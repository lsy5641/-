const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');

let win = null;

async function boot() {
  const { startServer } = require(path.join(__dirname, '..', 'dist', 'server', 'start.cjs'));
  const dataDir = path.join(app.getPath('userData'), 'data');
  const staticDir = path.join(__dirname, '..', 'dist', 'web');

  const { port } = await startServer({ port: 0, dataDir, staticDir });
  const url = `http://127.0.0.1:${port}`;

  win = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#f8fafc',
    title: 'JobCoach 求职助手',
    autoHideMenuBar: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  win.loadURL(url);
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });

  const menu = Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        { label: '打开数据文件夹', click: () => shell.openPath(dataDir) },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady()
  .then(boot)
  .catch((e) => {
    dialog.showErrorBox('JobCoach 启动失败', String((e && e.stack) || e));
    app.quit();
  });

app.on('window-all-closed', () => app.quit());