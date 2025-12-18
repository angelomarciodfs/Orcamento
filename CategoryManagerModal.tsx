import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Edit2, Check, FolderOpen, Tag } from 'lucide-react';
import type { CategoryStructure } from './types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  incomeCategories: string[];
  expenseGroups: CategoryStructure[];
  onSave: (income: string[], expenses: CategoryStructure[]) => void;
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen, onClose, incomeCategories, expenseGroups, onSave
}) => {
  const [tab, setTab] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  // Local state for editing
  const [localIncome, setLocalIncome] = useState<string[]>([]);
  const [localGroups, setLocalGroups] = useState<CategoryStructure[]>([]);

  // Update local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalIncome([...incomeCategories]);
      // Deep copy to avoid reference issues
      setLocalGroups(JSON.parse(JSON.stringify(expenseGroups)));
    }
  }, [isOpen, incomeCategories, expenseGroups]);

  // Inputs for new items
  const [newIncomeName, setNewIncomeName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  // State for Editing Mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!isOpen) return null;

  const handleSaveAll = () => {
    // Calls a single function to save both, preventing race conditions
    onSave(localIncome, localGroups);
    onClose();
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

  // --- INCOME ACTIONS ---
  const addIncome = () => {
    if (newIncomeName.trim()) {
      setLocalIncome([...localIncome, newIncomeName.trim()]);
      setNewIncomeName('');
    }
  };
  const updateIncome = (idx: number, newVal: string) => {
    const updated = [...localIncome];
    updated[idx] = newVal;
    setLocalIncome(updated);
  };
  const removeIncome = (idx: number) => {
    if(confirm('Tem certeza que deseja excluir esta categoria?')) {
        setLocalIncome(localIncome.filter((_, i) => i !== idx));
    }
  };

  // --- EXPENSE ACTIONS ---
  const addGroup = () => {
    if (newGroupName.trim()) {
      setLocalGroups([...localGroups, { name: newGroupName.trim(), items: [] }]);
      setNewGroupName('');
    }
  };
  const updateGroup = (idx: number, newName: string) => {
    const updated = [...localGroups];
    updated[idx].name = newName;
    setLocalGroups(updated);
  };
  const removeGroup = (idx: number) => {
    if(confirm('Excluir este grupo apagará todas as sub-categorias dele. Continuar?')) {
        setLocalGroups(localGroups.filter((_, i) => i !== idx));
    }
  };

  const addItemToGroup = (groupIdx: number, itemName: string) => {
    if (itemName.trim()) {
      const updated = [...localGroups];
      updated[groupIdx].items.push(itemName.trim());
      setLocalGroups(updated);
    }
  };
  const updateItemInGroup = (groupIdx: number, itemIdx: number, newVal: string) => {
    const updated = [...localGroups];
    updated[groupIdx].items[itemIdx] = newVal;
    setLocalGroups(updated);
  };
  const removeItemFromGroup = (groupIdx: number, itemIdx: number) => {
    const updated = [...localGroups];
    updated[groupIdx].items = updated[groupIdx].items.filter((_, i) => i !== itemIdx);
    setLocalGroups(updated);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden border border-gray-200">

        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Gerenciar Categorias e Grupos</h2>
            <p className="text-xs text-gray-500">Personalize as opções disponíveis nos lançamentos</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-white sticky top-0 z-10">
          <button
            className={`flex-1 py-4 font-semibold text-sm flex items-center justify-center gap-2 border-b-2 transition-colors ${tab === 'EXPENSE' ? 'border-red-500 text-red-600 bg-red-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setTab('EXPENSE')}
          >
            <FolderOpen size={18} />
            Despesas (Grupos)
          </button>
          <button
            className={`flex-1 py-4 font-semibold text-sm flex items-center justify-center gap-2 border-b-2 transition-colors ${tab === 'INCOME' ? 'border-green-500 text-green-600 bg-green-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setTab('INCOME')}
          >
            <Tag size={18} />
            Receitas (Fontes)
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">

          {tab === 'INCOME' && (
            <div className="max-w-xl mx-auto space-y-6">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Adicionar Nova Fonte</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newIncomeName}
                      onChange={(e) => setNewIncomeName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addIncome()}
                      placeholder="Ex: Venda de Bolos..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                    <button onClick={addIncome} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow-sm font-medium flex items-center gap-1">
                      <Plus size={18} /> Adicionar
                    </button>
                  </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                    Fontes Cadastradas ({localIncome.length})
                </div>
                <div className="divide-y divide-gray-100">
                    {localIncome.map((item, idx) => (
                    <div key={idx} className="p-3 hover:bg-gray-50 transition-colors flex items-center">
                        <EditableItem
                            id={`INCOME-${idx}`}
                            value={item}
                            onSave={(val) => updateIncome(idx, val)}
                            onDelete={() => removeIncome(idx)}
                        />
                    </div>
                    ))}
                    {localIncome.length === 0 && (
                        <div className="p-8 text-center text-gray-400 italic">Nenhuma categoria cadastrada.</div>
                    )}
                </div>
              </div>
            </div>
          )}

          {tab === 'EXPENSE' && (
            <div className="max-w-2xl mx-auto space-y-8">
              {/* Add Group Section */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Criar Novo Grupo de Despesas</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addGroup()}
                      placeholder="Ex: Manutenção da Casa..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button onClick={addGroup} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm font-medium flex items-center gap-1">
                      <Plus size={18} /> Criar Grupo
                    </button>
                  </div>
              </div>

              <div className="space-y-4">
                {localGroups.map((group, gIdx) => (
                  <div key={gIdx} className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                    {/* Group Header */}
                    <div className="bg-gray-100 px-4 py-3 border-b border-gray-300 flex justify-between items-center">
                       <EditableItem
                          id={`GROUP-${gIdx}`}
                          value={group.name}
                          onSave={(val) => updateGroup(gIdx, val)}
                          onDelete={() => removeGroup(gIdx)}
                          isHeader
                       />
                    </div>

                    {/* Items List */}
                    <div className="p-4 bg-white">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {group.items.map((item, iIdx) => (
                          <div key={iIdx} className="flex items-center p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                            <span className="w-2 h-2 rounded-full bg-gray-300 mr-2 flex-shrink-0"></span>
                            <EditableItem
                                id={`ITEM-${gIdx}-${iIdx}`}
                                value={item}
                                onSave={(val) => updateItemInGroup(gIdx, iIdx, val)}
                                onDelete={() => removeItemFromGroup(gIdx, iIdx)}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Add Item Input */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={`+ Adicionar item em ${group.name}...`}
                          className="flex-1 text-sm px-3 py-1.5 border border-gray-200 rounded focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                          onKeyDown={(e) => {
                            if(e.key === 'Enter') {
                                addItemToGroup(gIdx, e.currentTarget.value);
                                e.currentTarget.value = '';
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {localGroups.length === 0 && (
                    <div className="text-center p-10 text-gray-400 bg-white rounded border border-dashed border-gray-300">
                        Nenhum grupo de despesa criado. Use o campo acima para começar.
                    </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end gap-3 z-20">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 font-medium rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSaveAll} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2 transition-transform active:scale-95">
            <Save size={18} />
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;