import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs'; // Make sure you have installed: npm install bcryptjs @types/bcryptjs
import { authenticate, authorize } from '../middleware/auth'; // Assuming you have these

const router = Router();
const prisma = new PrismaClient();

// Get All Owners
router.get('/', authenticate, async (req, res) => {
  try {
    const owners = await prisma.owner.findMany({
      where: { tenantId: req.user?.tenantId },
      orderBy: { createdAt: 'desc' },
      include: { pets: true } // Optional: include pets for quick count
    });
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch owners' });
  }
});

// Create Owner
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const owner = await prisma.owner.create({
      data: {
        tenantId: req.user!.tenantId,
        name,
        email,
        phone,
        address,
        clientNumber: `CL-${Math.floor(1000 + Math.random() * 9000)}` // Simple ID generation
      }
    });
    res.json(owner);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create owner' });
  }
});

// --- THIS IS THE NEW LOGIC YOU NEED ---
// Update Portal Access (Toggle access & Set Password)
router.patch('/:id/portal', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { password, isActive } = req.body;
    
    const updateData: any = {
      isPortalActive: isActive
    };

    // Only hash and update password if a new one is provided
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

    const updatedOwner = await prisma.owner.update({
      where: { 
        id,
        tenantId: req.user?.tenantId // Security: Ensure owner belongs to tenant
      },
      data: updateData
    });

    // Don't send the password hash back
    const { passwordHash, ...safeOwner } = updatedOwner;
    res.json(safeOwner);
  } catch (error) {
    console.error("Portal Update Error:", error);
    res.status(500).json({ error: 'Failed to update portal access' });
  }
});

export default router;
