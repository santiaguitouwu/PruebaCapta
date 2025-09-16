export interface AppConfig {
    port: number;
    holidaysUrl: string;
    holidaysCacheTtlMinutes: number;
    tz: 'America/Bogota';
    workday: {
        morningStart: { h: number; m: number };
        morningEnd:   { h: number; m: number };
        lunchStart:   { h: number; m: number };
        lunchEnd:     { h: number; m: number };
        afternoonStart:{ h: number; m: number };
        close:        { h: number; m: number };
    };
}

export const config: AppConfig = {
    port: Number(process.env.PORT ?? 3000),
    holidaysUrl: String(process.env.HOLIDAYS_URL ?? 'https://content.capta.co/Recruitment/WorkingDays.json'),
    holidaysCacheTtlMinutes: Number(process.env.HOLIDAYS_CACHE_TTL_MINUTES ?? 60 * 24),
    tz: 'America/Bogota',
    workday: {
        morningStart: { h: 8, m: 0 },
        morningEnd:   { h: 12, m: 0 },
        lunchStart:   { h: 12, m: 0 },
        lunchEnd:     { h: 13, m: 0 },
        afternoonStart:{ h: 13, m: 0 },
        close:        { h: 17, m: 0 }
    }
};
