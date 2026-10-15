import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const createProblemSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  constraints: z.string().optional(),
  examples: z.array(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  testCases: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    isHidden: z.boolean().default(false),
  })),
});

export const getProblems = async (req: Request, res: Response) => {
  const { difficulty, tags, page = 1, limit = 20 } = req.query;
  
  let query = 'SELECT id, title, slug, difficulty, tags, acceptance_rate, total_submissions FROM problems WHERE 1=1';
  const params: any[] = [];
  let paramCount = 0;

  if (difficulty) {
    paramCount++;
    query += ` AND difficulty = $${paramCount}`;
    params.push(difficulty);
  }

  if (tags) {
    paramCount++;
    query += ` AND tags && $${paramCount}`;
    params.push(Array.isArray(tags) ? tags : [tags]);
  }

  query += ' ORDER BY created_at DESC';

  // Pagination
  const offset = (Number(page) - 1) * Number(limit);
  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(Number(limit));
  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(offset);

  const result = await pool.query(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM problems WHERE 1=1';
  const countParams: any[] = [];
  let countParamCount = 0;

  if (difficulty) {
    countParamCount++;
    countQuery += ` AND difficulty = $${countParamCount}`;
    countParams.push(difficulty);
  }

  if (tags) {
    countParamCount++;
    countQuery += ` AND tags && $${countParamCount}`;
    countParams.push(Array.isArray(tags) ? tags : [tags]);
  }

  const countResult = await pool.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count);

  res.json({
    status: 'success',
    data: {
      problems: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

export const getProblemBySlug = async (req: Request, res: Response) => {
  const { slug } = req.params;

  const result = await pool.query(
    'SELECT * FROM problems WHERE slug = $1',
    [slug]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Problem not found');
  }

  const problem = result.rows[0];

  // Get non-hidden test cases
  const testCasesResult = await pool.query(
    'SELECT id, input, expected_output, is_hidden FROM test_cases WHERE problem_id = $1 AND is_hidden = false ORDER BY order_index',
    [problem.id]
  );

  res.json({
    status: 'success',
    data: {
      problem: {
        ...problem,
        testCases: testCasesResult.rows,
      },
    },
  });
};

export const createProblem = async (req: AuthRequest, res: Response) => {
  const data = createProblemSchema.parse(req.body);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert problem
    const problemResult = await client.query(
      `INSERT INTO problems (title, slug, description, difficulty, constraints, examples, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.title,
        data.slug,
        data.description,
        data.difficulty,
        data.constraints,
        JSON.stringify(data.examples || []),
        data.tags || [],
        req.user!.id,
      ]
    );

    const problem = problemResult.rows[0];

    // Insert test cases
    for (let i = 0; i < data.testCases.length; i++) {
      const testCase = data.testCases[i];
      await client.query(
        'INSERT INTO test_cases (problem_id, input, expected_output, is_hidden, order_index) VALUES ($1, $2, $3, $4, $5)',
        [problem.id, testCase.input, testCase.expectedOutput, testCase.isHidden, i]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      status: 'success',
      data: {
        problem,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateProblem = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = createProblemSchema.partial().parse(req.body);

  const result = await pool.query(
    `UPDATE problems 
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         difficulty = COALESCE($3, difficulty),
         constraints = COALESCE($4, constraints),
         examples = COALESCE($5, examples),
         tags = COALESCE($6, tags)
     WHERE id = $7
     RETURNING *`,
    [
      data.title,
      data.description,
      data.difficulty,
      data.constraints,
      data.examples ? JSON.stringify(data.examples) : null,
      data.tags,
      id,
    ]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Problem not found');
  }

  res.json({
    status: 'success',
    data: {
      problem: result.rows[0],
    },
  });
};

export const deleteProblem = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const result = await pool.query(
    'DELETE FROM problems WHERE id = $1 RETURNING *',
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Problem not found');
  }

  res.json({
    status: 'success',
    message: 'Problem deleted successfully',
  });
};
