import crypto from 'crypto';
import QRCode from 'qrcode';
import { UpiQRData, WebhookEvent } from '../../src/types/payment.js';

export class UpiEngine {
  private static instance: UpiEngine;
  private qrStore: Map<string, UpiQRData> = new Map();
  private webhookStore: WebhookEvent[] = [];
  private webhookSecret = 'whsec_indiswitch_live_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  private constructor() {
    this.seedInitialQRs();
  }

  public static getInstance(): UpiEngine {
    if (!UpiEngine.instance) {
      UpiEngine.instance = new UpiEngine();
    }
    return UpiEngine.instance;
  }

  private async seedInitialQRs() {
    try {
      await this.generateDynamicQR({
        vpa: 'merchant.indiswitch@hdfcbank',
        merchantName: 'Tata Retail MegaStore Mumbai',
        mcc: '5411',
        amount: 1450.00,
        txnRef: 'IND' + Date.now().toString().slice(-8),
        note: 'Grocery & Organic Produce Order #9812'
      });
    } catch {
      // ignore
    }
  }

  /**
   * Generates NPCI UPI 2.0 Dynamic QR with digital signature
   */
  public async generateDynamicQR(params: {
    vpa: string;
    merchantName: string;
    mcc: string;
    amount: number;
    txnRef: string;
    note?: string;
    expiryMinutes?: number;
  }): Promise<UpiQRData> {
    const qrId = 'UPI-QR-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const expiryMinutes = params.expiryMinutes || 15;
    const expiryAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    // Construct NPCI UPI 2.0 URI format:
    // upi://pay?pa={vpa}&pn={merchantName}&mc={mcc}&tr={txnRef}&tn={note}&am={amount}&cu=INR&mode=02&orgid=180001
    const encodedPn = encodeURIComponent(params.merchantName);
    const encodedTn = encodeURIComponent(params.note || `Payment to ${params.merchantName}`);
    const amountStr = params.amount.toFixed(2);

    let rawPayload = `upi://pay?pa=${params.vpa}&pn=${encodedPn}&mc=${params.mcc}&tr=${params.txnRef}&tn=${encodedTn}&am=${amountStr}&cu=INR&mode=02&orgid=180001`;

    // NPCI PKI Signature (Simulated RSA-SHA256 signature for NPCI verification)
    const signHash = crypto.createHash('sha256').update(rawPayload).digest('base64');
    const fullPayload = `${rawPayload}&sign=${encodeURIComponent(signHash)}`;

    // Generate high-resolution QR data URL
    const qrDataUrl = await QRCode.toDataURL(fullPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
      color: {
        dark: '#002B49', // NPCI Blue
        light: '#FFFFFF'
      }
    });

    const qrData: UpiQRData = {
      qrId,
      qrPayload: fullPayload,
      qrDataUrl,
      vpa: params.vpa,
      merchantName: params.merchantName,
      mcc: params.mcc,
      txnRef: params.txnRef,
      amount: params.amount,
      expiryAt,
      status: 'ACTIVE',
      note: params.note
    };

    this.qrStore.set(qrId, qrData);
    return qrData;
  }

  public getQR(qrId: string): UpiQRData | undefined {
    return this.qrStore.get(qrId);
  }

  public listQRs(): UpiQRData[] {
    return Array.from(this.qrStore.values()).sort((a, b) => b.qrId.localeCompare(a.qrId));
  }

  public updateQRStatus(qrId: string, status: UpiQRData['status']): UpiQRData | undefined {
    const item = this.qrStore.get(qrId);
    if (item) {
      item.status = status;
      this.qrStore.set(qrId, item);
      return item;
    }
    return undefined;
  }

  /**
   * Dispatches a secure webhook event with HMAC-SHA256 signature
   */
  public dispatchWebhook(event: WebhookEvent['event'], merchantId: string, payload: any): WebhookEvent {
    const payloadStr = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', this.webhookSecret).update(payloadStr).digest('hex');

    const webhook: WebhookEvent = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      event,
      merchantId,
      payload,
      signature: `t=${Math.floor(Date.now() / 1000)},v1=${signature}`,
      delivered: true,
      statusCode: 200,
      attempts: 1,
      lastAttemptAt: new Date().toISOString()
    };

    this.webhookStore.unshift(webhook);
    if (this.webhookStore.length > 50) {
      this.webhookStore.pop();
    }

    return webhook;
  }

  public listWebhooks(): WebhookEvent[] {
    return this.webhookStore;
  }
}
