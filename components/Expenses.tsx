
import React, { useState } from 'react';
import { Expense, ClinicSettings } from '../types';
import { DollarSign, Plus, Calendar, Tag, FileText } from 'lucide-react';
import { formatCurrency } from '../utils/uiUtils';

interface ExpensesProps {
  expenses: Expense[];
  settings: ClinicSettings;
  onAddExpense: (expense: Omit<Expense, 'id' | 'tenantId'>) => void;
}

const Expenses: React.FC<ExpensesProps> = ({ expenses, settings, onAddExpense }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      category: 'Utilities',
      description: '',
      amount: '',
      paymentMethod: 'Cash',
      notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onAddExpense({
          date: new Date(formData.date).toISOString(),
          category: formData.category,
          description: formData.description,
          amount: Number(formData.amount),
          paymentMethod: formData.paymentMethod,
          notes: formData.notes
      });
      setIsModalOpen(false);
      setFormData({ date: new Date().toISOString().split('T')[0], category: 'Utilities', description: '', amount: '', paymentMethod: 'Cash', notes: '' });
  };

  const categories = ['Utilities', 'Rent', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other'];
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex justify-between items-center shrink-0">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Expenses</h2>
                <p className="text-sm text-slate-500">Track clinic expenditures</p>
            </div>
            <div className="flex items-center space-x-4">
                <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg border border-red-100 font-bold shadow-sm">
                    Total: {formatCurrency(totalExpenses, settings.currency)}
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center shadow-lg shadow-primary-200 transition-colors btn-press"
                >
                    <Plus className="w-4 h-4 mr-2" /> Record Expense
                </button>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                            <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                            <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {expenses.map(expense => (
                            <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-4 px-6 text-sm text-slate-600">
                                    {new Date(expense.date).toLocaleDateString()}
                                </td>
                                <td className="py-4 px-6">
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold uppercase">{expense.category}</span>
                                </td>
                                <td className="py-4 px-6 text-sm font-medium text-slate-800">{expense.description}</td>
                                <td className="py-4 px-6 text-sm text-slate-500">{expense.paymentMethod}</td>
                                <td className="py-4 px-6 text-right font-bold text-red-600 font-mono">
                                    {formatCurrency(expense.amount, settings.currency)}
                                </td>
                            </tr>
                        ))}
                        {expenses.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-10 text-center text-slate-400">No expenses recorded yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-up border border-white/50">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <h3 className="font-bold text-slate-800">Record New Expense</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                                <input type="date" required className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                                <select className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                            <input type="text" required className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g. Electric Bill" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Amount ({settings.currency})</label>
                                <input type="number" required className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                                <select className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                                    <option>Cash</option>
                                    <option>Bank Transfer</option>
                                    <option>Card</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                            <textarea className="w-full p-2 border border-slate-200 rounded-lg text-sm h-20" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                        </div>
                        <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-bold shadow-md btn-press">Save Expense</button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default Expenses;
