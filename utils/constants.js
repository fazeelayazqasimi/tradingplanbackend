const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student'
};

const SUBSCRIPTION_PLANS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime'
};

const SUBSCRIPTION_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
};

const REFERRAL_STATUSES = {
  PENDING: 'pending',
  CONVERTED: 'converted',
  PAID: 'paid'
};

const REFERRAL_LEVELS = {
  DIRECT: 1,
  INDIRECT: 2
};

const MAX_REFERRAL_LEVELS = 10;

const RANK_SLUGS = {
  V1: 'v1',
  V2: 'v2',
  V3: 'v3',
  V4: 'v4',
  V5: 'v5',
  V6: 'v6'
};

const WALLET_CATEGORIES = {
  DIRECT_INCOME: 'direct_income',
  INDIRECT_INCOME: 'indirect_income',
  TRADING_PROFIT: 'trading_profit',
  BONUS: 'bonus',
  WITHDRAWAL: 'withdrawal',
  PURCHASE: 'purchase',
  SUBSCRIPTION: 'subscription',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
  COMMISSION: 'commission'
};

const TRANSACTION_TYPES = {
  CREDIT: 'credit',
  DEBIT: 'debit'
};

const WITHDRAWAL_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid'
};

const WITHDRAWAL_METHODS = {
  BANK_TRANSFER: 'bank_transfer',
  PAYPAL: 'paypal',
  CRYPTO: 'crypto',
  MOBILE_MONEY: 'mobile_money',
  OTHER: 'other'
};

const SIGNAL_ACTIONS = {
  BUY: 'BUY',
  SELL: 'SELL',
  CLOSE: 'CLOSE',
  MODIFY: 'MODIFY'
};

const SIGNAL_STATUSES = {
  OPEN: 'open',
  CLOSED: 'closed',
  PENDING: 'pending'
};

const SIGNAL_SIDES = {
  LONG: 'LONG',
  SHORT: 'SHORT'
};

const TIMEFRAMES = {
  M1: 'M1',
  M5: 'M5',
  M15: 'M15',
  M30: 'M30',
  H1: 'H1',
  H4: 'H4',
  D1: 'D1',
  W1: 'W1',
  MN: 'MN'
};

const SUPPORT_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

const SUPPORT_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

const SUPPORT_CATEGORIES = {
  GENERAL: 'general',
  TECHNICAL: 'technical',
  BILLING: 'billing',
  OTHER: 'other'
};

const COURSE_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced'
};

const LESSON_TYPES = {
  VIDEO: 'video',
  TEXT: 'text',
  QUIZ: 'quiz',
  EXERCISE: 'exercise'
};

const ACTIVITY_LOG_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTER: 'register',
  PROFILE_UPDATE: 'profile_update',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET: 'password_reset',
  SUBSCRIPTION_CREATE: 'subscription_create',
  SUBSCRIPTION_CANCEL: 'subscription_cancel',
  SUBSCRIPTION_RENEW: 'subscription_renew',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  WITHDRAWAL_REQUEST: 'withdrawal_request',
  WITHDRAWAL_APPROVE: 'withdrawal_approve',
  WITHDRAWAL_REJECT: 'withdrawal_reject',
  RANK_CHANGE: 'rank_change',
  COURSE_ENROLL: 'course_enroll',
  COURSE_COMPLETE: 'course_complete',
  LESSON_COMPLETE: 'lesson_complete',
  QUIZ_ATTEMPT: 'quiz_attempt',
  ASSIGNMENT_SUBMIT: 'assignment_submit',
  SIGNAL_CREATE: 'signal_create',
  SIGNAL_UPDATE: 'signal_update',
  SIGNAL_DELETE: 'signal_delete',
  COPY_TRADE_OPEN: 'copy_trade_open',
  COPY_TRADE_CLOSE: 'copy_trade_close',
  ANNOUNCEMENT_CREATE: 'announcement_create',
  SUPPORT_TICKET_CREATE: 'support_ticket_create',
  SUPPORT_TICKET_CLOSE: 'support_ticket_close',
  REFERRAL_SIGNUP: 'referral_signup',
  REFERRAL_CONVERT: 'referral_convert',
  WALLET_CREDIT: 'wallet_credit',
  WALLET_DEBIT: 'wallet_debit',
  ACCOUNT_APPROVE: 'account_approve',
  ACCOUNT_DEACTIVATE: 'account_deactivate',
  SETTINGS_UPDATE: 'settings_update'
};

const PAYMENT_METHODS = {
  STRIPE: 'stripe',
  PAYPAL: 'paypal',
  BANK_TRANSFER: 'bank_transfer',
  CRYPTO: 'crypto',
  OTHER: 'other'
};

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  VERY_HIGH: 'very_high'
};

const ANNOUNCEMENT_TYPES = {
  GENERAL: 'general',
  COURSE: 'course',
  SIGNAL: 'signal',
  SYSTEM: 'system'
};

const SETTING_CATEGORIES = {
  GENERAL: 'general',
  SUBSCRIPTION: 'subscription',
  REFERRAL: 'referral',
  RANK: 'rank',
  TRADING: 'trading',
  WITHDRAWAL: 'withdrawal',
  SMTP: 'smtp',
  THEME: 'theme',
  NOTIFICATION: 'notification',
  SECURITY: 'security',
  PAYMENT: 'payment',
  API: 'api'
};

module.exports = {
  ROLES,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
  REFERRAL_STATUSES,
  REFERRAL_LEVELS,
  MAX_REFERRAL_LEVELS,
  RANK_SLUGS,
  WALLET_CATEGORIES,
  TRANSACTION_TYPES,
  WITHDRAWAL_STATUSES,
  WITHDRAWAL_METHODS,
  SIGNAL_ACTIONS,
  SIGNAL_STATUSES,
  SIGNAL_SIDES,
  TIMEFRAMES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  SUPPORT_CATEGORIES,
  COURSE_LEVELS,
  LESSON_TYPES,
  ACTIVITY_LOG_ACTIONS,
  PAYMENT_METHODS,
  RISK_LEVELS,
  ANNOUNCEMENT_TYPES,
  SETTING_CATEGORIES
};
