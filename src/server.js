import Fastify from 'fastify';
import dotenv from 'dotenv';
import { credentialsRoutes } from './routes/credentials/credentials.routes.js';

dotenv.config();

const server = Fastify({
  logger: true, // Enables structured logging
});

// Register route plugins
await server.register(credentialsRoutes);

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 8000;
    await server.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();