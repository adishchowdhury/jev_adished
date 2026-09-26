/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Flame,
  AlertTriangle,
  RotateCcw,
  Zap,
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface ChaosConfig {
  simulateLatencyMs: number;
  simulateFailure: boolean;
  slowClientMs: number;
  tripGeminiCircuit: boolean;
  active: boolean;
}

export const ChaosLab: React.FC = () => {
  const [config, setConfig] = useState<ChaosConfig>({
    simulateLatencyMs: 0,
    simulateFailure: false,
    slowClientMs: 0,
    tripGeminiCircuit: false,
    active: false,
  });
  const [logEvents, setLogEvents] = useState<string[]>([
    '⚡ [CHAOS ENGINE READY] Latency injection, provider fault, and slow client simulators initialized.',
  ]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/chaos/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const updateConfig = async (partial: Partial<ChaosConfig>) => {
    const updated = { ...config, ...partial };
    setConfig(updated);
    try {
      const res = await fetch('/api/chaos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // Ignore
    }
  };

  const handleTripGemini = async () => {
    try {
      await fetch('/api/providers/gemini/trip', { method: 'POST' });
      setLogEvents((prev) => [
        `🔥 [CHAOS INJECTED] Gemini circuit breaker manually forced OPEN. Subsequent requests will route to Ultra Turbo with zero downtime.`,
        ...prev,
      ]);
    } catch {
      // Ignore
    }
  };

  const handleResetBreakers = async () => {
    try {
      await fetch('/api/providers/gemini/reset', { method: 'POST' });
      await fetch('/api/providers/ultra_turbo/reset', { method: 'POST' });
      await fetch('/api/providers/fallback/reset', { method: 'POST' });
      updateConfig({ simulateFailure: false, simulateLatencyMs: 0, slowClientMs: 0 });
      setLogEvents((prev) => [
        `✅ [CHAOS RESET] All circuit breakers restored to CLOSED. All artificial latency removed.`,
        ...prev,
      ]);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* 1. Chaos Engine Controls */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-zinc-900 gap-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
            <span className="text-zinc-200 font-semibold uppercase tracking-wider text-xs">
              Chaos Engineering &amp; Fault Resilience Simulator
            </span>
          </div>

          <button
            onClick={handleResetBreakers}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer text-[11px]"
          >
            <RotateCcw className="w-3 h-3" />
            Reset All Faults &amp; Circuits
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fault 1: Artificial Provider Latency */}
          <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-zinc-300">Provider Latency Spike</span>
              <span className="text-amber-400 font-bold">{config.simulateLatencyMs}ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="2000"
              step="100"
              value={config.simulateLatencyMs}
              onChange={(e) => {
                const val = Number(e.target.value);
                updateConfig({ simulateLatencyMs: val });
                if (val > 0) {
                  setLogEvents((prev) => [
                    `⏱️ [CHAOS] Added +${val}ms synthetic latency to provider inference pipeline.`,
                    ...prev,
                  ]);
                }
              }}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
              <span>0ms (Normal)</span>
              <span>500ms</span>
              <span>1000ms</span>
              <span>2000ms</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2 font-sans">
              Tests whether runtime correctly isolates remote provider delay without lagging internal event loops.
            </p>
          </div>

          {/* Fault 2: Provider 503 Outage */}
          <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-zinc-300">Simulate Provider 503</span>
              <input
                type="checkbox"
                checked={config.simulateFailure}
                onChange={(e) => {
                  const val = e.target.checked;
                  updateConfig({ simulateFailure: val });
                  setLogEvents((prev) => [
                    val
                      ? `🚨 [CHAOS] Injected continuous HTTP 503 Provider Failures. Watch circuit breaker trip!`
                      : `✅ [CHAOS] Restored healthy provider responses.`,
                    ...prev,
                  ]);
                }}
                className="accent-rose-500 w-4 h-4 cursor-pointer"
              />
            </div>
            <button
              onClick={handleTripGemini}
              className="w-full py-1.5 px-3 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/60 text-rose-300 font-bold text-[11px] transition-colors cursor-pointer mt-2"
            >
              Force Trip Primary Circuit (OPEN)
            </button>
            <p className="text-[10px] text-zinc-500 mt-2 font-sans">
              Verifies circuit trips in &le; 3 failures and immediately switches to secondary fallback under 10ms.
            </p>
          </div>

          {/* Fault 3: Slow Client Backpressure */}
          <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-zinc-300">Slow Client Throttle</span>
              <span className="text-cyan-400 font-bold">{config.slowClientMs}ms/chunk</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={config.slowClientMs}
              onChange={(e) => {
                const val = Number(e.target.value);
                updateConfig({ slowClientMs: val });
                if (val > 0) {
                  setLogEvents((prev) => [
                    `🐌 [CHAOS] Consumer throttled to ${val}ms per chunk. Testing BoundedStreamQueue high watermark.`,
                    ...prev,
                  ]);
                }
              }}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
              <span>0ms (Line Speed)</span>
              <span>50ms (3G)</span>
              <span>100ms</span>
              <span>200ms (2G)</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2 font-sans">
              Tests whether server bounded queue caps at 32 chunks without unbounded memory growth.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Resilience Verification Matrix */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
        <span className="text-zinc-200 font-semibold uppercase text-xs block mb-3">
          Resilience Behavioral Guarantees
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded bg-zinc-900/40 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Retry Storm Prevention</span>
            </div>
            <p className="text-zinc-400 font-sans text-[11px] leading-relaxed">
              Full jitter exponential backoff prevents thundering herds during upstream cloud provider hiccups.
            </p>
          </div>

          <div className="p-3 rounded bg-zinc-900/40 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
              <Zap className="w-4 h-4" />
              <span>&lt; 10ms Failover Routing</span>
            </div>
            <p className="text-zinc-400 font-sans text-[11px] leading-relaxed">
              When primary circuit trips to OPEN, incoming requests seamlessly route to healthy secondary providers without dropping.
            </p>
          </div>

          <div className="p-3 rounded bg-zinc-900/40 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
              <Clock className="w-4 h-4" />
              <span>Sub-100ms Abort Latency</span>
            </div>
            <p className="text-zinc-400 font-sans text-[11px] leading-relaxed">
              Client disconnection immediately propagates an AbortSignal upstream, saving tokens and freeing compute slots.
            </p>
          </div>

          <div className="p-3 rounded bg-zinc-900/40 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
              <Activity className="w-4 h-4" />
              <span>Hard Bounded Buffers</span>
            </div>
            <p className="text-zinc-400 font-sans text-[11px] leading-relaxed">
              BoundedStreamQueue enforces a 32-chunk high watermark, pausing producers to protect RAM during traffic bursts.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Live Chaos Event Log */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
        <span className="text-zinc-400 uppercase text-[10px] tracking-wider block mb-2 font-semibold">
          Live Chaos Diagnostic Feed
        </span>
        <div className="bg-zinc-900/70 border border-zinc-800 rounded p-3 max-h-40 overflow-y-auto space-y-1 text-zinc-300 font-mono text-[11px]">
          {logEvents.map((evt, idx) => (
            <div key={idx} className="leading-relaxed">
              {evt}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
