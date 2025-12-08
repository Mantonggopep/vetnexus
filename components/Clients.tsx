import React, { useState, useEffect } from 'react';
import { Owner, Pet, SaleRecord, CommunicationLog, Species } from '../types';
import { Search, Mail, Phone, MapPin, ChevronRight, ArrowLeft, Plus, MessageSquare, PawPrint, X, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/uiUtils';

interface ClientsProps {
  owners?: Owner[]; // Made optional for safety
  pets?: Pet[];
  sales?: SaleRecord[]; 
  communications?: CommunicationLog[];
  currency: string;
  onAddClient: (client: Omit<Owner, 'id' | 'clientNumber'>) => void;
  onAddPatient: (pet: Omit<Pet, 'id' | 'imageUrl' | 'vitalsHistory' | 'notes'> & { initialWeight?: number }) => void;
}

const Clients: React.FC<ClientsProps> = ({ 
    owners = [], 
    pets = [], 
    sales = [], 
    communications = [], 
    currency, 
    onAddClient, 
    onAddPatient 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // Modals
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'patients' | 'financials' | 'communication'>('patients');

  // Form States
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '' });
  const [newPatient, setNewPatient] = useState({ 
      name: '', species: 'Dog', breed: '', age: '', gender: 'Male', allergies: '', color: '', initialWeight: ''
  });

  // Safe Filtering
  const filteredOwners = owners.filter(owner => 
    (owner.name && owner.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (owner.email && owner.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (owner.phone && owner.phone.includes(searchTerm)) ||
    (owner.clientNumber && owner.clientNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedClient = owners.find(o => o.id === selectedClientId);

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.phone) return;
    onAddClient(newClient);
    setNewClient({ name: '', email: '', phone: '', address: '' });
    setIsAddClientModalOpen(false);
  };

  const handleSavePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !newPatient.name) return;
    
    onAddPatient({
        name: newPatient.name,
        species: newPatient.species as Species,
        breed: newPatient.breed,
        age: Number(newPatient.age),
        gender: newPatient.gender as 'Male' | 'Female',
        ownerId: selectedClientId,
        allergies: newPatient.allergies ? newPatient.allergies.split(',').map(s => s.trim()) : [],
        type: 'Single',
        color: newPatient.color || 'Unknown',
        medicalConditions: [],
        initialWeight: newPatient.initialWeight ? Number(newPatient.initialWeight) : undefined
    });
    
    setNewPatient({ name: '', species: 'Dog', breed: '', age: '', gender: 'Male', allergies: '', color: '', initialWeight: '' });
    setIsAddPatientModalOpen(false);
  };

  // --- 1. DETAIL VIEW RENDER ---
  if (selectedClientId && selectedClient) {
    const clientPets = pets.filter(p => p.ownerId === selectedClientId);
    const clientSales = sales.filter(s => s.clientId === selectedClientId);
    const clientComms = communications; 
    
    const totalSpent = clientSales.filter(s => s.status === 'Paid').reduce((sum, s) => sum + s.total, 0);
    
    return (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in-up">
             {/* Detail Header */}
             <div className="flex items-center justify-between mb-4 shrink-0 px-6 pt-4">
                <button 
                    onClick={() => setSelectedClientId(null)} 
                    className="group flex items-center text-slate-500 hover:text-slate-800 transition-all duration-200 px-4 py-2 rounded-xl hover:bg-white hover:shadow-sm"
                >
                    <div className="bg-slate-200 p-2 rounded-full mr-3 group-hover:bg-slate-300 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> 
                    </div>
                    <span className="font-semibold text-lg">Back to Registry</span>
                </button>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden px-6 pb-6">
                {/* Left: Profile Card */}
                <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 border border-rose-100 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center text-rose-600 text-4xl font-bold shadow-2xl shadow-rose-500/20 ring-4 ring-white mb-4">
                                {selectedClient.name.charAt(0)}
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedClient.name}</h1>
                            <div className="flex items-center mt-2 space-x-2">
                                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-mono font-medium border border-slate-200">
                                    {selectedClient.clientNumber}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                                    Active
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 space-y-4 relative z-10">
                             <div className="p-4 bg-slate-50 rounded-2xl border border-transparent">
                                <p className="text-xs font-bold text-emerald-700 uppercase mb-1 flex items-center"><Phone className="w-3 h-3 mr-1"/> Mobile</p>
                                <p className="text-sm font-semibold text-slate-700">{selectedClient.phone}</p>
                             </div>
                             {selectedClient.email && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-transparent">
                                    <p className="text-xs font-bold text-rose-500 uppercase mb-1 flex items-center"><Mail className="w-3 h-3 mr-1"/> Email</p>
                                    <p className="text-sm font-semibold text-slate-700 break-all">{selectedClient.email}</p>
                                </div>
                             )}
                             <div className="p-4 bg-slate-50 rounded-2xl border border-transparent">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center"><MapPin className="w-3 h-3 mr-1"/> Address</p>
                                <p className="text-sm font-semibold text-slate-700 leading-relaxed">{selectedClient.address || 'N/A'}</p>
                             </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-white to-slate-50 rounded-[2rem] p-6 border border-white/60 shadow-lg flex flex-col justify-center">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase">Lifetime Value</span>
                            <span className="text-xl font-bold text-slate-800">{formatCurrency(totalSpent, currency)}</span>
                         </div>
                         <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                             <div className="bg-slate-900 h-full rounded-full" style={{ width: '75%' }}></div>
                         </div>
                    </div>
                </div>

                {/* Right: Tabs & Data */}
                <div className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col h-full bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-2xl shadow-slate-200/50 overflow-hidden">
                    <div className="px-8 py-5 border-b border-rose-100/50 flex justify-between items-center bg-white/40 sticky top-0 z-20 backdrop-blur-md">
                        <div className="flex space-x-1 bg-slate-100/50 p-1.5 rounded-2xl">
                             {(['patients', 'financials', 'communication'] as const).map((tab) => (
                                 <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`
                                        px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ease-out
                                        ${activeTab === tab 
                                            ? 'bg-white text-slate-900 shadow-md transform scale-105 ring-1 ring-slate-100' 
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}
                                    `}
                                 >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                 </button>
                             ))}
                        </div>
                        {activeTab === 'patients' && (
                             <button 
                                onClick={() => setIsAddPatientModalOpen(true)}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl text-sm font-bold flex items-center transition-all shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Add Patient
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white/30">
                        {activeTab === 'patients' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {clientPets.map((pet) => (
                                    <div 
                                        key={pet.id} 
                                        className="bg-white p-5 rounded-[2rem] border border-rose-50 shadow-sm hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-[4rem] -mr-8 -mt-8"></div>
                                        <div className="flex items-center space-x-4 mb-4 relative z-10">
                                            <div className="w-20 h-20 rounded-2xl bg-slate-200 overflow-hidden shadow-lg ring-2 ring-white">
                                                 <img 
                                                    src={pet.imageUrl || `https://ui-avatars.com/api/?name=${pet.name}&background=random`} 
                                                    className="w-full h-full object-cover"
                                                    alt={pet.name}
                                                />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-bold text-slate-900 leading-tight">{pet.name}</h4>
                                                <p className="text-sm font-medium text-emerald-700">{pet.breed}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-4 relative z-10">
                                            <div className="bg-slate-50 p-2 rounded-xl text-center">
                                                <span className="block text-xs text-slate-400 font-bold uppercase">Age</span>
                                                <span className="text-sm font-bold text-slate-700">{pet.age}y</span>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-xl text-center">
                                                <span className="block text-xs text-slate-400 font-bold uppercase">Sex</span>
                                                <span className="text-sm font-bold text-slate-700">{pet.gender}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-xl text-center">
                                                <span className="block text-xs text-slate-400 font-bold uppercase">Type</span>
                                                <span className="text-sm font-bold text-slate-700">{pet.species}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {clientPets.length === 0 && (
                                     <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white/30">
                                        <PawPrint className="w-12 h-12 mb-3 opacity-20 text-slate-500" />
                                        <p>No patients registered yet.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'financials' && (
                             <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5 font-bold text-slate-400 text-xs uppercase tracking-wider">Date</th>
                                            <th className="px-8 py-5 font-bold text-slate-400 text-xs uppercase tracking-wider">Items</th>
                                            <th className="px-8 py-5 font-bold text-slate-400 text-xs uppercase tracking-wider">Total</th>
                                            <th className="px-8 py-5 font-bold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {clientSales.map(sale => (
                                            <tr key={sale.id} className="hover:bg-rose-50/30 transition-colors">
                                                <td className="px-8 py-5 text-sm font-medium text-slate-600">
                                                    <div className="flex items-center">
                                                        <Calendar className="w-4 h-4 mr-2 text-rose-400" />
                                                        {new Date(sale.date).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-sm text-slate-600">{sale.items.length} Services/Products</td>
                                                <td className="px-8 py-5 text-sm font-bold text-slate-800">{formatCurrency(sale.total, currency)}</td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${sale.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                                                        {sale.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {clientSales.length === 0 && (
                                     <div className="p-12 text-center text-slate-400">No financial history available.</div>
                                )}
                             </div>
                        )}
                        
                        {activeTab === 'communication' && (
                             <div className="space-y-6 max-w-3xl mx-auto">
                                {clientComms.map((comm, idx) => (
                                    <div key={comm.id} className="relative flex space-x-6">
                                        {idx !== clientComms.length - 1 && (
                                            <div className="absolute top-10 left-5 w-0.5 h-full bg-slate-100 -z-10"></div>
                                        )}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md ring-4 ring-white ${comm.type === 'Call' ? 'bg-slate-900' : comm.type === 'Email' ? 'bg-rose-400' : 'bg-emerald-600'}`}>
                                            {comm.type === 'Call' ? <Phone className="w-4 h-4"/> : comm.type === 'Email' ? <Mail className="w-4 h-4"/> : <MessageSquare className="w-4 h-4"/>}
                                        </div>
                                        <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{comm.type}</span>
                                                <span className="text-xs text-slate-400 font-mono">{comm.date}</span>
                                            </div>
                                            <p className="text-slate-700 font-medium leading-relaxed">{comm.summary}</p>
                                            <div className="text-xs text-slate-400 mt-3 flex items-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-2"></div>
                                                Logged by {comm.staffName}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {clientComms.length === 0 && (
                                    <div className="text-center py-10 text-slate-400">
                                        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                        <p>No communication logs recorded.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
             <Modal open={isAddPatientModalOpen} onClose={() => setIsAddPatientModalOpen(false)} title={`New Patient for ${selectedClient.name}`}>
                 <form onSubmit={handleSavePatient} className="space-y-5">
                    <Input label="Pet Name" required value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})} placeholder="e.g. Bella" />
                    <div className="grid grid-cols-2 gap-5">
                        <Select label="Species" value={newPatient.species} onChange={e => setNewPatient({...newPatient, species: e.target.value})}>
                            <option value="Dog">Dog</option>
                            <option value="Cat">Cat</option>
                            <option value="Bird">Bird</option>
                            <option value="Reptile">Reptile</option>
                            <option value="Other">Other</option>
                        </Select>
                        <Input label="Breed" value={newPatient.breed} onChange={e => setNewPatient({...newPatient, breed: e.target.value})} placeholder="e.g. Golden Retriever" />
                    </div>
                    <div className="grid grid-cols-3 gap-5">
                        <Input label="Age" type="number" step="0.1" value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})} />
                        <Select label="Gender" value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})}>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </Select>
                        <Input label="Weight (kg)" type="number" step="0.1" value={newPatient.initialWeight} onChange={e => setNewPatient({...newPatient, initialWeight: e.target.value})} />
                    </div>
                    <Input label="Color / Markings" value={newPatient.color} onChange={e => setNewPatient({...newPatient, color: e.target.value})} placeholder="e.g. Golden with white paws" />
                    <Input label="Known Allergies" value={newPatient.allergies} onChange={e => setNewPatient({...newPatient, allergies: e.target.value})} placeholder="Optional..." />
                    
                    <div className="pt-4">
                        <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-slate-900/30 transition-all hover:scale-[1.02] active:scale-95">
                            Save Patient Record
                        </button>
                    </div>
                 </form>
            </Modal>
        </div>
    );
  }

  // --- 2. LIST VIEW RENDER (Main Page) ---
  return (
    <div className="bg-white/50 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-slate-200/60 border border-white/60 flex flex-col h-full overflow-hidden relative mx-6 mb-6">
        {/* Header - NOW FIXED & VISIBLE */}
        <div className="p-8 pb-4 flex flex-col md:flex-row justify-between items-center gap-6 z-20 relative shrink-0">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">Client Registry</h2>
                <p className="text-slate-500 font-medium">Manage your clinic's clients and patients.</p>
            </div>
            
            <div className="flex items-center space-x-3 w-full md:w-auto bg-white p-2 rounded-2xl shadow-lg shadow-slate-200/50 border border-rose-50">
                <div className="relative group flex-1 md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search clients..." 
                        className="w-full pl-11 pr-4 py-3 bg-transparent border-none text-sm focus:ring-0 placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-px h-8 bg-slate-200 mx-2"></div>
                <button 
                    onClick={() => setIsAddClientModalOpen(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center transition-all shadow-md hover:scale-105 active:scale-95 whitespace-nowrap"
                >
                    <Plus className="w-4 h-4 mr-2" /> Add Client
                </button>
            </div>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-12 px-8 py-3 mx-4 mt-2 text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 bg-white/20 rounded-xl">
            <div className="col-span-3 pl-4">Client Profile</div>
            <div className="col-span-3 border-l border-slate-200 pl-4">Contact Info</div>
            <div className="col-span-3 border-l border-slate-200 pl-4">Location</div>
            <div className="col-span-2 border-l border-slate-200 pl-4">Pets</div>
            <div className="col-span-1 text-right pr-4"></div>
        </div>

        {/* Floating Rows Container - FIXED OVERFLOW */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 space-y-3">
            {filteredOwners.length > 0 ? filteredOwners.map((owner) => {
                const ownerPets = pets.filter(p => p.ownerId === owner.id);
                
                return (
                    <div 
                        key={owner.id}
                        onClick={() => setSelectedClientId(owner.id)}
                        className="
                            group relative bg-white rounded-2xl p-4 grid grid-cols-12 items-center gap-4
                            border border-slate-100 shadow-sm cursor-pointer
                            hover:shadow-2xl hover:shadow-rose-500/10 hover:scale-[1.01] hover:z-10 hover:border-rose-100
                            transition-all duration-300 ease-spring
                        "
                    >
                        {/* 1. Client Profile - Rose Gold Avatar */}
                        <div className="col-span-3 flex items-center pl-2">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg shadow-sm border border-rose-100 group-hover:scale-110 transition-transform duration-300">
                                {owner.name.charAt(0)}
                            </div>
                            <div className="ml-4">
                                <h3 className="font-bold text-slate-800 text-sm group-hover:text-rose-600 transition-colors">{owner.name}</h3>
                                <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-mono rounded border border-slate-200">
                                    {owner.clientNumber || 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* 2. Contact Section - Navy Icons */}
                        <div className="col-span-3 flex flex-col justify-center border-l border-dashed border-slate-100 pl-4 h-full">
                            <div className="flex items-center text-sm font-medium text-slate-600 mb-1">
                                <div className="w-6 h-6 rounded-full bg-slate-50 text-slate-900 flex items-center justify-center mr-2 shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                    <Phone className="w-3 h-3" />
                                </div>
                                {owner.phone}
                            </div>
                            {owner.email && (
                                <div className="flex items-center text-xs text-slate-400">
                                    <div className="w-6 h-6 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mr-2 shrink-0 group-hover:bg-slate-200 transition-colors">
                                        <Mail className="w-3 h-3" />
                                    </div>
                                    <span className="truncate max-w-[140px]">{owner.email}</span>
                                </div>
                            )}
                        </div>

                        {/* 3. Location Section - Army Green Icon */}
                        <div className="col-span-3 flex items-center border-l border-dashed border-slate-100 pl-4 h-full">
                             <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mr-3 shrink-0">
                                <MapPin className="w-4 h-4" />
                             </div>
                             <span className="text-sm text-slate-600 line-clamp-2 leading-snug">
                                {owner.address || <span className="text-slate-300 italic">No address provided</span>}
                             </span>
                        </div>

                        {/* 4. Pets Section */}
                        <div className="col-span-2 flex items-center border-l border-dashed border-slate-100 pl-4 h-full">
                            <div className="flex -space-x-3 pl-1">
                                {ownerPets.slice(0, 3).map(pet => (
                                    <img 
                                        key={pet.id} 
                                        className="w-9 h-9 rounded-full border-[3px] border-white shadow-sm object-cover bg-slate-100 transition-transform group-hover:translate-x-1" 
                                        src={pet.imageUrl || `https://ui-avatars.com/api/?name=${pet.name}&background=random`} 
                                        alt={pet.name} 
                                        title={pet.name} 
                                    />
                                ))}
                                {ownerPets.length > 3 && (
                                    <div className="w-9 h-9 rounded-full border-[3px] border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm z-10">
                                        +{ownerPets.length - 3}
                                    </div>
                                )}
                                {ownerPets.length === 0 && (
                                    <span className="text-xs text-slate-400 italic pl-2">No pets</span>
                                )}
                            </div>
                        </div>

                        {/* 5. Action Arrow - Rose Gold */}
                        <div className="col-span-1 flex justify-end pr-2">
                             <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all duration-300 shadow-sm">
                                <ChevronRight className="w-4 h-4" />
                             </div>
                        </div>
                    </div>
                );
            }) : (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white/30">
                    <Search className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">{owners.length === 0 ? "No clients registered yet." : `No clients found matching "${searchTerm}"`}</p>
                 </div>
            )}
        </div>

        {/* Add Client Modal */}
        <Modal open={isAddClientModalOpen} onClose={() => setIsAddClientModalOpen(false)} title="Register New Client">
             <form onSubmit={handleSaveClient} className="space-y-5">
                 <Input label="Full Name" required value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="e.g. John Doe" />
                 <div className="grid grid-cols-2 gap-5">
                    <Input label="Phone Number" required type="tel" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} placeholder="+1 234 567 890" />
                    <Input label="Email Address" type="email" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} placeholder="john@example.com" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Physical Address</label>
                    <textarea 
                        className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rose-400 focus:bg-white transition-all resize-none shadow-inner" 
                        rows={3}
                        value={newClient.address} 
                        onChange={e => setNewClient({...newClient, address: e.target.value})} 
                        placeholder="Street address, City, State..."
                    />
                 </div>
                 <div className="pt-2">
                    <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold text-sm shadow-xl shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-95">
                        Create Client Profile
                    </button>
                 </div>
             </form>
        </Modal>
    </div>
  );
};

// --- REUSABLE COMPONENTS ---
const Modal = ({ open, onClose, title, children }: { open: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/50">
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                    <h3 className="font-bold text-slate-800 text-lg tracking-tight">{title}</h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">{label} {props.required && <span className="text-rose-500">*</span>}</label>
        <input className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rose-400 focus:bg-white transition-all shadow-sm" {...props} />
    </div>
);

const Select = ({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">{label}</label>
        <div className="relative">
            <select className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rose-400 focus:bg-white transition-all shadow-sm appearance-none" {...props}>
                {children}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronRight className="w-4 h-4 rotate-90" />
            </div>
        </div>
    </div>
);

export default Clients;
