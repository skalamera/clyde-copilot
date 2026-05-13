// Preload script for Electron context bridge

const { ipcRenderer, contextBridge } = require('electron');

// Expose necessary methods to the renderer process (the web page)
contextBridge.exposeInMainWorld('electronAPI', {
    startTranscription: () => ipcRenderer.send('start-audio-capture'),
    stopTranscription: () => ipcRenderer.send('stop-audio-capture'),
    resetSession: () => ipcRenderer.send('reset-session'),
    startAudioLevelTest: () => ipcRenderer.send('start-audio-level-test'),
    stopAudioLevelTest: () => ipcRenderer.send('stop-audio-level-test'),
    requestSuggestion: () => ipcRenderer.send('request-suggestion'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    getCompanies: () => ipcRenderer.invoke('get-companies'),
    getRoles: () => ipcRenderer.invoke('get-roles'),
    getInterviews: (company) => ipcRenderer.invoke('get-interviews', company),
    deleteCompany: (company) => ipcRenderer.invoke('delete-company', company),
    renameCompany: (oldName, newName) => ipcRenderer.invoke('rename-company', oldName, newName),
    setCompanyRole: (companyName, role) => ipcRenderer.invoke('set-company-role', companyName, role),
    getCompanyJobDescription: (companyName) => ipcRenderer.invoke('get-company-jd', companyName),
    setCompanyJobDescription: (companyName, jd) => ipcRenderer.invoke('set-company-jd', companyName, jd),
    deleteInterview: (company, id) => ipcRenderer.invoke('delete-interview', company, id),
    saveInterview: (metadata) => ipcRenderer.invoke('save-interview', metadata),
    saveManualInterview: (metadata) => ipcRenderer.invoke('save-manual-interview', metadata),
    getSessions: (filters) => ipcRenderer.invoke('get-sessions', filters),
    getSessionEntities: (mode) => ipcRenderer.invoke('get-session-entities', mode),
    saveSession: (sessionRecord) => ipcRenderer.invoke('save-session', sessionRecord),
    deleteSession: (payload) => ipcRenderer.invoke('delete-session', payload),
    deleteSessionEntity: (payload) => ipcRenderer.invoke('delete-session-entity', payload),
    updateSessionEntity: (payload) => ipcRenderer.invoke('update-session-entity', payload),
    setActiveSessionContext: (context) => ipcRenderer.invoke('set-active-session-context', context),
    validateServices: (settings) => ipcRenderer.invoke('validate-services', settings),
    extractJobContext: (jobDescription) => ipcRenderer.invoke('extract-job-context', jobDescription),
    onTranscriptUpdate: (callback) => ipcRenderer.on('transcript-update', callback),
    onAssistantUpdate: (callback) => ipcRenderer.on('assistant-update', callback),
    onHealthUpdate: (callback) => ipcRenderer.on('health-update', callback),
    onAudioLevelUpdate: (callback) => ipcRenderer.on('audio-level-update', callback),
    onSessionReset: (callback) => ipcRenderer.on('session-reset', callback),
    onAudioStatus: (callback) => ipcRenderer.on('audio-status', callback)
});
