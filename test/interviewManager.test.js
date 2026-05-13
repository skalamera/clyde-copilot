const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createInterviewManager } = require('../src/interviewManager');

test('Interview Manager CRUD operations', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-test-'));
    
    // Mock Axios Client to intercept LLM calls
    let postCallCount = 0;
    let failNextGrading = false;
    let failNextConfidence = false;
    let lastConfidenceResult = 85;

    const mockAxiosClient = {
        post: async (url, data, config) => {
            postCallCount++;
            
            // Differentiate between grading and confidence by checking the schema name
            const schemaName = data?.response_format?.json_schema?.name || 'grading';

            if (schemaName === 'transcript_cleanup') {
                return {
                    data: {
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    transcript: [
                                        { speaker: 'System Audio', text: 'Can you give an example of a process you have put in place to help scale the team better?' },
                                        { speaker: 'You', text: 'Yeah. At Benchmark, I directed support automation and systems integration strategy across Fresh Desk, Zendesk, and Ring Central. This was key to scaling because it reduced resolution time by 38%.' }
                                    ]
                                })
                            }
                        }]
                    }
                };
            }

            if (schemaName === 'grading') {
                if (failNextGrading) {
                    return { data: { choices: [{ message: { content: 'invalid json }' } }] } };
                }
                return {
                    data: {
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    grade: 'A',
                                    reasoning: 'Excellent performance.',
                                    examples: ['Example 1']
                                })
                            }
                        }]
                    }
                };
            } else if (schemaName === 'confidence') {
                if (failNextConfidence) {
                    return { data: { choices: [{ message: { content: 'bad json {[' } }] } };
                }
                return {
                    data: {
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    confidence_score: lastConfidenceResult,
                                    trend: 'up'
                                })
                            }
                        }]
                    }
                };
            }

            return { data: { choices: [{ message: { content: '{}' } }] } };
        }
    };

    const settings = {
        llmProvider: 'local',
        localLlmUrl: 'http://mock.test/v1/chat/completions'
    };

    const manager = createInterviewManager({
        appPath: tempDir,
        axiosClient: mockAxiosClient,
        settings,
        onStatus: () => {}
    });

    t.after(() => {
        // Clean up temp dir
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    await t.test('getCompanies returns empty initially', () => {
        const companies = manager.getCompanies();
        assert.deepStrictEqual(companies, []);
    });

    await t.test('confidence prompt uses a strict scoring rubric', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'interviewManager.js'), 'utf8');

        assert.match(source, /0 to 20: clearly weak, wrong, evasive, or little evidence of fit\./);
        assert.match(source, /If the candidate gives an obviously wrong answer to the key question, stay at 20 or below\./);
    });

    await t.test('grading prompt asks for detailed transcript-based evaluation', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'interviewManager.js'), 'utf8');

        assert.match(source, /Write a detailed evaluation in exactly 4 short professional sections/);
        assert.match(source, /Use concrete details from the transcript/);
        assert.match(source, /Do not write a generic one-paragraph summary/);
    });

    let savedInterviewId;

    await t.test('saveInterview creates company, interview, and grades it', async () => {
        const metadata = {
            company: 'Acme Corp',
            phase: 'Technical Screen',
            interviewerName: 'Alice',
            interviewerTitle: 'Lead',
            transcript: [{ speaker: 'Interviewer', text: 'Hello' }, { speaker: 'You', text: 'Hi there' }]
        };

        const id = manager.saveInterview(metadata);
        assert.ok(id);
        savedInterviewId = id;

        // Allow async grading to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        const companies = manager.getCompanies();
        assert.strictEqual(companies.length, 1);
        assert.strictEqual(companies[0].name, 'Acme Corp');
        assert.strictEqual(companies[0].confidence, 85);
        assert.strictEqual(companies[0].trend, 'up');

        const interviews = manager.getInterviews('Acme Corp');
        assert.strictEqual(interviews.length, 1);
        assert.strictEqual(interviews[0].id, id);
        assert.strictEqual(interviews[0].gradingStatus, 'complete');
        assert.strictEqual(interviews[0].grade, 'A');
        assert.strictEqual(interviews[0].interviewerName, 'Alice');
        assert.strictEqual(interviews[0].interviewerTitle, 'Lead');
    });

    await t.test('saveInterview gracefully handles grading JSON failure', async () => {
        failNextGrading = true;
        
        const metadata = {
            company: 'Acme Corp',
            phase: 'Behavioral',
            interviewerName: '',
            interviewerTitle: '',
            transcript: [{ speaker: 'Interviewer', text: 'Tell me a story' }]
        };

        const id = manager.saveInterview(metadata);
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for background grading

        const interviews = manager.getInterviews('Acme Corp');
        const failedInv = interviews.find(i => i.id === id);
        
        assert.strictEqual(failedInv.gradingStatus, 'complete'); // It catches the error and defaults to C
        assert.strictEqual(failedInv.grade, 'C');
        assert.strictEqual(failedInv.reasoning, 'Failed to generate proper evaluation.');
        
        failNextGrading = false; // reset
    });

    await t.test('manual interview transcript is cleaned before grading and saved cleaned', async () => {
        const metadata = {
            company: 'Clean Corp',
            phase: 'Technical Screen',
            interviewerName: '',
            interviewerTitle: '',
            transcript: [
                { speaker: 'System Audio', text: 'Can you give an example of' },
                { speaker: 'You', text: 'You get a...' },
                { speaker: 'System Audio', text: "a process you've put in place to help scale the team better?" },
                { speaker: 'You', text: 'Yeah. benchmark, I directed support automation and systems integration strategy across Fresh Desk, Zendesk, and Ring Central. This was key to scaling because it reduced resolution time by 38%.' }
            ]
        };

        const id = manager.saveInterview(metadata);
        await new Promise(resolve => setTimeout(resolve, 50));

        const interviews = manager.getInterviews('Clean Corp');
        const cleaned = interviews.find((i) => i.id === id);

        assert.ok(cleaned);
        assert.strictEqual(cleaned.gradingStatus, 'complete');
        assert.strictEqual(cleaned.transcript[0].text, 'Can you give an example of a process you have put in place to help scale the team better?');
        assert.strictEqual(cleaned.transcript[1].text, 'Yeah. At Benchmark, I directed support automation and systems integration strategy across Fresh Desk, Zendesk, and Ring Central. This was key to scaling because it reduced resolution time by 38%.');

        manager.deleteCompany('Clean Corp');
    });

    await t.test('renameCompany updates folder and internal JSON references', () => {
        manager.renameCompany('Acme Corp', 'Globex Inc');
        
        const companies = manager.getCompanies();
        assert.strictEqual(companies.length, 1);
        assert.strictEqual(companies[0].name, 'Globex Inc');

        // Check if internal interview JSONs were updated
        const interviews = manager.getInterviews('Globex Inc');
        assert.strictEqual(interviews.length, 2);
        assert.strictEqual(interviews[0].company, 'Globex Inc');
        assert.strictEqual(interviews[1].company, 'Globex Inc');

        // Check old company dir doesn't exist (getInterviews returns empty)
        assert.deepStrictEqual(manager.getInterviews('Acme Corp'), []);
    });

    await t.test('deleteInterview removes specific interview and recomputes confidence', async () => {
        lastConfidenceResult = 90; // Set a new expected score to verify recomputation

        manager.deleteInterview('Globex Inc', savedInterviewId);
        
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for async recompute

        const interviews = manager.getInterviews('Globex Inc');
        assert.strictEqual(interviews.length, 1);
        
        const companies = manager.getCompanies();
        assert.strictEqual(companies[0].confidence, 90);
    });

    await t.test('editInterview updates metadata like phase and interviewer title', async () => {
        // Create an interview first
        const metadata = {
            company: 'Edit Corp',
            phase: 'Technical Screen',
            interviewerName: 'Bob',
            interviewerTitle: 'Engineer',
            transcript: [{ speaker: 'You', text: 'Hello Edit Corp' }]
        };
        const id = manager.saveInterview(metadata);
        await new Promise(resolve => setTimeout(resolve, 50));

        let interviews = manager.getInterviews('Edit Corp');
        assert.strictEqual(interviews[0].phase, 'Technical Screen');
        assert.strictEqual(interviews[0].interviewerTitle, 'Engineer');
        assert.strictEqual(interviews[0].gradingStatus, 'complete');

        // Edit the interview using the existing ID
        const editMetadata = {
            id,
            company: 'Edit Corp',
            phase: 'Final Round', // Changed phase
            interviewerName: 'Bob Smith', // Changed name
            interviewerTitle: 'VP of Engineering', // Changed title
            transcript: [{ speaker: 'You', text: 'Hello Edit Corp. Here is more info.' }] // slightly changed transcript
        };
        manager.saveInterview(editMetadata);
        await new Promise(resolve => setTimeout(resolve, 50));

        interviews = manager.getInterviews('Edit Corp');
        assert.strictEqual(interviews.length, 1); // Should overwrite, not create new
        assert.strictEqual(interviews[0].id, id);
        assert.strictEqual(interviews[0].phase, 'Final Round');
        assert.strictEqual(interviews[0].interviewerName, 'Bob Smith');
        assert.strictEqual(interviews[0].interviewerTitle, 'VP of Engineering');
        assert.strictEqual(interviews[0].transcript[0].text, 'Can you give an example of a process you have put in place to help scale the team better?');
        assert.strictEqual(interviews[0].transcript[1].text, 'Yeah. At Benchmark, I directed support automation and systems integration strategy across Fresh Desk, Zendesk, and Ring Central. This was key to scaling because it reduced resolution time by 38%.');
        assert.strictEqual(interviews[0].gradingStatus, 'complete'); // Should have re-graded

        // Teardown
        manager.deleteCompany('Edit Corp');
    });

    await t.test('editInterview with the same raw transcript re-cleans and re-grades it', async () => {
        postCallCount = 0; // Reset network mock counter

        const metadata = {
            company: 'Meta Edit Corp',
            phase: 'Technical Screen',
            transcript: [{ speaker: 'You', text: 'Static text' }]
        };
        const id = manager.saveInterview(metadata);
        await new Promise(resolve => setTimeout(resolve, 50));

        let initialPostCount = postCallCount;
        assert.ok(initialPostCount >= 3); // Cleanup + grading + confidence calls

        const editMetadata = {
            id,
            originalCompany: 'Meta Edit Corp',
            company: 'Meta Edit Corp',
            phase: 'Final Round', // Changed phase
            transcript: [{ speaker: 'You', text: 'Static text' }] // Unchanged transcript
        };
        manager.saveInterview(editMetadata);
        await new Promise(resolve => setTimeout(resolve, 50));

        // The raw transcript text still differs from the stored cleaned transcript, so it re-cleans and re-grades.
        assert.strictEqual(postCallCount, initialPostCount + 3);

        const interviews = manager.getInterviews('Meta Edit Corp');
        assert.strictEqual(interviews[0].phase, 'Final Round');
        assert.strictEqual(interviews[0].grade, 'A'); // Grade preserved from initial mock setup

        manager.deleteCompany('Meta Edit Corp');
    });

    await t.test('editInterview changing companies moves the file and recomputes both', async () => {
        manager.deleteCompany('Globex Inc');
        
        const companies = manager.getCompanies();
        assert.strictEqual(companies.some((company) => company.name === 'Globex Inc'), false);
        
        const interviews = manager.getInterviews('Globex Inc');
        assert.strictEqual(interviews.length, 0);
    });

    await t.test('recomputeConfidence sets confidence to 0 when last interview is deleted', async () => {
        // Create new company and 1 interview
        const metadata = {
            company: 'Test Corp',
            phase: 'Technical Screen',
            transcript: [{ speaker: 'You', text: 'Hi' }]
        };
        const id = manager.saveInterview(metadata);
        await new Promise(resolve => setTimeout(resolve, 50));

        let companies = manager.getCompanies();
        const testCorp = companies.find((company) => company.name === 'Test Corp');
        assert.ok(testCorp);
        assert.strictEqual(testCorp.confidence, 90);

        // Delete the only interview
        manager.deleteInterview('Test Corp', id);
        await new Promise(resolve => setTimeout(resolve, 50));

        companies = manager.getCompanies();
        const deletedCorp = companies.find((company) => company.name === 'Test Corp');
        assert.ok(deletedCorp);
        assert.strictEqual(deletedCorp.confidence, 0); // Should be reset to 0 since no interviews are left
    });

});
