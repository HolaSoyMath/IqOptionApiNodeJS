import { Router } from "express";
import { CandleController } from "../controllers/candle.controller";

const router = Router();

// Subscrever para candles
router.post("/subscribe", CandleController.subscribe);

// Obter candles históricos
router.get("/:symbol/:timeframe", CandleController.getCandles);

// Obter preço atual
router.get("/:symbol/price", CandleController.getCurrentPrice);

// Estatísticas
router.get("/stats", CandleController.getStats);

export default router;
