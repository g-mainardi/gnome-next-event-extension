# Next Event (GNOME Shell Extension)

> Personal fork of [Bhavik-ag/gnome-next-event-extension](https://github.com/Bhavik-ag/gnome-next-event-extension), with its own UUID so that updates from extensions.gnome.org do not overwrite it.
>
> Changes from upstream:
> - Reuses the shell's calendar event source. `gnome-shell-calendar-server` keeps one time range for all clients, so the upstream's private "today only" source left every other day empty in the top-bar calendar.
> - All-day events appear only in the dropdown menu, never in the top bar.
> - Overlapping events are all shown in the top bar, separated by `|`.
> - Clicking an event opens GNOME Calendar through its `.desktop` file, which also works for the Flatpak build; times use 24-hour format.

Shows today’s next calendar event in the GNOME top bar. Click the widget to see all upcoming events for today, then click any event to open GNOME Calendar.

## Quick install (Ubuntu, end user)

1. Download `next-event@g-mainardi.github.io.shell-extension.zip` from this repo’s **Releases** page.
2. Open terminal in your Downloads folder and run:
   ```bash
   gnome-extensions install --force next-event@g-mainardi.github.io.shell-extension.zip
   gnome-extensions enable next-event@g-mainardi.github.io
   ```
3. (Optional) Open **Extension Manager** and configure preferences.

If the UI does not refresh immediately on Wayland, log out and back in once.

## Customize (Extension Manager / Preferences)

Open preferences:

```bash
gnome-extensions prefs next-event@g-mainardi.github.io
```

Available settings:
- Panel position (left / center / right)
- Font size
- Max title length
- Refresh interval (seconds)
- Show/hide `Now` indicator

## Uninstall

```bash
gnome-extensions disable next-event@g-mainardi.github.io
rm -rf ~/.local/share/gnome-shell/extensions/next-event@g-mainardi.github.io
```

## Build package from source

```bash
./package.sh
```

Creates: `dist/next-event@g-mainardi.github.io.shell-extension.zip`

## Maintainer docs

Publishing + review checklist: `docs/README.md`
