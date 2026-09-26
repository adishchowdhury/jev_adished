/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  traceId?: string;
  requestId?: string;
  event: string;
  message: string;
  data?: Record<string, unknown>;
  redactionApplied?: boolean;
}

export class RedactingLogger {
  private static SECRET_PATTERNS = [
    /AIza[0-9A-Za-z-_]{35}/g,                     // Google API keys
    /sk-[a-zA-Z0-9]{32,}/g,                      // OpenAI-style secret keys
    /Bearer\s+([a-zA-Z0-9_\-\.]+)/gi,             // Bearer tokens
    /(password|secret|apiKey|api_key|token)["']?\s*[:=]\s*["']?([^"',\s]+)/gi, // JSON/form fields
  ];

  private logs: StructuredLogEntry[] = [];
  private readonly maxStoredLogs: number = 500;

  public redact(text: string): { redactedText: string; hadSecret: boolean } {
    let hadSecret = false;
    let result = text;

    for (const pattern of RedactingLogger.SECRET_PATTERNS) {
      if (pattern.test(result)) {
        hadSecret = true;
        result = result.replace(pattern, (match, p1, p2) => {
          if (p2) return `${p1}: "[REDACTED_SECRET]"`;
          return '[REDACTED_SECRET]';
        });
      }
    }

    return { redactedText: result, hadSecret };
  }

  public sanitizeData(data: Record<string, unknown>): { sanitized: Record<string, unknown>; hadSecret: boolean } {
    let hadSecret = false;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('key') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('authorization')
      ) {
        sanitized[key] = '[REDACTED_SECRET]';
        hadSecret = true;
      } else if (typeof value === 'string') {
        const res = this.redact(value);
        sanitized[key] = res.redactedText;
        if (res.hadSecret) hadSecret = true;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const sub = this.sanitizeData(value as Record<string, unknown>);
        sanitized[key] = sub.sanitized;
        if (sub.hadSecret) hadSecret = true;
      } else {
        sanitized[key] = value;
      }
    }

    return { sanitized, hadSecret };
  }

  public log(level: LogLevel, event: string, message: string, meta?: { traceId?: string; requestId?: string; data?: Record<string, unknown> }): StructuredLogEntry {
    const { redactedText, hadSecret: msgHadSecret } = this.redact(message);
    let dataSanitized: Record<string, unknown> | undefined;
    let dataHadSecret = false;

    if (meta?.data) {
      const dataRes = this.sanitizeData(meta.data);
      dataSanitized = dataRes.sanitized;
      dataHadSecret = dataRes.hadSecret;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      traceId: meta?.traceId,
      requestId: meta?.requestId,
      event,
      message: redactedText,
      data: dataSanitized,
      redactionApplied: msgHadSecret || dataHadSecret,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxStoredLogs) {
      this.logs.pop();
    }

    return entry;
  }

  public info(event: string, message: string, meta?: { traceId?: string; requestId?: string; data?: Record<string, unknown> }): void {
    this.log('INFO', event, message, meta);
  }

  public warn(event: string, message: string, meta?: { traceId?: string; requestId?: string; data?: Record<string, unknown> }): void {
    this.log('WARN', event, message, meta);
  }

  public error(event: string, message: string, meta?: { traceId?: string; requestId?: string; data?: Record<string, unknown> }): void {
    this.log('ERROR', event, message, meta);
  }

  public getRecentLogs(limit: number = 50): StructuredLogEntry[] {
    return this.logs.slice(0, limit);
  }

  public clear(): void {
    this.logs = [];
  }
}

export const globalAuditLog = new RedactingLogger();
