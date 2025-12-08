import React, { useState } from 'react';
import { Tenant, UserProfile, SubscriptionTier, BillingPeriod, SubscriptionPlan } from '../types';
import { Check, Shield, Mail, User, Building, Lock, Globe, AlertCircle, CreditCard, ArrowRight } from 'lucide-react';

interface AuthProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onSignup: (user: UserProfile, tenant: Tenant, password: string, paymentRef?: string) => void;
  plans?: SubscriptionPlan[];
}

// DEFINING PLANS WITH NEW LIMITS
const DEFAULT_PLANS: SubscriptionPlan[] = [
    {
        id: 'Trial',
        name: 'Trial',
        price: { Monthly: 'NGN 100', Yearly: 'NGN 1,000' },
        features: ['Full Access for Testing', 'Limited Time', 'Single User'],
        limits: { maxUsers: 1, maxClients: 10, maxStorageGB: 0.5, modules: { pos: true, lab: true, ai: true, reports: true, multiBranch: false } }
    },
    {
        id: 'Starter',
        name: 'Starter',
        price: { Monthly: 'NGN 7,000', Yearly: 'NGN 70,000' },
        features: ['2 Users Max', 'Max 50 Clients', 'Basic Inventory & Sales', 'No Printing/Downloads', 'No AI Features'],
        limits: { 
            maxUsers: 2, 
            maxClients: 50, 
            maxStorageGB: 2, 
            modules: { pos: true, lab: false, ai: false, reports: false, multiBranch: false, print: false } 
        }
    },
    {
        id: 'Standard',
        name: 'Standard',
        price: { Monthly: 'NGN 30,000', Yearly: 'NGN 300,000' },
        features: ['7 Users Max', 'Unlimited Clients', 'Full Reports & Printing', 'Limited AI (200/mo)', 'Lab Module'],
        limits: { 
            maxUsers: 7, 
            maxClients: -1, 
            maxStorageGB: 10, 
            modules: { pos: true, lab: true, ai: true, reports: true, multiBranch: false, print: true, aiLimit: 200 } 
        }
    },
    {
        id: 'Premium',
        name: 'Premium',
        price: { Monthly: 'NGN 70,000', Yearly: 'NGN 700,000' },
        features: ['Unlimited Users', 'Unlimited AI', 'Multi-Branch Management', 'Staff Transfer', 'Priority Support'],
        limits: { 
            maxUsers: -1, 
            maxClients: -1, 
            maxStorageGB: 100, 
            modules: { pos: true, lab: true, ai: true, reports: true, multiBranch: true, print: true, aiLimit: -1 } 
        }
    }
];

// LIVE FLUTTERWAVE CONFIGURATION
const FLUTTERWAVE_CONFIG: Record<string, { id: number, amount: number }> = {
    'Trial_Monthly': { id: 149638, amount: 100 },
    'Trial_Yearly': { id: 149638, amount: 1000 }, 
    
    'Starter_Monthly': { id: 149600, amount: 7000 },
    'Starter_Yearly': { id: 149605, amount: 70000 },
    
    'Standard_Monthly': { id: 149601, amount: 30000 },
    'Standard_Yearly': { id: 149604, amount: 300000 },
    
    'Premium_Monthly': { id: 149602, amount: 70000 },
    'Premium_Yearly': { id: 149603, amount: 700000 },
};

declare global {
    interface Window {
        FlutterwaveCheckout: any;
    }
}

export const Auth: React.FC<AuthProps> = ({ onLogin, onSignup, plans = DEFAULT_PLANS }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [step, setStep] = useState(1);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [signupData, setSignupData] = useState({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      clinicName: '',
      country: 'Nigeria',
      plan: 'Starter' as SubscriptionTier,
      billingPeriod: 'Monthly' as BillingPeriod
  });

  const handleLoginSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      const success = await onLogin(loginEmail, loginPass);
      if (!success) {
          setLoginError('Invalid email or password.');
      }
  };

  const handlePaymentAndSignup = async () => {
      const configKey = `${signupData.plan}_${signupData.billingPeriod}`;
      const planConfig = FLUTTERWAVE_CONFIG[configKey];

      if (!planConfig || planConfig.id === 0) {
          alert(`Configuration Error: Missing Plan ID for ${signupData.plan}. Contact support.`);
          return;
      }

      if (!signupData.email || !signupData.name || !signupData.clinicName) {
          alert('Please provide your full name, email and clinic name.');
          return;
      }

      // @ts-ignore
      let rawKey = import.meta.env?.VITE_FLUTTERWAVE_PUBLIC_KEY || import.meta.env?.VITE_FLW_PUBLIC_KEY || '';
      const publicKey = (rawKey || '').toString().replace(/['"\s]/g, '').trim();

      if (!publicKey) {
          alert("Payment Error: Public Key is missing in .env.");
          return;
      }

      if (!window || !window.FlutterwaveCheckout) {
          alert("Payment gateway failed to load.");
          return;
      }

      const currencyMap: Record<string, string> = {
        'Nigeria': 'NGN', 'USA': 'USD', 'UK': 'GBP', 'Ghana': 'GHS', 'Kenya': 'KES'
      };
      const selectedCurrency = currencyMap[signupData.country] || 'NGN';

      setIsProcessingPayment(true);
      const txRef = `vnx-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      try {
          const modal = window.FlutterwaveCheckout({
              public_key: publicKey,
              tx_ref: txRef,
              amount: planConfig.amount,
              currency: selectedCurrency,
              payment_options: "card, banktransfer, ussd, account, mobilemoneyghana, mpesa",
              payment_plan: planConfig.id,
              customer: {
                  email: signupData.email,
                  name: signupData.name,
                  phone_number: "", 
              },
              customizations: {
                  title: "Vet Nexus Pro",
                  description: `${signupData.plan} ${signupData.billingPeriod}`,
                  logo: "https://placehold.co/100x100/teal/white?text=VN",
              },
              callback: (data: any) => {
                  try {
                      const paymentId = String(data.transaction_id || data.id || data.tx_ref || txRef);
                      completeSignup(paymentId);
                  } catch (cbErr) {
                      console.error("Error in callback:", cbErr);
                  } finally {
                      try { if (modal && typeof modal.close === 'function') modal.close(); } catch(e) {}
                      setIsProcessingPayment(false);
                  }
              },
              onclose: () => {
                  setIsProcessingPayment(false);
              },
          });
      } catch (err) {
          alert("Payment Error. Try again.");
          setIsProcessingPayment(false);
      }
  };

  const completeSignup = (paymentRef: string) => {
      const currencyMap: Record<string, string> = {
        'Nigeria': 'NGN', 'USA': 'USD', 'UK': 'GBP', 'Ghana': 'GHS', 'Kenya': 'KES'
      };
      const currency = currencyMap[signupData.country] || 'NGN';
      const tenantId = `tenant-${Date.now()}`;
      
      const newTenant: Tenant = {
          id: tenantId,
          name: signupData.clinicName,
          plan: signupData.plan,
          billingPeriod: signupData.billingPeriod,
          settings: {
              name: signupData.clinicName, address: '', phone: '', email: signupData.email, website: '',
              taxRate: 7.5, currency: currency, bankDetails: '',
              clientPrefix: 'CL-', invoicePrefix: 'INV-', receiptPrefix: 'REC-', patientPrefix: 'P-'
          },
          status: 'Active',
          joinedDate: new Date().toISOString().split('T')[0],
          storageUsed: 0
      };

      const newUser: UserProfile = {
          id: `u-${Date.now()}`, name: signupData.name, email: signupData.email, roles: ['Admin'], tenantId: tenantId
      };

      onSignup(newUser, newTenant, signupData.password, paymentRef);
  };

  if (mode === 'login') {
      return (
          <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-4">
              <div className="mb-8 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                      <Shield className="w-12 h-12 text-teal-600" />
                      <h1 className="text-4xl font-extrabold text-teal-900 tracking-tight">Vet Nexus Pro</h1>
                  </div>
                  <p className="text-teal-600 font-medium">Practice Management Simplified</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-teal-100">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Welcome Back</h2>
                  {loginError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center text-red-600 text-sm font-medium animate-shake">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          {loginError}
                      </div>
                  )}

                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                          <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input type="email" required className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" placeholder="you@clinic.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                          <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input type="password" required className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" placeholder="••••••••" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
                          </div>
                      </div>
                      <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-teal-200 transition-all transform active:scale-95">Log In</button>
                  </form>
                  <div className="mt-6 text-center text-sm">
                      <span className="text-slate-500">New to Vet Nexus? </span>
                      <button onClick={() => setMode('signup')} className="text-teal-600 font-bold hover:underline">Create Account</button>
                  </div>
              </div>
          </div>
      );
  }

  // SIGNUP WIZARD
  return (
      <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-teal-100 overflow-hidden flex flex-col md:flex-row h-[700px]">
              <div className="bg-teal-900 text-white p-10 md:w-1/3 flex flex-col justify-between relative overflow-hidden">
                   <div className="relative z-10">
                      <h2 className="text-3xl font-bold mb-4">Join 2,000+ Clinics</h2>
                      <p className="text-teal-200/80">Experience the future of veterinary practice management.</p>
                   </div>
              </div>

              <div className="p-10 md:w-2/3 overflow-y-auto">
                  <div className="flex justify-between items-center mb-8">
                      <h2 className="text-2xl font-bold text-slate-800">Create Account</h2>
                  </div>

                  <form onSubmit={(e) => e.preventDefault()}>
                      {step === 1 && (
                          <div className="space-y-5 animate-fade-in">
                              <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wide">Step 1: Administrator</h3>
                              <input type="text" required className="w-full p-3 border rounded-lg" placeholder="Full Name" value={signupData.name} onChange={e => setSignupData({...signupData, name: e.target.value})} />
                              <input type="email" required className="w-full p-3 border rounded-lg" placeholder="Email" value={signupData.email} onChange={e => setSignupData({...signupData, email: e.target.value})} />
                              <input type="password" required className="w-full p-3 border rounded-lg" placeholder="Password" value={signupData.password} onChange={e => setSignupData({...signupData, password: e.target.value})} />
                              <button type="button" onClick={() => setStep(2)} className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold mt-4">Next</button>
                          </div>
                      )}
                      
                      {step === 2 && (
                          <div className="space-y-5 animate-fade-in">
                              <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wide">Step 2: Clinic</h3>
                              <input type="text" required className="w-full p-3 border rounded-lg" placeholder="Clinic Name" value={signupData.clinicName} onChange={e => setSignupData({...signupData, clinicName: e.target.value})} />
                              <select className="w-full p-3 border rounded-lg" value={signupData.country} onChange={e => setSignupData({...signupData, country: e.target.value})}>
                                  <option value="Nigeria">Nigeria</option>
                                  <option value="USA">USA</option>
                              </select>
                              <div className="flex space-x-3 mt-4">
                                  <button onClick={() => setStep(1)} className="flex-1 bg-slate-100 py-3 rounded-lg">Back</button>
                                  <button onClick={() => setStep(3)} className="flex-1 bg-teal-600 text-white py-3 rounded-lg">Next</button>
                              </div>
                          </div>
                      )}

                      {step === 3 && (
                          <div className="space-y-5">
                               <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wide">Step 3: Plan</h3>
                               <div className="flex justify-end space-x-2 mb-2">
                                   <button className={`px-2 py-1 text-xs rounded ${signupData.billingPeriod === 'Monthly' ? 'bg-teal-600 text-white' : 'bg-gray-100'}`} onClick={() => setSignupData({...signupData, billingPeriod: 'Monthly'})}>Monthly</button>
                                   <button className={`px-2 py-1 text-xs rounded ${signupData.billingPeriod === 'Yearly' ? 'bg-teal-600 text-white' : 'bg-gray-100'}`} onClick={() => setSignupData({...signupData, billingPeriod: 'Yearly'})}>Yearly</button>
                               </div>
                               <div className="grid grid-cols-2 gap-2 h-64 overflow-y-auto">
                                  {plans.map(p => (
                                      <div key={p.id} onClick={() => setSignupData({...signupData, plan: p.id as SubscriptionTier})} className={`p-4 border rounded-lg cursor-pointer ${signupData.plan === p.id ? 'border-teal-500 bg-teal-50' : ''}`}>
                                          <div className="font-bold text-slate-800">{p.name}</div>
                                          <div className="text-teal-600 font-bold">{signupData.billingPeriod === 'Monthly' ? p.price.Monthly : p.price.Yearly}</div>
                                          <ul className="text-xs text-slate-500 mt-2 space-y-1">
                                              {p.features.slice(0, 3).map((f, i) => <li key={i}>- {f}</li>)}
                                          </ul>
                                      </div>
                                  ))}
                               </div>
                               <div className="flex space-x-3 mt-4">
                                  <button onClick={() => setStep(2)} className="flex-1 bg-slate-100 py-3 rounded-lg">Back</button>
                                  <button onClick={() => setStep(4)} className="flex-1 bg-teal-600 text-white py-3 rounded-lg">Payment</button>
                               </div>
                          </div>
                      )}

                      {step === 4 && (
                          <div className="space-y-6 text-center">
                               <h3 className="text-xl font-bold">Total: {(plans.find(p=>p.id===signupData.plan)?.price as any)?.[signupData.billingPeriod]}</h3>
                               <p className="text-sm text-slate-500">Plan: {signupData.plan} ({signupData.billingPeriod})</p>
                               <button onClick={handlePaymentAndSignup} disabled={isProcessingPayment} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold">
                                   {isProcessingPayment ? 'Processing...' : 'Pay Now'}
                               </button>
                               <button onClick={() => setStep(3)} className="text-slate-400 text-sm">Cancel</button>
                          </div>
                      )}
                  </form>
                  <div className="mt-6 text-center">
                    <button onClick={() => setMode('login')} className="text-sm text-slate-400">Back to Login</button>
                  </div>
              </div>
          </div>
      </div>
  );
};