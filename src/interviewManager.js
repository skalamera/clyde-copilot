const fs = require('fs');
const path = require('path');
const { generateChat } = require('./llmClient');
const {
    buildTranscriptCleanupPrompt,
    normalizeCleanedTranscriptResponse,
    transcriptToText
} = require('./transcriptCleanup');
const { directAddressFeedback } = require('./trendAnalysis');

function createInterviewManager({ appPath, axiosClient, settings, onStatus }) {
    const interviewsDir = path.join(appPath, 'Interviews');
    
    const provider = settings.llmProvider || 'local';
    const apiKey = settings.llmApiKey || '';
    const model = settings.llmModel || '';
    const localUrl = settings.localLlmUrl;

    if (!fs.existsSync(interviewsDir)) {
        fs.mkdirSync(interviewsDir, { recursive: true });
    }

    function sanitizeFilename(name) {
        return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    function getCompanies() {
        if (!fs.existsSync(interviewsDir)) return [];
        const items = fs.readdirSync(interviewsDir, { withFileTypes: true });
        const companies = items.filter(item => item.isDirectory()).map(dir => {
            const companyName = dir.name;
            let confidence = 0;
            let trend = 'neutral';
            let role = '';
            // Restore actual name from meta if sanitized folder differs
            let actualName = companyName; 
            const metaPath = path.join(interviewsDir, companyName, 'meta.json');
            if (fs.existsSync(metaPath)) {
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    actualName = meta.name || companyName;
                    confidence = meta.confidence_score || 0;
                    trend = meta.trend || 'neutral';
                    role = meta.role || '';
                } catch(e) {}
            }
            return { name: actualName, confidence, trend, role };
        });
        
        return companies.sort((a, b) => b.confidence - a.confidence);
    }

    function getRoles() {
        if (!fs.existsSync(interviewsDir)) return [];
        const items = fs.readdirSync(interviewsDir, { withFileTypes: true });
        const roles = new Set();
        for (const item of items) {
            if (item.isDirectory()) {
                const companyDir = path.join(interviewsDir, item.name);
                const files = fs.readdirSync(companyDir).filter(f => f.endsWith('.json') && f !== 'meta.json');
                for (const file of files) {
                    const fp = path.join(companyDir, file);
                    try {
                        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
                        if (data.role) {
                            roles.add(data.role);
                        }
                    } catch(e) {}
                }
            }
        }
        return Array.from(roles).sort();
    }

    function deleteCompany(companyName) {
        const companyDir = path.join(interviewsDir, sanitizeFilename(companyName));
        if (fs.existsSync(companyDir)) {
            fs.rmSync(companyDir, { recursive: true, force: true });
        }
    }

    function renameCompany(oldName, newName) {
        const oldDir = path.join(interviewsDir, sanitizeFilename(oldName));
        const newDir = path.join(interviewsDir, sanitizeFilename(newName));
        
        if (!fs.existsSync(oldDir)) throw new Error("Company not found");
        if (oldDir === newDir) return; // Same sanitized name, just update meta
        if (fs.existsSync(newDir)) throw new Error("Target company already exists");
        
        fs.renameSync(oldDir, newDir);
        
        // Update meta.json
        const metaPath = path.join(newDir, 'meta.json');
        if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            meta.name = newName;
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        }
        
        // Update all interview JSON files
        const files = fs.readdirSync(newDir).filter(f => f.endsWith('.json') && f !== 'meta.json');
        for (const file of files) {
            const fp = path.join(newDir, file);
            const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
            data.company = newName;
            fs.writeFileSync(fp, JSON.stringify(data, null, 2));
        }
    }

    function setCompanyRole(companyName, role) {
        const companyDir = path.join(interviewsDir, sanitizeFilename(companyName));
        if (!fs.existsSync(companyDir)) fs.mkdirSync(companyDir, { recursive: true });
        
        const metaPath = path.join(companyDir, 'meta.json');
        let meta = { name: companyName };
        if (fs.existsSync(metaPath)) {
            try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {}
        }
        meta.role = role;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        
        // Optionally update all interview JSON files in this directory with the new role
        const files = fs.readdirSync(companyDir).filter(f => f.endsWith('.json') && f !== 'meta.json');
        for (const file of files) {
            const fp = path.join(companyDir, file);
            try {
                const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
                data.role = role;
                fs.writeFileSync(fp, JSON.stringify(data, null, 2));
            } catch(e) {}
        }
    }

    function getCompanyJobDescription(companyName) {
        if (!companyName) return '';
        const companyDir = path.join(interviewsDir, sanitizeFilename(companyName));
        const jdPath = path.join(companyDir, 'jobDescription.txt');
        if (fs.existsSync(jdPath)) {
            return fs.readFileSync(jdPath, 'utf8');
        }
        return '';
    }

    function setCompanyJobDescription(companyName, jdText) {
        if (!companyName) return;
        const companyDir = path.join(interviewsDir, sanitizeFilename(companyName));
        if (!fs.existsSync(companyDir)) fs.mkdirSync(companyDir, { recursive: true });
        
        const jdPath = path.join(companyDir, 'jobDescription.txt');
        if (!jdText) {
            if (fs.existsSync(jdPath)) fs.unlinkSync(jdPath);
        } else {
            fs.writeFileSync(jdPath, jdText, 'utf8');
        }
    }

    function deleteInterview(companyName, interviewId) {
        const companyDir = path.join(interviewsDir, sanitizeFilename(companyName));
        const fp = path.join(companyDir, `${interviewId}.json`);
        
        if (fs.existsSync(fp)) {
            fs.unlinkSync(fp);
        }
        
        // Recompute overall confidence score after deletion
        recomputeConfidenceScore(companyDir, companyName).catch(e => console.error(e));
    }

    function saveInterview({ id, originalCompany, company, role, phase, interviewerName, interviewerTitle, transcript }) {
        if (!transcript || transcript.length === 0) {
            throw new Error("No transcript data to save.");
        }

        const companyDir = path.join(interviewsDir, sanitizeFilename(company));
        if (!fs.existsSync(companyDir)) {
            fs.mkdirSync(companyDir, { recursive: true });
        }

        const metaPath = path.join(companyDir, 'meta.json');
        if (!fs.existsSync(metaPath)) {
            fs.writeFileSync(metaPath, JSON.stringify({ name: company, confidence_score: 0, trend: 'neutral' }, null, 2));
        }

        const actualId = id || Date.now().toString();
        let existingData = null;
        let transcriptChanged = true;
        let originalCompanyDir = null;

        if (id) {
            // Check if existing file exists (either in the new company dir or the original one)
            const targetCompany = originalCompany || company;
            originalCompanyDir = path.join(interviewsDir, sanitizeFilename(targetCompany));
            const oldFilePath = path.join(originalCompanyDir, `${actualId}.json`);
            
            if (fs.existsSync(oldFilePath)) {
                try {
                    existingData = JSON.parse(fs.readFileSync(oldFilePath, 'utf8'));
                    
                    // Check if transcript text array deeply matches
                    const oldTrans = existingData.transcript.map(t => `${t.speaker}:${t.text}`).join('|');
                    const newTrans = transcript.map(t => `${t.speaker}:${t.text}`).join('|');
                    
                    if (oldTrans === newTrans) {
                        if (existingData.gradingStatus === 'failed') {
                            transcriptChanged = true; // force regrade
                        } else {
                            transcriptChanged = false;
                        }
                    }
                    
                    // If company changed, we need to delete the old file
                    if (originalCompany && sanitizeFilename(originalCompany) !== sanitizeFilename(company)) {
                        fs.unlinkSync(oldFilePath);
                    }
                } catch(e) {
                    console.error("Failed to read existing interview data for comparison:", e);
                }
            }
        }

        const interviewData = {
            id: actualId,
            company,
            role: role || (existingData ? existingData.role : ''),
            phase,
            interviewerName,
            interviewerTitle,
            date: existingData ? existingData.date : new Date().toISOString(),
            transcript,
            gradingStatus: (existingData && !transcriptChanged) ? existingData.gradingStatus : 'pending',
            grade: (existingData && !transcriptChanged) ? existingData.grade : null,
            reasoning: (existingData && !transcriptChanged) ? existingData.reasoning : null,
            examples: (existingData && !transcriptChanged) ? existingData.examples : []
        };

        const filePath = path.join(companyDir, `${actualId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(interviewData, null, 2));

        if (transcriptChanged && transcript.length > 0) {
            // Clean transcript before grading so the stored record and evaluation use the same text.
            processTranscriptCleanupInBackground(companyDir, actualId, interviewData).then((cleanedTranscript) => {
                const nextInterviewData = cleanedTranscript && cleanedTranscript.length
                    ? { ...interviewData, transcript: cleanedTranscript }
                    : interviewData;

                if (cleanedTranscript && cleanedTranscript.length) {
                    fs.writeFileSync(filePath, JSON.stringify(nextInterviewData, null, 2));
                }

                processGradingInBackground(companyDir, actualId, nextInterviewData).catch(e => {
                    console.error("Background grading failed", e);
                });
            }).catch(e => {
                console.error("Transcript cleanup failed", e);
                processGradingInBackground(companyDir, actualId, interviewData).catch(err => {
                    console.error("Background grading failed", err);
                });
            });
        } else {
            // Transcript didn't change, so no need to regrade the specific interview.
            // But we must recalculate confidence scores if company/phase changed.
            recomputeConfidenceScore(companyDir, company, role).catch(e => console.error("Confidence recompute failed", e));
            
            // If it moved companies, recompute the old company too
            if (originalCompany && sanitizeFilename(originalCompany) !== sanitizeFilename(company) && originalCompanyDir) {
                // Determine original role if we can
                let oldRole = '';
                const oldMetaPath = path.join(originalCompanyDir, 'meta.json');
                if (fs.existsSync(oldMetaPath)) {
                    try {
                        const oldMeta = JSON.parse(fs.readFileSync(oldMetaPath, 'utf8'));
                        oldRole = oldMeta.role || '';
                    } catch(e) {}
                }
                recomputeConfidenceScore(originalCompanyDir, originalCompany, oldRole).catch(e => console.error(e));
            }
        }

        return actualId;
    }

    function getInterviews(company) {
        const companyDir = path.join(interviewsDir, sanitizeFilename(company));
        if (!fs.existsSync(companyDir)) return [];
        
        const files = fs.readdirSync(companyDir).filter(f => f.endsWith('.json') && f !== 'meta.json');
        return files.map(file => {
            const data = JSON.parse(fs.readFileSync(path.join(companyDir, file), 'utf8'));
            return data;
        }).sort((a, b) => b.id.localeCompare(a.id));
    }

    async function recomputeConfidenceScore(companyDir, companyName, role) {
        if (onStatus) onStatus({ state: 'processing', message: `Computing confidence score for ${companyName}...` });

        const allInterviews = getInterviews(companyName);
        if (allInterviews.length === 0) {
            // No interviews left
            const metaPath = path.join(companyDir, 'meta.json');
            if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                meta.confidence_score = 0;
                meta.trend = 'neutral';
                fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
            }
            if (onStatus) onStatus({ state: 'success', message: `Evaluation complete for ${companyName}!` });
            return;
        }

        let combinedTranscripts = allInterviews.map((inv, idx) => `\n--- Interview ${idx + 1} (${inv.phase}) ---\n` + inv.transcript.map(t => `${t.speaker}: ${t.text}`).join('\n')).join('\n');

        const roleStr = role ? `\nRole/Job Title: ${role}` : '';
        const jd = getCompanyJobDescription(companyName);
        const jdStr = jd ? `\nJob Description Context:\n${jd}` : '';

        const confPrompt = `You are a strict, objective hiring manager evaluating a candidate across all their interviews for a company.
        Company: ${companyName}${roleStr}${jdStr}
        
        Review the transcripts of all their interviews so far.
        Determine the likelihood of them receiving an offer or moving to the next round, as a percentage from 0 to 100.
        Use a harsh rubric:
        - 0 to 20: clearly weak, wrong, evasive, or little evidence of fit.
        - 21 to 40: mixed or mostly weak evidence.
        - 41 to 60: acceptable but not convincing.
        - 61 to 75: solid but with real gaps.
        - 76 to 100: only for consistently strong evidence across the transcript.
        If the candidate gives an obviously wrong answer to the key question, stay at 20 or below.
        CRITICAL: Be extremely precise and granular with your percentage. Do NOT default to round numbers or multiples of 5 (e.g. avoid exactly 80, 85, 90). Instead, give highly specific numbers based on a detailed analysis of their performance (e.g., 82, 87, 91, 74). Be highly realistic and critical.
        Determine if their trend is "up", "down", or "neutral" compared to previous rounds (if only one round, default to neutral).
        
        Transcripts:
        ${combinedTranscripts}`;

        const confText = await generateChat({
            provider,
            apiKey,
            model,
            temperature: 0.2,
            maxTokens: 300,
            axiosClient,
            localUrl,
            jsonSchema: {
                name: 'confidence',
                schema: {
                    type: 'object',
                    properties: {
                        confidence_score: { type: 'integer' },
                        trend: { type: 'string', enum: ['up', 'down', 'neutral'] }
                    },
                    required: ['confidence_score', 'trend'],
                    additionalProperties: false
                }
            },
            messages: [{ role: 'user', content: confPrompt }]
        });

        let confData = { confidence_score: 0, trend: 'neutral' };
        try {
            // Some models return markdown fences around JSON even when instructed not to
            let cleanedText = confText.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json/g, '').replace(/```$/g, '').trim();
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```/g, '').replace(/```$/g, '').trim();
            }
            confData = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse confidence score JSON:", confText);
            // Default to neutral if AI fails to format properly
        }

        const metaPath = path.join(companyDir, 'meta.json');
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        meta.confidence_score = confData.confidence_score;
        meta.trend = confData.trend;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        if (onStatus) onStatus({ state: 'success', message: `Evaluation complete for ${companyName}!` });
    }

    async function processGradingInBackground(companyDir, id, interviewData) {
        if (onStatus) onStatus({ state: 'processing', message: `Grading interview for ${interviewData.company}...` });

        try {
            // 1. Grade the specific interview
            const transcriptText = transcriptToText(interviewData.transcript);
            
            const roleStr = interviewData.role ? `\nRole/Job Title: ${interviewData.role}` : '';
            const jd = getCompanyJobDescription(interviewData.company);
            const jdStr = jd ? `\nJob Description Context:\n${jd}` : '';
            
            const prompt = `You are an expert technical recruiter and hiring manager. Evaluate the candidate ("You") based on the interview transcript.
            Company: ${interviewData.company}${roleStr}${jdStr}
            
            Give a highly precise grade (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F) based on clarity, technical accuracy, conciseness, and professionalism. Be strict and exact.
            Write a detailed evaluation in exactly 4 short professional sections using markdown headers: **Overall assessment:**, **Evidence:**, **Risks:**, and **Outlook:**.
            Use concrete details from the transcript. Do not write a generic one-paragraph summary. Finish every sentence. Keep examples separate from the written evaluation.
            Address the user directly as "you". Do not call the user "the candidate" or use third-person pronouns like he, she, his, or her for the user.
            
            Transcript:
            ${transcriptText}`;

            const resultText = await generateChat({
                provider,
                apiKey,
                model,
                temperature: 0.2,
                maxTokens: 800,
                axiosClient,
                localUrl,
                jsonSchema: {
                    name: 'grading',
                    schema: {
                        type: 'object',
                        properties: {
                            grade: { type: 'string', enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'] },
                            reasoning: { type: 'string', description: 'The detailed evaluation formatted in exactly 4 sections with markdown headers: **Overall assessment:**, **Evidence:**, **Risks:**, **Outlook:**' },
                            examples: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['grade', 'reasoning', 'examples'],
                        additionalProperties: false
                    }
                },
                messages: [{ role: 'user', content: prompt }]
            });

            let gradeData = { grade: 'C', reasoning: 'Failed to generate proper evaluation.', examples: [] };
            try {
                let cleanedText = resultText.trim();
                if (cleanedText.startsWith('```json')) {
                    cleanedText = cleanedText.replace(/^```json/g, '').replace(/```$/g, '').trim();
                } else if (cleanedText.startsWith('```')) {
                    cleanedText = cleanedText.replace(/^```/g, '').replace(/```$/g, '').trim();
                }
                gradeData = JSON.parse(cleanedText);
            } catch (e) {
                console.error("Failed to parse grading score JSON:", resultText);
            }

            interviewData.gradingStatus = 'complete';
            interviewData.grade = gradeData.grade;
            interviewData.reasoning = directAddressFeedback(gradeData.reasoning);
            interviewData.examples = Array.isArray(gradeData.examples) ? gradeData.examples.map(directAddressFeedback).filter(Boolean) : [];

            fs.writeFileSync(path.join(companyDir, `${id}.json`), JSON.stringify(interviewData, null, 2));

            // 2. Compute overall confidence score
            await recomputeConfidenceScore(companyDir, interviewData.company, interviewData.role);

        } catch (error) {
            console.error("Grading processing error:", error);
            interviewData.gradingStatus = 'failed';
            fs.writeFileSync(path.join(companyDir, `${id}.json`), JSON.stringify(interviewData, null, 2));
            if (onStatus) onStatus({ state: 'error', message: `Grading failed for ${interviewData.company}` });
        }
    }

    async function processTranscriptCleanupInBackground(companyDir, id, interviewData) {
        const prompt = buildTranscriptCleanupPrompt(interviewData.transcript);

        const responseText = await generateChat({
            provider,
            apiKey,
            model,
            temperature: 0,
            maxTokens: 8192,
            axiosClient,
            localUrl,
            jsonSchema: {
                name: 'transcript_cleanup',
                schema: {
                    type: 'object',
                    properties: {
                        transcript: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    speaker: { type: 'string' },
                                    text: { type: 'string' }
                                },
                                required: ['speaker', 'text'],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ['transcript'],
                    additionalProperties: false
                }
            },
            messages: [{ role: 'user', content: prompt }]
        });

        const cleanedTranscript = normalizeCleanedTranscriptResponse(responseText, interviewData.transcript);
        if (cleanedTranscript) {
            return cleanedTranscript;
        }

        console.error("Failed to parse cleaned transcript JSON:", responseText);
        return null;
    }

    return {
        getCompanies,
        getRoles,
        deleteCompany,
        renameCompany,
        setCompanyRole,
        getCompanyJobDescription,
        setCompanyJobDescription,
        deleteInterview,
        saveInterview,
        getInterviews
    };
}

module.exports = { createInterviewManager };
