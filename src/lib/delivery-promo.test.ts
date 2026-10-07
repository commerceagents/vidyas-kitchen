import { computeOrderBreakdownFromItemSubtotal, ORDER_DELIVERY_INR } from "./order-pricing";

function check(name: string, ok: boolean) {
  if (!ok) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

const promo = { active: true, discountInr: 35, minOrderInr: 500 };

check("off when toggle is off", computeOrderBreakdownFromItemSubtotal(600).delivery === ORDER_DELIVERY_INR);
check(
  "free delivery above min order",
  computeOrderBreakdownFromItemSubtotal(600, { deliveryPromo: promo }).delivery === 0,
);
check(
  "full fee below min order",
  computeOrderBreakdownFromItemSubtotal(499, { deliveryPromo: promo }).delivery === ORDER_DELIVERY_INR,
);
check(
  "partial waiver",
  computeOrderBreakdownFromItemSubtotal(600, {
    deliveryPromo: { active: true, discountInr: 20, minOrderInr: 0 },
  }).delivery === 15,
);

if (process.exitCode) process.exit(process.exitCode);
console.log("delivery promo tests passed");
