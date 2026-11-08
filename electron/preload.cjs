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
  exportSingleMapDialog: (map) => ipcRenderer.invoke('desktop:export-single-map-dialog', map),
  normalizeImportedMap: (map) => ipcRenderer.invoke('desktop:normalize-imported-map', map),
  getGoogleDriveInfo: () => ipcRenderer.invoke('desktop:get-gdrive-info'),
  openGoogleDriveFolder: () => ipcRenderer.invoke('desktop:open-gdrive-folder'),
  exportToGoogleDrive: (data) => ipcRenderer.invoke('desktop:export-to-gdrive', data),
  pickFromGoogleDrive: () => ipcRenderer.invoke('desktop:pick-from-gdrive'),
  listGoogleDriveFiles: () => ipcRenderer.invoke('desktop:list-gdrive-files'),
  loadGoogleDriveFile: (filePath) => ipcRenderer.invoke('desktop:load-gdrive-file', filePath),
  minimizeWindow: () => ipcRenderer.invoke('desktop:minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('desktop:maximize-window'),
  closeWindow: () => ipcRenderer.invoke('desktop:close-window'),
});
