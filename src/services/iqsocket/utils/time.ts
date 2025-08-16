export class TimeUtils {
  static formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString();
  }

  static getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  static isNewMinute(currentFrom: number, newFrom: number): boolean {
    return newFrom > currentFrom;
  }
}