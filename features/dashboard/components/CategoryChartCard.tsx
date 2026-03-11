
import React, { useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { formatCurrency } from '../../../utils/formatters';
import { CategoryData } from '../../../types';

interface CategoryChartCardProps {
  title: string;
  type: 'income' | 'expense';
  categories: CategoryData[];
  total: number;
  onCategoryClick?: (category: CategoryData) => void;
}

export const CategoryChartCard: React.FC<CategoryChartCardProps> = ({ title, type, categories, total, onCategoryClick }) => {
  const [activeId, setActiveId] = useState<string | null>(categories[0]?.id ?? null);

  const isIncome = type === 'income';
  const accentBg = isIncome ? 'bg-emerald-50' : 'bg-rose-50';
  const accentBorder = isIncome ? 'border-emerald-200' : 'border-rose-200';
  const accentText = isIncome ? 'text-emerald-700' : 'text-rose-700';
  const headlineText = isIncome ? 'text-success' : 'text-danger';
  const topCategories = useMemo(() => categories.slice(0, 4), [categories]);
  const primaryCategory = topCategories[0] ?? null;
  const activeCategory = topCategories.find((category) => category.id === activeId) ?? primaryCategory;
  const concentration = total > 0 && primaryCategory ? (primaryCategory.amount / total) * 100 : 0;
  const remainder = Math.max(total - topCategories.slice(0, 3).reduce((sum, category) => sum + category.amount, 0), 0);
  const summarySegments = [
    ...topCategories.slice(0, 3).map((category) => ({
      id: category.id,
      name: category.name,
      amount: category.amount,
      color: category.color,
      percentage: total > 0 ? (category.amount / total) * 100 : 0,
    })),
    ...(remainder > 0 ? [{
      id: 'others',
      name: 'Outras',
      amount: remainder,
      color: '#CBD5E1',
      percentage: total > 0 ? (remainder / total) * 100 : 0,
    }] : []),
  ];

  return (
    <Card className="relative overflow-hidden rounded-[32px] border border-slate-200 !p-0 shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={`text-xl font-black tracking-tight ${type === 'expense' ? 'text-slate-900' : 'text-slate-800'}`}>
              {title}
            </h3>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              {categories.length} categorias no periodo
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${accentBg} ${accentText}`}>
            {isIncome ? 'Mapa de entradas' : 'Mapa de saidas'}
          </span>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-4">
          <div className={`rounded-[24px] border p-4 md:rounded-[28px] md:p-5 ${accentBorder} ${accentBg}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Volume total</p>
                <p className={`mt-3 break-words text-[clamp(1.8rem,3vw,2.4rem)] font-black tracking-tight ${headlineText}`}>
                  {formatCurrency(total)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Categoria lider</p>
                <p className="mt-2 max-w-[180px] truncate text-sm font-black text-slate-800">
                  {primaryCategory?.name || 'Sem lancamentos'}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {primaryCategory ? `${concentration.toFixed(1)}% do total` : 'Sem dados neste periodo'}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-full bg-white/80">
              <div className="flex h-3 w-full">
                {summarySegments.length > 0 ? summarySegments.map((segment) => (
                  <div
                    key={segment.id}
                    className="h-full transition-all"
                    style={{ width: `${Math.max(segment.percentage, 6)}%`, backgroundColor: segment.color }}
                  />
                )) : (
                  <div className="h-full w-full bg-slate-200" />
                )}
              </div>
            </div>

            <div className="mt-4 hidden gap-2 sm:grid sm:grid-cols-2">
              {summarySegments.slice(0, 4).map((segment) => (
                <div key={segment.id} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="truncate">{segment.name}</span>
                  <span className="ml-auto text-slate-400">{segment.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-400">
              <span className="material-symbols-outlined mb-3 text-4xl opacity-40">bar_chart</span>
              <p className="text-[11px] font-black uppercase tracking-[0.2em]">Sem lancamentos neste periodo</p>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {topCategories.map((cat, index) => {
                const percentage = total > 0 ? (cat.amount / total) * 100 : 0;
                const isActive = activeCategory?.id === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onCategoryClick?.(cat)}
                    onMouseEnter={() => setActiveId(cat.id)}
                    onFocus={() => setActiveId(cat.id)}
                    className={`w-full rounded-[20px] border px-3 py-3 text-left transition-all md:rounded-[24px] md:px-4 md:py-4 ${isActive ? 'border-slate-300 bg-slate-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl shadow-sm md:h-12 md:w-12 md:rounded-2xl"
                          style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                        >
                          <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 md:text-[10px]">
                              Top {index + 1}
                            </span>
                            <p className="truncate text-xs font-black text-slate-800 md:text-sm">{cat.name}</p>
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500 md:text-xs">
                            {percentage.toFixed(1)}% de participacao no periodo
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="block text-sm font-black text-slate-900 md:text-base">{formatCurrency(cat.amount)}</span>
                        <span className="text-[11px] font-bold text-slate-400">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(percentage, 4)}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden space-y-4 xl:block">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Em foco</p>
            <p className="mt-3 text-lg font-black leading-tight text-slate-900">
              {activeCategory?.name || 'Nenhuma categoria selecionada'}
            </p>
            <p className={`mt-2 text-2xl font-black tracking-tight ${headlineText}`}>
              {activeCategory ? formatCurrency(activeCategory.amount) : formatCurrency(0)}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              {activeCategory
                ? `${((activeCategory.amount / Math.max(total, 1)) * 100).toFixed(1)}% do total no periodo atual.`
                : 'Passe o mouse ou toque em uma categoria para ver o destaque.'}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Leitura rapida</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Concentracao top 3</p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {total > 0 ? `${((topCategories.slice(0, 3).reduce((sum, category) => sum + category.amount, 0) / total) * 100).toFixed(1)}%` : '0.0%'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Quantidade ativa</p>
                <p className="mt-2 text-lg font-black text-slate-900">{categories.length} categorias</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Media por categoria</p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {formatCurrency(categories.length > 0 ? total / categories.length : 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
