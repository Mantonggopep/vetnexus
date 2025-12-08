import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import os from 'os'; // Required for System Load stats

export async function adminRoutes(app: FastifyInstance) {
    
    // 1. GET ALL TENANTS
    app.get('/admin/tenants', { preHandler: [authenticate] }, async (req, reply) => {
        // Fetch tenants with counts for users and pets to display usage
        const tenants = await prisma.tenant.findMany({ 
            include: { 
                _count: { select: { users: true, pets: true } } 
            }, 
            orderBy: { joinedDate: 'desc' } 
        });

        // Map data to match Frontend "Tenant" interface
        return reply.send(tenants.map(t => ({ 
            ...t, 
            settings: JSON.parse(t.settings), 
            userCount: t._count.users, 
            patientCount: t._count.pets 
        })));
    });

    // 2. GET ADMIN STATS (Fixed Revenue Calculation)
    app.get('/admin/stats', { preHandler: [authenticate] }, async (req, reply) => {
        try {
            const tenants = await prisma.tenant.findMany();
            const activeTenants = tenants.filter(t => t.status === 'Active');
            
            // Fetch Plans to get real pricing
            const plans = await prisma.plan.findMany();

            // Calculate Monthly Revenue (MRR) based on Plan Price & Billing Cycle
            const monthlyRevenue = activeTenants.reduce((acc, tenant) => {
                const plan = plans.find(p => p.id === tenant.plan);
                if (!plan) return acc;

                // If billed Yearly, divide by 12 for MRR. If Monthly, take full price.
                if (tenant.billingPeriod === 'Yearly') {
                    return acc + (plan.priceYearly / 12);
                } else {
                    return acc + plan.priceMonthly;
                }
            }, 0);

            // Calculate System Resources (CPU/RAM)
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
            // safe check for cpu load
            const cpuUsage = os.loadavg() ? Math.min(Math.round(os.loadavg()[0] * 10), 100) : 0;

            return reply.send({ 
                totalClinics: tenants.length, 
                totalUsers: await prisma.user.count(), 
                totalPatients: await prisma.pet.count(), 
                activeSubscriptions: activeTenants.length, 
                monthlyRevenue: Math.round(monthlyRevenue), // Rounded MRR
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
                // Check for existing email globally to prevent duplicate admin accounts
                if (await tx.user.findFirst({ where: { email: data.email } })) {
                    throw new Error("Admin email already exists in the system");
                }

                // Create Tenant
                const tenant = await tx.tenant.create({ 
                    data: { 
                        name: data.clinicName, 
                        plan: data.plan, 
                        billingPeriod: data.billingPeriod || 'Monthly', // Capture Billing Period
                        status: 'Active', 
                        settings: JSON.stringify({ 
                            name: data.clinicName, 
                            currency: data.country === 'Nigeria' ? 'NGN' : 'USD' 
                        }) 
                    } 
                });

                // Create Admin User
                await tx.user.create({ 
                    data: { 
                        tenantId: tenant.id, 
                        name: data.name || data.adminName, 
                        email: data.email, 
                        passwordHash: await bcrypt.hash(data.password, 10), 
                        roles: JSON.stringify(['Admin', 'Veterinarian', 'SuperAdmin']) // Ensure Admin roles
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
                billingPeriod: body.billingPeriod // Allow updating billing period
            } 
        }));
    });
}