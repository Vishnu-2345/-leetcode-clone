import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { Play, Check, X, Clock, CheckCircle, XCircle, Code, Terminal, Sparkles, Eye } from 'lucide-react';
import { AICoachPanel } from '../components/AICoachPanel';
import { AlgoLensModal } from '../components/AlgoLensModal';
import { getStarterCode } from '../lib/starterCode';

export default function ProblemDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [activeTab, setActiveTab] = useState<'description' | 'submissions' | 'ai-coach'>('description');

  // Bottom Console Tabs
  const [bottomTab, setBottomTab] = useState<'testcase' | 'result'>('testcase');
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);
  const [customInput, setCustomInput] = useState<string>('');

  // Results state
  const [runResult, setRunResult] = useState<any>(null);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [isCheckingSubmission, setIsCheckingSubmission] = useState(false);
  const [isAlgoLensOpen, setIsAlgoLensOpen] = useState(false);

  // 1. Fetch Problem Details
  const { data: problemData, isLoading } = useQuery({
    queryKey: ['problem', slug],
    queryFn: async () => {
      const response = await api.get(`/problems/${slug}`);
      return response.data.data.problem;
    },
  });

  // Load starter code or custom input when problem loads
  useEffect(() => {
    if (problemData) {
      if (problemData.testCases && problemData.testCases.length > 0) {
        setCustomInput(problemData.testCases[0].input || '');
      }
      setCode(getStarterCode(problemData, language));
    }
  }, [problemData]);

  // 2. Fetch User's Past Submissions for this problem
  const { data: submissionsData, isLoading: isLoadingSubmissions } = useQuery({
    queryKey: ['problemSubmissions', problemData?.id],
    queryFn: async () => {
      const response = await api.get(`/submissions/problem/${problemData.id}`);
      return response.data.data.submissions;
    },
    enabled: isAuthenticated && !!problemData?.id,
  });

  // 3. Mutation: Run Code (Immediate verification without recording official stats)
  const runMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/submissions/run', {
        problemId: problemData.id,
        code,
        language,
        customTestCases: customInput.trim()
          ? [{ input: customInput.trim(), expected_output: problemData.testCases?.[selectedCaseIdx]?.expected_output || '' }]
          : undefined,
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      toast.success('Running code against test cases...');
      setIsRunningCode(true);
      setBottomTab('result');
      pollRunStatus(data.runId);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Run failed');
      setIsRunningCode(false);
    },
  });

  const pollRunStatus = (runId: string) => {
    let attempts = 0;
    const maxAttempts = 20;

    const interval = setInterval(async () => {
      try {
        attempts++;
        const resp = await api.get(`/submissions/run/${runId}`);
        if (resp.data.status === 'success' && resp.data.data) {
          clearInterval(interval);
          setIsRunningCode(false);
          setRunResult(resp.data.data);
          const allOk = resp.data.data.status === 'Accepted';
          if (allOk) {
            toast.success('Test Cases Passed! ✅');
          } else {
            toast.error('Test Cases Failed');
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsRunningCode(false);
          toast.error('Execution timeout');
        }
      } catch (err) {
        clearInterval(interval);
        setIsRunningCode(false);
      }
    }, 800);
  };

  // 4. Mutation: Submit Code (Evaluates all 50-150+ hidden test cases & updates stats)
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/submissions', {
        problemId: problemData.id,
        code,
        language,
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      toast.success('Submitted! Evaluating all test cases...');
      setIsCheckingSubmission(true);
      setBottomTab('result');
      pollSubmissionStatus(data.submission.id);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Submission failed');
      setIsCheckingSubmission(false);
    },
  });

  const pollSubmissionStatus = (submissionId: string) => {
    let attempts = 0;
    const maxAttempts = 60;

    const interval = setInterval(async () => {
      try {
        attempts++;
        const response = await api.get(`/submissions/${submissionId}`);
        const submission = response.data.data.submission;

        if (submission.status !== 'Pending' && submission.status !== 'Running') {
          clearInterval(interval);
          setIsCheckingSubmission(false);
          setSubmissionResult(submission);
          queryClient.invalidateQueries({ queryKey: ['problemSubmissions', problemData?.id] });

          if (submission.status === 'Accepted') {
            toast.success(`Accepted! Passed ${submission.test_cases_total} test cases! 🎉`);
          } else {
            toast.error(`${submission.status}`);
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsCheckingSubmission(false);
          toast.error('Timeout waiting for submission results');
        }
      } catch (error) {
        clearInterval(interval);
        setIsCheckingSubmission(false);
      }
    }, 500);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    setCode(getStarterCode(problemData, newLanguage));
  };

  const handleRun = () => {
    if (!code.trim()) {
      toast.error('Please write some code first');
      return;
    }
    setSubmissionResult(null);
    runMutation.mutate();
  };

  const handleSubmit = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to submit your solution');
      navigate('/login');
      return;
    }
    if (!code.trim()) {
      toast.error('Please write some code first');
      return;
    }
    setRunResult(null);
    submitMutation.mutate();
  };

  const handleViewSubmission = async (submissionId: string) => {
    try {
      const response = await api.get(`/submissions/${submissionId}`);
      const sub = response.data.data.submission;
      setSubmissionResult(sub);
      setRunResult(null);
      setBottomTab('result');
      if (sub.code) {
        setCode(sub.code);
        if (sub.language) {
          setLanguage(sub.language);
        }
      }
      toast.success('Loaded past submission');
    } catch (err) {
      toast.error('Failed to load submission');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'text-green-500 bg-green-500/10 border-green-500';
      case 'Medium':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500';
      case 'Hard':
        return 'text-red-500 bg-red-500/10 border-red-500';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-gray-400">
        <Clock className="h-6 w-6 animate-spin mr-2 text-blue-500" />
        Loading problem...
      </div>
    );
  }

  if (!problemData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-gray-400">
        Problem not found
      </div>
    );
  }

  const sampleCases = problemData.testCases || [];

  return (
    <div className="h-[calc(100vh-64px)] flex bg-slate-950 text-slate-100">
      {/* ================= LEFT PANEL: Problem Statement & Submissions ================= */}
      <div className="w-1/2 border-r border-slate-800 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-3">{problemData.title}</h1>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getDifficultyColor(problemData.difficulty)}`}>
                {problemData.difficulty}
              </span>
              {problemData.tags?.map((tag: string) => (
                <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs bg-slate-800 text-slate-400 border border-slate-700">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 mb-6">
            <button
              onClick={() => setActiveTab('description')}
              className={`px-4 py-2 font-medium text-sm transition ${
                activeTab === 'description'
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2 font-medium text-sm transition ${
                activeTab === 'submissions'
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Submissions
            </button>
            <button
              onClick={() => setActiveTab('ai-coach')}
              className={`px-4 py-2 font-medium text-sm transition flex items-center gap-1.5 ${
                activeTab === 'ai-coach'
                  ? 'text-indigo-400 border-b-2 border-indigo-500 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>AI Coach</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                New
              </span>
            </button>
          </div>

          {/* Tab 1: Description */}
          {activeTab === 'description' && (
            <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
              <div>
                <div className="whitespace-pre-wrap leading-relaxed">{problemData.description}</div>
              </div>

              {/* Examples */}
              {problemData.examples && problemData.examples.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-white">Examples</h3>
                  {problemData.examples.map((example: any, idx: number) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-lg space-y-2">
                      <div className="font-semibold text-slate-200 text-xs">Example {idx + 1}:</div>
                      <div>
                        <span className="text-slate-400 text-xs">Input: </span>
                        <code className="text-blue-300 font-mono text-xs">{example.input}</code>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs">Output: </span>
                        <code className="text-green-300 font-mono text-xs">{example.output}</code>
                      </div>
                      {example.explanation && (
                        <div className="text-slate-400 text-xs mt-1">
                          <span>Explanation: </span>
                          <span>{example.explanation}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Constraints */}
              {problemData.constraints && (
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">Constraints</h3>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg font-mono text-xs text-slate-300 whitespace-pre-wrap">
                    {problemData.constraints}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Submissions */}
          {activeTab === 'submissions' && (
            <div className="space-y-4">
              {!isAuthenticated ? (
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg text-center">
                  <p className="text-slate-300 mb-3 text-sm">Please sign in to view your submissions.</p>
                  <Link
                    to="/login"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition"
                  >
                    Sign In
                  </Link>
                </div>
              ) : isLoadingSubmissions ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Clock className="h-5 w-5 animate-spin mr-2 text-blue-500" />
                  Loading submissions...
                </div>
              ) : !submissionsData || submissionsData.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg text-center text-slate-400 text-sm">
                  No submissions yet for this problem. Run or submit your solution to begin!
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Submission History ({submissionsData.length})
                  </div>
                  {submissionsData.map((sub: any) => (
                    <div
                      key={sub.id}
                      onClick={() => handleViewSubmission(sub.id)}
                      className="p-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-lg cursor-pointer transition flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        {sub.status === 'Accepted' ? (
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        )}
                        <div>
                          <span className={`font-semibold text-sm ${sub.status === 'Accepted' ? 'text-green-400' : 'text-red-400'}`}>
                            {sub.status}
                          </span>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="capitalize">{sub.language}</span>
                            <span>•</span>
                            <span>{new Date(sub.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        {sub.runtime !== null && <div className="text-white font-medium">{sub.runtime}ms</div>}
                        {sub.memory !== null && sub.memory > 0 && <div className="text-slate-400">{sub.memory}MB</div>}
                        <span className="text-blue-400 hover:underline text-[11px] mt-0.5 inline-block">
                          View Code
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: AI Socratic Coach & Big-O Analyzer */}
          {activeTab === 'ai-coach' && (
            <AICoachPanel
              problemTitle={problemData.title}
              problemDescription={problemData.description}
              code={code}
              language={language}
            />
          )}
        </div>
      </div>

      {/* ================= RIGHT PANEL: Code Editor + Testcase/Result Console ================= */}
      <div className="w-1/2 flex flex-col bg-slate-950">
        {/* Editor Top Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center space-x-3">
            <Code className="h-4 w-4 text-slate-400" />
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="java">Java 17</option>
              <option value="cpp">C++ (GCC)</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            {/* AI Coach Quick Trigger */}
            <button
              onClick={() => setActiveTab('ai-coach')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition shadow ${
                activeTab === 'ai-coach'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border-indigo-500/30'
              }`}
              title="Open AI Socratic Coach & Big-O Complexity"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>AI Coach</span>
            </button>

            {/* AlgoLens Visualizer Trigger */}
            <button
              onClick={() => setIsAlgoLensOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-cyan-950/70 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-500/40 transition shadow"
              title="Open AlgoLens Interactive Step-by-Step Visualizer"
            >
              <Eye className="h-3.5 w-3.5 text-cyan-400" />
              <span>AlgoLens</span>
            </button>

            {/* Run Button (Fast Sample / Custom Verification) */}
            <button
              onClick={handleRun}
              disabled={runMutation.isPending || isRunningCode}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3.5 py-1.5 rounded text-xs font-medium border border-slate-700 transition"
            >
              {isRunningCode ? (
                <>
                  <Clock className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-blue-400" />
                  <span>Run</span>
                </>
              )}
            </button>

            {/* Submit Button (Full Hidden Test Suite Evaluation) */}
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || isCheckingSubmission}
              className="flex items-center space-x-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3.5 py-1.5 rounded text-xs font-medium transition"
            >
              {isCheckingSubmission ? (
                <>
                  <Clock className="h-3.5 w-3.5 animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Submit</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Monaco Code Editor */}
        <div className="flex-1 h-[55%]">
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
            }}
          />
        </div>

        {/* Bottom Console Panel (LeetCode Style) */}
        <div className="h-[45%] border-t border-slate-800 bg-slate-900 flex flex-col">
          {/* Console Tabs */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950 text-xs font-medium">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setBottomTab('testcase')}
                className={`flex items-center space-x-1.5 py-1 ${
                  bottomTab === 'testcase' ? 'text-blue-400 border-b border-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Testcase</span>
              </button>
              <button
                onClick={() => setBottomTab('result')}
                className={`flex items-center space-x-1.5 py-1 ${
                  bottomTab === 'result' ? 'text-blue-400 border-b border-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Test Result</span>
                {(isRunningCode || isCheckingSubmission) && (
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Console Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {/* VIEW 1: Testcase Editor & Cases */}
            {bottomTab === 'testcase' && (
              <div className="space-y-4">
                {/* Case Pills */}
                <div className="flex items-center space-x-2">
                  {sampleCases.map((tc: any, idx: number) => (
                    <button
                      key={tc.id || idx}
                      onClick={() => {
                        setSelectedCaseIdx(idx);
                        setCustomInput(tc.input);
                      }}
                      className={`px-3 py-1 rounded text-xs font-medium transition ${
                        selectedCaseIdx === idx
                          ? 'bg-slate-800 text-white border border-slate-700'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Case {idx + 1}
                    </button>
                  ))}
                </div>

                {/* Test Input Editor */}
                <div>
                  <div className="text-xs text-slate-400 mb-1.5 font-medium">Input:</div>
                  <textarea
                    rows={3}
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-xs text-blue-300 focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Enter custom input (e.g. nums = [2,7,11,15], target = 9)"
                  />
                  {sampleCases[selectedCaseIdx]?.expected_output && (
                    <div className="mt-2 text-xs">
                      <span className="text-slate-400">Expected Output: </span>
                      <code className="text-green-400 font-mono">
                        {sampleCases[selectedCaseIdx].expected_output}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: Results (Run Code or Official Submission) */}
            {bottomTab === 'result' && (
              <div className="space-y-4 text-xs">
                {isRunningCode || isCheckingSubmission ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-2">
                    <Clock className="h-6 w-6 animate-spin text-blue-500" />
                    <span>{isRunningCode ? 'Running test cases...' : 'Evaluating all test cases...'}</span>
                  </div>
                ) : runResult ? (
                  /* Run Code Results (Immediate) */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        {runResult.status === 'Accepted' ? (
                          <span className="text-green-400 font-bold text-sm flex items-center gap-1.5">
                            <Check className="h-4 w-4" /> Accepted
                          </span>
                        ) : (
                          <span className="text-red-400 font-bold text-sm flex items-center gap-1.5">
                            <X className="h-4 w-4" /> Wrong Answer / Error
                          </span>
                        )}
                      </div>
                    </div>

                    {runResult.results?.map((res: any, idx: number) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded space-y-2 font-mono">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="font-semibold text-xs text-slate-200">Test Case {idx + 1}</span>
                          <span className={res.status === 'Accepted' ? 'text-green-400' : 'text-red-400'}>
                            {res.status} ({res.runtime}ms)
                          </span>
                        </div>
                        <div>
                          <div className="text-slate-500 text-[11px]">Input:</div>
                          <div className="text-blue-300 whitespace-pre-wrap">{res.input}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-[11px]">Output:</div>
                          <div className={res.status === 'Accepted' ? 'text-green-400' : 'text-red-400'}>
                            {res.output || '(No output)'}
                          </div>
                        </div>
                        {res.expected_output && (
                          <div>
                            <div className="text-slate-500 text-[11px]">Expected:</div>
                            <div className="text-green-400">{res.expected_output}</div>
                          </div>
                        )}
                        {res.error_message && (
                          <div className="p-2 bg-red-950/40 border border-red-800 rounded text-red-300 text-[11px]">
                            {res.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : submissionResult ? (
                  /* Official Submission Results */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div>
                        <div className={`font-bold text-base flex items-center gap-1.5 ${
                          submissionResult.status === 'Accepted' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {submissionResult.status === 'Accepted' ? (
                            <><CheckCircle className="h-5 w-5" /> Accepted</>
                          ) : (
                            <><XCircle className="h-5 w-5" /> {submissionResult.status}</>
                          )}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5">
                          {submissionResult.test_cases_passed} / {submissionResult.test_cases_total} test cases passed
                        </div>
                      </div>
                      {submissionResult.runtime !== null && (
                        <div className="text-right text-xs">
                          <div className="text-slate-400">Runtime</div>
                          <div className="text-white font-semibold">{submissionResult.runtime}ms</div>
                        </div>
                      )}
                    </div>

                    {submissionResult.error_message && (
                      <div className="p-3 bg-red-950/40 border border-red-800 rounded text-red-300 font-mono text-xs">
                        {submissionResult.error_message}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    Click <strong>Run</strong> to test your code, or <strong>Submit</strong> to evaluate all hidden test cases.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AlgoLens Visualizer Modal */}
      <AlgoLensModal
        isOpen={isAlgoLensOpen}
        onClose={() => setIsAlgoLensOpen(false)}
        code={code}
        language={language}
        defaultInput={customInput || problemData?.testCases?.[0]?.input || ''}
      />
    </div>
  );
}
