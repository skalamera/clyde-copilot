const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY || process.env.SUPABASE_ANON_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY environment variable is not configured.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  console.log('Starting Solopreneur AI Support and Triage Agent...');

  // 1. Locate the logs directory
  const logsDir = path.join(__dirname, '../../logs');
  const outputDir = path.join(__dirname, '../../outputs/support_triage');
  fs.mkdirSync(outputDir, { recursive: true });

  if (!fs.existsSync(logsDir)) {
    console.log('No local app logs folder found. Generating support agent template logs to process...');
    fs.mkdirSync(logsDir, { recursive: true });
    // Write a sample crash log file
    const sampleLogs = [
      JSON.stringify({ time: new Date().toISOString(), level: 'error', message: 'Rust audio engine failed to bind to voice input device: DeviceNotFound.' }),
      JSON.stringify({ time: new Date().toISOString(), level: 'error', message: 'Whisper transcription request timed out after 30000ms.' })
    ].join('\n');
    fs.writeFileSync(path.join(logsDir, 'sample_crash_log.jsonl'), sampleLogs);
  }

  // 2. Scan logs directory for .jsonl or .log files containing errors
  const files = fs.readdirSync(logsDir);
  const errorLines = [];

  for (const file of files) {
    if (file.endsWith('.jsonl') || file.endsWith('.log')) {
      const filePath = path.join(logsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed') || line.toLowerCase().includes('exception')) {
          errorLines.push({ file, content: line.trim() });
        }
      }
    }
  }

  if (errorLines.length === 0) {
    console.log('No recent errors or exceptions found in app log files. System is healthy.');
    return;
  }

  console.log(`Found ${errorLines.length} recent error logs. Analyzing and generating troubleshooting responses...`);

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  for (const logItem of errorLines.slice(0, 5)) { // Limit to top 5 errors to avoid rate limits
    const prompt = `You are Clyde's Solopreneur support agent.
An error log was flagged in the user's desktop application:

"File: ${logItem.file} | Error: ${logItem.content}"

Draft a clear, friendly, and precise support resolution email to the user.
- Empathize with their issue.
- Diagnose what likely caused the issue (e.g. mic not selected/permissions missing on "DeviceNotFound", local whisper server not running on timeout, etc.).
- Give step-by-step troubleshooting actions (like checking audio settings in Clyde Settings tab, restarting the whisper sidecar, etc.).
- Keep it concise, under 180 words, and formatted as a Markdown draft response.`;

    try {
      const result = await model.generateContent(prompt);
      const ticketDraft = result.response.text();

      const triageResult = {
        triageTime: new Date().toISOString(),
        logFile: logItem.file,
        flaggedError: logItem.content,
        troubleshootingEmailDraft: ticketDraft
      };

      const outFileName = `support_triage_${Date.now()}_${Math.floor(Math.random() * 1000)}.json`;
      fs.writeFileSync(path.join(outputDir, outFileName), JSON.stringify(triageResult, null, 2));
      console.log(`Generated support response draft -> saved to outputs/support_triage/${outFileName}`);
    } catch (err) {
      console.error('Failed to draft support ticket:', err.message);
    }
  }

  console.log('Support and Triage Agent run completed successfully.');
}

run().catch(console.error);
