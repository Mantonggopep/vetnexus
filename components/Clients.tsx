import React, { useState, useEffect } from 'react';
import { Owner, Pet, SaleRecord, CommunicationLog, Species } from '../types';
import { Search, Mail, Phone, MapPin, ChevronRight, ArrowLeft, Plus, MessageSquare, PawPrint, X, Calendar, User, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/uiUtils';
import { OwnerService, PatientService, SaleService } from '../services/api'; // Ensure these match your API file

interface ClientsProps {
  // We can still accept props for initial data or fallback, 
  // but we will primarily manage state internally like PatientList
  currency?: string;
}

const Clients: React.FC<ClientsProps> = ({ currency = 'USD' }) => {
  // --- 1. Data State ---
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // --- 2. View State ---
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeTab, setActiveTab] = useState<'patients' | 'financials' | 'communication'>('patients');

  // --- 3. Filter/Search State ---
  const [searchTerm, setSearchTerm] = useState('');

  // --- 4. Modal State ---
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  
  // Forms
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '' });
  const [newPatient, setNewPatient] = useState({ 
      name: '', species: 'Dog', breed: '', age: '', gender: 'Male', allergies: '', color: '', initialWeight: ''
  });

  // --- API Integration ---
  const refreshData = async () => {
      setIsLoading(true);
      try {
          const [ownersRes, petsRes, salesRes] = await Promise.all([
              OwnerService.getAll(),
              PatientService.getAll(),
              SaleService.getAll()
          ]);
          setOwners(Array.isArray(ownersRes.data) ? ownersRes.data : []);
          setPets(Array.isArray(petsRes.data) ? petsRes.data : []);
          setSales(Array.isArray(salesRes.data) ? salesRes.data : []);
      } catch (error) {
          console.error("Failed to fetch client data", error);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      refreshData();
  }, []);

  // --- Handlers ---
  const handleSelectClient = (id: string) => {
      setIsAnimating(true);
      setSelectedClientId(id);
      setTimeout(() => setIsAnimating(false), 300);
  };

  const handleBackToList = () => {
      setIsAnimating(true);
      setSelectedClientId(null);
      setTimeout(() => setIsAnimating(false), 300);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newClient.name || !newClient.phone) return;
      
      try {
          const { data } = await OwnerService.create(newClient);
          setOwners([data, ...owners]);
          setNewClient({ name: '', email: '', phone: '', address: '' });
          setIsAddClientModalOpen(false);
      } catch (error) {
          console.error("Failed to create client", error);
      }
  };

  const handleSavePatient = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedClientId || !newPatient.name) return;

      const payload = {
          tenantId: 'system', // or current tenant
          name: newPatient.name,
          species: newPatient.species as Species,
          breed: newPatient.breed,
          age: Number(newPatient.age),
          gender: newPatient.gender as 'Male' | 'Female',
          ownerId: selectedClientId,
          allergies: newPatient.allergies ? newPatient.allergies.split(',') : [],
          type: 'Single',
          color: newPatient.color || 'Unknown',
          medicalConditions: [],
          initialWeight: newPatient.initialWeight ? Number(newPatient.initialWeight) : 0,
          imageUrl: `https://ui-avatars.com/api/?name=${newPatient.name}&background=random`
      };

      try {
          const { data } = await PatientService.create(payload);
          setPets([data, ...pets]);
          setNewPatient({ name: '', species: 'Dog', breed: '', age: '', gender: 'Male', allergies: '', color: '', initialWeight: '' });
          setIsAddPatientModalOpen(false);
      } catch (error) {
          console.error("Failed to create patient", error);
      }
  };

  // --- Filtering ---
  const filteredOwners = owners.filter(owner => 
    (owner.name && owner.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (owner.email && owner.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (owner.phone && owner.phone.includes(searchTerm)) ||
    (owner.clientNumber && owner.clientNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedClient = owners.find(o => o.id === selectedClientId);

  // --- RENDERERS ---

  // 1. DETAIL VIEW
  if (selectedClientId && selectedClient) {
      const clientPets = pets.filter(p => p.ownerId === selectedClientId);
      const clientSales = sales.filter(s => s.clientId === selectedClientId);
      const totalSpent = clientSales.filter(s => s.status === 'Paid').reduce((sum, s) => sum + s.total, 0);

      return (
          <div className="animate-fade-in-up h-full flex flex-col">
              {/* Navigation Bar */}
              <div className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 flex justify-between items-center rounded-t-[32px]">
                   <button 
                      onClick={handleBackToList}
                      className="flex items-center text-slate-500 hover:text-slate-800 transition-colors px-3 py-2 rounded-xl hover:bg-slate-100"
                   >
                       <div className="bg-slate-200 p-1.5 rounded-full mr-2">
                           <ArrowLeft className="w-4 h-4" /> 
                       </div>
                       <span className="font-bold text-sm">Back to Registry</span>
                   </button>
                   <div className="flex space-x-2">
                       {(['patients', 'financials', 'communication'] as const).map(tab => (
                           <button 
                               key={tab}
                               onClick={() => setActiveTab(tab)}
                               className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
                           >
                               {tab}
                           </button>
                       ))}
                   </div>
              </div>

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                  <div className="grid grid-cols-12 gap-6">
                      {/* Left: Client Card */}
                      <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-4">
                          <div className="bg-white rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 border border-white">
                              <div className="flex flex-col items-center text-center">
                                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center text-rose-600 text-3xl font-bold mb-4 shadow-inner">
                                      {selectedClient.name.charAt(0)}
                                  </div>
                                  <h1 className="text-xl font-bold text-slate-900">{selectedClient.name}</h1>
                                  <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-mono mt-2">{selectedClient.clientNumber}</span>
                              </div>
                              <div className="mt-6 space-y-3">
                                  <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3">
                                      <Phone className="w-4 h-4 text-emerald-600" />
                                      <span className="text-sm font-semibold text-slate-700">{selectedClient.phone}</span>
                                  </div>
                                  {selectedClient.email && (
                                    <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3">
                                        <Mail className="w-4 h-4 text-rose-500" />
                                        <span className="text-sm font-semibold text-slate-700 truncate">{selectedClient.email}</span>
                                    </div>
                                  )}
                                  <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3">
                                      <MapPin className="w-4 h-4 text-blue-500" />
                                      <span className="text-sm font-semibold text-slate-700 truncate">{selectedClient.address || 'No Address'}</span>
                                  </div>
                              </div>
                          </div>
                          <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-lg relative overflow-hidden">
                              <div className="relative z-10">
                                  <p className="text-slate-400 text-xs font-bold uppercase mb-1">Lifetime Value</p>
                                  <p className="text-2xl font-bold">{formatCurrency(totalSpent, currency)}</p>
                              </div>
                              <DollarSign className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-slate-800 opacity-50" />
                          </div>
                      </div>

                      {/* Right: Tab Content */}
                      <div className="col-span-12 md:col-span-8 lg:col-span-9">
                          {activeTab === 'patients' && (
                              <div className="space-y-4">
                                  <div className="flex justify-between items-center mb-2">
                                      <h3 className="font-bold text-slate-700">Registered Patients</h3>
                                      <button onClick={() => setIsAddPatientModalOpen(true)} className="bg-white hover:bg-slate-50 text-slate-900 px-4 py-2 rounded-xl text-xs font-bold shadow-sm border border-slate-200 flex items-center transition-all">
                                          <Plus className="w-3 h-3 mr-2" /> Add Patient
                                      </button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {clientPets.map(pet => (
                                          <div key={pet.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                                              <img src={pet.imageUrl || `https://ui-avatars.com/api/?name=${pet.name}&background=random`} className="w-16 h-16 rounded-2xl object-cover bg-slate-100" />
                                              <div>
                                                  <h4 className="font-bold text-slate-900">{pet.name}</h4>
                                                  <p className="text-xs text-slate-500 font-medium">{pet.species} • {pet.breed}</p>
                                                  <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600">{pet.gender}</span>
                                              </div>
                                          </div>
                                      ))}
                                      {clientPets.length === 0 && (
                                          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-200">
                                              <PawPrint className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                              <p>No patients recorded</p>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}

                          {activeTab === 'financials' && (
                              <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100">
                                  <table className="w-full text-left">
                                      <thead className="bg-slate-50 border-b border-slate-100">
                                          <tr>
                                              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase">Date</th>
                                              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase">Items</th>
                                              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase">Total</th>
                                              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase">Status</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {clientSales.map(sale => (
                                              <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{new Date(sale.date).toLocaleDateString()}</td>
                                                  <td className="px-6 py-4 text-sm text-slate-500">{sale.items.length} items</td>
                                                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{formatCurrency(sale.total, currency)}</td>
                                                  <td className="px-6 py-4">
                                                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${sale.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{sale.status}</span>
                                                  </td>
                                              </tr>
                                          ))}
                                          {clientSales.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No transactions</td></tr>}
                                      </tbody>
                                  </table>
                              </div>
                          )}
                      </div>
                  </div>
              </div>

               {/* Modal: Add Patient */}
                {isAddPatientModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-6 animate-scale-in">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">New Patient for {selectedClient.name}</h3>
                            <form onSubmit={handleSavePatient} className="space-y-4">
                                <input className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500" placeholder="Pet Name" value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})} required />
                                <div className="grid grid-cols-2 gap-4">
                                    <select className="px-4 py-3 bg-slate-50 border-none rounded-xl text-sm" value={newPatient.species} onChange={e => setNewPatient({...newPatient, species: e.target.value})}>
                                        {Object.values(Species).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <input className="px-4 py-3 bg-slate-50 border-none rounded-xl text-sm" placeholder="Breed" value={newPatient.breed} onChange={e => setNewPatient({...newPatient, breed: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" className="px-4 py-3 bg-slate-50 border-none rounded-xl text-sm" placeholder="Age" value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})} />
                                    <select className="px-4 py-3 bg-slate-50 border-none rounded-xl text-sm" value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})}>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setIsAddPatientModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold text-sm">Cancel</button>
                                    <button type="submit" className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
          </div>
      );
  }

  // 2. LIST VIEW (Default)
  return (
    <>
      <style>{`
        :root { --ios-primary: 0, 122, 255; }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div className={`bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/60 overflow-hidden flex flex-col h-[calc(100vh-6rem)] animate-fade-in-up font-sans transition-opacity duration-300 ${isAnimating ? 'opacity-50' : 'opacity-100'}`}>
        
        {/* Header & Controls */}
        <div className="p-6 border-b border-slate-100/50 flex flex-col md:flex-row gap-4 items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Client Registry</h2>
            <span className="text-xs font-medium text-slate-500 mt-0.5">
                {isLoading ? 'Loading...' : `${filteredOwners.length} Active Clients`}
            </span>
          </div>
          
          <div className="flex space-x-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[rgb(var(--ios-primary))] transition-colors" />
                  <input 
                      type="text" 
                      placeholder="Search clients..." 
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ios-primary))] focus:border-transparent transition-all shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <button 
                  onClick={() => setIsAddClientModalOpen(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl text-sm font-bold flex items-center transition-all shadow-lg shadow-slate-900/20 active:scale-95 whitespace-nowrap"
              >
                  <Plus className="w-4 h-4 mr-2 stroke-[3]" /> Add Client
              </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-slate-50 to-white custom-scrollbar">
          <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                  <tr>
                      <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-10">Client Identity</th>
                      <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contact Info</th>
                      <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Location</th>
                      <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pets</th>
                      <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right pr-8">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                  {filteredOwners.map((owner, idx) => {
                      const ownerPets = pets.filter(p => p.ownerId === owner.id);
                      return (
                          <tr 
                              key={owner.id} 
                              onClick={() => handleSelectClient(owner.id)}
                              className="hover:bg-rose-50/30 hover:scale-[1.005] cursor-pointer transition-all duration-300 group animate-fade-in-up"
                              style={{animationDelay: `${idx * 40}ms`}}
                          >
                              <td className="py-4 px-6 rounded-l-2xl">
                                  <div className="flex items-center space-x-4">
                                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 text-rose-500 flex items-center justify-center font-bold text-lg shadow-sm group-hover:shadow-md transition-all">
                                          {owner.name.charAt(0)}
                                      </div>
                                      <div>
                                          <p className="font-bold text-slate-900 text-base group-hover:text-rose-600 transition-colors">{owner.name}</p>
                                          <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                                              {owner.clientNumber || 'N/A'}
                                          </span>
                                      </div>
                                  </div>
                              </td>
                              <td className="py-4 px-6">
                                  <div className="flex flex-col space-y-1">
                                      <div className="flex items-center text-sm font-semibold text-slate-700">
                                          <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" /> {owner.phone}
                                      </div>
                                      {owner.email && (
                                          <div className="flex items-center text-xs text-slate-500">
                                              <Mail className="w-3.5 h-3.5 mr-2 text-slate-300" /> {owner.email}
                                          </div>
                                      )}
                                  </div>
                              </td>
                              <td className="py-4 px-6">
                                  <div className="flex items-center text-sm text-slate-600 max-w-[150px]">
                                      <MapPin className="w-4 h-4 mr-2 text-emerald-500 shrink-0" />
                                      <span className="truncate">{owner.address || <span className="text-slate-300 italic">No Address</span>}</span>
                                  </div>
                              </td>
                              <td className="py-4 px-6">
                                  <div className="flex -space-x-2">
                                      {ownerPets.slice(0, 3).map(pet => (
                                          <img 
                                            key={pet.id} 
                                            src={pet.imageUrl || `https://ui-avatars.com/api/?name=${pet.name}&background=random`} 
                                            className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 shadow-sm"
                                            title={pet.name}
                                          />
                                      ))}
                                      {ownerPets.length > 3 && (
                                          <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                              +{ownerPets.length - 3}
                                          </div>
                                      )}
                                      {ownerPets.length === 0 && <span className="text-xs text-slate-300 italic">No pets</span>}
                                  </div>
                              </td>
                              <td className="py-4 px-6 text-right rounded-r-2xl pr-8">
                                  <div className="flex justify-end items-center space-x-3">
                                      <div className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-300 group-hover:text-rose-500">
                                          <ChevronRight className="w-5 h-5" />
                                      </div>
                                  </div>
                              </td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>
          
          {/* Empty State */}
          {filteredOwners.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 min-h-[300px]">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100 shadow-inner">
                      <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700">No Clients Found</h3>
                  <p className="text-sm mt-1 max-w-xs mx-auto text-slate-400">
                      Try adjusting your search or add a new client.
                  </p>
              </div>
          )}
        </div>

        {/* Add Client Modal */}
        {isAddClientModalOpen && (
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity">
                <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl w-full max-w-md animate-scale-in border border-white/50">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-10">
                        <h3 className="font-bold text-xl text-slate-900 flex items-center">
                            <Plus className="w-6 h-6 mr-2 text-[rgb(var(--ios-primary))]" />
                            Register Client
                        </h3>
                        <button onClick={() => setIsAddClientModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500">✕</button>
                    </div>
                    
                    <form onSubmit={handleSaveClient} className="p-8 space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 ml-1">Full Name <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                                <input type="text" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-[rgb(var(--ios-primary))] transition-all" 
                                    value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Jane Doe" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 ml-1">Phone Number <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                                <input type="tel" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-[rgb(var(--ios-primary))] transition-all" 
                                    value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} placeholder="+1 234 567 8900" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 ml-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                                <input type="email" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-[rgb(var(--ios-primary))] transition-all" 
                                    value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} placeholder="jane@example.com" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 ml-1">Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-slate-400"/>
                                <input type="text" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-[rgb(var(--ios-primary))] transition-all" 
                                    value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} placeholder="123 Main St, City" />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end space-x-3">
                            <button type="button" onClick={() => setIsAddClientModalOpen(false)} className="px-6 py-3 text-slate-500 hover:bg-slate-100 rounded-xl text-sm font-bold transition-colors">Cancel</button>
                            <button type="submit" className="px-8 py-3 bg-[rgb(var(--ios-primary))] hover:brightness-110 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all">Create Profile</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </>
  );
};

export default Clients;
