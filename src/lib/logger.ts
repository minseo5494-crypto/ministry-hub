/**
 * 개발 환경에서만 로그를 출력하는 유틸리티
 * 프로덕션에서는 자동으로 비활성화됨
 */

const isDev = process.env.NODE_ENV === 'development'

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

interface LoggerOptions {
  prefix?: string
  showTimestamp?: boolean
}

class Logger {
  private prefix: string
  private showTimestamp: boolean

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || ''
    this.showTimestamp = options.showTimestamp || false
  }

  private formatMessage(level: LogLevel, ...args: unknown[]): unknown[] {
    const parts: unknown[] = []

    if (this.showTimestamp) {
      parts.push(`[${new Date().toISOString()}]`)
    }

    if (this.prefix) {
      parts.push(`[${this.prefix}]`)
    }

    return [...parts, ...args]
  }

  log(...args: unknown[]): void {
    if (isDev) {
      console.log(...this.formatMessage('log', ...args))
    }
  }

  info(...args: unknown[]): void {
    if (isDev) {
      console.info(...this.formatMessage('info', ...args))
    }
  }

  warn(...args: unknown[]): void {
    if (isDev) {
      console.warn(...this.formatMessage('warn', ...args))
    }
  }

  error(...args: unknown[]): void {
    // 에러는 프로덕션에서도 출력
    console.error(...this.formatMessage('error', ...args))
  }

  debug(...args: unknown[]): void {
    if (isDev) {
      console.debug(...this.formatMessage('debug', ...args))
    }
  }

  // 그룹 로깅
  group(label: string): void {
    if (isDev) {
      console.group(this.prefix ? `[${this.prefix}] ${label}` : label)
    }
  }

  groupEnd(): void {
    if (isDev) {
      console.groupEnd()
    }
  }

  // 테이블 로깅
  table(data: unknown): void {
    if (isDev) {
      console.table(data)
    }
  }

  // 시간 측정
  time(label: string): void {
    if (isDev) {
      console.time(this.prefix ? `[${this.prefix}] ${label}` : label)
    }
  }

  timeEnd(label: string): void {
    if (isDev) {
      console.timeEnd(this.prefix ? `[${this.prefix}] ${label}` : label)
    }
  }
}

// 기본 로거 인스턴스
export const logger = new Logger()

// 모듈별 로거 생성 함수
export function createLogger(prefix: string, options?: Omit<LoggerOptions, 'prefix'>): Logger {
  return new Logger({ prefix, ...options })
}

export default Logger
