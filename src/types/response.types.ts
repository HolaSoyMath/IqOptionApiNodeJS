export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    ssid: string;
    user: {
      id: string;
      email: string;
    };
  };
  timestamp: string;
}

export interface IQOptionLoginResponse {
  isSuccessful: boolean;
  message: string;
  result?: {
    ssid: string;
    user_id: number;
    email: string;
    balance?: number;
  };
}

export interface TwoFactorResponse {
  token: string;
  requiresSMS: boolean;
}

export interface WebSocketMessage {
  name: string;
  msg: any;
  request_id?: string;
  version?: string;
}