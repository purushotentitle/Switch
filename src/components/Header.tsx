import React from 'react';
import { Activity, ShieldCheck, Cpu, RefreshCw, Terminal, Layers, Building2, Server, CheckCircle2, ShieldAlert } from 'lucide-react';
import { SwitchMetrics } from '../types/payment';

interface HeaderProps {
  activeTab: 'simulator' | 'merchant' | 'ops' | 'qa' | 'architecture';
  setActiveTab: (tab: 'simulator' | 'merchant' | 'ops' | 'qa' | 'architecture') => void;
  metrics: SwitchMetrics;
  connectedWs: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  metrics,
  connectedWs,
  onRefresh
}) => {
  return (
    <header id="main-header" className="bg-[#0F172A] border-b border-slate-700 text-white sticky top-0 z-40 shrink-0">
      {/* Top High-Density Nav & Telemetry Strip */}
      <div className="w-full px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 text-[11px] font-mono">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-bold text-xs tracking-wider text-white shadow-xs">
            NX
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-white font-sans">IndiSwitch</span>
            <span className="text-slate-500 font-sans text-xs hidden sm:inline">|</span>
            <span className="text-slate-300 font-sans text-xs hidden sm:inline">Core Payment Gateway & Settlement</span>
            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded border border-emerald-500/30 uppercase font-mono tracking-wide">
              {connectedWs ? 'LIVE - DC1 (MUM)' : 'CONNECTING...'}
            </span>
          </div>
        </div>

        {/* Dense Telemetry metrics on right */}
        <div className="flex items-center gap-5 text-[11px] font-mono">
          <div className="flex flex-col items-end">
            <span className="text-slate-400 uppercase text-[9px] leading-tight">Global TPS</span>
            <span className="text-emerald-400 font-semibold">{metrics.currentTps.toFixed(1)} / s</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-400 uppercase text-[9px] leading-tight">Avg Latency</span>
            <span className="text-white font-semibold">{metrics.avgLatencyMs}ms</span>
          </div>
          <div className="flex flex-col items-end hidden md:flex">
            <span className="text-slate-400 uppercase text-[9px] leading-tight">p95 / p99</span>
            <span className="text-indigo-300 font-semibold">{metrics.p95LatencyMs} / {metrics.p99LatencyMs}ms</span>
          </div>
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-slate-400 uppercase text-[9px] leading-tight">HSM Pool</span>
            <span className="text-emerald-400 font-semibold">CONNECTED (Slot 1)</span>
          </div>
          <div className="w-px h-5 bg-slate-700 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connectedWs ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
            <span className="text-slate-300 text-[11px] hidden sm:inline">Ops Admin (S_D_12)</span>
            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors ml-1"
              title="Refresh Switch Telemetry"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Tab Strip */}
      <div className="w-full px-4 sm:px-6 py-1.5 bg-[#1E293B] border-b border-slate-700/80 flex items-center justify-between gap-2 overflow-x-auto">
        <nav className="flex items-center gap-1 text-xs">
          <button
            id="tab-simulator-btn"
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              activeTab === 'simulator'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Payment Simulator</span>
          </button>

          <button
            id="tab-merchant-btn"
            onClick={() => setActiveTab('merchant')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              activeTab === 'merchant'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Merchant Ledger</span>
          </button>

          <button
            id="tab-ops-btn"
            onClick={() => setActiveTab('ops')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              activeTab === 'ops'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Ops & HSM Vault</span>
          </button>

          <button
            id="tab-qa-btn"
            onClick={() => setActiveTab('qa')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              activeTab === 'qa'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>QA & 3-Way Recon</span>
          </button>

          <button
            id="tab-architecture-btn"
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              activeTab === 'architecture'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Hexagonal / Java 26 Specs</span>
          </button>
        </nav>

        <div className="hidden lg:flex items-center gap-4 text-[10px] font-mono text-slate-400">
          <span>ISO 8583:1987 (Port 9800)</span>
          <span>•</span>
          <span>NPCI UPI 2.0 (HTTPS/JSON)</span>
          <span>•</span>
          <span>ISO 20022 XML Engine</span>
        </div>
      </div>
    </header>
  );
};
