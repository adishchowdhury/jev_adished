/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Flame,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { AgentExecutionTrace, TraceSpan } from '../types';

interface TraceFlamegraphProps {
  traces: AgentExecutionTrace[];
  selectedTrace?: AgentExecutionTrace | null;
  onSelectTrace?: (trace: AgentExecutionTrace) => void;
}

export const TraceFlamegraph: React.FC<TraceFlamegraphProps> = ({
  traces,
  selectedTrace: propSelectedTrace,
  onSelectTrace,
}) => {
  const [internalSelectedTrace, setInternalSelectedTrace] = useState<AgentExecutionTrace | null>(null);
  const [hoveredSpan, setHoveredSpan] = useState<TraceSpan | null>(null);
  const [activeSpanDetail, setActiveSpanDetail] = useState<TraceSpan | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentTrace = propSelectedTrace || internalSelectedTrace || traces[0] || null;

  const totalDurationMs = useMemo(() => {
    if (!currentTrace) return 100;
    return Math.max(
      10,
      currentTrace.latency?.totalDurationMs ||
        currentTrace.spans.reduce((max, s) => Math.max(max, (s.offsetMs || 0) + (s.durationMs || 0)), 0) ||
        100
    );
  }, [currentTrace]);

  // Group spans by depth levels (0, 1, 2, etc.)
  const depthLevels = useMemo(() => {
    if (!currentTrace || !currentTrace.spans) return [];

    const levels: TraceSpan[][] = [];
    currentTrace.spans.forEach((span) => {
      const depth = span.depth ?? (span.parentId ? 1 : 0);
      if (!levels[depth]) {
        levels[depth] = [];
      }
      levels[depth].push(span);
    });

    // Sort each level by offsetMs
    levels.forEach((level) => {
      level.sort((a, b) => (a.offsetMs || 0) - (b.offsetMs || 0));
    });

    return levels;
  }, [currentTrace]);

  const getCategoryColor = (category?: string, isBreached?: boolean) => {
    if (isBreached) {
      return 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]';
    }
    switch (category) {
      case 'ingress':
        return 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100 border-zinc-500';
      case 'routing':
        return 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400';
      case 'context':
        return 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400';
      case 'tool':
        return 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400';
      case 'socket':
        return 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400';
      case 'provider':
        return 'bg-rose-700 hover:bg-rose-600 text-white border-rose-500';
      case 'stream':
        return 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold border-emerald-400';
      default:
        return 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-600';
    }
  };

  // Position of 20ms SLA boundary line
  const slaBoundaryPercent = Math.min(100, Math.max(0, (20.0 / totalDurationMs) * 100));

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs space-y-4">
      {/* 1. Header & Controls */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-zinc-900 gap-2">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-200 font-bold uppercase tracking-wider text-xs">
                Distributed Trace Flamegraph
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                Hierarchical DAG Spans
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans mt-0.5">
              Interactive timeline with 20ms SLA boundary indicator, parallel async tasks, and tool sandbox depths.
            </p>
          </div>
        </div>

        {/* Trace Selector & Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Trace Selector Dropdown */}
          <div className="relative">
            <select
              value={currentTrace?.traceId || ''}
              onChange={(e) => {
                const found = traces.find((t) => t.traceId === e.target.value);
                if (found) {
                  setInternalSelectedTrace(found);
                  if (onSelectTrace) onSelectTrace(found);
                  setActiveSpanDetail(null);
                }
              }}
              className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer pr-6"
            >
              {traces.map((t) => (
                <option key={t.traceId} value={t.traceId}>
                  {t.traceId} ({t.latency?.totalDurationMs?.toFixed(1) || '--'}ms) &bull; {t.providerUsed}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter spans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded pl-7 pr-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 w-32"
            />
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5">
            <button
              onClick={() => setZoomScale((prev) => Math.max(0.5, prev - 0.25))}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] px-1 text-zinc-400 font-mono">{zoomScale}x</span>
            <button
              onClick={() => setZoomScale((prev) => Math.min(3, prev + 0.25))}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={() => setZoomScale(1)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white cursor-pointer ml-0.5"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Color Legend Bar */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400 bg-zinc-900/50 p-2 rounded border border-zinc-900">
        <span className="text-zinc-500 font-bold uppercase">Legend:</span>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-zinc-700 border border-zinc-500" />
          <span>Ingress &amp; Auth</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-blue-600 border border-blue-400" />
          <span>Admission &amp; Route</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-cyan-600 border border-cyan-400" />
          <span>Parallel Context</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-purple-600 border border-purple-400" />
          <span>Tool Sandbox</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-amber-600 border border-amber-400" />
          <span>Socket Pool</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-rose-700 border border-rose-500" />
          <span>Remote Provider TTFT</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-600 border border-emerald-400" />
          <span>Stream Pump</span>
        </div>
        <div className="flex items-center gap-1 ml-auto text-rose-400 font-bold">
          <span className="w-2.5 h-2.5 rounded border border-rose-500 bg-rose-500/30 animate-pulse" />
          <span>SLA Breached (&gt; 20ms)</span>
        </div>
      </div>

      {/* 3. Flamegraph Visualization Canvas */}
      <div className="relative overflow-x-auto border border-zinc-800 rounded-lg bg-zinc-950 p-3 pt-6 min-h-[220px]">
        {/* Horizontal Timeline Ticks */}
        <div
          className="relative w-full border-b border-zinc-800 pb-1 mb-3 flex justify-between text-[9px] text-zinc-500 font-mono"
          style={{ width: `${zoomScale * 100}%` }}
        >
          <span>0ms</span>
          <span>{(totalDurationMs * 0.25).toFixed(1)}ms</span>
          <span>{(totalDurationMs * 0.5).toFixed(1)}ms</span>
          <span>{(totalDurationMs * 0.75).toFixed(1)}ms</span>
          <span>{totalDurationMs.toFixed(1)}ms</span>
        </div>

        {/* 20ms Internal SLA Red Guideline */}
        {totalDurationMs > 20 && (
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
            style={{ left: `${slaBoundaryPercent * zoomScale}%` }}
          >
            <div className="bg-rose-600 text-white font-mono font-bold text-[8px] px-1 py-0.5 rounded shadow-[0_0_8px_rgba(244,63,94,0.6)] whitespace-nowrap">
              20ms Internal SLA Limit
            </div>
            <div className="w-0.5 h-full border-r-2 border-dashed border-rose-500/80 shadow-[0_0_8px_#f43f5e]" />
          </div>
        )}

        {/* Flamegraph Rows Container */}
        <div
          className="space-y-2 relative"
          style={{ width: `${zoomScale * 100}%` }}
        >
          {depthLevels.map((levelSpans, depthIdx) => {
            return (
              <div key={depthIdx} className="relative h-7 w-full flex items-center">
                {levelSpans.map((span) => {
                  const duration = span.durationMs || 1;
                  const offset = span.offsetMs || 0;
                  const leftPct = (offset / totalDurationMs) * 100;
                  const widthPct = Math.max(1.8, (duration / totalDurationMs) * 100);

                  const isBreached = span.isSlaBreached || (span.depth === 1 && offset + duration > 20 && span.category !== 'provider' && span.category !== 'stream');
                  const isMatchingSearch = searchQuery === '' || span.name.toLowerCase().includes(searchQuery.toLowerCase());

                  return (
                    <div
                      key={span.id}
                      onClick={() => setActiveSpanDetail(span)}
                      onMouseEnter={() => setHoveredSpan(span)}
                      onMouseLeave={() => setHoveredSpan(null)}
                      className={`absolute h-6 rounded px-1.5 flex items-center justify-between text-[10px] font-mono border transition-all cursor-pointer truncate ${getCategoryColor(
                        span.category,
                        isBreached
                      )} ${
                        !isMatchingSearch ? 'opacity-20' : 'opacity-100'
                      } ${
                        activeSpanDetail?.id === span.id ? 'ring-2 ring-white z-10' : ''
                      }`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      title={`${span.name} (${duration.toFixed(1)}ms)`}
                    >
                      <span className="truncate pr-1 font-semibold">{span.name}</span>
                      {widthPct > 5 && (
                        <span className="text-[9px] opacity-80 shrink-0">
                          {duration.toFixed(1)}ms
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Interactive Hover & Inspector Card */}
      {(hoveredSpan || activeSpanDetail) && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          {(() => {
            const span = hoveredSpan || activeSpanDetail!;
            const dur = span.durationMs || 0;
            const pct = Math.round((dur / totalDurationMs) * 100);
            const isBreached = span.isSlaBreached || (span.depth === 1 && (span.offsetMs || 0) + dur > 20 && span.category !== 'provider' && span.category !== 'stream');

            return (
              <>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{span.name}</span>
                    <span className="text-[9px] px-1.5 rounded bg-zinc-800 text-zinc-400">
                      Depth: {span.depth}
                    </span>
                    <span className="text-[9px] px-1.5 rounded bg-zinc-800 text-zinc-400 uppercase">
                      {span.category || 'task'}
                    </span>
                    {isBreached && (
                      <span className="text-[9px] px-1.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold animate-pulse">
                        EXCEEDS 20ms SLA
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-3">
                    <span>
                      Duration: <strong className="text-emerald-400">{dur.toFixed(2)}ms</strong> ({pct}% of trace)
                    </span>
                    <span>&bull;</span>
                    <span>
                      Offset: <strong className="text-zinc-200">{(span.offsetMs || 0).toFixed(2)}ms</strong>
                    </span>
                    {span.slaBudgetMs && (
                      <>
                        <span>&bull;</span>
                        <span>
                          SLA Budget: <strong className="text-zinc-200">{span.slaBudgetMs}ms</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {span.metadata && Object.keys(span.metadata).length > 0 && (
                  <div className="text-[10px] text-zinc-400 bg-zinc-950/80 px-2.5 py-1 rounded border border-zinc-800 truncate max-w-xs">
                    {JSON.stringify(span.metadata)}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
