import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, RefreshCw, Cpu, ShieldCheck, FileText, Code, Copy, Check } from 'lucide-react';
import { TransactionRecord } from '../types/payment';

interface TransactionDetailModalProps {
  transaction: TransactionRecord | null;
  onClose: () => void;
  onTriggerReversal: (rrn: string) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onTriggerReversal
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ISO_FIELDS' | 'EMV_TAG55' | 'RAW_JSON'>('OVERVIEW');
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(transaction, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-300 overflow-hidden">
        {/* Header */}
        <div className="px-3.5 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded flex items-center justify-center font-bold ${
                transaction.status === 'CAPTURED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : transaction.status === 'REVERSED'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {transaction.status === 'CAPTURED' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : transaction.status === 'REVERSED' ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-slate-900">RRN: {transaction.rrn}</h3>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                    transaction.status === 'CAPTURED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : transaction.status === 'REVERSED'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {transaction.status}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                STAN: {transaction.stan} | TID: {transaction.terminalId} | {transaction.createdAt.replace('T', ' ').substring(0, 19)} IST
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {transaction.status === 'CAPTURED' && (
              <button
                onClick={() => onTriggerReversal(transaction.rrn)}
                className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reverse (0420)</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Sub-Tabs */}
        <div className="px-3.5 pt-2 border-b border-slate-200 flex gap-3 text-xs font-semibold bg-slate-50/50">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`pb-1.5 transition-colors border-b-2 text-xs ${
              activeTab === 'OVERVIEW'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Overview & Settlement
          </button>
          <button
            onClick={() => setActiveTab('ISO_FIELDS')}
            className={`pb-1.5 transition-colors border-b-2 text-xs ${
              activeTab === 'ISO_FIELDS'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            ISO 8583 ({transaction.rawIsoFields ? Object.keys(transaction.rawIsoFields).length : 0})
          </button>
          <button
            onClick={() => setActiveTab('EMV_TAG55')}
            className={`pb-1.5 transition-colors border-b-2 text-xs ${
              activeTab === 'EMV_TAG55'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            EMV Tag 55
          </button>
          <button
            onClick={() => setActiveTab('RAW_JSON')}
            className={`pb-1.5 transition-colors border-b-2 text-xs ${
              activeTab === 'RAW_JSON'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Raw JSON Audit
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 overflow-y-auto space-y-3 flex-1 text-xs">
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-3">
              {/* Financial Ledger Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Gross Amount</div>
                  <div className="text-sm font-bold font-mono text-slate-900">₹{transaction.amount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">MDR Deducted</div>
                  <div className="text-sm font-bold font-mono text-slate-700">₹{transaction.mdrAmount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">GST on MDR (18%)</div>
                  <div className="text-sm font-bold font-mono text-slate-700">₹{transaction.gstAmount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Net Payout</div>
                  <div className="text-sm font-bold font-mono text-emerald-600">₹{transaction.netPayout.toFixed(2)}</div>
                </div>
              </div>

              {/* Core Attributes Table */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2.5 rounded border border-slate-200 space-y-0.5">
                  <div className="text-slate-500 uppercase font-bold">Merchant Name & MID</div>
                  <div className="font-bold text-slate-900 text-xs">{transaction.merchantName}</div>
                  <div className="text-slate-500 font-mono">MID: {transaction.merchantId} | MCC: {transaction.mcc}</div>
                </div>

                <div className="p-2.5 rounded border border-slate-200 space-y-0.5">
                  <div className="text-slate-500 uppercase font-bold">Payment Instrument</div>
                  <div className="font-bold text-slate-900 text-xs">
                    {transaction.cardNumberMasked || transaction.vpa} ({transaction.cardBrand})
                  </div>
                  <div className="text-slate-500 font-mono">Auth: {transaction.authCode || 'N/A'} | {transaction.responseMessage}</div>
                </div>
              </div>

              {/* Fraud Evaluation Summary */}
              {transaction.fraudScore !== undefined && (
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1 font-bold text-slate-900 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Real-time Risk & Fraud Evaluation</span>
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    Score: <strong>{transaction.fraudScore}/100</strong> | Decision: <strong className="text-emerald-700">{transaction.fraudDecision}</strong>
                  </div>
                  {transaction.fraudReasons && transaction.fraudReasons.length > 0 && (
                    <div className="text-[9px] text-slate-500 font-mono">
                      Signals: {transaction.fraudReasons.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ISO_FIELDS' && (
            <div className="space-y-2">
              <div className="text-[10px] text-slate-500 font-mono">
                MTI: <strong>{transaction.mti}</strong> | Bitmap Elements Unpacked:
              </div>
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-2.5 py-1">Field #</th>
                      <th className="px-2.5 py-1 font-sans">Name</th>
                      <th className="px-2.5 py-1">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {transaction.rawIsoFields &&
                      Object.entries(transaction.rawIsoFields).map(([fNum, fVal]) => (
                        <tr key={fNum} className="hover:bg-slate-50">
                          <td className="px-2.5 py-1 font-bold text-slate-900">Field {fNum}</td>
                          <td className="px-2.5 py-1 text-slate-500 font-sans text-xs">
                            {fNum === '2' ? 'PAN' : fNum === '3' ? 'Processing Code' : fNum === '4' ? 'Amount' : fNum === '11' ? 'STAN' : fNum === '37' ? 'RRN' : fNum === '55' ? 'EMV Tag 55' : 'ISO Element ' + fNum}
                          </td>
                          <td className="px-2.5 py-1 text-slate-800 break-all">{fVal}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'EMV_TAG55' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                <span>EMV 4.3 ICC Tag 55 TLV Structures</span>
              </div>

              {transaction.emvData ? (
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-sans">Tag 9F26 (ARQC):</span>
                    <div className="font-bold text-slate-900">{transaction.emvData.arqc}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-sans">Tag 9F36 (ATC):</span>
                    <div className="font-bold text-slate-900">{transaction.emvData.atc}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-sans">Tag 9F37 (Unpredictable No):</span>
                    <div className="font-bold text-slate-900">{transaction.emvData.unpredictableNumber}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-sans">Tag 95 (TVR):</span>
                    <div className="font-bold text-slate-900">{transaction.emvData.tvr}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-sans">Tag 82 (AIP):</span>
                    <div className="font-bold text-slate-900">{transaction.emvData.aip}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-sans">Tag 9F10 (IAD):</span>
                    <div className="font-bold text-slate-900">{transaction.emvData.iad}</div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded bg-slate-50 text-slate-500 text-center text-xs">
                  No EMV Tag 55 data (Non-ICC / UPI transaction).
                </div>
              )}
            </div>
          )}

          {activeTab === 'RAW_JSON' && (
            <div className="space-y-1.5">
              <div className="flex justify-end">
                <button
                  onClick={handleCopy}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 font-sans"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-2.5 bg-slate-950 rounded font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-60 leading-tight">
                {JSON.stringify(transaction, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
