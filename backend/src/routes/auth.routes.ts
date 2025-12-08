import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { createLog, verifyPayment } from '../utils/serverHelpers';
import { sendEmail } from '../utils/email';

// Helper to generate 6-digit code
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export async function authRoutes(app: FastifyInstance) {
    
    // REMOVED: app.get('/plans') because it is now in admin.routes.ts
    // This prevents the "Duplicate Route" error.

    // --- AUTH ME ---
    app.get('/auth/me', async (req, reply) => {
        const token = req.cookies.token;
        if (!token) return reply.send({ user: null, tenant: null });
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
            const user = await prisma.user.findUnique({ where: { id: decoded.userId }, include: { tenant: true } });
            if (!user) return reply.send({ user: null, tenant: null });
            
            let roles = []; try { roles = JSON.parse(user.roles); } catch(e) { roles = [user.roles]; }
            let settings = {}; try { settings = JSON.parse(user.tenant.settings); } catch(e) {}
            return reply.send({
                user: { id: user.id, name: user.name, email: user.email, roles, tenantId: user.tenantId, avatarUrl: user.avatarUrl },
                tenant: { ...user.tenant, settings }
            });
        } catch (err) { return reply.send({ user: null, tenant: null }); }
    });

    // --- LOGIN ---
    app.post('/auth/login', async (req, reply) => {
        const { email, password } = req.body as any;
        const user = await prisma.user.findFirst({ where: { email }, include: { tenant: true } });
        
        if (!user || !await bcrypt.compare(password, user.passwordHash)) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        if (user.isSuspended) return reply.status(403).send({ error: 'Account suspended' });

        await createLog(user.tenantId, user.name, 'User Login', 'system');
        const token = jwt.sign({ userId: user.id, tenantId: user.tenantId, name: user.name }, process.env.JWT_SECRET!, { expiresIn: '8h' });
        
        reply.setCookie('token', token, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 28800 });
        let roles = []; try { roles = JSON.parse(user.roles); } catch(e) { roles = [user.roles]; }
        let settings = {}; try { settings = JSON.parse(user.tenant.settings); } catch(e) {}
        
        return reply.send({ 
            user: { id: user.id, name: user.name, email: user.email, roles, tenantId: user.tenantId, avatarUrl: user.avatarUrl },
            tenant: { ...user.tenant, settings }
        });
    });

    // --- SIGNUP FLOW 1: Initiate (Send Email) ---
    app.post('/auth/signup/initiate', async (req, reply) => {
        const { email } = req.body as any;
        if (!email) return reply.status(400).send({ error: 'Email is required' });

        // Check if email already registered to a tenant
        const existingUser = await prisma.user.findFirst({ where: { email } });
        if (existingUser) {
            return reply.status(400).send({ error: 'This email is already registered to a clinic.' });
        }

        const otp = generateOTP();
        const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        // Upsert token
        await prisma.verificationToken.upsert({
            where: { identifier_type: { identifier: email, type: 'EMAIL_VERIFICATION' } },
            update: { token: otp, expires },
            create: { identifier: email, token: otp, expires, type: 'EMAIL_VERIFICATION' },
        });

        // Send Email
        const sent = await sendEmail(email, 'Verify your email - Vet Nexus Pro', 
            `<div style="font-family: sans-serif;">
                <h2>Welcome to Vet Nexus Pro</h2>
                <p>Your verification code is:</p>
                <h1 style="color: #2563eb; letter-spacing: 2px;">${otp}</h1>
                <p>This code expires in 15 minutes.</p>
             </div>`
        );

        if (!sent) return reply.status(500).send({ error: 'Failed to send verification email' });
        return reply.send({ message: 'Verification code sent.' });
    });

    // --- SIGNUP FLOW 2: Verify Code (For UI Feedback) ---
    app.post('/auth/signup/verify', async (req, reply) => {
        const { email, code } = req.body as any;
        
        const record = await prisma.verificationToken.findUnique({
            where: { identifier_type: { identifier: email, type: 'EMAIL_VERIFICATION' } },
        });

        if (!record || record.token !== code || record.expires < new Date()) {
            return reply.status(400).send({ error: 'Invalid or expired code.' });
        }

        return reply.send({ message: 'Email verified successfully.' });
    });

    // --- SIGNUP FLOW 3: Complete Registration ---
    app.post('/auth/signup', async (req, reply) => {
        try {
            const { name, email, password, clinicName, plan, country, paymentRef, billingPeriod, verificationCode } = req.body as any;
            
            // 1. Verify Payment
            if (paymentRef && paymentRef !== 'TRIAL' && !await verifyPayment(paymentRef)) {
                return reply.status(402).send({ error: 'Payment verification failed' });
            }

            // 2. Verify Email Code Again (Security Check)
            const tokenRecord = await prisma.verificationToken.findUnique({
                where: { identifier_type: { identifier: email, type: 'EMAIL_VERIFICATION' } },
            });
            if (!tokenRecord || tokenRecord.token !== verificationCode) {
                return reply.status(400).send({ error: 'Email verification required.' });
            }

            const settings = JSON.stringify({ name: clinicName, currency: country === 'Nigeria' ? 'NGN' : 'USD', taxRate: 7.5, paymentRef: paymentRef || 'TRIAL' });
            
            const result = await prisma.$transaction(async (tx) => {
                // Check duplicate again inside transaction for safety
                if (await tx.user.findFirst({ where: { email } })) throw new Error("Email registered");
                
                const tenant = await tx.tenant.create({ 
                    data: { 
                        name: clinicName, 
                        plan: plan || 'Trial', 
                        billingPeriod: billingPeriod || 'Monthly', 
                        settings, 
                        storageUsed: 0 
                    } 
                });
                
                const passwordHash = await bcrypt.hash(password, 10);
                
                const user = await tx.user.create({ 
                    data: { 
                        tenantId: tenant.id, 
                        name, 
                        email, 
                        passwordHash, 
                        roles: JSON.stringify(['Admin']),
                        isVerified: true // Mark as verified
                    } 
                });
                
                await tx.log.create({ data: { tenantId: tenant.id, user: 'System', action: 'Clinic Created', type: 'system' } });
                
                // Cleanup Token
                await tx.verificationToken.delete({
                    where: { identifier_type: { identifier: email, type: 'EMAIL_VERIFICATION' } },
                });

                return { tenant, user };
            });

            // Auto-login after signup
            const token = jwt.sign({ userId: result.user.id, tenantId: result.tenant.id, name: result.user.name }, process.env.JWT_SECRET!, { expiresIn: '8h' });
            reply.setCookie('token', token, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 28800 });

            return reply.send({ message: 'Success', tenantId: result.tenant.id });
        } catch (error: any) { 
            return reply.status(500).send({ error: error.message }); 
        }
    });

    // --- FORGOT PASSWORD: Request ---
    app.post('/auth/password/forgot', async (req, reply) => {
        const { email } = req.body as any;
        const user = await prisma.user.findFirst({ where: { email } });
        
        // Security: Don't reveal if user exists, but don't send email if they don't
        if (!user) return reply.send({ message: 'If that email exists, a reset code has been sent.' });

        const otp = generateOTP();
        const expires = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.verificationToken.upsert({
            where: { identifier_type: { identifier: email, type: 'PASSWORD_RESET' } },
            update: { token: otp, expires },
            create: { identifier: email, token: otp, expires, type: 'PASSWORD_RESET' },
        });

        await sendEmail(email, 'Reset Password - Vet Nexus Pro', 
            `<div style="font-family: sans-serif;">
                <p>You requested a password reset. Your code is:</p>
                <h1 style="color: #ef4444; letter-spacing: 2px;">${otp}</h1>
                <p>If you did not request this, please ignore this email.</p>
             </div>`
        );

        return reply.send({ message: 'If that email exists, a reset code has been sent.' });
    });

    // --- FORGOT PASSWORD: Confirm & Reset ---
    app.post('/auth/password/reset', async (req, reply) => {
        const { email, code, newPassword } = req.body as any;

        const record = await prisma.verificationToken.findUnique({
            where: { identifier_type: { identifier: email, type: 'PASSWORD_RESET' } },
        });

        if (!record || record.token !== code || record.expires < new Date()) {
            return reply.status(400).send({ error: 'Invalid or expired code.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update all users with this email (though usually only one exists in this multi-tenant setup per logic)
        // Using updateMany handles the edge case if unique constraint isn't perfect, but findFirst/update is standard.
        await prisma.user.updateMany({
            where: { email },
            data: { passwordHash: hashedPassword },
        });

        // Cleanup
        await prisma.verificationToken.delete({
            where: { identifier_type: { identifier: email, type: 'PASSWORD_RESET' } },
        });

        return reply.send({ message: 'Password updated successfully. Please login.' });
    });

    // --- LOGOUT ---
    app.post('/auth/logout', async (req, reply) => {
        reply.clearCookie('token', { path: '/' });
        return reply.send({ message: 'Logged out' });
    });
}
