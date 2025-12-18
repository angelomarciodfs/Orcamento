
import React, { useState, useMemo } from 'react';
import { X, Search, Calendar, Tag, Info, Edit2, Trash2, ArrowRight } from 'lucide-react';
import type { Transaction } from './types';

interface SearchTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}

const SearchTransactionsModal: React.FC<SearchTransactionsModalProps> = ({
  isOpen, onClose, transactions, onEdit, onDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const results = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    
    return transactions.filter(t => 
      t.description.toLowerCase().includes(term) || 
      (t.observation && t.observation.toLowerCase().includes(term)) ||
      (t.group && t.group.toLowerCase().includes(term))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [searchTerm, transactions]);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden border border-gray-200">
        
        {/* Header com Input de Busca */}
        <div className="p-5 border-b bg-gray-50 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Search size={22} className="text-indigo-600" />
              Localizar Lançamento
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 transition-colors">
              <X size={24} />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              autoFocus
              placeholder="Pesquise por descrição, grupo ou histórico importado..."
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-indigo-100 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all text-gray-700 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
          {searchTerm.length < 2 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <Search size={48} className="opacity-20" />
              <p className="text-sm italic">Digite pelo menos 2 caracteres para pesquisar...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase ml-1">Encontrados {results.length} registros</p>
              {results.map(t => (
                <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all group">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${t.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {t.type === 'INCOME' ? 'Receita' : 'Despesa'}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase">
                          <Tag size={10} /> {t.group}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase">
                          <Calendar size={10} /> {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                      </div>
                      
                      <h4 className="font-bold text-gray-800 truncate">{t.description}</h4>
                      
                      {t.observation && (
                        <div className="mt-2 flex items-start gap-1.5 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-gray-500 italic leading-relaxed break-words">
                            {t.observation}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className={`text-lg font-mono font-bold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(t.amount)}
                      </div>
                      <div className="flex gap-1 justify-end mt-2">
                        <button 
                          onClick={() => onEdit(t)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => { if(confirm('Excluir este lançamento permanentemente?')) onDelete(t.id); }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <Search size={48} className="opacity-20" />
              <p className="text-sm italic text-center">Nenhum lançamento encontrado para "{searchTerm}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-all flex items-center gap-2"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchTransactionsModal;
