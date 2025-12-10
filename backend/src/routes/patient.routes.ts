import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get all patients
router.get('/', async (req, res) => {
  try {
    const pets = await prisma.pet.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(pets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Create a new Patient (Fixes "Add Pet" button)
router.post('/', async (req, res) => {
  try {
    const { 
      name, species, breed, age, gender, 
      ownerId, color, initialWeight, allergies 
    } = req.body;

    const pet = await prisma.pet.create({
      data: {
        tenantId: 'system', // Replace with actual tenant ID logic
        name,
        species,
        breed,
        age: Number(age),
        gender,
        ownerId,
        color,
        // Store weight in vitals history JSON or separate field if you added it
        initialWeight: Number(initialWeight), 
        allergies: JSON.stringify(allergies || []), // Prisma stores JSON strings for simple arrays if defined as String
        imageUrl: `https://ui-avatars.com/api/?name=${name}&background=random`
      }
    });
    res.json(pet);
  } catch (error) {
    console.error("Create Pet Error:", error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

export default router;
