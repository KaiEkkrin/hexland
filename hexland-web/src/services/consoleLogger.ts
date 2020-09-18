import { ILogger } from './interfaces';

// Provides a console logger.
class ConsoleLogger implements ILogger {
  logError(message: string, ...optionalParams: any[]) {
    console.error(message, ...optionalParams);
  }

  logInfo(message: string, ...optionalParams: any[]) {
    console.info(message, ...optionalParams);
  }

  logWarning(message: string, ...optionalParams: any[]) {
    console.warn(message, ...optionalParams);
  }
}

const consoleLogger = new ConsoleLogger();
export default consoleLogger;