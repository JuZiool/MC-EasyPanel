import winston from 'winston'

// 全局覆写 console 方法，为所有控制台输出添加 [HH:mm:ss] 时间戳
const pad2 = (n: number) => n.toString().padStart(2, '0')
const timestamp = () => {
  const now = new Date()
  return `[${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}]`
}

const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn
const originalInfo = console.info

console.log = (...args: any[]) => originalLog(timestamp(), ...args)
console.error = (...args: any[]) => originalError(timestamp(), ...args)
console.warn = (...args: any[]) => originalWarn(timestamp(), ...args)
console.info = (...args: any[]) => originalInfo(timestamp(), ...args)

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [new winston.transports.Console()]
})

export default logger
