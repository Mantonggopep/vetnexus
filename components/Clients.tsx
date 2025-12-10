import React, { useState, useEffect } from 'react';
import { Owner, Pet, SaleRecord, Species } from '../types';
import { Search, Mail, Phone, MapPin, ChevronRight, ArrowLeft, Plus, PawPrint, DollarSign, User } from 'lucide-react';
import { formatCurrency } from '../utils/uiUtils';
import { OwnerService, PatientService, SaleService } from '../services/api'; 

interface ClientsProps {
  currency?: string;
}

const Clients: React.FC<ClientsProps> = ({ currency = 'USD' }) => {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeTab, setActiveTab] = useState<'patients' | 'financials' | 'communication'>('patients');
  const [searchTerm, setSearchTerm] = useState('');

  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '' });
  const [newPatient, setNewPatient] = useState({ 
      name: '', species: 'Dog', breed: '', age: '', gender: 'Male', allergies: '', color: '', initialWeight: ''
  });

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

  useEffect(() => { refreshData(); }, []);

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
      try {
          const payload = {
              tenantId: 'system', name: newPatient.name, species: newPatient.species as Species,
              breed: newPatient.breed, age: Number(newPatient.age), gender: newPatient.gender as 'Male' | 'Female',
              ownerId: selectedClientId, allergies: newPatient.allergies ? newPatient.allergies.split(',') : [],
              type: 'Single', color: newPatient.color || 'Unknown', medicalConditions: [],
              initialWeight: newPatient.initialWeight ? Number(newPatient.initialWeight) : 0,
              imageUrl: `https://ui-avatars.com/api/?name=${newPatient.name}&background=random`
          };
          const { data } = await PatientService.create(payload);
          setPets([data, ...pets]);
          setNewPatient({ name: '', species: 'Dog', breed: '', age: '', gender: 'Male', allergies: '', color: '', initialWeight: '' });
          setIsAddPatientModalOpen(false);
      } catch (error) {
          console.error("Failed to create patient", error);
      }
  };

  const filteredOwners = owners.filter(owner => 
    (owner.name && owner.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (owner.email && owner.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (owner.phone && owner.phone.includes(searchTerm)) ||
    (owner.clientNumber && owner.clientNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedClient = owners.find(o => o.id === selectedClientId);

  // --- DETAIL VIEW ---
  if (selectedClientId && selectedClient) {
      const clientPets = pets.filter(p => p.ownerId === selectedClientId);
      const clientSales = sales.filter(s => s.clientId === selectedClientId);
      const totalSpent = clientSales.filter(s => s.status === 'Paid').reduce((sum, s) => sum + s.total, 0);

      return (
          <div className="animate-fade-in-up h-full flex flex-col bg-white md:bg-transparent">
              {/* Mobile Header for Detail */}
              <div className="bg-white/95 backdrop-blur-xl border-b border-slate-100 p-3 md:p-4 flex flex-col md:flex-row md:justify-between md:items-center sticky top-0 z-40">
                   <div className="flex items-center justify-between w-full md:w-auto">
                       <button onClick={handleBackToList} className="flex items-center text-slate-600 hover:text-slate-900 bg-slate-100/50 px-3 py-2 rounded-xl">
                           <ArrowLeft className="w-4 h-4 mr-1" /> <span className="text-sm font-bold">Back</span>
                       </button>
                       {/* Mobile Tabs */}
                       <div className="flex md:hidden bg-slate-100 p-1 rounded-lg">
                            {(['patients', 'financials'] as const).map(tab => (
                               <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase ${activeTab === tab ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
                                   {tab}
                               </button>
                           ))}
                       </div>
                   </div>
                   
                   {/* Desktop Tabs */}
                   <div className="hidden md:flex space-x-2 mt-2 md:mt-0">
                       {(['patients', 'financials', 'communication'] as const).map(tab => (
                           <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}>
                               {tab}
                           </button>
                       ))}
                   </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 pb-24">
                  <div className="grid grid-cols-12 gap-4 md:gap-6">
                      {/* Client Profile Card */}
                      <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-4">
                          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-br from-rose-50 to-indigo-50"></div>
                              <div className="relative z-10">
                                <div className="w-20 h-20 mx-auto rounded-full bg-white p-1 shadow-md mb-3">
                                    <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-2xl font-bold">
                                        {selectedClient.name.charAt(0)}
                                    </div>
                                </div>
                                <h1 className="text-xl font-black text-slate-900">{selectedClient.name}</h1>
                                <p className="text-xs font-bold text-slate-500 mt-1">{selectedClient.clientNumber}</p>
                                
                                <div className="mt-6 flex flex-col gap-3 text-left">
                                    <a href={`tel:${selectedClient.phone}`} className="p-3 bg-slate-50 rounded-xl flex items-center gap-3 hover:bg-slate-100 active:scale-95 transition-all">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Phone className="w-4 h-4" /></div>
                                        <span className="text-sm font-bold text-slate-700">{selectedClient.phone}</span>
                                    </a>
                                    <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><MapPin className="w-4 h-4" /></div>
                                        <span className="text-sm font-bold text-slate-700 truncate">{selectedClient.address || 'No Address'}</span>
                                    </div>
                                </div>
                              </div>
                          </div>
                      </div>

                      {/* Content Area */}
                      <div className="col-span-12 md:col-span-8 lg:col-span-9">
                          {activeTab === 'patients' && (
                              <div className="space-y-4">
                                  <div className="flex justify-between items-center px-1">
                                      <h3 className="font-bold text-slate-700">Pets ({clientPets.length})</h3>
                                      <button onClick={() => setIsAddPatientModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center">
                                          <Plus className="w-3 h-3 mr-2" /> Add
                                      </button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                      {clientPets.map(pet => (
                                          <div key={pet.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                                              <img src={pet.imageUrl || `https://ui-avatars.com/api/?name=${pet.name}&background=random`} className="w-14 h-14 rounded-2xl object-cover bg-slate-100 shadow-inner" />
                                              <div>
                                                  <h4 className="font-black text-slate-900">{pet.name}</h4>
                                                  <p className="text-xs text-slate-500 font-bold mt-0.5">{pet.species}</p>
                                                  <span className="inline-block mt-1.5 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600 uppercase tracking-wide">{pet.gender}</span>
                                              </div>
                                          </div>
                                      ))}
                                      {clientPets.length === 0 && <div className="col-span-full py-12 text-center text-slate-400">No pets recorded</div>}
                                  </div>
                              </div>
                          )}

                          {activeTab === 'financials' && (
                              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
                                   {/* Mobile Friendly List for Transactions */}
                                   <div className="md:hidden divide-y divide-slate-100">
                                        {clientSales.map(sale => (
                                            <div key={sale.id} className="p-4 flex justify-between items-center">
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold mb-0.5">{new Date(sale.date).toLocaleDateString()}</p>
                                                    <p className="text-sm font-bold text-slate-800">{sale.items.length} Items</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-base font-black text-slate-900">{formatCurrency(sale.total, currency)}</p>
                                                    <span className={`text-[10px] font-bold uppercase ${sale.status === 'Paid' ? 'text-emerald-500' : 'text-orange-500'}`}>{sale.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                   </div>
                                   {/* Desktop Table */}
                                  <table className="w-full text-left hidden md:table">
                                      <thead className="bg-slate-50 border-b border-slate-100">
                                          <tr>
                                              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase">Date</th>
                                              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase">Total</th>
                                              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase">Status</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {clientSales.map(sale => (
                                              <tr key={sale.id} className="hover:bg-slate-50">
                                                  <td className="px-6 py-4 text-sm font-bold text-slate-600">{new Date(sale.date).toLocaleDateString()}</td>
                                                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{formatCurrency(sale.total, currency)}</td>
                                                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${sale.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{sale.status}</span></td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
               {/* Modal for adding patient would go here (simplified for brevity) */}
               {isAddPatientModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-scale-in">
                            <h3 className="font-bold text-lg mb-4">Add Patient</h3>
                            <input className="w-full p-3 bg-slate-50 rounded-xl mb-3 text-sm font-bold" placeholder="Name" value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})} />
                            <div className="flex gap-2">
                                <button onClick={() => setIsAddPatientModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold text-sm">Cancel</button>
                                <button onClick={handleSavePatient} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">Save</button>
                            </div>
                        </div>
                    </div>
                )}
          </div>
      );
  }

  // --- LIST VIEW ---
  return (
      <div className={`bg-white md:bg-white/80 md:backdrop-blur-xl md:rounded-[32px] md:shadow-2xl md:border md:border-white/60 overflow-hidden flex flex-col h-full animate-fade-in-up font-sans transition-opacity duration-300 ${isAnimating ? 'opacity-50' : 'opacity-100'}`}>
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col gap-4 bg-white/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex justify-between items-center">
             <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Clients</h2>
                <span className="text-xs font-bold text-slate-400">{filteredOwners.length} Active</span>
             </div>
             <button onClick={() => setIsAddClientModalOpen(true)} className="md:hidden bg-slate-900 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-slate-900/20 active:scale-95"><Plus className="w-5 h-5" /></button>
          </div>
          
          <div className="flex gap-3">
              <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Search by name, phone..." className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <button onClick={() => setIsAddClientModalOpen(true)} className="hidden md:flex bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm font-bold items-center shadow-lg hover:scale-105 transition-all"><Plus className="w-4 h-4 mr-2" /> Add Client</button>
          </div>
        </div>

        {/* Responsive Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 md:bg-transparent pb-24 md:pb-0">
          
          {/* MOBILE: Card List View */}
          <div className="md:hidden flex flex-col gap-3 p-3">
              {filteredOwners.map((owner) => (
                  <div key={owner.id} onClick={() => handleSelectClient(owner.id)} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 active:scale-[0.98] transition-transform">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 text-rose-500 flex items-center justify-center font-black text-lg shadow-inner shrink-0">
                          {owner.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                          <h3 className="font-black text-slate-900 truncate">{owner.name}</h3>
                          <div className="flex items-center text-xs text-slate-500 font-bold mt-0.5">
                              <Phone className="w-3 h-3 mr-1" /> {owner.phone}
                          </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
              ))}
          </div>

          {/* DESKTOP: Table View */}
          <table className="w-full text-left hidden md:table">
              <thead className="sticky top-0 z-10 bg-white/50 backdrop-blur-md">
                  <tr>
                      <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase pl-10">Client</th>
                      <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase">Contact</th>
                      <th className="py-4 px-6 text-[11px] font-bold text-slate-400 uppercase">Pets</th>
                      <th className="py-4 px-6 text-right"></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredOwners.map((owner, idx) => {
                      const ownerPets = pets.filter(p => p.ownerId === owner.id);
                      return (
                          <tr key={owner.id} onClick={() => handleSelectClient(owner.id)} className="hover:bg-rose-50/30 cursor-pointer transition-colors group">
                              <td className="py-4 px-6 pl-10">
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold">{owner.name.charAt(0)}</div>
                                      <div><p className="font-bold text-slate-900">{owner.name}</p><span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold">{owner.clientNumber}</span></div>
                                  </div>
                              </td>
                              <td className="py-4 px-6"><div className="text-sm font-bold text-slate-600">{owner.phone}</div><div className="text-xs text-slate-400 font-medium">{owner.email}</div></td>
                              <td className="py-4 px-6">
                                  <div className="flex -space-x-2">
                                      {ownerPets.slice(0, 3).map(pet => <img key={pet.id} src={pet.imageUrl || `https://ui-avatars.com/api/?name=${pet.name}&background=random`} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100" />)}
                                      {ownerPets.length === 0 && <span className="text-xs text-slate-300 italic">No pets</span>}
                                  </div>
                              </td>
                              <td className="py-4 px-6 text-right"><ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition-colors inline-block" /></td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>
          
          {filteredOwners.length === 0 && <div className="p-10 text-center text-slate-400 font-bold text-sm">No clients found</div>}
        </div>

        {/* Add Client Modal */}
        {isAddClientModalOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-[32px] w-full max-w-md p-6 animate-scale-in shadow-2xl">
                    <h3 className="font-black text-xl mb-6 text-slate-900">New Client</h3>
                    <form onSubmit={handleSaveClient} className="space-y-4">
                        <input required placeholder="Full Name" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                        <input required placeholder="Phone Number" type="tel" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                        <input placeholder="Email (Optional)" type="email" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} />
                        <div className="pt-4 flex gap-3">
                            <button type="button" onClick={() => setIsAddClientModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                            <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 active:scale-95 transition-all">Create Profile</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
  );
};

export default Clients;
