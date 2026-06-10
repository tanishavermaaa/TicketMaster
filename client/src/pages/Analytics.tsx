import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';

interface AnalyticsData {
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  avgResolutionTimeHours: number;
  slaBreachedCount: number;
  totalTickets: number;
  agentWorkloads: Array<{
    id: string;
    name: string;
    email: string;
    activeTicketsCount: number;
  }>;
}

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const result = await apiCall<AnalyticsData>('/api/analytics');
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch analytics metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 0' }}>
        <div className="spinner" style={{ width: '48px', height: '48px', color: 'var(--primary)' }}></div>
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Calculating dashboard insights...</p>
      </div>
    );
  }

  if (error || !data) {
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
          <h3>Failed to Load Analytics</h3>
          <p>{error || 'Access denied or data unavailable.'}</p>
        </div>
      </div>
    );
  }

  // Helper values for drawing SVG charts
  const maxCategoryCount = Math.max(...Object.values(data.categoryCounts), 1);
  const maxPriorityCount = Math.max(...Object.values(data.priorityCounts), 1);

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
          Help Desk <span className="text-gradient">Performance Insights</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Operational intelligence, SLA status metrics, and agent load distributions</p>
      </div>

      {/* Overview stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        <div className="glass" style={{ padding: '24px', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '8px' }}>Total Volume</h4>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{data.totalTickets}</p>
        </div>

        <div className="glass" style={{ padding: '24px', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '8px' }}>Avg Resolution</h4>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--success)' }}>
            {data.avgResolutionTimeHours}h
          </p>
        </div>

        <div className="glass" style={{ padding: '24px', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '8px' }}>Active Backlog</h4>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--warning)' }}>
            {data.statusCounts.OPEN + data.statusCounts.IN_PROGRESS}
          </p>
        </div>

        <div className="glass" style={{ padding: '24px', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '8px' }}>SLA Breaches</h4>
          <p style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            color: data.slaBreachedCount > 0 ? 'var(--danger)' : 'var(--text-main)'
          }}>
            {data.slaBreachedCount}
          </p>
        </div>
      </div>

      {/* Visual Graphs Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '32px',
        marginBottom: '40px'
      }} className="charts-grid-split">
        
        {/* Category Breakdown (Horizontal Bar chart) */}
        <div className="glass" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>
            Volume by Category
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Object.entries(data.categoryCounts).map(([cat, count]) => {
              const pct = (count / maxCategoryCount) * 100;
              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 500 }}>{cat}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count} tickets</span>
                  </div>
                  {/* Progress bar wrap */}
                  <div style={{
                    width: '100%',
                    height: '10px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '5px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                      borderRadius: '5px',
                      transition: 'width 1s ease-in-out'
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Breakdown (Vertical SVG Bar Chart) */}
        <div className="glass" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>
            Backlog by Priority
          </h3>
          <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', position: 'relative', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            {Object.entries(data.priorityCounts).map(([priority, count]) => {
              const barHeight = count > 0 ? (count / maxPriorityCount) * 150 : 4;
              let fillGradient = 'var(--info)';
              if (priority === 'Medium') fillGradient = 'var(--primary)';
              else if (priority === 'High') fillGradient = 'var(--warning)';
              else if (priority === 'Critical') fillGradient = 'var(--danger)';

              return (
                <div key={priority} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{count}</span>
                  {/* Bar */}
                  <div style={{
                    width: '36px',
                    height: `${barHeight}px`,
                    backgroundColor: fillGradient,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 1.2s ease-in-out',
                    boxShadow: `0 0 12px ${fillGradient}40`
                  }}></div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {priority}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Agents workload Section */}
      <div className="glass" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>
          Active Load Balance (Active Tickets Assigned)
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {data.agentWorkloads.length === 0 ? (
            <p style={{ color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center' }}>No active support agents registered.</p>
          ) : (
            data.agentWorkloads.map(agent => {
              const activeCount = agent.activeTicketsCount;
              // Safe percentage bounds
              const maxActive = Math.max(...data.agentWorkloads.map(a => a.activeTicketsCount), 1);
              const pct = (activeCount / maxActive) * 100;
              
              return (
                <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ width: '160px', flexShrink: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{agent.name}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{agent.email}</span>
                  </div>

                  <div style={{ flex: 1, height: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', overflow: 'hidden', minWidth: '200px' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: activeCount > 4 ? 'var(--danger)' : (activeCount > 2 ? 'var(--warning)' : 'var(--success)'),
                      borderRadius: '6px',
                      transition: 'width 1s ease'
                    }}></div>
                  </div>

                  <div style={{ width: '80px', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                    {activeCount} active
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .charts-grid-split {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
