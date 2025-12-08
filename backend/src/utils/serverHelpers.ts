import { prisma } from '../lib/prisma';

export const DEFAULT_PLANS = [
    {
        id: 'Trial',
        name: 'Trial',
        priceMonthly: 100,
        priceYearly: 1000,
        features: JSON.stringify(['Full Access for Testing', 'Limited Time', 'Single User']),
        limits: JSON.stringify({ maxUsers: 1, maxClients: 10, maxStorageGB: 0.5, modules: { pos: true, lab: true, ai: true, reports: true, multiBranch: false } })
    },
    {
        id: 'Starter',
        name: 'Starter',
        priceMonthly: 7000,
        priceYearly: 70000,
        features: JSON.stringify(['2 Users Max', 'Max 50 Clients', 'Basic Inventory & Sales', 'No Printing/Downloads', 'No AI Features']),
        limits: JSON.stringify({ maxUsers: 2, maxClients: 50, maxStorageGB: 2, modules: { pos: true, lab: false, ai: false, reports: false, multiBranch: false, print: false } })
    },
    {
        id: 'Standard',
        name: 'Standard',
        priceMonthly: 30000,
        priceYearly: 300000,
        features: JSON.stringify(['7 Users Max', 'Unlimited Clients', 'Full Reports & Printing', 'Limited AI (200/mo)', 'Lab Module']),
        limits: JSON.stringify({ maxUsers: 7, maxClients: -1, maxStorageGB: 10, modules: { pos: true, lab: true, ai: true, reports: true, multiBranch: false, print: true, aiLimit: 200 } })
    },
    {
        id: 'Premium',
        name: 'Premium',
        priceMonthly: 70000,
        priceYearly: 700000,
        features: JSON.stringify(['Unlimited Users', 'Unlimited AI', 'Multi-Branch Management', 'Staff Transfer', 'Priority Support']),
        limits: JSON.stringify({ maxUsers: -1, maxClients: -1, maxStorageGB: 100, modules: { pos: true, lab: true, ai: true, reports: true, multiBranch: true, print: true, aiLimit: -1 } })
    }
];

export const createLog = async (tenantId: string, user: string, action: string, type: string, details: string = '') => {
    try {
        await prisma.log.create({ data: { tenantId, user, action, type, details } });
    } catch (e) { console.error("Failed to create log", e); }
};

export const checkLimits = async (tenantId: string, resourceType: 'storage' | 'users' | 'clients', incrementAmount: number = 0) => {
    const tenant = await prisma.tenant.findUnique({ 
        where: { id: tenantId },
        include: { _count: { select: { users: true, pets: true, owners: true } } }
    });
    
    if (!tenant) throw new Error("Tenant not found");
    if (tenant.status === 'Restricted' || tenant.status === 'Suspended') throw new Error("Account restricted");

    const plan = await prisma.plan.findUnique({ where: { id: tenant.plan } });
    const limits = plan ? JSON.parse(plan.limits) : { maxStorageGB: 0.5, maxUsers: 1, maxClients: 10 };
    const maxStorageMB = limits.maxStorageGB * 1024;

    if (resourceType === 'storage') {
        if (tenant.storageUsed + incrementAmount > maxStorageMB) throw new Error(`Storage quota exceeded.`);
    }
    if (resourceType === 'users' && limits.maxUsers !== -1) {
        if ((tenant._count.users + incrementAmount) > limits.maxUsers) throw new Error(`User limit reached.`);
    }
    if (resourceType === 'clients' && limits.maxClients !== -1) {
        const clientCount = await prisma.owner.count({ where: { tenantId } });
        if ((clientCount + incrementAmount) > limits.maxClients) throw new Error(`Client limit reached.`);
    }
    return tenant;
};

export const trackStorage = async (tenantId: string, mbUsed: number) => {
    await prisma.tenant.update({ where: { id: tenantId }, data: { storageUsed: { increment: mbUsed } } });
};

export const verifyPayment = async (transactionId: string): Promise<boolean> => {
    try {
        if (process.env.NODE_ENV !== 'production' && (transactionId.startsWith('mock-') || transactionId === 'TRIAL')) return true; 
        const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
        });
        const data = await response.json();
        return data.status === 'success' && data.data.status === 'successful';
    } catch (error) { return false; }
};