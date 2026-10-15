import { Router } from 'express';
import {
  submitCode,
  getSubmissionById,
  getUserSubmissions,
  getProblemSubmissions,
} from '../controllers/submission.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, submitCode);
router.get('/:id', authenticate, getSubmissionById);
router.get('/user/:userId', authenticate, getUserSubmissions);
router.get('/problem/:problemId', authenticate, getProblemSubmissions);

export default router;
