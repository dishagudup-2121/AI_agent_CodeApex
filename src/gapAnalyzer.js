/**
 * Gap Analyzer
 * STEP 7: Identify unused, weak, overly broad, redundant, and missing rules
 */

function analyzeGaps(rules, ruleHitCounts, conflicts, totalTransactions) {
  const gapAnalysis = [];

  for (const rule of rules) {
    const findings = [];
    const hitCount = ruleHitCounts[rule.rule_id] || 0;
    const hitRate = totalTransactions > 0 ? (hitCount / totalTransactions) * 100 : 0;
    const involvedConflicts = conflicts.filter(c => c.rule_1 === rule.rule_id || c.rule_2 === rule.rule_id);

    // Check unused
    if (hitCount === 0) {
      findings.push({
        status: 'unused',
        reason: `Rule was never triggered across ${totalTransactions} transactions.`,
        recommendation: 'Evaluate if the rule is obsolete or if test data lacks relevant edge cases.'
      });
    }

    // Check weak
    if (hitRate > 0 && hitRate < 10 && totalTransactions >= 5) {
      findings.push({
        status: 'weak',
        reason: `Rule "${rule.description}" triggered only ${hitCount} out of ${totalTransactions} transactions (${hitRate.toFixed(0)}%). Low trigger rate indicates narrow conditions.`,
        recommendation: 'Consider broadening the thresholds if higher catch-rate is desired.'
      });
    }

    // Check redundant
    if (involvedConflicts.filter(c => c.type === 'overlap' || c.type === 'subsumption').length > 0) {
      findings.push({
        status: 'redundant',
        reason: `Rule overlaps or is subsumed by other rules.`,
        recommendation: 'Merge overlapping rules to simplify logical processing.'
      });
    }

    // Check overly broad
    if (hitRate > 70 && totalTransactions >= 5) {
      findings.push({
        status: 'overly_broad',
        reason: `Rule triggered on ${hitRate.toFixed(0)}% of transactions.`,
        recommendation: 'Rule may be too restrictive. Consider narrowing the scope (e.g. higher threshold).'
      });
    }

    if (findings.length > 0) {
      const primary = findings[0];
      gapAnalysis.push({
        rule_id: rule.rule_id,
        status: primary.status,
        all_statuses: findings.map(f => f.status),
        hit_count: hitCount,
        hit_rate: totalTransactions > 0 ? `${hitRate.toFixed(1)}%` : 'N/A',
        reason: findings.map(f => f.reason).join(' Additionally: '),
        recommendation: findings.map(f => f.recommendation).join(' ')
      });
    }
  }

  // Check for missing domain coverage
  const extractedFields = new Set();
  rules.forEach(r => r.conditions.forEach(c => extractedFields.add(c.field)));

  const RECOMMENDED_FIELDS = [
    { field: 'cumulative_daily_volume', reason: 'No rules currently evaluate rolling daily volume. This is a recommended AML dimension to detect structuring.', rec: 'Implement a rule targeting cumulative_daily_volume.' },
    { field: 'beneficiary_risk', reason: 'No rules evaluate beneficiary risk scoring.', rec: 'Add beneficiary_risk threshold rules to improve detection of money mule networks.' }
  ];

  RECOMMENDED_FIELDS.forEach(rec => {
    if (!extractedFields.has(rec.field)) {
      gapAnalysis.push({
        rule_id: `MISSING_${rec.field}`,
        status: 'missing',
        all_statuses: ['missing'],
        hit_count: 'N/A',
        hit_rate: 'N/A',
        reason: rec.reason,
        recommendation: rec.rec
      });
    }
  });

  return { gap_analysis: gapAnalysis };
}

module.exports = { analyzeGaps };
