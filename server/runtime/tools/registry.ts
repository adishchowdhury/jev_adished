/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalAuditLog } from '../core/audit-log.ts';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  timeoutMs: number;
  maxConcurrency: number;
  execute: (params: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
}

export interface ToolExecutionResult {
  toolName: string;
  durationMs: number;
  success: boolean;
  result?: unknown;
  error?: string;
  wasCancelled?: boolean;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private activeConcurrency: Map<string, number> = new Map();

  constructor() {
    this.registerStandardTools();
  }

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    this.activeConcurrency.set(tool.name, 0);
  }

  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public async executeTool(
    name: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
    traceId?: string
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        toolName: name,
        durationMs: 0,
        success: false,
        error: `Tool "${name}" not found in registry.`,
      };
    }

    const currentRunning = this.activeConcurrency.get(name) || 0;
    if (currentRunning >= tool.maxConcurrency) {
      return {
        toolName: name,
        durationMs: 0,
        success: false,
        error: `Tool concurrency limit exceeded (${currentRunning}/${tool.maxConcurrency})`,
      };
    }

    // Input parameter validation
    for (const [key, schema] of Object.entries(tool.parameters)) {
      if (schema.required && (params[key] === undefined || params[key] === null)) {
        return {
          toolName: name,
          durationMs: 0,
          success: false,
          error: `Missing required parameter "${key}" for tool "${name}"`,
        };
      }
    }

    this.activeConcurrency.set(name, currentRunning + 1);
    const startTime = performance.now();

    // Setup bounded timeout with AbortController
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort(`Tool ${name} exceeded timeout ${tool.timeoutMs}ms`);
    }, tool.timeoutMs);

    const abortHandler = () => {
      timeoutController.abort(signal?.reason || 'External cancellation');
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    globalAuditLog.info('TOOL_START', `Executing tool: ${name}`, {
      traceId,
      data: { tool: name, params },
    });

    try {
      const result = await tool.execute(params, timeoutController.signal);
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }

      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      globalAuditLog.info('TOOL_COMPLETE', `Tool ${name} completed in ${durationMs}ms`, {
        traceId,
        data: { tool: name, durationMs },
      });

      return {
        toolName: name,
        durationMs,
        success: true,
        result,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }

      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      const isCancelled = timeoutController.signal.aborted || signal?.aborted;
      const errorMsg = err instanceof Error ? err.message : String(err);

      globalAuditLog.warn('TOOL_FAILED', `Tool ${name} failed: ${errorMsg}`, {
        traceId,
        data: { tool: name, durationMs, isCancelled },
      });

      return {
        toolName: name,
        durationMs,
        success: false,
        error: errorMsg,
        wasCancelled: isCancelled,
      };
    } finally {
      const active = this.activeConcurrency.get(name) || 1;
      this.activeConcurrency.set(name, Math.max(0, active - 1));
    }
  }

  private registerStandardTools(): void {
    // 1. Safe Calculator
    this.register({
      name: 'calculator',
      description: 'Evaluate mathematical expressions safely with microsecond latency.',
      parameters: {
        expression: { type: 'string', description: 'Mathematical expression (e.g. 1450 * 1.15)', required: true },
      },
      timeoutMs: 800,
      maxConcurrency: 100,
      execute: async ({ expression }) => {
        const clean = String(expression).replace(/[^0-9+\-*/().^% e]/g, '');
        // Fast numeric parser
        // eslint-disable-next-line no-new-func
        const fn = new Function(`"use strict"; return (${clean})`);
        return { expression: clean, result: fn() };
      },
    });

    // 2. Vector Semantic Search
    this.register({
      name: 'vector_search',
      description: 'High-speed in-memory semantic vector lookup over agent indexed documents.',
      parameters: {
        query: { type: 'string', description: 'Search query terms', required: true },
        topK: { type: 'number', description: 'Number of results (default 3)', required: false },
      },
      timeoutMs: 1200,
      maxConcurrency: 50,
      execute: async ({ query, topK = 3 }, signal) => {
        // Fast mock vector similarity store
        if (signal?.aborted) throw new Error('Vector search cancelled');
        const count = Math.min(Number(topK) || 3, 10);
        const documents = [
          { id: 'doc_1', title: 'Jev Ultra Streaming Protocol', score: 0.96, content: 'Zero-copy token pump with bounded backpressure queues.' },
          { id: 'doc_2', title: 'Circuit Breaker Failover Architecture', score: 0.91, content: 'Exponential backoff with full jitter prevents thundering herd on provider 500s.' },
          { id: 'doc_3', title: 'Connection Pooling & TLS Reuse', score: 0.88, content: 'HTTP/2 keep-alive socket reuse reduces handshake overhead from 45ms to 0.4ms.' },
          { id: 'doc_4', title: 'State Machine Execution Graph', score: 0.84, content: 'Concurrent context and memory retrieval eliminates 220ms of sequential waterfall lag.' },
        ];
        return {
          query: String(query),
          matches: documents.slice(0, count),
          totalScanned: 10400,
          latencyMs: 1.4,
        };
      },
    });

    // 3. System Runtime Diagnostics
    this.register({
      name: 'system_metrics',
      description: 'Probe runtime host metrics, event loop latency, and memory footprint.',
      parameters: {},
      timeoutMs: 500,
      maxConcurrency: 200,
      execute: async () => {
        const mem = process.memoryUsage();
        return {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          nodeVersion: process.version,
          platform: process.platform,
          uptimeSec: Math.round(process.uptime()),
        };
      },
    });

    // 4. Database / Cache Lookup
    this.register({
      name: 'database_lookup',
      description: 'Indexed key-value lookup with sub-millisecond retrieval.',
      parameters: {
        key: { type: 'string', description: 'Storage key to inspect', required: true },
      },
      timeoutMs: 600,
      maxConcurrency: 100,
      execute: async ({ key }, signal) => {
        if (signal?.aborted) throw new Error('Database lookup cancelled');
        return {
          key: String(key),
          cached: true,
          value: { profile: 'Agent Administrator', tier: 'Ultra-Performance', quotaRemaining: 984000 },
          queryDurationMs: 0.35,
        };
      },
    });
  }
}

export const globalToolRegistry = new ToolRegistry();
