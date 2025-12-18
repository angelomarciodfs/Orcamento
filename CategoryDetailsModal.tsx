
import React from 'react';
import { X, Edit2, Trash2 } from 'lucide-react';
import type { Transaction } from './types';

interface CategoryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}

const CategoryDetailsModal: React.FC<CategoryDetailsModalProps> = ({
  isOpen, onClose, categoryName, transactions, onDelete, onEdit
}) => {
  if (!isOpen) return null;

  const total = transactions.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{categoryName}</h2>
            <p className="text-xs text-gray-500">{transactions.length} lançamentos neste mês</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 bg-white">
          {transactions.length === 0 ? (
            <p className="text-center text-gray-400 py-4">Nenhum lançamento encontrado.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map(t => (
                <div key={t.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors group">
                  <div>
                    <div className="font-medium text-gray-800">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                        {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        {t.observation && <span className="ml-1 italic">- {t.observation}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit2 size={16} /></button>
                    <button onClick={() => { if(confirm('Excluir?')) onDelete(t.id); }} className="p-2 text-red-600 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <span className="font-semibold text-gray-600 uppercase text-xs">Total</span>
            <span className="font-bold text-xl text-gray-800">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
        </div>
      </div>
    </div>
  );
};

export default CategoryDetailsModal;
