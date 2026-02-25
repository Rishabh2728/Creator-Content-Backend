import paymentService from "../services/paymentService.js";

export const razorpayWebhookController = async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body;

    const payload = paymentService.parseWebhookPayload(rawBody);
    paymentService.verifyRazorpayWebhookSignature(rawBody, signature);

    const result = await paymentService.processRazorpayWebhookEvent(payload);

    res.status(200).json({
      success: true,
      message: "Webhook processed",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  razorpayWebhookController,
};

