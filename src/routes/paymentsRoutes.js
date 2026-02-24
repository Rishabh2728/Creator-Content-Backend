import express, { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  createRazorpayOrderController,
  verifyRazorpayPaymentController,
} from "../controllers/paymentsController.js";

const router = Router();

router.use(authMiddleware);

// Fallback parser for clients that send JSON without content-type header.
router.post(
  "/razorpay/order",
  express.text({ type: "*/*" }),
  createRazorpayOrderController
);
router.post(
  "/razorpay/verify",
  express.text({ type: "*/*" }),
  verifyRazorpayPaymentController
);

export default router;
