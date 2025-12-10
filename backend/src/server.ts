import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

// Import local utilities (Fixed paths from '../' to './')
import { prisma } from './lib/prisma'; 

// Import Routes
// Ensure these files exist in your src/routes/ folder
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes'; // This is where the code you posted earlier should go
import { clientPortalRoutes } from './routes/client.portal.routes';

// Load environment variables
dotenv.config();

const app = Fastify({
  logger: true,
});

async function main() {
  try {
    // --- 1. Register Global Plugins ---

    // Fixes "Property 'setCookie' does not exist"
    await app.register(cookie, {
      secret: process.env.COOKIE_SECRET || 'super-secret-development-key', 
      hook: 'onRequest', 
      parseOptions: {} 
    });

    // Enables Cross-Origin Resource Sharing
    await app.register(cors, {
      origin: true, // Allow all origins (configure this for production!)
      credentials: true, // Allow cookies to be sent
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
    
    // Auth Routes (Login, Signup, Logout)
    await app.register(authRoutes, { prefix: '/api/auth' });
    
    // User Routes (The code you posted earlier belongs in src/routes/user.routes.ts)
    await app.register(userRoutes, { prefix: '/api/users' });
    
    // Client Portal Routes
    await app.register(clientPortalRoutes, { prefix: '/api/portal' });

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
