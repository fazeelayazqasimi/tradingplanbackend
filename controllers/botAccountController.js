const BotAccount = require('../models/BotAccount');
const User = require('../models/User');
const TradingStrategy = require('../models/TradingStrategy');
const Setting = require('../models/Setting');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { debitWallet, runInTransaction } = require('../services/walletService');

const FEE_SETTING_KEY = 'bot_connect_fee_amount';
const DEFAULT_FEE = 20;

const getConnectFee = async () => {
  const raw = await Setting.getByKey(FEE_SETTING_KEY, DEFAULT_FEE);
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : DEFAULT_FEE;
};


const parseSort = (sort) => {
  if (sort && typeof sort === 'object') return sort;
  const fields = String(sort || '-createdAt')
    .split(',')
    .reduce((acc, part) => {
      const field = part.trim();
      if (!field) return acc;
      if (field.startsWith('-')) acc[field.slice(1)] = -1;
      else acc[field] = 1;
      return acc;
    }, {});
  return Object.keys(fields).length ? fields : { createdAt: -1 };
};

exports.getMyBotAccounts = async (req, res, next) => {
  try {
    const accounts = await BotAccount.find({ userId: req.user._id }).sort({ createdAt: -1 });
    sendSuccess(res, accounts, 'Bot accounts fetched');
  } catch (error) {
    next(error);
  }
};

exports.getConnectFeeInfo = async (req, res, next) => {
  try {
    const amount = await getConnectFee();
    sendSuccess(res, { amount, currency: 'USD', wallet: 'main' }, 'Connect fee fetched');
  } catch (error) {
    next(error);
  }
};

exports.createBotAccount = async (req, res, next) => {
  try {
    const { platform, accountNumber, server, brokerName, accountType, password, strategyId } = req.body;
    const type = accountType || 'real';

    const strategy = await TradingStrategy.findById(strategyId);
    if (!strategy || !strategy.isActive) {
      return sendError(res, 'Selected trading strategy is not available', 400);
    }

    let feeAmount = 0;
    if (type === 'real') {
      feeAmount = await getConnectFee();
    }

    const createPayload = () => ({
      userId: req.user._id,
      platform,
      accountNumber,
      server,
      brokerName,
      accountType: type,
      password,
      strategyId: strategy._id,
      strategyName: strategy.name,
      feeAmount,
    });

    let account;
    if (feeAmount > 0) {
      try {
        account = await runInTransaction(async (session) => {
          await debitWallet(req.user._id, {
            amount: feeAmount,
            category: 'bot_activation',
            description: `Bot activation - ${strategy.name}`,
            referenceModel: 'User',
            referenceId: req.user._id,
            walletType: 'main',
            session,
          });
          const [created] = await BotAccount.create([createPayload()], { session });
          return created;
        });
      } catch (err) {
        if (err.code === 'INSUFFICIENT_BALANCE' || /Insufficient balance|Wallet not found|Wallet is frozen/i.test(err.message || '')) {
          return sendError(res, err.message, 400);
        }
        throw err;
      }
    } else {
      account = await BotAccount.create(createPayload());
    }

    sendSuccess(res, account, 'Bot account connected', 201);
  } catch (error) {
    next(error);
  }
};

exports.deleteBotAccount = async (req, res, next) => {
  try {
    const account = await BotAccount.findById(req.params.id);
    if (!account) return sendError(res, 'Bot account not found', 404);
    if (account.userId.toString() !== req.user._id.toString()) {
      return sendError(res, 'Not authorized to delete this account', 403);
    }
    await account.deleteOne();
    sendSuccess(res, null, 'Bot account deleted');
  } catch (error) {
    next(error);
  }
};

exports.getMembersWithBotAccounts = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const search = req.query.search;
    const botFilter = req.query.filter;

    const match = { role: 'student' };
    if (search) {
      match.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const basePipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'botaccounts',
          localField: '_id',
          foreignField: 'userId',
          as: 'botAccounts',
        },
      },
    ];

    if (botFilter === 'filled') {
      basePipeline.push({ $match: { botAccounts: { $ne: [] } } });
    } else if (botFilter === 'not-filled') {
      basePipeline.push({ $match: { botAccounts: { $eq: [] } } });
    }

    const countResult = await User.aggregate([...basePipeline, { $count: 'total' }]);
    const total = countResult[0]?.total || 0;

    const members = await User.aggregate([
      ...basePipeline,
      { $sort: parseSort(sort) },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { password: 0 } },
    ]);

    sendPaginated(res, members, total, page, limit);
  } catch (error) {
    next(error);
  }
};
