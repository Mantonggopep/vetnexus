import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function plansRoutes(app: FastifyInstance) {
    
    // GET /api/plans
    app.get('/', async (req, reply) => {
        try {
            // 1. Try to fetch from Database
            const plans = await prisma.plan.findMany({
                orderBy: { priceMonthly: 'asc' }
            });

            // 2. If Database is empty, return these Defaults (So your UI doesn't break)
            if (plans.length === 0) {
                return reply.send([
                    {
                        id: 'basic-plan',
                        name: 'Basic',
                        priceMonthly: 29,
                        priceYearly: 290,
                        features: JSON.stringify(['2 Staff Members', '500 Client Records', 'Basic Support']),
                        limits: JSON.stringify({ staff: 2, clients: 500, storage: 5 })
                    },
                    {
                        id: 'pro-plan',
                        name: 'Pro',
                        priceMonthly: 79,
                        priceYearly: 790,
                        features: JSON.stringify(['5 Staff Members', 'Unlimited Clients', 'Priority Support', 'Email Reminders']),
                        limits: JSON.stringify({ staff: 5, clients: 999999, storage: 20 })
                    },
                    {
                        id: 'enterprise-plan',
                        name: 'Enterprise',
                        priceMonthly: 149,
                        priceYearly: 1490,
                        features: JSON.stringify(['Unlimited Staff', 'Analytics', '24/7 Support', 'SMS Reminders']),
                        limits: JSON.stringify({ staff: 999, clients: 999999, storage: 100 })
                    }
                ]);
            }

            return reply.send(plans);
        } catch (error) {
            console.error("Error fetching plans:", error);
            return reply.status(500).send({ error: "Failed to fetch plans" });
        }
    });
}
