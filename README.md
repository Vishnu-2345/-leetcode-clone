# LeetCode Clone - Coding Platform

A full-stack coding platform similar to LeetCode with problem management, code execution, and user authentication.

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Monaco Editor (code editor)
- Tailwind CSS + shadcn/ui
- React Query (data fetching)
- Zustand (state management)

### Backend
- Node.js + Express + TypeScript
- PostgreSQL (primary database)
- Redis (caching & job queue)
- Bull (job queue for code execution)
- JWT authentication

### Code Execution
- Docker containers with resource limits
- Support for multiple languages (Python, JavaScript, Java, C++)

## Project Structure

```
leetcode-clone/
├── frontend/          # React frontend application
├── backend/           # Node.js backend API
├── execution-engine/  # Code execution service
└── docker/            # Docker configurations
```

## Getting Started

See individual README files in each directory for setup instructions.

## Development

```bash
# Install dependencies for all services
npm run install:all

# Start all services in development mode
npm run dev

# Run tests
npm run test
```

## License

MIT
