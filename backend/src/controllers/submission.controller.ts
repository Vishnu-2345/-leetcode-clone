import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { submissionQueue } from '../services/submission.service';

const submitCodeSchema = z.object({
  problemId: z.string().uuid(),
  code: z.string(),
  language: z.enum(['javascript', 'python', 'java', 'cpp']),
});

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
