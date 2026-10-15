# Getting Started

Complete guide to set up and run the LeetCode clone platform.

## Prerequisites

Make sure you have the following installed:
- **Node.js 18+** - [Download](https://nodejs.org/)
- **PostgreSQL 15+** - [Download](https://www.postgresql.org/download/)
- **Redis 7+** - [Download](https://redis.io/download/)
- **Docker** - [Download](https://www.docker.com/products/docker-desktop/)

## Quick Start with Docker Compose

The easiest way to run the entire platform:

```bash
# Clone the repository
cd leetcode-clone

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Wait for services to be ready (30-60 seconds)
# Then seed the database
docker-compose exec backend npm run db:seed
```

Access the application:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Manual Setup (Development)

### 1. Database Setup

Start PostgreSQL and create database:

```bash
# On Windows with PostgreSQL installed
psql -U postgres

# In PostgreSQL shell:
CREATE DATABASE leetcode_db;
CREATE USER leetcode_user WITH PASSWORD 'leetcode_password';
GRANT ALL PRIVILEGES ON DATABASE leetcode_db TO leetcode_user;
\q

# Initialize schema
cd leetcode-clone/backend
psql -U leetcode_user -d leetcode_db -f database/init.sql
```

### 2. Redis Setup

Start Redis:

```bash
# On Windows with Redis installed
redis-server

# Or with Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### 3. Backend Setup

```bash
cd backend
npm install
cp ../.env.example .env
# Edit .env with your configuration
npm run db:seed
npm run dev
```

Backend runs on http://localhost:3000

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

### 5. Execution Engine Setup

```bash
cd execution-engine
npm install
npm run dev
```

Make sure Docker is running for code execution.

## Default Credentials

After seeding the database:

**Admin Account:**
- Email: `admin@codearena.com`
- Password: `admin123`

**Test User Account:**
- Email: `test@example.com`
- Password: `test123`

## Testing the Platform

1. **Register/Login**: Create an account or use test credentials
2. **Browse Problems**: Go to /problems to see sample problems
3. **Solve a Problem**: Click on "Two Sum" to try the editor
4. **Submit Code**: Write a solution and click Submit
5. **View Results**: Check submission status and test results
6. **Profile**: View your stats on the profile page

## Project Structure

```
leetcode-clone/
├── backend/              # Node.js API server
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── routes/       # API endpoints
│   │   ├── database/     # DB connection & migrations
│   │   └── middleware/   # Auth, error handling
│   └── package.json
│
├── frontend/             # React application
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── store/        # State management
│   │   └── lib/          # Utilities
│   └── package.json
│
├── execution-engine/     # Code execution service
│   ├── src/
│   │   ├── executors/    # Language-specific executors
│   │   └── index.ts      # Queue processor
│   └── package.json
│
└── docker-compose.yml    # All services configuration
```

## Development Workflow

### Adding a New Problem

1. Login as admin (admin@codearena.com)
2. Use API endpoint or add directly to database:

```bash
curl -X POST http://localhost:3000/api/problems \
  -H "Authorization: Bearer <your-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Problem Title",
    "slug": "problem-slug",
    "description": "Problem description...",
    "difficulty": "Easy",
    "tags": ["Array", "String"],
    "testCases": [
      {
        "input": "test input",
        "expectedOutput": "expected output",
        "isHidden": false
      }
    ]
  }'
```

### Testing Code Execution

Submit code via frontend or API:

```bash
curl -X POST http://localhost:3000/api/submissions \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "problemId": "<problem-uuid>",
    "code": "function solution(input) { return input; }",
    "language": "javascript"
  }'
```

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready -U leetcode_user -d leetcode_db

# Reset database
psql -U leetcode_user -d leetcode_db -f backend/database/init.sql
npm run db:seed
```

### Redis Connection Issues
```bash
# Test Redis
redis-cli ping
# Should return: PONG
```

### Docker Execution Issues
```bash
# Check Docker is running
docker ps

# Pull required images
docker pull node:18-alpine
docker pull python:3.11-alpine
docker pull openjdk:17-alpine
docker pull gcc:latest
```

### Port Conflicts
If ports are already in use, edit docker-compose.yml or update .env:
- Frontend: Change 5173 to another port
- Backend: Change 3000 to another port
- PostgreSQL: Change 5432 to another port
- Redis: Change 6379 to another port

## Next Steps

- Explore the sample problems
- Try submitting solutions in different languages
- Check the leaderboard
- Add your own problems (as admin)
- Customize the UI theme and styling

## Production Deployment

For production deployment:

1. Update environment variables for production
2. Set strong JWT_SECRET
3. Use managed database (AWS RDS, DigitalOcean)
4. Use managed Redis (AWS ElastiCache, Redis Cloud)
5. Deploy frontend to Vercel/Netlify
6. Deploy backend to AWS/DigitalOcean/Railway
7. Use Kubernetes for execution engine scaling

See deployment guides in `/docs` folder for detailed instructions.
