import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

// Get all owners (for the Clients list)
router.get('/', async (req, res) => {
  try {
    const owners = await prisma.owner.findMany({
      orderBy: { createdAt: 'desc' },
      include: { pets: true } // Include pets for the list count
    });
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch owners' });
  }
});

// Create a new Owner (Fixes "Add Client" modal)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    
    // Generate a random Client ID
    const clientNumber = `CL-${Math.floor(10000 + Math.random() * 90000)}`;

    const owner = await prisma.owner.create({
      data: {
        tenantId: 'system', // Replace with req.user.tenantId if using auth
        name,
        email,
        phone,
        address,
        clientNumber
      }
    });
    res.json(owner);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create owner' });
  }
});

// ACTIVATE PORTAL (Fixes "Configure Portal Access" button)
router.patch('/:id/portal', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, isActive } = req.body;

    const updateData: any = {
      isPortalActive: isActive
    };

    // Only hash password if it was provided
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

    const updatedOwner = await prisma.owner.update({
      where: { id },
      data: updateData
    });

    // Return owner without sending back the password hash
    const { passwordHash, ...safeOwner } = updatedOwner;
    res.json(safeOwner);
  } catch (error) {
    console.error("Portal Update Error:", error);
    res.status(500).json({ error: 'Failed to update portal access' });
  }
});

export default router;
