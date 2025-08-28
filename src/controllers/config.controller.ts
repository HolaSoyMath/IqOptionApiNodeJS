import { Request, Response } from 'express';
import { ConfigService, ConfigData } from '../services/config.service';
import { AppError } from '../errors/custom-errors';

export class ConfigController {
  static async getConfig(req: Request, res: Response) {
    try {
      const config = await ConfigService.getConfig();
      
      res.status(200).json({
        success: true,
        message: 'Configurações recuperadas com sucesso',
        data: {
          autoConnect: config.autoConnect,
          defaultEntryValue: config.defaultEntryValue,
          maxOperationsPerDay: config.maxOperationsPerDay,
          stopLoss: config.stopLoss,
          stopGain: config.stopGain,
          stopLossEnabled: config.stopLossEnabled,
          stopGainEnabled: config.stopGainEnabled,
          notifications: config.notifications
        }
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro interno do servidor'
        });
      }
    }
  }

  static async updateConfig(req: Request, res: Response) {
    try {
      const configData: ConfigData = req.body;
      
      const updatedConfig = await ConfigService.updateConfig(configData);
      
      res.status(200).json({
        success: true,
        message: 'Configurações atualizadas com sucesso',
        data: {
          autoConnect: updatedConfig.autoConnect,
          defaultEntryValue: updatedConfig.defaultEntryValue,
          maxOperationsPerDay: updatedConfig.maxOperationsPerDay,
          stopLoss: updatedConfig.stopLoss,
          stopGain: updatedConfig.stopGain,
          stopLossEnabled: updatedConfig.stopLossEnabled,
          stopGainEnabled: updatedConfig.stopGainEnabled,
          notifications: updatedConfig.notifications
        }
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro interno do servidor'
        });
      }
    }
  }
}