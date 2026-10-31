import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { pool } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { submissionQueue, runQueue } from '../services/submission.service';
import { redisClient } from '../cache/redis';

const submitCodeSchema = z.object({
  problemId: z.string().uuid(),
  code: z.string(),
  language: z.enum(['javascript', 'python', 'java', 'cpp']),
});

const runCodeSchema = z.object({
  problemId: z.string().uuid(),
  code: z.string(),
  language: z.enum(['javascript', 'python', 'java', 'cpp']),
  customTestCases: z.array(z.object({
    input: z.string(),
    expected_output: z.string().optional(),
  })).optional(),
});

// Run Code against sample / custom test cases (does not record official user stats)
export const runCode = async (req: Request, res: Response) => {
  const { problemId, code, language, customTestCases } = runCodeSchema.parse(req.body);

  let testCasesToRun: Array<{ id?: string; input: string; expected_output: string }> = [];

  if (customTestCases && customTestCases.length > 0) {
    testCasesToRun = customTestCases.map((tc, idx) => ({
      id: `custom-${idx}`,
      input: tc.input,
      expected_output: tc.expected_output || '',
    }));
  } else {
    // Fetch non-hidden sample test cases from database
    const tcResult = await pool.query(
      `SELECT id, input, expected_output FROM test_cases
       WHERE problem_id = $1 AND is_hidden = false
       ORDER BY order_index LIMIT 5`,
      [problemId]
    );

    if (tcResult.rows.length === 0) {
      throw new AppError(404, 'No sample test cases available for this problem');
    }

    testCasesToRun = tcResult.rows;
  }

  const runId = crypto.randomUUID();

  // Enqueue run job
  await runQueue.add('execute-run', {
    runId,
    code,
    language,
    testCases: testCasesToRun,
  });

  res.status(202).json({
    status: 'success',
    data: {
      runId,
      message: 'Code run queued',
    },
  });
};

// Poll results of a Run Code execution
export const getRunResult = async (req: Request, res: Response) => {
  const { runId } = req.params;

  const cached = await redisClient.get(`run:${runId}`);
  if (!cached) {
    return res.json({
      status: 'pending',
      data: null,
    });
  }

  const parsed = JSON.parse(cached);
  res.json({
    status: 'success',
    data: parsed,
  });
};

export const submitCode = async (req: AuthRequest, res: Response) => {
  const { problemId, code, language } = submitCodeSchema.parse(req.body);

  // Verify problem exists
  const problemResult = await pool.query(
    'SELECT id FROM problems WHERE id = $1',
    [problemId]
  );

  if (problemResult.rows.length === 0) {
    throw new AppError(404, 'Problem not found');
  }

  // Get test cases count
  const testCasesResult = await pool.query(
    'SELECT COUNT(*) FROM test_cases WHERE problem_id = $1',
    [problemId]
  );

  const testCasesTotal = parseInt(testCasesResult.rows[0].count);

  // Create submission record
  const submissionResult = await pool.query(
    `INSERT INTO submissions (user_id, problem_id, code, language, status, test_cases_total)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [req.user!.id, problemId, code, language, 'Pending', testCasesTotal]
  );

  const submission = submissionResult.rows[0];

  // Add to job queue
  await submissionQueue.add('execute-submission', {
    submissionId: submission.id,
    problemId,
    code,
    language,
    userId: req.user!.id,
  });

  res.status(201).json({
    status: 'success',
    data: {
      submission,
    },
  });
};

export const getSubmissionById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT s.*, p.title as problem_title, p.slug as problem_slug
     FROM submissions s
     JOIN problems p ON s.problem_id = p.id
     WHERE s.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Submission not found');
  }

  const submission = result.rows[0];

  // Get submission results
  const resultsQuery = await pool.query(
    `SELECT sr.*, tc.input, tc.expected_output
     FROM submission_results sr
     JOIN test_cases tc ON sr.test_case_id = tc.id
     WHERE sr.submission_id = $1
     ORDER BY tc.order_index`,
    [id]
  );

  res.json({
    status: 'success',
    data: {
      submission: {
        ...submission,
        results: resultsQuery.rows,
      },
    },
  });
};

export const getUserSubmissions = async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  // Check authorization
  if (req.user!.id !== userId && req.user!.role !== 'admin') {
    throw new AppError(403, 'Not authorized to view these submissions');
  }

  const offset = (Number(page) - 1) * Number(limit);

  const result = await pool.query(
    `SELECT s.*, p.title as problem_title, p.slug as problem_slug, p.difficulty
     FROM submissions s
     JOIN problems p ON s.problem_id = p.id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, Number(limit), offset]
  );

  const countResult = await pool.query(
    'SELECT COUNT(*) FROM submissions WHERE user_id = $1',
    [userId]
  );

  const total = parseInt(countResult.rows[0].count);

  res.json({
    status: 'success',
    data: {
      submissions: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

export const getProblemSubmissions = async (req: AuthRequest, res: Response) => {
  const { problemId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const offset = (Number(page) - 1) * Number(limit);

  const result = await pool.query(
    `SELECT s.id, s.status, s.runtime, s.memory, s.language, s.created_at, u.username
     FROM submissions s
     JOIN users u ON s.user_id = u.id
     WHERE s.problem_id = $1 AND s.user_id = $2
     ORDER BY s.created_at DESC
     LIMIT $3 OFFSET $4`,
    [problemId, req.user!.id, Number(limit), offset]
  );

  res.json({
    status: 'success',
    data: {
      submissions: result.rows,
    },
  });
};

const visualizeSchema = z.object({
  code: z.string(),
  language: z.string().default('python'),
  input: z.string().default(''),
});

export const visualizeExecution = async (req: Request, res: Response) => {
  const { code, language, input } = visualizeSchema.parse(req.body);
  const traceId = crypto.randomUUID();

  try {
    const job = await runQueue.add('execute-visualize', {
      traceId,
      code,
      language,
      input,
    });

    const result = await Promise.race([
      job.finished(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for visualizer')), 10000)
      ),
    ]);

    res.json({
      status: 'success',
      data: {
        traceId,
        ...(result as any),
      },
    });
  } catch (err: any) {
    const cached = await redisClient.get(`trace:${traceId}`);
    if (cached) {
      return res.json({
        status: 'success',
        data: {
          traceId,
          ...JSON.parse(cached),
        },
      });
    }

    res.status(202).json({
      status: 'pending',
      data: {
        traceId,
        message: 'Visualizer job queued',
      },
    });
  }
};

export const getVisualizeResult = async (req: Request, res: Response) => {
  const { traceId } = req.params;
  const cached = await redisClient.get(`trace:${traceId}`);
  if (!cached) {
    return res.json({
      status: 'pending',
      data: null,
    });
  }

  res.json({
    status: 'success',
    data: {
      traceId,
      ...JSON.parse(cached),
    },
  });
};
