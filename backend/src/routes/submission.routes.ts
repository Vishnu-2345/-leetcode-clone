import { Router } from 'express';
import {
  submitCode,
  runCode,
  getRunResult,
  getSubmissionById,
  getUserSubmissions,
  getProblemSubmissions,
  visualizeExecution,
  getVisualizeResult,
} from '../controllers/submission.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Run Code (instant test against sample or custom test cases)
router.post('/run', runCode);
router.get('/run/:runId', getRunResult);

// AlgoLens Execution Visualizer
router.post('/visualize', visualizeExecution);
router.get('/visualize/:traceId', getVisualizeResult);

// Official Submissions
router.post('/', authenticate, submitCode);
router.get('/:id', authenticate, getSubmissionById);
router.get('/user/:userId', authenticate, getUserSubmissions);
router.get('/problem/:problemId', authenticate, getProblemSubmissions);

export default router;
