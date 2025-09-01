import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { setupSwagger } from "./config/swagger.config";
import authRoutes from "./routes/auth.routes";
import marketRoutes from "./routes/market.routes";
import candlesRoutes from "./routes/candles.routes";
import accountRoutes from "./routes/account.routes";
import healthRoutes from "./routes/health.routes";
import ordersRoutes from "./routes/orders.routes";
import { errorHandler } from "./middlewares/error-handler";
import { config } from "./config/app.config";
import { Logger } from "./utils/logger";
import { configRoutes } from './routes/config.routes';
import candleRoutes from './routes/candle.routes';
import { strategyRoutes } from './routes/strategy.routes';
import { IQSocketService } from './services/iqsocket.service';
import { OrderListenerService } from './services/orderListener.service';

class App {
  public app: Express;
  private port: number;

  constructor() {
    this.app = express();
    this.port = config.port;
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSwagger();
    this.initializeErrorHandling();
    this.initializeServices();
  }

  private initializeMiddlewares(): void {
    // Middlewares de segurança
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || "*",
        credentials: true,
      })
    );

    // Middlewares de parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Middleware de logging
    if (config.nodeEnv === "development") {
      this.app.use((req, res, next) => {
        Logger.info("APP", `${req.method} ${req.path}`);
        next();
      });
    }
  }

  private initializeRoutes(): void {
    // Health check route
    this.app.use("/health", healthRoutes);

    // API routes
    this.app.use("/api/auth", authRoutes);
    this.app.use("/api/account", accountRoutes);
    this.app.use("/api/market", marketRoutes);
    this.app.use("/api/candle", candleRoutes);
    this.app.use("/api/candles", candlesRoutes);
    this.app.use("/api/orders", ordersRoutes);
    this.app.use("/api/config", configRoutes);
    this.app.use("/api/strategies", strategyRoutes);

    // Root endpoint
    this.app.get("/", (req, res) => {
      res.status(200).json({
        success: true,
        message: "IQ Option API está rodando!",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        endpoints: {
          health: "/health",
          auth: "/api/auth",
          account: "/api/account",
          market: "/api/market",
          candle: "/api/candle",
          candles: "/api/candles",
          orders: "/api/orders",
          config: "/api/config",
        },
      });
    });
  }

  private initializeSwagger(): void {
    setupSwagger(this.app);
  }

  private initializeErrorHandling(): void {
    // Middleware de tratamento de erros
    this.app.use(errorHandler);

    // Rota 404 - deve ser a última
    this.app.use("*", (req, res) => {
      res.status(404).json({
        success: false,
        message: `Endpoint '${req.originalUrl}' não encontrado`,
        timestamp: new Date().toISOString(),
        availableEndpoints: {
          health: "/health",
          auth: "/api/auth",
          account: "/api/account",
          market: "/api/market",
          candle: "/api/candle",
          candles: "/api/candles",
          orders: "/api/orders",
          config: "/api/config",
          docs: "/api-docs",
        },
      });
    });
  }

  private initializeServices(): void {
    // Inicializar OrderListenerService com IQSocketService
    const iqSocket = IQSocketService.getInstance();
    OrderListenerService.initialize(iqSocket);
    Logger.info("APP", "📡 OrderListenerService inicializado com sucesso");
  }

  public start(): void {
    this.app
      .listen(this.port, () => {
        Logger.info("APP", `🚀 Servidor rodando na porta ${this.port}`);
        Logger.info("APP", "📚 Documentação Swagger disponível em:");
        Logger.info("APP", `   http://localhost:${this.port}/api-docs`);
        Logger.info("APP", "🔗 Endpoints principais:");
        Logger.info("APP", `   http://localhost:${this.port}/api/health`);
        Logger.info("APP", `🌍 Ambiente: ${config.nodeEnv}`);
      })
      .on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          Logger.error("APP", `❌ Erro: Porta ${this.port} já está em uso!`);
          Logger.info("APP", "💡 Soluções:");
          Logger.info("APP", "   1. Pare o processo que está usando a porta");
          Logger.info("APP", "   2. Mude a porta no arquivo .env");
          Logger.info("APP", "   3. Use: npx kill-port 3001");
          process.exit(1);
        } else {
          Logger.error("APP", "❌ Erro ao iniciar servidor", error);
          process.exit(1);
        }
      });
  }

  public getApp(): Express {
    return this.app;
  }
}

// Criar e exportar instância única
const appInstance = new App();

// Iniciar servidor apenas se este arquivo for executado diretamente
if (require.main === module) {
  appInstance.start();
}

// Exportar para testes
export default appInstance.getApp();
export { appInstance };
