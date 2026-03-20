/**
 * Conflict Detector
 * STEP 3: Detect rule overlaps, priority clashes, subsumptions, and contradictions
 */

function conditionsOverlap(cond1, cond2) {
  if (cond1.field !== cond2.field) return { overlap: false };

  // Strict subset matching (subsumption logic)
  if (
    typeof cond1.value === 'number' &&
    typeof cond2.value === 'number' &&
    cond1.field === cond2.field
  ) {
    const bothGT = (cond1.operator === '>' || cond1.operator === '>=') &&
                   (cond2.operator === '>' || cond2.operator === '>=');
    const bothLT = (cond1.operator === '<' || cond1.operator === '<=') &&
                   (cond2.operator === '<' || cond2.operator === '<=');

    if (bothGT || bothLT) {
      // Mark which is the broader (lower GT threshold or higher LT threshold)
      cond1._subsumes = bothGT ? (cond1.value < cond2.value) : (cond1.value > cond2.value);
      cond2._subsumes = !cond1._subsumes;
      return { overlap: true, subsumption: true, broaderCond: cond1._subsumes ? cond1 : cond2 };
    }
  }

  // General strict matching
  if (cond1.operator === '==' && cond2.operator === '==') {
    if (cond1.value === cond2.value) return { overlap: true };
  }

  return { overlap: false };
}

function detectConflicts(rules) {
  const conflicts = [];
  const actionSeverityMap = { 'allow': 0, 'flag': 1, 'block': 2 };

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const rule1 = rules[i];
      const rule2 = rules[j];

      // Exclude rules that have totally different fields if AND logic (simplification)
      let hasOverlap = false;
      let subsumptionDetected = false;
      let broaderRuleId = null;

      for (const cond1 of rule1.conditions) {
        for (const cond2 of rule2.conditions) {
          const overlapResult = conditionsOverlap(cond1, cond2);
          if (overlapResult.overlap) {
            hasOverlap = true;
            if (overlapResult.subsumption) {
              subsumptionDetected = true;
              broaderRuleId = overlapResult.broaderCond._subsumes === rule1.conditions.indexOf(cond1) ? rule1.rule_id : rule2.rule_id;
            }
          }
        }
      }

      if (hasOverlap) {
        // 1. Contradiction: Same condition but conflicting actions
        if (rule1.action !== rule2.action) {
          // If block vs allow, or flag vs block
          conflicts.push({
            rule_1: rule1.rule_id,
            rule_2: rule2.rule_id,
            type: 'contradiction',
            reason: `Rules ${rule1.rule_id} and ${rule2.rule_id} overlap but prescribe different actions: ${rule1.rule_id} ${actionSeverityMap[rule1.action] > actionSeverityMap[rule2.action] ? 'is more severe' : 'conflicts with'} ${rule2.action}.`
          });
        } 
        // 2. Subsumption
        else if (subsumptionDetected) {
          const { broader, narrower } = rule1.rule_id === broaderRuleId 
            ? { broader: rule1, narrower: rule2 } 
            : { broader: rule2, narrower: rule1 };
            
          conflicts.push({
            rule_1: rule1.rule_id,
            rule_2: rule2.rule_id,
            type: 'subsumption',
            reason: `Rule ${broader.rule_id} subsumes Rule ${narrower.rule_id}. Every transaction triggering ${narrower.rule_id} also triggers ${broader.rule_id}. The broader rule may produce duplicate alerts.`
          });
        }
        // 3. General overlap
        else if (rule1.severity !== rule2.severity) {
           conflicts.push({
            rule_1: rule1.rule_id,
            rule_2: rule2.rule_id,
            type: 'priority_clash',
            reason: `Rules ${rule1.rule_id} and ${rule2.rule_id} overlap with differing severities (${rule1.severity} vs ${rule2.severity}). Resolution engine defaults to most restrictive.`
          });
        } else {
          conflicts.push({
            rule_1: rule1.rule_id,
            rule_2: rule2.rule_id,
            type: 'overlap',
            reason: `Rules ${rule1.rule_id} and ${rule2.rule_id} overlap. May produce redundant compliance flags.`
          });
        }
      }
    }
  }

  return { conflicts };
}

module.exports = { detectConflicts };
