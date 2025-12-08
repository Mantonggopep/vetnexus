import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import os from 'os';

export async function adminRoutes(app: FastifyInstance) {
    
    // 1. GET ALL TENANTS
    app.get('/admin/tenants', { preHandler: [authenticate] }, async (req, reply) => {
        const tenants = await prisma.tenant.findMany({ 
            include: { 
                _count: { select: { users: true, pets: true } } 
            }, 
            orderBy: { joinedDate: 'desc' } 
        });

        return reply.send(tenants.map(t => ({ 
            ...t, 
            settings: JSON.parse(t.settings), 
            userCount: t._count.users, 
            patientCount: t._count.pets 
        })));
    });

    // 2. GET ADMIN STATS
    app.get('/admin/stats', { preHandler: [authenticate] }, async (req, reply) => {
        try {
            const tenants = await prisma.tenant.findMany();
            const activeTenants = tenants.filter(t => t.status === 'Active');
            
            const plans = await prisma.plan.findMany();

            const monthlyRevenue = activeTenants.reduce((acc, tenant) => {
                const plan = plans.find(p => p.id === tenant.plan);
                if (!plan) return acc;

                if (tenant.billingPeriod === 'Yearly') {
                    return acc + (plan.priceYearly / 12);
                } else {
                    return acc + plan.priceMonthly;
                }
            }, 0);

            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
            const cpuUsage = os.loadavg() ? Math.min(Math.round(os.loadavg()[0] * 10), 100) : 0;

            return reply.send({ 
                totalClinics: tenants.length, 
                totalUsers: await prisma.user.count(), 
                totalPatients: await prisma.pet.count(), 
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
    app.post('/admin/tenants', { preHandler: [authenticate] }, async (req, reply) => {
        const data = req.body as any;
        try {
            const result = await prisma.$transaction(async (tx) => {
                if (await tx.user.findFirst({ where: { email: data.email } })) {
                    throw new Error("Admin email already exists in the system");
                }

                const tenant = await tx.tenant.create({ 
                    data: { 
                        name: data.clinicName, 
                        plan: data.plan, 
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
                        // ✅ FIX: Removed 'SuperAdmin' from the roles list
                        roles: JSON.stringify(['Admin', 'Veterinarian']) 
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
    app.patch('/admin/tenants/:id', { preHandler: [authenticate] }, async (req, reply) => {
        const { id } = req.params as any;
        const body = req.body as any;
        
        return reply.send(await prisma.tenant.update({ 
            where: { id }, 
            data: { 
                status: body.status, 
                plan: body.plan,
                billingPeriod: body.billingPeriod 
            } 
        }));
    });

    // =========================================================
    // 5. PLAN ROUTES
    // =========================================================

    // GET /api/plans
    app.get('/plans', async (req, reply) => {
        try {
            const plans = await prisma.plan.findMany({
                orderBy: { priceMonthly: 'asc' }
            });

            const formattedPlans = plans.map(p => ({
                id: p.id,
                name: p.name,
                price: {
                    Monthly: p.priceMonthly,
                    Yearly: p.priceYearly
                },
                features: JSON.parse(p.features), 
                limits: JSON.parse(p.limits)      
            }));

            return reply.send(formattedPlans);
        } catch (error) {
            console.error("Error fetching plans:", error);
            return reply.status(500).send({ error: "Failed to fetch plans" });
        }
    });

    // PATCH /api/plans/:id
    app.patch('/plans/:id', { preHandler: [authenticate] }, async (req, reply) => {
        const { id } = req.params as any;
        const body = req.body as any;

        try {
            const updatedPlan = await prisma.plan.update({
                where: { id },
                data: {
                    priceMonthly: body.priceMonthly,
                    priceYearly: body.priceYearly,
                    features: JSON.stringify(body.features), 
                    limits: JSON.stringify(body.limits)
                }
            });

            return reply.send(updatedPlan);
        } catch (error) {
            console.error("Error updating plan:", error);
            return reply.status(500).send({ error: "Failed to update plan" });
        }
    });
}
