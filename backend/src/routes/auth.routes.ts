import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plan, UserProfile, Tenant } from '../types';
import { Loader2, Stethoscope, PawPrint, ArrowRight, ShieldCheck, User, AlertCircle } from 'lucide-react';

interface AuthProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onSignup: (user: UserProfile, tenant: Tenant, password: string, paymentRef?: string) => Promise<void>;
  plans: Plan[];
}

export const Auth: React.FC<AuthProps> = ({ onLogin, onSignup, plans = [] }) => {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState<'STAFF' | 'CLIENT'>('STAFF');
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Signup State
  const [name, setName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('Professional'); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // --- HANDLE CLIENT REDIRECT ---
    if (userType === 'CLIENT') {
      navigate('/portal/login');
      return;
    }

    // --- HANDLE STAFF LOGIN/SIGNUP ---
    setLoading(true);
    try {
      if (isLogin) {
        await onLogin(email, password);
      } else {
        // Find selected plan or default to first available
        const planDetails = plans.find(p => p.name === selectedPlan) || plans[0];
        const planName = planDetails?.name || 'Trial';
        
        // Construct the Tenant Object (Clinic)
        const newTenant: Tenant = {
            id: '', 
            name: clinicName, 
            plan: planName as any, 
            billingPeriod: 'Monthly', 
            settings: {
                name: clinicName,
                address: '',
                phone: '',
                email: email,
                website: '',
                taxRate: 0,
                currency: 'USD',
                bankDetails: '',
                clientPrefix: 'CL',
                invoicePrefix: 'INV',
                receiptPrefix: 'REC',
                patientPrefix: 'PT',
            }, 
            status: 'Active', 
            joinedDate: new Date().toISOString(), 
            storageUsed: 0 
        };

        // Construct the User Object (Admin)
        const newUser: UserProfile = { 
            id: '', 
            tenantId: '', 
            name, 
            email, 
            roles: ['SuperAdmin'] 
        };

        await onSignup(newUser, newTenant, password);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      // Display a friendly error message
      setError(err.message || err.response?.data?.error || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row animate-fade-in">
      
      {/* Left Side - Brand & Info */}
      <div className="hidden md:flex md:w-1/2 bg-indigo-600 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-8">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <Stethoscope className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">VetNexus</h1>
          </div>
          <h2 className="text-4xl font-extrabold mb-6 leading-tight">
            The Modern OS for <br/> Veterinary Clinics
          </h2>
          <p className="text-indigo-100 text-lg max-w-md">
            Streamline your practice with AI-powered records, inventory management, and a dedicated client portal.
          </p>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-500 rounded-full opacity-50 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-indigo-700 rounded-full opacity-50 blur-3xl"></div>
        
        <div className="relative z-10 text-sm text-indigo-200">
          © 2024 VetNexus Inc. All rights reserved.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-12">
        <div className="w-full max-w-md space-y-8">
          
          {/* Mobile Header (Visible only on small screens) */}
          <div className="md:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white mb-4 shadow-lg">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">VetNexus</h1>
          </div>

          {/* User Type Toggle (Staff vs Client) */}
          <div className="bg-white p-1 rounded-xl border border-gray-200 shadow-sm flex mb-6">
            <button
                type="button"
                onClick={() => { setUserType('STAFF'); setError(null); }}
                className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${
                    userType === 'STAFF' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Clinic Staff
            </button>
            <button
                type="button"
                onClick={() => { setUserType('CLIENT'); setError(null); }}
                className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${
                    userType === 'CLIENT' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
                <User className="w-4 h-4 mr-2" />
                Pet Owner
            </button>
          </div>

          {/* Main Form Card */}
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            
            {userType === 'CLIENT' ? (
                // --- CLIENT PORTAL VIEW ---
                <div className="text-center space-y-6">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-4 animate-bounce-slow">
                        <PawPrint className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Pet Owner Portal</h2>
                        <p className="text-gray-500 mt-2 text-sm">
                            Access your pet's medical records, book appointments, and view invoices.
                        </p>
                    </div>
                    <button
                        onClick={handleSubmit}
                        className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-white font-medium bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg hover:shadow-blue-500/30"
                    >
                        Go to Client Login <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                    <div className="text-xs text-gray-400">
                        Need an account? Contact your veterinary clinic.
                    </div>
                </div>
            ) : (
                // --- STAFF LOGIN/SIGNUP VIEW ---
                <>
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {isLogin ? 'Staff Login' : 'Create Clinic Account'}
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {isLogin ? 'Enter your credentials to access the workspace.' : 'Start your 14-day free trial.'}
                        </p>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-sm text-red-600 animate-pulse">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span className="break-words">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                    <input required type="text" className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Dr. John Doe" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label>
                                    <input required type="text" className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Happy Pets Clinic" value={clinicName} onChange={e => setClinicName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Plan</label>
                                    <select 
                                        className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all"
                                        value={selectedPlan}
                                        onChange={e => setSelectedPlan(e.target.value)}
                                        disabled={plans.length === 0}
                                    >
                                        {plans.length > 0 ? (
                                            plans.map(plan => (
                                                <option key={plan.id} value={plan.name}>{plan.name}</option>
                                            ))
                                        ) : (
                                            <option value="Professional">Professional (Default)</option>
                                        )}
                                    </select>
                                </div>
                            </>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <input required type="email" className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="doctor@clinic.com" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input required type="password" className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (isLogin ? 'Sign In' : 'Create Account')}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button 
                            type="button"
                            onClick={() => { setIsLogin(!isLogin); setError(null); }}
                            className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
                        >
                            {isLogin ? "New clinic? Create an account" : "Already have an account? Sign in"}
                        </button>
                    </div>
                </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
