import { Link } from 'react-router-dom';
import { Code2, User, LogOut, Trophy, ShieldCheck, Swords } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Code2 className="h-8 w-8 text-blue-500" />
              <span className="text-xl font-bold text-white">CodeArena</span>
            </Link>
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                to="/problems"
                className="text-gray-300 hover:bg-slate-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Problems
              </Link>
              <Link
                to="/leaderboard"
                className="text-gray-300 hover:bg-slate-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5"
              >
                <Trophy className="h-4 w-4 text-yellow-500" />
                Leaderboard
              </Link>
              <Link
                to="/arena"
                className="text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 transition"
              >
                <Swords className="h-4 w-4 text-rose-400" />
                <span>1v1 Arena</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                  LIVE
                </span>
              </Link>
              {isAuthenticated && (
                <Link
                  to="/submissions"
                  className="text-gray-300 hover:bg-slate-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Submissions
                </Link>
              )}
              {isAuthenticated && isAdmin && (
                <Link
                  to="/admin/problems"
                  className="text-blue-400 hover:bg-slate-700 hover:text-blue-300 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5"
                >
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  Admin Panel
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center space-x-2 text-gray-300 hover:text-white"
                >
                  <User className="h-5 w-5" />
                  <span className="text-sm font-medium">{user?.username}</span>
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center space-x-2 text-gray-300 hover:text-white"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
