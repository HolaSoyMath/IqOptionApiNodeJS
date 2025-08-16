export interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface SessionData {
  userId: string;
  ssid: string;
  expiresAt: Date;
}

export interface IQOptionSession {
  ssid: string;
  cookies: Record<string, string>;
  headers: Record<string, string>;
}