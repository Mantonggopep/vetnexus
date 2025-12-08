
import React, { useState } from 'react';
import { LabResult, Pet, Owner } from '../types';
import { FlaskConical, Clock, CheckCircle2, FileText, Download, Plus, Search, Microscope, Upload, Save } from 'lucide-react';

interface LabProps {
    results: LabResult[];
    pets: Pet[];
    owners: Owner[];
    onAddResult: (result: LabResult) => void;
    onUpdateResult: (result: LabResult) => void;
}

const Lab: React.FC<LabProps> = ({ results, pets, owners, onAddResult, onUpdateResult }) => {
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({ petId: '', testName: '', notes: '' });

  // File Result Modal State
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [resultData, setResultData] = useState({ result: '', notes: '' });

  const filteredResults = results.filter(r => {
      const matchesSearch = r.testName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'All' || r.status === (activeTab === 'Completed' ? 'Completed' : 'Pending');
      // For 'Pending' tab, show Pending and Processing
      if (activeTab === 'Pending') {
          return matchesSearch && (r.status === 'Pending' || r.status === 'Processing');
      }
      return matchesSearch && matchesTab;
  });

  const handleCreateRequest = () => {
      if (!newRequest.petId || !newRequest.testName) return;
      const pet = pets.find(p => p.id === newRequest.petId);
      const owner = owners.find(o => o.id === pet?.ownerId);

      const newItem: LabResult = {
          id: `lr-${Date.now()}`,
          tenantId: pet?.tenantId || '',
          petId: newRequest.petId,
          patientName: pet?.name,
          ownerName: owner?.name,
          testName: newRequest.testName,
          requestDate: new Date().toISOString(),
          status: 'Pending',
          requestedBy: 'Current User', // Mock
          notes: newRequest.notes
      };

      onAddResult(newItem);
      setIsRequestModalOpen(false);
      setNewRequest({ petId: '', testName: '', notes: '' });
  };

  const openFileModal = (lab: LabResult) => {
      setSelectedResult(lab);
      setResultData({ result: lab.result || '', notes: lab.notes || '' });
      setIsFileModalOpen(true);
  };

  const handleSaveResult = () => {
      if (!selectedResult) return;
      
      const updated: LabResult = {
          ...selectedResult,
          status: 'Completed',
          completionDate: new Date().toISOString(),
          result: resultData.result,
          notes: resultData.notes,
          conductedBy: 'Lab Tech' // Mock
      };

      onUpdateResult(updated);
      setIsFileModalOpen(false);
      setSelectedResult(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 h-[calc(100vh-8rem)] flex flex-col">
       <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <FlaskConical className="w-5 h-5 mr-2" /> Lab & Diagnostics
            </h2>
            <div className="flex space-x-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search tests..." 
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => setIsRequestModalOpen(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" /> Request Test
                </button>
            </div>
       </div>

       {/* Tabs */}
       <div className="px-4 pt-4 flex space-x-1 border-b border-slate-100 bg-slate-50">
           {['All', 'Pending', 'Completed'].map(tab => (
               <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab ? 'bg-white text-primary-600 border-x border-t border-slate-200' : 'text-slate-500 hover:bg-white/50'
                }`}
               >
                   {tab}
               </button>
           ))}
       </div>

       <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResults.map(lab => (
                    <div key={lab.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-slate-800">{lab.testName}</h3>
                                <p className="text-xs text-slate-500">{new Date(lab.requestDate).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                lab.status === 'Completed' ? 'bg-green-50 text-green-600 border-green-100' : 
                                lab.status === 'Processing' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                'bg-orange-50 text-orange-600 border-orange-100'
                            }`}>
                                {lab.status}
                            </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center text-sm text-slate-700">
                                <span className="text-slate-400 w-20 text-xs uppercase font-bold">Patient:</span>
                                <span className="font-medium">{lab.patientName || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center text-sm text-slate-700">
                                <span className="text-slate-400 w-20 text-xs uppercase font-bold">Owner:</span>
                                <span>{lab.ownerName || '-'}</span>
                            </div>
                            <div className="flex items-center text-sm text-slate-700">
                                <span className="text-slate-400 w-20 text-xs uppercase font-bold">Req By:</span>
                                <span>{lab.requestedBy}</span>
                            </div>
                        </div>

                        {lab.status !== 'Completed' ? (
                            <button 
                                onClick={() => openFileModal(lab)}
                                className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-bold transition-colors flex items-center justify-center border border-blue-200"
                            >
                                <Microscope className="w-4 h-4 mr-2" /> File Result
                            </button>
                        ) : (
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                <p className="text-xs font-bold text-green-700 mb-1 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Result Filed</p>
                                <p className="text-sm text-slate-700 line-clamp-2">{lab.result}</p>
                                {lab.resultUrl && (
                                    <button className="text-xs text-primary-600 hover:underline mt-2 flex items-center">
                                        <Download className="w-3 h-3 mr-1" /> Download Report
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {filteredResults.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No lab requests found.</p>
                </div>
            )}
       </div>

       {/* New Request Modal */}
       {isRequestModalOpen && (
           <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-up">
                   <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                       <h3 className="font-bold text-slate-800">New Lab Request</h3>
                       <button onClick={() => setIsRequestModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                   </div>
                   <div className="p-6 space-y-4">
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Select Patient</label>
                           <select 
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                            value={newRequest.petId}
                            onChange={(e) => setNewRequest({...newRequest, petId: e.target.value})}
                           >
                               <option value="">Choose...</option>
                               {pets.map(p => <option key={p.id} value={p.id}>{p.name} ({p.species})</option>)}
                           </select>
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Test Name</label>
                           <input 
                            type="text" 
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                            placeholder="e.g. CBC, Urinalysis"
                            value={newRequest.testName}
                            onChange={(e) => setNewRequest({...newRequest, testName: e.target.value})}
                           />
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Clinical Notes</label>
                           <textarea 
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm h-24"
                            placeholder="Reason for test..."
                            value={newRequest.notes}
                            onChange={(e) => setNewRequest({...newRequest, notes: e.target.value})}
                           />
                       </div>
                       <button onClick={handleCreateRequest} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-bold">Send Request</button>
                   </div>
               </div>
           </div>
       )}

       {/* File Result Modal */}
       {isFileModalOpen && selectedResult && (
           <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-scale-up">
                   <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                       <h3 className="font-bold text-slate-800">File Result: {selectedResult.testName}</h3>
                       <button onClick={() => setIsFileModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                   </div>
                   <div className="p-6 space-y-4">
                       <div className="bg-slate-50 p-3 rounded-lg text-sm mb-2 border border-slate-100">
                           <p><span className="font-bold">Patient:</span> {selectedResult.patientName}</p>
                           <p><span className="font-bold">Requested:</span> {new Date(selectedResult.requestDate).toLocaleDateString()}</p>
                       </div>

                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Result Summary</label>
                           <textarea 
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm h-32"
                            placeholder="Enter findings..."
                            value={resultData.result}
                            onChange={(e) => setResultData({...resultData, result: e.target.value})}
                           />
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                           <input 
                            type="text" 
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                            value={resultData.notes}
                            onChange={(e) => setResultData({...resultData, notes: e.target.value})}
                           />
                       </div>
                       
                       <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm hover:bg-slate-50 cursor-pointer">
                           <Upload className="w-6 h-6 mx-auto mb-2" />
                           <p>Click to upload result PDF or Image (Mock)</p>
                       </div>

                       <div className="flex justify-end space-x-3 pt-2">
                            <button onClick={() => setIsFileModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-bold">Cancel</button>
                            <button onClick={handleSaveResult} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold flex items-center">
                                <Save className="w-4 h-4 mr-2" /> Complete & Save
                            </button>
                       </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default Lab;
