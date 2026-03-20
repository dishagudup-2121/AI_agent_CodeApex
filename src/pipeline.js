/**
 * Pipeline Orchestrator v2.0
 * Full 9-step compliance pipeline with validation, analytics, and audit logging
 */

const { parsePolicy } = require('./policyParser');
const { validateRules } = require('./ruleValidator');
const { detectConflicts } = require('./conflictDetector');
const { validateTransactions } = require('./transactionValidator');
const { analyzeGaps } = require('./gapAnalyzer');
const { generateAnalytics } = require('./analyticsEngine');
const { AuditLogger } = require('./auditLogger');

function runPipeline(policyText, transactions) {
  const audit = new AuditLogger();

  try {
    audit.logPipelineStart(policyText.length, transactions.length);

    // STEP 1: Parse policy → structured rules
    const rawRules = parsePolicy(policyText);
    audit.logRuleExtraction(rawRules.length);

    // STEP 2: Validate rules
    const { validation_report, validRules } = validateRules(rawRules);
    audit.logRuleValidation(validRules.length, validation_report.rejected);

    // STEP 3: Detect conflicts
    const { conflicts } = detectConflicts(validRules);
    audit.logConflictDetection(conflicts.length);

    // STEP 4 & 5: Validate transactions + causal reasoning + severity assignment
    const { transactionsAnalysis, ruleHitCounts } = validateTransactions(validRules, transactions);

    // Log each transaction evaluation
    transactionsAnalysis.forEach(tx => {
      audit.logTransactionEval(tx.transaction_id, tx.triggered_rules.length, tx.action, tx.severity);
      if (tx.violated) {
        audit.logViolation(tx.transaction_id, tx.triggered_rules, tx.severity);
      }
    });

    // STEP 7: Gap analysis
    const { gap_analysis } = analyzeGaps(validRules, ruleHitCounts, conflicts, transactions.length);
    audit.logGapAnalysis(gap_analysis.length);

    // STEP 8: Analytics generation
    const { analytics, ai_summary, recommendations } = generateAnalytics(
      validRules, conflicts, transactionsAnalysis, transactions, gap_analysis
    );

    const totalViolations = transactionsAnalysis.filter(t => t.violated).length;
    audit.logPipelineEnd(totalViolations);

    // STEP 9: Assemble final output
    return {
      metadata: {
        pipeline_version: '2.0.0',
        executed_at: new Date().toISOString(),
        total_rules_extracted: rawRules.length,
        total_rules_valid: validRules.length,
        total_transactions_evaluated: transactions.length,
        total_conflicts_detected: conflicts.length,
        total_violations: totalViolations,
        total_gaps_identified: gap_analysis.length
      },
      ai_summary,
      recommendations,
      analytics,
      rules: validRules,
      validation_report,
      conflicts,
      transactions_analysis: transactionsAnalysis,
      gap_analysis,
      audit_log: audit.getLog()
    };
  } catch (err) {
    audit.logError('pipeline', err);
    throw err;
  }
}

module.exports = { runPipeline };
