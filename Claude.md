# BeePEE Project - Development Notes

## Project Overview
BeePEE is an Electron-based application for creating and editing Portal 2 Puzzle Editor items. It manages item packages, instances, conditions, and various item properties.

## Recent Development Work

### Welcome Screen & Package Creation
- **Implemented**: Welcome screen that shows when no package is loaded
- **Features**:
  - Three main actions: New Package, Open Package, Import Package
  - Compact, modern card-based UI
  - Package creation in separate window
  - Package ID format: `PACKAGENAME_UUID` (4 characters)
  - Required fields: Package Name, Description
  - Automatic transition to ItemBrowser after package load
  - State management tracks whether a package is loaded
  - Creates proper package structure with `info.json`

### Item Creation System
- **Implemented**: Full item creation workflow with separate window
- **Features**:
  - Generates unique item IDs using format: `bpee_{itemName}_{author}_{UUID}`
  - UUID is 4 characters long (e.g., `bpee_test_areng_A3F9`)
  - Collision detection ensures unique IDs
  - Required fields: Name, Description, Icon, Instances (at least one)
  - Creates necessary file structure:
    - `items/{itemName}_{author}/editoritems.json`
    - `items/{itemName}_{author}/properties.json`
    - `resources/BEE2/items/{packageId}/{itemName}.png` (icon)
    - `resources/instances/bpee/{itemId}/instance.vmf` (and instance_1.vmf, instance_2.vmf, etc. for multiple instances)
    - Instance paths in editoritems: `instances/BEE2/bpee/{itemId}/instance.vmf`
  - Updates package `info.json` with new item entry
  - Window automatically closes on successful creation

### Item Deletion System
- **Implemented**: Comprehensive item deletion with confirmation
- **Features**:
  - Delete button in item editor footer
  - Confirmation dialog with warning about permanent deletion
  - Shows what will be deleted (configuration, instances, conditions, etc.)
  - Cleans up all associated files:
    - Item folder (`items/{itemName}_{author}/`)
    - Instance files in `resources/instances/bpee/{itemId}/`
    - Icon file in `resources/BEE2/items/`
    - Entry in package `info.json`
  - Updates in-memory package data
  - Refreshes UI automatically

### VBSP Conditions - Random Array Support
- **Implemented**: Support for "random" arrays in VBSP conditions
- **Features**:
  - Parses random selection structures from condition results
  - Visual block editor with "Random Selection" block type
  - Displays options as numbered list in the UI
  - Validates random selection blocks
  - Uses `Hive` icon for visual representation

## Key Technical Architecture

### Electron IPC Communication
**Main Process** (`backend/events.js`):
- `open-create-item-window` - Opens item creation window
- `create-item` - Handles item creation (file system operations)
- `delete-item` - Handles item deletion (file system cleanup)
- `open-item-editor` - Opens item editor window
- `show-open-dialog` - Exposes file picker dialog

**Preload Script** (`backend/preload.js`):
- Exposes secure APIs to renderer via `contextBridge`
- `window.electron.invoke` - Generic IPC invoker
- `window.electron.showOpenDialog` - File picker
- `window.package.*` - Package-specific APIs
- **Event Listeners**: Uses `ipcRenderer.removeAllListeners()` before adding new listeners to prevent stacking

**Renderer Process** (React components):
- Uses `window.electron.invoke()` for backend communication
- Listens for events via `window.package.on*` methods

### React State Management

#### ItemBrowser Component
**Critical Fix**: Item click handling uses item ID instead of full object to prevent stale closure issues:
```javascript
// Pass only the ID
<ItemIcon item={item} onEdit={() => handleEditItem(item.id)} />

// Always look up current item from latest state
const handleEditItem = (itemId) => {
    const currentItem = items.find(i => i.id === itemId)
    if (!currentItem) {
        console.warn("Item no longer exists, skipping editor open:", itemId)
        return
    }
    window.package.openItemEditor(currentItem)
}
```

**Why this matters**: 
- React's `map()` creates closures that capture item objects
- Even after state updates, old DOM elements retain old item references
- Passing primitive IDs ensures we always look up fresh data from current state
- Prevents "Item not found" errors when clicking deleted items

#### Event Listener Management
**Critical Fix**: Prevent listener stacking in `backend/preload.js`:
```javascript
onPackageLoaded: (callback) => {
    ipcRenderer.removeAllListeners("package:loaded") // Remove old listeners
    ipcRenderer.on("package:loaded", (event, items) => callback(items))
}
```

**Why this matters**:
- Multiple listeners would stack up on hot reload or component remount
- Caused duplicate UI updates and inconsistent state
- `removeAllListeners` ensures only one active listener at a time

## File Structure

### Backend Files
- `backend/events.js` - IPC handlers for all application features
- `backend/items/itemEditor.js` - Window management for editor and creation
- `backend/models/items.js` - Item class and data management
- `backend/models/package.js` - Package class managing item collections
- `backend/packageManager.js` - Package loading and conversion (VDF/JSON)
- `backend/saveItem.js` - File system operations for saving items
- `backend/preload.js` - Secure API exposure to renderer

### Frontend Files
- `src/App.jsx` - Main app with routing (supports query-based routes for production)
- `src/components/ItemBrowser.jsx` - Grid view of all items
- `src/components/ItemEditor.jsx` - Main editor with tabs and delete functionality
- `src/components/AddItem.jsx` - Button to open creation window
- `src/pages/CreateItemPage.jsx` - Separate window for item creation
- `src/components/items/` - Individual editor tabs (Info, Instances, Conditions, etc.)

## Known Issues & Solutions

### Issue 1: Items not showing in-game after creation
**Problem**: Instance paths in `editoritems.json` were absolute file system paths instead of relative.

**Solution**: Modified `create-item` handler to use relative paths:
```javascript
const instanceFileName = index === 0 ? 'instance.vmf' : `instance_${index}.vmf`
editoritems.Item.Exporting.Instances[index.toString()] = {
    Name: `instances/BEE2/bpee/${itemId}/${instanceFileName}`, // Relative path with BEE2 prefix
    EntityCount: 0,
    BrushCount: 0,
    BrushSideCount: 0
}
```

### Issue 2: UI not updating after item creation/deletion
**Problem**: Multiple event listeners stacking up, causing inconsistent state updates.

**Solution**: Added `removeAllListeners()` before registering listeners in preload script.

### Issue 3: "Item not found" errors when clicking deleted items
**Problem**: React closures capturing stale item objects.

**Solution**: Changed to pass item IDs and look up fresh data from current state.

### Issue 4: BEE2 "Unknown instance option error" when parsing editoritems
**Problem**: When VMF files don't exist, `vmfParser.js` added an `"error": "File not found"` property to instance stats, which got saved to editoritems.json. BEE2's parser doesn't recognize "error" as a valid instance property.

**Solution**: Modified `backend/models/items.js` to explicitly extract only valid properties (EntityCount, BrushCount, BrushSideCount) instead of using spread operator that includes error property:
```javascript
editoritems.Item.Exporting.Instances[nextIndex.toString()] = {
    Name: instanceName,
    EntityCount: vmfStats.EntityCount || 0,
    BrushCount: vmfStats.BrushCount || 0,
    BrushSideCount: vmfStats.BrushSideCount || 0,
}
```

## Item Creation Flow

1. User clicks "+" button in ItemBrowser
2. `AddItem.jsx` invokes `open-create-item-window`
3. New BrowserWindow opens with `CreateItemPage.jsx`
4. User fills form: name, description, author, selects icon and instance files
5. Click "Create" → invokes `create-item` IPC
6. Backend (`backend/events.js`):
   - Validates input
   - Generates unique ID with collision check
   - Creates folder structure
   - Copies icon and instance files
   - Creates `editoritems.json` and `properties.json`
   - Updates package `info.json`
   - Creates new Item instance
   - Sends `package-loaded` event to refresh UI
   - Closes creation window
7. ItemBrowser receives update and re-renders with new item

## Item Deletion Flow

1. User opens item in editor
2. Clicks "Delete" button in footer
3. Confirmation dialog appears with warnings
4. User confirms → invokes `delete-item` IPC with itemId
5. Backend (`backend/events.js`):
   - Finds item in package
   - Deletes item folder recursively
   - Deletes all instance files
   - Deletes icon file
   - Updates package `info.json` (removes item entry)
   - Removes from in-memory package items array
   - Sends `package-loaded` event to refresh UI
6. ItemBrowser receives update and re-renders without deleted item
7. Editor window closes automatically

## Development Best Practices

1. **Always use `removeAllListeners`** before registering IPC event listeners
2. **Pass primitive values** (IDs) in React callbacks, not full objects
3. **Look up fresh state** inside event handlers, don't rely on closures
4. **Use relative paths** for game resources (instances, icons)
5. **Validate input** on both frontend and backend
6. **Clean up resources** completely when deleting items
7. **Update UI** by sending events, not relying on component state alone
8. **Handle errors gracefully** with console warnings and user feedback

## Routing System

### Development
Uses normal React Router with `BrowserRouter`.

### Production
Uses query parameters to determine which window to render:
- `?route=editor` → Item Editor
- `?route=create-item` → Create Item Window
- No query → Main ItemBrowser

Example:
```javascript
const urlParams = new URLSearchParams(window.location.search)
const routeParam = urlParams.get('route')
const showEditor = routeParam === 'editor'
const showCreateItem = routeParam === 'create-item'
```

## Future Considerations

- Consider adding undo functionality for item deletion
- Add item duplication feature
- Implement item search/filter in browser
- Add batch operations (delete multiple items)
- Export/import individual items between packages
- Validation for instance file compatibility

---

## Custom Model Conversion System

### Overview
Automatically converts VMF instances → OBJ files → Source Engine MDL files, and integrates them into the package's editoritems.json.

### What Happens When You Click "Make Model"

1. **VMF → OBJ Conversion** (existing functionality)
   - Converts the VMF instance file to OBJ format
   - Extracts textures and applies optional cartoonish styling
   - Outputs to: `{package}/temp_models/{instance}.obj`

2. **OBJ → MDL Conversion** (NEW!)
   - Generates a QC (QuakeC) file that describes the model compilation
   - Uses STUDIOMDL from the Source SDK to compile the OBJ into MDL
   - Compiles to Portal 2 directory (STUDIOMDL requirement)
   - Creates multiple files: `.mdl`, `.vvd`, `.vtx` (various formats: plain, dx90, dx80, sw)
   - **Copies ALL files** to: `{package}/resources/models/props_map_editor/bpee/item/`
   - **Cleans up Portal 2 directory** - deletes compiled files and empty folders

3. **editoritems.json Update** (NEW!)
   - Automatically updates the item's editoritems.json
   - Adds/updates the Model section:
     ```json
     "Model": {
         "ModelName": "bpee/item/bpee_myitem_areng_a3f9.mdl"
     }
     ```
   - Uses the item ID as the model filename to ensure each item has a unique model

### Files Created

**New Utility: `backend/utils/mdlConverter.js`**
- `getStudioMDLPath()` - Locates STUDIOMDL executable
- `generateQCFile()` - Creates QC compilation script
- `convertObjToMDL()` - Runs STUDIOMDL compilation
- `copyMDLToPackage()` - Copies compiled files to package and cleans up Portal 2 directory
- `convertAndInstallMDL()` - Main orchestration function

**Updated Files:**
- `backend/events.js` - Enhanced `convert-instance-to-obj` handler with MDL conversion
- `src/components/items/Info.jsx` - Added user feedback for MDL conversion
- `package.json` - Added extraResources configuration for STUDIOMDL

### QC File Structure

```qc
$modelname "props_map_editor/bpee/item/bpee_myitem_areng_a3f9.mdl"
$staticprop
$body body "instance.obj"
$surfaceprop "default"
$cdmaterials "models/props_map_editor/"
$scale 1.0
$sequence idle "instance.obj" fps 30
```

The model name uses the item ID (sanitized for filenames) to ensure uniqueness.

**Path structure:** `props_map_editor/bpee/item/` - Simple and clean!

### Directory Structure

**During Compilation (temporary):**
```
C:\...\Portal 2\portal2\models\props_map_editor\bpee\item\
├── bpee_myitem_areng_a3f9.mdl        (compiled here by STUDIOMDL)
├── bpee_myitem_areng_a3f9.vvd        
├── bpee_myitem_areng_a3f9.vtx        (can be .vtx, .dx90.vtx, .dx80.vtx, .sw.vtx)
```

**After Copy & Cleanup (Portal 2 files deleted):**
```
{package}/
├── temp_models/                    (temporary build files)
│   ├── instance.obj
│   ├── instance.mtl
│   ├── instance.qc
│   └── materials/                  (extracted textures)
└── resources/
    └── models/
        └── props_map_editor/
            └── bpee/
                └── item/
                    ├── bpee_myitem_areng_a3f9.mdl  (Source model - COPIED)
                    ├── bpee_myitem_areng_a3f9.vvd  (Vertex data - COPIED)
                    └── bpee_myitem_areng_a3f9.vtx  (Vertex indices - COPIED, any format)
```

**Note:** Each item gets its own uniquely named model based on the item ID to prevent conflicts!

**⚠️ All files are needed!** Source Engine requires all file types (.mdl, .vvd, .vtx) to load the model correctly.

### Requirements

1. **STUDIOMDL** - Located in `backend/libs/studiomdl/studiomdl.exe`
2. **Portal 2 Installation** - Required for STUDIOMDL's `-game` parameter (points to `gameinfo.txt`)
3. **Valid OBJ File** - Must be generated from VMF first

### User Experience

**Success Messages:**
- ✅ Full Success: "Model generated successfully! OBJ: ... MDL: ... The editoritems.json has been updated."
- ⚠️ Partial Success: "OBJ created but MDL conversion failed" (OBJ preview still works)
- ❌ Failure: Specific error message with details

### Error Handling

Graceful degradation:
- If MDL conversion fails, OBJ file is still available for preview
- Error messages include specific failure reasons
- editoritems.json is only updated if MDL conversion succeeds
- Portal 2 directory cleanup continues even if individual file deletion fails

### Compilation Flow

1. **Compile**: STUDIOMDL must output to `{Portal 2}/portal2/models/props_map_editor/bpee/item/` (hardcoded by Source SDK)
2. **Copy**: All `.mdl`, `.vvd`, and any `.vtx` files copied to package `resources/models/props_map_editor/bpee/item/`
3. **Cleanup**: Delete all compiled files from Portal 2 directory
4. **Cleanup Directories**: Remove empty `item/` and `bpee/` folders if empty
5. **Update**: Add Model section to editoritems.json with path `bpee/item/{itemId}.mdl`

### Why Portal 2 Directory is Used

- STUDIOMDL's `-game` parameter requires the folder containing `gameinfo.txt`
- The tool **always** outputs relative to `{-game}/models/{$modelname}`
- There's no way to specify a custom output directory
- We copy the files out and clean up immediately after compilation

### Export Behavior

When exporting packages:
- `temp_models/` directory is **automatically excluded** from exports
- This folder only contains temporary build files (QC, OBJ, MTL, extracted textures)
- Final MDL files are already in `resources/models/` and will be included

