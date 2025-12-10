import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

// Client Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find the owner by email
    const owner = await prisma.owner.findFirst({
      where: { email }
    });

    if (!owner) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // 2. Check if portal is active
    if (!owner.isPortalActive) {
      return res.status(403).json({ error: 'Portal access is not active. Contact clinic.' });
    }

    // 3. Check password
    if (!owner.passwordHash) {
       return res.status(400).json({ error: 'Account not configured. Contact clinic.' });
    }

    const isMatch = await bcrypt.compare(password, owner.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // 4. Generate Token
    const token = jwt.sign(
      { id: owner.id, role: 'client', tenantId: owner.tenantId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: owner.id, name: owner.name, email: owner.email } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
