
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { DetectedTransaction, DetectedMetadata, InputMode } from '../types';
import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';
import { extractTextFromPDF, parseNubankText, parseCSV } from '../utils/localParsers';

interface ProcessingContextType {
  isProcessing: boolean;
  processingPhase: number;
  progressText: string;
  results: DetectedTransaction[];
  detectedMetadata: DetectedMetadata | null;
  hasResults: boolean;
  startProcessing: (mode: InputMode, files: File[], textInput: string) => Promise<void>;
  clearResults: () => void;
  setResults: React.Dispatch<React.SetStateAction<DetectedTransaction[]>>;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

const PROCESSING_PHASES = [
  "Lendo arquivo...",
  "Identificando padrões...",
  "Calculando parcelas...",
  "Categorizando...",
  "Finalizando..."
];

export const ProcessingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState(0);
  const [progressText, setProgressText] = useState(PROCESSING_PHASES[0]);
  const [results, setResults] = useState<DetectedTransaction[]>([]);
  const [detectedMetadata, setDetectedMetadata] = useState<DetectedMetadata | null>(null);

  const normalizeDate = (raw: string): string => {
    const value = String(raw || '').trim();
    if (!value) return new Date().toISOString().split('T')[0];

    if (value.includes('/')) {
      const parts = value.split('/').map(p => p.trim());
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${year}-${month}-${day}`;
      }
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0];
  };

  const normalizeDetectedTransactions = (items: any[]): DetectedTransaction[] => {
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => {
        const rawAmount = Number(item?.amount);
        const type = item?.type === 'income' ? 'income' : 'expense';
        const amount = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0;
        const description = String(item?.description || '').trim();

        return {
          date: normalizeDate(item?.date),
          description: description || 'Lançamento importado',
          amount,
          type,
          category: String(item?.category || (type === 'income' ? 'Receita' : 'Outros')).trim(),
          selected: true,
          sourceType: item?.sourceType === 'card' ? 'card' : 'account',
          bankName: item?.bankName ? String(item.bankName) : undefined,
          installmentNumber: Number.isInteger(item?.installmentNumber) ? item.installmentNumber : undefined,
          totalInstallments: Number.isInteger(item?.totalInstallments) ? item.totalInstallments : undefined,
        } as DetectedTransaction;
      })
      .filter((tx) => tx.amount > 0 && tx.description.length > 0);
  };

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      setProcessingPhase(0);
      interval = setInterval(() => {
        setProcessingPhase(prev => (prev + 1) % PROCESSING_PHASES.length);
      }, 600);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    if (isProcessing && !progressText.includes('Arquivo')) {
        setProgressText(PROCESSING_PHASES[processingPhase]);
    }
  }, [processingPhase, isProcessing]);

  const startProcessing = useCallback(async (mode: InputMode, files: File[], textInput: string) => {
    if (!currentUser?.isPro) {
      addNotification("Funcionalidade exclusiva para usuários PRO.", "info");
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setDetectedMetadata(null);
    
    let allTransactions: DetectedTransaction[] = [];
    let lastMetadata: DetectedMetadata | null = null;
    let successCount = 0;

    try {
      // 1. MODO ARQUIVO (Múltiplos)
      if (mode === 'file' && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setProgressText(`Processando arquivo ${i + 1} de ${files.length}: ${file.name}`);
            
            let fileTransactions: DetectedTransaction[] = [];
            let fileMetadata: DetectedMetadata | null = null;

            if (file.type === 'application/pdf') {
               try {
                 const textToParse = await extractTextFromPDF(file);
                 
                 // Processamento 100% Local para PDFs
                 const localResult = parseNubankText(textToParse, file.name);
                 
                 if (localResult.transactions.length > 0) {
                     fileTransactions = localResult.transactions;
                     fileMetadata = localResult.metadata;
                 } else {
                     console.warn(`Nenhuma transação encontrada localmente em ${file.name}. Tentando IA...`);
                     const aiResult = await processWithAI(null, textToParse);
                     fileTransactions = aiResult.transactions;
                     fileMetadata = aiResult.metadata;
                 }
               } catch (e) {
                 console.error(`Erro ao ler PDF ${file.name}`, e);
                 addNotification(`Erro ao ler PDF ${file.name}`, "error");
               }
            } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
               const text = await file.text();
              const csvResult = parseCSV(text, file.name);
               fileTransactions = csvResult.transactions;
               fileMetadata = csvResult.metadata;
               if (fileTransactions.length === 0) {
                 try {
                   const aiResult = await processWithAI(null, text);
                   fileTransactions = aiResult.transactions;
                   fileMetadata = { ...fileMetadata, ...aiResult.metadata };
                 } catch (e) {
                   console.error(`Erro ao processar CSV ${file.name} com IA`, e);
                 }
               }
            } else if (file.type.startsWith('image/') || file.type.startsWith('audio/')) {
              // Imagens e áudios usam IA porque OCR/transcrição local no browser é limitado.
               try {
                 const aiResult = await processWithAI(file, null);
                 fileTransactions = aiResult.transactions;
                 fileMetadata = aiResult.metadata;
               } catch (e) {
                 console.error(`Erro ao processar imagem ${file.name}`, e);
               }
            }

            if (fileTransactions.length > 0) {
                allTransactions = [...allTransactions, ...fileTransactions];
                if (fileMetadata) lastMetadata = { ...lastMetadata, ...fileMetadata };
                successCount++;
            }
            
            // Pequeno delay visual para UI não piscar
            await new Promise(resolve => setTimeout(resolve, 300));
        }
      } 
      // 2. MODO TEXTO (Único)
      else if (mode === 'text' && textInput) {
         setProgressText("Analisando texto...");
         const localResult = parseNubankText(textInput, "Texto Colado");
         if (localResult.transactions.length > 0) {
            allTransactions = localResult.transactions;
            lastMetadata = localResult.metadata;
            successCount = 1;
         } else {
            // Fallback para IA apenas em texto livre não estruturado
            try {
                const aiResult = await processWithAI(null, textInput);
                allTransactions = aiResult.transactions;
                lastMetadata = aiResult.metadata;
                if (allTransactions.length > 0) successCount = 1;
            } catch (e) {
                console.error("Erro ao processar texto com IA", e);
            }
         }
      }

      if (allTransactions.length > 0) {
          setResults(allTransactions.map(t => ({ ...t, selected: true })));
          setDetectedMetadata(lastMetadata);
          addNotification(`${allTransactions.length} registros extraídos com sucesso.`, "success");
      } else {
          addNotification("Não foi possível identificar transações automaticamente. Tente outro arquivo, revise o texto/voz e confirme se a IA está configurada.", "warning");
      }

    } catch (err) {
      console.error("Processing Error:", err);
      addNotification("Erro no processamento.", "error");
    } finally {
      setIsProcessing(false);
      setProgressText(PROCESSING_PHASES[0]);
    }
  }, [currentUser, addNotification]);

  // Helper para IA (Mantido apenas para Imagens ou Texto Livre confuso)
  const processWithAI = async (file: File | null, text: string | null) => {
      const meta = import.meta as any;
      const env = (meta && meta.env) ? meta.env : {};
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.VITE_API_KEY;

      if (!apiKey) {
        throw new Error('API key da IA não configurada. Defina GEMINI_API_KEY no ambiente.');
      }

      const ai = new GoogleGenAI({ apiKey });
      let contents: any = [];
      let prompt = `Extraia transações financeiras de extratos/faturas/texto livre/voz. Retorne SOMENTE JSON no formato: { metadata: { limit, dueDay, closingDay, bankName }, transactions: [{ date: 'YYYY-MM-DD', description, amount (positivo), type: 'income'|'expense', category, sourceType: 'account'|'card', bankName }] }.`;

      if (file) {
         const reader = new FileReader();
         const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
         });
         contents = [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }];
      } else {
         contents = [{ parts: [{ text: `${prompt}\n\nTEXTO:\n${text}` }] }];
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || "{ \"transactions\": [], \"metadata\": {} }");
      return {
        metadata: parsed?.metadata || {},
        transactions: normalizeDetectedTransactions(parsed?.transactions || [])
      };
  };

  const clearResults = useCallback(() => {
    setResults([]);
    setDetectedMetadata(null);
  }, []);

  return (
    <ProcessingContext.Provider value={{
      isProcessing,
      processingPhase,
      progressText,
      results,
      detectedMetadata,
      hasResults: results.length > 0,
      startProcessing,
      clearResults,
      setResults
    }}>
      {children}
    </ProcessingContext.Provider>
  );
};

export const useProcessing = (): ProcessingContextType => {
  const context = useContext(ProcessingContext);
  if (context === undefined) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
};
