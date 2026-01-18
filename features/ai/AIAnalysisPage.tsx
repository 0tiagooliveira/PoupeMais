
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
}

interface StructuredAnalysis {
  healthScore: number;
  scoreReasons: string[];
  headline: string;
  summary: string;
  financialTip: string;
  vulnerabilities: { category: string; observation: string }[];
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
  { id: 'save', text: 'Como posso reduzir meus gastos?', icon: 'savings' },
  { id: 'emergency', text: 'Meu fundo de reserva está seguro?', icon: 'shield_person' },
  { id: 'invest', text: 'Onde investir o saldo atual?', icon: 'trending_up' },
  { id: 'fixed', text: 'Gastos fixos estão altos?', icon: 'home_repair_service' },
];

export const AIAnalysisPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const location = useLocation();
  const navigate = useNavigate(); // Hook de navegação adicionado
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

  // Carregar dados e checar contexto de foco
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

        // Se o usuário veio de um clique específico (ex: categoria ou transação), iniciamos a análise focada
        if (location.state?.focusItem) {
          const item = location.state.focusItem;
          const type = location.state.focusType;
          const label = type === 'transaction' ? (item as Transaction).description : (item as CategoryData).name;
          
          // Pequeno delay para garantir que os stats do período base foram carregados (mesmo que parciais)
          setTimeout(() => {
             handleAskQuestion(`Analise este item específico: ${label}. Contexto: valor ${formatCurrency(item.amount || (item as Transaction).amount)}, tipo ${type}. Dê um conselho de CFO sobre isso.`);
          }, 500);
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
      interval = setInterval(() => setThinkingStep(p => (p + 1) % THINKING_STEPS.length), 1500);
    }
    return () => clearInterval(interval);
  }, [isGenerating, isAsking]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAsking]);

  const generateAndPlayAudio = async (textToRead: string) => {
    if (isSpeaking || !textToRead) return;
    setIsSpeaking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToRead }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // Tom calmo e profissional
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
        if (ctx.state === 'suspended') await ctx.resume();

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
      console.error("Erro ao gerar áudio", e);
      setIsSpeaking(false);
    }
  };

  const handleAskQuestion = async (text: string) => {
    const question = text || inputMessage;
    if (!question.trim() || isAsking || !isPro) return;

    setMessages(prev => [...prev, { role: 'user', content: question, timestamp: new Date() }]);
    setInputMessage('');
    setIsAsking(true);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        // Usamos os stats calculados do período atual como contexto
        const context = {
            periodo: periodStats.label,
            totalGanhos: formatCurrency(periodStats.income),
            totalGastos: formatCurrency(periodStats.expense),
            balanço: formatCurrency(periodStats.income - periodStats.expense),
            maioresGastos: periodStats.expenseCats.slice(0, 3).map(c => `${c.name}: ${formatCurrency(c.amount)}`)
        };

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ parts: [{ text: `CONTEXTO FINANCEIRO DO USUÁRIO: ${JSON.stringify(context)}. PERGUNTA: "${question}". Responda como o Mentor CFO do Poup+, de forma prática, curta e incentivadora em português.` }] }],
            config: {
                systemInstruction: "Você é o Mentor CFO do Poup+. Sua linguagem é sofisticada mas acessível. Nunca ignore o contexto dos gastos reais do usuário fornecidos.",
            }
        });

        const reply = response.text || "Não consegui processar sua dúvida agora.";
        setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);
        
        // Auto-play the answer
        generateAndPlayAudio(reply);

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
        contents: [{ parts: [{ text: `Gere um diagnóstico CFO rigoroso baseado neste cenário: ${JSON.stringify(promptData)}` }] }],
        config: {
          responseMimeType: "application/json",
          systemInstruction: "CFO do Poup+. Retorne JSON estrito. Regra de ouro: Pagamentos de fatura são despesas reais de caixa, não ignore o impacto. headline deve ser curta e forte.",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              healthScore: { type: Type.INTEGER },
              scoreReasons: { type: Type.ARRAY, items: { type: Type.STRING } },
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              financialTip: { type: Type.STRING },
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
      
      // Auto-play diagnostic com estrutura rica e detalhada
      const topCategoriesText = periodStats.expenseCats.slice(0, 3)
        .map(c => `${c.name}: ${formatCurrency(c.amount)}`)
        .join('. ');

      const vulnerabilitiesText = parsed.vulnerabilities
        .map((v: any) => `${v.category}. ${v.observation}`)
        .join('. ');

      const diagnosticText = `
        Relatório Poup+ Intelligence Gerado. ${parsed.headline}.
        
        Fluxo Auditoria Reais: Entradas Brutas de ${formatCurrency(periodStats.income)}. Saídas Totais de ${formatCurrency(periodStats.expense)}.
        
        Mapeamento de Gastos. As maiores categorias foram: ${topCategoriesText}.
        
        Pulo do Gato: "${parsed.financialTip}".
        
        Vulnerabilidades de Caixa detectadas: ${vulnerabilitiesText}.
        
        Sua nota de saúde financeira é ${parsed.healthScore}.
      `.replace(/\s+/g, ' ').trim();

      generateAndPlayAudio(diagnosticText);

    } catch (e) { 
      addNotification('Falha ao processar auditoria.', 'error');
    } finally { 
      setIsGenerating(false); 
    }
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
    const expMap = new Map<string, number>();

    filtered.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else {
        expense += t.amount;
        expMap.set(t.category, (expMap.get(t.category) || 0) + t.amount);
      }
    });

    const expenseCats = Array.from(expMap.entries()).map(([name, amount], i) => ({
      id: name, name, amount, color: ['#EF4444', '#F43F5E', '#E11D48'][i % 3], icon: getIconByCategoryName(name)
    })).sort((a, b) => b.amount - a.amount);

    return { income, expense, expenseCats, label: `${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}` };
  }, [allTransactions, startDate, endDate]);

  // Função para navegar para as transações filtradas ao clicar no gráfico da IA
  const handleCategoryClick = (category: CategoryData) => {
    navigate('/expenses', { 
      state: { 
        category: category.name, 
        type: 'expense'
      } 
    });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-32 space-y-6">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-primary"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando IA...</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-32 max-w-7xl mx-auto px-2 lg:px-6 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
            Poup+ <span className="text-primary italic">Intelligence</span>
          </h2>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Consultoria Estratégica Premium</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-[32px] shadow-sm border border-slate-100">
           <div className="flex items-center gap-3 px-2">
              <span className="text-[10px] font-black text-slate-300 uppercase">Período</span>
              <div className="flex items-center gap-1 bg-slate-50 rounded-2xl px-3 py-2 border border-slate-100/50 focus-within:border-primary/30 transition-all">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none w-28" />
                <span className="text-slate-300 mx-1">—</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none w-28" />
              </div>
           </div>
           <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !isPro} 
                className="rounded-2xl font-black uppercase tracking-widest text-[10px] bg-primary hover:bg-emerald-600 text-white px-8 h-12 shadow-xl shadow-primary/20 hover:scale-[1.03] active:scale-[0.97] transition-all"
           >
                {isGenerating ? 'Analisando...' : 'Gerar Diagnóstico'}
            </Button>
        </div>
      </header>

      {/* CFO CONSULTANCY SECTION */}
      <section className="bg-white rounded-[40px] p-8 border border-emerald-100 shadow-2xl shadow-primary/5 overflow-hidden flex flex-col min-h-[500px]">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-[22px] bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/30">
                    <span className="material-symbols-outlined text-3xl font-light">savings</span>
                </div>
                <div>
                    <h4 className="text-xl font-black text-slate-800 tracking-tight">Consultoria CFO</h4>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Mentor Digital Ativo</p>
                </div>
            </div>
            {isSpeaking && (
                <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full animate-pulse">
                   <span className="material-symbols-outlined text-primary text-sm">volume_up</span>
                   <span className="text-[10px] font-black text-primary uppercase">IA falando...</span>
                </div>
            )}
        </div>
        
        <div className="flex-1 overflow-y-auto max-h-[400px] mb-8 space-y-6 px-4 custom-scrollbar">
            {messages.length === 0 && !isAsking && (
                <div className="text-center py-20">
                    <div className="inline-flex h-20 w-20 items-center justify-center rounded-[32px] bg-slate-50 text-slate-300 mb-6">
                       <span className="material-symbols-outlined text-4xl">chat_bubble</span>
                    </div>
                    <p className="text-sm text-slate-400 font-bold max-w-xs mx-auto">Tire dúvidas sobre seus gastos específicos ou peça estratégias de economia.</p>
                </div>
            )}
            
            {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[85%] p-5 rounded-[30px] ${m.role === 'user' ? 'bg-slate-100 text-slate-800 rounded-tr-none' : 'bg-primary text-white rounded-tl-none shadow-2xl shadow-primary/10'}`}>
                        <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        <span className={`text-[9px] mt-3 block opacity-40 uppercase font-black`}>{m.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
            ))}
            
            {isAsking && (
                <div className="flex justify-start">
                    <div className="bg-primary text-white p-5 rounded-[30px] rounded-tl-none flex flex-col gap-3 shadow-2xl shadow-primary/10">
                         <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-150"></div>
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-300"></div>
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100/80">{THINKING_STEPS[thinkingStep]}</p>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-8">
            {PRESET_QUESTIONS.map((q) => (
                <button key={q.id} onClick={() => handleAskQuestion(q.text)} disabled={isAsking || !isPro} className="flex-shrink-0 flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-50 border border-emerald-100 hover:border-primary hover:bg-white hover:shadow-xl transition-all text-xs font-black text-primary active:scale-95 disabled:opacity-50">
                    <span className="material-symbols-outlined text-xl">{q.icon}</span>
                    {q.text}
                </button>
            ))}
        </div>

        <div className="relative group">
            <input 
                type="text" 
                value={inputMessage} 
                onChange={e => setInputMessage(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAskQuestion(inputMessage)}
                placeholder="Pergunte qualquer coisa ao CFO..." 
                className="w-full bg-slate-50 rounded-[28px] py-5 pl-8 pr-16 text-sm font-bold text-slate-800 outline-none border-2 border-transparent focus:bg-white focus:border-primary/20 focus:shadow-2xl transition-all selection:bg-primary/20"
            />
            <button 
                onClick={() => handleAskQuestion(inputMessage)}
                disabled={isAsking || !inputMessage.trim() || !isPro}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl active:scale-90 disabled:opacity-50 transition-all hover:bg-emerald-600"
            >
                <span className="material-symbols-outlined text-2xl">send</span>
            </button>
        </div>
      </section>

      {isGenerating ? (
        <div className="bg-white rounded-[40px] p-24 text-center border border-emerald-100 shadow-2xl animate-in zoom-in-95">
          <div className="relative h-32 w-32 mx-auto mb-10">
             <div className="absolute inset-0 rounded-full border-[6px] border-slate-100 border-t-primary animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-primary animate-pulse font-light">analytics</span>
             </div>
          </div>
          <h3 className="text-3xl font-black text-slate-800 tracking-tighter mb-4">Gerando Auditoria</h3>
          <p className="text-primary font-black uppercase text-[11px] tracking-[0.3em]">{THINKING_STEPS[thinkingStep]}</p>
        </div>
      ) : analysis ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-12 duration-1000">
          
          <div className="lg:col-span-8 space-y-8">
            {/* PREMIUM DIAGNOSTIC CARD */}
            <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 rounded-[50px] p-10 text-white shadow-[0_35px_60px_-15px_rgba(33,194,94,0.15)] relative overflow-hidden group border border-white/5">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none transition-transform group-hover:scale-125 duration-[2000ms]"></div>
                <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-white/5 rounded-full blur-[60px] pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="relative h-44 w-44 flex-shrink-0">
                        <svg className="h-full w-full -rotate-90 filter drop-shadow-[0_0_15px_rgba(33,194,94,0.3)]" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="none" stroke="#ffffff08" strokeWidth="3" />
                            <circle cx="18" cy="18" r="16" fill="none" stroke="#21C25E" strokeWidth="3" strokeDasharray={`${analysis?.healthScore ?? 0}, 100`} strokeLinecap="round" className="transition-all duration-[2000ms] ease-out" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-black tracking-tighter text-white drop-shadow-2xl">{analysis?.healthScore ?? '--'}</span>
                            <span className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] mt-1">Health Score</span>
                        </div>
                    </div>
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="flex items-center justify-center md:justify-start gap-4">
                           <span className="text-[10px] font-black bg-white/5 border border-white/10 px-5 py-2 rounded-full uppercase tracking-widest text-emerald-100/60 shadow-inner">Período: {analysis?.periodLabel}</span>
                           <button 
                             onClick={() => generateAndPlayAudio(
                               `Relatório Poup+ Intelligence. ${analysis.headline}. Fluxo Auditoria Reais: Entradas Brutas de ${formatCurrency(periodStats.income)}. Saídas Totais de ${formatCurrency(periodStats.expense)}. Mapeamento de Gastos: As maiores categorias foram: ${periodStats.expenseCats.slice(0, 3).map(c => `${c.name}: ${formatCurrency(c.amount)}`).join('. ')}. Pulo do Gato: ${analysis.financialTip}. Vulnerabilidades de Caixa: ${analysis.vulnerabilities.map(v => `${v.category}. ${v.observation}`).join('. ')}. Nota de saúde: ${analysis.healthScore}.`
                             )}
                             className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white hover:bg-emerald-400 transition-all shadow-xl shadow-primary/20 ${isSpeaking ? 'animate-pulse scale-110' : ''}`}
                           >
                             <span className="material-symbols-outlined text-xl">{isSpeaking ? 'volume_up' : 'play_arrow'}</span>
                           </button>
                        </div>
                        <h3 className="text-4xl font-black leading-[1.1] tracking-tighter text-white drop-shadow-2xl">{analysis?.headline}</h3>
                        <p className="text-base text-emerald-100/70 leading-relaxed font-bold max-w-xl">{analysis?.summary}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-4">
                            {(analysis?.scoreReasons ?? []).map((r, i) => (
                                <span key={i} className="text-[10px] font-black uppercase tracking-widest bg-emerald-700/30 text-emerald-200 px-4 py-2.5 rounded-2xl border border-emerald-600/20 backdrop-blur-sm shadow-sm">{r}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
                   <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-8 px-1">Fluxo Auditoria Reais</h4>
                   <div className="space-y-6">
                      <div className="group flex justify-between items-center p-6 bg-emerald-50/40 rounded-[30px] border border-emerald-100/50 hover:bg-emerald-50 transition-all">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined">trending_up</span></div>
                            <span className="text-xs font-black text-emerald-800 uppercase tracking-tight">Entradas Brutas</span>
                         </div>
                         <span className="text-xl font-black text-primary tracking-tighter">{formatCurrency(periodStats.income)}</span>
                      </div>
                      <div className="group flex justify-between items-center p-6 bg-rose-50/40 rounded-[30px] border border-rose-100/50 hover:bg-rose-50 transition-all">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center"><span className="material-symbols-outlined">trending_down</span></div>
                            <span className="text-xs font-black text-rose-800 uppercase tracking-tight">Saídas Totais</span>
                         </div>
                         <span className="text-xl font-black text-danger tracking-tighter">{formatCurrency(periodStats.expense)}</span>
                      </div>
                   </div>
                </div>
                {/* Gráfico Interativo com navegação */}
                <CategoryChartCard 
                    title="Mapeamento de Gastos" 
                    type="expense" 
                    categories={periodStats.expenseCats} 
                    total={periodStats.expense}
                    onCategoryClick={handleCategoryClick} 
                />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-primary rounded-[40px] p-8 text-white shadow-2xl shadow-primary/30 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                    <span className="material-symbols-outlined text-[150px] rotate-12">lightbulb</span>
                </div>
                <div className="flex flex-col gap-6 relative z-10">
                   <div className="h-14 w-14 rounded-[20px] bg-white flex items-center justify-center text-primary shrink-0 shadow-2xl">
                      <span className="material-symbols-outlined text-3xl font-light">tips_and_updates</span>
                   </div>
                   <div>
                      <h4 className="text-[11px] font-black text-emerald-900/60 uppercase tracking-[0.2em] mb-2">Pulo do Gato</h4>
                      <p className="text-lg text-white font-black leading-tight italic tracking-tight">"{analysis?.financialTip}"</p>
                   </div>
                </div>
            </div>

            <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
                <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-8">Vulnerabilidades de Caixa</h4>
                <div className="space-y-4">
                    {(analysis?.vulnerabilities ?? []).map((v, i) => (
                        <div key={i} className="p-6 bg-slate-50 rounded-[30px] border border-slate-100 hover:bg-white hover:border-primary/20 hover:shadow-2xl transition-all group">
                              <p className="text-sm font-black text-slate-800 leading-tight mb-2 flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse"></span>
                                {v?.category}
                              </p>
                              <p className="text-[11px] text-slate-500 font-bold leading-relaxed">{v?.observation}</p>
                        </div>
                    ))}
                    {analysis?.vulnerabilities.length === 0 && (
                        <div className="text-center py-6">
                            <span className="material-symbols-outlined text-primary text-4xl mb-2">verified</span>
                            <p className="text-xs font-black text-slate-400 uppercase">Fluxo Saudável</p>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-32 bg-white rounded-[50px] border border-emerald-50 shadow-2xl shadow-primary/5">
           <div className="inline-flex h-24 w-24 items-center justify-center rounded-[36px] bg-emerald-50 text-primary mb-8 shadow-inner">
              <span className="material-symbols-outlined text-5xl font-light">analytics</span>
           </div>
           <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tighter">Pronto para a Auditoria?</h3>
           <p className="text-base text-slate-400 max-w-sm mx-auto mb-12 font-bold leading-relaxed">Clique no botão abaixo para que o Poup+ Intelligence analise suas movimentações reais.</p>
           <Button onClick={handleGenerate} className="rounded-[24px] font-black uppercase tracking-[0.2em] text-[11px] bg-primary hover:bg-emerald-600 text-white px-16 py-6 shadow-[0_20px_40px_-10px_rgba(33,194,94,0.3)] transition-all hover:scale-[1.05] active:scale-[0.95]">
              Iniciar Auditoria Pro
           </Button>
        </div>
      )}
    </div>
  );
};
