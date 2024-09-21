import winston from 'winston';

export function createLogger(logFile, console = true) {
  const transports = [];
  if (console)
    transports.push(new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    }));
  transports.push(new winston.transports.File({
    filename: logFile,
    format: winston.format.simple()
  }))
  return winston.createLogger({ level: 'debug', transports });
}
