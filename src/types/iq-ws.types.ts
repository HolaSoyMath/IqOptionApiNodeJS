export interface WSMessage {
  name: string;
  msg: any;
  request_id?: string;
}

export interface WSResponse {
  name: string;
  msg?: any;
  data?: any;
  request_id?: string;
}

export interface PendingRequest {
  resolve: Function;
  reject: Function;
  timeout: NodeJS.Timeout;
}

export interface HeartbeatData {
  userTime: number;
  userTimeRecv: number;
}

export interface WSConnectionConfig {
  url: string;
  connectionTimeout: number;
  authTimeout: number;
  heartbeatInterval: number;
  maxReconnectAttempts: number;
}

export type WSConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'error';

export interface WSEventHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (message: WSResponse) => void;
  onAuthenticated?: () => void;
}