import coinWalletService from "../services/coinWalletService.js";
import { syncCoinPlansCatalog } from "../services/coinPlanCatalogService.js";
import CoinPlan from "../models/coinPlan.js";

export const getCoinWalletController = async (req, res, next) => {
  try {
    await syncCoinPlansCatalog();
    const wallet = await coinWalletService.ensureWalletWithFreeGrant(req.user._id);

    res.status(200).json({
      success: true,
      data: coinWalletService.toWalletResponse(wallet),
    });
  } catch (error) {
    next(error);
  }
};

export const listCoinPlansController = async (req, res, next) => {
  try {
    await syncCoinPlansCatalog();
    const plans = await CoinPlan.find({ isActive: true })
      .select(
        "planId amountInRupees amountPaise currency baseCoins bonusCoins totalCoins isActive"
      )
      .sort({ amountPaise: 1 });

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getCoinWalletController,
  listCoinPlansController,
};
