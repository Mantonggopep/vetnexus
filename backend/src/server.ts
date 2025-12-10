import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { createLog, checkLimits } from '../utils/serverHelpers';
import bcrypt from 'bcryptjs';

export async function userRoutes(app: FastifyInstance) {
    
    // GET ALL USERS
    app.get('/', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        
        const users = await prisma.user.findMany({
            where: { tenantId: user.tenantId },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        });
        return reply.send(users);
    });

    // CREATE USER (Staff)
    app.post('/', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const body = req.body as any;

        if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return reply.status(403).send({ error: "Only Admins can create users" });
        }

        try {
            await checkLimits(user.tenantId, 'users', 1);

            const hashedPassword = await bcrypt.hash(body.password || 'welcome123', 10);

            const newUser = await prisma.user.create({
                data: {
                    tenantId: user.tenantId,
                    name: body.name,
                    email: body.email,
                    passwordHash: hashedPassword,
                    role: body.role || 'VET'
                }
            });

            await createLog(user.tenantId, user.name, 'Created Staff User', 'admin', newUser.name);
            
            const { passwordHash, ...safeUser } = newUser;
            return reply.send(safeUser);
        } catch (e: any) {
            return reply.status(403).send({ error: e.message });
        }
    });

    // DELETE USER
    app.delete('/:id', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const { id } = req.params as any;

        if (user.role !== 'ADMIN') return reply.status(403).send({ error: "Unauthorized" });
        if (id === user.id) return reply.status(400).send({ error: "Cannot delete yourself" });

        await prisma.user.delete({ where: { id, tenantId: user.tenantId } });
        await createLog(user.tenantId, user.name, 'Deleted User', 'admin');
        
        return reply.send({ success: true });
    });
}
