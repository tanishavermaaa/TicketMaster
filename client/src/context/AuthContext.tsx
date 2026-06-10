import React, { createContext, useState, useContext } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'AGENT';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAgent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = sessionStorage.getItem('user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (error) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        return null;
      }
    }
    return null;
  });
  const loading = false;

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    sessionStorage.setItem('token', newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));
    
    // Redirect to root route (dashboards resolve this based on role)
    window.location.hash = '/';
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.hash = '/login';
  };

  const isAuthenticated = !!token;
  const isAgent = user?.role === 'AGENT';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated, isAgent }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
