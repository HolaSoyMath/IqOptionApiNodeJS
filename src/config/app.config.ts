import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || ''
  },
  
  iqOption: {
    host: process.env.IQ_OPTION_HOST || 'iqoption.com',
    apiUrl: process.env.IQ_OPTION_API_URL || 'https://iqoption.com/api',
    wsUrl: process.env.IQ_OPTION_WS_URL || 'wss://iqoption.com/echo/websocket'
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default-secret-key',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10)
  },
  
  session: {
    timeout: parseInt(process.env.SESSION_TIMEOUT || '3600000', 10) // 1 hour
  }
};