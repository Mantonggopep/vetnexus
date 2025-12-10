import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

export async function clientPortalRoutes(app: FastifyInstance) {
  
  // --- CLIENT LOGIN ---
  app.post('/login', async (request, reply) => {
    const { email, phone, password } = request.body as any;

    // Allow login by Email OR Phone
    const owner = await prisma.owner.findFirst({
      where: {
        OR: [
          { email: email || undefined },
          { phone: phone || undefined }
        ]
      }
    });

    if (!owner || !owner.passwordHash) {
      return reply.status(401).send({ error: 'Invalid credentials or portal not activated' });
    }

    if (!owner.isPortalActive) {
      return reply.status(403).send({ error: 'Portal access is disabled for this account' });
    }

    const isValid = await bcrypt.compare(password, owner.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // Update last login
    await prisma.owner.update({
      where: { id: owner.id },
      data: { lastLogin: new Date() }
    });

    const token = jwt.sign(
      { userId: owner.id, tenantId: owner.tenantId, type: 'CLIENT', name: owner.name },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return { token, user: { id: owner.id, name: owner.name, email: owner.email } };
  });

  // --- PROTECTED ROUTES (REQUIRE AUTHENTICATION) ---
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authenticate);

    // 1. Get Dashboard Data
    protectedRoutes.get('/dashboard', async (request, reply) => {
      const { id: ownerId } = (request as AuthenticatedRequest).user!;

      const [pets, appointments, unpaidInvoices] = await Promise.all([
        prisma.pet.findMany({ where: { ownerId } }),
        prisma.appointment.findMany({ 
          where: { ownerId, date: { gte: new Date() } },
          orderBy: { date: 'asc' },
          take: 5
        }),
        prisma.saleRecord.findMany({
          where: { ownerId, status: { in: ['Pending', 'Partial'] } }
        })
      ]);

      return { pets, appointments, unpaidInvoices };
    });

    // 2. My Pets & Records
    protectedRoutes.get('/pets', async (request, reply) => {
      const { id: ownerId } = (request as AuthenticatedRequest).user!;
      return prisma.pet.findMany({
        where: { ownerId },
        include: {
          labResults: { take: 5, orderBy: { requestDate: 'desc' } }
        }
      });
    });

    // 3. Book Appointment
    protectedRoutes.post('/appointments', async (request, reply) => {
      const { id: ownerId, tenantId } = (request as AuthenticatedRequest).user!;
      const { petId, date, reason } = request.body as any;

      const appointment = await prisma.appointment.create({
        data: {
          tenantId,
          ownerId,
          petId,
          date: new Date(date),
          reason,
          status: 'Requested' // Different from 'Scheduled' so staff sees it as a request
        }
      });
      return appointment;
    });

    // 4. Invoices & Payments
    protectedRoutes.get('/invoices', async (request, reply) => {
      const { id: ownerId } = (request as AuthenticatedRequest).user!;
      return prisma.saleRecord.findMany({
        where: { ownerId },
        orderBy: { date: 'desc' }
      });
    });

    // 5. Chat / Messages
    protectedRoutes.get('/messages', async (request, reply) => {
      const { id: ownerId } = (request as AuthenticatedRequest).user!;
      return prisma.message.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'asc' }
      });
    });

    protectedRoutes.post('/messages', async (request, reply) => {
      const { id: ownerId, tenantId } = (request as AuthenticatedRequest).user!;
      const { content } = request.body as any;

      return prisma.message.create({
        data: {
          tenantId,
          ownerId,
          senderType: 'Client',
          senderId: ownerId,
          content,
          isRead: false
        }
      });
    });

  });
}
