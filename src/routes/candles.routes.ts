import { Router } from 'express';
import { CandlesController } from '../controllers/candles.controller';
import { extractSSIDFromHeader } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/candles/collect - com middleware para extrair SSID do header
router.post('/collect', extractSSIDFromHeader, CandlesController.collectCandles);

// GET /api/candles/history/:active_id
router.get('/history/:active_id', CandlesController.getHistoryCandles);

export default router;