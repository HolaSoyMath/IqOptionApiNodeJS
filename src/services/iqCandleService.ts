import { candleManager } from "./candleManager";
import { Candle } from "../types/candle.types";
import { IQWSClient } from "./iq/ws-client";

class IQCandleService {
  private static instance: IQCandleService;
  private wsClients: Map<string, IQWSClient> = new Map();
  private activeSubscriptions: Set<string> = new Set();

  private constructor() {}

  static getInstance(): IQCandleService {
    if (!IQCandleService.instance) {
      IQCandleService.instance = new IQCandleService();
    }
    return IQCandleService.instance;
  }

  /**
   * Conecta e subscreve para receber candles da IQ Option
   */
  async subscribeToCandles(
    ssid: string,
    symbol: string,
    timeframe: string
  ): Promise<void> {
    const subscriptionKey = `${symbol}:${timeframe}`;

    if (this.activeSubscriptions.has(subscriptionKey)) {
      console.log(`[IQ CANDLE SERVICE] Já subscrito para ${subscriptionKey}`);
      return;
    }

    try {
      // Obter ou criar cliente WebSocket
      let wsClient = this.wsClients.get(ssid);
      if (!wsClient) {
        wsClient = new IQWSClient({
          url: process.env.IQ_WSS_URL || "wss://ws.iqoption.com/echo/websocket",
          ssid,
          timeout: 10000,
        });
        await wsClient.connect();
        this.wsClients.set(ssid, wsClient);
      }

      // Configurar listener para candles
      wsClient.on("message", (message: any) => {
        if (message.name === "candles" || message.name === "candle-generated") {
          this.handleCandleMessage(message, symbol, timeframe);
        }
      });

      // Subscrever para candles na IQ Option
      await wsClient.send("subscribeMessage", "1.0", {
        name: "candle-generated",
        params: {
          routingFilters: {
            active_id: this.getActiveId(symbol),
            size: this.getTimeframeSize(timeframe),
          },
        },
      });

      this.activeSubscriptions.add(subscriptionKey);

      // Subscrever no gerenciador global
      candleManager.subscribe(symbol, timeframe);

      console.log(
        `[IQ CANDLE SERVICE] Subscrito para candles: ${symbol} ${timeframe}`
      );
    } catch (error) {
      console.error(`[IQ CANDLE SERVICE] Erro ao subscrever candles:`, error);
      throw error;
    }
  }

  /**
   * Processa mensagens de candles da IQ Option
   */
  private handleCandleMessage(
    message: any,
    symbol: string,
    timeframe: string
  ): void {
    try {
      const candleData = message.msg || message.data;

      if (candleData && candleData.candles) {
        candleData.candles.forEach((candleInfo: any) => {
          const candle: Candle = {
            id: `${symbol}_${timeframe}_${candleInfo.from}`,
            symbol,
            timeframe,
            timestamp: candleInfo.from * 1000, // Converter para milliseconds
            open: candleInfo.open,
            high: candleInfo.max,
            low: candleInfo.min,
            close: candleInfo.close,
            volume: candleInfo.volume,
            createdAt: new Date(),
          };

          // Adicionar ao estado global
          candleManager.addCandle(candle);
        });
      }
    } catch (error) {
      console.error("[IQ CANDLE SERVICE] Erro ao processar candle:", error);
    }
  }

  /**
   * Mapeia símbolo para active_id da IQ Option
   */
  private getActiveId(symbol: string): number {
    const symbolMap: { [key: string]: number } = {
      EURUSD: 1,
      GBPUSD: 2,
      USDJPY: 3,
      AUDUSD: 4,
      USDCAD: 5,
      USDCHF: 6,
      NZDUSD: 7,
      EURGBP: 8,
      EURJPY: 9,
      GBPJPY: 10,
      // Adicionar mais símbolos conforme necessário
    };
    return symbolMap[symbol] || 1;
  }

  /**
   * Mapeia timeframe para size da IQ Option
   */
  private getTimeframeSize(timeframe: string): number {
    const timeframeMap: { [key: string]: number } = {
      "1m": 60,
      "5m": 300,
      "15m": 900,
      "30m": 1800,
      "1h": 3600,
      "4h": 14400,
      "1d": 86400,
    };
    return timeframeMap[timeframe] || 60;
  }

  /**
   * Desconecta de todas as subscrições
   */
  async disconnect(): Promise<void> {
    for (const [ssid, client] of this.wsClients) {
      try {
        await client.disconnect();
      } catch (error) {
        console.error(`Erro ao desconectar cliente ${ssid}:`, error);
      }
    }
    this.wsClients.clear();
    this.activeSubscriptions.clear();
  }
}

export const iqCandleService = IQCandleService.getInstance();
