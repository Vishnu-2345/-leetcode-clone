#!/bin/bash

echo "========================================"
echo "LeetCode Clone - Project Setup"
echo "========================================"
echo ""

echo "[1/4] Installing root dependencies..."
npm install || exit 1

echo ""
echo "[2/4] Installing backend dependencies..."
cd backend
npm install || exit 1
cd ..

echo ""
echo "[3/4] Installing frontend dependencies..."
cd frontend
npm install || exit 1
cd ..

echo ""
echo "[4/4] Installing execution-engine dependencies..."
cd execution-engine
npm install || exit 1
cd ..

echo ""
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and configure"
echo "2. Start PostgreSQL and Redis"
echo "3. Run database migrations: cd backend && psql -U leetcode_user -d leetcode_db -f database/init.sql"
echo "4. Seed database: cd backend && npm run db:seed"
echo "5. Start all services: npm run dev"
echo ""
echo "Or use Docker Compose:"
echo "  docker-compose up -d"
echo "  docker-compose exec backend npm run db:seed"
echo ""
