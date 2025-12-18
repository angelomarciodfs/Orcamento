
import React, { useState, useRef } from 'react';
import { X, Upload, AlertCircle, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
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

  if (!isOpen) return null;

  const parseNum = (v: any): number => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    
    let str = String(v).trim();
    // Remove símbolos monetários
    str = str.replace('R$', '').replace('$', '').trim();

    // Lógica para formatos brasileiros (1.234,56)
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
    
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'number') {
      if (value > 20000) {
        try {
           const dateObj = XLSX.SSF.parse_date_code(value);
           // Fix: Corrected date string segment construction to avoid duplicate month parts
           return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
        } catch(e) { return null; }
      }
      return null;
    }

    let str = String(value).trim();
    if (!str || str.includes('0001')) return null;

    const matchBR = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (matchBR) {
      const day = matchBR[1].padStart(2, '0');
      const month = matchBR[2].padStart(2, '0');
      let year = matchBR[3];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }

    const matchISO = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (matchISO) return `${matchISO[1]}-${matchISO[2].padStart(2, '0')}-${matchISO[3].padStart(2, '0')}`;

    return null;
  };

  const findColumnIndices = (headers: string[]) => {
    const cols = { date: -1, desc: -1, amount: -1, credit: -1, debit: -1 };
    
    const dateSynonyms = ['data', 'dt.', 'vencimento', 'date'];
    const descSynonyms = ['descrição', 'descricão', 'historico', 'histórico', 'lançamento', 'description'];
    const amountSynonyms = ['valor (r$)', 'valor r$', 'quantia', 'amount'];
    const creditSynonyms = ['crédito', 'credito', 'entradas', 'proventos'];
    const debitSynonyms = ['débito', 'debito', 'saídas', 'descontos'];

    headers.forEach((h, idx) => {
      const cleanH = h.toLowerCase().trim();
      if (cols.date === -1 && dateSynonyms.some(s => cleanH.includes(s))) cols.date = idx;
      if (cols.desc === -1 && descSynonyms.some(s => cleanH.includes(s))) cols.desc = idx;
      if (cols.amount === -1 && amountSynonyms.some(s => cleanH === s)) cols.amount = idx;
      if (cols.credit === -1 && creditSynonyms.some(s => cleanH.includes(s))) cols.credit = idx;
      if (cols.debit === -1 && debitSynonyms.some(s => cleanH.includes(s))) cols.debit = idx;
    });

    return cols;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (jsonData.length === 0) {
          setError("Arquivo vazio.");
          return;
        }

        let headerIdx = -1;
        let colIndices = { date: -1, desc: -1, amount: -1, credit: -1, debit: -1 };

        // Busca o cabeçalho
        for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
          const row = jsonData[i].map(c => String(c || ''));
          const found = findColumnIndices(row);
          if (found.date !== -1 && (found.amount !== -1 || (found.credit !== -1 && found.debit !== -1))) {
            headerIdx = i;
            colIndices = found;
            break;
          }
        }

        if (headerIdx === -1) {
          setError("Não identificamos as colunas de Data e Valor. O arquivo deve tel cabeçalhos como 'Data', 'Descrição' e 'Valor' ou 'Crédito'/'Débito'.");
          return;
        }

        const parsed: ImportItem[] = [];
        let idCounter = 0;

        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const date = parseAnyDate(row[colIndices.date]);
          if (!date) continue;

          const description = String(row[colIndices.desc] || '').trim();
          const lowerDesc = description.toLowerCase();
          
          // Ignora linhas de rodapé/resumo baseadas no seu extrato
          const blacklist = ['saldo anterior', 'total', 'saldo atual', 'saldo de conta', 'bloqueado', 'limite', 'disponível', 'juros', 'iof acumulado'];
          if (blacklist.some(b => lowerDesc.includes(b))) continue;
          if (!description) continue;

          let finalAmount = 0;
          let type: TransactionType = 'EXPENSE';

          // Lógica para colunas separadas (Santander/BB)
          if (colIndices.credit !== -1 || colIndices.debit !== -1) {
             const creditVal = parseNum(row[colIndices.credit]);
             const debitVal = parseNum(row[colIndices.debit]);

             if (creditVal !== 0) {
                finalAmount = Math.abs(creditVal);
                type = 'INCOME';
             } else if (debitVal !== 0) {
                finalAmount = Math.abs(debitVal);
                type = 'EXPENSE';
             }
          } else {
             // Lógica para coluna única
             const amountRaw = parseNum(row[colIndices.amount]);
             finalAmount = Math.abs(amountRaw);
             type = amountRaw < 0 ? 'INCOME' : 'EXPENSE';
          }

          if (finalAmount !== 0) {
            let suggestedGroup = type === 'EXPENSE' ? (expenseGroups[0]?.name || '') : 'Receitas';
            let suggestedCategory = '';
            
            // Tenta achar no histórico
            const match = existingTransactions.find(t => 
              t.description.toLowerCase().includes(description.toLowerCase().substring(0, 10))
            );
            
            if (match) {
              suggestedGroup = match.group;
              suggestedCategory = match.description;
            }

            parsed.push({
              id: `import-${Date.now()}-${idCounter++}`,
              date,
              description,
              amount: finalAmount,
              type,
              selectedCategory: suggestedCategory,
              selectedGroup: suggestedGroup,
              isChecked: suggestedCategory !== '',
              isPossibleDuplicate: existingTransactions.some(et => 
                et.date === date && Math.abs(Math.abs(et.amount) - finalAmount) < 0.01
              )
            });
          }
        }

        if (parsed.length > 0) {
          setImportItems(parsed);
          setStep('CLASSIFY');
          setError(null);
        } else {
          setError("Nenhum lançamento identificado. Verifique se o arquivo contém dados após o cabeçalho.");
        }

      } catch (err) {
        setError("Erro ao ler arquivo. Tente outro formato.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = () => {
    const selected = importItems.filter(i => i.isChecked && i.selectedCategory);
    if (selected.length === 0) {
      alert("Selecione os itens e suas categorias.");
      return;
    }
    onImport(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Importação de Extrato</h2>
              <p className="text-xs text-gray-500 uppercase font-semibold">Passo {step === 'UPLOAD' ? '1: Enviar Arquivo' : '2: Classificar Itens'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30">
          {error && (
            <div className="p-4">
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}

          {step === 'UPLOAD' ? (
            <div className="p-10 flex-1 flex flex-col items-center justify-center text-center">
              <div 
                className="w-full max-w-lg border-3 border-dashed border-gray-300 rounded-3xl p-12 flex flex-col items-center hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText size={48} className="text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-800">Clique para selecionar o Extrato</h3>
                <p className="text-sm text-gray-500 mt-2">Aceita XLS, XLSX e CSV (Santander, BB, Itaú, etc)</p>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xls,.xlsx" onChange={handleFileUpload} />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 text-white sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-10">
                        <input type="checkbox" onChange={(e) => setImportItems(prev => prev.map(i => ({ ...i, isChecked: e.target.checked })))} />
                      </th>
                      <th className="p-3 text-left">Data</th>
                      <th className="p-3 text-left">Descrição</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 text-left">Categoria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importItems.map(item => (
                      <tr key={item.id} className={`${item.isPossibleDuplicate ? 'bg-amber-50' : 'hover:bg-gray-50'} ${!item.isChecked ? 'opacity-60' : ''}`}>
                        <td className="p-3 text-center">
                          <input type="checkbox" checked={item.isChecked} onChange={() => setImportItems(prev => prev.map(i => i.id === item.id ? { ...i, isChecked: !i.isChecked } : i))} />
                        </td>
                        <td className="p-3 font-mono">{new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.description}</span>
                            {/* Fixed: Wrapped AlertTriangle in a span with the title attribute as Lucide icons do not support a title prop directly */}
                            {item.isPossibleDuplicate && (
                              <span title="Possível duplicado">
                                <AlertTriangle size={14} className="text-amber-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`p-3 text-right font-mono font-bold ${item.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                          {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="p-3">
                          <select 
                            className="w-full text-xs p-2 rounded border border-gray-200"
                            value={item.selectedCategory} 
                            onChange={(e) => {
                              const val = e.target.value;
                              const group = item.type === 'INCOME' ? 'Receitas' : (expenseGroups.find(g => g.items.includes(val))?.name || '');
                              setImportItems(prev => prev.map(p => p.id === item.id ? { ...p, selectedGroup: group, selectedCategory: val, isChecked: !!val } : p));
                            }}
                          >
                            <option value="">-- Selecione --</option>
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

        <div className="p-5 border-t bg-white flex justify-end gap-3">
          {step === 'CLASSIFY' && (
            <button onClick={() => setStep('UPLOAD')} className="px-6 py-2 text-gray-500 font-bold">Voltar</button>
          )}
          <button 
            disabled={step === 'UPLOAD' || importItems.filter(i => i.isChecked && i.selectedCategory).length === 0}
            onClick={handleConfirm} 
            className="px-10 py-2 bg-indigo-600 disabled:bg-gray-300 text-white font-bold rounded-xl shadow hover:bg-indigo-700"
          >
            Concluir ({importItems.filter(i => i.isChecked && i.selectedCategory).length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default BankImportModal;
