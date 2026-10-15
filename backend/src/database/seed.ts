import { pool } from '../database/connection';
import bcrypt from 'bcrypt';

const sampleProblems = [
  {
    title: 'Two Sum',
    slug: 'two-sum',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
    difficulty: 'Easy',
    constraints: `• 2 <= nums.length <= 10^4
• -10^9 <= nums[i] <= 10^9
• -10^9 <= target <= 10^9
• Only one valid answer exists.`,
    examples: [
      {
        input: '[2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
      },
      {
        input: '[3,2,4], target = 6',
        output: '[1,2]',
      },
    ],
    tags: ['Array', 'Hash Table'],
    testCases: [
      { input: '2,7,11,15\n9', expectedOutput: '0,1', isHidden: false },
      { input: '3,2,4\n6', expectedOutput: '1,2', isHidden: false },
      { input: '3,3\n6', expectedOutput: '0,1', isHidden: false },
      { input: '1,5,3,7,8,9\n12', expectedOutput: '2,4', isHidden: true },
    ],
  },
  {
    title: 'Valid Parentheses',
    slug: 'valid-parentheses',
    description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    difficulty: 'Easy',
    constraints: `• 1 <= s.length <= 10^4
• s consists of parentheses only '()[]{}'.`,
    examples: [
      { input: '()', output: 'true' },
      { input: '()[]{}', output: 'true' },
      { input: '(]', output: 'false' },
    ],
    tags: ['String', 'Stack'],
    testCases: [
      { input: '()', expectedOutput: 'true', isHidden: false },
      { input: '()[]{}', expectedOutput: 'true', isHidden: false },
      { input: '(]', expectedOutput: 'false', isHidden: false },
      { input: '([)]', expectedOutput: 'false', isHidden: true },
      { input: '{[]}', expectedOutput: 'true', isHidden: true },
    ],
  },
  {
    title: 'Reverse Linked List',
    slug: 'reverse-linked-list',
    description: `Given the head of a singly linked list, reverse the list, and return the reversed list.`,
    difficulty: 'Easy',
    constraints: `• The number of nodes in the list is the range [0, 5000].
• -5000 <= Node.val <= 5000`,
    examples: [
      { input: '[1,2,3,4,5]', output: '[5,4,3,2,1]' },
      { input: '[1,2]', output: '[2,1]' },
      { input: '[]', output: '[]' },
    ],
    tags: ['Linked List', 'Recursion'],
    testCases: [
      { input: '1,2,3,4,5', expectedOutput: '5,4,3,2,1', isHidden: false },
      { input: '1,2', expectedOutput: '2,1', isHidden: false },
      { input: '', expectedOutput: '', isHidden: false },
    ],
  },
  {
    title: 'Longest Substring Without Repeating Characters',
    slug: 'longest-substring-without-repeating-characters',
    description: `Given a string s, find the length of the longest substring without repeating characters.`,
    difficulty: 'Medium',
    constraints: `• 0 <= s.length <= 5 * 10^4
• s consists of English letters, digits, symbols and spaces.`,
    examples: [
      { input: 'abcabcbb', output: '3', explanation: 'The answer is "abc", with the length of 3.' },
      { input: 'bbbbb', output: '1', explanation: 'The answer is "b", with the length of 1.' },
      { input: 'pwwkew', output: '3', explanation: 'The answer is "wke", with the length of 3.' },
    ],
    tags: ['Hash Table', 'String', 'Sliding Window'],
    testCases: [
      { input: 'abcabcbb', expectedOutput: '3', isHidden: false },
      { input: 'bbbbb', expectedOutput: '1', isHidden: false },
      { input: 'pwwkew', expectedOutput: '3', isHidden: false },
      { input: 'dvdf', expectedOutput: '3', isHidden: true },
    ],
  },
  {
    title: 'Median of Two Sorted Arrays',
    slug: 'median-of-two-sorted-arrays',
    description: `Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.

The overall run time complexity should be O(log (m+n)).`,
    difficulty: 'Hard',
    constraints: `• nums1.length == m
• nums2.length == n
• 0 <= m <= 1000
• 0 <= n <= 1000
• 1 <= m + n <= 2000
• -10^6 <= nums1[i], nums2[i] <= 10^6`,
    examples: [
      { input: 'nums1 = [1,3], nums2 = [2]', output: '2.00000', explanation: 'merged array = [1,2,3] and median is 2.' },
      { input: 'nums1 = [1,2], nums2 = [3,4]', output: '2.50000', explanation: 'merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5.' },
    ],
    tags: ['Array', 'Binary Search', 'Divide and Conquer'],
    testCases: [
      { input: '1,3\n2', expectedOutput: '2.0', isHidden: false },
      { input: '1,2\n3,4', expectedOutput: '2.5', isHidden: false },
    ],
  },
];

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Starting database seed...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      ['admin', 'admin@codearena.com', adminPassword, 'admin']
    );

    const adminId = adminResult.rows[0]?.id;
    console.log('Admin user created');

    // Create test user
    const testPassword = await bcrypt.hash('test123', 10);
    await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['testuser', 'test@example.com', testPassword, 'user']
    );
    console.log('Test user created');

    // Insert sample problems
    for (const problem of sampleProblems) {
      const problemResult = await client.query(
        `INSERT INTO problems (title, slug, description, difficulty, constraints, examples, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [
          problem.title,
          problem.slug,
          problem.description,
          problem.difficulty,
          problem.constraints,
          JSON.stringify(problem.examples),
          problem.tags,
          adminId,
        ]
      );

      const problemId = problemResult.rows[0]?.id;

      if (problemId) {
        // Insert test cases
        for (let i = 0; i < problem.testCases.length; i++) {
          const testCase = problem.testCases[i];
          await client.query(
            'INSERT INTO test_cases (problem_id, input, expected_output, is_hidden, order_index) VALUES ($1, $2, $3, $4, $5)',
            [problemId, testCase.input, testCase.expectedOutput, testCase.isHidden, i]
          );
        }
        console.log(`Created problem: ${problem.title}`);
      }
    }

    console.log('Database seed completed successfully!');
    console.log('\nLogin credentials:');
    console.log('Admin - Email: admin@codearena.com, Password: admin123');
    console.log('User  - Email: test@example.com, Password: test123');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
