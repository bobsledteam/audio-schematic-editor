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
