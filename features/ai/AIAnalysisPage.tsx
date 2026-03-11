
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Transaction, CategoryData } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
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

const THINKING_STEPS = [
  "Lendo dados...",
  "Calculando métricas...",
  "Gerando insights...",
  "Finalizando..."
];

const TEXT_MODELS = ['gemini-3-flash-preview', 'gemini-2.0-flash'];
const GEMINI_TTS_VOICE = 'Sulafat';

const getGeminiApiKey = () => {
  const meta = import.meta as any;
  return (meta?.env?.VITE_GEMINI_API_KEY || meta?.env?.GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY || '').trim();
};

const getGeminiErrorMessage = (error: unknown, fallbackMessage: string) => {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (/API_KEY_INVALID|API key not valid|invalid api key/i.test(raw)) {
    return 'Chave Gemini invalida. Configure VITE_GEMINI_API_KEY com uma chave valida no .env.';
  }
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(raw)) {
    return 'Limite da API Gemini atingido. Tente novamente em alguns minutos.';
  }
  return fallbackMessage;
};

const openNativeDatePicker = (event: React.MouseEvent<HTMLInputElement>) => {
  const target = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
  try {
    target.showPicker?.();
  } catch {
    // Fallback: browsers sem permissao para showPicker no momento do evento usam o picker padrao.
  }
};

const CategoryHorizontalBars: React.FC<{
  title: string;
  categories: CategoryData[];
  total: number;
  tone: 'income' | 'expense';
  onCategoryClick: (category: CategoryData) => void;
}> = ({ title, categories, total, tone, onCategoryClick }) => {
  const [activeId, setActiveId] = useState<string | null>(categories[0]?.id ?? null);
  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{title}</h4>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tone === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          Top categorias
        </span>
      </div>

      {categories.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-50 text-xs font-black uppercase tracking-[0.15em] text-slate-400">Sem dados no periodo</div>
      ) : (
        <div className="space-y-3">
          {categories.slice(0, 7).map((cat) => {
            const pct = total > 0 ? (cat.amount / total) * 100 : 0;
            const isActive = active?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onMouseEnter={() => setActiveId(cat.id)}
                onFocus={() => setActiveId(cat.id)}
                onClick={() => onCategoryClick(cat)}
                className={`w-full rounded-2xl border p-3 text-left transition-all ${isActive ? 'border-slate-300 bg-slate-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">{cat.icon || getIconByCategoryName(cat.name)}</span>
                    <span className="truncate text-sm font-black text-slate-800">{cat.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">{formatCurrency(cat.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, pct)}%`, backgroundColor: cat.color }} />
                </div>
                <p className="mt-1 text-right text-[11px] font-black text-slate-400">{pct.toFixed(1)}% do total</p>
              </button>
            );
          })}

          {active && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">
              Em foco: <span className="font-black text-slate-900">{active.name}</span> representa{' '}
              <span className="font-black text-slate-900">{((active.amount / Math.max(total, 1)) * 100).toFixed(1)}%</span> ({formatCurrency(active.amount)}).
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const IncomeInsightsPanel: React.FC<{
  title: string;
  categories: CategoryData[];
  total: number;
  onCategoryClick: (category: CategoryData) => void;
}> = ({ title, categories, total, onCategoryClick }) => {
  const [activeId, setActiveId] = useState<string | null>(categories[0]?.id ?? null);
  const data = categories.slice(0, 6);
  const active = data.find((category) => category.id === activeId) ?? data[0] ?? null;
  const topThreeTotal = data.slice(0, 3).reduce((sum, category) => sum + category.amount, 0);
  const averageIncome = data.length > 0 ? total / data.length : 0;

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{title}</h4>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Leitura de receitas</span>
      </div>

      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-50 text-xs font-black uppercase tracking-[0.15em] text-slate-400">Sem dados no periodo</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3">
            {data.map((cat, index) => {
              const percentage = total > 0 ? (cat.amount / total) * 100 : 0;
              const isActive = active?.id === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onMouseEnter={() => setActiveId(cat.id)}
                  onFocus={() => setActiveId(cat.id)}
                  onClick={() => onCategoryClick(cat)}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all ${isActive ? 'border-emerald-200 bg-emerald-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl shadow-sm"
                        style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                      >
                        <span className="material-symbols-outlined text-lg">{cat.icon || getIconByCategoryName(cat.name)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{cat.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Top {index + 1} receita do periodo</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-slate-900">{formatCurrency(cat.amount)}</p>
                      <p className="text-[11px] font-bold text-slate-400">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(percentage, 4)}%`, backgroundColor: cat.color }} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Receita em foco</p>
              <p className="mt-3 text-lg font-black leading-tight text-slate-900">{active?.name || 'Sem receitas no periodo'}</p>
              <p className="mt-2 text-[1.8rem] font-black tracking-tight text-primary">{active ? formatCurrency(active.amount) : formatCurrency(0)}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
                {active ? `${((active.amount / Math.max(total, 1)) * 100).toFixed(1)}% de tudo que entrou no intervalo selecionado.` : 'Adicione receitas para destravar a leitura por categoria.'}
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Concentracao</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white bg-white/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Top 3 receitas</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{total > 0 ? `${((topThreeTotal / total) * 100).toFixed(1)}%` : '0.0%'}</p>
                </div>
                <div className="rounded-2xl border border-white bg-white/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Media por categoria</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(averageIncome)}</p>
                </div>
                <div className="rounded-2xl border border-white bg-white/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Categorias ativas</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{data.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export const AIAnalysisPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const preparedAudioBufferRef = useRef<AudioBuffer | null>(null);
  const preparedNarrativeRef = useRef<string>('');
  const autoPlayWhenReadyRef = useRef(false);
  const shouldAutoPlayNextNarrationRef = useRef(false);
  
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);

  const [periodPreset, setPeriodPreset] = useState<'30d' | '90d' | '180d' | '365d' | 'custom'>('90d');
  const [referenceMonth, setReferenceMonth] = useState(() => new Date());

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const isPro = currentUser?.isPro || false;

  // Carregar dados para análise
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
    if (periodPreset === 'custom') return;
    const daysMap = { '30d': 30, '90d': 90, '180d': 180, '365d': 365, custom: 90 };
    const end = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - (daysMap[periodPreset] - 1));

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, [periodPreset, referenceMonth]);

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(() => setThinkingStep(p => (p + 1) % THINKING_STEPS.length), 800); // Acelerado visualmente
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch {
          // Ignora erros de stop em source ja finalizada.
        }
      }
    };
  }, []);

  const ensureAudioContextReady = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch {
        // Alguns navegadores podem bloquear resume fora de gesto valido.
      }
    }
  };

  const stopAudioPlayback = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch {
        // Ignora erros de stop em source ja finalizada.
      }
      audioSourceRef.current = null;
    }
    setIsSpeaking(false);
  };

  const playAudioBuffer = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    stopAudioPlayback();
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    audioSourceRef.current = source;
    source.onended = () => {
      audioSourceRef.current = null;
      setIsSpeaking(false);
    };
    setIsSpeaking(true);
    source.start();
  };

  const requestNarrationAudio = async (textToRead: string): Promise<AudioBuffer | null> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      addNotification('Chave Gemini nao configurada para leitura em voz.', 'error');
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: `Leia em portugues do Brasil com voz humana, natural e acolhedora, em ritmo moderado. Texto: ${textToRead}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio || !audioContextRef.current) return null;

    return decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
  };

  const prepareNarration = async (textToRead: string) => {
    if (!textToRead || isPreparingAudio) return;
    if (preparedNarrativeRef.current === textToRead && preparedAudioBufferRef.current) return;

    setIsPreparingAudio(true);
    try {
      await ensureAudioContextReady();
      const buffer = await requestNarrationAudio(textToRead);
      if (buffer) {
        preparedAudioBufferRef.current = buffer;
        preparedNarrativeRef.current = textToRead;
        if (autoPlayWhenReadyRef.current) {
          autoPlayWhenReadyRef.current = false;
          playAudioBuffer(buffer);
        }
      }
    } catch (e) {
      console.error('Erro ao preparar audio', e);
      addNotification(getGeminiErrorMessage(e, 'Erro ao preparar audio da IA.'), 'error');
    } finally {
      setIsPreparingAudio(false);
    }
  };

  const buildAnalysisNarrative = (data: StructuredAnalysis | null) => {
    if (!data) return '';
    let narrative = `Diagnostico completo do Poup Mais. ${data.headline}. `;
    narrative += `Sua nota de saude financeira e ${data.healthScore} de 100. `;
    narrative += `${data.summary} `;
    narrative += `Minha dica estrategica para voce: ${data.financialTip} `;
    if (data.vulnerabilities && data.vulnerabilities.length > 0) {
      narrative += ' Identifiquei algumas vulnerabilidades importantes: ';
      data.vulnerabilities.forEach((v: any, index: number) => {
        narrative += `${index + 1}. Em ${v.category}, ${v.observation}. `;
      });
    } else {
      narrative += ' Nao encontrei vulnerabilidades criticas. Seu fluxo esta saudavel.';
    }
    return narrative;
  };

  const buildAudioNarrative = (data: StructuredAnalysis | null) => {
    if (!data) return '';
    const topVulnerabilities = (data.vulnerabilities || []).slice(0, 2);
    let narrative = `${data.headline}. `;
    narrative += `Sua nota de saude financeira e ${data.healthScore} de 100. `;
    narrative += `${data.summary} `;
    narrative += `Dica principal: ${data.financialTip} `;
    if (topVulnerabilities.length > 0) {
      narrative += `Alertas: `;
      topVulnerabilities.forEach((v, index) => {
        narrative += `${index + 1}. ${v.category}: ${v.observation}. `;
      });
    }
    return narrative;
  };

  const handlePlayNarration = async () => {
    const narrative = buildAudioNarrative(analysis);
    if (!narrative) return;

    await ensureAudioContextReady();
    if (preparedNarrativeRef.current === narrative && preparedAudioBufferRef.current) {
      playAudioBuffer(preparedAudioBufferRef.current);
      return;
    }

    autoPlayWhenReadyRef.current = true;
    await prepareNarration(narrative);
  };

  const buildFallbackAnalysis = (): StructuredAnalysis => {
    const balance = periodStats.income - periodStats.expense;
    const spendingRatio = periodStats.income > 0 ? (periodStats.expense / periodStats.income) * 100 : 100;
    const scoreBase = Math.max(10, Math.min(95, Math.round(100 - spendingRatio + (balance > 0 ? 8 : -10))));
    const top1 = periodStats.expenseCats[0];
    const top2 = periodStats.expenseCats[1];

    const scoreReasons = [
      balance >= 0 ? 'Saldo positivo no periodo' : 'Saldo negativo no periodo',
      top1 ? `Maior concentracao em ${top1.name}` : 'Sem concentracao relevante de gastos',
      spendingRatio > 85 ? 'Comprometimento alto da renda' : 'Comprometimento da renda controlado'
    ];

    const vulnerabilities = [
      top1
        ? { category: top1.name, observation: `Representa ${((top1.amount / Math.max(periodStats.expense, 1)) * 100).toFixed(1)}% das despesas do periodo.` }
        : { category: 'Despesas', observation: 'Distribuicao equilibrada, sem concentracao extrema.' },
      top2
        ? { category: top2.name, observation: `Segundo maior foco de saida com ${formatCurrency(top2.amount)}.` }
        : { category: 'Planejamento', observation: 'Crie categorias de controle para refinar a analise.' }
    ];

    return {
      healthScore: scoreBase,
      scoreReasons,
      headline: balance >= 0 ? 'Fluxo sob controle com oportunidade de acelerar metas.' : 'Fluxo pressionado: hora de ajuste rapido e objetivo.',
      summary:
        balance >= 0
          ? `Voce fechou o periodo com saldo de ${formatCurrency(balance)}. O proximo passo e transformar esse excedente em aportes automaticos.`
          : `Voce fechou o periodo com deficit de ${formatCurrency(Math.abs(balance))}. Reduzir gastos variaveis nas maiores categorias deve ser prioridade imediata.`,
      financialTip:
        balance >= 0
          ? 'Automatize aportes semanais para sua meta principal e limite gastos impulsivos por categoria.'
          : 'Defina teto semanal para as duas maiores categorias e acompanhe diariamente por 30 dias.',
      vulnerabilities,
      periodLabel: periodStats.label,
    };
  };

  const handleGenerate = async () => {
    if (!isPro) {
        addNotification("Assine o plano PRO para auditoria com IA.", "info");
        return;
    }
    await ensureAudioContextReady();
    shouldAutoPlayNextNarrationRef.current = true;
    setIsGenerating(true);
    setThinkingStep(0);
    
    try {
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        const localAnalysis = buildFallbackAnalysis();
        setAnalysis(localAnalysis);
        addNotification('Chave Gemini nao configurada. Diagnostico assistido gerado localmente.', 'info');
        setIsGenerating(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const promptData = {
         period: periodStats.label,
         incomeTotal: periodStats.income,
         expenseTotal: periodStats.expense,
         netBalance: periodStats.income - periodStats.expense,
         topExpenses: periodStats.expenseCats.slice(0, 5).map(c => ({ cat: c.name, val: c.amount }))
      };

      let response: any = null;
      let lastError: unknown = null;
      for (const model of TEXT_MODELS) {
        try {
          response = await ai.models.generateContent({
            model,
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
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!response) {
        throw lastError ?? new Error('Falha ao gerar resposta com modelos de texto.');
      }
      
      const parsed = JSON.parse(response.text.replace(/```json|```/g, '').trim());
      parsed.periodLabel = periodStats.label;
      setAnalysis(parsed);
      void db.collection('users').doc(currentUser!.uid).collection('ai_analysis').doc('latest').set(parsed);
      addNotification('Auditoria concluída!', 'success');

    } catch (e) { 
      console.error('Erro ao gerar auditoria', e);
      const localAnalysis = buildFallbackAnalysis();
      setAnalysis(localAnalysis);
      addNotification(getGeminiErrorMessage(e, 'Falha ao processar auditoria. Diagnostico assistido exibido.'), 'error');
    } finally { 
      setIsGenerating(false); 
    }
  };

  useEffect(() => {
    const narrative = buildAudioNarrative(analysis);
    if (!narrative) return;

    if (shouldAutoPlayNextNarrationRef.current) {
      shouldAutoPlayNextNarrationRef.current = false;
      autoPlayWhenReadyRef.current = true;
    }

    prepareNarration(narrative);
  }, [analysis]);

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
    const incomeMap = new Map<string, number>();
    const expMap = new Map<string, number>();

    filtered.forEach(t => {
      if (t.type === 'income') {
        income += t.amount;
        incomeMap.set(t.category, (incomeMap.get(t.category) || 0) + t.amount);
      } else {
        expense += t.amount;
        expMap.set(t.category, (expMap.get(t.category) || 0) + t.amount);
      }
    });

    const incomePalette = ['#22c55e', '#4ade80', '#86efac', '#d1fae5', '#9ca3af'];
    const expensePalette = ['#ef4444', '#f87171', '#fca5a5', '#d1d5db', '#9ca3af'];
    const incomeCats = Array.from(incomeMap.entries()).map(([name, amount], i) => ({
      id: name,
      name,
      amount,
      color: incomePalette[i % incomePalette.length],
      icon: getIconByCategoryName(name)
    })).sort((a, b) => b.amount - a.amount);
    const expenseCats = Array.from(expMap.entries()).map(([name, amount], i) => ({
      id: name,
      name,
      amount,
      color: expensePalette[i % expensePalette.length],
      icon: getIconByCategoryName(name)
    })).sort((a, b) => b.amount - a.amount);

    return { income, expense, incomeCats, expenseCats, label: `${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}` };
  }, [allTransactions, startDate, endDate]);

  const aiHighlights = useMemo(() => {
    const net = periodStats.income - periodStats.expense;
    const expenseRatio = periodStats.income > 0 ? (periodStats.expense / periodStats.income) * 100 : 0;
    const topExpense = periodStats.expenseCats[0] ?? null;
    const topIncome = periodStats.incomeCats[0] ?? null;

    return {
      net,
      expenseRatio,
      topExpense,
      topIncome,
      topExpenseShare: topExpense && periodStats.expense > 0 ? (topExpense.amount / periodStats.expense) * 100 : 0,
      topIncomeShare: topIncome && periodStats.income > 0 ? (topIncome.amount / periodStats.income) * 100 : 0,
    };
  }, [periodStats]);

  // Função para navegar para as transações filtradas ao clicar no gráfico da IA
  const handleCategoryClick = (category: CategoryData, type: 'income' | 'expense') => {
    navigate(type === 'income' ? '/incomes' : '/expenses', { 
      state: { 
        category: category.name, 
        type
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
    <div className="mx-auto max-w-[1380px] space-y-8 pb-24 px-2 lg:px-6 animate-in fade-in duration-300">
      <header className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Poup+ IA</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Analise financeira
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">
            Diagnostico visual e direto do periodo selecionado, com foco em fluxo de caixa, concentracao de gastos e pontos de risco.
          </p>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm xl:min-w-[520px]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200 min-h-[64px]">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReferenceMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 border border-slate-200"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                  Mes anterior
                </button>
                <span className="rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-700 border border-slate-200">
                  {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(referenceMonth)}
                </span>
                <button
                  type="button"
                  onClick={() => setReferenceMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 border border-slate-200"
                >
                  Proximo mes
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { key: '30d', label: '30d' },
                  { key: '90d', label: '90d' },
                  { key: '180d', label: '180d' },
                  { key: '365d', label: '365d' },
                  { key: 'custom', label: 'Personalizado' },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPeriodPreset(option.key)}
                    className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-all ${periodPreset === option.key ? 'bg-primary text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {periodPreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={startDate} onClick={openNativeDatePicker} onChange={e => setStartDate(e.target.value)} className="w-32 cursor-pointer rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 outline-none border border-slate-200" />
                  <span className="text-slate-300">-</span>
                  <input type="date" value={endDate} onClick={openNativeDatePicker} onChange={e => setEndDate(e.target.value)} className="w-32 cursor-pointer rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 outline-none border border-slate-200" />
                </div>
              )}
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Periodo ativo: {periodStats.label}
              </div>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !isPro}
              className="h-14 rounded-2xl bg-primary px-8 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-600"
            >
              {isGenerating ? 'Analisando...' : 'Gerar diagnostico'}
            </Button>
          </div>
        </div>
      </header>

      {isGenerating ? (
        <div className="rounded-[36px] border border-slate-200 bg-white px-8 py-20 text-center shadow-sm">
          <div className="relative mx-auto mb-8 h-24 w-24">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-emerald-50 text-primary">
              <span className="material-symbols-outlined text-4xl">analytics</span>
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Gerando diagnostico</h3>
          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">{THINKING_STEPS[thinkingStep]}</p>
        </div>
      ) : analysis ? (
        <div className="space-y-6">
          <div className="space-y-6">
            <section className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start">
                <div className="mx-auto flex flex-col items-center gap-4 xl:pt-1">
                  <div className="relative h-40 w-40">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray={`${analysis?.healthScore ?? 0}, 100`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-5xl font-black tracking-tighter text-slate-900">{analysis?.healthScore ?? '--'}</span>
                      <span className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Health score</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 text-center xl:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2 xl:justify-start">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Periodo: {analysis?.periodLabel}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      Relatorio estrategico
                    </span>
                  </div>
                  <h3 className="break-words text-3xl font-black leading-[1.08] tracking-tight text-slate-900 lg:text-[2.3rem] xl:text-[2.6rem]">{analysis?.headline}</h3>
                  <p className="max-w-3xl text-base font-semibold leading-8 text-slate-600">{analysis?.summary}</p>
                  <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 lg:p-6">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Player do diagnostico</p>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-emerald-700 shadow-sm">
                        {isSpeaking ? 'Ao vivo' : isPreparingAudio ? 'Preparando audio' : 'Pronto'}
                      </span>
                    </div>
                    <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-emerald-100">
                      <div className={`h-full rounded-full bg-emerald-500 transition-all ${isSpeaking ? 'w-full' : isPreparingAudio ? 'w-2/3 animate-pulse' : 'w-0'}`} />
                    </div>
                    <p className="mb-4 text-base font-bold leading-7 text-emerald-900">
                      {isSpeaking ? 'A IA esta narrando agora.' : isPreparingAudio ? 'A IA esta preparando a voz. A reproducao iniciara automaticamente.' : 'Narracao pronta para reproducao.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 xl:justify-start">
                      <button
                        onClick={handlePlayNarration}
                        disabled={isPreparingAudio}
                        className={`flex h-14 min-w-[190px] items-center justify-center gap-3 rounded-2xl border border-emerald-300 bg-white px-5 text-sm font-black uppercase tracking-[0.14em] text-primary transition-all hover:bg-emerald-100 disabled:opacity-70 ${isSpeaking ? 'animate-pulse' : ''}`}
                        title="Ouvir diagnostico"
                      >
                        <span className="material-symbols-outlined text-2xl">{isSpeaking ? 'volume_up' : isPreparingAudio ? 'hourglass_top' : 'play_arrow'}</span>
                        {isSpeaking ? 'Tocando' : isPreparingAudio ? 'Carregando voz' : 'Ouvir agora'}
                      </button>
                      <button
                        onClick={stopAudioPlayback}
                        className="flex h-14 min-w-[130px] items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:bg-slate-100"
                        title="Parar audio"
                      >
                        <span className="material-symbols-outlined text-2xl">stop</span>
                        Parar
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(analysis?.scoreReasons ?? []).map((reason, index) => (
                      <div key={index} className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-left shadow-sm">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Sinal {index + 1}</p>
                        <p className="mt-2 text-sm font-black leading-6 text-slate-900 lg:text-base">
                        {reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Entradas</span>
                    <p className="mt-3 break-words text-[clamp(1.6rem,2.6vw,2.1rem)] font-black tracking-tight text-primary">{formatCurrency(periodStats.income)}</p>
                  </div>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/80 text-primary shadow-sm">
                    <span className="material-symbols-outlined">trending_up</span>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-emerald-800">Todas as receitas consolidadas do periodo.</p>
              </div>
              <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">Despesas</span>
                    <p className="mt-3 break-words text-[clamp(1.6rem,2.6vw,2.1rem)] font-black tracking-tight text-red-500">{formatCurrency(periodStats.expense)}</p>
                  </div>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/80 text-red-500 shadow-sm">
                    <span className="material-symbols-outlined">trending_down</span>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-red-700">Saidas acumuladas dentro do intervalo ativo.</p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Saldo</span>
                    <p className={`mt-3 break-words text-[clamp(1.6rem,2.6vw,2.1rem)] font-black tracking-tight ${periodStats.income - periodStats.expense >= 0 ? 'text-primary' : 'text-red-500'}`}>
                      {formatCurrency(periodStats.income - periodStats.expense)}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/80 text-slate-700 shadow-sm">
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-600">Resultado liquido entre entradas e despesas.</p>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Leitura de fluxo do periodo</h4>
                    <p className="mt-1 text-lg font-black tracking-tight text-slate-900">Resumo claro sem grafico fraco</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Visao executiva</span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Saldo do periodo</p>
                    <p className={`mt-3 text-[clamp(1.8rem,3vw,2.5rem)] font-black tracking-tight ${aiHighlights.net >= 0 ? 'text-primary' : 'text-red-500'}`}>
                      {formatCurrency(aiHighlights.net)}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                      {aiHighlights.net >= 0 ? 'Entradas acima das saidas no intervalo selecionado.' : 'Saidas acima das entradas no intervalo selecionado.'}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-red-200 bg-red-50 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-600">Pressao das despesas</p>
                    <p className="mt-3 text-[clamp(1.8rem,3vw,2.5rem)] font-black tracking-tight text-red-500">
                      {aiHighlights.expenseRatio.toFixed(1)}%
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                      Percentual da receita consumido pelas despesas do periodo.
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Maior categoria de gasto</p>
                    <p className="mt-3 truncate text-xl font-black tracking-tight text-slate-900">
                      {aiHighlights.topExpense?.name || 'Sem despesas'}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
                      {aiHighlights.topExpense ? `${formatCurrency(aiHighlights.topExpense.amount)} • ${aiHighlights.topExpenseShare.toFixed(1)}% das saidas.` : 'Sem movimentacao de despesas no periodo.'}
                    </p>
                  </div>
                </div>
              </div>

              <CategoryHorizontalBars
                title="Mapa de gastos por categoria"
                tone="expense"
                categories={periodStats.expenseCats}
                total={periodStats.expense}
                onCategoryClick={(category) => handleCategoryClick(category, 'expense')}
              />
            </section>

            <section>
              <IncomeInsightsPanel
                title="Panorama de receitas por categoria"
                categories={periodStats.incomeCats}
                total={periodStats.income}
                onCategoryClick={(category) => handleCategoryClick(category, 'income')}
              />
            </section>

            <section className="rounded-[32px] border border-emerald-200 bg-white p-6 shadow-sm lg:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-primary shadow-sm">
                    <span className="material-symbols-outlined text-2xl">tips_and_updates</span>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Dica do CFO</p>
                    <p className="mt-3 text-xl font-black leading-9 text-slate-900">{analysis?.financialTip}</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-5xl text-emerald-200">lightbulb</span>
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
              <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Vulnerabilidades</h4>
              <div className="mt-5 space-y-4">
                {(analysis?.vulnerabilities ?? []).map((v, i) => (
                  <div key={i} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start gap-3">
                      <span className="mt-2 h-3 w-3 flex-shrink-0 rounded-full bg-red-400"></span>
                      <div>
                        <p className="text-lg font-black text-slate-900">{v?.category}</p>
                        <p className="mt-2 text-base font-semibold leading-8 text-slate-500">{v?.observation}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {analysis?.vulnerabilities.length === 0 && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                    <span className="material-symbols-outlined text-3xl text-primary">verified</span>
                    <p className="mt-2 text-sm font-black text-primary">Fluxo saudavel</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="rounded-[36px] border border-slate-200 bg-white px-8 py-24 text-center shadow-sm">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-50 text-primary">
            <span className="material-symbols-outlined text-4xl">analytics</span>
          </div>
          <h3 className="text-3xl font-black tracking-tight text-slate-900">Pronto para a analise?</h3>
          <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-8 text-slate-500">
            Gere o relatorio da Poup+ IA para entender seu fluxo do periodo, enxergar concentracao de gastos e identificar riscos de caixa.
          </p>
          <Button onClick={handleGenerate} className="mt-8 h-14 rounded-2xl bg-primary px-10 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-100 hover:bg-emerald-600">
            Iniciar analise
          </Button>
        </div>
      )}
    </div>
  );
};
