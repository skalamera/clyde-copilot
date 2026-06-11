const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const axios = require('axios');
const userSecretsPath = path.join(os.homedir(), '.secrets', 'clyde-dev.env');
if (fs.existsSync(userSecretsPath)) {
  require('dotenv').config({ path: userSecretsPath });
} else {
  require('dotenv').config();
}

async function resetKnowledge() {
    const appData = process.env.APPDATA;
    
    let store = {};
    try {
        store = JSON.parse(fs.readFileSync(path.join(appData, 'clyde', 'config.json'), 'utf8'));
    } catch(e) {}
    
    const apiKey = process.env.PINECONE_API_KEY || store.pineconeApiKey;
    let host = process.env.PINECONE_HOST || store.pineconeHost;
    
    if (!apiKey || !host) {
        console.log('Pinecone is not configured. Only resetting local database.');
    } else {
        host = host.replace(/\/+$/, '');
        console.log('Wiping remote Pinecone data...');
        
        try {
            // Delete from clyde-pro-knowledge namespace
            await axios.post(`${host}/vectors/delete`, {
                deleteAll: true,
                namespace: 'clyde-pro-knowledge'
            }, {
                headers: {
                    'Api-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            });
            console.log('✓ Cleared clyde-pro-knowledge namespace');

            // Delete from default namespace (where the old ingest.js might have put it)
            await axios.post(`${host}/vectors/delete`, {
                deleteAll: true,
                namespace: ''
            }, {
                headers: {
                    'Api-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            });
            console.log('✓ Cleared default namespace');
        } catch (error) {
            console.error('Failed to clear Pinecone:', error.response?.data || error.message);
        }
    }

    console.log('\nWiping local Knowledge database...');
    // The default electron app path for userData is usually %APPDATA%/clyde
    const dbPath = path.join(appData, 'clyde', 'Knowledge', 'knowledge.db');
    const dbPathWal = path.join(appData, 'clyde', 'Knowledge', 'knowledge.db-wal');
    const dbPathShm = path.join(appData, 'clyde', 'Knowledge', 'knowledge.db-shm');

    if (fs.existsSync(dbPath)) {
        try {
            fs.unlinkSync(dbPath);
            if (fs.existsSync(dbPathWal)) fs.unlinkSync(dbPathWal);
            if (fs.existsSync(dbPathShm)) fs.unlinkSync(dbPathShm);
            console.log('✓ Deleted local SQLite Knowledge database');
        } catch (e) {
            console.error('Failed to delete local database. Make sure Clyde is fully closed!', e.message);
        }
    } else {
        console.log('- Local database not found, nothing to delete');
    }

    console.log('\nReset complete! You are starting fresh.');
}

resetKnowledge();
