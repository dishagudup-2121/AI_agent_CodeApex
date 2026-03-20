/**
 * Compliance Pipeline Orchestrator
 */

const { parsePolicy } = require('./policyParser');
const { validateRules } = require('./ruleValidator');
const { detectConflicts } = require('./conflictDetector');
const { validateTransactions } = require('./transactionValidator');
const { analyzeGaps } = require('./gapAnalyzer');
const { generateAnalytics } = require('./analyticsEngine');
const { AuditLogger } = require('./auditLogger');

async function runPipeline(policyText, transactions, onProgress = () => {}) {
  const audit = new AuditLogger();

  // Safe default results in case individual steps fail
  let rawRules = [], validRules = [], validation_report = { total:0, valid:0, rejected:0, details:[] };
  let conflicts = [], transactionsAnalysis = [], ruleHitCounts = {};
  let gap_analysis = [], analytics = {}, ai_summary = '', recommendations = [];

  try {
    audit.logPipelineStart(policyText.length, transactions.length);

    // STEP 1 — Parse policy
    try {
      onProgress(1, 'Extracting rules from policy document');
      rawRules = await parsePolicy(policyText);
      if (rawRules) {
        audit.logRuleExtraction(rawRules.length);
      } else {
        rawRules = [];
      }
    } catch (e) {
      audit.logError('parsePolicy', e);
      console.error('[pipeline] Step 1 failed:', e.message);
    }

    // STEP 2 — Validate rules
    try {
      onProgress(2, 'Validating extracted rules');
      const vResult = validateRules(rawRules || []);
      validation_report = vResult.validation_report;
      validRules = vResult.validRules;
      audit.logRuleValidation(validRules.length, validation_report.rejected);
    } catch (e) {
      audit.logError('validateRules', e);
      validRules = rawRules; // Use unvalidated rules as fallback
    }

    // STEP 3 — Detect conflicts
    try {
      onProgress(3, 'Detecting rule conflicts');
      const cResult = detectConflicts(validRules);
      conflicts = cResult.conflicts;
      audit.logConflictDetection(conflicts.length);
      conflicts.forEach(c => audit.logConflictDetail(c.rule_1, c.rule_2, c.type, c.reason));
    } catch (e) {
      audit.logError('detectConflicts', e);
      conflicts = [];
    }

    // STEP 4 — Validate transactions
    try {
      onProgress(4, 'Evaluating transactions against rules');
      const tResult = validateTransactions(validRules, transactions);
      transactionsAnalysis = tResult.transactionsAnalysis;
      ruleHitCounts = tResult.ruleHitCounts;
      transactionsAnalysis.forEach(tx => {
        audit.logTransactionEval(tx.transaction_id, tx.triggered_rules.length, tx.action, tx.severity);
        if (tx.violated) audit.logViolation(tx.transaction_id, tx.triggered_rules, tx.severity);
      });
    } catch (e) {
      audit.logError('validateTransactions', e);
      transactionsAnalysis = transactions.map(tx => ({
        transaction_id: tx.transaction_id || 'UNKNOWN',
        violated: false, triggered_rules: [], severity: 'none',
        action: 'allow', causal_chain: ['Error during evaluation'], explanation: 'Evaluation failed'
      }));
    }

    // STEP 5 — Gap analysis
    try {
      onProgress(5, 'Analyzing policy gaps');
      const gResult = analyzeGaps(validRules, ruleHitCounts, conflicts, transactions.length);
      gap_analysis = gResult.gap_analysis;
      audit.logGapAnalysis(gap_analysis.length);
    } catch (e) {
      audit.logError('analyzeGaps', e);
      gap_analysis = [];
    }

    // STEP 6 — Analytics + AI summary
    try {
      onProgress(6, 'Generating AI compliance summary');
      const aResult = await generateAnalytics(validRules, conflicts, transactionsAnalysis, transactions, gap_analysis);
      analytics = aResult.analytics;
      ai_summary = aResult.ai_summary;
      recommendations = aResult.recommendations;
    } catch (e) {
      audit.logError('generateAnalytics', e);
      ai_summary = `${transactionsAnalysis.filter(t=>t.violated).length} of ${transactions.length} transactions flagged for compliance review.`;
      analytics = { total_transactions: transactions.length, violations: 0, passed: transactions.length,
        violation_rate: '0%', critical_count: 0, severity_distribution: {}, action_distribution: {},
        top_rules_triggered: [], risk_score_stats: { average: 0, max: 0, min: 0 },
        total_rules: validRules.length, total_conflicts: conflicts.length, total_gaps: gap_analysis.length };
    }

    const totalViolations = transactionsAnalysis.filter(t => t.violated).length;
    audit.logPipelineEnd(totalViolations);
    onProgress(6, 'Complete');

    return {
      metadata: {
        pipeline_version: '2.1.0',
        executed_at: new Date().toISOString(),
        total_rules_extracted: rawRules.length,
        total_rules_valid: validRules.length,
        total_transactions_evaluated: transactions.length,
        total_conflicts_detected: conflicts.length,
        total_violations: totalViolations,
        total_gaps_identified: gap_analysis.length,
        extraction_method: rawRules[0]?._extraction_method || 'llm'
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
    audit.logError('pipeline_fatal', err);
    throw err;
  }
}

module.exports = { runPipeline };
