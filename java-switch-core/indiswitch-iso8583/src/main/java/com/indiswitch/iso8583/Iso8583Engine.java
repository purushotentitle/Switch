package com.indiswitch.iso8583;

import org.jpos.iso.ISOMsg;
import org.jpos.iso.ISOPackager;
import org.jpos.iso.packager.GenericPackager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Enterprise ISO 8583:1987 message unpacker and builder wrapping jPOS 2.1.9.
 */
public class Iso8583Engine {

    private static final Logger log = LoggerFactory.getLogger(Iso8583Engine.class);
    private final ISOPackager packager;

    public Iso8583Engine() {
        try (InputStream is = getClass().getResourceAsStream("/iso8583/iso87ascii.xml")) {
            if (is != null) {
                this.packager = new GenericPackager(is);
            } else {
                this.packager = null;
            }
        } catch (Exception e) {
            log.error("Failed to initialize jPOS GenericPackager", e);
            throw new RuntimeException("jPOS initialization failed", e);
        }
    }

    public ISOMsg parseRawBytes(byte[] rawPacket) throws Exception {
        ISOMsg isoMsg = new ISOMsg();
        if (packager != null) {
            isoMsg.setPackager(packager);
            isoMsg.unpack(rawPacket);
        }
        return isoMsg;
    }

    public Map<Integer, String> extractFields(ISOMsg msg) {
        Map<Integer, String> fields = new HashMap<>();
        for (int i = 1; i <= msg.getMaxField(); i++) {
            if (msg.hasField(i)) {
                fields.put(i, msg.getString(i));
            }
        }
        return fields;
    }
}
