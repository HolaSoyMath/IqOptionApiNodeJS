import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto, TwoFactorDto } from '../dto/login.dto';
import { ApiResponse, LoginResponse } from '../types/response.types';
import { TwoFactorRequiredError } from '../errors/custom-errors';

export class AuthController {
  constructor(private authService: AuthService) {}

  async login(req: Request, res: Response): Promise<void> {
    try {
      const loginData: LoginDto = req.body;
      const result: LoginResponse = await this.authService.login(loginData);
      
      const response: ApiResponse<LoginResponse> = {
        success: true,
        message: 'Login realizado com sucesso',
        data: result,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof TwoFactorRequiredError) {
        const response: ApiResponse<{ token: string }> = {
          success: false,
          message: error.message,
          data: { token: error.token },
          timestamp: new Date().toISOString()
        };
        
        res.status(202).json(response);
        return;
      }
      
      throw error;
    }
  }

  async loginTwoFactor(req: Request, res: Response): Promise<void> {
    const twoFactorData: TwoFactorDto = req.body;
    const result: LoginResponse = await this.authService.loginWithTwoFactor(twoFactorData);
    
    const response: ApiResponse<LoginResponse> = {
      success: true,
      message: 'Login 2FA realizado com sucesso',
      data: result,
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(response);
  }

  async validateSession(req: Request, res: Response): Promise<void> {
    const { ssid } = req.params;
    const isValid = await this.authService.validateSession(ssid);
    
    const response: ApiResponse<{ isValid: boolean }> = {
      success: true,
      message: isValid ? 'Sessão válida' : 'Sessão inválida',
      data: { isValid },
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(response);
  }

  async logout(req: Request, res: Response): Promise<void> {
    const { ssid } = req.body;
    await this.authService.logout(ssid);
    
    const response: ApiResponse = {
      success: true,
      message: 'Logout realizado com sucesso',
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(response);
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    const response: ApiResponse<{ status: string; version: string }> = {
      success: true,
      message: 'API funcionando corretamente',
      data: {
        status: 'online',
        version: '1.0.0'
      },
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(response);
  }
}