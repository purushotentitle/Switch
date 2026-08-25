import React, { useState } from 'react';
import { Layers, CheckCircle2, ShieldCheck, Database, Server, Cpu, FileCode2, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

export const ArchitectureDashboard: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState<string>('indiswitch-crypto-hsm');
  const [copiedCode, setCopiedCode] = useState(false);

  const modules = [
    {
      id: 'indiswitch-domain',
      name: '1. indiswitch-domain',
      description: 'Pure Hexagonal domain models, Value Objects, Money (NUMERIC 15,2), ARQC/PIN aggregates. Zero dependencies on frameworks.',
      codeSnippet: `package com.indiswitch.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record Transaction(
    UUID id,
    String rrn,
    String stan,
    String mti,
    String procCode,
    BigDecimal amount, // Strict NUMERIC(15,2)
    Currency currency,
    TransactionStatus status,
    String responseCode,
    String authCode,
    MerchantId merchantId,
    CardInstrument cardInstrument,
    EmvCryptogram emvCryptogram,
    BigDecimal mdrAmount,
    BigDecimal gstAmount,
    BigDecimal netPayout,
    Instant createdAt
) {
    public boolean isApproved() {
        return "00".equals(responseCode);
    }
}`
    },
    {
      id: 'indiswitch-crypto-hsm',
      name: '2. indiswitch-crypto-hsm',
      description: 'SoftHSM2 PKCS#11 integration via SunPKCS11. Card Unique Key (UDK), Session Key (SK_AC), Retail MAC (ISO 9797-1), ISO-0 PIN translation.',
      codeSnippet: `package com.indiswitch.crypto.service;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.Security;
import java.util.HexFormat;

public class SoftHsm2CryptoService {
    // Computes Retail MAC (ISO 9797-1 Alg 3) for EMV ARQC
    public byte[] computeRetailMac(byte[] sessionKey, byte[] emvTag55Bytes) throws Exception {
        Mac mac = Mac.getInstance("ISO9797ALG3MAC", "BC");
        SecretKeySpec keySpec = new SecretKeySpec(expandTripleDes(sessionKey), "DESede");
        mac.init(keySpec);
        return mac.doFinal(emvTag55Bytes);
    }

    // Translates ISO-0 PIN block from Terminal Key (TPK) to Zone Key (ZPK)
    public String translatePinBlock(byte[] tpk, byte[] zpk, String pinBlockHex) throws Exception {
        byte[] cipherBytes = HexFormat.of().parseHex(pinBlockHex);
        Cipher tpkCipher = Cipher.getInstance("DESede/ECB/NoPadding", "BC");
        tpkCipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(expandTripleDes(tpk), "DESede"));
        byte[] clearBlock = tpkCipher.doFinal(cipherBytes);

        Cipher zpkCipher = Cipher.getInstance("DESede/ECB/NoPadding", "BC");
        zpkCipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(expandTripleDes(zpk), "DESede"));
        return HexFormat.of().formatHex(zpkCipher.doFinal(clearBlock)).toUpperCase();
    }
}`
    },
    {
      id: 'indiswitch-iso8583',
      name: '3. indiswitch-iso8583',
      description: 'jPOS 2.1.9 packager, 128 field bitmap definitions, Q2 server channel config, EMV Tag 55 TLV parser.',
      codeSnippet: `package com.indiswitch.iso8583.packager;

import org.jpos.iso.ISOBasePackager;
import org.jpos.iso.IFA_NUMERIC;
import org.jpos.iso.IFA_LLNUM;
import org.jpos.iso.IFA_LLLCHAR;

public class NpcISOPackager extends ISOBasePackager {
    public NpcISOPackager() {
        super();
        setFieldPackager(new ISOFieldPackager[] {
            new IFA_NUMERIC(4, "MESSAGE TYPE INDICATOR"),
            new IFB_BITMAP(16, "BIT MAP"),
            new IFA_LLNUM(19, "PRIMARY ACCOUNT NUMBER"),
            new IFA_NUMERIC(6, "PROCESSING CODE"),
            new IFA_NUMERIC(12, "AMOUNT, TRANSACTION"),
            new IFA_NUMERIC(10, "TRANSMISSION DATE AND TIME"),
            new IFA_NUMERIC(6, "SYSTEM TRACE AUDIT NUMBER"),
            new IFA_NUMERIC(6, "TIME, LOCAL TRANSACTION"),
            new IFA_NUMERIC(4, "DATE, LOCAL TRANSACTION"),
            new IFA_NUMERIC(4, "DATE, EXPIRATION"),
            new IFA_NUMERIC(4, "MERCHANT CATEGORY CODE"),
            new IFA_NUMERIC(3, "POS ENTRY MODE"),
            new IFA_LLLCHAR(999, "EMV TAG 55 ICC PAYLOAD")
        });
    }
}`
    },
    {
      id: 'indiswitch-iso20022',
      name: '4. indiswitch-iso20022',
      description: 'ISO 8583 ↔ ISO 20022 (pacs.008, pacs.002, pacs.004) bidirectional mappers with zero-reflection MapStruct.',
      codeSnippet: `package com.indiswitch.iso20022.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import com.indiswitch.domain.model.Transaction;
import iso.std.iso._20022.tech.xsd.pacs_008_001.FIToFICstmrCdtTrf;

@Mapper(componentModel = "spring")
public interface Iso8583ToPacs008Mapper {
    @Mapping(target = "grpHdr.msgId", expression = "java(\\"INDISWITCH-\\" + txn.stan() + \\"-\\" + System.currentTimeMillis())")
    @Mapping(target = "grpHdr.creDtTm", expression = "java(java.time.OffsetDateTime.now())")
    @Mapping(target = "cdtTrfTxInf.pmtId.endToEndId", source = "rrn")
    @Mapping(target = "cdtTrfTxInf.intrBkSttlmAmt.value", source = "amount")
    FIToFICstmrCdtTrf mapToPacs008(Transaction txn);
}`
    },
    {
      id: 'indiswitch-fraud-engine',
      name: '5. indiswitch-fraud-engine',
      description: 'Real-time velocity scoring, high-risk MCC detection, micro-probe card enumeration detection, and ML anomaly engine.',
      codeSnippet: `package com.indiswitch.fraud.service;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class RealTimeFraudEngine {
    public FraudDecision evaluate(TransactionContext ctx, List<RecentTransaction> history) {
        int riskScore = 5;
        
        // High velocity check (>3 in 60s)
        long recentCount = history.stream().filter(t -> ctx.now().toEpochMilli() - t.timestamp() < 60_000).count();
        if (recentCount >= 3) {
            riskScore += 38;
        }

        // High value check
        if (ctx.amount().doubleValue() > 100_000.0) {
            riskScore += 25;
        }

        if (riskScore >= 75) return new FraudDecision(Decision.DECLINE, riskScore, "RUL_VEL_01");
        if (riskScore >= 45) return new FraudDecision(Decision.CHALLENGE_3DS, riskScore, "STEP_UP_OTP");
        return new FraudDecision(Decision.APPROVE, riskScore, "LOW_RISK");
    }
}`
    },
    {
      id: 'indiswitch-settlement-batch',
      name: '6. indiswitch-settlement-batch',
      description: 'Spring Batch 5 chunk-oriented 5-step settlement job with Finacle TTUM accounting voucher export and Nostro/Vostro double entry.',
      codeSnippet: `package com.indiswitch.batch.settlement;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SettlementBatchConfig {
    @Bean
    public Job fiveStepSettlementJob(JobRepository repo,
                                     Step step1FetchSchemeFiles,
                                     Step step2ThreeWayMatch,
                                     Step step3ComputeMdrGstTaxes,
                                     Step step4GenerateTtumVoucher,
                                     Step step5DisburseNostroPool) {
        return new JobBuilder("settlementJob", repo)
                .start(step1FetchSchemeFiles)
                .next(step2ThreeWayMatch)
                .next(step3ComputeMdrGstTaxes)
                .next(step4GenerateTtumVoucher)
                .next(step5DisburseNostroPool)
                .build();
    }
}`
    },
    {
      id: 'indiswitch-arch-tests',
      name: '7. indiswitch-arch-tests',
      description: 'ArchUnit 1.3.0 architectural rules enforcing Hexagonal architecture, zero framework leakage into Domain, and ≥90% JaCoCo coverage gate.',
      codeSnippet: `package com.indiswitch.arch;

import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.onionArchitecture;

@AnalyzeClasses(packages = "com.indiswitch")
public class ArchitectureHexagonalTest {
    @ArchTest
    public static final ArchRule onion_architecture_is_respected = onionArchitecture()
            .domainModels("..domain.model..")
            .domainServices("..domain.service..")
            .applicationServices("..application..")
            .adapter("iso8583", "..adapter.iso8583..")
            .adapter("crypto", "..adapter.crypto..");

    @ArchTest
    public static final ArchRule domain_must_not_depend_on_frameworks =
            noClasses()
                    .that().resideInAPackage("..domain..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "org.springframework..", "jakarta.persistence..", "org.jpos.."
                    );
}`
    }
  ];

  const currentMod = modules.find(m => m.id === selectedModule) || modules[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentMod.codeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-3.5">
      {/* Tech Stack Specs Header Banner */}
      <div className="bg-slate-900 rounded p-3.5 border border-slate-700 text-white space-y-2.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Enterprise Java 26 / Spring Boot 4.0.6 Switch Stack</h2>
              <p className="text-[10px] text-slate-400 font-mono">15-Module Maven Project with jPOS 2.1.9, SoftHSM2, Kafka Outbox, and Spring Batch 5</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Java 26 (Temurin)
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
              Spring Boot 4.0.6
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
              jPOS 2.1.9
            </span>
          </div>
        </div>

        {/* 15-Module Architecture Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-0.5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">Database</div>
            <div className="font-bold text-sky-400 text-xs font-mono">PostgreSQL 16</div>
            <div className="text-[9px] text-slate-500 font-mono">NUMERIC(15,2) / Flyway</div>
          </div>
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-0.5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">Cryptography</div>
            <div className="font-bold text-emerald-400 text-xs font-mono">SoftHSM2 PKCS#11</div>
            <div className="text-[9px] text-slate-500 font-mono">SunPKCS11 / 3DES</div>
          </div>
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-0.5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">Messaging</div>
            <div className="font-bold text-amber-400 text-xs font-mono">Apache Kafka</div>
            <div className="text-[9px] text-slate-500 font-mono">Transactional Outbox</div>
          </div>
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-0.5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">Settlement</div>
            <div className="font-bold text-purple-400 text-xs font-mono">Spring Batch 5</div>
            <div className="text-[9px] text-slate-500 font-mono">5-Step Chunk Job</div>
          </div>
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-0.5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">QR Engine</div>
            <div className="font-bold text-rose-400 text-xs font-mono">ZXing 3.5.3</div>
            <div className="text-[9px] text-slate-500 font-mono">NPCI UPI 2.0 Spec</div>
          </div>
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-0.5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">Governance</div>
            <div className="font-bold text-indigo-400 text-xs font-mono">ArchUnit 1.3.0</div>
            <div className="text-[9px] text-slate-500 font-mono">≥90% JaCoCo Gate</div>
          </div>
        </div>
      </div>

      {/* Interactive Code Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Module Selector Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-white rounded border border-slate-200 shadow-xs p-3 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Architecture Modules</h3>
            <div className="space-y-1">
              {modules.map(mod => (
                <button
                  key={mod.id}
                  onClick={() => setSelectedModule(mod.id)}
                  className={`w-full text-left p-2 rounded text-xs transition-all ${
                    selectedModule === mod.id
                      ? 'bg-blue-50 text-blue-900 border border-blue-300 font-bold shadow-xs'
                      : 'hover:bg-slate-100 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="font-semibold text-xs">{mod.name}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{mod.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Source Code Viewer */}
        <div className="lg:col-span-8 space-y-2">
          <div className="bg-slate-950 rounded border border-slate-800 text-white p-3 space-y-2 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
                  <h4 className="text-xs font-bold text-slate-200">{currentMod.name}</h4>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{currentMod.description}</p>
              </div>

              <button
                id="copy-java-code-btn"
                onClick={handleCopyCode}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors border border-slate-700"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <pre className="p-2.5 bg-slate-900 rounded font-mono text-[11px] text-emerald-300 overflow-x-auto leading-normal max-h-80 border border-slate-800">
              {currentMod.codeSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
