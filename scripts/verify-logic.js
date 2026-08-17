/**
 * verify-logic.js — End-to-end verification of the GAP commission model,
 * rank qualification engine and wallet-activation flows.
 *
 * Runs against a SEPARATE test database:
 *   - TEST_MONGO_URI env var, or
 *   - MONGO_URI with the database name suffixed with "-test"
 *
 * It never touches the production database.
 *
 * Usage: node scripts/verify-logic.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Fail email sends instantly (the Resend API is not reachable with an
// invalid key from this test runner — calls fail fast with a 401).
// All email code paths still execute — they just fail fast instead of
// attempting a real delivery.
process.env.RESEND_API_KEY = 'invalid-key-for-test';

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const UserRank = require('../models/UserRank');
const Rank = require('../models/Rank');
const Referral = require('../models/Referral');
const Subscription = require('../models/Subscription');
const Course = require('../models/Course');
const CoursePurchase = require('../models/CoursePurchase');
const Setting = require('../models/Setting');
const Coupon = require('../models/Coupon');

const { processReferralCommission } = require('../services/referralService');
const { checkAndPromoteRank, getRankQualification } = require('../services/rankService');
const { activateWithBalance } = require('../controllers/subscriptionController');
const paymentsRouter = require('../routes/payments');
const { notifyStudentActivity } = require('../services/studentActivityService');
const UserProgress = require('../models/UserProgress');
const ActivityLog = require('../models/ActivityLog');
const WalletTransaction = require('../models/WalletTransaction');

const DEFAULT_RANKS = [
  { name: 'D1', slug: 'd1', order: 1, minDirectReferrals: 0, minTeamMembers: 0, minRequiredRank: null, minRequiredRankCount: 0, activationGain: 30, quantification: 4, indirectIncome: 0, minReferrals: 0, minRevenue: 0, commissionPercent: 0, perks: ['Base member'], isActive: true },
  { name: 'D2', slug: 'd2', order: 2, minDirectReferrals: 3, minTeamMembers: 20, minRequiredRank: 'D1', minRequiredRankCount: 3, activationGain: 40, quantification: 6, indirectIncome: 10, minReferrals: 3, minRevenue: 300, commissionPercent: 10, perks: ['Direct Referral Bonus', 'Copy Trading Share'], isActive: true },
  { name: 'D3', slug: 'd3', order: 3, minDirectReferrals: 5, minTeamMembers: 100, minRequiredRank: 'D2', minRequiredRankCount: 3, activationGain: 50, quantification: 8, indirectIncome: 20, minReferrals: 5, minRevenue: 1000, commissionPercent: 15, perks: ['Priority Support'], isActive: true },
  { name: 'D4', slug: 'd4', order: 4, minDirectReferrals: 8, minTeamMembers: 300, minRequiredRank: 'D3', minRequiredRankCount: 3, activationGain: 60, quantification: 10, indirectIncome: 30, minReferrals: 8, minRevenue: 2500, commissionPercent: 20, perks: ['VIP Support', 'Exclusive Signals'], isActive: true },
  { name: 'D5', slug: 'd5', order: 5, minDirectReferrals: 12, minTeamMembers: 800, minRequiredRank: 'D4', minRequiredRankCount: 3, activationGain: 65, quantification: 11, indirectIncome: 35, minReferrals: 12, minRevenue: 5000, commissionPercent: 25, perks: ['Personal Mentor', 'Custom Strategies'], isActive: true },
  { name: 'D6', slug: 'd6', order: 6, minDirectReferrals: 20, minTeamMembers: 1500, minRequiredRank: 'D5', minRequiredRankCount: 3, activationGain: 70, quantification: 12, indirectIncome: 40, minReferrals: 20, minRevenue: 10000, commissionPercent: 30, perks: ['Elite Mentorship', 'Revenue Sharing'], isActive: true },
];

const deriveTestUri = (uri) => {
  const s = String(uri);
  const withDb = s.match(/^([^?]*\/)([^/?]+)(\?.*)?$/);
  if (withDb) return `${withDb[1]}${withDb[2]}-test${withDb[3] || ''}`;
  const qIdx = s.indexOf('?');
  const base = (qIdx === -1 ? s : s.slice(0, qIdx)).replace(/\/+$/, '');
  const query = qIdx === -1 ? '' : s.slice(qIdx);
  return `${base}/forex_hub-test${query}`;
};

let rankByName = new Map();
let seq = 0;
let passed = 0;
let failed = 0;
const failures = [];

const t = (name, fn) => async () => {
  const start = Date.now();
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name} (${Date.now() - start}ms)`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.error(`  FAIL  ${name}\n        ${e.message}`);
  }
};

const unique = () => `u${(++seq).toString(36)}${Date.now().toString(36)}`;

const createUser = async ({ name = null, referredBy = null, active = true, balance = 0, rankName = 'D1', withReferralRecord = true } = {}) => {
  const firstName = name || unique();
  const user = await User.create({
    firstName,
    lastName: firstName,
    email: `${firstName.toLowerCase()}${unique()}@test.local`,
    password: 'Password123!',
    referralCode: `REF${unique().toUpperCase()}`,
    referredBy: referredBy ? referredBy._id || referredBy : null,
    isApproved: active,
    subscriptionStatus: active ? 'active' : 'none'
  });
  await Wallet.insertMany([
    { userId: user._id, type: 'main', availableBalance: balance },
    { userId: user._id, type: 'funding', availableBalance: 0 },
    { userId: user._id, type: 'ib', availableBalance: 0 }
  ]);
  await UserRank.create({
    userId: user._id,
    currentRankId: rankByName.get(rankName)._id,
    rankHistory: [{ rankId: rankByName.get(rankName)._id, achievedAt: new Date(), reason: 'test setup', changeType: 'automatic' }]
  });
  if (referredBy && withReferralRecord) {
    await Referral.create({
      referrerId: referredBy._id || referredBy,
      referredUserId: user._id,
      referralCode: user.referralCode,
      status: active ? 'converted' : 'pending',
      level: 1
    });
  }
  return user;
};

const setRank = async (userId, rankName) => {
  await UserRank.updateOne({ userId }, { $set: { currentRankId: rankByName.get(rankName)._id } });
};

const balance = async (userId, type = 'main') => {
  const w = await Wallet.findOne({ userId, type }).lean();
  return w ? w.availableBalance : null;
};

const cleanAll = async () => {
  await Promise.all([
    User.deleteMany({}),
    Wallet.deleteMany({}),
    UserRank.deleteMany({}),
    Rank.deleteMany({}),
    Referral.deleteMany({}),
    Subscription.deleteMany({}),
    Course.deleteMany({}),
    CoursePurchase.deleteMany({}),
    Setting.deleteMany({}),
    Coupon.deleteMany({}),
    UserProgress.deleteMany({}),
    ActivityLog.deleteMany({}),
    WalletTransaction.deleteMany({})
  ]);
};

const seedRanks = async () => {
  const ranks = await Rank.insertMany(DEFAULT_RANKS);
  rankByName = new Map(ranks.map((r) => [r.name, r]));
};

const seedSettings = async () => {
  await Setting.insertMany([
    { key: 'membership_price', value: 120, category: 'subscription' },
    { key: 'funding_wallet_usage_percent', value: 20, category: 'subscription' },
    { key: 'plan_days_yearly', value: 365, category: 'subscription' }
  ]);
};

const bulkChildren = async (parentIds, countPerParent, { status = 'converted', rankName = 'D1' } = {}) => {
  const users = [];
  const userRanks = [];
  const rankId = rankByName.get(rankName)._id;
  const now = new Date();
  for (const parentId of parentIds) {
    for (let j = 0; j < countPerParent; j++) {
      const firstName = `b${(++seq).toString(36)}${Date.now().toString(36)}`;
      users.push({
        firstName,
        lastName: firstName,
        email: `${firstName}@test.local`,
        password: 'Password123!',
        referralCode: `REF${firstName.toUpperCase()}`,
        referredBy: parentId,
        isApproved: true,
        subscriptionStatus: 'active'
      });
      userRanks.push({ currentRankId: rankId, rankHistory: [{ rankId, achievedAt: now, reason: 'test setup', changeType: 'automatic' }] });
    }
  }
  const created = await User.insertMany(users);
  const refsBulk = created.map((u) => ({
    referrerId: u.referredBy,
    referredUserId: u._id,
    referralCode: u.referralCode,
    status,
    level: 1
  }));
  await Referral.insertMany(refsBulk);
  const walletBulk = [];
  created.forEach((u) => {
    for (const type of ['main', 'funding', 'ib']) {
      walletBulk.push({ userId: u._id, type, availableBalance: 0 });
    }
  });
  await Wallet.insertMany(walletBulk);
  const rankBulk = created.map((u, idx) => ({ userId: u._id, currentRankId: rankId, rankHistory: [JSON.parse(JSON.stringify(userRanks[idx].rankHistory[0]))] }));
  await UserRank.insertMany(rankBulk);
  return created;
};

const buildTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/payments', paymentsRouter);
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ success: false, message: err.message });
  });
  return app;
};

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

const mockReq = (user, body = {}) => ({ user: user._id ? user : { _id: user }, body });

const activateFlow = async (userId, { balance: bal = 120, funding = 0 } = {}) => {
  if (funding > 0) {
    await Wallet.updateOne({ userId, type: 'funding' }, { $set: { availableBalance: funding } });
  }
  await Wallet.updateOne({ userId, type: 'main' }, { $set: { availableBalance: bal } });
  const res = mockRes();
  await activateWithBalance(mockReq(userId), res, (err) => { throw err; });
  return res;
};

const probeTransactions = async () => {
  const session = await mongoose.startSession();
  let supported = true;
  try {
    await session.withTransaction(async () => {
      await User.create([{ firstName: 'probe', lastName: 'probe', email: 'probe@test.local', password: 'Password123!', referralCode: 'PROBE1' }], { session });
      throw new Error('__abort__');
    });
  } catch (e) {
    if (e.message !== '__abort__') supported = false;
  } finally {
    await session.endSession();
  }
  return supported;
};

const main = async () => {
  const baseUri = process.env.MONGO_URI || process.env.TEST_MONGO_URI;
  const testUri = process.env.TEST_MONGO_URI || deriveTestUri(baseUri);
  if (!testUri) {
    console.error('ERROR: Could not derive a test database URI. Set TEST_MONGO_URI explicitly.');
    process.exit(1);
  }
  if (testUri === baseUri) {
    console.error('ERROR: TEST_MONGO_URI must differ from MONGO_URI. Refusing to run against the production database.');
    process.exit(1);
  }

  console.log(`Connecting to TEST database (production DB is NOT touched):`);
  console.log(`  ${testUri.replace(/:[^:@/]+@/, ':***@')}`);
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });

  const txSupported = await probeTransactions();
  if (!txSupported) {
    console.error('ERROR: The test cluster does not support transactions (needs a replica set / MongoDB 4.0+).');
    process.exit(1);
  }

  await cleanAll();
  await seedRanks();
  await seedSettings();
  console.log('Seeded: ranks (D1-D6) + settings (membership_price=120, funding=20%) on test DB\n');

  const tests = [];

  // ------------------------------------------------------------------
  // A. GAP commission engine
  // ------------------------------------------------------------------

  tests.push(t('A1: Direct sponsor (D1) receives full 30', async () => {
    const sponsor = await createUser({ name: 'spA1', rankName: 'D1' });
    const member = await createUser({ name: 'memA1', referredBy: sponsor._id, active: false });
    const results = await processReferralCommission(member._id, 120, 'subscription');
    if (!results) throw new Error('expected payout results, got null');
    if (results.length !== 1) throw new Error(`expected 1 payout, got ${results.length}`);
    if (results[0].amount !== 30) throw new Error(`expected 30, got ${results[0].amount}`);
    if (await balance(sponsor._id) !== 30) throw new Error(`sponsor balance expected 30, got ${await balance(sponsor._id)}`);
    const ref = await Referral.findOne({ referredUserId: member._id, level: 1 }).lean();
    if (ref.status !== 'converted') throw new Error(`referral status expected converted, got ${ref.status}`);
    if (ref.commissionAmount !== 30) throw new Error(`referral commissionAmount expected 30, got ${ref.commissionAmount}`);
  }));

  tests.push(t('A2: GAP chain D1->D2->D3->D4 pays only increments (30+10+10+10=60)', async () => {
    const s4 = await createUser({ name: 's4A2', rankName: 'D4' });
    const s3 = await createUser({ name: 's3A2', referredBy: s4._id, rankName: 'D3', withReferralRecord: false });
    const s2 = await createUser({ name: 's2A2', referredBy: s3._id, rankName: 'D2', withReferralRecord: false });
    const s1 = await createUser({ name: 's1A2', referredBy: s2._id, rankName: 'D1', withReferralRecord: false });
    const member = await createUser({ name: 'memA2', referredBy: s1._id, active: false, withReferralRecord: false });
    const results = await processReferralCommission(member._id, 120, 'subscription');
    if (!results) throw new Error('expected payout results, got null');
    const byLevel = Object.fromEntries(results.map((r) => [r.level, r.amount]));
    if (byLevel[1] !== 30) throw new Error(`level1 expected 30, got ${byLevel[1]}`);
    if (byLevel[2] !== 10) throw new Error(`level2 expected 10, got ${byLevel[2]}`);
    if (byLevel[3] !== 10) throw new Error(`level3 expected 10, got ${byLevel[3]}`);
    if (byLevel[4] !== 10) throw new Error(`level4 expected 10, got ${byLevel[4]}`);
    const total = results.reduce((s, r) => s + r.amount, 0);
    if (total !== 60) throw new Error(`total expected 60, got ${total}`);
    if (await balance(s1._id) !== 30) throw new Error('s1 balance wrong');
    if (await balance(s2._id) !== 10) throw new Error('s2 balance wrong');
    if (await balance(s3._id) !== 10) throw new Error('s3 balance wrong');
    if (await balance(s4._id) !== 10) throw new Error('s4 balance wrong');
  }));

  tests.push(t('A3: Full chain D1..D6 caps at 70 (30+10+10+10+5+5)', async () => {
    const chain = [];
    let prev = null;
    for (const r of ['D6', 'D5', 'D4', 'D3', 'D2', 'D1']) {
      const u = await createUser({ name: `sA3${r}`, referredBy: prev, rankName: r, withReferralRecord: false });
      chain.unshift(u);
      prev = u._id;
    }
    const member = await createUser({ name: 'memA3', referredBy: chain[0]._id, active: false, withReferralRecord: false });
    const results = await processReferralCommission(member._id, 120, 'subscription');
    if (!results) throw new Error('expected payout results, got null');
    const total = results.reduce((s, r) => s + r.amount, 0);
    if (total !== 70) throw new Error(`total expected 70 (cap), got ${total}`);
    const byLevel = Object.fromEntries(results.map((r) => [r.level, r.amount]));
    if (byLevel[5] !== 5 || byLevel[6] !== 5) throw new Error(`levels 5/6 expected 5/5, got ${byLevel[5]}/${byLevel[6]}`);
    if (await balance(chain[5]._id) !== 5) throw new Error('D6 balance wrong');
  }));

  tests.push(t('A4: Non-monotonic chain D3->D1->D1->D4 pays 50+0+0+10=60', async () => {
    const s4 = await createUser({ name: 's4A4', rankName: 'D4' });
    const s3 = await createUser({ name: 's3A4', referredBy: s4._id, rankName: 'D1', withReferralRecord: false });
    const s2 = await createUser({ name: 's2A4', referredBy: s3._id, rankName: 'D1', withReferralRecord: false });
    const s1 = await createUser({ name: 's1A4', referredBy: s2._id, rankName: 'D3', withReferralRecord: false });
    const member = await createUser({ name: 'memA4', referredBy: s1._id, active: false, withReferralRecord: false });
    const results = await processReferralCommission(member._id, 120, 'subscription');
    if (!results) throw new Error('expected payout results, got null');
    const byLevel = Object.fromEntries(results.map((r) => [r.level, r.amount]));
    if (byLevel[1] !== 50) throw new Error(`level1 expected 50, got ${byLevel[1]}`);
    if ((byLevel[2] || 0) !== 0) throw new Error(`level2 expected 0 (absent), got ${byLevel[2]}`);
    if ((byLevel[3] || 0) !== 0) throw new Error(`level3 expected 0 (absent), got ${byLevel[3]}`);
    if (byLevel[4] !== 10) throw new Error(`level4 expected 10, got ${byLevel[4]}`);
    const total = results.reduce((s, r) => s + r.amount, 0);
    if (total !== 60) throw new Error(`total expected 60, got ${total}`);
  }));

  tests.push(t('A5: Duplicate processing is a no-op (sequential)', async () => {
    const sponsor = await createUser({ name: 'spA5', rankName: 'D1' });
    const member = await createUser({ name: 'memA5', referredBy: sponsor._id, active: false });
    const r1 = await processReferralCommission(member._id, 120, 'subscription');
    if (!r1) throw new Error('first processing should pay');
    const r2 = await processReferralCommission(member._id, 120, 'subscription');
    if (r2 !== null) throw new Error(`second processing expected null, got ${JSON.stringify(r2)}`);
    if (await balance(sponsor._id) !== 30) throw new Error(`sponsor balance expected 30, got ${await balance(sponsor._id)}`);
  }));

  tests.push(t('A6: Concurrent duplicate processing pays exactly once', async () => {
    const sponsor = await createUser({ name: 'spA6', rankName: 'D1' });
    const member = await createUser({ name: 'memA6', referredBy: sponsor._id, active: false });
    const [r1, r2] = await Promise.all([
      processReferralCommission(member._id, 120, 'subscription'),
      processReferralCommission(member._id, 120, 'subscription')
    ]);
    const paid = [r1, r2].filter((r) => r && r.length > 0);
    if (paid.length !== 1) throw new Error(`expected exactly 1 payout pass, got ${paid.length}`);
    if (await balance(sponsor._id) !== 30) throw new Error(`sponsor balance expected 30, got ${await balance(sponsor._id)}`);
  }));

  // ------------------------------------------------------------------
  // B. Rank qualification engine
  // ------------------------------------------------------------------

  tests.push(t('B1: D1->D2 promotion (3 direct, 20 team, 3 qualified legs)', async () => {
    const u = await createUser({ name: 'uB1', rankName: 'D1' });
    const a = await createUser({ name: 'aB1', referredBy: u._id, rankName: 'D1' });
    const b = await createUser({ name: 'bB1', referredBy: u._id, rankName: 'D1' });
    const c = await createUser({ name: 'cB1', referredBy: u._id, rankName: 'D1' });
    await bulkChildren([a._id], 8);
    await bulkChildren([b._id], 5);
    await bulkChildren([c._id], 4);
    const q = await getRankQualification(u._id, { requiredRankName: 'D1', qualifiedLegsRequired: 3 });
    if (q.directReferrals !== 3) throw new Error(`direct expected 3, got ${q.directReferrals}`);
    if (q.activeTeamMembers !== 20) throw new Error(`team expected 20, got ${q.activeTeamMembers}`);
    if (q.qualifiedLegs !== 3) throw new Error(`qualifiedLegs expected 3, got ${q.qualifiedLegs}`);
    const promo = await checkAndPromoteRank(u._id);
    if (!promo.promoted) throw new Error('expected promotion');
    if (promo.newRank.name !== 'D2') throw new Error(`expected D2, got ${promo.newRank.name}`);
    const ur = await UserRank.findOne({ userId: u._id }).lean();
    if (ur.currentRankId.toString() !== rankByName.get('D2')._id.toString()) throw new Error('UserRank not updated to D2');
  }));

  tests.push(t('B2: Multiple qualifiers in same leg count as ONE leg', async () => {
    const u = await createUser({ name: 'uB2', rankName: 'D1' });
    const a = await createUser({ name: 'aB2', referredBy: u._id, rankName: 'D1' });
    const b = await createUser({ name: 'bB2', referredBy: u._id, rankName: 'D1' });
    const c = await createUser({ name: 'cB2', referredBy: u._id, rankName: 'D1' });
    const aKids = await bulkChildren([a._id], 4);
    await bulkChildren([b._id], 1);
    await setRank(aKids[0]._id, 'D2');
    await setRank(aKids[1]._id, 'D2');
    const q = await getRankQualification(u._id, { requiredRankName: 'D1', qualifiedLegsRequired: 3 });
    if (q.qualifiedLegs !== 3) throw new Error(`qualifiedLegs expected 3 (leg A has 2 D2 members), got ${q.qualifiedLegs}`);
  }));

  tests.push(t('B3: Free (pending) members are excluded from qualification', async () => {
    const u = await createUser({ name: 'uB3', rankName: 'D1' });
    const a = await createUser({ name: 'aB3', referredBy: u._id, rankName: 'D1' });
    const b = await createUser({ name: 'bB3', referredBy: u._id, rankName: 'D1' });
    const c = await createUser({ name: 'cB3', referredBy: u._id, rankName: 'D1' });
    await bulkChildren([a._id], 8);
    await bulkChildren([b._id], 2);
    await bulkChildren([c._id], 2);
    await createUser({ name: 'fB3', referredBy: u._id, rankName: 'D1', active: false });
    await createUser({ name: 'f2B3', referredBy: u._id, rankName: 'D1', active: false });
    await bulkChildren([a._id], 3, { status: 'pending' });
    const q = await getRankQualification(u._id, { requiredRankName: 'D1', qualifiedLegsRequired: 3 });
    if (q.directReferrals !== 3) throw new Error(`direct expected 3 (2 pending excluded), got ${q.directReferrals}`);
    if (q.activeTeamMembers !== 15) throw new Error(`team expected 15 (pending excluded), got ${q.activeTeamMembers}`);
    if (q.qualifiedLegs !== 3) throw new Error(`qualifiedLegs expected 3, got ${q.qualifiedLegs}`);
    const promo = await checkAndPromoteRank(u._id);
    if (promo.promoted) throw new Error('expected NO promotion (team 15 < 20)');
  }));

  tests.push(t('B4: D2->D3 promotion (5 direct, 100 team, 3 legs with D2+ member)', async () => {
    const u = await createUser({ name: 'uB4', rankName: 'D2' });
    const legs = [];
    for (const L of ['A', 'B', 'C', 'D', 'E']) {
      legs.push(await createUser({ name: `leg${L}B4`, referredBy: u._id, rankName: 'D1' }));
    }
    for (let i = 0; i < 5; i++) await bulkChildren([legs[i]._id], i < 3 ? 18 : 19);
    for (let i = 0; i < 3; i++) {
      const kids = await bulkChildren([legs[i]._id], 1);
      await setRank(kids[0]._id, 'D2');
    }
    const q = await getRankQualification(u._id, { requiredRankName: 'D2', qualifiedLegsRequired: 3 });
    if (q.directReferrals !== 5) throw new Error(`direct expected 5, got ${q.directReferrals}`);
    if (q.activeTeamMembers !== 100) throw new Error(`team expected 100, got ${q.activeTeamMembers}`);
    if (q.qualifiedLegs !== 3) throw new Error(`qualifiedLegs expected 3, got ${q.qualifiedLegs}`);
    const promo = await checkAndPromoteRank(u._id);
    if (!promo.promoted) throw new Error('expected promotion');
    if (promo.newRank.name !== 'D3') throw new Error(`expected D3, got ${promo.newRank.name}`);
  }));

  tests.push(t('B5: D3->D4 promotion (8 direct, 300 team, 3 legs with D3+ member)', async () => {
    const u = await createUser({ name: 'uB5', rankName: 'D3' });
    const legs = [];
    for (let i = 0; i < 8; i++) {
      legs.push(await createUser({ name: `leg${i}B5`, referredBy: u._id, rankName: 'D1' }));
    }
    for (let i = 0; i < 8; i++) {
      await bulkChildren([legs[i]._id], i === 3 ? 37 : 36);
    }
    for (let i = 0; i < 3; i++) {
      const kids = await bulkChildren([legs[i]._id], 1);
      await setRank(kids[0]._id, 'D3');
    }
    const q = await getRankQualification(u._id, { requiredRankName: 'D3', qualifiedLegsRequired: 3 });
    if (q.directReferrals !== 8) throw new Error(`direct expected 8, got ${q.directReferrals}`);
    if (q.activeTeamMembers !== 300) throw new Error(`team expected 300, got ${q.activeTeamMembers}`);
    if (q.qualifiedLegs !== 3) throw new Error(`qualifiedLegs expected 3, got ${q.qualifiedLegs}`);
    const promo = await checkAndPromoteRank(u._id);
    if (!promo.promoted) throw new Error('expected promotion');
    if (promo.newRank.name !== 'D4') throw new Error(`expected D4, got ${promo.newRank.name}`);
  }));

  // ------------------------------------------------------------------
  // C. Wallet activation flows (no PIN when balance covers payment)
  // ------------------------------------------------------------------

  tests.push(t('C1: Wallet activation succeeds WITHOUT PIN, deducts exactly, activates user', async () => {
    const user = await createUser({ name: 'uC1', active: false, balance: 120 });
    const res = await activateFlow(user._id, { balance: 120 });
    if (res.statusCode !== 201) throw new Error(`expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (await balance(user._id) !== 0) throw new Error(`main balance expected 0, got ${await balance(user._id)}`);
    const fresh = await User.findById(user._id).lean();
    if (!fresh.isApproved || fresh.subscriptionStatus !== 'active') throw new Error('user not activated');
    const subs = await Subscription.find({ userId: user._id, status: 'active' }).lean();
    if (subs.length !== 1) throw new Error(`expected 1 active subscription, got ${subs.length}`);
    const ur = await UserRank.findOne({ userId: user._id }).lean();
    if (ur.currentRankId.toString() !== rankByName.get('D1')._id.toString()) throw new Error('first rank D1 not assigned');
  }));

  tests.push(t('C2: Funding wallet used first (20% split), rest from main', async () => {
    const user = await createUser({ name: 'uC2', active: false, balance: 0 });
    await Wallet.updateOne({ userId: user._id, type: 'funding' }, { $set: { availableBalance: 24 } });
    await Wallet.updateOne({ userId: user._id, type: 'main' }, { $set: { availableBalance: 96 } });
    const res = mockRes();
    await activateWithBalance(mockReq(user._id), res, (e) => { throw e; });
    if (res.statusCode !== 201) throw new Error(`expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (await balance(user._id, 'funding') !== 0) throw new Error(`funding expected 0, got ${await balance(user._id, 'funding')}`);
    if (await balance(user._id, 'main') !== 0) throw new Error(`main expected 0, got ${await balance(user._id, 'main')}`);
  }));

  tests.push(t('C3: Insufficient balance -> 400, nothing created', async () => {
    const user = await createUser({ name: 'uC3', active: false, balance: 50 });
    const res = await activateFlow(user._id, { balance: 50 });
    if (res.statusCode !== 400) throw new Error(`expected 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (res.body.message.indexOf('Insufficient') === -1) throw new Error(`unexpected message: ${res.body.message}`);
    if (await balance(user._id) !== 50) throw new Error(`balance should stay 50, got ${await balance(user._id)}`);
    const subs = await Subscription.countDocuments({ userId: user._id });
    if (subs !== 0) throw new Error(`expected 0 subscriptions, got ${subs}`);
    const fresh = await User.findById(user._id).lean();
    if (fresh.isApproved) throw new Error('user should not be approved');
  }));

  tests.push(t('C4: Concurrent activations deduct exactly once (no double-spend)', async () => {
    const user = await createUser({ name: 'uC4', active: false, balance: 240 });
    const [r1, r2] = await Promise.all([
      activateFlow(user._id, { balance: 240 }),
      activateFlow(user._id, { balance: 240 })
    ]);
    const ok = [r1, r2].filter((r) => r.statusCode === 201).length;
    const bad = [r1, r2].filter((r) => r.statusCode === 400).length;
    if (ok !== 1 || bad !== 1) throw new Error(`expected 1 success + 1 failure, got ${ok} + ${bad}`);
    if (await balance(user._id) !== 120) throw new Error(`main balance expected 120, got ${await balance(user._id)}`);
    const subs = await Subscription.countDocuments({ userId: user._id, status: 'active' });
    if (subs !== 1) throw new Error(`expected exactly 1 active subscription, got ${subs}`);
  }));

  tests.push(t('C5: Activation pays GAP commission to sponsor', async () => {
    const sponsor = await createUser({ name: 'spC5', rankName: 'D2' });
    const member = await createUser({ name: 'memC5', referredBy: sponsor._id, active: false, balance: 120 });
    const res = await activateFlow(member._id, { balance: 120 });
    if (res.statusCode !== 201) throw new Error(`expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    if (await balance(sponsor._id) !== 40) throw new Error(`sponsor (D2) expected 40, got ${await balance(sponsor._id)}`);
    const ref = await Referral.findOne({ referredUserId: member._id, level: 1 }).lean();
    if (ref.status !== 'converted') throw new Error('referral should be converted after activation');
  }));

  // ------------------------------------------------------------------
  // D. Wallet course purchase flow (routes/payments.js)
  // ------------------------------------------------------------------

  tests.push(t('D1: Course purchase via wallet - insufficient balance creates NOTHING', async () => {
    const instructor = await createUser({ name: 'instrD1', rankName: 'D1' });
    const course = await Course.create({
      title: `Test Course ${unique()}`,
      description: 'test course',
      level: 'beginner',
      category: 'trading',
      instructorId: instructor._id,
      price: 100,
      isPublished: true
    });
    const user = await createUser({ name: 'uD1', active: true, balance: 50 });

    const app = buildTestApp();
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const resp = await fetch(`http://127.0.0.1:${port}/payments/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: course._id.toString(), broker: 'dma', paymentMethod: 'wallet' })
      });
      const data = await resp.json();
      if (resp.status !== 400) throw new Error(`expected 400, got ${resp.status}: ${JSON.stringify(data)}`);
      if (data.message.indexOf('Insufficient') === -1) throw new Error(`unexpected message: ${data.message}`);
      const purchases = await CoursePurchase.countDocuments({ userId: user._id, courseId: course._id });
      if (purchases !== 0) throw new Error(`expected 0 purchases, got ${purchases}`);
      if (await balance(user._id) !== 50) throw new Error(`balance should stay 50, got ${await balance(user._id)}`);
    } finally {
      server.close();
    }
  }));

  tests.push(t('D2: Course purchase via wallet - success debits once and activates', async () => {
    const instructor = await createUser({ name: 'instrD2', rankName: 'D1' });
    const course = await Course.create({
      title: `Test Course ${unique()}`,
      description: 'test course',
      level: 'beginner',
      category: 'trading',
      instructorId: instructor._id,
      price: 100,
      isPublished: true
    });
    const user = await createUser({ name: 'uD2', active: true, balance: 100 });

    const app = buildTestApp();
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const resp = await fetch(`http://127.0.0.1:${port}/payments/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: course._id.toString(), broker: 'dma', paymentMethod: 'wallet' })
      });
      const data = await resp.json();
      if (resp.status !== 201) throw new Error(`expected 201, got ${resp.status}: ${JSON.stringify(data)}`);
      if (await balance(user._id) !== 0) throw new Error(`balance expected 0, got ${await balance(user._id)}`);
      const purchase = await CoursePurchase.findOne({ userId: user._id, courseId: course._id }).lean();
      if (!purchase || purchase.status !== 'active') throw new Error('purchase should be active');
      const freshCourse = await Course.findById(course._id).lean();
      if (freshCourse.totalStudents !== 1) throw new Error(`totalStudents expected 1, got ${freshCourse.totalStudents}`);

      const dup = await fetch(`http://127.0.0.1:${port}/payments/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: course._id.toString(), broker: 'dma', paymentMethod: 'wallet' })
      });
      if (dup.status !== 400) throw new Error(`duplicate purchase expected 400, got ${dup.status}`);
      if (await balance(user._id) !== 0) throw new Error(`balance must not change on duplicate, got ${await balance(user._id)}`);
      const count = await CoursePurchase.countDocuments({ userId: user._id, courseId: course._id });
      if (count !== 1) throw new Error(`expected 1 purchase, got ${count}`);
    } finally {
      server.close();
    }
  }));

  // ------------------------------------------------------------------
  // E. Student activity notifications (admin summary email)
  // ------------------------------------------------------------------

  tests.push(t('E1: Student activity logged + admin email attempted + login throttled', async () => {
    const student = await createUser({ name: 'uE1', active: true });
    const actor = { _id: student._id, firstName: student.firstName, lastName: student.lastName, email: student.email };

    await notifyStudentActivity({ user: actor, action: 'login', details: { email: actor.email } });
    const log = await ActivityLog.findOne({ userId: student._id, action: 'login' }).lean();
    if (!log) throw new Error('ActivityLog entry not created');
    if (log.metadata.adminNotified !== true) throw new Error('adminNotified flag missing');
    if (log.changes.email !== actor.email) throw new Error('details not persisted');

    await notifyStudentActivity({ user: actor, action: 'login' });
    const logs = await ActivityLog.find({ userId: student._id, action: 'login' }).lean();
    if (logs.length !== 2) throw new Error(`expected 2 log entries, got ${logs.length}`);
    const notified = logs.filter((l) => l.metadata.adminNotified === true).length;
    if (notified !== 1) throw new Error(`expected exactly 1 admin email (throttled), got ${notified}`);

    await notifyStudentActivity({ user: actor, action: 'registration', details: { email: actor.email } });
    const regLogs = await ActivityLog.find({ userId: student._id, action: 'registration' }).lean();
    if (regLogs.length !== 1 || regLogs[0].metadata.adminNotified !== true) {
      throw new Error('non-throttled action should notify every time');
    }
  }));

  // ------------------------------------------------------------------
  // Run everything
  // ------------------------------------------------------------------

  for (const testFn of tests) {
    try { await testFn(); } catch (e) {
      failed++;
      failures.push({ name: testFn.name || 'unknown', error: e.message });
      console.error(`  FAIL  (runner error)\n        ${e.message}`);
    }
  }

  console.log(`\n==========================================`);
  console.log(`  PASSED: ${passed}   FAILED: ${failed}`);
  console.log(`==========================================`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  }

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
};

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
