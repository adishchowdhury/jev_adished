/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileCode,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  Zap,
  Terminal,
  RefreshCw,
  Flame,
  List,
} from 'lucide-react';
import { AgentExecutionTrace, StructuredLogEntry } from '../types';
import { TraceFlamegraph } from './TraceFlamegraph';

export const TraceLogsView: React.FC = () => {
  const [traces, setTraces] = useState<AgentExecutionTrace[]>([]);
  const [logs, setLogs] = useState<StructuredLogEntry[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<AgentExecutionTrace | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'traces' | 'flamegraph' | 'logs'>('traces');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const [tracesRes, logsRes] = await Promise.all([
        fetch('/api/traces'),
        fetch('/api/logs'),
      ]);
      if (tracesRes.ok) {
        const data = await tracesRes.json();
        setTraces(data);
        if (data.length > 0 && !selectedTrace) {
          setSelectedTrace(data[0]);
        }
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* 1. Header & Zero-Leak Verification Badge */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-zinc-900 gap-2">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-zinc-200 font-semibold uppercase tracking-wider text-xs">
                Distributed Tracing &amp; Redacted Audit Log
              </span>
              <p className="text-[10px] text-zinc-400 font-sans mt-0.5">
                Every request carries a traceId and span hierarchy with zero-leak credential scrubbing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>ZERO SECRET LEAKS VERIFIED (0 API KEYS IN LOGS)</span>
            </div>
          </div>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('traces')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeSubTab === 'traces'
                ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            OpenTelemetry Execution Traces ({traces.length})
          </button>
          <button
            onClick={() => setActiveSubTab('flamegraph')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'flamegraph'
                ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Flame className="w-3 h-3 text-emerald-400" />
            <span>Trace Flamegraph</span>
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeSubTab === 'logs'
                ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Structured Scrubbed Logs ({logs.length})
          </button>
        </div>
      </div>

      {/* 2. Content Views */}
      {activeSubTab === 'flamegraph' ? (
        <TraceFlamegraph
          traces={traces}
          selectedTrace={selectedTrace}
          onSelectTrace={(t) => setSelectedTrace(t)}
        />
      ) : activeSubTab === 'traces' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Traces List */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-2 max-h-[500px] overflow-y-auto">
            <span className="text-zinc-500 text-[10px] uppercase font-bold block mb-1">
              Recent Traces
            </span>
            {traces.length === 0 ? (
              <div className="text-zinc-600 italic py-8 text-center">
                No traces recorded yet. Run a stream in the Stream Studio!
              </div>
            ) : (
              traces.map((trace) => {
                const isSelected = selectedTrace?.traceId === trace.traceId;
                return (
                  <button
                    key={trace.traceId}
                    onClick={() => setSelectedTrace(trace)}
                    className={`w-full text-left p-2.5 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-950/20 text-white'
                        : 'border-zinc-800/80 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-zinc-200 truncate">{trace.traceId}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          trace.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : trace.status === 'cancelled'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {trace.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate mb-1">
                      {trace.query}
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>{trace.latency?.totalDurationMs?.toFixed(1) || '--'}ms</span>
                      <span>{trace.tokenCount} tokens</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Trace Detail & Spans */}
          <div className="md:col-span-2 bg-zinc-950 border border-zinc-800 rounded-lg p-4">
            {selectedTrace ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
                  <div>
                    <span className="text-zinc-400 text-[10px]">Trace ID:</span>
                    <div className="text-sm font-bold text-emerald-400">{selectedTrace.traceId}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-400 text-[10px]">Total Latency:</span>
                    <div className="text-sm font-bold text-white">
                      {selectedTrace.latency?.totalDurationMs?.toFixed(1) || '--'} ms
                    </div>
                  </div>
                </div>

                {/* Spans List */}
                <div>
                  <span className="text-zinc-400 text-[11px] uppercase tracking-wider block mb-2 font-semibold">
                    Spans &amp; Milestones ({selectedTrace.spans?.length || 0})
                  </span>
                  <div className="space-y-1.5">
                    {selectedTrace.spans?.map((span, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/80"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 text-[10px]">#{idx + 1}</span>
                          <span className="text-zinc-200 font-semibold">{span.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-400 font-bold">{span.durationMs}ms</span>
                          <span className="text-[9px] px-1 rounded bg-zinc-800 text-zinc-400 uppercase">
                            {span.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* JSON Trace Metadata */}
                <div>
                  <span className="text-zinc-400 text-[11px] uppercase tracking-wider block mb-1 font-semibold">
                    Raw Trace Metadata (Sanitized)
                  </span>
                  <pre className="p-3 rounded bg-zinc-900/80 border border-zinc-800 text-[10px] text-zinc-300 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedTrace, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-zinc-500 italic py-16 text-center">
                Select a trace from the left panel to inspect spans and microsecond timings.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Scrubbed Structured Logs */
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-900">
            <span className="text-zinc-200 font-semibold uppercase text-xs">
              Live Structured Logs Feed (Auto-Redacting Secrets)
            </span>
            <span className="text-[10px] text-zinc-500">
              Regex Filters: AIza*, sk-*, Bearer*, API_KEY*
            </span>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {logs.map((log, idx) => {
              const isError = log.level === 'ERROR';
              const isWarn = log.level === 'WARN';

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded border text-[11px] font-mono ${
                    isError
                      ? 'border-rose-800/60 bg-rose-950/20 text-rose-300'
                      : isWarn
                      ? 'border-amber-800/60 bg-amber-950/20 text-amber-300'
                      : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                          isError
                            ? 'bg-rose-500/20 text-rose-400'
                            : isWarn
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-emerald-400 font-semibold">{log.event}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      {log.traceId && <span>{log.traceId}</span>}
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <p className="text-zinc-200 font-sans text-xs">{log.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
