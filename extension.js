/**
 * Next Event - GNOME Shell Extension
 * Shows the next upcoming calendar event for today in the top bar.
 *
 * Local changes:
 * - Reuses the shell's own calendar event source instead of creating a second
 *   one. gnome-shell-calendar-server keeps a single time range for everybody,
 *   so a private source asking for "today" clobbered the date menu's month range
 *   and left every other day empty.
 * - All-day events are listed in the menu only, never in the top bar.
 * - Overlapping events are all shown in the top bar.
 */

import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

const DEFAULT_PANEL_POSITION = 'center';
const DEFAULT_FONT_SIZE = 15;
const DEFAULT_MAX_TITLE_LENGTH = 35;
const DEFAULT_REFRESH_INTERVAL_SECONDS = 60;
const MIN_REFRESH_INTERVAL_SECONDS = 10;
const PANEL_POSITIONS = new Set(['left', 'center', 'right']);
const SEPARATOR = '  |  ';

/** An event is "all day" for today if it covers the whole day. */
function isAllDay(ev, todayStart, tomorrowStart) {
    return ev.date <= todayStart && ev.end >= tomorrowStart;
}

/**
 * Timed events that go in the top bar: every ongoing one if any,
 * otherwise every upcoming one starting at the earliest start time.
 */
export function pickBarEvents(timed, now) {
    const ongoing = timed.filter(ev => ev.date <= now && ev.end > now);
    if (ongoing.length > 0)
        return ongoing;
    const upcoming = timed.filter(ev => ev.date > now);
    if (upcoming.length === 0)
        return [];
    const first = Math.min(...upcoming.map(ev => ev.date.getTime()));
    return upcoming.filter(ev => ev.date.getTime() === first);
}

export default class NextEventExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._settingsSignals = [];
        this._allDayEvents = [];
        this._timedEvents = [];
        this._createIndicator();
        this._startTimer();
        this._connectSettingsSignals();
        this._refresh();
    }

    disable() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }

        this._disconnectEventSource();

        if (this._settings && this._settingsSignals) {
            for (const id of this._settingsSignals)
                this._settings.disconnect(id);
        }

        // The label is a child of the indicator and dies with it.
        this._indicator?.destroy();
        this._indicator = null;
        this._label = null;

        this._settingsSignals = [];
        this._settings = null;
        this._allDayEvents = [];
        this._timedEvents = [];
    }

    _createIndicator() {
        const currentText = this._label?.get_text() || 'Loading...';
        this._indicator?.destroy();

        this._indicator = new PanelMenu.Button(0.5, 'Next Event', false);
        this._label = new St.Label({
            text: currentText,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._updateLabelStyle();

        this._indicator.add_child(this._label);
        Main.panel.addToStatusArea('next-event', this._indicator, 0, this._getPanelPosition());
        this._populateMenu();
    }

    _connectSettingsSignals() {
        const on = (key, fn) => this._settingsSignals.push(this._settings.connect(`changed::${key}`, fn));
        on('panel-position', () => {
            this._createIndicator();
            this._refresh();
        });
        on('font-size', () => this._updateLabelStyle());
        on('max-title-length', () => this._refresh());
        on('refresh-interval-seconds', () => this._startTimer());
        on('show-ongoing-indicator', () => this._refresh());
    }

    _startTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }

        const interval = Math.max(
            MIN_REFRESH_INTERVAL_SECONDS,
            this._settings?.get_int('refresh-interval-seconds') ?? DEFAULT_REFRESH_INTERVAL_SECONDS
        );

        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    /**
     * Follow the date menu's event source. The shell swaps it on session mode
     * changes (e.g. lock screen), so re-check on every refresh.
     */
    _syncEventSource() {
        const source = Main.panel.statusArea.dateMenu?._eventSource ?? null;
        if (source === this._eventSource)
            return;
        this._disconnectEventSource();
        this._eventSource = source;
        if (source)
            this._changedId = source.connect('changed', () => this._refresh());
    }

    _disconnectEventSource() {
        if (this._eventSource && this._changedId)
            this._eventSource.disconnect(this._changedId);
        this._eventSource = null;
        this._changedId = null;
    }

    /**
     * The shell only loads the month shown in its calendar. If the user left it
     * on another month, bring it back to today, but never while it's open.
     */
    _ensureTodayLoaded(todayStart, tomorrowStart) {
        const dateMenu = Main.panel.statusArea.dateMenu;
        const begin = this._eventSource?._curRequestBegin;
        const end = this._eventSource?._curRequestEnd;
        if (!dateMenu || dateMenu.menu.isOpen || !begin || !end)
            return;
        if (begin > todayStart || end < tomorrowStart)
            dateMenu._calendar?.setDate(new Date());
    }

    _getPanelPosition() {
        const value = this._settings?.get_string('panel-position') || DEFAULT_PANEL_POSITION;
        return PANEL_POSITIONS.has(value) ? value : DEFAULT_PANEL_POSITION;
    }

    _getMaxTitleLength() {
        const value = this._settings?.get_int('max-title-length') ?? DEFAULT_MAX_TITLE_LENGTH;
        return Math.max(10, value);
    }

    _shouldShowOngoingIndicator() {
        return this._settings?.get_boolean('show-ongoing-indicator') ?? true;
    }

    _updateLabelStyle() {
        if (!this._label)
            return;

        const fontSize = Math.max(10, this._settings?.get_int('font-size') ?? DEFAULT_FONT_SIZE);
        this._label.set_style(`font-size: ${fontSize}px; padding: 0 8px;`);
    }

    _title(ev) {
        const max = this._getMaxTitleLength();
        const title = ev.summary || 'Untitled Event';
        return title.length > max ? `${title.substring(0, max - 1)}...` : title;
    }

    _timeText(ev, now) {
        const isNow = ev.date <= now && ev.end > now;
        return isNow && this._shouldShowOngoingIndicator() ? 'Now' : this._formatTime(ev.date);
    }

    _refresh() {
        if (!this._label || !this._indicator)
            return;

        this._syncEventSource();
        if (!this._eventSource)
            return;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        this._ensureTodayLoaded(todayStart, tomorrowStart);

        const events = this._eventSource.getEvents(todayStart, tomorrowStart) || [];
        this._allDayEvents = events.filter(ev => isAllDay(ev, todayStart, tomorrowStart));
        const timed = events
            .filter(ev => !isAllDay(ev, todayStart, tomorrowStart))
            .sort((a, b) => a.date - b.date);
        this._timedEvents = timed.filter(ev => ev.end > now);
        this._populateMenu();

        const bar = pickBarEvents(timed, now);
        if (bar.length > 0)
            this._label.set_text(bar.map(ev => `${this._timeText(ev, now)} · ${this._title(ev)}`).join(SEPARATOR));
        else
            this._label.set_text(timed.length === 0 ? 'No events today' : 'Done for today');
    }

    _populateMenu() {
        if (!this._indicator)
            return;

        this._indicator.menu.removeAll();

        const now = new Date();
        const rows = [
            ...this._allDayEvents.map(ev => `All day · ${this._title(ev)}`),
            ...this._timedEvents.map(ev => `${this._timeText(ev, now)} · ${this._title(ev)}`),
        ];

        if (rows.length === 0) {
            this._indicator.menu.addMenuItem(new PopupMenu.PopupMenuItem('No upcoming events today', {
                reactive: false,
                can_focus: false,
            }));
            return;
        }

        for (const text of rows) {
            const item = new PopupMenu.PopupMenuItem(text);
            item.connect('activate', () => {
                // Calendar is a Flatpak here: launch via its .desktop file, not the binary name
                const app = Shell.AppSystem.get_default().lookup_app('org.gnome.Calendar.desktop');
                if (app)
                    app.activate();
                else
                    Util.spawn(['gnome-calendar']);
            });
            this._indicator.menu.addMenuItem(item);
        }
    }

    /**
     * Format a Date object to a human-readable time string (e.g. "15:30").
     */
    _formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    }
}
