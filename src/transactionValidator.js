/**
 * Transaction Validator
 * STEP 4, 5, 6: Evaluate transactions against rules, build causal chains, assign severity
 */

const severityMap = { low: 1, medium: 2, high: 3, critical: 4 };
const SEVERITY_ORDER = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
const SEVERITY_LABELS = ['none', 'low', 'medium', 'high', 'critical'];

function evaluateCondition(condition, transaction) {
  const { field, operator, value } = condition;
  const actual = transaction[field] !== undefined ? transaction[field] : null;

  if (actual === null) {
    return { met: false, detail: `Field '${field}' is missing in transaction` };
  }

  let met = false;
  switch (operator) {
    case '>': met = actual > value; break;
    case '>=': met = actual >= value; break;
    case '<': met = actual < value; break;
    case '<=': met = actual <= value; break;
    case '==': met = actual === value; break;
    case '!=': met = actual !== value; break;
    case 'in':
      if (Array.isArray(value)) {
        met = value.includes(actual);
      }
      break;
    case 'not_in':
      if (Array.isArray(value)) {
        met = !value.includes(actual);
      }
      break;
  }

  // Format value for readable output
  let displayValue = value;
  if (Array.isArray(value)) displayValue = `[${value.join(', ')}]`;

  return { met, detail: `${field} = ${actual} ${operator} ${displayValue}` };
}

function evaluateRule(rule, transaction) {
  const { conditions, condition_logic = 'AND' } = rule;
  const causalSteps = [];
  let triggered = false;

  if (!conditions || conditions.length === 0) {
    return { triggered: false, causalSteps: [] };
  }

  if (condition_logic === 'AND') {
    triggered = true;
    for (const cond of conditions) {
      const { met, detail } = evaluateCondition(cond, transaction);
      causalSteps.push(`[${rule.rule_id}] ${detail} → ${met ? 'MET' : 'NOT MET'}`);
      if (!met) triggered = false;
    }
    if (triggered) causalSteps.push(`[${rule.rule_id}] All conditions met → Rule TRIGGERED`);
  } else if (condition_logic === 'OR') {
    triggered = false;
    for (const cond of conditions) {
      const { met, detail } = evaluateCondition(cond, transaction);
      causalSteps.push(`[${rule.rule_id}] ${detail} → ${met ? 'MET' : 'NOT MET'}`);
      if (met) triggered = true;
    }
    if (triggered) causalSteps.push(`[${rule.rule_id}] At least one condition met (OR logic) → Rule TRIGGERED`);
  }

  return { triggered, causalSteps };
}

function generateExplanation(transaction, triggeredRules, finalAction, finalSeverity) {
  const txId = transaction.transaction_id || 'UNKNOWN';
  const amt = transaction.transaction_amount !== undefined ? transaction.transaction_amount : (transaction.amount || 0);
  const formattedAmt = `$${Number(amt).toLocaleString()}`;

  if (triggeredRules.length === 0) {
    return `Transaction ${txId} (${formattedAmt}) passed all compliance checks. No rules triggered. Cleared for processing.`;
  }

  const actStr = finalAction.toUpperCase();
  const sevStr = finalSeverity.toUpperCase();
  const ruleIds = triggeredRules.map(r => r.rule_id).join(', ');

  const reasonList = triggeredRules.map(r => {
    let focus = r.description;
    if (!focus) focus = 'Policy violation';
    return `${r.rule_id} (${focus})`;
  }).join(', ');

  if (finalAction === 'block') {
    return `Transaction ${txId} (${formattedAmt}) must be BLOCKED with ${sevStr} severity. Triggered: ${reasonList}.`;
  } else if (finalAction === 'flag') {
    return `Transaction ${txId} (${formattedAmt}) has been FLAGGED for review with ${sevStr} severity. Triggered: ${reasonList}.`;
  } else {
    return `Transaction ${txId} (${formattedAmt}) triggered rules (${ruleIds}) but action is ALLOW. Warning: potentially conflicting policy logic.`;
  }
}

function validateTransactions(rules, transactions) {
  const ruleHitCounts = {};
  rules.forEach(r => { ruleHitCounts[r.rule_id] = 0; });

  const transactionsAnalysis = transactions.map(tx => {
    const triggeredRules = [];
    const allCausalSteps = [];
    const evalCache = new Map();
    let maxSeverityLevel = 0;
    let maxAction = 'allow';

    const ACTION_PRIORITY = { allow: 0, flag: 1, block: 2 };

    for (const rule of rules) {
      try {
        const result = evaluateRule(rule, tx);
        evalCache.set(rule.rule_id, result);
        const { triggered, causalSteps } = result;
        allCausalSteps.push(...causalSteps);

        if (triggered) {
          triggeredRules.push(rule);
          ruleHitCounts[rule.rule_id]++;

          const sevLevel = SEVERITY_ORDER[rule.severity] || 0;
          if (sevLevel > maxSeverityLevel) {
            maxSeverityLevel = sevLevel;
          }

          const actionPriority = ACTION_PRIORITY[rule.action] || 0;
          if (actionPriority > (ACTION_PRIORITY[maxAction] || 0)) {
            maxAction = rule.action;
          }
        }
      } catch (e) {
        // Skip isolated rule failure
      }
    }

    const violated = triggeredRules.length > 0;
    // Reverse lookup severity map to ensure strict bounds
    let severity = 'none';
    if (violated && maxSeverityLevel > 0) {
      severity = SEVERITY_LABELS[maxSeverityLevel] || 'none';
    }

    const causalChain = [];
    for (const rule of triggeredRules) {
      const cached = evalCache.get(rule.rule_id);
      if (cached && cached.causalSteps) {
        causalChain.push(...cached.causalSteps.filter(s => s.includes('MET') || s.includes('TRIGGERED')));
      }
    }

    if (violated) {
      if (triggeredRules.length > 1) {
        causalChain.push(`Conflict resolution: applied most restrictive action "${maxAction}" with severity "${severity}"`);
      }
      causalChain.push(`Final decision: Transaction ${maxAction.toUpperCase()} with ${severity.toUpperCase()} severity`);
    } else {
      causalChain.push(`Final decision: Transaction CLEARED — no rules triggered`);
    }

    const explanation = generateExplanation(tx, triggeredRules, maxAction, severity);

    return {
      transaction_id: tx.transaction_id || `TXN-UNK-001`,
      violated,
      triggered_rules: triggeredRules.map(r => r.rule_id),
      severity,
      action: violated ? maxAction : 'allow',
      causal_chain: causalChain,
      explanation
    };
  });

  return { transactionsAnalysis, ruleHitCounts };
}

module.exports = { validateTransactions, evaluateRule, evaluateCondition };
