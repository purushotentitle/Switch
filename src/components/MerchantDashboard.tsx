import React, { useState } from 'react';
import { Building2, Search, Filter, ArrowUpRight, ShieldAlert, CheckCircle2, AlertCircle, RefreshCw, FileText, Download, ExternalLink, Send, Zap } from 'lucide-react';
import { DisputeRecord, TransactionRecord, WebhookEvent } from '../types/payment';

interface MerchantDashboardProps {
  transactions: TransactionRecord[];
  disputes: DisputeRecord[];
  webhooks: WebhookEvent[];
  onSelectTransaction: (txn: TransactionRecord) => void;
  onTriggerReversal: (rrn: string) => void;
  onRefresh: () => void;
}

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({
  transactions,
  disputes,
  webhooks,
  onSelectTransaction,
  onTriggerReversal,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [subTab, setSubTab] = useState<'TRANSACTIONS' | 'DISPUTES' | 'WEBHOOKS'>('TRANSACTIONS');

  // Dispute creation modal / state
  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null);
  const [evidenceText, setEvidenceText] = useState('');
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);

  // Financial calculations
  const capturedTxns = transactions.filter(t => t.status === 'CAPTURED');
  const grossVolume = capturedTxns.reduce((sum, t) => sum + t.amount, 0);
  const totalMdr = capturedTxns.reduce((sum, t) => sum + t.mdrAmount, 0);
  const totalGst = capturedTxns.reduce((sum, t) => sum + t.gstAmount, 0);
  const netPayout = grossVolume - totalMdr - totalGst;
  const zeroMdrVolume = capturedTxns.filter(t => t.cardBrand === 'RuPay' || t.cardBrand === 'NPCI_UPI').reduce((sum, t) => sum + t.amount, 0);

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch =
      t.rrn.includes(searchTerm) ||
      t.stan.includes(searchTerm) ||
      t.merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.cardNumberMasked && t.cardNumberMasked.includes(searchTerm)) ||
      (t.vpa && t.vpa.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmitRepresentment = async (disputeId: string) => {
    if (!evidenceText.trim()) return;
    setIsSubmittingEvidence(true);
    try {
      await fetch('/api/disputes/represent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, evidenceText })
      });
      setSelectedDispute(null);
      setEvidenceText('');
      onRefresh();
    } catch (err) {
      console.error('Failed to submit representment', err);
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Merchant Financial Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Gross Settled Volume</span>
            <span className="px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[9px] border border-emerald-200">T+0/T+1</span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">₹{grossVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <p className="text-[10px] text-slate-500 font-mono">{capturedTxns.length} transactions processed today</p>
        </div>

        <div className="bg-white p-3 rounded border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Net Payout Disbursed</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-sky-500" />
          </div>
          <div className="text-lg font-bold font-mono text-sky-600">₹{netPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <p className="text-[10px] text-slate-500 font-mono">MDR: ₹{totalMdr.toFixed(2)} | GST: ₹{totalGst.toFixed(2)}</p>
        </div>

        <div className="bg-white p-3 rounded border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Zero MDR Volume</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-600">₹{zeroMdrVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <p className="text-[10px] text-emerald-600 font-mono">RuPay / UPI zero interchange</p>
        </div>

        <div className="bg-white p-3 rounded border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Active Chargebacks</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">{disputes.filter(d => d.status === 'OPEN').length} Cases</div>
          <p className="text-[10px] text-slate-500 font-mono">NPCI Dispute Cycle 2026</p>
        </div>
      </div>

      {/* Main Merchant Portal Content Box */}
      <div className="bg-white rounded border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Sub-tabs */}
        <div className="px-3.5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-1.5">
            <button
              id="subtab-transactions-btn"
              onClick={() => setSubTab('TRANSACTIONS')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                subTab === 'TRANSACTIONS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Live Ledger ({transactions.length})
            </button>
            <button
              id="subtab-disputes-btn"
              onClick={() => setSubTab('DISPUTES')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                subTab === 'DISPUTES'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Chargebacks ({disputes.length})
            </button>
            <button
              id="subtab-webhooks-btn"
              onClick={() => setSubTab('WEBHOOKS')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                subTab === 'WEBHOOKS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Webhook Logs ({webhooks.length})
            </button>
          </div>

          {subTab === 'TRANSACTIONS' && (
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-400" />
                <input
                  id="merchant-search-input"
                  type="text"
                  placeholder="Filter RRN, STAN, PAN..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-7 pr-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-blue-500 w-48 font-mono"
                />
              </div>

              {/* Status Filter */}
              <select
                id="merchant-status-filter"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-700 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="CAPTURED">Captured</option>
                <option value="AUTHORIZED">Authorized</option>
                <option value="REVERSED">Reversed</option>
                <option value="CHARGEBACK">Chargeback</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Live Transactions Table */}
        {subTab === 'TRANSACTIONS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">RRN / STAN</th>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Instrument</th>
                  <th className="px-3 py-2 text-right">Gross (INR)</th>
                  <th className="px-3 py-2 text-right">Net Payout</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredTransactions.map(txn => (
                  <tr key={txn.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-900 text-xs">{txn.rrn}</div>
                      <div className="text-[10px] text-slate-400">STAN: {txn.stan} | {txn.terminalId}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-[10px]">
                      {txn.createdAt.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="px-3 py-2 font-sans text-xs">
                      <span className="font-medium text-slate-900">
                        {txn.type === 'CARD_EMV' ? 'EMV Chip (051)' : txn.type === 'CARD_CONTACTLESS' ? 'NFC (071)' : txn.type === 'UPI_QR' ? 'UPI 2.0' : txn.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-700">
                      {txn.cardNumberMasked || txn.vpa || 'N/A'}
                      <span className="ml-1 text-[9px] font-sans font-semibold text-slate-500">({txn.cardBrand})</span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 text-xs">
                      ₹{txn.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-semibold text-xs">
                      ₹{txn.netPayout.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center font-sans">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          txn.status === 'CAPTURED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : txn.status === 'REVERSED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : txn.status === 'CHARGEBACK'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {txn.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right space-x-1.5 font-sans">
                      <button
                        onClick={() => onSelectTransaction(txn)}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-blue-600 font-semibold text-[10px] border border-slate-200"
                      >
                        Inspect
                      </button>
                      {txn.status === 'CAPTURED' && (
                        <button
                          onClick={() => onTriggerReversal(txn.rrn)}
                          className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-[10px] border border-amber-200"
                          title="Trigger 0420 Reversal"
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Disputes / Chargebacks */}
        {subTab === 'DISPUTES' && (
          <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">NPCI / Scheme Chargeback Cases</h3>
                <p className="text-[11px] text-slate-500">Manage representments, submit proof of delivery, and dispute resolutions</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {disputes.map(d => (
                <div key={d.id} className="p-3 rounded border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-mono text-[9px] font-bold border border-purple-200">
                        {d.caseNumber}
                      </span>
                      <span className="font-bold text-xs text-slate-900">Reason {d.reasonCode}</span>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                      {d.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">{d.reasonDescription}</p>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200">
                    <div>Dispute: <strong className="text-slate-900">₹{d.disputeAmount.toFixed(2)}</strong></div>
                    <div>RRN: <strong className="text-slate-900">{d.rrn}</strong></div>
                    <div>Brand: <strong>{d.cardBrand}</strong></div>
                    <div>Due: <strong className="text-rose-600">{d.dueDate}</strong></div>
                  </div>

                  {d.evidenceSubmitted ? (
                    <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px]">
                      <strong>Evidence Submitted:</strong> {d.evidenceSubmitted}
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedDispute(d)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-xs font-bold transition-all shadow-xs"
                    >
                      Submit Representment Evidence
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Representment Modal */}
            {selectedDispute && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded max-w-md w-full p-4 space-y-3 shadow-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Submit Representment: {selectedDispute.caseNumber}</h4>
                    <button onClick={() => setSelectedDispute(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="text-slate-600 text-[11px]">
                      Upload or specify merchant proof of delivery, POS signed electronic journal log, or customer signature.
                    </p>
                    <textarea
                      rows={3}
                      value={evidenceText}
                      onChange={e => setEvidenceText(e.target.value)}
                      placeholder="e.g. POS Signed Slip #9810, GPS Delivery Verification, OTP logs..."
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:outline-blue-500 font-mono text-[11px]"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => setSelectedDispute(null)}
                        className="px-3 py-1 rounded border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={isSubmittingEvidence || !evidenceText.trim()}
                        onClick={() => handleSubmitRepresentment(selectedDispute.id)}
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                      >
                        {isSubmittingEvidence ? 'Submitting...' : 'Submit to NPCI Queue'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Webhook Logs */}
        {subTab === 'WEBHOOKS' && (
          <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Merchant Event Webhooks</h3>
                <p className="text-[11px] text-slate-500">Real-time HMAC-SHA256 signed event notifications dispatched to merchant webhooks</p>
              </div>
            </div>

            <div className="space-y-2">
              {webhooks.map(wh => (
                <div key={wh.id} className="p-3 rounded border border-slate-700 bg-slate-900 text-white font-mono text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[9px] border border-emerald-500/30">
                        HTTP {wh.statusCode}
                      </span>
                      <span className="text-sky-400 font-bold text-[11px]">{wh.event}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{wh.lastAttemptAt.replace('T', ' ').substring(0, 19)}</span>
                  </div>

                  <div className="text-[10px] text-slate-400">
                    Signature: <span className="text-amber-300">{wh.signature.substring(0, 40)}...</span>
                  </div>

                  <pre className="bg-slate-950 p-2 rounded text-emerald-400 text-[10px] overflow-x-auto border border-slate-800 max-h-36">
                    {JSON.stringify(wh.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
