/**
 * Analytics Engine
 * Computes severity distribution, top rules, risk stats, and AI summary text
 */

const Groq = require('groq-sdk');

async function generateAnalytics(rules, conflicts, transactionsAnalysis, transactions, gapAnalysis) {
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

  const criticalCount = severityDist.critical;
  const highCount = severityDist.high;
  const topRule = topRules.length > 0 ? topRules[0] : null;
  const blockedCount = actionDist.block;

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

  // Template AI Summary Fallback
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

  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'gsk_your_key_here' && process.env.DEMO_MODE !== 'true') {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const promptContent = `Compliance pipeline results:
- Total transactions: ${total}
- Violations: ${violations} (${violationRate}% violation rate)
- Critical severity: ${criticalCount}
- High severity: ${highCount}
- Blocked transactions: ${blockedCount}
- Average risk score: ${avgRisk}, Maximum risk score: ${maxRisk}
- Most triggered rule: ${topRule ? topRule.rule_id : 'N/A'} — "${topRule ? topRule.description : 'N/A'}" (${topRule ? topRule.trigger_count : 0} times)
- Rule conflicts detected: ${conflicts.length}
- Policy gaps identified: ${gapAnalysis.length}
- Action distribution: ${actionDist.block} blocked, ${actionDist.flag} flagged, ${actionDist.allow} allowed

Generate a 3-sentence executive compliance briefing.`;

      const groqCall = groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: `You are a senior AML (Anti-Money Laundering) compliance analyst writing an executive briefing.\nWrite a 3-sentence compliance summary based on the data provided.\nSentence 1: State the overall violation picture with specific numbers.\nSentence 2: Identify the most significant risk pattern or finding (look for structuring, velocity abuse, sanctions exposure, new account fraud).\nSentence 3: Give the single most urgent recommended action.\nUse professional financial compliance language. Be specific — use the actual numbers provided.\nReturn ONLY the summary text. No preamble, no labels, no markdown.` },
          { role: 'user', content: promptContent }
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Groq timeout')), 5000));
      const response = await Promise.race([groqCall, timeoutPromise]);
      aiSummary = response.choices[0].message.content.trim();
    } catch (err) {
      console.warn(`[analyticsEngine] AI Summary disabled or failed (${err.message}). Using template fallback.`);
    }
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
    ai_summary: aiSummary,
    recommendations
  };
}

module.exports = { generateAnalytics };
