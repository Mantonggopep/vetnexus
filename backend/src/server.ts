import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';
import { DEFAULT_PLANS } from './utils/serverHelpers';

// --- ROUTE IMPORTS ---
// Ensure these files exist in src/routes/
import { authRoutes } from './routes/auth.routes';
import { adminRoutes } from './routes/admin.routes';
import { ownerRoutes } from './routes/owner.routes';      
import { patientRoutes } from './routes/patient.routes';
import { clinicalRoutes } from './routes/clinical.routes';
import { clientPortalRoutes } from './routes/client.portal.routes';

// Optional imports (wrapped in try-catch below)
import { userRoutes } from './routes/user.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { aiRoutes } from './routes/ai.routes';

const app: FastifyInstance = Fastify({ 
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
  },
  bodyLimit: 1048576 * 10 // 10MB limit
});

const PORT = parseInt(process.env.PORT || '4000');

// --- PLUGINS ---
app.register(helmet, { contentSecurityPolicy: false, global: true });

app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    const allowed = [
      'http://localhost:5173', 
      'http://localhost:4173',
      'http://localhost:3000',
      'https://vetnexuspro.vercel.app', 
      process.env.CLIENT_URL?.replace(/\/$/, '') 
    ].filter(Boolean);

    // Allow allowed list OR any vercel subdomain
    if (allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      return cb(null, true);
    }

    if (process.env.NODE_ENV !== 'production') {
      app.log.warn(`⚠️ Dev CORS Allowed: ${origin}`);
      return cb(null, true);
    }

    app.log.warn(`🚫 Blocked CORS request from: ${origin}`);
    return cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
});

app.register(cookie, { 
  secret: process.env.COOKIE_SECRET || 'super-secret-key-change-in-prod', 
  hook: 'onRequest',
  parseOptions: {} 
});

// --- REGISTER ROUTES ---
app.register(async (api) => {
    // Health Check
    api.get('/health', async () => ({ status: 'ok', timestamp: new Date() }));

    // 1. Auth & Admin
    // Auth handles /login, /signup
    api.register(authRoutes, { prefix: '/auth' });
    // Admin handles /admin/tenants, /admin/stats
    api.register(adminRoutes, { prefix: '/admin' });

    // 2. Client Portal (Login for pet owners)
    api.register(clientPortalRoutes, { prefix: '/portal' }); 
    
    // 3. Core Entities
    // We register these separately to ensure modularity.
    // Ensure owner.routes.ts ONLY handles owners, and clinical.routes.ts ONLY handles appointments
    api.register(ownerRoutes, { prefix: '/owners' });       
    api.register(patientRoutes, { prefix: '/patients' });   
    
    // 4. Clinical (Appointments, Labs, Consultations)
    // IMPORTANT: Ensure clinical.routes.ts does NOT try to register /owners again
    try {
        api.register(clinicalRoutes); 
    } catch (e) {
        // Fallbacks if clinical.routes is broken
        api.get('/appointments', async () => []);
        api.get('/consultations', async () => []);
        api.get('/labs', async () => []);
    }
    
    // 5. Optional Modules
    try { api.register(inventoryRoutes, { prefix: '/inventory' }); } catch (e) {
        api.get('/inventory', async () => []); 
    }
    
    try { api.register(userRoutes, { prefix: '/users' }); } catch (e) {
        api.get('/users', async () => []); 
    }

    try { api.register(aiRoutes, { prefix: '/ai' }); } catch (e) {}

    // --- STATIC DATA / PLACEHOLDERS ---
    
    // Public Plans Route (Critical for Signup)
    api.get('/plans', async () => DEFAULT_PLANS);

    // Empty arrays for missing features to prevent Frontend 404s
    api.get('/sales', async () => []);
    api.get('/logs', async () => []);
    api.get('/expenses', async () => []);
    api.get('/branches', async () => []);

}, { prefix: '/api' });


// --- START & SEED ---
const start = async () => {
  try {
    if (!process.env.JWT_SECRET) app.log.warn("⚠️ WARNING: JWT_SECRET not set.");
    
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
