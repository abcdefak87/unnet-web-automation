/**
 * Axios Debugging Utilities
 * Enhanced error handling and debugging for API requests
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios';

// Debug configuration
export const DEBUG_CONFIG = {
  logRequests: process.env.NODE_ENV === 'development',
  logResponses: process.env.NODE_ENV === 'development',
  logErrors: true,
  includeHeaders: true,
  includeTimings: true,
};

// Request/Response timing tracker
const requestTimings = new Map<string, number>();

/**
 * Generate unique request ID
 */
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Format error for better debugging
 */
export const formatAxiosError = (error: AxiosError): {
  type: string;
  message: string;
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  data?: any;
  headers?: any;
  stack?: string;
} => {
  if (error.response) {
    // Server responded with error status
    return {
      type: 'RESPONSE_ERROR',
      message: error.message,
      status: error.response.status,
      statusText: error.response.statusText,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      data: error.response.data,
      headers: DEBUG_CONFIG.includeHeaders ? error.response.headers : undefined,
      stack: error.stack,
    };
  } else if (error.request) {
    // Request was made but no response received
    return {
      type: 'NO_RESPONSE',
      message: 'No response received from server',
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      headers: DEBUG_CONFIG.includeHeaders ? error.config?.headers : undefined,
      stack: error.stack,
    };
  } else {
    // Request setup error
    return {
      type: 'REQUEST_SETUP_ERROR',
      message: error.message,
      stack: error.stack,
    };
  }
};

/**
 * Enhanced request logger
 */
export const logRequest = (config: AxiosRequestConfig): void => {
  if (!DEBUG_CONFIG.logRequests) return;

  const requestId = generateRequestId();
  (config as any).requestId = requestId;
  
  if (DEBUG_CONFIG.includeTimings) {
    requestTimings.set(requestId, Date.now());
  }

  console.group(`📤 API Request [${requestId}]`);
  console.log('Method:', config.method?.toUpperCase());
  console.log('URL:', config.url);
  console.log('Base URL:', config.baseURL);
  console.log('Full URL:', `${config.baseURL}${config.url}`);
  
  if (config.params) {
    console.log('Query Params:', config.params);
  }
  
  if (config.data) {
    console.log('Request Body:', config.data);
  }
  
  if (DEBUG_CONFIG.includeHeaders && config.headers) {
    console.log('Headers:', config.headers);
  }
  
  console.groupEnd();
};

/**
 * Enhanced response logger
 */
export const logResponse = (response: AxiosResponse): void => {
  if (!DEBUG_CONFIG.logResponses) return;

  const requestId = (response.config as any).requestId;
  let duration = 'N/A';
  
  if (DEBUG_CONFIG.includeTimings && requestId && requestTimings.has(requestId)) {
    const startTime = requestTimings.get(requestId)!;
    duration = `${Date.now() - startTime}ms`;
    requestTimings.delete(requestId);
  }

  console.group(`📥 API Response [${requestId}] - ${duration}`);
  console.log('Status:', `${response.status} ${response.statusText}`);
  console.log('URL:', response.config.url);
  console.log('Response Data:', response.data);
  
  if (DEBUG_CONFIG.includeHeaders) {
    console.log('Response Headers:', response.headers);
  }
  
  console.groupEnd();
};

/**
 * Enhanced error logger
 */
export const logError = (error: AxiosError): void => {
  if (!DEBUG_CONFIG.logErrors) return;

  const requestId = (error.config as any)?.requestId;
  const errorInfo = formatAxiosError(error);
  
  console.group(`❌ API Error [${requestId || 'unknown'}]`);
  console.error('Error Type:', errorInfo.type);
  console.error('Message:', errorInfo.message);
  
  if (errorInfo.status) {
    console.error('Status:', `${errorInfo.status} ${errorInfo.statusText}`);
  }
  
  console.error('URL:', `${errorInfo.method} ${errorInfo.url}`);
  
  if (errorInfo.data) {
    console.error('Error Response:', errorInfo.data);
  }
  
  if (errorInfo.headers) {
    console.error('Response Headers:', errorInfo.headers);
  }
  
  if (errorInfo.stack && process.env.NODE_ENV === 'development') {
    console.error('Stack Trace:', errorInfo.stack);
  }
  
  console.groupEnd();
};

/**
 * Create debugging interceptors for axios instance
 */
export const attachDebugInterceptors = (axiosInstance: AxiosInstance) => {
  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config) => {
      logRequest(config);
      return config;
    },
    (error) => {
      console.error('Request Interceptor Error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response) => {
      logResponse(response);
      return response;
    },
    (error) => {
      logError(error);
      return Promise.reject(error);
    }
  );
};

/**
 * Common error handlers
 */
export const errorHandlers = {
  handle404: (error: AxiosError) => {
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();
    
    console.error(`
🔍 404 Not Found - Troubleshooting Guide:
════════════════════════════════════════
Request: ${method} ${url}

Possible causes:
1. ❌ Wrong HTTP method (GET vs POST vs PUT vs DELETE)
2. ❌ Incorrect endpoint path
3. ❌ Missing route on server
4. ❌ Typo in URL
5. ❌ API version mismatch

Debugging steps:
1. Check server routes file for exact endpoint definition
2. Verify HTTP method matches between frontend and backend
3. Check if middleware is blocking the route
4. Ensure server is running and routes are registered
5. Check network tab in browser DevTools
6. Test endpoint with curl/Postman

Server route checklist:
- Is the route registered? (app.use('/api/whatsapp', whatsappRoutes))
- Is the method correct? (router.get vs router.post)
- Any middleware blocking? (authentication, CORS, etc.)
`);
  },

  handle401: (error: AxiosError) => {
    console.error(`
🔐 401 Unauthorized:
════════════════════
- Token expired or invalid
- Check authentication headers
- Verify token in cookies/localStorage
`);
  },

  handle403: (error: AxiosError) => {
    console.error(`
🚫 403 Forbidden:
════════════════
- Insufficient permissions
- Check user roles
- Verify CORS configuration
`);
  },

  handle500: (error: AxiosError) => {
    console.error(`
💥 500 Internal Server Error:
════════════════════════════
- Check server logs
- Database connection issues
- Unhandled exceptions
- Missing environment variables
`);
  },
};

/**
 * Network error detector
 */
export const detectNetworkIssue = (error: AxiosError): {
  isNetworkError: boolean;
  possibleCauses: string[];
} => {
  const causes: string[] = [];
  
  if (!error.response && error.request) {
    causes.push('Server is not running');
    causes.push('Network connection lost');
    causes.push('CORS blocking the request');
    causes.push('Wrong port or hostname');
    causes.push('Firewall blocking connection');
  }
  
  if (error.code === 'ECONNREFUSED') {
    causes.push('Server refused connection - check if server is running');
  }
  
  if (error.code === 'ETIMEDOUT') {
    causes.push('Request timeout - server took too long to respond');
  }
  
  return {
    isNetworkError: causes.length > 0,
    possibleCauses: causes,
  };
};

/**
 * API Testing utility
 */
export class APITester {
  private baseURL: string;
  
  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }
  
  async testEndpoint(
    method: string,
    path: string,
    data?: any,
    headers?: any
  ): Promise<void> {
    console.group(`🧪 Testing API Endpoint`);
    console.log('Method:', method);
    console.log('URL:', `${this.baseURL}${path}`);
    
    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${path}`,
        data,
        headers,
      });
      
      console.log('✅ Success:', response.status);
      console.log('Response:', response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorInfo = formatAxiosError(error);
        console.error('❌ Failed:', errorInfo);
        
        // Provide specific guidance based on error
        if (error.response?.status === 404) {
          errorHandlers.handle404(error);
        } else if (error.response?.status === 401) {
          errorHandlers.handle401(error);
        } else if (error.response?.status === 403) {
          errorHandlers.handle403(error);
        } else if (error.response?.status === 500) {
          errorHandlers.handle500(error);
        }
        
        // Check for network issues
        const networkIssue = detectNetworkIssue(error);
        if (networkIssue.isNetworkError) {
          console.error('🌐 Network Issue Detected:');
          networkIssue.possibleCauses.forEach(cause => {
            console.error(`  - ${cause}`);
          });
        }
      }
    }
    
    console.groupEnd();
  }
  
  async runDiagnostics(): Promise<void> {
    console.group('🏥 API Diagnostics');
    
    // Test server connectivity
    console.log('1. Testing server connectivity...');
    try {
      await axios.get(`${this.baseURL}/health`);
      console.log('✅ Server is reachable');
    } catch (error) {
      console.error('❌ Cannot reach server');
    }
    
    // Test API health
    console.log('2. Testing API health endpoint...');
    try {
      await axios.get(`${this.baseURL}/api/health`);
      console.log('✅ API is healthy');
    } catch (error) {
      console.error('❌ API health check failed');
    }
    
    // List all registered routes (if available)
    console.log('3. Common API endpoints to verify:');
    const endpoints = [
      'GET /api/whatsapp/status',
      'GET /api/whatsapp/stats',
      'GET /api/whatsapp/test',
      'POST /api/whatsapp/test',
      'POST /api/whatsapp/send',
      'POST /api/whatsapp/initialize',
    ];
    
    endpoints.forEach(endpoint => {
      console.log(`  - ${endpoint}`);
    });
    
    console.groupEnd();
  }
}

// Export for use in api.ts
export default {
  DEBUG_CONFIG,
  formatAxiosError,
  logRequest,
  logResponse,
  logError,
  attachDebugInterceptors,
  errorHandlers,
  detectNetworkIssue,
  APITester,
};
