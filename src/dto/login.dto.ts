import Joi from 'joi';

export interface LoginDto {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface TwoFactorDto {
  token: string;
  code: string;
}

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email deve ter um formato válido',
    'any.required': 'Email é obrigatório'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Senha deve ter pelo menos 6 caracteres',
    'any.required': 'Senha é obrigatória'
  }),
  twoFactorCode: Joi.string().length(6).optional().messages({
    'string.length': 'Código 2FA deve ter exatamente 6 dígitos'
  })
});

export const twoFactorSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Token é obrigatório'
  }),
  code: Joi.string().length(6).required().messages({
    'string.length': 'Código deve ter exatamente 6 dígitos',
    'any.required': 'Código é obrigatório'
  })
});