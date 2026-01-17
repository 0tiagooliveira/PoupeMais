
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Transaction, CategoryData } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { CategoryChartCard } from '../dashboard/components/CategoryChartCard';
import { getIconByCategoryName } from '../../utils/categoryIcons';

// --- Utilitários de Áudio ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface AIInsight {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  type: 'saving' | 'warning' | 'opportunity';
}

interface StructuredAnalysis {
  healthScore: number;
  scoreReasons: string[];
  headline: string;
  summary: string;
  savingsPotential: number;
  financialTip: string;
  topInsights: AIInsight[];
  recommendedActionPlan: string[];
  emergencyFundStatus: { monthsCovered: number; status: string; advice: string };
  vulnerabilities: { category: string; riskLevel: string; observation: string }[];
  investmentPotential: { description: string; expectedReturn: string };
  updatedAt: string;
  periodLabel: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const THINKING_STEPS = [
  "Auditando movimentações...",
  "Limpando faturas das receitas...",
  "Mapeando centros de custo...",
  "Projetando rentabilidade...",
  "Finalizando diagnóstico..."
];

const PRESET_QUESTIONS = [
  { id: 'save', text: 'Como posso reduzir meus gastos?', icon: 'savings', color: 'bg-emerald-50 text-emerald-600' },
  { id: 'emergency', text: 'Meu fundo de reserva está seguro?', icon: 'shield_person', color: 'bg-blue-50 text-blue-600' },
  { id: 'invest', text: 'Onde investir o saldo atual?', icon: 'trending_up', color: 'bg-purple-50 text-purple-600' },
  { id: 'fixed', text: 'Gastos fixos estão altos?', icon: 'home_repair_service', color: 'bg-slate-50 text-slate-600' },
  { id: 'risks', text: 'Quais os maiores riscos?', icon: 'warning', color: 'bg-rose-50 text-rose-600' },
];

const IMPACT_MAP: Record<string, { label: string, color: string, bg: string }> = {
  high: { label: 'Crítico', color: 'text-rose-600', bg: 'bg-rose-100' },
  medium: { label: 'Atenção', color: 'text-amber-600', bg: 'bg-amber-100' },
  low: { label: 'Sugestão', color: 'text-slate-500', bg: 'bg-slate-100' }
};

export const AIAnalysisPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const isPro = currentUser?.isPro || false;

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const transSnapshot = await db.collection('users').doc(currentUser.uid).collection('transactions').get();
        const transData = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
        setAllTransactions(transData);

        const analysisDoc = await db.collection('users').doc(currentUser.uid).collection('ai_analysis').doc('latest').get();
        if (analysisDoc.exists) {
          setAnalysis(analysisDoc.data() as StructuredAnalysis);
        }
      } catch (e) {
        console.error("Erro ao carregar dados:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser]);

  useEffect(() => {
    let interval: any;
    if (isGenerating || isAsking) {
      interval = setInterval(() => setThinkingStep(p => (p + 1) % THINKING_STEPS.length), 2000);
    }
    return () => clearInterval(interval);
  }, [isGenerating, isAsking]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAsking]);

  const handleSpeech = async () => {
    if (!analysis || isSpeaking) return;
    setIsSpeaking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const promptText = `Leia este relatório financeiro de forma executiva e clara: 
      Título: ${analysis.headline}. 
      Resumo: ${analysis.summary}. 
      Dica do especialista: ${analysis.financialTip}. 
      Saúde financeira nota ${analysis.healthScore}.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (e) {
      setIsSpeaking(false);
    }
  };

  const isExcludedFromRevenue = (t: Transaction) => {
    const desc = (t.description || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();
    // Rigor máximo: Pagamento de cartão NUNCA é receita
    const keywords = ['pagamento de cartão', 'fatura', 'cartão de crédito', 'nubank', 'itau', 'bradesco', 'santander', 'card payment', 'estorno', 'reembolso fatura', 'credito fatura'];
    return keywords.some(key => desc.includes(key) || cat.includes(key)) || cat.includes('transferência');
  };

  const periodStats = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = allTransactions.filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end && !t.isIgnored;
    });

    let income = 0;
    let expense = 0;
    const incMap = new Map<string, number>();
    const expMap = new Map<string, number>();

    filtered.forEach(t => {
      if (t.type === 'income') {
        if (!isExcludedFromRevenue(t)) {
            income += t.amount;
            incMap.set(t.category, (incMap.get(t.category) || 0) + t.amount);
        }
      } else {
        expense += t.amount;
        expMap.set(t.category, (expMap.get(t.category) || 0) + t.amount);
      }
    });

    const toCategoryData = (map: Map<string, number>, type: 'income' | 'expense'): CategoryData[] => {
      const palette = type === 'income' ? ['#21C25E', '#10B981', '#059669'] : ['#EF4444', '#F43F5E', '#E11D48'];
      return Array.from(map.entries()).map(([name, amount], i) => ({
          id: name, name, amount, color: palette[i % palette.length], icon: getIconByCategoryName(name)
      })).sort((a, b) => b.amount - a.amount);
    };

    return { income, expense, incomeCats: toCategoryData(incMap, 'income'), expenseCats: toCategoryData(expMap, 'expense'), label: `${new Intl.DateTimeFormat('pt-BR').format(start)} a ${new Intl.DateTimeFormat('pt-BR').format(end)}` };
  }, [allTransactions, startDate, endDate]);

  const handleAskQuestion = async (text: string) => {
    const question = text || inputMessage;
    if (!question.trim() || isAsking || !isPro) return;

    setMessages(prev => [...prev, { role: 'user', content: question, timestamp: new Date() }]);
    setInputMessage('');
    setIsAsking(true);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const context = {
            periodo: periodStats.label,
            totalGanhos: formatCurrency(periodStats.income),
            totalGastos: formatCurrency(periodStats.expense),
            balanço: formatCurrency(periodStats.income - periodStats.expense),
            maioresGastos: periodStats.expenseCats.slice(0, 5).map(c => `${c.name}: ${formatCurrency(c.amount)}`),
            saudeNota: analysis?.healthScore || 'Não calculada'
        };

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ parts: [{ text: `CONTEXTO FINANCEIRO: ${JSON.stringify(context)}. PERGUNTA DO USUÁRIO: "${question}". Responda de forma curta, prática e direta em português.` }] }],
            config: {
                systemInstruction: "Você é o Mentor Financeiro do Poup+. Use o contexto para dar respostas personalizadas. Nunca trate pagamentos de fatura como ganho financeiro.",
            }
        });

        setMessages(prev => [...prev, { role: 'assistant', content: response.text || "Não consegui analisar isso agora.", timestamp: new Date() }]);
    } catch (e) {
        addNotification("Erro na consultoria.", "error");
    } finally {
        setIsAsking(false);
    }
  };

  const handleGenerate = async () => {
    if (!isPro) {
        addNotification("Assine o plano PRO para auditoria com IA.", "info");
        return;
    }
    setIsGenerating(true);
    setThinkingStep(0);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const promptData = {
         period: periodStats.label,
         incomeTotal: periodStats.income,
         expenseTotal: periodStats.expense,
         netBalance: periodStats.income - periodStats.expense,
         topExpenses: periodStats.expenseCats.slice(0, 5).map(c => ({ cat: c.name, val: c.amount }))
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ parts: [{ text: `Gere diagnóstico executivo: ${JSON.stringify(promptData)}` }] }],
        config: {
          responseMimeType: "application/json",
          systemInstruction: "CFO Poup+. JSON rigoroso. Regra de ouro: Pagamentos de fatura são despesas, nunca ganhos.",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              healthScore: { type: Type.INTEGER },
              scoreReasons: { type: Type.ARRAY, items: { type: Type.STRING } },
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              financialTip: { type: Type.STRING },
              topInsights: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, impact: { type: Type.STRING } } } },
              vulnerabilities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, observation: { type: Type.STRING } } } },
            }
          }
        },
      });
      
      const parsed = JSON.parse(response.text.replace(/```json|```/g, '').trim());
      parsed.periodLabel = periodStats.label;
      await db.collection('users').doc(currentUser!.uid).collection('ai_analysis').doc('latest').set(parsed);
      setAnalysis(parsed);
      addNotification('Auditoria concluída!', 'success');
    } catch (e) { 
      addNotification('Falha ao processar dados.', 'error');
    } finally { 
      setIsGenerating(false); 
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-32 space-y-6">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-primary"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Auditoria...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto px-2 lg:px-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-2">
            Poup+ <span className="text-primary italic">Intelligence</span>
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Inteligência Estratégica</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-[24px] shadow-sm border border-slate-100">
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase ml-2">Início</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border-none rounded-xl text-xs font-bold p-2 outline-none focus:ring-1 focus:ring-primary/20" />
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase">Fim</span>
              {/* FIXED: added arrow function parameter 'e' to the onChange handler */}
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border-none rounded-xl text-xs font-bold p-2 outline-none focus:ring-1 focus:ring-primary/20" />
           </div>
           <Button onClick={handleGenerate} disabled={isGenerating || !isPro} className="rounded-xl font-bold bg-slate-900 text-white px-6 h-10 shadow-xl hover:scale-105 transition-all">
                {isGenerating ? 'Analisando...' : 'Gerar Diagnóstico'}
            </Button>
        </div>
      </header>

      <section className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex items-center gap-3 mb-6 px-2">
            <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-xl">psychology</span>
            </div>
            <div>
                <h4 className="text-sm font-black text-slate-800 tracking-tight">Consultoria CFO Poup+</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Atendimento Premium</p>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto max-h-[400px] mb-6 space-y-6 px-2 custom-scrollbar">
            {messages.length === 0 && !isAsking && (
                <div className="text-center py-12">
                    <p className="text-xs text-slate-400 font-medium">Use os botões rápidos ou pergunte algo específico abaixo.</p>
                </div>
            )}
            
            {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[85%] p-4 rounded-3xl ${m.role === 'user' ? 'bg-slate-100 text-slate-800 rounded-tr-none' : 'bg-slate-900 text-white rounded-tl-none shadow-xl'}`}>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        <span className={`text-[8px] mt-2 block opacity-40 uppercase font-bold`}>{m.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
            ))}
            
            {isAsking && (
                <div className="flex justify-start">
                    <div className="bg-slate-900 text-white p-4 rounded-3xl rounded-tl-none flex flex-col gap-2">
                         <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-100"></div>
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-200"></div>
                         </div>
                         <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{THINKING_STEPS[thinkingStep]}</p>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6">
            {PRESET_QUESTIONS.map((q) => (
                <button key={q.id} onClick={() => handleAskQuestion(q.text)} disabled={isAsking || !isPro} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/30 transition-all text-xs font-bold text-slate-700 active:scale-95 disabled:opacity-50">
                    <span className={`material-symbols-outlined text-lg ${q.color.split(' ')[1]}`}>{q.icon}</span>
                    {q.text}
                </button>
            ))}
        </div>

        <div className="relative">
            <input 
                type="text" 
                value={inputMessage} 
                onChange={e => setInputMessage(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAskQuestion(inputMessage)}
                placeholder="Ex: Como economizar R$ 500 no próximo mês?" 
                className="w-full bg-slate-100 rounded-2xl py-4 pl-6 pr-14 text-xs font-bold text-slate-800 outline-none border border-transparent focus:bg-white focus:border-slate-200 focus:shadow-sm transition-all"
            />
            <button 
                onClick={() => handleAskQuestion(inputMessage)}
                disabled={isAsking || !inputMessage.trim() || !isPro}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg active:scale-90 disabled:opacity-50 transition-all"
            >
                <span className="material-symbols-outlined">send</span>
            </button>
        </div>
      </section>

      {isGenerating ? (
        <div className="bg-white rounded-[40px] p-20 text-center border border-slate-100 shadow-xl animate-in zoom-in-95">
          <div className="relative h-24 w-24 mx-auto mb-8">
             <div className="absolute inset-0 rounded-full border-4 border-slate-200 border-t-primary animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary animate-pulse">analytics</span>
             </div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Processando Auditoria</h3>
          <p className="text-slate-400 font-medium">{THINKING_STEPS[thinkingStep]}</p>
        </div>
      ) : analysis ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-8">
          
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="relative h-32 w-32 flex-shrink-0">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="none" stroke="#ffffff10" strokeWidth="3" />
                            <circle cx="18" cy="18" r="16" fill="none" stroke={(analysis?.healthScore ?? 0) > 60 ? '#21C25E' : '#FF4444'} strokeWidth="3" strokeDasharray={`${analysis?.healthScore ?? 0}, 100`} strokeLinecap="round" className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black">{analysis?.healthScore ?? '--'}</span>
                            <span className="text-[8px] font-bold opacity-40 uppercase">Nota</span>
                        </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                           <span className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest">{analysis?.periodLabel || periodStats.label}</span>
                           <button 
                            onClick={handleSpeech}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 transition-all ${isSpeaking ? 'bg-success text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                           >
                             <span className={`material-symbols-outlined text-sm ${isSpeaking ? 'animate-pulse' : ''}`}>{isSpeaking ? 'volume_up' : 'play_circle'}</span>
                             <span className="text-[10px] font-black uppercase tracking-widest">{isSpeaking ? 'Ouvindo...' : 'Ouvir Relatório'}</span>
                           </button>
                        </div>
                        <h3 className="text-2xl font-black leading-tight mb-3">{analysis?.headline}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed mb-4">{analysis?.summary}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                            {(analysis?.scoreReasons ?? []).map((r, i) => (
                                <span key={i} className="text-[9px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-lg border border-white/5">{r}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CategoryChartCard title="Origens de Receita (Real)" type="income" categories={periodStats.incomeCats} total={periodStats.income} />
                <CategoryChartCard title="Centros de Despesa" type="expense" categories={periodStats.expenseCats} total={periodStats.expense} />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-emerald-50 rounded-[32px] p-6 border border-emerald-100 shadow-sm">
                <div className="flex items-start gap-4">
                   <div className="h-10 w-10 rounded-2xl bg-success flex items-center justify-center text-white shrink-0">
                      <span className="material-symbols-outlined text-lg">lightbulb</span>
                   </div>
                   <div className="flex-1">
                      <h4 className="text-sm font-black text-emerald-900 mb-1">Dica de Ouro</h4>
                      <p className="text-xs text-emerald-800 font-medium leading-relaxed italic">"{analysis?.financialTip}"</p>
                   </div>
                </div>
            </div>

            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Raio-X Real</h4>
                <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/30">
                       <span className="text-xs font-bold text-slate-600">Receitas Reais</span>
                       <span className="text-sm font-black text-success">{formatCurrency(periodStats.income)}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-rose-50/50 rounded-2xl border border-rose-100/30">
                       <span className="text-xs font-bold text-slate-600">Despesas Totais</span>
                       <span className="text-sm font-black text-danger">{formatCurrency(periodStats.expense)}</span>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Vulnerabilidades</p>
                        <div className="space-y-3">
                            {(analysis?.vulnerabilities ?? []).map((v, i) => (
                                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                      <p className="text-[11px] font-bold text-slate-700 leading-tight mb-0.5">{v?.category}</p>
                                      <p className="text-[9px] text-slate-400 leading-snug">{v?.observation}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-24 bg-white rounded-[40px] border border-slate-100">
           <span className="material-symbols-outlined text-6xl text-slate-200 mb-6">insights</span>
           <h3 className="text-xl font-bold text-slate-800 mb-2">Diagnóstico Estratégico</h3>
           <p className="text-sm text-slate-400 max-w-sm mx-auto mb-8 font-medium">Selecione as datas acima e clique em "Gerar Diagnóstico" para iniciar a auditoria PRO.</p>
           <Button onClick={handleGenerate} className="rounded-2xl font-bold bg-primary text-white px-12 py-4 shadow-xl shadow-success/20">
              Iniciar Auditoria com IA
           </Button>
        </div>
      )}
    </div>
  );
};
