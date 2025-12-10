import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

export async function ownerRoutes(app: FastifyInstance) {

    const requireAuth = async (req: any, reply: any) => {
        if (!req.headers.authorization) reply.status(401).send({ error: 'Unauthorized' });
    };

    // 0. DUPLICATE CHECK
    app.get('/check-duplicate', { preHandler: requireAuth }, async (req, reply) => {
        const { name, phone } = req.query as any;
        if (!name && !phone) return reply.send({ exists: false });

        const conditions: any[] = [];
        if (name) conditions.push({ name: { equals: name, mode: 'insensitive' } });
        if (phone) conditions.push({ phone: { contains: phone } }); 

        const existing = await prisma.owner.findFirst({
            where: { OR: conditions },
            select: { id: true, name: true, phone: true }
        });

        return reply.send({ exists: !!existing, match: existing });
    });

    // 1. GET ALL OWNERS
    app.get('/', { preHandler: requireAuth }, async (req, reply) => {
        const owners = await prisma.owner.findMany({
            include: { pets: true },
            orderBy: { createdAt: 'desc' }
        });
        return reply.send(owners);
    });

    // 2. CREATE OWNER
    app.post('/', { preHandler: requireAuth }, async (req, reply) => {
        const body = req.body as any;
        try {
            const clientNumber = `CL-${Math.floor(10000 + Math.random() * 90000)}`;
            const owner = await prisma.owner.create({
                data: {
                    tenantId: 'system',
                    name: body.name,
                    phone: body.phone,
                    email: body.email || null,
                    address: body.address || null,
                    clientNumber,
                    createdAt: new Date(),
                    isPortalActive: false
                }
            });
            return reply.send(owner);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // 3. UPDATE OWNER
    app.patch('/:id', { preHandler: requireAuth }, async (req, reply) => {
        const { id } = req.params as any;
        const body = req.body as any;
        try {
            const updated = await prisma.owner.update({
                where: { id },
                data: {
                    email: body.email,
                    phone: body.phone,
                    address: body.address,
                    name: body.name
                }
            });
            return reply.send(updated);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // 4. MANAGE PORTAL ACCESS
    app.patch('/:id/portal', { preHandler: requireAuth }, async (req, reply) => {
        const { id } = req.params as any;
        const { password, isActive } = req.body as any;
        try {
            const updateData: any = { isPortalActive: isActive };
            if (password) {
                updateData.passwordHash = await bcrypt.hash(password, 10);
            }
            const updated = await prisma.owner.update({
                where: { id },
                data: updateData
            });
            return reply.send({ success: true, isPortalActive: updated.isPortalActive });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // 5. DELETE OWNER
    app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
        const { id } = req.params as any;
        try {
            const hasPets = await prisma.pet.count({ where: { ownerId: id } });
            if (hasPets > 0) return reply.status(400).send({ error: "Cannot delete client. Remove pets first." });
            await prisma.owner.delete({ where: { id } });
            return reply.send({ success: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
