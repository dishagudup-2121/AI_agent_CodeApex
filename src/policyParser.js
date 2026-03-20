/**
 * Policy Parser & Structured Rule Generator
 * STEP 1 & 2: Parse unstructured policy text → extract enforceable rules → JSON
 */

const SANCTIONED_COUNTRIES = ['KP', 'IR', 'SY', 'CU', 'UA-43']; // ISO codes: North Korea, Iran, Syria, Cuba, Crimea
const SANCTIONED_NAMES = ['North Korea', 'Iran', 'Syria', 'Cuba', 'Crimea'];

/**
 * Rule definition templates keyed by pattern identifiers.
 * Each template maps a recognized policy pattern to a structured rule.
 */
const RULE_TEMPLATES = [
  {
    id: 'R1',
    pattern: /transaction[s]?\s+exceeding\s+\$?10[,.]?000\s+must\s+be\s+flagged/i,
    generate: () => ({
      rule_id: 'R1',
      description: 'Flag any single transaction exceeding $10,000 for manual compliance review',
      conditions: [
        { field: 'transaction_amount', operator: '>', value: 10000 }
      ],
      action: 'flag',
      severity: 'medium',
      scope: 'transaction',
      depends_on: []
    })
  },
  {
    id: 'R2',
    pattern: /sanctioned\s+countries.*must\s+be\s+(immediately\s+)?blocked/i,
    generate: () => ({
      rule_id: 'R2',
      description: 'Block transactions originating from or destined to sanctioned countries',
      conditions: [
        { field: 'sender_country', operator: 'in', value: SANCTIONED_COUNTRIES },
        { field: 'receiver_country', operator: 'in', value: SANCTIONED_COUNTRIES }
      ],
      condition_logic: 'OR',
      action: 'block',
      severity: 'critical',
      scope: 'transaction',
      depends_on: []
    })
  },
  {
    id: 'R3',
    pattern: /more\s+than\s+5\s+transactions\s+within\s+a\s+24[- ]hour/i,
    generate: () => ({
      rule_id: 'R3',
      description: 'Flag high-frequency transactions (>5 in 24h) for non-VIP accounts',
      conditions: [
        { field: 'user_tx_count_24h', operator: '>', value: 5 },
        { field: 'is_vip', operator: '==', value: false }
      ],
      action: 'flag',
      severity: 'low',
      scope: 'user',
      depends_on: []
    })
  },
  {
    id: 'R4',
    pattern: /exceeding\s+\$?50[,.]?000\s+must\s+be\s+escalated.*blocked\s+pending/i,
    generate: () => ({
      rule_id: 'R4',
      description: 'Block and escalate any transaction exceeding $50,000 pending manual approval',
      conditions: [
        { field: 'transaction_amount', operator: '>', value: 50000 }
      ],
      action: 'block',
      severity: 'high',
      scope: 'transaction',
      depends_on: []
    })
  },
  {
    id: 'R5',
    pattern: /new\s+accounts?\s*\(?\s*less\s+than\s+30\s+days/i,
    generate: () => ({
      rule_id: 'R5',
      description: 'Block transactions exceeding $10,000 from accounts less than 30 days old',
      conditions: [
        { field: 'transaction_amount', operator: '>', value: 10000 },
        { field: 'account_age_days', operator: '<', value: 30 }
      ],
      action: 'block',
      severity: 'high',
      scope: 'transaction',
      depends_on: []
    })
  },
  {
    id: 'R6',
    pattern: /dormant\s+accounts?\s*\(?\s*no\s+activity\s+for\s+180\s+days/i,
    generate: () => ({
      rule_id: 'R6',
      description: 'Flag transactions >$5,000 from dormant accounts (180+ days inactive)',
      conditions: [
        { field: 'account_dormant_days', operator: '>=', value: 180 },
        { field: 'transaction_amount', operator: '>', value: 5000 }
      ],
      action: 'flag',
      severity: 'high',
      scope: 'account',
      depends_on: []
    })
  },
  {
    id: 'R7',
    pattern: /risk\s+score\s+exceeding\s+80/i,
    generate: () => ({
      rule_id: 'R7',
      description: 'Block all outgoing transactions for accounts with risk score > 80',
      conditions: [
        { field: 'risk_score', operator: '>', value: 80 }
      ],
      action: 'block',
      severity: 'critical',
      scope: 'account',
      depends_on: []
    })
  },
  {
    id: 'R8',
    pattern: /international\s+transactions.*exceeding\s+\$?25[,.]?000.*enhanced\s+due\s+diligence/i,
    generate: () => ({
      rule_id: 'R8',
      description: 'Flag international transactions exceeding $25,000 for enhanced due diligence',
      conditions: [
        { field: 'is_international', operator: '==', value: true },
        { field: 'transaction_amount', operator: '>', value: 25000 }
      ],
      action: 'flag',
      severity: 'medium',
      scope: 'transaction',
      depends_on: []
    })
  },
  {
    id: 'R9',
    pattern: /currency\s+conversion.*spread\s+exceeding\s+5\s*%/i,
    generate: () => ({
      rule_id: 'R9',
      description: 'Flag transactions with currency conversion spread exceeding 5% above mid-market rate',
      conditions: [
        { field: 'currency_spread_pct', operator: '>', value: 5 }
      ],
      action: 'flag',
      severity: 'medium',
      scope: 'transaction',
      depends_on: []
    })
  },
  {
    id: 'R10',
    pattern: /more\s+than\s+\$?500[,.]?000.*cumulative.*transaction\s+volume.*single\s+calendar\s+day/i,
    generate: () => ({
      rule_id: 'R10',
      description: 'Block users exceeding $500,000 cumulative daily transaction volume',
      conditions: [
        { field: 'cumulative_daily_volume', operator: '>', value: 500000 }
      ],
      action: 'block',
      severity: 'high',
      scope: 'user',
      depends_on: []
    })
  },
  {
    id: 'R11',
    pattern: /weekend\s+and\s+holiday\s+transactions\s+exceeding\s+\$?15[,.]?000/i,
    generate: () => ({
      rule_id: 'R11',
      description: 'Hold weekend/holiday transactions exceeding $15,000 for next-business-day review',
      conditions: [
        { field: 'is_weekend', operator: '==', value: true },
        { field: 'transaction_amount', operator: '>', value: 15000 }
      ],
      action: 'flag',
      severity: 'medium',
      scope: 'transaction',
      depends_on: []
    })
  }
];

/**
 * Parse unstructured policy text and extract enforceable rules.
 * @param {string} policyText - Raw policy document text
 * @returns {Array} Array of structured rule objects
 */
function parsePolicy(policyText) {
  const rules = [];
  const matchedIds = new Set();

  for (const template of RULE_TEMPLATES) {
    if (template.pattern.test(policyText) && !matchedIds.has(template.id)) {
      matchedIds.add(template.id);
      rules.push(template.generate());
    }
  }

  // Sort by rule_id for deterministic output
  rules.sort((a, b) => {
    const numA = parseInt(a.rule_id.replace('R', ''));
    const numB = parseInt(b.rule_id.replace('R', ''));
    return numA - numB;
  });

  return rules;
}

module.exports = { parsePolicy, SANCTIONED_COUNTRIES };
