import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
}

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Pagination and Filtering states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '6',
        status: statusFilter,
        search
      });
      const data = await apiCall<{ tickets: Ticket[]; pagination: { totalPages: number } }>(
        `/api/tickets?${queryParams.toString()}`
      );
      setTickets(data.tickets);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [page, statusFilter, search]);

  useEffect(() => {
    const handleSseUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type } = customEvent.detail;
      if (type === 'TICKET_CREATED' || type === 'TICKET_UPDATED') {
        fetchTickets();
      }
    };

    window.addEventListener('ticket-sse-event', handleSseUpdate);
    return () => {
      window.removeEventListener('ticket-sse-event', handleSseUpdate);
    };
  }, [page, statusFilter, search]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setCreating(true);
    setError(null);

    try {
      await apiCall('/api/tickets', {
        method: 'POST',
        body: { title, description }
      });
      setTitle('');
      setDescription('');
      setIsModalOpen(false);
      setPage(1); // Reset to page 1 to see the new ticket
      fetchTickets();
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
      setCreating(false);
    } finally {
      setCreating(false);
    }
  };

  const getSlaIndicator = (priority: string, createdAtStr: string, status: string) => {
    if (status === 'RESOLVED' || status === 'CLOSED') {
      return <span className="sla-tag sla-ok">SLA: Met</span>;
    }

    const createdAt = new Date(createdAtStr);
    const now = new Date();
    const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    let limit = 48; // Low priority
    if (priority === 'Critical') limit = 1;
    else if (priority === 'High') limit = 4;
    else if (priority === 'Medium') limit = 24;

    if (ageHours > limit) {
      return (
        <span className="sla-tag sla-breached">
          SLA Breached ({Math.floor(ageHours - limit)}h overdue)
        </span>
      );
    }

    const remaining = limit - ageHours;
    if (remaining < limit * 0.25) {
      return (
        <span className="sla-tag sla-warning">
          SLA Warning ({Math.ceil(remaining)}h remaining)
        </span>
      );
    }

    return (
      <span className="sla-tag sla-ok">
        SLA OK ({Math.ceil(remaining)}h left)
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '60px' }}>
      {/* Dashboard Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: '40px'
      }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
            Welcome back, <span className="text-gradient">{user?.name}</span>
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Create new support tickets or monitor ongoing requests</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create New Ticket
        </button>
      </div>

      {/* Filters & Search Grid */}
      <div className="glass" style={{
        padding: '20px',
        marginBottom: '30px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1', minWidth: '260px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search tickets by title or description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: '40px' }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-dark)" strokeWidth="2.5" style={{ position: 'absolute', left: '14px', top: '15px' }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <div style={{ width: '200px' }}>
          <select 
            value={statusFilter} 
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Tickets List Area */}
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div className="spinner" style={{ width: '48px', height: '48px', borderWidth: '3px', color: 'var(--primary)' }}></div>
          <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-dark)" strokeWidth="1.5">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 17h6" />
            <path d="M9 13h6" />
            <path d="M9 9h6" />
          </svg>
          <div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>No tickets found</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              {search || statusFilter 
                ? 'Try adjusting your filters or search terms' 
                : "You haven't submitted any support tickets yet."}
            </p>
          </div>
          {!search && !statusFilter && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              Submit Your First Ticket
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '24px'
          }}>
            {tickets.map(ticket => (
              <div 
                key={ticket.id} 
                className="glass animate-fade-in" 
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
                onClick={() => window.location.hash = `/ticket/${ticket.id}`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 12px 30px -10px var(--primary-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'var(--shadow)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <span className={`badge badge-status-${ticket.status.toLowerCase()}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>
                    {formatDate(ticket.createdAt)}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-main)' }}>
                    {ticket.title}
                  </h3>
                  <p style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.5'
                  }}>
                    {ticket.description}
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '14px',
                  marginTop: 'auto'
                }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-muted)' }}>
                      {ticket.category}
                    </span>
                    <span className={`badge badge-priority-${ticket.priority.toLowerCase()}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  {getSlaIndicator(ticket.priority, ticket.createdAt, ticket.status)}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '30px' }}>
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

      {/* Create Ticket Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass animate-fade-in" style={{
            width: '100%',
            maxWidth: '600px',
            padding: '40px',
            position: 'relative'
          }}>
            <button 
              onClick={() => {
                if (!creating) setIsModalOpen(false);
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.5rem'
              }}
            >
              &times;
            </button>

            <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
              Create Support Ticket
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
              Describe the issue you're facing. Our AI agent will automatically prioritize, categorize, and draft a response.
            </p>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label htmlFor="ticket-title">Ticket Title</label>
                <input
                  id="ticket-title"
                  type="text"
                  placeholder="e.g. Cannot process credit card payment"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={creating}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="ticket-desc">Detailed Description</label>
                <textarea
                  id="ticket-desc"
                  placeholder="Describe your issue in detail. If relevant, include any error codes or steps to reproduce."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={creating}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={creating || !title.trim() || !description.trim()}
                >
                  {creating ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="spinner"></span>
                      <span>AI Triage Analysing...</span>
                    </div>
                  ) : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
