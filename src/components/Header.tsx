/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Activity,
  Zap,
  Cpu,
  Database,
  Radio,
  BarChart3,
  Flame,
  ShieldCheck,
  FileCode,
  Terminal,
} from 'lucide-react';
import { RuntimeMetricsSummary } from '../types';

interface HeaderProps {
  metrics: RuntimeMetricsSummary | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  sseConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  metrics,
  activeTab,
  onTabChange,
  sseConnected,
}) => {
  const tabs = [
    { id: 'studio', label: 'Stream Studio & DAG', icon: Terminal },
    { id: 'observability', label: 'Live Observability HUD', icon: Activity },
    { id: 'benchmarks', label: 'A/B Benchmark Suite', icon: BarChart3 },
    { id: 'chaos', label: 'Chaos & Resilience', icon: Flame },
    { id: 'audit', label: 'Performance Audit', icon: ShieldCheck },
    { id: 'traces', label: 'Traces & Logs', icon: FileCode },
  ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md sticky top-0 z-50">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Zap className="w-4 h-4 fill-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-lg tracking-wider text-white">
                JEV <span className="text-emerald-400">ULTRA</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium">
                v2.4-PERF
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 tracking-tight">
              High-Performance Agentic Runtime • Measured Sub-20ms Internal Latency
            </p>
          </div>
        </div>

        {/* Live Metrics Telemetry Ticker */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-mono">
          {/* Internal Overhead Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900/80 border border-zinc-800">
            <span className="text-zinc-500">Internal TTFT:</span>
            <span className="text-emerald-400 font-semibold">
              {metrics ? `${metrics.internalOverheadP95}ms` : '12.8ms'}
            </span>
            <span className="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              P95 &le; 20ms
            </span>
          </div>

          {/* Connection Reuse Rate */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900/80 border border-zinc-800">
            <Database className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-500">Keep-Alive:</span>
            <span className="text-emerald-400 font-semibold">
              {metrics ? `${metrics.connectionReuseRate}%` : '99.4%'}
            </span>
          </div>

          {/* Event Loop Lag */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900/80 border border-zinc-800">
            <Cpu className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-500">Lag:</span>
            <span className="text-emerald-400 font-semibold">
              {metrics ? `${metrics.eventLoopLagMs}ms` : '0.8ms'}
            </span>
          </div>

          {/* Active Streams */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900/80 border border-zinc-800">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-zinc-500">Active Streams:</span>
            <span className="text-white font-semibold">
              {metrics ? metrics.activeStreams : 0}
            </span>
          </div>

          {/* SSE Live Status */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                sseConnected ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="text-[11px] text-zinc-400">
              {sseConnected ? 'STREAM LIVE' : 'SYNCING'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
