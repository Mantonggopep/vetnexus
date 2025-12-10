import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

// --- CONFIGURATION ---
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// --- TYPES ---
interface LoginBody {
  email: string;
  password: string;
}

interface SignupBody {
  name: string;
  email: string;
  password: string;
  clinicName?: string;
}

export async function authRoutes(app: FastifyInstance) {

  // =================================================================
  // LOGIN
  // =================================================================
  app.post<{ Body: LoginBody }>('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;

    try {
      // 1. Find User
      const user = await prisma.user.findUnique({
        where: { email },
        include: { tenant: true }
      });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // 2. Check Password
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // 3. Parse Roles Safely
      let roles: string[] = [];
      try {
        roles = JSON.parse(user.roles);
      } catch (e) {
        roles = ['Veterinarian']; // Fallback
      }

      // 4. Generate Token
      const token = jwt.sign(
        { userId: user.id, tenantId: user.tenantId, roles },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 5. Set Cookie
      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Secure in Prod
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE
      });

      // 6. Return Data
      return reply.send({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          roles,
          tenantId: user.tenantId,
          avatarUrl: user.avatarUrl
        },
        tenant: user.tenant
      });

    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // =================================================================
  // SIGNUP
  // =================================================================
  app.post<{ Body: SignupBody }>('/signup', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          clinicName: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { name, email, password, clinicName } = request.body;

    try {
      // 1. Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return reply.status(400).send({ error: 'User already exists' });
      }

      // 2. Hash Password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // 3. Transaction: Create Tenant & User
      const result = await prisma.$transaction(async (tx) => {
        // Create Tenant
        const newTenant = await tx.tenant.create({
          data: {
            name: clinicName || `${name}'s Clinic`,
            plan: 'Trial',
            status: 'Active',
            settings: JSON.stringify({ currency: 'USD', timezone: 'UTC' })
          }
        });

        // Create User
        const newUser = await tx.user.create({
          data: {
            tenantId: newTenant.id,
            name,
            email,
            passwordHash,
            roles: JSON.stringify(['Admin']),
            isVerified: false
          }
        });

        return { newTenant, newUser };
      });

      // 4. Generate Token
      const token = jwt.sign(
        { userId: result.newUser.id, tenantId: result.newTenant.id, roles: ['Admin'] },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 5. Set Cookie
      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE
      });

      return reply.send({
        success: true,
        message: 'Account created successfully',
        token,
        user: {
            id: result.newUser.id,
            name: result.newUser.name,
            email: result.newUser.email,
            roles: ['Admin'],
            tenantId: result.newUser.tenantId
        },
        tenant: result.newTenant
      });

    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Signup failed' });
    }
  });

  // =================================================================
  // LOGOUT
  // =================================================================
  app.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.send({ success: true, message: 'Logged out successfully' });
  });

  // =================================================================
  // GET CURRENT USER (ME)
  // =================================================================
  app.get('/me', async (request, reply) => {
    try {
      // 1. Extract Token
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

      // 2. Verify Token
      const decoded: any = jwt.verify(token, JWT_SECRET);

      // 3. Fetch Fresh Data
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { tenant: true }
      });

      if (!user) {
        return reply.status(401).send({ error: 'User not found' });
      }

      // 4. Parse Roles
      let roles: string[] = [];
      try {
        roles = JSON.parse(user.roles);
      } catch (e) {
        roles = [];
      }

      return reply.send({
        id: user.id,
        name: user.name,
        email: user.email,
        roles,
        tenantId: user.tenantId,
        avatarUrl: user.avatarUrl,
        tenant: user.tenant
      });

    } catch (error) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
}
