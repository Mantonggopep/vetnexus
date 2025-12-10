import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function patientRoutes(app: FastifyInstance) {
  
  // GET ALL PATIENTS
  app.get('/', async (request, reply) => {
    try {
      const pets = await prisma.pet.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return reply.send(pets);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch patients' });
    }
  });

  // CREATE PATIENT
  app.post('/', async (request, reply) => {
    const { 
      name, species, breed, age, gender, 
      ownerId, color, allergies 
    } = request.body as any;

    try {
      const pet = await prisma.pet.create({
        data: {
          tenantId: 'system', // Replace with request.user.tenantId if auth enabled
          name,
          species,
          breed,
          age: Number(age) || 0,
          gender,
          ownerId,
          color,
          // 'initialWeight' removed because it doesn't exist in your Prisma Schema
          allergies: Array.isArray(allergies) ? JSON.stringify(allergies) : (allergies || "[]"),
          imageUrl: `https://ui-avatars.com/api/?name=${name}&background=random`
        }
      });
      return reply.send(pet);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Failed to create patient' });
    }
  });
}
