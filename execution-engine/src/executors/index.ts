import Docker from 'dockerode';
import { logger } from './logger';

const docker = new Docker();

const MAX_EXECUTION_TIME = parseInt(process.env.MAX_EXECUTION_TIME || '5000');
const MAX_MEMORY_MB = parseInt(process.env.MAX_MEMORY_MB || '256');

interface ExecutionResult {
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Compile Error';
  output: string;
  error: string | null;
  runtime: number;
  memory: number;
}

const languageConfigs: Record<string, { image: string; cmd: string[] }> = {
  javascript: {
    image: 'node:18-alpine',
    cmd: ['node', '/code/solution.js'],
  },
  python: {
    image: 'python:3.11-alpine',
    cmd: ['python', '/code/solution.py'],
  },
  java: {
    image: 'openjdk:17-alpine',
    cmd: ['java', 'Solution'],
  },
  cpp: {
    image: 'gcc:latest',
    cmd: ['sh', '-c', 'g++ -o /code/solution /code/solution.cpp && /code/solution'],
  },
};

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
  
  try {
    // Create container
    const container = await docker.createContainer({
      Image: config.image,
      Cmd: config.cmd,
      HostConfig: {
        Memory: MAX_MEMORY_MB * 1024 * 1024, // Convert MB to bytes
        MemorySwap: MAX_MEMORY_MB * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000, // 50% CPU
        NetworkMode: 'none', // Disable network access
        ReadonlyRootfs: false,
      },
      WorkingDir: '/code',
      OpenStdin: true,
      StdinOnce: true,
      Tty: false,
    });

    // Start container
    await container.start();

    // Write code to container
    const fileExtension = getFileExtension(language);
    const fileName = language === 'java' ? 'Solution.java' : `solution${fileExtension}`;
    
    const exec = await container.exec({
      Cmd: ['sh', '-c', `echo '${code.replace(/'/g, "'\\''")}' > /code/${fileName}`],
      AttachStdout: true,
      AttachStderr: true,
    });
    
    await exec.start({});

    // Execute with timeout
    const execPromise = new Promise<string>(async (resolve, reject) => {
      try {
        const stream = await container.attach({
          stream: true,
          stdout: true,
          stderr: true,
          stdin: true,
        });

        let output = '';
        let error = '';

        stream.on('data', (chunk: Buffer) => {
          const data = chunk.toString();
          if (data.includes('[stdout]')) {
            output += data.replace('[stdout]', '');
          } else {
            error += data;
          }
        });

        stream.on('end', () => {
          resolve(output || error);
        });

        // Send input
        stream.write(input);
        stream.end();
      } catch (err) {
        reject(err);
      }
    });

    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Time Limit Exceeded')), MAX_EXECUTION_TIME);
    });

    const output = await Promise.race([execPromise, timeoutPromise]);
    const runtime = Date.now() - startTime;

    // Get memory usage
    const stats = await container.stats({ stream: false });
    const memory = Math.floor(stats.memory_stats.usage / 1024 / 1024); // Convert to MB

    // Clean up
    await container.stop();
    await container.remove();

    return {
      status: 'Accepted',
      output: output.trim(),
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
        error: 'Your code took too long to execute',
        runtime: MAX_EXECUTION_TIME,
        memory: 0,
      };
    }

    return {
      status: 'Runtime Error',
      output: '',
      error: String(error),
      runtime,
      memory: 0,
    };
  }
}

function getFileExtension(language: string): string {
  switch (language) {
    case 'javascript':
      return '.js';
    case 'python':
      return '.py';
    case 'java':
      return '.java';
    case 'cpp':
      return '.cpp';
    default:
      return '.txt';
  }
}
