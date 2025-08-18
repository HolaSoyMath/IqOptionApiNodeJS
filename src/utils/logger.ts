export class Logger {
  private static formatMessage(level: string, context: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
  }

  static debug(context: string, message: string, data?: any): void {
    const formattedMessage = this.formatMessage('debug', context, message);
    if (data) {
      console.debug(formattedMessage, data);
    } else {
      console.debug(formattedMessage);
    }
  }

  static info(context: string, message: string, data?: any): void {
    const formattedMessage = this.formatMessage('info', context, message);
    if (data) {
      console.info(formattedMessage, data);
    } else {
      console.info(formattedMessage);
    }
  }

  static warn(context: string, message: string, data?: any): void {
    const formattedMessage = this.formatMessage('warn', context, message);
    if (data) {
      console.warn(formattedMessage, data);
    } else {
      console.warn(formattedMessage);
    }
  }

  static error(context: string, message: string, error?: any): void {
    const formattedMessage = this.formatMessage('error', context, message);
    if (error) {
      console.error(formattedMessage, error);
    } else {
      console.error(formattedMessage);
    }
  }

  static safe(context: string, message: string, data?: any): void {
    const formattedMessage = this.formatMessage('info', context, message);
    if (data && typeof data === 'object') {
      const safeData = Array.isArray(data) 
        ? `Array(${data.length})` 
        : `Object(${Object.keys(data).length} keys)`;
      console.info(formattedMessage, safeData);
    } else {
      console.info(formattedMessage, data);
    }
  }
}

export default Logger;