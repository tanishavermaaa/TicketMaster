import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export interface NotificationItem {
  id: string;
  message: string;
  createdAt: Date;
  read: boolean;
  link: string;
}

interface NavbarProps {
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  notifications,
  onMarkAllAsRead,
  onClearNotifications
}) => {
  const { user, logout, isAgent } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = (link: string) => {
    setShowNotifications(false);
    window.location.hash = link;
  };

  return (
    <header className="glass" style={{
      borderRadius: 0,
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      marginBottom: '32px'
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '70px'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => window.location.hash = '/'}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px var(--primary-glow))' }}>
            <path d="M15 5v14" />
            <path d="M9 5v14" />
            <path d="M12 5v14" />
            <rect width="18" height="14" x="3" y="5" rx="2" />
          </svg>
          <span className="text-gradient" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem' }}>
            TicketMaster<span style={{ fontSize: '0.85rem', verticalAlign: 'super', fontWeight: 500, color: 'var(--accent)', marginLeft: '2px' }}>AI</span>
          </span>
        </div>

        {/* User profile & Actions */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Navigation links for Agents */}
            {isAgent && (
              <div style={{ display: 'flex', gap: '16px', marginRight: '10px' }}>
                <a href="#/" style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>Dashboard</a>
                <a href="#/analytics" style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}>Analytics</a>
              </div>
            )}

            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    backgroundColor: 'var(--danger)',
                    color: 'white',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="glass animate-fade-in" style={{
                  position: 'absolute',
                  right: 0,
                  top: '40px',
                  width: '320px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  zIndex: 200,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <h4 style={{ fontSize: '0.95rem' }}>Notifications</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {unreadCount > 0 && (
                        <button onClick={onMarkAllAsRead} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>Read All</button>
                      )}
                      {notifications.length > 0 && (
                        <button onClick={onClearNotifications} style={{ background: 'none', border: 'none', color: 'var(--text-dark)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>Clear</button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {notifications.length === 0 ? (
                      <p style={{ color: 'var(--text-dark)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>No new notifications</p>
                    ) : (
                      notifications.map(item => (
                        <div 
                          key={item.id} 
                          onClick={() => handleNotificationClick(item.link)}
                          style={{
                            padding: '10px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: item.read ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                            borderLeft: item.read ? 'none' : '3px solid var(--primary)',
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = item.read ? 'transparent' : 'rgba(255, 255, 255, 0.02)'}
                        >
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '4px' }}>{item.message}</p>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.name}</p>
                <span className={`badge ${isAgent ? 'badge-status-resolved' : 'badge-status-open'}`} style={{ fontSize: '0.65rem', padding: '2px 6px', marginTop: '2px' }}>
                  {user.role}
                </span>
              </div>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: 'white',
                fontFamily: 'var(--font-display)',
                fontSize: '1rem'
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Logout Button */}
            <button className="btn btn-secondary" onClick={logout} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
