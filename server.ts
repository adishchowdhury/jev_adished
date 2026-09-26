/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

import { AgentRequest } from './server/runtime/core/types.ts';
import { AgentExecutionGraph } from './server/runtime/agent/execution-graph.ts';
import { globalCancellationRegistry } from './server/runtime/core/cancellation.ts';
import { globalMetrics } from './server/runtime/core/metrics.ts';
import { globalConnectionPool } from './server/runtime/core/connection-pool.ts';
import { globalProviderRouter } from './server/runtime/providers/router.ts';
import { globalToolRegistry } from './server/runtime/tools/registry.ts';
import { globalBenchmarkSuite } from './server/runtime/benchmarks/suite.ts';
import { globalChaosEngine } from './server/runtime/chaos/engine.ts';
import { globalAuditLog } from './server/runtime/core/audit-log.ts';
import { JEV_PERFORMANCE_AUDIT } from './server/runtime/audit/report-data.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory trace history for observability UI
const recentTraces: unknown[] = [
  {
    requestId: 'req_live_baseline_1',
    traceId: 'trace_jev_ultra_optimal_01',
    userId: 'usr_perf_engineer',
    query: 'Evaluate mathematical formula with sandboxed calculator tool: 125000 * 1.085^20',
    status: 'completed',
    startTime: Date.now() - 12000,
    endTime: Date.now() - 11952,
    tokenCount: 84,
    providerUsed: 'ultra_turbo',
    connectionReused: true,
    circuitBreakerState: 'CLOSED',
    toolsUsed: ['calculator'],
    ttfbMs: 3.2,
    ttftMs: 14.8,
    latency: {
      networkIngressMs: 0.8,
      authMs: 0.2,
      routingMs: 0.6,
      queueMs: 0.1,
      contextRetrievalMs: 2.8,
      toolExecutionMs: 1.6,
      providerConnectionMs: 0.4,
      providerTtftMs: 4.8,
      internalJevOverheadMs: 6.5,
      streamProcessingMs: 36.7,
      networkEgressMs: 0.2,
      totalDurationMs: 48.2,
    },
    spans: [
      {
        id: 'span_root_optimal_01',
        name: 'agent_request: req_live_baseline_1',
        startTime: Date.now() - 12000,
        endTime: Date.now() - 11952,
        durationMs: 48.2,
        offsetMs: 0,
        depth: 0,
        status: 'completed',
        metadata: { internalOverheadMs: 6.5 },
      },
      {
        id: 'span_1',
        parentId: 'span_root_optimal_01',
        name: 'network_ingress',
        startTime: Date.now() - 12000,
        endTime: Date.now() - 12000 + 0.8,
        durationMs: 0.8,
        offsetMs: 0,
        depth: 1,
        category: 'ingress',
        slaBudgetMs: 2.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_2',
        parentId: 'span_root_optimal_01',
        name: 'routing_and_queue',
        startTime: Date.now() - 12000 + 0.8,
        endTime: Date.now() - 12000 + 1.4,
        durationMs: 0.6,
        offsetMs: 0.8,
        depth: 1,
        category: 'routing',
        slaBudgetMs: 2.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_3',
        parentId: 'span_root_optimal_01',
        name: 'concurrent_context_dag',
        startTime: Date.now() - 12000 + 1.4,
        endTime: Date.now() - 12000 + 4.2,
        durationMs: 2.8,
        offsetMs: 1.4,
        depth: 1,
        category: 'context',
        slaBudgetMs: 8.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_3a',
        parentId: 'span_3',
        name: 'context:memory_lookup',
        startTime: Date.now() - 12000 + 1.4,
        endTime: Date.now() - 12000 + 2.6,
        durationMs: 1.2,
        offsetMs: 1.4,
        depth: 2,
        category: 'context',
        slaBudgetMs: 4.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_3b',
        parentId: 'span_3',
        name: 'context:session_cache',
        startTime: Date.now() - 12000 + 1.4,
        endTime: Date.now() - 12000 + 1.8,
        durationMs: 0.4,
        offsetMs: 1.4,
        depth: 2,
        category: 'context',
        slaBudgetMs: 2.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_3c',
        parentId: 'span_3',
        name: 'context:doc_vector_index',
        startTime: Date.now() - 12000 + 1.4,
        endTime: Date.now() - 12000 + 3.0,
        durationMs: 1.6,
        offsetMs: 1.4,
        depth: 2,
        category: 'context',
        slaBudgetMs: 5.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_4',
        parentId: 'span_root_optimal_01',
        name: 'tool_execution_sandbox',
        startTime: Date.now() - 12000 + 4.2,
        endTime: Date.now() - 12000 + 5.8,
        durationMs: 1.6,
        offsetMs: 4.2,
        depth: 1,
        category: 'tool',
        slaBudgetMs: 6.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_4a',
        parentId: 'span_4',
        name: 'tool:calculator_eval',
        startTime: Date.now() - 12000 + 4.2,
        endTime: Date.now() - 12000 + 5.8,
        durationMs: 1.6,
        offsetMs: 4.2,
        depth: 2,
        category: 'tool',
        slaBudgetMs: 5.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_5',
        parentId: 'span_root_optimal_01',
        name: 'persistent_socket_pool',
        startTime: Date.now() - 12000 + 5.8,
        endTime: Date.now() - 12000 + 6.2,
        durationMs: 0.4,
        offsetMs: 5.8,
        depth: 1,
        category: 'socket',
        slaBudgetMs: 2.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_6',
        parentId: 'span_root_optimal_01',
        name: 'provider_ttft_wait',
        startTime: Date.now() - 12000 + 6.2,
        endTime: Date.now() - 12000 + 11.0,
        durationMs: 4.8,
        offsetMs: 6.2,
        depth: 2,
        category: 'provider',
        slaBudgetMs: 500.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'span_7',
        parentId: 'span_root_optimal_01',
        name: 'stream_token_pump',
        startTime: Date.now() - 12000 + 11.0,
        endTime: Date.now() - 11952,
        durationMs: 37.2,
        offsetMs: 11.0,
        depth: 1,
        category: 'stream',
        slaBudgetMs: 200.0,
        isSlaBreached: false,
        status: 'completed',
      },
    ],
  },
  {
    requestId: 'req_live_breach_sample',
    traceId: 'trace_sla_breach_spike_02',
    userId: 'usr_perf_engineer',
    query: 'Uncached cold remote database join with external vector search tool',
    status: 'completed',
    startTime: Date.now() - 60000,
    endTime: Date.now() - 59720,
    tokenCount: 62,
    providerUsed: 'gemini',
    connectionReused: true,
    circuitBreakerState: 'CLOSED',
    toolsUsed: ['vector_search'],
    ttfbMs: 28.4,
    ttftMs: 95.0,
    latency: {
      networkIngressMs: 2.4,
      authMs: 0.5,
      routingMs: 1.2,
      queueMs: 0.3,
      contextRetrievalMs: 14.5,
      toolExecutionMs: 7.2,
      providerConnectionMs: 0.6,
      providerTtftMs: 68.0,
      internalJevOverheadMs: 26.4, // Breaches 20ms internal SLA!
      streamProcessingMs: 185.0,
      networkEgressMs: 0.3,
      totalDurationMs: 280.0,
    },
    spans: [
      {
        id: 'span_root_breach_02',
        name: 'agent_request: req_live_breach_sample',
        startTime: Date.now() - 60000,
        endTime: Date.now() - 59720,
        durationMs: 280.0,
        offsetMs: 0,
        depth: 0,
        status: 'completed',
        metadata: { internalOverheadMs: 26.4, slaBreached: true },
      },
      {
        id: 'b_span_1',
        parentId: 'span_root_breach_02',
        name: 'network_ingress',
        startTime: Date.now() - 60000,
        endTime: Date.now() - 60000 + 2.4,
        durationMs: 2.4,
        offsetMs: 0,
        depth: 1,
        category: 'ingress',
        slaBudgetMs: 2.0,
        isSlaBreached: true,
        status: 'completed',
      },
      {
        id: 'b_span_2',
        parentId: 'span_root_breach_02',
        name: 'routing_and_queue',
        startTime: Date.now() - 60000 + 2.4,
        endTime: Date.now() - 60000 + 3.6,
        durationMs: 1.2,
        offsetMs: 2.4,
        depth: 1,
        category: 'routing',
        slaBudgetMs: 2.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'b_span_3',
        parentId: 'span_root_breach_02',
        name: 'concurrent_context_dag',
        startTime: Date.now() - 60000 + 3.6,
        endTime: Date.now() - 60000 + 18.1,
        durationMs: 14.5,
        offsetMs: 3.6,
        depth: 1,
        category: 'context',
        slaBudgetMs: 8.0,
        isSlaBreached: true, // EXCEEDED 8ms segment budget!
        status: 'completed',
      },
      {
        id: 'b_span_3a',
        parentId: 'b_span_3',
        name: 'context:memory_lookup',
        startTime: Date.now() - 60000 + 3.6,
        endTime: Date.now() - 60000 + 7.6,
        durationMs: 4.0,
        offsetMs: 3.6,
        depth: 2,
        category: 'context',
        slaBudgetMs: 4.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'b_span_3b',
        parentId: 'b_span_3',
        name: 'context:doc_vector_index',
        startTime: Date.now() - 60000 + 3.6,
        endTime: Date.now() - 60000 + 18.1,
        durationMs: 14.5,
        offsetMs: 3.6,
        depth: 2,
        category: 'context',
        slaBudgetMs: 5.0,
        isSlaBreached: true,
        status: 'completed',
      },
      {
        id: 'b_span_4',
        parentId: 'span_root_breach_02',
        name: 'tool_execution_sandbox',
        startTime: Date.now() - 60000 + 18.1,
        endTime: Date.now() - 60000 + 25.3,
        durationMs: 7.2,
        offsetMs: 18.1,
        depth: 1,
        category: 'tool',
        slaBudgetMs: 6.0,
        isSlaBreached: true, // Exceeded 6ms budget!
        status: 'completed',
      },
      {
        id: 'b_span_4a',
        parentId: 'b_span_4',
        name: 'tool:vector_search_cosine',
        startTime: Date.now() - 60000 + 18.1,
        endTime: Date.now() - 60000 + 25.3,
        durationMs: 7.2,
        offsetMs: 18.1,
        depth: 2,
        category: 'tool',
        slaBudgetMs: 6.0,
        isSlaBreached: true,
        status: 'completed',
      },
      {
        id: 'b_span_5',
        parentId: 'span_root_breach_02',
        name: 'persistent_socket_pool',
        startTime: Date.now() - 60000 + 25.3,
        endTime: Date.now() - 60000 + 25.9,
        durationMs: 0.6,
        offsetMs: 25.3,
        depth: 1,
        category: 'socket',
        slaBudgetMs: 2.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'b_span_6',
        parentId: 'span_root_breach_02',
        name: 'provider_ttft_wait',
        startTime: Date.now() - 60000 + 25.9,
        endTime: Date.now() - 60000 + 93.9,
        durationMs: 68.0,
        offsetMs: 25.9,
        depth: 2,
        category: 'provider',
        slaBudgetMs: 500.0,
        isSlaBreached: false,
        status: 'completed',
      },
      {
        id: 'b_span_7',
        parentId: 'span_root_breach_02',
        name: 'stream_token_pump',
        startTime: Date.now() - 60000 + 93.9,
        endTime: Date.now() - 59720,
        durationMs: 186.1,
        offsetMs: 93.9,
        depth: 1,
        category: 'stream',
        slaBudgetMs: 200.0,
        isSlaBreached: false,
        status: 'completed',
      },
    ],
  },
];

// 1. Health & Readiness Probes (K8s / Cloud Run)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'UP', timestamp: Date.now(), runtime: 'Jev Ultra' });
});

app.get('/api/ready', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'READY',
    eventLoopLagMs: globalMetrics.getSummary().eventLoopLagMs,
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
  });
});

// 2. Real-Time SSE Agent Streaming Execution
app.post('/api/agent/stream', async (req, res) => {
  const {
    query = 'Explain how Jev Ultra achieves P95 <= 20ms internal overhead.',
    provider = 'gemini',
    tools = ['calculator', 'vector_search'],
    priority = 'high',
    temperature = 0.7,
    maxTokens = 800,
  } = req.body || {};

  const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const requestId = `req_${Date.now()}`;
  const userId = 'usr_engineer_primary';

  // Register hierarchical cancellation token
  const tokenSource = globalCancellationRegistry.register(traceId);

  // Setup Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx proxy buffering
  res.flushHeaders?.();

  globalAuditLog.info('STREAM_CONNECT', `Client connected for streaming trace: ${traceId}`, {
    traceId,
    requestId,
  });

  let isFinished = false;

  // Client disconnect listener -> Propagate upstream cancellation immediately when TCP socket disconnects
  res.socket?.on('close', () => {
    if (!isFinished && !res.writableEnded) {
      globalCancellationRegistry.cancel(traceId, 'Client socket disconnected');
      globalAuditLog.warn('STREAM_CLIENT_DISCONNECT', `Client disconnected. Upstream cancellation triggered for ${traceId}`);
    }
  });

  const sendEvent = (event: string, data: unknown) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const agentRequest: AgentRequest = {
    requestId,
    traceId,
    userId,
    query,
    provider,
    tools,
    stream: true,
    priority,
    temperature,
    maxTokens,
  };

  const chaosSettings = globalChaosEngine.getSettings();

  const executionGraph = new AgentExecutionGraph(
    agentRequest,
    tokenSource.signal,
    (event) => {
      sendEvent(event.type, event);
    }
  );

  try {
    const finalTrace = await executionGraph.execute(agentRequest, chaosSettings);
    recentTraces.unshift(finalTrace);
    if (recentTraces.length > 50) {
      recentTraces.pop();
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    sendEvent('error', { error: errorMsg });
  } finally {
    isFinished = true;
    globalCancellationRegistry.remove(traceId);
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// 3. Non-Streaming Agent Run
app.post('/api/agent/run', async (req, res) => {
  const { query = 'Status check', provider = 'gemini' } = req.body || {};
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tokenSource = globalCancellationRegistry.register(traceId);

  const agentRequest: AgentRequest = {
    requestId: `req_${Date.now()}`,
    traceId,
    userId: 'usr_engineer_primary',
    query,
    provider,
    stream: false,
  };

  const graph = new AgentExecutionGraph(agentRequest, tokenSource.signal);
  try {
    const trace = await graph.execute(agentRequest, globalChaosEngine.getSettings());
    recentTraces.unshift(trace);
    res.json({ trace });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  } finally {
    globalCancellationRegistry.remove(traceId);
  }
});

// 4. Live Runtime Metrics & Prometheus JSON
app.get('/api/metrics', (_req, res) => {
  const poolStats = globalConnectionPool.getStats();
  const cancelLatency = globalCancellationRegistry.getP95CancellationLatencyMs();
  const summary = globalMetrics.getSummary(poolStats.reuseRatePercent, cancelLatency);
  res.json(summary);
});

// 5. Live SSE Telemetry Stream for HUD (every 500ms)
app.get('/api/metrics/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const interval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(interval);
      return;
    }
    const poolStats = globalConnectionPool.getStats();
    const cancelLatency = globalCancellationRegistry.getP95CancellationLatencyMs();
    const summary = globalMetrics.getSummary(poolStats.reuseRatePercent, cancelLatency);
    res.write(`data: ${JSON.stringify(summary)}\n\n`);
  }, 500);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// 6. Traces Explorer
app.get('/api/traces', (_req, res) => {
  res.json(recentTraces);
});

// 7. Comparative A/B Benchmark Endpoints
app.post('/api/benchmark/run', async (req, res) => {
  const { concurrency = 50, workload = 'Real-time A/B Simulation' } = req.body || {};
  const run = await globalBenchmarkSuite.runLiveComparativeBenchmark(Number(concurrency), String(workload));
  res.json(run);
});

app.get('/api/benchmark/history', (_req, res) => {
  res.json(globalBenchmarkSuite.getHistory());
});

// 8. Provider & Circuit Breaker Status
app.get('/api/providers', (_req, res) => {
  res.json(globalProviderRouter.listProviders());
});

app.post('/api/providers/:name/trip', (req, res) => {
  const breaker = globalProviderRouter.getCircuitBreaker(req.params.name);
  if (breaker) {
    breaker.forceOpen();
    res.json({ message: `Circuit breaker ${req.params.name} forced OPEN`, snapshot: breaker.getSnapshot() });
  } else {
    res.status(404).json({ error: 'Provider not found' });
  }
});

app.post('/api/providers/:name/reset', (req, res) => {
  const breaker = globalProviderRouter.getCircuitBreaker(req.params.name);
  if (breaker) {
    breaker.forceClose();
    res.json({ message: `Circuit breaker ${req.params.name} reset to CLOSED`, snapshot: breaker.getSnapshot() });
  } else {
    res.status(404).json({ error: 'Provider not found' });
  }
});

// 9. Tools Registry
app.get('/api/tools', (_req, res) => {
  res.json(globalToolRegistry.list().map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    timeoutMs: t.timeoutMs,
    maxConcurrency: t.maxConcurrency,
  })));
});

// 10. Chaos Engineering
app.get('/api/chaos/config', (_req, res) => {
  res.json(globalChaosEngine.getSettings());
});

app.post('/api/chaos/config', (req, res) => {
  const updated = globalChaosEngine.updateSettings(req.body);
  res.json(updated);
});

// 11. Performance Audit Report Data
app.get('/api/audit-report', (_req, res) => {
  res.json(JEV_PERFORMANCE_AUDIT);
});

// 12. Structured Audit Logs
app.get('/api/logs', (_req, res) => {
  res.json(globalAuditLog.getRecentLogs(100));
});

// Mount Vite in dev mode or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ Jev Ultra Runtime listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
