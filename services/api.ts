import axios from 'axios';

// --- CONFIGURATION ---
const PRODUCTION_API_URL = 'https://vetnexus-backend.onrender.com/api';
const LOCAL_API_URL = 'http://localhost:4000/api';

// Use environment variable if available, otherwise fallback based on mode
const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'production' 
  ? PRODUCTION_API_URL
  : LOCAL_API_URL);

console.log("API Configured to:", baseURL);

const api = axios.create({
  baseURL,
  withCredentials: true, // Keep this if you use cookies, but usually Token is enough
  headers: {
    'Content-Type': 'application/json',
  }
});

// --- 1. REQUEST INTERCEPTOR (The Fix for 401s) ---
// This attaches the token to every request automatically
api.interceptors.request.use(
  (config) => {
    // Check both standard keys. Adjust 'token' to match what you use in Login.tsx
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- 2. RESPONSE INTERCEPTOR ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.config) {
        console.error(`API Request failed on: ${error.config.url}`);
    }

    // Handle Session Expiry (Auto Logout)
    if (error.response?.status === 401) {
        // Optional: Only clear if it's not the login endpoint itself
        if (!error.config.url.includes('/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            // Optional: Force reload to login page
            // window.location.href = '/login'; 
        }
    }

    const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
    return Promise.reject({ ...error, message });
  }
);

// --- SERVICES ---

export const AuthService = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  signup: (data: any, paymentRef?: string) => api.post('/auth/signup', { ...data, paymentRef }),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return api.post('/auth/logout');
  },
  getMe: () => api.get('/auth/me'),
};

export const UserService = {
    getAll: () => api.get('/users'),
    create: (data: any) => api.post('/users', data),
    update: (id: string, data: any) => api.patch(`/users/${id}`, data),
    delete: (id: string) => api.delete(`/users/${id}`)
};

export const BranchService = {
    getAll: () => api.get('/branches'),
    create: (data: any) => api.post('/branches', data)
};

export const SettingsService = {
    update: (settings: any) => api.patch('/settings', settings)
};

export const PatientService = {
  getAll: () => api.get('/patients'),
  create: (data: any) => api.post('/patients', data),
};

export const OwnerService = {
  getAll: () => api.get('/owners'),
  // Duplication check helper
  checkDuplicate: (name: string, phone: string) => api.get(`/owners/check-duplicate?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`),
  create: (data: any) => api.post('/owners', data),
  update: (id: string, data: any) => api.patch(`/owners/${id}`, data),
  delete: (id: string) => api.delete(`/owners/${id}`),
  updatePortalAccess: (id: string, data: { password?: string, isActive: boolean }) => api.patch(`/owners/${id}/portal`, data),
};

export const InventoryService = {
  getAll: () => api.get('/inventory'),
  create: (data: any) => api.post('/inventory', data),
  update: (id: string, data: any) => api.patch(`/inventory/${id}`, data),
  delete: (id: string) => api.delete(`/inventory/${id}`)
};

export const AppointmentService = {
  getAll: () => api.get('/appointments'),
  create: (data: any) => api.post('/appointments', data),
};

export const SaleService = {
  getAll: () => api.get('/sales'),
  create: (data: any) => api.post('/sales', data),
  delete: (id: string) => api.delete(`/sales/${id}`)
};

export const ConsultationService = {
  getAll: () => api.get('/consultations'),
  create: (data: any) => api.post('/consultations', data),
};

export const LabService = {
  getAll: () => api.get('/labs'),
  create: (data: any) => api.post('/labs', data),
  update: (id: string, data: any) => api.patch(`/labs/${id}`, data),
};

export const ExpenseService = {
  getAll: () => api.get('/expenses'),
  create: (data: any) => api.post('/expenses', data),
};

export const LogService = {
    getAll: () => api.get('/logs')
};

export const PlanService = {
    getAll: () => api.get('/plans'),
    update: (id: string, data: any) => api.patch(`/plans/${id}`, data)
};

export const SuperAdminService = {
  createTenant: (data: any) => api.post('/admin/tenants', data),
  getTenants: () => api.get('/admin/tenants'),
  updateTenant: (id: string, data: any) => api.patch(`/admin/tenants/${id}`, data),
  getStats: () => api.get('/admin/stats'),
};

export const ClientPortalService = {
  login: (credentials: any) => api.post('/portal/login', credentials),
  getDashboard: () => api.get('/portal/dashboard'),
  getPets: () => api.get('/portal/pets'),
  bookAppointment: (data: any) => api.post('/portal/appointments', data),
  getInvoices: () => api.get('/portal/invoices'),
  getMessages: () => api.get('/portal/messages'),
  sendMessage: (content: string) => api.post('/portal/messages', { content }),
};

export default api;
