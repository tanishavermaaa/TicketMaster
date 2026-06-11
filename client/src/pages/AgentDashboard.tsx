import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface UserSummary {
  id: string;
  name: string;
  email: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdById: string;
  createdBy: UserSummary;
  assignedToId: string | null;
  assignedTo: UserSummary | null;
  createdAt: string;
}

interface AnalyticsData {
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  avgResolutionTimeHours: number;
  slaBreachedCount: number;
  totalTickets: number;
}

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<UserSummary[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAgents = async () => {
    try {
      const data = await apiCall<UserSummary[]>('/api/agents');
      setAgents(data);
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await apiCall<AnalyticsData>('/api/analytics');
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '8',
        search,
        status,
        priority,
        category,
        assigneeId
      });
      const data = await apiCall<{ tickets: Ticket[]; pagination: { totalPages: number } }>(
        `/api/tickets?${queryParams.toString()}`
      );
      setTickets(data.tickets);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [page, search, status, priority, category, assigneeId]);

  useEffect(() => {
    const handleSseUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type } = customEvent.detail;
      if (type === 'TICKET_CREATED' || type === 'TICKET_UPDATED') {
        fetchTickets();
        fetchAnalytics();
      }
    };

    window.addEventListener('ticket-sse-event', handleSseUpdate);
    return () => {
      window.removeEventListener('ticket-sse-event', handleSseUpdate);
    };
  }, [page, search, status, priority, category, assigneeId]);

  const handleAssignToMe = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation
    if (!user) return;

    try {
      await apiCall(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        body: { assignedToId: user.id }
      });
      fetchTickets();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message || 'Failed to assign ticket');
    }
  };

  const getSlaIndicator = (ticketPriority: string, createdAtStr: string, ticketStatus: string) => {
    if (ticketStatus === 'RESOLVED' || ticketStatus === 'CLOSED') {
      return <span className="sla-tag sla-ok">Met</span>;
    }

    const createdAt = new Date(createdAtStr);
    const now = new Date();
    const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    let limit = 48;
    if (ticketPriority === 'Critical') limit = 1;
    else if (ticketPriority === 'High') limit = 4;
    else if (ticketPriority === 'Medium') limit = 24;

    if (ageHours > limit) {
      return <span className="sla-tag sla-breached">Breached</span>;
    }

    const remaining = limit - ageHours;
    if (remaining < limit * 0.25) {
      return <span className="sla-tag sla-warning">Escalate</span>;
    }

    return <span className="sla-tag sla-ok">Active</span>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '60px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
          Support Agent <span className="text-gradient">Triage Desk</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Triage, assign, and resolve customer support tickets</p>
      </div>

      {/* Analytics Grid */}
      {analytics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
          marginBottom: '40px'
        }}>
          <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Open Tickets</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--info)' }}>
              {analytics.statusCounts.OPEN}
            </span>
          </div>

          <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>In Progress</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--warning)' }}>
              {analytics.statusCounts.IN_PROGRESS}
            </span>
          </div>

          <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Avg Resolution</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--success)' }}>
              {analytics.avgResolutionTimeHours} hr
            </span>
          </div>

          <div className="glass" style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            border: analytics.slaBreachedCount > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
            background: analytics.slaBreachedCount > 0 ? 'rgba(239, 68, 68, 0.02)' : 'var(--bg-glass)'
          }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>SLA Breached</span>
            <span style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: analytics.slaBreachedCount > 0 ? 'var(--danger)' : 'var(--text-main)',
              animation: analytics.slaBreachedCount > 0 ? 'pulse 2s infinite' : 'none',
              borderRadius: 'var(--radius-sm)'
            }}>
              {analytics.slaBreachedCount}
            </span>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      <div className="glass" style={{ padding: '24px', marginBottom: '30px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filters & Query Controls
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search title/desc..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: '36px' }}
            />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dark)" strokeWidth="2.5" style={{ position: 'absolute', left: '12px', top: '15px' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Status */}
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Priority */}
          <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <option value="">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>

          {/* Category */}
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            <option value="Billing">Billing</option>
            <option value="Technical Issue">Technical Issue</option>
            <option value="Account Access">Account Access</option>
            <option value="Feature Request">Feature Request</option>
            <option value="General Inquiry">General Inquiry</option>
          </select>

          {/* Assignee */}
          <select value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); setPage(1); }}>
            <option value="">All Assignees</option>
            <option value="unassigned">Unassigned Only</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Error */}
      {error && (
        <div style={{
          backgroundColor: 'var(--danger-glow)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--danger)',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px'
        }}>
          {error}
        </div>
      )}

      {/* Tickets Table / List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', color: 'var(--primary)' }}></div>
          <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Fetching desk tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem' }}>No tickets match the query criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Table Wrap */}
          <div className="glass" style={{ overflowX: 'auto', border: '1px solid var(--border-color)' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.9rem'
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Ticket</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Priority</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Customer</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Assignee</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Created</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>SLA</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => window.location.hash = `/ticket/${ticket.id}`}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                        {ticket.title}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>ID: {ticket.id.substring(0, 8)}...</span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className={`badge badge-status-${ticket.status.toLowerCase()}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className={`badge badge-priority-${ticket.priority.toLowerCase()}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                      {ticket.category}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 500 }}>{ticket.createdBy.name}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{ticket.createdBy.email}</span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {ticket.assignedTo ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--text-main)'
                        }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></span>
                          {ticket.assignedTo.name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                      {formatDate(ticket.createdAt)}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {getSlaIndicator(ticket.priority, ticket.createdAt, ticket.status)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      {!ticket.assignedToId && (
                        <button 
                          className="btn btn-secondary" 
                          onClick={(e) => handleAssignToMe(ticket.id, e)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm)'
                          }}
                        >
                          Claim
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '8px 16px' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Page <strong>{page}</strong> of {totalPages}
              </span>
              <button 
                className="btn btn-secondary" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '8px 16px' }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
