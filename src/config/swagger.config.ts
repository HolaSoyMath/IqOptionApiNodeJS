import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IQ Option API Node.js',
      version: '1.0.0',
      description: 'API Node.js para emular funcionalidades da IQ Option',
      contact: {
        name: 'API Support',
        email: 'support@iqoptionapi.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',  // ← Mudança aqui
        description: 'Servidor de Desenvolvimento'
      },
      {
        url: 'https://api.iqoptionapi.com',
        description: 'Servidor de Produção'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'SSID',
          description: 'Token SSID da IQ Option obtido após login'
        }
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indica se a operação foi bem-sucedida'
            },
            message: {
              type: 'string',
              description: 'Mensagem descritiva da operação'
            },
            data: {
              type: 'object',
              description: 'Dados retornados pela operação'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp da resposta'
            }
          },
          required: ['success', 'message', 'timestamp']
        },
        BinaryMarket: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único do mercado'
            },
            name: {
              type: 'string',
              description: 'Nome do par de moedas (ex: EURUSD)'
            },
            enabled: {
              type: 'boolean',
              description: 'Se o mercado está habilitado'
            },
            is_suspended: {
              type: 'boolean',
              description: 'Se o mercado está suspenso'
            },
            type: {
              type: 'string',
              enum: ['binary', 'turbo'],
              description: 'Tipo do mercado'
            },
            profit_commission: {
              type: 'number',
              description: 'Porcentagem de lucro do mercado'
            },
            is_open: {
              type: 'boolean',
              description: 'Se o mercado está aberto para negociação'
            }
          },
          required: ['id', 'name', 'enabled', 'is_suspended', 'type', 'profit_commission', 'is_open']
        },
        InstrumentMarket: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID único do instrumento'
            },
            name: {
              type: 'string',
              description: 'Nome do instrumento'
            },
            active_id: {
              type: 'integer',
              description: 'ID do ativo'
            },
            type: {
              type: 'string',
              enum: ['crypto', 'forex', 'cfd'],
              description: 'Tipo do instrumento'
            },
            schedule: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  open: {
                    type: 'integer',
                    description: 'Timestamp de abertura'
                  },
                  close: {
                    type: 'integer',
                    description: 'Timestamp de fechamento'
                  }
                }
              },
              description: 'Horários de funcionamento'
            },
            is_open: {
              type: 'boolean',
              description: 'Se o mercado está aberto'
            },
            precision: {
              type: 'integer',
              description: 'Precisão decimal'
            },
            min_amount: {
              type: 'number',
              description: 'Valor mínimo de investimento'
            },
            max_amount: {
              type: 'number',
              description: 'Valor máximo de investimento'
            }
          },
          required: ['id', 'name', 'active_id', 'type', 'schedule', 'is_open']
        },
        MarketData: {
          type: 'object',
          properties: {
            binary_markets: {
              type: 'array',
              items: { $ref: '#/components/schemas/BinaryMarket' },
              description: 'Lista de mercados binários'
            },
            turbo_markets: {
              type: 'array',
              items: { $ref: '#/components/schemas/BinaryMarket' },
              description: 'Lista de mercados turbo'
            },
            crypto_markets: {
              type: 'array',
              items: { $ref: '#/components/schemas/InstrumentMarket' },
              description: 'Lista de mercados de criptomoedas'
            },
            forex_markets: {
              type: 'array',
              items: { $ref: '#/components/schemas/InstrumentMarket' },
              description: 'Lista de mercados forex'
            },
            cfd_markets: {
              type: 'array',
              items: { $ref: '#/components/schemas/InstrumentMarket' },
              description: 'Lista de mercados CFD'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp dos dados'
            },
            server_time: {
              type: 'integer',
              description: 'Timestamp do servidor'
            }
          },
          required: ['binary_markets', 'turbo_markets', 'crypto_markets', 'forex_markets', 'cfd_markets', 'timestamp', 'server_time']
        },
        PairAvailability: {
          type: 'object',
          properties: {
            available: {
              type: 'boolean',
              description: 'Se o par está disponível'
            },
            markets: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Lista de mercados onde o par está disponível'
            },
            profit_rates: {
              type: 'object',
              additionalProperties: {
                type: 'number'
              },
              description: 'Taxas de lucro por tipo de mercado'
            }
          },
          required: ['available', 'markets', 'profit_rates']
        },
        LoginRequest: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário'
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'Senha do usuário'
            }
          },
          required: ['email', 'password']
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object',
              properties: {
                ssid: {
                  type: 'string',
                  description: 'Token SSID para autenticação'
                },
                user_id: {
                  type: 'integer',
                  description: 'ID do usuário'
                },
                balance: {
                  type: 'number',
                  description: 'Saldo da conta'
                },
                currency: {
                  type: 'string',
                  description: 'Moeda da conta'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Config: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único da configuração',
              example: 1
            },
            autoConnect: {
              type: 'boolean',
              description: 'Se deve conectar automaticamente na inicialização',
              example: false
            },
            defaultEntryValue: {
              type: 'number',
              minimum: 1,
              description: 'Valor padrão de entrada para operações (mínimo: 1)',
              example: 5.0
            },
            maxOperationsPerDay: {
              type: 'integer',
              minimum: 1,
              description: 'Número máximo de operações por dia',
              example: 50
            },
            stopLoss: {
              type: 'number',
              minimum: 0,
              description: 'Valor de stop loss (0 = desabilitado)',
              example: 0
            },
            stopGain: {
              type: 'number',
              minimum: 0,
              description: 'Valor de stop gain (0 = desabilitado)',
              example: 0
            },
            stopLossEnabled: {
              type: 'boolean',
              description: 'Se o stop loss está habilitado',
              example: false
            },
            stopGainEnabled: {
              type: 'boolean',
              description: 'Se o stop gain está habilitado',
              example: false
            },
            notifications: {
              type: 'object',
              nullable: true,
              properties: {
                win: {
                  type: 'boolean',
                  description: 'Notificações para operações ganhas'
                },
                loss: {
                  type: 'boolean',
                  description: 'Notificações para operações perdidas'
                },
                auto: {
                  type: 'boolean',
                  description: 'Notificações para operações automáticas'
                },
                sound: {
                  type: 'boolean',
                  description: 'Notificações sonoras'
                }
              },
              example: {
                win: true,
                loss: true,
                auto: true,
                sound: true
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da configuração'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização'
            }
          },
          required: ['id', 'autoConnect', 'defaultEntryValue', 'maxOperationsPerDay', 'stopLoss', 'stopGain', 'stopLossEnabled', 'stopGainEnabled', 'createdAt', 'updatedAt']
        },
        ConfigData: {
          type: 'object',
          properties: {
            autoConnect: {
              type: 'boolean',
              description: 'Se deve conectar automaticamente na inicialização',
              example: true
            },
            defaultEntryValue: {
              type: 'number',
              minimum: 1,
              description: 'Valor padrão de entrada para operações (mínimo: 1)',
              example: 10.0
            },
            maxOperationsPerDay: {
              type: 'integer',
              minimum: 1,
              description: 'Número máximo de operações por dia',
              example: 100
            },
            stopLoss: {
              type: 'number',
              minimum: 0,
              description: 'Valor de stop loss (0 = desabilitado)',
              example: 50
            },
            stopGain: {
              type: 'number',
              minimum: 0,
              description: 'Valor de stop gain (0 = desabilitado)',
              example: 100
            },
            stopLossEnabled: {
              type: 'boolean',
              description: 'Se o stop loss está habilitado',
              example: true
            },
            stopGainEnabled: {
              type: 'boolean',
              description: 'Se o stop gain está habilitado',
              example: true
            },
            notifications: {
              type: 'object',
              nullable: true,
              properties: {
                win: {
                  type: 'boolean',
                  description: 'Notificações para operações ganhas'
                },
                loss: {
                  type: 'boolean',
                  description: 'Notificações para operações perdidas'
                },
                auto: {
                  type: 'boolean',
                  description: 'Notificações para operações automáticas'
                },
                sound: {
                  type: 'boolean',
                  description: 'Notificações sonoras'
                }
              },
              example: {
                win: true,
                loss: false,
                auto: true,
                sound: false
              }
            }
          },
          additionalProperties: false
        },
        ConfigResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Configurações recuperadas com sucesso'
            },
            data: {
              type: 'object',
              properties: {
                autoConnect: {
                  type: 'boolean',
                  example: false
                },
                defaultEntryValue: {
                  type: 'number',
                  example: 5.0
                },
                maxOperationsPerDay: {
                  type: 'integer',
                  example: 50
                },
                stopLoss: {
                  type: 'number',
                  example: 0
                },
                stopGain: {
                  type: 'number',
                  example: 0
                },
                stopLossEnabled: {
                  type: 'boolean',
                  example: false
                },
                stopGainEnabled: {
                  type: 'boolean',
                  example: false
                },
                notifications: {
                  type: 'object',
                  nullable: true,
                  example: {
                    win: true,
                    loss: true,
                    auto: true,
                    sound: true
                  }
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['success', 'message', 'data', 'timestamp']
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Mensagem de erro'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['success', 'message', 'timestamp']
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './dist/routes/*.js',  // ← Adicionar para arquivos compilados
    './dist/controllers/*.js'  // ← Adicionar para arquivos compilados
  ]
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'IQ Option API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  }));
  
  // Endpoint para obter o JSON da documentação
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

export { specs };