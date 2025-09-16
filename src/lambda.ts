import awsLambdaFastify from 'aws-lambda-fastify';
import { buildServer } from './server.js';

const app = buildServer();
export const handler = awsLambdaFastify(app);