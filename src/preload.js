// Preload script for Electron context bridge

const { ipcRenderer, contextBridge } = require('electron');

// Expose necessary methods to the renderer process (the web page)
contextBridge.exposeInMainWorld('electronAPI', {
    startTranscription: () => ipcRenderer.send('start-audio-capture'),
    stopTranscription: () => ipcRenderer.send('stop-audio-capture'),
    onTranscriptUpdate: (callback) => ipcRenderer.on('transcript-update', callback)
});