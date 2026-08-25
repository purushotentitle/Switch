package com.indiswitch.upi;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * NPCI UPI 2.0 Dynamic QR Code generation engine utilizing ZXing 3.5.3.
 */
public class UpiDynamicQrEngine {

    public static String buildUpiIntentString(
        String vpa,
        String payeeName,
        String merchantCode,
        String txnRef,
        BigDecimal amount,
        String note
    ) {
        return String.format(
            "upi://pay?pa=%s&pn=%s&mc=%s&tr=%s&am=%.2f&cu=INR&tn=%s",
            URLEncoder.encode(vpa, StandardCharsets.UTF_8),
            URLEncoder.encode(payeeName, StandardCharsets.UTF_8),
            URLEncoder.encode(merchantCode, StandardCharsets.UTF_8),
            URLEncoder.encode(txnRef, StandardCharsets.UTF_8),
            amount,
            URLEncoder.encode(note, StandardCharsets.UTF_8)
        );
    }

    public static String generateBase64Qr(String upiPayload, int width, int height) throws Exception {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        BitMatrix bitMatrix = qrCodeWriter.encode(upiPayload, BarcodeFormat.QR_CODE, width, height);

        ByteArrayOutputStream pngOutputStream = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", pngOutputStream);
        byte[] pngData = pngOutputStream.toByteArray();
        return Base64.getEncoder().encodeToString(pngData);
    }
}
