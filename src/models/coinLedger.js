import mongoose from "mongoose";

const coinLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },
    source: {
      type: String,
      enum: ["FREE_GRANT", "MESSAGE_SEND", "PLAN_PURCHASE"],
      required: true,
    },
    coins: {
      type: Number,
      required: true,
      min: 1,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    refType: {
      type: String,
      default: null,
      trim: true,
    },
    refId: {
      type: String,
      default: null,
      trim: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

coinLedgerSchema.index({ userId: 1, createdAt: -1 });
coinLedgerSchema.index({ refType: 1, refId: 1 });

const CoinLedger =
  mongoose.models.CoinLedger || mongoose.model("CoinLedger", coinLedgerSchema);

export default CoinLedger;

