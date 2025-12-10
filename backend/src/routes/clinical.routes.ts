import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { createLog, checkLimits, trackStorage } from '../utils/serverHelpers';
import bcrypt from 'bcryptjs'; // Required for hashing client passwords

// Helper to handle String -> JSON conversion safely
const safeParse = (data: string | null, fallback: any = []) => {
    if (!data) return fallback;
    try {
        return JSON.parse(data);
    } catch (e) {
        return fallback;
    }
};

export async function clinicalRoutes(app: FastifyInstance) {
    
    // =========================================
    // 0. DUPLICATE CHECK
    // =========================================
    app.get('/owners/check-duplicate', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const { name, phone } = req.query as any;

        if (!name && !phone) return reply.send({ exists: false });

        const conditions: any[] = [];
        if (name) conditions.push({ name: { equals: name, mode: 'insensitive' } });
        if (phone) conditions.push({ phone: { contains: phone } }); 

        const existing = await prisma.owner.findFirst({
            where: {
                tenantId: user.tenantId,
                OR: conditions
            },
            select: { id: true, name: true, phone: true, clientNumber: true }
        });

        return reply.send({ 
            exists: !!existing, 
            match: existing 
        });
    });

    // =========================================
    // 1. OWNERS (CLIENTS)
    // =========================================
    app.get('/owners', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const owners = await prisma.owner.findMany({
            where: { tenantId: user.tenantId },
            include: { pets: true },
            orderBy: { createdAt: 'desc' }
        });
        return reply.send(owners);
    });

    // CREATE OWNER
    app.post('/owners', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const body = req.body as any;

        try {
            await checkLimits(user.tenantId, 'clients', 1);

            // --- ID GENERATION LOGIC ---
            const tenant = await prisma.tenant.findUnique({ 
                where: { id: user.tenantId },
                select: { name: true } 
            });

            let acronym = 'CL';
            if (tenant?.name) {
                const matches = tenant.name.match(/\b(\w)/g);
                if (matches) acronym = matches.join('').toUpperCase().substring(0, 3);
            }

            const now = new Date();
            const currentYear = now.getFullYear();
            const startOfYear = new Date(currentYear, 0, 1); 
            const nextYear = new Date(currentYear + 1, 0, 1);

            const yearlyCount = await prisma.owner.count({ 
                where: { 
                    tenantId: user.tenantId,
                    createdAt: { gte: startOfYear, lt: nextYear }
                } 
            });

            const nextSequence = yearlyCount + 1;
            const newClientNumber = `${acronym}/${nextSequence}/${currentYear}`;
            
            const owner = await prisma.owner.create({
                data: {
                    tenantId: user.tenantId,
                    name: body.name,
                    phone: body.phone,
                    email: body.email || null,
                    address: body.address || null,
                    clientNumber: newClientNumber,
                    createdAt: new Date(),
                    isPortalActive: false // Default to inactive
                }
            });

            await createLog(user.tenantId, user.name, 'Registered Client', 'admin', owner.name);
            return reply.send(owner);
        } catch (e: any) {
            return reply.status(403).send({ error: e.message });
        }
    });

    // UPDATE OWNER DETAILS
    app.patch('/owners/:id', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const { id } = req.params as any;
        const body = req.body as any;

        try {
            const updated = await prisma.owner.update({
                where: { id, tenantId: user.tenantId },
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

    // --- NEW: MANAGE CLIENT PORTAL ACCESS ---
    app.patch('/owners/:id/portal', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const { id } = req.params as any;
        const { password, isActive } = req.body as any;

        try {
            // Only Staff can do this (User type check is in middleware, but ensuring safety)
            if (user.type === 'CLIENT') {
                return reply.status(403).send({ error: "Clients cannot modify portal access." });
            }

            const updateData: any = { isPortalActive: isActive };
            
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                updateData.passwordHash = hashedPassword;
            }

            const updated = await prisma.owner.update({
                where: { id, tenantId: user.tenantId },
                data: updateData
            });

            await createLog(user.tenantId, user.name, 'Updated Client Portal Access', 'admin', updated.name);

            return reply.send({ 
                success: true, 
                isPortalActive: updated.isPortalActive,
                hasPassword: !!updated.passwordHash
            });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // DELETE OWNER
    app.delete('/owners/:id', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const { id } = req.params as any;

        try {
            const hasPets = await prisma.pet.count({ where: { ownerId: id } });
            if (hasPets > 0) {
                return reply.status(400).send({ error: "Cannot delete client. Please remove or reassign their pets first." });
            }

            await prisma.owner.delete({ where: { id, tenantId: user.tenantId } });
            await createLog(user.tenantId, user.name, 'Deleted Client', 'admin', id);
            
            return reply.send({ success: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // =========================================
    // 2. PATIENTS (PETS)
    // =========================================
    app.get('/patients', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        
        const patients = await prisma.pet.findMany({
            where: { tenantId: user.tenantId },
            include: { owner: true },
            orderBy: { name: 'asc' },
            take: 100
        });

        return reply.send(patients.map(p => ({
            ...p,
            vitalsHistory: safeParse(p.vitalsHistory),
            notes: safeParse(p.notes),
            allergies: safeParse(p.allergies),
            medicalConditions: safeParse(p.medicalConditions),
            reminders: safeParse(p.reminders),
            vaccinations: safeParse(p.vaccinations)
        })));
    });

    app.post('/patients', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const body = req.body as any;

        try {
            await checkLimits(user.tenantId, 'storage', 0.05);

            const initialVitals = body.initialWeight 
                ? [{ date: new Date().toISOString(), weightKg: Number(body.initialWeight) }] 
                : [];

            const patient = await prisma.pet.create({
                data: {
                    tenantId: user.tenantId,
                    ownerId: body.ownerId,
                    name: body.name,
                    species: body.species,
                    breed: body.breed || '',
                    age: Number(body.age || 0),
                    gender: body.gender,
                    type: body.type || 'Single',
                    color: body.color || '',
                    imageUrl: body.imageUrl || '',
                    allergies: JSON.stringify(body.allergies || []),
                    medicalConditions: JSON.stringify(body.medicalConditions || []),
                    vitalsHistory: JSON.stringify(initialVitals),
                    notes: "[]",
                    reminders: "[]",
                    vaccinations: "[]"
                }
            });

            await trackStorage(user.tenantId, 0.05);
            return reply.send({
                ...patient,
                vitalsHistory: initialVitals,
                allergies: body.allergies || [],
                medicalConditions: body.medicalConditions || []
            });

        } catch (e: any) {
            return reply.status(403).send({ error: e.message });
        }
    });

    app.delete('/patients/:id', { preHandler: [authenticate] }, async (req, reply) => {
        const { id } = req.params as any;
        await prisma.pet.delete({ where: { id } });
        return reply.send({ success: true });
    });

    // =========================================
    // 3. APPOINTMENTS
    // =========================================
    app.get('/appointments', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const appointments = await prisma.appointment.findMany({
            where: { tenantId: user.tenantId },
            include: { pet: true, owner: true },
            orderBy: { date: 'asc' }
        });
        return reply.send(appointments);
    });

    app.post('/appointments', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const body = req.body as any;

        try {
            const appt = await prisma.appointment.create({
                data: {
                    tenantId: user.tenantId,
                    ownerId: body.ownerId || null,
                    petId: body.petId || null,
                    walkInName: body.walkInName || null,
                    date: body.date,
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

    // =========================================
    // 4. CONSULTATIONS
    // =========================================
    app.get('/consultations', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const consults = await prisma.consultation.findMany({
            where: { tenantId: user.tenantId },
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

    app.post('/consultations', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const data = req.body as any;

        try {
            await checkLimits(user.tenantId, 'storage', 0.1);

            const consult = await prisma.consultation.upsert({
                where: { id: data.id || 'new_entry' },
                update: {
                    status: data.status,
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
                },
                create: {
                    tenantId: user.tenantId,
                    petId: data.petId,
                    ownerId: data.ownerId,
                    date: new Date(),
                    vetName: data.vetName || user.name,
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

            await createLog(user.tenantId, user.name, 'Consultation Saved', 'clinical');
            return reply.send(consult);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // =========================================
    // 5. LABS
    // =========================================
    app.get('/labs', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const labs = await prisma.labResult.findMany({
            where: { tenantId: user.tenantId },
            include: { pet: true },
            orderBy: { requestDate: 'desc' }
        });
        return reply.send(labs);
    });

    app.post('/labs', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const body = req.body as any;

        try {
            const lab = await prisma.labResult.create({
                data: {
                    tenantId: user.tenantId,
                    petId: body.petId,
                    testName: body.testName,
                    status: 'Pending',
                    cost: Number(body.cost || 0),
                    notes: body.notes,
                    requestedBy: user.name
                }
            });
            return reply.send(lab);
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.patch('/labs/:id', { preHandler: [authenticate] }, async (req, reply) => {
        const { id } = req.params as any;
        const body = req.body as any;

        const updated = await prisma.labResult.update({
            where: { id },
            data: {
                status: body.status,
                result: body.result,
                completionDate: body.status === 'Completed' ? new Date() : undefined,
                conductedBy: body.conductedBy,
                notes: body.notes
            }
        });
        return reply.send(updated);
    });
}
