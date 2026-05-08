// Preload script for Electron context bridge

const { ipcRenderer, contextBridge } = require('electron');

// Expose necessary methods to the renderer process (the web page)
contextBridge.exposeInMainWorld('electronAPI', {
    startTranscription: (context) => ipcRenderer.send('start-audio-capture', context),
    stopTranscription: () => ipcRenderer.send('stop-audio-capture'),
    startAudioLevelTest: () => ipcRenderer.send('start-audio-level-test'),
    stopAudioLevelTest: () => ipcRenderer.send('stop-audio-level-test'),
    requestSuggestion: () => ipcRenderer.send('request-suggestion'),
    saveContext: (context) => ipcRenderer.invoke('save-context', context),
    loadContext: () => ipcRenderer.invoke('load-context'),
    onTranscriptUpdate: (callback) => ipcRenderer.on('transcript-update', callback),
    onAssistantUpdate: (callback) => ipcRenderer.on('assistant-update', callback),
    onHealthUpdate: (callback) => ipcRenderer.on('health-update', callback),
    onAudioLevelUpdate: (callback) => ipcRenderer.on('audio-level-update', callback),
    onAudioStatus: (callback) => ipcRenderer.on('audio-status', callback)
});
