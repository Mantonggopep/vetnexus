import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

// Helper for safe JSON parsing
const safeParse = (data: string | null, fallback: any = []) => {
    if (!data) return fallback;
    try { return JSON.parse(data); } catch (e) { return fallback; }
};

export async function clinicalRoutes(app: FastifyInstance) {

    // --- INLINE AUTH CHECK ---
    const requireAuth = async (req: any, reply: any) => {
        // In a real app, verify JWT here
        if (!req.headers.authorization) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
    };

    // ==========================
    // APPOINTMENTS
    // ==========================
    app.get('/appointments', { preHandler: requireAuth }, async (req, reply) => {
        const appointments = await prisma.appointment.findMany({
            include: { pet: true, owner: true },
            orderBy: { date: 'asc' }
        });
        return reply.send(appointments);
    });

    app.post('/appointments', { preHandler: requireAuth }, async (req, reply) => {
        const body = req.body as any;
        try {
            const appt = await prisma.appointment.create({
                data: {
                    tenantId: 'system', // Replace with req.user.tenantId
                    ownerId: body.ownerId || null,
                    petId: body.petId || null,
                    walkInName: body.walkInName || null,
                    date: new Date(body.date),
                    reason: body.reason,
                    status: body.status || 'Scheduled',
                    doctorName: body.doctorName
                }
            });
            return reply.send(appt);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ==========================
    // CONSULTATIONS
    // ==========================
    app.get('/consultations', { preHandler: requireAuth }, async (req, reply) => {
        const consults = await prisma.consultation.findMany({
            include: { pet: true, owner: true },
            orderBy: { date: 'desc' },
            take: 50
        });

        return reply.send(consults.map(c => ({
            ...c,
            vitals: safeParse(c.vitals, {}),
            exam: safeParse(c.exam, {}),
            diagnosis: safeParse(c.diagnosis, {}),
            labRequests: safeParse(c.labRequests, []),
            prescription: safeParse(c.prescription, []),
            attachments: safeParse(c.attachments, []),
            financials: safeParse(c.financials, {})
        })));
    });

    app.post('/consultations', { preHandler: requireAuth }, async (req, reply) => {
        const data = req.body as any;
        try {
            const consult = await prisma.consultation.create({
                data: {
                    tenantId: 'system',
                    petId: data.petId,
                    ownerId: data.ownerId,
                    date: new Date(),
                    vetName: data.vetName || 'Staff',
                    status: data.status || 'Draft',
                    chiefComplaint: data.chiefComplaint,
                    history: data.history,
                    plan: data.plan,
                    vitals: JSON.stringify(data.vitals || {}),
                    exam: JSON.stringify(data.exam || {}),
                    diagnosis: JSON.stringify(data.diagnosis || {}),
                    labRequests: JSON.stringify(data.labRequests || []),
                    prescription: JSON.stringify(data.prescription || []),
                    attachments: JSON.stringify(data.attachments || []),
                    financials: JSON.stringify(data.financials || {})
                }
            });
            return reply.send(consult);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // ==========================
    // LABS
    // ==========================
    app.get('/labs', { preHandler: requireAuth }, async (req, reply) => {
        const labs = await prisma.labResult.findMany({
            include: { pet: true },
            orderBy: { requestDate: 'desc' }
        });
        return reply.send(labs);
    });

    app.post('/labs', { preHandler: requireAuth }, async (req, reply) => {
        const body = req.body as any;
        try {
            const lab = await prisma.labResult.create({
                data: {
                    tenantId: 'system',
                    petId: body.petId,
                    testName: body.testName,
                    status: 'Pending',
                    cost: Number(body.cost || 0),
                    notes: body.notes,
                    requestedBy: 'System'
                }
            });
            return reply.send(lab);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
