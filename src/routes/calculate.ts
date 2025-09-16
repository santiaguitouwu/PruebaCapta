import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DateTime } from "luxon";
import { holidaysCache } from '../lib/holidays.js';
import { clampToPrevWorkingInstant, addWorkingDays, addWorkingHours, toUtcIsoZ, toBogota } from '../lib/time.js';
import { InvalidParametersError, ServiceUnavailableError } from '../errors.js';
import type { ApiError, ApiSuccess, CalculateQuery } from '../types.js';

const QuerySchema = z.object({
    days: z.coerce.number().int().positive().optional(),
    hours: z.coerce.number().int().positive().optional(),
    date: z.string().datetime({ offset: true }).endsWith('Z').optional()
}) satisfies z.ZodType<CalculateQuery>;

type Req = FastifyRequest<{ Querystring: CalculateQuery }>;

export default async function routes(app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
    app.get('/api/calculate', async (req: Req, reply: FastifyReply) => {
        try {
            const parsed = QuerySchema.safeParse(req.query);
            if (!parsed.success) {
                throw new InvalidParametersError(parsed.error.issues.map(i => i.message).join('; '));
            }
            const { days, hours, date } = parsed.data;

            if (days == null && hours == null) {
                throw new InvalidParametersError('Debe enviar al menos uno de: "days" o "hours" (enteros positivos).');
            }

            // Base en hora Colombia: si envían date (UTC Z), convertir; si no, "ahora" Colombia.
            const baseUtc = date ? DateTime.fromISO(date, { zone: 'utc' }) : DateTime.utc();
            if (!baseUtc.isValid) throw new InvalidParametersError('Parámetro "date" inválido.');

            const baseCol = toBogota(baseUtc);

            // Festivos (cacheados con TTL)
            const holidays = await holidaysCache.get();

            // Regla: si fecha/hora está fuera de jornada o no es día laboral, aproximar hacia atrás
            let t = clampToPrevWorkingInstant(baseCol, holidays);

            // Suma primero días, luego horas
            if (typeof days === 'number') {
                t = addWorkingDays(t, days, holidays);
            }
            if (typeof hours === 'number') {
                // Si quedó exactamente a las 12:00, avanzar a 13:00 para cómputo horario
                const noon = t.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
                if (t.equals(noon)) t = t.set({ hour: 13, minute: 0, second: 0, millisecond: 0 });
                t = addWorkingHours(t, hours, holidays);
            }

            const result: ApiSuccess = { date: toUtcIsoZ(t) };
            // Respuesta EXACTA: solo "date"
            return reply.code(200).type('application/json').send(result);
        } catch (err) {
            if (err instanceof InvalidParametersError) {
                const body: ApiError = { error: err.code, message: err.message };
                return reply.code(400).type('application/json').send(body);
            }
            if (err instanceof ServiceUnavailableError) {
                const body: ApiError = { error: err.code, message: err.message };
                return reply.code(503).type('application/json').send(body);
            }
            const body: ApiError = { error: 'InternalError', message: 'Ha ocurrido un error no esperado.' };
            return reply.code(500).type('application/json').send(body);
        }
    });

    // Ruta básica de salud
    app.get('/health', async (_req, reply) => reply.send({ ok: true }));
}
