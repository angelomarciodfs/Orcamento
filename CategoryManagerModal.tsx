
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Edit2, Check, FolderOpen, Tag, CreditCard, TrendingUp } from 'lucide-react';
import type { CategoryStructure } from './types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  incomeCategories: string[];
  expenseGroups: CategoryStructure[];
  bankList: string[];
  investmentList: string[];
  onSave: (income: string[], expenses: CategoryStructure[], banks: string[], investments: string[]) => void;
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen, onClose, incomeCategories, expenseGroups, bankList, investmentList, onSave
}) => {
  const [tab, setTab] = useState<'INCOME' | 'EXPENSE' | 'BANKS' | 'INVESTMENTS'>('EXPENSE');
  
  // Local state for editing
  const [localIncome, setLocalIncome] = useState<string[]>([]);
  const [localGroups, setLocalGroups] = useState<CategoryStructure[]>([]);
  const [localBanks, setLocalBanks] = useState<string[]>([]);
  const [localInvestments, setLocalInvestments] = useState<string[]>([]);
  
  // Update local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalIncome([...incomeCategories]);
      setLocalGroups(JSON.parse(JSON.stringify(expenseGroups)));
      setLocalBanks([...bankList]);
      setLocalInvestments([...investmentList]);
    }
  }, [isOpen, incomeCategories, expenseGroups, bankList, investmentList]);
  
  // Inputs for new items
  const [newItemName, setNewItemName] = useState('');
  
  // State for Editing Mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!isOpen) return null;

  const handleSaveAll = () => {
    onSave(localIncome, localGroups, localBanks, localInvestments);
  };

  // --- Helper: Editable Item Component ---
  const EditableItem = ({ 
    id, 
    value, 
    onSave, 
    onDelete, 
    isHeader = false 
  }: { 
    id: string, 
    value: string, 
    onSave: (val: string) => void, 
    onDelete: () => void,
    isHeader?: boolean
  }) => {
    const isEditing = editingId === id;

    const startEdit = () => {
      setEditingId(id);
      setEditValue(value);
    };

    const confirmEdit = () => {
      if (editValue.trim()) {
        onSave(editValue.trim());
        setEditingId(null);
      }
    };

    const cancelEdit = () => {
      setEditingId(null);
      setEditValue('');
    };

    if (isEditing) {
      return (
        <div className={`flex items-center gap-2 flex-1 ${isHeader ? 'p-1' : ''}`}>
          <input 
            type="text" 
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-800"
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <button onClick={confirmEdit} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={16} /></button>
          <button onClick={cancelEdit} className="text-red-500 hover:bg-red-100 p-1 rounded"><X size={16} /></button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between flex-1 gap-2 group">
        <span className={`truncate ${isHeader ? 'font-bold text-gray-800' : 'text-gray-700'}`}>{value}</span>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button onClick={startEdit} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded" title="Editar nome">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Excluir item">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  const addItem = () => {
    if (!newItemName.trim()) return;
    const name = newItemName.trim();
    if (tab === 'INCOME') setLocalIncome([...localIncome, name]);
    else if (tab === 'BANKS') setLocalBanks([...localBanks, name]);
    else if (tab === 'INVESTMENTS') setLocalInvestments([...localInvestments, name]);
    else if (tab === 'EXPENSE') setLocalGroups([...localGroups, { name, items: [] }]);
    setNewItemName('');
  };

  const getActiveList = () => {
    if (tab === 'INCOME') return localIncome;
    if (tab === 'BANKS') return localBanks;
    if (tab === 'INVESTMENTS') return localInvestments;
    return [];
  };

  const updateSimpleList = (idx: number, newVal: string) => {
    if (tab === 'INCOME') {
      const updated = [...localIncome];
      updated[idx] = newVal;
      setLocalIncome(updated);
    } else if (tab === 'BANKS') {
      const updated = [...localBanks];
      updated[idx] = newVal;
      setLocalBanks(updated);
    } else if (tab === 'INVESTMENTS') {
      const updated = [...localInvestments];
      updated[idx] = newVal;
      setLocalInvestments(updated);
    }
  };

  const removeSimpleList = (idx: number) => {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    if (tab === 'INCOME') setLocalIncome(localIncome.filter((_, i) => i !== idx));
    else if (tab === 'BANKS') setLocalBanks(localBanks.filter((_, i) => i !== idx));
    else if (tab === 'INVESTMENTS') setLocalInvestments(localInvestments.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Autonomia de Gestão</h2>
            <p className="text-xs text-gray-500 font-medium">Personalize Bancos, Investimentos e Categorias</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-white overflow-x-auto shrink-0 scrollbar-hide">
          <button 
            className={`flex-1 min-w-[120px] py-4 font-bold text-xs flex items-center justify-center gap-2 border-b-2 transition-colors uppercase tracking-wider ${tab === 'EXPENSE' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setTab('EXPENSE')}
          >
            <FolderOpen size={16} /> Despesas
          </button>
          <button 
            className={`flex-1 min-w-[120px] py-4 font-bold text-xs flex items-center justify-center gap-2 border-b-2 transition-colors uppercase tracking-wider ${tab === 'INCOME' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setTab('INCOME')}
          >
            <Tag size={16} /> Receitas
          </button>
          <button 
            className={`flex-1 min-w-[120px] py-4 font-bold text-xs flex items-center justify-center gap-2 border-b-2 transition-colors uppercase tracking-wider ${tab === 'BANKS' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setTab('BANKS')}
          >
            <CreditCard size={16} /> Bancos
          </button>
          <button 
            className={`flex-1 min-w-[120px] py-4 font-bold text-xs flex items-center justify-center gap-2 border-b-2 transition-colors uppercase tracking-wider ${tab === 'INVESTMENTS' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setTab('INVESTMENTS')}
          >
            <TrendingUp size={16} /> Investimentos
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          
          <div className="max-w-2xl mx-auto space-y-6">
              {/* Add Input Section */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    {tab === 'EXPENSE' ? 'Novo Grupo de Despesas' : tab === 'INCOME' ? 'Nova Fonte de Receita' : tab === 'BANKS' ? 'Novo Banco' : 'Novo Investimento'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addItem()}
                      placeholder="Digite aqui..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                    <button onClick={addItem} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm font-bold flex items-center gap-1">
                      <Plus size={18} /> Adicionar
                    </button>
                  </div>
              </div>

              {tab === 'EXPENSE' ? (
                <div className="space-y-4">
                  {localGroups.map((group, gIdx) => (
                    <div key={gIdx} className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
                      <div className="bg-gray-100 px-4 py-3 border-b border-gray-300 flex justify-between items-center">
                         <EditableItem 
                            id={`GROUP-${gIdx}`} 
                            value={group.name} 
                            onSave={(val) => {
                              const updated = [...localGroups];
                              updated[gIdx].name = val;
                              setLocalGroups(updated);
                            }} 
                            onDelete={() => {
                              if(confirm('Excluir este grupo apagará todas as sub-categorias?')) {
                                setLocalGroups(localGroups.filter((_, i) => i !== gIdx));
                              }
                            }}
                            isHeader
                         />
                      </div>
                      <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                          {group.items.map((item, iIdx) => (
                            <div key={iIdx} className="flex items-center p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                              <span className="w-2 h-2 rounded-full bg-indigo-300 mr-2 flex-shrink-0"></span>
                              <EditableItem 
                                  id={`ITEM-${gIdx}-${iIdx}`} 
                                  value={item} 
                                  onSave={(val) => {
                                    const updated = [...localGroups];
                                    updated[gIdx].items[iIdx] = val;
                                    setLocalGroups(updated);
                                  }} 
                                  onDelete={() => {
                                    const updated = [...localGroups];
                                    updated[gIdx].items = updated[gIdx].items.filter((_, i) => i !== iIdx);
                                    setLocalGroups(updated);
                                  }} 
                              />
                            </div>
                          ))}
                          <div className="sm:col-span-2 mt-4 pt-3 border-t border-gray-100">
                            <input 
                              type="text"
                              placeholder={`+ Novo item em ${group.name}...`}
                              className="w-full text-xs px-3 py-2 border border-dashed border-gray-300 rounded focus:border-indigo-400 outline-none"
                              onKeyDown={(e) => {
                                if(e.key === 'Enter' && e.currentTarget.value.trim()) {
                                    const updated = [...localGroups];
                                    updated[gIdx].items.push(e.currentTarget.value.trim());
                                    setLocalGroups(updated);
                                    e.currentTarget.value = '';
                                }
                              }}
                            />
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Itens Cadastrados ({getActiveList().length})
                  </div>
                  <div className="divide-y divide-gray-100">
                      {getActiveList().map((item, idx) => (
                      <div key={idx} className="p-3 hover:bg-gray-50 transition-colors flex items-center">
                          <EditableItem 
                              id={`${tab}-${idx}`} 
                              value={item} 
                              onSave={(val) => updateSimpleList(idx, val)} 
                              onDelete={() => removeSimpleList(idx)} 
                          />
                      </div>
                      ))}
                      {getActiveList().length === 0 && (
                          <div className="p-12 text-center text-gray-400 italic text-sm">Nenhum item cadastrado.</div>
                      )}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end gap-3 z-20">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 font-bold rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSaveAll} className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2 transition-transform active:scale-95">
            <Save size={18} />
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;
