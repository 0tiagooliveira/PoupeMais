
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { db } from '../../services/firebase';
import firebase from 'firebase/compat/app';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Transaction, CategoryData, Account } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { CategoryChartCard } from '../dashboard/components/CategoryChartCard';
import { getIconByCategoryName } from '../../utils/categoryIcons';
import { useAccounts } from '../../hooks/useAccounts';

// --- Utilitários de Áudio e Imagem ---
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

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper para data local YYYY-MM-DD
const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  isAudio?: boolean;
  isImage?: boolean;
  imageData?: string;
  extractedData?: {
    amount: number;
    description: string;
    category: string;
    date: string;
    type: 'income' | 'expense';
  };
}

const THINKING_STEPS = [
  "Analisando...",
  "Extraindo dados...",
  "Consultando CFO...",
  "Finalizando..."
];

const PRESET_QUESTIONS = [
  { id: 'save', text: 'Como posso reduzir meus gastos?', icon: 'savings' },
  { id: 'emergency', text: 'Meu fundo de reserva está seguro?', icon: 'shield_person' },
  { id: 'invest', text: 'Onde investir o saldo atual?', icon: 'trending_up' },
];

export const AIAnalysisPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const { accounts } = useAccounts();
  const location = useLocation();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Estados de Data com Inicialização Local
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toInputDate(d);
  });
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));
  const [selectedPreset, setSelectedPreset] = useState('currentMonth');

  const isPro = currentUser?.isPro || false;

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) setSelectedAccountId(accounts[0].id);
  }, [accounts]);

  useEffect(() => {
    let timer: any;
    if (isRecording) timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    else setRecordingTime(0);
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const transSnapshot = await db.collection('users').doc(currentUser.uid).collection('transactions').get();
        const transData = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
        setAllTransactions(transData);
        const analysisDoc = await db.collection('users').doc(currentUser.uid).collection('ai_analysis').doc('latest').get();
        if (analysisDoc.exists) setAnalysis(analysisDoc.data() as StructuredAnalysis);

        if (location.state?.focusItem) {
          const item = location.state.focusItem;
          const type = location.state.focusType;
          const label = type === 'transaction' ? (item as Transaction).description : (item as CategoryData).name;
          setTimeout(() => handleAskQuestion(`Analise este item específico: ${label}. Contexto: valor ${formatCurrency(item.amount || (item as Transaction).amount)}, tipo ${type}. Dê um conselho de CFO sobre isso.`), 500);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [currentUser]);

  useEffect(() => {
    let interval: any;
    if (isGenerating || isAsking) interval = setInterval(() => setThinkingStep(p => (p + 1) % THINKING_STEPS.length), 800);
    return () => clearInterval(interval);
  }, [isGenerating, isAsking]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isAsking]);

  const handleFileClick = () => { if (!isPro) { addNotification("Assine o PRO para comprovantes.", "info"); return; } fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { addNotification("Selecione uma imagem.", "warning"); return; }
    const base64 = await fileToBase64(file);
    handleAskQuestion("Analisando comprovante...", undefined, base64);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value;
    setSelectedPreset(preset);
    
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
        case 'currentMonth':
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'lastMonth':
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'last30':
            start = new Date();
            start.setDate(today.getDate() - 30);
            end = today;
            break;
        case 'currentYear':
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31);
            break;
        case 'custom':
            return;
    }
    
    setStartDate(toInputDate(start));
    setEndDate(toInputDate(end));
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
      setSelectedPreset('custom');
      if (type === 'start') setStartDate(value);
      else setEndDate(value);
  }

  const startRecording = async () => {
    if (!isPro) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const base64Audio = await fileToBase64(audioBlob as File);
        handleAskQuestion("Áudio enviado", base64Audio);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { addNotification("Erro no microfone.", "error"); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const generateAndPlayAudio = async (textToRead: string) => {
    if (isSpeaking || !textToRead) return;
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToRead }] }],
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else setIsSpeaking(false);
    } catch (e) { setIsSpeaking(false); }
  };

  const handleAskQuestion = async (text: string, base64Audio?: string, base64Image?: string) => {
    const question = text || inputMessage;
    if ((!question.trim() && !base64Audio && !base64Image) || isAsking || !isPro) return;

    const userMsg: Message = { 
        role: 'user', 
        content: base64Audio ? "Mensagem de voz..." : base64Image ? "Comprovante enviado para análise rápida." : question, 
        timestamp: new Date(),
        isAudio: !!base64Audio,
        isImage: !!base64Image,
        imageData: base64Image
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsAsking(true);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [{ text: `CONTEXTO FINANCEIRO (${periodStats.label}): ${JSON.stringify(periodStats)}.` }];

        if (base64Audio) {
            parts.push({ inlineData: { mimeType: 'audio/webm', data: base64Audio } });
            parts.push({ text: "O usuário enviou este áudio. Responda como o Mentor CFO do Poup+, curto e objetivo." });
        } else if (base64Image) {
            parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Image } });
            parts.push({ text: "Extraia: valor, descrição, data (YYYY-MM-DD), categoria e tipo (income/expense). Retorne texto E um JSON no final." });
        } else {
            parts.push({ text: `PERGUNTA: "${question}". Responda como Mentor CFO.` });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts }],
            config: { systemInstruction: "Você é o Mentor CFO do Poup+. Sofisticado mas acessível. Extraia dados de imagens de recibos se presentes." }
        });

        const fullText = response.text || "";
        let reply = fullText;
        let extractedData = undefined;

        if (base64Image) {
            try {
                const jsonMatch = fullText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    extractedData = JSON.parse(jsonMatch[0]);
                    reply = fullText.replace(jsonMatch[0], '').trim();
                }
            } catch (e) { }
        }

        setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date(), extractedData }]);
        generateAndPlayAudio(reply.length > 200 ? reply.substring(0, 200) + "..." : reply);
    } catch (e) { addNotification("Erro na consultoria.", "error"); } finally { setIsAsking(false); }
  };

  const handleQuickSave = async (data: any, msgIndex: number) => {
    if (!selectedAccountId || savingTransaction) return;
    setSavingTransaction(true);
    try {
        const batch = db.batch();
        const userRef = db.collection('users').doc(currentUser!.uid);
        const transRef = userRef.collection('transactions').doc();
        batch.set(transRef, { ...data, accountId: selectedAccountId, status: 'completed', isFixed: false, isRecurring: false, createdAt: new Date().toISOString() });
        batch.update(userRef.collection('accounts').doc(selectedAccountId), { balance: firebase.firestore.FieldValue.increment(data.type === 'income' ? data.amount : -data.amount) });
        await batch.commit();
        addNotification("Lançamento salvo!", "success");
        setMessages(prev => { const copy = [...prev]; copy[msgIndex].extractedData = undefined; return copy; });
    } catch (e) { addNotification("Erro ao salvar.", "error"); } finally { setSavingTransaction(false); }
  };

  const handleGenerate = async () => {
    if (!isPro) { addNotification("PRO necessário.", "info"); return; }
    setIsGenerating(true);
    setThinkingStep(0);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const promptData = { period: periodStats.label, incomeTotal: periodStats.income, expenseTotal: periodStats.expense, topExpenses: periodStats.expenseCats.slice(0, 5).map(c => ({ cat: c.name, val: c.amount })) };
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Gere diagnóstico CFO: ${JSON.stringify(promptData)}` }] }],
        config: {
          responseMimeType: "application/json",
          systemInstruction: "CFO do Poup+. Retorne JSON estrito.",
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
      addNotification('Auditoria pronta!', 'success');
      generateAndPlayAudio(`${parsed.headline}. ${parsed.summary}`);
    } catch (e) { addNotification('Erro na auditoria.', 'error'); } finally { setIsGenerating(false); }
  };

  const periodStats = useMemo(() => {
    // Ajusta datas para cobrir o dia inteiro em timezone local
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');
    
    const filtered = allTransactions.filter(t => { 
        // Compara com a data UTC salva, convertendo para objeto Date
        const d = new Date(t.date); 
        return d >= start && d <= end && !t.isIgnored; 
    });
    
    let income = 0; let expense = 0; const expMap = new Map<string, number>();
    filtered.forEach(t => { if (t.type === 'income') income += t.amount; else { expense += t.amount; expMap.set(t.category, (expMap.get(t.category) || 0) + t.amount); } });
    const expenseCats = Array.from(expMap.entries()).map(([name, amount], i) => ({ id: name, name, amount, color: ['#EF4444', '#F43F5E', '#E11D48'][i % 3], icon: getIconByCategoryName(name) })).sort((a, b) => b.amount - a.amount);
    
    // Formata o label do período
    const startStr = new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR');
    const endStr = new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR');
    
    return { income, expense, expenseCats, label: `${startStr} a ${endStr}` };
  }, [allTransactions, startDate, endDate]);

  if (loading) return ( <div className="flex flex-col items-center justify-center p-32 space-y-6"> <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-primary"></div> <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IA Sincronizando...</p> </div> );

  return (
    <div className="space-y-10 pb-32 max-w-7xl mx-auto px-2 lg:px-6 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tighter flex items-center gap-3">
            Poup+ <span className="text-primary italic">Intelligence</span>
          </h2>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Consultoria Estratégica Premium</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-2 pr-2 pl-6 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
           <div className="flex items-center gap-4 mr-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">Período</span>
              
              <div className="flex items-center gap-2">
                  {/* Date Inputs - Primary Interface */}
                  <div className="flex items-center gap-2">
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => handleDateChange('start', e.target.value)} 
                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 outline-none p-0 w-[105px] hover:text-primary transition-colors cursor-pointer" 
                    />
                    <span className="text-slate-300 font-light">—</span>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => handleDateChange('end', e.target.value)} 
                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 outline-none p-0 w-[105px] hover:text-primary transition-colors cursor-pointer" 
                    />
                  </div>

                  {/* Preset Dropdown - Secondary/Icon Interface */}
                  <div className="relative group">
                      <button className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-primary hover:text-white transition-all">
                        <span className="material-symbols-outlined text-lg">calendar_month</span>
                      </button>
                      <select 
                        value={selectedPreset} 
                        onChange={handlePresetChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      >
                        <option value="currentMonth">Este Mês</option>
                        <option value="lastMonth">Mês Passado</option>
                        <option value="last30">Últimos 30 dias</option>
                        <option value="currentYear">Este Ano</option>
                        <option value="custom">Personalizado</option>
                      </select>
                  </div>
              </div>
           </div>
           
           <Button 
             onClick={handleGenerate} 
             disabled={isGenerating || !isPro} 
             className="w-full sm:w-auto rounded-[20px] font-black uppercase tracking-widest text-[11px] bg-primary hover:bg-emerald-600 text-white px-8 h-12 shadow-lg shadow-primary/20 transition-transform active:scale-95"
           >
                {isGenerating ? 'Processando...' : 'GERAR DIAGNÓSTICO'}
            </Button>
        </div>
      </header>

      <section className="bg-white dark:bg-slate-900 rounded-[40px] p-8 border border-emerald-100 dark:border-emerald-900/30 shadow-2xl shadow-primary/5 overflow-hidden flex flex-col min-h-[600px] transition-colors">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-[22px] bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/30"><span className="material-symbols-outlined text-3xl font-light">savings</span></div>
                <div><h4 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Consultoria CFO</h4><p className="text-[10px] font-black text-primary uppercase tracking-widest">Mentor Digital Ativo</p></div>
            </div>
            <div className="flex gap-2">
                {isSpeaking && <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full animate-pulse"><span className="material-symbols-outlined text-primary text-sm">volume_up</span></div>}
                {isRecording && <div className="bg-rose-50 px-4 py-2 rounded-full border border-rose-100 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-danger animate-ping"></span><span className="text-[10px] font-black text-danger">{recordingTime}s</span></div>}
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto max-h-[450px] mb-8 space-y-6 px-4 custom-scrollbar">
            {messages.length === 0 && !isAsking && ( <div className="text-center py-20 text-slate-400 font-bold"><p>Envie foto de comprovante, áudio ou texto para auditoria.</p></div> )}
            {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in`}>
                    <div className="max-w-[85%] space-y-3">
                        <div className={`p-5 rounded-[30px] ${m.role === 'user' ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tr-none' : 'bg-primary text-white rounded-tl-none shadow-xl'}`}>
                            {m.isImage && m.imageData && <img src={`data:image/jpeg;base64,${m.imageData}`} className="max-h-56 rounded-2xl mb-4 border-2 border-white/20 shadow-2xl" />}
                            <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{m.content}</p>
                            <span className="text-[9px] mt-2 block opacity-40 uppercase font-black">{m.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        {!isAsking && m.extractedData && (
                            <div className="bg-slate-900 text-white p-6 rounded-[32px] border border-white/10 shadow-2xl animate-in zoom-in-95">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center"><span className="material-symbols-outlined">receipt_long</span></div>
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comprovante Detectado</p><p className="text-sm font-black">{m.extractedData.description}</p></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-5 bg-white/5 p-4 rounded-2xl">
                                    <div><p className="text-[9px] font-bold text-slate-500 uppercase">Valor</p><p className="text-lg font-black text-emerald-400">{formatCurrency(m.extractedData.amount)}</p></div>
                                    <div><p className="text-[9px] font-bold text-slate-500 uppercase">Categoria</p><p className="text-xs font-bold">{m.extractedData.category}</p></div>
                                </div>
                                <div className="space-y-3">
                                    <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-white outline-none">{accounts.map(acc => <option key={acc.id} value={acc.id} className="text-slate-900">{acc.name}</option>)}</select>
                                    <Button onClick={() => handleQuickSave(m.extractedData, i)} disabled={savingTransaction} className="w-full bg-primary hover:bg-emerald-600 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest">{savingTransaction ? 'Salvando...' : 'Confirmar Lançamento'}</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
            {isAsking && ( <div className="flex justify-start"> <div className="bg-primary text-white p-5 rounded-[30px] rounded-tl-none flex flex-col gap-2"> <div className="flex gap-1.5"><div className="w-2 h-2 bg-white rounded-full animate-bounce"></div><div className="w-2 h-2 bg-white rounded-full animate-bounce delay-150"></div><div className="w-2 h-2 bg-white rounded-full animate-bounce delay-300"></div></div> <p className="text-[9px] font-black uppercase text-emerald-100/80">{THINKING_STEPS[thinkingStep]}</p> </div> </div> )}
            <div ref={chatEndRef} />
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-8">
            {PRESET_QUESTIONS.map((q) => ( <button key={q.id} onClick={() => handleAskQuestion(q.text)} disabled={isAsking || isRecording || !isPro} className="flex-shrink-0 flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 hover:border-primary text-xs font-black text-primary"><span className="material-symbols-outlined text-xl">{q.icon}</span>{q.text}</button> ))}
        </div>

        <div className="flex items-center gap-3">
            <div className="relative flex-1">
                <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskQuestion(inputMessage)} placeholder={isRecording ? "Gravando..." : "Pergunte ou envie foto de comprovante..."} disabled={isRecording} className="w-full bg-slate-50 dark:bg-slate-800 rounded-[28px] py-5 pl-8 pr-16 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none border-2 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/20 transition-all" />
                <button onClick={() => handleAskQuestion(inputMessage)} disabled={isAsking || (!inputMessage.trim() && !isRecording) || !isPro} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl active:scale-90"><span className="material-symbols-outlined text-2xl">send</span></button>
            </div>
            <button onClick={handleFileClick} className="h-[60px] w-[60px] rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-primary/20 text-primary hover:bg-primary/5 active:scale-90 transition-all shadow-lg"><span className="material-symbols-outlined text-2xl">photo_camera</span></button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <button onClick={isRecording ? stopRecording : startRecording} disabled={isAsking || !isPro} className={`h-[60px] w-[60px] rounded-full flex items-center justify-center transition-all shadow-xl active:scale-90 ${isRecording ? 'bg-danger text-white animate-pulse' : 'bg-white dark:bg-slate-800 border-2 border-primary/20 text-primary hover:bg-primary/5'}`}><span className="material-symbols-outlined text-3xl font-light">{isRecording ? 'stop' : 'mic'}</span></button>
        </div>
      </section>

      {isGenerating ? ( <div className="bg-white dark:bg-slate-900 rounded-[40px] p-24 text-center border border-emerald-100 dark:border-emerald-900/30 shadow-2xl animate-in zoom-in-95"> <div className="relative h-32 w-32 mx-auto mb-10"><div className="absolute inset-0 rounded-full border-[6px] border-slate-100 dark:border-slate-800 border-t-primary animate-spin"></div></div> <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Gerando Auditoria</h3> </div> ) : analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-12 duration-1000">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-gradient-to-br from-emerald-900 to-slate-900 rounded-[50px] p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="relative h-44 w-44"><svg className="h-full w-full -rotate-90" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="none" stroke="#ffffff08" strokeWidth="3" /><circle cx="18" cy="18" r="16" fill="none" stroke="#21C25E" strokeWidth="3" strokeDasharray={`${analysis.healthScore}, 100`} strokeLinecap="round" className="transition-all duration-[2000ms]" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-5xl font-black">{analysis.healthScore}</span></div></div>
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="flex items-center justify-center md:justify-start gap-4"><span className="text-[10px] font-black bg-white/5 border border-white/10 px-5 py-2 rounded-full uppercase">Período: {analysis.periodLabel}</span><button onClick={() => generateAndPlayAudio(`${analysis.headline}. ${analysis.summary}`)} className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-xl ${isSpeaking ? 'animate-pulse' : ''}`}><span className="material-symbols-outlined text-xl">{isSpeaking ? 'volume_up' : 'play_arrow'}</span></button></div>
                        <h3 className="text-4xl font-black leading-tight tracking-tighter">{analysis.headline}</h3>
                        <p className="text-sm font-medium text-slate-300 leading-relaxed max-w-xl">{analysis.summary}</p>
                    </div>
                </div>
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/5 pt-8">
                    {analysis.scoreReasons.slice(0, 4).map((r, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white/5 px-4 py-3 rounded-2xl border border-white/5"><span className="material-symbols-outlined text-primary text-sm">check_circle</span><span className="text-[10px] font-bold text-slate-200 leading-tight">{r}</span></div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined text-2xl">tips_and_updates</span></div>
                    <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-3">Conselho Prático</h4>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{analysis.financialTip}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined text-2xl">warning</span></div>
                    <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-3">Pontos de Atenção</h4>
                    <ul className="space-y-3">
                        {analysis.vulnerabilities.map((v, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></div>
                                <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{v.category}</span><span className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-tight block">{v.observation}</span></div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
             <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Fluxo do Período</p>
                    <div className="space-y-6">
                        <div><p className="text-xs font-bold text-slate-400 mb-1">Entradas</p><p className="text-3xl font-black text-emerald-400 tracking-tighter">{formatCurrency(periodStats.income)}</p></div>
                        <div><p className="text-xs font-bold text-slate-400 mb-1">Saídas</p><p className="text-3xl font-black text-rose-400 tracking-tighter">{formatCurrency(periodStats.expense)}</p></div>
                        <div className="pt-6 border-t border-white/10"><p className="text-xs font-bold text-slate-400 mb-1">Resultado</p><p className={`text-4xl font-black tracking-tighter ${periodStats.income - periodStats.expense >= 0 ? 'text-white' : 'text-rose-400'}`}>{formatCurrency(periodStats.income - periodStats.expense)}</p></div>
                    </div>
                </div>
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700"></div>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800"><h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Maiores Gastos</h4></div>
                <div className="p-2">
                    {periodStats.expenseCats.slice(0, 5).map((cat, i) => (
                        <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><span className="material-symbols-outlined text-lg">{cat.icon}</span></div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cat.name}</span>
                            </div>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100">{formatCurrency(cat.amount)}</span>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
