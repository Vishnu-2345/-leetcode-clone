# Frontend Application

React + TypeScript frontend for the LeetCode clone platform.

## Features

- React 18 with TypeScript
- Vite for blazing fast development
- Tailwind CSS for styling
- Monaco Editor (VS Code editor)
- React Query for data fetching
- Zustand for state management
- React Router for navigation

## Prerequisites

- Node.js 18+

## Installation

```bash
npm install
```

## Environment Variables

Create `.env.local`:

```env
VITE_API_URL=http://localhost:3000
```

## Development

```bash
npm run dev
```

Application runs on `http://localhost:5173`

## Build

```bash
npm run build
```

## Pages

- **Home** - Landing page with features
- **Problems** - Browse and filter coding problems
- **Problem Detail** - Solve problems with code editor
- **Profile** - User statistics and activity
- **Submissions** - View submission history
- **Login/Register** - Authentication

## Key Components

### Code Editor
Uses Monaco Editor (same as VS Code) with:
- Syntax highlighting
- Multi-language support (JavaScript, Python, Java, C++)
- Auto-completion
- Error highlighting

### Problem List
- Filter by difficulty
- Search by title
- View acceptance rates and tags

### Split View
Problem description on left, code editor on right for optimal workflow.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Monaco Editor** - Code editor
- **React Query** - Server state
- **Zustand** - Client state
- **React Router** - Routing
- **Axios** - HTTP client
