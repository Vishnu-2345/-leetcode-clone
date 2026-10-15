import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/axios';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { Play, Check, X, Clock, ChevronRight } from 'lucide-react';

const languageTemplates: Record<string, string> = {
  javascript: `function solution(input) {
  // Your code here
  return result;
}`,
  python: `def solution(input):
    # Your code here
    return result`,
  java: `class Solution {
    public String solution(String input) {
        // Your code here
        return result;
    }
}`,
  cpp: `#include <iostream>
#include <string>

std::string solution(std::string input) {
    // Your code here
    return result;
}`,
};

export default function ProblemDetailPage() {
  const { slug } = useParams();
  const [code, setCode] = useState(languageTemplates.javascript);
  const [language, setLanguage] = useState('javascript');
  const [activeTab, setActiveTab] = useState<'description' | 'submissions'>('description');

  const { data: problemData, isLoading } = useQuery({
    queryKey: ['problem', slug],
    queryFn: async () => {
      const response = await api.get(`/problems/${slug}`);
      return response.data.data.problem;
    },
  });

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
      toast.success('Code submitted successfully!');
      // Poll for results
      checkSubmissionStatus(data.submission.id);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Submission failed');
    },
  });

  const checkSubmissionStatus = async (submissionId: string) => {
    // This would poll the submission status
    // For now, just show success
    toast.success('Checking your submission...');
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    setCode(languageTemplates[newLanguage as keyof typeof languageTemplates]);
  };

  const handleSubmit = () => {
    if (!code.trim()) {
      toast.error('Please write some code first');
      return;
    }
    submitMutation.mutate();
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading problem...</div>
      </div>
    );
  }

  if (!problemData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Problem not found</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Left Panel - Problem Description */}
      <div className="w-1/2 border-r border-slate-700 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-3">{problemData.title}</h1>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium border ${getDifficultyColor(
                  problemData.difficulty
                )}`}
              >
                {problemData.difficulty}
              </span>
              {problemData.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-sm bg-slate-700 text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700 mb-6">
            <button
              onClick={() => setActiveTab('description')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'description'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'submissions'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Submissions
            </button>
          </div>

          {/* Description Tab */}
          {activeTab === 'description' && (
            <div className="space-y-6">
              {/* Description */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">Description</h2>
                <div
                  className="text-gray-300 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: problemData.description }}
                />
              </div>

              {/* Examples */}
              {problemData.examples && problemData.examples.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-3">Examples</h2>
                  {problemData.examples.map((example: any, index: number) => (
                    <div key={index} className="mb-4 bg-slate-800 p-4 rounded-lg">
                      <div className="mb-2">
                        <span className="text-gray-400">Input:</span>
                        <code className="ml-2 text-blue-400">{example.input}</code>
                      </div>
                      <div className="mb-2">
                        <span className="text-gray-400">Output:</span>
                        <code className="ml-2 text-green-400">{example.output}</code>
                      </div>
                      {example.explanation && (
                        <div>
                          <span className="text-gray-400">Explanation:</span>
                          <p className="ml-2 text-gray-300">{example.explanation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Constraints */}
              {problemData.constraints && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-3">Constraints</h2>
                  <div
                    className="text-gray-300 leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: problemData.constraints }}
                  />
                </div>
              )}

              {/* Test Cases */}
              {problemData.testCases && problemData.testCases.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-3">Sample Test Cases</h2>
                  {problemData.testCases.map((testCase: any, index: number) => (
                    <div key={testCase.id} className="mb-3 bg-slate-800 p-3 rounded">
                      <div className="text-sm">
                        <span className="text-gray-400">Test {index + 1} Input:</span>
                        <code className="ml-2 text-blue-400">{testCase.input}</code>
                      </div>
                      <div className="text-sm mt-1">
                        <span className="text-gray-400">Expected Output:</span>
                        <code className="ml-2 text-green-400">{testCase.expected_output}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submissions Tab */}
          {activeTab === 'submissions' && (
            <div>
              <p className="text-gray-400">Your submission history will appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Code Editor */}
      <div className="w-1/2 flex flex-col bg-slate-900">
        {/* Editor Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded text-sm font-medium transition"
          >
            {submitMutation.isPending ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>Submit</span>
              </>
            )}
          </button>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1">
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>
      </div>
    </div>
  );
}
