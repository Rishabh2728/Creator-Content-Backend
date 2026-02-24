import CoinLedger from "../models/coinLedger.js";
import CoinWallet from "../models/coinWallet.js";
import HttpError from "../utils/httpError.js";

export const FREE_GRANT_COINS = 20;
export const MESSAGE_COST_COINS = 1;

const walletPublicFields = (walletDoc) => ({
  remainingCoins: walletDoc.remainingCoins,
  freeGrantApplied: walletDoc.freeGrantApplied,
  totalCoinsPurchased: walletDoc.totalCoinsPurchased,
  totalCoinsUsed: walletDoc.totalCoinsUsed,
});

const normalizeSession = (session) => (session ? { session } : {});

const ensureWalletDoc = async (userId, session = null) => {
  await CoinWallet.updateOne(
    { userId },
    {
      $setOnInsert: {
        userId,
        remainingCoins: 0,
        freeGrantApplied: false,
        totalCoinsPurchased: 0,
        totalCoinsUsed: 0,
      },
    },
    { upsert: true, ...normalizeSession(session) }
  );

  return CoinWallet.findOne({ userId }, null, normalizeSession(session));
};

export const ensureWalletWithFreeGrant = async (userId, session = null) => {
  await ensureWalletDoc(userId, session);

  const grantResult = await CoinWallet.updateOne(
    { userId, freeGrantApplied: false },
    {
      $inc: { remainingCoins: FREE_GRANT_COINS },
      $set: { freeGrantApplied: true },
    },
    normalizeSession(session)
  );

  const wallet = await CoinWallet.findOne({ userId }, null, normalizeSession(session));

  if (!wallet) {
    throw new HttpError(500, "Unable to initialize coin wallet");
  }

  if (grantResult.modifiedCount > 0) {
    await CoinLedger.create(
      [
        {
          userId,
          type: "CREDIT",
          source: "FREE_GRANT",
          coins: FREE_GRANT_COINS,
          balanceAfter: wallet.remainingCoins,
          refType: "wallet",
          refId: String(wallet._id),
          meta: { reason: "one_time_welcome_grant" },
        },
      ],
      normalizeSession(session)
    );
  }

  return wallet;
};

export const debitCoinForMessageSend = async ({
  userId,
  messageRefId = null,
  session = null,
}) => {
  await ensureWalletWithFreeGrant(userId, session);

  const wallet = await CoinWallet.findOneAndUpdate(
    {
      userId,
      remainingCoins: { $gte: MESSAGE_COST_COINS },
    },
    {
      $inc: {
        remainingCoins: -MESSAGE_COST_COINS,
        totalCoinsUsed: MESSAGE_COST_COINS,
      },
    },
    { new: true, ...normalizeSession(session) }
  );

  if (!wallet) {
    throw new HttpError(
      402,
      "Insufficient coins. Buy a plan to continue messaging."
    );
  }

  await CoinLedger.create(
    [
      {
        userId,
        type: "DEBIT",
        source: "MESSAGE_SEND",
        coins: MESSAGE_COST_COINS,
        balanceAfter: wallet.remainingCoins,
        refType: "message",
        refId: messageRefId ? String(messageRefId) : null,
        meta: { costPerMessage: MESSAGE_COST_COINS },
      },
    ],
    normalizeSession(session)
  );

  return wallet;
};

export const creditCoinsForPlanPurchase = async ({
  userId,
  plan,
  orderId,
  paymentId,
  session = null,
}) => {
  const totalCoins = Number(plan?.totalCoins || 0);
  if (!totalCoins || totalCoins < 1) {
    throw new HttpError(500, "Invalid coin credit amount");
  }

  await ensureWalletDoc(userId, session);

  const wallet = await CoinWallet.findOneAndUpdate(
    { userId },
    {
      $inc: {
        remainingCoins: totalCoins,
        totalCoinsPurchased: totalCoins,
      },
    },
    { new: true, ...normalizeSession(session) }
  );

  if (!wallet) {
    throw new HttpError(500, "Unable to credit wallet");
  }

  await CoinLedger.create(
    [
      {
        userId,
        type: "CREDIT",
        source: "PLAN_PURCHASE",
        coins: totalCoins,
        balanceAfter: wallet.remainingCoins,
        refType: "payment",
        refId: paymentId || orderId,
        meta: {
          orderId,
          paymentId,
          planId: plan.id,
          amountPaise: plan.amountPaise,
          baseCoins: plan.baseCoins,
          bonusCoins: plan.bonusCoins,
        },
      },
    ],
    normalizeSession(session)
  );

  return wallet;
};

export const toWalletResponse = (walletDoc) => ({
  wallet: walletPublicFields(walletDoc),
});

export default {
  ensureWalletWithFreeGrant,
  debitCoinForMessageSend,
  creditCoinsForPlanPurchase,
  toWalletResponse,
};

