import mongoose from "mongoose";

const coinPlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    amountInRupees: {
      type: Number,
      required: true,
      min: 1,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
      trim: true,
    },
    baseCoins: {
      type: Number,
      required: true,
      min: 1,
    },
    bonusCoins: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCoins: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const CoinPlan =
  mongoose.models.CoinPlan || mongoose.model("CoinPlan", coinPlanSchema);

export default CoinPlan;

