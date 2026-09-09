# Endo Audio Schematic Editor

Desktop application for placing audio / guitar wiring components on a schematic canvas (Endo ASD).

Runs as a native window on your computer (local UI + embedded webview). Projects stay on this machine (`localStorage`).

## Features

- **Single Coil pickup** — placeholder image with Hot (H, green) and Ground (G, white) terminals
- **6-Way DPDT switch** — placeholder box with T1–T6 terminals in a 3×2 grid
- **Select & delete** — click a component to select; press Delete or Backspace to remove
- **Drag to move** — drag components around the canvas
- **Terminal snap** — hover over any mini terminal box for 2 seconds to snap the cursor to its center

## Run the desktop app

**Requirements:** [Python 3](https://www.python.org/downloads/)

From the project root:

```bash
python3 -m pip install -r requirements.txt
npm start
```

That opens **Endo Audio Schematic Editor** in its own application window.

**Browser fallback** (e.g. Cursor preview):

```bash
npm run start:browser
```

Or: `Terminal → Run Task → Run Endo ASD`.

Font: Consolas (with monospace fallbacks).

## Windows download

Send testers **`EndoASD-Setup.exe`** — a normal Windows installer (Next → Next → Finish, optional desktop shortcut, uninstall via Settings).

### Build the installer (on Windows)

1. Install [Python 3](https://www.python.org/downloads/) and [Inno Setup 6](https://jrsoftware.org/isdl.php) (free).
2. From the project folder, run:

```bat
build\build-windows.bat
```

3. Share **`dist\EndoASD-Setup.exe`**.

Testers double-click the setup file, install, then launch **Endo Audio Schematic Editor** from the Start menu. Closing the window quits the app.

**GitHub Actions:** push a tag like `v1.0.0` and download **EndoASD-Setup.exe** from the workflow artifacts.

### Without installer (portable)

- **`dist\EndoASD.exe`** — single file, no install step (PyInstaller build only).
- **`EndoASD.bat`** — needs Python 3 + `pip install -r requirements.txt` on the PC.
- **`dist\EndoASD-Windows-Bugtest.zip`** — portable folder for bug testers.

## macOS download

Share **`EndoASD-mac-Bugtest.dmg`** — open it and drag **Endo ASD.app** to Applications.

### Build on Mac

From the project folder:

```bash
chmod +x build/build-mac.sh
./build/build-mac.sh
```

Output:
- **`dist/Endo ASD.app`** — double-click to run (desktop window)
- **`dist/EndoASD-mac-Bugtest.dmg`** — easy to share

**Without building:** double-click **`EndoASD.command`** (needs Python 3 + `pip install -r requirements.txt`).

**GitHub Actions:** run **Build macOS app** from the Actions tab, or push a `v*` tag, then download **EndoASD-mac**.

## Check update

On the gate screen, under the Bugtest build number, click **Check update**. Set `gitUrl` in `update-channel.json` after the repo is pushed so testers can pull newer builds.
