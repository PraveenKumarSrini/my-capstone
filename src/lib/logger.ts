import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['accessToken', 'webhookSecret', '*.accessToken', '*.webhookSecret'],
    censor: '[REDACTED]',
  },
})

export default logger
