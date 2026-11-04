# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GNOME Shell extension (ESM, GNOME 45–50) that shows today's next calendar event in the top bar. Personal fork of Bhavik-ag/gnome-next-event-extension with its own UUID `next-event@g-mainardi.github.io`. No build step, no dependencies, no test suite.

## Commands

```bash
./package.sh                      # gnome-extensions pack -> dist/<uuid>.shell-extension.zip
gnome-extensions install --force dist/next-event@g-mainardi.github.io.shell-extension.zip
gnome-extensions enable next-event@g-mainardi.github.io
gnome-extensions prefs next-event@g-mainardi.github.io
journalctl -f -o cat /usr/bin/gnome-shell   # extension errors/logs
shexli . && shexli dist/*.zip     # EGO static checks (pip install shexli in a venv)
```

On Wayland the shell does not reload extension code; log out and back in after reinstalling.

Releases: pushing a `v*` tag runs `.github/workflows/release.yml`, which builds the zip with an inline Python script (not `package.sh`) from a hardcoded file list: `metadata.json`, `extension.js`, `prefs.js`, `schemas/*.gschema.xml`. A new source file must be added there too.

## Architecture

- `extension.js` — everything runtime. A `PanelMenu.Button` with a label (bar) and a popup menu (all of today's remaining events, all-day ones first; clicking any opens the default `text/calendar` app).
- `prefs.js` — Adw preferences window bound to the GSettings schema in `schemas/` (panel position, font size, max title length, refresh interval, "Now" indicator). Adding a setting means: schema key + prefs row + `_connectSettingsSignals()` handler in `extension.js`.

Key design point (the reason for the fork): the extension does **not** create its own calendar source. `gnome-shell-calendar-server` holds a single requested time range shared by all clients, so a private "today" source would clobber the date menu's month range. Instead it borrows `Main.panel.statusArea.dateMenu._eventSource` (private shell API):
- `_syncEventSource()` re-resolves it on every refresh because the shell replaces it on session-mode changes (lock screen).
- `_ensureTodayLoaded()` reads the source's `_curRequestBegin/_curRequestEnd`; if the user navigated the date-menu calendar to another month, it resets it to today via `dateMenu._calendar.setDate()` — but never while the date menu is open.

Refresh is driven by both the source's `changed` signal and a GLib timer (min 10s). Bar logic lives in the exported pure function `pickBarEvents()`: all ongoing timed events, else all upcoming events sharing the earliest start time, joined by `  |  `. All-day events (covering the whole of today) never appear in the bar. Times are 24-hour.

`metadata.json` must not contain `version` (deprecated for EGO). Maintainer publishing checklist: `docs/README.md`.
