import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

// --- TYPES ---
interface ClientUser {
  userId: string;
  tenantId: string;
  type: 'CLIENT';
  name: string;
}

// Extend FastifyRequest to include user
interface ClientRequest extends FastifyRequest {
  user?: ClientUser;
}

export async function clientPortalRoutes(app: FastifyInstance) {
  
  // =================================================================
  // PUBLIC: LOGIN
  // =================================================================
  app.post('/login', async (request, reply) => {
    const { email, phone, password } = request.body as any;

    try {
      // 1. Find Owner by Email OR Phone
      const owner = await prisma.owner.findFirst({
        where: {
          OR: [
            { email: email || undefined },
            { phone: phone || undefined }
          ]
        }
      });

      // 2. Validate User & Portal Status
      if (!owner || !owner.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials or portal not configured' });
      }

      if (!owner.isPortalActive) {
        return reply.status(403).send({ error: 'Portal access is disabled for this account' });
      }

      // 3. Validate Password
      const isValid = await bcrypt.compare(password, owner.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // 4. Update Last Login
      await prisma.owner.update({
        where: { id: owner.id },
        data: { lastLogin: new Date() }
      });

      // 5. Generate Token
      const token = jwt.sign(
        { userId: owner.id, tenantId: owner.tenantId, type: 'CLIENT', name: owner.name },
        process.env.JWT_SECRET || 'super-secret-key',
        { expiresIn: '7d' }
      );

      // 6. Set Cookie
      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // 'lax' is better for navigation than 'strict'
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return reply.send({ 
        token, 
        user: { id: owner.id, name: owner.name, email: owner.email } 
      });

    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // =================================================================
  // PROTECTED ROUTES
  // =================================================================
  app.register(async (protectedRoutes) => {
    
    // --- INLINE AUTHENTICATION HOOK ---
    // This ensures we don't rely on external middleware files that might be broken
    protectedRoutes.addHook('preHandler', async (request: ClientRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;
        const cookieToken = request.cookies.token;
        
        let token;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        } else if (cookieToken) {
          token = cookieToken;
        }

        if (!token) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key') as ClientUser;
        request.user = decoded; // Attach user to request
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }
    });

    // 1. Get Dashboard Data
    protectedRoutes.get('/dashboard', async (request: ClientRequest, reply) => {
      const { userId: ownerId } = request.user!;

      const [pets, appointments, unpaidInvoices] = await Promise.all([
        prisma.pet.findMany({ where: { ownerId } }),
        prisma.appointment.findMany({ 
          where: { ownerId, date: { gte: new Date() } },
          orderBy: { date: 'asc' },
          take: 5
        }),
        prisma.saleRecord.findMany({
          where: { ownerId, status: { in: ['Pending', 'Partial'] } } // Ensure 'Pending' matches your Schema Enum
        })
      ]);

      return { pets, appointments, unpaidInvoices };
    });

    // 2. My Pets & Records
    protectedRoutes.get('/pets', async (request: ClientRequest, reply) => {
      const { userId: ownerId } = request.user!;
      return prisma.pet.findMany({
        where: { ownerId },
        include: {
          labResults: { take: 5, orderBy: { requestDate: 'desc' } }
        }
      });
    });

    // 3. Book Appointment
    protectedRoutes.post('/appointments', async (request: ClientRequest, reply) => {
      const { userId: ownerId, tenantId } = request.user!;
      const { petId, date, reason } = request.body as any;

      try {
        const appointment = await prisma.appointment.create({
          data: {
            tenantId,
            ownerId,
            petId,
            date: new Date(date),
            reason,
            status: 'Scheduled', // Use a valid status from your Prisma Enum
            doctorName: 'Pending Assignment' 
          }
        });
        return appointment;
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to book appointment' });
      }
    });

    // 4. Invoices & Payments
    protectedRoutes.get('/invoices', async (request: ClientRequest, reply) => {
      const { userId: ownerId } = request.user!;
      return prisma.saleRecord.findMany({
        where: { ownerId },
        orderBy: { date: 'desc' }
      });
    });

    // 5. Chat / Messages
    protectedRoutes.get('/messages', async (request: ClientRequest, reply) => {
      const { userId: ownerId } = request.user!;
      // Ensure 'Message' model exists in prisma.schema
      // If it doesn't, this will throw an error. 
      // Assuming you added the Message model in previous steps:
      return prisma.message.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'asc' }
      });
    });

    protectedRoutes.post('/messages', async (request: ClientRequest, reply) => {
      const { userId: ownerId, tenantId } = request.user!;
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
