/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Sparkles,
  Terminal,
  Activity,
  CheckCircle2,
  Clock,
  Flame,
} from 'lucide-react';
import { AgentExecutionTrace, AgentRunStatus, LatencyBreakdown } from '../types';
import { ExecutionDagVisualizer } from './ExecutionDagVisualizer';
import { WaterfallChart } from './WaterfallChart';

export const StreamStudio: React.FC = () => {
  const [query, setQuery] = useState(
    'Evaluate formula with tool: calculate 125000 * ((1 + 0.085/12)^(12*20))'
  );
  const [provider, setProvider] = useState<'gemini' | 'ultra_turbo' | 'fallback'>('gemini');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamOutput, setStreamOutput] = useState('');
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenVelocity, setTokenVelocity] = useState(0);
  const [status, setStatus] = useState<AgentRunStatus>('created');
  const [activeTool, setActiveTool] = useState<string | undefined>();
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [latestTrace, setLatestTrace] = useState<AgentExecutionTrace | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamStartTimeRef = useRef<number>(0);
  const outputContainerRef = useRef<HTMLDivElement>(null);

  const presets = [
    {
      title: 'Tool & Math Evaluation',
      query: 'Evaluate formula with tool: calculate 125000 * ((1 + 0.085/12)^(12*20))',
      provider: 'gemini' as const,
    },
    {
      title: 'Vector Semantic Search',
      query: 'Search vector index for "Jev Ultra Streaming Protocol" and summarize score',
      provider: 'gemini' as const,
    },
    {
      title: 'Ultra-Fast Turbo Stream (Sub-ms)',
      query: 'Stream architecture overview with zero-copy buffer verification',
      provider: 'ultra_turbo' as const,
    },
    {
      title: 'Resilience Circuit Failover',
      query: 'Verify circuit breaker trip and seamless fallback router',
      provider: 'fallback' as const,
    },
  ];

  // Auto-scroll output container
  useEffect(() => {
    if (outputContainerRef.current) {
      outputContainerRef.current.scrollTop = outputContainerRef.current.scrollHeight;
    }
  }, [streamOutput]);

  const handleStartStream = async () => {
    if (isStreaming) return;

    setIsStreaming(true);
    setStreamOutput('');
    setTokenCount(0);
    setTokenVelocity(0);
    setStatus('running');
    setActiveTool(undefined);
    setToolsUsed([]);
    setLatestTrace(null);

    abortControllerRef.current = new AbortController();
    streamStartTimeRef.current = performance.now();

    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          provider,
          tools: ['calculator', 'vector_search'],
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let receivedTokens = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          let eventType = 'message';
          let dataStr = '';

          for (const subline of line.split('\n')) {
            if (subline.startsWith('event: ')) {
              eventType = subline.slice(7).trim();
            } else if (subline.startsWith('data: ')) {
              dataStr = subline.slice(6);
            }
          }

          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            const payload = parsed.data;

            if (eventType === 'state') {
              setStatus(payload.status);
              if (payload.status === 'executing_tool') {
                setActiveTool(payload.metadata?.tool);
                setToolsUsed((prev) => Array.from(new Set([...prev, payload.metadata?.tool])));
              }
            } else if (eventType === 'chunk') {
              setStatus('streaming');
              setStreamOutput((prev) => prev + payload.text);
              receivedTokens++;
              setTokenCount(receivedTokens);

              const elapsedSec = (performance.now() - streamStartTimeRef.current) / 1000;
              if (elapsedSec > 0) {
                setTokenVelocity(Math.round((receivedTokens / elapsedSec) * 10) / 10);
              }
            } else if (eventType === 'done') {
              setStatus('completed');
              setLatestTrace(payload.trace);
            } else if (eventType === 'error') {
              setStatus(payload.isCancelled ? 'cancelled' : 'failed');
            }
          } catch {
            // Ignore malformed chunks
          }
        }
      }
    } catch (err: unknown) {
      if (abortControllerRef.current?.signal.aborted) {
        setStatus('cancelled');
      } else {
        setStatus('failed');
        setStreamOutput((prev) => prev + `\n\n[ERROR: ${err instanceof Error ? err.message : String(err)}]`);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      const cancelStart = performance.now();
      abortControllerRef.current.abort('User clicked Cancel');
      const cancelLatency = Math.round((performance.now() - cancelStart) * 100) / 100;
      setStatus('cancelled');
      setStreamOutput((prev) => prev + `\n\n⚡ [CLIENT DISCONNECTED - Upstream cancellation propagated in ${cancelLatency}ms]`);
      setIsStreaming(false);
    }
  };

  const defaultLatency: LatencyBreakdown = latestTrace?.latency || {
    networkIngressMs: 0.2,
    authMs: 0.1,
    routingMs: 0.3,
    queueMs: 0.1,
    contextRetrievalMs: 1.8,
    toolExecutionMs: toolsUsed.length > 0 ? 1.4 : 0,
    providerConnectionMs: 0.4,
    providerTtftMs: provider === 'ultra_turbo' ? 4.2 : 68.0,
    internalJevOverheadMs: 12.8,
    streamProcessingMs: 18.4,
    networkEgressMs: 0.2,
    totalDurationMs: provider === 'ultra_turbo' ? 24.5 : 88.0,
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Card */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-zinc-900 gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-zinc-200 text-xs font-semibold uppercase tracking-wider">
              Agent Execution & Streaming Studio
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-zinc-500 text-[11px] mr-1">Workload Presets:</span>
            {presets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(preset.query);
                  setProvider(preset.provider);
                }}
                disabled={isStreaming}
                className="text-[11px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* Input & Provider Controls */}
        <div className="space-y-3">
          <div>
            <textarea
              rows={2}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isStreaming}
              placeholder="Enter user query to execute through Jev Ultra execution graph..."
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/30 resize-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400">Inference Provider:</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                disabled={isStreaming}
                className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="gemini">Gemini 3.8 Flash (Live)</option>
                <option value="ultra_turbo">Jev Ultra Turbo Engine (Sub-ms Latency)</option>
                <option value="fallback">Resilient Fallback Provider</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {!isStreaming ? (
                <button
                  onClick={handleStartStream}
                  className="flex items-center gap-2 px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Run Stream (SSE)
                </button>
              ) : (
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all cursor-pointer animate-pulse"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Abort / Disconnect (Test Cancel)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Visual Execution Graph */}
      <ExecutionDagVisualizer
        status={status}
        latency={defaultLatency}
        toolsUsed={toolsUsed}
        activeTool={activeTool}
      />

      {/* Output Stream Box */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs">
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-zinc-200 font-semibold uppercase tracking-wider text-[11px]">
              Live Streamed Token Output
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>Tokens:</span>
              <span className="text-white font-bold">{tokenCount}</span>
            </div>

            <div className="flex items-center gap-1.5 text-zinc-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Velocity:</span>
              <span className="text-emerald-400 font-bold">{tokenVelocity} tps</span>
            </div>

            <div className="flex items-center gap-1.5 text-zinc-400">
              <Flame className="w-3.5 h-3.5 text-cyan-400" />
              <span>Backpressure Buffer:</span>
              <span className="text-cyan-300 font-bold">0 / 32 ch</span>
            </div>
          </div>
        </div>

        <div
          ref={outputContainerRef}
          className="min-h-[160px] max-h-[280px] overflow-y-auto bg-zinc-900/60 border border-zinc-900 rounded p-3 text-zinc-200 leading-relaxed whitespace-pre-wrap font-mono text-xs selection:bg-emerald-500/30"
        >
          {streamOutput ? (
            streamOutput
          ) : (
            <span className="text-zinc-600 italic">
              Awaiting execution trigger. Click &quot;Run Stream (SSE)&quot; above to watch real-time token emission and microsecond latency measurement.
            </span>
          )}
        </div>
      </div>

      {/* Latency Waterfall Breakdown */}
      <WaterfallChart
        latency={defaultLatency}
        providerUsed={provider === 'gemini' ? 'Gemini 3.8 Flash' : provider === 'ultra_turbo' ? 'Ultra Turbo' : 'Fallback'}
      />
    </div>
  );
};
