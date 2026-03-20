/**
 * Analytics Engine
 * Computes severity distribution, top rules, risk stats, and AI summary text
 */

function generateAnalytics(rules, conflicts, transactionsAnalysis, transactions, gapAnalysis) {
  const total = transactionsAnalysis.length;
  const violations = transactionsAnalysis.filter(t => t.violated).length;
  const passed = total - violations;

  // Severity distribution
  const severityDist = { critical: 0, high: 0, medium: 0, low: 0, none: 0 };
  transactionsAnalysis.forEach(t => { severityDist[t.severity] = (severityDist[t.severity] || 0) + 1; });

  // Top triggered rules
  const ruleHits = {};
  transactionsAnalysis.forEach(t => {
    t.triggered_rules.forEach(r => { ruleHits[r] = (ruleHits[r] || 0) + 1; });
  });
  const topRules = Object.entries(ruleHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => {
      const rule = rules.find(r => r.rule_id === id);
      return { rule_id: id, trigger_count: count, description: rule ? rule.description : '' };
    });

  // Risk score stats
  let avgRisk = 0, maxRisk = 0, minRisk = 100;
  if (transactions.length > 0) {
    const scores = transactions.map(t => t.risk_score || 0);
    avgRisk = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    maxRisk = Math.max(...scores);
    minRisk = Math.min(...scores);
  }

  // Action distribution
  const actionDist = { block: 0, flag: 0, allow: 0 };
  transactionsAnalysis.forEach(t => { actionDist[t.action] = (actionDist[t.action] || 0) + 1; });

  // Violation rate
  const violationRate = total > 0 ? ((violations / total) * 100).toFixed(1) : '0';

  // AI Summary
  const criticalCount = severityDist.critical;
  const topRule = topRules.length > 0 ? topRules[0] : null;
  const blockedCount = actionDist.block;

  let aiSummary = `${violations} out of ${total} transactions violated compliance policy (${violationRate}% violation rate). `;

  if (criticalCount > 0) {
    aiSummary += `${criticalCount} critical risk${criticalCount > 1 ? 's' : ''} detected requiring immediate attention. `;
  }

  if (topRule) {
    aiSummary += `Rule ${topRule.rule_id} was most frequently triggered (${topRule.trigger_count} times). `;
  }

  if (blockedCount > 0) {
    aiSummary += `${blockedCount} transaction${blockedCount > 1 ? 's were' : ' was'} automatically blocked.`;
  }

  // Recommendations
  const recommendations = [];
  if (criticalCount > 0) {
    recommendations.push('Immediately review all critical-severity transactions for regulatory breach risk.');
  }
  if (conflicts.length > 0) {
    recommendations.push(`Resolve ${conflicts.length} detected rule conflict${conflicts.length > 1 ? 's' : ''} to ensure consistent enforcement.`);
  }
  if (gapAnalysis.length > 0) {
    const unused = gapAnalysis.filter(g => g.status === 'unused' || g.status === 'missing').length;
    if (unused > 0) {
      recommendations.push(`Address ${unused} policy gap${unused > 1 ? 's' : ''} to improve compliance coverage.`);
    }
  }
  if (parseFloat(violationRate) > 70) {
    recommendations.push('High violation rate suggests overly strict policies or suspicious dataset. Consider threshold review.');
  }

  return {
    analytics: {
      total_transactions: total,
      violations,
      passed,
      violation_rate: `${violationRate}%`,
      critical_count: criticalCount,
      severity_distribution: severityDist,
      action_distribution: actionDist,
      top_rules_triggered: topRules,
      risk_score_stats: { average: avgRisk, max: maxRisk, min: minRisk },
      total_rules: rules.length,
      total_conflicts: conflicts.length,
      total_gaps: gapAnalysis.length
    },
    ai_summary: aiSummary.trim(),
    recommendations
  };
}

module.exports = { generateAnalytics };
