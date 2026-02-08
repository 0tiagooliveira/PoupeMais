
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { DetectedTransaction, InputMode } from '../types';
import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';

interface ProcessingContextType {
  isProcessing: boolean;
  processingPhase: number;
  progressText: string;
  results: DetectedTransaction[];
  hasResults: boolean;
  startProcessing: (mode: InputMode, file: File | null, textInput: string) => Promise<void>;
  clearResults: () => void;
  setResults: React.Dispatch<React.SetStateAction<DetectedTransaction[]>>;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

const AI_PHASES = [
  "Digitalizando documento...",
  "Extraindo datas e valores...",
  "Analisando contexto das despesas...",
  "Consultando base de categorias...",
  "Aplicando inteligência financeira...",
  "Finalizando organização..."
];

export const ProcessingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState(0);
  const [results, setResults] = useState<DetectedTransaction[]>([]);

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      setProcessingPhase(0);
      interval = setInterval(() => {
        setProcessingPhase(prev => (prev + 1) % AI_PHASES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const fileToData = (file: File): Promise<{ base64?: string, text?: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        reader.readAsText(file);
        reader.onload = () => resolve({ text: reader.result as string });
      } else {
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1] });
      }
      
      reader.onerror = error => reject(error);
    });
  };

  const startProcessing = useCallback(async (mode: InputMode, file: File | null, textInput: string) => {
    if (!currentUser?.isPro) {
      addNotification("Funcionalidade exclusiva para usuários PRO.", "info");
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let contents: any = [];
      let inputContext = "";

      if (mode === 'file' && file) {
        const { base64, text } = await fileToData(file);
        inputContext = "Extraia dados deste arquivo (Extrato Bancário, CSV ou Foto de Recibo).";
        
        const parts: any[] = [{ text: inputContext }];
        if (text) {
          parts.push({ text: `CONTEÚDO DO ARQUIVO:\n${text}` });
        } else if (base64) {
          parts.push({
            inlineData: {
              mimeType: file.type || 'image/jpeg',
              data: base64
            }
          });
        }
        contents = [{ parts }];
      } else {
        inputContext = "Analise este texto informal (pode ser cópia de SMS, WhatsApp ou anotações).";
        contents = [{ parts: [{ text: `${inputContext}\n\nTEXTO DO USUÁRIO:\n${textInput}` }] }];
      }

      const today = new Date().toISOString().split('T')[0];
      const prompt = `
      Você é um assistente financeiro inteligente. Sua tarefa é extrair transações financeiras do conteúdo fornecido.
      
      REGRAS DE INTERPRETAÇÃO:
      1. Se a data não for explícita (ex: "ontem", "hoje"), use como base a data de hoje: ${today}.
      2. Se for um texto informal (ex: "Gastei 50 no almoço"), o valor é 50, tipo 'expense', descrição 'Almoço'.
      3. Identifique padrões de SMS de banco (ex: "Compra aprovada Nubank R$ 20,00 Padaria").
      4. CATEGORIZAÇÃO: Tente mapear para uma destas categorias padrão: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Compras, Salário, Investimentos, Cartão de crédito, Serviços, Outros.
      5. FATURAS DE CARTÃO: Identifique especificamente se o comprovante é um pagamento de fatura de cartão de crédito. Se for, categorize como 'Cartão de crédito' e use o tipo 'expense'. Se for um estorno ou crédito de fatura, use 'income'.
      6. Se o valor for negativo ou indicar saída/compra/débito, type = 'expense'. Se for crédito/depósito/pix recebido, type = 'income'. Use valor ABSOLUTO (positivo) no JSON.

      Retorne APENAS um JSON array.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents,
        config: {
          systemInstruction: prompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: "Formato YYYY-MM-DD" },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                type: { type: Type.STRING, enum: ["income", "expense"] },
                category: { type: Type.STRING }
              },
              required: ['date', 'description', 'amount', 'type', 'category']
            }
          }
        }
      });

      const extracted = JSON.parse(response.text || "[]") as DetectedTransaction[];
      
      if (extracted.length === 0) {
        addNotification("Nenhuma transação identificada.", "warning");
      } else {
        setResults(extracted.map(t => ({ ...t, selected: true })));
        addNotification(`${extracted.length} transações identificadas!`, "success");
      }

    } catch (err) {
      console.error("AI Error:", err);
      addNotification("Erro ao processar dados. Tente novamente.", "error");
    } finally {
      setIsProcessing(false);
    }
  }, [currentUser, addNotification]);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return (
    <ProcessingContext.Provider value={{
      isProcessing,
      processingPhase,
      progressText: AI_PHASES[processingPhase],
      results,
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
