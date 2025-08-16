import { Request, Response, NextFunction } from 'express';
import { unsubscribeCandlesSchema } from '../dto/unsubscribe-candles.dto';
import { ApiResponse } from '../types/response.types';

export const validateUnsubscribeCandles = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = unsubscribeCandlesSchema.validate(req.body);
  
  if (error) {
    const response: ApiResponse = {
      success: false,
      message: error.details[0].message,
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }
  
  next();
};