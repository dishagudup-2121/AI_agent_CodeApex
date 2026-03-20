/**
 * Policy Gap Analyzer
 * STEP 7: Identify unused, weak, and redundant rules
 */

/**
 * Analyze rules for coverage gaps.
 * @param {Array} rules - Array of structured rule objects
 * @param {Object} ruleHitCounts - Map of rule_id -> number of transactions that triggered it
 * @param {Array} conflicts - Array of conflict objects from conflict detector
 * @param {number} totalTransactions - Total number of transactions evaluated
 * @returns {Object} Object with gap_analysis array
 */
function analyzeGaps(rules, ruleHitCounts, conflicts, totalTransactions) {
  const gapAnalysis = [];

  for (const rule of rules) {
    const hitCount = ruleHitCounts[rule.rule_id] || 0;
    const hitRate = totalTransactions > 0 ? (hitCount / totalTransactions) * 100 : 0;

    // Check for unused rules (never triggered)
    if (hitCount === 0) {
      gapAnalysis.push({
        rule_id: rule.rule_id,
        status: 'unused',
        hit_count: 0,
        hit_rate: '0%',
        reason: `Rule "${rule.description}" was not triggered by any of the ${totalTransactions} transactions evaluated. Conditions may be too restrictive or not represented in the current dataset.`,
        recommendation: 'Review conditions for relevance. If the rule targets edge cases, ensure the transaction dataset includes representative scenarios. Consider adjusting thresholds if they are too restrictive.'
      });
      continue;
    }

    // Check for weak rules (triggered very rarely < 10% of transactions)
    if (hitRate > 0 && hitRate < 10 && totalTransactions >= 5) {
      gapAnalysis.push({
        rule_id: rule.rule_id,
        status: 'weak',
        hit_count: hitCount,
        hit_rate: `${hitRate.toFixed(1)}%`,
        reason: `Rule "${rule.description}" triggered only ${hitCount} out of ${totalTransactions} transactions (${hitRate.toFixed(1)}%). Low trigger rate may indicate the rule is too narrow.`,
        recommendation: 'Consider broadening conditions or lowering thresholds to improve coverage. Alternatively, if the rule targets specific fraud patterns, the low rate may be acceptable.'
      });
      continue;
    }

    // Check for rules involved in conflicts (potential redundancy)
    const involvedConflicts = conflicts.filter(
      c => c.rule_1 === rule.rule_id || c.rule_2 === rule.rule_id
    );

    if (involvedConflicts.length > 0) {
      const overlapConflicts = involvedConflicts.filter(c => c.type === 'overlap');
      if (overlapConflicts.length > 0) {
        const relatedRules = overlapConflicts.map(c =>
          c.rule_1 === rule.rule_id ? c.rule_2 : c.rule_1
        );
        gapAnalysis.push({
          rule_id: rule.rule_id,
          status: 'redundant',
          hit_count: hitCount,
          hit_rate: `${hitRate.toFixed(1)}%`,
          reason: `Rule "${rule.description}" overlaps with rule(s) [${relatedRules.join(', ')}] and may be partially redundant.`,
          recommendation: 'Consider merging overlapping rules or adding distinguishing conditions to reduce evaluation overhead and avoid conflicting actions.'
        });
        continue;
      }
    }

    // Check for overly broad rules (>70% trigger rate)
    if (hitRate > 70 && totalTransactions >= 5) {
      gapAnalysis.push({
        rule_id: rule.rule_id,
        status: 'overly_broad',
        hit_count: hitCount,
        hit_rate: `${hitRate.toFixed(1)}%`,
        reason: `Rule "${rule.description}" triggered on ${hitCount} out of ${totalTransactions} transactions (${hitRate.toFixed(1)}%). Extremely high trigger rate may cause alert fatigue.`,
        recommendation: 'Consider adding more specific conditions or raising thresholds to reduce false positive rate and focus on genuinely suspicious activity.'
      });
    }
  }

  // Check for missing coverage areas
  const coveredFields = new Set();
  for (const rule of rules) {
    for (const cond of rule.conditions) {
      coveredFields.add(cond.field);
    }
  }

  const RECOMMENDED_FIELDS = [
    { field: 'cumulative_amount_24h', label: 'Rolling 24-hour monetary velocity' },
    { field: 'transaction_type', label: 'Transaction type-specific rules' },
    { field: 'beneficiary_risk', label: 'Beneficiary risk scoring' }
  ];

  for (const rec of RECOMMENDED_FIELDS) {
    if (!coveredFields.has(rec.field)) {
      gapAnalysis.push({
        rule_id: `MISSING_${rec.field.toUpperCase()}`,
        status: 'missing',
        hit_count: 'N/A',
        hit_rate: 'N/A',
        reason: `No rules currently evaluate the "${rec.field}" field. ${rec.label} is a recommended compliance dimension.`,
        recommendation: `Implement a rule targeting ${rec.label} to improve coverage against structuring, smurfing, or other evasion techniques.`
      });
    }
  }

  return { gap_analysis: gapAnalysis };
}

module.exports = { analyzeGaps };
