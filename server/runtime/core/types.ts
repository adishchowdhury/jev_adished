/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AgentRunStatus =
  | 'created'
  | 'running'
  | 'waiting_tool'
  | 'executing_tool'
  | 'waiting_model'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface LatencyBreakdown {
  networkIngressMs: number;
  authMs: number;
  routingMs: number;
  queueMs: number;
  contextRetrievalMs: number;
  toolExecutionMs: number;
  providerConnectionMs: number;
  providerTtftMs: number;
  internalJevOverheadMs: number;
  streamProcessingMs: number;
  networkEgressMs: number;
  totalDurationMs: number;
}

export interface TraceSpan {
  id: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  offsetMs?: number;
  depth?: number;
  category?: 'ingress' | 'routing' | 'context' | 'tool' | 'socket' | 'provider' | 'stream';
  slaBudgetMs?: number;
  isSlaBreached?: boolean;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  metadata?: Record<string, unknown>;
}

export interface AgentRequest {
  requestId: string;
  traceId: string;
  userId: string;
  query: string;
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: string[];
  stream?: boolean;
  priority?: 'high' | 'normal' | 'low';
  timeoutMs?: number;
}

export interface AgentExecutionTrace {
  requestId: string;
  traceId: string;
  userId: string;
  query: string;
  status: AgentRunStatus;
  startTime: number;
  endTime?: number;
  spans: TraceSpan[];
  latency: LatencyBreakdown;
  tokenCount: number;
  ttfbMs?: number;
  ttftMs?: number;
  providerUsed: string;
  connectionReused: boolean;
  circuitBreakerState: CircuitBreakerState;
  toolsUsed: string[];
  error?: string;
  cancelledAt?: number;
}

export interface StreamChunkEvent {
  type: 'chunk' | 'state' | 'tool_call' | 'tool_result' | 'metrics' | 'error' | 'done';
  traceId: string;
  timestamp: number;
  data: unknown;
}

export interface RuntimeMetricsSummary {
  ttfbP50: number;
  ttfbP95: number;
  ttfbP99: number;
  internalOverheadP50: number;
  internalOverheadP95: number;
  internalOverheadP99: number;
  streamOverheadP95: number;
  e2eLatencyP50: number;
  e2eLatencyP95: number;
  e2eLatencyP99: number;
  activeStreams: number;
  activeRequests: number;
  totalRequestsHandled: number;
  throughputTokensPerSec: number;
  connectionReuseRate: number;
  eventLoopLagMs: number;
  memoryRssMb: number;
  memoryHeapUsedMb: number;
  memoryHeapTotalMb: number;
  gcPauseTotalMs: number;
  cancellationLatencyP95Ms: number;
  circuitBreakers: Record<string, {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    lastTripTime?: number;
  }>;
  acceptanceStatus: {
    ttfbP95Passed: boolean;
    internalTtftP95Passed: boolean;
    streamOverheadPassed: boolean;
    connectionReusePassed: boolean;
    cancellationPassed: boolean;
    eventLoopPassed: boolean;
  };
}

export interface BenchmarkResultItem {
  name: string;
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  ttfbP95Ms: number;
  internalOverheadP95Ms: number;
  throughputTokensPerSec: number;
  memoryDeltaMb: number;
  connectionReuseRate: number;
  errorRatePercent: number;
}

export interface ComparativeBenchmarkRun {
  id: string;
  timestamp: number;
  concurrency: number;
  workload: string;
  baselineJev: BenchmarkResultItem;
  jevUltra: BenchmarkResultItem;
  improvements: {
    latencyReductionP95Percent: number;
    internalOverheadReductionPercent: number;
    throughputIncreasePercent: number;
    memoryEfficiencyPercent: number;
  };
}
