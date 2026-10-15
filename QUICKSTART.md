# 🚀 Quick Start Guide

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 18+ installed
- ✅ Docker installed and running
- ✅ Git (optional, for version control)

## 🎯 Fastest Way to Start

### Using Docker Compose (Recommended)

```bash
# 1. Navigate to project
cd leetcode-clone

# 2. Copy environment file
copy .env.example .env

# 3. Start all services (first time will take 2-3 minutes to download images)
docker-compose up -d

# 4. Wait for services to be ready (check status)
docker-compose ps

# 5. Seed the database with sample problems
docker-compose exec backend npm run db:seed

# 6. Open your browser
# Frontend: http://localhost:5173
# Backend API: http://localhost:3000/health
```

That's it! 🎉

## 🔑 Login Credentials

After seeding, use these accounts:

**Admin Account:**
```
Email: admin@codearena.com
Password: admin123
```

**Test User:**
```
Email: test@example.com
Password: test123
```

## 🎮 Try It Out

1. **Register a new account** at http://localhost:5173/register
2. **Browse problems** - Go to Problems page
3. **Solve "Two Sum"** - Click on it and try the editor
4. **Submit your code** - Write a solution and hit Submit
5. **Check your profile** - See your stats and history

## 🛠️ Development Mode

To run services individually:

```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm install
npm run dev

# Terminal 3 - Execution Engine
cd execution-engine
npm install
npm run dev
```

**Note:** You'll still need PostgreSQL and Redis running:
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=leetcode_password postgres:15
docker run -d -p 6379:6379 redis:7-alpine
```

## 📚 What You Can Do

### As a User:
- ✅ Browse 5 pre-loaded coding problems
- ✅ Filter by difficulty (Easy, Medium, Hard)
- ✅ Solve problems with Monaco editor
- ✅ Write code in JavaScript, Python, Java, or C++
- ✅ Submit and get instant feedback
- ✅ View your submission history
- ✅ Track your progress and stats

### As an Admin:
- ✅ Create new problems
- ✅ Add test cases
- ✅ Manage existing problems
- ✅ View all submissions

## 🐛 Troubleshooting

### Services won't start?
```bash
# Check what's using the ports
netstat -ano | findstr "5173 3000 5432 6379"

# Stop all containers and restart
docker-compose down
docker-compose up -d
```

### Can't connect to database?
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres
```

### Code execution not working?
```bash
# Ensure Docker daemon is running
docker ps

# Check execution engine logs
docker-compose logs execution-engine

# Pull required images manually
docker pull node:18-alpine
docker pull python:3.11-alpine
```

### Port conflicts?
Edit `docker-compose.yml` and change the port mappings:
```yaml
ports:
  - "5174:5173"  # Change first number
```

## 📊 Project Stats

- **61 files created**
- **3 microservices** (Backend, Frontend, Execution Engine)
- **7 frontend pages** (Home, Problems, ProblemDetail, Login, Register, Profile, Submissions)
- **15+ API endpoints** (Auth, Problems, Submissions, Users)
- **4 programming languages** supported (JavaScript, Python, Java, C++)
- **5 sample problems** included
- **Production-ready** with Docker orchestration

## 🎓 Learn More

- Read `GETTING_STARTED.md` for detailed setup instructions
- Check `PROJECT_SUMMARY.md` for technical overview
- See `backend/README.md` for API documentation
- Review `frontend/README.md` for UI component details

## 💡 Tips

1. **Use Chrome DevTools** to inspect API calls
2. **Check Docker logs** if something fails: `docker-compose logs -f [service]`
3. **Hot reload is enabled** - changes to code will auto-refresh
4. **Use Postman** to test API endpoints directly
5. **Read the sample problems** to understand the data structure

## 🚀 Next Steps

Once running, try:
1. Creating a new problem (as admin)
2. Submitting a solution in different languages
3. Checking the leaderboard
4. Customizing the UI theme
5. Adding more features (see PROJECT_SUMMARY.md)

---

**Need help?** Check the logs:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f execution-engine
```

**Ready to code? Let's go! 🎉**
