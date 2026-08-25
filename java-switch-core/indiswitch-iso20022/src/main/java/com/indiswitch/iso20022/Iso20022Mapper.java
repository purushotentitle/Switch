package com.indiswitch.iso20022;

import com.indiswitch.domain.model.SwitchTransaction;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;

/**
 * Zero-Reflection ISO 8583 ↔ ISO 20022 (pacs.008.001.08 / pacs.002.001.10) Mapper.
 */
@Component
public class Iso20022Mapper {

    public String toPacs008Xml(SwitchTransaction txn) {
        String msgId = "PACS008-" + txn.rrn();
        String creationDateTime = DateTimeFormatter.ISO_INSTANT.format(txn.timestamp());

        return String.format("""
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
              <FIToFICstmrCdtTrf>
                <GrpHdr>
                  <MsgId>%s</MsgId>
                  <CreDtTm>%s</CreDtTm>
                  <NbOfTxs>1</NbOfTxs>
                  <SttlmInf>
                    <SttlmMtd>CLRG</SttlmMtd>
                    <ClrSys>
                      <Prtry>NPCI_UPI_SWITCH</Prtry>
                    </ClrSys>
                  </SttlmInf>
                </GrpHdr>
                <CdtTrfTxInf>
                  <PmtId>
                    <EndToEndId>%s</EndToEndId>
                    <TxId>%s</TxId>
                  </PmtId>
                  <IntrBkSttlmAmt Ccy="INR">%.2f</IntrBkSttlmAmt>
                  <Dbtr>
                    <Nm>Customer / Cardholder</Nm>
                  </Dbtr>
                  <Cdtr>
                    <Nm>%s</Nm>
                  </Cdtr>
                  <RmtInf>
                    <Ustrd>Purchase at Terminal %s</Ustrd>
                  </RmtInf>
                </CdtTrfTxInf>
              </FIToFICstmrCdtTrf>
            </Document>
            """, msgId, creationDateTime, txn.rrn(), txn.stan(), txn.amount(), txn.merchantId(), txn.terminalId());
    }
}
