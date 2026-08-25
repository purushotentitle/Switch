package com.indiswitch.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * Immutable Java 26 Record representing an Authoritative Payment Transaction.
 */
public record SwitchTransaction(
    String rrn,
    String stan,
    String mti,
    String processingCode,
    BigDecimal amount,
    String currencyCode,
    String merchantId,
    String terminalId,
    String maskedPan,
    String cardBrand,
    String authCode,
    String responseCode,
    TransactionStatus status,
    BigDecimal mdrAmount,
    BigDecimal gstAmount,
    BigDecimal netPayout,
    Integer fraudScore,
    EmvTag55Data emvData,
    Instant timestamp,
    Map<String, String> isoFields
) {
    public SwitchTransaction {
        if (rrn == null || rrn.isBlank()) {
            throw new IllegalArgumentException("RRN cannot be null or empty");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Amount must be non-negative");
        }
    }
}
