import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { createLog, checkLimits } from '../utils/serverHelpers';

export async function userRoutes(app: FastifyInstance) {
    // Settings
    app.patch('/settings', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const body = req.body as any;
        const updated = await prisma.tenant.update({ where: { id: user.tenantId }, data: { settings: JSON.stringify(body), ...(body.name && { name: body.name }) } });
        await createLog(user.tenantId, user.name, 'Updated Settings', 'system');
        return reply.send({ ...updated, settings: JSON.parse(updated.settings) });
    });

    // Logs
    app.get('/logs', { preHandler: [authenticate] }, async (req, reply) => {
        const tenantId = (req as AuthenticatedRequest).user!.tenantId;
        return reply.send(await prisma.log.findMany({ where: { tenantId }, orderBy: { timestamp: 'desc' }, take: 200 }));
    });

    // Users
    app.get('/users', { preHandler: [authenticate] }, async (req, reply) => {
        const tenantId = (req as AuthenticatedRequest).user!.tenantId;
        const users = await prisma.user.findMany({ where: { tenantId }, select: { id: true, name: true, email: true, roles: true, avatarUrl: true, isSuspended: true } });
        return reply.send(users.map(u => ({ ...u, roles: JSON.parse(u.roles) })));
    });

    app.post('/users', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const body = req.body as any;
        try {
            await checkLimits(user.tenantId, 'users', 1);
            const newUser = await prisma.user.create({
                data: { tenantId: user.tenantId, name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 10), roles: JSON.stringify(body.roles), isSuspended: body.isSuspended || false }
            });
            await createLog(user.tenantId, user.name, 'Created User', 'admin', `Created: ${body.name}`);
            return reply.send({ ...newUser, roles: JSON.parse(newUser.roles) });
        } catch (e: any) { return reply.status(403).send({ error: e.message }); }
    });

    // Branches
    app.get('/branches', { preHandler: [authenticate] }, async (req, reply) => {
        const tenantId = (req as AuthenticatedRequest).user!.tenantId;
        const branches = await prisma.tenant.findMany({ where: { parentId: tenantId } });
        return reply.send(branches.map(b => ({ ...b, settings: JSON.parse(b.settings) })));
    });
}