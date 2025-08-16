import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { setupSwagger } from './config/swagger.config';
import authRoutes from './routes/auth.routes';
import marketRoutes from './routes/market.routes';
import candlesRoutes from './routes/candles.routes';
import healthRoutes from './routes/health.routes';
import { errorHandler } from './middlewares/error-handler';
import { config } from './config/app.config';

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
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));

    // Middlewares de parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Middleware de logging
    if (config.nodeEnv === 'development') {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
      });
    }
  }

  private initializeRoutes(): void {
    // Health check route
    this.app.use('/health', healthRoutes);
    
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/markets', marketRoutes);
    this.app.use('/api/candles', candlesRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'IQ Option API está rodando!',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          markets: '/api/markets',
          candles: '/api/candles',
          docs: '/api-docs'
        }
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
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: `Endpoint '${req.originalUrl}' não encontrado`,
        timestamp: new Date().toISOString(),
        availableEndpoints: {
          health: '/health',
          auth: '/api/auth',
          markets: '/api/markets',
          candles: '/api/candles',
          docs: '/api-docs'
        }
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`🚀 Servidor rodando na porta ${this.port}`);
      console.log(`📚 Documentação disponível em: http://localhost:${this.port}/api-docs`);
      console.log(`❤️  Health check disponível em: http://localhost:${this.port}/health`);
      console.log(`🌍 Ambiente: ${config.nodeEnv}`);
    }).on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Erro: Porta ${this.port} já está em uso!`);
        console.log('💡 Soluções:');
        console.log('   1. Pare o processo que está usando a porta');
        console.log('   2. Mude a porta no arquivo .env');
        console.log('   3. Use: npx kill-port 3001');
        process.exit(1);
      } else {
        console.error('❌ Erro ao iniciar servidor:', error);
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