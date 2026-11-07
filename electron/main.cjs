const { app, BrowserWindow, ipcMain, shell, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;

// Thư mục lưu trữ dữ liệu cá nhân trên máy tính (Documents\MindnoteVault)
const VAULT_DIR = path.join(app.getPath('documents'), 'MindnoteVault');
const ATTACHMENTS_DIR = path.join(VAULT_DIR, 'attachments');
const MAPS_FILE = path.join(VAULT_DIR, 'maps.json');
const SETTINGS_FILE = path.join(VAULT_DIR, 'settings.json');

// Đảm bảo các thư mục vault tồn tại trên ổ cứng
function ensureVaultDirectories() {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
}

// Đăng ký custom protocol để app có thể load ảnh local siêu tốc không qua Base64
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mindnote-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function createWindow() {
  ensureVaultDirectories();

  const iconPath = path.join(__dirname, '..', 'public', 'icon-512.png');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#121215',
    title: 'Mindnote - Không Gian Ghi Chú Vô Tận',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Tùy theo môi trường: Nếu chạy dev server thì load localhost, nếu build thì load file dist/index.html
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      // Fallback dev server nếu chưa build dist
      mainWindow.loadURL('http://localhost:5173');
    }
  }

  // Mở các liên kết ngoài bằng trình duyệt mặc định của hệ thống
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handler cho giao thức mindnote-asset://[attachId]
app.whenReady().then(() => {
  protocol.handle('mindnote-asset', (request) => {
    try {
      let fileName = request.url.replace(/^mindnote-asset:\/\//, '');
      fileName = decodeURIComponent(fileName.split('?')[0].split('#')[0]).replace(/^\/+/, '');
      const filePath = path.join(ATTACHMENTS_DIR, fileName);

      if (fs.existsSync(filePath)) {
        return net.fetch(pathToFileURL(filePath).toString());
      }
      return new Response('Asset not found', { status: 404 });
    } catch (err) {
      console.error('[Protocol] Lỗi load mindnote-asset:', err);
      return new Response('Internal error', { status: 500 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// IPC HANDLERS: XỬ LÝ LƯU TRỮ LOCAL SSD/HDD
// ==========================================

// 1. Lấy thông tin thư mục Vault
ipcMain.handle('desktop:get-vault-info', async () => {
  ensureVaultDirectories();
  let mapCount = 0;
  let attachCount = 0;

  if (fs.existsSync(MAPS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
      if (Array.isArray(data)) mapCount = data.length;
    } catch {}
  }

  if (fs.existsSync(ATTACHMENTS_DIR)) {
    attachCount = fs.readdirSync(ATTACHMENTS_DIR).length;
  }

  return {
    vaultPath: VAULT_DIR,
    attachmentsPath: ATTACHMENTS_DIR,
    mapCount,
    attachCount,
  };
});

// 2. Mở thư mục Vault trong File Explorer của Windows
ipcMain.handle('desktop:open-vault-folder', async () => {
  ensureVaultDirectories();
  await shell.openPath(VAULT_DIR);
  return true;
});

// 3. Đọc dữ liệu bản đồ từ file maps.json trên ổ cứng
ipcMain.handle('desktop:load-maps', async () => {
  ensureVaultDirectories();
  if (!fs.existsSync(MAPS_FILE)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(MAPS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.error('[Desktop Storage] Lỗi đọc maps.json:', err);
    return null;
  }
});

// 4. Lưu bản đồ xuống file maps.json trên ổ cứng
ipcMain.handle('desktop:save-maps', async (_event, maps) => {
  ensureVaultDirectories();
  try {
    const tempFile = `${MAPS_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(maps, null, 2), 'utf8');
    fs.renameSync(tempFile, MAPS_FILE);
    return true;
  } catch (err) {
    console.error('[Desktop Storage] Lỗi ghi maps.json:', err);
    return false;
  }
});

// 5. Lưu ảnh đính kèm thành file thực tế trong attachments/ (Triệt tiêu Base64)
ipcMain.handle('desktop:save-attachment', async (_event, { attachId, base64 }) => {
  ensureVaultDirectories();
  try {
    if (!base64 || typeof base64 !== 'string') return null;

    let mimeType = 'image/png';
    let base64Data = base64;

    if (base64.includes(';base64,')) {
      const parts = base64.split(';base64,');
      mimeType = parts[0].replace('data:', '');
      base64Data = parts[1];
    }

    const ext = mimeType.split('/')[1] || 'png';
    const fileName = `${attachId}.${ext}`;
    const filePath = path.join(ATTACHMENTS_DIR, fileName);

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    // Trả về URI định dạng mindnote-asset://fileName để giao diện hiển thị trực tiếp siêu nhẹ
    return `mindnote-asset://${fileName}`;
  } catch (err) {
    console.error('[Desktop Storage] Lỗi lưu ảnh đính kèm:', err);
    return null;
  }
});

// 6. Nhập file backup JSON từ hộp thoại Windows
ipcMain.handle('desktop:import-backup-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn file JSON sao lưu Mindnote',
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    dialog.showErrorBox('Lỗi nhập dữ liệu', `Không thể đọc file: ${err.message}`);
    return null;
  }
});

// 7. Xuất file backup JSON ra hộp thoại Windows
ipcMain.handle('desktop:export-backup-dialog', async (_event, maps) => {
  const defaultName = `mindnote_backup_${new Date().toISOString().slice(0, 10)}.json`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Lưu bản sao lưu Mindnote',
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) {
    return false;
  }

  try {
    fs.writeFileSync(result.filePath, JSON.stringify(maps, null, 2), 'utf8');
    return true;
  } catch (err) {
    dialog.showErrorBox('Lỗi xuất dữ liệu', `Không thể ghi file: ${err.message}`);
    return false;
  }
});

// Window controls
ipcMain.handle('desktop:minimize-window', () => mainWindow?.minimize());
ipcMain.handle('desktop:maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('desktop:close-window', () => mainWindow?.close());
