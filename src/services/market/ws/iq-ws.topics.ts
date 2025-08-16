import { WSMessage } from '../../../types/iq-ws.types';

export class WSTopicBuilder {
  /**
   * Cria mensagem para obter dados de inicialização
   */
  static createInitializationRequest(requestId: string): WSMessage {
    return {
      name: 'sendMessage',
      msg: {
        name: 'get-initialization-data',
        version: '3.0',
        body: {}
      },
      request_id: requestId
    };
  }

  /**
   * Cria mensagem para obter instrumentos
   */
  static createInstrumentsRequest(type: 'crypto' | 'forex' | 'cfd', requestId: string): WSMessage {
    return {
      name: 'sendMessage',
      msg: {
        name: 'get-instruments',
        version: '4.0',
        body: { type }
      },
      request_id: requestId
    };
  }

  /**
   * Cria mensagem de heartbeat
   */
  static createHeartbeatMessage(userTime: number, userTimeRecv: number): WSMessage {
    return {
      name: 'heartbeat',
      msg: {
        userTime,
        userTimeRecv
      }
    };
  }

  /**
   * Cria mensagem de SSID
   */
  static createSSIDMessage(ssid: string): WSMessage {
    return {
      name: 'ssid',
      msg: ssid
    };
  }

  /**
   * Cria mensagem genérica
   */
  static createMessage(name: string, data: any, requestId?: string): WSMessage {
    return {
      name,
      msg: data,
      request_id: requestId
    };
  }
}