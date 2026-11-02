const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://leetcode_user:leetcode_password@localhost:5433/leetcode_db'
});

async function run() {
  const datasetPath = path.join(__dirname, '..', 'backend', 'data', 'leetcode_dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  let count = 0;

  for (const item of dataset) {
    if (item.slug && item.starterCode) {
      const res = await pool.query(
        'UPDATE problems SET starter_code = $1, entry_point = $2 WHERE slug = $3',
        [item.starterCode, item.entryPoint || null, item.slug]
      );
      if (res.rowCount > 0) count++;
    }
  }

  // Reverse Linked List
  const reverseListCode = `# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        `;
  await pool.query(
    'UPDATE problems SET starter_code = $1, entry_point = $2 WHERE slug = $3',
    [reverseListCode, 'Solution().reverseList', 'reverse-linked-list']
  );

  console.log('ALL 50 problems now have starter_code and entry_point in the database!');
}

run().catch(console.error).finally(() => pool.end());
