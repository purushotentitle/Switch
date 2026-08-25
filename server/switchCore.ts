import { DisputeRecord, ISOMessage, SwitchMetrics, TransactionRecord } from '../src/types/payment.js';
import { SoftHSMSimulator } from './crypto/hsm.js';
import { RealTimeFraudEngine } from './fraud/engine.js';
import { ISO_FIELD_DEFINITIONS, RESPONSE_CODES } from './iso8583/fields.js';
import { ISO8583To20022Mapper } from './iso8583/mapper20022.js';
import { ISOPackager } from './iso8583/packager.js';
import { ReconciliationEngine } from './reconciliation/engine.js';
import { UpiEngine } from './upi/upiEngine.js';

type ListenerCallback = (data: { type: string; payload: any }) => void;

export class SwitchCore {
  private static instance: SwitchCore;
  private transactions: TransactionRecord[] = [];
  private disputes: DisputeRecord[] = [];
  private listeners: Set<ListenerCallback> = new Set();
  private stanCounter = 100450;
  private rrnCounter = 423819002150;
  private hsmOpsCount = 1420;
  private peakTps = 24.5;
  private activeTcpConnections = 8; // Simulated POS Terminals & Switch Inbound TCP sockets

  private constructor() {
    this.seedInitialTransactions();
    this.seedInitialDisputes();
  }

  public static getInstance(): SwitchCore {
    if (!SwitchCore.instance) {
      SwitchCore.instance = new SwitchCore();
    }
    return SwitchCore.instance;
  }

  public subscribe(cb: ListenerCallback) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private broadcast(type: string, payload: any) {
    for (const listener of this.listeners) {
      try {
        listener({ type, payload });
      } catch (err) {
        console.error('Error broadcasting to listener', err);
      }
    }
  }

  private seedInitialTransactions() {
    const merchants = [
      { id: 'MID_TATA_01', name: 'Tata Star Bazaar Andheri East' },
      { id: 'MID_RELIANCE_02', name: 'Reliance Digital Bandra' },
      { id: 'MID_DMART_03', name: 'DMart Supermarket Powai' },
      { id: 'MID_AMAZON_04', name: 'Amazon Pay India IN' }
    ];

    const cards = [
      { pan: '6074123456789012', brand: 'RuPay', type: 'CARD_EMV' as const, mask: '607412******9012' },
      { pan: '4532019876543210', brand: 'Visa', type: 'CARD_CONTACTLESS' as const, mask: '453201******3210' },
      { pan: '5241890123456789', brand: 'Mastercard', type: 'CARD_EMV' as const, mask: '524189******6789' }
    ];

    const now = Date.now();
    for (let i = 0; i < 12; i++) {
      const m = merchants[i % merchants.length];
      const c = cards[i % cards.length];
      const amount = Math.floor(Math.random() * 4500 + 150);
      const stan = (this.stanCounter++).toString().padStart(6, '0');
      const rrn = (this.rrnCounter++).toString();
      const isFailed = i === 4;
      const isReversed = i === 8;

      const mdr = c.brand === 'RuPay' ? 0 : Math.round(amount * 0.009 * 100) / 100;
      const gst = Math.round(mdr * 0.18 * 100) / 100;

      const txn: TransactionRecord = {
        id: `TXN-IND-${stan}`,
        txnRef: `REF-${rrn}`,
        stan,
        rrn,
        authCode: isFailed ? undefined : `AUTH${Math.floor(100000 + Math.random() * 900000)}`,
        mti: isReversed ? '0420' : '0200',
        procCode: '000000',
        type: c.type,
        amount,
        currency: 'INR',
        status: isReversed ? 'REVERSED' : (isFailed ? 'FAILED' : 'CAPTURED'),
        responseCode: isFailed ? '51' : '00',
        responseMessage: isFailed ? 'Insufficient Funds' : 'Approved',
        merchantId: m.id,
        merchantName: m.name,
        terminalId: `TID_MUM_${(101 + i).toString()}`,
        cardNumberMasked: c.mask,
        cardBrand: c.brand as any,
        posEntryMode: c.type === 'CARD_CONTACTLESS' ? '071' : '051',
        createdAt: new Date(now - (12 - i) * 180000).toISOString(),
        settled: i < 6,
        mdrAmount: mdr,
        gstAmount: gst,
        netPayout: amount - mdr - gst,
        fraudEvaluation: {
          riskScore: isFailed ? 42 : 12,
          decision: 'APPROVE',
          reasons: ['Normal cardholder profile'],
          rulesTriggered: [],
          latencyMs: 2.1
        }
      };

      this.transactions.push(txn);
    }
  }

  private seedInitialDisputes() {
    this.disputes.push({
      id: 'DSP-2026-001',
      caseNumber: 'NPCI-DISP-492109',
      rrn: '423819002145',
      txnAmount: 2499.00,
      disputeAmount: 2499.00,
      reasonCode: '4837',
      reasonDescription: 'No Cardholder Authorization / Suspected Fraudulent Swiped Transaction',
      status: 'OPEN',
      cardBrand: 'Visa',
      merchantId: 'MID_TATA_01',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
    });
  }

  /**
   * Process an Inbound ISO 8583 Financial Transaction (0200 Purchase, 0100 Auth, 0420 Reversal, 0800 Echo)
   */
  public async processISO8583Message(rawInput: string): Promise<{
    parsedRequest: ISOMessage;
    responseISO: ISOMessage;
    transactionRecord: TransactionRecord;
    arqcValidation?: any;
    pinTranslation?: any;
    fraudEvaluation?: any;
    iso20022Xml?: string;
  }> {
    const startTime = performance.now();
    const parsedRequest = ISOPackager.unpack(rawInput);
    const mti = parsedRequest.mti;
    const reqFields = parsedRequest.fields;

    const pan = reqFields[2] || '';
    const amountMinor = parseInt(reqFields[4] || '0', 10);
    const amountINR = amountMinor / 100;
    const stan = reqFields[11] || (this.stanCounter++).toString().padStart(6, '0');
    const rrn = reqFields[37] || (this.rrnCounter++).toString().padStart(12, '0');
    const tid = reqFields[41] || 'TID_IND_01';
    const mid = reqFields[42] || 'MID_INDISWITCH_01';
    const merchantName = reqFields[43] || 'IndiSwitch Retail Mumbai IN';
    const mcc = reqFields[18] || '5411';
    const posEntryMode = reqFields[22] || '051';
    const pinBlockHex = reqFields[52];
    const tag55Hex = reqFields[55];

    let cardBrand: 'RuPay' | 'Visa' | 'Mastercard' | 'NPCI_UPI' = 'RuPay';
    if (pan.startsWith('4')) cardBrand = 'Visa';
    else if (pan.startsWith('5')) cardBrand = 'Mastercard';
    else if (pan.startsWith('6')) cardBrand = 'RuPay';

    const hsm = SoftHSMSimulator.getInstance();
    const fraudEngine = RealTimeFraudEngine.getInstance();
    const upiEngine = UpiEngine.getInstance();

    this.hsmOpsCount += 2;

    // 1. PIN Block Translation (if Field 52 present)
    let pinTranslation = undefined;
    if (pinBlockHex) {
      pinTranslation = hsm.translatePinBlock(pinBlockHex, pan, 'ISO-0');
    }

    // 2. EMV Tag 55 Parsing & ARQC Validation
    let arqcValidation = undefined;
    const emvTagsMap: Record<string, string> = {};
    if (tag55Hex) {
      const parsedTags = ISOPackager.parseEMVTag55(tag55Hex);
      for (const t of parsedTags) {
        emvTagsMap[t.tag] = t.value;
      }

      const receivedARQC = emvTagsMap['9F26'] || '';
      const atc = emvTagsMap['9F36'] || '0001';
      const un = emvTagsMap['9F37'] || 'A1B2C3D4';
      const tvr = emvTagsMap['95'] || '0000000000';

      arqcValidation = hsm.validateARQC({
        pan,
        atc,
        unpredictableNumber: un,
        amount: reqFields[4] || '000000000000',
        currencyCode: reqFields[49] || '0356',
        tvr,
        receivedARQC,
        cardBrand
      });
    }

    // 3. Real-Time Fraud & Anomaly Scoring
    const fraudEvaluation = fraudEngine.evaluateTransaction({
      panOrVpa: pan || mid,
      amount: amountINR,
      mcc,
      posEntryMode,
      terminalId: tid,
      location: merchantName,
      isFallback: posEntryMode === '021'
    });

    // 4. Response Code Resolution
    let responseCode = '00';
    let responseMessage = 'Approved';
    let status: TransactionRecord['status'] = 'CAPTURED';

    if (mti === '0420') {
      // Reversal Request
      responseCode = '00';
      responseMessage = 'Reversal Accepted and Cleared';
      status = 'REVERSED';
    } else if (mti === '0800') {
      // Network Echo / Logon
      responseCode = '00';
      responseMessage = 'System Ready / Echo Acknowledged';
      status = 'AUTHORIZED';
    } else {
      if (fraudEvaluation.decision === 'DECLINE') {
        responseCode = '59';
        responseMessage = RESPONSE_CODES['59'].description;
        status = 'FAILED';
      } else if (arqcValidation && !arqcValidation.valid) {
        responseCode = '96';
        responseMessage = 'EMV Cryptogram ARQC Verification Failed';
        status = 'FAILED';
      } else if (amountINR >= 500000) {
        // High limit decline
        responseCode = '51';
        responseMessage = RESPONSE_CODES['51'].description;
        status = 'FAILED';
      }
    }

    // 5. Construct Response MTI & Fields
    let respMti = '0210';
    if (mti === '0100') respMti = '0110';
    else if (mti === '0200') respMti = '0210';
    else if (mti === '0420') respMti = '0430';
    else if (mti === '0800') respMti = '0810';

    const authCode = responseCode === '00' ? `AUTH${Math.floor(100000 + Math.random() * 900000)}` : undefined;

    const respFields: Record<number, string> = {
      2: pan,
      3: reqFields[3] || '000000',
      4: reqFields[4] || '000000000000',
      7: reqFields[7] || new Date().toISOString().replace(/[-:T]/g, '').substring(4, 14),
      11: stan,
      12: reqFields[12] || new Date().toTimeString().substring(0, 8).replace(/:/g, ''),
      13: reqFields[13] || new Date().toISOString().substring(5, 10).replace('-', ''),
      37: rrn,
      38: authCode || '      ',
      39: responseCode,
      41: tid,
      42: mid,
      49: reqFields[49] || '356'
    };

    // Attach Tag 55 in response with ARPC (Tag 91) & ARC (Tag 8A)
    if (arqcValidation) {
      const respTag55Payload = ISOPackager.encodeEMVTag55([
        { tag: '91', value: arqcValidation.arpc },
        { tag: '8A', value: Buffer.from(arqcValidation.arc).toString('hex') }
      ]);
      respFields[55] = respTag55Payload;
    }

    const packedResp = ISOPackager.pack(respMti, respFields);
    const responseISO: ISOMessage = {
      mti: respMti,
      bitmapHex: packedResp.bitmapHex,
      fields: respFields,
      rawAscii: packedResp.rawString,
      rawHex: packedResp.rawHex,
      parsedAt: new Date().toISOString()
    };

    // 6. Map to ISO 20022 pacs.008 or pacs.002
    let iso20022Doc = undefined;
    if (mti === '0200' || mti === '0100') {
      iso20022Doc = ISO8583To20022Mapper.mapToPacs008(parsedRequest);
    } else if (mti === '0420') {
      iso20022Doc = ISO8583To20022Mapper.mapToPacs004(parsedRequest);
    }

    // 7. Calculate MDR and create record
    const mdrRate = cardBrand === 'RuPay' ? 0 : 0.009;
    const mdr = Math.round(amountINR * mdrRate * 100) / 100;
    const gst = Math.round(mdr * 0.18 * 100) / 100;

    let txnType: TransactionRecord['type'] = 'CARD_EMV';
    if (posEntryMode === '071') txnType = 'CARD_CONTACTLESS';
    else if (posEntryMode === '021') txnType = 'CARD_MAGSTRIPE';
    if (mti === '0420') txnType = 'REVERSAL';

    const txnRecord: TransactionRecord = {
      id: `TXN-IND-${stan}`,
      txnRef: `REF-${rrn}`,
      stan,
      rrn,
      authCode,
      mti,
      procCode: reqFields[3] || '000000',
      type: txnType,
      amount: amountINR,
      currency: 'INR',
      status,
      responseCode,
      responseMessage,
      merchantId: mid,
      merchantName,
      terminalId: tid,
      cardNumberMasked: pan ? pan.substring(0, 6) + '******' + pan.slice(-4) : undefined,
      cardBrand,
      posEntryMode,
      emvTags: emvTagsMap,
      fraudEvaluation,
      arqcResult: arqcValidation,
      isoRawMessage: parsedRequest,
      iso20022Xml: iso20022Doc?.xml,
      createdAt: new Date().toISOString(),
      settled: false,
      mdrAmount: mdr,
      gstAmount: gst,
      netPayout: amountINR - mdr - gst
    };

    this.transactions.unshift(txnRecord);
    if (this.transactions.length > 500) this.transactions.pop();

    // 8. Trigger Merchant Webhook
    if (status === 'CAPTURED' || status === 'AUTHORIZED') {
      upiEngine.dispatchWebhook('payment.captured', mid, {
        transactionId: txnRecord.id,
        rrn: txnRecord.rrn,
        amount: txnRecord.amount,
        authCode: txnRecord.authCode,
        status: 'CAPTURED',
        paymentMethod: txnRecord.type,
        cardBrand: txnRecord.cardBrand
      });
    } else if (status === 'FAILED') {
      upiEngine.dispatchWebhook('payment.failed', mid, {
        transactionId: txnRecord.id,
        rrn: txnRecord.rrn,
        amount: txnRecord.amount,
        responseCode: txnRecord.responseCode,
        reason: txnRecord.responseMessage
      });
    } else if (status === 'REVERSED') {
      upiEngine.dispatchWebhook('payment.reversed', mid, {
        transactionId: txnRecord.id,
        rrn: txnRecord.rrn,
        amount: txnRecord.amount,
        reversalType: 'AUTO_POS_TIMEOUT'
      });
    }

    // Broadcast live event over WebSocket
    this.broadcast('NEW_TRANSACTION', {
      transaction: txnRecord,
      responseISO
    });

    return {
      parsedRequest,
      responseISO,
      transactionRecord: txnRecord,
      arqcValidation,
      pinTranslation,
      fraudEvaluation,
      iso20022Xml: iso20022Doc?.xml
    };
  }

  /**
   * Process a simulated UPI Payment completion against a Dynamic QR
   */
  public processUPIPayment(params: {
    qrId: string;
    payerVpa: string;
    payerName: string;
    amount: number;
    txnRef: string;
  }): TransactionRecord {
    const stan = (this.stanCounter++).toString().padStart(6, '0');
    const rrn = (this.rrnCounter++).toString().padStart(12, '0');
    const upiEngine = UpiEngine.getInstance();
    const qr = upiEngine.getQR(params.qrId);

    const fraud = RealTimeFraudEngine.getInstance().evaluateTransaction({
      panOrVpa: params.payerVpa,
      amount: params.amount,
      mcc: qr?.mcc || '5411',
      terminalId: 'UPI_GATEWAY_V2',
      location: 'NPCI UPI Hub'
    });

    const isDeclined = fraud.decision === 'DECLINE';
    const status: TransactionRecord['status'] = isDeclined ? 'FAILED' : 'CAPTURED';
    const responseCode = isDeclined ? '59' : '00';
    const responseMessage = isDeclined ? 'Risk Blocked' : 'Approved';

    const txnRecord: TransactionRecord = {
      id: `TXN-UPI-${stan}`,
      txnRef: params.txnRef,
      stan,
      rrn,
      authCode: isDeclined ? undefined : `UPI${Math.floor(100000 + Math.random() * 900000)}`,
      mti: '0200',
      procCode: '000000',
      type: 'UPI_QR',
      amount: params.amount,
      currency: 'INR',
      status,
      responseCode,
      responseMessage,
      merchantId: qr ? `MID_${qr.mcc}` : 'MID_UPI_MERCHANT',
      merchantName: qr ? qr.merchantName : 'NPCI UPI Merchant',
      terminalId: 'UPI_VIRTUAL_01',
      vpa: params.payerVpa,
      customerName: params.payerName,
      cardBrand: 'NPCI_UPI',
      fraudEvaluation: fraud,
      createdAt: new Date().toISOString(),
      settled: false,
      mdrAmount: 0, // Zero MDR on UPI in India
      gstAmount: 0,
      netPayout: params.amount
    };

    if (qr && status === 'CAPTURED') {
      upiEngine.updateQRStatus(params.qrId, 'PAID');
    }

    this.transactions.unshift(txnRecord);

    if (status === 'CAPTURED') {
      upiEngine.dispatchWebhook('payment.captured', txnRecord.merchantId, {
        transactionId: txnRecord.id,
        rrn: txnRecord.rrn,
        amount: txnRecord.amount,
        vpa: txnRecord.vpa,
        payerName: txnRecord.customerName,
        status: 'CAPTURED',
        channel: 'UPI_QR_2.0'
      });
    }

    this.broadcast('NEW_TRANSACTION', {
      transaction: txnRecord
    });

    return txnRecord;
  }

  /**
   * Triggers a Reversal (0420) for an existing transaction
   */
  public triggerReversal(rrn: string, reason: string = 'Customer Cancelled at POS'): TransactionRecord | undefined {
    const txn = this.transactions.find(t => t.rrn === rrn);
    if (!txn || txn.status === 'REVERSED') return undefined;

    txn.status = 'REVERSED';
    txn.reversalReason = reason;

    UpiEngine.getInstance().dispatchWebhook('payment.reversed', txn.merchantId, {
      transactionId: txn.id,
      rrn: txn.rrn,
      amount: txn.amount,
      reason
    });

    this.broadcast('TRANSACTION_UPDATED', { transaction: txn });
    return txn;
  }

  /**
   * Raises or Updates a Chargeback Dispute
   */
  public raiseDispute(params: {
    rrn: string;
    reasonCode: string;
    reasonDescription: string;
    disputeAmount: number;
  }): DisputeRecord {
    const txn = this.transactions.find(t => t.rrn === params.rrn);
    const disputeId = `DSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const dispute: DisputeRecord = {
      id: disputeId,
      caseNumber: `NPCI-DISP-${Math.floor(100000 + Math.random() * 900000)}`,
      rrn: params.rrn,
      txnAmount: txn ? txn.amount : params.disputeAmount,
      disputeAmount: params.disputeAmount,
      reasonCode: params.reasonCode,
      reasonDescription: params.reasonDescription,
      status: 'OPEN',
      cardBrand: txn?.cardBrand || 'RuPay',
      merchantId: txn?.merchantId || 'MID_INDISWITCH_01',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
      createdAt: new Date().toISOString()
    };

    if (txn) {
      txn.status = 'CHARGEBACK';
    }

    this.disputes.unshift(dispute);
    UpiEngine.getInstance().dispatchWebhook('dispute.created', dispute.merchantId, dispute);
    this.broadcast('DISPUTE_UPDATED', { dispute });
    return dispute;
  }

  public submitRepresentment(disputeId: string, evidenceText: string): DisputeRecord | undefined {
    const d = this.disputes.find(item => item.id === disputeId);
    if (!d) return undefined;

    d.status = 'REPRESENTMENT_SUBMITTED';
    d.evidenceSubmitted = evidenceText;
    this.broadcast('DISPUTE_UPDATED', { dispute: d });
    return d;
  }

  public resolveDispute(disputeId: string, outcome: 'MERCHANT_WON' | 'MERCHANT_LOST'): DisputeRecord | undefined {
    const d = this.disputes.find(item => item.id === disputeId);
    if (!d) return undefined;

    d.status = outcome;
    this.broadcast('DISPUTE_UPDATED', { dispute: d });
    return d;
  }

  public listTransactions(): TransactionRecord[] {
    return this.transactions;
  }

  public listDisputes(): DisputeRecord[] {
    return this.disputes;
  }

  public getMetrics(): SwitchMetrics {
    const txns = this.transactions;
    const totalCount = txns.length;
    const successful = txns.filter(t => t.status === 'CAPTURED' || t.status === 'AUTHORIZED').length;
    const successRate = totalCount > 0 ? Math.round((successful / totalCount) * 1000) / 10 : 98.4;
    const totalVolume = txns.filter(t => t.status === 'CAPTURED').reduce((acc, t) => acc + t.amount, 0);

    return {
      currentTps: Math.round((Math.random() * 8 + 14) * 10) / 10,
      peakTps: this.peakTps,
      todayVolume: Math.round(totalVolume * 100) / 100,
      todayCount: totalCount,
      successRate,
      avgLatencyMs: 4.8,
      p95LatencyMs: 9.2,
      p99LatencyMs: 16.4,
      hsmOpsPerSec: this.hsmOpsCount,
      activeTcpConnections: this.activeTcpConnections,
      activeQRs: UpiEngine.getInstance().listQRs().filter(q => q.status === 'ACTIVE').length,
      activeDisputes: this.disputes.filter(d => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length,
      systemHealth: 'OPTIMAL'
    };
  }
}
