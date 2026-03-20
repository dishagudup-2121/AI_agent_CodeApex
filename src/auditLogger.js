/**
 * Audit Logger
 * In-memory audit log for full traceability of pipeline execution
 */

class AuditLogger {
  constructor() {
    this.logs = [];
    this.startTime = Date.now();
  }

  log(eventType, details) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      event_type: eventType,
      ...details
    });
  }

  logPipelineStart(policyLength, txCount) {
    this.log('PIPELINE_START', { policy_chars: policyLength, transaction_count: txCount });
  }

  logRuleExtraction(ruleCount) {
    this.log('RULES_EXTRACTED', { count: ruleCount });
  }

  logRuleValidation(validCount, rejectedCount) {
    this.log('RULES_VALIDATED', { valid: validCount, rejected: rejectedCount });
  }

  logConflictDetection(conflictCount) {
    this.log('CONFLICTS_DETECTED', { count: conflictCount });
  }

  logTransactionEval(txId, triggered, action, severity) {
    this.log('TRANSACTION_EVALUATED', { transaction_id: txId, rules_triggered: triggered, action, severity });
  }

  logViolation(txId, ruleIds, severity) {
    this.log('VIOLATION', { transaction_id: txId, rules: ruleIds, severity });
  }

  logGapAnalysis(gapCount) {
    this.log('GAP_ANALYSIS_COMPLETE', { gaps_found: gapCount });
  }

  logError(context, error) {
    this.log('ERROR', { context, message: error.message || String(error) });
  }

  logPipelineEnd(totalViolations) {
    this.log('PIPELINE_COMPLETE', { total_violations: totalViolations, total_elapsed_ms: Date.now() - this.startTime });
  }

  getLog() {
    return this.logs;
  }
}

module.exports = { AuditLogger };
