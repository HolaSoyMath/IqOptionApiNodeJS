import { Request, Response } from 'express';
import { AppError } from '../errors/custom-errors';
import { Logger } from '../utils/logger';
import { StrategyService } from '@/services/strategy.service';

export class StrategyController {
  /**
   * GET /api/strategies
   * Retorna todas as estratégias com summary
   */
  static async getAll(req: Request, res: Response) {
    try {
      const result = await StrategyService.getAllStrategies();
      
      return res.status(200).json({
        success: true,
        message: 'Estratégias recuperadas com sucesso',
        data: result
      });
    } catch (error) {
      Logger.error('Erro ao buscar estratégias:', (error as Error).message);
      
      if (error instanceof AppError) { 
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * PUT /api/strategies/:id
   * Atualiza configurações de uma estratégia
   */
  static async update(req: Request, res: Response) {
    try {
      const strategyId = parseInt(req.params.id);
      
      if (isNaN(strategyId)) {
        throw new AppError('ID da estratégia deve ser um número válido', 400);
      }
      
      const updatedStrategy = await StrategyService.updateStrategy(strategyId, req.body);
      
      return res.status(200).json({
        success: true,
        message: 'Estratégia atualizada com sucesso',
        data: updatedStrategy
      });
    } catch (error) {
      Logger.error('Erro ao atualizar estratégia:', (error as Error).message);
      
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}