import HttpError from "../utils/httpError.js";
import paymentService from "../services/paymentService.js";
import { syncCoinPlansCatalog } from "../services/coinPlanCatalogService.js";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolvePlanIdFromNumericHints = (payload = {}) => {
  const amountCandidates = [
    payload?.amountInRupees,
    payload?.amount,
    payload?.price,
    payload?.planAmount,
    payload?.data?.amountInRupees,
    payload?.plan?.amountInRupees,
    payload?.selectedPlan?.amountInRupees,
  ]
    .map(toNumber)
    .filter((value) => value !== null);

  for (const amount of amountCandidates) {
    if (amount === 199 || amount === 19900) return "coins-199";
    if (amount === 399 || amount === 39900) return "coins-399";
    if (amount === 599 || amount === 59900) return "coins-599";
  }

  const totalCoinsCandidates = [
    payload?.totalCoins,
    payload?.coins,
    payload?.coinCount,
    payload?.data?.totalCoins,
    payload?.plan?.totalCoins,
    payload?.selectedPlan?.totalCoins,
  ]
    .map(toNumber)
    .filter((value) => value !== null);

  for (const totalCoins of totalCoinsCandidates) {
    if (totalCoins === 220) return "coins-199";
    if (totalCoins === 510) return "coins-399";
    if (totalCoins === 900) return "coins-599";
  }

  return "";
};

const normalizePayload = (payload) => {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload && typeof payload === "object" ? payload : {};
};

const resolvePlanId = (payload, req) => {
  return (
    payload?.planId ||
    payload?.id ||
    payload?.plan ||
    payload?.plan?.id ||
    payload?.selectedPlanId ||
    payload?.selectedPlan?.id ||
    payload?.data?.planId ||
    req.query?.planId ||
    resolvePlanIdFromNumericHints(payload) ||
    ""
  );
};

export const createRazorpayOrderController = async (req, res, next) => {
  try {
    await syncCoinPlansCatalog();
    const payload = normalizePayload(req.body);
    const planId = resolvePlanId(payload, req);
    if (!planId) {
      throw new HttpError(
        400,
        "planId is required. Send planId (coins-199/coins-399/coins-599) or plan amount (199/399/599)."
      );
    }

    const data = await paymentService.createRazorpayOrder({
      userId: req.user._id,
      planId,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyRazorpayPaymentController = async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    const {
      razorpay_order_id: razorpayOrderIdFromBody,
      razorpay_payment_id: razorpayPaymentIdFromBody,
      razorpay_signature: razorpaySignatureFromBody,
    } = payload;
    const planId = resolvePlanId(payload, req);
    const razorpayOrderId =
      razorpayOrderIdFromBody || payload?.razorpayOrderId || req.query?.razorpay_order_id;
    const razorpayPaymentId =
      razorpayPaymentIdFromBody || payload?.razorpayPaymentId || req.query?.razorpay_payment_id;
    const razorpaySignature =
      razorpaySignatureFromBody || payload?.razorpaySignature || req.query?.razorpay_signature;

    if (!planId) {
      throw new HttpError(400, "planId is required");
    }

    const data = await paymentService.verifyRazorpayAndCreditCoins({
      userId: req.user._id,
      planId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    res.status(200).json({
      success: true,
      message: "Payment verified and coins credited",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createRazorpayOrderController,
  verifyRazorpayPaymentController,
};
