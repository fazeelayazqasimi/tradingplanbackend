# Dream Trader - Trading Institute Management System (Backend)

A robust RESTful API backend for managing a trading education institute, built with Node.js, Express.js, and MongoDB.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Auth**: JWT (access + refresh tokens)
- **Email**: Nodemailer (Gmail SMTP)
- **Security**: Helmet, CORS, Rate Limiting
- **File Upload**: Multer

## Project Structure

```
backend/
├── config/
│   └── db.js                 # MongoDB connection
├── controllers/              # 20 route handlers
│   ├── adminController.js    # Dashboard, revenue, activity logs
│   ├── announcementController.js
│   ├── assignmentController.js
│   ├── authController.js     # Register, login, refresh, password reset
│   ├── certificateController.js
│   ├── contactController.js  # Contact form submissions
│   ├── copyTradingController.js
│   ├── courseController.js
│   ├── faqController.js
│   ├── pageContentController.js
│   ├── quizController.js
│   ├── rankController.js
│   ├── referralController.js
│   ├── settingController.js
│   ├── signalController.js
│   ├── subscriptionController.js
│   ├── supportController.js
│   ├── userController.js
│   ├── walletController.js
│   └── withdrawalController.js
├── database/
│   └── seed.js               # Database seeding script
├── emails/
│   ├── index.js              # Email sending utilities
│   └── template.js           # Email templates
├── helpers/
│   ├── pagination.js
│   └── response.js           # sendSuccess, sendError, sendPaginated
├── middleware/
│   ├── auth.js               # JWT protect + role-based authorize
│   ├── error.js              # Global error handler
│   ├── rateLimiter.js
│   ├── upload.js             # Multer config for avatars, courses, resources
│   └── validate.js           # Validation middleware
├── models/                   # 22 Mongoose schemas
│   ├── User.js
│   ├── Course.js
│   ├── Signal.js
│   ├── Subscription.js
│   ├── Wallet.js
│   ├── WalletTransaction.js
│   ├── Withdrawal.js
│   ├── Referral.js
│   ├── Rank.js
│   ├── UserRank.js
│   ├── Assignment.js
│   ├── Quiz.js
│   ├── Certificate.js
│   ├── CopyTrading.js
│   ├── Announcement.js
│   ├── Support.js
│   ├── FAQ.js
│   ├── PageContent.js
│   ├── Setting.js
│   ├── Contact.js
│   ├── ActivityLog.js
│   └── UserProgress.js
├── routes/                   # 21 route modules
├── services/
│   ├── copyTradingService.js
│   ├── emailService.js
│   ├── rankService.js
│   └── referralService.js
├── uploads/                  # Avatar, course, resource files
│   ├── avatars/
│   ├── courses/
│   └── resources/
├── utils/
│   ├── constants.js
│   └── helpers.js
├── validators/
│   ├── authValidators.js
│   ├── courseValidators.js
│   ├── generalValidators.js
│   ├── referralValidators.js
│   ├── signalValidators.js
│   ├── subscriptionValidators.js
│   ├── userValidators.js
│   └── withdrawalValidators.js
├── server.js                 # Express app entry point
└── package.json
```

## Environment Variables (.env)

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=15d
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_REFRESH_EXPIRES_IN=30d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
NODE_ENV=development
```

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_EXPIRE` | Access token expiration (e.g., `15d`) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration (e.g., `30d`) |
| `EMAIL_HOST` | SMTP host for Nodemailer |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_USER` | Sender email address |
| `EMAIL_PASS` | Email app password |
| `FRONTEND_URL` | Frontend origin for CORS |
| `BACKEND_URL` | Backend base URL |
| `NODE_ENV` | `development` or `production` |

## Installation & Setup

```bash
# Clone the repository
git clone <repository-url>
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env   # edit with your values

# Seed the database (optional)
npm run seed

# Start development server (with nodemon)
npm run dev

# Start production server
npm start
```

## API Endpoints

All endpoints are prefixed with `/api`.

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login | No |
| POST | `/api/auth/refresh` | Refresh access token | No |
| GET | `/api/auth/me` | Get current user | Yes |
| POST | `/api/auth/forgot-password` | Send reset email | No |
| PUT | `/api/auth/reset-password/:token` | Reset password | No |
| PUT | `/api/auth/change-password` | Change password | Yes |
| PUT | `/api/auth/profile` | Update profile/avatar | Yes |

### Users (Admin)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users` | List all users | Admin |
| GET | `/api/users/:id` | Get user details | Admin |
| PUT | `/api/users/:id` | Update user | Admin |
| POST | `/api/users/connect-mt` | Connect MT4/MT5 | Student |
| DELETE | `/api/users/disconnect-mt` | Disconnect MT | Student |

### Courses

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/courses` | List courses (public) | No |
| GET | `/api/courses/:slug` | Get course by slug | No |
| POST | `/api/courses` | Create course | Admin |
| PUT | `/api/courses/:id` | Update course | Admin |
| DELETE | `/api/courses/:id` | Delete course | Admin |

### Assignments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/assignments` | List assignments | No |
| GET | `/api/assignments/:id` | Get assignment | Yes |
| POST | `/api/assignments` | Create assignment | Admin |
| POST | `/api/assignments/:id/submit` | Submit assignment | Student |
| PUT | `/api/assignments/:id/grade/:submissionId` | Grade submission | Admin |
| DELETE | `/api/assignments/:id` | Delete assignment | Admin |

### Quizzes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/quizzes` | List quizzes | No |
| GET | `/api/quizzes/:id` | Get quiz | Yes |
| POST | `/api/quizzes` | Create quiz | Admin |
| POST | `/api/quizzes/:id/submit` | Submit quiz answers | Student |
| PUT | `/api/quizzes/:id` | Update quiz | Admin |
| DELETE | `/api/quizzes/:id` | Delete quiz | Admin |

### Certificates

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/certificates` | My certificates | Yes |
| GET | `/api/certificates/:id` | Get certificate | Yes |
| GET | `/api/certificates/verify/:number` | Verify certificate | No |
| GET | `/api/certificates/admin/all` | All certificates | Admin |
| POST | `/api/certificates/admin` | Issue certificate | Admin |
| DELETE | `/api/certificates/admin/:id` | Delete certificate | Admin |

### Signals

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/signals` | List signals (public) | No |
| GET | `/api/signals/:id` | Get signal | Yes |
| POST | `/api/signals` | Create signal | Admin |
| PUT | `/api/signals/:id` | Update signal | Admin |
| DELETE | `/api/signals/:id` | Delete signal | Admin |

### Announcements

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/announcements` | List announcements | Yes |
| GET | `/api/announcements/:id` | Get announcement | Yes |
| POST | `/api/announcements` | Create announcement | Admin |
| DELETE | `/api/announcements/:id` | Delete announcement | Admin |

### Referrals

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/referrals/code` | Get my referral code | Yes |
| GET | `/api/referrals/stats` | Referral statistics | Yes |
| GET | `/api/referrals/tree` | Referral tree | Yes |
| GET | `/api/referrals/earnings` | Referral earnings | Yes |

### Ranks

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/ranks` | List all ranks | No |
| GET | `/api/ranks/me` | My rank | Yes |
| GET | `/api/ranks/distribution` | Rank distribution | Admin |
| POST | `/api/ranks` | Create rank | Admin |
| PUT | `/api/ranks/:id` | Update rank | Admin |
| POST | `/api/ranks/override` | Override user rank | Admin |
| PUT | `/api/ranks/:userId/lock` | Lock rank | Admin |
| PUT | `/api/ranks/:userId/unlock` | Unlock rank | Admin |

### Wallets

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/wallets` | My wallet | Yes |
| GET | `/api/wallets/transactions` | Transaction history | Yes |
| GET | `/api/wallets/stats` | Wallet stats | Yes |
| GET | `/api/wallets/all` | All wallets | Admin |
| GET | `/api/wallets/admin/stats` | Admin wallet stats | Admin |
| POST | `/api/wallets/:userId/credit` | Credit wallet | Admin |

### Withdrawals

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/withdrawals` | Request withdrawal | Student |
| GET | `/api/withdrawals` | List withdrawals | Yes |
| PUT | `/api/withdrawals/:id/approve` | Approve withdrawal | Admin |
| PUT | `/api/withdrawals/:id/reject` | Reject withdrawal | Admin |
| PUT | `/api/withdrawals/:id/paid` | Mark as paid | Admin |

### Subscriptions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/subscriptions` | Create subscription | Student |
| GET | `/api/subscriptions` | List subscriptions | Admin |
| GET | `/api/subscriptions/me` | My subscription | Student |
| PUT | `/api/subscriptions/:id/approve` | Approve | Admin |
| PUT | `/api/subscriptions/:id/reject` | Reject | Admin |
| PUT | `/api/subscriptions/me/cancel` | Cancel subscription | Student |

### Copy Trading

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/copy-trading/stats` | Copy trading stats | Yes |
| GET | `/api/copy-trading/history` | Copy history | Yes |
| POST | `/api/copy-trading` | Start copying | Student |
| DELETE | `/api/copy-trading/:id` | Stop copying | Student |

### Support

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/support` | Create ticket | Yes |
| GET | `/api/support` | List tickets | Yes |
| GET | `/api/support/:id` | Get ticket | Yes |
| POST | `/api/support/:id/messages` | Add message | Yes |
| PUT | `/api/support/:id/status` | Update status | Admin |
| PUT | `/api/support/:id/assign` | Assign ticket | Admin |

### FAQs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/faqs/public` | Public FAQs | No |
| GET | `/api/faqs` | All FAQs | Admin |
| POST | `/api/faqs` | Create FAQ | Admin |
| PUT | `/api/faqs/:id` | Update FAQ | Admin |
| PUT | `/api/faqs/:id/toggle` | Toggle visibility | Admin |
| DELETE | `/api/faqs/:id` | Delete FAQ | Admin |

### Page Content (CMS)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/page-content/public?page=home` | Public content | No |
| GET | `/api/page-content` | All content | Admin |
| POST | `/api/page-content` | Create content | Admin |
| PUT | `/api/page-content/:id` | Update content | Admin |
| DELETE | `/api/page-content/:id` | Delete content | Admin |

### Contact Form

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/contact` | Submit contact form | No |
| GET | `/api/contact` | List contacts | Admin |
| GET | `/api/contact/:id` | Get contact | Admin |
| PUT | `/api/contact/:id/status` | Update status | Admin |
| DELETE | `/api/contact/:id` | Delete contact | Admin |

### Settings

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/settings/public` | Public settings | No |
| GET | `/api/settings` | All settings | Admin |
| PUT | `/api/settings` | Update settings | Admin |

### Admin Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/dashboard` | Dashboard stats | Admin |
| GET | `/api/admin/revenue` | Revenue report | Admin |
| GET | `/api/admin/activity-logs` | Activity logs | Admin |

### Health Check

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | No |

## Key Features

- **JWT Authentication** with access + refresh token rotation
- **Role-based access control** (admin/student)
- **Referral system** with direct + indirect commission tracking (2 levels)
- **Rank system** with automatic promotion/demotion (D1-D6 levels)
- **Wallet system** with categorized transactions (direct income, indirect income, trading profit, bonus)
- **Copy trading** with automatic profit distribution
- **Quiz & Assignment** system with grading
- **Certificate** generation and verification
- **Support ticket** system with message threads
- **CMS** for managing website content
- **Rate limiting** and input validation
- **File upload** support (avatars, course materials, assignment submissions)

## License

MIT
