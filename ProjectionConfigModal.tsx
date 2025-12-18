import React, { useState, useEffect } from 'react';
import { X, Save, CheckSquare, Square, Info } from 'lucide-react';
import type { CategoryStructure, ProjectionSettings } from '../../types';

interface ProjectionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseGroups: CategoryStructure[];
  currentSettings: ProjectionSettings;
  onSave: (settings: ProjectionSettings) => void;
}

const ProjectionConfigModal: React.FC<ProjectionConfigModalProps> = ({
  isOpen, onClose, expenseGroups, currentSettings, onSave
}) => {
  const [localNeeds, setLocalNeeds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLocalNeeds([...currentSettings.needs_items]);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const toggleItem = (item: string) => {
    if (localNeeds.includes(item)) {
      setLocalNeeds(localNeeds.filter(i => i !== item));
    } else {
      setLocalNeeds([...localNeeds, item]);
    }
  };

  const toggleGroup = (group: CategoryStructure) => {
    const allItems = group.items;
    const allSelected = allItems.every(i => localNeeds.includes(i));

    if (allSelected) {
      // Unselect all
      setLocalNeeds(localNeeds.filter(i => !allItems.includes(i)));
    } else {
      // Select all (merge unique)
      const newNeeds = new Set([...localNeeds, ...allItems]);
      setLocalNeeds(Array.from(newNeeds));
    }
  };

  const handleSave = () => {
    onSave({ needs_items: localNeeds });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden">

        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Configurar Projeção (50-30-20)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Selecione o que são <span className="font-bold text-blue-600">Necessidades Básicas (50%)</span>.
              <br/>
              O que não for marcado será considerado <span className="font-bold text-purple-600">Lazer/Desejos (30%)</span>.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 space-y-6">

           <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex gap-3 text-sm text-blue-800">
              <Info className="flex-shrink-0" size={20} />
              <p>
                 Itens como <strong>Dízimos</strong> e <strong>Investimentos</strong> são calculados separadamente.
                 Aqui você define apenas a divisão entre contas fixas/essenciais e estilo de vida.
              </p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {expenseGroups.map(group => {
                 if (group.name === 'Dízimos e Ofertas') return null; // Skip Dízimos

                 const allSelected = group.items.length > 0 && group.items.every(i => localNeeds.includes(i));
                 const someSelected = group.items.some(i => localNeeds.includes(i));

                 return (
                    <div key={group.name} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                       <div
                          className="bg-gray-100 p-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
                          onClick={() => toggleGroup(group)}
                       >
                          <span className="font-bold text-gray-700">{group.name}</span>
                          <div className={`p-1 rounded ${allSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                             {allSelected ? <CheckSquare size={20} /> : (someSelected ? <div className="w-5 h-5 bg-blue-200 rounded flex items-center justify-center text-xs font-bold text-blue-700">-</div> : <Square size={20} />)}
                          </div>
                       </div>
                       <div className="p-2 space-y-1">
                          {group.items.map(item => {
                             const isSelected = localNeeds.includes(item);
                             return (
                                <div
                                  key={item}
                                  onClick={() => toggleItem(item)}
                                  className={`flex items-center justify-between p-2 rounded cursor-pointer text-sm ${isSelected ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50 text-gray-600'}`}
                                >
                                   <span>{item}</span>
                                   {isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} className="text-gray-300" />}
                                </div>
                             )
                          })}
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>

        <div className="p-4 border-t bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-100 font-medium rounded-lg">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow flex items-center gap-2">
            <Save size={18} />
            Salvar Configuração
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectionConfigModal;