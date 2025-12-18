
import React, { useState, useEffect } from 'react';
import { X, Save, CheckSquare, Square, Info } from 'lucide-react';
import type { CategoryStructure, ProjectionSettings } from './types';

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
      setLocalNeeds(localNeeds.filter((i: string) => i !== item));
    } else {
      setLocalNeeds([...localNeeds, item]);
    }
  };

  const toggleGroup = (group: CategoryStructure) => {
    const allItems = group.items;
    const allSelected = allItems.every((i: string) => localNeeds.includes(i));
    if (allSelected) {
      setLocalNeeds(localNeeds.filter((i: string) => !allItems.includes(i)));
    } else {
      const newNeeds = new Set([...localNeeds, ...allItems]);
      setLocalNeeds(Array.from(newNeeds));
    }
  };

  const handleSave = () => {
    onSave({ needs_items: localNeeds });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Configurar Projeção</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-sm text-blue-800">
              <Info className="shrink-0" size={20} />
              <p>Selecione as <strong>Necessidades Básicas (50%)</strong>. O restante será <strong>Lazer (30%)</strong>.</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {expenseGroups.map(group => {
                 if (group.name === 'Dízimos e Ofertas') return null;
                 const allSelected = group.items.length > 0 && group.items.every((i: string) => localNeeds.includes(i));
                 return (
                    <div key={group.name} className="bg-white border rounded-lg overflow-hidden">
                       <div className="bg-gray-100 p-3 flex items-center justify-between cursor-pointer" onClick={() => toggleGroup(group)}>
                          <span className="font-bold">{group.name}</span>
                          {allSelected ? <CheckSquare className="text-blue-600" /> : <Square className="text-gray-400" />}
                       </div>
                       <div className="p-2 space-y-1">
                          {group.items.map(item => (
                                <div key={item} onClick={() => toggleItem(item)} className="flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-50">
                                   <span className="text-sm">{item}</span>
                                   {localNeeds.includes(item) ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} className="text-gray-300" />}
                                </div>
                          ))}
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>
        <div className="p-4 border-t bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 text-gray-600">Cancelar</button>
          <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow">Salvar</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectionConfigModal;
