import { HolidaysSource } from '../types.js';
import { ServiceUnavailableError } from '../errors.js';
import { config } from '../config.js';
import { setTimeout as sleep } from 'node:timers/promises';
import { DateTime } from 'luxon';

type CaptaHolidayJson = string[] | { date: string }[] | Record<string, unknown>;

const toYmd = (isoLike: string): string => {
    // Normaliza a YYYY-MM-DD en zona Colombia (por si el origen trae offset/utc)
    const dt = DateTime.fromISO(isoLike, { zone: 'utc' }).isValid
        ? DateTime.fromISO(isoLike, { zone: 'utc' })
        : DateTime.fromFormat(isoLike, 'yyyy-MM-dd', { zone: 'utc' });

    if (!dt.isValid) return '';
    return dt.toUTC().toFormat('yyyy-LL-dd');
};

const parseCapta = (data: CaptaHolidayJson): HolidaysSource => {
    const set = new Set<string>();
    if (Array.isArray(data)) {
        for (const item of data) {
            const raw = typeof item === 'string' ? item : (item as { date?: string }).date;
            if (!raw) continue;
            const ymd = toYmd(raw);
            if (ymd) set.add(ymd);
        }
    } else if (typeof data === 'object' && data != null) {
        // soporte alternativo: { "2025-01-01": true, ... } o { "holidays": ["2025-..."] }
        const maybeArr = (data as Record<string, unknown>).holidays;
        if (Array.isArray(maybeArr)) {
            for (const raw of maybeArr) {
                if (typeof raw === 'string') {
                    const ymd = toYmd(raw);
                    if (ymd) set.add(ymd);
                }
            }
        } else {
            for (const key of Object.keys(data)) {
                const ymd = toYmd(key);
                if (ymd) set.add(ymd);
            }
        }
    }
    let minYear: number | null = null;
    let maxYear: number | null = null;
    for (const d of set) {
        const y = Number(d.slice(0, 4));
        minYear = minYear == null ? y : Math.min(minYear, y);
        maxYear = maxYear == null ? y : Math.max(maxYear, y);
    }
    return { dates: set, minYear, maxYear };
};

class HolidaysCache {
    private cache: HolidaysSource | null = null;
    private expiresAt: number = 0;
    private inflight: Promise<HolidaysSource> | null = null;

    public async get(): Promise<HolidaysSource> {
        const now = Date.now();
        if (this.cache && now < this.expiresAt) return this.cache;
        if (this.inflight) return this.inflight;

        this.inflight = this.fetchWithRetry();
        try {
            const res = await this.inflight;
            this.cache = res;
            this.expiresAt = Date.now() + config.holidaysCacheTtlMinutes * 60_000;
            return res;
        } finally {
            this.inflight = null;
        }
    }

    private async fetchWithRetry(): Promise<HolidaysSource> {
        const url = config.holidaysUrl;
        const attempts = [0, 250, 1000]; // backoff ms
        let lastErr: unknown = null;

        for (const delay of attempts) {
            if (delay) await sleep(delay);
            try {
                const resp = await fetch(url, { method: 'GET' });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const json = (await resp.json()) as CaptaHolidayJson;
                const parsed = parseCapta(json);
                // sanity mínima: debe haber al menos un año y > 10 fechas
                if (!parsed.minYear || parsed.dates.size < 10) {
                    throw new Error('Formato de festivos inesperado o insuficiente');
                }
                return parsed;
            } catch (err) {
                lastErr = err;
            }
        }
        throw new ServiceUnavailableError(
            `No se pudieron obtener los festivos desde ${url}: ${String(lastErr)}`
        );
    }
}

export const holidaysCache = new HolidaysCache();

export const isHoliday = (ymd: string, src: HolidaysSource): boolean => {
    return src.dates.has(ymd);
};
