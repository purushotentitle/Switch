import { ISOMessage } from '../../src/types/payment.js';

export interface ISO20022Document {
  messageType: 'pacs.008.001.08' | 'pacs.002.001.10' | 'pacs.004.001.09' | 'pain.001.001.09' | 'camt.053.001.08';
  header: {
    messageId: string;
    creationDateTime: string;
    initiatingParty: string;
    settlementMethod: string;
  };
  body: any;
  xml: string;
}

export class ISO8583To20022Mapper {
  /**
   * Converts ISO 8583 (0200 / 0100) to ISO 20022 pacs.008.001.08 (Financial Transfer)
   */
  public static mapToPacs008(iso: ISOMessage): ISO20022Document {
    const rrn = iso.fields[37] || `RRN${Date.now()}`;
    const stan = iso.fields[11] || '000001';
    const amountMinor = parseInt(iso.fields[4] || '0', 10);
    const amountINR = (amountMinor / 100).toFixed(2);
    const currency = iso.fields[49] === '356' ? 'INR' : 'INR';
    const pan = iso.fields[2] || '';
    const maskedPan = pan ? pan.substring(0, 6) + '******' + pan.substring(pan.length - 4) : 'UNKNOWN';
    const mid = iso.fields[42] || 'MID_DEFAULT';
    const merchantName = iso.fields[43] || 'Retail Merchant Mumbai IN';
    const dateStr = new Date().toISOString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>INDISWITCH-MSG-${stan}-${Date.now()}</MsgId>
      <CreDtTm>${dateStr}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
        <ClrSys>
          <Prtry>NPCI_NFS_RUPAY</Prtry>
        </ClrSys>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>${rrn}</EndToEndId>
        <TxId>STAN-${stan}</TxId>
        <ClrSysRef>${rrn}</ClrSysRef>
      </PmtId>
      <IntrBkSttlmAmt Ccy="${currency}">${amountINR}</IntrBkSttlmAmt>
      <IntrBkSttlmDt>${dateStr.substring(0, 10)}</IntrBkSttlmDt>
      <Dbtr>
        <Nm>Cardholder (${maskedPan})</Nm>
        <Id>
          <OrgId>
            <Othr>
              <Id>${pan.substring(0, 6)}</Id>
              <SchmeNm><Prtry>IIN_BIN</Prtry></SchmeNm>
            </Othr>
          </OrgId>
        </Id>
      </Dbtr>
      <DbtrAgt>
        <FinInstnId>
          <ClrSysMmbId>
            <MmbId>${iso.fields[32] || 'HDFC0000001'}</MmbId>
          </ClrSysMmbId>
          <Nm>Acquiring Bank</Nm>
        </FinInstnId>
      </DbtrAgt>
      <CdtrAgt>
        <FinInstnId>
          <ClrSysMmbId>
            <MmbId>NPCI0000001</MmbId>
          </ClrSysMmbId>
          <Nm>NPCI Switch Router</Nm>
        </FinInstnId>
      </CdtrAgt>
      <Cdtr>
        <Nm>${merchantName.trim()}</Nm>
        <Id>
          <OrgId>
            <Othr>
              <Id>${mid}</Id>
              <SchmeNm><Prtry>MERCHANT_ID</Prtry></SchmeNm>
            </Othr>
          </OrgId>
        </Id>
      </Cdtr>
      <Purp>
        <Prtry>POS_RETAIL_PURCHASE</Prtry>
      </Purp>
      <RmtInf>
        <Ustrd>POS Transaction Stan:${stan} EntryMode:${iso.fields[22] || '051'}</Ustrd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`;

    return {
      messageType: 'pacs.008.001.08',
      header: {
        messageId: `INDISWITCH-MSG-${stan}-${Date.now()}`,
        creationDateTime: dateStr,
        initiatingParty: mid,
        settlementMethod: 'CLRG_NPCI'
      },
      body: {
        endToEndId: rrn,
        txId: `STAN-${stan}`,
        amount: parseFloat(amountINR),
        currency,
        debtorMaskedPan: maskedPan,
        creditorMid: mid,
        creditorName: merchantName.trim()
      },
      xml
    };
  }

  /**
   * Converts ISO 8583 (0210 / 0110) to ISO 20022 pacs.002.001.10 (Payment Status Report)
   */
  public static mapToPacs002(iso: ISOMessage): ISO20022Document {
    const rrn = iso.fields[37] || `RRN${Date.now()}`;
    const stan = iso.fields[11] || '000001';
    const responseCode = iso.fields[39] || '00';
    const authCode = iso.fields[38] || 'AUTH01';
    const dateStr = new Date().toISOString();
    const isApproved = responseCode === '00';
    const txStatus = isApproved ? 'ACTC' : 'RJCT'; // Accepted Technical / Rejected

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10">
  <FIToFIPmtStsRpt>
    <GrpHdr>
      <MsgId>INDISWITCH-RPT-${stan}-${Date.now()}</MsgId>
      <CreDtTm>${dateStr}</CreDtTm>
    </GrpHdr>
    <TxInfAndSts>
      <OrgnlEndToEndId>${rrn}</OrgnlEndToEndId>
      <OrgnlTxId>STAN-${stan}</OrgnlTxId>
      <TxSts>${txStatus}</TxSts>
      <StsRsnInf>
        <Rsn>
          <Prtry>ISO_RC_${responseCode}</Prtry>
        </Rsn>
        <AddtlInf>${isApproved ? `Approved with AuthCode: ${authCode}` : `Declined with ISO RC ${responseCode}`}</AddtlInf>
      </StsRsnInf>
      <ClrSysRef>${rrn}</ClrSysRef>
    </TxInfAndSts>
  </FIToFIPmtStsRpt>
</Document>`;

    return {
      messageType: 'pacs.002.001.10',
      header: {
        messageId: `INDISWITCH-RPT-${stan}-${Date.now()}`,
        creationDateTime: dateStr,
        initiatingParty: 'ISSUER_SWITCH',
        settlementMethod: 'CLRG_NPCI'
      },
      body: {
        originalEndToEndId: rrn,
        originalTxId: `STAN-${stan}`,
        transactionStatus: txStatus,
        responseCode,
        authCode,
        approved: isApproved
      },
      xml
    };
  }

  /**
   * Converts ISO 8583 (0420 Reversal) to ISO 20022 pacs.004.001.09 (Payment Return)
   */
  public static mapToPacs004(iso: ISOMessage): ISO20022Document {
    const rrn = iso.fields[37] || `RRN${Date.now()}`;
    const stan = iso.fields[11] || '000001';
    const amountMinor = parseInt(iso.fields[4] || '0', 10);
    const amountINR = (amountMinor / 100).toFixed(2);
    const dateStr = new Date().toISOString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.004.001.09">
  <PmtRtr>
    <GrpHdr>
      <MsgId>INDISWITCH-RTR-${stan}-${Date.now()}</MsgId>
      <CreDtTm>${dateStr}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
    </GrpHdr>
    <TxInf>
      <RtrId>REV-${rrn}</RtrId>
      <OrgnlEndToEndId>${rrn}</OrgnlEndToEndId>
      <RtrdIntrBkSttlmAmt Ccy="INR">${amountINR}</RtrdIntrBkSttlmAmt>
      <RtrRsnInf>
        <Rsn>
          <Cd>CUST</Cd>
        </Rsn>
        <AddtlInf>Auto-reversal on POS Timeout / 0420 Trigger</AddtlInf>
      </RtrRsnInf>
    </TxInf>
  </PmtRtr>
</Document>`;

    return {
      messageType: 'pacs.004.001.09',
      header: {
        messageId: `INDISWITCH-RTR-${stan}-${Date.now()}`,
        creationDateTime: dateStr,
        initiatingParty: 'SWITCH_ACQUIRER',
        settlementMethod: 'CLRG_NPCI'
      },
      body: {
        returnId: `REV-${rrn}`,
        originalEndToEndId: rrn,
        returnedAmount: parseFloat(amountINR),
        reason: 'Auto-reversal on POS Timeout'
      },
      xml
    };
  }
}
