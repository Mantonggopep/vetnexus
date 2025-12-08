import { FastifyInstance } from 'fastify';
import { VeterinaryAI } from '../services/ai.service';

export async function aiRoutes(app: FastifyInstance) {
    
    // POST /api/ai/diagnose
    app.post('/diagnose', async (req, reply) => {
        try {
            const result = await VeterinaryAI.suggestDiagnosis(req.body);
            return reply.send(result);
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ error: 'AI Service Error' });
        }
    });

    // POST /api/ai/soap
    app.post('/soap', async (req, reply) => {
        try {
            const content = await VeterinaryAI.generateSOAP(req.body);
            return reply.send({ content });
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ error: 'AI Service Error' });
        }
    });

    // POST /api/ai/chat
    app.post('/chat', async (req, reply) => {
        try {
            const answer = await VeterinaryAI.chat(req.body);
            return reply.send({ answer });
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ error: 'AI Service Error' });
        }
    });
}