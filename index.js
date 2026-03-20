/**
 * CLI Entry Point v2.0
 * Runs the full production compliance pipeline
 */
const fs = require('fs');
const path = require('path');
const { runPipeline } = require('./src/pipeline');

// Load sample data from first dataset
const dataDir = path.join(__dirname, 'data', 'datasets', 'dataset_1');
const policyText = fs.readFileSync(path.join(dataDir, 'policy.txt'), 'utf-8');
const transactions = JSON.parse(fs.readFileSync(path.join(dataDir, 'transactions.json'), 'utf-8'));

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   PolicyGuard — Compliance Intelligence Engine v2.0         ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('▶ Running compliance pipeline...');
console.log(`  • Policy: ${policyText.length} chars | Transactions: ${transactions.length}\n`);

const results = runPipeline(policyText, transactions);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  PIPELINE SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Rules extracted:    ${results.metadata.total_rules_extracted} (${results.metadata.total_rules_valid} valid)`);
console.log(`  Conflicts:          ${results.metadata.total_conflicts_detected}`);
console.log(`  Transactions:       ${results.metadata.total_transactions_evaluated}`);
console.log(`  Violations:         ${results.metadata.total_violations}`);
console.log(`  Gaps:               ${results.metadata.total_gaps_identified}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🧠 AI SUMMARY:', results.ai_summary, '\n');

for (const tx of results.transactions_analysis) {
  const icon = tx.violated ? '🚨' : '✅';
  console.log(`  ${icon} ${tx.transaction_id} | ${tx.action.toUpperCase()} | ${tx.severity.toUpperCase()} | [${tx.triggered_rules.join(', ') || 'none'}]`);
}

console.log(`\n📊 Analytics: ${JSON.stringify(results.analytics.severity_distribution)}`);
console.log(`📋 Audit log: ${results.audit_log.length} entries\n`);

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'results.json'), JSON.stringify(results, null, 2), 'utf-8');
console.log('✅ Full results → output/results.json\n');
