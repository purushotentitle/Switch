import { ISO_FIELD_DEFINITIONS } from './fields.js';
import { EMVTLVData, ISOMessage } from '../../src/types/payment.js';

export class ISOPackager {
  /**
   * Parses an ISO 8583 message string (Hex or ASCII)
   */
  public static unpack(rawInput: string): ISOMessage {
    const cleanInput = rawInput.trim();
    let isHex = /^[0-9A-Fa-f]+$/.test(cleanInput) && cleanInput.length >= 36;
    
    let mti = '';
    let bitmapHex = '';
    let body = '';

    if (isHex && cleanInput.startsWith('30') && cleanInput.length > 40) {
      // Hex-encoded ASCII (e.g. 30323030 for '0200')
      const decodedAscii = Buffer.from(cleanInput, 'hex').toString('utf8');
      return this.unpack(decodedAscii);
    }

    if (cleanInput.length >= 20 && !isHex) {
      // ASCII MTI (4 chars) + Hex Bitmap (16 or 32 chars) + Data
      mti = cleanInput.substring(0, 4);
      const primaryBitmapHex = cleanInput.substring(4, 20);
      let totalBitmapLength = 16;
      
      // Check if Field 1 (Secondary Bitmap) is present
      const firstByte = parseInt(primaryBitmapHex.substring(0, 2), 16);
      const hasSecondary = (firstByte & 0x80) !== 0;
      if (hasSecondary && cleanInput.length >= 36) {
        totalBitmapLength = 32;
        bitmapHex = cleanInput.substring(4, 36);
      } else {
        bitmapHex = primaryBitmapHex;
      }
      body = cleanInput.substring(4 + totalBitmapLength);
    } else {
      // Raw string format
      mti = cleanInput.substring(0, 4);
      bitmapHex = cleanInput.substring(4, 20);
      body = cleanInput.substring(20);
    }

    const presentFields = this.parseBitmapToFields(bitmapHex);
    const fields: Record<number, string> = {};

    let cursor = 0;
    for (const fieldNum of presentFields) {
      if (fieldNum === 1) continue; // Skip secondary bitmap indicator
      const def = ISO_FIELD_DEFINITIONS[fieldNum];
      if (!def) {
        // Fallback default: fixed 10 chars if undefined
        const val = body.substring(cursor, cursor + 10);
        fields[fieldNum] = val;
        cursor += 10;
        continue;
      }

      let value = '';
      if (def.type === 'LLVAR_NUMERIC' || def.type === 'LLVAR_ALPHANUMERIC') {
        const lenStr = body.substring(cursor, cursor + 2);
        const len = parseInt(lenStr, 10) || 0;
        cursor += 2;
        value = body.substring(cursor, cursor + len);
        cursor += len;
      } else if (def.type === 'LLLVAR_NUMERIC' || def.type === 'LLLVAR_ALPHANUMERIC' || def.type === 'LLLVAR_BINARY') {
        const lenStr = body.substring(cursor, cursor + 3);
        const len = parseInt(lenStr, 10) || 0;
        cursor += 3;
        value = body.substring(cursor, cursor + len);
        cursor += len;
      } else {
        // FIXED length
        value = body.substring(cursor, cursor + def.maxLength);
        cursor += def.maxLength;
      }

      fields[fieldNum] = value;
    }

    return {
      mti,
      bitmapHex,
      fields,
      rawAscii: cleanInput,
      rawHex: Buffer.from(cleanInput).toString('hex').toUpperCase(),
      parsedAt: new Date().toISOString()
    };
  }

  /**
   * Packs an ISOMessage object into raw wire format
   */
  public static pack(mti: string, fields: Record<number, string>): { rawString: string; rawHex: string; bitmapHex: string } {
    const fieldNums = Object.keys(fields).map(Number).sort((a, b) => a - b);
    const maxField = Math.max(...fieldNums, 0);
    const useSecondary = maxField > 64;

    const bitmapBytes = new Uint8Array(useSecondary ? 16 : 8);
    if (useSecondary) {
      bitmapBytes[0] |= 0x80; // Field 1 bit
    }

    for (const f of fieldNums) {
      if (f < 1 || f > 128) continue;
      const byteIndex = Math.floor((f - 1) / 8);
      const bitIndex = 7 - ((f - 1) % 8);
      bitmapBytes[byteIndex] |= (1 << bitIndex);
    }

    const bitmapHex = Buffer.from(bitmapBytes).toString('hex').toUpperCase();
    let body = '';

    for (const f of fieldNums) {
      if (f === 1) continue;
      const val = fields[f] || '';
      const def = ISO_FIELD_DEFINITIONS[f];

      if (!def) {
        body += val;
        continue;
      }

      if (def.type.startsWith('LLVAR')) {
        const lenStr = String(val.length).padStart(2, '0');
        body += lenStr + val;
      } else if (def.type.startsWith('LLLVAR')) {
        const lenStr = String(val.length).padStart(3, '0');
        body += lenStr + val;
      } else {
        // Fixed length - pad if necessary
        if (def.type === 'NUMERIC') {
          body += val.padStart(def.maxLength, '0').substring(0, def.maxLength);
        } else {
          body += val.padEnd(def.maxLength, ' ').substring(0, def.maxLength);
        }
      }
    }

    const rawString = mti + bitmapHex + body;
    const rawHex = Buffer.from(rawString).toString('hex').toUpperCase();

    return {
      rawString,
      rawHex,
      bitmapHex
    };
  }

  /**
   * Converts Bitmap Hex to array of present field numbers (1-128)
   */
  public static parseBitmapToFields(bitmapHex: string): number[] {
    const fields: number[] = [];
    const bytes = Buffer.from(bitmapHex, 'hex');

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      for (let bit = 7; bit >= 0; bit--) {
        if ((byte & (1 << bit)) !== 0) {
          const fieldNum = i * 8 + (7 - bit) + 1;
          fields.push(fieldNum);
        }
      }
    }

    return fields;
  }

  /**
   * Parses EMV Tag 55 (Integrated Circuit Card) TLV hex payload
   */
  public static parseEMVTag55(hexPayload: string): EMVTLVData[] {
    if (!hexPayload || hexPayload.length < 4) return [];
    const results: EMVTLVData[] = [];
    let idx = 0;
    const clean = hexPayload.replace(/\s+/g, '').toUpperCase();

    const KNOWN_EMV_TAGS: Record<string, string> = {
      '9F26': 'Application Cryptogram (ARQC/TC/AAC)',
      '9F27': 'Cryptogram Information Data (CID)',
      '9F10': 'Issuer Application Data (IAD)',
      '9F37': 'Unpredictable Number (UN)',
      '9F36': 'Application Transaction Counter (ATC)',
      '95': 'Terminal Verification Results (TVR)',
      '9A': 'Transaction Date',
      '9C': 'Transaction Type',
      '9F02': 'Amount, Authorized (Numeric)',
      '5F2A': 'Transaction Currency Code',
      '82': 'Application Interchange Profile (AIP)',
      '9F1A': 'Terminal Country Code',
      '9F03': 'Amount, Other (Numeric)',
      '9F33': 'Terminal Capabilities',
      '9F34': 'Cardholder Verification Method (CVM) Results',
      '9F35': 'Terminal Type',
      '84': 'Dedicated File (DF) Name / AID',
      '50': 'Application Label',
      '5A': 'Application Primary Account Number (PAN)'
    };

    while (idx < clean.length) {
      let tag = clean.substring(idx, idx + 2);
      idx += 2;

      // Check if two-byte tag (if lower 5 bits of first byte are 11111, i.e. 0x1F)
      const firstByteVal = parseInt(tag, 16);
      if ((firstByteVal & 0x1F) === 0x1F && idx < clean.length) {
        tag += clean.substring(idx, idx + 2);
        idx += 2;
      }

      if (idx >= clean.length) break;

      // Length byte
      let lenByte = parseInt(clean.substring(idx, idx + 2), 16);
      idx += 2;
      let lenInBytes = lenByte;

      if ((lenByte & 0x80) !== 0) {
        const numLenBytes = lenByte & 0x7F;
        if (numLenBytes === 1 && idx < clean.length) {
          lenInBytes = parseInt(clean.substring(idx, idx + 2), 16);
          idx += 2;
        }
      }

      const valHexLen = lenInBytes * 2;
      if (idx + valHexLen > clean.length) {
        valHexLen === clean.length - idx;
      }

      const valueHex = clean.substring(idx, idx + valHexLen);
      idx += valHexLen;

      results.push({
        tag,
        name: KNOWN_EMV_TAGS[tag] || `Tag ${tag}`,
        length: lenInBytes,
        value: valueHex,
        description: KNOWN_EMV_TAGS[tag]
      });
    }

    return results;
  }

  /**
   * Encodes EMV TLV data into hex string for Tag 55
   */
  public static encodeEMVTag55(tags: { tag: string; value: string }[]): string {
    let result = '';
    for (const item of tags) {
      const cleanVal = item.value.replace(/\s+/g, '');
      const byteLen = Math.floor(cleanVal.length / 2);
      const lenHex = byteLen.toString(16).padStart(2, '0').toUpperCase();
      result += item.tag.toUpperCase() + lenHex + cleanVal.toUpperCase();
    }
    return result;
  }
}
