import mongoose from "mongoose";

const coinWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    remainingCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeGrantApplied: {
      type: Boolean,
      default: false,
    },
    totalCoinsPurchased: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCoinsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const CoinWallet =
  mongoose.models.CoinWallet || mongoose.model("CoinWallet", coinWalletSchema);

export default CoinWallet;

