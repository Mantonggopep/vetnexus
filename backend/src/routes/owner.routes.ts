// backend/src/routes/owner.routes.ts (Fastify Version)
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

export async function ownerRoutes(app: FastifyInstance) {
  
  // Get Owners
  app.get('/', async (request, reply) => {
    // You might need middleware for tenantId here
    const owners = await prisma.owner.findMany({ 
        orderBy: { createdAt: 'desc' },
        include: { pets: true }
    });
    return owners;
  });

  // Create Owner
  app.post('/', async (request, reply) => {
    const { name, email, phone, address } = request.body as any;
    const clientNumber = `CL-${Math.floor(10000 + Math.random() * 90000)}`;
    
    const owner = await prisma.owner.create({
      data: {
        tenantId: 'system', // Replace with request.user.tenantId
        name, email, phone, address, clientNumber
      }
    });
    return owner;
  });

  // Update Portal Access
  app.patch('/:id/portal', async (request, reply) => {
    const { id } = request.params as any;
    const { password, isActive } = request.body as any;
    
    const updateData: any = { isPortalActive: isActive };
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.owner.update({
      where: { id },
      data: updateData
    });

    const { passwordHash, ...safe } = updated;
    return safe;
  });
}
