import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { createLog, checkLimits, trackStorage } from '../utils/serverHelpers';
import { generateNextId } from '../utils/idGenerator';

// Helper to safely parse JSON
// FIX: Added 'undefined' to the type definition here
const safeParse = (data: string | null | undefined, fallback: any = {}) => {
    if (!data) return fallback;
    try { return JSON.parse(data); } catch { return fallback; }
};

export async function inventoryRoutes(app: FastifyInstance) {
    // --- INVENTORY MANAGEMENT ---
    
    // NEW: Check for duplicate Inventory Item
    app.get('/inventory/check-duplicate', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const { name } = req.query as any;

        if (!name) return reply.send({ exists: false });

        const existing = await prisma.inventoryItem.findFirst({
            where: {
                tenantId: user.tenantId,
                name: { equals: name, mode: 'insensitive' } // Case insensitive check
            },
            select: { id: true, name: true, stock: true }
        });

        return reply.send({ 
            exists: !!existing, 
            match: existing 
        });
    });

    // Get all items
    app.get('/inventory', { preHandler: [authenticate] }, async (req, reply) => {
        return reply.send(await prisma.inventoryItem.findMany({ 
            where: { tenantId: (req as AuthenticatedRequest).user!.tenantId },
            orderBy: { name: 'asc' }
        }));
    });
    
    // Create new item
    app.post('/inventory', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const data = req.body as any;
        try {
            await checkLimits(user.tenantId, 'storage', 0.002);
            
            const item = await prisma.inventoryItem.create({ 
                data: { 
                    tenantId: user.tenantId,
                    name: data.name,
                    category: data.category,
                    type: data.type || 'Product',
                    sku: data.sku,
                    stock: Number(data.stock), 
                    purchasePrice: Number(data.purchasePrice), 
                    retailPrice: Number(data.retailPrice), 
                    wholesalePrice: Number(data.wholesalePrice), 
                    reorderLevel: Number(data.reorderLevel),
                    expiryDate: data.expiryDate
                } 
            });
            
            await createLog(user.tenantId, user.name, 'Added Inventory', 'system', item.name);
            return reply.send(item);
        } catch(e: any) { 
            return reply.status(403).send({ error: e.message }); 
        }
    });

    // Update item
    app.patch('/inventory/:id', { preHandler: [authenticate] }, async (req, reply) => {
        const data = req.body as any;
        return reply.send(await prisma.inventoryItem.update({ 
            where: { id: (req.params as any).id }, 
            data: { 
                name: data.name, 
                category: data.category, 
                stock: Number(data.stock), 
                retailPrice: Number(data.retailPrice),
                purchasePrice: Number(data.purchasePrice),
                reorderLevel: Number(data.reorderLevel)
            } 
        }));
    });

    // Delete item
    app.delete('/inventory/:id', { preHandler: [authenticate] }, async (req, reply) => {
        await prisma.inventoryItem.delete({ where: { id: (req.params as any).id } });
        return reply.send({ success: true });
    });

    // --- SALES & POS ---

    // Get all sales
    app.get('/sales', { preHandler: [authenticate] }, async (req, reply) => {
        const sales = await prisma.saleRecord.findMany({ 
            where: { tenantId: (req as AuthenticatedRequest).user!.tenantId }, 
            orderBy: { date: 'desc' },
            take: 500
        });
        
        // Parse JSON strings back to objects
        return reply.send(sales.map(s => ({ 
            ...s, 
            items: JSON.parse(s.items), 
            payments: JSON.parse(s.payments) 
        })));
    });

    // Create Sale
    app.post('/sales', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const data = req.body as any;
        
        try {
            await checkLimits(user.tenantId, 'storage', 0.005);
            
            // --- ID GENERATION START ---
            const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
            const settings = safeParse(tenant?.settings, {});
            
            const salesCount = await prisma.saleRecord.count({ where: { tenantId: user.tenantId } });
            const nextSeq = salesCount + 1;

            const invoicePattern = settings.invoicePrefix || 'INV-0000';
            const receiptPattern = settings.receiptPrefix || 'RCPT-0000';

            const newInvoiceNumber = generateNextId(invoicePattern, nextSeq);
            const newReceiptNumber = generateNextId(receiptPattern, nextSeq);
            // --- ID GENERATION END ---

            const shouldDeduct = data.status === 'Paid' || data.status === 'Pending';
            
            const sale = await prisma.$transaction(async (tx) => {
                if (shouldDeduct) {
                    for (const item of data.items) {
                        const inv = await tx.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
                        if (inv && inv.type === 'Product') {
                            if (inv.stock < item.quantity) {
                                throw new Error(`Low stock: ${item.name} (Only ${inv.stock} left)`);
                            }
                            await tx.inventoryItem.update({ 
                                where: { id: item.inventoryItemId }, 
                                data: { stock: { decrement: item.quantity } } 
                            });
                        }
                    }
                }
                
                return await tx.saleRecord.create({
                    data: {
                        tenant: { connect: { id: user.tenantId } }, 
                        date: new Date(), 
                        clientId: data.clientId, 
                        clientName: data.clientName, 
                        clientAddress: data.clientAddress,
                        clientEmail: data.clientEmail,
                        clientPhone: data.clientPhone,
                        items: JSON.stringify(data.items), 
                        payments: JSON.stringify(data.payments || []), 
                        subtotal: Number(data.subtotal), 
                        discount: Number(data.discount), 
                        tax: Number(data.tax), 
                        total: Number(data.total),
                        status: data.status, 
                        invoiceNumber: newInvoiceNumber, 
                        receiptNumber: newReceiptNumber, 
                        notes: data.notes
                    }
                });
            });

            await trackStorage(user.tenantId, 0.005);
            await createLog(user.tenantId, user.name, 'Processed Sale', 'financial', `${data.total}`);
            
            return reply.send({ ...sale, items: data.items, payments: data.payments || [] });
            
        } catch(e: any) { 
            return reply.status(400).send({ error: e.message }); 
        }
    });

    app.delete('/sales/:id', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        await prisma.saleRecord.deleteMany({ 
            where: { id: (req.params as any).id, tenantId: user.tenantId } 
        });
        
        await createLog(user.tenantId, user.name, 'Deleted Sale', 'financial');
        return reply.send({ success: true });
    });

    app.get('/expenses', { preHandler: [authenticate] }, async (req, reply) => {
        return reply.send(await prisma.expense.findMany({ 
            where: { tenantId: (req as AuthenticatedRequest).user!.tenantId },
            orderBy: { date: 'desc' }
        }));
    });
    
    app.post('/expenses', { preHandler: [authenticate] }, async (req, reply) => {
        const user = (req as AuthenticatedRequest).user!;
        const data = req.body as any;
        
        await checkLimits(user.tenantId, 'storage', 0.005);
        
        const expense = await prisma.expense.create({ 
            data: { 
                tenantId: user.tenantId,
                date: new Date(),
                category: data.category,
                description: data.description,
                paymentMethod: data.paymentMethod,
                amount: Number(data.amount),
                notes: data.notes
            } 
        });
        
        return reply.send(expense);
    });
}