# PolicyGuard v2.0
**Production-Grade AI Compliance Agent**

An advanced compliance system that automatically extracts rules from uncontrolled policy documents (PDF, TXT) and evaluates raw transaction JSON against them.

## Quick Start
1. \`npm install\`
2. \`cp .env.example .env\`
3. (Optional) Add \`GROQ_API_KEY\` to \`.env\`
4. \`npm run dev\`
5. Open \`http://localhost:3000\`

## Demo Mode
If no API key is provided, the system falls back to **Demo Mode**, yielding a predictable set of 9 rules overriding 10 sample transactions without making external network calls.

## Final Improvements (v2.1)
- **Robustness**: Complete try/catch wrapping around isolated pipeline steps
- **Asynchrony**: LLM-first evaluations integrated into the async/await pipeline
- **Reliability**: Dual fallback extraction (LLM -> Regex Templates)
- **UI Enhancements**: Risk Score Bars, Toast notifications, Export functionality

## Field Normalisation Supported
- \`transaction_amount\`, \`amount\`, \`value\`, \`sum\`  -> \`transaction_amount\`
- \`sender_country\`, \`origin_country\`              -> \`sender_country\`
- \`risk_score\`, \`score\`                           -> \`risk_score\`
- \`user_tx_count_24h\`, \`tx_count\`                 -> \`user_tx_count_24h\`
