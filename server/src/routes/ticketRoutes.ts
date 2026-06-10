import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../services/db';
import { authenticateJWT, UserPayload } from '../middlewares/auth';
import { triageTicket } from '../services/aiService';
import { sseService } from '../services/sseService';

const router = Router();

// SSE Event Stream for Live Updates
// We support token in query parameter for EventSource compatibility
router.get('/events', async (req: Request, res: Response) => {
  const token = req.query.token as string;
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey') as UserPayload;
    
    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Prevent buffering in Nginx if deployed
    });

    const clientId = `${decoded.id}-${Date.now()}`;
    sseService.addClient(clientId, res, decoded.role, decoded.id);

    // Keep connection alive with a ping every 30s
    const pingInterval = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'PING' })}\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseService.removeClient(clientId);
    });
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
});

// POST /tickets - Create ticket (Customer only, or any logged in user)
router.post('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    const user = req.user!;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    // Run AI Triage
    const triage = await triageTicket(title, description);

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        category: triage.category,
        priority: triage.priority,
        suggestedResponse: triage.suggestedResponse,
        createdById: user.id,
        status: 'OPEN'
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        ticketId: ticket.id,
        userId: user.id,
        action: 'TICKET_CREATED',
        details: JSON.stringify({
          category: triage.category,
          priority: triage.priority
        })
      }
    });

    // Broadcast SSE update
    sseService.broadcastEvent('TICKET_CREATED', ticket);

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tickets - List tickets (Customer views own; Agent views all)
router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const priority = (req.query.priority as string) || '';
    const category = (req.query.category as string) || '';
    const assigneeId = (req.query.assigneeId as string) || '';

    const skip = (page - 1) * limit;

    // Build query filters
    const whereClause: any = {};

    // Customer scoping
    if (user.role === 'CUSTOMER') {
      whereClause.createdById = user.id;
    } else if (assigneeId) {
      if (assigneeId === 'unassigned') {
        whereClause.assignedToId = null;
      } else {
        whereClause.assignedToId = assigneeId;
      }
    }

    // Status filter
    if (status) {
      whereClause.status = status;
    }

    // Priority filter
    if (priority) {
      whereClause.priority = priority;
    }

    // Category filter
    if (category) {
      whereClause.category = category;
    }

    // Search filter
    if (search) {
      whereClause.OR = [
        { title: { contains: search } },
        { description: { contains: search } }
      ];
    }

    // Fetch tickets and count
    const [tickets, totalCount] = await prisma.$transaction([
      prisma.ticket.findMany({
        where: whereClause,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          assignedTo: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.ticket.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      tickets,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error('List tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tickets/:id - Get details (comments, history)
router.get('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, role: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        auditLogs: {
          include: {
            user: {
              select: { id: true, name: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Validate access
    if (user.role === 'CUSTOMER' && ticket.createdById !== user.id) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    res.status(200).json(ticket);
  } catch (error) {
    console.error('Get ticket detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /tickets/:id - Update ticket (Status, Assignee, Priority, Category, Title, Description)
router.patch('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, priority, category, assignedToId, title, description } = req.body;
    const user = req.user!;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { name: true } }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Access control
    if (user.role === 'CUSTOMER') {
      if (ticket.createdById !== user.id) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }
      
      if (ticket.status === 'CLOSED') {
        return res.status(403).json({ error: 'Closed tickets cannot be modified' });
      }

      const customerUpdateData: any = {};
      const changes: string[] = [];

      if (status && status === 'CLOSED') {
        customerUpdateData.status = 'CLOSED';
        changes.push('status updated to CLOSED');
      } else if (status) {
        return res.status(403).json({ error: 'Customers can only update status to CLOSED' });
      }

      if (title && title.trim() !== ticket.title) {
        customerUpdateData.title = title.trim();
        changes.push('title updated');
      }

      if (description && description.trim() !== ticket.description) {
        customerUpdateData.description = description.trim();
        changes.push('description updated');
      }

      if (Object.keys(customerUpdateData).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id },
        data: customerUpdateData,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } }
        }
      });

      if (customerUpdateData.status) {
        await prisma.auditLog.create({
          data: {
            ticketId: id,
            userId: user.id,
            action: 'STATUS_CHANGE',
            details: JSON.stringify({ old: ticket.status, new: 'CLOSED' })
          }
        });
      }
      if (customerUpdateData.title || customerUpdateData.description) {
        await prisma.auditLog.create({
          data: {
            ticketId: id,
            userId: user.id,
            action: 'TICKET_UPDATED',
            details: JSON.stringify({
              titleChanged: !!customerUpdateData.title,
              descriptionChanged: !!customerUpdateData.description
            })
          }
        });
      }

      sseService.broadcastEvent('TICKET_UPDATED', {
        ...updatedTicket,
        lastChange: changes.join(', ')
      });
      return res.status(200).json(updatedTicket);
    }

    // Agent can update anything
    const updateData: any = {};
    const auditLogsToCreate: any[] = [];
    const changes: string[] = [];

    if (status && status !== ticket.status) {
      updateData.status = status;
      auditLogsToCreate.push({
        action: 'STATUS_CHANGE',
        details: JSON.stringify({ old: ticket.status, new: status })
      });
      changes.push(`status updated to ${status}`);
    }

    if (priority && priority !== ticket.priority) {
      updateData.priority = priority;
      auditLogsToCreate.push({
        action: 'PRIORITY_CHANGE',
        details: JSON.stringify({ old: ticket.priority, new: priority })
      });
      changes.push(`priority updated to ${priority}`);
    }

    if (category && category !== ticket.category) {
      updateData.category = category;
      auditLogsToCreate.push({
        action: 'CATEGORY_CHANGE',
        details: JSON.stringify({ old: ticket.category, new: category })
      });
      changes.push(`category updated to ${category}`);
    }

    if (assignedToId !== undefined && assignedToId !== ticket.assignedToId) {
      updateData.assignedToId = assignedToId === '' ? null : assignedToId;
      
      let newAssigneeName = 'Unassigned';
      if (assignedToId) {
        const newAssignee = await prisma.user.findUnique({
          where: { id: assignedToId }
        });
        if (newAssignee) newAssigneeName = newAssignee.name;
      }

      const oldAssigneeName = ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned';
      
      auditLogsToCreate.push({
        action: 'ASSIGNMENT',
        details: JSON.stringify({ old: oldAssigneeName, new: newAssigneeName })
      });
      changes.push(`assignee updated to ${newAssigneeName}`);
    }


    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } }
      }
    });

    // Write audit logs
    for (const log of auditLogsToCreate) {
      await prisma.auditLog.create({
        data: {
          ticketId: id,
          userId: user.id,
          action: log.action,
          details: log.details
        }
      });
    }

    sseService.broadcastEvent('TICKET_UPDATED', {
      ...updatedTicket,
      lastChange: changes.join(', ')
    });

    res.status(200).json(updatedTicket);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /tickets/:id/comments - Add comment
router.post('/:id/comments', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const user = req.user!;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Access control
    if (user.role === 'CUSTOMER' && ticket.createdById !== user.id) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        ticketId: id,
        userId: user.id
      },
      include: {
        user: {
          select: { id: true, name: true, role: true }
        }
      }
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        ticketId: id,
        userId: user.id,
        action: 'COMMENT_ADDED',
        details: JSON.stringify({ commentId: comment.id })
      }
    });

    // If it's an agent adding a comment, automatically advance ticket to IN_PROGRESS if it was OPEN
    if (user.role === 'AGENT' && ticket.status === 'OPEN') {
      const updatedTicket = await prisma.ticket.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } }
        }
      });

      await prisma.auditLog.create({
        data: {
          ticketId: id,
          userId: user.id,
          action: 'STATUS_CHANGE',
          details: JSON.stringify({ old: 'OPEN', new: 'IN_PROGRESS' })
        }
      });

      sseService.broadcastEvent('TICKET_UPDATED', updatedTicket);
    }

    // Broadcast SSE comment event
    sseService.broadcastEvent('COMMENT_ADDED', { ticketId: id, comment });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tickets/:id/comments - List comments
router.get('/:id/comments', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const ticket = await prisma.ticket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Access control
    if (user.role === 'CUSTOMER' && ticket.createdById !== user.id) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const comments = await prisma.comment.findMany({
      where: { ticketId: id },
      include: {
        user: {
          select: { id: true, name: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json(comments);
  } catch (error) {
    console.error('List comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
