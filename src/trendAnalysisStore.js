const fs = require('node:fs');
const path = require('node:path');

function saveTrendAnalysis(appPath, companyId, payload = {}) {
  const filePath = getTrendAnalysisPath(appPath, companyId);
  if (!filePath) {
    return null;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const nextRecord = {
    companyId: String(companyId || ''),
    sessionsCount: Number.isInteger(payload.sessionsCount) ? payload.sessionsCount : null,
    sessionsSignature: String(payload.sessionsSignature || ''),
    updatedAt: new Date().toISOString(),
    analysis: payload.analysis && typeof payload.analysis === 'object' ? payload.analysis : null
  };

  fs.writeFileSync(filePath, JSON.stringify(nextRecord, null, 2), 'utf8');
  return nextRecord;
}

function loadTrendAnalysis(appPath, companyId) {
  const filePath = getTrendAnalysisPath(appPath, companyId);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function deleteTrendAnalysis(appPath, companyId) {
  const filePath = getTrendAnalysisPath(appPath, companyId);
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

function renameTrendAnalysis(appPath, oldCompanyId, newCompanyId) {
  const oldPath = getTrendAnalysisPath(appPath, oldCompanyId);
  const newPath = getTrendAnalysisPath(appPath, newCompanyId);

  if (!oldPath || !newPath || !fs.existsSync(oldPath)) {
    return false;
  }

  fs.mkdirSync(path.dirname(newPath), { recursive: true });
  fs.renameSync(oldPath, newPath);
  return true;
}

function getTrendAnalysisPath(appPath, companyId) {
  if (!appPath || !companyId) {
    return '';
  }

  const dir = path.join(appPath, 'TrendAnalysis');
  const fileName = sanitizeKey(companyId);
  return path.join(dir, `${fileName}.json`);
}

function sanitizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'analysis';
}

module.exports = {
  deleteTrendAnalysis,
  getTrendAnalysisPath,
  loadTrendAnalysis,
  renameTrendAnalysis,
  saveTrendAnalysis
};
