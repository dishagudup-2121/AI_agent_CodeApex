/**
 * Transaction Validator & Causal Reasoning Engine
 * STEP 4, 5, 6: Evaluate transactions against rules, build causal chains, assign severity
 */

const SEVERITY_ORDER = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
const SEVERITY_LABELS = ['none', 'low', 'medium', 'high', 'critical'];

/**
 * Evaluate a single condition against a transaction.
 * @param {Object} condition - Rule condition { field, operator, value }
 * @param {Object} transaction - Transaction data
 * @returns {{ met: boolean, explanation: string }}
 */
function evaluateCondition(condition, transaction) {
  const { field, operator, value } = condition;
  const actual = transaction[field];

  if (actual === undefined || actual === null) {
    return {
      met: false,
      explanation: `Field "${field}" is not present in the transaction`
    };
  }

  let met = false;
  let explanation = '';

  switch (operator) {
    case '>':
      met = actual > value;
      explanation = `${field} = ${actual} ${met ? '>' : '≤'} ${value}`;
      break;
    case '>=':
      met = actual >= value;
      explanation = `${field} = ${actual} ${met ? '≥' : '<'} ${value}`;
      break;
    case '<':
      met = actual < value;
      explanation = `${field} = ${actual} ${met ? '<' : '≥'} ${value}`;
      break;
    case '<=':
      met = actual <= value;
      explanation = `${field} = ${actual} ${met ? '≤' : '>'} ${value}`;
      break;
    case '==':
      met = actual === value;
      explanation = `${field} = ${JSON.stringify(actual)} ${met ? '==' : '!='} ${JSON.stringify(value)}`;
      break;
    case '!=':
      met = actual !== value;
      explanation = `${field} = ${JSON.stringify(actual)} ${met ? '!=' : '=='} ${JSON.stringify(value)}`;
      break;
    case 'in':
      if (Array.isArray(value)) {
        met = value.includes(actual);
        explanation = `${field} = "${actual}" ${met ? 'is in' : 'is not in'} [${value.join(', ')}]`;
      }
      break;
    case 'not_in':
      if (Array.isArray(value)) {
        met = !value.includes(actual);
        explanation = `${field} = "${actual}" ${met ? 'is not in' : 'is in'} [${value.join(', ')}]`;
      }
      break;
    default:
      explanation = `Unknown operator "${operator}"`;
  }

  return { met, explanation };
}

/**
 * Evaluate a rule against a transaction.
 * @param {Object} rule - Structured rule object
 * @param {Object} transaction - Transaction data
 * @returns {{ triggered: boolean, conditionResults: Array, causalSteps: Array }}
 */
function evaluateRule(rule, transaction) {
  const conditionResults = [];
  const causalSteps = [];
  const logic = rule.condition_logic || 'AND';

  for (const condition of rule.conditions) {
    const result = evaluateCondition(condition, transaction);
    conditionResults.push({ ...condition, ...result });
    causalSteps.push(`[${rule.rule_id}] Condition: ${result.explanation} → ${result.met ? 'MET' : 'NOT MET'}`);
  }

  let triggered;
  if (logic === 'OR') {
    triggered = conditionResults.some(r => r.met);
    if (triggered) {
      causalSteps.push(`[${rule.rule_id}] At least one condition met (OR logic) → Rule TRIGGERED`);
    } else {
      causalSteps.push(`[${rule.rule_id}] No conditions met (OR logic) → Rule NOT triggered`);
    }
  } else {
    triggered = conditionResults.every(r => r.met);
    if (triggered) {
      causalSteps.push(`[${rule.rule_id}] All conditions met (AND logic) → Rule TRIGGERED`);
    } else {
      causalSteps.push(`[${rule.rule_id}] Not all conditions met (AND logic) → Rule NOT triggered`);
    }
  }

  return { triggered, conditionResults, causalSteps };
}

/**
 * Generate a natural language explanation for a transaction evaluation.
 * @param {Object} transaction - Transaction data
 * @param {Array} triggeredRules - Array of triggered rule objects
 * @param {string} maxAction - Most restrictive action applied
 * @param {string} maxSeverity - Highest severity assigned
 * @returns {string}
 */
function generateExplanation(transaction, triggeredRules, maxAction, maxSeverity) {
  if (triggeredRules.length === 0) {
    return `Transaction ${transaction.transaction_id} (amount: $${transaction.transaction_amount.toLocaleString()}) passed all compliance checks. No rules were triggered. The transaction is cleared for processing.`;
  }

  const ruleDescriptions = triggeredRules.map(r =>
    `${r.rule_id}: ${r.description}`
  ).join('; ');

  const actionText = maxAction === 'block'
    ? 'must be BLOCKED'
    : maxAction === 'flag'
      ? 'has been FLAGGED for review'
      : 'is allowed';

  return `Transaction ${transaction.transaction_id} (amount: $${transaction.transaction_amount.toLocaleString()}) ${actionText} with ${maxSeverity.toUpperCase()} severity. Triggered rules: [${ruleDescriptions}]. The most restrictive action "${maxAction}" was applied based on the rule hierarchy.`;
}

/**
 * Validate all transactions against all rules.
 * @param {Array} rules - Array of structured rule objects
 * @param {Array} transactions - Array of transaction objects
 * @returns {{ transactionsAnalysis: Array, ruleHitCounts: Object }}
 */
function validateTransactions(rules, transactions) {
  const ruleHitCounts = {};
  rules.forEach(r => { ruleHitCounts[r.rule_id] = 0; });

  const transactionsAnalysis = transactions.map(tx => {
    const triggeredRules = [];
    const allCausalSteps = [];
    let maxSeverityLevel = 0;
    let maxAction = 'allow';

    const ACTION_PRIORITY = { allow: 0, flag: 1, block: 2 };

    for (const rule of rules) {
      const { triggered, causalSteps } = evaluateRule(rule, tx);
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
    }

    const violated = triggeredRules.length > 0;
    const severity = violated ? SEVERITY_LABELS[maxSeverityLevel] : 'none';

    // Build final causal chain (only include triggered rules and the final decision)
    const causalChain = [];
    for (const rule of triggeredRules) {
      const { causalSteps } = evaluateRule(rule, tx);
      causalChain.push(...causalSteps.filter(s => s.includes('MET')));
    }
    if (triggeredRules.length > 1) {
      causalChain.push(`Conflict resolution: applied most restrictive action "${maxAction}" with severity "${severity}"`);
    }
    if (violated) {
      causalChain.push(`Final decision: Transaction ${maxAction === 'block' ? 'BLOCKED' : 'FLAGGED'} with ${severity.toUpperCase()} severity`);
    } else {
      causalChain.push('Final decision: Transaction CLEARED — no rules triggered');
    }

    const explanation = generateExplanation(tx, triggeredRules, maxAction, severity);

    return {
      transaction_id: tx.transaction_id,
      violated,
      triggered_rules: triggeredRules.map(r => r.rule_id),
      severity,
      action: maxAction,
      causal_chain: causalChain,
      explanation
    };
  });

  return { transactionsAnalysis, ruleHitCounts };
}

module.exports = { validateTransactions, evaluateCondition, evaluateRule };
