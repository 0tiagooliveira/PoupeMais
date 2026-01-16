
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Transaction } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { getIconByCategoryName } from '../../utils/categoryIcons';

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
  savingsExplanation: string;
  topInsights: AIInsight[];
  recommendedActionPlan: string[];
  financialFreedomEstimate: string;
  categoryDeepDive: { category: string; reason: string; potentialSaving: number }[];
  updatedAt: string;
}

const THINKING_STEPS = [
  "Auditoria de gastos em tempo real...",
  "Calculando índice de saúde financeira...",
  "Projetando cenários de liberdade...",
  "Identificando cortes inteligentes...",
  "Gerando plano de ação executivo..."
];

const IMPACT_MAP: Record<string, { label: string, color: string, bg: string }> = {
  high: { label: 'Alto Impacto', color: 'text-rose-600', bg: 'bg-rose-100' },
  medium: { label: 'Médio Impacto', color: 'text-amber-600', bg: 'bg-amber-100' },
  low: { label: 'Baixo Impacto', color: 'text-slate-500', bg: 'bg-slate-100' }
};

// Categorias que geralmente são fixas ou recorrentes (Heurística para quando a flag não estiver marcada)
const IMPLIED_FIXED_CATEGORIES = [
  'aluguel', 'condomínio', 'energia', 'luz', 'água', 'internet', 
  'telefonia', 'celular', 'plano de saúde', 'escola', 'faculdade', 
  'curso', 'assinaturas', 'streaming', 'netflix', 'spotify', 'academia'
];

export const AIAnalysisPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);

  const isPro = currentUser?.isPro || false;

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const transSnapshot = await db.collection('users').doc(currentUser.uid).collection('transactions').get();
        const transData = transSnapshot.docs.map(doc => doc.data()) as Transaction[];
        setAllTransactions(transData);

        const analysisDoc = await db.collection('users').doc(currentUser.uid).collection('ai_analysis').doc('latest').get();
        if (analysisDoc.exists) {
          const data = analysisDoc.data() as StructuredAnalysis;
          setAnalysis({
             ...data,
             healthScore: Number(data.healthScore) || 0,
             savingsPotential: Number(data.savingsPotential) || 0,
             scoreReasons: data.scoreReasons || [],
             topInsights: data.topInsights || [],
             recommendedActionPlan: data.recommendedActionPlan || [],
             categoryDeepDive: data.categoryDeepDive || []
          });
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
    if (isGenerating) {
      interval = setInterval(() => setThinkingStep(p => (p + 1) % THINKING_STEPS.length), 2000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Função para identificar transações neutras (Pagamento de fatura, estorno, transferência)
  const isNeutralTransaction = (t: Transaction) => {
    const desc = t.description.toLowerCase();
    const cat = t.category.toLowerCase();
    
    return (
        cat.includes('pagamento de cartão') || 
        cat.includes('fatura') ||
        cat.includes('transferência') ||
        desc.includes('pagamento de fatura') ||
        desc.includes('pagamento de cartão') ||
        desc.includes('fatura cartão') ||
        desc.includes('fatura nubank') ||
        desc.includes('fatura itau') ||
        desc.includes('estorno') ||
        cat.includes('estorno')
    );
  };

  // --- ESTATÍSTICAS REAIS (Raio-X) ---
  const generalStats = useMemo(() => {
    const expenseCats: Record<string, number> = {};
    const incomeCats: Record<string, number> = {};
    let fixedTotal = 0;
    let recurringTotal = 0;
    let fixedCount = 0;

    allTransactions.forEach(t => {
        if (t.isIgnored) return;
        
        // Pula transações neutras (pagamentos de cartão, estornos)
        if (isNeutralTransaction(t)) return;
        
        // Categorias e Totais
        if (t.type === 'expense') {
            expenseCats[t.category] = (expenseCats[t.category] || 0) + t.amount;

            // Lógica melhorada para Custos Fixos
            const catLower = t.category.toLowerCase();
            const isImpliedFixed = IMPLIED_FIXED_CATEGORIES.some(c => catLower.includes(c));
            
            if (t.isFixed || isImpliedFixed) {
                fixedTotal += t.amount;
                fixedCount++;
            }
            if (t.isRecurring || isImpliedFixed) {
                recurringTotal += t.amount;
            }

        } else if (t.type === 'income') {
            incomeCats[t.category] = (incomeCats[t.category] || 0) + t.amount;
        }
    });

    const sortAndSlice = (obj: Record<string, number>) => 
        Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
        topExpenses: sortAndSlice(expenseCats),
        topIncome: sortAndSlice(incomeCats),
        fixedTotal,
        fixedCount,
        recurringTotal,
        maxExpenseVal: Math.max(...Object.values(expenseCats), 1) // Para barra de progresso
    };
  }, [allTransactions]);

  const aggregatedContext = useMemo(() => {
    const monthlyMap: Record<string, { inc: number, exp: number, cats: Record<string, number> }> = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    allTransactions.forEach(t => {
      if (!t.date || t.isIgnored) return; 
      if (isNeutralTransaction(t)) return; // Exclui pagamentos de cartão dos dados da IA
      
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return; 
      if (tDate < sixMonthsAgo) return;
      
      const month = t.date.substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { inc: 0, exp: 0, cats: {} };
      if (t.type === 'income') monthlyMap[month].inc += t.amount;
      else {
        monthlyMap[month].exp += t.amount;
        monthlyMap[month].cats[t.category] = (monthlyMap[month].cats[t.category] || 0) + t.amount;
      }
    });

    return Object.entries(monthlyMap).map(([month, data]) => ({
      m: month,
      i: data.inc,
      e: data.exp,
      top: Object.entries(data.cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => ({ n, v }))
    })).sort((a, b) => b.m.localeCompare(a.m));
  }, [allTransactions]);

  const handleGenerate = async () => {
    if (!isPro) return;
    setIsGenerating(true);
    setThinkingStep(0);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const promptData = {
         history: aggregatedContext.slice(-4),
         totalTrans: allTransactions.length
      };

      const prompt = `Analise este perfil financeiro: ${JSON.stringify(promptData)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          systemInstruction: `Você é o Senior Finance AI do app Poup+.
          
          IMPORTANTE: JAMAIS use a palavra "déficit". Substitua por termos como "Desafio Orçamentário", "Saldo Comprometido" ou "Necessidade de Ajuste". Seja construtivo.

          REGRAS ESTRITAS DE SAÍDA (JSON):
          1. "healthScore": Inteiro de 0 a 100.
          2. "scoreReasons": Array com exatos 3 strings curtas.
          3. "headline": Frase de impacto curta.
          4. "summary": Resumo direto em 2 frases.
          5. "savingsPotential": NÚMERO FLOAT PURO.
          6. "savingsExplanation": Frase curta explicando a economia.
          7. "financialFreedomEstimate": String (ex: "12 anos").
          8. "recommendedActionPlan": Array com 4 passos.
          9. "topInsights": Array com 4 objetos. "impact" deve ser 'high', 'medium' ou 'low'.
          
          NUNCA retorne markdown, apenas o JSON puro.`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              healthScore: { type: Type.INTEGER },
              scoreReasons: { type: Type.ARRAY, items: { type: Type.STRING } },
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              savingsPotential: { type: Type.NUMBER },
              savingsExplanation: { type: Type.STRING },
              financialFreedomEstimate: { type: Type.STRING },
              topInsights: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, impact: { type: Type.STRING }, type: { type: Type.STRING } } } },
              recommendedActionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
              categoryDeepDive: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, reason: { type: Type.STRING }, potentialSaving: { type: Type.NUMBER } } } }
            }
          }
        },
      });
      
      let rawText = response.text || "{}";
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      let json;
      try {
        json = JSON.parse(rawText);
      } catch (e) {
        console.error("Erro no parse JSON da IA:", rawText);
        throw new Error("Formato de resposta inválido");
      }

      const parsed: StructuredAnalysis = {
        ...json,
        healthScore: Number(json.healthScore) || 50,
        savingsPotential: Number(json.savingsPotential) || 0,
        scoreReasons: json.scoreReasons?.length ? json.scoreReasons : ["Análise de fluxo", "Verificação de dados", "Projeção inicial"],
        topInsights: json.topInsights || [],
        recommendedActionPlan: json.recommendedActionPlan?.length ? json.recommendedActionPlan : ["Revisar gastos", "Criar orçamento"],
        categoryDeepDive: json.categoryDeepDive || [],
        updatedAt: new Date().toISOString()
      };

      await db.collection('users').doc(currentUser!.uid).collection('ai_analysis').doc('latest').set(parsed);

      setAnalysis(parsed);
      addNotification('Análise atualizada com sucesso!', 'success');
    } catch (e) { 
      console.error(e); 
      addNotification('Ocorreu um erro na análise. Tente novamente.', 'error');
    } finally { 
      setIsGenerating(false); 
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-32 space-y-6">
      <div className="relative">
         <div className="h-16 w-16 animate-spin rounded-full border-[6px] border-slate-100 border-t-primary"></div>
         <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary animate-pulse">lock</span>
         </div>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Processando dados...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto px-2 lg:px-6">
      {/* Header Compacto */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-2">
            Relatório <span className="text-primary bg-primary/10 px-2 rounded-lg">Inteligente</span>
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1">Análise Financeira 360º</p>
        </div>
        {analysis && analysis.updatedAt && (
          <div className="flex items-center gap-2 bg-white border border-slate-100 px-4 py-2 rounded-full shadow-sm">
             <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
               Atualizado {new Date(analysis.updatedAt).toLocaleDateString('pt-BR')}
             </p>
          </div>
        )}
      </header>

      {isGenerating ? (
        <div className="bg-slate-900 rounded-[40px] p-12 text-center text-white shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="mb-8 relative">
             <span className="material-symbols-outlined text-6xl animate-bounce text-primary">psychology</span>
             <div className="absolute top-0 left-1/2 -translate-x-1/2 h-16 w-16 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
          </div>
          <h3 className="text-2xl font-black tracking-tight mb-2">Analisando Padrões</h3>
          <p className="text-slate-400 font-medium animate-pulse">{THINKING_STEPS[thinkingStep]}</p>
        </div>
      ) : (
        <>
          {/* Action Button if no analysis or manual trigger */}
          {!analysis && (
             <div className="text-center py-12">
               <div className="bg-slate-50 rounded-[40px] p-10 border border-slate-100 inline-block max-w-md">
                 <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">auto_awesome</span>
                 <h3 className="text-lg font-bold text-slate-700 mb-2">Descubra insights ocultos</h3>
                 <p className="text-sm text-slate-400 mb-6">Nossa IA analisa cada transação para encontrar oportunidades de economia.</p>
                 <Button onClick={handleGenerate} disabled={!isPro} className="w-full rounded-2xl py-4 font-bold bg-primary text-white shadow-lg shadow-primary/20">
                    {isPro ? 'Gerar Análise Completa' : 'Disponível no Plano PRO'}
                 </Button>
               </div>
             </div>
          )}

          {analysis && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-8 duration-700">
              
              {/* Coluna Principal (Esquerda) */}
              <div className="lg:col-span-8 space-y-8">
                
                {/* Score Card */}
                <div className="relative overflow-hidden rounded-[40px] bg-slate-900 p-8 text-white shadow-2xl">
                   <div className="absolute top-0 right-0 p-12 opacity-5">
                      <span className="material-symbols-outlined text-[200px] rotate-12">health_and_safety</span>
                   </div>
                   
                   <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                      <div className="relative h-32 w-32 flex-shrink-0">
                         <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                            <path className="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                            <path className={`${analysis.healthScore > 70 ? 'text-emerald-500' : analysis.healthScore > 40 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000`} strokeDasharray={`${analysis.healthScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                         </svg>
                         <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black tracking-tighter">{analysis.healthScore}</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Score</span>
                         </div>
                      </div>
                      
                      <div className="flex-1 text-center md:text-left">
                         <h3 className="text-2xl font-black leading-tight mb-2">{analysis.headline}</h3>
                         <p className="text-sm text-slate-400 leading-relaxed font-medium">{analysis.summary}</p>
                         
                         <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-2">
                            {(analysis.scoreReasons || []).map((reason, i) => (
                               <span key={i} className="px-3 py-1 rounded-lg bg-white/10 text-[10px] font-bold uppercase tracking-wide text-slate-300 border border-white/5">
                                 {reason}
                               </span>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>

                {/* Plano de Ação */}
                <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                   <h4 className="flex items-center gap-2 text-lg font-black text-slate-800 mb-6">
                      <span className="material-symbols-outlined text-primary">checklist</span>
                      Plano de Ação Recomendado
                   </h4>
                   <div className="space-y-4">
                      {(analysis.recommendedActionPlan || []).map((step, i) => (
                         <div key={i} className="flex items-start gap-4 group">
                            <div className="h-8 w-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0 font-black text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors">
                               {i + 1}
                            </div>
                            <div className="pt-1.5">
                               <p className="text-sm font-bold text-slate-700 leading-snug">{step}</p>
                            </div>
                         </div>
                      ))}
                      {(!analysis.recommendedActionPlan || analysis.recommendedActionPlan.length === 0) && (
                        <p className="text-sm text-slate-400 italic">Nenhuma ação imediata necessária.</p>
                      )}
                   </div>
                </div>

                {/* Deep Dive de Categorias */}
                {(analysis.categoryDeepDive || []).length > 0 && (
                   <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                      <h4 className="flex items-center gap-2 text-lg font-black text-slate-800 mb-6">
                         <span className="material-symbols-outlined text-primary">pie_chart</span>
                         Análise por Categoria
                      </h4>
                      <div className="grid gap-4">
                         {analysis.categoryDeepDive.map((item, i) => (
                            <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                               <div>
                                  <p className="font-bold text-slate-800">{item.category}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-400 uppercase">Potencial</p>
                                  <p className="text-sm font-black text-emerald-600">+{formatCurrency(item.potentialSaving)}</p>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                )}
              </div>

              {/* Coluna Lateral (Direita) - AGORA COM DADOS REAIS */}
              <div className="lg:col-span-4 space-y-6">
                 
                 {/* Raio-X dos Dados (Estatísticas Reais) */}
                 <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                    <h4 className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest mb-6">
                       Raio-X dos Dados
                    </h4>

                    {/* Custos Fixos & Recorrentes */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                       <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Custos Fixos</p>
                          <p className="text-sm font-black text-slate-800">{formatCurrency(generalStats.fixedTotal)}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{generalStats.fixedCount} transações</p>
                       </div>
                       <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                          <p className="text-[9px] font-black uppercase text-indigo-400 mb-1">Recorrentes</p>
                          <p className="text-sm font-black text-indigo-700">{formatCurrency(generalStats.recurringTotal)}</p>
                          <p className="text-[9px] text-indigo-400 mt-0.5">Assinaturas, etc.</p>
                       </div>
                    </div>

                    {/* Top Despesas */}
                    <div className="mb-6">
                        <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                           <span className="material-symbols-outlined text-rose-500 text-sm">trending_down</span>
                           Onde você mais gasta
                        </p>
                        <div className="space-y-3">
                           {generalStats.topExpenses.map(([cat, val], i) => (
                              <div key={i}>
                                 <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                                    <span className="flex items-center gap-1">
                                       <span className="material-symbols-outlined text-[10px] text-slate-400">{getIconByCategoryName(cat)}</span>
                                       {cat}
                                    </span>
                                    <span>{formatCurrency(val)}</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                       className="h-full bg-rose-400 rounded-full" 
                                       style={{ width: `${(val / generalStats.maxExpenseVal) * 100}%` }}
                                    ></div>
                                 </div>
                              </div>
                           ))}
                           {generalStats.topExpenses.length === 0 && <p className="text-xs text-slate-400 italic">Sem despesas registradas.</p>}
                        </div>
                    </div>

                    {/* Top Receitas */}
                    <div>
                        <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                           <span className="material-symbols-outlined text-emerald-500 text-sm">trending_up</span>
                           Maiores Entradas
                        </p>
                        <div className="space-y-2">
                           {generalStats.topIncome.map(([cat, val], i) => (
                              <div key={i} className="flex justify-between items-center p-2 rounded-xl bg-emerald-50/30 border border-emerald-50">
                                 <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                                    {cat}
                                 </span>
                                 <span className="text-[10px] font-black text-emerald-600">{formatCurrency(val)}</span>
                              </div>
                           ))}
                           {generalStats.topIncome.length === 0 && <p className="text-xs text-slate-400 italic">Sem receitas registradas.</p>}
                        </div>
                    </div>
                 </div>

                 {/* Top Insights (Mantido) */}
                 <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">Principais Insights</h4>
                    {(analysis.topInsights || []).map((insight, i) => {
                       const impact = IMPACT_MAP[insight.impact] || IMPACT_MAP.low;
                       return (
                          <div key={i} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                             <div className="flex items-center justify-between mb-2">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${impact.bg} ${impact.color}`}>
                                   {impact.label}
                                </span>
                                <span className="material-symbols-outlined text-slate-300 text-sm">
                                   {insight.type === 'warning' ? 'warning' : insight.type === 'opportunity' ? 'rocket_launch' : 'lightbulb'}
                                </span>
                             </div>
                             <h5 className="font-bold text-slate-800 text-sm leading-tight mb-1">{insight.title}</h5>
                             <p className="text-xs text-slate-500 leading-relaxed">{insight.description}</p>
                          </div>
                       )
                    })}
                 </div>

                 {/* Re-generate Button */}
                 <Button onClick={handleGenerate} variant="secondary" className="w-full rounded-2xl py-4 font-bold border-slate-200 text-slate-600 hover:bg-white hover:border-primary hover:text-primary transition-all">
                    <span className="material-symbols-outlined text-lg mr-2">refresh</span>
                    Atualizar Análise
                 </Button>

              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
