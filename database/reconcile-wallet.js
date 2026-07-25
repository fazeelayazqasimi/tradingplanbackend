const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const WalletTransaction = require('../models/WalletTransaction');
const CoursePurchase = require('../models/CoursePurchase');
const Wallet = require('../models/Wallet');

const reconcile = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected...\n');

    const purchases = await CoursePurchase.find({}).lean();
    const purchaseUserIds = new Set();
    purchases.forEach(p => purchaseUserIds.add(p.userId.toString()));

    const orphanedTransactions = await WalletTransaction.find({
      type: 'debit',
      category: 'purchase',
      referenceModel: 'CoursePurchase',
      status: 'completed'
    }).lean();

    const fixed = [];
    for (const tx of orphanedTransactions) {
      if (tx.referenceId && purchaseUserIds.has(tx.userId.toString())) {
        const purchase = await CoursePurchase.findById(tx.referenceId);
        if (!purchase) {
          await Wallet.findOneAndUpdate(
            { userId: tx.userId },
            {
              $inc: {
                availableBalance: tx.amount,
                totalEarned: tx.amount
              }
            }
          );
          await WalletTransaction.create({
            walletId: tx.walletId,
            userId: tx.userId,
            type: 'credit',
            category: 'refund',
            amount: tx.amount,
            balanceAfter: 0,
            description: `Auto-refund: orphaned debit (${tx.description || 'failed purchase'})`,
            referenceModel: 'WalletTransaction',
            referenceId: tx._id,
            status: 'completed'
          });
          fixed.push({ userId: tx.userId, amount: tx.amount, transactionId: tx._id });
          console.log(`Refunded $${tx.amount} to user ${tx.userId} (orphaned debit)`);
        }
      }
    }

    if (fixed.length === 0) {
      console.log('No orphaned transactions found. Everything looks clean!');
    } else {
      console.log(`\n✅ Refunded ${fixed.length} orphaned transaction(s).`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Reconciliation error:', error);
    process.exit(1);
  }
};

reconcile();
