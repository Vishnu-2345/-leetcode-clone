# Backend API

Node.js backend for the LeetCode clone platform.

## Features

- RESTful API with Express.js
- PostgreSQL database with connection pooling
- Redis for caching and job queues
- JWT authentication
- Bull queue for async job processing
- Comprehensive error handling
- Request validation with Zod

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://leetcode_user:leetcode_password@localhost:5432/leetcode_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
PORT=3000
NODE_ENV=development
```

## Database Setup

### Run migrations

```bash
# Initialize database with schema
psql -U leetcode_user -d leetcode_db -f database/init.sql
```

### Seed sample data

```bash
npm run db:seed
```

This will create:
- Admin user: `admin@codearena.com` / `admin123`
- Test user: `test@example.com` / `test123`
- 5 sample coding problems with test cases

## Development

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get user profile (protected)

### Problems
- `GET /api/problems` - List all problems (with filters)
- `GET /api/problems/:slug` - Get problem details
- `POST /api/problems` - Create problem (admin only)
- `PUT /api/problems/:id` - Update problem (admin only)
- `DELETE /api/problems/:id` - Delete problem (admin only)

### Submissions
- `POST /api/submissions` - Submit code for a problem
- `GET /api/submissions/:id` - Get submission details
- `GET /api/submissions/user/:userId` - Get user's submissions
- `GET /api/submissions/problem/:problemId` - Get problem submissions

### Users
- `GET /api/users/:userId/stats` - Get user statistics
- `GET /api/users/leaderboard` - Get global leaderboard

## Testing

```bash
npm test
```

## Build

```bash
npm run build
npm start
```

## Architecture

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── database/        # Database connection and queries
├── middleware/      # Express middleware
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
└── index.ts         # Application entry point
```
