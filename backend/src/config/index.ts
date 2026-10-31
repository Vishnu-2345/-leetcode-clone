import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://leetcode_user:leetcode_password@localhost:5432/leetcode_db',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  
  execution: {
    maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '5000', 10),
    maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB || '256', 10),
  },

  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'codellama',
  },
};
