import React, { useState } from 'react';
import { api } from '../lib/axios';
import toast from 'react-hot-toast';
import {
  Sparkles,
  Cpu,
  Lightbulb,
  ShieldAlert,
  MessageSquare,
  Send,
  RefreshCw,
  Key,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

interface AICoachPanelProps {
  problemTitle: string;
  problemDescription: string;
  code: string;
  language: string;
}

interface ComplexityData {
  timeComplexity: string;
  spaceComplexity: string;
  explanation: string;
  optimizationTips: string[];
  source: string;
}

interface CodeReviewData {
  rating: number;
  summary: string;
  strengths: string[];
  suggestions: string[];
  edgeCases: string[];
  source: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const AICoachPanel: React.FC<AICoachPanelProps> = ({
  problemTitle,
  problemDescription,
  code,
  language,
}) => {
  const [subTab, setSubTab] = useState<'complexity' | 'hints' | 'review' | 'chat'>('complexity');

  // Custom API Key from LocalStorage
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('codearena_gemini_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  // 1. Complexity State
  const [complexity, setComplexity] = useState<ComplexityData | null>(null);
  const [loadingComplexity, setLoadingComplexity] = useState(false);

  // 2. Hints State
  const [unlockedHintLevel, setUnlockedHintLevel] = useState<number>(1);
  const [hints, setHints] = useState<Record<number, { title: string; text: string }>>({});
  const [loadingHint, setLoadingHint] = useState(false);

  // 3. Review State
  const [review, setReview] = useState<CodeReviewData | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  // 4. Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I'm **Socrates**, your AI algorithm coach. Ask me anything about **${problemTitle}**, time/space trade-offs, or debugging edge cases!`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  const getHeaders = () => {
    return apiKey ? { 'x-gemini-api-key': apiKey } : {};
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('codearena_gemini_key', tempKey.trim());
    setApiKey(tempKey.trim());
    setShowKeyModal(false);
    toast.success(tempKey.trim() ? 'Gemini API Key saved!' : 'Using server default engine');
  };

  // 1. Complexity Request
  const handleAnalyzeComplexity = async () => {
    if (!code.trim()) {
      toast.error('Write some code first to analyze complexity');
      return;
    }
    setLoadingComplexity(true);
    try {
      const res = await api.post(
        '/ai/analyze-complexity',
        { problemTitle, problemDescription, code, language, apiKey },
        { headers: getHeaders() }
      );
      setComplexity(res.data.data);
      toast.success('Complexity analysis ready!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to analyze complexity');
    } finally {
      setLoadingComplexity(false);
    }
  };

  // 2. Hint Request
  const handleFetchHint = async (level: number) => {
    setLoadingHint(true);
    try {
      const res = await api.post(
        '/ai/hint',
        { problemTitle, problemDescription, code, language, hintLevel: level, apiKey },
        { headers: getHeaders() }
      );
      setHints((prev) => ({
        ...prev,
        [level]: { title: res.data.data.title, text: res.data.data.hintText },
      }));
      setUnlockedHintLevel(level);
    } catch (err: any) {
      toast.error('Failed to load hint');
    } finally {
      setLoadingHint(false);
    }
  };

  // 3. Review Request
  const handleReviewCode = async () => {
    if (!code.trim()) {
      toast.error('Write some code first to review');
      return;
    }
    setLoadingReview(true);
    try {
      const res = await api.post(
        '/ai/review',
        { problemTitle, code, language, apiKey },
        { headers: getHeaders() }
      );
      setReview(res.data.data);
      toast.success('AI Code Review complete!');
    } catch (err: any) {
      toast.error('Failed to generate code review');
    } finally {
      setLoadingReview(false);
    }
  };

  // 4. Chat Request
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim() || loadingChat) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setLoadingChat(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post(
        '/ai/chat',
        {
          problemTitle,
          problemDescription,
          code,
          language,
          message: text,
          history,
          apiKey,
        },
        { headers: getHeaders() }
      );

      const botReply: ChatMessage = {
        role: 'assistant',
        content: res.data.data.reply,
      };
      setMessages((prev) => [...prev, botReply]);
    } catch (err) {
      toast.error('Failed to get coach response');
    } finally {
      setLoadingChat(false);
    }
  };

  const getComplexityBadge = (c: string) => {
    const upper = c.toUpperCase();
    if (upper.includes('O(1)') || upper.includes('O(LOG')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (upper.includes('O(N)') && !upper.includes('O(N^') && !upper.includes('O(N LOG')) {
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
    if (upper.includes('LOG') || upper.includes('O(M + N)')) {
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    }
    return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Provider Status */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">Socrates AI Coach</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {apiKey ? 'Gemini 2.0 (Custom Key)' : 'Smart Engine'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive complexity analysis, socratic hints, and code review
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowKeyModal(true)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          title="Configure Gemini API Key"
        >
          <Key className="h-3.5 w-3.5 text-indigo-400" />
          <span>{apiKey ? 'Key Configured' : 'Set Gemini Key'}</span>
        </button>
      </div>

      {/* Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Gemini API Key Settings</h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add your Google Gemini API key to enable live Gemini 2.0 Flash reasoning. Your key is
              saved locally in your browser. Leave blank to use server defaults.
            </p>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tabs Nav */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSubTab('complexity')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            subTab === 'complexity'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          Big-O Complexity
        </button>
        <button
          onClick={() => {
            setSubTab('hints');
            if (!hints[1]) handleFetchHint(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            subTab === 'hints'
              ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          Socratic Hints
        </button>
        <button
          onClick={() => setSubTab('review')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            subTab === 'review'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Code Review
        </button>
        <button
          onClick={() => setSubTab('chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            subTab === 'chat'
              ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Ask Socrates
        </button>
      </div>

      {/* ================= 1. BIG-O COMPLEXITY TAB ================= */}
      {subTab === 'complexity' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white">Algorithmic Asymptotics</h4>
              <p className="text-xs text-slate-400">
                Calculates Time & Space complexity for your currently written code.
              </p>
            </div>
            <button
              onClick={handleAnalyzeComplexity}
              disabled={loadingComplexity}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
            >
              {loadingComplexity ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Cpu className="h-3.5 w-3.5" />
                  Analyze Big-O
                </>
              )}
            </button>
          </div>

          {complexity ? (
            <div className="space-y-4">
              {/* Big-O Badges Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Time Complexity</span>
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-lg font-mono font-bold border ${getComplexityBadge(
                        complexity.timeComplexity
                      )}`}
                    >
                      {complexity.timeComplexity}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Space Complexity</span>
                    <Cpu className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-lg font-mono font-bold border ${getComplexityBadge(
                        complexity.spaceComplexity
                      )}`}
                    >
                      {complexity.spaceComplexity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-2">
                <h5 className="text-xs font-semibold text-slate-200">Mathematical Breakdown:</h5>
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {complexity.explanation}
                </div>
              </div>

              {/* Optimization Tips */}
              {complexity.optimizationTips && complexity.optimizationTips.length > 0 && (
                <div className="bg-blue-950/20 border border-blue-500/20 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                    <Lightbulb className="h-4 w-4" />
                    <span>Optimization Advice:</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {complexity.optimizationTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <Cpu className="h-5 w-5" />
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Click <strong>"Analyze Big-O"</strong> to inspect asymptotic time and space limits,
                bottleneck loops, and memory trade-offs.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================= 2. SOCRATIC HINTS TAB ================= */}
      {subTab === 'hints' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white">Progressive Socratic Hints</h4>
              <p className="text-xs text-slate-400">
                Unlock hints step-by-step without spoiling the core solution.
              </p>
            </div>
            <div className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              Tier {unlockedHintLevel} of 3
            </div>
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map((lvl) => {
              const isUnlocked = unlockedHintLevel >= lvl;
              const hintContent = hints[lvl];

              return (
                <div
                  key={lvl}
                  className={`border rounded-xl p-4 transition ${
                    isUnlocked
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isUnlocked
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {lvl}
                      </span>
                      <h5 className="text-xs font-bold text-slate-200">
                        {lvl === 1 && '💡 Intuition & Mental Model'}
                        {lvl === 2 && '🛠️ Algorithmic Pattern & Data Structures'}
                        {lvl === 3 && '📝 Blueprint & Edge Cases'}
                      </h5>
                    </div>

                    {!isUnlocked && (
                      <button
                        onClick={() => handleFetchHint(lvl)}
                        disabled={loadingHint}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-semibold transition"
                      >
                        {loadingHint ? 'Unlocking...' : 'Unlock Hint'}
                      </button>
                    )}
                  </div>

                  {isUnlocked && hintContent ? (
                    <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap pl-8 font-sans">
                      {hintContent.text}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 pl-8 italic">
                      Locked. Try solving on your own or unlock when stuck.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 3. CODE REVIEW TAB ================= */}
      {subTab === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white">AI Code Review & Quality Audit</h4>
              <p className="text-xs text-slate-400">
                Staff Engineer style feedback on readability, idioms, and edge cases.
              </p>
            </div>
            <button
              onClick={handleReviewCode}
              disabled={loadingReview}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
            >
              {loadingReview ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Auditing...
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Review Code
                </>
              )}
            </button>
          </div>

          {review ? (
            <div className="space-y-4">
              {/* Score Card */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Solution Quality Score</div>
                  <div className="text-sm text-slate-200 mt-1 font-medium">{review.summary}</div>
                </div>
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    {review.rating}
                  </span>
                  <span className="text-xs text-emerald-500 font-semibold">/ 10</span>
                </div>
              </div>

              {/* Strengths & Suggestions Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Strengths</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {review.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500">✓</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>Suggestions</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {review.suggestions.map((sug, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500">→</span>
                        <span>{sug}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Edge Cases */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Crucial Edge Cases to Guard Against</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {review.edgeCases.map((ec, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-lg text-xs"
                    >
                      {ec}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Hit <strong>"Review Code"</strong> to check for edge cases, variable hygiene, and
                interview-readiness.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================= 4. ASK SOCRATES (CHAT) TAB ================= */}
      {subTab === 'chat' && (
        <div className="space-y-4">
          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2">
            {[
              'Can this be solved in O(1) space?',
              'Explain the core transition step',
              'What edge cases would fail?',
              'How to structure code in an interview?',
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p)}
                className="px-2.5 py-1 rounded-full text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chat Window */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-[340px] overflow-y-auto space-y-3 font-sans">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-xs leading-relaxed ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                    <Sparkles className="h-3 w-3" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-xl max-w-[85%] whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loadingChat && (
              <div className="flex gap-2 items-center text-xs text-slate-400 italic">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                Socrates is thinking...
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ask Socrates anything about this problem or your code..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={loadingChat || !chatInput.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
