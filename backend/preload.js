const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('package', {
    loadpackage: () => ipcRenderer.invoke('dialog:loadPackage')
});