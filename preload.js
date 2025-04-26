const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // 設定相關方法
  openSettings: () => {
    console.log("Preload: 發送開啟設定訊號");
    ipcRenderer.send("open-settings");
  },

  getSettings: () => ipcRenderer.send("get-settings"),
  saveSettings: (settings) => ipcRenderer.send("save-settings", settings),
  onSettingsLoaded: (callback) => {
    ipcRenderer.on("settings-loaded", (event, ...args) => callback(...args));
  },
  onSettingsSaved: (callback) => {
    ipcRenderer.on("settings-saved", (event, ...args) => callback(...args));
  },
  onSettingsUpdated: (callback) => {
    ipcRenderer.on("settings-updated", (event, ...args) => callback(...args));
  },

  backupDonateHistory: (history) =>
    ipcRenderer.send("backup-donate-history", history),
  onBackupComplete: (callback) => {
    ipcRenderer.on("backup-complete", (_event, result) => callback(result));
  },
});
