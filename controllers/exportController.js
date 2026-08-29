const User = require('../models/User');
const { sendError } = require('../helpers/response');

const CSV_HEADERS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'country',
  'role',
  'isApproved',
  'subscriptionStatus',
  'referralCode',
  'createdAt',
];

function csvEscape(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsv(users) {
  const headerRow = CSV_HEADERS.map((h) => csvEscape(h)).join(',');
  const rows = users.map((u) =>
    CSV_HEADERS.map((field) => csvEscape(u[field])).join(',')
  );
  return [headerRow, ...rows].join('\r\n');
}

exports.exportUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('firstName lastName email phone country role isApproved subscriptionStatus referralCode createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const csv = buildCsv(users);

    const filename = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send('﻿' + csv);
  } catch (error) {
    next(error);
  }
};
