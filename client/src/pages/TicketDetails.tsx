import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: {
    name: string;
    role: string;
  };
}

interface TicketDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  suggestedResponse: string | null;
  createdById: string;
  createdBy: UserSummary;
  assignedToId: string | null;
  assignedTo: UserSummary | null;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
  auditLogs: AuditLog[];
}

interface TicketDetailsProps {
  id: string;
}

export const TicketDetails: React.FC<TicketDetailsProps> = ({ id }) => {
  const { user, isAgent } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [agents, setAgents] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Input states
  const [commentContent, setCommentContent] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const startEditing = () => {
    if (!ticket) return;
    setEditTitle(ticket.title);
    setEditDescription(ticket.description);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editDescription.trim()) return;
    setUpdatingField('details');
    try {
      const updated = await apiCall<TicketDetail>(`/api/tickets/${id}`, {
        method: 'PATCH',
        body: { title: editTitle, description: editDescription }
      });
      setTicket(prev => prev ? { ...prev, ...updated } : null);
      setIsEditing(false);
      fetchTicket();
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket details');
    } finally {
      setUpdatingField(null);
    }
  };

  const fetchTicket = async () => {
    try {
      const data = await apiCall<TicketDetail>(`/api/tickets/${id}`);
      setTicket(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    if (!isAgent) return;
    try {
      const data = await apiCall<UserSummary[]>('/api/agents');
      setAgents(data);
    } catch (err) {
      console.error('Failed to load agents list', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTicket();
    fetchAgents();

    // Set up SSE event listener locally for this ticket's comments or updates
    // In App.tsx we run a global SSE. For simple detail pages, reloading on event works.
    // We can subscribe to the window event trigger by App.tsx
    const handleSseUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type, data } = customEvent.detail;

      if (
        (type === 'COMMENT_ADDED' && data.ticketId === id) ||
        (type === 'TICKET_UPDATED' && data.id === id)
      ) {
        // Silently refresh details
        fetchTicket();
      }
    };

    window.addEventListener('ticket-sse-event', handleSseUpdate);
    return () => {
      window.removeEventListener('ticket-sse-event', handleSseUpdate);
    };
  }, [id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    setCommenting(true);
    try {
      await apiCall<Comment>(`/api/tickets/${id}/comments`, {
        method: 'POST',
        body: { content: commentContent }
      });
      
      setCommentContent('');
      // Force reload ticket to capture update status + new audit logs
      fetchTicket();
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setCommenting(false);
    }
  };

  const handleFieldChange = async (fieldName: string, value: any) => {
    if (!ticket) return;
    setUpdatingField(fieldName);

    try {
      const updated = await apiCall<TicketDetail>(`/api/tickets/${id}`, {
        method: 'PATCH',
        body: { [fieldName]: value }
      });
      setTicket(prev => prev ? { ...prev, ...updated, auditLogs: updated.auditLogs || prev.auditLogs } : null);
      // Fetch ticket again to fully refresh audit logs
      fetchTicket();
    } catch (err: any) {
      alert(err.message || 'Failed to update field');
    } finally {
      setUpdatingField(null);
    }
  };

  const handleCloseTicket = async () => {
    if (!window.confirm('Are you sure you want to close this ticket?')) return;
    handleFieldChange('status', 'CLOSED');
  };

  const handleInsertDraftResponse = () => {
    if (ticket?.suggestedResponse) {
      setCommentContent(ticket.suggestedResponse);
    }
  };

  const parseAuditLogMessage = (log: AuditLog) => {
    const actor = `${log.user.name} (${log.user.role})`;
    try {
      const details = JSON.parse(log.details);
      switch (log.action) {
        case 'TICKET_CREATED':
          return `${actor} created the ticket with ${details.category} category & ${details.priority} priority.`;
        case 'STATUS_CHANGE':
          return `${actor} changed status from "${details.old}" to "${details.new}".`;
        case 'PRIORITY_CHANGE':
          return `${actor} changed priority from "${details.old}" to "${details.new}".`;
        case 'CATEGORY_CHANGE':
          return `${actor} changed category from "${details.old}" to "${details.new}".`;
        case 'ASSIGNMENT':
          return `${actor} changed assignee from "${details.old}" to "${details.new}".`;
        case 'COMMENT_ADDED':
          return `${actor} added a comment.`;
        default:
          return `${actor} performed action ${log.action}.`;
      }
    } catch (e) {
      return `${actor} performed action: ${log.action}.`;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 0' }}>
        <div className="spinner" style={{ width: '48px', height: '48px', color: 'var(--primary)' }}></div>
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading ticket details...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <div style={{
          backgroundColor: 'var(--danger-glow)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--danger)',
          padding: '24px',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Failed to Load Ticket</h3>
          <p style={{ marginBottom: '16px' }}>{error || 'Ticket not found.'}</p>
          <button className="btn btn-secondary" onClick={() => window.location.hash = '/'}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '80px' }}>
      {/* Back Button */}
      <button 
        className="btn btn-secondary" 
        onClick={() => window.location.hash = '/'} 
        style={{ marginBottom: '24px', padding: '8px 16px', fontSize: '0.85rem' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Dashboard
      </button>

      {/* Detail Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '32px',
        alignItems: 'start'
      }} className="details-layout-split">
        
        {/* Left Column: Title, Description, Comments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Ticket Header & Description */}
          <div className="glass" style={{ padding: '32px' }}>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: 600 }}>EDIT TICKET DETAILS</span>
                <div className="form-group">
                  <label htmlFor="edit-title">Ticket Title</label>
                  <input
                    id="edit-title"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ fontSize: '1.1rem', padding: '10px 14px' }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-desc">Description</label>
                  <textarea
                    id="edit-desc"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    style={{ minHeight: '150px', padding: '12px 16px', lineHeight: '1.6' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={updatingField === 'details'}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveEdit} disabled={updatingField === 'details' || !editTitle.trim() || !editDescription.trim()}>
                    {updatingField === 'details' ? <span className="spinner"></span> : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: 600 }}>TICKET ID: {ticket.id}</span>
                    <h1 style={{ fontSize: '2rem', marginTop: '6px', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>
                      {ticket.title}
                    </h1>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!isAgent && ticket.createdById === user?.id && ticket.status !== 'CLOSED' && (
                      <button className="btn btn-secondary" onClick={startEditing} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                        Edit Ticket
                      </button>
                    )}
                    {!isAgent && ticket.status !== 'CLOSED' && (
                      <button className="btn btn-danger" onClick={handleCloseTicket} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                        Close Ticket
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ 
                  backgroundColor: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: '20px', 
                  lineHeight: '1.6', 
                  fontSize: '1rem',
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {ticket.description}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Submitted by <strong>{ticket.createdBy.name}</strong> ({ticket.createdBy.email})</span>
              <span>Created: {formatDate(ticket.createdAt)}</span>
            </div>
          </div>

          {/* Comments Section */}
          <div className="glass" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', fontFamily: 'var(--font-display)' }}>
              Discussion Log
            </h3>

            {/* Comments Stream */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {ticket.comments.length === 0 ? (
                <p style={{ color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                  No replies posted yet.
                </p>
              ) : (
                ticket.comments.map(c => {
                  const isCommentByAgent = c.user.role === 'AGENT';
                  const isMe = c.userId === user?.id;

                  return (
                    <div 
                      key={c.id} 
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        width: '100%'
                      }}
                    >
                      <div style={{
                        maxWidth: '85%',
                        padding: '16px 20px',
                        borderRadius: 'var(--radius-md)',
                        borderTopLeftRadius: isMe ? 'var(--radius-md)' : 0,
                        borderTopRightRadius: isMe ? 0 : 'var(--radius-md)',
                        backgroundColor: isMe 
                          ? (isCommentByAgent ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.04)') 
                          : (isCommentByAgent ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)'),
                        border: isCommentByAgent 
                          ? '1px solid rgba(99, 102, 241, 0.25)' 
                          : '1px solid var(--border-color)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '6px', fontSize: '0.75rem' }}>
                          <span style={{ fontWeight: 600, color: isCommentByAgent ? 'var(--accent)' : 'var(--info)' }}>
                            {c.user.name} {isCommentByAgent && ' (Staff)'}
                          </span>
                          <span style={{ color: 'var(--text-dark)' }}>{formatDate(c.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: '0.92rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                          {c.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Form */}
            {ticket.status === 'CLOSED' ? (
              <div style={{
                textAlign: 'center',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255,255,255,0.01)',
                border: '1px dashed var(--border-color)',
                color: 'var(--text-dark)',
                fontSize: '0.9rem'
              }}>
                This ticket is closed. Re-open/unclose is not supported.
              </div>
            ) : (
              <form onSubmit={handlePostComment} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <textarea
                  placeholder="Type your message here..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  disabled={commenting}
                  required
                  style={{ minHeight: '100px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={commenting || !commentContent.trim()}>
                    {commenting ? <span className="spinner"></span> : 'Send Reply'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Metadata, AI, Audit Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Metadata Desk Cards */}
          <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', fontFamily: 'var(--font-display)' }}>
              Ticket Metadata
            </h3>

            {/* Status Field */}
            <div className="form-group">
              <label>Status</label>
              {isAgent ? (
                <select
                  value={ticket.status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  disabled={updatingField === 'status'}
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              ) : (
                <div>
                  <span className={`badge badge-status-${ticket.status.toLowerCase()}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>

            {/* Priority Field */}
            <div className="form-group">
              <label>Priority</label>
              {isAgent ? (
                <select
                  value={ticket.priority}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                  disabled={updatingField === 'priority'}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              ) : (
                <div>
                  <span className={`badge badge-priority-${ticket.priority.toLowerCase()}`}>
                    {ticket.priority}
                  </span>
                </div>
              )}
            </div>

            {/* Category Field */}
            <div className="form-group">
              <label>Category</label>
              {isAgent ? (
                <select
                  value={ticket.category}
                  onChange={(e) => handleFieldChange('category', e.target.value)}
                  disabled={updatingField === 'category'}
                >
                  <option value="Billing">Billing</option>
                  <option value="Technical Issue">Technical Issue</option>
                  <option value="Account Access">Account Access</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="General Inquiry">General Inquiry</option>
                </select>
              ) : (
                <span className="badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-muted)', alignSelf: 'flex-start' }}>
                  {ticket.category}
                </span>
              )}
            </div>

            {/* Assignee Field */}
            <div className="form-group">
              <label>Assignee</label>
              {isAgent ? (
                <select
                  value={ticket.assignedToId || ''}
                  onChange={(e) => handleFieldChange('assignedToId', e.target.value)}
                  disabled={updatingField === 'assignedToId'}
                >
                  <option value="">Unassigned</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                  {ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned'}
                </span>
              )}
            </div>
          </div>

          {/* AI Suggested Response Box (Agent only) */}
          {isAgent && ticket.status !== 'CLOSED' && ticket.suggestedResponse && (
            <div className="glass" style={{
              padding: '24px',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              background: 'rgba(168, 85, 247, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                  <path d="M12 2a10 10 0 0 1 7.54 16.59A6 6 0 0 0 22 22v-1a5 5 0 0 0-3.3-4.7A10 10 0 0 1 12 2Z" />
                  <path d="M21 16V8a2 2 0 0 0-2-2h-3" />
                  <path d="M3 16V8a2 2 0 0 1 2-2h3" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>
                  AI Suggested Response
                </h3>
              </div>

              <div style={{
                backgroundColor: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                fontSize: '0.85rem',
                lineHeight: '1.6',
                color: 'var(--text-muted)',
                maxHeight: '160px',
                overflowY: 'auto',
                marginBottom: '16px',
                whiteSpace: 'pre-wrap'
              }}>
                {ticket.suggestedResponse}
              </div>

              <button className="btn btn-secondary" onClick={handleInsertDraftResponse} style={{
                width: '100%',
                fontSize: '0.8rem',
                padding: '8px 16px',
                borderColor: 'var(--accent)',
                color: 'var(--text-main)',
                backgroundColor: 'rgba(168, 85, 247, 0.05)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.05)'}
              >
                Use Suggested Response
              </button>
            </div>
          )}

          {/* Audit Trail / History */}
          <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', fontFamily: 'var(--font-display)' }}>
              Activity History
            </h3>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '6px'
            }}>
              {ticket.auditLogs.map((log) => (
                <div key={log.id} style={{
                  display: 'flex',
                  gap: '12px',
                  fontSize: '0.8rem',
                  alignItems: 'flex-start'
                }}>
                  {/* Timeline dot */}
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: log.action === 'TICKET_CREATED' ? 'var(--info)' : (log.action === 'STATUS_CHANGE' ? 'var(--warning)' : 'var(--primary)'),
                    marginTop: '4px',
                    flexShrink: 0
                  }}></div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {parseAuditLogMessage(log)}
                    </span>
                    <span style={{ color: 'var(--text-dark)', fontSize: '0.7rem' }}>
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
      
      {/* Styles for Split Column Layout */}
      <style>{`
        @media (min-width: 992px) {
          .details-layout-split {
            grid-template-columns: 3fr 2fr !important;
          }
        }
      `}</style>
    </div>
  );
};
