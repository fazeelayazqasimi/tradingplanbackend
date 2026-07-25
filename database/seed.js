const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Rank = require('../models/Rank');
const Setting = require('../models/Setting');
const Course = require('../models/Course');
const Wallet = require('../models/Wallet');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for seeding...');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Rank.deleteMany({}),
      Setting.deleteMany({}),
      Course.deleteMany({}),
      Wallet.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create admin
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@tradinginstitute.com',
      password: 'Admin@123',
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
      referralCode: 'ADMIN001',
    });
    console.log('Admin created:', admin.email);

    // Create ranks V1-V6
    const ranks = await Rank.insertMany([
      { name: 'V1', slug: 'v1', minReferrals: 0, minRevenue: 0, commissionPercent: 5, bonusPerReferral: 0, profitSharePercent: 0, copyTradingSharePercent: 0, activationGain: 30, quantification: 5, indirectIncome: 5, perks: ['Base member'], order: 1 },
      { name: 'V2', slug: 'v2', minReferrals: 3, minRevenue: 300, commissionPercent: 10, bonusPerReferral: 5, profitSharePercent: 5, copyTradingSharePercent: 2, activationGain: 40, quantification: 6, indirectIncome: 8, perks: ['5% profit share', '2% copy trading share'], order: 2 },
      { name: 'V3', slug: 'v3', minReferrals: 10, minRevenue: 1000, commissionPercent: 15, bonusPerReferral: 10, profitSharePercent: 10, copyTradingSharePercent: 5, activationGain: 50, quantification: 7, indirectIncome: 10, perks: ['10% profit share', '5% copy trading share', 'Priority support'], order: 3 },
      { name: 'V4', slug: 'v4', minReferrals: 25, minRevenue: 2500, commissionPercent: 20, bonusPerReferral: 15, profitSharePercent: 15, copyTradingSharePercent: 8, activationGain: 60, quantification: 8, indirectIncome: 12, perks: ['15% profit share', '8% copy trading share', 'VIP support', 'Exclusive signals'], order: 4 },
      { name: 'V5', slug: 'v5', minReferrals: 50, minRevenue: 5000, commissionPercent: 25, bonusPerReferral: 20, profitSharePercent: 20, copyTradingSharePercent: 12, activationGain: 65, quantification: 9, indirectIncome: 15, perks: ['20% profit share', '12% copy trading share', 'Personal mentor', 'Custom strategies'], order: 5 },
      { name: 'V6', slug: 'v6', minReferrals: 100, minRevenue: 10000, commissionPercent: 30, bonusPerReferral: 25, profitSharePercent: 25, copyTradingSharePercent: 15, activationGain: 70, quantification: 10, indirectIncome: 20, perks: ['25% profit share', '15% copy trading share', 'Elite mentorship', 'Revenue sharing'], order: 6 },
    ]);
    console.log('Ranks created:', ranks.length);

    // Create default settings
    const defaultSettings = [
      { key: 'membership_price', value: 100, category: 'subscription', description: 'Annual membership price in USD' },
      { key: 'membership_duration', value: 365, category: 'subscription', description: 'Membership duration in days' },
      { key: 'membership_plans', value: [{ name: 'Annual', price: 100, duration: 365 }], category: 'subscription', description: 'Available membership plans' },
      { key: 'institute_name', value: 'Trading Institute', category: 'general', description: 'Institute display name' },
      { key: 'institute_email', value: 'info@tradinginstitute.com', category: 'general', description: 'Contact email' },
      { key: 'institute_phone', value: '+1 234 567 890', category: 'general', description: 'Contact phone' },
      { key: 'institute_address', value: '123 Trading Street, Financial District', category: 'general', description: 'Address' },
      { key: 'min_withdrawal', value: 50, category: 'withdrawal', description: 'Minimum withdrawal amount' },
      { key: 'max_withdrawal', value: 10000, category: 'withdrawal', description: 'Maximum withdrawal amount' },
      { key: 'broker_share_percent', value: 20, category: 'trading', description: 'Broker share in profit distribution' },
      { key: 'trader_share_percent', value: 30, category: 'trading', description: 'Trader share in profit distribution' },
      { key: 'network_share_percent', value: 50, category: 'trading', description: 'Network share in profit distribution' },
      { key: 'site_tagline', value: 'Master Trading. Build Wealth.', category: 'general', description: 'Website tagline' },
      { key: 'site_description', value: 'Professional trading education with live signals and copy trading.', category: 'general', description: 'Website description' },
      { key: 'social_instagram', value: '#', category: 'general', description: 'Instagram URL' },
      { key: 'social_twitter', value: '#', category: 'general', description: 'Twitter URL' },
      { key: 'social_youtube', value: '#', category: 'general', description: 'YouTube URL' },
      { key: 'social_telegram', value: '#', category: 'general', description: 'Telegram URL' },
      { key: 'institute_logo', value: '', category: 'general', description: 'Institute logo URL' },
      { key: 'referral_level_1_commission', value: 30, category: 'referral', description: 'Level 1 direct referral commission in USD' },
      { key: 'referral_level_2_commission', value: 10, category: 'referral', description: 'Level 2 indirect referral commission in USD' },
      { key: 'referral_level_3_commission', value: 5, category: 'referral', description: 'Level 3 referral commission in USD' },
      { key: 'referral_level_4_commission', value: 3, category: 'referral', description: 'Level 4 referral commission in USD' },
      { key: 'referral_level_5_commission', value: 2, category: 'referral', description: 'Level 5 referral commission in USD' },
      { key: 'referral_max_levels', value: 5, category: 'referral', description: 'Maximum referral chain levels for commission' },
      { key: 'broker_dma_name', value: 'DMA', category: 'api', description: 'DMA Broker display name' },
      { key: 'broker_dma_api_key', value: '', category: 'api', description: 'DMA Broker API Key' },
      { key: 'broker_dma_api_secret', value: '', category: 'api', description: 'DMA Broker API Secret' },
      { key: 'broker_dma_api_endpoint', value: 'https://api.dma-broker.com', category: 'api', description: 'DMA Broker API Endpoint' },
      { key: 'broker_startrading_name', value: 'StarTrading', category: 'api', description: 'StarTrading Broker display name' },
      { key: 'broker_startrading_api_key', value: '', category: 'api', description: 'StarTrading Broker API Key' },
      { key: 'broker_startrading_api_secret', value: '', category: 'api', description: 'StarTrading Broker API Secret' },
      { key: 'broker_startrading_api_endpoint', value: 'https://api.startrading.com', category: 'api', description: 'StarTrading Broker API Endpoint' },
      { key: 'free_registration_bonus_enabled', value: true, category: 'general', description: 'Enable $1 free registration bonus' },
    ];
    await Setting.insertMany(defaultSettings);
    console.log('Settings created:', defaultSettings.length);

    // Create sample courses
    const courses = await Course.insertMany([
      {
        title: 'Trading Fundamentals',
        slug: 'trading-fundamentals',
        description: 'Learn the basics of trading including chart reading, market structure, and risk management.',
        level: 'beginner',
        category: 'Fundamentals',
        instructorId: admin._id,
        price: 100,
        totalLessons: 10,
        totalStudents: 0,
        isPublished: true,
        isFeatured: true,
        order: 1,
        lessons: [
          { title: 'Introduction to Trading', slug: 'intro-to-trading', type: 'text', content: 'Trading is the act of buying and selling financial instruments...', order: 1, isFree: true },
          { title: 'Market Structure', slug: 'market-structure', type: 'video', videoUrl: '', videoDuration: 1200, order: 2, isFree: true },
          { title: 'Candlestick Patterns', slug: 'candlestick-patterns', type: 'video', videoUrl: '', videoDuration: 1800, order: 3 },
          { title: 'Support & Resistance', slug: 'support-resistance', type: 'video', videoUrl: '', videoDuration: 1500, order: 4 },
          { title: 'Risk Management', slug: 'risk-management', type: 'video', videoUrl: '', videoDuration: 2000, order: 5 },
          { title: 'Position Sizing', slug: 'position-sizing', type: 'text', content: 'Position sizing is crucial...', order: 6 },
          { title: 'Trading Psychology', slug: 'trading-psychology', type: 'video', videoUrl: '', videoDuration: 1600, order: 7 },
          { title: 'Creating a Trading Plan', slug: 'trading-plan', type: 'text', content: 'A trading plan outlines...', order: 8 },
          { title: 'Demo Trading', slug: 'demo-trading', type: 'exercise', order: 9 },
          { title: 'Final Assessment', slug: 'final-assessment', type: 'quiz', order: 10 },
        ],
      },
      {
        title: 'Advanced Technical Analysis',
        slug: 'advanced-technical-analysis',
        description: 'Master advanced chart patterns, indicators, and trading strategies.',
        level: 'intermediate',
        category: 'Technical Analysis',
        instructorId: admin._id,
        price: 150,
        totalLessons: 8,
        totalStudents: 0,
        isPublished: true,
        isFeatured: true,
        order: 2,
        lessons: [
          { title: 'Advanced Chart Patterns', slug: 'advanced-chart-patterns', type: 'video', videoUrl: '', videoDuration: 2400, order: 1, isFree: true },
          { title: 'Fibonacci Retracement', slug: 'fibonacci', type: 'video', videoUrl: '', videoDuration: 1800, order: 2 },
          { title: 'RSI & MACD Mastery', slug: 'rsi-macd', type: 'video', videoUrl: '', videoDuration: 2000, order: 3 },
          { title: 'Volume Analysis', slug: 'volume-analysis', type: 'video', videoUrl: '', videoDuration: 1600, order: 4 },
          { title: 'Harmonic Patterns', slug: 'harmonic-patterns', type: 'video', videoUrl: '', videoDuration: 2200, order: 5 },
          { title: 'Elliott Wave Theory', slug: 'elliott-wave', type: 'text', content: 'The Elliott Wave Principle...', order: 6 },
          { title: 'Multi-Timeframe Analysis', slug: 'multi-timeframe', type: 'video', videoUrl: '', videoDuration: 1500, order: 7 },
          { title: 'Strategy Backtesting', slug: 'backtesting', type: 'exercise', order: 8 },
        ],
      },
      {
        title: 'Price Action Mastery',
        slug: 'price-action-mastery',
        description: 'Learn to trade naked charts using pure price action concepts.',
        level: 'advanced',
        category: 'Price Action',
        instructorId: admin._id,
        price: 200,
        totalLessons: 6,
        totalStudents: 0,
        isPublished: true,
        isFeatured: false,
        order: 3,
        lessons: [
          { title: 'Supply & Demand Zones', slug: 'supply-demand', type: 'video', videoUrl: '', videoDuration: 2000, order: 1, isFree: true },
          { title: 'Order Blocks', slug: 'order-blocks', type: 'video', videoUrl: '', videoDuration: 1800, order: 2 },
          { title: 'Liquidity Concepts', slug: 'liquidity', type: 'video', videoUrl: '', videoDuration: 2200, order: 3 },
          { title: 'Smart Money Concepts', slug: 'smart-money', type: 'video', videoUrl: '', videoDuration: 2500, order: 4 },
          { title: 'Breaker & Mitigation Blocks', slug: 'breaker-blocks', type: 'video', videoUrl: '', videoDuration: 1800, order: 5 },
          { title: 'Live Trading Sessions', slug: 'live-trading', type: 'exercise', order: 6 },
        ],
      },
    ]);
    console.log('Courses created:', courses.length);

    console.log('\n✅ Seed completed successfully!');
    console.log('Admin login: admin@tradinginstitute.com / Admin@123');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
