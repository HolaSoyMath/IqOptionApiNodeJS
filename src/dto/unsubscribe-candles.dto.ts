import Joi from 'joi';

export interface UnsubscribeCandlesDto {
  active_ids: number[];
  sizes?: number[];
}

export const unsubscribeCandlesSchema = Joi.object({
  active_ids: Joi.array().items(
    Joi.number().integer().positive().messages({
      'number.base': 'Cada active_id deve ser um número',
      'number.integer': 'Cada active_id deve ser um número inteiro',
      'number.positive': 'Cada active_id deve ser positivo'
    })
  ).min(1).required().messages({
    'array.base': 'active_ids deve ser um array de números',
    'array.min': 'É necessário informar pelo menos um active_id',
    'any.required': 'active_ids é obrigatório'
  }),
  sizes: Joi.array().items(
    Joi.number().integer().positive().messages({
      'number.base': 'Cada size deve ser um número',
      'number.integer': 'Cada size deve ser um número inteiro',
      'number.positive': 'Cada size deve ser positivo'
    })
  ).optional().messages({
    'array.base': 'sizes deve ser um array de números'
  })
});