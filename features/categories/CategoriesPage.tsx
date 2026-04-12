
import React, { useState, useMemo, useEffect } from 'react';
import { useCategories } from '../../hooks/useCategories';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useNotification } from '../../contexts/NotificationContext';
import { TransactionType, Category } from '../../types';

const AVAILABLE_ICONS = [
  'payments', 'shopping_cart', 'restaurant', 'local_cafe', 'bakery_dining',
  'local_pizza', 'lunch_dining', 'fastfood', 'receipt_long', 'directions_car',
  'commute', 'train', 'flight', 'directions_bus', 'home', 'house', 'apartment',
  'real_estate_agent', 'hotel', 'medical_services', 'health_and_safety', 'monitor_heart',
  'psychology', 'self_improvement', 'school', 'menu_book', 'sports_esports',
  'stadia_controller', 'music_note', 'movie', 'theaters', 'subscriptions',
  'credit_card', 'account_balance_wallet', 'savings', 'account_balance', 'currency_exchange',
  'attach_money', 'paid', 'price_check', 'request_quote', 'gavel', 'card_giftcard',
  'redeem', 'pets', 'build', 'construction', 'handyman', 'plumbing', 'smartphone',
  'devices', 'computer', 'tv', 'headphones', 'wifi', 'bolt', 'water_drop', 'local_gas_station',
  'propane', 'spa', 'checkroom', 'face', 'volunteer_activism', 'handshake', 'groups',
  'family_restroom', 'child_friendly', 'elderly', 'diversity_3', 'stars', 'emoji_events',
  'casino', 'sports_soccer', 'sports_basketball', 'sports_tennis', 'fitness_center',
  'monitor_weight', 'trending_up', 'show_chart', 'pie_chart', 'query_stats', 'insights',
  'percent', 'storefront', 'shopping_bag', 'local_mall', 'design_services', 'brush',
  'palette', 'camera_alt', 'photo_camera', 'sync_alt', 'undo', 'calendar_month',
  'event', 'move_to_inbox', 'archive', 'inventory_2', 'more_horiz', 'category',
  'home_repair_service', 'workspace_premium', 'military_tech'
];

const AVAILABLE_COLORS = [
  '#21C25E', '#16A34A', '#22C55E', '#84CC16', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#2563EB', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
  '#EF4444', '#DC2626', '#F97316', '#FB923C', '#F59E0B', '#EAB308', '#64748B', '#475569',
  '#334155', '#0F172A', '#000000', '#7C3AED', '#1D4ED8', '#059669'
];

export const CategoriesPage: React.FC = () => {
  const { allCategories, addCustomCategory, updateCustomCategory, deleteCustomCategory, loading } = useCategories();
  const { addNotification } = useNotification();
  const [filterType, setFilterType] = useState<TransactionType>('expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('category');
  const [newColor, setNewColor] = useState('#21C25E');
  const [iconSearch, setIconSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredCategories = useMemo(() => {
    return allCategories.filter(c => c.type === filterType);
  }, [allCategories, filterType]);

  useEffect(() => {
    if (editingCategory) {
      setNewName(editingCategory.name);
      setNewIcon(editingCategory.icon);
      setNewColor(editingCategory.color);
      setIconSearch('');
    } else {
      setNewName('');
      setNewIcon('category');
      setNewColor('#21C25E');
      setIconSearch('');
    }
  }, [editingCategory, isModalOpen]);

  const filteredIcons = useMemo(() => {
    const query = iconSearch.trim().toLowerCase();
    if (!query) return AVAILABLE_ICONS;
    return AVAILABLE_ICONS.filter(icon => icon.toLowerCase().includes(query));
  }, [iconSearch]);

  const handleSave = async () => {
    if (!newName.trim()) {
      addNotification('Informe um nome para a categoria.', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        await updateCustomCategory(editingCategory.id, {
          name: newName,
          icon: newIcon,
          color: newColor,
          type: filterType
        });
        addNotification(`Categoria "${newName}" atualizada!`, 'success');
      } else {
        await addCustomCategory({
          name: newName,
          icon: newIcon,
          color: newColor,
          type: filterType
        });
        addNotification(`Categoria "${newName}" criada!`, 'success');
      }
      handleCloseModal();
    } catch (error) {
      addNotification('Erro ao processar categoria.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (cat: Category) => {
    setEditingCategory(cat);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  return (
    <div className="mx-auto max-w-2xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm" />
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Categorias</h2>
            <p className="text-xs font-bold text-slate-400">Organize suas finanças</p>
          </div>
        </div>
        <button 
          onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success text-white shadow-lg shadow-success/20 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined font-bold">add</span>
        </button>
      </div>

      <div className="mb-8 flex justify-center">
        <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setFilterType('expense')}
            className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${
              filterType === 'expense' ? 'bg-white dark:bg-slate-900 shadow-sm text-danger' : 'text-slate-400'
            }`}
          >
            Despesas
          </button>
          <button
            onClick={() => setFilterType('income')}
            className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${
              filterType === 'income' ? 'bg-white dark:bg-slate-900 shadow-sm text-success' : 'text-slate-400'
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
              className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div 
                  className="flex h-11 w-11 items-center justify-center rounded-[14px] shadow-sm ring-1 ring-inset ring-slate-100/50 dark:ring-slate-700/50"
                  style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                >
                  <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{cat.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {cat.isCustom ? 'Personalizada' : 'Sistema'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {cat.isCustom ? (
                  <>
                    <button 
                      onClick={() => handleEditClick(cat)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button 
                      onClick={() => deleteCustomCategory(cat.id)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-slate-200 dark:text-slate-700 uppercase mr-2 px-2 py-1 rounded-lg border border-slate-50 dark:border-slate-800">Fixa</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCategory ? "Editar Categoria" : "Nova Categoria"}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4">
            <div 
              className="h-16 w-16 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: `${newColor}20`, color: newColor }}
            >
              <span className="material-symbols-outlined text-3xl leading-none">{newIcon}</span>
            </div>
            <Input 
              label="Nome da categoria" 
              placeholder="Ex: Doações, Academia..." 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              className="w-full font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Ícone</label>
            <Input
              label="Buscar ícone"
              placeholder="Ex: casa, cart, saúde..."
              value={iconSearch}
              onChange={e => setIconSearch(e.target.value)}
              className="mb-3"
            />
            <div className="grid grid-cols-6 gap-2 max-h-[220px] overflow-y-auto p-1 custom-scrollbar">
              {filteredIcons.map(icon => (
                <button 
                  key={icon}
                  type="button"
                  onClick={() => setNewIcon(icon)}
                  className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${newIcon === icon ? 'bg-primary text-white shadow-md scale-110' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  <span className="material-symbols-outlined text-lg leading-none">{icon}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Cor</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLORS.map(color => (
                <button 
                  key={color}
                  type="button"
                  onClick={() => setNewColor(color)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${newColor === color ? 'border-slate-800 dark:border-slate-200 scale-110 shadow-md' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input 
                type="color" 
                value={newColor} 
                onChange={e => setNewColor(e.target.value)}
                className="h-8 w-8 rounded-full bg-transparent overflow-hidden cursor-pointer border-none"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={handleCloseModal} className="flex-1 rounded-2xl font-bold h-12">Cancelar</Button>
            <Button onClick={handleSave} isLoading={saving} className="flex-1 rounded-2xl font-bold bg-primary text-white h-12 shadow-lg shadow-primary/20">
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
