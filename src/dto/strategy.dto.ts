import Joi from 'joi';

export interface UpdateStrategyDto {
  isActive?: 'active' | 'inactive';
  entryValue?: number;
  accountType?: 'demo' | 'real';
  stopGainType?: 'percentage' | 'value';
  stopGainValue?: number;
  stopGainEnabled?: boolean;
  dailyResetGain?: boolean;
  stopLossType?: 'percentage' | 'value';
  stopLossValue?: number;
  stopLossEnabled?: boolean;
  dailyResetLoss?: boolean;
}

export const updateStrategySchema = Joi.object({
  isActive: Joi.string().valid('active', 'inactive').optional().messages({
    'any.only': 'Status deve ser "active" ou "inactive"'
  }),
  entryValue: Joi.number().min(1).optional().messages({
    'number.min': 'Valor de entrada deve ser maior que 0'
  }),
  accountType: Joi.string().valid('demo', 'real').optional().messages({
    'any.only': 'Tipo de conta deve ser "demo" ou "real"'
  }),
  stopGainType: Joi.string().valid('percentage', 'value').optional().messages({
    'any.only': 'Tipo de stop gain deve ser "percentage" ou "value"'
  }),
  stopGainValue: Joi.number().min(0).optional().messages({
    'number.min': 'Valor de stop gain deve ser maior ou igual a 0'
  }),
  stopGainEnabled: Joi.boolean().optional(),
  dailyResetGain: Joi.boolean().optional(),
  stopLossType: Joi.string().valid('percentage', 'value').optional().messages({
    'any.only': 'Tipo de stop loss deve ser "percentage" ou "value"'
  }),
  stopLossValue: Joi.number().min(0).optional().messages({
    'number.min': 'Valor de stop loss deve ser maior ou igual a 0'
  }),
  stopLossEnabled: Joi.boolean().optional(),
  dailyResetLoss: Joi.boolean().optional()
});