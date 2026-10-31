import Docker from 'dockerode';
import { PassThrough } from 'stream';
import { logger } from '../logger';

const docker = new Docker(
  process.platform === 'win32' && !process.env.DOCKER_HOST
    ? { socketPath: '//./pipe/docker_engine' }
    : undefined
);

const MAX_EXECUTION_TIME = parseInt(process.env.MAX_EXECUTION_TIME || '5000', 10);
const MAX_MEMORY_MB = parseInt(process.env.MAX_MEMORY_MB || '256', 10);

export interface ExecutionResult {
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compile Error';
  output: string;
  error: string | null;
  runtime: number;
  memory: number;
}

export interface BatchTestCase {
  id: string;
  input: string;
  expected_output?: string;
}

export interface BatchTestCaseResult {
  id: string;
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compile Error';
  output: string;
  error: string | null;
  runtime: number;
  memory: number;
}

interface LanguageConfig {
  image: string;
  fileName: string;
  compileCmd?: string;
  runCmd: string;
  wrapCode: (userCode: string) => string;
}

const languageConfigs: Record<string, LanguageConfig> = {
  javascript: {
    image: 'node:18-alpine',
    fileName: 'solution.js',
    runCmd: 'node /code/solution.js < /code/input.txt',
    wrapCode: (userCode: string) => `
const fs = require('fs');

${userCode}

(function run() {
  try {
    let rawInput = '';
    try {
      rawInput = fs.readFileSync(0, 'utf-8').trim();
    } catch (_) {}

    // Check if user defined a class Solution or function solution
    let runner = null;
    if (typeof Solution === 'function') {
      const inst = new Solution();
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(inst)).filter(m => m !== 'constructor');
      if (methods.length > 0 && typeof inst[methods[0]] === 'function') {
        runner = inst[methods[0]].bind(inst);
      }
    } else if (typeof solution === 'function') {
      runner = solution;
    }

    if (!runner) {
      return;
    }

    // Try parsing inputs either as assignments like: nums = [2,7], target = 9
    // or as raw JSON / values
    let args = [];
    if (rawInput) {
      if (rawInput.includes('=')) {
        const parts = rawInput.split(/,\\s*(?=[a-zA-Z_]\\w*\\s*=)/);
        for (const p of parts) {
          const eqIdx = p.indexOf('=');
          if (eqIdx !== -1) {
            const valStr = p.slice(eqIdx + 1).trim();
            try {
              args.push(JSON.parse(valStr));
            } catch (_) {
              args.push(valStr);
            }
          }
        }
      } else {
        try {
          const parsed = JSON.parse(rawInput);
          args = Array.isArray(parsed) ? [parsed] : [parsed];
        } catch (_) {
          args = [rawInput];
        }
      }
    }

    const result = runner(...args);
    if (result !== undefined) {
      if (Array.isArray(result) || (typeof result === 'object' && result !== null)) {
        console.log(JSON.stringify(result));
      } else if (typeof result === 'boolean') {
        console.log(result ? 'True' : 'False');
      } else {
        console.log(String(result));
      }
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
})();
`,
  },
  python: {
    image: 'python:3.11-alpine',
    fileName: 'solution.py',
    runCmd: 'python /code/solution.py < /code/input.txt',
    wrapCode: (userCode: string) => `
import sys
import re
import json
from typing import *

${userCode}

if __name__ == '__main__':
    try:
        raw_input = sys.stdin.read().strip()
        
        # 1. Resolve target method from Solution class or standalone solution function
        method = None
        if 'Solution' in globals() and isinstance(globals()['Solution'], type):
            sol = globals()['Solution']()
            methods = [m for m in dir(sol) if not m.startswith('_')]
            if methods:
                method = getattr(sol, methods[0])
        elif 'solution' in globals() and callable(globals()['solution']):
            method = globals()['solution']

        if not method:
            sys.exit(0)

        # 2. Parse input arguments
        args_dict = {}
        args_list = []
        if raw_input:
            if '=' in raw_input:
                parts = re.split(r',\\s*(?=[a-zA-Z_]\\w*\\s*=)', raw_input)
                exec_scope = {}
                try:
                    exec('\\n'.join(parts), {}, exec_scope)
                    args_dict = exec_scope
                except Exception:
                    args_list = [raw_input]
            else:
                try:
                    args_list = [json.loads(raw_input)]
                except Exception:
                    args_list = [raw_input]

        # 3. Call method
        if args_dict:
            res = method(**args_dict)
        elif args_list:
            res = method(*args_list)
        else:
            res = method()

        # 4. Format output to match LeetCode standard
        if res is not None:
            if isinstance(res, bool):
                print('True' if res else 'False')
            elif isinstance(res, (list, dict, tuple)):
                print(json.dumps(res))
            elif isinstance(res, float):
                if abs(res - round(res, 5)) < 1e-7 and not res.is_integer():
                    print(f"{res:.5f}")
                else:
                    print(f"{res:g}")
            else:
                print(str(res))
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
`,
  },
  java: {
    image: 'openjdk:17-alpine',
    fileName: 'Solution.java',
    compileCmd: 'javac /code/Solution.java',
    runCmd: 'java -cp /code Solution < /code/input.txt',
    wrapCode: (userCode: string) => {
      if (userCode.includes('public static void main')) {
        return userCode;
      }
      return `
import java.util.*;

${userCode}

class SolutionRunner {
    public static void main(String[] args) {
        try {
            Scanner sc = new Scanner(System.in);
            StringBuilder sb = new StringBuilder();
            while (sc.hasNextLine()) {
                if (sb.length() > 0) sb.append("\\n");
                sb.append(sc.nextLine());
            }
            Solution sol = new Solution();
            Object res = sol.solution(sb.toString().trim());
            if (res != null) {
                if (res instanceof Object[]) {
                    Object[] arr = (Object[]) res;
                    for (int i = 0; i < arr.length; i++) {
                        System.out.print(arr[i] + (i < arr.length - 1 ? "," : ""));
                    }
                    System.out.println();
                } else if (res instanceof int[]) {
                    int[] arr = (int[]) res;
                    for (int i = 0; i < arr.length; i++) {
                        System.out.print(arr[i] + (i < arr.length - 1 ? "," : ""));
                    }
                    System.out.println();
                } else {
                    System.out.println(res);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }
}
`;
    },
  },
  cpp: {
    image: 'gcc:latest',
    fileName: 'solution.cpp',
    compileCmd: 'g++ -O2 -o /code/solution /code/solution.cpp',
    runCmd: '/code/solution < /code/input.txt',
    wrapCode: (userCode: string) => {
      if (userCode.includes('int main(')) {
        return userCode;
      }
      return `
#include <iostream>
#include <string>
#include <vector>
#include <sstream>

${userCode}

int main() {
    try {
        std::string input, line;
        while (std::getline(std::cin, line)) {
            if (!input.empty()) input += "\\n";
            input += line;
        }
        std::cout << solution(input);
        return 0;
    } catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        return 1;
    } catch (...) {
        std::cerr << "Unknown error occurred" << std::endl;
        return 1;
    }
}
`;
    },
  },
};

const verifiedImages = new Set<string>();

async function ensureImage(image: string): Promise<void> {
  if (verifiedImages.has(image)) return;
  try {
    const images = await docker.listImages();
    const exists = images.some((img: any) =>
      img.RepoTags?.some((tag: any) => tag === image || tag === `${image}:latest`)
    );
    if (!exists) {
      logger.info(`Docker image ${image} not found locally. Pulling...`);
      const pullStream = await docker.pull(image);
      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(pullStream, (err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
      logger.info(`Successfully pulled image ${image}`);
    }
    verifiedImages.add(image);
  } catch (err) {
    logger.warn(`Could not verify or pull image ${image}:`, err);
  }
}

async function runExec(
  container: Docker.Container,
  cmd: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const exec = await container.exec({
    Cmd: ['sh', '-c', cmd],
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();

  let stdout = '';
  let stderr = '';

  stdoutStream.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  stderrStream.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  docker.modem.demuxStream(stream, stdoutStream, stderrStream);

  await new Promise<void>((resolve) => {
    stream.on('end', () => resolve());
  });

  const inspect = await exec.inspect();
  return {
    exitCode: inspect.ExitCode ?? 0,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

export async function executeCode(
  code: string,
  language: string,
  input: string
): Promise<ExecutionResult> {
  const config = languageConfigs[language];
  if (!config) {
    return {
      status: 'Compile Error',
      output: '',
      error: `Unsupported language: ${language}`,
      runtime: 0,
      memory: 0,
    };
  }

  const startTime = Date.now();
  let container: Docker.Container | null = null;

  try {
    await ensureImage(config.image);

    // Create container sleeping in background
    container = await docker.createContainer({
      Image: config.image,
      Cmd: ['sh', '-c', 'sleep 60'],
      WorkingDir: '/code',
      HostConfig: {
        Memory: MAX_MEMORY_MB * 1024 * 1024,
        MemorySwap: MAX_MEMORY_MB * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000, // 50% CPU
        NetworkMode: 'none', // isolated
      },
      Tty: false,
    });

    await container.start();

    // Prepare code and input with base64 to avoid any quoting or escape issues
    const fullCode = config.wrapCode(code);
    const codeBase64 = Buffer.from(fullCode, 'utf-8').toString('base64');
    const inputBase64 = Buffer.from(input, 'utf-8').toString('base64');

    // Write source file
    await runExec(
      container,
      `mkdir -p /code && echo "${codeBase64}" | base64 -d > /code/${config.fileName}`
    );

    // Write input file
    await runExec(
      container,
      `echo "${inputBase64}" | base64 -d > /code/input.txt`
    );

    // Compilation step if needed
    if (config.compileCmd) {
      const compileRes = await runExec(container, config.compileCmd);
      if (compileRes.exitCode !== 0) {
        return {
          status: 'Compile Error',
          output: '',
          error: compileRes.stderr || compileRes.stdout || 'Compilation failed',
          runtime: Date.now() - startTime,
          memory: 0,
        };
      }
    }

    // Determine execution command
    const runCmd =
      language === 'java' && fullCode.includes('class SolutionRunner')
        ? 'java -cp /code SolutionRunner < /code/input.txt'
        : config.runCmd;

    // Run execution with timeout race
    const executionPromise = runExec(container, runCmd);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Time Limit Exceeded')), MAX_EXECUTION_TIME);
    });

    const runRes = await Promise.race([executionPromise, timeoutPromise]);
    const runtime = Date.now() - startTime;

    // Get memory usage if available
    let memory = 0;
    try {
      const stats = await container.stats({ stream: false });
      memory = Math.floor((stats.memory_stats?.usage || 0) / 1024 / 1024);
    } catch (_) {}

    if (runRes.exitCode !== 0) {
      return {
        status: 'Runtime Error',
        output: runRes.stdout,
        error: runRes.stderr || `Exited with status code ${runRes.exitCode}`,
        runtime,
        memory,
      };
    }

    return {
      status: 'Accepted',
      output: runRes.stdout,
      error: null,
      runtime,
      memory,
    };
  } catch (error) {
    const runtime = Date.now() - startTime;
    logger.error('Code execution error:', error);

    if (error instanceof Error && error.message === 'Time Limit Exceeded') {
      return {
        status: 'Time Limit Exceeded',
        output: '',
        error: 'Your code took too long to execute (Time Limit Exceeded)',
        runtime: MAX_EXECUTION_TIME,
        memory: 0,
      };
    }

    return {
      status: 'Runtime Error',
      output: '',
      error: error instanceof Error ? error.message : String(error),
      runtime,
      memory: 0,
    };
  } finally {
    if (container) {
      try {
        await container.stop({ t: 0 }).catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      } catch (_) {}
    }
  }
}

export async function executeBatch(
  code: string,
  language: string,
  testCases: BatchTestCase[]
): Promise<BatchTestCaseResult[]> {
  if (!testCases || testCases.length === 0) {
    return [];
  }

  if (language === 'python') {
    return executeBatchPython(code, testCases);
  } else if (language === 'javascript' || language === 'typescript') {
    return executeBatchJS(code, testCases);
  }

  return executeBatchContainerSession(code, language, testCases);
}

async function executeBatchPython(
  code: string,
  testCases: BatchTestCase[]
): Promise<BatchTestCaseResult[]> {
  const startTime = Date.now();
  let container: Docker.Container | null = null;

  try {
    await ensureImage('python:3.11-alpine');

    container = await docker.createContainer({
      Image: 'python:3.11-alpine',
      Cmd: ['sh', '-c', 'sleep 60'],
      WorkingDir: '/code',
      HostConfig: {
        Memory: MAX_MEMORY_MB * 1024 * 1024,
        MemorySwap: MAX_MEMORY_MB * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000,
        NetworkMode: 'none',
      },
      Tty: false,
    });

    await container.start();

    const harness = `
import sys
import re
import json
import time
import traceback
from typing import *

${code}

if __name__ == '__main__':
    try:
        with open('/code/testcases.json', 'r', encoding='utf-8') as f:
            cases = json.load(f)
    except Exception as e:
        sys.exit(1)

    results = []

    method_name = None
    if 'Solution' in globals() and isinstance(globals()['Solution'], type):
        methods = [m for m in dir(globals()['Solution']) if not m.startswith('_')]
        if methods:
            method_name = methods[0]
    elif 'solution' in globals() and callable(globals()['solution']):
        method_name = 'solution'

    for tc in cases:
        tc_id = tc.get('id', '')
        raw_input = tc.get('input', '').strip()
        t0 = time.perf_counter()

        try:
            if not method_name:
                results.append({
                    "id": tc_id,
                    "status": "Runtime Error",
                    "output": "",
                    "error": "No solution method found in Solution class",
                    "runtime": 0
                })
                break

            if method_name == 'solution' and 'solution' in globals() and callable(globals()['solution']) and not ('Solution' in globals() and hasattr(globals()['Solution'], 'solution')):
                caller = globals()['solution']
            else:
                sol_instance = globals()['Solution']()
                caller = getattr(sol_instance, method_name)

            args_dict = {}
            args_list = []
            if raw_input:
                if '=' in raw_input:
                    parts = re.split(r',\\s*(?=[a-zA-Z_]\\w*\\s*=)', raw_input)
                    exec_scope = {}
                    try:
                        exec('\\n'.join(parts), {}, exec_scope)
                        args_dict = exec_scope
                    except Exception:
                        args_list = [raw_input]
                else:
                    try:
                        args_list = [json.loads(raw_input)]
                    except Exception:
                        args_list = [raw_input]

            if args_dict:
                res = caller(**args_dict)
            elif args_list:
                res = caller(*args_list)
            else:
                res = caller()

            runtime_ms = max(1, int((time.perf_counter() - t0) * 1000))

            out_str = ""
            if res is not None:
                if isinstance(res, bool):
                    out_str = 'True' if res else 'False'
                elif isinstance(res, (list, dict, tuple)):
                    out_str = json.dumps(res)
                elif isinstance(res, float):
                    if abs(res - round(res, 5)) < 1e-7 and not res.is_integer():
                        out_str = f"{res:.5f}"
                    else:
                        out_str = f"{res:g}"
                else:
                    out_str = str(res)

            results.append({
                "id": tc_id,
                "status": "Accepted",
                "output": out_str,
                "error": None,
                "runtime": runtime_ms
            })
        except Exception:
            runtime_ms = max(1, int((time.perf_counter() - t0) * 1000))
            results.append({
                "id": tc_id,
                "status": "Runtime Error",
                "output": "",
                "error": traceback.format_exc().strip(),
                "runtime": runtime_ms
            })
            break

    try:
        with open('/code/results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f)
    except Exception:
        pass
`;

    const codeBase64 = Buffer.from(harness, 'utf-8').toString('base64');
    const casesData = JSON.stringify(testCases.map((tc, idx) => ({ id: tc.id || `tc-${idx}`, input: tc.input })));
    const casesBase64 = Buffer.from(casesData, 'utf-8').toString('base64');

    await runExec(
      container,
      `mkdir -p /code && echo "${codeBase64}" | base64 -d > /code/batch_runner.py && echo "${casesBase64}" | base64 -d > /code/testcases.json`
    );

    const execPromise = runExec(container, 'python /code/batch_runner.py');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Time Limit Exceeded')), MAX_EXECUTION_TIME * 2);
    });

    const runRes = await Promise.race([execPromise, timeoutPromise]);

    let memory = 0;
    try {
      const stats = await container.stats({ stream: false });
      memory = Math.floor((stats.memory_stats?.usage || 0) / 1024 / 1024);
    } catch (_) {}

    const catRes = await runExec(container, 'cat /code/results.json | base64');
    if (catRes.exitCode === 0 && catRes.stdout.trim()) {
      try {
        const decoded = Buffer.from(catRes.stdout.trim(), 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded) as BatchTestCaseResult[];
        return parsed.map((r) => ({ ...r, memory }));
      } catch (_) {}
    }

    if (runRes.exitCode !== 0) {
      return [{
        id: testCases[0]?.id || 'tc-0',
        status: 'Runtime Error',
        output: runRes.stdout,
        error: runRes.stderr || `Exited with status code ${runRes.exitCode}`,
        runtime: Date.now() - startTime,
        memory,
      }];
    }

    return [];
  } catch (err: any) {
    if (err?.message === 'Time Limit Exceeded') {
      return [{
        id: testCases[0]?.id || 'tc-0',
        status: 'Time Limit Exceeded',
        output: '',
        error: 'Time Limit Exceeded',
        runtime: MAX_EXECUTION_TIME,
        memory: 0,
      }];
    }
    return [{
      id: testCases[0]?.id || 'tc-0',
      status: 'Runtime Error',
      output: '',
      error: err?.message || String(err),
      runtime: Date.now() - startTime,
      memory: 0,
    }];
  } finally {
    if (container) {
      try {
        await container.stop({ t: 0 }).catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      } catch (_) {}
    }
  }
}

async function executeBatchJS(
  code: string,
  testCases: BatchTestCase[]
): Promise<BatchTestCaseResult[]> {
  const startTime = Date.now();
  let container: Docker.Container | null = null;

  try {
    await ensureImage('node:18-alpine');

    container = await docker.createContainer({
      Image: 'node:18-alpine',
      Cmd: ['sh', '-c', 'sleep 60'],
      WorkingDir: '/code',
      HostConfig: {
        Memory: MAX_MEMORY_MB * 1024 * 1024,
        MemorySwap: MAX_MEMORY_MB * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000,
        NetworkMode: 'none',
      },
      Tty: false,
    });

    await container.start();

    const harness = `
const fs = require('fs');

${code}

(function runAll() {
  let cases = [];
  try {
    const raw = fs.readFileSync('/code/testcases.json', 'utf-8');
    cases = JSON.parse(raw);
  } catch (err) {
    process.exit(1);
  }

  const results = [];

  for (const tc of cases) {
    const tcId = tc.id || '';
    const rawInput = (tc.input || '').trim();
    const t0 = Date.now();

    try {
      let runner = null;
      if (typeof Solution === 'function') {
        const inst = new Solution();
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(inst)).filter(m => m !== 'constructor');
        if (methods.length > 0 && typeof inst[methods[0]] === 'function') {
          runner = inst[methods[0]].bind(inst);
        }
      } else if (typeof solution === 'function') {
        runner = solution;
      }

      if (!runner) {
        results.push({
          id: tcId,
          status: 'Runtime Error',
          output: '',
          error: 'No solution method found in Solution class',
          runtime: 0
        });
        break;
      }

      let args = [];
      if (rawInput) {
        if (rawInput.includes('=')) {
          const parts = rawInput.split(/,\\s*(?=[a-zA-Z_]\\w*\\s*=)/);
          for (const p of parts) {
            const eqIdx = p.indexOf('=');
            if (eqIdx !== -1) {
              const valStr = p.slice(eqIdx + 1).trim();
              try {
                args.push(JSON.parse(valStr));
              } catch (_) {
                args.push(valStr);
              }
            }
          }
        } else {
          try {
            const parsed = JSON.parse(rawInput);
            args = Array.isArray(parsed) ? [parsed] : [parsed];
          } catch (_) {
            args = [rawInput];
          }
        }
      }

      const res = runner(...args);
      const runtimeMs = Math.max(1, Date.now() - t0);

      let outStr = '';
      if (res !== undefined && res !== null) {
        if (Array.isArray(res) || typeof res === 'object') {
          outStr = JSON.stringify(res);
        } else if (typeof res === 'boolean') {
          outStr = res ? 'True' : 'False';
        } else {
          outStr = String(res);
        }
      }

      results.push({
        id: tcId,
        status: 'Accepted',
        output: outStr,
        error: null,
        runtime: runtimeMs
      });
    } catch (err) {
      const runtimeMs = Math.max(1, Date.now() - t0);
      results.push({
        id: tcId,
        status: 'Runtime Error',
        output: '',
        error: err && err.stack ? err.stack : String(err),
        runtime: runtimeMs
      });
      break;
    }
  }

  try {
    fs.writeFileSync('/code/results.json', JSON.stringify(results), 'utf-8');
  } catch (_) {}
})();
`;

    const codeBase64 = Buffer.from(harness, 'utf-8').toString('base64');
    const casesData = JSON.stringify(testCases.map((tc, idx) => ({ id: tc.id || `tc-${idx}`, input: tc.input })));
    const casesBase64 = Buffer.from(casesData, 'utf-8').toString('base64');

    await runExec(
      container,
      `mkdir -p /code && echo "${codeBase64}" | base64 -d > /code/solution.js && echo "${casesBase64}" | base64 -d > /code/testcases.json`
    );

    const execPromise = runExec(container, 'node /code/solution.js');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Time Limit Exceeded')), MAX_EXECUTION_TIME * 2);
    });

    const runRes = await Promise.race([execPromise, timeoutPromise]);

    let memory = 0;
    try {
      const stats = await container.stats({ stream: false });
      memory = Math.floor((stats.memory_stats?.usage || 0) / 1024 / 1024);
    } catch (_) {}

    const catRes = await runExec(container, 'cat /code/results.json | base64');
    if (catRes.exitCode === 0 && catRes.stdout.trim()) {
      try {
        const decoded = Buffer.from(catRes.stdout.trim(), 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded) as BatchTestCaseResult[];
        return parsed.map((r) => ({ ...r, memory }));
      } catch (_) {}
    }

    if (runRes.exitCode !== 0) {
      return [{
        id: testCases[0]?.id || 'tc-0',
        status: 'Runtime Error',
        output: runRes.stdout,
        error: runRes.stderr || `Exited with status code ${runRes.exitCode}`,
        runtime: Date.now() - startTime,
        memory,
      }];
    }

    return [];
  } catch (err: any) {
    if (err?.message === 'Time Limit Exceeded') {
      return [{
        id: testCases[0]?.id || 'tc-0',
        status: 'Time Limit Exceeded',
        output: '',
        error: 'Time Limit Exceeded',
        runtime: MAX_EXECUTION_TIME,
        memory: 0,
      }];
    }
    return [{
      id: testCases[0]?.id || 'tc-0',
      status: 'Runtime Error',
      output: '',
      error: err?.message || String(err),
      runtime: Date.now() - startTime,
      memory: 0,
    }];
  } finally {
    if (container) {
      try {
        await container.stop({ t: 0 }).catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      } catch (_) {}
    }
  }
}

async function executeBatchContainerSession(
  code: string,
  language: string,
  testCases: BatchTestCase[]
): Promise<BatchTestCaseResult[]> {
  const config = languageConfigs[language];
  if (!config) {
    return [{
      id: testCases[0]?.id || 'tc-0',
      status: 'Compile Error',
      output: '',
      error: `Unsupported language: ${language}`,
      runtime: 0,
      memory: 0,
    }];
  }

  const startTime = Date.now();
  let container: Docker.Container | null = null;
  const results: BatchTestCaseResult[] = [];

  try {
    await ensureImage(config.image);

    container = await docker.createContainer({
      Image: config.image,
      Cmd: ['sh', '-c', 'sleep 120'],
      WorkingDir: '/code',
      HostConfig: {
        Memory: MAX_MEMORY_MB * 1024 * 1024,
        MemorySwap: MAX_MEMORY_MB * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000,
        NetworkMode: 'none',
      },
      Tty: false,
    });

    await container.start();

    const fullCode = config.wrapCode(code);
    const codeBase64 = Buffer.from(fullCode, 'utf-8').toString('base64');
    await runExec(
      container,
      `mkdir -p /code && echo "${codeBase64}" | base64 -d > /code/${config.fileName}`
    );

    if (config.compileCmd) {
      const compileRes = await runExec(container, config.compileCmd);
      if (compileRes.exitCode !== 0) {
        return [{
          id: testCases[0]?.id || 'tc-0',
          status: 'Compile Error',
          output: '',
          error: compileRes.stderr || compileRes.stdout || 'Compilation failed',
          runtime: Date.now() - startTime,
          memory: 0,
        }];
      }
    }

    const runCmd =
      language === 'java' && fullCode.includes('class SolutionRunner')
        ? 'java -cp /code SolutionRunner < /code/input.txt'
        : config.runCmd;

    for (const tc of testCases) {
      const tcId = tc.id;
      const tcStart = Date.now();
      const inputBase64 = Buffer.from(tc.input, 'utf-8').toString('base64');
      await runExec(container, `echo "${inputBase64}" | base64 -d > /code/input.txt`);

      const execPromise = runExec(container, runCmd);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Time Limit Exceeded')), MAX_EXECUTION_TIME);
      });

      try {
        const runRes = await Promise.race([execPromise, timeoutPromise]);
        const tcRuntime = Date.now() - tcStart;

        if (runRes.exitCode !== 0) {
          results.push({
            id: tcId,
            status: 'Runtime Error',
            output: runRes.stdout,
            error: runRes.stderr || `Exited with status code ${runRes.exitCode}`,
            runtime: tcRuntime,
            memory: 0,
          });
          break;
        }

        results.push({
          id: tcId,
          status: 'Accepted',
          output: runRes.stdout,
          error: null,
          runtime: tcRuntime,
          memory: 0,
        });
      } catch (err: any) {
        results.push({
          id: tcId,
          status: 'Time Limit Exceeded',
          output: '',
          error: 'Time Limit Exceeded',
          runtime: MAX_EXECUTION_TIME,
          memory: 0,
        });
        break;
      }
    }

    return results;
  } catch (err: any) {
    return [{
      id: testCases[0]?.id || 'tc-0',
      status: 'Runtime Error',
      output: '',
      error: err?.message || String(err),
      runtime: Date.now() - startTime,
      memory: 0,
    }];
  } finally {
    if (container) {
      try {
        await container.stop({ t: 0 }).catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      } catch (_) {}
    }
  }
}
