
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
    // Se tiver vírgula e ponto, assumimos formato BR (1.234,56) ou US (1,234.56)
    if (str.includes(',') && str.includes('.')) {
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        // Formato BR: 1.234,56 -> remove ponto, troca vírgula por ponto
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato US: 1,234.56 -> remove vírgula
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      // Apenas vírgula: 1234,56 -> troca por ponto
      str = str.replace(',', '.');
    }
    
    return parseFloat(str);
  };

  const parseAnyDate = (value: any): string | null => {
    if (value === undefined || value === null) return null;
    
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'number') {
      // Excel Serial Date
      if (value > 20000) {
        const dateObj = XLSX.SSF.parse_date_code(value);
        return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      }
      return null;
    }

    let str = String(value).trim();
    if (!str) return null;

    // DD/MM/YYYY ou DD/MM/YY
    const matchBR = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (matchBR) {
      const day = matchBR[1].padStart(2, '0');
      const month = matchBR[2].padStart(2, '0');
      let year = matchBR[3];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }

    // YYYY-MM-DD
    const matchISO = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (matchISO) return `${matchISO[1]}-${matchISO[2].padStart(2, '0')}-${matchISO[3].padStart(2, '0')}`;

    return null;
  };

  const findColumnIndices = (headers: string[]) => {
    const cols = { date: -1, desc: -1, amount: -1 };
    
    const dateSynonyms = ['data', 'dt.', 'vencimento', 'movimentação', 'lançamento', 'date'];
    const descSynonyms = ['descrição', 'descricão', 'historico', 'histórico', 'lançamento', 'detalhe', 'estabelecimento', 'description', 'texto'];
    const amountSynonyms = ['valor', 'val.', 'total', 'quantia', 'valor r$', 'valor (r$)', 'entrada/saída', 'amount', 'débito', 'crédito'];

    headers.forEach((h, idx) => {
      const cleanH = h.toLowerCase().trim();
      if (cols.date === -1 && dateSynonyms.some(s => cleanH.includes(s))) cols.date = idx;
      if (cols.desc === -1 && descSynonyms.some(s => cleanH.includes(s))) cols.desc = idx;
      if (cols.amount === -1 && amountSynonyms.some(s => cleanH.includes(s))) cols.amount = idx;
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
          setError("O arquivo selecionado parece estar vazio.");
          return;
        }

        // 1. Encontrar a linha de cabeçalho (procuramos nas primeiras 20 linhas)
        let headerIdx = -1;
        let colIndices = { date: -1, desc: -1, amount: -1 };

        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i].map(c => String(c || ''));
          const found = findColumnIndices(row);
          // Se encontramos pelo menos data e valor, é um bom candidato
          if (found.date !== -1 && found.amount !== -1) {
            headerIdx = i;
            colIndices = found;
            break;
          }
        }

        // 2. Se não achou cabeçalho, tenta um modo "fallback" (adivinhação por tipos de dados)
        if (headerIdx === -1) {
          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const hasDate = row.some(c => parseAnyDate(c) !== null);
            const hasNum = row.some(c => !isNaN(parseNum(c)) && parseNum(c) !== 0);
            if (hasDate && hasNum) {
              headerIdx = i - 1; // Assume que a linha anterior era o cabeçalho
              // Tenta mapear o que der
              colIndices.date = row.findIndex(c => parseAnyDate(c) !== null);
              colIndices.amount = row.findIndex(c => !isNaN(parseNum(c)) && parseNum(c) !== 0);
              colIndices.desc = row.findIndex((c, idx) => idx !== colIndices.date && idx !== colIndices.amount && typeof c === 'string');
              break;
            }
          }
        }

        if (headerIdx === -1 && colIndices.date === -1) {
          setError("Não conseguimos identificar as colunas de 'Data' e 'Valor' no arquivo. Certifique-se de que é um extrato válido.");
          return;
        }

        const parsed: ImportItem[] = [];
        let idCounter = 0;

        // 3. Processar os dados a partir da linha identificada
        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const date = parseAnyDate(row[colIndices.date]);
          const rawAmount = parseNum(row[colIndices.amount]);
          const description = String(row[colIndices.desc] || 'Sem descrição').trim();

          if (date && !isNaN(rawAmount) && rawAmount !== 0) {
            // Filtros de palavras proibidas (resumos de extratos)
            const lowerDesc = description.toLowerCase();
            const blacklist = ['saldo', 'resumo', 'limite', 'total', 'subtotal', 'extrato de'];
            if (blacklist.some(b => lowerDesc.includes(b))) continue;

            const amount = Math.abs(rawAmount);
            const type: TransactionType = rawAmount < 0 ? 'INCOME' : 'EXPENSE';

            // Sugestão Inteligente (Baseada no Histórico)
            let suggestedGroup = type === 'EXPENSE' ? (expenseGroups[0]?.name || '') : 'Receitas';
            let suggestedCategory = '';
            
            const match = existingTransactions.find(t => 
              t.description.toLowerCase().includes(description.toLowerCase()) || 
              description.toLowerCase().includes(t.description.toLowerCase())
            );
            
            if (match) {
              suggestedGroup = match.group;
              suggestedCategory = match.description;
            }

            parsed.push({
              id: `import-${Date.now()}-${idCounter++}`,
              date,
              description,
              amount,
              type,
              selectedCategory: suggestedCategory,
              selectedGroup: suggestedGroup,
              isChecked: suggestedCategory !== '',
              isPossibleDuplicate: existingTransactions.some(et => 
                et.date === date && 
                Math.abs(et.amount) === amount
              )
            });
          }
        }

        if (parsed.length > 0) {
          setImportItems(parsed);
          setStep('CLASSIFY');
          setError(null);
        } else {
          setError("Nenhum lançamento válido encontrado nas linhas processadas.");
        }

      } catch (err) {
        console.error(err);
        setError("Erro técnico ao ler o arquivo. Tente exportar em outro formato (CSV ou XLSX).");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = () => {
    const selected = importItems.filter(i => i.isChecked && i.selectedCategory);
    if (selected.length === 0) {
      alert("Selecione pelo menos um lançamento e defina sua categoria.");
      return;
    }
    onImport(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Importação de Extrato</h2>
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Passo {step === 'UPLOAD' ? '1: Enviar Arquivo' : '2: Classificar Itens'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30">
          {error && (
            <div className="p-4 shrink-0">
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r shadow-sm flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Ops! Algo deu errado</p>
                  <p className="text-xs opacity-90">{error}</p>
                </div>
              </div>
            </div>
          )}

          {step === 'UPLOAD' ? (
            <div className="p-10 flex-1 flex flex-col items-center justify-center text-center">
              <div 
                className="w-full max-w-lg border-3 border-dashed border-gray-300 rounded-3xl p-12 flex flex-col items-center hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-all group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <FileText size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Arraste seu extrato aqui</h3>
                <p className="text-sm text-gray-500 max-w-xs">Suporta arquivos Excel (.xls, .xlsx) e CSV de qualquer banco brasileiro.</p>
                
                <button className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                   <Upload size={18} /> Procurar Arquivo
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xls,.xlsx" onChange={handleFileUpload} />
              </div>
              
              <div className="mt-10 grid grid-cols-3 gap-6 w-full max-w-2xl opacity-40">
                <div className="flex flex-col items-center gap-1">
                   <CheckCircle2 size={16} />
                   <span className="text-[10px] font-bold uppercase">Mapeamento Automático</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <CheckCircle2 size={16} />
                   <span className="text-[10px] font-bold uppercase">Detector de Duplicados</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <CheckCircle2 size={16} />
                   <span className="text-[10px] font-bold uppercase">Sugestão por IA</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-800 text-white sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded accent-indigo-600"
                          onChange={(e) => setImportItems(prev => prev.map(i => ({ ...i, isChecked: e.target.checked })))} 
                        />
                      </th>
                      <th className="p-3 text-left font-bold uppercase tracking-wider text-[10px]">Data</th>
                      <th className="p-3 text-left font-bold uppercase tracking-wider text-[10px]">Descrição no Extrato</th>
                      <th className="p-3 text-right font-bold uppercase tracking-wider text-[10px]">Valor</th>
                      <th className="p-3 text-left font-bold uppercase tracking-wider text-[10px]">Classificar Como</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importItems.map(item => (
                      <tr key={item.id} className={`${item.isPossibleDuplicate ? 'bg-amber-50/50' : 'hover:bg-gray-50'} transition-colors ${!item.isChecked ? 'opacity-60' : ''}`}>
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={item.isChecked} 
                            className="w-4 h-4 rounded accent-indigo-600"
                            onChange={() => setImportItems(prev => prev.map(i => i.id === item.id ? { ...i, isChecked: !i.isChecked } : i))} 
                          />
                        </td>
                        <td className="p-3 whitespace-nowrap text-gray-500 font-mono">
                          {new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">{item.description}</span>
                            {item.isPossibleDuplicate && (
                              <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded" title="Já existe um lançamento similar neste mês">
                                <AlertTriangle size={10} /> POSSÍVEL DUPLICADO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`p-3 text-right font-mono font-bold ${item.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                          {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="p-3">
                          <select 
                            className={`w-full text-xs p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${item.selectedCategory ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200'}`}
                            value={item.selectedCategory} 
                            onChange={(e) => {
                              const val = e.target.value;
                              const group = item.type === 'INCOME' ? 'Receitas' : (expenseGroups.find(g => g.items.includes(val))?.name || '');
                              setImportItems(prev => prev.map(p => p.id === item.id ? { ...p, selectedGroup: group, selectedCategory: val, isChecked: !!val } : p));
                            }}
                          >
                            <option value="">-- Selecione uma categoria --</option>
                            {item.type === 'INCOME' ? (
                              <optgroup label="Fontes de Receita">
                                {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                              </optgroup>
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

        {/* Footer Area */}
        <div className="p-5 border-t bg-white shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-500">
            {step === 'CLASSIFY' && (
               <p><strong>{importItems.filter(i => i.isChecked && i.selectedCategory).length}</strong> de <strong>{importItems.length}</strong> itens prontos para importar.</p>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {step === 'CLASSIFY' && (
              <button onClick={() => { setStep('UPLOAD'); setImportItems([]); }} className="flex-1 sm:flex-none px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                Reiniciar
              </button>
            )}
            <button 
              disabled={step === 'UPLOAD' || importItems.filter(i => i.isChecked && i.selectedCategory).length === 0}
              onClick={handleConfirm} 
              className="flex-1 sm:flex-none px-10 py-2.5 bg-indigo-600 disabled:bg-gray-300 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
            >
              Concluir Importação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankImportModal;
