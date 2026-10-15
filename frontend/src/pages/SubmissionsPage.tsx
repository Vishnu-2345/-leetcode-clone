import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/axios';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SubmissionsPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['submissions', user?.id],
    queryFn: async () => {
      const response = await api.get(`/submissions/user/${user?.id}`);
      return response.data.data;
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Accepted':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'Wrong Answer':
      case 'Runtime Error':
      case 'Compile Error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'text-green-500';
      case 'Wrong Answer':
      case 'Runtime Error':
      case 'Compile Error':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">My Submissions</h1>
        <p className="text-gray-400">View all your code submissions and results</p>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Problem
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Language
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Runtime
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : data?.submissions?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                  No submissions yet. Start solving problems!
                </td>
              </tr>
            ) : (
              data?.submissions?.map((submission: any) => (
                <tr key={submission.id} className="hover:bg-slate-750 transition">
                  <td className="px-6 py-4">
                    <Link
                      to={`/problems/${submission.problem_slug}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {submission.problem_title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(submission.status)}
                      <span className={`font-medium ${getStatusColor(submission.status)}`}>
                        {submission.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300 capitalize">
                    {submission.language}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {submission.runtime ? `${submission.runtime}ms` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {new Date(submission.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
