import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

// Import local utilities
import { prisma } from './lib/prisma'; 

// Import Routes
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes'; 
import { clientPortalRoutes } from './routes/client.portal.routes';
import { plansRoutes } from './routes/plans.routes'; // <--- NEW IMPORT

// Load environment variables
dotenv.config();

const app = Fastify({
  logger: true,
});

async function main() {
  try {
    // --- 1. Register Global Plugins ---

    await app.register(cookie, {
      secret: process.env.COOKIE_SECRET || 'super-secret-development-key', 
      hook: 'onRequest', 
      parseOptions: {} 
    });

    await app.register(cors, {
      origin: true, 
      credentials: true, 
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    });

    // --- 2. Health Check / DB Check ---
    app.get('/health', async (req, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: 'ok', db: 'connected' };
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ status: 'error', db: 'disconnected' });
      }
    });

    // --- 3. Register Routes ---
    
    // Auth Routes
    await app.register(authRoutes, { prefix: '/api/auth' });
    
    // User Routes
    await app.register(userRoutes, { prefix: '/api/users' });
    
    // Client Portal Routes
    await app.register(clientPortalRoutes, { prefix: '/api/portal' });

    // Plans Routes (Fixes the 404 error)
    await app.register(plansRoutes, { prefix: '/api/plans' }); // <--- NEW REGISTRATION

    // --- 4. Start Server ---
    const PORT = Number(process.env.PORT) || 3000;
    
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running at http://localhost:${PORT}`);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});

main();
