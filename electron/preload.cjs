const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mindnoteDesktop', {
  isDesktop: true,
  getVaultInfo: () => ipcRenderer.invoke('desktop:get-vault-info'),
  openVaultFolder: () => ipcRenderer.invoke('desktop:open-vault-folder'),
  loadMaps: () => ipcRenderer.invoke('desktop:load-maps'),
  saveMaps: (maps) => ipcRenderer.invoke('desktop:save-maps', maps),
  saveAttachment: (attachId, base64) => ipcRenderer.invoke('desktop:save-attachment', { attachId, base64 }),
  importBackupDialog: () => ipcRenderer.invoke('desktop:import-backup-dialog'),
  exportBackupDialog: (maps) => ipcRenderer.invoke('desktop:export-backup-dialog', maps),
  minimizeWindow: () => ipcRenderer.invoke('desktop:minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('desktop:maximize-window'),
  closeWindow: () => ipcRenderer.invoke('desktop:close-window'),
});
