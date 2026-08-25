import React, { useState, useEffect } from 'react';
import { CreditCard, QrCode, Send, RefreshCw, Cpu, ShieldCheck, CheckCircle, AlertTriangle, ArrowRight, Lock, Eye, Copy, Zap } from 'lucide-react';
import { ISOMessage, TransactionRecord, UpiQRData } from '../types/payment';

interface SimulatorDashboardProps {
  onTransactionComplete: (txn: TransactionRecord) => void;
}

export const SimulatorDashboard: React.FC<SimulatorDashboardProps> = ({ onTransactionComplete }) => {
  const [simMode, setSimMode] = useState<'CARD_ISO' | 'UPI_QR'>('CARD_ISO');

  // Card Simulator State
  const [cardProfile, setCardProfile] = useState<'RUPAY_EMV' | 'VISA_NFC' | 'MC_MAGSTRIPE'>('RUPAY_EMV');
  const [pan, setPan] = useState('6074123456789012');
  const [amountINR, setAmountINR] = useState('2499.00');
  const [pin, setPin] = useState('1234');
  const [merchantName, setMerchantName] = useState('Tata Star Bazaar Andheri');
  const [mcc, setMcc] = useState('5411');
  const [terminalId, setTerminalId] = useState('TID_MUM_101');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawPayloadInput, setRawPayloadInput] = useState('');
  const [lastIsoResponse, setLastIsoResponse] = useState<any>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // UPI Simulator State
  const [upiVpa, setUpiVpa] = useState('merchant.tata@hdfcbank');
  const [upiMerchantName, setUpiMerchantName] = useState('Tata Star Bazaar Andheri East');
  const [upiMcc, setUpiMcc] = useState('5411');
  const [upiAmount, setUpiAmount] = useState('850.00');
  const [upiNote, setUpiNote] = useState('Organic Groceries Order #4819');
  const [generatedQR, setGeneratedQR] = useState<UpiQRData | null>(null);
  const [payerVpa, setPayerVpa] = useState('rohit.sharma@okhdfcbank');
  const [payerName, setPayerName] = useState('Rohit Sharma');
  const [upiPaying, setUpiPaying] = useState(false);
  const [upiSuccessTxn, setUpiSuccessTxn] = useState<TransactionRecord | null>(null);

  // Load sample ISO on mount or profile change
  useEffect(() => {
    loadSamplePayload(cardProfile);
  }, [cardProfile]);

  const loadSamplePayload = async (profile: 'RUPAY_EMV' | 'VISA_NFC' | 'MC_MAGSTRIPE') => {
    let mode = 'EMV_CHIP';
    let selectedPan = '6074123456789012';
    if (profile === 'VISA_NFC') {
      mode = 'CONTACTLESS';
      selectedPan = '4532019876543210';
    } else if (profile === 'MC_MAGSTRIPE') {
      mode = 'MAGSTRIPE';
      selectedPan = '5241890123456789';
    }
    setPan(selectedPan);

    try {
      const amountPaise = (parseFloat(amountINR || '100') * 100).toString();
      const res = await fetch(`/api/iso8583/sample?mode=${mode}&pan=${selectedPan}&amount=${amountPaise}`);
      const data = await res.json();
      setRawPayloadInput(data.packedString);
    } catch (err) {
      console.error('Failed to load sample', err);
    }
  };

  const handleTransmitISO = async () => {
    if (!rawPayloadInput.trim()) return;
    setIsProcessing(true);
    setLastIsoResponse(null);

    try {
      const res = await fetch('/api/iso8583/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawMessage: rawPayloadInput.trim() })
      });
      const data = await res.json();
      setLastIsoResponse(data);
      if (data.transactionRecord) {
        onTransactionComplete(data.transactionRecord);
      }
    } catch (err) {
      console.error('Error processing ISO transaction', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateUPIQR = async () => {
    try {
      const res = await fetch('/api/upi/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vpa: upiVpa,
          merchantName: upiMerchantName,
          mcc: upiMcc,
          amount: parseFloat(upiAmount),
          note: upiNote
        })
      });
      const data = await res.json();
      setGeneratedQR(data);
      setUpiSuccessTxn(null);
    } catch (err) {
      console.error('Failed to generate UPI QR', err);
    }
  };

  const handleSimulateUPIPay = async () => {
    if (!generatedQR) return;
    setUpiPaying(true);
    try {
      const res = await fetch('/api/upi/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrId: generatedQR.qrId,
          payerVpa,
          payerName,
          amount: generatedQR.amount,
          txnRef: generatedQR.txnRef
        })
      });
      const data = await res.json();
      setUpiSuccessTxn(data);
      onTransactionComplete(data);
    } catch (err) {
      console.error('Failed UPI payment simulation', err);
    } finally {
      setUpiPaying(false);
    }
  };

  const handleTriggerReversal = async (rrn: string) => {
    try {
      const res = await fetch('/api/reversal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rrn, reason: 'Simulated POS Cancel Button' })
      });
      const data = await res.json();
      if (lastIsoResponse && lastIsoResponse.transactionRecord) {
        setLastIsoResponse({
          ...lastIsoResponse,
          transactionRecord: data
        });
      }
      onTransactionComplete(data);
    } catch (err) {
      console.error('Failed to trigger reversal', err);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Top High Density Banner & Mode Switcher */}
      <div className="bg-white rounded border border-slate-200 shadow-xs px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600/10 text-blue-600 rounded flex items-center justify-center font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment Simulator & Inbound Engine</h2>
              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-mono border border-slate-200">ISO-8583 / UPI-2.0</span>
            </div>
            <p className="text-[11px] text-slate-500">Inject ISO 8583 TCP raw packets or simulate NPCI UPI 2.0 dynamic scan-and-pay transactions</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
          <button
            id="sim-mode-card-btn"
            onClick={() => setSimMode('CARD_ISO')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              simMode === 'CARD_ISO'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>ISO 8583 POS Terminal</span>
          </button>
          <button
            id="sim-mode-upi-btn"
            onClick={() => setSimMode('UPI_QR')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              simMode === 'UPI_QR'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>UPI 2.0 Dynamic QR</span>
          </button>
        </div>
      </div>

      {simMode === 'CARD_ISO' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Terminal Controls Panel */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Terminal Configuration</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Mode: {cardProfile === 'RUPAY_EMV' ? '051 (EMV Chip)' : cardProfile === 'VISA_NFC' ? '071 (Contactless)' : '021 (Magstripe)'}
                </span>
              </div>

              {/* Card Profile Buttons */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Card Profile Preset</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    id="preset-rupay-btn"
                    onClick={() => setCardProfile('RUPAY_EMV')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded border text-center transition-all ${
                      cardProfile === 'RUPAY_EMV'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-700 font-bold ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    RuPay EMV Chip
                  </button>
                  <button
                    id="preset-visa-btn"
                    onClick={() => setCardProfile('VISA_NFC')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded border text-center transition-all ${
                      cardProfile === 'VISA_NFC'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-700 font-bold ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Visa Contactless
                  </button>
                  <button
                    id="preset-mc-btn"
                    onClick={() => setCardProfile('MC_MAGSTRIPE')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded border text-center transition-all ${
                      cardProfile === 'MC_MAGSTRIPE'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-700 font-bold ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    MC Magstripe
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Primary Account Number (Field 2)</label>
                  <input
                    id="sim-pan-input"
                    type="text"
                    value={pan}
                    onChange={e => setPan(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900 focus:bg-white focus:outline-blue-500"
                    placeholder="16 or 19 digit PAN"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Amount (₹ INR)</label>
                  <div className="relative mt-0.5">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">₹</span>
                    <input
                      id="sim-amount-input"
                      type="number"
                      value={amountINR}
                      onChange={e => setAmountINR(e.target.value)}
                      className="w-full pl-6 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">PIN (ISO-0 Block)</label>
                  <div className="relative mt-0.5">
                    <Lock className="w-3 h-3 absolute left-2.5 top-2 text-slate-400" />
                    <input
                      id="sim-pin-input"
                      type="password"
                      maxLength={4}
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900 focus:bg-white focus:outline-blue-500"
                      placeholder="1234"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Merchant Name (Field 43)</label>
                  <input
                    id="sim-merchant-input"
                    type="text"
                    value={merchantName}
                    onChange={e => setMerchantName(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:bg-white focus:outline-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">MCC / TID</label>
                  <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                    <input
                      id="sim-mcc-input"
                      type="text"
                      value={mcc}
                      onChange={e => setMcc(e.target.value)}
                      className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900"
                      placeholder="5411"
                    />
                    <input
                      id="sim-tid-input"
                      type="text"
                      value={terminalId}
                      onChange={e => setTerminalId(e.target.value)}
                      className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900"
                      placeholder="TID_01"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex items-center gap-2">
                <button
                  id="rebuild-payload-btn"
                  onClick={() => loadSamplePayload(cardProfile)}
                  className="px-2.5 py-1.5 rounded border border-slate-300 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1"
                  title="Re-pack fresh ISO packet"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Rebuild</span>
                </button>

                <button
                  id="transmit-iso-btn"
                  disabled={isProcessing}
                  onClick={handleTransmitISO}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Transmitting via TCP Socket...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send ISO 8583 (0200 Purchase)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Test Scenarios */}
            <div className="bg-slate-900 rounded p-3 text-white space-y-2 border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Fast Test Injections</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  id="scenario-reversal-btn"
                  onClick={async () => {
                    const res = await fetch(`/api/iso8583/sample?mode=REVERSAL_0420&pan=${pan}&amount=250000`);
                    const data = await res.json();
                    setRawPayloadInput(data.packedString);
                  }}
                  className="p-2 bg-slate-800/90 hover:bg-slate-700/90 rounded text-left border border-slate-700 transition-colors"
                >
                  <div className="font-semibold text-amber-400 text-xs">0420 Reversal</div>
                  <div className="text-[10px] text-slate-400 font-mono">Timeout rollback</div>
                </button>

                <button
                  id="scenario-echo-btn"
                  onClick={async () => {
                    const res = await fetch(`/api/iso8583/sample?mode=ECHO_0800`);
                    const data = await res.json();
                    setRawPayloadInput(data.packedString);
                  }}
                  className="p-2 bg-slate-800/90 hover:bg-slate-700/90 rounded text-left border border-slate-700 transition-colors"
                >
                  <div className="font-semibold text-sky-400 text-xs">0800 Echo Test</div>
                  <div className="text-[10px] text-slate-400 font-mono">Network Logon ping</div>
                </button>
              </div>
            </div>
          </div>

          {/* Raw Wire Packet & Switch Response Inspector */}
          <div className="lg:col-span-7 space-y-3">
            {/* Raw Inbound Message Box */}
            <div className="bg-slate-900 rounded p-3 text-white border border-slate-700 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono">Inbound TCP Stream Buffer (ISO-8583)</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rawPayloadInput);
                    setCopiedRaw(true);
                    setTimeout(() => setCopiedRaw(false), 2000);
                  }}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-mono"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedRaw ? 'Copied!' : 'Copy Wire Payload'}</span>
                </button>
              </div>

              <textarea
                id="raw-iso-textarea"
                rows={3}
                value={rawPayloadInput}
                onChange={e => setRawPayloadInput(e.target.value)}
                className="w-full bg-slate-950 p-2 rounded font-mono text-[11px] text-sky-300 border border-slate-800 focus:outline-none focus:border-sky-500"
                placeholder="02007238000008000000..."
              />
              <div className="text-[10px] text-slate-400 font-mono">
                Format: <strong>MTI (4 bytes) + Primary/Secondary Hex Bitmap (16/32 chars) + Packed Data Elements</strong>
              </div>
            </div>

            {/* Live Response Panel */}
            {lastIsoResponse ? (
              <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    {lastIsoResponse.transactionRecord?.status === 'CAPTURED' || lastIsoResponse.transactionRecord?.status === 'AUTHORIZED' ? (
                      <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </div>
                    ) : lastIsoResponse.transactionRecord?.status === 'REVERSED' ? (
                      <div className="w-5 h-5 rounded bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {lastIsoResponse.responseISO?.mti} Response: {lastIsoResponse.transactionRecord?.responseMessage} (RC {lastIsoResponse.transactionRecord?.responseCode})
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono">
                        RRN: {lastIsoResponse.transactionRecord?.rrn} | STAN: {lastIsoResponse.transactionRecord?.stan} | AuthCode: {lastIsoResponse.transactionRecord?.authCode || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {lastIsoResponse.transactionRecord?.status === 'CAPTURED' && (
                    <button
                      id="response-trigger-reversal-btn"
                      onClick={() => handleTriggerReversal(lastIsoResponse.transactionRecord.rrn)}
                      className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Trigger 0420 Reversal</span>
                    </button>
                  )}
                </div>

                {/* Cryptographic & Risk Diagnostic Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* SoftHSM2 ARQC & ARPC Card */}
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-1 text-indigo-700 font-bold text-xs uppercase">
                      <Cpu className="w-3 h-3" />
                      <span>SoftHSM2 ARQC Cryptogram</span>
                    </div>
                    {lastIsoResponse.arqcValidation ? (
                      <div className="space-y-0.5 font-mono text-[10px] text-slate-600">
                        <div>Status: <span className="text-emerald-600 font-bold">VALIDATED (Match OK)</span></div>
                        <div>Received ARQC: <span className="text-slate-900 font-bold">{lastIsoResponse.arqcValidation.receivedARQC}</span></div>
                        <div>Calculated ARPC: <span className="text-indigo-600 font-bold">{lastIsoResponse.arqcValidation.arpc}</span></div>
                        <div>Session Key AC: <span className="text-slate-500">{lastIsoResponse.arqcValidation.sessionKeyAC.substring(0, 16)}...</span></div>
                        <div>HSM Bus Latency: <span className="text-slate-900">{lastIsoResponse.arqcValidation.hsmExecutionTimeMs} ms</span></div>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-[10px]">No Tag 55 EMV Cryptogram in this message.</p>
                    )}
                  </div>

                  {/* Fraud Engine Card */}
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-1 text-blue-700 font-bold text-xs uppercase">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Real-time Fraud Score</span>
                    </div>
                    {lastIsoResponse.fraudEvaluation ? (
                      <div className="space-y-0.5 text-[10px] text-slate-600">
                        <div>
                          Risk Score:{' '}
                          <strong className={lastIsoResponse.fraudEvaluation.riskScore > 50 ? 'text-rose-600' : 'text-emerald-600'}>
                            {lastIsoResponse.fraudEvaluation.riskScore} / 100
                          </strong>{' '}
                          ({lastIsoResponse.fraudEvaluation.decision})
                        </div>
                        <div>Decision: <strong className="text-slate-900">{lastIsoResponse.fraudEvaluation.decision}</strong></div>
                        <div className="text-slate-500">{lastIsoResponse.fraudEvaluation.reasons?.[0]}</div>
                        <div className="text-slate-500 font-mono">Latency: {lastIsoResponse.fraudEvaluation.latencyMs} ms</div>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-[10px]">Fraud score evaluated.</p>
                    )}
                  </div>
                </div>

                {/* ISO 20022 Pacs.008 Dual-Stack XML Preview */}
                {lastIsoResponse.iso20022Xml && (
                  <div className="bg-slate-950 p-2.5 rounded text-white space-y-1 border border-slate-800">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1">
                      <span className="font-bold text-sky-400 uppercase font-mono">ISO 20022 Dual-Stack XML (pacs.008.001.08)</span>
                      <span className="text-[9px]">MapStruct Engine</span>
                    </div>
                    <pre className="text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-28 p-1">
                      {lastIsoResponse.iso20022Xml}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded p-6 border border-dashed border-slate-300 text-center space-y-2">
                <Send className="w-6 h-6 text-slate-400 mx-auto" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Awaiting Transaction Transmission</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Click "Send ISO 8583" to simulate a real point-of-sale card transaction over the switch engine.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* UPI 2.0 Dynamic QR Simulator View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* QR Generator Controls */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <QrCode className="w-3.5 h-3.5 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Generate Dynamic NPCI UPI 2.0 QR</h3>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Merchant VPA (pa)</label>
                  <input
                    id="upi-vpa-input"
                    type="text"
                    value={upiVpa}
                    onChange={e => setUpiVpa(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Merchant Name (pn)</label>
                  <input
                    id="upi-name-input"
                    type="text"
                    value={upiMerchantName}
                    onChange={e => setUpiMerchantName(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Amount (₹ INR)</label>
                    <input
                      id="upi-amount-input"
                      type="number"
                      value={upiAmount}
                      onChange={e => setUpiAmount(e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">MCC (mc)</label>
                    <input
                      id="upi-mcc-input"
                      type="text"
                      value={upiMcc}
                      onChange={e => setUpiMcc(e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Note / Order Invoice (tn)</label>
                  <input
                    id="upi-note-input"
                    type="text"
                    value={upiNote}
                    onChange={e => setUpiNote(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900"
                  />
                </div>

                <button
                  id="generate-upi-qr-btn"
                  onClick={handleGenerateUPIQR}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Generate Signed Dynamic QR</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active QR & Mobile App Simulator */}
          <div className="lg:col-span-7 space-y-3">
            {generatedQR ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Physical/Screen QR Code Display */}
                <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 text-center space-y-3 flex flex-col items-center justify-center">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px] font-mono">NPCI UPI 2.0</span>
                    <span>{generatedQR.merchantName}</span>
                  </div>

                  <div className="p-2 bg-white border-2 border-slate-900 rounded shadow-inner">
                    <img src={generatedQR.qrDataUrl} alt="UPI Dynamic QR" className="w-40 h-40 rounded" />
                  </div>

                  <div className="text-xs font-mono text-slate-600">
                    <div className="text-sm font-bold text-slate-900">₹{generatedQR.amount.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400">Ref: {generatedQR.txnRef}</div>
                    <div className="mt-0.5 text-[11px]">
                      Status:{' '}
                      <span className={`font-bold ${generatedQR.status === 'PAID' ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {generatedQR.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer UPI App Simulator */}
                <div className="bg-slate-900 rounded p-3.5 border border-slate-700 text-white space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">UPI App Simulator</h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Payer Name</label>
                      <input
                        type="text"
                        value={payerName}
                        onChange={e => setPayerName(e.target.value)}
                        className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Payer VPA / Handle</label>
                      <input
                        type="text"
                        value={payerVpa}
                        onChange={e => setPayerVpa(e.target.value)}
                        className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white"
                      />
                    </div>

                    <div className="p-2 bg-slate-800/80 rounded space-y-0.5 text-[10px] font-mono">
                      <div className="text-slate-400">Amount: <strong className="text-emerald-400">₹{generatedQR.amount.toFixed(2)}</strong></div>
                      <div className="text-slate-400">Payee: <strong className="text-white">{generatedQR.vpa}</strong></div>
                      <div className="text-slate-400">Zero MDR Payout: <strong className="text-sky-300">₹{generatedQR.amount.toFixed(2)} (100%)</strong></div>
                    </div>

                    <button
                      id="simulate-upi-pay-btn"
                      disabled={upiPaying || generatedQR.status === 'PAID'}
                      onClick={handleSimulateUPIPay}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
                    >
                      {upiPaying ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Routing via NPCI Switch...</span>
                        </>
                      ) : generatedQR.status === 'PAID' ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Payment Completed (Captured)</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Simulate UPI PIN Debit & Pay</span>
                        </>
                      )}
                    </button>
                  </div>

                  {upiSuccessTxn && (
                    <div className="p-2 bg-emerald-950/70 border border-emerald-800 rounded text-emerald-300 text-[11px] space-y-0.5">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>Payment Approved: {upiSuccessTxn.authCode}</span>
                      </div>
                      <div className="text-[10px] text-emerald-400/80 font-mono">
                        RRN: {upiSuccessTxn.rrn} | Instant Webhook Dispatched
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded p-6 border border-dashed border-slate-300 text-center space-y-2">
                <QrCode className="w-6 h-6 text-slate-400 mx-auto" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Dynamic QR Ready to Generate</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Enter merchant details and click "Generate Signed Dynamic QR" to test the real-time UPI 2.0 flow.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
