import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { 
  ShieldCheck, Plus, Trash2, Edit3, Search, AlertCircle, Check, X, Code2, 
  Terminal 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProblemRow {
  id: string;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  acceptance_rate: string | number;
  total_submissions: number;
}

interface TestCaseForm {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface ProblemFormData {
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  constraints: string;
  tags: string;
  examples: string; // JSON string
  testCases: TestCaseForm[];
}

const initialForm: ProblemFormData = {
  title: '',
  slug: '',
  difficulty: 'Easy',
  description: '',
  constraints: '',
  tags: 'Array, Hash Table',
  examples: '[\n  {\n    "input": "nums = [2,7,11,15], target = 9",\n    "output": "[0,1]"\n  }\n]',
  testCases: [
    { input: 'nums = [2,7,11,15], target = 9', expectedOutput: '[0,1]', isHidden: false },
    { input: 'nums = [3,2,4], target = 6', expectedOutput: '[1,2]', isHidden: false },
    { input: 'nums = [3,3], target = 6', expectedOutput: '[0,1]', isHidden: true },
  ],
};

export default function AdminProblemsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProblemFormData>(initialForm);

  // Check admin rights
  const isAdmin = user?.role === 'admin';

  // 1. Fetch Problems
  const { data, isLoading } = useQuery({
    queryKey: ['admin-problems'],
    queryFn: async () => {
      const resp = await api.get('/problems?limit=100');
      return resp.data.data.problems as ProblemRow[];
    },
    enabled: isAdmin,
  });

  // 2. Create Problem Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await api.post('/problems', payload);
    },
    onSuccess: () => {
      toast.success('Problem created successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-problems'] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create problem');
    },
  });

  // 3. Update Problem Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      return await api.put(`/problems/${id}`, payload);
    },
    onSuccess: () => {
      toast.success('Problem updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-problems'] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update problem');
    },
  });

  // 4. Delete Problem Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/problems/${id}`);
    },
    onSuccess: () => {
      toast.success('Problem deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-problems'] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete problem');
    },
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProblemId(null);
    setFormData(initialForm);
  };

  const openCreateModal = () => {
    setEditingProblemId(null);
    setFormData(initialForm);
    setIsModalOpen(true);
  };

  const openEditModal = async (problem: ProblemRow) => {
    try {
      const resp = await api.get(`/problems/${problem.slug}`);
      const full = resp.data.data.problem;
      setEditingProblemId(full.id);
      setFormData({
        title: full.title,
        slug: full.slug,
        difficulty: full.difficulty,
        description: full.description,
        constraints: full.constraints || '',
        tags: (full.tags || []).join(', '),
        examples: JSON.stringify(full.examples || [], null, 2),
        testCases: (full.testCases || []).map((tc: any) => ({
          input: tc.input,
          expectedOutput: tc.expected_output,
          isHidden: tc.is_hidden,
        })),
      });
      setIsModalOpen(true);
    } catch (_) {
      toast.error('Failed to load problem details');
    }
  };

  const handleTitleChange = (val: string) => {
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setFormData((prev) => ({
      ...prev,
      title: val,
      slug: editingProblemId ? prev.slug : autoSlug,
    }));
  };

  const handleAddTestCase = () => {
    setFormData((prev) => ({
      ...prev,
      testCases: [
        ...prev.testCases,
        { input: '', expectedOutput: '', isHidden: true },
      ],
    }));
  };

  const handleRemoveTestCase = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      testCases: prev.testCases.filter((_, idx) => idx !== index),
    }));
  };

  const handleTestCaseChange = (index: number, field: keyof TestCaseForm, val: any) => {
    setFormData((prev) => {
      const next = [...prev.testCases];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, testCases: next };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let parsedExamples: any[] = [];
    try {
      parsedExamples = JSON.parse(formData.examples || '[]');
    } catch (_) {
      toast.error('Examples must be valid JSON');
      return;
    }

    const tagsArray = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: formData.title.trim(),
      slug: formData.slug.trim(),
      difficulty: formData.difficulty,
      description: formData.description.trim(),
      constraints: formData.constraints.trim(),
      tags: tagsArray,
      examples: parsedExamples,
      testCases: formData.testCases.map((tc) => ({
        input: tc.input.trim(),
        expectedOutput: tc.expectedOutput.trim(),
        isHidden: tc.isHidden,
      })),
    };

    if (!payload.title || !payload.slug || !payload.description) {
      toast.error('Please fill in required fields (Title, Slug, Description)');
      return;
    }

    if (editingProblemId) {
      updateMutation.mutate({ id: editingProblemId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-full mb-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          You must be an administrator to access the Problem Management Panel.
        </p>
      </div>
    );
  }

  const problemsList = (data || []).filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-2.5">
              <ShieldCheck className="h-6 w-6 text-blue-500" />
              <h1 className="text-2xl font-bold text-white">Admin Problem Management</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Create, modify, manage testcases, and delete algorithmic problems on CodeArena
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 sm:w-64"
              />
            </div>
            <button
              onClick={openCreateModal}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>New Problem</span>
            </button>
          </div>
        </div>

        {/* Problems List Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Title / Slug</th>
                  <th className="py-3 px-5">Difficulty</th>
                  <th className="py-3 px-5">Tags</th>
                  <th className="py-3 px-5 text-right">Acceptance</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Loading problems...
                    </td>
                  </tr>
                ) : problemsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No problems found.
                    </td>
                  </tr>
                ) : (
                  problemsList.map((problem) => (
                    <tr key={problem.id} className="hover:bg-slate-850/40 transition">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-white text-sm">{problem.title}</div>
                        <div className="text-slate-500 text-[11px] font-mono mt-0.5">{problem.slug}</div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            problem.difficulty === 'Easy'
                              ? 'text-green-400 bg-green-500/10 border-green-500/30'
                              : problem.difficulty === 'Medium'
                              ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                              : 'text-red-400 bg-red-500/10 border-red-500/30'
                          }`}
                        >
                          {problem.difficulty}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {problem.tags?.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-slate-300">
                        {(parseFloat(String(problem.acceptance_rate)) || 0).toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(problem)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition"
                            title="Edit Problem"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${problem.title}"?`)) {
                                deleteMutation.mutate(problem.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                            title="Delete Problem"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================= MODAL: CREATE / EDIT PROBLEM ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Code2 className="h-5 w-5 text-blue-500" />
                {editingProblemId ? 'Edit Problem' : 'Create New Problem'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Title & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Valid Anagram"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Slug *</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g. valid-anagram"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Difficulty & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Difficulty</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="Array, Hash Table, Two Pointers"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Problem Description *</label>
                <textarea
                  rows={5}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Given two strings s and t, return true if t is an anagram of s..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                />
              </div>

              {/* Constraints */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Constraints</label>
                <textarea
                  rows={2}
                  value={formData.constraints}
                  onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
                  placeholder="1 <= s.length, t.length <= 5 * 10^4"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Examples (JSON) */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Examples (JSON Array)</label>
                <textarea
                  rows={3}
                  value={formData.examples}
                  onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Test Cases */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-blue-400" />
                    <span>Test Cases ({formData.testCases.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTestCase}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Test Case</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {formData.testCases.map((tc, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Case #{idx + 1}</span>
                        <div className="flex items-center space-x-3">
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tc.isHidden}
                              onChange={(e) => handleTestCaseChange(idx, 'isHidden', e.target.checked)}
                              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                            />
                            <span>Hidden (Evaluation only)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveTestCase(idx)}
                            className="text-slate-500 hover:text-red-400 p-0.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <input
                            type="text"
                            required
                            placeholder="Input: s = 'anagram', t = 'nagaram'"
                            value={tc.input}
                            onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-blue-300 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            required
                            placeholder="Expected Output: True"
                            value={tc.expectedOutput}
                            onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-green-300 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>{editingProblemId ? 'Save Changes' : 'Create Problem'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
