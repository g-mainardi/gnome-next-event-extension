// Run: gjs -m test/events.test.js
import { isAllDay, pickBarEvents } from '../events.js';

const at = (h, m = 0) => new Date(2026, 0, 1, h, m);
const ev = (summary, start, end) => ({ summary, date: start, end });

function assertNames(actual, expected, msg) {
    const got = actual.map(e => e.summary).join(',');
    if (got !== expected.join(','))
        throw new Error(`${msg}: expected [${expected}], got [${got}]`);
}

const a = ev('a', at(9), at(10));
const b = ev('b', at(9, 30), at(11));
const c = ev('c', at(12), at(13));
const d = ev('d', at(12), at(12, 30));
const all = [a, b, c, d];

assertNames(pickBarEvents(all, at(8)), ['a'], 'earliest upcoming');
assertNames(pickBarEvents(all, at(9, 45)), ['a', 'b'], 'all ongoing');
assertNames(pickBarEvents(all, at(10)), ['b'], 'end is exclusive');
assertNames(pickBarEvents(all, at(11, 30)), ['c', 'd'], 'ties on start time');
assertNames(pickBarEvents(all, at(14)), [], 'done for today');
assertNames(pickBarEvents([], at(8)), [], 'no events');

const todayStart = at(0), tomorrowStart = new Date(2026, 0, 2);
if (!isAllDay(ev('x', todayStart, tomorrowStart), todayStart, tomorrowStart))
    throw new Error('whole-day event should be all day');
if (isAllDay(a, todayStart, tomorrowStart))
    throw new Error('timed event should not be all day');

print('ok');
