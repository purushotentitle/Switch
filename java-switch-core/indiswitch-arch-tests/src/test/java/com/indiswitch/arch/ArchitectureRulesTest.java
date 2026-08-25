package com.indiswitch.arch;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * ArchUnit 1.3.0 Architecture Governance Tests.
 * Enforces Onion/Hexagonal layered architecture and Domain Isolation.
 */
@AnalyzeClasses(packages = "com.indiswitch", importOptions = ImportOption.DoNotIncludeTests.class)
public class ArchitectureRulesTest {

    @ArchTest
    public static final ArchRule domain_must_not_depend_on_infrastructure =
        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAnyPackage("..persistence..", "..messaging..", "..api..")
            .because("Domain core models must be strictly decoupled from external I/O & frameworks.");

    @ArchTest
    public static final ArchRule controllers_must_be_annotated_with_rest_controller =
        classes().that().resideInAPackage("..api..")
            .and().haveSimpleNameEndingWith("Controller")
            .should().beAnnotatedWith("org.springframework.web.bind.annotation.RestController")
            .because("All API entrypoints must follow Spring REST conventions.");
}
