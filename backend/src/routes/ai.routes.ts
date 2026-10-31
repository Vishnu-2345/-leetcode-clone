import { Router } from 'express';
import {
  analyzeComplexity,
  getHint,
  reviewCode,
  chatWithCoach,
} from '../controllers/ai.controller';

const router = Router();

// Public / Authenticated AI Endpoints
router.post('/analyze-complexity', analyzeComplexity);
router.post('/hint', getHint);
router.post('/review', reviewCode);
router.post('/chat', chatWithCoach);

export default router;

