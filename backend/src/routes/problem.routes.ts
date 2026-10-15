import { Router } from 'express';
import {
  getProblems,
  getProblemBySlug,
  createProblem,
  updateProblem,
  deleteProblem,
} from '../controllers/problem.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', getProblems);
router.get('/:slug', getProblemBySlug);
router.post('/', authenticate, authorize('admin'), createProblem);
router.put('/:id', authenticate, authorize('admin'), updateProblem);
router.delete('/:id', authenticate, authorize('admin'), deleteProblem);

export default router;
