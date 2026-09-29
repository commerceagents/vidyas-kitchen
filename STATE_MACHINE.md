# WhatsApp conversation states

Every free-text message is classified before the pending question is allowed to consume it. The current state is a hint. It is not a filter.

A button or list tap is already a direct answer, so it skips classification and runs the action on that id.

## Classifier

Local rules run first. A day, a slot, a short yes/no, or an obvious cart edit does not wait on a model. Any other sentence of three or more words, during a pending state, is sent to `gpt-4o-mini` with this system prompt:

> You are analyzing a user's WhatsApp message in the context of an ongoing food order conversation. The bot's last message and current pending state are provided. Do NOT assume the user is answering the pending question — evaluate what they actually said. Set `matches_pending_state: true` ONLY if the message is clearly a direct answer to what was asked (e.g., a day/date when asked 'when would you like it'). If the user is asking to change the cart, asking something else, or expressing a different intent, classify that intent instead, even if a question is still pending.

The model returns `intent`, `matches_pending_state`, `extracted_value`, `item_reference`, and `quantity`. Item ids are never taken from the model. Cart lines are matched in code.

## States

| State | How the chat got here | Question still open |
|---|---|---|
| `idle` | Welcome, or a cleared checkout | None. The next message starts an order. |
| `browsing_category` | Menu | Which category |
| `picking_item` | A category | Which dish |
| `picking_variant` | A dish | 500gm or 1kg |
| `picking_qty` | A size | How many |
| `cart_review` | Something landed in the cart | Checkout, add, or clear. Cart edits are applied here directly. |
| `confirming_last` | Checkout, and a previous address exists | Same as last time, or change it |
| `picking_date` | Checkout needs a day | When would you like it |
| `picking_slot` | A day was saved | Breakfast, lunch, or dinner |
| `picking_address` | A slot was saved | Delivery address, or a shared pin |
| `picking_pay_method` | Address saved | Pay online or cash |
| `awaiting_payment` | Online payment link sent | Pay, or change the order. No second order is created. |
| `confirming_proposal` | A typed order was priced | Confirm. The order row is written only on that tap. |
| `rating_comment` | Stars arrived for a delivered order | One line about the meal. Not interrupted. |
| `ai_chat` | A sentence that is not inside a slot | Whatever they just said |

`rating_comment` stays rigid on purpose: that one line is stored as the review.

## Router

Pending states are `picking_date`, `picking_slot`, `picking_address`, `picking_pay_method`, `awaiting_payment`, `confirming_last`, `confirming_proposal`, `picking_variant`, and `picking_qty`.

| Incoming intent | What happens |
|---|---|
| `answer_pending_question` | Save the answer and move to the next step. Interrupt count goes back to 0. |
| `remove_item`, `edit_cart`, `add_item` | Do the cart change, confirm it, then ask the pending question again. |
| `ask_menu` | Answer with the chicken / mutton / egg line, then ask again. |
| `ask_status` | Read out open orders, then ask again. |
| `cancel_order` | Clear the cart and the pending question. Nothing is sent to the kitchen. |
| `complaint` | Leave the slot immediately and ask what happened. This does not wait behind the pending question. |
| `checkout` or `small_talk` | The pending question is asked again. Checkout words do not place the order. |
| `unclear` | Say that this message was not understood, quoting it, then ask the pending question again. The old question is not repeated as if the message never arrived. |

After any interruption that does not finish the slot, the pending question is sent again in the same turn.

A sentence like "remove the mom's chicken 1kg and keep 3 of the 500gm" removes only the 1kg line and sets the 500gm line to 3, then asks for the day again.

## Escalation

`interrupted_count` is stored on the session as a note inside `recent_turns` (`__vk_interrupt__:STATE:COUNT`). It does not need a new database column. A successful answer clears it.

The same pending question, interrupted 3 times without an answer, stops asking. The customer gets the "Passing this to the team" message with the kitchen phone and email. A row is written to `customer_complaints` with the state and the last message. The cart is kept. No WhatsApp is sent to the kitchen number, because that would be a free-form message outside the customer's thread.

The count is per question. Moving from the day to the slot starts a new count.
