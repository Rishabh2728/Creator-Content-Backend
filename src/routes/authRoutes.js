import { Router } from "express";
import {
  sendOtpController,
  verifyOtpController,
  registerController,
  loginController,
} from "../controllers/authController.js";

const router = Router();

router.post("/send-otp", sendOtpController);
router.post("/verify-otp", verifyOtpController);
router.post("/register", registerController);
router.post("/signup", registerController);
router.post("/login", loginController);
router.post("/signin", loginController);

export default router;
