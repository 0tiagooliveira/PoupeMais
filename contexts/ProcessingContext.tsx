
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
                     console.warn(`Nenhuma transação encontrada localmente em ${file.name}`);
                     // Opcional: Se quiser manter IA apenas para imagens/casos extremos, descomente abaixo. 
                     // Mas o pedido foi para remover a regra da IA ler tudo.
                     // const aiResult = await processWithAI(null, textToParse);
                     // fileTransactions = aiResult.transactions;
                 }
               } catch (e) {
                 console.error(`Erro ao ler PDF ${file.name}`, e);
                 addNotification(`Erro ao ler PDF ${file.name}`, "error");
               }
            } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
               const text = await file.text();
               const csvResult = parseCSV(text);
               fileTransactions = csvResult.transactions;
               fileMetadata = csvResult.metadata;
            } else if (file.type.startsWith('image/')) {
               // Imagens ainda usam IA pois OCR local é pesado/complexo para browser
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
          addNotification("Não foi possível identificar transações. Verifique o formato do arquivo.", "warning");
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let contents: any = [];
      let prompt = `Extraia transações financeiras. Retorne JSON: { metadata: { limit, dueDay, closingDay, bankName }, transactions: [{ date: 'YYYY-MM-DD', description, amount (positivo), type: 'income'|'expense', category }] }`;

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
        model: 'gemini-3-flash-preview',
        contents,
        config: { responseMimeType: "application/json" }
      });

      return JSON.parse(response.text || "{ \"transactions\": [], \"metadata\": {} }");
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
