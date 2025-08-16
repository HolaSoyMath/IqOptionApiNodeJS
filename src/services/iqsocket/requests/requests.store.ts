import { RequestInfo } from '../candles/candles.types';

export class RequestsStore {
  private requests = new Map<string, RequestInfo>();

  set(requestId: string, info: RequestInfo): void {
    this.requests.set(requestId, info);
  }

  get(requestId: string): RequestInfo | undefined {
    return this.requests.get(requestId);
  }

  delete(requestId: string): boolean {
    return this.requests.delete(requestId);
  }

  clear(): void {
    this.requests.clear();
  }

  size(): number {
    return this.requests.size;
  }

  getActiveFromRequest(requestId: string): number | null {
    const request = this.get(requestId);
    return request?.active_id ?? null;
  }

  getSizeFromRequest(requestId: string): number | null {
    const request = this.get(requestId);
    return request?.size ?? request?.sizes?.[0] ?? null;
  }

  getSizesFromRequest(requestId: string): number[] | null {
    const request = this.get(requestId);
    if (request?.sizes) return request.sizes;
    if (request?.size) return [request.size];
    return null;
  }
}