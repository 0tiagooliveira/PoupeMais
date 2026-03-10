import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { GoogleGenAI, Modality } from '@google/genai';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { CategoryData, Transaction } from '../../types';

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

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const THINKING_STEPS = ['Lendo dados...', 'Calculando métricas...', 'Gerando insights...', 'Finalizando...'];

const PRESET_QUESTIONS = [
  { id: 'save', text: 'Como posso reduzir meus gastos?', icon: 'savings' },
  { id: 'emergency', text: 'Meu fundo de reserva está seguro?', icon: 'shield_person' },
  { id: 'invest', text: 'Onde investir o saldo atual?', icon: 'trending_up' },
  { id: 'fixed', text: 'Gastos fixos estão altos?', icon: 'home_repair_service' },
];

export const AIConsultoriaPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const location = useLocation();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const isPro = currentUser?.isPro || false;

  const periodStats = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = allTransactions.filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= end && !t.isIgnored;
    });

    let income = 0;
    let expense = 0;
    const expenseCats = new Map<string, number>();

    filtered.forEach((t) => {
      if (t.type === 'income') {
        income += t.amount;
      } else {
        expense += t.amount;
        expenseCats.set(t.category, (expenseCats.get(t.category) || 0) + t.amount);
      }
    });

    return {
      income,
      expense,
      label: `${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`,
      topExpenses: Array.from(expenseCats.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [allTransactions, startDate, endDate]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const transSnapshot = await db.collection('users').doc(currentUser.uid).collection('transactions').get();
        const transData = transSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Transaction[];
        setAllTransactions(transData);
      } catch (e) {
        console.error('Erro ao carregar dados da consultoria:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  useEffect(() => {
    let interval: any;
    if (isAsking) {
      interval = setInterval(() => setThinkingStep((p) => (p + 1) % THINKING_STEPS.length), 800);
    }
    return () => clearInterval(interval);
  }, [isAsking]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAsking]);

  const generateAndPlayAudio = async (textToRead: string) => {
    if (isSpeaking || !textToRead) return;
    setIsSpeaking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: textToRead }] }],
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
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

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
      console.error('Erro ao gerar áudio', e);
      setIsSpeaking(false);
    }
  };

  const handleAskQuestion = async (text: string) => {
    const question = text || inputMessage;
    if (!question.trim() || isAsking || !isPro) return;

    setMessages((prev) => [...prev, { role: 'user', content: question, timestamp: new Date() }]);
    setInputMessage('');
    setIsAsking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = {
        periodo: periodStats.label,
        totalGanhos: formatCurrency(periodStats.income),
        totalGastos: formatCurrency(periodStats.expense),
        balanco: formatCurrency(periodStats.income - periodStats.expense),
        maioresGastos: periodStats.topExpenses.slice(0, 3).map((c) => `${c.name}: ${formatCurrency(c.amount)}`),
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              {
                text: `CONTEXTO FINANCEIRO DO USUARIO: ${JSON.stringify(context)}. PERGUNTA: "${question}". Responda como o Mentor CFO do Poup+, de forma pratica, curta e incentivadora em portugues.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: 'Voce e o Mentor CFO do Poup+. Sua linguagem e sofisticada mas acessivel. Seja breve.',
        },
      });

      const reply = response.text || 'Nao consegui processar sua duvida agora.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);
      generateAndPlayAudio(reply);
    } catch (e) {
      addNotification('Erro na consultoria.', 'error');
    } finally {
      setIsAsking(false);
    }
  };

  useEffect(() => {
    if (!location.state?.focusItem || loading || !isPro) return;

    const item = location.state.focusItem;
    const type = location.state.focusType;
    const label = type === 'transaction' ? (item as Transaction).description : (item as CategoryData).name;
    const value = (item as Transaction).amount || (item as CategoryData).amount || 0;

    const timer = setTimeout(() => {
      handleAskQuestion(
        `Analise este item especifico: ${label}. Contexto: valor ${formatCurrency(value)}, tipo ${type}. De um conselho de CFO sobre isso.`,
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [loading, isPro]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-5">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-primary"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregando consultoria...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto px-2 lg:px-4 animate-in fade-in duration-300">
      <header className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton className="bg-slate-50 border border-slate-100 shadow-none" />
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Consultoria CFO</h2>
            <p className="text-[11px] font-bold text-slate-500">Conversa dedicada para duvidas e estrategia financeira.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none w-28" />
            <span className="text-slate-300">-</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none w-28" />
          </div>
          {isSpeaking && (
            <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-3 py-2 rounded-xl">IA falando...</span>
          )}
        </div>
      </header>

      <section className="bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-sm">
        <div className="flex-1 overflow-y-auto max-h-[58vh] mb-5 space-y-4 px-1 custom-scrollbar">
          {messages.length === 0 && !isAsking && (
            <div className="text-center py-16">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300 mb-4">
                <span className="material-symbols-outlined text-3xl">chat_bubble</span>
              </div>
              <p className="text-sm text-slate-500 font-bold max-w-sm mx-auto">Pergunte sobre gastos, metas, fluxo de caixa e acoes praticas para melhorar seu resultado.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[88%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-slate-100 text-slate-800 rounded-tr-sm' : 'bg-primary text-white rounded-tl-sm shadow-md shadow-primary/10'}`}>
                <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{m.content}</p>
                <span className="text-[9px] mt-2 block opacity-50 uppercase font-black">{m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}

          {isAsking && (
            <div className="flex justify-start">
              <div className="bg-primary text-white p-4 rounded-2xl rounded-tl-sm flex flex-col gap-2 shadow-md shadow-primary/10">
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

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4">
          {PRESET_QUESTIONS.map((q) => (
            <button
              key={q.id}
              onClick={() => handleAskQuestion(q.text)}
              disabled={isAsking || !isPro}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 hover:border-primary hover:bg-white transition-all text-xs font-black text-primary active:scale-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">{q.icon}</span>
              {q.text}
            </button>
          ))}
        </div>

        <div className="relative group">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion(inputMessage)}
            placeholder="Pergunte qualquer coisa ao CFO..."
            className="w-full bg-slate-50 rounded-2xl py-4 pl-5 pr-14 text-sm font-bold text-slate-800 outline-none border border-slate-100 focus:bg-white focus:border-primary/30 focus:shadow-sm transition-all"
          />
          <button
            onClick={() => handleAskQuestion(inputMessage)}
            disabled={isAsking || !inputMessage.trim() || !isPro}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center active:scale-90 disabled:opacity-50 transition-all hover:bg-emerald-600"
          >
            <span className="material-symbols-outlined text-xl">send</span>
          </button>
        </div>
      </section>
    </div>
  );
};
