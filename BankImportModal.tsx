
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, AlertCircle, AlertTriangle, FileText, Check } from 'lucide-react';
import type { ImportItem, CategoryStructure, TransactionType, Transaction } from './types';
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

  // Resetar o modal sempre que ele for fechado ou aberto
  useEffect(() => {
    if (!isOpen) {
      setImportItems([]);
      setStep('UPLOAD');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getCleanDescription = (fullDesc: string) => {
    // Remove padrões de data/hora comuns em extratos (ex: 21/10 13:42)
    const datePattern = /\d{2}\/\d{2}(?:\s\d{2}:\d{2})?/;
    const match = fullDesc.match(datePattern);
    if (match && match.index !== undefined) {
      const afterDate = fullDesc.substring(match.index + match[0].length);
      return afterDate.replace(/^[-\s]+/, '').toLowerCase().trim();
    }
    return fullDesc.toLowerCase().trim();
  };

  const processImportedItems = (items: ImportItem[]): ImportItem[] => {
    return items.map(item => {
      const itemDescLower = item.description.toLowerCase().trim();
      const itemCleaned = getCleanDescription(item.description);

      // 1. Verificar Duplicados (Mesma data, valor e descrição similar)
      const duplicateMatch = existingTransactions.find(ex => {
        const sameDate = ex.date === item.date;
        const sameAmount = Math.abs(Math.abs(ex.amount) - item.amount) < 0.01;
        if (!sameDate || !sameAmount) return false;

        const obsLower = (ex.observation || '').toLowerCase();
        const descLower = ex.description.toLowerCase().trim();

        if (obsLower.includes('importado:')) {
          const importedContent = obsLower.split('importado:')[1]?.trim() || '';
          if (itemDescLower.includes(importedContent) || importedContent.includes(itemDescLower)) return true;
        }
        return itemDescLower.includes(descLower) || descLower.includes(itemDescLower);
      });

      // 2. Busca no Histórico para Sugestão Inteligente (Aprendizado)
      const historyMatch = duplicateMatch || [...existingTransactions].reverse().find(ex => {
        if (!ex.group) return false;
        
        let historicalBankText = '';
        if (ex.observation?.toLowerCase().includes('importado:')) {
          historicalBankText = ex.observation.split(/importado:/i)[1]?.toLowerCase().trim() || '';
        }

        const matchTarget = historicalBankText || ex.description.toLowerCase().trim();
        
        return itemCleaned === matchTarget || 
               (itemCleaned.length > 5 && matchTarget.includes(itemCleaned)) ||
               (matchTarget.length > 5 && itemCleaned.includes(matchTarget));
      });

      return {
        ...item,
        isPossibleDuplicate: !!duplicateMatch,
        isChecked: false, 
        selectedGroup: historyMatch?.group || (item.type === 'INCOME' ? 'Receitas' : (expenseGroups[0]?.name || '')),
        selectedCategory: historyMatch?.description || ''
      };
    });
  };

  const parseNum = (v: any): number => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    let str = String(v).trim().replace('R$', '').replace('$', '').trim();
    if (str.includes(',') && str.includes('.')) {
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  };

  const parseAnyDate = (value: any): string | null => {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
    if (typeof value === 'number' && value > 20000) {
      try {
        const dateObj = XLSX.SSF.parse_date_code(value);
        return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      } catch { return null; }
    }
    let str = String(value).trim();
    if (!str || str.includes('0001')) return null;
    const matchBR = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (matchBR) {
      const day = matchBR[1].padStart(2, '0');
      const month = matchBR[2].padStart(2, '0');
      let year = matchBR[3].length === 2 ? `20${matchBR[3]}` : matchBR[3];
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][];
        
        let headerIdx = -1;
        let colMap = { date: -1, descs: [] as number[], credit: -1, debit: -1, amount: -1 };

        const dateSyns = ['data', 'dt.'];
        const descSyns = ['descrição', 'descricão', 'historico', 'histórico', 'lançamento', 'lancamento', 'detalhes', 'detalhe', 'informação', 'docto'];
        const creditSyns = ['crédito', 'credito', 'entrada'];
        const debitSyns = ['débito', 'debito', 'saída'];

        for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
          const row = jsonData[i].map(c => String(c || '').toLowerCase().trim());
          if (row.some(c => dateSyns.some(s => c.includes(s)))) {
            headerIdx = i;
            row.forEach((cell, idx) => {
              if (dateSyns.some(s => cell.includes(s))) colMap.date = idx;
              if (descSyns.some(s => cell.includes(s))) colMap.descs.push(idx);
              if (creditSyns.some(s => cell.includes(s))) colMap.credit = idx;
              if (debitSyns.some(s => cell.includes(s))) colMap.debit = idx;
              if (cell === 'valor' || (cell.includes('valor') && !cell.includes('saldo'))) colMap.amount = idx;
            });
            break;
          }
        }

        if (headerIdx === -1) {
          setError("Não foi possível identificar o cabeçalho do extrato.");
          return;
        }

        const parsed: ImportItem[] = [];
        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row) continue;
          const date = parseAnyDate(row[colMap.date]);
          if (!date) continue;

          const rawDescription = colMap.descs
            .map(idx => String(row[idx] || '').trim())
            .filter(s => !!s)
            .join(' - ');

          if (!rawDescription || /saldo|anterior|resumo|total|limite/i.test(rawDescription)) continue;

          let val = 0;
          let type: TransactionType = 'EXPENSE';

          if (colMap.credit !== -1 || colMap.debit !== -1) {
            const c = parseNum(row[colMap.credit]);
            const d = parseNum(row[colMap.debit]);
            if (c !== 0) { val = Math.abs(c); type = 'INCOME'; }
            else if (d !== 0) { val = Math.abs(d); type = 'EXPENSE'; }
          } else if (colMap.amount !== -1) {
            const a = parseNum(row[colMap.amount]);
            val = Math.abs(a);
            type = a < 0 ? 'EXPENSE' : 'INCOME';
          }

          if (val > 0) {
            parsed.push({
              id: `imp-${i}-${Date.now()}`,
              date,
              description: rawDescription,
              amount: val,
              type,
              selectedGroup: '',
              selectedCategory: '',
              isChecked: false
            });
          }
        }

        if (parsed.length > 0) {
          setImportItems(processImportedItems(parsed));
          setStep('CLASSIFY');
          setError(null);
        } else {
          setError("Nenhum lançamento identificado nas colunas de valor.");
        }
      } catch (err) { setError("Erro ao processar arquivo."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = () => {
    const selected = importItems.filter(i => i.isChecked && i.selectedCategory);
    if (selected.length === 0) {
      alert("Selecione os lançamentos marcando a caixa e definindo a categoria.");
      return;
    }
    onImport(selected);
    onClose(); // O useEffect cuidará de limpar o estado
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header Fixo */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white"><Upload size={20} /></div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Importador de Extrato</h2>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Passo {step === 'UPLOAD' ? '1: Enviar Arquivo' : '2: Classificar Itens'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30 min-h-0">
          {error && (
            <div className="p-4 shrink-0">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 text-xs text-red-700 flex gap-2">
                <AlertCircle size={16}/> {error}
              </div>
            </div>
          )}

          {step === 'UPLOAD' ? (
            <div className="p-10 flex-1 flex flex-col items-center justify-center">
              <div 
                className="w-full max-w-lg border-3 border-dashed border-gray-300 rounded-3xl p-12 flex flex-col items-center hover:bg-indigo-50/50 cursor-pointer transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText size={50} className="text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-800">Selecione seu Extrato</h3>
                <p className="text-sm text-gray-500 mt-2">Santander, Banco do Brasil, Itaú, etc. (XLSX, CSV)</p>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xls,.xlsx" onChange={handleFileUpload} />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto px-4 pb-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible relative">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-800 text-white shadow-sm">
                      <th className="p-3 w-10 text-center rounded-tl-xl">
                        <input 
                          type="checkbox" 
                          onChange={(e) => setImportItems(prev => prev.map(i => ({ ...i, isChecked: e.target.checked })))} 
                        />
                      </th>
                      <th className="p-3 text-left">Data</th>
                      <th className="p-3 text-left">Descrição no Extrato</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 text-left rounded-tr-xl">Classificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importItems.map(item => (
                      <tr key={item.id} className={`${item.isPossibleDuplicate ? 'bg-amber-100/70' : 'hover:bg-gray-50'} transition-colors ${!item.isChecked ? 'opacity-75' : ''}`}>
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={item.isChecked} 
                            onChange={() => setImportItems(prev => prev.map(i => i.id === item.id ? { ...i, isChecked: !i.isChecked } : i))} 
                          />
                        </td>
                        <td className="p-3 font-mono whitespace-nowrap text-gray-500">
                          {new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700 leading-tight">{item.description}</span>
                            {item.isPossibleDuplicate && (
                              <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded shadow-sm shrink-0 uppercase">
                                <AlertTriangle size={10} /> Já Existe
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${item.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                          {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="p-3">
                          <select 
                            className={`w-full text-xs p-1.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${item.selectedCategory ? 'border-indigo-200 bg-white font-semibold text-indigo-700' : 'border-gray-200 bg-white'}`}
                            value={item.selectedCategory} 
                            onChange={(e) => {
                              const val = e.target.value;
                              const group = item.type === 'INCOME' ? 'Receitas' : (expenseGroups.find(g => g.items.includes(val))?.name || '');
                              setImportItems(prev => prev.map(p => p.id === item.id ? { ...p, selectedGroup: group, selectedCategory: val, isChecked: !!val } : p));
                            }}
                          >
                            <option value="">-- Classificar --</option>
                            {item.type === 'INCOME' ? (
                                incomeCategories.map(c => <option key={c} value={c}>{c}</option>)
                            ) : (
                              expenseGroups.map(g => (
                                <optgroup key={g.name} label={g.name}>
                                  {g.items.map(i => <option key={i} value={i}>{i}</option>)}
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
            </div>
          )}
        </div>

        {/* Footer Area Fixo */}
        <div className="p-5 border-t bg-white shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-gray-500 flex items-center gap-4">
            {step === 'CLASSIFY' && (
              <>
                <span className="flex items-center gap-1 font-semibold text-amber-700"><AlertTriangle size={12}/> Amarelo: Lançamento já existente</span>
                <span>Selecionados: <strong>{importItems.filter(i => i.isChecked).length}</strong></span>
              </>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {step === 'CLASSIFY' && (
              <button onClick={() => setStep('UPLOAD')} className="flex-1 sm:flex-none px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                Mudar Arquivo
              </button>
            )}
            <button 
              disabled={step === 'UPLOAD' || importItems.filter(i => i.isChecked && i.selectedCategory).length === 0}
              onClick={handleConfirm} 
              className="flex-1 sm:flex-none px-10 py-2.5 bg-indigo-600 disabled:bg-gray-300 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} /> Salvar Selecionados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankImportModal;
