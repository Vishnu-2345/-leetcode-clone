/**
 * Utility to generate exact LeetCode-style starter code for any problem and language.
 * Guarantees real problem-specific function names and exact parameter signatures (never *args, **kwargs).
 */

function slugToCamelCase(slug: string): string {
  if (!slug) return 'solution';
  return slug
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
}

export function extractMethodSignature(pythonStarter: string, slug: string = '', sampleInput: string = ''): {
  methodName: string;
  params: string[];
  paramTypes: Record<string, string>;
  returnType: string;
} {
  let methodName = slugToCamelCase(slug);
  let params: string[] = [];
  const paramTypes: Record<string, string> = {};
  let returnType = 'any';

  if (pythonStarter) {
    const match = pythonStarter.match(/def\s+([a-zA-Z_]\w*)\s*\((?:self,?\s*)?([^)]*)\)(?:\s*->\s*([^:]+))?:/);
    if (match) {
      methodName = match[1];
      const rawParams = match[2];
      returnType = match[3]?.trim() || 'any';

      if (rawParams.trim()) {
        const paramParts = rawParams.split(',');
        paramParts.forEach((p) => {
          const colonIdx = p.indexOf(':');
          if (colonIdx !== -1) {
            const name = p.slice(0, colonIdx).trim();
            const type = p.slice(colonIdx + 1).trim();
            if (name && name !== 'self') {
              params.push(name);
              paramTypes[name] = type;
            }
          } else {
            const name = p.trim();
            if (name && name !== 'self') {
              params.push(name);
              paramTypes[name] = 'any';
            }
          }
        });
      }
    }
  }

  // Fallback: Infer parameters from sample test case input if not found
  if (params.length === 0 && sampleInput) {
    const matches = Array.from(sampleInput.matchAll(/([a-zA-Z_]\w*)\s*=/g));
    if (matches.length > 0) {
      params = matches.map((m) => m[1]);
    } else {
      params = ['nums'];
    }
  }

  if (params.length === 0) {
    params = ['nums'];
  }

  return { methodName, params, paramTypes, returnType };
}

export function getStarterCode(problem: any, language: string = 'python'): string {
  if (!problem) return '';

  const rawPython = problem.starter_code || problem.starterCode || '';
  const slug = problem.slug || '';
  const sampleInput = problem.testCases?.[0]?.input || problem.examples?.[0]?.input || '';

  const { methodName, params } = extractMethodSignature(rawPython, slug, sampleInput);

  switch (language) {
    case 'python': {
      if (rawPython && rawPython.trim()) {
        let trimmed = rawPython.trimEnd();
        if (trimmed.endsWith(':')) {
          trimmed += '\n        # Write your solution here\n        pass';
        } else if (!trimmed.includes('pass') && !trimmed.includes('return') && !trimmed.includes('...') && !trimmed.includes('#')) {
          trimmed += '\n        pass';
        }
        return trimmed;
      }

      const paramStr = params.length > 0 ? `self, ${params.join(', ')}` : 'self';
      return `class Solution:
    def ${methodName}(${paramStr}):
        # Write your solution here
        pass`;
    }

    case 'javascript': {
      const jsDocParams = params.map((p) => `   * @param {any} ${p}`).join('\n');
      return `class Solution {
  /**
${jsDocParams}
   * @return {any}
   */
  ${methodName}(${params.join(', ')}) {
    // Write your solution here
  }
}`;
    }

    case 'java': {
      const javaParams = params.map((p) => `Object ${p}`).join(', ');
      return `class Solution {
    public Object ${methodName}(${javaParams}) {
        // Write your solution here
        return null;
    }
}`;
    }

    case 'cpp': {
      const cppParams = params.map((p) => `auto ${p}`).join(', ');
      return `#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
using namespace std;

class Solution {
public:
    void ${methodName}(${cppParams}) {
        // Write your solution here
    }
};`;
    }

    default:
      return '';
  }
}
