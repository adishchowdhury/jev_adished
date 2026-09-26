/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StreamStudio } from './components/StreamStudio';
import { ObservabilityDashboard } from './components/ObservabilityDashboard';
import { BenchmarkSuite } from './components/BenchmarkSuite';
import { ChaosLab } from './components/ChaosLab';
import { AuditReportView } from './components/AuditReportView';
import { TraceLogsView } from './components/TraceLogsView';
import { RuntimeMetricsSummary } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('studio');
  const [metrics, setMetrics] = useState<RuntimeMetricsSummary | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  useEffect(() => {
    // Initial fetch
    fetch('/api/metrics')
      .then((res) => res.json())
      .then((data) => setMetrics(data))
      .catch(() => {});

    // Connect to live SSE telemetry stream
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/metrics/stream');

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setMetrics(parsed);
        } catch {
          // Ignore
        }
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }

    return () => {
      eventSource?.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation & Telemetry HUD */}
      <Header
        metrics={metrics}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sseConnected={sseConnected}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4">
        {activeTab === 'studio' && <StreamStudio />}
        {activeTab === 'observability' && <ObservabilityDashboard metrics={metrics} />}
        {activeTab === 'benchmarks' && <BenchmarkSuite />}
        {activeTab === 'chaos' && <ChaosLab />}
        {activeTab === 'audit' && <AuditReportView />}
        {activeTab === 'traces' && <TraceLogsView />}
      </main>

      {/* Footer Status Bar */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-2.5 px-4 font-mono text-[11px] text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold">JEV ULTRA RUNTIME</span>
            <span>&bull;</span>
            <span>Hybrid TS/Go Socket Architecture</span>
            <span>&bull;</span>
            <span>Zero-Copy Stream Buffers</span>
            <span>&bull;</span>
            <span>Deterministic Microsecond Telemetry</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-400">All Latency SLA Contracts Enforced (P95 &le; 20ms)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
