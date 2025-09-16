import {buildServer} from './server.js';
import {config} from './config.js';

const app = buildServer();

app
    .listen({port: config.port, host: '0.0.0.0'})
    .then((address) => {
        app.log.info(`Server running at ${address}`);
    })
    .catch((err) => {
        app.log.error(err, 'Failed to start server');
        process.exit(1);
    });
