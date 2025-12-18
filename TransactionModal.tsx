
import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Loader2, Plus, Minus, Trash2, Calculator } from 'lucide-react';
import type { Transaction, TransactionType, CategoryStructure } from './types';
import { analyzeReceiptWithGemini } from './geminiService';

interface SplitLine {
  id: string;
  group: string;
  description: string;
  amount: number;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: any) => Promise<void> | void;
  initialType?: TransactionType;
  fixedDescription?: string;
  fixedGroup?: string;
  editingTransaction?: Transaction | null;
  incomeCategories: string[];
  expenseGroups: CategoryStructure[];
}

const TransactionModal: React.FC<TransactionModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialType = 'EXPENSE',
  fixedDescription,
  fixedGroup,
  editingTransaction,
  incomeCategories,
  expenseGroups
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [group, setGroup] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isCustomDescription, setIsCustomDescription] = useState(false);
  const [amount, setAmount] = useState<string>(''); 
  const [isNegative, setIsNegative] = useState(false);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [observation, setObservation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitLine[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrency = (value: string): number => {
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
        setAmount('');
        return;
    }
    const floatValue = parseInt(rawValue) / 100;
    setAmount(formatCurrency(floatValue));
  };

  const availableDescriptions = type === 'INCOME' 
    ? incomeCategories 
    : expenseGroups.find(g => g.name === group)?.items || [];

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setIsSplitMode(false);
      setSplits([]);

      if (editingTransaction) {
        setType(editingTransaction.type);
        setGroup(editingTransaction.group);
        
        // Verifica se a descrição está na lista pré-definida
        const currentGroupItems = editingTransaction.type === 'INCOME' 
            ? incomeCategories 
            : expenseGroups.find(g => g.name === editingTransaction.group)?.items || [];
        
        const isKnown = currentGroupItems.includes(editingTransaction.description);
        setIsCustomDescription(!isKnown);
        setDescription(editingTransaction.description);

        setAmount(formatCurrency(Math.abs(editingTransaction.amount)));
        setIsNegative(editingTransaction.amount < 0);
        if (editingTransaction.date) {
            setDate(editingTransaction.date.split('T')[0]);
        }
        setObservation(editingTransaction.observation || '');
      } else {
        setType(initialType);
        setAmount('');
        setIsNegative(initialType === 'EXPENSE'); // Sugere negativo se for despesa
        setObservation('');
        setDate(new Date().toISOString().split('T')[0]);
        setIsCustomDescription(false);
        
        if (fixedDescription) {
          setDescription(fixedDescription);
        } else {
          setDescription('');
        }

        if (fixedGroup) {
          setGroup(fixedGroup);
        } else {
          if (initialType === 'INCOME') {
            setGroup('Receitas');
            if (incomeCategories.length > 0 && !fixedDescription) setDescription(incomeCategories[0]);
          } else if (initialType === 'EXPENSE') {
            if (expenseGroups.length > 0) {
              setGroup(expenseGroups[0].name);
              if (expenseGroups[0].items.length > 0 && !fixedDescription) setDescription(expenseGroups[0].items[0]);
            }
          }
        }
      }
    }
  }, [isOpen, editingTransaction, initialType, fixedDescription, fixedGroup]);

  const handleStartSplit = () => {
    const totalVal = parseCurrency(amount);
    if (isNaN(totalVal) || totalVal <= 0) {
      alert("Defina um valor total antes de dividir.");
      return;
    }
    setIsSplitMode(true);
    setSplits([
      { 
        id: Math.random().toString(36).substr(2, 9), 
        group: type === 'INCOME' ? 'Receitas' : group, 
        description: description, 
        amount: totalVal 
      }
    ]);
  };

  const addSplitLine = () => {
    const totalVal = parseCurrency(amount);
    const currentSum = splits.reduce((acc, s) => acc + s.amount, 0);
    const remaining = Math.max(0, totalVal - currentSum);

    setSplits([...splits, { 
      id: Math.random().toString(36).substr(2, 9), 
      group: expenseGroups[0]?.name || '', 
      description: expenseGroups[0]?.items[0] || '', 
      amount: remaining 
    }]);
  };

  const removeSplitLine = (id: string) => {
    setSplits(splits.filter(s => s.id !== id));
  };

  const updateSplitLine = (id: string, field: keyof SplitLine, value: any) => {
    setSplits(splits.map(s => {
      if (s.id !== id) return s;
      if (field === 'group' && type === 'EXPENSE') {
          const newGroup = expenseGroups.find(g => g.name === value);
          return { ...s, group: value, description: newGroup?.items[0] || '' };
      }
      return { ...s, [field]: value };
    }));
  };

  const currentSplitsTotal = splits.reduce((acc, s) => acc + s.amount, 0);
  const totalToSplit = parseCurrency(amount);
  const splitDifference = totalToSplit - currentSplitsTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseCurrency(amount);

    if (isNaN(numericAmount)) {
        alert("Por favor, insira um valor válido.");
        return;
    }

    if (isSplitMode) {
      if (Math.abs(splitDifference) > 0.01) {
        alert(`A soma das divisões deve ser igual ao valor total.`);
        return;
      }
    }

    setIsSubmitting(true);
    const finalAmount = isNegative ? -Math.abs(numericAmount) : Math.abs(numericAmount);

    try {
        if (isSplitMode) {
            await onSave({
              isSplit: true,
              originalId: editingTransaction?.id,
              date,
              type,
              splits: splits.map(s => ({
                ...s,
                amount: isNegative ? -Math.abs(s.amount) : Math.abs(s.amount),
                date,
                type
              }))
            });
        } else {
            const payload = {
              type,
              group: type === 'INCOME' ? 'Receitas' : group,
              description,
              amount: finalAmount,
              date,
              observation
            };
            
            if (editingTransaction) {
              await onSave({ ...payload, id: editingTransaction.id });
            } else {
              await onSave(payload);
            }
        }
        onClose();
    } catch (error) {
        console.error("Erro ao salvar:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsAnalyzing(true);
      try {
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              try {
                  const data = await analyzeReceiptWithGemini(base64);
                  if (data.date) setDate(data.date);
                  if (data.amount) {
                      setAmount(formatCurrency(Math.abs(data.amount)));
                      setIsNegative(data.amount < 0);
                  }
                  if (data.description) setDescription(data.description);
              } catch (err) {
                  alert("Erro ao analisar imagem.");
              } finally {
                  setIsAnalyzing(false);
              }
          };
          reader.readAsDataURL(file);
      } catch (error) {
          console.error(error);
          setIsAnalyzing(false);
      }
  };

  if (!isOpen) return null;

  const isSpecialType = type === 'BALANCE' || type === 'EXTRA';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden relative flex flex-col max-h-[90vh]">
        
        {isAnalyzing && (
            <div className="absolute inset-0 bg-white bg-opacity-90 z-20 flex flex-col items-center justify-center text-indigo-600">
                <Loader2 size={48} className="animate-spin mb-2" />
                <p className="font-semibold animate-pulse">IA lendo comprovante...</p>
            </div>
        )}

        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800">
            {isSplitMode ? 'Dividir Lançamento' : (editingTransaction ? 'Editar Lançamento' : (fixedDescription ? `Lançar ${fixedDescription}` : `Novo Lançamento`))}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {!fixedDescription && !editingTransaction && !isSplitMode && (
            <div className="flex gap-2">
                <div className="flex bg-gray-100 p-1 rounded-lg flex-1">
                  <button type="button" className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${type === 'INCOME' ? 'bg-green-500 text-white shadow' : 'text-gray-600'}`} onClick={() => { setType('INCOME'); setGroup('Receitas'); }}>Receita</button>
                  <button type="button" className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow' : 'text-gray-600'}`} onClick={() => { setType('EXPENSE'); if(expenseGroups.length > 0) { setGroup(expenseGroups[0].name); setDescription(expenseGroups[0].items[0] || ''); } }}>Despesa</button>
                </div>
                <button type="button" onClick={handleCameraClick} className="px-3 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex flex-col items-center justify-center"><Camera size={20} /><span className="text-[10px] font-bold">SCAN</span></button>
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Total (R$)</label>
              <div className="relative flex rounded-md shadow-sm">
                  <button type="button" onClick={() => setIsNegative(!isNegative)} className={`inline-flex items-center px-3 rounded-l-md border border-r-0 text-sm font-medium transition-colors ${isNegative ? 'bg-red-50 text-red-700 border-red-300' : 'bg-green-50 text-green-700 border-green-300'}`}>
                    {isNegative ? <Minus size={20} /> : <Plus size={20} />}
                  </button>
                  <input type="tel" required placeholder="0,00" value={amount} onChange={handleAmountChange} readOnly={isSplitMode} className={`block w-full flex-1 rounded-none rounded-r-md border px-3 py-2 text-lg font-mono text-right ${isSplitMode ? 'bg-gray-100 text-gray-500' : (isNegative ? 'text-red-700 border-red-300' : 'text-gray-900 border-gray-300')}`} />
              </div>
            </div>

            {!isSplitMode ? (
              <>
                {!isSpecialType && !fixedDescription && (
                  <>
                    {type === 'EXPENSE' && (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Grupo</label>
                        <select value={group} onChange={(e) => { setGroup(e.target.value); const newGroup = expenseGroups.find(g => g.name === e.target.value); setDescription(newGroup?.items[0] || ''); }} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500">
                          {expenseGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{type === 'INCOME' ? 'Fonte' : 'Item'}</label>
                      <select 
                        value={isCustomDescription ? 'custom' : description} 
                        onChange={(e) => {
                            if (e.target.value === 'custom') {
                                setIsCustomDescription(true);
                            } else {
                                setIsCustomDescription(false);
                                setDescription(e.target.value);
                            }
                        }} 
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        {availableDescriptions.map(item => <option key={item} value={item}>{item}</option>)}
                        <option value="custom">Outro (Digitar...)</option>
                      </select>
                      {isCustomDescription && (
                        <input 
                            type="text" 
                            autoFocus
                            placeholder="Descreva o lançamento..." 
                            value={description === 'custom' ? '' : description}
                            className="mt-2 w-full px-3 py-2 border rounded-lg border-indigo-300 bg-indigo-50" 
                            onChange={(e) => setDescription(e.target.value)} 
                        />
                      )}
                    </div>
                  </>
                )}
                {fixedDescription && <div className="bg-indigo-50 p-3 rounded-lg text-center font-bold text-indigo-800 border border-indigo-100">{fixedDescription}</div>}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Observação</label>
                  <textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                
                {editingTransaction && (
                  <button type="button" onClick={handleStartSplit} className="w-full py-2 px-4 border-2 border-dashed border-indigo-200 text-indigo-500 rounded-lg hover:bg-indigo-50 font-bold flex items-center justify-center gap-2 transition-colors">
                    <Calculator size={18} />
                    Dividir lançamento em várias categorias
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-4 pt-2 border-t">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-700 text-sm uppercase">Detalhamento da Divisão</h3>
                  <div className={`text-xs font-mono font-bold px-2 py-1 rounded ${Math.abs(splitDifference) < 0.01 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    Restante: {formatCurrency(splitDifference)}
                  </div>
                </div>

                <div className="space-y-3">
                  {splits.map((s) => (
                    <div key={s.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2 relative">
                      <button type="button" onClick={() => removeSplitLine(s.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Grupo</label>
                          <select value={s.group} onChange={(e) => updateSplitLine(s.id, 'group', e.target.value)} className="w-full p-1 text-xs border rounded">
                             {type === 'INCOME' ? <option value="Receitas">Receitas</option> : expenseGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Categoria</label>
                          <select value={s.description} onChange={(e) => updateSplitLine(s.id, 'description', e.target.value)} className="w-full p-1 text-xs border rounded">
                             {(type === 'INCOME' ? incomeCategories : (expenseGroups.find(g => g.name === s.group)?.items || [])).map(item => <option key={item} value={item}>{item}</option>)}
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Valor da Parte</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={s.amount} 
                          onChange={(e) => updateSplitLine(s.id, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full p-1 text-sm border rounded font-mono" 
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={addSplitLine} className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold flex items-center justify-center gap-1 hover:bg-gray-200">
                  <Plus size={16} /> Adicionar Parte
                </button>

                <button type="button" onClick={() => setIsSplitMode(false)} className="w-full py-1 text-xs text-indigo-600 font-medium hover:underline">
                  Cancelar divisão
                </button>
              </div>
            )}
          </div>
        </form>

        <div className="p-4 border-t bg-gray-50 shrink-0">
          <button type="submit" disabled={isSubmitting} onClick={handleSubmit} className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2">
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            {isSplitMode ? 'Confirmar Divisão' : (editingTransaction ? 'Salvar Alterações' : 'Salvar Lançamento')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionModal;
