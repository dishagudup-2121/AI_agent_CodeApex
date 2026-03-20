/**
 * Rule Validator
 * Validates schema correctness of extracted rules before execution
 */

const VALID_OPERATORS = ['>', '>=', '<', '<=', '==', '!=', 'in', 'not_in'];
const VALID_ACTIONS = ['flag', 'block', 'allow'];
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const VALID_SCOPES = ['transaction', 'account', 'user', 'system'];

function validateRule(rule) {
  const errors = [];

  if (!rule.rule_id || typeof rule.rule_id !== 'string') errors.push('Missing or invalid rule_id');
  if (!rule.description || typeof rule.description !== 'string') errors.push('Missing description');
  if (!VALID_ACTIONS.includes(rule.action)) errors.push(`Invalid action "${rule.action}"`);
  if (!VALID_SEVERITIES.includes(rule.severity)) errors.push(`Invalid severity "${rule.severity}"`);
  if (!VALID_SCOPES.includes(rule.scope)) errors.push(`Invalid scope "${rule.scope}"`);

  if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    errors.push('Rules must have at least one condition');
  } else {
    rule.conditions.forEach((cond, i) => {
      if (!cond.field) errors.push(`Condition ${i}: missing field`);
      if (!VALID_OPERATORS.includes(cond.operator)) errors.push(`Condition ${i}: invalid operator "${cond.operator}"`);
      if (cond.value === undefined || cond.value === null) {
        errors.push(`Condition ${i}: missing value`);
      } else {
        // Operator-specific type validation
        const op = cond.operator;
        if (['>', '>=', '<', '<='].includes(op)) {
          if (typeof cond.value !== 'number') errors.push(`Condition ${i}: operator "${op}" requires a numeric value`);
        } else if (['in', 'not_in'].includes(op)) {
          if (!Array.isArray(cond.value)) errors.push(`Condition ${i}: operator "${op}" requires an array value`);
        }
      }
    });
  }

  return { rule_id: rule.rule_id, valid: errors.length === 0, errors };
}

function validateRules(rules) {
  const results = rules.map(validateRule);
  const validRules = rules.filter((_, i) => results[i].valid);
  const rejected = results.filter(r => !r.valid);

  return {
    validation_report: {
      total: rules.length,
      valid: validRules.length,
      rejected: rejected.length,
      details: results
    },
    validRules
  };
}

module.exports = { validateRules };
