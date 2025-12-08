import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

import { prisma } from '../lib/prisma';

// --- UPDATED INTERFACE: Includes 'name' ---
export interface AuthUser {
  id: string;
  tenantId: string;
  roles: string[];
  name: string; // <--- This is the critical fix
}

export type AuthenticatedRequest = FastifyRequest & {
  user?: AuthUser;
};

interface JwtPayload {
  userId: string;
  tenantId: string;
  name?: string;
  iat: number;
  exp: number;
}

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.cookies?.token || request.headers.authorization?.split(' ')[1];

  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized: No token provided' });
  }

  try {
    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is missing");
        return reply.status(500).send({ error: 'Internal Server Error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    
    // We try to get the name from the token first (fastest)
    // If not in token, we fetch from DB (slower but safer)
    let userName = decoded.name;
    let roles: string[] = [];

    // Always verify user exists in DB to prevent banned users from acting
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, tenantId: true, roles: true, isSuspended: true, name: true }
    });

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    if (user.isSuspended) {
      return reply.status(403).send({ error: 'Account suspended' });
    }

    try {
        roles = JSON.parse(user.roles as string);
    } catch (e) {
        roles = [user.roles as string];
    }

    // Attach user to request
    (request as AuthenticatedRequest).user = {
      id: user.id,
      tenantId: user.tenantId,
      roles: roles,
      name: user.name // Ensure this comes from DB if not in token
    };

  } catch (err) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const req = request as AuthenticatedRequest;
    if (!req.user || !req.user.roles.some(role => allowedRoles.includes(role))) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
};
