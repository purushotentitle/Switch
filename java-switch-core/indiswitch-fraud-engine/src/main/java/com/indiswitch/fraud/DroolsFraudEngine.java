package com.indiswitch.fraud;

import com.indiswitch.domain.model.SwitchTransaction;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Real-Time Payment Risk & Velocity Scoring Engine (Drools / Rule Matrix).
 */
@Service
public class DroolsFraudEngine {

    public record FraudEvaluation(
        int score,
        String decision, // APPROVED, STEP_UP_OTP, BLOCKED
        List<String> triggeredRules
    ) {}

    public FraudEvaluation evaluate(SwitchTransaction txn, int recentVelocityCount) {
        int score = 0;
        List<String> rules = new ArrayList<>();

        // High Ticket Size Check
        if (txn.amount().compareTo(new BigDecimal("100000.00")) > 0) {
            score += 45;
            rules.add("RULE_HIGH_TICKET_ANOMALY");
        }

        // Card Velocity Velocity Surge
        if (recentVelocityCount > 5) {
            score += 50;
            rules.add("RULE_VELOCITY_BURST_EXCEEDED");
        }

        // Zero-MDR UPI Rule
        if ("UPI".equalsIgnoreCase(txn.cardBrand()) && txn.amount().compareTo(new BigDecimal("200000.00")) > 0) {
            score += 35;
            rules.add("RULE_UPI_PER_TXN_CEILING");
        }

        String decision;
        if (score >= 80) {
            decision = "BLOCKED";
        } else if (score >= 40) {
            decision = "STEP_UP_OTP";
        } else {
            decision = "APPROVED";
        }

        return new FraudEvaluation(score, decision, rules);
    }
}
