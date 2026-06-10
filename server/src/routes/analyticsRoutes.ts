import { Router, Request, Response } from 'express';
import prisma from '../services/db';
import { authenticateJWT, requireAgent } from '../middlewares/auth';

const router = Router();

// GET /api/analytics - Support Agent Analytics Dashboard data
router.get('/', authenticateJWT, requireAgent, async (req: Request, res: Response) => {
  try {
    // 1. Status Counts
    const statusCounts = await prisma.ticket.groupBy({
      by: ['status'],
      _count: { _all: true }
    });

    const statusMap: Record<string, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0
    };
    statusCounts.forEach(item => {
      statusMap[item.status] = item._count._all;
    });

    // 2. Priority Counts
    const priorityCounts = await prisma.ticket.groupBy({
      by: ['priority'],
      _count: { _all: true }
    });

    const priorityMap: Record<string, number> = {
      Low: 0,
      Medium: 0,
      High: 0,
      Critical: 0
    };
    priorityCounts.forEach(item => {
      priorityMap[item.priority] = item._count._all;
    });

    // 3. Category Counts
    const categoryCounts = await prisma.ticket.groupBy({
      by: ['category'],
      _count: { _all: true }
    });

    const categoryMap: Record<string, number> = {
      'Billing': 0,
      'Technical Issue': 0,
      'Account Access': 0,
      'Feature Request': 0,
      'General Inquiry': 0
    };
    categoryCounts.forEach(item => {
      categoryMap[item.category] = item._count._all;
    });

    // 4. Average Resolution Time (in hours)
    // Find tickets that are RESOLVED or CLOSED
    const resolvedTickets = await prisma.ticket.findMany({
      where: {
        status: { in: ['RESOLVED', 'CLOSED'] }
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
    });

    let avgResolutionTimeHours = 0;
    if (resolvedTickets.length > 0) {
      const totalDiffMs = resolvedTickets.reduce((sum, ticket) => {
        const diff = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
        return sum + diff;
      }, 0);
      const avgMs = totalDiffMs / resolvedTickets.length;
      avgResolutionTimeHours = parseFloat((avgMs / (1000 * 60 * 60)).toFixed(2));
    }

    // 5. SLA Breach Counts
    // Critical: 1h, High: 4h, Medium: 24h, Low: 48h
    const now = new Date();
    const tickets = await prisma.ticket.findMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] }
      },
      select: {
        createdAt: true,
        priority: true
      }
    });

    let slaBreachedCount = 0;
    tickets.forEach(ticket => {
      const ageHours = (now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
      let limit = 48; // default Low: 48h
      if (ticket.priority === 'Critical') limit = 1;
      else if (ticket.priority === 'High') limit = 4;
      else if (ticket.priority === 'Medium') limit = 24;

      if (ageHours > limit) {
        slaBreachedCount++;
      }
    });

    // 6. Agent Workload
    // Get all agents and count active tickets assigned to them
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT' },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            ticketsAssigned: {
              where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }
            }
          }
        }
      }
    });

    const agentWorkloads = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      activeTicketsCount: agent._count.ticketsAssigned
    }));

    res.status(200).json({
      statusCounts: statusMap,
      priorityCounts: priorityMap,
      categoryCounts: categoryMap,
      avgResolutionTimeHours,
      slaBreachedCount,
      agentWorkloads,
      totalTickets: statusCounts.reduce((acc, c) => acc + c._count._all, 0)
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
