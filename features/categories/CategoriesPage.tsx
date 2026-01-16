
import React, { useState, useMemo } from 'react';
import { useCategories } from '../../hooks/useCategories';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../contexts/NotificationContext';
import { TransactionType } from '../../types';

const AVAILABLE_ICONS = [
  'payments', 'shopping_cart', 'restaurant', 'directions_car', 'home', 
  'medical_services', 'school', 'sports_esports', 'flight', 'subscriptions',
  'credit_card', 'gavel', 'card_giftcard', 'pets', 'build', 'smartphone',
  'bolt', 'water_drop', 'propane', 'spa', 'handshake', 'savings', 'checkroom',
  'face', 'local_gas_station', 'more_horiz', 'computer', 'stars', 'trending_up',
  'real_estate_agent', 'show_chart', 'pie_chart', 'percent', 'currency_exchange',
  'storefront', 'design_services', 'undo', 'account_balance', 'emoji_events',
  'diversity_3', 'elderly', 'child_friendly', 'volunteer_activism', 'casino',
  'sync_alt', 'calendar_month', 'move_to_inbox', 'query_stats'
];

export const CategoriesPage: React.FC = () => {
  const { allCategories, addCustomCategory, deleteCustomCategory, loading } = useCategories();
  const { addNotification } = useNotification();
  const [filterType, setFilterType] = useState<TransactionType>('expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('category');
  const [newColor, setNewColor] = useState('#21C25E');
  const [creating, setCreating] = useState(false);

  const filteredCategories = useMemo(() => {
    return allCategories.filter(c => c.type === filterType);
  }, [allCategories, filterType]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await addCustomCategory({
        name: newName,
        icon: newIcon,
        color: newColor,
        type: filterType
      });
      addNotification(`Categoria "${newName}" criada!`, 'success');
      setNewName('');
      setIsModalOpen(false);
    } catch (error) {
      addNotification('Erro ao criar categoria.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Categorias</h2>
            <p className="text-xs font-bold text-slate-400">Organize suas finanças</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success text-white shadow-lg shadow-success/20 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined font-bold">add</span>
        </button>
      </div>

      <div className="mb-8 flex justify-center">
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            onClick={() => setFilterType('expense')}
            className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${
              filterType === 'expense' ? 'bg-white shadow-sm text-danger' : 'text-slate-400'
            }`}
          >
            Despesas
          </button>
          <button
            onClick={() => setFilterType('income')}
            className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${
              filterType === 'income' ? 'bg-white shadow-sm text-success' : 'text-slate-400'
            }`}
          >
            Receitas
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredCategories.map((cat) => (
            <div 
              key={cat.id || cat.name} 
              className="group flex items-center justify-between p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div 
                  className="flex h-11 w-11 items-center justify-center rounded-[14px] shadow-sm ring-1 ring-inset ring-slate-100/50"
                  style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                >
                  <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{cat.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {cat.isCustom ? 'Personalizada' : 'Sistema'}
                  </p>
                </div>
              </div>
              
              {cat.isCustom && (
                <button 
                  onClick={() => deleteCustomCategory(cat.id)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-danger hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Categoria">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4">
            <div 
              className="h-16 w-16 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: `${newColor}20`, color: newColor }}
            >
              <span className="material-symbols-outlined text-3xl">{newIcon}</span>
            </div>
            <Input 
              label="Nome da categoria" 
              placeholder="Ex: Doações, Academia..." 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              className="w-full"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tipo</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilterType('expense')}
                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${filterType === 'expense' ? 'bg-red-50 border-danger text-danger' : 'border-slate-100 text-slate-400'}`}
              >
                Despesa
              </button>
              <button 
                onClick={() => setFilterType('income')}
                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${filterType === 'income' ? 'bg-emerald-50 border-success text-success' : 'border-slate-100 text-slate-400'}`}
              >
                Receita
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Ícone</label>
            <div className="grid grid-cols-6 gap-2 max-h-[150px] overflow-y-auto p-1 custom-scrollbar">
              {AVAILABLE_ICONS.map(icon => (
                <button 
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${newIcon === icon ? 'bg-primary text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-2xl font-bold">Cancelar</Button>
            <Button onClick={handleCreate} isLoading={creating} className="flex-1 rounded-2xl font-bold bg-primary text-white">Criar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
