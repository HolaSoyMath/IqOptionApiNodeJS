import axios, { AxiosResponse } from 'axios';
import { UserModel } from '../models/user.model';
import { LoginDto, TwoFactorDto } from '../dto/login.dto';
import { 
  LoginResponse, 
  IQOptionLoginResponse, 
  TwoFactorResponse 
} from '../types/response.types';
import { 
  AuthenticationError, 
  IQOptionError, 
  TwoFactorRequiredError 
} from '../errors/custom-errors';
import { config } from '../config/app.config';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';

export class AuthService {
  constructor(private userModel: UserModel) {}

  async login(loginData: LoginDto): Promise<LoginResponse> {
    const { email, password, twoFactorCode } = loginData;

    try {
      // Fazer login direto na IQ Option
      const iqOptionResult = await this.loginToIQOption(email, password, twoFactorCode);
      
      if (!iqOptionResult.isSuccessful) {
        throw new AuthenticationError(iqOptionResult.message || 'Falha no login');
      }

      if (!iqOptionResult.result) {
        throw new IQOptionError('Resposta inválida da IQ Option');
      }

      // Verificar se o usuário existe no banco local
      let user = await this.userModel.findByEmail(email);
      
      if (!user) {
        // Se não existe, criar um novo usuário
        user = await this.userModel.create(email, password);
      }

      // Atualizar SSID do usuário
      await this.userModel.updateSsid(user.id, iqOptionResult.result.ssid);

      return {
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          ssid: iqOptionResult.result.ssid,
          user: {
            id: user.id,
            email: user.email
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof TwoFactorRequiredError) {
        throw error;
      }
      throw error;
    }
  }

  async loginWithTwoFactor(twoFactorData: TwoFactorDto): Promise<LoginResponse> {
    // Recuperar dados do token temporário
    const tokenData = this.getTwoFactorTokenData(twoFactorData.token);
    
    if (!tokenData) {
      throw new AuthenticationError('Token 2FA inválido ou expirado');
    }

    // Fazer login com código 2FA
    return this.login({
      email: tokenData.email,
      password: tokenData.password,
      twoFactorCode: twoFactorData.code
    });
  }

  private async loginToIQOption(
    email: string, 
    password: string, 
    twoFactorCode?: string
  ): Promise<IQOptionLoginResponse> {
    try {
      // Preparar dados para a requisição
      const loginData: any = {
        identifier: email,
        password: password
      };

      // Adicionar token 2FA se fornecido
      if (twoFactorCode) {
        loginData.token = twoFactorCode;
      }

      // Fazer requisição para a API da IQ Option
      const response: AxiosResponse = await axios.post(
        'https://auth.iqoption.com/api/v2/login',
        loginData,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://iqoption.com',
            'Referer': 'https://iqoption.com/'
          },
          timeout: 15000,
          validateStatus: (status) => status < 500 // Aceitar códigos de erro do cliente
        }
      );

      // Verificar se a resposta indica sucesso
      if (response.status === 200 && response.data) {
        // Verificar se precisa de 2FA
        if (response.data.code === 'two_factor_required' || response.data.message === 'two_factor_required') {
          const token = uuidv4();
          this.storeTwoFactorToken(token, email, password);
          throw new TwoFactorRequiredError(token);
        }

        // Login bem-sucedido
        if (response.data.ssid || response.data.session) {
          return {
            isSuccessful: true,
            message: 'Login realizado com sucesso',
            result: {
              ssid: response.data.ssid || response.data.session,
              user_id: response.data.user_id,
              email: email
            }
          };
        }
      }

      // Tratar erros específicos
      if (response.status === 400 || response.status === 401) {
        return {
          isSuccessful: false,
          message: response.data?.message || 'Credenciais inválidas'
        };
      }

      // Erro genérico
      return {
        isSuccessful: false,
        message: 'Erro no login'
      };

    } catch (error: any) {
      if (error instanceof TwoFactorRequiredError) {
        throw error;
      }
      
      Logger.error('AUTH', 'Erro ao fazer login na IQ Option', error);
      
      // Tratar erros de rede
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new IQOptionError('Erro de conexão com a IQ Option');
      }
      
      // Tratar respostas de erro HTTP
      if (error.response) {
        const status = error.response.status;
        
        if (status === 401 || status === 403) {
          return {
            isSuccessful: false,
            message: 'Credenciais inválidas'
          };
        }
      }
      
      throw new IQOptionError('Erro de comunicação com a IQ Option');
    }
  }

  // Métodos auxiliares para gerenciar tokens 2FA temporários
  private twoFactorTokens = new Map<string, { email: string; password: string; timestamp: number }>();

  private storeTwoFactorToken(token: string, email: string, password: string): void {
    this.twoFactorTokens.set(token, {
      email,
      password,
      timestamp: Date.now()
    });

    // Limpar token após 5 minutos
    setTimeout(() => {
      this.twoFactorTokens.delete(token);
    }, 5 * 60 * 1000);
  }

  private getTwoFactorTokenData(token: string): { email: string; password: string } | null {
    const data = this.twoFactorTokens.get(token);
    
    if (!data) {
      return null;
    }

    // Verificar se o token não expirou (5 minutos)
    if (Date.now() - data.timestamp > 5 * 60 * 1000) {
      this.twoFactorTokens.delete(token);
      return null;
    }

    return {
      email: data.email,
      password: data.password
    };
  }

  async validateSession(ssid: string): Promise<boolean> {
    const session = await this.userModel.findActiveSession(ssid);
    return !!session;
  }

  async logout(ssid: string): Promise<void> {
    await this.userModel.deactivateSession(ssid);
  }
}