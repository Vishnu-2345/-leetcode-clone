import { pool } from '../database/connection';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

interface TestCaseItem {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  orderIndex: number;
}

interface ProblemItem {
  title: string;
  slug: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  constraints?: string;
  examples?: any[];
  tags?: string[];
  testCases: TestCaseItem[];
}

const DATASET_PATH = path.join(__dirname, '..', '..', 'data', 'leetcode_dataset.json');

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Starting LeetCode dataset database seed...');

    // 1. Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['admin', 'admin@codearena.com', adminPassword, 'admin']
    );

    const adminId = adminResult.rows[0]?.id;
    console.log('✓ Admin user verified');

    // 2. Create test user
    const testPassword = await bcrypt.hash('test123', 10);
    await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      ['testuser', 'test@example.com', testPassword, 'user']
    );
    console.log('✓ Test user verified');

    // 3. Load problems dataset
    let problems: ProblemItem[] = [];
    if (fs.existsSync(DATASET_PATH)) {
      const raw = fs.readFileSync(DATASET_PATH, 'utf-8');
      problems = JSON.parse(raw);
      console.log(`✓ Loaded ${problems.length} problems from dataset: ${DATASET_PATH}`);
    } else {
      console.warn(`! Dataset not found at ${DATASET_PATH}. Falling back to default problems.`);
    }

    let totalTestCasesInserted = 0;

    for (const problem of problems) {
      // Upsert problem
      const problemResult = await client.query(
        `INSERT INTO problems (title, slug, description, difficulty, constraints, examples, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           difficulty = EXCLUDED.difficulty,
           constraints = EXCLUDED.constraints,
           examples = EXCLUDED.examples,
           tags = EXCLUDED.tags
         RETURNING id`,
        [
          problem.title,
          problem.slug,
          problem.description,
          problem.difficulty,
          problem.constraints || null,
          JSON.stringify(problem.examples || []),
          problem.tags || [],
          adminId,
        ]
      );

      const problemId = problemResult.rows[0]?.id;

      if (problemId && problem.testCases && problem.testCases.length > 0) {
        // Clear old test cases for this problem to prevent stale duplicates
        await client.query('DELETE FROM test_cases WHERE problem_id = $1', [problemId]);

        // Bulk insert test cases
        for (let i = 0; i < problem.testCases.length; i++) {
          const tc = problem.testCases[i];
          await client.query(
            `INSERT INTO test_cases (problem_id, input, expected_output, is_hidden, order_index)
             VALUES ($1, $2, $3, $4, $5)`,
            [problemId, tc.input, tc.expectedOutput, tc.isHidden ?? (i >= 3), i]
          );
        }

        totalTestCasesInserted += problem.testCases.length;
        console.log(`  ✓ [${problem.difficulty}] ${problem.title} (${problem.testCases.length} test cases)`);
      }
    }

    console.log('\n=============================================');
    console.log(`🎉 Database seed completed successfully!`);
    console.log(`Total Problems:   ${problems.length}`);
    console.log(`Total Test Cases: ${totalTestCasesInserted}`);
    console.log('=============================================');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
