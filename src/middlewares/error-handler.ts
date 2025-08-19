import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/custom-errors';
import { ApiResponse } from '../types/response.types';
import { Logger } from "../utils/logger";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Erro interno do servidor';
  let isOperational = false;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  }

  // Log do erro para desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    Logger.error("ERROR_HANDLER", "Error Details", {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query
    });
  }

  const response: ApiResponse = {
    success: false,
    message,
    error: isOperational ? message : 'Erro interno do servidor',
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(response);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};