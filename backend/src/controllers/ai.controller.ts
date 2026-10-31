import { Request, Response } from 'express';
import { z } from 'zod';
import * as aiService from '../services/ai.service';
import { AppError } from '../middleware/errorHandler';

const complexitySchema = z.object({
  problemTitle: z.string().default('Coding Problem'),
  problemDescription: z.string().default(''),
  code: z.string().min(1, 'Code is required to analyze complexity'),
  language: z.string().default('python'),
  apiKey: z.string().optional(),
});

const hintSchema = z.object({
  problemTitle: z.string().default('Coding Problem'),
  problemDescription: z.string().default(''),
  code: z.string().optional().default(''),
  language: z.string().default('python'),
  hintLevel: z.number().min(1).max(3).default(1),
  apiKey: z.string().optional(),
});

const reviewSchema = z.object({
  problemTitle: z.string().default('Coding Problem'),
  code: z.string().min(1, 'Code is required for review'),
  language: z.string().default('python'),
  apiKey: z.string().optional(),
});

const chatSchema = z.object({
  problemTitle: z.string().default('Coding Problem'),
  problemDescription: z.string().default(''),
  code: z.string().default(''),
  language: z.string().default('python'),
  message: z.string().min(1, 'Message cannot be empty'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'model']),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
  apiKey: z.string().optional(),
});

export const analyzeComplexity = async (req: Request, res: Response) => {
  const parsed = complexitySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.errors[0].message);
  }

  const clientApiKey = (req.headers['x-gemini-api-key'] as string) || parsed.data.apiKey;

  const result = await aiService.analyzeComplexity(
    parsed.data.problemTitle,
    parsed.data.problemDescription,
    parsed.data.code,
    parsed.data.language,
    clientApiKey
  );

  res.json({
    status: 'success',
    data: result,
  });
};

export const getHint = async (req: Request, res: Response) => {
  const parsed = hintSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.errors[0].message);
  }

  const clientApiKey = (req.headers['x-gemini-api-key'] as string) || parsed.data.apiKey;

  const result = await aiService.getHint(
    parsed.data.problemTitle,
    parsed.data.problemDescription,
    parsed.data.code,
    parsed.data.language,
    parsed.data.hintLevel,
    clientApiKey
  );

  res.json({
    status: 'success',
    data: result,
  });
};

export const reviewCode = async (req: Request, res: Response) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.errors[0].message);
  }

  const clientApiKey = (req.headers['x-gemini-api-key'] as string) || parsed.data.apiKey;

  const result = await aiService.reviewCode(
    parsed.data.problemTitle,
    parsed.data.code,
    parsed.data.language,
    clientApiKey
  );

  res.json({
    status: 'success',
    data: result,
  });
};

export const chatWithCoach = async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.errors[0].message);
  }

  const clientApiKey = (req.headers['x-gemini-api-key'] as string) || parsed.data.apiKey;

  const result = await aiService.askCoach(
    parsed.data.problemTitle,
    parsed.data.problemDescription,
    parsed.data.code,
    parsed.data.language,
    parsed.data.message,
    parsed.data.history,
    clientApiKey
  );

  res.json({
    status: 'success',
    data: result,
  });
};
