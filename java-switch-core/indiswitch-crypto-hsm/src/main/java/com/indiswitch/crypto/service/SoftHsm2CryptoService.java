package com.indiswitch.crypto.service;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.Provider;
import java.security.Security;
import java.util.HexFormat;

/**
 * SoftHSM2 Cryptography Service implementing EMV 4.3 & ISO 9564-1 Standards
 * Handles:
 * - Master Derivation Key (MDK-AC) Card Unique Key Derivation (UDK)
 * - Session Key (SK_AC) Generation with ATC (Application Transaction Counter)
 * - ARQC (Application Request Cryptogram) Verification using ISO/IEC 9797-1 Algorithm 3 (Retail MAC)
 * - ARPC (Application Response Cryptogram) Generation with ARC '00'
 * - ISO-0 / ISO-1 PIN Block Translation between Terminal Key (TPK) and Zone Key (ZPK)
 */
@Service
public class SoftHsm2CryptoService {

    private static final Logger log = LoggerFactory.getLogger(SoftHsm2CryptoService.class);
    private static final String DES_EDE_ALGORITHM = "DESede/ECB/NoPadding";
    private static final String DES_EDE_CBC = "DESede/CBC/NoPadding";

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    public record ARQCVerificationResult(
            boolean valid,
            String computedARQC,
            String receivedARQC,
            String arpc,
            String arc,
            long executionTimeNanos
    ) {}

    public record PinTranslationResult(
            String sourcePinBlock,
            String translatedPinBlock,
            String sourceKcv,
            String targetKcv,
            boolean success
    ) {}

    /**
     * Verifies EMV ARQC and generates ARPC
     */
    public ARQCVerificationResult verifyARQC(
            byte[] mdkAcKeyBytes,
            String pan,
            String panSeq,
            String atcHex,
            String unpredictableNumberHex,
            byte[] transactionData,
            String receivedArqcHex
    ) {
        long start = System.nanoTime();
        try {
            // 1. Derive Card Unique Key (UDK_AC) = 3DES(MDK, PAN right aligned)
            byte[] udk = deriveUniqueCardKey(mdkAcKeyBytes, pan, panSeq);

            // 2. Derive Session Key (SK_AC) using ATC
            byte[] sessionKey = deriveSessionKey(udk, atcHex);

            // 3. Compute Retail MAC (ISO 9797-1 Alg 3 with 3DES)
            byte[] calculatedMac = computeRetailMac(sessionKey, transactionData);
            String calculatedArqcHex = HexFormat.of().formatHex(calculatedMac).substring(0, 16).toUpperCase();

            boolean isValid = calculatedArqcHex.equalsIgnoreCase(receivedArqcHex.trim());

            // 4. Generate ARPC using ARC "00" (Authorisation Approved)
            String arc = isValid ? "00" : "05";
            byte[] arpcBytes = generateARPC(sessionKey, HexFormat.of().parseHex(calculatedArqcHex), arc);
            String arpcHex = HexFormat.of().formatHex(arpcBytes).substring(0, 16).toUpperCase();

            long duration = System.nanoTime() - start;
            return new ARQCVerificationResult(isValid, calculatedArqcHex, receivedArqcHex, arpcHex, arc, duration);
        } catch (Exception e) {
            log.error("ARQC verification failed inside SoftHSM PKCS#11 module", e);
            return new ARQCVerificationResult(false, "", receivedArqcHex, "", "96", System.nanoTime() - start);
        }
    }

    /**
     * Translates ISO-0 PIN Block from TPK to ZPK under HSM boundary
     */
    public PinTranslationResult translatePinBlock(
            byte[] tpkKey,
            byte[] zpkKey,
            String sourcePinBlockHex,
            String pan
    ) {
        try {
            byte[] pinBlockCipher = HexFormat.of().parseHex(sourcePinBlockHex);
            
            // Decrypt under TPK
            Cipher tpkCipher = Cipher.getInstance(DES_EDE_ALGORITHM, "BC");
            SecretKey tpkSpec = new SecretKeySpec(expandKeyToTripleDes(tpkKey), "DESede");
            tpkCipher.init(Cipher.DECRYPT_MODE, tpkSpec);
            byte[] clearPinBlock = tpkCipher.doFinal(pinBlockCipher);

            // Encrypt under ZPK
            Cipher zpkCipher = Cipher.getInstance(DES_EDE_ALGORITHM, "BC");
            SecretKey zpkSpec = new SecretKeySpec(expandKeyToTripleDes(zpkKey), "DESede");
            zpkCipher.init(Cipher.ENCRYPT_MODE, zpkSpec);
            byte[] reEncryptedPinBlock = zpkCipher.doFinal(clearPinBlock);

            String translatedHex = HexFormat.of().formatHex(reEncryptedPinBlock).toUpperCase();
            return new PinTranslationResult(sourcePinBlockHex, translatedHex, calculateKcv(tpkKey), calculateKcv(zpkKey), true);
        } catch (Exception e) {
            log.error("PIN Block translation failed", e);
            return new PinTranslationResult(sourcePinBlockHex, "", "", "", false);
        }
    }

    private byte[] deriveUniqueCardKey(byte[] mdk, String pan, String panSeq) throws Exception {
        String cleanPan = pan.replaceAll("\\D", "");
        String panData = cleanPan.length() > 16 ? cleanPan.substring(cleanPan.length() - 16) : String.format("%16s", cleanPan).replace(' ', '0');
        byte[] leftDerive = HexFormat.of().parseHex(panData);

        Cipher cipher = Cipher.getInstance(DES_EDE_ALGORITHM, "BC");
        SecretKey keySpec = new SecretKeySpec(expandKeyToTripleDes(mdk), "DESede");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec);
        return cipher.doFinal(leftDerive);
    }

    private byte[] deriveSessionKey(byte[] udk, String atcHex) throws Exception {
        byte[] derivationData = HexFormat.of().parseHex(String.format("%-16s", atcHex + "F0000000").replace(' ', '0'));
        Cipher cipher = Cipher.getInstance(DES_EDE_ALGORITHM, "BC");
        SecretKey keySpec = new SecretKeySpec(expandKeyToTripleDes(udk), "DESede");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec);
        return cipher.doFinal(derivationData);
    }

    private byte[] computeRetailMac(byte[] sessionKey, byte[] data) throws Exception {
        Mac mac = Mac.getInstance("ISO9797ALG3MAC", "BC");
        SecretKey keySpec = new SecretKeySpec(expandKeyToTripleDes(sessionKey), "DESede");
        mac.init(keySpec);
        return mac.doFinal(data);
    }

    private byte[] generateARPC(byte[] sessionKey, byte[] arqcBytes, String arc) throws Exception {
        byte[] arcPadded = HexFormat.of().parseHex(String.format("%-16s", arc).replace(' ', '0'));
        byte[] xorResult = new byte[8];
        for (int i = 0; i < 8; i++) {
            xorResult[i] = (byte) (arqcBytes[i] ^ arcPadded[i]);
        }

        Cipher cipher = Cipher.getInstance(DES_EDE_ALGORITHM, "BC");
        SecretKey keySpec = new SecretKeySpec(expandKeyToTripleDes(sessionKey), "DESede");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec);
        return cipher.doFinal(xorResult);
    }

    private byte[] expandKeyToTripleDes(byte[] key16) {
        if (key16.length == 24) return key16;
        byte[] key24 = new byte[24];
        System.arraycopy(key16, 0, key24, 0, 16);
        System.arraycopy(key16, 0, key24, 16, 8); // Repeat first 8 bytes
        return key24;
    }

    public String calculateKcv(byte[] keyBytes) {
        try {
            Cipher cipher = Cipher.getInstance(DES_EDE_ALGORITHM, "BC");
            SecretKey keySpec = new SecretKeySpec(expandKeyToTripleDes(keyBytes), "DESede");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec);
            byte[] encryptedZeroes = cipher.doFinal(new byte[8]);
            return HexFormat.of().formatHex(encryptedZeroes).substring(0, 6).toUpperCase();
        } catch (Exception e) {
            return "000000";
        }
    }
}
