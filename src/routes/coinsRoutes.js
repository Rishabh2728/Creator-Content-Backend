import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  getCoinWalletController,
  listCoinPlansController,
} from "../controllers/coinsController.js";

const router = Router();

router.use(authMiddleware);

router.get("/wallet", getCoinWalletController);
router.get("/plans", listCoinPlansController);

export default router;
