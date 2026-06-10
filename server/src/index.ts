import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './services/db';
import authRoutes from './routes/authRoutes';
import ticketRoutes from './routes/ticketRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import { authenticateJWT, requireAgent } from './middlewares/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Register API routes
app.use('/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/analytics', analyticsRoutes);

// Helper route to list all agents (restricted to logged-in agents)
app.get('/api/agents', authenticateJWT, requireAgent, async (req: Request, res: Response) => {
  try {
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT' },
      select: { id: true, name: true, email: true }
    });
    res.status(200).json(agents);
  } catch (error) {
    console.error('Failed to retrieve agents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', service: 'AI Support Ticket API' });
});

// Centralized error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error occurred' });
});

app.listen(PORT, () => {
  console.log(`Server successfully started on port ${PORT}`);
});
