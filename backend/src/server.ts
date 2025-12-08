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
import { aiRoutes } from './routes/ai.routes'; // <--- NEW IMPORT

const app: FastifyInstance = Fastify({ logger: process.env.NODE_ENV !== 'production' });
const PORT = parseInt(process.env.PORT || '4000');

// --- PLUGINS ---
app.register(helmet, { contentSecurityPolicy: false, global: true });
app.register(cors, {
  origin: (origin, cb) => {
    // Allow localhost:5173, localhost:4173, and specific CLIENT_URL
    const allowed = ['http://localhost:5173', 'http://localhost:4173', process.env.CLIENT_URL].filter(Boolean);
    if (!origin || allowed.includes(origin) || process.env.NODE_ENV !== 'production') return cb(null, true);
    return cb(new Error("Not allowed"), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
});
app.register(cookie, { secret: process.env.COOKIE_SECRET || 'super-secret', hook: 'onRequest' });

// --- REGISTER ROUTES ---
// Prefix all with /api
app.register(async (api) => {
    api.register(authRoutes);
    api.register(adminRoutes);
    api.register(userRoutes);
    api.register(clinicalRoutes);
    api.register(inventoryRoutes);
    
    // Register AI routes (URL becomes /api/ai/...)
    api.register(aiRoutes, { prefix: '/ai' }); 
}, { prefix: '/api' });


// --- START & SEED ---
const start = async () => {
  try {
    if (!process.env.JWT_SECRET) console.warn("WARNING: JWT_SECRET not set.");

    // Seed Plans
    for (const p of DEFAULT_PLANS) {
        await prisma.plan.upsert({ where: { id: p.id }, update: p, create: p });
    }

    // Seed Super Admin
    const systemTenant = await prisma.tenant.upsert({ 
        where: { id: 'system' }, 
        update: {}, 
        create: { id: 'system', name: 'System Admin', plan: 'Enterprise', settings: '{}', storageUsed: 0 } 
    });

    const adminEmail = 'mantonggopep@gmail.com';
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: { tenantId: systemTenant.id },
        create: { 
            tenantId: systemTenant.id, name: 'Super Admin', email: adminEmail, 
            passwordHash: await bcrypt.hash('12doctor12', 10), roles: JSON.stringify(['SuperAdmin']) 
        }
    });

    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on port ${PORT}`);
  } catch (err) { app.log.error(err); (process as any).exit(1); }
};

start();