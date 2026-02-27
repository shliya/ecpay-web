const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const server = express();
const PORT = 3001;
const apiRoute = require('./server/routes/hamster-tools/index');
const cors = require('cors');
const { scheduler } = require('./server/lib/scheduler');

server.use(cors());
server.use(express.json());
server.use('/api/v1', apiRoute);

let mainWindow;
let settingsWindow = null;
let store;

function startServer() {
    return new Promise((resolve, reject) => {
        try {
            expressServer = server.listen(PORT, () => {
                console.log(`Express 伺服器啟動在 port ${PORT}`);
                resolve();
            });
        } catch (error) {
            console.error('啟動伺服器失敗:', error);
            reject(error);
        }
    });
}

async function initialize() {
    const Store = (await import('electron-store')).default;
    store = new Store();
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        icon: path.join(__dirname, 'build/2.png'),
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // 開發時可以打開開發者工具
    mainWindow.webContents.openDevTools();

    // 啟動 Express 伺服器
    require('./index.js');

    // 等待伺服器啟動
    setTimeout(() => {
        mainWindow.loadFile(path.join(__dirname, 'public/login.html'));
    }, 2000);
}

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    settingsWindow.loadFile(path.join(__dirname, './public/settings.html'));

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

// 設定相關的 IPC 處理
ipcMain.on('save-settings', (event, settings) => {
    store.set('settings', settings);
    mainWindow.webContents.send('settings-updated', settings);
    event.reply('settings-saved', true);
});

ipcMain.on('get-settings', event => {
    const settings = store.get('settings');
    event.reply('settings-loaded', settings);
});

ipcMain.on('open-settings', () => {
    try {
        console.log('收到開啟設定視窗請求');
        if (!settingsWindow) {
            console.log('創建新的設定視窗');
            createSettingsWindow();
        } else {
            console.log('聚焦現有設定視窗');
            settingsWindow.focus();
        }
    } catch (error) {
        console.error('開啟設定視窗時發生錯誤:', error);
    }
});

// 新增：處理設定視窗的載入完成事件
ipcMain.on('settings-window-loaded', event => {
    try {
        const settings = store.get('settings');
        event.reply('settings-loaded', settings);
    } catch (error) {
        console.error('載入設定時發生錯誤:', error);
    }
});

// 處理斗內歷史記錄
ipcMain.on('backup-donate-history', async (event, history) => {
    try {
        // 建立備份資料夾
        const userDataPath = app.getPath('userData');
        const backupDir = path.join(userDataPath, 'backups');
        console.log('備份目錄:', userDataPath);
        await fs.mkdir(backupDir, { recursive: true });

        // 建立檔案名稱 (格式: YYYY-MM-DD-HH-mm-ss.json)
        const now = new Date();
        const fileName = `${now.getFullYear()}-${String(
            now.getMonth() + 1
        ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(
            now.getHours()
        ).padStart(
            2,
            '0'
        )}-${String(now.getMinutes()).padStart(2, '0')}-${String(
            now.getSeconds()
        ).padStart(2, '0')}.json`;

        const filePath = path.join(backupDir, fileName);

        // 寫入檔案
        await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf8');

        event.reply('backup-complete', {
            success: true,
            message: `備份成功: ${fileName}`,
            path: filePath,
        });
    } catch (error) {
        console.error('備份失敗:', error);
        event.reply('backup-complete', {
            success: false,
            message: `備份失敗: ${error.message}`,
        });
    }
});

app.whenReady().then(async () => {
    try {
        await initialize();
        await startServer();

        // 啟動定時任務排程器
        scheduler.start();

        createMainWindow();
    } catch (error) {
        console.error('應用程式啟動失敗:', error);
        app.quit();
    }
});

// 關閉時清理
app.on('window-all-closed', () => {
    // 停止定時任務排程器
    scheduler.stop();

    if (expressServer) {
        expressServer.close(() => {
            console.log('Express 伺服器已關閉');
        });
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    // 應用程式即將退出時停止排程器
    scheduler.stop();
});
