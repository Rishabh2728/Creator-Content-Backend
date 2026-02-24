import HttpError from "../utils/httpError.js";

export const COIN_PLAN_MAP = Object.freeze({
  "coins-199": Object.freeze({
    id: "coins-199",
    amountInRupees: 199,
    amountPaise: 19900,
    currency: "INR",
    baseCoins: 200,
    bonusCoins: 20,
  }),
  "coins-399": Object.freeze({
    id: "coins-399",
    amountInRupees: 399,
    amountPaise: 39900,
    currency: "INR",
    baseCoins: 450,
    bonusCoins: 60,
  }),
  "coins-599": Object.freeze({
    id: "coins-599",
    amountInRupees: 599,
    amountPaise: 59900,
    currency: "INR",
    baseCoins: 750,
    bonusCoins: 150,
  }),
});

export const getCoinPlan = (planId) => {
  const rawPlanId = String(planId || "").trim().toLowerCase();
  let normalizedPlanId = rawPlanId;

  if (!normalizedPlanId) {
    throw new HttpError(400, "planId is required");
  }

  normalizedPlanId = normalizedPlanId.replace(/_/g, "-");
  if (/^\d+$/.test(normalizedPlanId)) {
    normalizedPlanId = `coins-${normalizedPlanId}`;
  }
  if (/^coins\d+$/.test(normalizedPlanId)) {
    normalizedPlanId = normalizedPlanId.replace(/^coins/, "coins-");
  }

  const aliasToPlanId = {
    starter: "coins-199",
    growth: "coins-399",
    pro: "coins-599",
  };
  normalizedPlanId = aliasToPlanId[normalizedPlanId] || normalizedPlanId;

  const plan = COIN_PLAN_MAP[normalizedPlanId];

  if (!plan) {
    throw new HttpError(
      400,
      "Invalid planId. Allowed: coins-199, coins-399, coins-599"
    );
  }

  return {
    ...plan,
    totalCoins: plan.baseCoins + plan.bonusCoins,
  };
};

export default COIN_PLAN_MAP;
