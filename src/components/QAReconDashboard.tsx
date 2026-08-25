import React, { useState, useEffect } from 'react';
import { CheckCircle2, Play, RefreshCw, FileText, Download, AlertTriangle, ShieldCheck, Layers, Code, ArrowRight, Check, X } from 'lucide-react';
import { ReconBatchSummary, ReconRecord, TransactionRecord } from '../types/payment';

interface QAReconDashboardProps {
  transactions: TransactionRecord[];
  onRefresh: () => void;
}

export const QAReconDashboard: React.FC<QAReconDashboardProps> = ({ transactions, onRefresh }) => {
  const [qaSubTab, setQaSubTab] = useState<'RECON' | 'TEST_SUITE' | 'ISO20022_MAPPER'>('RECON');

  // Recon State
  const [batches, setBatches] = useState<ReconBatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchRecords, setBatchRecords] = useState<ReconRecord[]>([]);
  const [ttumContent, setTtumContent] = useState<string>('');
  const [isRunningRecon, setIsRunningRecon] = useState(false);

  // Test Suite State
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Mapper State
  const [sampleIsoText, setSampleIsoText] = useState('020072380000080000000216607412345678901200000000249900082414120510045014120508242812541105100423819002150TID_01  MID_TATA_01    Tata Star Bazaar Andheri East IN        356');
  const [mappedXml, setMappedXml] = useState<string>('');

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/reconciliation/batches');
      const data = await res.json();
      setBatches(data);
      if (data.length > 0 && !selectedBatchId) {
        selectBatch(data[0].batchId);
      }
    } catch (err) {
      console.error('Failed to fetch batches', err);
    }
  };

  const selectBatch = async (batchId: string) => {
    setSelectedBatchId(batchId);
    try {
      const [recRes, ttumRes] = await Promise.all([
        fetch(`/api/reconciliation/records/${batchId}`),
        fetch(`/api/reconciliation/ttum/${batchId}`)
      ]);
      const recData = await recRes.json();
      const ttumData = await ttumRes.text();
      setBatchRecords(recData);
      setTtumContent(ttumData);
    } catch (err) {
      console.error('Failed to fetch batch details', err);
    }
  };

  const handleRunReconciliation = async () => {
    setIsRunningRecon(true);
    try {
      const res = await fetch('/api/reconciliation/run', { method: 'POST' });
      const data = await res.json();
      await fetchBatches();
      if (data.batch) {
        selectBatch(data.batch.batchId);
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to run reconciliation', err);
    } finally {
      setIsRunningRecon(false);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/qa/run-tests', { method: 'POST' });
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      console.error('Failed to run tests', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleConvertIsoTo20022 = async () => {
    try {
      const res = await fetch('/api/iso8583/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawMessage: sampleIsoText.trim() })
      });
      const data = await res.json();
      setMappedXml(data.iso20022Xml || 'No ISO 20022 mapping output');
    } catch (err) {
      console.error('Error translating ISO 8583 to ISO 20022', err);
    }
  };

  const handleDownloadTTUM = () => {
    if (!ttumContent) return;
    const blob = new Blob([ttumContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TTUM_SETTLEMENT_${selectedBatchId || 'BATCH'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3.5">
      {/* Navigation Sub-tabs */}
      <div className="bg-white rounded border border-slate-200 shadow-xs px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          <button
            id="qa-subtab-recon-btn"
            onClick={() => setQaSubTab('RECON')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              qaSubTab === 'RECON'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            3-Way Recon & TTUM
          </button>
          <button
            id="qa-subtab-tests-btn"
            onClick={() => setQaSubTab('TEST_SUITE')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              qaSubTab === 'TEST_SUITE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Automated QA Suite
          </button>
          <button
            id="qa-subtab-mapper-btn"
            onClick={() => setQaSubTab('ISO20022_MAPPER')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              qaSubTab === 'ISO20022_MAPPER'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            ISO 8583 ↔ ISO 20022 Mapper
          </button>
        </div>

        {qaSubTab === 'RECON' && (
          <button
            id="run-recon-job-btn"
            disabled={isRunningRecon}
            onClick={handleRunReconciliation}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
          >
            {isRunningRecon ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Running 3-Way Match...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>Execute Settlement Batch</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* SubTab 1: 3-Way Reconciliation */}
      {qaSubTab === 'RECON' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Batches List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white rounded border border-slate-200 shadow-xs p-3 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Reconciliation Batches</h3>
              <div className="space-y-1.5">
                {batches.map(b => (
                  <div
                    key={b.batchId}
                    onClick={() => selectBatch(b.batchId)}
                    className={`p-2.5 rounded border text-xs cursor-pointer transition-all ${
                      selectedBatchId === b.batchId
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-500 font-medium'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="font-mono text-xs">{b.batchId}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {b.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-600 font-mono">
                      Matched: <strong>{b.threeWayMatchedCount}</strong>/{b.totalTransactions} | Vol: ₹{b.threeWayMatchedVolume.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">Date: {b.runDate}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Batch Details & TTUM Viewer */}
          <div className="lg:col-span-8 space-y-3">
            {/* TTUM Accounting Voucher Section */}
            <div className="bg-slate-900 rounded p-3 border border-slate-700 text-white space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Finacle / CBS TTUM Voucher</h4>
                </div>
                <button
                  id="download-ttum-btn"
                  onClick={handleDownloadTTUM}
                  className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-all"
                >
                  <Download className="w-3 h-3" />
                  <span>Download TTUM</span>
                </button>
              </div>

              <pre className="p-2 bg-slate-950 rounded font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-44 leading-tight border border-slate-800">
                {ttumContent || 'Select a batch to inspect TTUM voucher entries.'}
              </pre>
            </div>

            {/* 3-Way Match Records Table */}
            <div className="bg-white rounded border border-slate-200 shadow-xs p-3 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Itemized 3-Way Recon Grid</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-2.5 py-1.5">RRN</th>
                      <th className="px-2.5 py-1.5 text-right">Switch (₹)</th>
                      <th className="px-2.5 py-1.5 text-right">Network (₹)</th>
                      <th className="px-2.5 py-1.5 text-right">CBS Bank (₹)</th>
                      <th className="px-2.5 py-1.5 text-center">Status</th>
                      <th className="px-2.5 py-1.5 font-sans">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {batchRecords.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-2.5 py-1.5 font-bold text-slate-900">{r.rrn}</td>
                        <td className="px-2.5 py-1.5 text-right text-slate-800 font-semibold">{r.switchAmount.toFixed(2)}</td>
                        <td className="px-2.5 py-1.5 text-right text-slate-600">{r.networkAmount ? r.networkAmount.toFixed(2) : <span className="text-rose-500">MISSING</span>}</td>
                        <td className="px-2.5 py-1.5 text-right text-slate-600">{r.bankAmount ? r.bankAmount.toFixed(2) : <span className="text-rose-500">MISSING</span>}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              r.matchStatus === '3_WAY_MATCHED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {r.matchStatus}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 text-slate-700 font-sans text-xs">
                          {r.resolution}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: Automated Test Suite */}
      {qaSubTab === 'TEST_SUITE' && (
        <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Switch & Crypto Test Suite</h3>
              <p className="text-[11px] text-slate-500">
                Executes EMV ARQC, ISO-0 PIN translation, 0420 Reversals, Fraud scoring, and 3-Way Recon validations
              </p>
            </div>

            <button
              id="run-all-tests-btn"
              disabled={isRunningTests}
              onClick={handleRunTests}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
            >
              {isRunningTests ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing Test Cases...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Run All Test Cases</span>
                </>
              )}
            </button>
          </div>

          {testResults ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-center">
                  <div className="text-lg font-bold font-mono text-slate-900">{testResults.total}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Total Scenarios</div>
                </div>
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-lg font-bold font-mono text-emerald-600">{testResults.passed}</div>
                  <div className="text-[10px] text-emerald-700 uppercase font-bold">Passed (100%)</div>
                </div>
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-center">
                  <div className="text-lg font-bold font-mono text-rose-600">{testResults.failed}</div>
                  <div className="text-[10px] text-rose-700 uppercase font-bold">Failed</div>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded overflow-hidden">
                {testResults.tests.map((t: any) => (
                  <div key={t.testId} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                        <Check className="w-3 h-3" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="font-mono text-slate-500 text-[10px]">[{t.testId}]</span>
                          <span>{t.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">{t.details}</p>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[10px] text-slate-500">
                      {t.executionMs} ms
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded p-6 border border-dashed border-slate-300 text-center space-y-1.5">
              <CheckCircle2 className="w-6 h-6 text-slate-400 mx-auto" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Test Harness Ready</h4>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Click "Run All Test Cases" to execute the complete end-to-end switch test suite.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: ISO 8583 to ISO 20022 Mapper */}
      {qaSubTab === 'ISO20022_MAPPER' && (
        <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">ISO 8583:1987 ↔ ISO 20022 (pacs.008 / pacs.002) Mapper</h3>
            <p className="text-[11px] text-slate-500">
              Converts legacy card wire packets to ISO 20022 XML messages with zero-reflection MapStruct engine.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Source ISO 8583 Raw Message String</label>
              <textarea
                rows={6}
                value={sampleIsoText}
                onChange={e => setSampleIsoText(e.target.value)}
                className="w-full p-2 bg-slate-950 font-mono text-[11px] text-sky-300 rounded border border-slate-800 focus:outline-blue-500"
              />
              <button
                id="convert-iso-btn"
                onClick={handleConvertIsoTo20022}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Map to ISO 20022 pacs.008 XML</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Generated ISO 20022 XML Document</label>
              <pre className="p-2 bg-slate-950 font-mono text-[10px] text-emerald-400 rounded border border-slate-800 overflow-x-auto max-h-56 leading-tight">
                {mappedXml || 'Click "Map to ISO 20022" to generate structured pacs.008 XML.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
