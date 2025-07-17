const { app, BrowserWindow } = require('electron');
const path = require('path');
const { loadPackagePopup } = require('./loadPackage.js')

const createWindow = () => {
    const win = new BrowserWindow({
        title: "BeePEE",
        width: 1024,
        height: 512,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.setMenuBarVisibility(false);

    const isDev = !app.isPackaged;
    
    if (isDev) {
        win.loadURL('http://localhost:5173');
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

//register stuff
loadPackagePopup();

app.whenReady().then(createWindow)