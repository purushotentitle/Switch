package com.indiswitch.domain.model;

/**
 * EMV 4.3 ICC Tag 55 Cryptogram payload.
 */
public record EmvTag55Data(
    String arqc,                // Tag 9F26
    String atc,                 // Tag 9F36
    String unpredictableNumber, // Tag 9F37
    String tvr,                 // Tag 95
    String aip,                 // Tag 82
    String iad                  // Tag 9F10
) {}
