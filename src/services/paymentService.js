import crypto from "crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import { getCoinPlan } from "../config/coinPlans.js";
import PaymentTransaction from "../models/paymentTransaction.js";
import HttpError from "../utils/httpError.js";
import { creditCoinsForPlanPurchase, ensureWalletWithFreeGrant } from "./coinWalletService.js";

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new HttpError(
      500,
      "Razorpay credentials missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

const validateAndBuildSignature = (orderId, paymentId) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keySecret) {
    throw new HttpError(
      500,
      "Razorpay secret missing. Set RAZORPAY_KEY_SECRET."
    );
  }
  return crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
};

export const createRazorpayOrder = async ({ userId, planId }) => {
  const plan = getCoinPlan(planId);
  const razorpay = getRazorpayClient();
  const shortUserId = String(userId).slice(-8);
  const shortTs = Date.now().toString().slice(-10);
  const receipt = `cc_${shortUserId}_${shortTs}`.slice(0, 40);
  let order;
  try {
    order = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: plan.currency,
      receipt,
      notes: {
        userId: String(userId),
        planId: plan.id,
      },
    });
  } catch (error) {
    const gatewayMessage =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      "Razorpay order creation failed";
    throw new HttpError(502, gatewayMessage);
  }

  await PaymentTransaction.create({
    userId,
    planId: plan.id,
    razorpayOrderId: order.id,
    amountPaise: order.amount,
    currency: order.currency || plan.currency,
    status: "CREATED",
    coinsCredited: false,
  });

  return {
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency || plan.currency,
    },
  };
};

export const verifyRazorpayAndCreditCoins = async ({
  userId,
  planId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new HttpError(
      400,
      "razorpay_order_id, razorpay_payment_id and razorpay_signature are required"
    );
  }

  const plan = getCoinPlan(planId);
  const expectedSignature = validateAndBuildSignature(
    razorpayOrderId,
    razorpayPaymentId
  );

  const providedBuffer = Buffer.from(String(razorpaySignature));
  const expectedBuffer = Buffer.from(String(expectedSignature));
  const signatureValid =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!signatureValid) {
    await PaymentTransaction.updateOne(
      { userId, razorpayOrderId },
      {
        $set: {
          status: "FAILED",
          razorpayPaymentId,
          razorpaySignature,
        },
      }
    );
    throw new HttpError(400, "Invalid Razorpay signature");
  }

  const session = await mongoose.startSession();
  try {
    let walletResult = null;
    await session.withTransaction(async () => {
      const payment = await PaymentTransaction.findOne(
        { userId, razorpayOrderId },
        null,
        { session }
      );

      if (!payment) {
        throw new HttpError(404, "Payment order not found for this user");
      }

      if (payment.planId !== plan.id) {
        throw new HttpError(400, "planId does not match payment order");
      }

      if (payment.coinsCredited) {
        const existingWallet = await ensureWalletWithFreeGrant(userId, session);
        walletResult = existingWallet;
        return;
      }

      const updateResult = await PaymentTransaction.updateOne(
        {
          _id: payment._id,
          coinsCredited: false,
        },
        {
          $set: {
            razorpayPaymentId,
            razorpaySignature,
            status: "VERIFIED",
            coinsCredited: true,
          },
        },
        { session }
      );

      if (updateResult.modifiedCount === 0) {
        const existingWallet = await ensureWalletWithFreeGrant(userId, session);
        walletResult = existingWallet;
        return;
      }

      walletResult = await creditCoinsForPlanPurchase({
        userId,
        plan,
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        session,
      });
    });

    return {
      wallet: {
        remainingCoins: walletResult?.remainingCoins || 0,
      },
    };
  } catch (error) {
    if (error?.code === 11000) {
      throw new HttpError(
        409,
        "Duplicate payment verification attempt detected"
      );
    }
    const gatewayMessage =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      null;
    if (gatewayMessage && !(error instanceof HttpError)) {
      throw new HttpError(502, gatewayMessage);
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export default {
  createRazorpayOrder,
  verifyRazorpayAndCreditCoins,
};
