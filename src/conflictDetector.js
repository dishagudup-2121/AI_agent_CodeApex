/**
 * Rule Conflict Detector
 * STEP 3: Pairwise comparison of all rules to detect contradictions, overlaps, and priority clashes
 */

/**
 * Check if two conditions overlap on the same field.
 * @param {Object} cond1 - First condition
 * @param {Object} cond2 - Second condition
 * @returns {boolean}
 */
function conditionsOverlap(cond1, cond2) {
  if (cond1.field !== cond2.field) return false;

  // Same field, check operator overlap
  if (cond1.operator === cond2.operator && JSON.stringify(cond1.value) === JSON.stringify(cond2.value)) {
    return true;
  }

  // Numeric range overlaps
  if (typeof cond1.value === 'number' && typeof cond2.value === 'number') {
    // Both > with different thresholds -> the higher threshold is a subset of the lower
    if (cond1.operator === '>' && cond2.operator === '>') return true;
    if (cond1.operator === '>=' && cond2.operator === '>=') return true;
    if (cond1.operator === '<' && cond2.operator === '<') return true;

    // > and >= on same field
    if ((cond1.operator === '>' || cond1.operator === '>=') &&
        (cond2.operator === '>' || cond2.operator === '>=')) return true;
  }

  return false;
}

/**
 * Find shared condition fields between two rules.
 * @param {Object} rule1
 * @param {Object} rule2
 * @returns {Array} Array of overlapping field names
 */
function findSharedFields(rule1, rule2) {
  const fields1 = new Set(rule1.conditions.map(c => c.field));
  const fields2 = new Set(rule2.conditions.map(c => c.field));
  return [...fields1].filter(f => fields2.has(f));
}

/**
 * Severity hierarchy for priority clash detection.
 */
const SEVERITY_ORDER = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * Detect conflicts between all rules.
 * @param {Array} rules - Array of structured rule objects
 * @returns {Object} Object with conflicts array
 */
function detectConflicts(rules) {
  const conflicts = [];

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const r1 = rules[i];
      const r2 = rules[j];

      const sharedFields = findSharedFields(r1, r2);
      if (sharedFields.length === 0) continue;

      // Check for actual condition overlaps
      let hasOverlap = false;
      const overlappingFields = [];

      for (const field of sharedFields) {
        const conds1 = r1.conditions.filter(c => c.field === field);
        const conds2 = r2.conditions.filter(c => c.field === field);

        for (const c1 of conds1) {
          for (const c2 of conds2) {
            if (conditionsOverlap(c1, c2)) {
              hasOverlap = true;
              overlappingFields.push(field);
            }
          }
        }
      }

      if (!hasOverlap) continue;

      // Determine conflict type
      if (r1.action !== r2.action) {
        // Different actions on overlapping conditions = contradiction
        conflicts.push({
          rule_1: r1.rule_id,
          rule_2: r2.rule_id,
          type: 'contradiction',
          reason: `Rules ${r1.rule_id} and ${r2.rule_id} have overlapping conditions on field(s) [${overlappingFields.join(', ')}] but prescribe different actions: "${r1.action}" vs "${r2.action}". When both trigger simultaneously, the more restrictive action (block > flag > allow) should take precedence.`
        });
      } else if (r1.action === r2.action && r1.severity !== r2.severity) {
        // Same action but different severity = priority clash
        conflicts.push({
          rule_1: r1.rule_id,
          rule_2: r2.rule_id,
          type: 'priority',
          reason: `Rules ${r1.rule_id} and ${r2.rule_id} share overlapping conditions on field(s) [${overlappingFields.join(', ')}] with the same action "${r1.action}" but different severities: "${r1.severity}" vs "${r2.severity}". The higher severity should be applied.`
        });
      } else if (r1.action === r2.action && r1.severity === r2.severity) {
        // Same action and severity on overlapping conditions = overlap (potential redundancy)
        const r1CondCount = r1.conditions.length;
        const r2CondCount = r2.conditions.length;
        if (r1CondCount !== r2CondCount) {
          conflicts.push({
            rule_1: r1.rule_id,
            rule_2: r2.rule_id,
            type: 'overlap',
            reason: `Rules ${r1.rule_id} and ${r2.rule_id} overlap on field(s) [${overlappingFields.join(', ')}] with the same action and severity. ${r1.rule_id} has ${r1CondCount} conditions while ${r2.rule_id} has ${r2CondCount} conditions, making one a broader version of the other.`
          });
        }
      }
    }
  }

  return { conflicts };
}

module.exports = { detectConflicts };
