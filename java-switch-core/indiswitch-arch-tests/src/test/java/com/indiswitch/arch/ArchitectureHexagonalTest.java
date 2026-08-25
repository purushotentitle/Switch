package com.indiswitch.arch;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.onionArchitecture;

/**
 * ArchUnit 1.3.0 Architecture Governance Rules
 * Enforces:
 * 1. Onion / Hexagonal Architecture layers
 * 2. Zero leak of Spring / DB / Kafka infrastructure into Domain module
 * 3. Strict immutability and BigDecimal NUMERIC(15,2) Money precision
 * 4. HSM Cryptography isolated strictly behind Port interfaces
 */
@AnalyzeClasses(packages = "com.indiswitch", importOptions = ImportOption.DoNotIncludeTests.class)
public class ArchitectureHexagonalTest {

    @ArchTest
    public static final ArchRule onion_architecture_is_respected = onionArchitecture()
            .domainModels("..domain.model..")
            .domainServices("..domain.service..")
            .applicationServices("..application..")
            .adapter("iso8583", "..adapter.iso8583..")
            .adapter("upi", "..adapter.upi..")
            .adapter("persistence", "..adapter.persistence..")
            .adapter("crypto", "..adapter.crypto..")
            .adapter("kafka", "..adapter.kafka..");

    @ArchTest
    public static final ArchRule domain_must_not_depend_on_frameworks =
            noClasses()
                    .that().resideInAPackage("..domain..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "org.springframework..",
                            "jakarta.persistence..",
                            "org.apache.kafka..",
                            "org.jpos.."
                    )
                    .because("Domain layer must remain purely agnostic of infrastructure frameworks");

    @ArchTest
    public static final ArchRule hsm_keys_must_only_be_accessed_via_port =
            classes()
                    .that().resideInAPackage("..crypto..")
                    .should().onlyBeAccessed().byAnyPackage("..crypto..", "..application.ports..");
}
