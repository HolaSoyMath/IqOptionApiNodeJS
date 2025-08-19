import WebSocket from "ws";
import { EventEmitter } from "events";

export interface MarketLite {
  id: string | number;
  name: string;
  type: "binary" | "turbo" | "crypto" | "forex" | "cfd" | "digital";
  active_id?: number;
}

export interface WSClientConfig {
  url: string;
  ssid: string;
  timeout: number;
}

export class IQWSClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WSClientConfig;
  private isAuthenticated = false;
  private pendingRequests = new Map<
    string,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();
  private requestCounter = 0;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 60 segundos
  private subscriptions = new Set<string>();

  constructor(config: WSClientConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[WS] Conectando em ${this.config.url}`);

      this.ws = new WebSocket(this.config.url, {
        headers: {
          Origin: "https://iqoption.com",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const timeout = setTimeout(() => {
        reject(new Error("Timeout na conexão WebSocket"));
      }, this.config.timeout);

      this.ws.on("open", () => {
        clearTimeout(timeout);
        console.log("[WS] Conectado, iniciando autenticação...");
        this.authenticate()
          .then(() => {
            console.log("[WS] Autenticado com sucesso");
            resolve();
          })
          .catch(reject);
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error("[WS] Erro ao parsear mensagem:", error);
        }
      });

      this.ws.on("error", (error) => {
        clearTimeout(timeout);
        console.error("[WS] Erro de conexão:", error);
        reject(error);
      });

      this.ws.on("close", () => {
        console.log("[WS] Conexão fechada");
        this.isAuthenticated = false;
        this.emit("disconnected");
      });
    });
  }

  private async authenticate(): Promise<void> {
    const authMessage = {
      name: "ssid",
      msg: this.config.ssid,
      request_id: this.generateRequestId(),
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout na autenticação"));
      }, this.config.timeout);

      const handleAuth = (message: any) => {
        if (message.name === "profile" || message.name === "timeSync") {
          clearTimeout(timeout);
          this.isAuthenticated = true;
          this.removeListener("message", handleAuth);
          resolve();
        }
      };

      this.on("message", handleAuth);
      this.sendRaw(authMessage);
    });
  }

  private handleMessage(message: any): void {
    console.log(
      `[WS] Mensagem recebida: ${message.name} (request_id: ${message.request_id})`
    );

    // Resolver requests pendentes
    if (message.request_id && this.pendingRequests.has(message.request_id)) {
      const pending = this.pendingRequests.get(message.request_id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.request_id);

      if (message.name === "result" || message.msg) {
        pending.resolve(message.msg || message);
      } else {
        pending.reject(
          new Error(`Erro na resposta: ${JSON.stringify(message)}`)
        );
      }
    }

    this.emit("message", message);
  }

  async send(
    name: string,
    version: string,
    body: any,
    requestId?: string
  ): Promise<any> {
    if (!this.isAuthenticated) {
      throw new Error("WebSocket não autenticado");
    }

    const id = requestId || this.generateRequestId();
    const message = {
      name: "sendMessage",
      msg: {
        name,
        version,
        body,
        request_id: id,
      },
      request_id: id,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timeout na requisição ${name} (${id})`));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.sendRaw(message);
    });
  }

  private sendRaw(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(
        `[WS] Enviando: ${message.name} (request_id: ${message.request_id})`
      );
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error("WebSocket não conectado");
    }
  }

  async getInstruments(type: string): Promise<MarketLite[]> {
    const cacheKey = `instruments_${type}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log(`[WS] Usando cache para instruments ${type}`);
      return cached;
    }

    try {
      console.log(`[WS] Buscando instruments para tipo: ${type}`);

      // Tentar v4.0 primeiro, depois v3.0
      let response;
      try {
        response = await this.send("get-instruments", "4.0", { type });
      } catch (error) {
        console.log(`[WS] Tentando v3.0 para ${type}`);
        response = await this.send("get-instruments", "3.0", { type });
      }

      const instruments: MarketLite[] = [];

      if (response && response.instruments) {
        for (const instrument of response.instruments) {
          instruments.push({
            id: instrument.id,
            name: instrument.name,
            type: this.mapInstrumentType(type),
            active_id: instrument.active_id,
          });
        }
      }

      this.setCache(cacheKey, instruments);
      console.log(
        `[WS] Encontrados ${instruments.length} instruments para ${type}`
      );
      return instruments;
    } catch (error) {
      console.error(`[WS] Erro ao buscar instruments ${type}:`, error);
      return [];
    }
  }

  async getInitializationData(): Promise<{
    binary: MarketLite[];
    turbo: MarketLite[];
  }> {
    const cacheKey = "initialization_data";
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log("[WS] Usando cache para initialization-data");
      return cached;
    }

    try {
      console.log("[WS] Buscando initialization-data...");
      const response = await this.send("get-initialization-data", "3.0", {});

      const result = { binary: [] as MarketLite[], turbo: [] as MarketLite[] };

      // A resposta vem diretamente, não em response.result
      const data = response.result || response;

      if (data) {
        // Processar mercados binary
        if (data.binary?.actives) {
          const binaryActives = Object.entries(data.binary.actives)
            .map(([key, obj]: [string, any]) => {
              const active_id = Number(key);
              const name =
                obj?.name ||
                obj?.asset ||
                obj?.ticker ||
                obj?.symbol ||
                String(active_id);
              const id = active_id;
              return {
                id,
                name,
                type: "binary" as const,
                active_id,
              };
            })
            .filter((item) => item.name && item.active_id)
            .sort((a, b) => a.name.localeCompare(b.name));

          result.binary = binaryActives;
        }

        // Processar mercados turbo
        if (data.turbo?.actives) {
          const turboActives = Object.entries(data.turbo.actives)
            .map(([key, obj]: [string, any]) => {
              const active_id = Number(key);
              const name =
                obj?.name ||
                obj?.asset ||
                obj?.ticker ||
                obj?.symbol ||
                String(active_id);
              const id = active_id;
              return {
                id,
                name,
                type: "turbo" as const,
                active_id,
              };
            })
            .filter((item) => item.name && item.active_id)
            .sort((a, b) => a.name.localeCompare(b.name));

          result.turbo = turboActives;
        }
      }

      this.setCache(cacheKey, result);
      console.log(
        `[BINARY] Dados obtidos: ${result.binary.length} binary, ${result.turbo.length} turbo`
      );
      return result;
    } catch (error) {
      console.error("[WS] Erro ao buscar initialization-data:", error);
      return { binary: [], turbo: [] };
    }
  }

  private mapInstrumentType(
    type: string
  ): "crypto" | "forex" | "cfd" | "digital" {
    switch (type.toLowerCase()) {
      case "crypto":
        return "crypto";
      case "forex":
        return "forex";
      case "cfd":
        return "cfd";
      case "digital-option":
        return "digital";
      default:
        return "crypto";
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  private getCached(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isAuthenticated = false;
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  /**
   * Subscreve para receber atualizações de instrumentos digitais
   */
  async subscribeDigitalInstruments(): Promise<void> {
    const subscriptionKey = "digital-instruments";

    if (this.subscriptions.has(subscriptionKey)) {
      console.log("[WS] Já subscrito aos instrumentos digitais");
      return;
    }

    const subscribeMessage = {
      name: "subscribeMessage",
      msg: {
        name: "instruments",
        params: {
          routingFilters: {
            type: "digital-option",
          },
        },
      },
      request_id: this.generateRequestId(),
    };

    this.sendRaw(subscribeMessage);
    this.subscriptions.add(subscriptionKey);
    console.log("[WS] Subscrito aos instrumentos digitais");
  }

  /**
   * Cancela a subscrição de instrumentos digitais
   */
  async unsubscribeDigitalInstruments(): Promise<void> {
    const subscriptionKey = "digital-instruments";

    if (!this.subscriptions.has(subscriptionKey)) {
      console.log("[WS] Não estava subscrito aos instrumentos digitais");
      return;
    }

    const unsubscribeMessage = {
      name: "unsubscribeMessage",
      msg: {
        name: "instruments",
        params: {
          routingFilters: {
            type: "digital-option",
          },
        },
      },
      request_id: this.generateRequestId(),
    };

    this.sendRaw(unsubscribeMessage);
    this.subscriptions.delete(subscriptionKey);
    console.log("[WS] Cancelada subscrição aos instrumentos digitais");
  }

  /**
   * Subscreve para receber atualizações de preços de instrumentos digitais para um ativo específico
   */
  async subscribeDigitalPrices(assetId: number): Promise<void> {
    const subscriptionKey = `digital-prices-${assetId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      console.log(
        `[WS] Já subscrito aos preços digitais para ativo ${assetId}`
      );
      return;
    }

    const subscribeMessage = {
      name: "subscribeMessage",
      msg: {
        name: "price-splitter.client-price-generated",
        version: "1.0",
        params: {
          routingFilters: {
            instrument_type: "digital-option",
            asset_id: assetId,
          },
        },
      },
      request_id: this.generateRequestId(),
    };

    this.sendRaw(subscribeMessage);
    this.subscriptions.add(subscriptionKey);
    console.log(`[WS] Subscrito aos preços digitais para ativo ${assetId}`);
  }

  /**
   * Cancela a subscrição de preços digitais para um ativo específico
   */
  async unsubscribeDigitalPrices(assetId: number): Promise<void> {
    const subscriptionKey = `digital-prices-${assetId}`;

    if (!this.subscriptions.has(subscriptionKey)) {
      console.log(
        `[WS] Não estava subscrito aos preços digitais para ativo ${assetId}`
      );
      return;
    }

    const unsubscribeMessage = {
      name: "unsubscribeMessage",
      msg: {
        name: "price-splitter.client-price-generated",
        version: "1.0",
        params: {
          routingFilters: {
            instrument_type: "digital-option",
            asset_id: assetId,
          },
        },
      },
      request_id: this.generateRequestId(),
    };

    this.sendRaw(unsubscribeMessage);
    this.subscriptions.delete(subscriptionKey);
    console.log(
      `[WS] Cancelada subscrição aos preços digitais para ativo ${assetId}`
    );
  }

  /**
   * Retorna lista de subscrições ativas
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Cancela todas as subscrições
   */
  async unsubscribeAll(): Promise<void> {
    const subscriptions = Array.from(this.subscriptions);

    for (const subscription of subscriptions) {
      if (subscription === "digital-instruments") {
        await this.unsubscribeDigitalInstruments();
      } else if (subscription.startsWith("digital-prices-")) {
        const assetId = parseInt(subscription.replace("digital-prices-", ""));
        await this.unsubscribeDigitalPrices(assetId);
      }
    }

    this.subscriptions.clear();
    console.log("[WS] Todas as subscrições canceladas");
  }
}
