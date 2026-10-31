import { Router } from 'express';
import { getDuelsLeaderboard, getUserDuelStats } from '../controllers/duel.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/leaderboard', getDuelsLeaderboard);
router.get('/stats', authenticate, getUserDuelStats);

export default router;

