import { config } from '../config';
import { logger } from '../utils/logger';

export interface ComplexityResult {
  timeComplexity: string;
  spaceComplexity: string;
  explanation: string;
  optimizationTips: string[];
  source: 'gemini' | 'ollama' | 'heuristic_engine';
}

export interface HintResult {
  hintLevel: number;
  title: string;
  hintText: string;
  source: 'gemini' | 'ollama' | 'heuristic_engine';
}

export interface CodeReviewResult {
  rating: number;
  summary: string;
  strengths: string[];
  suggestions: string[];
  edgeCases: string[];
  source: 'gemini' | 'ollama' | 'heuristic_engine';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface ChatResult {
  reply: string;
  source: 'gemini' | 'ollama' | 'heuristic_engine';
}

// Helper: Call Gemini REST API
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string | null> {
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${systemPrompt}\n\n${userPrompt}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn(`Gemini API error (${response.status}): ${errText}`);
      return null;
    }

    const data: any = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    return text || null;
  } catch (err) {
    logger.warn('Failed to call Gemini API:', err);
    return null;
  }
}

// Helper: Call Local Ollama API
async function callOllama(
  systemPrompt: string,
  userPrompt: string,
  ollamaUrl: string = config.ai.ollamaUrl
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ai.ollamaModel,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    const data: any = await response.json();
    return data.response || null;
  } catch (_) {
    return null;
  }
}

// Main LLM Dispatcher
async function queryLLM(
  systemPrompt: string,
  userPrompt: string,
  customApiKey?: string
): Promise<{ text: string; source: 'gemini' | 'ollama' } | null> {
  const geminiKey = customApiKey || config.ai.geminiApiKey;

  if (geminiKey) {
    const text = await callGemini(systemPrompt, userPrompt, geminiKey);
    if (text) {
      return { text, source: 'gemini' };
    }
  }

  // Fallback to Ollama
  const ollamaText = await callOllama(systemPrompt, userPrompt);
  if (ollamaText) {
    return { text: ollamaText, source: 'ollama' };
  }

  return null;
}

// 1. Analyze Complexity (Time & Space Big-O)
export async function analyzeComplexity(
  problemTitle: string,
  problemDescription: string,
  code: string,
  language: string,
  customApiKey?: string
): Promise<ComplexityResult> {
  const systemPrompt = `You are a world-class algorithm analysis expert for competitive programming.
Analyze the provided code solution for the given coding problem.
You MUST output your response strictly as valid JSON matching this schema:
{
  "timeComplexity": "e.g. O(N) or O(N log N) or O(M * N)",
  "spaceComplexity": "e.g. O(1) or O(N) or O(M * N)",
  "explanation": "Detailed 2-3 paragraph explanation of the algorithmic loops, recursion depth, and auxiliary data structures.",
  "optimizationTips": ["tip 1", "tip 2", "tip 3"]
}
Do NOT include markdown formatting or backticks around the JSON.`;

  const userPrompt = `Problem: ${problemTitle}
Language: ${language}
Code:
${code}`;

  const llmRes = await queryLLM(systemPrompt, userPrompt, customApiKey);

  if (llmRes) {
    try {
      const cleanJson = llmRes.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        timeComplexity: parsed.timeComplexity || 'O(N)',
        spaceComplexity: parsed.spaceComplexity || 'O(1)',
        explanation: parsed.explanation || 'Analyzed code operations and memory allocation.',
        optimizationTips: Array.isArray(parsed.optimizationTips) ? parsed.optimizationTips : [],
        source: llmRes.source,
      };
    } catch (_) {}
  }

  // Fallback: Intelligent Static Heuristic Complexity Analyzer
  return analyzeComplexityHeuristic(code, language, problemTitle);
}

// 2. Socratic Hint Engine
export async function getHint(
  problemTitle: string,
  problemDescription: string,
  code: string,
  language: string,
  hintLevel: number = 1,
  customApiKey?: string
): Promise<HintResult> {
  const levelDescriptions = {
    1: 'LEVEL 1 (Conceptual Intuition): Give a guiding philosophical or thought-provoking observation. NEVER name the algorithm or write code.',
    2: 'LEVEL 2 (Algorithmic Pattern): Suggest the optimal algorithmic paradigm or data structure (e.g. Two Pointers, Monotonic Stack, Dynamic Programming) and explain WHY it fits.',
    3: 'LEVEL 3 (Pseudocode & Edge Cases): Provide a concrete step-by-step logic breakdown and key edge cases to guard against.',
  };

  const systemPrompt = `You are a supportive, insightful FAANG engineering interviewer using the Socratic method.
Target: ${levelDescriptions[hintLevel as 1 | 2 | 3] || levelDescriptions[1]}
Be concise, inspiring, and educational. Use Markdown formatting.`;

  const userPrompt = `Problem: ${problemTitle}
Problem Description:
${problemDescription.slice(0, 800)}

Candidate's current code:
${code || '(No code written yet)'}`;

  const llmRes = await queryLLM(systemPrompt, userPrompt, customApiKey);

  const titles = {
    1: '💡 Hint 1: High-Level Intuition',
    2: '🛠️ Hint 2: Pattern & Data Structure',
    3: '📝 Hint 3: Blueprint & Edge Cases',
  };

  if (llmRes) {
    return {
      hintLevel,
      title: titles[hintLevel as 1 | 2 | 3] || '💡 Algorithmic Hint',
      hintText: llmRes.text,
      source: llmRes.source,
    };
  }

  // Fallback Heuristic Hints
  return getHintHeuristic(problemTitle, problemDescription, hintLevel);
}

// 3. AI Code Review
export async function reviewCode(
  problemTitle: string,
  code: string,
  language: string,
  customApiKey?: string
): Promise<CodeReviewResult> {
  const systemPrompt = `You are a Staff Software Engineer reviewing an interview candidate's solution for "${problemTitle}".
Provide constructive, high-signal feedback.
You MUST reply strictly with valid JSON:
{
  "rating": 8, // Integer 1-10
  "summary": "High-level summary of code cleanliness and algorithmic approach",
  "strengths": ["Clear naming", "Optimal time complexity"],
  "suggestions": ["Consider handling empty input early", "Use dict.get() for safer lookup"],
  "edgeCases": ["Empty string/array", "Duplicates", "Large values causing overflow"]
}
Do NOT include markdown backticks around the JSON.`;

  const userPrompt = `Language: ${language}\nCode:\n${code}`;

  const llmRes = await queryLLM(systemPrompt, userPrompt, customApiKey);

  if (llmRes) {
    try {
      const cleanJson = llmRes.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        rating: typeof parsed.rating === 'number' ? parsed.rating : 8,
        summary: parsed.summary || 'Code is functional and structured well.',
        strengths: parsed.strengths || [],
        suggestions: parsed.suggestions || [],
        edgeCases: parsed.edgeCases || [],
        source: llmRes.source,
      };
    } catch (_) {}
  }

  // Heuristic review fallback
  return reviewCodeHeuristic(code, language);
}

// 4. Interactive Coach Chat
export async function askCoach(
  problemTitle: string,
  problemDescription: string,
  code: string,
  language: string,
  message: string,
  history: ChatMessage[] = [],
  customApiKey?: string
): Promise<ChatResult> {
  const systemPrompt = `You are "Socrates", an encouraging, brilliant AI Coding Interviewer at CodeArena.
Problem: ${problemTitle}
Candidate Language: ${language}
Current Code:
${code}

Your job is to answer the candidate's question, clarify algorithmic concepts, or guide them through debugging.
Format your response with rich Markdown, code blocks where appropriate, and clear bullet points.`;

  const conversation = history
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Candidate' : 'Socrates'}: ${m.content}`)
    .join('\n\n');

  const userPrompt = `${conversation ? `${conversation}\n\n` : ''}Candidate: ${message}`;

  const llmRes = await queryLLM(systemPrompt, userPrompt, customApiKey);

  if (llmRes) {
    return {
      reply: llmRes.text,
      source: llmRes.source,
    };
  }

  return {
    reply: `I analyzed your code for **${problemTitle}**. Notice how your variables are initialized. If you want to optimize your time complexity, examine where repetitive computations occur inside your primary loop, and consider whether a hash map, two pointers, or memoization table can cache prior states!`,
    source: 'heuristic_engine',
  };
}

// ==========================================
// HEURISTIC ENGINE IMPLEMENTATIONS (FALLBACKS)
// ==========================================

function analyzeComplexityHeuristic(
  code: string,
  language: string,
  problemTitle: string
): ComplexityResult {
  const lower = code.toLowerCase();

  // Time Complexity Detection
  let timeComplexity = 'O(N)';
  let timeReason = 'Single linear traversal over the input elements.';

  // Check nested loops
  const forMatches = (code.match(/\bfor\b|\bwhile\b/g) || []).length;
  const is2DMatrix = /\[\s*\[.*?for.*?for/s.test(code) || /for.*?for/s.test(code);

  if (forMatches >= 3) {
    timeComplexity = 'O(N³)';
    timeReason = 'Multiple nested loops iterating over the dataset.';
  } else if (forMatches >= 2 || is2DMatrix) {
    if (lower.includes('len(s)') && lower.includes('len(p)')) {
      timeComplexity = 'O(m × n)';
      timeReason = '2D grid traversal iterating across both string lengths $m$ and $n$.';
    } else {
      timeComplexity = 'O(N²)';
      timeReason = 'Nested iteration through the input collection.';
    }
  } else if (lower.includes('.sort') || lower.includes('sorted(')) {
    timeComplexity = 'O(N log N)';
    timeReason = 'Sorting routine dominates the execution time.';
  } else if (lower.includes('while') && (lower.includes('left < right') || lower.includes('// 2') || lower.includes('>> 1'))) {
    timeComplexity = 'O(log N)';
    timeReason = 'Binary search halving the search space each step.';
  }

  // Space Complexity Detection
  let spaceComplexity = 'O(1)';
  let spaceReason = 'Constant additional memory using scalar variables and pointers.';

  if (is2DMatrix || lower.includes('dp = [[') || lower.includes('vector<vector<')) {
    spaceComplexity = lower.includes('len(s)') ? 'O(m × n)' : 'O(N²)';
    spaceReason = '2D dynamic programming grid allocated in memory.';
  } else if (
    lower.includes('dict(') ||
    lower.includes('defaultdict(') ||
    lower.includes('set(') ||
    lower.includes('new map') ||
    lower.includes('hashmap') ||
    lower.includes('unordered_map')
  ) {
    spaceComplexity = 'O(N)';
    spaceReason = 'Auxiliary hash table/set storing up to $N$ unique items.';
  } else if (forMatches > 0 && (lower.includes('result.append') || lower.includes('result.push'))) {
    spaceComplexity = 'O(N)';
    spaceReason = 'Output data structure storing elements proportional to input size.';
  }

  return {
    timeComplexity,
    spaceComplexity,
    explanation: `**Time Complexity: ${timeComplexity}** — ${timeReason}\n\n**Space Complexity: ${spaceComplexity}** — ${spaceReason}`,
    optimizationTips: [
      'Check if auxiliary space can be reduced to O(1) or O(min(m, n)) by using two rolling rows instead of a full 2D table.',
      'For string anagrams or character frequency, a fixed-size 26-element array provides O(1) auxiliary space compared to a general dictionary.',
      'Guard against early exit conditions before initiating full state allocation.',
    ],
    source: 'heuristic_engine',
  };
}

function getHintHeuristic(
  problemTitle: string,
  problemDescription: string,
  level: number
): HintResult {
  const hints: Record<number, { title: string; text: string }> = {
    1: {
      title: '💡 Hint 1: High-Level Intuition',
      text: `Think about how you would solve **${problemTitle}** manually with pencil and paper.
- What is the invariant that must hold true at every step?
- Can you break down the problem into smaller identical sub-problems?
- Ask yourself: *"If I already know the answer for a prefix or smaller slice, can I determine the answer for the next character or number?"*`,
    },
    2: {
      title: '🛠️ Hint 2: Pattern & Data Structure',
      text: `Consider these core algorithmic patterns for **${problemTitle}**:
- **Dynamic Programming / Memoization:** If subproblems overlap, cache state transitions in a table $dp[i][j]$.
- **Hash Map / Frequency Counter:** If looking for matches, anagrams, or target sums, lookups can be reduced from $\\mathcal{O}(N)$ to $\\mathcal{O}(1)$.
- **Two Pointers:** If dealing with sorted sequences or matching from both ends, can pointers move inward or outward?`,
    },
    3: {
      title: '📝 Hint 3: Blueprint & Edge Cases',
      text: `**Concrete Execution Blueprint:**
1. **Base Cases:** Handle empty inputs ($0$ length), single element cases, and boundaries first.
2. **State Transition:** Define $dp[i][j]$ clearly (e.g. does prefix of length $i$ match pattern of length $j$?).
3. **Guard against:**
   - Index out-of-bounds at $i-1$ or $j-1$.
   - Wildcards matching empty strings (e.g. \`*\` matching 0 occurrences).
   - Duplicate entries in frequency maps.`,
    },
  };

  const selected = hints[level] || hints[1];
  return {
    hintLevel: level,
    title: selected.title,
    hintText: selected.text,
    source: 'heuristic_engine',
  };
}

function reviewCodeHeuristic(code: string, language: string): CodeReviewResult {
  const lines = code.split('\n').filter((l) => l.trim().length > 0);
  const rating = lines.length > 5 ? 8 : 6;

  return {
    rating,
    summary: 'The code demonstrates a structured algorithmic approach with clear logic boundaries.',
    strengths: [
      'Clean modular solution structure adhering to standard competitive programming harness.',
      'Explicit variable naming and organized helper structures.',
      'Appropriate use of language built-ins.',
    ],
    suggestions: [
      'Consider adding early-return boundary checks for edge cases (e.g. empty inputs).',
      'Optimize space by reusing state rows if using tabular dynamic programming.',
      'Add brief inline comments explaining non-trivial transition logic.',
    ],
    edgeCases: [
      'Empty strings or 0-length input arrays',
      'Inputs consisting entirely of repeating characters or symbols',
      'Inputs where no match is possible (worst-case traversal)',
    ],
    source: 'heuristic_engine',
  };
}

