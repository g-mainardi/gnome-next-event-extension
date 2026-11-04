// Pure event logic, no shell imports, so it can be tested with plain gjs.

/**
 * @typedef {object} CalendarEvent
 * @property {Date} date start
 * @property {Date} end
 * @property {string} [summary]
 */

/**
 * An event is "all day" for today if it covers the whole day.
 * @param {CalendarEvent} ev
 * @param {Date} todayStart
 * @param {Date} tomorrowStart
 */
export function isAllDay(ev, todayStart, tomorrowStart) {
    return ev.date <= todayStart && ev.end >= tomorrowStart;
}

/**
 * Timed events that go in the top bar: every ongoing one if any,
 * otherwise every upcoming one starting at the earliest start time.
 * @template {CalendarEvent} T
 * @param {T[]} timed
 * @param {Date} now
 * @returns {T[]}
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
