import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para extrair SSID do header Authorization e adicionar ao body
 */
export const extractSSIDFromHeader = (req: Request, res: Response, next: NextFunction): void => {
  // Extrair SSID do header Authorization (Bearer Token)
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const ssid = authHeader.replace('Bearer ', '').trim();
    
    // Adicionar SSID ao body se não estiver presente
    if (!req.body.ssid && ssid) {
      req.body.ssid = ssid;
    }
  }
  
  next();
};