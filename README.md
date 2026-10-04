# Millennium Desktop

**Live demo:** https://wieslawsoltes.github.io/WinMe/ — The `Deploy to GitHub Pages` workflow publishes `dist/` on every push to `main`.

A modular HTML/JavaScript reimplementation of the Windows Millennium Edition desktop. The application includes 60 registered applications and control-panel entries, a persistent virtual drive, classic window management, and a WebGPU compute renderer with WebGL 2 and Canvas 2D fallbacks.

**This is a browser desktop, not a complete Windows Me operating system.** It does not execute arbitrary Windows binaries or implement the Windows kernel, drivers, Win32 ABI, DirectX, or physical hardware services. The interface follows Windows Me visual references, but exhaustive pixel and feature parity has not been established. See [COMPATIBILITY.md](COMPATIBILITY.md) for the precise boundary.

## Run and develop

Use Node.js 22 or later:

```sh
npm ci
npm run dev
```

Open the local address reported by Vite. The development server uses port 4173. For checks and production preparation:

```sh
npm test
npm run build
npm run check
```

The production site is the `dist` directory. It contains native ES modules and readable source, with no runtime npm dependencies or required application server. Serve this directory over HTTPS, or localhost during development. Opening `index.html` directly through `file://` is not supported because ES modules and browser storage require a proper origin.

`build` generates a content-versioned service worker. After the first successful online load and cache installation, the desktop's static program files can load offline. Browser capabilities and externally embedded pages still depend on the host. The development preview does not register this cache.

## Desktop and file workflows

The shell supplies the Start menu, Programs and Documents submenus, taskbar, Quick Launch, tray volume, clock, desktop icons, shortcuts, selection, dragging, context menus, Run, Close Program, local logon, shutdown, restart, and screen savers. Windows support resizing, maximize/restore, minimize, task switching, cascading, tiling, and save/discard prompts.

Explorer and common file dialogs operate on a case-insensitive virtual drive with Windows path conventions. Create folders, rename and move files, copy/paste, search, change hidden/read-only attributes, import host files, export files, recycle items and restore them. The `C:` and `D:` drives are virtual; they do not expose the host filesystem.

Files live in IndexedDB at the site's browser origin. Mutations commit before observers see the new state. Optimistic revision checks prevent independent tabs from silently overwriting unrelated changes. If persistent storage is unavailable, the app explicitly reports memory-only mode. Backup exports a portable drive snapshot; System Restore captures the virtual drive and desktop preferences.

A built-in original sample song is generated as PCM WAV. It is not an original Microsoft media asset.

## Applications

### Accessories

- **Notepad:** plain text, new/open/save/save as, find/replace, go to line, word wrap, font selection, time/date, print, and dirty-document prompts.
- **WordPad:** rich text and HTML, font/color/paragraph formatting, embedded raster pictures, lists, clipboard commands, print, and basic RTF text import. Rich formatting is saved as HTML.
- **Paint:** pencil, brush, airbrush, eraser, flood fill, color picker, magnifier, text, line, two-bend curve, rectangle, rounded rectangle, ellipse, polygon, rectangular and free-form selections. Includes palette editing, undo/redo, copy/cut/paste, resize, stretch/skew, rotate/flip, inversion, PNG saving, printing, and wallpaper assignment.
- **Calculator:** immediate standard calculations, repeat equals, percent, memory, and common scientific functions.
- **MS-DOS Prompt:** virtual file commands, quoted paths, pipes, redirection, environment variables, basic BAT scripts, labels/GOTO, command history, completion, and launching registered applications. This is a command interpreter, not DOS binary emulation.
- **Character Map** and **Imaging:** character selection/copy and image viewing, zoom, rotation, export, and print.

### Media

- **Windows Media Player:** Me-style navigation and chrome; local audio/video, library, playlists, transport, seek, volume, mute, shuffle/repeat, compact view, stream URLs, and audio-reactive visualizations.
- **Sound Recorder:** microphone capture through browser permission, real sample waveform, playback, seeking, codec-aware saving, and playback speed/volume effects. Recording lifecycle protects against late permission and stop events replacing a newly opened document.
- **Windows Movie Maker:** image/video collection, storyboard ordering, titles, captions, trim points, preview, editable project files, and real-time WebM/MP4 export when supported. Exports use a separate media element and an immutable timeline copy. Recording pauses while assets load or seek. Its `.mswmm` project is a documented application-specific JSON file, not Microsoft's binary format.

### Games

Minesweeper, Solitaire, FreeCell, Spider Solitaire, Hearts, a Space Cadet-inspired Pinball game, and the five Internet Games entries: Backgammon, Checkers, Hearts, Reversi, and Spades. The Internet Games use local computer opponents. Original multiplayer services are not connected.

The game rules are implemented in DOM-independent models. Backgammon enforces mandatory dice use, bar entry, hits, doubles, and bearing off. Hearts handles passing, follow-suit, the first trick, broken hearts, and shooting the moon. Spades handles partnership contracts, Nil, bags, penalties, and tied match scores.

### Internet and system

Internet Explorer provides browser-style navigation, history, favorites, local pages and HTML, and sandboxed external-page embedding where the remote site allows it. Outlook Express provides local folders, drafts, message composition, an address book, MIME/EML import and export including attachments, and an explicit handoff to the user's mail app for delivery.

Control Panel includes Display, Date/Time, Sounds, Folder Options, Mouse, Keyboard, Regional Settings, Accessibility, Fonts, System, Gaming Options, Internet Options, Power, Printers, local profile naming, and Add/Remove Programs. Utilities include Search, Backup, System Restore, Disk Cleanup, virtual ScanDisk/Defragmenter analysis, System Information, Registry Editor, On-Screen Keyboard, and Scheduled Tasks that run while the desktop is open.

## Package architecture

All packages are npm workspaces under `dist/packages`. They can be imported as source modules, used through the workspace package names, or served by another ES-module host.

| Package                   | Responsibility                                  | Main public exports                                                           |
| ------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `@millennium/core`        | DOM-independent shared primitives               | `EventHub`, `History`, `Settings`, `AppRegistry`, path-independent utilities  |
| `@millennium/filesystem`  | Virtual drive, transactions, backup, restore    | `VirtualFileSystem`, `normalizePath`, `basename`, `dirname`, `extension`      |
| `@millennium/ui`          | Classic controls, icons and menus               | `h`, `button`, `field`, `tabs`, `MenuManager`, icon helpers; `classic.css`    |
| `@millennium/shell`       | Windowing, desktop, Explorer, common dialogs    | `WindowManager`, `DesktopShell`, `Dialogs`, `createExplorer`                  |
| `@millennium/renderer`    | Graphics backends and synthesized sound         | `Surface`, `SoundEngine`                                                      |
| `@millennium/accessories` | Text/image editors and utilities                | `registerAccessories`; subpath exports for app factories and calculator model |
| `@millennium/games`       | Game models and application views               | `registerGames`; `models`, `boards`, `tricks` subpaths                        |
| `@millennium/media`       | Player, recorder and movie editor               | `registerMedia`; application subpaths                                         |
| `@millennium/system`      | Control Panel, utilities, help                  | `registerSystem`; `control-panel`, `utilities`, `help` subpaths               |
| `@millennium/internet`    | Browser, mail, contacts and local networking UI | `registerInternet`; `mime`, `browser`, `mail`, `network` subpaths             |

Each workspace declares its dependencies and ES-module exports. UI font assets are included in the UI package. A consumer of the complete shell also includes `dist/desktop.css`; it contains application-specific layouts.

### Virtual drive example

```js
import { VirtualFileSystem } from '@millennium/filesystem';

const drive = new VirtualFileSystem({ name: 'my-application-drive' });
await drive.ready;
await drive.writeFile('C:\\My Documents\\hello.txt', 'Hello');
console.log(drive.readFile('c:\\my documents\\HELLO.TXT'));
const unsubscribe = drive.on('change', () => refreshFiles());
// At teardown:
unsubscribe();
drive.close();
```

`stat`, `list`, and `walk` return owned metadata objects rather than copying large file buffers. `readFile(path, 'bytes')` returns an owned `Uint8Array`; `readFile(path, 'blob')` returns a Blob. Mutating a returned byte buffer does not modify stored files. Asynchronous write methods serialize commits and reject invalid operations.

### Graphics example

```js
import { Surface } from '@millennium/renderer';

const canvas = document.createElement('canvas');
canvas.style.cssText = 'width:640px;height:360px';
document.body.append(canvas); // A surface requires a mounted canvas.
const surface = new Surface(canvas, {
  effect: 'plasma',
  preference: 'auto',
  animated: true,
});
await surface.ready;
console.log(surface.diagnostics());
// The public canvas reference can change during backend fallback:
console.log(surface.canvas);
// At teardown:
surface.dispose();
```

`Surface` owns its canvas context, animation lifecycle, resize observation, and backend disposal. Automatic mode tries WebGPU, then WebGL 2, then Canvas 2D. Each attempt gets a fresh canvas because browser context types cannot be switched on an existing context. Runtime device/context loss advances to the next backend. A failure in the final backend becomes an explicit failed state rather than a retry loop.

The WebGPU path computes pixels in WGSL storage buffers and presents them with a fullscreen render pass. It is real graphics work, not merely feature detection. Windows, menus and controls remain DOM/CSS; Paint, Pinball, clocks and movie preview use Canvas 2D. The renderer caps internal effect resolution to control GPU and CPU costs. It does not implement a GPU compositor for every desktop control.

### Application host contract

Application factories receive a context with `createWindow`, `wm`, `menus`, `dialogs`, `fs`, `settings`, `sound`, `registry`, `clipboard`, `surfaces`, `launch`, `open`, `run`, `properties`, and print helpers. Factories return a window handle. A window can set `beforeClose`, register `onDispose` handlers, and use its `AbortSignal` for event cleanup.

The complete application exposes the same host as `globalThis.millennium` for embedding and diagnostics. In browsers supporting ChatGPT's page-scoped imperative WebMCP API, it registers four tools: list applications, open an application, list virtual files, and save a text file. Inputs are validated before actions, and the tools use the same registry/drive as visible controls.

## Verification

`npm test` uses the Node test runner, fake IndexedDB transactions and a jsdom integration harness. The suite covers shared primitives, calculator behavior, fill boundaries, MIME Unicode/binary round trips, path rules, persistence, concurrent sessions, rollback, restore, game rules, all 60 application factories, window lifecycle, common Save dialogs, Notepad persistence/cancel behavior, terminal file operations, renderer fallback state transitions, and page-tool execution through a test registry.

**Verification limits:** the preview server started, but this execution session's cloud browser refused access. No screenshot comparison or pixel-diff verification was completed. The DOM harness stubs canvas/media and does not validate visual layout, real shader compilation, GPU drivers, microphone devices, browser codec output, audible playback, native print/file pickers, host shortcuts, service-worker offline reload, or WebMCP in a supported browser. These remain browser/hardware acceptance checks, not tests claimed as passed.

## Visual references and third-party assets

Visual measurements and terminology were informed by Windows Me captures in [GUIdebook](https://guidebookgallery.org/screenshots/winme) and [Operating-System.org](https://www.operating-system.org/betriebssystem/_english/bs-winme.htm). Specific references include the [desktop](https://guidebookgallery.org/pics/gui/desktop/empty/winme.png), [Display Properties](https://guidebookgallery.org/pics/gui/settings/appearance/winme-1-1.png), [Media Player](https://guidebookgallery.org/pics/gui/applications/multimedia/mediaplayer/winme.png), and [Start/Accessories menu](https://www.operating-system.org/betriebssystem/bsgfx/microsoft/winme/windowsme-final-scr-22.png). Reference screenshots are not bundled as application assets.

The recreated **Microsoft Sans Serif** fonts are by **lou**, distributed through [98.css's font directory](https://github.com/jdan/98.css/tree/main/fonts), under **CC BY-SA 3.0**. Their license and original attribution files are preserved under `dist/packages/ui/assets/fonts`. See [FontStruct attribution](https://fontstruct.com/fontstructions/show/1384746) and the bundled notices. The 98.css license notice is also retained. The application CSS and SVG icons were authored for this implementation; original Windows executable resources and audio are not included.

Application code is provided under the MIT license. Font licensing remains separate. Windows, Windows Me, Internet Explorer, and associated product names identify the interfaces being reimplemented.
