const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const userSecretsPath = path.join(os.homedir(), '.secrets', 'clyde-dev.env');
if (fs.existsSync(userSecretsPath)) {
  require('dotenv').config({ path: userSecretsPath });
} else {
  require('dotenv').config();
}
const { Pinecone } = require('@pinecone-database/pinecone');
const pdfParse = require('pdf-parse');
const { getEmbedding } = require('../src/pineconeClient.js');

async function ingestFile(filePath) {
    console.log(`Starting ingestion for: ${filePath}`);
    
    // 1. Read file
    let text = '';
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.txt' || ext === '.md') {
        text = fs.readFileSync(filePath, 'utf8');
    } else if (ext === '.pdf') {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        text = data.text;
    } else {
        throw new Error('Unsupported file type. Please use .txt, .md, or .pdf');
    }

    // 2. Chunk text (simple chunking by double newlines or large blocks)
    // We'll clean up whitespace and ensure chunks are a reasonable size.
    const rawChunks = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';
    
    for (const piece of rawChunks) {
        const trimmed = piece.trim();
        if (!trimmed) continue;
        
        if (currentChunk.length + trimmed.length < 1000) {
            currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = trimmed;
        }
    }
    if (currentChunk) chunks.push(currentChunk);

    console.log(`Extracted and split text into ${chunks.length} manageable chunks.`);

    // 3. Initialize Pinecone
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX || 'clyde-copilot';
    
    if (!pineconeApiKey) {
        throw new Error("PINECONE_API_KEY is missing from .env");
    }

    const pc = new Pinecone({ apiKey: pineconeApiKey });
    const index = pc.Index(indexName);

    console.log(`Connected to Pinecone index: ${indexName}`);

    // 4. Generate embeddings and upsert sequentially to avoid rate limits
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
        console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}...`);
        try {
            const values = await getEmbedding(chunks[i]);
            
            const formattedValues = [];
            for(let j=0; j<values.length; j++) {
                formattedValues.push(values[j]);
            }
            
            if (formattedValues.length > 0) {
                vectors.push({
                    id: `doc-${path.basename(filePath)}-chunk-${i}-${Date.now()}`,
                    values: formattedValues,
                    metadata: {
                        text: chunks[i],
                        source: path.basename(filePath)
                    }
                });
            }
            // Small delay to respect rate limits
            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            console.error(`Error embedding chunk ${i+1}:`, err);
        }
    }

    if (vectors.length > 0) {
        console.log(`Upserting ${vectors.length} vectors to Pinecone...`);
        // We bypass the bugged Pinecone SDK and hit the REST API directly
        const axios = require('axios');
        const pineconeHost = process.env.PINECONE_HOST;
        
        try {
            await axios.post(`${pineconeHost}/vectors/upsert`, {
                vectors: vectors
            }, {
                headers: {
                    'Api-Key': pineconeApiKey,
                    'Content-Type': 'application/json'
                }
            });
            console.log('✅ Ingestion complete! The data is now available to Clyde.');
        } catch (err) {
            console.error('Pinecone REST API error:', err.response?.data || err.message);
        }
    } else {
        console.log('No vectors were generated to upsert.');
    }
}

const targetFile = process.argv[2];
if (!targetFile) {
    console.error('❌ Please provide a file to ingest!');
    console.error('Usage: node scripts/ingest.js <path/to/resume.pdf or .txt>');
    process.exit(1);
}

ingestFile(targetFile).catch(err => {
    console.error('Ingestion failed:', err);
});
