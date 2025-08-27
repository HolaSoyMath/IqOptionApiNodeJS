import { Request, Response } from "express";
import { candleManager } from "../services/candleManager";
import { iqCandleService } from "../services/iqCandleService";

export class CandleController {
  /**
   * Subscreve para receber candles de um símbolo
   */
  static async subscribe(req: Request, res: Response): Promise<void> {
    try {
      const { symbol, timeframe } = req.body;
      const ssid = req.headers.authorization?.replace("Bearer ", "");

      if (!ssid) {
        res.status(401).json({ success: false, message: "SSID necessário" });
        return;
      }

      if (!symbol || !timeframe) {
        res.status(400).json({
          success: false,
          message: "symbol e timeframe são obrigatórios",
          example: { symbol: "EURUSD", timeframe: "1m" },
        });
        return;
      }

      await iqCandleService.subscribeToCandles(ssid, symbol, timeframe);

      res.json({
        success: true,
        message: `Subscrito para candles de ${symbol} ${timeframe}`,
        data: {
          symbol,
          timeframe,
          currentCandles: candleManager.getCandles(symbol, timeframe, 10),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erro ao subscrever candles",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Obtém candles históricos
   */
  static async getCandles(req: Request, res: Response): Promise<void> {
    try {
      const { symbol, timeframe } = req.params;
      const { limit } = req.query;

      const candles = candleManager.getCandles(
        symbol,
        timeframe,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          count: candles.length,
          candles,
          lastPrice: candleManager.getCurrentPrice(symbol, timeframe),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erro ao obter candles",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Obtém preço atual
   */
  static async getCurrentPrice(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const { timeframe = "1m" } = req.query;

      const price = candleManager.getCurrentPrice(symbol, timeframe as string);
      const lastCandle = candleManager.getLastCandle(
        symbol,
        timeframe as string
      );

      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          currentPrice: price,
          lastCandle,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erro ao obter preço atual",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Obtém estatísticas dos candles em memória
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = candleManager.getStats();
      const availableSymbols = candleManager.getAvailableSymbols();

      res.json({
        success: true,
        data: {
          stats,
          availableSymbols,
          totalSymbols: availableSymbols.length,
          memoryUsage: process.memoryUsage(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erro ao obter estatísticas",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
