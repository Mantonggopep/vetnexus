import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';
import { DEFAULT_PLANS } from './utils/serverHelpers';

// --- ROUTE IMPORTS ---
import { authRoutes } from './routes/auth.routes';
import { adminRoutes } from './routes/admin.routes';
import { userRoutes } from './routes/user.routes';
import { clinicalRoutes } from './routes/clinical.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { aiRoutes } from './routes/ai.routes';
// Key additions to ensure Frontend works:
import { ownerRoutes } from './routes/owner.routes';     // Manages Clients
import { patientRoutes } from './routes/patient.routes'; // Manages Pets
import { clientPortalRoutes } from './routes/client.portal.routes'; // Manages Portal Login

const app: FastifyInstance = Fastify({ 
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
  },
  bodyLimit: 1048576 * 10 // 10MB limit for file uploads/images
});

const PORT = parseInt(process.env.PORT || '4000');

// --- PLUGINS ---

// 1. Security Headers
app.register(helmet, { contentSecurityPolicy: false, global: true });

// 2. CORS Configuration (Strict but allows Vercel & Localhost)
app.register(cors, {
  origin: (origin, cb) => {
    // Allow non-browser requests (mobile apps, curl, postman)
    if (!origin) return cb(null, true);

    const allowedExact = [
      'http://localhost:5173', 
      'http://localhost:4173',
      'http://localhost:3000',
      'https://vetnexuspro.vercel.app', 
      process.env.CLIENT_URL?.replace(/\/$/, '') // Remove trailing slash
    ].filter(Boolean);

    // Check Exact Match
    if (allowedExact.includes(origin)) {
      return cb(null, true);
    }

    // Allow ALL Vercel Preview/Deployment URLs
    if (origin.endsWith('.vercel.app')) {
      return cb(null, true);
    }

    // Dev Mode Fallback
    if (process.env.NODE_ENV !== 'production') {
      app.log.warn(`⚠️ Dev CORS Allowed: ${origin}`);
      return cb(null, true);
    }

    // Block others
    app.log.warn(`🚫 Blocked CORS request from: ${origin}`);
    return cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
});

// 3. Cookie Parser
app.register(cookie, { 
  secret: process.env.COOKIE_SECRET || 'super-secret-key-change-in-prod', 
  hook: 'onRequest',
  parseOptions: {} 
});

// --- REGISTER ROUTES ---
app.register(async (api) => {
    // Health Check
    api.get('/health', async () => { return { status: 'ok', timestamp: new Date() } });

    // Core Routes
    api.register(authRoutes, { prefix: '/auth' }); // usually /auth prefix is handled inside or here
    api.register(adminRoutes, { prefix: '/admin' });
    api.register(userRoutes, { prefix: '/users' });
    
    // Feature Routes
    api.register(ownerRoutes, { prefix: '/owners' });       // Fixes "Clients" page
    api.register(patientRoutes, { prefix: '/patients' });   // Fixes "Add Pet"
    api.register(clinicalRoutes, { prefix: '/clinical' });  // Appts/Consults
    api.register(inventoryRoutes, { prefix: '/inventory' });
    
    // AI & Portal
    api.register(aiRoutes, { prefix: '/ai' });
    api.register(clientPortalRoutes, { prefix: '/portal' }); 

}, { prefix: '/api' });


// --- START & SEED ---
const start = async () => {
  try {
    if (!process.env.JWT_SECRET) app.log.warn("⚠️ WARNING: JWT_SECRET not set.");
    if (!process.env.DATABASE_URL) app.log.warn("⚠️ WARNING: DATABASE_URL not set.");

    await prisma.$connect();
    app.log.info("✅ Connected to Database");

    // 1. Seed Plans
    for (const p of DEFAULT_PLANS) {
        await prisma.plan.upsert({ where: { id: p.id }, update: p, create: p });
    }
    app.log.info("✅ Plans Seeded");

    // 2. Seed System Tenant & Super Admin
    const systemTenant = await prisma.tenant.upsert({ 
        where: { id: 'system' }, 
        update: {}, 
        create: { 
          id: 'system', 
          name: 'System Admin', 
          plan: 'Enterprise', 
          settings: '{}', 
          storageUsed: 0 
        } 
    });

    const adminEmail = 'mantonggopep@gmail.com'; 
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail }});
    
    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('12doctor12', 10);
        await prisma.user.create({
            data: { 
                tenantId: systemTenant.id, 
                name: 'Super Admin', 
                email: adminEmail, 
                passwordHash: hashedPassword, 
                roles: JSON.stringify(['SuperAdmin']),
                isVerified: true
            }
        });
        app.log.info("✅ Super Admin Created");
    }

    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`🚀 Server running on port ${PORT}`);

  } catch (err) { 
    app.log.error(err);
    process.exit(1); 
  }
};

start();
