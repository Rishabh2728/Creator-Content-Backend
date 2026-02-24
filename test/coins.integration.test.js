import crypto from "crypto";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import CoinWallet from "../src/models/coinWallet.js";
import CoinLedger from "../src/models/coinLedger.js";
import PaymentTransaction from "../src/models/paymentTransaction.js";
import coinWalletService from "../src/services/coinWalletService.js";
import paymentService from "../src/services/paymentService.js";
import HttpError from "../src/utils/httpError.js";

const testUserId = new mongoose.Types.ObjectId();

const makeWalletDoc = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  userId: testUserId,
  remainingCoins: 20,
  freeGrantApplied: true,
  totalCoinsPurchased: 0,
  totalCoinsUsed: 0,
  ...overrides,
});

test("one-time free grant applies only once", async (t) => {
  let updateCount = 0;
  let ledgerCount = 0;

  t.mock.method(CoinWallet, "updateOne", async (query) => {
    updateCount += 1;
    if (query?.freeGrantApplied === false) {
      return { modifiedCount: updateCount === 2 ? 1 : 0 };
    }
    return { modifiedCount: 0 };
  });

  t.mock.method(CoinWallet, "findOne", async () => makeWalletDoc({ remainingCoins: 20 }));

  t.mock.method(CoinLedger, "create", async () => {
    ledgerCount += 1;
    return [];
  });

  const first = await coinWalletService.ensureWalletWithFreeGrant(testUserId);
  const second = await coinWalletService.ensureWalletWithFreeGrant(testUserId);

  assert.equal(first.remainingCoins, 20);
  assert.equal(second.remainingCoins, 20);
  assert.equal(ledgerCount, 1);
});

test("message debit throws 402 when wallet has no coins", async (t) => {
  t.mock.method(CoinWallet, "updateOne", async (query) => {
    if (query?.freeGrantApplied === false) {
      return { modifiedCount: 0 };
    }
    return { modifiedCount: 0 };
  });

  t.mock.method(CoinWallet, "findOne", async () =>
    makeWalletDoc({ remainingCoins: 0, freeGrantApplied: true }),
  );

  t.mock.method(CoinWallet, "findOneAndUpdate", async () => null);
  t.mock.method(CoinLedger, "create", async () => []);

  await assert.rejects(
    () => coinWalletService.debitCoinForMessageSend({ userId: testUserId }),
    (error) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 402);
      assert.match(error.message, /Insufficient coins/);
      return true;
    },
  );
});

test("payment verify credits once and duplicate verify does not double-credit", async (t) => {
  process.env.RAZORPAY_KEY_SECRET = "test_secret";

  let findPaymentCalls = 0;
  let paymentUpdateCalls = 0;
  let ledgerCredits = 0;

  const orderId = "order_abc";
  const paymentId = "pay_abc";
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  t.mock.method(PaymentTransaction, "findOne", async () => {
    findPaymentCalls += 1;
    return {
      _id: new mongoose.Types.ObjectId(),
      userId: testUserId,
      planId: "coins-199",
      coinsCredited: findPaymentCalls > 1,
    };
  });

  t.mock.method(PaymentTransaction, "updateOne", async () => {
    paymentUpdateCalls += 1;
    return { modifiedCount: paymentUpdateCalls === 1 ? 1 : 0 };
  });

  // creditCoinsForPlanPurchase path
  t.mock.method(CoinWallet, "findOneAndUpdate", async () =>
    makeWalletDoc({ remainingCoins: 220, totalCoinsPurchased: 220 }),
  );

  // ensureWalletDoc + ensureWalletWithFreeGrant path
  t.mock.method(CoinWallet, "updateOne", async () => ({ modifiedCount: 0 }));
  t.mock.method(CoinWallet, "findOne", async () =>
    makeWalletDoc({ remainingCoins: 220, freeGrantApplied: true }),
  );

  t.mock.method(CoinLedger, "create", async (docs) => {
    if (docs?.[0]?.source === "PLAN_PURCHASE") {
      ledgerCredits += 1;
    }
    return [];
  });

  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  }));

  const first = await paymentService.verifyRazorpayAndCreditCoins({
    userId: testUserId,
    planId: "coins-199",
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: signature,
  });

  const second = await paymentService.verifyRazorpayAndCreditCoins({
    userId: testUserId,
    planId: "coins-199",
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: signature,
  });

  assert.equal(first.wallet.remainingCoins, 220);
  assert.equal(second.wallet.remainingCoins, 220);
  assert.equal(ledgerCredits, 1);
});
