const BASE_URL = (import.meta.env.VITE_API_URL as string) || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export async function apiCall<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  
  const token = sessionStorage.getItem('token');
  const activeHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    activeHeaders['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: activeHeaders,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 401) {
    // Session expired or unauthorized
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    
    // Redirect to login page using hash routing
    if (!window.location.hash.includes('/login') && !window.location.hash.includes('/register')) {
      window.location.hash = '/login';
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }

  return data as T;
}
