import { Router } from 'express';
import { CandlesController } from '../controllers/candles.controller';

const router = Router();

// POST /api/candles/collect
router.post('/collect', CandlesController.collectCandles);

// GET /api/candles/status
router.get('/status', CandlesController.getCollectionStatus);

// GET /api/candles/live/:active_id
router.get('/live/:active_id', CandlesController.getLiveCandles);

// GET /api/candles/history/:active_id
router.get('/history/:active_id', CandlesController.getHistoryCandles);

export default router;