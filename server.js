/**
 * Express API Server v2.0
 * Random datasets, file upload, analytics, full pipeline API
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { runPipeline } = require('./src/pipeline');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.txt', '.text', '.md', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt and .md files are supported'));
    }
  }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// State: last pipeline results
let lastResults = null;

// ── Dataset Management ──
const DATASETS_DIR = path.join(__dirname, 'data', 'datasets');

function getAvailableDatasets() {
  try {
    return fs.readdirSync(DATASETS_DIR).filter(d =>
      fs.statSync(path.join(DATASETS_DIR, d)).isDirectory()
    );
  } catch { return []; }
}

function loadDataset(name) {
  const dir = path.join(DATASETS_DIR, name);
  const policyText = fs.readFileSync(path.join(dir, 'policy.txt'), 'utf-8');
  const transactions = JSON.parse(fs.readFileSync(path.join(dir, 'transactions.json'), 'utf-8'));
  return { policyText, transactions, dataset_name: name };
}

// ── API Routes ──

// Random sample dataset
app.get('/api/random-sample', (req, res) => {
  try {
    const datasets = getAvailableDatasets();
    if (datasets.length === 0) {
      return res.status(404).json({ error: 'No datasets found' });
    }
    const pick = datasets[Math.floor(Math.random() * datasets.length)];
    const data = loadDataset(pick);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load random sample', details: err.message });
  }
});

// Legacy sample data endpoint (picks first dataset)
app.get('/api/sample-data', (req, res) => {
  try {
    const datasets = getAvailableDatasets();
    const data = loadDataset(datasets[0] || 'dataset_1');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sample data', details: err.message });
  }
});

// Run pipeline
app.post('/api/run-pipeline', (req, res) => {
  try {
    const { policyText, transactions } = req.body;

    if (!policyText || !transactions || !Array.isArray(transactions)) {
      return res.status(400).json({
        error: 'Invalid input. Provide "policyText" (string) and "transactions" (array).'
      });
    }

    const results = runPipeline(policyText, transactions);
    lastResults = results;

    // Save to file
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'results.json'), JSON.stringify(results, null, 2), 'utf-8');

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Pipeline execution failed', details: err.message });
  }
});

// Upload policy file
app.post('/api/upload-policy', upload.single('policyFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const policyText = req.file.buffer.toString('utf-8');
    res.json({ policyText, filename: req.file.originalname, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: 'File upload failed', details: err.message });
  }
});

// Get last results
app.get('/api/results', (req, res) => {
  if (!lastResults) {
    return res.status(404).json({ error: 'No results available. Run the pipeline first.' });
  }
  res.json(lastResults);
});

// Get analytics
app.get('/api/analytics', (req, res) => {
  if (!lastResults || !lastResults.analytics) {
    return res.status(404).json({ error: 'No analytics available. Run the pipeline first.' });
  }
  res.json({
    analytics: lastResults.analytics,
    ai_summary: lastResults.ai_summary,
    recommendations: lastResults.recommendations
  });
});

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const datasets = getAvailableDatasets();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Enterprise Data Policy Compliance Agent v2.0              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🌐 Dashboard:      http://localhost:${PORT}`);
  console.log(`  📡 Run Pipeline:   POST http://localhost:${PORT}/api/run-pipeline`);
  console.log(`  🎲 Random Sample:  GET  http://localhost:${PORT}/api/random-sample`);
  console.log(`  📂 Upload Policy:  POST http://localhost:${PORT}/api/upload-policy`);
  console.log(`  📊 Analytics:      GET  http://localhost:${PORT}/api/analytics`);
  console.log(`  📦 Results:        GET  http://localhost:${PORT}/api/results`);
  console.log(`  📁 Datasets:       ${datasets.length} available (${datasets.join(', ')})`);
  console.log('');
});
