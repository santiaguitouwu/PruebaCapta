import Fastify from 'fastify';
import routes from './routes/calculate.js';

export const buildServer = () => {
    const app = Fastify({ logger: true });
    app.register(routes);
    return app;
};

export type AppServer = ReturnType<typeof buildServer>;
