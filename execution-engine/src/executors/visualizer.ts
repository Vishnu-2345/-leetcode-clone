import Docker from 'dockerode';
import { PassThrough } from 'stream';
import { logger } from '../logger';

const docker = new Docker(
  process.platform === 'win32' && !process.env.DOCKER_HOST
    ? { socketPath: '//./pipe/docker_engine' }
    : undefined
);

export interface VisualizerStep {
  step: number;
  line: number;
  event: 'line' | 'call' | 'return';
  function: string;
  variables: Record<string, any>;
  callStack: Array<{ function: string; line: number }>;
  stdout?: string;
  returnVal?: any;
}

export interface VisualizerResult {
  status: 'Success' | 'Error' | 'Compile Error';
  error?: string | null;
  result?: any;
  totalSteps: number;
  steps: VisualizerStep[];
  detectedArrays: string[];
  detectedPointers: string[];
  truncated: boolean;
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

  return new Promise((resolve, reject) => {
    stream.on('end', async () => {
      try {
        const inspectData = await exec.inspect();
        resolve({
          exitCode: inspectData.ExitCode || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      } catch (err) {
        reject(err);
      }
    });

    stream.on('error', reject);
  });
}

const PYTHON_TRACER_TEMPLATE = `
import sys
import os
import json
import re
import traceback

class StdoutCapture:
    def __init__(self):
        self.buffer = []
    def write(self, s):
        self.buffer.append(s)
    def flush(self):
        pass
    def get_value(self):
        return "".join(self.buffer)

stdout_cap = StdoutCapture()
original_stdout = sys.stdout
sys.stdout = stdout_cap

# User Code Injected
USER_CODE_STRING = r"""__USER_CODE_TOKEN__"""
RAW_INPUT = r"""__RAW_INPUT_TOKEN__"""

MAX_STEPS = 150
steps = []

def serialize_val(val, depth=0):
    if depth > 3:
        return repr(val)
    if val is None or isinstance(val, (bool, int, float, str)):
        return val
    if isinstance(val, (list, tuple)):
        if len(val) > 30:
            return [serialize_val(x, depth + 1) for x in val[:30]] + [f"... +{len(val) - 30} more"]
        return [serialize_val(x, depth + 1) for x in val]
    if isinstance(val, dict):
        res = {}
        for k, v in list(val.items())[:25]:
            res[str(k)] = serialize_val(v, depth + 1)
        return res
    if isinstance(val, set):
        return [serialize_val(x, depth + 1) for x in list(val)[:25]]
    return repr(val)

def trace_hook(frame, event, arg):
    if len(steps) >= MAX_STEPS:
        return None
    if frame.f_code.co_filename != '<user_code>' or frame.f_code.co_name == '<module>':
        return trace_hook

    call_stack = []
    curr = frame
    while curr and curr.f_code.co_filename == '<user_code>' and curr.f_code.co_name != '<module>':
        call_stack.append({
            'function': curr.f_code.co_name,
            'line': curr.f_lineno
        })
        curr = curr.f_back

    locals_snap = {}
    for k, v in frame.f_locals.items():
        if not k.startswith('_') and k != 'self':
            locals_snap[k] = serialize_val(v)

    steps.append({
        'step': len(steps) + 1,
        'line': frame.f_lineno,
        'event': event,
        'function': frame.f_code.co_name,
        'variables': locals_snap,
        'callStack': call_stack,
        'stdout': stdout_cap.get_value(),
        'returnVal': serialize_val(arg) if event == 'return' else None
    })
    return trace_hook

def execute():
    # 1. Parse input
    args_dict = {}
    args_list = []
    if RAW_INPUT:
        if '=' in RAW_INPUT:
            parts = re.split(r',\\s*(?=[a-zA-Z_]\\w*\\s*=)', RAW_INPUT)
            scope = {}
            try:
                exec('\\n'.join(parts), {}, scope)
                args_dict = scope
            except Exception:
                args_list = [RAW_INPUT]
        else:
            try:
                args_list = [json.loads(RAW_INPUT)]
            except Exception:
                args_list = [RAW_INPUT]

    # 2. Compile user code
    scope = {}
    try:
        code_obj = compile(USER_CODE_STRING, '<user_code>', 'exec')
        exec(code_obj, scope)
    except Exception as e:
        sys.stdout = original_stdout
        print(json.dumps({
            'status': 'Compile Error',
            'error': str(e),
            'totalSteps': 0,
            'steps': [],
            'detectedArrays': [],
            'detectedPointers': [],
            'truncated': False
        }))
        return

    # 3. Locate target function
    target_fn = None
    if 'Solution' in scope and isinstance(scope['Solution'], type):
        inst = scope['Solution']()
        methods = [m for m in dir(inst) if not m.startswith('_')]
        if methods:
            target_fn = getattr(inst, methods[0])
    else:
        for k, v in scope.items():
            if callable(v) and not k.startswith('_'):
                target_fn = v
                break

    if not target_fn:
        sys.stdout = original_stdout
        print(json.dumps({
            'status': 'Error',
            'error': 'No callable function or Solution class method found',
            'totalSteps': 0,
            'steps': [],
            'detectedArrays': [],
            'detectedPointers': [],
            'truncated': False
        }))
        return

    # 4. Trace execution
    sys.settrace(trace_hook)
    err = None
    result = None
    try:
        if args_dict:
            result = target_fn(**args_dict)
        elif args_list:
            result = target_fn(*args_list)
        else:
            result = target_fn()
    except Exception:
        err = traceback.format_exc()
    finally:
        sys.settrace(None)

    # 5. Detect arrays and pointer variables
    detected_arrays = set()
    detected_pointers = set()
    pointer_names = {'i', 'j', 'k', 'l', 'r', 'left', 'right', 'low', 'high', 'mid', 'start', 'end', 'p1', 'p2', 'p', 'curr'}
    for s in steps:
        for k, v in s['variables'].items():
            if isinstance(v, list):
                detected_arrays.add(k)
            elif isinstance(v, int) and (k.lower() in pointer_names or 'idx' in k.lower() or 'ptr' in k.lower()):
                detected_pointers.add(k)

    sys.stdout = original_stdout
    print(json.dumps({
        'status': 'Error' if err else 'Success',
        'error': err,
        'result': serialize_val(result),
        'totalSteps': len(steps),
        'steps': steps,
        'detectedArrays': list(detected_arrays),
        'detectedPointers': list(detected_pointers),
        'truncated': len(steps) >= MAX_STEPS
    }))

if __name__ == '__main__':
    execute()
`;

export async function executeVisualizer(
  code: string,
  language: string,
  input: string
): Promise<VisualizerResult> {
  // If language is JavaScript, we can also map or run Python by default
  // For Python execution:
  let container: Docker.Container | null = null;
  try {
    container = await docker.createContainer({
      Image: 'python:3.11-alpine',
      Cmd: ['sh', '-c', 'sleep 60'],
      WorkingDir: '/code',
      HostConfig: {
        Memory: 128 * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000,
        NetworkMode: 'none',
      },
      Tty: false,
    });

    await container.start();

    // Prepare tracer script
    // Escape backslashes and double quotes in user code for Python raw string
    const escapedCode = code.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedInput = input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const script = PYTHON_TRACER_TEMPLATE
      .replace('__USER_CODE_TOKEN__', escapedCode)
      .replace('__RAW_INPUT_TOKEN__', escapedInput);

    const scriptBase64 = Buffer.from(script, 'utf-8').toString('base64');
    await runExec(
      container,
      `mkdir -p /code && echo "${scriptBase64}" | base64 -d > /code/tracer.py`
    );

    const runRes = await runExec(container, 'python3 /code/tracer.py');

    if (runRes.exitCode !== 0 && !runRes.stdout) {
      return {
        status: 'Error',
        error: runRes.stderr || 'Tracer process exited with error',
        totalSteps: 0,
        steps: [],
        detectedArrays: [],
        detectedPointers: [],
        truncated: false,
      };
    }

    try {
      const parsed: VisualizerResult = JSON.parse(runRes.stdout);
      return parsed;
    } catch (_) {
      return {
        status: 'Error',
        error: runRes.stdout || runRes.stderr || 'Failed to parse execution trace',
        totalSteps: 0,
        steps: [],
        detectedArrays: [],
        detectedPointers: [],
        truncated: false,
      };
    }
  } catch (err: any) {
    logger.error('Visualizer execution error:', err);
    return {
      status: 'Error',
      error: err?.message || String(err),
      totalSteps: 0,
      steps: [],
      detectedArrays: [],
      detectedPointers: [],
      truncated: false,
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

