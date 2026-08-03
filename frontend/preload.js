const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runSpiderTester: (payload) => ipcRenderer.invoke('run-spidertester', payload),
});
