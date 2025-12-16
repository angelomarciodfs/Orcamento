import React, { useState, useRef } from 'react';
import { X, Upload, Check, AlertCircle, AlertTriangle, Wand2 } from 'lucide-react';
import type { ImportItem, CategoryStructure, TransactionType, Transaction } from '../types';
import * as XLSX from 'xlsx';

interface BankImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ImportItem[]) => void;
  expenseGroups: CategoryStructure[];
  incomeCategories: string[];
  existingTransactions: Transaction[];
}

const BankImportModal: React.FC<BankImportModalProps> = ({
  isOpen, onClose, onImport, expenseGroups, incomeCategories, existingTransactions
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [step, setStep] = useState<'UPLOAD' | 'CLASSIFY'>('UPLOAD');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // --- Process Items (Duplicate Check + Smart Classification) ---
  const processImportedItems = (items: ImportItem[]): ImportItem[] => {
      return items.map(item => {
          const itemDescLower = item.description.toLowerCase().trim();

          // 1. Check for Exact Duplicates (Already Imported)
          const existingMatch = existingTransactions.find(ex => {
             const sameDate = ex.date === item.date;
             const sameAmount = Math.abs(ex.amount - item.amount) < 0.01; 
             
             // Check observation pattern "Importado: DESCRIÇÃO_BANCO"
             const isImportedSameDesc = ex.observation?.toLowerCase().includes(itemDescLower);
             // Or check if user manually named the description same as bank
             const isSameDesc = ex.description.toLowerCase().trim() === itemDescLower;

             return sameDate && sameAmount && (isImportedSameDesc || isSameDesc);
          });

          if (existingMatch) {
              return {
                  ...item,
                  isPossibleDuplicate: true,
                  isChecked: false,
                  selectedGroup: existingMatch.group,
                  selectedCategory: existingMatch.description
              };
          }

          // 2. Smart Classification (History Learning)
          // If not a duplicate, look for ANY previous transaction that came from this bank description
          const historyMatch = existingTransactions.find(ex => {
              // Matches if the historical transaction's observation contains this bank description
              // e.g. History Obs: "Importado: UBER DO BRASIL" vs Current Desc: "UBER DO BRASIL"
              return ex.observation?.toLowerCase().includes(itemDescLower) || 
                     ex.description.toLowerCase() === itemDescLower;
          });

          if (historyMatch) {
              return {
                  ...item,
                  isPossibleDuplicate: false,
                  isChecked: false, // Default unchecked per user request
                  selectedGroup: historyMatch.group,
                  selectedCategory: historyMatch.description
              };
          }

          // 3. New Item, No History
          return {
              ...item,
              isPossibleDuplicate: false,
              isChecked: false, // Default unchecked
              selectedCategory: '',
              selectedGroup: item.type === 'EXPENSE' ? (expenseGroups[0]?.name || '') : 'Receitas'
          };
      });
  };

  // --- Date Parsing Utils ---
  const parseAnyDate = (value: any): string | null => {
    if (value === undefined || value === null) return null;

    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        return value.toISOString().split('T')[0];
    }

    if (typeof value === 'number') {
         if (value > 20000) {
             const dateObj = new Date(Math.round((value - 25569) * 86400 * 1000));
             dateObj.setUTCHours(12); 
             return dateObj.toISOString().split('T')[0];
         }
         return null; 
    }

    let str = String(value).trim();
    if (!str) return null;

    str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');

    const matchBR = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (matchBR) {
        const day = matchBR[1].padStart(2, '0');
        const month = matchBR[2].padStart(2, '0');
        let year = matchBR[3];
        if (year.length === 2) year = `20${year}`;
        return `${year}-${month}-${day}`;
    }

    const matchISO = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (matchISO) {
        return `${matchISO[1]}-${matchISO[2].padStart(2,'0')}-${matchISO[3].padStart(2,'0')}`;
    }

    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = event.target?.result;
            if (data) {
                parseExcel(data as ArrayBuffer);
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    else {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseCSV(text);
        };
        reader.readAsText(file, 'ISO-8859-1');
    }
  };

  const parseExcel = (buffer: ArrayBuffer) => {
    try {
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        const parsed: ImportItem[] = [];
        let idCounter = 0;

        let headerRowIndex = -1;
        // Added 'details' to the mapping
        let colMap = { date: -1, desc: -1, details: -1, credit: -1, debit: -1, value: -1 };

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i].map(cell => String(cell).toLowerCase().trim());
            
            // Check for Date column to identify header row
            if (row.some(c => c.includes('data') || c.includes('dt.'))) {
                // Check for description/value to confirm it's the header
                if (row.some(c => c.includes('desc') || c.includes('hist') || c.includes('lançamento') || c.includes('valor') || c.includes('crédito'))) {
                    headerRowIndex = i;
                    colMap.date = row.findIndex(c => c.includes('data') || c.includes('dt.'));
                    
                    // Enhanced Description Detection (BB uses "Lançamento")
                    colMap.desc = row.findIndex(c => c.includes('desc') || c.includes('hist') || c.includes('lançamento') || c.includes('lancamento'));
                    
                    // Added Details Detection (BB uses "Detalhes")
                    colMap.details = row.findIndex(c => c.includes('detalhes') || c.includes('informações'));
                    
                    colMap.credit = row.findIndex(c => c.includes('crédito') || c.includes('credito'));
                    colMap.debit = row.findIndex(c => c.includes('débito') || c.includes('debito'));
                    colMap.value = row.findIndex(c => c === 'valor' || c.includes('saldo') === false && c.includes('valor'));
                    break;
                }
            }
        }

        // Fallback for when headers are not found or ambiguous
        if (headerRowIndex === -1) {
            colMap = { date: 0, desc: 1, details: 2, credit: -1, debit: -1, value: 3 }; 
        }

        const startRow = headerRowIndex === -1 ? 0 : headerRowIndex + 1;

        for (let i = startRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const rawDate = row[colMap.date];
            const dateIso = parseAnyDate(rawDate);
            if (!dateIso) continue;

            // --- Construction of Description (Concatenating Lançamento + Detalhes if available) ---
            let description = 'Sem descrição';
            
            const mainDesc = (colMap.desc !== -1 && row[colMap.desc]) ? String(row[colMap.desc]).trim() : '';
            const detailDesc = (colMap.details !== -1 && row[colMap.details]) ? String(row[colMap.details]).trim() : '';

            // Filter out system terms if they appear in data rows
            if (mainDesc.toLowerCase().includes('saldo anterior') || mainDesc.toLowerCase().includes('sdo cta')) continue;

            if (mainDesc && detailDesc) {
                // Example: "Pix Enviado - Padaria do João"
                description = `${mainDesc} - ${detailDesc}`;
            } else if (mainDesc) {
                description = mainDesc;
            } else if (detailDesc) {
                description = detailDesc;
            } else {
                 // Fallback: try to find a string that isn't the date
                 const possibleDesc = row.find((cell, idx) => idx !== colMap.date && typeof cell === 'string' && cell.length > 5);
                 if (possibleDesc) description = possibleDesc;
            }

            let amount = 0;
            let type: TransactionType = 'EXPENSE';

            if (colMap.credit !== -1 && colMap.debit !== -1) {
                const creditVal = row[colMap.credit];
                const debitVal = row[colMap.debit];

                if (creditVal) {
                    amount = typeof creditVal === 'number' ? creditVal : parseFloat(String(creditVal).replace(/\./g, '').replace(',', '.'));
                    type = 'INCOME';
                } else if (debitVal) {
                    amount = typeof debitVal === 'number' ? debitVal : parseFloat(String(debitVal).replace(/\./g, '').replace(',', '.'));
                    amount = Math.abs(amount);
                    type = 'EXPENSE';
                }
            } else {
                let valRaw = colMap.value !== -1 ? row[colMap.value] : null;
                if (valRaw === undefined || valRaw === null) {
                    valRaw = row.find((cell, idx) => idx !== colMap.date && typeof cell === 'number');
                }
                if (valRaw !== undefined && valRaw !== null) {
                    let val = typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw).replace(/\./g, '').replace(',', '.'));
                    if (!isNaN(val)) {
                         if (val < 0) {
                            amount = Math.abs(val);
                            type = 'EXPENSE';
                         } else {
                            amount = val;
                            type = 'INCOME';
                         }
                    }
                }
            }

            if (amount > 0) {
                 parsed.push({
                    id: `import-xls-${Date.now()}-${idCounter++}`,
                    date: dateIso,
                    description: description,
                    amount: amount,
                    type: type,
                    selectedCategory: '',
                    selectedGroup: '', // Will be filled by processItems
                    isChecked: false // User requested default unchecked
                });
            }
        }

        if (parsed.length > 0) {
            const processedItems = processImportedItems(parsed);
            setImportItems(processedItems);
            setStep('CLASSIFY');
            setError(null);
        } else {
            setError("Nenhuma transação válida encontrada. Verifique se o arquivo possui colunas de Data e Valor.");
        }

    } catch (err) {
        console.error(err);
        setError("Erro ao ler arquivo Excel.");
    }
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      const parsed: ImportItem[] = [];
      let idCounter = 0;

      lines.forEach(line => {
        if (!line.trim() || line.toLowerCase().includes('saldo')) return;
        
        const cleanLine = line.replace(/"/g, '');
        const separator = cleanLine.includes(';') ? ';' : ',';
        const parts = cleanLine.split(separator);

        let dateIso: string | null = null;
        let dateIndex = -1;

        for (let i = 0; i < parts.length; i++) {
            const d = parseAnyDate(parts[i]);
            if (d) {
                dateIso = d;
                dateIndex = i;
                break;
            }
        }

        if (dateIso) {
            let amount = 0;
            let type: TransactionType = 'EXPENSE';
            let description = '';

            const valuePartIndex = parts.findIndex((p, idx) => {
                if (idx <= dateIndex) return false;
                return /^-?[\d\.]+,?\d{0,2}$/.test(p.trim());
            });

            if (valuePartIndex !== -1) {
                const valStr = parts[valuePartIndex].trim();
                const valClean = valStr.replace(/\./g, '').replace(',', '.');
                const valNum = parseFloat(valClean);
                
                if (!isNaN(valNum)) {
                    amount = Math.abs(valNum);
                    type = valNum < 0 ? 'EXPENSE' : 'INCOME';

                    const descParts = parts.slice(dateIndex + 1, valuePartIndex);
                    if (descParts.length > 0) {
                        description = descParts.join(' ');
                    } else {
                        if (valuePartIndex - 1 !== dateIndex) {
                            description = parts[valuePartIndex - 1];
                        } else {
                            description = parts.find((p, idx) => idx !== dateIndex && idx !== valuePartIndex && p.length > 2) || 'Sem descrição';
                        }
                    }
                }
            }

            if (amount > 0) {
                parsed.push({
                    id: `import-csv-${Date.now()}-${idCounter++}`,
                    date: dateIso,
                    description: description.trim() || 'Importado',
                    amount: amount,
                    type: type,
                    selectedCategory: '',
                    selectedGroup: '',
                    isChecked: false // Default unchecked
                });
            }
        }
      });

      if (parsed.length === 0) {
          setError("Não foi possível ler as transações.");
      } else {
          const processedItems = processImportedItems(parsed);
          setImportItems(processedItems);
          setStep('CLASSIFY');
          setError(null);
      }
    } catch (err) {
        setError("Erro ao processar arquivo.");
        console.error(err);
    }
  };

  const handleCategoryChange = (id: string, group: string, category: string) => {
    setImportItems(prev => prev.map(p => {
        if (p.id !== id) return p;
        return { 
            ...p, 
            selectedGroup: group, 
            selectedCategory: category,
            // Automatically check the item if a valid category is selected
            isChecked: category ? true : p.isChecked 
        };
    }));
  };

  const handleToggle = (id: string) => {
    setImportItems(prev => prev.map(p => {
        if (p.id !== id) return p;
        return { ...p, isChecked: !p.isChecked };
    }));
  };

  const handleToggleAll = (checked: boolean) => {
      setImportItems(prev => prev.map(p => ({
          ...p,
          isChecked: checked
      })));
  };

  const handleConfirmImport = () => {
    const toImport = importItems.filter(i => i.isChecked && i.selectedCategory);
    if (toImport.length === 0) {
        setError("Selecione os itens desejados e defina a categoria.");
        return;
    }
    onImport(toImport);
    onClose();
    setImportItems([]);
    setStep('UPLOAD');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        
        {/* Header - Fixed */}
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Importar Extrato Bancário</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Content - Flexible */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {error && (
                <div className="p-4 pb-0 shrink-0">
                    <div className="bg-red-50 text-red-700 p-3 rounded flex items-center gap-2">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                </div>
            )}

            {step === 'UPLOAD' ? (
                <div className="p-4 flex-1 overflow-auto">
                    <div className="h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                         onClick={() => fileInputRef.current?.click()}>
                        <Upload size={48} className="text-gray-400 mb-2" />
                        <p className="text-gray-600 font-medium">Clique para selecionar o arquivo</p>
                        <p className="text-xs text-gray-400 mt-1">Suporta: .XLS, .XLSX (Santander/BB) e .CSV</p>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".csv,.txt,.xls,.xlsx"
                            onChange={handleFileUpload}
                        />
                    </div>
                </div>
            ) : (
                <>
                    {/* Fixed Info Banner - Outside Scroll View */}
                    <div className="p-4 pb-0 shrink-0 bg-white z-10">
                         <div className="bg-blue-50 text-blue-800 p-3 text-xs rounded border border-blue-200 flex flex-col gap-1 shadow-sm">
                            <span className="flex items-center gap-2 font-medium"><AlertTriangle size={14}/> Linhas amarelas/laranjas: Já importadas anteriormente.</span>
                            <span className="flex items-center gap-2 font-medium"><Wand2 size={14}/> Categorias preenchidas automaticamente baseadas no seu histórico.</span>
                            <span>* Selecione a categoria para marcar automaticamente, ou marque a caixa de seleção.</span>
                        </div>
                    </div>

                    {/* Scrollable Table Area */}
                    <div className="flex-1 overflow-auto p-4 pt-2">
                        <table className="w-full text-sm border-collapse min-w-[600px]">
                            {/* Sticky Header inside scroll container */}
                            <thead className="text-gray-700">
                                <tr>
                                    <th className="p-2 w-10 text-center border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">
                                        <input type="checkbox" 
                                            checked={importItems.length > 0 && importItems.every(i => i.isChecked)}
                                            onChange={(e) => handleToggleAll(e.target.checked)} 
                                            title="Marcar/Desmarcar Todos"
                                        />
                                    </th>
                                    <th className="p-2 text-left border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">Data</th>
                                    <th className="p-2 text-left border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">Descrição (Banco)</th>
                                    <th className="p-2 text-right border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">Valor</th>
                                    <th className="p-2 text-left border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">Classificação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {importItems.map(item => (
                                    <tr 
                                        key={item.id} 
                                        className={`
                                            transition-colors border-b border-gray-100
                                            ${item.isPossibleDuplicate 
                                                ? 'bg-amber-200 hover:bg-amber-300 text-amber-900' // Darker, distinct orange/amber for duplicates
                                                : 'bg-white hover:bg-gray-50'
                                            } 
                                            ${!item.isChecked 
                                                ? (item.isPossibleDuplicate ? 'opacity-85' : 'opacity-60 grayscale-[0.5]') // Less fade for duplicates so color pops
                                                : ''
                                            }
                                        `}
                                    >
                                        <td className="p-2 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={item.isChecked}
                                                onChange={() => handleToggle(item.id)}
                                            />
                                        </td>
                                        <td className="p-2 w-24 whitespace-nowrap">
                                            {item.date ? new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Inválida'}
                                        </td>
                                        <td className="p-2 font-medium">
                                            <div className="flex items-center gap-2">
                                                {item.description}
                                                {item.isPossibleDuplicate && (
                                                    <span title="Este item parece já ter sido importado" className="text-amber-800 cursor-help">
                                                        <AlertTriangle size={14} />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`p-2 text-right font-mono whitespace-nowrap ${item.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                                            {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="p-2 w-64">
                                            <select 
                                                className={`w-full border rounded p-1.5 text-sm transition-colors ${!item.selectedCategory && item.isChecked ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200'} cursor-pointer text-gray-800`}
                                                value={item.selectedCategory}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (item.type === 'INCOME') {
                                                        handleCategoryChange(item.id, 'Receitas', val);
                                                    } else {
                                                        const groupName = expenseGroups.find(g => g.items.includes(val))?.name || '';
                                                        handleCategoryChange(item.id, groupName, val);
                                                    }
                                                }}
                                            >
                                                <option value="">Selecione...</option>
                                                {item.type === 'INCOME' ? (
                                                    <optgroup label="Receitas">
                                                        {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </optgroup>
                                                ) : (
                                                    expenseGroups.map(group => (
                                                        <optgroup key={group.name} label={group.name}>
                                                            {group.items.map(sub => (
                                                                <option key={sub} value={sub}>{sub}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))
                                                )}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>

        {/* Footer - Fixed */}
        <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 shrink-0">
            {step === 'CLASSIFY' && (
                <button 
                    onClick={() => { setImportItems([]); setStep('UPLOAD'); }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-medium"
                >
                    Voltar
                </button>
            )}
            {step === 'CLASSIFY' ? (
                 <button 
                 onClick={handleConfirmImport}
                 className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2 shadow-sm font-semibold"
                >
                 <Check size={18} />
                 Confirmar Importação ({importItems.filter(i => i.isChecked && i.selectedCategory).length})
                </button>
            ) : (
                <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-medium">
                    Cancelar
                </button>
            )}
        </div>

      </div>
    </div>
  );
};

export default BankImportModal;