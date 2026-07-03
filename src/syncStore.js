const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STATE = {
  proposals: [],
  audit: [],
  cursors: {}
};

function createSyncStore({ appPath }) {
  if (!appPath) {
    throw new Error('appPath is required.');
  }

  const dir = path.join(appPath, 'Sync');
  const storePath = path.join(dir, 'google-sync.json');
  fs.mkdirSync(dir, { recursive: true });

  function listProposals(filters = {}) {
    const state = readState();
    const status = clean(filters.status || 'pending');
    return state.proposals
      .filter((proposal) => !status || proposal.status === status)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function upsertProposal(proposal = {}) {
    const state = readState();
    const now = new Date().toISOString();
    const dedupeKey = clean(proposal.dedupeKey || proposal.id);
    if (!dedupeKey) {
      throw new Error('Proposal dedupeKey is required.');
    }

    const existing = state.proposals.find((item) => item.dedupeKey === dedupeKey);
    const next = {
      ...(existing || {}),
      ...proposal,
      id: clean(proposal.id) || existing?.id || `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      dedupeKey,
      status: clean(existing?.status || proposal.status || 'pending'),
      createdAt: existing?.createdAt || clean(proposal.createdAt) || now,
      updatedAt: now
    };

    state.proposals = existing
      ? state.proposals.map((item) => item.dedupeKey === dedupeKey ? next : item)
      : [next, ...state.proposals];
    writeState(state);
    return next;
  }

  function getProposal(id) {
    const proposalId = clean(id);
    return readState().proposals.find((proposal) => proposal.id === proposalId) || null;
  }

  function markProposal(id, status, result = {}) {
    const proposalId = clean(id);
    const state = readState();
    const now = new Date().toISOString();
    let updated = null;
    state.proposals = state.proposals.map((proposal) => {
      if (proposal.id !== proposalId) {
        return proposal;
      }
      updated = {
        ...proposal,
        status: clean(status) || proposal.status,
        result,
        appliedAt: status === 'approved' ? now : proposal.appliedAt,
        dismissedAt: status === 'dismissed' ? now : proposal.dismissedAt,
        updatedAt: now
      };
      return updated;
    });
    writeState(state);
    return updated;
  }

  function dismissPendingProposals(predicate, result = {}) {
    if (typeof predicate !== 'function') {
      return [];
    }
    const state = readState();
    const now = new Date().toISOString();
    const dismissed = [];
    state.proposals = state.proposals.map((proposal) => {
      if (proposal.status !== 'pending' || !predicate(proposal)) {
        return proposal;
      }
      const next = {
        ...proposal,
        status: 'dismissed',
        result,
        dismissedAt: now,
        updatedAt: now
      };
      dismissed.push(next);
      return next;
    });
    if (dismissed.length) {
      writeState(state);
    }
    return dismissed;
  }

  function addAudit(entry = {}) {
    const state = readState();
    const now = new Date().toISOString();
    const row = {
      id: clean(entry.id) || `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: clean(entry.type || entry.actionType || 'sync'),
      message: clean(entry.message || entry.summary),
      proposalId: clean(entry.proposalId),
      status: clean(entry.status || 'info'),
      source: entry.source || null,
      action: entry.action || null,
      result: entry.result || null,
      createdAt: clean(entry.createdAt) || now,
      autoApproved: Boolean(entry.autoApproved),
      read: entry.read !== undefined ? Boolean(entry.read) : true
    };
    state.audit = [row, ...state.audit].slice(0, 500);
    writeState(state);
    return row;
  }

  function markAuditRead(ids = []) {
    const state = readState();
    state.audit = state.audit.map(entry => {
       if (ids.includes(entry.id) || ids.length === 0) {
           return { ...entry, read: true };
       }
       return entry;
    });
    writeState(state);
    return true;
  }

  function listAudit(limit = 100) {
    const count = Math.max(1, Math.min(500, Number(limit) || 100));
    return readState().audit.slice(0, count);
  }

  function clearState() {
    writeState(DEFAULT_STATE);
    return true;
  }

  function getCursors() {
    return { ...readState().cursors };
  }

  function setCursor(key, value) {
    const state = readState();
    state.cursors = {
      ...(state.cursors || {}),
      [clean(key)]: clean(value)
    };
    writeState(state);
    return state.cursors;
  }

  function readState() {
    try {
      if (!fs.existsSync(storePath)) {
        return { ...DEFAULT_STATE };
      }
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      return {
        proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
        audit: Array.isArray(parsed.audit) ? parsed.audit : [],
        cursors: parsed.cursors && typeof parsed.cursors === 'object' ? parsed.cursors : {}
      };
    } catch (_error) {
      return { ...DEFAULT_STATE };
    }
  }

  function writeState(state) {
    fs.writeFileSync(storePath, JSON.stringify({ ...DEFAULT_STATE, ...state }, null, 2), 'utf8');
  }

  return {
    addAudit,
    clearState,
    dismissPendingProposals,
    getCursors,
    getProposal,
    listAudit,
    listProposals,
    markProposal,
    markAuditRead,
    setCursor,
    storePath,
    upsertProposal
  };
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  createSyncStore
};
