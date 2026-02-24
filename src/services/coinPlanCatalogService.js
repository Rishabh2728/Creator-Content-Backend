import { COIN_PLAN_MAP } from "../config/coinPlans.js";
import CoinPlan from "../models/coinPlan.js";

export const syncCoinPlansCatalog = async () => {
  const plans = Object.values(COIN_PLAN_MAP);

  await Promise.all(
    plans.map((plan) =>
      CoinPlan.updateOne(
        { planId: plan.id },
        {
          $set: {
            amountInRupees: plan.amountInRupees,
            amountPaise: plan.amountPaise,
            currency: plan.currency,
            baseCoins: plan.baseCoins,
            bonusCoins: plan.bonusCoins,
            totalCoins: plan.baseCoins + plan.bonusCoins,
            isActive: true,
          },
          $setOnInsert: {
            planId: plan.id,
          },
        },
        { upsert: true }
      )
    )
  );
};

export default {
  syncCoinPlansCatalog,
};

