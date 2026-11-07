const BotAccount = require('../models/BotAccount');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

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

exports.createBotAccount = async (req, res, next) => {
  try {
    const { platform, accountNumber, server, brokerName, accountType, password } = req.body;
    const account = await BotAccount.create({
      userId: req.user._id,
      platform,
      accountNumber,
      server,
      brokerName,
      accountType: accountType || 'real',
      password,
    });
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
