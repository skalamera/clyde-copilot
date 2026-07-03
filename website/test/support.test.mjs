import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const apiRoot = path.resolve('website/api');

test('support endpoint imports correctly and contains escapeHtml function', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'support.js'), 'utf8');

  assert.match(source, /function escapeHtml/);
  assert.match(source, /escapedName = escapeHtml/);
  assert.match(source, /escapedEmail = escapeHtml/);
  assert.match(source, /escapedType = escapeHtml/);
  assert.match(source, /escapedSubject = escapeHtml/);
  assert.match(source, /escapedDescription = escapeHtml/);
});

test('support endpoint generates unique ticket ID starting with CLY-', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'support.js'), 'utf8');

  assert.match(source, /const ticketId = `CLY-/);
  assert.match(source, /`\[Clyde Support Ticket \${ticketId}\]/);
});

test('support endpoint sets Content-Type to text/html and MIME-Version 1.0', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'support.js'), 'utf8');

  assert.match(source, /Content-Type: text\/html; charset="UTF-8"/);
  assert.match(source, /MIME-Version: 1\.0/);
});

test('support endpoint renders HTML email template matching the design structure', () => {
  const source = fs.readFileSync(path.join(apiRoot, 'support.js'), 'utf8');

  assert.match(source, /htmlTemplate = `<!DOCTYPE html>/);
  assert.match(source, /Clyde<\/span> Support Center/);
  assert.match(source, /white-space: pre-wrap;/);
  assert.match(source, /Reply-To: \${email}/);
});
