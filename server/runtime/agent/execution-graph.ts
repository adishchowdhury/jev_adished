/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AgentRequest,
  AgentExecutionTrace,
  AgentRunStatus,
  LatencyBreakdown,
  StreamChunkEvent,
} from '../core/types.ts';
import { globalProviderRouter } from '../providers/router.ts';
import { globalToolRegistry } from '../tools/registry.ts';
import { globalMetrics } from '../core/metrics.ts';
import { globalAuditLog } from '../core/audit-log.ts';
import { BoundedStreamQueue } from '../core/backpressure.ts';
import { globalConnectionPool } from '../core/connection-pool.ts';

export class AgentExecutionGraph {
  private trace: AgentExecutionTrace;
  private status: AgentRunStatus = 'created';
  private latency: LatencyBreakdown;
  private signal?: AbortSignal;
  private onEvent?: (event: StreamChunkEvent) => void;
  private streamQueue: BoundedStreamQueue<string>;

  constructor(request: AgentRequest, signal?: AbortSignal, onEvent?: (event: StreamChunkEvent) => void) {
    this.signal = signal;
    this.onEvent = onEvent;
    this.streamQueue = new BoundedStreamQueue<string>({ highWatermark: 32, lowWatermark: 8 });

    this.latency = {
      networkIngressMs: 0,
      authMs: 0,
      routingMs: 0,
      queueMs: 0,
      contextRetrievalMs: 0,
      toolExecutionMs: 0,
      providerConnectionMs: 0,
      providerTtftMs: 0,
      internalJevOverheadMs: 0,
      streamProcessingMs: 0,
      networkEgressMs: 0,
      totalDurationMs: 0,
    };

    this.trace = {
      requestId: request.requestId,
      traceId: request.traceId,
      userId: request.userId,
      query: request.query,
      status: 'created',
      startTime: Date.now(),
      spans: [],
      latency: this.latency,
      tokenCount: 0,
      providerUsed: request.provider || 'gemini',
      connectionReused: true,
      circuitBreakerState: 'CLOSED',
      toolsUsed: [],
    };
  }

  private transition(newStatus: AgentRunStatus, metadata?: Record<string, unknown>): void {
    this.status = newStatus;
    this.trace.status = newStatus;
    if (this.onEvent) {
      this.onEvent({
        type: 'state',
        traceId: this.trace.traceId,
        timestamp: Date.now(),
        data: { status: newStatus, metadata },
      });
    }
  }

  private recordSpan(
    name: string,
    durationMs: number,
    offsetMs: number,
    depth: number = 1,
    category?: 'ingress' | 'routing' | 'context' | 'tool' | 'socket' | 'provider' | 'stream',
    slaBudgetMs?: number,
    parentId?: string,
    metadata?: Record<string, unknown>
  ): void {
    const isSlaBreached = slaBudgetMs !== undefined && durationMs > slaBudgetMs;
    this.trace.spans.push({
      id: `span_${this.trace.spans.length + 1}`,
      parentId,
      name,
      startTime: this.trace.startTime + offsetMs,
      endTime: this.trace.startTime + offsetMs + durationMs,
      durationMs,
      offsetMs,
      depth,
      category,
      slaBudgetMs,
      isSlaBreached,
      status: 'completed',
      metadata,
    });
  }

  public async execute(
    request: AgentRequest,
    chaosSettings?: { simulateLatencyMs?: number; simulateFailure?: boolean; slowClientMs?: number }
  ): Promise<AgentExecutionTrace> {
    const overallStartTime = performance.now();
    globalMetrics.recordStreamStart();

    const rootSpanId = `span_root_${request.requestId}`;

    try {
      this.transition('running');

      // Stage 1: Network Ingress & Parsing
      const ingressStart = performance.now();
      await this.stepIngressAndAuth();
      this.latency.networkIngressMs = Math.round((performance.now() - ingressStart) * 100) / 100;
      const ingressOffset = Math.round((ingressStart - overallStartTime) * 100) / 100;
      this.recordSpan('network_ingress', this.latency.networkIngressMs, ingressOffset, 1, 'ingress', 2.0, rootSpanId);

      // Stage 2: Routing & Admission Queue
      const routingStart = performance.now();
      await this.stepRoutingAndQueue(request);
      this.latency.routingMs = Math.round((performance.now() - routingStart) * 100) / 100;
      const routingOffset = Math.round((routingStart - overallStartTime) * 100) / 100;
      this.recordSpan('routing_and_queue', this.latency.routingMs, routingOffset, 1, 'routing', 2.0, rootSpanId);

      // Stage 3: Concurrent Context Retrieval (Memory + Doc Index + User State parallel execution)
      const contextStart = performance.now();
      const contextOffset = Math.round((contextStart - overallStartTime) * 100) / 100;
      const contextData = await this.stepConcurrentContextRetrieval(request, contextOffset, rootSpanId);
      this.latency.contextRetrievalMs = Math.round((performance.now() - contextStart) * 100) / 100;
      this.recordSpan('concurrent_context_dag', this.latency.contextRetrievalMs, contextOffset, 1, 'context', 8.0, rootSpanId, { contextKeys: Object.keys(contextData) });

      // Stage 4: Planner & Tool Execution
      const toolStart = performance.now();
      const toolOffset = Math.round((toolStart - overallStartTime) * 100) / 100;
      const toolResults = await this.stepToolExecution(request, toolOffset, rootSpanId);
      this.latency.toolExecutionMs = Math.round((performance.now() - toolStart) * 100) / 100;
      this.recordSpan('tool_execution_sandbox', this.latency.toolExecutionMs, toolOffset, 1, 'tool', 6.0, rootSpanId, { toolsExecuted: this.trace.toolsUsed });

      // Stage 5: Provider Connection & TTFT Measurement
      const connStart = performance.now();
      const connOffset = Math.round((connStart - overallStartTime) * 100) / 100;
      this.transition('waiting_model');
      // Simulate persistent socket pool acquisition (0.3ms vs 45ms cold TLS)
      await new Promise((r) => setTimeout(r, 0.4));
      globalConnectionPool.recordRequest(true, 0.4);
      this.latency.providerConnectionMs = Math.round((performance.now() - connStart) * 100) / 100;
      this.trace.connectionReused = true;
      this.recordSpan('persistent_socket_pool', this.latency.providerConnectionMs, connOffset, 1, 'socket', 2.0, rootSpanId, { socketReused: true });

      // Stage 6: LLM Streaming with Backpressure & Cancellation
      this.transition('streaming');
      const streamStart = performance.now();
      const streamOffset = Math.round((streamStart - overallStartTime) * 100) / 100;
      let firstTokenReceived = false;

      // Construct augmented prompt
      const augmentedPrompt = `[Context: ${JSON.stringify(contextData)}]\n[Tool Outputs: ${JSON.stringify(toolResults)}]\nQuery: ${request.query}`;

      const streamGen = globalProviderRouter.streamInference(
        request.provider || 'gemini',
        {
          prompt: augmentedPrompt,
          traceId: request.traceId,
          signal: this.signal,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        },
        chaosSettings
      );

      for await (const chunk of streamGen) {
        if (this.signal?.aborted) {
          throw new Error(`Execution aborted: ${this.signal.reason}`);
        }

        if (!firstTokenReceived) {
          firstTokenReceived = true;
          const ttft = Math.round(performance.now() - overallStartTime);
          this.trace.ttftMs = ttft;
          this.latency.providerTtftMs = Math.round(performance.now() - connStart);

          // Internal Jev Overhead = Time before provider response starts minus the provider's own connect/queue time
          this.latency.internalJevOverheadMs = Math.round(
            this.latency.networkIngressMs +
            this.latency.authMs +
            this.latency.routingMs +
            this.latency.contextRetrievalMs +
            this.latency.toolExecutionMs +
            this.latency.providerConnectionMs
          );

          this.recordSpan('provider_ttft_wait', this.latency.providerTtftMs, connOffset, 2, 'provider', 500.0, rootSpanId);

          globalMetrics.recordTtfb(this.latency.networkIngressMs + this.latency.routingMs + 2);
          globalMetrics.recordInternalOverhead(this.latency.internalJevOverheadMs);
        }

        this.trace.tokenCount += Math.max(1, Math.round(chunk.text.length / 4));

        // Push to bounded stream queue (respecting backpressure)
        await this.streamQueue.push(chunk.text, chunk.text.length);

        // Emit to SSE consumer
        if (this.onEvent) {
          this.onEvent({
            type: 'chunk',
            traceId: this.trace.traceId,
            timestamp: Date.now(),
            data: { text: chunk.text, tokenCount: this.trace.tokenCount },
          });
        }

        // Handle simulated slow client backpressure testing
        if (chaosSettings?.slowClientMs && chaosSettings.slowClientMs > 0) {
          await new Promise((r) => setTimeout(r, chaosSettings.slowClientMs));
        }

        this.streamQueue.shift();
      }

      this.latency.streamProcessingMs = Math.round((performance.now() - streamStart) * 100) / 100;
      this.latency.totalDurationMs = Math.round((performance.now() - overallStartTime) * 100) / 100;
      this.trace.endTime = Date.now();

      this.recordSpan('stream_token_pump', this.latency.streamProcessingMs, streamOffset, 1, 'stream', 200.0, rootSpanId, { tokensStreamed: this.trace.tokenCount });

      // Insert root span at top of spans list
      this.trace.spans.unshift({
        id: rootSpanId,
        name: `agent_request: ${request.requestId}`,
        startTime: this.trace.startTime,
        endTime: this.trace.endTime,
        durationMs: this.latency.totalDurationMs,
        offsetMs: 0,
        depth: 0,
        status: 'completed',
        metadata: {
          query: request.query,
          provider: request.provider,
          internalOverheadMs: this.latency.internalJevOverheadMs,
        },
      });

      globalMetrics.recordStreamOverhead(Math.round((this.latency.streamProcessingMs / Math.max(1, this.trace.tokenCount)) * 10) / 10);
      globalMetrics.recordE2ELatency(this.latency.totalDurationMs);
      globalMetrics.recordStreamEnd(this.trace.tokenCount);

      this.transition('completed');
      if (this.onEvent) {
        this.onEvent({
          type: 'done',
          traceId: this.trace.traceId,
          timestamp: Date.now(),
          data: { trace: this.trace },
        });
      }

      return this.trace;
    } catch (err: unknown) {
      this.trace.endTime = Date.now();
      this.latency.totalDurationMs = Math.round((performance.now() - overallStartTime) * 100) / 100;
      globalMetrics.recordStreamEnd(this.trace.tokenCount);

      if (this.signal?.aborted) {
        this.transition('cancelled', { reason: this.signal.reason });
        this.trace.cancelledAt = Date.now();
        this.trace.error = `Cancelled: ${this.signal.reason}`;
        globalAuditLog.warn('AGENT_CANCELLED', `Trace ${request.traceId} cancelled: ${this.signal.reason}`);
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.transition('failed', { error: errorMsg });
        this.trace.error = errorMsg;
        globalAuditLog.error('AGENT_FAILED', `Trace ${request.traceId} failed: ${errorMsg}`);
      }

      if (this.onEvent) {
        this.onEvent({
          type: 'error',
          traceId: this.trace.traceId,
          timestamp: Date.now(),
          data: { error: this.trace.error, isCancelled: this.signal?.aborted },
        });
      }

      return this.trace;
    }
  }

  private async stepIngressAndAuth(): Promise<void> {
    if (this.signal?.aborted) throw new Error('Aborted at ingress');
    // Microsecond token verification / authorization check
    await new Promise((r) => setTimeout(r, 0.2));
  }

  private async stepRoutingAndQueue(request: AgentRequest): Promise<void> {
    if (this.signal?.aborted) throw new Error('Aborted at routing');
    // Check provider circuit breaker
    const breaker = globalProviderRouter.getCircuitBreaker(request.provider || 'gemini');
    this.trace.circuitBreakerState = breaker ? breaker.getState() : 'CLOSED';
    await new Promise((r) => setTimeout(r, 0.3));
  }

  private async stepConcurrentContextRetrieval(request: AgentRequest, baseOffset: number = 0, parentId?: string): Promise<Record<string, unknown>> {
    if (this.signal?.aborted) throw new Error('Aborted at context retrieval');

    // Parallel Execution of Independent Operations (Memory, Cache, Docs)
    const [memoryResult, sessionResult, docResult] = await Promise.all([
      // 1. Semantic Memory
      (async () => {
        const start = performance.now();
        await new Promise((r) => setTimeout(r, 1.2));
        const dur = Math.round((performance.now() - start) * 100) / 100;
        this.recordSpan('context:memory_lookup', dur, baseOffset, 2, 'context', 4.0, parentId, { hits: 2 });
        return { userHistoryMatches: 2, affinityScore: 0.94 };
      })(),
      // 2. User Session Cache
      (async () => {
        const start = performance.now();
        await new Promise((r) => setTimeout(r, 0.4));
        const dur = Math.round((performance.now() - start) * 100) / 100;
        this.recordSpan('context:session_cache', dur, baseOffset, 2, 'context', 2.0, parentId, { tier: 'pro' });
        return { tier: 'pro', tokenBudget: 200000 };
      })(),
      // 3. Document Index Pre-fetch
      (async () => {
        const start = performance.now();
        await new Promise((r) => setTimeout(r, 1.6));
        const dur = Math.round((performance.now() - start) * 100) / 100;
        this.recordSpan('context:doc_vector_index', dur, baseOffset, 2, 'context', 5.0, parentId, { chunks: 48 });
        return { indexedChunksCount: 48 };
      })(),
    ]);

    return {
      memory: memoryResult,
      session: sessionResult,
      docs: docResult,
      query: request.query,
    };
  }

  private async stepToolExecution(request: AgentRequest, baseOffset: number = 0, parentId?: string): Promise<Record<string, unknown>> {
    if (this.signal?.aborted) throw new Error('Aborted before tool execution');

    const results: Record<string, unknown> = {};
    const queryLower = request.query.toLowerCase();

    // Check if tools should be invoked
    if (queryLower.includes('calculate') || queryLower.includes('math') || /\d+[\+\-\*\/]\d+/.test(queryLower)) {
      this.transition('waiting_tool');
      this.transition('executing_tool', { tool: 'calculator' });
      this.trace.toolsUsed.push('calculator');

      // Extract expression
      const match = queryLower.match(/[0-9+\-*/().^% e]+/);
      const expr = match ? match[0].trim() : '42 * 12';
      const calcResult = await globalToolRegistry.executeTool('calculator', { expression: expr }, this.signal, this.trace.traceId);
      results['calculator'] = calcResult;
      this.recordSpan('tool:calculator_eval', calcResult.durationMs, baseOffset, 2, 'tool', 5.0, parentId, { expression: expr, success: calcResult.success });
    }

    if (queryLower.includes('search') || queryLower.includes('vector') || queryLower.includes('document')) {
      this.transition('waiting_tool');
      this.transition('executing_tool', { tool: 'vector_search' });
      this.trace.toolsUsed.push('vector_search');

      const searchResult = await globalToolRegistry.executeTool('vector_search', { query: request.query }, this.signal, this.trace.traceId);
      results['vector_search'] = searchResult;
      this.recordSpan('tool:vector_search_cosine', searchResult.durationMs, baseOffset, 2, 'tool', 8.0, parentId, { query: request.query, success: searchResult.success });
    }

    return results;
  }
}
