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
import { errorHandler } from "./middlewares/error-handler";
import { config } from "./config/app.config";
import { Logger } from "./utils/logger";

// Carregar variáveis de ambiente
dotenv.config();

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

  // Removido: import ordersRoutes from "./routes/orders.routes";

  private initializeRoutes(): void {
    // Health check route
    this.app.use("/health", healthRoutes);

    // API routes
    this.app.use("/api/auth", authRoutes);
    this.app.use("/api/markets", marketRoutes);
    this.app.use("/api/candles", candlesRoutes);
    this.app.use("/api/account", accountRoutes);
    // Removido: this.app.use("/api/orders", ordersRoutes);

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
          markets: "/api/markets",
          candles: "/api/candles",
          account: "/api/account",
          // Removido: orders: "/api/orders",
          docs: "/api-docs",
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
          markets: "/api/markets",
          candles: "/api/candles",
          account: "/api/account",
          // Removido: orders: "/api/orders",
          docs: "/api-docs",
        },
      });
    });
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
