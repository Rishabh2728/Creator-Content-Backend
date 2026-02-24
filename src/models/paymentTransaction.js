import mongoose from "mongoose";

const paymentTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: String,
      required: true,
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
      default: null,
    },
    razorpaySignature: {
      type: String,
      trim: true,
      default: null,
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
    status: {
      type: String,
      enum: ["CREATED", "VERIFIED", "FAILED"],
      default: "CREATED",
    },
    coinsCredited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

paymentTransactionSchema.index({ userId: 1, createdAt: -1 });
paymentTransactionSchema.index({ userId: 1, planId: 1, status: 1 });

const PaymentTransaction =
  mongoose.models.PaymentTransaction ||
  mongoose.model("PaymentTransaction", paymentTransactionSchema);

export default PaymentTransaction;
