export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Credenciais inválidas') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso não encontrado') {
    super(message, 404);
  }
}

export class IQOptionError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(`IQ Option Error: ${message}`, statusCode);
  }
}

export class TwoFactorRequiredError extends AppError {
  public readonly token: string;

  constructor(token: string, message: string = 'Autenticação 2FA necessária') {
    super(message, 202);
    this.token = token;
  }
}