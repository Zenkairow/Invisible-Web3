import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const myFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    myFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp(),
        myFormat
      )
    })
  ]
});

// Helper for live telemetry calibration on Amoy
export const trackMiningDelay = async (txPromise: Promise<any>, contextMessage: string) => {
  const broadcastTime = Date.now();
  logger.info(`[TX_BROADCAST] ${contextMessage} - Awaiting mining...`);
  try {
    const tx = await txPromise;
    // tx.wait() or receipt depending on what is passed, assume tx has .wait()
    const receipt = await (tx.wait ? tx.wait() : tx);
    const miningTime = Date.now();
    const delayMs = miningTime - broadcastTime;
    logger.info(`[TX_MINED] ${contextMessage} - Confirmed in block ${receipt.blockNumber} (Delay: ${delayMs}ms)`);
    return receipt;
  } catch (error: any) {
    logger.error(`[TX_FAILED] ${contextMessage} - ${error.message}`);
    throw error;
  }
};
