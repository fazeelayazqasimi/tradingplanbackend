const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const UserRank = require('../models/UserRank');
const Rank = require('../models/Rank');
const Subscription = require('../models/Subscription');
const Setting = require('../models/Setting');

const { verifyIPN, parseIPNBody, getStatusFromIPN } = require('../services/coinPaymentService');
const { processReferralCommission } = require('../services/referralService');
const { sendAccountApprovedEmail } = require('../services/emailService');

const getPlanDays = async (plan) => {
  const setting = await Setting.findOne({ key: `plan_days_${plan}` });
  return (setting && Number(setting.value)) || 365;
};

const handleDepositIPN = async (ipnData) => {
  const txnId = ipnData.txn_id;
  const customRef = ipnData.custom;
  const statusCode = parseInt(ipnData.status, 10);
  const statusText = ipnData.status_text || '';
  const amount1 = parseFloat(ipnData.amount1) || 0;
  const amount2 = parseFloat(ipnData.amount2) || 0;
  const currency1 = ipnData.currency1 || '';
  const currency2 = ipnData.currency2 || '';
  const confirmsNeeded = parseInt(ipnData.confirms_needed, 10) || 0;
  const confirmsReceived = parseInt(ipnData.confirms_received, 10) || 0;

  let deposit;

  if (txnId) {
    deposit = await Deposit.findOne({ coinPaymentsTxnId: txnId });
  }

  if (!deposit && customRef) {
    deposit = await Deposit.findOne({ coinPaymentRef: customRef });
  }

  if (!deposit) {
    console.warn(`[CoinPayments Webhook] No deposit found for txnId=${txnId} custom=${customRef}`);
    return { handled: false, reason: 'deposit_not_found' };
  }

  if (deposit.webhookProcessed && statusCode < -1) {
    console.log(`[CoinPayments Webhook] Deposit ${deposit._id} already processed, skipping`);
    return { handled: true, action: 'already_processed' };
  }

  deposit.coinPaymentsTxnId = txnId || deposit.coinPaymentsTxnId;
  deposit.confirmsNeeded = confirmsNeeded;
  deposit.confirmsReceived = confirmsReceived;

  const mappedStatus = getStatusFromIPN(statusCode);

  if (mappedStatus === 'completed') {
    if (!deposit.webhookProcessed) {
      deposit.status = 'approved';
      deposit.webhookProcessed = true;
      deposit.processedAt = new Date();
      await deposit.save();

      const walletType = deposit.walletType || 'funding';
      let wallet = await Wallet.findOne({ userId: deposit.userId, type: walletType });
      if (!wallet) {
        wallet = await Wallet.create({ userId: deposit.userId, type: walletType });
      }

      wallet.availableBalance += deposit.amount;
      wallet.totalEarned += deposit.amount;
      wallet.lastCreditAt = new Date();
      await wallet.save();

      await WalletTransaction.create({
        walletId: wallet._id,
        userId: deposit.userId,
        type: 'credit',
        category: 'deposit',
        amount: deposit.amount,
        balanceAfter: wallet.availableBalance,
        description: `Deposit completed via CoinPayments - ${deposit.amount}`,
        referenceId: deposit._id,
        referenceModel: 'Deposit',
        status: 'completed',
      });

      const pendingSub = await Subscription.findOne({
        userId: deposit.userId,
        status: 'pending',
      }).sort({ createdAt: -1 });

      if (pendingSub) {
        pendingSub.status = 'active';
        pendingSub.startDate = new Date();
        pendingSub.endDate = new Date(Date.now() + (await getPlanDays(pendingSub.plan)) * 24 * 60 * 60 * 1000);
        pendingSub.paymentMethod = 'crypto';
        pendingSub.transactionRef = `COIN-${txnId || deposit.coinPaymentRef}`;
        await pendingSub.save();

        await User.findByIdAndUpdate(deposit.userId, { isApproved: true, subscriptionStatus: 'active' });

        // Assign D1 rank if not exists
        try {
          const existingRank = await UserRank.findOne({ userId: deposit.userId });
          if (!existingRank) {
            const firstRank = await Rank.findOne({ isActive: true }).sort({ order: 1 });
            if (firstRank) {
              await UserRank.create({
                userId: deposit.userId,
                currentRankId: firstRank._id,
                rankHistory: [{
                  rankId: firstRank._id,
                  achievedAt: new Date(),
                  reason: `Assigned ${firstRank.name} via CoinPayments subscription`,
                  changeType: 'automatic'
                }]
              });
            }
          }
        } catch (e) {
          console.error('[WEBHOOK] UserRank creation error:', e.message);
        }

        const user = await User.findById(deposit.userId);
        sendAccountApprovedEmail(user).catch((e) => console.error('[EMAIL] sendAccountApprovedEmail:', e.message));

        try {
          await processReferralCommission(deposit.userId, pendingSub.amount, 'subscription');
        } catch (e) {
          console.error('[REFERRAL] processReferralCommission:', e.message);
        }

        console.log(`[CoinPayments] Subscription auto-activated for user ${deposit.userId}`);
      }

      console.log(`[CoinPayments] Deposit ${deposit._id} completed and wallet credited`);
    }
  } else if (mappedStatus === 'failed') {
    deposit.status = 'failed';
    await deposit.save();
    console.log(`[CoinPayments] Deposit ${deposit._id} failed: ${statusText}`);
  } else if (mappedStatus === 'pending' || mappedStatus === 'waiting') {
    if (deposit.status === 'pending') {
      await deposit.save();
    }
  }

  return { handled: true, status: mappedStatus };
};

const handleWithdrawalIPN = async (ipnData) => {
  const txnId = ipnData.txn_id;
  const statusCode = parseInt(ipnData.status, 10);
  const statusText = ipnData.status_text || '';

  if (!txnId) {
    return { handled: false, reason: 'no_txn_id' };
  }

  const withdrawal = await Withdrawal.findOne({ coinPaymentsTxnId: txnId });
  if (!withdrawal) {
    console.warn(`[CoinPayments Webhook] No withdrawal found for txnId=${txnId}`);
    return { handled: false, reason: 'withdrawal_not_found' };
  }

  const mappedStatus = getStatusFromIPN(statusCode);

  if (mappedStatus === 'completed') {
    withdrawal.status = 'paid';
    withdrawal.paidAt = new Date();
    console.log(`[CoinPayments] Withdrawal ${withdrawal._id} completed`);
  } else if (mappedStatus === 'failed') {
    withdrawal.status = 'failed';
    withdrawal.payoutError = statusText;

    const wallet = await Wallet.findOne({ userId: withdrawal.userId });
    if (wallet) {
      wallet.availableBalance += withdrawal.amount;
      wallet.pendingBalance -= withdrawal.amount;
      await wallet.save();
    }

    await WalletTransaction.create({
      walletId: wallet?._id,
      userId: withdrawal.userId,
      type: 'credit',
      category: 'withdrawal_refund',
      amount: withdrawal.amount,
      balanceAfter: wallet?.availableBalance || 0,
      description: `Withdrawal failed - refunded ${withdrawal.amount}`,
      referenceId: withdrawal._id,
      referenceModel: 'Withdrawal',
      status: 'completed',
    });

    console.log(`[CoinPayments] Withdrawal ${withdrawal._id} failed: ${statusText}`);
  } else if (mappedStatus === 'pending') {
    withdrawal.status = 'processing';
    console.log(`[CoinPayments] Withdrawal ${withdrawal._id} processing`);
  }

  await withdrawal.save();
  return { handled: true, status: mappedStatus };
};

exports.handleCoinPaymentsIPN = async (req, res) => {
  try {
    const bodyRaw = req.bodyRaw || req.rawBody || '';
    const headers = req.headers;

    if (!verifyIPN(bodyRaw, headers)) {
      console.error('[CoinPayments] Invalid HMAC signature');
      return res.status(403).send('HMAC verification failed');
    }

    const ipnData = parseIPNBody(bodyRaw);
    const ipnType = ipnData.ipn_type || ipnData.type || '';

    console.log(`[CoinPayments] IPN received: type=${ipnType} txn_id=${ipnData.txn_id} status=${ipnData.status}`);

    let result;
    if (ipnType === 'deposit' || ipnType === 'api') {
      result = await handleDepositIPN(ipnData);
    } else if (ipnType === 'withdrawal') {
      result = await handleWithdrawalIPN(ipnData);
    } else {
      console.log(`[CoinPayments] Unhandled IPN type: ${ipnType}`);
      result = { handled: false, reason: 'unhandled_type' };
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[CoinPayments] IPN handler error:', error);
    res.status(500).send('Internal error');
  }
};