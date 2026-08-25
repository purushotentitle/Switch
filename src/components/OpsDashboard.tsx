import React, { useState } from 'react';
import { Server, Cpu, ShieldCheck, Activity, Key, Wifi, AlertTriangle, Play, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';
import { SwitchMetrics } from '../types/payment';

interface OpsDashboardProps {
  metrics: SwitchMetrics;
  onRefresh: () => void;
}

export const OpsDashboard: React.FC<OpsDashboardProps> = ({ metrics, onRefresh }) => {
  const [echoStatus, setEchoStatus] = useState<string | null>(null);
  const [isEchoing, setIsEchoing] = useState(false);

  // HSM Keys Mock Data from server API
  const hsmKeys = [
    { keyId: 'HSM-KEY-MDK_RUPAY_AC_01', alias: 'MDK_RUPAY_AC_01', type: 'MDK-AC', algorithm: '3DES (112-bit)', kcv: 'B5F89A', slot: 1, status: 'ACTIVE' },
    { keyId: 'HSM-KEY-MDK_VISA_AC_01', alias: 'MDK_VISA_AC_01', type: 'MDK-AC', algorithm: '3DES (112-bit)', kcv: '91E4C2', slot: 1, status: 'ACTIVE' },
    { keyId: 'HSM-KEY-MDK_MC_AC_01', alias: 'MDK_MC_AC_01', type: 'MDK-AC', algorithm: '3DES (112-bit)', kcv: '33A0B1', slot: 1, status: 'ACTIVE' },
    { keyId: 'HSM-KEY-ZPK_NPCI_SWITCH_01', alias: 'ZPK_NPCI_SWITCH_01', type: 'ZPK', algorithm: '3DES (112-bit)', kcv: 'A1B2C3', slot: 2, status: 'ACTIVE' },
    { keyId: 'HSM-KEY-TPK_INGENICO_POS_01', alias: 'TPK_INGENICO_POS_01', type: 'TPK', algorithm: '3DES (112-bit)', kcv: '112233', slot: 2, status: 'ACTIVE' },
    { keyId: 'HSM-KEY-CVK_CARD_AUTH_01', alias: 'CVK_CARD_AUTH_01', type: 'CVK', algorithm: '3DES (112-bit)', kcv: '889900', slot: 3, status: 'ACTIVE' }
  ];

  const networkLinks = [
    { name: 'NPCI National Financial Switch (NFS)', port: 9800, protocol: 'ISO 8583:1987', state: 'ONLINE', latency: '4.2ms', echo: 'MTI 0800 ACK' },
    { name: 'RuPay National Payment Gateway (NPG)', port: 9801, protocol: 'ISO 8583:1993', state: 'ONLINE', latency: '5.1ms', echo: 'MTI 0800 ACK' },
    { name: 'NPCI UPI 2.0 Central Switch Hub', port: 8443, protocol: 'HTTPS / JSON-RPC', state: 'ONLINE', latency: '12.4ms', echo: 'Heartbeat 200 OK' },
    { name: 'Visa Direct / Base I Channel', port: 9804, protocol: 'ISO 8583:1987', state: 'ONLINE', latency: '28.0ms', echo: 'MTI 0800 ACK' },
    { name: 'Mastercard BankNet Gateway', port: 9805, protocol: 'ISO 8583:1987', state: 'ONLINE', latency: '31.2ms', echo: 'MTI 0800 ACK' }
  ];

  const fraudRules = [
    { id: 'RUL_VEL_01', name: 'Velocity Burst (60s Spike)', severity: 'CRITICAL', condition: '>3 attempts in 60s on same PAN/VPA', action: 'DECLINE (RC 59)' },
    { id: 'RUL_AMT_01', name: 'High Value Threshold', severity: 'HIGH', condition: 'Single transaction > ₹1,00,000', action: 'STEP-UP 3DS / OTP' },
    { id: 'RUL_MCC_01', name: 'High Risk MCC Sector', severity: 'HIGH', condition: 'MCC 7995 (Gambling), 6051 (Crypto/FX)', action: 'SCORE +30 / RISK REVIEW' },
    { id: 'RUL_TEST_01', name: 'BIN Testing Micro Probe', severity: 'CRITICAL', condition: 'Rapid < ₹10 repeat probes', action: 'IP & BIN TEMPORARY LOCK' },
    { id: 'RUL_FALLBACK_01', name: 'EMV Chip Fallback Mode', severity: 'MEDIUM', condition: 'POS Entry Mode 021 (Magstripe on Chip card)', action: 'SCORE +20' }
  ];

  const handleSendNetworkEcho = async () => {
    setIsEchoing(true);
    setEchoStatus(null);
    try {
      const res = await fetch('/api/iso8583/sample?mode=ECHO_0800');
      const data = await res.json();
      const procRes = await fetch('/api/iso8583/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawMessage: data.packedString })
      });
      const procData = await procRes.json();
      setEchoStatus(`MTI 0810 Echo Response: ${procData.transactionRecord?.responseMessage} (STAN: ${procData.transactionRecord?.stan})`);
    } catch (err) {
      console.error('Echo failed', err);
    } finally {
      setIsEchoing(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Switch Telemetry Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 text-white p-3 rounded border border-slate-700 space-y-0.5 shadow-xs">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
            <span>Throughput (TPS)</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {metrics.currentTps.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">tx/sec</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Peak: {metrics.peakTps} TPS</p>
        </div>

        <div className="bg-slate-900 text-white p-3 rounded border border-slate-700 space-y-0.5 shadow-xs">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
            <span>Latency (p95 / p99)</span>
            <Server className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-sky-400">
            {metrics.p95LatencyMs} <span className="text-[10px] text-slate-500 font-normal">/ {metrics.p99LatencyMs} ms</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">Average engine: {metrics.avgLatencyMs} ms</p>
        </div>

        <div className="bg-slate-900 text-white p-3 rounded border border-slate-700 space-y-0.5 shadow-xs">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
            <span>SoftHSM2 Ops Rate</span>
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">
            {metrics.hsmOpsPerSec} <span className="text-[10px] text-slate-500 font-normal">ops/sec</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">3DES Retail MAC PKCS#11</p>
        </div>

        <div className="bg-slate-900 text-white p-3 rounded border border-slate-700 space-y-0.5 shadow-xs">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
            <span>Persistent Sockets</span>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {metrics.activeTcpConnections} <span className="text-[10px] text-slate-500 font-normal">Active</span>
          </div>
          <p className="text-[10px] text-emerald-400 font-mono">100% Channel score</p>
        </div>
      </div>

      {/* Network Links & Heartbeat Echo Test */}
      <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Inter-Bank Switch & Scheme Channels</h3>
          </div>

          <div className="flex items-center gap-2">
            {echoStatus && (
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {echoStatus}
              </span>
            )}
            <button
              id="send-echo-0800-btn"
              disabled={isEchoing}
              onClick={handleSendNetworkEcho}
              className="bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
            >
              {isEchoing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              <span>Send ISO 8583 0800 Echo</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {networkLinks.map((link, idx) => (
            <div key={idx} className="p-2.5 rounded border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">{link.name}</span>
                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{link.state}</span>
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-600 space-y-0.5">
                <div>Port: {link.port} | {link.protocol}</div>
                <div className="flex justify-between text-slate-500">
                  <span>RTT: {link.latency}</span>
                  <span className="text-slate-700 font-bold">{link.echo}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SoftHSM2 PKCS#11 Key Vault Inspector */}
      <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">SoftHSM2 PKCS#11 Cryptographic Key Vault</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">SunPKCS11 Provider / SoftHSM Lib</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-3 py-1.5">Key Alias</th>
                <th className="px-3 py-1.5">Type</th>
                <th className="px-3 py-1.5">Algorithm</th>
                <th className="px-3 py-1.5">KCV Checksum</th>
                <th className="px-3 py-1.5">Slot</th>
                <th className="px-3 py-1.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[10px]">
              {hsmKeys.map(k => (
                <tr key={k.keyId} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-bold text-slate-900">{k.alias}</td>
                  <td className="px-3 py-1.5 text-indigo-700 font-semibold">{k.type}</td>
                  <td className="px-3 py-1.5 text-slate-600">{k.algorithm}</td>
                  <td className="px-3 py-1.5 text-slate-900 font-bold">{k.kcv}</td>
                  <td className="px-3 py-1.5 text-slate-600">Slot {k.slot}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                      {k.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Fraud Engine Rules Table */}
      <div className="bg-white rounded border border-slate-200 shadow-xs p-3.5 space-y-3">
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Real-time Risk & Drools Engine Rules</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {fraudRules.map(r => (
            <div key={r.id} className="p-2.5 rounded border border-slate-200 bg-slate-50/70 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">{r.name}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                    r.severity === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : r.severity === 'HIGH'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200'
                  }`}
                >
                  {r.severity}
                </span>
              </div>
              <p className="text-[10px] text-slate-600">Condition: {r.condition}</p>
              <div className="text-[10px] font-mono font-semibold text-indigo-700">Action: {r.action}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
