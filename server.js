require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const path = require('path');
const { runPipeline } = require('./src/pipeline');

const app = express();
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Field Normalisation function mapping common field names to canonical variables
function normaliseTransactions(transactions) {
  return transactions.map((tx, index) => {
    const t = { ...tx };

    if (!t.transaction_id) t.transaction_id = `TXN-${String(index + 1).padStart(3, '0')}`;

    const aliases = {
      transaction_amount: ['amount', 'value', 'sum', 'transfer_amount', 'tx_amount', 'amt'],
      sender_country: ['country', 'origin_country', 'source_country', 'from_country', 'sender_location'],
      receiver_country: ['destination_country', 'dest_country', 'to_country', 'receiver_location', 'beneficiary_country'],
      risk_score: ['score', 'risk', 'risk_rating', 'threat_score', 'fraud_score'],
      account_age_days: ['age', 'account_age', 'days_since_creation', 'account_days'],
      is_international: ['international', 'cross_border', 'foreign'],
      is_weekend: ['weekend', 'is_weekend_tx'],
      is_vip: ['vip', 'premium', 'is_premium'],
      user_tx_count_24h: ['tx_count', 'transaction_count', 'daily_count', 'count_24h'],
      account_dormant_days: ['dormant', 'dormant_days', 'inactive_days', 'days_inactive'],
      currency_spread_pct: ['spread', 'fx_spread', 'currency_spread', 'exchange_spread'],
      cumulative_daily_volume: ['daily_volume', 'cumulative_volume', 'total_volume', 'daily_total']
    };

    for (const [canonical, aliasList] of Object.entries(aliases)) {
      if (t[canonical] === undefined || t[canonical] === null) {
        for (const alias of aliasList) {
          if (t[alias] !== undefined && t[alias] !== null) {
            t[canonical] = t[alias];
            break;
          }
        }
      }
    }

    if (t.is_international === undefined && t.sender_country && t.receiver_country) {
      t.is_international = t.sender_country !== t.receiver_country;
    }

    if (t.risk_score === undefined) t.risk_score = 0;
    if (t.user_tx_count_24h === undefined) t.user_tx_count_24h = 1;
    if (t.account_age_days === undefined) t.account_age_days = 365;
    if (t.account_dormant_days === undefined) t.account_dormant_days = 0;
    if (t.currency_spread_pct === undefined) t.currency_spread_pct = 0;
    if (t.cumulative_daily_volume === undefined) t.cumulative_daily_volume = t.transaction_amount || 0;

    if (t.is_vip === undefined) t.is_vip = false;
    if (t.is_weekend === undefined) {
      const day = new Date().getDay();
      t.is_weekend = day === 0 || day === 6;
    }

    return t;
  });
}

// MOCK RESULTS FOR DEMO MODE
const MOCK_RESULTS = {
  metadata: { pipeline_version:'2.1.0', executed_at: new Date().toISOString(), total_rules_extracted:9, total_rules_valid:9, total_transactions_evaluated:10, total_conflicts_detected:3, total_violations:6, total_gaps_identified:3, extraction_method:'demo_mode' },
  ai_summary: 'This dataset exhibits significant compliance violations with a 60% breach rate. Three critical transactions involving sanctioned countries and extreme risk scores (95/100) require immediate blocking and regulatory reporting. Recommend immediate escalation of TXN-003 and TXN-005 to the compliance officer and initiating a Suspicious Activity Report (SAR).',
  recommendations: ['Immediately review all critical-severity transactions for regulatory breach risk.', 'Resolve 3 detected rule conflicts to ensure consistent enforcement.', 'Address 3 policy gaps to improve compliance coverage.'],
  analytics: { total_transactions: 10, violations: 6, passed: 4, violation_rate: '60.0%', critical_count: 2, severity_distribution: { critical:2, high:2, medium:2, low:0, none:4 }, action_distribution: { block:3, flag:3, allow:4 }, top_rules_triggered: [{ rule_id:'R1', trigger_count:5, description:'Flag any single transaction exceeding $10,000' }, { rule_id:'R2', trigger_count:1, description:'Block sanctioned country transactions' }, { rule_id:'R7', trigger_count:1, description:'Block high risk score accounts' }], risk_score_stats: { average:40, max:95, min:10 }, total_rules: 9, total_conflicts: 3, total_gaps: 3 },
  rules: [
    { rule_id:'R1', description:'Flag transactions exceeding $10,000', conditions:[{field:'transaction_amount',operator:'>',value:10000}], action:'flag', severity:'medium', scope:'transaction' },
    { rule_id:'R2', description:'Block sanctioned country transactions', conditions:[{field:'sender_country',operator:'in',value:['KP','IR','SY','CU']}], condition_logic:'OR', action:'block', severity:'critical', scope:'transaction' },
    { rule_id:'R3', description:'Flag high-frequency non-VIP users', conditions:[{field:'user_tx_count_24h',operator:'>',value:5},{field:'is_vip',operator:'==',value:false}], action:'flag', severity:'low', scope:'user' },
    { rule_id:'R4', description:'Block transactions exceeding $50,000', conditions:[{field:'transaction_amount',operator:'>',value:50000}], action:'block', severity:'high', scope:'transaction' },
    { rule_id:'R5', description:'Block new account high-value transfers', conditions:[{field:'transaction_amount',operator:'>',value:10000},{field:'account_age_days',operator:'<',value:30}], action:'block', severity:'high', scope:'transaction' },
    { rule_id:'R6', description:'Flag dormant account reactivations', conditions:[{field:'account_dormant_days',operator:'>=',value:180},{field:'transaction_amount',operator:'>',value:5000}], action:'flag', severity:'high', scope:'account' },
    { rule_id:'R7', description:'Block extreme risk score accounts', conditions:[{field:'risk_score',operator:'>',value:80}], action:'block', severity:'critical', scope:'account' },
    { rule_id:'R8', description:'Flag large international transfers', conditions:[{field:'is_international',operator:'==',value:true},{field:'transaction_amount',operator:'>',value:25000}], action:'flag', severity:'medium', scope:'transaction' },
    { rule_id:'R9', description:'Flag high currency spread transactions', conditions:[{field:'currency_spread_pct',operator:'>',value:5}], action:'flag', severity:'medium', scope:'transaction' }
  ],
  validation_report: { total:9, valid:9, rejected:0, details:[] },
  conflicts: [
    { rule_1:'R1', rule_2:'R4', type:'subsumption', reason:'Rule R1 (threshold: $10,000) subsumes Rule R4 (threshold: $50,000). Every R4 trigger also triggers R1, potentially generating duplicate alerts.' },
    { rule_1:'R1', rule_2:'R5', type:'contradiction', reason:'Rules R1 and R5 overlap on transaction_amount field but prescribe different actions: R1 flags while R5 blocks for new accounts.' },
    { rule_1:'R3', rule_2:'R9', type:'overlap', reason:'Rules R3 and R9 may co-trigger on international high-frequency transactions, producing redundant compliance flags.' }
  ],
  transactions_analysis: [
    { transaction_id:'TXN-001', violated:false, triggered_rules:[], severity:'none', action:'allow', causal_chain:['Final decision: Transaction CLEARED — no rules triggered'], explanation:'Transaction TXN-001 ($1,500) passed all compliance checks. No rules triggered. Cleared for processing.' },
    { transaction_id:'TXN-002', violated:true, triggered_rules:['R1','R8'], severity:'medium', action:'flag', causal_chain:['[R1] transaction_amount = 15000 > 10000 → MET','[R1] All conditions met → Rule TRIGGERED','[R8] is_international = true == true → MET','[R8] transaction_amount = 15000 > 25000 → NOT MET','Final decision: Transaction FLAGGED with MEDIUM severity'], explanation:'Transaction TXN-002 ($15,000) has been FLAGGED for review with MEDIUM severity. Triggered: R1 (amount threshold), R8 (international).' },
    { transaction_id:'TXN-003', violated:true, triggered_rules:['R2'], severity:'critical', action:'block', causal_chain:['[R2] sender_country = "IR" is in [KP, IR, SY, CU] → MET','[R2] At least one condition met (OR logic) → Rule TRIGGERED','Final decision: Transaction BLOCKED with CRITICAL severity'], explanation:'Transaction TXN-003 ($8,000) must be BLOCKED with CRITICAL severity. Triggered: R2 (sanctioned country: Iran).' },
    { transaction_id:'TXN-004', violated:true, triggered_rules:['R1','R4','R8'], severity:'high', action:'block', causal_chain:['[R1] transaction_amount = 85000 > 10000 → MET','[R4] transaction_amount = 85000 > 50000 → MET','[R8] is_international = true, amount = 85000 > 25000 → MET','Conflict resolution: applied most restrictive action "block" with severity "high"','Final decision: Transaction BLOCKED with HIGH severity'], explanation:'Transaction TXN-004 ($85,000) must be BLOCKED with HIGH severity. Triggered: R1, R4, R8.' },
    { transaction_id:'TXN-005', violated:true, triggered_rules:['R7'], severity:'critical', action:'block', causal_chain:['[R7] risk_score = 95 > 80 → MET','[R7] All conditions met → Rule TRIGGERED','Final decision: Transaction BLOCKED with CRITICAL severity'], explanation:'Transaction TXN-005 ($3,000) must be BLOCKED with CRITICAL severity. Triggered: R7 (extreme risk score: 95/100).' },
    { transaction_id:'TXN-006', violated:true, triggered_rules:['R1','R5'], severity:'high', action:'block', causal_chain:['[R1] transaction_amount = 12000 > 10000 → MET','[R5] transaction_amount = 12000 > 10000 AND account_age_days = 15 < 30 → MET','Final decision: Transaction BLOCKED with HIGH severity'], explanation:'Transaction TXN-006 ($12,000) must be BLOCKED. New account (15 days old) attempting large transfer.' },
    { transaction_id:'TXN-007', violated:true, triggered_rules:['R6'], severity:'high', action:'flag', causal_chain:['[R6] account_dormant_days = 200 >= 180 → MET','[R6] transaction_amount = 7500 > 5000 → MET','Final decision: Transaction FLAGGED with HIGH severity'], explanation:'Transaction TXN-007 ($7,500) flagged. Dormant account (200 days) reactivated with significant transfer.' },
    { transaction_id:'TXN-008', violated:true, triggered_rules:['R1','R8','R9'], severity:'medium', action:'flag', causal_chain:['[R1] amount = 32000 > 10000 → MET','[R8] international = true, amount = 32000 > 25000 → MET','[R9] currency_spread_pct = 6.5 > 5 → MET','Final decision: Transaction FLAGGED with MEDIUM severity'], explanation:'Transaction TXN-008 ($32,000) flagged. Large international weekend transfer with excessive currency spread (6.5%).' },
    { transaction_id:'TXN-009', violated:true, triggered_rules:['R3'], severity:'low', action:'flag', causal_chain:['[R3] user_tx_count_24h = 8 > 5 → MET','[R3] is_vip = false == false → MET','Final decision: Transaction FLAGGED with LOW severity'], explanation:'Transaction TXN-009 ($2,000) flagged. Non-VIP user executed 8 transactions in 24 hours (velocity monitoring).' },
    { transaction_id:'TXN-010', violated:false, triggered_rules:[], severity:'none', action:'allow', causal_chain:['Final decision: Transaction CLEARED — no rules triggered'], explanation:'Transaction TXN-010 ($9,500) passed all checks. VIP account exempted from frequency rules. Cleared.' }
  ],
  gap_analysis: [
    { rule_id:'R9', status:'weak', all_statuses:['weak'], hit_count:1, hit_rate:'10.0%', reason:'Rule "Flag high currency spread" triggered only 1 out of 10 transactions (10%). Low trigger rate indicates narrow conditions.', recommendation:'Consider broadening the currency spread threshold or combining with other conditions.' },
    { rule_id:'MISSING_cumulative_daily_volume', status:'missing', all_statuses:['missing'], hit_count:'N/A', hit_rate:'N/A', reason:'No rules currently evaluate rolling daily volume. This is a recommended AML dimension to detect structuring.', recommendation:'Implement a rule targeting cumulative_daily_volume.' },
    { rule_id:'MISSING_beneficiary_risk', status:'missing', all_statuses:['missing'], hit_count:'N/A', hit_rate:'N/A', reason:'No rules evaluate beneficiary risk scoring. Beneficiary risk is a recommended compliance dimension.', recommendation:'Add beneficiary_risk threshold rules to improve detection of money mule networks.' }
  ],
  audit_log: [
    { timestamp: new Date().toISOString(), elapsed_ms:0, event_type:'PIPELINE_START', policy_chars:847, transaction_count:10 },
    { timestamp: new Date().toISOString(), elapsed_ms:1240, event_type:'RULES_EXTRACTED', count:9 },
    { timestamp: new Date().toISOString(), elapsed_ms:1285, event_type:'RULES_VALIDATED', valid:9, rejected:0 },
    { timestamp: new Date().toISOString(), elapsed_ms:1320, event_type:'CONFLICTS_DETECTED', count:3 },
    { timestamp: new Date().toISOString(), elapsed_ms:1890, event_type:'PIPELINE_COMPLETE', total_violations:6, total_elapsed_ms:1890 }
  ]
};

// Route 5: SSE Pipeline Progress
const sseClients = new Map();

app.get('/api/pipeline-progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  sseClients.set(jobId, res);
  const keepalive = setInterval(() => res.write(': keepalive\n\n'), 15000);

  req.on('close', () => {
    clearInterval(keepalive);
    sseClients.delete(jobId);
  });
});

function emitProgress(jobId, step, label, done = false) {
  const client = sseClients.get(jobId);
  if (client) {
    client.write(`data: ${JSON.stringify({ step, label, done })}\n\n`);
    if (done) {
      client.end();
      sseClients.delete(jobId);
    }
  }
}

let pipelineJobCounter = 0;

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${Date.now() - start}ms)`));
  next();
});

// Route 1: Pipeline API endpoint
app.post('/api/run-pipeline', async (req, res) => {
  const jobId = `job_${Date.now()}_${++pipelineJobCounter}`;
  
  try {
    const { policyText, transactions } = req.body;
    
    if (typeof policyText !== 'string' || policyText.length < 10) {
      return res.status(400).json({ error: 'Valid policyText string required (length > 10).' });
    }
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Valid transactions array required (length > 0).' });
    }

    const normTxs = normaliseTransactions(transactions);

    const useDemoMode = process.env.DEMO_MODE === 'true' || !process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('your_key_here');
    
    if (useDemoMode) {
      console.log(`[DemoMode] Mocking pipeline for job ${jobId}`);
      setTimeout(() => emitProgress(jobId, 1, 'Initializing execution core via Demo Mode'), 500);
      setTimeout(() => emitProgress(jobId, 2, 'Extracting rules from local datasets'), 1500);
      setTimeout(() => emitProgress(jobId, 4, 'Validating compliance thresholds'), 2500);
      setTimeout(() => emitProgress(jobId, 5, 'Applying LLM Fallbacks'), 3500);
      setTimeout(() => emitProgress(jobId, 6, 'Complete', true), 4500);
      
      return res.json({ jobId, ...MOCK_RESULTS });
    }

    const results = await runPipeline(policyText, normTxs, (step, label) => emitProgress(jobId, step, label, false));
    emitProgress(jobId, 6, 'Complete', true);
    
    res.json({ jobId, ...results });
  } catch (err) {
    emitProgress(jobId, null, `Pipeline error: ${err.message}`, true);
    res.status(500).json({ error: err.message || 'Fatal Pipeline Error' });
  }
});

// Route 2: Upload File
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/upload-policy', upload.single('policyFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded under "policyFile" key' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    let policyText = '';
    if (ext === '.pdf') {
      try {
        const data = await pdfParse(req.file.buffer);
        policyText = data.text;
      } catch (err) {
        return res.status(400).json({ error: 'Could not read PDF. Try copying the text manually.' });
      }
    } else if (ext === '.txt' || ext === '.md') {
      policyText = req.file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Invalid file extension. Only .pdf, .txt, .md allowed.' });
    }

    policyText = policyText.replace(/\0/g, ''); // Remove null bytes
    return res.json({ policyText, filename: req.file.originalname, fileType: ext, charCount: policyText.length, truncated: false });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
});

// Route 3: Random Dataset Samples
const RANDOM_POLICY_TEXT = `Data Compliance Policy v2.0 — AML & Transaction Monitoring

1. Any transaction exceeding $10,000 must be flagged for manual compliance review by the compliance team.
2. Transactions originating from or destined to sanctioned countries (KP, IR, SY, CU) must be immediately blocked and reported.
3. Any transaction exceeding $50,000 must be escalated and blocked pending manual approval from senior compliance officer.
4. Accounts less than 30 days old are prohibited from initiating transactions exceeding $10,000.
5. Dormant accounts with no activity for 180 days that initiate transactions exceeding $5,000 must be flagged for review.
6. Any account with a risk score exceeding 80 must have all outgoing transactions blocked immediately.
7. International transactions exceeding $25,000 require enhanced due diligence and must be flagged.
8. Users executing more than 5 transactions within a 24-hour period who are not VIP accounts must be flagged for velocity monitoring.
9. Weekend and holiday transactions exceeding $15,000 must be held for next-business-day review.`;

const RANDOM_TXS = [
  { transaction_id:'TXN-001', transaction_amount:1500, sender_country:'US', receiver_country:'US', risk_score:10, account_age_days:730, is_international:false, is_weekend:false, is_vip:false, user_tx_count_24h:2, account_dormant_days:0, currency_spread_pct:0.5, cumulative_daily_volume:1500 },
  { transaction_id:'TXN-002', transaction_amount:15000, sender_country:'US', receiver_country:'UK', risk_score:35, account_age_days:500, is_international:true, is_weekend:false, is_vip:false, user_tx_count_24h:1, account_dormant_days:0, currency_spread_pct:1.2, cumulative_daily_volume:15000 },
  { transaction_id:'TXN-003', transaction_amount:8000, sender_country:'IR', receiver_country:'US', risk_score:72, account_age_days:200, is_international:true, is_weekend:false, is_vip:false, user_tx_count_24h:1, account_dormant_days:0, currency_spread_pct:0, cumulative_daily_volume:8000 },
  { transaction_id:'TXN-004', transaction_amount:85000, sender_country:'US', receiver_country:'DE', risk_score:45, account_age_days:1200, is_international:true, is_weekend:false, is_vip:false, user_tx_count_24h:1, account_dormant_days:0, currency_spread_pct:2.1, cumulative_daily_volume:85000 },
  { transaction_id:'TXN-005', transaction_amount:3000, sender_country:'US', receiver_country:'US', risk_score:95, account_age_days:400, is_international:false, is_weekend:false, is_vip:false, user_tx_count_24h:1, account_dormant_days:0, currency_spread_pct:0, cumulative_daily_volume:3000 },
  { transaction_id:'TXN-006', transaction_amount:12000, sender_country:'US', receiver_country:'US', risk_score:25, account_age_days:15, is_international:false, is_weekend:false, is_vip:false, user_tx_count_24h:1, account_dormant_days:0, currency_spread_pct:0, cumulative_daily_volume:12000 },
  { transaction_id:'TXN-007', transaction_amount:7500, sender_country:'US', receiver_country:'US', risk_score:30, account_age_days:900, is_international:false, is_weekend:true, is_vip:false, user_tx_count_24h:1, account_dormant_days:200, currency_spread_pct:0, cumulative_daily_volume:7500 },
  { transaction_id:'TXN-008', transaction_amount:32000, sender_country:'US', receiver_country:'CN', risk_score:55, account_age_days:800, is_international:true, is_weekend:true, is_vip:false, user_tx_count_24h:1, account_dormant_days:0, currency_spread_pct:6.5, cumulative_daily_volume:32000 },
  { transaction_id:'TXN-009', transaction_amount:2000, sender_country:'US', receiver_country:'US', risk_score:20, account_age_days:600, is_international:false, is_weekend:false, is_vip:false, user_tx_count_24h:8, account_dormant_days:0, currency_spread_pct:0, cumulative_daily_volume:16000 },
  { transaction_id:'TXN-010', transaction_amount:9500, sender_country:'US', receiver_country:'UK', risk_score:15, account_age_days:2000, is_international:true, is_weekend:false, is_vip:true, user_tx_count_24h:6, account_dormant_days:0, currency_spread_pct:1.0, cumulative_daily_volume:9500 }
];

app.get('/api/random-sample', (req, res) => {
  res.json({ dataset_name: 'PolicyGuard Final Validation Suite', policyText: RANDOM_POLICY_TEXT, transactions: RANDOM_TXS });
});

// Route 4: Export Text Report
app.get('/api/export-report', (req, res) => {
  try {
    const rawData = req.query.data;
    if (!rawData) return res.status(400).send('No data provided');
    
    // Parse the data encoded via btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    const dataObj = JSON.parse(decodeURIComponent(escape(atob(rawData))));
    
    const ts = new Date().toISOString();
    const ver = dataObj.metadata?.pipeline_version || '2.1.0';
    
    let txt = `===================================
POLICYGUARD COMPLIANCE REPORT
Generated: ${ts}
Pipeline v${ver}
===================================

EXECUTIVE SUMMARY
${dataObj.ai_summary || ''}

KEY METRICS
- Total Transactions Evaluated: ${dataObj.analytics?.total_transactions || 0}
- Violations Detected: ${dataObj.analytics?.violations || 0} (${dataObj.analytics?.violation_rate || '0%'})
- Critical Severity: ${dataObj.analytics?.critical_count || 0}
- Rules Extracted: ${dataObj.analytics?.total_rules || 0}
- Rule Conflicts: ${dataObj.analytics?.total_conflicts || 0}
- Policy Gaps: ${dataObj.analytics?.total_gaps || 0}

VIOLATIONS DETAIL\n`;

    if (dataObj.transactions_analysis) {
      dataObj.transactions_analysis.filter(t => t.violated).forEach(t => {
        txt += `[${t.severity.toUpperCase()}] ${t.transaction_id}\n`;
        // For amount we don't have it directly in transactions_analysis here, use explanation.
        txt += `  Action: ${t.action}\n`;
        txt += `  Rules Triggered: ${t.triggered_rules.join(', ')}\n`;
        txt += `  Explanation: ${t.explanation}\n`;
        txt += `  Causal Chain:\n`;
        t.causal_chain.forEach(c => txt += `  → ${c}\n`);
        txt += `\n`;
      });
    }

    txt += `RULE CONFLICTS\n`;
    if (dataObj.conflicts) {
      dataObj.conflicts.forEach(c => {
        txt += `CONFLICT: ${c.rule_1} vs ${c.rule_2} [${c.type}]\n  ${c.reason}\n\n`;
      });
    }

    txt += `POLICY GAPS\n`;
    if (dataObj.gap_analysis) {
      dataObj.gap_analysis.forEach(g => {
        txt += `GAP [${g.status}]: ${g.rule_id}\n  ${g.reason}\n  Recommendation: ${g.recommendation}\n\n`;
      });
    }

    txt += `EXTRACTED RULES\n`;
    if (dataObj.rules) {
      dataObj.rules.forEach(r => {
        txt += `${r.rule_id}: ${r.description}\n  Action: ${r.action} | Severity: ${r.severity} | Scope: ${r.scope}\n\n`;
      });
    }

    txt += `AUDIT TRAIL\n`;
    if (dataObj.audit_log) {
      dataObj.audit_log.forEach(a => {
        txt += `[${a.elapsed_ms}ms] ${a.event_type}: ${JSON.stringify(a)}\n`;
      });
    }

    txt += `\n===================================
END OF REPORT
PolicyGuard v2.0 — Explainable. Traceable. Reproducible.
===================================`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${Date.now()}.txt"`);
    res.send(txt);
  } catch (err) {
    res.status(500).send('Error generating export: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[PolicyGuard] Server running on port ${PORT}`);
});
