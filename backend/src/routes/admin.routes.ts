import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import os from 'os';

export async function adminRoutes(app: FastifyInstance) {

    // --- INLINE AUTH CHECK (Prevents build errors) ---
    const requireAuth = async (req: any, reply: any) => {
        // In production, verify the JWT here. 
        // For now, we check if the header exists to prevent unauthorized requests
        if (!req.headers.authorization) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
    };
    
    // 1. GET ALL TENANTS
    app.get('/tenants', { preHandler: requireAuth }, async (req, reply) => {
        try {
            const tenants = await prisma.tenant.findMany({ 
                include: { 
                    _count: { select: { users: true, pets: true } } 
                }, 
                orderBy: { joinedDate: 'desc' } 
            });

            return reply.send(tenants.map(t => ({ 
                ...t, 
                settings: JSON.parse(t.settings || '{}'), 
                userCount: t._count.users, 
                patientCount: t._count.pets 
            })));
        } catch (e) {
            return reply.status(500).send({ error: 'Failed to fetch tenants' });
        }
    });

    // 2. GET ADMIN STATS
    app.get('/stats', { preHandler: requireAuth }, async (req, reply) => {
        try {
            const [tenants, usersCount, petsCount, plans] = await Promise.all([
                prisma.tenant.findMany(),
                prisma.user.count(),
                prisma.pet.count(),
                prisma.plan.findMany()
            ]);

            const activeTenants = tenants.filter(t => t.status === 'Active');
            
            const monthlyRevenue = activeTenants.reduce((acc, tenant) => {
                const plan = plans.find(p => p.id === tenant.plan);
                if (!plan) return acc;
                // Simple revenue calculation
                return acc + (tenant.billingPeriod === 'Yearly' ? (plan.priceYearly / 12) : plan.priceMonthly);
            }, 0);

            // System Load Mocks (OS module works on server)
            const cpuUsage = os.loadavg() ? Math.min(Math.round(os.loadavg()[0] * 10), 100) : 0;
            const memoryUsage = Math.round((1 - os.freemem() / os.totalmem()) * 100);

            return reply.send({ 
                totalClinics: tenants.length, 
                totalUsers: usersCount, 
                totalPatients: petsCount, 
                activeSubscriptions: activeTenants.length, 
                monthlyRevenue: Math.round(monthlyRevenue),
                systemLoad: { cpuUsage, memoryUsage }
            });
        } catch (e) {
            console.error(e);
            return reply.status(500).send({ error: "Failed to load stats" });
        }
    });

    // 3. CREATE TENANT
    app.post('/tenants', { preHandler: requireAuth }, async (req, reply) => {
        const data = req.body as any;
        try {
            const result = await prisma.$transaction(async (tx) => {
                if (await tx.user.findFirst({ where: { email: data.email } })) {
                    throw new Error("Admin email already exists in the system");
                }

                const tenant = await tx.tenant.create({ 
                    data: { 
                        name: data.clinicName, 
                        plan: data.plan || 'Trial', 
                        billingPeriod: data.billingPeriod || 'Monthly',
                        status: 'Active', 
                        settings: JSON.stringify({ 
                            name: data.clinicName, 
                            currency: data.country === 'Nigeria' ? 'NGN' : 'USD' 
                        }) 
                    } 
                });

                await tx.user.create({ 
                    data: { 
                        tenantId: tenant.id, 
                        name: data.name || data.adminName, 
                        email: data.email, 
                        passwordHash: await bcrypt.hash(data.password, 10), 
                        roles: JSON.stringify(['Admin', 'Veterinarian']),
                        isVerified: true
                    } 
                });

                return tenant;
            });
            return reply.send(result);
        } catch(e: any) { 
            return reply.status(400).send({ error: e.message }); 
        }
    });

    // 4. UPDATE TENANT
    app.patch('/tenants/:id', { preHandler: requireAuth }, async (req, reply) => {
        const { id } = req.params as any;
        const body = req.body as any;
        
        try {
            const updated = await prisma.tenant.update({ 
                where: { id }, 
                data: { 
                    status: body.status, 
                    plan: body.plan,
                    billingPeriod: body.billingPeriod 
                } 
            });
            return reply.send(updated);
        } catch (e) {
            return reply.status(500).send({ error: 'Update failed' });
        }
    });

    // 5. UPDATE PLANS (Admin Only)
    // Note: Public GET /plans is handled in server.ts
    app.patch('/plans/:id', { preHandler: requireAuth }, async (req, reply) => {
        const { id } = req.params as any;
        const body = req.body as any;

        try {
            const updatedPlan = await prisma.plan.update({
                where: { id },
                data: {
                    priceMonthly: body.priceMonthly,
                    priceYearly: body.priceYearly,
                    features: JSON.stringify(body.features || []), 
                    limits: JSON.stringify(body.limits || {})
                }
            });

            return reply.send(updatedPlan);
        } catch (error) {
            console.error("Error updating plan:", error);
            return reply.status(500).send({ error: "Failed to update plan" });
        }
    });
}
