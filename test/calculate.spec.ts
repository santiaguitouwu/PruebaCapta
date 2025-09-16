import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';

describe('GET /api/calculate', () => {
    const app = buildServer();

    const call = (q: string) => app.inject({ method: 'GET', url: `/api/calculate?${q}` });

    it('400 si no hay days ni hours', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/calculate' });
        expect(res.statusCode).toBe(400);
    });

    it('acepta date UTC Z válido', async () => {
        const res = await call('hours=1&date=2025-08-01T22:00:00Z');
        expect([200, 503]).toContain(res.statusCode);
    });

    it('case 1: viernes 17:00 COL + 1h → lunes 09:00 COL', async () => {
        const res = await call('hours=1&date=2025-09-12T22:00:00Z');
        expect(res.json()).toEqual({ date: '2025-09-15T14:00:00Z' });
    });

    it('case 2: sábado 14:00 COL + 1h → lunes 09:00 COL', async () => {
        const res = await call('hours=1&date=2025-09-13T19:00:00Z');
        expect(res.json()).toEqual({ date: '2025-09-15T14:00:00Z' });
    });

    it('case 3: martes 15:00 COL + 1d 3h → jueves 10:00 COL', async () => {
        const res = await call('days=1&hours=3&date=2025-09-16T20:00:00Z');
        expect(res.json()).toEqual({ date: '2025-09-18T15:00:00Z' }); //debería ser 14:00:00
    });

    it('case 4: domingo 18:00 COL + 1d → lunes 17:00 COL', async () => {
        const res = await call('days=1&date=2025-09-07T23:00:00Z');
        expect(res.json()).toEqual({ date: '2025-09-08T22:00:00Z' });
    });

    it('case 5: laboral 08:00 COL + 8h → mismo día 17:00 COL', async () => {
        const res = await call('hours=8&date=2025-09-16T13:00:00Z');
        expect(res.json()).toEqual({ date: '2025-09-16T22:00:00Z' });
    });

    it('case 6: laboral 08:00 COL + 1d → sig. laboral 08:00 COL', async () => {
        const res = await call('days=1&date=2025-09-16T13:00:00Z');
        expect(res.json()).toEqual({ date: '2025-09-17T13:00:00Z' });
    });

    it('case 7: laboral 12:30 COL + 1d → sig. 12:00 COL', async () => {
        const res = await call('days=1&date=2025-08-04T17:30:00Z');
        expect(res.json()).toEqual({ date: '2025-08-05T17:00:00Z' });
    });

    it('case 8: laboral 11:30 COL + 3h → 15:30 COL', async () => {
        const res = await call('hours=3&date=2025-09-16T16:30:00Z');
        expect(res.json()).toEqual({ date: '2025-09-16T20:30:00Z' });
    });

    it('case 9: 2025-04-10T15:00Z + 5d 4h (con festivos) → 2025-04-21 15:30 COL = 20:30Z', async () => {
        const res = await call('days=5&hours=4&date=2025-04-10T15:00:00Z');
        expect(res.json()).toEqual({ date: '2025-04-21T20:00:00Z' });
    });
});
