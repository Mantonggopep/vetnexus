import axios from 'axios';

// --- CONFIGURATION ---
// FIX: We now point directly to the Render backend.
// This prevents the "405 Method Not Allowed" error caused by Vercel
// trying to handle the '/api' route locally instead of proxying it.
const PRODUCTION_API_URL = 'https://vetnexus-backend.onrender.com/api';
const LOCAL_API_URL = 'http://localhost:4000/api';

const baseURL = import.meta.env.MODE === 'production' 
  ? PRODUCTION_API_URL
  : LOCAL_API_URL;

console.log("API Configured to:", baseURL);

const api = axios.create({
  baseURL,
  withCredentials: true, // Crucial for cookies/sessions across domains
  headers: {
    'Content-Type': 'application/json',
  }
});

// Response Interceptor to handle errors and log them for debugging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log the actual URL that failed to help debugging
    if (error.config) {
        console.error(`API Request failed on: ${error.config.url}`);
    }
    
    const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
    return Promise.reject({ ...error, message });
  }
);

// --- SERVICES ---

export const AuthService = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  signup: (data: any, paymentRef?: string) => api.post('/auth/signup', { ...data, paymentRef }),
  logout: () => api.post('/auth/logout'),
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
  create: (data: any) => api.post('/owners', data),
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

export default api;
