import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { createLog, verifyPayment } from '../utils/serverHelpers';
import { sendEmail } from '../utils/email';

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export async function authRoutes(app: FastifyInstance) {
    
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
        
        // FIX: Changed sameSite to 'none' and secure to true for Vercel/Render support
        reply.setCookie('token', token, { 
            path: '/', 
            httpOnly: true, 
            secure: true, // Must be true for sameSite='none'
            sameSite: 'none', // Required for cross-site (Vercel -> Render)
            maxAge: 28800 
        });

        let roles = []; try { roles = JSON.parse(user.roles); } catch(e) { roles = [user.roles]; }
        let settings = {}; try { settings = JSON.parse(user.tenant.settings); } catch(e) {}
        
        return reply.send({ 
            user: { id: user.id, name: user.name, email: user.email, roles, tenantId: user.tenantId, avatarUrl: user.avatarUrl },
            tenant: { ...user.tenant, settings }
        });
    });

    // --- SIGNUP FLOW 1: Initiate ---
    app.post('/auth/signup/initiate', async (req, reply) => {
        const { email } = req.body as any;
        if (!email) return reply.status(400).send({ error: 'Email is required' });

        const existingUser = await prisma.user.findFirst({ where: { email } });
        if (existingUser) return reply.status(400).send({ error: 'This email is already registered.' });

        const otp = generateOTP();
        const expires = new Date(Date.now() + 15 * 60 * 1000); 

        await prisma.verificationToken.upsert({
            where: { identifier_type: { identifier: email, type: 'EMAIL_VERIFICATION' } },
            update: { token: otp, expires },
            create: { identifier: email, token: otp, expires, type: 'EMAIL_VERIFICATION' },
        });

        const sent = await sendEmail(email, 'Verify your email - Vet Nexus Pro', 
            `<h2>Welcome to Vet Nexus Pro</h2><p>Code: <b>${otp}</b></p>`
        );

        if (!sent) return reply.status(500).send({ error: 'Failed to send email' });
        return reply.send({ message: 'Verification code sent.' });
    });

    // --- SIGNUP FLOW 2: Verify ---
    app.post('/auth/signup/verify', async (req, reply) => {
        const { email, code } = req.body as any;
        const record = await prisma.verificationToken.findUnique({
            where: { identifier_type: { identifier: email, type: 'EMAIL_VERIFICATION' } },
        });
        if (!record || record.token !== code || record.expires < new Date()) {
            return reply.status(400).send({ error: 'Invalid or expired code.' });
        }
        return reply.send({ message: 'Email verified.' });
    });

    // --- SIGNUP FLOW 3: Complete ---
    app.post('/auth/signup', async (req, reply) => {
        try {
            const { name, email, password, clinicName, plan, country, paymentRef, billingPeriod, verificationCode } = req.body as any;
            
            if (paymentRef && paymentRef !== 'TRIAL' && !await verifyPayment(paymentRef)) {
                return reply.status(402).send({ error: 'Payment verification failed' });
            }

            const tokenRecord = await prisma.verificationToken.findUnique({
                where: { identifier_type: { identifier: email, type: 'EMAIL_VERIFICATION' } },
            });
            if (!tokenRecord || tokenRecord.token !== verificationCode) {
                return reply.status(400).send({ error: 'Email verification required.' });
            }

            const settings = JSON.stringify({ name: clinicName, currency: country === 'Nigeria' ? 'NGN' : 'USD', taxRate: 7.5, paymentRef: paymentRef || 'TRIAL' });
            
            const result = await prisma.$transaction(async (tx) => {
                if (await tx.user.findFirst({ where: { email } })) throw new Error("Email registered");
                
                const tenant = await tx.tenant.create({ 
                    data: { name: clinicName, plan: plan || 'Trial', billingPeriod: billingPeriod || 'Monthly', settings, storageUsed: 0 } 
                });
                
                const passwordHash = await bcrypt.hash(password, 10);
                const user = await tx.user.create({ 
                    data: { tenantId: tenant.id, name, email, passwordHash, roles: JSON.stringify(['Admin']), isVerified: true } 
                });
                
                await tx.log.create({ data: { tenantId: tenant.id, user: 'System', action: 'Clinic Created', type: 'system' } });
                await tx.verificationToken.delete({ where: { identifier_type: { identifier: email, type: 'EMAIL_VERIFICATION' } } });

                return { tenant, user };
            });

            const token = jwt.sign({ userId: result.user.id, tenantId: result.tenant.id, name: result.user.name }, process.env.JWT_SECRET!, { expiresIn: '8h' });
            
            // FIX: Cookie settings here as well
            reply.setCookie('token', token, { 
                path: '/', 
                httpOnly: true, 
                secure: true, 
                sameSite: 'none', 
                maxAge: 28800 
            });

            return reply.send({ message: 'Success', tenantId: result.tenant.id });
        } catch (error: any) { 
            return reply.status(500).send({ error: error.message }); 
        }
    });

    // --- LOGOUT ---
    app.post('/auth/logout', async (req, reply) => {
        reply.clearCookie('token', { path: '/' });
        return reply.send({ message: 'Logged out' });
    });
    
    // --- PASSWORD RESET ROUTES ---
    app.post('/auth/password/forgot', async (req, reply) => {
        const { email } = req.body as any;
        const user = await prisma.user.findFirst({ where: { email } });
        if (!user) return reply.send({ message: 'Reset code sent.' }); // Fake success

        const otp = generateOTP();
        await prisma.verificationToken.upsert({
            where: { identifier_type: { identifier: email, type: 'PASSWORD_RESET' } },
            update: { token: otp, expires: new Date(Date.now() + 15 * 60 * 1000) },
            create: { identifier: email, token: otp, expires: new Date(Date.now() + 15 * 60 * 1000), type: 'PASSWORD_RESET' },
        });

        await sendEmail(email, 'Reset Password', `<p>Code: ${otp}</p>`);
        return reply.send({ message: 'Reset code sent.' });
    });

    app.post('/auth/password/reset', async (req, reply) => {
        const { email, code, newPassword } = req.body as any;
        const record = await prisma.verificationToken.findUnique({ where: { identifier_type: { identifier: email, type: 'PASSWORD_RESET' } } });
        
        if (!record || record.token !== code || record.expires < new Date()) return reply.status(400).send({ error: 'Invalid code' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.updateMany({ where: { email }, data: { passwordHash: hashedPassword } });
        await prisma.verificationToken.delete({ where: { identifier_type: { identifier: email, type: 'PASSWORD_RESET' } } });

        return reply.send({ message: 'Password reset successful' });
    });
}
