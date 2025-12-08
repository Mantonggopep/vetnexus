import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';
import { DEFAULT_PLANS } from './utils/serverHelpers';

// Route Imports
import { authRoutes } from './routes/auth.routes';
import { adminRoutes } from './routes/admin.routes';
import { userRoutes } from './routes/user.routes';
import { clinicalRoutes } from './routes/clinical.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { aiRoutes } from './routes/ai.routes';

const app: FastifyInstance = Fastify({ 
  logger: process.env.NODE_ENV !== 'production',
  bodyLimit: 1048576 * 10 // 10MB
});

const PORT = parseInt(process.env.PORT || '4000');

// --- PLUGINS ---
app.register(helmet, { contentSecurityPolicy: false, global: true });

// --- UPDATED CORS CONFIGURATION ---
app.register(cors, {
  origin: (origin, cb) => {
    // 1. Allow mobile apps or non-browser tools (no origin)
    if (!origin) return cb(null, true);

    // 2. Define strict allowed origins (Localhost + Main Production Domain)
    const allowedExact = [
      'http://localhost:5173', 
      'http://localhost:4173', 
      'https://vetnexuspro.vercel.app', 
      process.env.CLIENT_URL?.replace(/\/$/, '') // Remove trailing slash if present
    ].filter(Boolean);

    // 3. Check Exact Match
    if (allowedExact.includes(origin)) {
      return cb(null, true);
    }

    // 4. ✅ FIX: Allow ALL Vercel Preview URLs (Dynamic)
    // This allows https://vetnexuspro-git-main... etc.
    if (origin.endsWith('.vercel.app')) {
      return cb(null, true);
    }

    // 5. Dev Mode fallback
    if (process.env.NODE_ENV !== 'production') {
      console.log(`⚠️ Dev CORS Allowed: ${origin}`);
      return cb(null, true);
    }

    // Block everything else
    console.warn(`🚫 Blocked CORS request from: ${origin}`);
    return cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true, // Required for Cookies/Auth Headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
});

app.register(cookie, { 
  secret: process.env.COOKIE_SECRET || 'super-secret', 
  hook: 'onRequest',
  parseOptions: {} 
});

// --- REGISTER ROUTES ---
app.register(async (api) => {
    // Health Check
    api.get('/health', async () => { return { status: 'ok', timestamp: new Date() } });

    api.register(authRoutes);
    api.register(adminRoutes);
    api.register(userRoutes);
    api.register(clinicalRoutes);
    api.register(inventoryRoutes);
    api.register(aiRoutes, { prefix: '/ai' }); 
}, { prefix: '/api' });


// --- START & SEED ---
const start = async () => {
  try {
    if (!process.env.JWT_SECRET) console.warn("⚠️ WARNING: JWT_SECRET not set.");
    if (!process.env.DATABASE_URL) console.warn("⚠️ WARNING: DATABASE_URL not set.");

    await prisma.$connect();
    console.log("✅ Connected to Database");

    // Seed Plans
    for (const p of DEFAULT_PLANS) {
        await prisma.plan.upsert({ where: { id: p.id }, update: p, create: p });
    }
    console.log("✅ Plans Seeded");

    // Seed System Tenant & Super Admin
    const systemTenant = await prisma.tenant.upsert({ 
        where: { id: 'system' }, 
        update: {}, 
        create: { id: 'system', name: 'System Admin', plan: 'Enterprise', settings: '{}', storageUsed: 0 } 
    });

    const adminEmail = 'mantonggopep@gmail.com'; // Change this if needed
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail }});
    
    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('12doctor12', 10);
        await prisma.user.create({
            data: { 
                tenantId: systemTenant.id, 
                name: 'Super Admin', 
                email: adminEmail, 
                passwordHash: hashedPassword, 
                roles: JSON.stringify(['SuperAdmin']) 
            }
        });
        console.log("✅ Super Admin Created");
    }

    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on port ${PORT}`);

  } catch (err) { 
    console.error("🔥 FAILED TO START SERVER:", err); 
    process.exit(1); 
  }
};

start();
