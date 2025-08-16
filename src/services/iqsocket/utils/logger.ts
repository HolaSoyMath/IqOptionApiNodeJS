export class IQSocketLogger {
  private static formatOHLC(o: number, h: number, l: number, c: number): string {
    return `O=${o.toFixed(5)} H=${h.toFixed(5)} L=${l.toFixed(5)} C=${c.toFixed(5)}`;
  }

  private static formatTimeRange(fromSec: number, toSec: number): string {
    const fromMs = fromSec * 1000;
    const toMs = toSec * 1000;
    
    // Use timezone local do servidor; se quiser fixar: timeZone: 'America/Sao_Paulo'
    const fmt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const fromStr = new Date(fromMs).toLocaleTimeString('pt-BR', fmt);
    const toStr = new Date(toMs).toLocaleTimeString('pt-BR', fmt);
    return `from: ${fromStr} (${fromSec}) to: ${toStr} (${toSec})`;
  }

  private static candleKey(activeId: number, size: number, fromSec: number): string {
    // formato legível e único
    return `${activeId}:${size}:${fromSec}`;
  }

  static logSeed(size: number, id: number | string | undefined, activeId: number, from: number, to: number, o: number, h: number, l: number, c: number): void {
    const cid = (id ?? this.candleKey(activeId, size, from));
    console.log(`[SEED ${size}s] Candle ID: ${cid} Market ID: ${activeId} | ${this.formatTimeRange(from, to)} | ${this.formatOHLC(o, h, l, c)}`);
  }

  static logLive(size: number, id: number | string | undefined, activeId: number, from: number, to: number, o: number, h: number, l: number, c: number, phase: string, delta?: string): void {
    const cid = (id ?? this.candleKey(activeId, size, from));
    const deltaStr = delta ? ` | Δ=${delta}` : '';
    console.log(`[LIVE ${size}s] Candle ID: ${cid} Market ID: ${activeId} | ${this.formatTimeRange(from, to)} | ${this.formatOHLC(o, h, l, c)} | phase=${phase}${deltaStr}`);
  }

  static logClose(size: number, id: number | string | undefined, activeId: number, from: number, to: number, o: number, h: number, l: number, c: number): void {
    const cid = (id ?? this.candleKey(activeId, size, from));
    console.log(`[CLOSE ${size}s] Candle ID: ${cid} Market ID: ${activeId} | ${this.formatTimeRange(from, to)} | ${this.formatOHLC(o, h, l, c)} | phase=closed`);
  }

  static logRoll(id: number | string, activeId: number, size: number, from: number): void {
    console.log(`[ROLL] Novo candle ${id} Market ID: ${activeId}:${size} from=${from}`);
  }

  static logWsMessage(name: string, details?: string): void {
    console.log(`[WS RX] ${name}${details ? ` ${details}` : ''}`);
  }

  static logConnection(message: string): void {
    console.log(`[WS] ${message}`);
  }

  static logAuth(message: string): void {
    console.log(`[AUTH] ${message}`);
  }

  static logError(context: string, error: any): void {
    console.error(`[ERROR ${context}]`, error);
  }

  static logTimeSync(timestamp: number): void {
    const date = new Date(timestamp);
    console.log(`[TIME SYNC] Server time: ${timestamp} (${date.toISOString()})`);
  }
}