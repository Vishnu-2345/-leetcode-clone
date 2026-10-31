import Queue from 'bull';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { executeCode, executeBatch } from './executors';
import { executeVisualizer } from './executors/visualizer';
import { logger } from './logger';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leetcode_user:leetcode_password@localhost:5432/leetcode_db';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// PostgreSQL connection
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Redis connection
const redis = createClient({ url: REDIS_URL });

// Bull queues
const submissionQueue = new Queue('submission-queue', REDIS_URL);
const runQueue = new Queue('run-queue', REDIS_URL);

function normalizeOutput(str: string): string {
  if (!str) return '';
  return str.replace(/\r\n/g, '\n').trim();
}

function parseFlexible(str: string): any {
  const norm = normalizeOutput(str);
  if (!norm) return null;

  // 1. Direct JSON parse
  try {
    return JSON.parse(norm);
  } catch (_) {}

  // 2. Python-style representation: single quotes -> double quotes, True/False/None -> true/false/null
  try {
    const jsonReady = norm
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null');
    return JSON.parse(jsonReady);
  } catch (_) {}

  return null;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;

  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-5;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    // Check direct order
    let directMatch = true;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        directMatch = false;
        break;
      }
    }
    if (directMatch) return true;

    // Check order-independent matching for sets of groups (e.g. Group Anagrams)
    if (a.every(Array.isArray) && b.every(Array.isArray)) {
      const serializeGroup = (grp: any[]) => JSON.stringify([...grp].sort());
      const sortedA = a.map(serializeGroup).sort();
      const sortedB = b.map(serializeGroup).sort();
      return JSON.stringify(sortedA) === JSON.stringify(sortedB);
    }

    return false;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (JSON.stringify(keysA) !== JSON.stringify(keysB)) return false;
    return keysA.every((k) => deepEqual(a[k], b[k]));
  }

  // String fallback
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function outputsMatch(actual: string, expected: string): boolean {
  const normActual = normalizeOutput(actual);
  const normExpected = normalizeOutput(expected);

  if (normActual === normExpected) return true;

  // Parse structured data
  const valActual = parseFlexible(normActual);
  const valExpected = parseFlexible(normExpected);

  if (valActual !== null && valExpected !== null) {
    if (deepEqual(valActual, valExpected)) {
      return true;
    }
  }

  // Normalize comma lists or booleans
  if (normActual.toLowerCase() === normExpected.toLowerCase()) {
    return true;
  }

  return false;
}

async function init() {
  try {
    await redis.connect();
    logger.info('Redis connected');

    // 1. Process "Run Code" jobs (runs against public/custom test cases only)
    runQueue.process('execute-run', async (job: any) => {
      const { runId, code, language, testCases } = job.data;
      logger.info(`Processing run job ${runId} with ${testCases?.length || 0} test cases`);

      const batchResults = await executeBatch(code, language, testCases || []);
      const resultMap = new Map(batchResults.map((r) => [r.id, r]));

      const results = [];
      let allPassed = true;

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const tcId = tc.id || `tc-${i}`;
        const res = resultMap.get(tcId) || {
          id: tcId,
          status: 'Runtime Error' as const,
          output: '',
          error: 'Execution did not produce output',
          runtime: 0,
          memory: 0,
        };

        const isMatch = outputsMatch(res.output, tc.expected_output);
        const status = res.status === 'Accepted'
          ? (isMatch ? 'Accepted' : 'Wrong Answer')
          : res.status;

        if (status !== 'Accepted') {
          allPassed = false;
        }

        results.push({
          id: tcId,
          input: tc.input,
          expected_output: tc.expected_output,
          output: res.output,
          status,
          runtime: res.runtime,
          memory: res.memory,
          error_message: res.error,
        });
      }

      // Store results in Redis for 10 minutes
      await redis.set(
        `run:${runId}`,
        JSON.stringify({
          status: allPassed ? 'Accepted' : 'Completed',
          results,
        }),
        { EX: 600 }
      );

      return { success: true };
    });

    // 1.5 Process "Visualize Trace" jobs
    runQueue.process('execute-visualize', async (job: any) => {
      const { traceId, code, language, input } = job.data;
      logger.info(`Processing visualizer job ${traceId} (${language})`);
      const traceResult = await executeVisualizer(code, language, input);

      if (traceId) {
        await redis.set(
          `trace:${traceId}`,
          JSON.stringify(traceResult),
          { EX: 600 }
        );
      }

      return traceResult;
    });

    // 2. Process official "Submission" jobs
    submissionQueue.process('execute-submission', async (job: any) => {
      const { submissionId, problemId, code, language, userId } = job.data;

      logger.info(`Processing submission ${submissionId} for problem ${problemId}`);

      try {
        // Update submission status to Running
        await pool.query(
          'UPDATE submissions SET status = $1 WHERE id = $2',
          ['Running', submissionId]
        );

        // Get test cases
        const testCasesResult = await pool.query(
          'SELECT * FROM test_cases WHERE problem_id = $1 ORDER BY order_index',
          [problemId]
        );

        const testCases = testCasesResult.rows;

        // Execute ALL test cases in a single fast batch session
        const batchResults = await executeBatch(code, language, testCases);
        const resultMap = new Map(batchResults.map((r) => [r.id, r]));

        let passedCount = 0;
        let totalRuntime = 0;
        let totalMemory = 0;
        let status = 'Accepted';
        let errorMessage = null;

        // Verify outputs sequentially up to the first failing test case
        for (let i = 0; i < testCases.length; i++) {
          const testCase = testCases[i];
          const result = resultMap.get(testCase.id) || {
            id: testCase.id,
            status: 'Runtime Error' as const,
            output: '',
            error: 'Execution did not complete',
            runtime: 0,
            memory: 0,
          };

          const isMatch = outputsMatch(result.output, testCase.expected_output);
          const caseStatus = result.status === 'Accepted'
            ? (isMatch ? 'Accepted' : 'Wrong Answer')
            : result.status;

          // Store individual result
          await pool.query(
            `INSERT INTO submission_results (submission_id, test_case_id, status, runtime, memory, output, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              submissionId,
              testCase.id,
              caseStatus,
              result.runtime,
              result.memory,
              result.output,
              result.error,
            ]
          );

          if (caseStatus === 'Accepted') {
            passedCount++;
            totalRuntime += result.runtime;
            totalMemory += result.memory;
          } else {
            status = caseStatus;
            errorMessage = result.error || (caseStatus === 'Wrong Answer'
              ? `Expected: ${testCase.expected_output}, Got: ${result.output}`
              : null);
            break; // Stop after first failing test case
          }
        }

        const avgRuntime = passedCount > 0 ? Math.floor(totalRuntime / passedCount) : 0;
        const avgMemory = passedCount > 0 ? Math.floor(totalMemory / passedCount) : 0;

        // Update submission with final status
        await pool.query(
          `UPDATE submissions 
           SET status = $1, runtime = $2, memory = $3, test_cases_passed = $4, error_message = $5
           WHERE id = $6`,
          [status, avgRuntime, avgMemory, passedCount, errorMessage, submissionId]
        );

        // Update user problem stats
        if (status === 'Accepted') {
          await pool.query(
            `INSERT INTO user_problem_stats (user_id, problem_id, is_solved, attempts, best_runtime, best_memory, first_solved_at)
             VALUES ($1, $2, true, 1, $3, $4, NOW())
             ON CONFLICT (user_id, problem_id)
             DO UPDATE SET 
               is_solved = true,
               attempts = user_problem_stats.attempts + 1,
               best_runtime = CASE WHEN user_problem_stats.best_runtime IS NULL OR user_problem_stats.best_runtime = 0 THEN $3 ELSE LEAST(user_problem_stats.best_runtime, $3) END,
               best_memory = CASE WHEN user_problem_stats.best_memory IS NULL OR user_problem_stats.best_memory = 0 THEN $4 ELSE LEAST(user_problem_stats.best_memory, $4) END,
               last_attempted_at = NOW()`,
            [userId, problemId, avgRuntime, avgMemory]
          );

          // Update problem stats
          await pool.query(
            `UPDATE problems 
             SET total_submissions = total_submissions + 1,
                 total_accepted = total_accepted + 1,
                 acceptance_rate = (total_accepted + 1)::float / (total_submissions + 1)::float * 100
             WHERE id = $1`,
            [problemId]
          );
        } else {
          await pool.query(
            `INSERT INTO user_problem_stats (user_id, problem_id, is_solved, attempts)
             VALUES ($1, $2, false, 1)
             ON CONFLICT (user_id, problem_id)
             DO UPDATE SET 
               attempts = user_problem_stats.attempts + 1,
               last_attempted_at = NOW()`,
            [userId, problemId]
          );

          await pool.query(
            `UPDATE problems 
             SET total_submissions = total_submissions + 1,
                 acceptance_rate = total_accepted::float / (total_submissions + 1)::float * 100
             WHERE id = $1`,
            [problemId]
          );
        }

        logger.info(`Submission ${submissionId} completed with status: ${status}`);
      } catch (error) {
        logger.error(`Error processing submission ${submissionId}:`, error);
        await pool.query(
          'UPDATE submissions SET status = $1, error_message = $2 WHERE id = $3',
          ['Runtime Error', String(error), submissionId]
        );
      }
    });

    logger.info('Execution engine started and listening for jobs on submission-queue and run-queue');
  } catch (error) {
    logger.error('Failed to initialize execution engine:', error);
    process.exit(1);
  }
}

init();
