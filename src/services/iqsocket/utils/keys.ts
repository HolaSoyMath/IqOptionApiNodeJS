export class KeyUtils {
  static candleKey(activeId: number, size: number): string {
    return `${activeId}:${size}`;
  }

  static subscriptionKey(activeId: number, size: number): string {
    return `${activeId}:${size}`;
  }
}