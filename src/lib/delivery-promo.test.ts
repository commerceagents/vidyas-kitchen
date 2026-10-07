import {
  BASE_DELIVERY_INR,
  deliveryPromoFromMode,
  deliveryPromoMode,
  deliveryPromoSummary,
} from "./delivery-promo";
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

check(
  "free-over-min mode sets full waiver",
  deliveryPromoFromMode("free_over_min", 500).discountInr === BASE_DELIVERY_INR &&
    deliveryPromoFromMode("free_over_min", 500).minOrderInr === 500,
);
check(
  "flat-off mode clears minimum",
  deliveryPromoFromMode("flat_off", 20).discountInr === 20 &&
    deliveryPromoFromMode("flat_off", 20).minOrderInr === 0,
);
check(
  "saved min order maps to free-over-min mode",
  deliveryPromoMode({ active: true, discountInr: 35, minOrderInr: 500 }) === "free_over_min",
);
check(
  "saved flat discount maps to flat-off mode",
  deliveryPromoMode({ active: true, discountInr: 20, minOrderInr: 0 }) === "flat_off",
);
check(
  "summary says free delivery over minimum",
  deliveryPromoSummary({ active: true, discountInr: 35, minOrderInr: 500 }) ===
    "Free delivery on orders over ₹500",
);

if (process.exitCode) process.exit(process.exitCode);
console.log("delivery promo tests passed");
