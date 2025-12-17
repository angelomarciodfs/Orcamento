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
      
      const getCleanDescription = (fullDesc: string) => {
          const datePattern = /\d{2}\/\d{2}(?:\s\d{2}:\d{2})?/;
          const match = fullDesc.match(datePattern);
          
          if (match && match.index !== undefined) {
              const afterDate = fullDesc.substring(match.index + match[0].length);
              return afterDate.replace(/^[-\s]+/, '').toLowerCase().trim();
          }
          return fullDesc.toLowerCase().trim();
      };

      return items.map(item => {
          const itemDescLower = item.description.toLowerCase().trim();
          const itemCleaned = getCleanDescription(item.description);

          const existingMatch = existingTransactions.find(ex => {
             const sameDate = ex.date === item.date;
             const sameAmount = Math.abs(ex.amount - item.amount) < 0.01; 
             const isImportedSameDesc = ex.observation?.toLowerCase().includes(itemDescLower);
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

          const historyMatch = existingTransactions.find(ex => {
              if (!ex.group) return false;
              const historyDesc = ex.description.toLowerCase().trim();
              if (itemCleaned === historyDesc) return true;
              if (itemCleaned.includes(historyDesc) && historyDesc.length > 2) return true;
              if (historyDesc.includes(itemCleaned) && itemCleaned.length > 2) return true;
              const historyObs = ex.observation?.toLowerCase() || '';
              if (historyObs.includes(itemCleaned) && itemCleaned.length > 3) return true;
              return false;
          });

          if (historyMatch) {
              return {
                  ...item,
                  isPossibleDuplicate: false,
                  isChecked: false,
                  selectedGroup: historyMatch.group,
                  selectedCategory: historyMatch.description
              };
          }

          return {
              ...item,
              isPossibleDuplicate: false,
              isChecked: false,
              selectedCategory: '',
              selectedGroup: item.type === 'EXPENSE' ? (expenseGroups[0]?.name || '') : 'Receitas'
          };
      });
  };

  const parseAnyDate = (value: any): string | null => {
    if (value === undefined || value === null) return null;

    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        const iso = value.toISOString().split('T')[0];
        // Skip dummy card dates
        if (iso === '0001-01-01' || iso === '1899-12-30') return null;
        return iso;
    }

    if (typeof value === 'number') {
         if (value > 20000) {
             const dateObj = new Date(Math.round((value - 25569) * 86400 * 1000));
             dateObj.setUTCHours(12); 
             const iso = dateObj.toISOString().split('T')[0];
             if (iso === '0001-01-01') return null;
             return iso;
         }
         return null; 
    }

    let str = String(value).trim();
    if (!str || str.includes('01/01/0001')) return null;

    str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');

    const matchBR = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (matchBR) {
        const day = matchBR[1].padStart(2, '0');
        const month = matchBR[2].padStart(2, '0');
        let year = matchBR[3];
        if (year.length === 2) year = `20${year}`;
        if (year === '0001') return null;
        return `${year}-${month}-${day}`;
    }

    const matchISO = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (matchISO) {
        if (matchISO[1] === '0001') return null;
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
            if (data) parseExcel(data as ArrayBuffer);
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
        let colMap = { date: -1, desc: -1, details: -1, credit: -1, debit: -1, value: -1, valR: -1, valU: -1 };

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i].map(cell => String(cell).toLowerCase().trim());
            
            // Procura por cabeçalhos comuns (incluindo o padrão de fatura Valor (R$))
            if (row.some(c => c.includes('data') || c.includes('dt.'))) {
                if (row.some(c => c.includes('desc') || c.includes('hist') || c.includes('lançamento') || c.includes('valor'))) {
                    headerRowIndex = i;
                    colMap.date = row.findIndex(c => c.includes('data') || c.includes('dt.'));
                    colMap.desc = row.findIndex(c => c.includes('desc') || c.includes('hist') || c.includes('lançamento'));
                    colMap.details = row.findIndex(c => c.includes('detalhes'));
                    colMap.credit = row.findIndex(c => c.includes('crédito'));
                    colMap.debit = row.findIndex(c => c.includes('débito'));
                    colMap.value = row.findIndex(c => c === 'valor');
                    
                    // Colunas específicas de Fatura (R$ e US$)
                    colMap.valR = row.findIndex(c => c.includes('valor (r$)') || c.includes('valor r$'));
                    colMap.valU = row.findIndex(c => c.includes('valor (us$)') || c.includes('valor us$'));
                    break;
                }
            }
        }

        if (headerRowIndex === -1) {
            colMap = { ...colMap, date: 0, desc: 1, valR: 3 }; 
        }

        const startRow = headerRowIndex === -1 ? 0 : headerRowIndex + 1;

        for (let i = startRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const rawDate = row[colMap.date];
            const dateIso = parseAnyDate(rawDate);
            if (!dateIso) continue;

            let description = 'Sem descrição';
            const mainDesc = (colMap.desc !== -1 && row[colMap.desc]) ? String(row[colMap.desc]).trim() : '';
            const detailDesc = (colMap.details !== -1 && row[colMap.details]) ? String(row[colMap.details]).trim() : '';

            // --- Regras de exclusão para faturas ---
            const descLower = mainDesc.toLowerCase();
            if (descLower.includes('subtotal') || 
                descLower.includes('saldo anterior') || 
                descLower.includes('total de pagamentos') || 
                descLower.includes('total de créditos') || 
                descLower.includes('resumo de despesas') ||
                descLower.includes('limite total') ||
                descLower.includes('no período desta fatura')) {
                continue;
            }

            if (mainDesc && detailDesc) description = `${mainDesc} - ${detailDesc}`;
            else if (mainDesc) description = mainDesc;
            else if (detailDesc) description = detailDesc;

            let amount = 0;
            let type: TransactionType = 'EXPENSE';

            // Lógica de valor para faturas (R$ é prioritário)
            if (colMap.valR !== -1 && row[colMap.valR] !== undefined && row[colMap.valR] !== null) {
                const valRaw = row[colMap.valR];
                let val = typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw).replace(/\./g, '').replace(',', '.'));
                if (!isNaN(val) && val !== 0) {
                    amount = Math.abs(val);
                    type = val < 0 ? 'INCOME' : 'EXPENSE'; // Em faturas, crédito costuma ser negativo
                }
            } 
            
            // Se amount ainda for 0, tenta as outras colunas
            if (amount === 0) {
                if (colMap.credit !== -1 && row[colMap.credit]) {
                    const val = typeof row[colMap.credit] === 'number' ? row[colMap.credit] : parseFloat(String(row[colMap.credit]).replace(/\./g, '').replace(',', '.'));
                    amount = Math.abs(val); type = 'INCOME';
                } else if (colMap.debit !== -1 && row[colMap.debit]) {
                    const val = typeof row[colMap.debit] === 'number' ? row[colMap.debit] : parseFloat(String(row[colMap.debit]).replace(/\./g, '').replace(',', '.'));
                    amount = Math.abs(val); type = 'EXPENSE';
                } else if (colMap.value !== -1 && row[colMap.value]) {
                    const val = typeof row[colMap.value] === 'number' ? row[colMap.value] : parseFloat(String(row[colMap.value]).replace(/\./g, '').replace(',', '.'));
                    amount = Math.abs(val); type = val < 0 ? 'EXPENSE' : 'INCOME';
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
                    selectedGroup: '',
                    isChecked: false
                });
            }
        }

        if (parsed.length > 0) {
            const processedItems = processImportedItems(parsed);
            setImportItems(processedItems);
            setStep('CLASSIFY');
            setError(null);
        } else {
            setError("Nenhuma transação válida encontrada. Verifique se o arquivo possui o formato esperado.");
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
            if (d) { dateIso = d; dateIndex = i; break; }
        }

        if (dateIso) {
            let amount = 0;
            let type: TransactionType = 'EXPENSE';
            let description = '';
            const valuePartIndex = parts.findIndex((p, idx) => idx > dateIndex && /^-?[\d\.]+,?\d{0,2}$/.test(p.trim()));

            if (valuePartIndex !== -1) {
                const valStr = parts[valuePartIndex].trim();
                const valNum = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(valNum)) {
                    amount = Math.abs(valNum);
                    type = valNum < 0 ? 'EXPENSE' : 'INCOME';
                    description = parts.slice(dateIndex + 1, valuePartIndex).join(' ');
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
                    isChecked: false
                });
            }
        }
      });

      if (parsed.length === 0) setError("Não foi possível ler as transações.");
      else {
          setImportItems(processImportedItems(parsed));
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
        return { ...p, selectedGroup: group, selectedCategory: category, isChecked: category ? true : p.isChecked };
    }));
  };

  const handleToggle = (id: string) => {
    setImportItems(prev => prev.map(p => p.id === id ? { ...p, isChecked: !p.isChecked } : p));
  };

  const handleToggleAll = (checked: boolean) => {
      setImportItems(prev => prev.map(p => ({ ...p, isChecked: checked })));
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
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Importar Dados Financeiros</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {error && <div className="p-4 pb-0 shrink-0"><div className="bg-red-50 text-red-700 p-3 rounded flex items-center gap-2"><AlertCircle size={20} />{error}</div></div>}

            {step === 'UPLOAD' ? (
                <div className="p-4 flex-1 overflow-auto">
                    <div className="h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={48} className="text-gray-400 mb-2" />
                        <p className="text-gray-600 font-medium">Clique para selecionar Extrato ou Fatura</p>
                        <p className="text-xs text-gray-400 mt-1">Suporta Excel (Santander/BB/Cartão) e CSV</p>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt,.xls,.xlsx" onChange={handleFileUpload} />
                    </div>
                </div>
            ) : (
                <>
                    <div className="p-4 pb-0 shrink-0 bg-white z-10">
                         <div className="bg-blue-50 text-blue-800 p-3 text-xs rounded border border-blue-200 flex flex-col gap-1 shadow-sm">
                            <span className="flex items-center gap-2 font-medium"><AlertTriangle size={14}/> Linhas coloridas: Já importadas anteriormente.</span>
                            <span className="flex items-center gap-2 font-medium"><Wand2 size={14}/> Categorias sugeridas baseadas no seu histórico.</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 pt-2">
                        <table className="w-full text-sm border-collapse min-w-[600px]">
                            <thead className="text-gray-700">
                                <tr>
                                    <th className="p-2 w-10 text-center border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">
                                        <input type="checkbox" checked={importItems.length > 0 && importItems.every(i => i.isChecked)} onChange={(e) => handleToggleAll(e.target.checked)} />
                                    </th>
                                    <th className="p-2 text-left border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">Data</th>
                                    <th className="p-2 text-left border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">Descrição</th>
                                    <th className="p-2 text-right border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">Valor</th>
                                    <th className="p-2 text-left border-b border-gray-300 sticky top-0 bg-gray-100 z-10 shadow-sm">Classificação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {importItems.map(item => (
                                    <tr key={item.id} className={`transition-colors border-b border-gray-100 ${item.isPossibleDuplicate ? 'bg-amber-200 hover:bg-amber-300 text-amber-900' : 'bg-white hover:bg-gray-50'} ${!item.isChecked ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                        <td className="p-2 text-center"><input type="checkbox" checked={item.isChecked} onChange={() => handleToggle(item.id)} /></td>
                                        <td className="p-2 w-24 whitespace-nowrap">{item.date ? new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Inválida'}</td>
                                        <td className="p-2 font-medium"><div className="flex items-center gap-2">{item.description}{item.isPossibleDuplicate && <AlertTriangle size={14} />}</div></td>
                                        <td className={`p-2 text-right font-mono whitespace-nowrap ${item.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                                            {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="p-2 w-64">
                                            <select className={`w-full border rounded p-1.5 text-sm transition-colors ${!item.selectedCategory && item.isChecked ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} value={item.selectedCategory} onChange={(e) => {
                                                const val = e.target.value;
                                                const groupName = item.type === 'INCOME' ? 'Receitas' : (expenseGroups.find(g => g.items.includes(val))?.name || '');
                                                handleCategoryChange(item.id, groupName, val);
                                            }}>
                                                <option value="">Selecione...</option>
                                                {item.type === 'INCOME' ? (
                                                    <optgroup label="Receitas">{incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                                                ) : (
                                                    expenseGroups.map(group => (<optgroup key={group.name} label={group.name}>{group.items.map(sub => <option key={sub} value={sub}>{sub}</option>)}</optgroup>))
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

        <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 shrink-0">
            {step === 'CLASSIFY' && <button onClick={() => { setImportItems([]); setStep('UPLOAD'); }} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-medium">Voltar</button>}
            {step === 'CLASSIFY' ? (
                 <button onClick={handleConfirmImport} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2 shadow-sm font-semibold">
                 <Check size={18} /> Confirmar ({importItems.filter(i => i.isChecked && i.selectedCategory).length})
                </button>
            ) : (<button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-medium">Cancelar</button>)}
        </div>
      </div>
    </div>
  );
};

export default BankImportModal;