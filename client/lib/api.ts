import axios from 'axios'
import Cookies from 'js-cookie'
import toast from 'react-hot-toast'
import { attachDebugInterceptors, errorHandlers, detectNetworkIssue, formatAxiosError } from './axios-debug'

const getApiBaseUrl = () => {
  // First check for environment variable
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // In production, use relative URL for same-origin requests
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // Use relative path for production (works with Nginx proxy)
    return '/api';
  }
  
  // In development, always use direct localhost URL to avoid rewrite issues
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Attach debugging interceptors in development
if (process.env.NODE_ENV === 'development') {
  attachDebugInterceptors(api);
}

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Debug logging for CSRF token requests
    if (config.url?.includes('csrf-token')) {
      console.log('CSRF token request:', {
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        method: config.method
      });
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors and token refresh
api.interceptors.response.use(
  (response) => {
    // Debug logging for CSRF token responses
    if (response.config.url?.includes('csrf-token')) {
      console.log('CSRF token response:', {
        status: response.status,
        data: response.data,
        headers: response.headers
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Debug logging for CSRF token errors
    if (originalRequest?.url?.includes('csrf-token')) {
      console.error('CSRF token error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        config: originalRequest
      });
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = Cookies.get('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          });

          const { token, refreshToken: rotated } = response.data;
          Cookies.set('token', token);
          if (rotated) {
            Cookies.set('refreshToken', rotated);
          }
          
          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens but don't redirect
          Cookies.remove('token');
          Cookies.remove('refreshToken');
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, clear token but don't redirect
        Cookies.remove('token');
      }
    } else if (error.response?.status === 500) {
      toast.error('Terjadi kesalahan server');
    }
    return Promise.reject(error);
  }
)

// API endpoints
export const authAPI = {
  login: async (data: { username: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    // Store refresh token
    if (response.data.refreshToken) {
      Cookies.set('refreshToken', response.data.refreshToken);
    }
    return response;
  },
  register: (data: any) => api.post('/auth/register', data),
  profile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  changePassword: (data: any) => api.put('/auth/change-password', data),
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Always clear tokens
      Cookies.remove('token');
      Cookies.remove('refreshToken');
    }
  },
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
}

export const jobsAPI = {
  getAll: (params?: any) => api.get('/jobs', { params }),
  getById: (id: string) => api.get(`/jobs/${id}`),
  create: (data: FormData) => api.post('/jobs', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateStatus: (id: string, data: any) => api.put(`/jobs/${id}/status`, data),
  assign: (id: string, data: any) => api.post(`/jobs/${id}/assign`, data),
  selfAssign: (id: string) => api.post(`/jobs/${id}/self-assign`, {}),
  confirm: (id: string, data: { action: 'ACCEPT' | 'DECLINE' }) => api.post(`/jobs/${id}/confirm`, data),
  complete: (id: string, data: FormData) => api.put(`/jobs/${id}/complete`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id: string) => api.delete(`/jobs/${id}`),
}

export const techniciansAPI = {
  getAll: () => api.get('/technicians'),
  getById: (id: string) => api.get(`/technicians/${id}`),
  getAvailable: () => api.get('/technicians/available/for-job'),
  create: (data: any) => api.post('/technicians', data),
  update: (id: string, data: any) => api.put(`/technicians/${id}`, data),
  delete: (id: string) => api.delete(`/technicians/${id}`),
}

export const inventoryAPI = {
  getItems: (params?: any) => api.get('/inventory/items', { params }),
  getItemById: (id: string) => api.get(`/inventory/items/${id}`),
  createItem: (data: any) => api.post('/inventory/items', data),
  updateItem: (id: string, data: any) => api.put(`/inventory/items/${id}`, data),
  addStock: (id: string, data: any) => api.post(`/inventory/items/${id}/stock/add`, data),
  removeStock: (id: string, data: any) => api.post(`/inventory/items/${id}/stock/remove`, data),
  returnStock: (id: string, data: any) => api.post(`/inventory/items/${id}/stock/return`, data),
  damageStock: (id: string, data: any) => api.post(`/inventory/items/${id}/stock/damage`, data),
  getLogs: (params?: any) => api.get('/inventory/logs', { params }),
  getLowStock: () => api.get('/inventory/low-stock'),
}

export const customersAPI = {
  getAll: (params?: any) => api.get('/customers', { params }),
  getById: (id: string) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data),
  registerPublic: (data: FormData) => api.post('/customers/register', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  checkPhoneExists: (phone: string) => api.post('/customers/check-phone', { phone }),
  // Email verification endpoints removed - no longer required
  getCSRFToken: () => {
    console.log('Fetching CSRF token from:', `${API_BASE_URL}/customers/register/csrf-token`);
    return api.get('/customers/register/csrf-token');
  },
}

export const reportsAPI = {
  getDashboard: () => api.get('/reports/dashboard'),
  getJobs: (params?: any) => api.get('/reports/jobs', { params }),
  getInventory: (params?: any) => api.get('/reports/inventory', { params }),
  getTechnicians: (params?: any) => api.get('/reports/technicians', { params }),
}

// WhatsApp API endpoints
export const whatsappAPI = {
  getStatus: () => api.get('/whatsapp/status'),
  getStats: () => api.get('/whatsapp/stats'),
  sendTestMessage: (data: { phone: string; message?: string }) => api.post('/monitoring/whatsapp/test', data),
  initialize: () => api.post('/whatsapp/initialize'),
  sendMessage: (data: { to: string; message: string }) => api.post('/whatsapp/send', data),
}

// Monitoring API endpoints
export const monitoringAPI = {
  getSystemStats: () => api.get('/monitoring/stats'),
  getWhatsAppStatus: () => api.get('/monitoring/whatsapp/status'),
  testWhatsApp: (data: { phone: string; message?: string }) => api.post('/monitoring/whatsapp/test', data),
}

// Development API testing utilities (only available in development)
export const devAPI = {
  // Test all API endpoints
  testAllEndpoints: async () => {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('API testing only available in development mode');
      return;
    }

    const { APITester } = await import('./axios-debug');
    const tester = new APITester(API_BASE_URL);
    
    console.group('🧪 Testing All API Endpoints');
    
    // Test basic endpoints
    await tester.testEndpoint('GET', '/health');
    await tester.testEndpoint('GET', '/api/health');
    
    // Test WhatsApp endpoints
    await tester.testEndpoint('GET', '/api/whatsapp/status');
    await tester.testEndpoint('GET', '/api/whatsapp/stats');
    
    // Test monitoring endpoints
    await tester.testEndpoint('GET', '/api/monitoring/stats');
    await tester.testEndpoint('GET', '/api/monitoring/whatsapp/status');
    
    // Run full diagnostics
    await tester.runDiagnostics();
    
    console.groupEnd();
  },
  
  // Test specific endpoint
  testEndpoint: async (method: string, path: string, data?: any) => {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('API testing only available in development mode');
      return;
    }

    const { APITester } = await import('./axios-debug');
    const tester = new APITester(API_BASE_URL);
    await tester.testEndpoint(method, path, data);
  }
}

