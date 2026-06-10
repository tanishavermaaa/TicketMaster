import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.auditLog.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.user.deleteMany({});

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Create Users
  const customer = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      password: hashedPassword,
      name: 'Jane Customer',
      role: 'CUSTOMER'
    }
  });

  const agent1 = await prisma.user.create({
    data: {
      email: 'agent@example.com',
      password: hashedPassword,
      name: 'John Agent',
      role: 'AGENT'
    }
  });

  const agent2 = await prisma.user.create({
    data: {
      email: 'agent2@example.com',
      password: hashedPassword,
      name: 'Sarah Support',
      role: 'AGENT'
    }
  });

  console.log('Created Users:', {
    customer: customer.email,
    agent1: agent1.email,
    agent2: agent2.email
  });

  // 2. Create Tickets
  // Ticket 1: Open Account Access ticket
  const ticket1 = await prisma.ticket.create({
    data: {
      title: 'Unable to log in to my customer portal',
      description: 'I keep getting an "invalid session" error when I enter my credentials. I have tried resetting my password but the link expired before I could use it. Please help!',
      category: 'Account Access',
      priority: 'High',
      status: 'OPEN',
      createdById: customer.id,
      suggestedResponse: `Hi Jane,

I'm sorry to hear you're having trouble logging into your customer portal. I've looked into your account and it seems your recovery token had expired.

I have generated a new password reset link for you that is valid for 24 hours. You can reset it here: [Reset Link]. If you continue to see the "invalid session" error, please clear your browser cookies and try again.

Best regards,
Support Team`
    }
  });

  // Log ticket1 creation in audit trail
  await prisma.auditLog.create({
    data: {
      ticketId: ticket1.id,
      userId: customer.id,
      action: 'TICKET_CREATED',
      details: JSON.stringify({ category: 'Account Access', priority: 'High' })
    }
  });

  // Ticket 2: In Progress Billing ticket assigned to John Agent
  const ticket2 = await prisma.ticket.create({
    data: {
      title: 'Charged twice for monthly invoice #INV-402',
      description: 'I noticed a duplicate transaction on my credit card statement for June. Two charges of $49.00 were processed. Please refund the second charge.',
      category: 'Billing',
      priority: 'Medium',
      status: 'IN_PROGRESS',
      createdById: customer.id,
      assignedToId: agent1.id,
      suggestedResponse: `Hi Jane,

Thank you for bringing this to our attention. I see that invoice #INV-402 was indeed double-processed on June 9th. 

I have initiated a refund of $49.00 back to your card. Depending on your financial institution, this credit should appear on your statement in 3-5 business days.

Best regards,
John Agent
Support Team`
    }
  });

  // Log ticket2 audit trail
  await prisma.auditLog.create({
    data: {
      ticketId: ticket2.id,
      userId: customer.id,
      action: 'TICKET_CREATED',
      details: JSON.stringify({ category: 'Billing', priority: 'Medium' })
    }
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket2.id,
      userId: agent1.id,
      action: 'ASSIGNMENT',
      details: JSON.stringify({ old: 'Unassigned', new: agent1.name })
    }
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket2.id,
      userId: agent1.id,
      action: 'STATUS_CHANGE',
      details: JSON.stringify({ old: 'OPEN', new: 'IN_PROGRESS' })
    }
  });

  // Add Comment to Ticket 2
  const comment1 = await prisma.comment.create({
    data: {
      ticketId: ticket2.id,
      userId: agent1.id,
      content: "Hello Jane, I'm checking with our finance department now to verify the transaction double charge. I will update you as soon as the refund is initiated."
    }
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket2.id,
      userId: agent1.id,
      action: 'COMMENT_ADDED',
      details: JSON.stringify({ commentId: comment1.id })
    }
  });

  // Ticket 3: Resolved Technical Issue assigned to Sarah
  // SLA breached and then resolved
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const ticket3 = await prisma.ticket.create({
    data: {
      title: 'App crashed when downloading PDF reports',
      description: 'Whenever I navigate to reports and click "Export to PDF", the entire page crashes and displays an error code ERR_BAD_RESPONSE. This is happening on Chrome and Safari.',
      category: 'Technical Issue',
      priority: 'Critical',
      status: 'RESOLVED',
      createdById: customer.id,
      assignedToId: agent2.id,
      createdAt: threeDaysAgo,
      updatedAt: new Date(),
      suggestedResponse: `Hi Jane,

I apologize for the app crashing. Our engineering team identified a bug where PDF generating binaries crashed on certain report sizes.

We have deployed a hotfix to production. Please refresh your browser (Ctrl+F5 or Cmd+Shift+R) and try downloading the report again. It should download successfully now.

Best regards,
Sarah Support
Support Team`
    }
  });

  // Audit logs for Ticket 3
  await prisma.auditLog.create({
    data: {
      ticketId: ticket3.id,
      userId: customer.id,
      action: 'TICKET_CREATED',
      details: JSON.stringify({ category: 'Technical Issue', priority: 'Critical' }),
      createdAt: threeDaysAgo
    }
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket3.id,
      userId: agent2.id,
      action: 'ASSIGNMENT',
      details: JSON.stringify({ old: 'Unassigned', new: agent2.name }),
      createdAt: threeDaysAgo
    }
  });

  const comment2 = await prisma.comment.create({
    data: {
      ticketId: ticket3.id,
      userId: agent2.id,
      content: "Hi Jane, I have logged this crash with our Dev team. They are looking into the PDF parser libraries right now. I will post here as soon as a fix is live.",
      createdAt: threeDaysAgo
    }
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket3.id,
      userId: agent2.id,
      action: 'COMMENT_ADDED',
      details: JSON.stringify({ commentId: comment2.id }),
      createdAt: threeDaysAgo
    }
  });

  // Comment from customer
  const comment3 = await prisma.comment.create({
    data: {
      ticketId: ticket3.id,
      userId: customer.id,
      content: "Thanks Sarah, let me know. I really need to export this report by tomorrow for my team presentation.",
      createdAt: new Date(threeDaysAgo.getTime() + 120000)
    }
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket3.id,
      userId: customer.id,
      action: 'COMMENT_ADDED',
      details: JSON.stringify({ commentId: comment3.id }),
      createdAt: new Date(threeDaysAgo.getTime() + 120000)
    }
  });

  // Resolved status change
  await prisma.ticket.update({
    where: { id: ticket3.id },
    data: { status: 'RESOLVED' }
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket3.id,
      userId: agent2.id,
      action: 'STATUS_CHANGE',
      details: JSON.stringify({ old: 'OPEN', new: 'RESOLVED' })
    }
  });

  const comment4 = await prisma.comment.create({
    data: {
      ticketId: ticket3.id,
      userId: agent2.id,
      content: "Good news Jane! The hotfix has been successfully deployed. The PDF reports are now generating correctly. I am marking this ticket as resolved. Let me know if you run into any other problems!"
    }
  });

  await prisma.auditLog.create({
    data: {
      ticketId: ticket3.id,
      userId: agent2.id,
      action: 'COMMENT_ADDED',
      details: JSON.stringify({ commentId: comment4.id })
    }
  });

  console.log('Successfully seeded database with users, tickets, comments, and audit trails!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
