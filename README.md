# Guitar Wiring Schematic Visualiser

A local app for placing guitar wiring components on a schematic canvas. Runs inside Cursor's preview tab (Glass browser).

## Features

- **Single Coil pickup** — placeholder image with Hot (H, green) and Ground (G, white) terminals
- **6-Way DPDT switch** — placeholder box with T1–T6 terminals in a 3×2 grid
- **Select & delete** — click a component to select; press Delete or Backspace to remove
- **Drag to move** — drag components around the canvas
- **Terminal snap** — hover over any mini terminal box for 2 seconds to snap the cursor to its center

## Run as app (Cursor preview)

**Quick start** — from the project root:

```bash
npm start
```

Then open **http://127.0.0.1:8765** in Cursor's preview tab, or use **Run → Start Debugging** and pick **Guitar Wiring App**.

**From Cursor tasks:** `Terminal → Run Task → Run Guitar Wiring App` (starts the local server).

Font: Consolas (with monospace fallbacks).

## Windows download

Send your friend **`GuitarWiring-Setup.exe`** — a normal Windows installer (Next → Next → Finish, optional desktop shortcut, uninstall via Settings).

### Build the installer (on Windows)

1. Install [Python 3](https://www.python.org/downloads/) and [Inno Setup 6](https://jrsoftware.org/isdl.php) (free).
2. From the project folder, run:

```bat
build\build-windows.bat
```

3. Share **`dist\GuitarWiring-Setup.exe`**.

Your friend double-clicks the setup file, installs, then launches **Guitar Wiring Visualiser** from the Start menu. The app opens in their browser. To quit, close the browser tab and end **GuitarWiring.exe** in Task Manager if it keeps running.

**GitHub Actions:** push a tag like `v1.0.0` and download **GuitarWiring-Setup.exe** from the workflow artifacts.

### Without installer (portable)

- **`dist\GuitarWiring.exe`** — single file, no install step (PyInstaller build only).
- **`GuitarWiring.bat`** — needs Python 3 on the PC.

Custom assets are saved in the browser on that computer (`localStorage`).

## Controls

| Action | Control |
|--------|---------|
| Place Single Coil | Click **+ Single Coil**, then click canvas |
| Place DPDT | Click **+ 6-Way DPDT**, then click canvas |
| Select | Click component |
| Move | Drag component |
| Delete | Select component, press Delete |
| Cancel placement | Escape |
| Snap to terminal | Hover terminal 2 seconds |
