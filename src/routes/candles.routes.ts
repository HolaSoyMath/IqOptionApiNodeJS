import { Router } from 'express';
import { CandlesController } from '../controllers/candles.controller';
import { extractSSIDFromHeader } from '../middlewares/auth.middleware';
import { validateUnsubscribeCandles } from '../middlewares/unsubscribe-validation';

const router = Router();

// POST /api/candles/collect - com middleware para extrair SSID do header
router.post('/collect', extractSSIDFromHeader, CandlesController.collectCandles);

// POST /api/candles/unsubscribe - novo endpoint para cancelar subscrições
router.post('/unsubscribe', validateUnsubscribeCandles, CandlesController.unsubscribeCandles);

// GET /api/candles/history/:active_id
router.get('/history/:active_id', CandlesController.getHistoryCandles);

export default router;