import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Loader2, Sparkles, Plus, Minus } from 'lucide-react';
import type { Transaction, TransactionType, CategoryStructure } from '../types';
import { analyzeReceiptWithGemini } from '../services/geminiService';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: any) => Promise<void> | void;
  initialType?: TransactionType;
  fixedDescription?: string;
  fixedGroup?: string;
  editingTransaction?: Transaction | null;
  // Dynamic Categories
  incomeCategories: string[];
  expenseGroups: CategoryStructure[];
}

// Chave fornecida pelo usuário
const DEFAULT_GEMINI_KEY = 'AIzaSyA5rfmsVN3gUWg8-UUMe8xknqbLRaukB8U';

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
  
  // Amount is now a string to handle the mask (e.g., "1.200,50")
  const [amount, setAmount] = useState<string>(''); 
  const [isNegative, setIsNegative] = useState(false); // New state for sign

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [observation, setObservation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [geminiKey, setGeminiKey] = useState(DEFAULT_GEMINI_KEY);

  // --- Currency Mask Helpers ---
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrency = (value: string): number => {
    // Remove thousand separators (dots) and replace decimal separator (comma) with dot
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Get only digits
    const rawValue = e.target.value.replace(/\D/g, '');
    
    if (!rawValue) {
        setAmount('');
        return;
    }

    // Convert to float (divide by 100 to account for cents)
    const floatValue = parseInt(rawValue) / 100;
    
    // Format back to string
    setAmount(formatCurrency(floatValue));
  };

  // --- Initialization ---
  useEffect(() => {
    // Load key from storage if exists, otherwise keep default
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setGeminiKey(savedKey);

    if (isOpen) {
      setIsSubmitting(false);
      if (editingTransaction) {
        // Editing Mode - Populate fields
        setType(editingTransaction.type);
        setGroup(editingTransaction.group);
        setDescription(editingTransaction.description);
        
        // Format existing amount to mask (Absolute value)
        setAmount(formatCurrency(Math.abs(editingTransaction.amount)));
        setIsNegative(editingTransaction.amount < 0);
        
        // Ensure date is YYYY-MM-DD
        if (editingTransaction.date) {
            setDate(editingTransaction.date.split('T')[0]);
        } else {
            setDate(new Date().toISOString().split('T')[0]);
        }
        
        setObservation(editingTransaction.observation || '');
      } else {
        // New Mode - Reset fields
        setType(initialType);
        setAmount(''); // Empty for new
        setIsNegative(false); // Default positive
        setObservation('');
        setDate(new Date().toISOString().split('T')[0]);
        
        if (fixedDescription) {
          setDescription(fixedDescription);
        } else {
          setDescription('');
        }

        if (fixedGroup) {
          setGroup(fixedGroup);
        } else {
          // Defaults
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
  }, [isOpen, initialType, fixedDescription, fixedGroup, incomeCategories, expenseGroups, editingTransaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse the masked string back to a number
    const numericAmount = parseCurrency(amount);

    // Allow 0 or negative via isNegative flag
    if (isNaN(numericAmount)) {
        alert("Por favor, insira um valor válido.");
        return;
    }

    setIsSubmitting(true);

    // Apply sign
    const finalAmount = isNegative ? -Math.abs(numericAmount) : Math.abs(numericAmount);

    const payload = {
      type,
      group: type === 'INCOME' ? 'Receitas' : group,
      description,
      amount: finalAmount,
      date, // Ensure this state is used
      observation
    };
    
    console.log('[DEBUG Modal] Submit Form:', payload);

    try {
        // Pass ID back if editing to ensure update works
        if (editingTransaction) {
          await onSave({ ...payload, id: editingTransaction.id });
        } else {
          await onSave(payload);
        }
        onClose();
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Ocorreu um erro ao salvar o lançamento.");
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- AI Logic ---
  const handleCameraClick = () => {
    if (!geminiKey) {
        setShowApiKeyInput(true);
        return;
    }
    fileInputRef.current?.click();
  };

  const saveApiKey = () => {
      if (geminiKey.trim()) {
          localStorage.setItem('gemini_api_key', geminiKey.trim());
          setShowApiKeyInput(false);
          fileInputRef.current?.click();
      }
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
                  const data = await analyzeReceiptWithGemini(base64, geminiKey);
                  
                  if (data.date) setDate(data.date);
                  if (data.amount) {
                      setAmount(formatCurrency(Math.abs(data.amount)));
                      setIsNegative(data.amount < 0);
                  }
                  if (data.description) setDescription(data.description);
                  
                  // Try to match category hint
                  if (data.categoryHint && type === 'EXPENSE') {
                      setObservation(`IA Sugeriu: ${data.categoryHint}`);
                  }
              } catch (err) {
                  alert("Erro ao analisar imagem. Verifique a chave API.");
                  setShowApiKeyInput(true); // Maybe key is wrong
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

  // Derive available descriptions based on selected group
  const availableDescriptions = type === 'INCOME' 
    ? incomeCategories 
    : expenseGroups.find(g => g.name === group)?.items || [];

  const isSpecialType = type === 'BALANCE' || type === 'EXTRA';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden relative">
        
        {/* Loading Overlay */}
        {isAnalyzing && (
            <div className="absolute inset-0 bg-white bg-opacity-90 z-20 flex flex-col items-center justify-center text-indigo-600">
                <Loader2 size={48} className="animate-spin mb-2" />
                <p className="font-semibold animate-pulse">Lendo comprovante...</p>
            </div>
        )}

        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            {editingTransaction 
              ? 'Editar Lançamento' 
              : (fixedDescription ? `Lançar ${fixedDescription}` : `Nova ${type === 'INCOME' ? 'Receita' : 'Despesa'}`)}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* API Key Input Overlay - Only shown if key is missing or fails */}
        {showApiKeyInput && (
            <div className="bg-yellow-50 p-4 border-b border-yellow-200">
                <p className="text-sm text-yellow-800 mb-2 font-medium flex items-center gap-2">
                    <Sparkles size={16} /> Configurar IA (Gemini)
                </p>
                <p className="text-xs text-yellow-700 mb-2">
                    Para ler cupons, insira sua chave gratuita do Google AI Studio.
                </p>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="Cole sua API Key aqui..."
                        className="flex-1 px-2 py-1 text-sm border border-yellow-300 rounded"
                    />
                    <button onClick={saveApiKey} className="bg-yellow-600 text-white px-3 py-1 rounded text-sm font-bold">
                        Salvar
                    </button>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          
          {/* Header Buttons row */}
          {!fixedDescription && !editingTransaction && (
            <div className="flex gap-2 mb-4">
                <div className="flex bg-gray-100 p-1 rounded-lg flex-1">
                <button
                    type="button"
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${type === 'INCOME' ? 'bg-green-500 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
                    onClick={() => { setType('INCOME'); setGroup('Receitas'); }}
                >
                    Receita
                </button>
                <button
                    type="button"
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
                    onClick={() => { 
                    setType('EXPENSE'); 
                    if(expenseGroups.length > 0) {
                        setGroup(expenseGroups[0].name);
                        setDescription(expenseGroups[0].items[0] || '');
                    }
                    }}
                >
                    Despesa
                </button>
                </div>
                
                {/* Scan Button */}
                <button 
                    type="button"
                    onClick={handleCameraClick}
                    className="px-3 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 flex flex-col items-center justify-center"
                    title="Escanear Comprovante"
                >
                    <Camera size={20} />
                    <span className="text-[10px] font-bold">SCAN</span>
                </button>
                <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange}
                />
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Standard Category Selection (Only if not fixed) */}
            {!isSpecialType && !fixedDescription && (
              <>
                {type === 'EXPENSE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                    <select
                      value={group}
                      onChange={(e) => {
                        setGroup(e.target.value);
                        const newGroup = expenseGroups.find(g => g.name === e.target.value);
                        if (newGroup && newGroup.items.length > 0) {
                          setDescription(newGroup.items[0]);
                        } else {
                          setDescription('');
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {expenseGroups.map(g => (
                        <option key={g.name} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {type === 'INCOME' ? 'Fonte da Receita' : 'Item da Despesa'}
                  </label>
                  <div className="relative">
                    <select
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                    >
                      {availableDescriptions.map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                      <option value="custom">Outro (Digitar...)</option>
                    </select>
                  </div>
                  {description === 'custom' && (
                    <input 
                        type="text" 
                        placeholder="Digite a descrição"
                        className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        onChange={(e) => setDescription(e.target.value)}
                    />
                  )}
                </div>
              </>
            )}

            {/* If fixed description, just show it read-only or hidden */}
            {fixedDescription && (
               <div className="bg-gray-50 p-2 rounded border border-gray-200 text-center font-medium text-gray-700">
                  {fixedDescription}
               </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <div className="relative flex rounded-md shadow-sm">
                  {/* +/- Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsNegative(!isNegative)}
                    className={`inline-flex items-center px-3 rounded-l-md border border-r-0 text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10 ${
                        isNegative 
                        ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100' 
                        : 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                    }`}
                    title={isNegative ? "Valor Negativo (Débito)" : "Valor Positivo (Crédito)"}
                  >
                    {isNegative ? <Minus size={20} /> : <Plus size={20} />}
                  </button>
                  <input
                    type="tel"
                    required
                    placeholder="0,00"
                    value={amount}
                    onChange={handleAmountChange}
                    inputMode="numeric"
                    className={`block w-full flex-1 rounded-none rounded-r-md border px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-mono text-right ${
                         isNegative 
                         ? 'text-red-700 border-red-300 placeholder-red-300' 
                         : 'text-gray-900 border-gray-300'
                    }`}
                  />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação (Opcional)</label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg shadow transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {editingTransaction ? 'Atualizar Lançamento' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;