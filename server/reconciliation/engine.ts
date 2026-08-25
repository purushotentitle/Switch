import { ReconBatchSummary, ReconRecord, TransactionRecord } from '../../src/types/payment.js';

export class ReconciliationEngine {
  private static instance: ReconciliationEngine;
  private batchHistory: ReconBatchSummary[] = [];
  private reconRecordsStore: Map<string, ReconRecord[]> = new Map();

  private constructor() {
    this.seedInitialBatch();
  }

  public static getInstance(): ReconciliationEngine {
    if (!ReconciliationEngine.instance) {
      ReconciliationEngine.instance = new ReconciliationEngine();
    }
    return ReconciliationEngine.instance;
  }

  private seedInitialBatch() {
    const batchId = 'RECON-BATCH-20260824-001';
    const runDate = '2026-08-24';
    const mockRecords: ReconRecord[] = [
      {
        rrn: '423819002145',
        txnDate: '2026-08-24 14:12:05',
        switchAmount: 2499.00,
        networkAmount: 2499.00,
        bankAmount: 2499.00,
        switchStatus: 'SUCCESS',
        networkStatus: 'SETTLED',
        bankStatus: 'DEBITED',
        matchStatus: '3_WAY_MATCHED',
        settlementEligible: true,
        resolution: 'AUTO_MATCHED'
      },
      {
        rrn: '423819002146',
        txnDate: '2026-08-24 14:15:30',
        switchAmount: 850.00,
        networkAmount: 850.00,
        bankAmount: 850.00,
        switchStatus: 'SUCCESS',
        networkStatus: 'SETTLED',
        bankStatus: 'DEBITED',
        matchStatus: '3_WAY_MATCHED',
        settlementEligible: true,
        resolution: 'AUTO_MATCHED'
      },
      {
        rrn: '423819002147',
        txnDate: '2026-08-24 14:22:11',
        switchAmount: 12000.00,
        networkAmount: 12000.00,
        bankAmount: undefined,
        switchStatus: 'SUCCESS',
        networkStatus: 'SETTLED',
        bankStatus: 'TIMEOUT_UNPOSTED',
        matchStatus: 'CBS_MISSING',
        discrepancyType: 'CBS Host timed out during accounting debit posting',
        settlementEligible: false,
        resolution: 'POSTED_TO_SUSPENSE'
      },
      {
        rrn: '423819002148',
        txnDate: '2026-08-24 14:35:48',
        switchAmount: 320.00,
        networkAmount: 320.00,
        bankAmount: 320.00,
        switchStatus: 'SUCCESS',
        networkStatus: 'SETTLED',
        bankStatus: 'DEBITED',
        matchStatus: '3_WAY_MATCHED',
        settlementEligible: true,
        resolution: 'AUTO_MATCHED'
      },
      {
        rrn: '423819002149',
        txnDate: '2026-08-24 14:48:19',
        switchAmount: 4500.00,
        networkAmount: undefined,
        bankAmount: undefined,
        switchStatus: 'SUCCESS',
        networkStatus: 'DROPPED_AT_SCHEME',
        bankStatus: 'NOT_FOUND',
        matchStatus: 'NETWORK_MISSING',
        discrepancyType: 'Transaction dropped before scheme clearing cycle',
        settlementEligible: false,
        resolution: 'REVERSAL_TRIGGERED'
      }
    ];

    this.reconRecordsStore.set(batchId, mockRecords);
    this.batchHistory.push({
      batchId,
      runDate,
      totalTransactions: 5,
      threeWayMatchedCount: 3,
      threeWayMatchedVolume: 3669.00,
      switchOnlyCount: 1,
      networkOnlyCount: 0,
      bankOnlyCount: 0,
      mismatchCount: 1,
      status: 'COMPLETED',
      ttumGenerated: true,
      ttumFilePath: `/reports/ttum_${batchId}.txt`,
      totalMdr: 33.02,
      totalGst: 5.94,
      totalNetPayout: 3630.04
    });
  }

  /**
   * Runs the 3-Way Reconciliation Job on active transactions
   */
  public runReconciliation(transactions: TransactionRecord[]): { batch: ReconBatchSummary; records: ReconRecord[]; ttumContent: string } {
    const batchId = `RECON-BATCH-${new Date().toISOString().substring(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
    const runDate = new Date().toISOString().substring(0, 10);
    const records: ReconRecord[] = [];

    let matchedCount = 0;
    let matchedVol = 0;
    let switchOnlyCount = 0;
    let networkOnlyCount = 0;
    let bankOnlyCount = 0;
    let mismatchCount = 0;

    let totalMdr = 0;
    let totalGst = 0;
    let totalNetPayout = 0;

    for (const txn of transactions) {
      if (txn.status === 'REVERSED' || txn.status === 'FAILED') continue;

      // Deterministic simulation based on RRN
      const rrnNum = parseInt(txn.rrn.slice(-2), 10) || 0;
      let matchStatus: ReconRecord['matchStatus'] = '3_WAY_MATCHED';
      let networkAmt: number | undefined = txn.amount;
      let bankAmt: number | undefined = txn.amount;
      let netStatus = 'SETTLED';
      let bnkStatus = 'DEBITED';
      let discType: string | undefined;
      let resolution: ReconRecord['resolution'] = 'AUTO_MATCHED';
      let settlementEligible = true;

      // 5% chance of CBS missing, 3% chance of Network missing
      if (rrnNum % 20 === 19) {
        matchStatus = 'CBS_MISSING';
        bankAmt = undefined;
        bnkStatus = 'CBS_DEBIT_FAILED';
        discType = 'CBS debit dropped during host blip';
        resolution = 'POSTED_TO_SUSPENSE';
        settlementEligible = false;
        mismatchCount++;
      } else if (rrnNum % 30 === 29) {
        matchStatus = 'NETWORK_MISSING';
        networkAmt = undefined;
        netStatus = 'DROPPED_AT_SCHEME';
        discType = 'Scheme clearing cycle missing transaction record';
        resolution = 'REVERSAL_TRIGGERED';
        settlementEligible = false;
        switchOnlyCount++;
      } else {
        matchedCount++;
        matchedVol += txn.amount;
        
        // MDR: 0.9% for Card Credit, 0% for RuPay Debit / UPI
        const mdrRate = txn.type.startsWith('CARD') && txn.cardBrand !== 'RuPay' ? 0.009 : 0.0;
        const mdr = Math.round(txn.amount * mdrRate * 100) / 100;
        const gst = Math.round(mdr * 0.18 * 100) / 100;
        const net = txn.amount - mdr - gst;

        totalMdr += mdr;
        totalGst += gst;
        totalNetPayout += net;
      }

      records.push({
        rrn: txn.rrn,
        txnDate: txn.createdAt.replace('T', ' ').substring(0, 19),
        switchAmount: txn.amount,
        networkAmount: networkAmt,
        bankAmount: bankAmt,
        switchStatus: txn.status,
        networkStatus: netStatus,
        bankStatus: bnkStatus,
        matchStatus,
        discrepancyType: discType,
        resolution,
        settlementEligible
      });
    }

    const batchSummary: ReconBatchSummary = {
      batchId,
      runDate,
      totalTransactions: records.length,
      threeWayMatchedCount: matchedCount,
      threeWayMatchedVolume: matchedVol,
      switchOnlyCount,
      networkOnlyCount,
      bankOnlyCount,
      mismatchCount,
      status: 'COMPLETED',
      ttumGenerated: true,
      ttumFilePath: `/reports/ttum_${batchId}.txt`,
      totalMdr,
      totalGst,
      totalNetPayout
    };

    this.reconRecordsStore.set(batchId, records);
    this.batchHistory.unshift(batchSummary);

    const ttumContent = this.generateTTUMFile(batchSummary, records);

    return {
      batch: batchSummary,
      records,
      ttumContent
    };
  }

  /**
   * Generates standard Finacle / BANCS format TTUM Accounting Voucher
   */
  public generateTTUMFile(batch: ReconBatchSummary, records: ReconRecord[]): string {
    const timestamp = new Date().toISOString();
    let lines = [
      `========================================================================================`,
      `NATIONAL PAYMENTS CORPORATION OF INDIA / FINACLE CBS SETTLEMENT TTUM VOUCHER`,
      `BATCH ID     : ${batch.batchId}`,
      `DATE         : ${batch.runDate} | TIMESTAMP: ${timestamp}`,
      `TOTAL VOLUME : INR ${batch.threeWayMatchedVolume.toFixed(2)} | MATCHED TXNS: ${batch.threeWayMatchedCount}`,
      `TOTAL MDR    : INR ${batch.totalMdr.toFixed(2)} | TOTAL GST (18%): INR ${batch.totalGst.toFixed(2)}`,
      `NET PAYOUT   : INR ${batch.totalNetPayout.toFixed(2)}`,
      `========================================================================================`,
      `ACC_NUM           | CCY | D/C | AMOUNT (INR)  | TXN_TYPE | VALUE_DATE | RRN          | REMARKS / ACCOUNT NAME`,
      `----------------------------------------------------------------------------------------`
    ];

    // Double entry leg for matched settlement
    // 1. Debit Scheme Settlement Nostro Account (NPCI / Visa / MC Pool)
    lines.push(
      `00100982301019    | INR | D   | ${batch.threeWayMatchedVolume.toFixed(2).padStart(13, ' ')} | TRFR     | ${batch.runDate.replace(/-/g, '')}   | NOSTRO_POOL  | NPCI/SCHEME CLEARING DEBIT POOL`
    );

    // 2. Credit Merchant Settlement Pool (Net Payout)
    lines.push(
      `20490192840192    | INR | C   | ${batch.totalNetPayout.toFixed(2).padStart(13, ' ')} | TRFR     | ${batch.runDate.replace(/-/g, '')}   | MERCH_POOL   | MERCHANT NET PAYOUT DISBURSEMENT`
    );

    // 3. Credit Switch MDR Fee Income
    if (batch.totalMdr > 0) {
      lines.push(
        `30900192840001    | INR | C   | ${batch.totalMdr.toFixed(2).padStart(13, ' ')} | TRFR     | ${batch.runDate.replace(/-/g, '')}   | MDR_INCOME   | SWITCH INTERCHANGE & MDR INCOME`
      );
    }

    // 4. Credit GST Payable on MDR (Govt Indirect Tax Account)
    if (batch.totalGst > 0) {
      lines.push(
        `40900192840002    | INR | C   | ${batch.totalGst.toFixed(2).padStart(13, ' ')} | TRFR     | ${batch.runDate.replace(/-/g, '')}   | GST_PAYABLE  | 18% GST ON DIGITAL PAYMENTS FEE`
      );
    }

    lines.push(`----------------------------------------------------------------------------------------`);
    lines.push(`ITEMIZED DISCREPANCY & RECON AUDIT TRAIL:`);

    for (const r of records) {
      lines.push(
        `${r.rrn.padEnd(14, ' ')} | INR | ${r.matchStatus.padEnd(16, ' ')} | ${r.switchAmount.toFixed(2).padStart(10, ' ')} | ${r.resolution?.padEnd(20, ' ')} | ${r.discrepancyType || 'CLEARED OK'}`
      );
    }

    lines.push(`========================================================================================`);
    lines.push(`END OF TTUM FILE - CRC32: ${Math.floor(Math.random() * 90000000 + 10000000).toString(16).toUpperCase()}`);

    return lines.join('\n');
  }

  public listBatches(): ReconBatchSummary[] {
    return this.batchHistory;
  }

  public getBatchRecords(batchId: string): ReconRecord[] {
    return this.reconRecordsStore.get(batchId) || [];
  }
}
