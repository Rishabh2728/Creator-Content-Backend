import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import { syncCoinPlansCatalog } from "../src/services/coinPlanCatalogService.js";
import CoinPlan from "../src/models/coinPlan.js";

const run = async () => {
  try {
    await connectDB();
    await syncCoinPlansCatalog();

    const plans = await CoinPlan.find({})
      .select("planId amountInRupees baseCoins bonusCoins totalCoins isActive")
      .sort({ amountInRupees: 1 });

    console.log("Coin plans seeded/updated:");
    console.table(
      plans.map((p) => ({
        planId: p.planId,
        amountInRupees: p.amountInRupees,
        baseCoins: p.baseCoins,
        bonusCoins: p.bonusCoins,
        totalCoins: p.totalCoins,
        isActive: p.isActive,
      }))
    );
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Failed to seed coin plans:", error.message);
  process.exit(1);
});

