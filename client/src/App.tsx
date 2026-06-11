import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import type { NotificationItem } from './components/Navbar';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { AgentDashboard } from './pages/AgentDashboard';
import { TicketDetails } from './pages/TicketDetails';
import { Analytics } from './pages/Analytics';

// Custom Hook to manage Hash Routing
function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash || '#/');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '#/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return route;
}

interface ToastMessage {
  id: string;
  message: string;
}

const AppContent: React.FC = () => {
  const { user, token, loading, isAuthenticated, isAgent } = useAuth();
  const route = useHashRoute();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message }]);
    
    // Automatically dismiss toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // SSE Event Listener for Live Updates
  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return;
    }

    const BASE_URL = (import.meta.env.VITE_API_URL as string) || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');
    const sseUrl = `${BASE_URL}/api/tickets/events?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'CONNECTED' || parsed.type === 'PING') {
          return;
        }

        // Broadcast event locally to nested pages (e.g. TicketDetails)
        const localEvent = new CustomEvent('ticket-sse-event', { detail: parsed });
        window.dispatchEvent(localEvent);

        // Map events to user role notifications
        let alertText = '';
        let routeLink = '/';

        if (parsed.type === 'TICKET_CREATED') {
          // Both agents and customers can notice a new ticket (if customer created it, or for agents)
          if (isAgent) {
            alertText = `New ticket created by ${parsed.data.createdBy.name}: "${parsed.data.title}"`;
            routeLink = `/ticket/${parsed.data.id}`;
          }
        } else if (parsed.type === 'TICKET_UPDATED') {
          const isOwner = parsed.data.createdById === user?.id;
          
          if (isAgent || isOwner) {
            const changeDesc = parsed.data.lastChange || `status updated to ${parsed.data.status.replace('_', ' ')}`;
            alertText = `Ticket "${parsed.data.title}": ${changeDesc}`;
            routeLink = `/ticket/${parsed.data.id}`;
          }
        } else if (parsed.type === 'COMMENT_ADDED') {
          // If comment is by someone else
          if (parsed.data.comment.userId !== user?.id) {
            alertText = `${parsed.data.comment.user.name} commented: "${parsed.data.comment.content.substring(0, 30)}..."`;
            routeLink = `/ticket/${parsed.data.ticketId}`;
          }
        }

        if (alertText) {
          const newNotification: NotificationItem = {
            id: `${Date.now()}-${Math.random()}`,
            message: alertText,
            createdAt: new Date(),
            read: false,
            link: routeLink
          };

          setNotifications(prev => [newNotification, ...prev].slice(0, 15));
          showToast(alertText);
        }
      } catch (error) {
        console.error('Failed to parse SSE event data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.warn('SSE disconnected, connection will retry automatically.', error);
    };

    return () => {
      eventSource.close();
    };
  }, [token, isAgent, user]);

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: '64px', height: '64px', borderWidth: '4px', color: 'var(--primary)' }}></div>
      </div>
    );
  }

  // 1. Unauthenticated Router Scaffolding
  if (!isAuthenticated) {
    if (route === '#/register') {
      return <Register />;
    }
    return <Login />;
  }

  // 2. Authenticated Navigation Router Scaffolding
  let PageComponent = <div style={{ padding: '40px', textAlign: 'center' }}>404 Not Found</div>;
  const hash = route.replace('#', '');

  if (hash === '/' || hash === '') {
    PageComponent = isAgent ? <AgentDashboard /> : <CustomerDashboard />;
  } else if (hash === '/analytics') {
    PageComponent = isAgent ? <Analytics /> : <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>Access Denied</div>;
  } else if (hash.startsWith('/ticket/')) {
    const ticketId = hash.replace('/ticket/', '');
    PageComponent = <TicketDetails id={ticketId} />;
  } else if (hash === '/login' || hash === '/register') {
    // Authenticated users redirecting away from auth pages
    window.location.hash = '/';
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar 
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearNotifications={handleClearNotifications}
      />
      
      <main style={{ flex: 1 }}>
        {PageComponent}
      </main>

      {/* Floating Real-Time Notifications Overlay */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast toast-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Real-Time Alert</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{toast.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};
