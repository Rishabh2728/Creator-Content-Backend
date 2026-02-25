import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import assetRoutes from "./routes/assetRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import coinsRoutes from "./routes/coinsRoutes.js";
import paymentsRoutes from "./routes/paymentsRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import { syncCoinPlansCatalog } from "./services/coinPlanCatalogService.js";
import authMiddleware from "./middlewares/authMiddleware.js";
import { getCoinWalletController } from "./controllers/coinsController.js";
import {
  createRazorpayOrderController,
  verifyRazorpayPaymentController,
} from "./controllers/paymentsController.js";

const app = express();
let coinPlansSyncPromise = null;
let coinPlansSynced = false;

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:5173,http://localhost:3000,https://creator-connect-frontend.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Webhooks need raw body, so mount before express.json().
app.use("/api/webhooks", webhookRoutes);
app.use("/webhooks", webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(async (req, res, next) => {
  try {
    if (!coinPlansSynced) {
      if (!coinPlansSyncPromise) {
        coinPlansSyncPromise = syncCoinPlansCatalog()
          .then(() => {
            coinPlansSynced = true;
          })
          .finally(() => {
            coinPlansSyncPromise = null;
          });
      }
      await coinPlansSyncPromise;
    }
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/", (req, res) => {
  res.send("API running...");
});

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy" });
});

// Direct hard-wired endpoints for frontend compatibility.
app.get("/api/coins/wallet", authMiddleware, getCoinWalletController);
app.post(
  "/api/payments/razorpay/order",
  authMiddleware,
  createRazorpayOrderController
);
app.post(
  "/api/payments/razorpay/verify",
  authMiddleware,
  verifyRazorpayPaymentController
);

app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/coins", coinsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/coins", coinsRoutes);
app.use("/payments", paymentsRoutes);

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend connected successfully" });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message =
    err.message ||
    err?.error?.description ||
    err?.description ||
    "Internal Server Error";

  console.error("[api][error]", {
    path: req.originalUrl,
    method: req.method,
    statusCode,
    message,
    details: err?.error || null,
  });

  res.status(statusCode).json({
    success: false,
    message,
  });
});

export default app;
