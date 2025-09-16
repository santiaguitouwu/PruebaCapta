import { DateTime, Interval } from 'luxon';
import { config } from '../config.js';
import type { HolidaysSource } from '../types.js';

export interface WorkingSegments {
    morning: Interval;
    afternoon: Interval;
}

export const toBogota = (dt: DateTime): DateTime => dt.setZone(config.tz, { keepLocalTime: false });
export const toUtcIsoZ = (dt: DateTime): `${string}Z` => dt.toUTC().toISO({ suppressMilliseconds: true }) as `${string}Z`;

export const ymd = (dt: DateTime): string => dt.toFormat('yyyy-LL-dd');

export const workingSegmentsFor = (dt: DateTime): WorkingSegments => {
    const base = toBogota(dt).startOf('day');
    const mStart = base.set({ hour: config.workday.morningStart.h, minute: config.workday.morningStart.m });
    const mEnd   = base.set({ hour: config.workday.morningEnd.h,   minute: config.workday.morningEnd.m });
    const aStart = base.set({ hour: config.workday.afternoonStart.h, minute: config.workday.afternoonStart.m });
    const close  = base.set({ hour: config.workday.close.h,          minute: config.workday.close.m });
    return {
        morning: Interval.fromDateTimes(mStart, mEnd),       // [08:00,12:00)
        afternoon: Interval.fromDateTimes(aStart, close)     // [13:00,17:00)
    };
};

export const isWeekend = (dt: DateTime): boolean => {
    const wd = toBogota(dt).weekday; // 1=Mon,...,7=Sun
    return wd === 6 || wd === 7;
};

export const isWorkingDay = (dt: DateTime, holidays: HolidaysSource): boolean => {
    const day = ymd(toBogota(dt));
    if (isWeekend(dt)) return false;
    return !holidays.dates.has(day);
};

export const clampToPrevWorkingInstant = (dt: DateTime, holidays: HolidaysSource): DateTime => {
    // Si está en día no laborable, retroceder al cierre del día hábil anterior.
    let cur = toBogota(dt);
    while (!isWorkingDay(cur, holidays)) {
        cur = previousWorkingDayClose(cur, holidays);
    }
    const { morning, afternoon } = workingSegmentsFor(cur);

    // Si está dentro de jornada -> si está en almuerzo, aproximar hacia atrás a las 12:00;
    // si antes de 08:00 -> ir al día hábil anterior 17:00; si después de 17:00 -> 17:00.
    if (morning.contains(cur)) return cur;
    if (afternoon.contains(cur)) return cur;

    const twelve = morning.end;        // 12:00
    const eight  = morning.start;      // 08:00
    const thirteen = afternoon.start;  // 13:00
    const seventeen = afternoon.end;   // 17:00

    if (cur >= twelve && cur < thirteen) {
        // en almuerzo -> hacia atrás al límite: 12:00
        return twelve;
    }
    if (cur >= seventeen) {
        return seventeen;
    }
    // cur < 08:00 -> día hábil anterior 17:00
    return previousWorkingDayClose(cur, holidays);
};

export const previousWorkingDayClose = (dt: DateTime, holidays: HolidaysSource): DateTime => {
    // Devuelve el último instante de trabajo del día hábil previo (17:00).
    let d = toBogota(dt).minus({ days: 1 }).endOf('day');
    while (!isWorkingDay(d, holidays)) {
        d = d.minus({ days: 1 });
    }
    const { afternoon } = workingSegmentsFor(d);
    return afternoon.end; // 17:00 del día hábil anterior
};

export const nextWorkingDaySameLocalTime = (dt: DateTime, holidays: HolidaysSource): DateTime => {
    // Avanza al próximo día hábil manteniendo HH:mm (permitimos 12:00 como frontera válida).
    let d = toBogota(dt).plus({ days: 1 });
    while (!isWorkingDay(d, holidays)) {
        d = d.plus({ days: 1 });
    }
    return d.set({ hour: dt.hour, minute: dt.minute, second: 0, millisecond: 0 });
};

export const startOfNextWorkMorning = (dt: DateTime, holidays: HolidaysSource): DateTime => {
    let d = toBogota(dt);
    if (d.hour >= 17) d = d.plus({ days: 1 });
    while (!isWorkingDay(d, holidays)) {
        d = d.plus({ days: 1 });
    }
    const { morning } = workingSegmentsFor(d);
    return morning.start;
};

export const addWorkingDays = (start: DateTime, days: number, holidays: HolidaysSource): DateTime => {
    // Asumimos start ya "clampeado" a instante de trabajo o frontera 12:00/17:00.
    let cur = toBogota(start).set({ second: 0, millisecond: 0 });
    for (let i = 0; i < days; i++) {
        cur = nextWorkingDaySameLocalTime(cur, holidays);
    }
    return cur;
};

export const addWorkingHours = (start: DateTime, hours: number, holidays: HolidaysSource): DateTime => {
    // Avanza 'hours' en bloques respetando [08-12) y [13-17)
    let cur = toBogota(start).set({ second: 0, millisecond: 0 });
    let remaining = hours;

    while (remaining > 0) {
        const segs = workingSegmentsFor(cur);
        const inMorning = segs.morning.contains(cur) || cur.equals(segs.morning.end);
        const inAfternoon = segs.afternoon.contains(cur) || cur.equals(segs.afternoon.end);

        if (!inMorning && !inAfternoon) {
            // Si está exactamente en 12:00 -> saltar a 13:00 (próxima franja)
            if (cur.equals(segs.morning.end)) {
                cur = segs.afternoon.start;
            } else if (cur < segs.morning.start) {
                // antes de 08:00: ir a 08:00 (pero nuestra API siempre clampea atrás: podría suceder tras sumar días)
                cur = segs.morning.start;
            } else if (cur > segs.afternoon.end) {
                cur = startOfNextWorkMorning(cur, holidays);
            } else if (cur >= segs.morning.end && cur < segs.afternoon.start) {
                cur = segs.afternoon.start;
            } else {
                // fuera de día hábil -> ir a próxima mañana
                cur = startOfNextWorkMorning(cur, holidays);
            }
            continue;
        }

        // Determina fin de franja actual
        const end = inMorning && cur < segs.morning.end ? segs.morning.end : segs.afternoon.end;
        const diffHours = end.diff(cur, 'hours').hours;

        if (remaining <= diffHours + 1e-9) {
            cur = cur.plus({ hours: remaining });
            remaining = 0;
        } else {
            remaining -= diffHours;
            cur = end;
            // Si terminamos en 12:00 saltar a 13:00; si en 17:00 saltar a próxima mañana
            if (cur.equals(segs.morning.end)) {
                cur = segs.afternoon.start;
            } else if (cur.equals(segs.afternoon.end)) {
                cur = startOfNextWorkMorning(cur, holidays);
            }
        }
    }

    return cur;
};
