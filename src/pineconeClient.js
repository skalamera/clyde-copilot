const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');

async function getEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set, skipping embedding generation");
    return [];
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  // Matches the model used in cv-site ingest script
  const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

async function searchResumeVectors(queryText, topK = 3) {
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeHost = process.env.PINECONE_HOST;

  if (!pineconeApiKey || !pineconeHost) {
    console.warn("PINECONE_API_KEY or PINECONE_HOST is missing, skipping RAG retrieval");
    return [];
  }

  const pc = new Pinecone({ apiKey: pineconeApiKey });
  // Pass the host directly for custom endpoint routing if you need it,
  // or use the index name from the host if preferred. 
  // We'll use the native fetch directly against the host to ensure it hits your specific cluster.

  const vector = await getEmbedding(queryText);

  const response = await axios.post(`${pineconeHost}/query`, {
    vector,
    topK,
    includeMetadata: true
  }, {
    headers: {
      'Api-Key': pineconeApiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.data || !response.data.matches) {
    console.log(`[RAG] Pinecone search returned no matches for question: "${queryText}"`);
    return [];
  }

  const matches = response.data.matches.map(match => ({
    score: match.score,
    text: match.metadata?.text || '',
    source: match.metadata?.source || 'unknown'
  }));

  console.log(`[RAG] Successfully retrieved ${matches.length} context chunks from Pinecone for question: "${queryText}"`);
  
  return matches;
}

async function detectResumeQuestion(transcript) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY missing, skipping intent detection");
    return null;
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `Analyze the following meeting transcript. 
Determine if any speaker (other than "You") is currently asking "You" a fully complete question about your professional history, past projects, work experience, or a general job interview question (e.g. behavioral questions, "how would you handle X", "what is your 30-60-90 day plan", strengths/weaknesses).

CRITICAL RULES:
1. The question MUST be grammatically complete. If the speaker trails off or is mid-sentence (e.g. "Can you tell me how the...", "What did you do at...", "How the CV site project was architected", "If you were to get the job, what would"), set isAskingInterviewQuestion to false.
2. Only consider the very last statements in the transcript. Do not extract questions that were asked and already answered earlier in the transcript.
3. If the transcript is just a fragment or the person hasn't finished their thought, set isAskingInterviewQuestion to false.
4. If yes and the question is fully finished, extract the core question.

Transcript:
${transcript}

Return ONLY a JSON object with this structure:
{
  "isAskingInterviewQuestion": boolean,
  "question": string | null
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.isAskingInterviewQuestion && parsed.question && parsed.question.length > 25) {
        return parsed.question;
      }
    }
  } catch (error) {
    console.error("Intent detection error:", error);
  }
  return null;
}

module.exports = {
  getEmbedding,
  searchResumeVectors,
  detectResumeQuestion
};
