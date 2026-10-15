import Queue from 'bull';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { executeCode } from './executors';
import { logger } from './logger';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leetcode_user:leetcode_password@localhost:5432/leetcode_db';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// PostgreSQL connection
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Redis connection
const redis = createClient({ url: REDIS_URL });

// Bull queue
const submissionQueue = new Queue('submission-queue', REDIS_URL);

async function init() {
  try {
    await redis.connect();
    logger.info('Redis connected');

    // Process submission jobs
    submissionQueue.process('execute-submission', async (job) => {
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
        let passedCount = 0;
        let totalRuntime = 0;
        let totalMemory = 0;
        let status = 'Accepted';
        let errorMessage = null;

        // Execute code against each test case
        for (const testCase of testCases) {
          const result = await executeCode(code, language, testCase.input);

          // Store result
          await pool.query(
            `INSERT INTO submission_results (submission_id, test_case_id, status, runtime, memory, output, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              submissionId,
              testCase.id,
              result.status,
              result.runtime,
              result.memory,
              result.output,
              result.error,
            ]
          );

          if (result.status === 'Accepted') {
            // Check if output matches expected
            if (result.output.trim() === testCase.expected_output.trim()) {
              passedCount++;
              totalRuntime += result.runtime;
              totalMemory += result.memory;
            } else {
              status = 'Wrong Answer';
              errorMessage = `Expected: ${testCase.expected_output}, Got: ${result.output}`;
              break;
            }
          } else {
            status = result.status;
            errorMessage = result.error;
            break;
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
               best_runtime = LEAST(user_problem_stats.best_runtime, $3),
               best_memory = LEAST(user_problem_stats.best_memory, $4),
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
        
        // Update submission with error status
        await pool.query(
          'UPDATE submissions SET status = $1, error_message = $2 WHERE id = $3',
          ['Runtime Error', String(error), submissionId]
        );
      }
    });

    logger.info('Execution engine started and listening for jobs');
  } catch (error) {
    logger.error('Failed to initialize execution engine:', error);
    process.exit(1);
  }
}

init();
