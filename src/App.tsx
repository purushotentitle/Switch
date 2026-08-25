import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SimulatorDashboard } from './components/SimulatorDashboard';
import { MerchantDashboard } from './components/MerchantDashboard';
import { OpsDashboard } from './components/OpsDashboard';
import { QAReconDashboard } from './components/QAReconDashboard';
import { ArchitectureDashboard } from './components/ArchitectureDashboard';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { DisputeRecord, SwitchMetrics, TransactionRecord, WebhookEvent } from './types/payment';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'merchant' | 'ops' | 'qa' | 'architecture'>('simulator');
  const [connectedWs, setConnectedWs] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);

  // Switch Live State
  const [metrics, setMetrics] = useState<SwitchMetrics>({
    currentTps: 18.4,
    peakTps: 142.0,
    avgLatencyMs: 4.8,
    p95LatencyMs: 14.2,
    p99LatencyMs: 24.5,
    successRate: 99.85,
    activeTcpConnections: 12,
    hsmOpsPerSec: 1450,
    dailyCapturedVolume: 12450000.0,
    dailyTransactionCount: 48920
  });

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);

  // Fetch initial switch snapshot
  const loadSwitchData = async () => {
    try {
      const [mRes, tRes, dRes, wRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/transactions'),
        fetch('/api/disputes'),
        fetch('/api/webhooks')
      ]);

      if (mRes.ok) setMetrics(await mRes.json());
      if (tRes.ok) setTransactions(await tRes.json());
      if (dRes.ok) setDisputes(await dRes.json());
      if (wRes.ok) setWebhooks(await wRes.json());
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  };

  useEffect(() => {
    loadSwitchData();

    // Setup WebSocket connection for live telemetry
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnectedWs(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'INITIAL_STATE') {
            if (msg.payload.metrics) setMetrics(msg.payload.metrics);
            if (msg.payload.transactions) setTransactions(msg.payload.transactions);
          } else if (msg.type === 'TRANSACTION_PROCESSED' || msg.type === 'TRANSACTION_REVERSED') {
            const newTxn: TransactionRecord = msg.payload;
            setTransactions(prev => {
              const existingIdx = prev.findIndex(t => t.rrn === newTxn.rrn);
              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = newTxn;
                return updated;
              }
              return [newTxn, ...prev];
            });

            // Re-fetch metrics & webhooks
            fetch('/api/metrics').then(r => r.json()).then(setMetrics).catch(() => {});
            fetch('/api/webhooks').then(r => r.json()).then(setWebhooks).catch(() => {});
          } else if (msg.type === 'METRICS_UPDATE') {
            setMetrics(msg.payload);
          }
        } catch (e) {
          console.error('WS Parse Error', e);
        }
      };

      ws.onclose = () => {
        setConnectedWs(false);
      };
    } catch (err) {
      console.error('WS Connection Error', err);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleTransactionComplete = (txn: TransactionRecord) => {
    setTransactions(prev => {
      const idx = prev.findIndex(t => t.rrn === txn.rrn);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = txn;
        return copy;
      }
      return [txn, ...prev];
    });
    loadSwitchData();
  };

  const handleTriggerReversal = async (rrn: string) => {
    try {
      const res = await fetch('/api/reversal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rrn, reason: 'Operator Portal Reversal' })
      });
      const data = await res.json();
      if (selectedTransaction && selectedTransaction.rrn === rrn) {
        setSelectedTransaction(data);
      }
      handleTransactionComplete(data);
    } catch (err) {
      console.error('Reversal failed', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Header & High-Density Nav */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        metrics={metrics}
        connectedWs={connectedWs}
        onRefresh={loadSwitchData}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-4 py-3.5">
        {activeTab === 'simulator' && (
          <SimulatorDashboard onTransactionComplete={handleTransactionComplete} />
        )}

        {activeTab === 'merchant' && (
          <MerchantDashboard
            transactions={transactions}
            disputes={disputes}
            webhooks={webhooks}
            onSelectTransaction={setSelectedTransaction}
            onTriggerReversal={handleTriggerReversal}
            onRefresh={loadSwitchData}
          />
        )}

        {activeTab === 'ops' && (
          <OpsDashboard metrics={metrics} onRefresh={loadSwitchData} />
        )}

        {activeTab === 'qa' && (
          <QAReconDashboard transactions={transactions} onRefresh={loadSwitchData} />
        )}

        {activeTab === 'architecture' && <ArchitectureDashboard />}
      </main>

      {/* High-Density Footer Strip */}
      <footer className="bg-white border-t border-slate-200 py-2.5 px-4 text-[11px] text-slate-500 shrink-0">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">IndiSwitch 2026 Core</span>
            <span className="text-slate-300">•</span>
            <span>NPCI UPI 2.0 & ISO 8583 / ISO 20022 Hybrid Switch</span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">ISO/IEC 9797-1 Retail MAC</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
            <span className="text-emerald-600 font-medium">SoftHSM2 PKCS#11 UP</span>
            <span>•</span>
            <span>PostgreSQL 16 (Flyway)</span>
            <span>•</span>
            <span>Spring Batch 5 EOD Recon</span>
          </div>
        </div>
      </footer>

      {/* Transaction Inspection Modal */}
      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onTriggerReversal={handleTriggerReversal}
        />
      )}
    </div>
  );
}
