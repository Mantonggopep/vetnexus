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
  // Increase payload limit if you are uploading images/files
  bodyLimit: 1048576 * 10 // 10MB
});

const PORT = parseInt(process.env.PORT || '4000');

// --- PLUGINS ---
app.register(helmet, { contentSecurityPolicy: false, global: true });

// --- CRITICAL CORS FIX ---
app.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = [
      'http://localhost:5173', 
      'http://localhost:4173', 
      'https://vetnexuspro.vercel.app', // Hardcoded to ensure Vercel works
      process.env.CLIENT_URL // Fallback from env vars
    ];

    // Remove undefined/null and normalize (remove trailing slashes)
    const cleanOrigins = allowedOrigins
      .filter((url): url is string => !!url)
      .map(url => url.replace(/\/$/, ''));

    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return cb(null, true);

    if (cleanOrigins.includes(origin)) {
      return cb(null, true);
    }

    // Development fallback: Allow all if not in production
    if (process.env.NODE_ENV !== 'production') {
      return cb(null, true);
    }

    console.warn(`Blocked CORS request from: ${origin}`);
    return cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true, // REQUIRED for cookies/sessions to work
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
});

app.register(cookie, { 
  secret: process.env.COOKIE_SECRET || 'super-secret', 
  hook: 'onRequest',
  parseOptions: {} 
});

// --- REGISTER ROUTES ---
// Prefix all with /api
app.register(async (api) => {
    // Health Check Endpoint (useful for Render to know app is alive)
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

    // 1. Connect to DB first
    await prisma.$connect();
    console.log("✅ Connected to Database");

    // 2. Seed Plans
    for (const p of DEFAULT_PLANS) {
        await prisma.plan.upsert({ where: { id: p.id }, update: p, create: p });
    }
    console.log("✅ Plans Seeded");

    // 3. Seed Super Admin
    const systemTenant = await prisma.tenant.upsert({ 
        where: { id: 'system' }, 
        update: {}, 
        create: { id: 'system', name: 'System Admin', plan: 'Enterprise', settings: '{}', storageUsed: 0 } 
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
                roles: JSON.stringify(['SuperAdmin']) 
            }
        });
        console.log("✅ Super Admin Created");
    }

    // 4. Listen on 0.0.0.0 (Required for Render)
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Accepting requests from: https://vetnexuspro.vercel.app`);

  } catch (err) { 
    app.log.error(err);
    console.error("🔥 FAILED TO START SERVER:", err); 
    process.exit(1); 
  }
};

start();
