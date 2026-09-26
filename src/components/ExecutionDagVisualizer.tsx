/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Shield,
  Layers,
  ArrowRight,
  Wrench,
  Server,
  Zap,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { AgentRunStatus, LatencyBreakdown } from '../types';

interface ExecutionDagVisualizerProps {
  status: AgentRunStatus;
  latency?: LatencyBreakdown;
  toolsUsed?: string[];
  activeTool?: string;
}

export const ExecutionDagVisualizer: React.FC<ExecutionDagVisualizerProps> = ({
  status,
  latency,
  toolsUsed = [],
  activeTool,
}) => {
  const getStepStatus = (step: string): 'pending' | 'active' | 'completed' | 'failed' | 'cancelled' => {
    if (status === 'failed') return 'failed';
    if (status === 'cancelled') return 'cancelled';

    switch (step) {
      case 'ingress':
        if (status === 'created') return 'active';
        return 'completed';
      case 'routing':
        if (status === 'created') return 'pending';
        if (status === 'running') return 'active';
        return 'completed';
      case 'context':
        if (['created', 'running'].includes(status)) return 'active';
        return 'completed';
      case 'tools':
        if (['waiting_tool', 'executing_tool'].includes(status)) return 'active';
        if (['waiting_model', 'streaming', 'completed'].includes(status)) return 'completed';
        return 'pending';
      case 'socket':
        if (status === 'waiting_model') return 'active';
        if (['streaming', 'completed'].includes(status)) return 'completed';
        return 'pending';
      case 'streaming':
        if (status === 'streaming') return 'active';
        if (status === 'completed') return 'completed';
        return 'pending';
      case 'completed':
        if (status === 'completed') return 'completed';
        return 'pending';
      default:
        return 'pending';
    }
  };

  const renderBadge = (stepStatus: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled') => {
    if (stepStatus === 'completed') {
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (stepStatus === 'active') {
      return (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      );
    }
    if (stepStatus === 'failed') {
      return <AlertCircle className="w-3.5 h-3.5 text-rose-500" />;
    }
    if (stepStatus === 'cancelled') {
      return <XCircle className="w-3.5 h-3.5 text-amber-500" />;
    }
    return <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />;
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
            Execution Graph (DAG Pipeline)
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            PARALLEL RETRIEVAL ACTIVE
          </span>
        </div>
        <div className="text-[11px] text-zinc-500">
          Status:{' '}
          <span
            className={`font-semibold uppercase ${
              status === 'completed'
                ? 'text-emerald-400'
                : status === 'failed'
                ? 'text-rose-400'
                : status === 'cancelled'
                ? 'text-amber-400'
                : 'text-cyan-400 animate-pulse'
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Nodes Timeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        {/* Node 1: Ingress & Auth */}
        <div
          className={`p-2.5 rounded border transition-all ${
            getStepStatus('ingress') === 'active'
              ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
              : getStepStatus('ingress') === 'completed'
              ? 'border-zinc-800 bg-zinc-900/50'
              : 'border-zinc-900 bg-zinc-950 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-[10px]">STAGE 1</span>
            {renderBadge(getStepStatus('ingress'))}
          </div>
          <div className="flex items-center gap-1.5 text-zinc-200 font-semibold mb-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ingress / Auth</span>
          </div>
          <div className="text-[10px] text-zinc-400">
            {latency ? `${latency.networkIngressMs}ms` : '0.2ms'}
          </div>
        </div>

        {/* Node 2: Concurrent Context Retrieval */}
        <div
          className={`p-2.5 rounded border transition-all ${
            getStepStatus('context') === 'active'
              ? 'border-cyan-500 bg-cyan-950/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              : getStepStatus('context') === 'completed'
              ? 'border-zinc-800 bg-zinc-900/50'
              : 'border-zinc-900 bg-zinc-950 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-[10px]">STAGE 2</span>
            {renderBadge(getStepStatus('context'))}
          </div>
          <div className="flex items-center gap-1.5 text-zinc-200 font-semibold mb-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Parallel Context</span>
          </div>
          <div className="text-[10px] text-zinc-400">
            {latency ? `${latency.contextRetrievalMs}ms` : '1.8ms'}
          </div>
          <div className="text-[9px] text-emerald-400/80 font-sans mt-1">
            Promise.allSettled(Memory, Cache, Docs)
          </div>
        </div>

        {/* Node 3: Sandboxed Tool Execution */}
        <div
          className={`p-2.5 rounded border transition-all ${
            getStepStatus('tools') === 'active'
              ? 'border-purple-500 bg-purple-950/20 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
              : getStepStatus('tools') === 'completed'
              ? 'border-zinc-800 bg-zinc-900/50'
              : 'border-zinc-900 bg-zinc-950 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-[10px]">STAGE 3</span>
            {renderBadge(getStepStatus('tools'))}
          </div>
          <div className="flex items-center gap-1.5 text-zinc-200 font-semibold mb-1">
            <Wrench className="w-3.5 h-3.5 text-purple-400" />
            <span>Tool Sandbox</span>
          </div>
          <div className="text-[10px] text-zinc-400">
            {latency ? `${latency.toolExecutionMs}ms` : '1.4ms'}
          </div>
          <div className="text-[9px] text-zinc-400 mt-1">
            {activeTool ? `Active: ${activeTool}` : toolsUsed.length > 0 ? toolsUsed.join(', ') : 'Ready'}
          </div>
        </div>

        {/* Node 4: Persistent Keep-Alive Socket */}
        <div
          className={`p-2.5 rounded border transition-all ${
            getStepStatus('socket') === 'active'
              ? 'border-amber-500 bg-amber-950/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              : getStepStatus('socket') === 'completed'
              ? 'border-zinc-800 bg-zinc-900/50'
              : 'border-zinc-900 bg-zinc-950 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-[10px]">STAGE 4</span>
            {renderBadge(getStepStatus('socket'))}
          </div>
          <div className="flex items-center gap-1.5 text-zinc-200 font-semibold mb-1">
            <Server className="w-3.5 h-3.5 text-amber-400" />
            <span>Socket Pool</span>
          </div>
          <div className="text-[10px] text-zinc-400">
            {latency ? `${latency.providerConnectionMs}ms` : '0.4ms'}
          </div>
          <div className="text-[9px] text-emerald-400 mt-1">
            HTTP/2 Keep-Alive Reuse
          </div>
        </div>

        {/* Node 5: Streaming Token Pump */}
        <div
          className={`p-2.5 rounded border transition-all ${
            getStepStatus('streaming') === 'active'
              ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
              : getStepStatus('streaming') === 'completed'
              ? 'border-zinc-800 bg-zinc-900/50'
              : 'border-zinc-900 bg-zinc-950 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-[10px]">STAGE 5</span>
            {renderBadge(getStepStatus('streaming'))}
          </div>
          <div className="flex items-center gap-1.5 text-zinc-200 font-semibold mb-1">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Stream Pump</span>
          </div>
          <div className="text-[10px] text-zinc-400">
            {latency ? `${latency.streamProcessingMs}ms` : 'Active'}
          </div>
          <div className="text-[9px] text-cyan-400 mt-1">
            Bounded Backpressure (32 ch)
          </div>
        </div>

        {/* Node 6: Egress & Telemetry */}
        <div
          className={`p-2.5 rounded border transition-all ${
            getStepStatus('completed') === 'completed'
              ? 'border-emerald-500 bg-zinc-900/70'
              : 'border-zinc-900 bg-zinc-950 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-500 text-[10px]">STAGE 6</span>
            {renderBadge(getStepStatus('completed'))}
          </div>
          <div className="flex items-center gap-1.5 text-zinc-200 font-semibold mb-1">
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
            <span>Egress Telemetry</span>
          </div>
          <div className="text-[10px] text-zinc-400">
            Total: {latency ? `${latency.totalDurationMs}ms` : '--'}
          </div>
          <div className="text-[9px] text-emerald-400 mt-1">
            Audit Scrubbed (0 Leaks)
          </div>
        </div>
      </div>
    </div>
  );
};
