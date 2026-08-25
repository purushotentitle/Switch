export interface ISOFieldDefinition {
  fieldNumber: number;
  name: string;
  type: 'NUMERIC' | 'ALPHA' | 'ALPHANUMERIC' | 'SPECIAL' | 'BINARY' | 'LLVAR_NUMERIC' | 'LLVAR_ALPHANUMERIC' | 'LLLVAR_NUMERIC' | 'LLLVAR_ALPHANUMERIC' | 'LLLVAR_BINARY';
  maxLength: number;
  description: string;
}

export interface ISOMessage {
  mti: string;
  bitmapHex: string;
  fields: Record<number, string>;
  rawHex?: string;
  rawAscii?: string;
  parsedAt: string;
}

export interface EMVTLVData {
  tag: string;
  name: string;
  length: number;
  value: string;
  description?: string;
}

export interface ARQCValidationResult {
  valid: boolean;
  pan: string;
  atc: string;
  unpredictableNumber: string;
  transactionAmount: string;
  currencyCode: string;
  sessionKeyAC: string;
  calculatedARQC: string;
  receivedARQC: string;
  arpc: string;
  arc: string;
  hsmExecutionTimeMs: number;
}

export interface PINBlockResult {
  sourcePinBlock: string;
  translatedPinBlock: string;
  sourceKeyName: string;
  destKeyName: string;
  format: 'ISO-0' | 'ISO-1' | 'ISO-3';
  isValidPin?: boolean;
}

export interface FraudEvaluationResult {
  riskScore: number; // 0 - 100
  decision: 'APPROVE' | 'CHALLENGE_3DS' | 'DECLINE';
  reasons: string[];
  rulesTriggered: {
    ruleId: string;
    ruleName: string;
    scoreContribution: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    detail: string;
  }[];
  latencyMs: number;
}

export interface TransactionRecord {
  id: string;
  txnRef: string; // RRN / Txn Reference
  stan: string; // System Trace Audit Number (6 digits)
  rrn: string; // Retrieval Reference Number (12 digits)
  authCode?: string;
  mti: string;
  procCode: string;
  type: 'CARD_EMV' | 'CARD_CONTACTLESS' | 'CARD_MAGSTRIPE' | 'CARD_ECOM' | 'UPI_QR' | 'UPI_INTENT' | 'UPI_COLLECT' | 'REVERSAL';
  amount: number; // in INR
  currency: string;
  status: 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REVERSED' | 'CHARGEBACK' | 'PENDING';
  responseCode: string; // '00' = Success, '51' = Insufficient, etc.
  responseMessage: string;
  merchantId: string;
  merchantName: string;
  terminalId: string;
  cardNumberMasked?: string;
  cardBrand?: 'RuPay' | 'Visa' | 'Mastercard' | 'NPCI_UPI';
  vpa?: string;
  customerName?: string;
  posEntryMode?: string;
  emvTags?: Record<string, string>;
  fraudEvaluation?: FraudEvaluationResult;
  arqcResult?: ARQCValidationResult;
  isoRawMessage?: ISOMessage;
  iso20022Xml?: string;
  reversalReason?: string;
  createdAt: string;
  settled: boolean;
  settlementBatchId?: string;
  mdrAmount: number;
  gstAmount: number;
  netPayout: number;
}

export interface UpiQRData {
  qrId: string;
  qrPayload: string;
  qrDataUrl: string;
  vpa: string;
  merchantName: string;
  mcc: string;
  txnRef: string;
  amount: number;
  expiryAt: string;
  status: 'ACTIVE' | 'SCANNED' | 'PAID' | 'EXPIRED';
  note?: string;
}

export interface ReconRecord {
  rrn: string;
  txnDate: string;
  switchAmount: number;
  networkAmount?: number;
  bankAmount?: number;
  switchStatus: string;
  networkStatus?: string;
  bankStatus?: string;
  matchStatus: '3_WAY_MATCHED' | 'SWITCH_MISSING' | 'NETWORK_MISSING' | 'CBS_MISSING' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH';
  discrepancyType?: string;
  resolution?: 'AUTO_MATCHED' | 'REVERSAL_TRIGGERED' | 'POSTED_TO_SUSPENSE' | 'MANUAL_OVERRIDE' | 'UNRESOLVED';
  settlementEligible: boolean;
}

export interface ReconBatchSummary {
  batchId: string;
  runDate: string;
  totalTransactions: number;
  threeWayMatchedCount: number;
  threeWayMatchedVolume: number;
  switchOnlyCount: number;
  networkOnlyCount: number;
  bankOnlyCount: number;
  mismatchCount: number;
  status: 'COMPLETED' | 'RUNNING' | 'FAILED';
  ttumGenerated: boolean;
  ttumFilePath?: string;
  totalMdr: number;
  totalGst: number;
  totalNetPayout: number;
}

export interface WebhookEvent {
  id: string;
  event: 'payment.authorized' | 'payment.captured' | 'payment.failed' | 'payment.reversed' | 'dispute.created' | 'settlement.processed';
  merchantId: string;
  payload: any;
  signature: string;
  delivered: boolean;
  statusCode?: number;
  attempts: number;
  lastAttemptAt: string;
}

export interface DisputeRecord {
  id: string;
  caseNumber: string;
  rrn: string;
  txnAmount: number;
  disputeAmount: number;
  reasonCode: string;
  reasonDescription: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'REPRESENTMENT_SUBMITTED' | 'MERCHANT_WON' | 'MERCHANT_LOST' | 'ACCEPTED_DEBIT';
  cardBrand: string;
  merchantId: string;
  evidenceSubmitted?: string;
  dueDate: string;
  createdAt: string;
}

export interface SwitchMetrics {
  currentTps: number;
  peakTps: number;
  todayVolume: number;
  todayCount: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  hsmOpsPerSec: number;
  activeTcpConnections: number;
  activeQRs: number;
  activeDisputes: number;
  systemHealth: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';
}
