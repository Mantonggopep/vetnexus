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
  logger: process.env.NODE_ENV !== 'production' 
});

const PORT = parseInt(process.env.PORT || '4000');

// --- PLUGINS ---
app.register(helmet, { contentSecurityPolicy: false, global: true });

app.register(cors, {
  origin: (origin, cb) => {
    // defined allowed origins
    const allowed = [
      'http://localhost:5173', 
      'http://localhost:4173', 
      process.env.CLIENT_URL
    ].filter((url): url is string => !!url); // Type-safe filter

    // Allow requests with no origin (like mobile apps or curl) or if origin is in allow list
    if (!origin || allowed.includes(origin) || process.env.NODE_ENV !== 'production') {
      return cb(null, true);
    }
    return cb(new Error("Not allowed"), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
});

app.register(cookie, { 
  secret: process.env.COOKIE_SECRET || 'super-secret', 
  hook: 'onRequest' 
});

// --- REGISTER ROUTES ---
// Prefix all with /api
app.register(async (api) => {
    api.register(authRoutes);
    api.register(adminRoutes); // Make sure this file has the GET /plans route!
    api.register(userRoutes);
    api.register(clinicalRoutes);
    api.register(inventoryRoutes);
    
    // Register AI routes
    api.register(aiRoutes, { prefix: '/ai' }); 
}, { prefix: '/api' });


// --- START & SEED ---
const start = async () => {
  try {
    if (!process.env.JWT_SECRET) console.warn("WARNING: JWT_SECRET not set.");
    if (!process.env.DATABASE_URL) console.warn("WARNING: DATABASE_URL not set.");

    // 1. Connect to DB first to ensure it's alive
    await prisma.$connect();
    console.log("✅ Connected to Database");

    // 2. Seed Plans
    // This is the CRITICAL part that fixes your empty plans issue
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
    // Check if admin exists to avoid re-hashing password every restart
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

  } catch (err) { 
    // Use console.error to ensure it shows in Render logs before exit
    console.error("🔥 FAILED TO START SERVER:", err); 
    process.exit(1); 
  }
};

start();
