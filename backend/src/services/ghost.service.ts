import { Server } from 'socket.io';
import { runQueue } from './submission.service';
import { redisClient } from '../cache/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';

export type GhostDifficulty = 'Novice' | 'Gladiator' | 'Grandmaster';

export interface GhostConfig {
  difficulty: GhostDifficulty;
  rating: number;
  wpm: number;
  thinkingDelayMs: number;
  initialErrorChance: number;
}

const DIFFICULTY_PRESETS: Record<GhostDifficulty, GhostConfig> = {
  Novice: {
    difficulty: 'Novice',
    rating: 1250,
    wpm: 45,
    thinkingDelayMs: 6000,
    initialErrorChance: 0.35,
  },
  Gladiator: {
    difficulty: 'Gladiator',
    rating: 1650,
    wpm: 68,
    thinkingDelayMs: 4000,
    initialErrorChance: 0.15,
  },
  Grandmaster: {
    difficulty: 'Grandmaster',
    rating: 2150,
    wpm: 90,
    thinkingDelayMs: 2500,
    initialErrorChance: 0.0,
  },
};

export class GhostDuelistSession {
  private roomId: string;
  private problem: any;
  private botConfig: GhostConfig;
  private io: Server;
  private isAborted: boolean = false;
  private activeTimeouts: NodeJS.Timeout[] = [];
  private ghostSocketId: string;
  private ghostUsername: string;

  constructor(
    roomId: string,
    problem: any,
    difficulty: GhostDifficulty = 'Gladiator',
    io: Server
  ) {
    this.roomId = roomId;
    this.problem = problem;
    this.botConfig = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.Gladiator;
    this.io = io;
    this.ghostSocketId = `ghost_${roomId}`;
    this.ghostUsername = `GhostAI (${this.botConfig.difficulty})`;
  }

  public getBotUser() {
    return {
      id: `bot_${this.botConfig.difficulty.toLowerCase()}`,
      username: this.ghostUsername,
      rating: this.botConfig.rating,
      isGhost: true,
      difficulty: this.botConfig.difficulty,
    };
  }

  public getSocketId() {
    return this.ghostSocketId;
  }

  public stop() {
    this.isAborted = true;
    this.activeTimeouts.forEach((t) => clearTimeout(t));
    this.activeTimeouts = [];
    logger.info(`Ghost session stopped for room ${this.roomId}`);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.isAborted) return resolve();
      const t = setTimeout(() => {
        resolve();
      }, ms);
      this.activeTimeouts.push(t);
    });
  }

  public async start() {
    logger.info(`Starting Ghost Duelist for room ${this.roomId} [Difficulty: ${this.botConfig.difficulty}]`);

    // 1. Initial Humanized Thinking Phase
    await this.wait(this.botConfig.thinkingDelayMs);
    if (this.isAborted) return;

    this.io.to(this.roomId).emit('arena:opponent_progress', {
      socketId: this.ghostSocketId,
      username: this.ghostUsername,
      progress: 0,
      totalCases: this.problem.testCases?.length || 3,
      status: 'coding',
    });

    // 2. Query Live Neural Model for Solution
    let code = await this.queryNeuralSolution();
    if (!code || this.isAborted) return;

    // Optional initial bug simulation for Novice tier to test live debugging
    if (Math.random() < this.botConfig.initialErrorChance) {
      code = this.injectTemporaryBug(code);
    }

    // 3. Humanized Keystroke Streaming Loop
    await this.streamKeystrokes(code);
    if (this.isAborted) return;

    // 4. Submit to Docker Execution Engine
    await this.evaluateAndDebugLoop(code);
  }

  // --------------------------------------------------------------------------
  // LLM Query: Live Neural Inference via Gemini / Ollama / Deterministic
  // --------------------------------------------------------------------------
  private async queryNeuralSolution(failingErrorFeedback?: string): Promise<string> {
    const systemPrompt = `You are an elite competitive programmer writing clean Python 3 solutions.
Solve the problem with optimal time and space complexity.
Return ONLY valid, executable Python 3 code inside a class Solution or function solution.
Do not write markdown formatting, markdown backticks, explanations, or prose outside the code.`;

    let userPrompt = `Problem: ${this.problem.title}
Difficulty: ${this.problem.difficulty}
Description:
${this.problem.description}
Constraints:
${this.problem.constraints || 'Standard constraints'}
Examples:
${JSON.stringify(this.problem.examples || [])}`;

    if (failingErrorFeedback) {
      userPrompt += `\n\nYour previous code failed test cases with this error:\n${failingErrorFeedback}\nAnalyze the error and return the complete, corrected Python 3 code.`;
    }

    // Attempt 1: Gemini REST API
    if (config.ai.geminiApiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.ai.geminiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return this.cleanCodeOutput(text);
          }
        }
      } catch (e) {
        logger.warn('Ghost AI Gemini call failed, falling back:', e);
      }
    }

    // Attempt 2: Local Ollama Model
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${config.ai.ollamaUrl}/api/generate`, {
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
      if (res.ok) {
        const data: any = await res.json();
        if (data.response) {
          return this.cleanCodeOutput(data.response);
        }
      }
    } catch (_) {}

    // Fallback: Smart Algorithmic Generator
    return this.generateAlgorithmicFallback();
  }

  private cleanCodeOutput(raw: string): string {
    let clean = raw.trim();
    if (clean.startsWith('```python')) {
      clean = clean.replace(/^```python\s*/i, '').replace(/```\s*$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }
    return clean.trim();
  }

  private injectTemporaryBug(code: string): string {
    // Injects a minor off-by-one or missing variable that causes an initial test failure
    if (code.includes('range(')) {
      return code.replace('range(', 'range(1, ');
    }
    if (code.includes('return ')) {
      return code.replace('return ', 'pass\n        return ');
    }
    return code;
  }

  // --------------------------------------------------------------------------
  // Humanized Keystroke Emitter
  // --------------------------------------------------------------------------
  private async streamKeystrokes(fullCode: string): Promise<void> {
    const charsPerWord = 5;
    const charsPerSecond = (this.botConfig.wpm * charsPerWord) / 60;
    const baseCharDelayMs = Math.round(1000 / charsPerSecond);

    let currentBuffer = '';
    const lines = fullCode.split('\n');

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      if (this.isAborted) return;
      const line = lines[lIdx];

      // Type line character-by-character in micro-bursts of 2-4 chars
      let colIdx = 0;
      while (colIdx < line.length) {
        if (this.isAborted) return;

        const burstSize = Math.min(line.length - colIdx, Math.floor(Math.random() * 3) + 2);
        const chunk = line.substring(colIdx, colIdx + burstSize);
        currentBuffer += chunk;
        colIdx += burstSize;

        // Emit keystroke delta to room
        this.io.to(this.roomId).emit('arena:ghost_code_update', {
          roomId: this.roomId,
          ghostUsername: this.ghostUsername,
          code: currentBuffer,
          cursor: { line: lIdx + 1, col: colIdx },
          status: 'typing',
        });

        // Jittered delay
        const jitter = Math.floor(Math.random() * 20) - 10;
        await this.wait(Math.max(25, baseCharDelayMs * burstSize + jitter));
      }

      // Line break
      currentBuffer += '\n';
      this.io.to(this.roomId).emit('arena:ghost_code_update', {
        roomId: this.roomId,
        ghostUsername: this.ghostUsername,
        code: currentBuffer,
        cursor: { line: lIdx + 2, col: 0 },
        status: 'typing',
      });

      // Pause at newline / control flow
      const lineTrim = line.trim();
      let pauseMs = 150;
      if (lineTrim.endsWith(':') || lineTrim.startsWith('def ') || lineTrim.startsWith('class ')) {
        pauseMs = 400 + Math.random() * 300;
      }
      await this.wait(pauseMs);
    }
  }

  // --------------------------------------------------------------------------
  // Docker Sandbox Evaluation & Self-Healing Loop
  // --------------------------------------------------------------------------
  private async evaluateAndDebugLoop(initialCode: string): Promise<void> {
    let currentCode = initialCode;
    const maxDebugAttempts = 3;

    for (let attempt = 1; attempt <= maxDebugAttempts; attempt++) {
      if (this.isAborted) return;

      // Broadcast running state
      this.io.to(this.roomId).emit('arena:opponent_progress', {
        socketId: this.ghostSocketId,
        username: this.ghostUsername,
        progress: 0,
        totalCases: this.problem.testCases?.length || 3,
        status: 'running',
      });

      // Execute in real Docker sandbox
      const testCases = (this.problem.testCases || []).map((tc: any, idx: number) => ({
        id: tc.id || `tc-${idx}`,
        input: tc.input,
        expected_output: tc.expected_output,
      }));

      const runId = `ghost_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const job = await runQueue.add('execute-run', {
        runId,
        code: currentCode,
        language: 'python',
        testCases,
      });

      // Await Docker result
      let runResult: any = null;
      try {
        await Promise.race([
          job.finished(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000)),
        ]);

        const cached = await redisClient.get(`run:${runId}`);
        if (cached) {
          runResult = JSON.parse(cached);
        }
      } catch (err) {
        logger.warn(`Ghost Docker execution timeout or error on attempt ${attempt}:`, err);
      }

      if (this.isAborted) return;

      const results = runResult?.results || [];
      const passedCount = results.filter((r: any) => r.status === 'Accepted').length;
      const totalCount = testCases.length || 3;

      // Broadcast real progress bar percentage
      this.io.to(this.roomId).emit('arena:opponent_progress', {
        socketId: this.ghostSocketId,
        username: this.ghostUsername,
        progress: passedCount,
        totalCases: totalCount,
        status: passedCount === totalCount ? 'accepted' : 'coding',
      });

      // Check if 100% Passed
      if (passedCount === totalCount && totalCount > 0) {
        logger.info(`Ghost AI won room ${this.roomId} on attempt ${attempt}!`);
        await this.handleGhostVictory();
        return;
      }

      // Self-Healing Phase: Debug failing test case
      if (attempt < maxDebugAttempts && !this.isAborted) {
        const failingCase = results.find((r: any) => r.status !== 'Accepted') || results[0];
        const errorFeedback = failingCase
          ? `Input: ${failingCase.input}\nExpected: ${failingCase.expected_output}\nGot: ${failingCase.output}\nError: ${failingCase.error_message || 'Wrong Answer'}`
          : 'Output did not match expected result';

        this.io.to(this.roomId).emit('arena:ghost_debug_notice', {
          roomId: this.roomId,
          message: `${this.ghostUsername} encountered a failing test case. Debugging...`,
          attempt,
        });

        // 3-4s thinking & reading error pause
        await this.wait(3500);
        if (this.isAborted) return;

        // Re-query LLM with error feedback
        const fixedCode = await this.queryNeuralSolution(errorFeedback);
        if (fixedCode && !this.isAborted) {
          currentCode = fixedCode;
          // Re-stream fixed code
          await this.streamKeystrokes(currentCode);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Victory Resolution
  // --------------------------------------------------------------------------
  private async handleGhostVictory(): Promise<void> {
    if (this.isAborted) return;

    // Fetch duel details from DB to penalize human rating
    try {
      const roomResult = await pool.query(
        `SELECT player1_id, player2_id FROM duels WHERE room_id = $1`,
        [this.roomId]
      );

      const humanUserId = roomResult.rows[0]?.player1_id;
      if (humanUserId && !humanUserId.startsWith('bot_')) {
        await pool.query(
          `UPDATE users 
           SET rating = GREATEST(100, rating - 18), duels_lost = duels_lost + 1 
           WHERE id = $1`,
          [humanUserId]
        );
      }

      await pool.query(
        `UPDATE duels 
         SET status = 'finished', winner_id = 'bot_ghost', finished_at = NOW() 
         WHERE room_id = $1`,
        [this.roomId]
      );
    } catch (err) {
      logger.warn('Failed to update DB for ghost victory:', err);
    }

    this.io.to(this.roomId).emit('arena:match_ended', {
      winner: this.ghostUsername,
      winnerId: 'bot_ghost',
      ratingDelta: -18,
      reason: `${this.ghostUsername} passed all test cases!`,
    });
  }

  // --------------------------------------------------------------------------
  // Deterministic Algorithmic Fallback (if no API keys or local Ollama available)
  // --------------------------------------------------------------------------
  private generateAlgorithmicFallback(): string {
    const title = (this.problem.title || '').toLowerCase();
    const slug = (this.problem.slug || '').toLowerCase();

    if (slug.includes('two-sum') || title.includes('two sum')) {
      return `class Solution:
    def solution(self, nums, target):
        seen = {}
        for i, num in enumerate(nums):
            diff = target - num
            if diff in seen:
                return [seen[diff], i]
            seen[num] = i
        return []`;
    }

    if (slug.includes('palindrome') || title.includes('palindrome')) {
      return `class Solution:
    def solution(self, s: str) -> bool:
        filtered = [c.lower() for c in s if c.isalnum()]
        left, right = 0, len(filtered) - 1
        while left < right:
            if filtered[left] != filtered[right]:
                return False
            left += 1
            right -= 1
        return True`;
    }

    if (slug.includes('group-anagrams') || title.includes('anagram')) {
      return `from collections import defaultdict

class Solution:
    def solution(self, strs):
        anagram_map = defaultdict(list)
        for s in strs:
            sorted_s = "".join(sorted(s))
            anagram_map[sorted_s].append(s)
        result = [sorted(group) for group in anagram_map.values()]
        return sorted(result)`;
    }

    if (slug.includes('reverse') || title.includes('reverse')) {
      return `class Solution:
    def solution(self, s):
        if isinstance(s, list):
            left, right = 0, len(s) - 1
            while left < right:
                s[left], s[right] = s[right], s[left]
                left += 1
                right -= 1
            return s
        return s[::-1]`;
    }

    // Generic optimal heuristic fallback
    return `class Solution:
    def solution(self, *args, **kwargs):
        # Extract inputs from args or kwargs
        if args:
            val = args[0]
            if isinstance(val, list):
                return sorted(val)
            return val
        return None`;
  }
}

// Active Ghost sessions mapped by roomId
export const activeGhostSessions = new Map<string, GhostDuelistSession>();
