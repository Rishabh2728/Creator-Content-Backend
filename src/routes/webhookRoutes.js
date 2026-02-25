import express, { Router } from "express";
import { razorpayWebhookController } from "../controllers/webhookController.js";

const router = Router();

// Razorpay signature verification requires raw request body.
router.post("/razorpay", express.raw({ type: "*/*" }), razorpayWebhookController);

export default router;

