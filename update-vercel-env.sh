#!/bin/bash
echo "Updating Vercel environment variables..."
vercel env rm WHATSAPP_ACCESS_TOKEN production -y
vercel env rm WHATSAPP_PHONE_NUMBER_ID production -y
vercel env rm WHATSAPP_BUSINESS_ACCOUNT_ID production -y

echo "EAATibYTTUqUBSAmERTW4TwZBCEQO1LwAjVgZAFZAYoZCiKb4pfBc9nP6QMOm17uv6uKCtJA7CqYxnkT4xN0p7GCm8g0yMKd2ZA8RAsCFvnD7VZAZApbAnZBVvW3ie41bjY8ZAuN58xADaRbXpQDfQLz2LPUTBZChcDp5YBckdNzSZAFaSMxZC2kqYcC3LM8NO4UnwgZDZD" | vercel env add WHATSAPP_ACCESS_TOKEN production
echo "121690616211d238" | vercel env add WHATSAPP_PHONE_NUMBER_ID production
echo "280121587284723d2" | vercel env add WHATSAPP_BUSINESS_ACCOUNT_ID production
