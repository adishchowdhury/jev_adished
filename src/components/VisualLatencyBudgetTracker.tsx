/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Gauge,
  Sliders,
  CheckCircle2,
  XCircle,
  Activity,
  ArrowRight,
  TrendingDown,
  Flame,
} from 'lucide-react';
import { RuntimeMetricsSummary, LatencyBreakdown } from '../types';

interface LatencySegment {
  id: string;
  name: string;
  budgetMs: number;
  actualMs: number;
  category: string;
  description: string;
}

interface VisualLatencyBudgetTrackerProps {
  metrics: RuntimeMetricsSummary | null;
  activeTraceLatency?: LatencyBreakdown;
}

export const VisualLatencyBudgetTracker: React.FC<VisualLatencyBudgetTrackerProps> = ({
  metrics,
  activeTraceLatency,
}) => {
  // Live simulation offset to allow testing SLA breach & recovery in real-time
  const [injectedOffsetMs, setInjectedOffsetMs] = useState<number>(0);
  const [countdownTick, setCountdownTick] = useState<number>(0);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  // Real-time ticking simulation for live countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownTick((prev) => (prev + 1) % 100);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Base actuals from metrics or active trace
  const internalP95 = (metrics?.internalOverheadP95 ?? 12.8) + injectedOffsetMs;
  const ttfbP95 = (metrics?.ttfbP95 ?? 48.5) + injectedOffsetMs * 0.8;
  const ttfRemote = 65.0; // Remote provider inference TTFT
  const totalTtft = internalP95 + ttfRemote;

  const INTERNAL_SLA_BUDGET_MS = 20.0;
  const TTFB_SLA_BUDGET_MS = 100.0;
  const TTFT_REMOTE_SLA_BUDGET_MS = 500.0;

  // Breakdown of segments that make up the internal 20ms SLA
  const baseIngress = activeTraceLatency?.networkIngressMs ?? 0.8;
  const baseRouting = activeTraceLatency?.routingMs ?? 0.6;
  const baseContext = (activeTraceLatency?.contextRetrievalMs ?? 2.8) + (injectedOffsetMs > 0 ? injectedOffsetMs * 0.6 : 0);
  const baseTool = (activeTraceLatency?.toolExecutionMs ?? 1.6) + (injectedOffsetMs > 0 ? injectedOffsetMs * 0.4 : 0);
  const baseSocket = activeTraceLatency?.providerConnectionMs ?? 0.4;
  const baseBuffer = activeTraceLatency?.queueMs ?? 0.3;

  const segments: LatencySegment[] = [
    {
      id: 'ingress',
      name: 'Network Ingress & Auth',
      budgetMs: 2.0,
      actualMs: Math.round(baseIngress * 10) / 10,
      category: 'Network',
      description: 'Request parsing, header validation, zero-leak token check',
    },
    {
      id: 'routing',
      name: 'Admission & Routing',
      budgetMs: 2.0,
      actualMs: Math.round(baseRouting * 10) / 10,
      category: 'Admission',
      description: 'Circuit breaker probe & queue admission check',
    },
    {
      id: 'context',
      name: 'Concurrent Context DAG',
      budgetMs: 8.0,
      actualMs: Math.round(baseContext * 10) / 10,
      category: 'DAG Engine',
      description: 'Promise.allSettled(Memory, Cache, Doc Vector Store)',
    },
    {
      id: 'tools',
      name: 'Tool Sandbox Execution',
      budgetMs: 6.0,
      actualMs: Math.round(baseTool * 10) / 10,
      category: 'Tools',
      description: 'Sandboxed tool runtime with AbortController timeout',
    },
    {
      id: 'socket',
      name: 'Socket Pool Handshake',
      budgetMs: 2.0,
      actualMs: Math.round(baseSocket * 10) / 10,
      category: 'Networking',
      description: 'HTTP/2 Keep-Alive persistent connection reuse (0.4ms)',
    },
  ];

  const totalCalculatedInternalMs = segments.reduce((sum, s) => sum + s.actualMs, 0);
  const internalRemainingBudgetMs = Math.round((INTERNAL_SLA_BUDGET_MS - totalCalculatedInternalMs) * 10) / 10;
  const isInternalBreached = totalCalculatedInternalMs > INTERNAL_SLA_BUDGET_MS;

  const ttfbRemainingBudgetMs = Math.round((TTFB_SLA_BUDGET_MS - ttfbP95) * 10) / 10;
  const isTtfbBreached = ttfbP95 > TTFB_SLA_BUDGET_MS;

  const ttftRemainingBudgetMs = Math.round((TTFT_REMOTE_SLA_BUDGET_MS - totalTtft) * 10) / 10;
  const isTtftBreached = totalTtft > TTFT_REMOTE_SLA_BUDGET_MS;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs space-y-4">
      {/* 1. Header with SLA Status & Real-time Live Headroom */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-zinc-900 gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-200 font-bold uppercase tracking-wider text-xs">
                Visual Latency Budget Tracker &amp; SLA Countdowns
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                  isInternalBreached
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isInternalBreached ? '20ms SLA BREACH DETECTED' : '20ms INTERNAL SLA: PASSED'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans mt-0.5">
              Deterministic real-time microsecond countdown monitoring for TTFT internal overhead (&le;20ms) and TTFB (&le;100ms).
            </p>
          </div>
        </div>

        {/* Live Headroom Timer Pill */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono ${
              isInternalBreached
                ? 'bg-rose-950/40 border-rose-600/70 text-rose-300'
                : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <div className="text-[10px] uppercase text-zinc-400">Internal Headroom:</div>
            <div className="text-sm font-black">
              {internalRemainingBudgetMs >= 0 ? `+${internalRemainingBudgetMs.toFixed(1)}ms` : `${internalRemainingBudgetMs.toFixed(1)}ms`}
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                isInternalBreached ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 2. Top Countdowns Grid: Internal TTFT vs. TTFB vs. Provider TTFT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Countdown Card 1: Internal Processing Overhead (20ms SLA) */}
        <div
          className={`p-3.5 rounded-lg border transition-all ${
            isInternalBreached
              ? 'bg-rose-950/20 border-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
              : 'bg-zinc-900/60 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-2">
            <span className="text-zinc-400 font-bold uppercase">1. Internal TTFT Overhead</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                isInternalBreached
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              Budget: 20.0ms
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="text-2xl font-black text-white">
              {totalCalculatedInternalMs.toFixed(1)} <span className="text-xs text-zinc-400 font-normal">ms</span>
            </div>
            <div
              className={`text-xs font-bold ${
                isInternalBreached ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {internalRemainingBudgetMs >= 0
                ? `${internalRemainingBudgetMs.toFixed(1)}ms remaining`
                : `${Math.abs(internalRemainingBudgetMs).toFixed(1)}ms OVER BUDGET`}
            </div>
          </div>

          {/* Progress Bar with 20ms Marker */}
          <div className="relative w-full bg-zinc-950 h-3 rounded overflow-hidden mb-1.5 border border-zinc-800">
            <div
              className={`h-full rounded transition-all duration-200 ${
                isInternalBreached ? 'bg-rose-500' : totalCalculatedInternalMs > 16 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (totalCalculatedInternalMs / INTERNAL_SLA_BUDGET_MS) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>0ms</span>
            <span className="text-emerald-400 font-bold">10ms (P50)</span>
            <span className="text-rose-400 font-bold">20ms (Max SLA)</span>
          </div>
        </div>

        {/* Countdown Card 2: Time to First Byte (100ms SLA) */}
        <div
          className={`p-3.5 rounded-lg border transition-all ${
            isTtfbBreached
              ? 'bg-rose-950/20 border-rose-600'
              : 'bg-zinc-900/60 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-2">
            <span className="text-zinc-400 font-bold uppercase">2. Time to First Byte (TTFB)</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                isTtfbBreached
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              Budget: 100.0ms
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="text-2xl font-black text-white">
              {ttfbP95.toFixed(1)} <span className="text-xs text-zinc-400 font-normal">ms</span>
            </div>
            <div
              className={`text-xs font-bold ${
                isTtfbBreached ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {ttfbRemainingBudgetMs >= 0
                ? `${ttfbRemainingBudgetMs.toFixed(1)}ms remaining`
                : `${Math.abs(ttfbRemainingBudgetMs).toFixed(1)}ms OVER BUDGET`}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full bg-zinc-950 h-3 rounded overflow-hidden mb-1.5 border border-zinc-800">
            <div
              className={`h-full rounded transition-all duration-200 ${
                isTtfbBreached ? 'bg-rose-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${Math.min(100, (ttfbP95 / TTFB_SLA_BUDGET_MS) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>0ms</span>
            <span className="text-cyan-400">50ms (Optimal)</span>
            <span className="text-zinc-400">100ms (P95 SLA)</span>
          </div>
        </div>

        {/* Countdown Card 3: End-to-End First Token (TTFT) */}
        <div
          className={`p-3.5 rounded-lg border transition-all ${
            isTtftBreached
              ? 'bg-rose-950/20 border-rose-600'
              : 'bg-zinc-900/60 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-2">
            <span className="text-zinc-400 font-bold uppercase">3. Full Remote TTFT (User Visible)</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border bg-purple-500/20 text-purple-300 border-purple-500/30">
              Budget: 500.0ms
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="text-2xl font-black text-white">
              {totalTtft.toFixed(1)} <span className="text-xs text-zinc-400 font-normal">ms</span>
            </div>
            <div className="text-xs font-bold text-purple-300">
              {ttftRemainingBudgetMs.toFixed(1)}ms remaining
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full bg-zinc-950 h-3 rounded overflow-hidden mb-1.5 border border-zinc-800">
            <div
              className="h-full rounded bg-purple-500 transition-all duration-200"
              style={{ width: `${Math.min(100, (totalTtft / TTFT_REMOTE_SLA_BUDGET_MS) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>0ms</span>
            <span>Jev ({totalCalculatedInternalMs.toFixed(1)}ms)</span>
            <span>Remote Model ({ttfRemote}ms)</span>
            <span>500ms</span>
          </div>
        </div>
      </div>

      {/* 3. Detailed Segments Matrix: Real-time Budget Countdown per Segment */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-zinc-300 font-bold text-xs uppercase">
              Internal 20ms SLA Budget Segment Allocation &amp; Burn Rate
            </span>
          </div>
          <span className="text-[10px] text-zinc-500">
            Segments highlighted in red breach their individual allocation
          </span>
        </div>

        <div className="space-y-2.5">
          {segments.map((seg) => {
            const isBreached = seg.actualMs > seg.budgetMs;
            const burnPct = Math.min(100, Math.round((seg.actualMs / seg.budgetMs) * 100));
            const remaining = Math.round((seg.budgetMs - seg.actualMs) * 10) / 10;

            return (
              <div
                key={seg.id}
                onClick={() => setSelectedSegment(selectedSegment === seg.id ? null : seg.id)}
                className={`p-2.5 rounded border transition-all cursor-pointer ${
                  isBreached
                    ? 'border-rose-500 bg-rose-950/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                    : 'border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {isBreached ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <span className="font-bold text-white text-xs">{seg.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                      {seg.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-zinc-400 text-[11px]">
                      Budget: <span className="text-zinc-300 font-semibold">{seg.budgetMs.toFixed(1)}ms</span>
                    </span>
                    <span className="text-zinc-500">&bull;</span>
                    <span className="text-zinc-400 text-[11px]">
                      Actual:{' '}
                      <span className={`font-bold ${isBreached ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {seg.actualMs.toFixed(1)}ms
                      </span>
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                        isBreached
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {isBreached
                        ? `EXCEEDED BY +${Math.abs(remaining).toFixed(1)}ms`
                        : `${remaining.toFixed(1)}ms HEADROOM`}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-zinc-950 h-2 rounded overflow-hidden border border-zinc-800/80">
                  <div
                    className={`h-full rounded transition-all duration-300 ${
                      isBreached ? 'bg-rose-500' : burnPct > 80 ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${burnPct}%` }}
                  />
                </div>

                {selectedSegment === seg.id && (
                  <div className="text-[10px] text-zinc-400 font-sans mt-2 pt-2 border-t border-zinc-800 flex justify-between items-center">
                    <span>{seg.description}</span>
                    <span className="text-zinc-500 font-mono">Burn: {burnPct}% of budget</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Interactive Live SLA Breach Simulator Slider */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-zinc-300 text-xs font-bold uppercase">
              Interactive Live SLA Budget Simulator
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setInjectedOffsetMs(0)}
              className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
            >
              Reset to Optimal (0ms)
            </button>
            <button
              onClick={() => setInjectedOffsetMs(15)}
              className="text-[10px] px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/60 text-rose-300 transition-colors cursor-pointer"
            >
              Inject +15ms Spike (Breach SLA)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-400 whitespace-nowrap">
            Simulated Internal Delay:
          </span>
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            value={injectedOffsetMs}
            onChange={(e) => setInjectedOffsetMs(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <span className={`text-xs font-bold w-16 text-right ${injectedOffsetMs > 7.2 ? 'text-rose-400' : 'text-emerald-400'}`}>
            +{injectedOffsetMs}ms
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 font-sans mt-1.5">
          Drag the slider to test real-time countdown reactions and visual segment highlighting when internal overhead exceeds the 20ms SLA threshold.
        </p>
      </div>
    </div>
  );
};
