const fs = require('fs')
const vdf = require('vdf-parser')
const path = require('path')
const AdmZip = require('adm-zip')
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { addItem } = require("./models/items")

const loadPackage = (pathToPackage) => {
    //Extract package
    const packageName = path.basename(pathToPackage, '.zip')
    const packageDir = path.join(__dirname, "..", "packages", packageName) // Go up one level to root
    fs.mkdirSync(packageDir, { recursive: true })

    const zip = new AdmZip(pathToPackage)
    zip.extractAllTo(packageDir)

    const infoPath = path.join(packageDir, "info.txt")

    const rawInfo = fs.readFileSync(infoPath, 'utf-8')
    const parsedInfo = vdf.parse(rawInfo)

    //Items
    const rawitems = parsedInfo["Item"];
    rawitems.forEach(element => {
        addItem(packageDir, element);
    });
    

}

const loadPackagePopup = () => {
    ipcMain.handle('dialog:loadPackage', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile']
    });

    if (result.canceled) return null;
    
    //Load the package
    loadPackage(result.filePaths[0])
    });
}

module.exports = { loadPackagePopup }