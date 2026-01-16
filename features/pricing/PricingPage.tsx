
import React from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';

export const PricingPage: React.FC = () => {
  const { currentUser } = useAuth();

  const plans = [
    {
      name: 'Poup+ Grátis',
      price: 'R$ 0',
      description: 'Ideal para quem está começando a se organizar.',
      buttonText: currentUser?.isPro ? 'Plano Atual' : 'Continuar Grátis',
      buttonVariant: 'secondary' as const,
      features: [
        'Registro manual de transações',
        'Dashboard financeiro básico',
        'Limite de 1 conta bancária',
        'Gráficos de categorias simples',
        'Suporte via comunidade',
      ],
      notIncluded: [
        'Inteligência Artificial (IA)',
        'Importação automática de CSV',
        'Contas ilimitadas',
        'Projeção de Cartão de Crédito',
        'Sincronização entre dispositivos (Premium)',
      ]
    },
    {
      name: 'Poup+ PRO',
      price: 'R$ 19,90',
      period: '/mês',
      description: 'A experiência completa para quem leva finanças a sério.',
      buttonText: currentUser?.isPro ? 'Você já é PRO' : 'Assinar Agora',
      buttonVariant: 'primary' as const,
      highlight: true,
      features: [
        'Tudo do plano Grátis',
        'Poup+ Intelligence (IA Gemini)',
        'Contas e Bancos ilimitados',
        'Importação Automática de CSV',
        'Análise avançada de Cartão de Crédito',
        'Projeções de gastos futuros',
        'Suporte prioritário 24/7',
        'Sem anúncios ou limites',
      ]
    }
  ];

  return (
    <div className="space-y-10 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton className="bg-white shadow-sm border border-slate-100" />
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Planos e Preços</h2>
            <p className="text-sm font-medium text-slate-400">Escolha o nível da sua organização financeira.</p>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[40px] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <h3 className="text-3xl md:text-4xl font-black tracking-tighter mb-4">
              Desbloqueie o poder da <span className="text-success">Inteligência Artificial</span>.
            </h3>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-0">
              O Poup+ PRO não apenas rastreia seus gastos, ele ensina você a economizar usando modelos de linguagem avançados treinados para o mercado brasileiro.
            </p>
          </div>
          <span className="material-symbols-outlined absolute -right-12 -bottom-12 text-white/5 text-[260px] rotate-12 pointer-events-none">auto_awesome</span>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-8 md:grid-cols-2">
        {plans.map((plan, idx) => (
          <div 
            key={idx}
            className={`relative flex flex-col rounded-[40px] p-8 transition-all duration-500 hover:scale-[1.02] ${
              plan.highlight 
                ? 'bg-white border-2 border-primary shadow-2xl ring-4 ring-primary/5' 
                : 'bg-white border border-slate-100 shadow-sm'
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-6 py-1.5 rounded-full shadow-lg">
                Melhor Valor
              </div>
            )}

            <div className="mb-8">
              <h4 className={`text-xl font-black mb-2 ${plan.highlight ? 'text-primary' : 'text-slate-800'}`}>
                {plan.name}
              </h4>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black tracking-tighter text-slate-900">{plan.price}</span>
                {plan.period && <span className="text-slate-400 font-bold text-sm">{plan.period}</span>}
              </div>
              <p className="text-xs font-medium text-slate-400 leading-relaxed">
                {plan.description}
              </p>
            </div>

            <div className="flex-1 space-y-4 mb-10">
              {plan.features.map((feature, fIdx) => (
                <div key={fIdx} className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 ${plan.highlight ? 'bg-success/10 text-success' : 'bg-slate-100 text-slate-400'}`}>
                    <span className="material-symbols-outlined text-[14px] font-black">check</span>
                  </div>
                  <span className="text-sm font-bold text-slate-600">{feature}</span>
                </div>
              ))}
              
              {plan.notIncluded?.map((feature, fIdx) => (
                <div key={fIdx} className="flex items-start gap-3 opacity-40">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 bg-slate-50 text-slate-300">
                    <span className="material-symbols-outlined text-[14px] font-black">close</span>
                  </div>
                  <span className="text-sm font-bold text-slate-400">{feature}</span>
                </div>
              ))}
            </div>

            <Button 
              variant={plan.buttonVariant}
              disabled={currentUser?.isPro && plan.highlight}
              className={`w-full py-5 rounded-[24px] font-black text-sm tracking-tight shadow-xl transition-all ${
                plan.highlight ? 'bg-primary hover:bg-emerald-600 text-white shadow-primary/20' : ''
              }`}
            >
              {plan.buttonText}
            </Button>
          </div>
        ))}
      </div>

      {/* Trust Section */}
      <div className="text-center py-10 max-w-lg mx-auto">
         <span className="material-symbols-outlined text-slate-200 text-4xl mb-4">security</span>
         <h5 className="text-sm font-bold text-slate-800 mb-2">Pagamento Seguro & Transparente</h5>
         <p className="text-[11px] font-medium text-slate-400 leading-relaxed px-6">
           Utilizamos criptografia bancária para processar suas assinaturas. Cancele quando quiser, sem letras miúdas ou taxas de fidelidade.
         </p>
      </div>
    </div>
  );
};
