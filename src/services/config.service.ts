import { PrismaClient } from '@prisma/client';
import { AppError } from '../errors/custom-errors';

const prisma = new PrismaClient();

export interface ConfigData {
  autoConnect?: boolean;
  defaultEntryValue?: number;
  maxOperationsPerDay?: number;
  stopLoss?: number;
  stopGain?: number;
  stopLossEnabled?: boolean;
  stopGainEnabled?: boolean;
  notifications?: {
    win: boolean;
    loss: boolean;
    auto: boolean;
    sound: boolean;
  };
}

export class ConfigService {
  static async getConfig() {
    try {
      const config = await prisma.config.upsert({
        where: { id: 1 },
        update: {}, // Não atualiza nada, apenas retorna se existir
        create: {
          id: 1,
          autoConnect: false,
          defaultEntryValue: 5.0,
          maxOperationsPerDay: 50,
          stopLoss: 0,
          stopGain: 0,
          stopLossEnabled: false,
          stopGainEnabled: false,
          notifications: {
            win: true,
            loss: true,
            auto: true,
            sound: true
          }
        }
      });
      
      return config;
    } catch (error) {
      throw new AppError('Erro ao recuperar configurações', 500);
    }
  }

  static async updateConfig(data: ConfigData) {
    try {
      // Validações
      this.validateConfigData(data);
      
      // Usar upsert para evitar race condition
      const config = await prisma.config.upsert({
        where: { id: 1 }, // Assumindo que sempre usamos ID 1 para configuração única
        update: {
          ...data,
          updatedAt: new Date()
        },
        create: {
          id: 1,
          autoConnect: data.autoConnect ?? false,
          defaultEntryValue: data.defaultEntryValue ?? 5.0,
          maxOperationsPerDay: data.maxOperationsPerDay ?? 50,
          stopLoss: data.stopLoss ?? 0,
          stopGain: data.stopGain ?? 0,
          stopLossEnabled: data.stopLossEnabled ?? false,
          stopGainEnabled: data.stopGainEnabled ?? false,
          notifications: data.notifications ?? {
            win: true,
            loss: true,
            auto: true,
            sound: true
          }
        }
      });
      
      return config;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Erro ao atualizar configurações', 500);
    }
  }

  private static validateConfigData(data: ConfigData) {
    if (data.defaultEntryValue !== undefined) {
      if (typeof data.defaultEntryValue !== 'number' || data.defaultEntryValue <= 0) {
        throw new AppError('defaultEntryValue deve ser um número positivo', 400);
      }
    }

    if (data.maxOperationsPerDay !== undefined) {
      if (!Number.isInteger(data.maxOperationsPerDay) || data.maxOperationsPerDay <= 0) {
        throw new AppError('maxOperationsPerDay deve ser um inteiro positivo', 400);
      }
    }

    if (data.stopLoss !== undefined) {
      if (typeof data.stopLoss !== 'number' || data.stopLoss < 0) {
        throw new AppError('stopLoss deve ser um número não negativo', 400);
      }
    }

    if (data.stopGain !== undefined) {
      if (typeof data.stopGain !== 'number' || data.stopGain < 0) {
        throw new AppError('stopGain deve ser um número não negativo', 400);
      }
    }

    if (data.stopLossEnabled !== undefined) {
      if (typeof data.stopLossEnabled !== 'boolean') {
        throw new AppError('stopLossEnabled deve ser um booleano', 400);
      }
    }

    if (data.stopGainEnabled !== undefined) {
      if (typeof data.stopGainEnabled !== 'boolean') {
        throw new AppError('stopGainEnabled deve ser um booleano', 400);
      }
    }

    if (data.notifications !== undefined) {
      if (typeof data.notifications !== 'object' || data.notifications === null) {
        throw new AppError('notifications deve ser um objeto válido', 400);
      }
      
      const requiredKeys = ['win', 'loss', 'auto', 'sound'];
      for (const key of requiredKeys) {
        if (!(key in data.notifications) || typeof data.notifications[key as keyof typeof data.notifications] !== 'boolean') {
          throw new AppError(`notifications.${key} deve ser um booleano`, 400);
        }
      }
    }
  }
}