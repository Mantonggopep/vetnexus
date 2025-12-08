import React, { useState, useMemo, useEffect, useRef } from 'react';
import { InventoryItem, Owner, SaleRecord, SaleItem, Payment, ClinicSettings, SubscriptionTier } from '../types';
import { 
    Search, ShoppingCart, Trash2, Receipt, Printer, FileText, 
    CheckCircle2, X, Plus, Minus, ChevronDown, Eye, AlertTriangle, CreditCard
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { formatCurrency } from '../utils/uiUtils';

interface POSProps {
  sales: SaleRecord[];
  owners: Owner[];
  settings: ClinicSettings;
  inventory: InventoryItem[];
  plan?: SubscriptionTier;
  onSaveSale: (sale: SaleRecord) => void;
  onDeleteSale: (id: string, reason: string) => void;
}

const POS: React.FC<POSProps> = ({ sales = [], owners = [], settings, inventory = [], plan, onSaveSale, onDeleteSale }) => {
  // --- STATE ---
  const [historyFilter, setHistoryFilter] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [clientType, setClientType] = useState<'Walk-in' | 'Registered'>('Walk-in');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Payment State
  const [payMethod, setPayMethod] = useState<'Cash' | 'Card' | 'Transfer' | 'Credit'>('Transfer');
  const [payAmount, setPayAmount] = useState<string>('');
  const [discount, setDiscount] = useState('');

  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<SaleRecord | null>(null);

  // --- STRICT CALCULATIONS ---
  const subtotal = cart.reduce((sum, item) => {
      const price = parseFloat(item.unitPrice.toString()) || 0;
      const qty = parseFloat(item.quantity.toString()) || 0;
      return sum + (price * qty);
  }, 0);

  const taxRate = parseFloat(settings.taxRate?.toString() || '0');
  const tax = subtotal * (taxRate / 100);
  const discountVal = parseFloat(discount) || 0;
  
  const calculatedTotal = (subtotal + tax) - discountVal;
  const total = Math.max(0, calculatedTotal);

  // --- MEMOS ---
  const searchResults = useMemo(() => {
      let results = inventory;
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          results = inventory.filter(i => i.name.toLowerCase().includes(lower) || i.sku.toLowerCase().includes(lower));
      }
      return results.slice(0, 10);
  }, [inventory, searchTerm]);

  const filteredHistory = useMemo(() => {
      let sorted = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (historyFilter !== 'All') {
          sorted = sorted.filter(s => s.status === historyFilter);
      }
      return sorted;
  }, [sales, historyFilter]);

  // --- EFFECTS ---
  useEffect(() => {
      if (total > 0) {
          setPayAmount(total.toFixed(2));
      } else {
          setPayAmount('');
      }
  }, [total, cart, discount]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
              setIsSearchFocused(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- ACTIONS ---

  const addToCart = (item: InventoryItem) => {
      const price = parseFloat(item.retailPrice.toString());
      setCart(prev => {
          const existing = prev.find(i => i.inventoryItemId === item.id);
          if (existing) {
              const newQty = existing.quantity + 1;
              return prev.map(i => i.inventoryItemId === item.id 
                ? { ...i, quantity: newQty, total: newQty * price } 
                : i
              );
          }
          return [...prev, { 
              inventoryItemId: item.id, name: item.name, sku: item.sku, 
              quantity: 1, unitPrice: price, total: price 
          }];
      });
      setSearchTerm('');
      setIsSearchFocused(false);
  };

  const updateQty = (id: string, newQty: number) => {
      if (isNaN(newQty) || newQty < 0) return;
      if (newQty === 0) { removeItem(id); return; }
      setCart(prev => prev.map(i => i.inventoryItemId === id 
        ? { ...i, quantity: newQty, total: newQty * i.unitPrice } 
        : i
      ));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.inventoryItemId !== id));

  // --- HISTORY ACTIONS ---

  const handleEditInvoice = (sale: SaleRecord) => {
      if (cart.length > 0 && !window.confirm("Current cart will be replaced. Continue?")) return;
      setCart(sale.items);
      setDiscount(sale.discount.toString());
      setPayMethod(sale.payments[0]?.method || 'Transfer');
      setSelectedSale(sale);
      if (sale.clientId) {
          setClientType('Registered');
          setSelectedClientId(sale.clientId);
      } else {
          setClientType('Walk-in');
          setSelectedClientId('');
      }
  };

  const handleViewReceipt = (sale: SaleRecord) => {
      setPrintData(sale);
      setShowPrintModal(true);
  };

  const handleDeleteInvoice = (id: string) => {
      const reason = window.prompt("Reason for deletion (required for logs):");
      if (reason) {
          onDeleteSale(id, reason);
          if (selectedSale?.id === id) resetPOS();
      }
  };

  // --- CHECKOUT LOGIC ---

  const handleProcessTransaction = (type: 'Invoice' | 'Receipt') => {
      if (cart.length === 0) return;
      
      const isReceipt = type === 'Receipt';
      const status = isReceipt ? 'Paid' : 'Pending';

      if (!isReceipt && clientType === 'Walk-in') {
          if (!window.confirm("Generating an unpaid Invoice for a Walk-in client is risky. Continue?")) return;
      }

      const finalAmount = parseFloat(payAmount) || 0;
      
      if (isReceipt) {
          if (finalAmount <= 0 && total > 0) {
              alert("Amount paid cannot be 0.");
              return;
          }
          if (finalAmount < total) {
              if(!window.confirm(`Payment (${formatCurrency(finalAmount, settings.currency)}) is less than Total (${formatCurrency(total, settings.currency)}). Proceed?`)) return;
          }
      }

      const payments: Payment[] = isReceipt ? [{
          id: `pay-${Date.now()}`,
          method: payMethod,
          amount: finalAmount,
          date: new Date().toISOString()
      }] : [];

      const saleId = selectedSale?.id || `sale-${Date.now()}`;
      const registeredOwner = owners.find(o => o.id === selectedClientId);
      
      const newSale: SaleRecord = {
          id: saleId,
          tenantId: '',
          date: new Date().toISOString(),
          clientId: clientType === 'Registered' ? selectedClientId : undefined,
          clientName: clientType === 'Registered' && registeredOwner ? registeredOwner.name : 'Walk-in Client',
          clientAddress: clientType === 'Registered' && registeredOwner ? registeredOwner.address : '',
          items: cart,
          subtotal,
          discount: discountVal,
          tax,
          total,
          status,
          payments,
          invoiceNumber: selectedSale?.invoiceNumber || `${settings.invoicePrefix}${Date.now().toString().slice(-6)}`,
          receiptNumber: status === 'Paid' ? (selectedSale?.receiptNumber || `${settings.receiptPrefix}${Date.now().toString().slice(-6)}`) : undefined
      };

      onSaveSale(newSale);
      resetPOS();
  };

  const resetPOS = () => {
      setCart([]);
      setDiscount('');
      setPayAmount('');
      setSelectedSale(null);
      setClientType('Walk-in');
      setSelectedClientId('');
      setPayMethod('Transfer');
  };

  // --- PRINT FUNCTION ---
  const handlePrint = () => {
      if (!printData) return;
      
      const isPaid = printData.status === 'Paid';
      const color = isPaid ? '#10b981' : '#f59e0b'; // Emerald or Amber
      
      // Fetch details with fallback to ensure header isn't empty
      // Note: 'name' is often used in backend, 'clinicName' in frontend types. We check both.
      const clinicName = settings.name || settings.clinicName || "Veterinary Clinic";
      const address = settings.address || "Address not provided";
      const phone = settings.phone || "";
      const email = settings.email || "";
      const website = settings.website || "";

      // Combine contact info cleanly
      const contactInfo = [phone, email, website].filter(Boolean).join(" • ");

      const printContent = `
        <html>
          <head>
            <title>${isPaid ? 'Receipt' : 'Invoice'} - ${printData.invoiceNumber}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
              body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; -webkit-print-color-adjust: exact; max-width: 800px; margin: 0 auto; }
              
              .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid ${color}; padding-bottom: 20px; }
              .clinic-name { font-size: 32px; font-weight: 900; color: ${color}; margin: 0; text-transform: uppercase; letter-spacing: -1px; }
              .clinic-address { font-size: 14px; color: #64748b; margin: 8px 0 4px 0; }
              .clinic-contact { font-size: 13px; font-weight: 600; color: #475569; }
              
              .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
              .meta-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
              .meta-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
              .meta-value { font-size: 14px; font-weight: 600; color: #334155; }
              
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
              th { background-color: ${isPaid ? '#ecfdf5' : '#fffbeb'}; color: ${color}; text-align: left; padding: 12px 16px; font-weight: 800; border-bottom: 2px solid ${color}; }
              td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
              tr:last-child td { border-bottom: none; }
              
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              
              .totals-section { display: flex; justify-content: flex-end; margin-top: 20px; }
              .totals-table { width: 300px; }
              .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #64748b; }
              .grand-total { font-size: 20px; font-weight: 900; color: ${color}; border-top: 2px solid ${color}; padding-top: 10px; margin-top: 5px; color: #0f172a; }
              
              .watermark {
                position: fixed; top: 50%; left: 50%; 
                transform: translate(-50%, -50%) rotate(-45deg); 
                font-size: 10rem; font-weight: 900; 
                color: ${color}; opacity: 0.08; 
                z-index: -1; pointer-events: none; border: 12px solid ${color}; padding: 20px 40px; border-radius: 20px;
              }

              .footer { text-align: center; margin-top: 60px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
              
              .account-info {
                margin-top: 40px; background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px;
                text-align: center;
              }
            </style>
          </head>
          <body>
            
            <div class="watermark">${isPaid ? 'PAID' : 'INVOICE'}</div>

            <div class="header">
              <h1 class="clinic-name">${clinicName}</h1>
              <p class="clinic-address">${address}</p>
              <p class="clinic-contact">${contactInfo}</p>
            </div>

            <div class="meta-grid">
              <div class="meta-box">
                <span class="meta-label">Billed To</span>
                <div class="meta-value">${printData.clientName}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${printData.clientAddress || 'No Address Provided'}</div>
              </div>
              <div class="meta-box text-right">
                <span class="meta-label">Document Details</span>
                <div class="meta-value">#${isPaid ? printData.receiptNumber : printData.invoiceNumber}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                  Date: ${new Date(printData.date).toLocaleDateString()}
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="border-top-left-radius: 8px;">Description</th>
                  <th class="text-center">Qty</th>
                  <th class="text-right">Price</th>
                  <th class="text-right" style="border-top-right-radius: 8px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${printData.items.map(item => `
                  <tr>
                    <td>
                      <div style="font-weight: 600; color: #334155;">${item.name}</div>
                      <div style="font-size: 11px; color: #94a3b8;">SKU: ${item.sku}</div>
                    </td>
                    <td class="text-center" style="font-weight: 600;">${item.quantity}</td>
                    <td class="text-right">${formatCurrency(item.unitPrice, settings.currency)}</td>
                    <td class="text-right" style="font-weight: 700; color: #0f172a;">${formatCurrency(item.total, settings.currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="totals-section">
              <div class="totals-table">
                <div class="totals-row">
                  <span>Subtotal</span>
                  <span>${formatCurrency(printData.subtotal, settings.currency)}</span>
                </div>
                <div class="totals-row">
                  <span>Tax (${settings.taxRate || 0}%)</span>
                  <span>${formatCurrency(printData.tax, settings.currency)}</span>
                </div>
                ${printData.discount > 0 ? `
                  <div class="totals-row" style="color: #ef4444;">
                    <span>Discount</span>
                    <span>-${formatCurrency(printData.discount, settings.currency)}</span>
                  </div>
                ` : ''}
                <div class="totals-row grand-total">
                  <span>Total Due</span>
                  <span>${formatCurrency(printData.total, settings.currency)}</span>
                </div>
                
                ${isPaid ? `
                  <div class="totals-row" style="margin-top: 8px; font-size: 12px; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
                     <span>Paid via ${printData.payments[0]?.method || 'Cash'}</span>
                     <span>${new Date(printData.payments[0]?.date || Date.now()).toLocaleTimeString()}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            ${!isPaid ? `
              <div class="account-info">
                <h4 style="margin: 0 0 10px 0; color: #334155; text-transform: uppercase; font-size: 12px;">Payment Instructions</h4>
                <p style="margin: 0; font-size: 14px; color: #475569;">
                  <strong>Bank:</strong> GTBank &nbsp;|&nbsp; 
                  <strong>Acc:</strong> ${settings.clinicName} &nbsp;|&nbsp; 
                  <strong>No:</strong> 0123456789
                </p>
              </div>
            ` : ''}

            <div class="footer">
              <p>Thank you for choosing ${clinicName}!</p>
              <p style="font-size: 10px; margin-top: 5px;">System Generated by Vet Nexus</p>
            </div>

            <script>
              window.print();
            </script>
          </body>
        </html>
      `;

      const win = window.open('', '', 'width=900,height=700');
      if (win) {
          win.document.write(printContent);
          win.document.close();
      }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6 p-4 font-sans bg-slate-50/50">
        
        {/* --- LEFT PANEL: SEARCH & HISTORY --- */}
        <div className="flex-1 flex flex-col gap-6 h-full relative">
            
            {/* Header Area */}
            <div className="flex flex-col gap-4 z-40">
                {/* Search Bar */}
                <div className="relative w-full" ref={searchRef}>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Scan SKU or Search Item..." 
                            value={searchTerm}
                            onFocus={() => setIsSearchFocused(true)}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setIsSearchFocused(true);
                            }}
                            className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-base font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none shadow-sm transition-all"
                        />
                    </div>
                    {/* Dropdown Results */}
                    {isSearchFocused && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in max-h-96 overflow-y-auto custom-scrollbar z-50">
                            <div className="p-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                {searchTerm ? 'Search Results' : 'Inventory'}
                            </div>
                            {searchResults.length > 0 ? (
                                searchResults.map(item => (
                                    <button 
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-emerald-50 transition-colors border-b border-slate-50 last:border-0 text-left group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs group-hover:bg-emerald-100 group-hover:text-emerald-600">
                                                {item.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm group-hover:text-emerald-900">{item.name}</p>
                                                <p className="text-xs text-slate-400">Stock: {item.stock} • SKU: {item.sku}</p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-emerald-600">{formatCurrency(item.retailPrice, settings.currency)}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">No items found</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2">
                    {['All', 'Pending', 'Paid'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setHistoryFilter(tab as any)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${historyFilter === tab 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                        >
                            {tab === 'Pending' ? 'Invoices' : tab === 'Paid' ? 'Receipts' : 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {/* History List */}
            <div className="flex-1 bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/50 overflow-hidden relative">
                <div className="h-full overflow-y-auto p-4 custom-scrollbar space-y-3">
                    {filteredHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <FileText className="w-16 h-16 mb-4 stroke-1"/>
                            <p>No records found</p>
                        </div>
                    ) : (
                        filteredHistory.map((sale) => (
                            <div 
                                key={sale.id} 
                                className={`group p-4 bg-white border border-slate-100 rounded-2xl transition-all hover:shadow-lg hover:border-emerald-200 relative overflow-hidden ${selectedSale?.id === sale.id ? 'ring-2 ring-emerald-500' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sale.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {sale.status === 'Paid' ? <CheckCircle2 className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5"/>}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">{sale.clientName}</h4>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                                                <span>#{sale.invoiceNumber}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>{new Date(sale.date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-black text-slate-800 text-sm">{formatCurrency(sale.total, settings.currency)}</p>
                                        </div>
                                        
                                        {/* Row Actions */}
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleViewReceipt(sale)} 
                                                className="p-2 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors" 
                                                title="View/Print"
                                            >
                                                <Eye className="w-4 h-4"/>
                                            </button>

                                            {sale.status === 'Pending' && (
                                                <button onClick={() => handleEditInvoice(sale)} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200" title="Edit/Pay">
                                                    <CreditCard className="w-4 h-4"/>
                                                </button>
                                            )}
                                            
                                            <button onClick={() => handleDeleteInvoice(sale.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="Delete">
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* --- RIGHT PANEL: TRANSACTION --- */}
        <div className="w-[420px] flex flex-col h-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-200 overflow-hidden z-30">
            
            {/* Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-200">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">
                        {selectedSale ? (selectedSale.status === 'Pending' ? 'Editing Invoice' : 'Receipt View') : 'New Sale'}
                    </h3>
                    {selectedSale && (
                        <button onClick={resetPOS} className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1">
                            <X className="w-3 h-3"/> Clear
                        </button>
                    )}
                </div>
                
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-3">
                    <button onClick={() => setClientType('Walk-in')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${clientType === 'Walk-in' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Walk-in</button>
                    <button onClick={() => setClientType('Registered')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${clientType === 'Registered' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Registered</button>
                </div>
                {clientType === 'Registered' && (
                     <SearchableSelect 
                        options={owners.map(o => ({ id: o.id, label: o.name, subLabel: o.phone }))}
                        value={selectedClientId}
                        onChange={setSelectedClientId}
                        placeholder="Select Client..."
                    />
                )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <ShoppingCart className="w-12 h-12 mb-3 opacity-20"/>
                        <p className="text-sm font-medium">Cart is empty</p>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div key={item.inventoryItemId} className="flex items-center justify-between group p-2 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                            <div className="flex-1 pr-3">
                                <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{item.name}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{formatCurrency(item.unitPrice, settings.currency)}</p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg h-8 shadow-sm">
                                    <button onClick={() => updateQty(item.inventoryItemId, item.quantity - 1)} className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-l-lg"><Minus className="w-3 h-3"/></button>
                                    <input 
                                        type="number"
                                        min="1"
                                        className="w-10 h-full text-center text-xs font-bold text-slate-700 focus:outline-none focus:bg-slate-50"
                                        value={item.quantity}
                                        onChange={(e) => updateQty(item.inventoryItemId, parseInt(e.target.value) || 0)}
                                    />
                                    <button onClick={() => updateQty(item.inventoryItemId, item.quantity + 1)} className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-r-lg"><Plus className="w-3 h-3"/></button>
                                </div>
                                <button onClick={() => removeItem(item.inventoryItemId)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>

                            <div className="text-right w-20 pl-2">
                                <p className="font-bold text-emerald-600 text-sm">{formatCurrency(item.total, settings.currency)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-5 border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
                 
                 {/* Totals */}
                 <div className="space-y-1 mb-4">
                     <div className="flex justify-between text-xs text-slate-500 font-medium">
                         <span>Subtotal</span>
                         <span>{formatCurrency(subtotal, settings.currency)}</span>
                     </div>
                     <div className="flex justify-between text-xs text-slate-500 font-medium">
                         <span>Tax ({settings.taxRate || 0}%)</span>
                         <span>{formatCurrency(tax, settings.currency)}</span>
                     </div>
                     <div className="flex justify-between items-center text-emerald-600">
                         <span className="text-xs font-bold uppercase">Discount</span>
                         <input 
                            type="number" 
                            className="w-20 bg-white border border-emerald-100 rounded px-2 py-0.5 text-right text-xs font-bold outline-none focus:border-emerald-400"
                            placeholder="0"
                            value={discount}
                            onChange={e => setDiscount(e.target.value)}
                         />
                     </div>
                     <div className="flex justify-between items-end pt-2 border-t border-slate-200 mt-2">
                         <span className="text-sm font-bold text-slate-800">Total Due</span>
                         <span className="text-2xl font-black text-slate-900">{formatCurrency(total, settings.currency)}</span>
                     </div>
                 </div>

                 {/* Payment Controls */}
                 <div className="grid grid-cols-5 gap-2 mb-4">
                    <div className="col-span-2 relative">
                         <select 
                            value={payMethod} 
                            onChange={(e) => setPayMethod(e.target.value as any)}
                            className="w-full h-full appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 outline-none focus:border-slate-400"
                         >
                             <option value="Transfer">Transfer</option>
                             <option value="Cash">Cash</option>
                             <option value="Card">Card</option>
                             <option value="Credit" disabled={clientType !== 'Registered'}>Credit</option>
                         </select>
                         <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none"/>
                    </div>
                    <div className="col-span-3 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{settings.currency === 'NGN' ? '₦' : '$'}</span>
                        <input 
                            type="number" 
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            className="w-full bg-slate-900 text-white font-bold text-lg py-3 pl-7 pr-3 rounded-xl outline-none focus:ring-2 focus:ring-slate-700 transition-all placeholder-slate-600"
                            placeholder="Amount..."
                        />
                    </div>
                 </div>

                 {/* Actions */}
                 <div className="grid grid-cols-2 gap-3">
                     <button 
                        onClick={() => handleProcessTransaction('Invoice')}
                        disabled={cart.length === 0}
                        className="py-3 rounded-xl border border-slate-300 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                     >
                         <FileText className="w-4 h-4" /> 
                         <span>Save as Invoice</span>
                     </button>
                     <button 
                        onClick={() => handleProcessTransaction('Receipt')}
                        disabled={cart.length === 0}
                        className="py-3 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-200 hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                     >
                         <Printer className="w-4 h-4" /> 
                         <span>Pay & Receipt</span>
                     </button>
                 </div>
            </div>
        </div>

        {/* --- RECEIPT PREVIEW / PRINT MODAL --- */}
        {showPrintModal && printData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="font-bold text-slate-800">Print Preview</h2>
                        <button onClick={() => setShowPrintModal(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5"/></button>
                    </div>
                    
                    <div className="p-8 text-center space-y-4">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Printer className="w-10 h-10"/>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Ready to Print</h3>
                        <p className="text-slate-500 text-sm">Review the document for <strong>{printData.clientName}</strong> amounting to <strong className="text-slate-900">{formatCurrency(printData.total, settings.currency)}</strong>.</p>
                        
                        <button 
                            onClick={handlePrint}
                            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-black transition-all flex items-center justify-center gap-2"
                        >
                            <Printer className="w-5 h-5"/> Print Now
                        </button>
                        <p className="text-xs text-slate-400 mt-4">Tip: You can save as PDF from the print dialog.</p>
                    </div>
                </div>
            </div>
        )}

        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        `}</style>
    </div>
  );
};

export default POS;