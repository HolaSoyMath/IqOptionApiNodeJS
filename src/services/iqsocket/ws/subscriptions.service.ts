import { ConnectionService } from './connection.service';
import { KeyUtils } from '../utils/keys';
import { IQSocketLogger } from '../utils/logger';

export class SubscriptionsService {
  private subscriptions = new Set<string>();
  private requestCounter = 0;

  constructor(private connectionService: ConnectionService) {}

  subscribeCandles(activeId: number, size: number): void {
    const key = KeyUtils.subscriptionKey(activeId, size);
    
    if (this.subscriptions.has(key)) {
      return; // Já subscrito
    }

    const subscribeMessage = {
      name: 'subscribeMessage',
      msg: {
        name: 'candle-generated',
        params: {
          routingFilters: {
            active_id: activeId,
            size: size
          }
        }
      },
      request_id: this.generateRequestId()
    };

    this.connectionService.send(subscribeMessage);
    this.subscriptions.add(key);
    
    IQSocketLogger.logWsMessage('SUBSCRIBE', `candle-generated ${activeId}:${size}`);
  }

  replay(): void {
    if (this.subscriptions.size === 0) {
      return;
    }

    IQSocketLogger.logWsMessage('REPLAY', `${this.subscriptions.size} subscriptions`);
    
    for (const key of this.subscriptions) {
      const [activeId, size] = key.split(':').map(Number);
      
      // Remover da lista para resubscrever
      this.subscriptions.delete(key);
      this.subscribeCandles(activeId, size);
    }
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  clear(): void {
    this.subscriptions.clear();
  }

  private generateRequestId(): string {
    return `sub_${++this.requestCounter}_${Date.now()}`;
  }

  unsubscribeCandles(activeId: number, size: number): boolean {
    const key = KeyUtils.subscriptionKey(activeId, size);
    
    if (!this.subscriptions.has(key)) {
      return false; // Não estava subscrito
    }

    const unsubscribeMessage = {
      name: 'unsubscribeMessage',
      msg: {
        name: 'candle-generated',
        params: {
          routingFilters: {
            active_id: activeId,
            size: size
          }
        }
      },
      request_id: this.generateRequestId()
    };

    this.connectionService.send(unsubscribeMessage);
    this.subscriptions.delete(key);
    
    IQSocketLogger.logWsMessage('UNSUBSCRIBE', `candle-generated ${activeId}:${size}`);
    return true;
  }

  getActiveSubscriptions(activeId: number): number[] {
    const sizes: number[] = [];
    for (const key of this.subscriptions) {
      const [subActiveId, size] = key.split(':').map(Number);
      if (subActiveId === activeId) {
        sizes.push(size);
      }
    }
    return sizes;
  }

  hasSubscription(activeId: number, size: number): boolean {
    const key = KeyUtils.subscriptionKey(activeId, size);
    return this.subscriptions.has(key);
  }
}