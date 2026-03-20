/**
 * Policy Parser & Structured Rule Generator
 * STEP 1 & 2: Parse unstructured policy text → extract enforceable rules → JSON
 */

const fs = require('fs');
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk');

const SANCTIONED_COUNTRIES = ['KP', 'IR', 'SY', 'CU', 'UA-43'];

const RULE_TEMPLATES = [
  { id: 'R1', pattern: /(?=.*10[,.]?000)(?=.*flag)/i, generate: () => ({ rule_id: 'R1', description: 'Flag any single transaction exceeding $10,000 for manual compliance review', conditions: [{ field: 'transaction_amount', operator: '>', value: 10000 }], action: 'flag', severity: 'medium', scope: 'transaction', depends_on: [] }) },
  { id: 'R2', pattern: /(?=.*block)(?=.*sanctioned)/i, generate: () => ({ rule_id: 'R2', description: 'Block transactions originating from or destined to sanctioned countries', conditions: [{ field: 'sender_country', operator: 'in', value: SANCTIONED_COUNTRIES }, { field: 'receiver_country', operator: 'in', value: SANCTIONED_COUNTRIES }], condition_logic: 'OR', action: 'block', severity: 'critical', scope: 'transaction', depends_on: [] }) },
  { id: 'R3', pattern: /(?=.*5\s+transactions)(?=.*24[- ]hour)/i, generate: () => ({ rule_id: 'R3', description: 'Flag high-frequency transactions (>5 in 24h) for non-VIP accounts', conditions: [{ field: 'user_tx_count_24h', operator: '>', value: 5 }, { field: 'is_vip', operator: '==', value: false }], action: 'flag', severity: 'low', scope: 'user', depends_on: [] }) },
  { id: 'R4', pattern: /(?=.*50[,.]?000)(?=.*escalate)(?=.*block)/i, generate: () => ({ rule_id: 'R4', description: 'Block and escalate any transaction exceeding $50,000 pending manual approval', conditions: [{ field: 'transaction_amount', operator: '>', value: 50000 }], action: 'block', severity: 'high', scope: 'transaction', depends_on: [] }) },
  { id: 'R5', pattern: /(?=.*new\s+account)(?=.*30\s+days)/i, generate: () => ({ rule_id: 'R5', description: 'Block transactions exceeding $10,000 from accounts less than 30 days old', conditions: [{ field: 'transaction_amount', operator: '>', value: 10000 }, { field: 'account_age_days', operator: '<', value: 30 }], action: 'block', severity: 'high', scope: 'transaction', depends_on: [] }) },
  { id: 'R6', pattern: /(?=.*dormant)(?=.*180\s+days)/i, generate: () => ({ rule_id: 'R6', description: 'Flag transactions >$5,000 from dormant accounts (180+ days inactive)', conditions: [{ field: 'account_dormant_days', operator: '>=', value: 180 }, { field: 'transaction_amount', operator: '>', value: 5000 }], action: 'flag', severity: 'high', scope: 'account', depends_on: [] }) },
  { id: 'R7', pattern: /(?=.*risk\s+score)(?=.*80)/i, generate: () => ({ rule_id: 'R7', description: 'Block all transactions for accounts with risk score > 80', conditions: [{ field: 'risk_score', operator: '>', value: 80 }], action: 'block', severity: 'critical', scope: 'account', depends_on: [] }) },
  { id: 'R8', pattern: /(?=.*international)(?=.*25[,.]?000)(?=.*due\s+diligence)/i, generate: () => ({ rule_id: 'R8', description: 'Flag international transactions exceeding $25,000 for enhanced due diligence', conditions: [{ field: 'is_international', operator: '==', value: true }, { field: 'transaction_amount', operator: '>', value: 25000 }], action: 'flag', severity: 'medium', scope: 'transaction', depends_on: [] }) },
  { id: 'R9', pattern: /(?=.*currency)(?=.*spread)(?=.*5\s*%)/i, generate: () => ({ rule_id: 'R9', description: 'Flag transactions with currency conversion spread exceeding 5% above mid-market rate', conditions: [{ field: 'currency_spread_pct', operator: '>', value: 5 }], action: 'flag', severity: 'medium', scope: 'transaction', depends_on: [] }) },
  { id: 'R10', pattern: /(?=.*500[,.]?000)(?=.*cumulative)/i, generate: () => ({ rule_id: 'R10', description: 'Block users exceeding $500,000 cumulative daily transaction volume', conditions: [{ field: 'cumulative_daily_volume', operator: '>', value: 500000 }], action: 'block', severity: 'high', scope: 'user', depends_on: [] }) },
  { id: 'R11', pattern: /(?=.*weekend|holiday)(?=.*15[,.]?000)/i, generate: () => ({ rule_id: 'R11', description: 'Hold weekend/holiday transactions exceeding $15,000 for next-business-day review', conditions: [{ field: 'is_weekend', operator: '==', value: true }, { field: 'transaction_amount', operator: '>', value: 15000 }], action: 'flag', severity: 'medium', scope: 'transaction', depends_on: [] }) }
];

const SYSTEM_PROMPT = `You are a compliance rule extraction engine for an Anti-Money Laundering (AML) system.
Your job is to read a policy document and extract every enforceable compliance rule as structured JSON.

CRITICAL INSTRUCTIONS:
- Return ONLY a valid JSON array. No markdown. No code fences. No explanation. No preamble.
- Start your response with [ and end with ]
- Extract EVERY rule that specifies a condition triggering an action
- Map ALL monetary amounts, time periods, frequencies, countries, and scores to the fields below

AVAILABLE FIELDS (use ONLY these exact field names in conditions):
- transaction_amount: number (USD amount of the transaction)
- sender_country: string (ISO country code of sender, e.g. "US", "IR")
- receiver_country: string (ISO country code of receiver)
- risk_score: number (0-100, account risk score)
- account_age_days: number (how many days old the account is)
- is_international: boolean (true if sender and receiver countries differ)
- is_weekend: boolean (true if transaction occurs on Saturday or Sunday)
- is_vip: boolean (true if account has VIP status)
- user_tx_count_24h: number (number of transactions by this user in last 24 hours)
- account_dormant_days: number (days since last account activity)
- currency_spread_pct: number (currency conversion spread percentage)
- cumulative_daily_volume: number (total USD volume transacted today by this user)
- beneficiary_risk: number (0-100, risk score of the receiving party)

AVAILABLE OPERATORS: > >= < <= == != in not_in
For "in" and "not_in" operators, value must be a JSON array.
For geographic sanctions, use sender_country or receiver_country with "in" operator and ISO codes array.

OUTPUT SCHEMA — each rule must have ALL these fields:
{
  "rule_id": "R1",           // Sequential: R1, R2, R3...
  "description": "string",   // Clear human-readable description of what this rule does
  "conditions": [            // Array of condition objects
    {
      "field": "transaction_amount",
      "operator": ">",
      "value": 10000
    }
  ],
  "condition_logic": "AND",  // "AND" (all conditions must be met) or "OR" (any condition triggers)
  "action": "flag",          // MUST be exactly: "flag", "block", or "allow"
  "severity": "medium",      // MUST be exactly: "low", "medium", "high", or "critical"
  "scope": "transaction",    // MUST be exactly: "transaction", "account", "user", or "system"
  "depends_on": []           // Array of rule_ids this rule depends on (usually empty)
}

SEVERITY MAPPING GUIDE:
- critical: sanctions violations, risk_score > 80, terrorist financing indicators
- high: large amounts (> $50,000), new account abuse, dormant account reactivation
- medium: moderate amounts ($10,000-$50,000), high frequency, international transfers
- low: minor threshold breaches, informational flags

ACTION MAPPING GUIDE:
- block: transaction must be stopped, requires manual approval to proceed
- flag: transaction is allowed but marked for human review
- allow: explicitly permitted (use rarely, only when policy specifies an exception)
`;

function preprocessPolicy(rawText) {
  let cleanText = rawText.replace(/[\r\n]+/g, '\n').replace(/\s{2,}/g, ' ').trim();
  // Strip lines that look like "Page 1 of 5" or dates or just numbers
  cleanText = cleanText.split('\n').filter(line => {
    const t = line.trim();
    if (/^Page \d+( of \d+)?$/i.test(t)) return false;
    if (/^\d+$/.test(t)) return false;
    return true;
  }).join('\n');

  let truncated = false;
  if (cleanText.length > 8000) {
    const keywordRegex = /(Rules|Policy|Regulations|Requirements|Compliance|Prohibited|Mandatory|Shall|Must)/i;
    const match = cleanText.match(keywordRegex);
    if (match) {
      cleanText = cleanText.substring(match.index, match.index + 8000);
    } else {
      cleanText = cleanText.substring(0, 8000);
    }
    truncated = true;
  }
  return { cleanText, truncated, originalLength: rawText.length };
}

function parseGroqResponse(rawResponse) {
  if (!rawResponse) return null;
  let text = rawResponse.trim();
  text = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  
  if (firstBracket === -1 || lastBracket === -1) return null;
  text = text.slice(firstBracket, lastBracket + 1);

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    try {
      // Fix trailing commas
      text = text.replace(/,\s*([\]}])/g, '$1');
      // Replace single quotes surrounding keys/values (broadly)
      text = text.replace(/'([^']+)'\s*:/g, '"$1":');
      parsed = JSON.parse(text);
    } catch (e2) {
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;

  const validActions = ['flag', 'block', 'allow'];
  const validSeverities = ['low', 'medium', 'high', 'critical'];

  const cleaned = parsed.filter(r => {
    if (!r.action || !validActions.includes(r.action.toLowerCase())) return false;
    if (!r.severity || !validSeverities.includes(r.severity.toLowerCase())) return false;
    if (!Array.isArray(r.conditions) || r.conditions.length === 0) return false;
    return true;
  }).map((r, i) => {
    return {
      ...r,
      rule_id: `R${i + 1}`,
      action: r.action.toLowerCase(),
      severity: r.severity.toLowerCase(),
      _extraction_method: 'llm'
    };
  });

  return cleaned.length > 0 ? cleaned : null;
}

function parseRegexFallback(policyText) {
  const rules = [];
  const matchedIds = new Set();
  for (const template of RULE_TEMPLATES) {
    if (template.pattern.test(policyText) && !matchedIds.has(template.id)) {
      matchedIds.add(template.id);
      rules.push({ ...template.generate(), _extraction_method: 'regex_fallback' });
    }
  }
  rules.sort((a, b) => parseInt(a.rule_id.substring(1)) - parseInt(b.rule_id.substring(1)));
  return rules;
}

async function parsePolicy(policyText) {
  const { cleanText } = preprocessPolicy(policyText);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.includes('your_key_here') || process.env.DEMO_MODE === 'true') {
    console.log('[policyParser] No valid Groq API key found or Demomode is true. Using fallback.');
    return parseRegexFallback(cleanText);
  }

  try {
    const groq = new Groq({ apiKey });

    const groqCall = groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Extract all enforceable compliance rules from this policy document:\n\n${cleanText}\n\nReturn a JSON array of rule objects.` }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Groq timeout after 7s')), 7000)
    );

    const completion = await Promise.race([groqCall, timeoutPromise]);
    const rawResponse = completion.choices[0].message.content;

    const parsedRules = parseGroqResponse(rawResponse);
    if (parsedRules && parsedRules.length > 0) {
      return parsedRules;
    } else {
      console.warn('[policyParser] WARNING: Using regex fallback — LLM extraction failed or returned 0 rules');
      return parseRegexFallback(cleanText);
    }
  } catch (err) {
    console.warn(`[policyParser] WARNING: Using regex fallback — LLM extraction failed (${err.message})`);
    return parseRegexFallback(cleanText);
  }
}

module.exports = { parsePolicy, SANCTIONED_COUNTRIES, RULE_TEMPLATES };
