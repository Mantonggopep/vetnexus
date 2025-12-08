import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { Search, Package, AlertTriangle, Plus, DollarSign, Edit, RefreshCw, X, Zap } from 'lucide-react';
import { formatCurrency } from '../utils/uiUtils';
import api from '../services/api'; // <--- Ensure this imports your configured axios instance

interface InventoryProps {
    items: InventoryItem[];
    currency: string;
    onAddItem: (item: InventoryItem) => void;
    onUpdateItem: (item: InventoryItem) => void;
}

const PRODUCT_CATEGORIES = ['Medicine', 'Food', 'Supply', 'Accessory', 'Equipment', 'Others'];
const SERVICE_CATEGORIES = ['Treatment', 'Vaccination', 'Surgery', 'Consultation', 'Grooming', 'Laboratory', 'Others'];

const Inventory: React.FC<InventoryProps> = ({ items, currency, onAddItem, onUpdateItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Quick Actions State
  const [quickStockVal, setQuickStockVal] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
      name: '', category: 'Medicine', type: 'Product', sku: '', stock: 0, purchasePrice: 0, retailPrice: 0, wholesalePrice: 0, reorderLevel: 0, expiryDate: ''
  });

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const totalValue = items.filter(i => i.type === 'Product').reduce((sum, i) => sum + (i.stock * i.retailPrice), 0);
  const lowStockCount = items.filter(i => i.type === 'Product' && i.stock <= i.reorderLevel).length;

  // --- MODIFIED HANDLER WITH DUPLICATE CHECK ---
  const handleSave = async () => {
      // 1. Validate
      if (!formData.name) return;

      // 2. Duplicate Check (Only when creating new item)
      if (!isEditMode) {
          try {
              const { data } = await api.get('/inventory/check-duplicate', {
                  params: { name: formData.name }
              });

              if (data.exists) {
                  const confirm = window.confirm(
                      `Duplicate Item Alert!\n\n` + 
                      `An item named "${data.match.name}" already exists in your inventory.\n` + 
                      `Current Stock: ${data.match.stock}\n\n` + 
                      `Do you want to create a DUPLICATE item?`
                  );
                  if (!confirm) return;
              }
          } catch (e) {
              console.error('Check failed', e);
          }
      }

      // 3. Create Object
      const newItem: InventoryItem = {
          id: selectedItem ? selectedItem.id : `inv-${Date.now()}`,
          tenantId: '', 
          name: formData.name || 'New Item',
          category: formData.category as any,
          type: formData.type as any,
          sku: formData.sku || `SKU-${Date.now()}`,
          stock: Number(formData.stock),
          purchasePrice: Number(formData.purchasePrice),
          retailPrice: Number(formData.retailPrice),
          wholesalePrice: Number(formData.wholesalePrice),
          reorderLevel: Number(formData.reorderLevel),
          expiryDate: formData.expiryDate
      };

      // 4. Submit
      if (selectedItem) {
          onUpdateItem(newItem);
      } else {
          onAddItem(newItem);
      }
      closeModal();
  };

  const handleStockUpdate = (action: 'add' | 'reconcile') => {
      if (!selectedItem) return;
      const val = Number(quickStockVal);
      if (isNaN(val)) return;

      const newStock = action === 'add' ? selectedItem.stock + val : val;
      
      const updated = { ...selectedItem, stock: newStock };
      onUpdateItem(updated);
      setSelectedItem(updated);
      setQuickStockVal('');
  };

  const closeModal = () => {
      setIsAddModalOpen(false);
      setIsEditMode(false);
      setSelectedItem(null);
      setFormData({
          name: '', category: 'Medicine', type: 'Product', sku: '', stock: 0, purchasePrice: 0, retailPrice: 0, wholesalePrice: 0, reorderLevel: 0, expiryDate: ''
      });
  };

  const openEdit = (item: InventoryItem) => {
      setFormData(item);
      setSelectedItem(item);
      setIsEditMode(true);
      setIsAddModalOpen(true);
  };

  const openDetails = (item: InventoryItem) => {
      setSelectedItem(item);
      setQuickStockVal('');
  };

  const handleTypeChange = (type: 'Product' | 'Service') => {
      const defaultCategory = type === 'Service' ? SERVICE_CATEGORIES[0] : PRODUCT_CATEGORIES[0];
      setFormData(prev => ({ ...prev, type, category: defaultCategory as any }));
  };

  const StatCard = ({ label, value, icon: Icon, color }: any) => (
      <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-sm flex items-center justify-between group hover:scale-105 transition-transform duration-300">
          <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${color} text-white shadow-lg group-hover:rotate-12 transition-transform`}>
              <Icon className="w-5 h-5" />
          </div>
      </div>
  );

  const currentCategories = formData.type === 'Service' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;
  const filterCategories = ['All', ...new Set([...PRODUCT_CATEGORIES, ...SERVICE_CATEGORIES])];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 animate-fade-in">
        <div className="flex-1 flex flex-col gap-6">
            <div className="flex gap-4">
                <div className="flex-1 grid grid-cols-3 gap-4">
                    <StatCard label="Total Valuation" value={formatCurrency(totalValue, currency)} icon={DollarSign} color="bg-emerald-500" />
                    <StatCard label="Low Stock Alerts" value={lowStockCount} icon={AlertTriangle} color="bg-rose-500" />
                    <StatCard label="Total Items" value={items.length} icon={Package} color="bg-blue-500" />
                </div>
            </div>

            <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100 flex justify-between items-center sticky top-0 z-20">
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search by name, SKU..." 
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-lg custom-scrollbar">
                        {filterCategories.slice(0, 6).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterCategory === cat ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
                <button 
                    onClick={() => { closeModal(); setIsAddModalOpen(true); }}
                    className="ml-4 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center shadow-lg shadow-slate-900/20 btn-press transition-all"
                >
                    <Plus className="w-4 h-4 mr-2" /> Add Item
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-20">
                    {filteredItems.map((item, idx) => (
                        <div 
                            key={item.id}
                            onClick={() => openDetails(item)}
                            className={`
                                group relative bg-white p-5 rounded-[1.5rem] border-2 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl
                                ${selectedItem?.id === item.id ? 'border-primary-500 ring-4 ring-primary-500/10 z-10' : 'border-slate-100 hover:border-slate-200'}
                            `}
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md ${item.type === 'Service' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                                    {item.type === 'Service' ? <Zap className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-black text-slate-800">{formatCurrency(item.retailPrice, currency)}</p>
                                    {item.type === 'Product' && (
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.stock <= item.reorderLevel ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                            {item.stock} in stock
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 mb-1 truncate">{item.name}</h3>
                                <p className="text-xs text-slate-400 font-mono mb-3">{item.sku}</p>
                                <div className="flex gap-2">
                                    <span className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase">{item.category}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {selectedItem && !isAddModalOpen && (
            <div className="w-[400px] bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-slide-left">
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 backdrop-blur-md">
                    <div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${selectedItem.type === 'Service' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                            {selectedItem.type}
                        </span>
                        <h2 className="text-2xl font-black text-slate-900 mt-2 leading-tight">{selectedItem.name}</h2>
                        <p className="text-sm text-slate-500 font-mono mt-1">{selectedItem.sku}</p>
                    </div>
                    <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-3xl -translate-y-10 translate-x-10"></div>
                        <div className="relative z-10">
                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">{selectedItem.type === 'Service' ? 'Clinic Charge' : 'Selling Price'}</p>
                            <p className="text-4xl font-black tracking-tight">{formatCurrency(selectedItem.retailPrice, currency)}</p>
                            
                            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">{selectedItem.type === 'Service' ? 'Cost of Service' : 'Cost Price'}</p>
                                    <p className="font-medium">{formatCurrency(selectedItem.purchasePrice, currency)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Margin</p>
                                    <p className="font-medium text-green-400">
                                        {selectedItem.retailPrice > 0 ? ((selectedItem.retailPrice - selectedItem.purchasePrice) / selectedItem.retailPrice * 100).toFixed(1) : 0}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {selectedItem.type === 'Product' && (
                        <div className="bg-white border-2 border-slate-100 rounded-2xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800 flex items-center"><Package className="w-4 h-4 mr-2 text-blue-500"/> Stock Control</h3>
                                <span className={`text-xs font-bold px-2 py-1 rounded ${selectedItem.stock <= selectedItem.reorderLevel ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                    {selectedItem.stock} Units Available
                                </span>
                            </div>
                            
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input 
                                        type="number" 
                                        className="w-full pl-3 pr-3 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-blue-500 focus:outline-none"
                                        placeholder="Qty"
                                        value={quickStockVal}
                                        onChange={e => setQuickStockVal(e.target.value)}
                                    />
                                </div>
                                <button 
                                    onClick={() => handleStockUpdate('add')}
                                    disabled={!quickStockVal}
                                    className="px-4 py-2 bg-green-50 text-green-700 border-2 border-green-100 rounded-xl font-bold text-xs flex flex-col items-center justify-center hover:bg-green-100 disabled:opacity-50 transition-colors"
                                >
                                    <Plus className="w-4 h-4 mb-0.5" /> Add
                                </button>
                                <button 
                                    onClick={() => handleStockUpdate('reconcile')}
                                    disabled={!quickStockVal}
                                    className="px-4 py-2 bg-orange-50 text-orange-700 border-2 border-orange-100 rounded-xl font-bold text-xs flex flex-col items-center justify-center hover:bg-orange-100 disabled:opacity-50 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4 mb-0.5" /> Set
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-3 leading-snug">
                                <b>Add:</b> Increases current stock by amount.<br/>
                                <b>Set:</b> Overwrites stock (for physical counts).
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-xs text-slate-400 uppercase font-bold mb-1">Category</p>
                            <p className="font-bold text-slate-700">{selectedItem.category}</p>
                        </div>
                        {selectedItem.type === 'Product' && (
                             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Expiry</p>
                                <p className={`font-bold ${!selectedItem.expiryDate ? 'text-slate-400 italic' : 'text-slate-700'}`}>{selectedItem.expiryDate || 'N/A'}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-white">
                    <button onClick={() => openEdit(selectedItem)} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all btn-press flex items-center justify-center">
                        <Edit className="w-4 h-4 mr-2" /> Edit Details
                    </button>
                </div>
            </div>
        )}

        {isAddModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg animate-scale-in border border-white/50 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-xl text-slate-800">{isEditMode ? 'Edit Item' : 'Add New Item'}</h3>
                        <button onClick={closeModal} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"><X className="w-4 h-4 text-slate-500"/></button>
                    </div>
                    
                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                            {['Product', 'Service'].map(t => (
                                <button 
                                    key={t}
                                    onClick={() => handleTypeChange(t as any)}
                                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${formData.type === t ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                             <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Name <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary-500" 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Category</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary-500"
                                    value={formData.category} 
                                    onChange={e => setFormData({...formData, category: e.target.value as any})}
                                >
                                    {currentCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">SKU / Code</label>
                            <input 
                                type="text" 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" 
                                value={formData.sku} 
                                onChange={e => setFormData({...formData, sku: e.target.value})}
                                placeholder={formData.type === 'Service' ? 'SVC-001' : 'PROD-001'}
                            />
                        </div>

                        {formData.type === 'Product' ? (
                            <>
                                <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cost Price</label>
                                        <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Wholesale</label>
                                        <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={formData.wholesalePrice} onChange={e => setFormData({...formData, wholesalePrice: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Retail</label>
                                        <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800" value={formData.retailPrice} onChange={e => setFormData({...formData, retailPrice: Number(e.target.value)})} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                     <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Stock</label>
                                        <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Low Alert</label>
                                        <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.reorderLevel} onChange={e => setFormData({...formData, reorderLevel: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 ml-1">Expiry</label>
                                        <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="grid grid-cols-2 gap-5 bg-purple-50 p-5 rounded-2xl border border-purple-100">
                                <div>
                                    <label className="block text-xs font-bold text-purple-800 uppercase mb-1.5">Cost of Service</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs font-bold">{formatCurrency(0, currency).charAt(0)}</span>
                                        <input 
                                            type="number" 
                                            className="w-full pl-7 p-3 bg-white border border-purple-200 rounded-xl text-sm" 
                                            placeholder="0.00"
                                            value={formData.purchasePrice} 
                                            onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})} 
                                        />
                                    </div>
                                    <p className="text-[10px] text-purple-600/60 mt-1">Internal cost (materials, labor)</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-800 uppercase mb-1.5">Clinic Charge</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs font-bold">{formatCurrency(0, currency).charAt(0)}</span>
                                        <input 
                                            type="number" 
                                            className="w-full pl-7 p-3 bg-white border border-purple-200 rounded-xl text-sm font-bold text-purple-900" 
                                            placeholder="0.00"
                                            value={formData.retailPrice} 
                                            onChange={e => setFormData({...formData, retailPrice: Number(e.target.value)})} 
                                        />
                                    </div>
                                    <p className="text-[10px] text-purple-600/60 mt-1">Amount billed to client</p>
                                </div>
                            </div>
                        )}

                        <button onClick={handleSave} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all btn-press mt-4">
                            {isEditMode ? 'Save Changes' : 'Create Item'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Inventory;