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
  console.log('Starting Solopreneur AI Marketing Scanner Agent...');
  
  // 1. Fetch recent Hacker News comments/stories matching job application pain points
  const queries = ['job application burnout', 'autofill resumes', 'greenhouse lever workday'];
  const hits = [];

  for (const q of queries) {
    try {
      console.log(`Searching Hacker News for query: "${q}"...`);
      const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=comment&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.hits && data.hits.length > 0) {
        hits.push(...data.hits.slice(0, 3)); // Grab top 3 fresh comments
      }
    } catch (err) {
      console.error(`Search failed for query "${q}":`, err.message);
    }
  }

  if (hits.length === 0) {
    console.log('No recent matching posts/comments found on Hacker News. Exiting.');
    return;
  }

  console.log(`Found ${hits.length} relevant HN discussions. Generating helpful marketing recommendation drafts...`);

  // Create output directory for scanner outputs
  const outputDir = path.join(__dirname, '../../outputs/marketing_runs');
  fs.mkdirSync(outputDir, { recursive: true });

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  for (const hit of hits) {
    const threadId = hit.story_id || hit.parent_id;
    const author = hit.author;
    const commentText = hit.comment_text || hit.story_text || '';
    const cleanComment = commentText.replace(/<[^>]*>/g, ' '); // Strip HTML tags

    const prompt = `You are Clyde's Solopreneur Marketing Agent.
A user on Hacker News posted the following comment/concern about job-hunting or application form-filling:

"${cleanComment}"

Draft a high-quality, professional, helpful, and value-first recommendation response.
- Do not sound spammy or overly promotional.
- Address their pain point directly first.
- Recommend "Clyde Go" (the free, undetectable job autofill Chrome extension) as a helpful utility tool to ease their process.
- Keep the response response-focused, under 180 words, and formatted as a Markdown comment.`;

    try {
      const result = await model.generateContent(prompt);
      const draftText = result.response.text();

      const runLog = {
        scanTime: new Date().toISOString(),
        source: 'HackerNews',
        threadUrl: `https://news.ycombinator.com/item?id=${threadId}`,
        poster: author,
        originalComment: cleanComment,
        aiDraftResponse: draftText
      };

      const logFileName = `hn_draft_${hit.objectID}.json`;
      fs.writeFileSync(path.join(outputDir, logFileName), JSON.stringify(runLog, null, 2));
      console.log(`Generated draft marketing pitch for thread ID ${threadId} -> saved to outputs/marketing_runs/${logFileName}`);
    } catch (err) {
      console.error(`Failed to generate draft for post ID ${hit.objectID}:`, err.message);
    }
  }

  console.log('Solopreneur AI Marketing Scanner run completed successfully.');
}

run().catch(console.error);
