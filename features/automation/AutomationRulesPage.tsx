import React, { useEffect, useMemo, useState } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useCategories } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';
import { db } from '../../services/firebase';
import { AutomationRule } from '../../types';

type PersistedRule = AutomationRule;

type RuleFormState = {
  descriptionContains: string;
  amountMin: string;
  amountMax: string;
  accountId: string;
  categoryId: string;
  renameTo: string;
  shouldRename: boolean;
  shouldHide: boolean;
  isActive: boolean;
};

const EMPTY_FORM: RuleFormState = {
  descriptionContains: '',
  amountMin: '',
  amountMax: '',
  accountId: 'all',
  categoryId: '',
  renameTo: '',
  shouldRename: false,
  shouldHide: false,
  isActive: true,
};

export const AutomationRulesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const { allCategories } = useCategories();
  const { accounts } = useAccounts();

  const [rules, setRules] = useState<PersistedRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PersistedRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);

  useEffect(() => {
    if (!currentUser?.uid) {
      setRules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = db
      .collection('users')
      .doc(currentUser.uid)
      .collection('automation_rules')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<AutomationRule, 'id'>),
          }));
          setRules(data);
          setLoading(false);
        },
        (error: any) => {
          console.error('[AUTOMATION_PAGE] Erro ao carregar regras:', error);
          addNotification(error?.message || 'Erro ao carregar regras inteligentes.', 'error');
          setLoading(false);
        }
      );

    return unsubscribe;
  }, [currentUser?.uid, addNotification]);

  const categoriesByType = useMemo(() => {
    return allCategories
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allCategories]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingRule(null);
  };

  const openNewRuleModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditRuleModal = (rule: PersistedRule) => {
    setEditingRule(rule);
    setForm({
      descriptionContains: rule.conditions?.descriptionContains || '',
      amountMin: rule.conditions?.amountMin || '',
      amountMax: rule.conditions?.amountMax || '',
      accountId: rule.conditions?.accountId || 'all',
      categoryId: rule.actions?.categoryId || '',
      renameTo: rule.actions?.renameTo || '',
      shouldRename: Boolean(rule.actions?.renameTo),
      shouldHide: Boolean(rule.actions?.isIgnored),
      isActive: rule.isActive !== false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSaveRule = async () => {
    if (!currentUser?.uid) return;
    if (!form.descriptionContains.trim()) {
      addNotification('Informe o texto gatilho da regra.', 'warning');
      return;
    }

    if (!form.categoryId && !form.shouldRename && !form.shouldHide) {
      addNotification('Escolha ao menos uma acao para a regra.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        conditions: {
          descriptionContains: form.descriptionContains.trim(),
          amountMin: form.amountMin || undefined,
          amountMax: form.amountMax || undefined,
          accountId: form.accountId === 'all' ? undefined : form.accountId,
        },
        actions: {
          categoryId: form.categoryId || undefined,
          renameTo: form.shouldRename ? form.renameTo.trim() || undefined : undefined,
          isIgnored: form.shouldHide ? true : undefined,
        },
        isActive: form.isActive,
        updatedAt: new Date().toISOString(),
      };

      const cleanPayload = JSON.parse(JSON.stringify(payload));

      if (editingRule) {
        await db
          .collection('users')
          .doc(currentUser.uid)
          .collection('automation_rules')
          .doc(editingRule.id)
          .update(cleanPayload);

        addNotification('Regra inteligente atualizada.', 'success');
      } else {
        await db
          .collection('users')
          .doc(currentUser.uid)
          .collection('automation_rules')
          .add({
            ...cleanPayload,
            createdAt: new Date().toISOString(),
          });

        addNotification('Regra inteligente criada.', 'success');
      }

      closeModal();
    } catch (error: any) {
      console.error('[AUTOMATION_PAGE] Erro ao salvar regra:', error);
      addNotification(error?.message || 'Erro ao salvar regra inteligente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (rule: PersistedRule) => {
    if (!currentUser?.uid) return;

    try {
      await db
        .collection('users')
        .doc(currentUser.uid)
        .collection('automation_rules')
        .doc(rule.id)
        .update({ isActive: !rule.isActive, updatedAt: new Date().toISOString() });

      addNotification(!rule.isActive ? 'Regra ativada.' : 'Regra pausada.', 'success');
    } catch (error: any) {
      addNotification(error?.message || 'Erro ao atualizar status da regra.', 'error');
    }
  };

  const handleDeleteRule = async (rule: PersistedRule) => {
    if (!currentUser?.uid) return;
    const ok = window.confirm('Tem certeza que deseja excluir esta regra inteligente?');
    if (!ok) return;

    try {
      await db
        .collection('users')
        .doc(currentUser.uid)
        .collection('automation_rules')
        .doc(rule.id)
        .delete();

      addNotification('Regra excluida com sucesso.', 'success');
    } catch (error: any) {
      addNotification(error?.message || 'Erro ao excluir regra.', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <BackButton className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm" />
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Regras Inteligentes</h2>
            <p className="text-xs font-bold text-slate-400">Aprendizado automatico nas proximas importacoes</p>
          </div>
        </div>
        <button
          onClick={openNewRuleModal}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success text-white shadow-lg shadow-success/20 transition-all active:scale-90"
        >
          <span className="material-symbols-outlined font-bold">add</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center shadow-sm">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-2">tips_and_updates</span>
          <p className="text-lg font-black text-slate-700 dark:text-slate-200">Nenhuma regra criada</p>
          <p className="text-sm font-medium text-slate-400 mt-1">Crie regras para categorizar e renomear automaticamente.</p>
          <Button onClick={openNewRuleModal} className="mt-6 rounded-2xl h-11 px-6">Criar primeira regra</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">Quando descricao contem</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rule.conditions?.descriptionContains || '-'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rule.actions?.categoryId && (
                      <span className="text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                        Categoria: {rule.actions.categoryId}
                      </span>
                    )}
                    {rule.actions?.renameTo && (
                      <span className="text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
                        Renomear: {rule.actions.renameTo}
                      </span>
                    )}
                    {rule.actions?.isIgnored && (
                      <span className="text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg bg-amber-50 text-amber-700">
                        Ocultar
                      </span>
                    )}
                    {rule.conditions?.accountId && (
                      <span className="text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
                        Conta especifica
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                    rule.isActive ? 'bg-success/10 text-success' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {rule.isActive ? 'Ativa' : 'Pausada'}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => openEditRuleModal(rule)}
                  className="rounded-xl h-10 px-3 text-xs font-bold"
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleToggleRule(rule)}
                  className="rounded-xl h-10 px-3 text-xs font-bold"
                >
                  {rule.isActive ? 'Pausar' : 'Ativar'}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDeleteRule(rule)}
                  className="rounded-xl h-10 px-3 text-xs font-bold"
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingRule ? 'Editar Regra Inteligente' : 'Nova Regra Inteligente'}>
        <div className="flex flex-col gap-4">
          <Input
            label="Texto gatilho"
            value={form.descriptionContains}
            onChange={(e) => setForm((prev) => ({ ...prev, descriptionContains: e.target.value }))}
            placeholder="Ex: cigarro, uber, mercado"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor minimo (opcional)"
              value={form.amountMin}
              onChange={(e) => setForm((prev) => ({ ...prev, amountMin: e.target.value }))}
              placeholder="0.00"
            />
            <Input
              label="Valor maximo (opcional)"
              value={form.amountMax}
              onChange={(e) => setForm((prev) => ({ ...prev, amountMax: e.target.value }))}
              placeholder="9999.99"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-secondary">Conta (opcional)</label>
            <select
              value={form.accountId}
              onChange={(e) => setForm((prev) => ({ ...prev, accountId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-surface px-3 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todas as contas/cartoes</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-secondary">Categoria de destino (opcional)</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-surface px-3 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">Nao alterar categoria</option>
              {categoriesByType.map((cat) => (
                <option key={`${cat.type}-${cat.name}`} value={cat.name}>{cat.name} ({cat.type === 'income' ? 'Receita' : 'Despesa'})</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-secondary">
            <input
              type="checkbox"
              checked={form.shouldRename}
              onChange={(e) => setForm((prev) => ({ ...prev, shouldRename: e.target.checked }))}
            />
            Renomear descricao
          </label>

          {form.shouldRename && (
            <Input
              label="Novo nome"
              value={form.renameTo}
              onChange={(e) => setForm((prev) => ({ ...prev, renameTo: e.target.value }))}
              placeholder="Ex: Bem-estar"
            />
          )}

          <label className="flex items-center gap-2 text-sm font-medium text-secondary">
            <input
              type="checkbox"
              checked={form.shouldHide}
              onChange={(e) => setForm((prev) => ({ ...prev, shouldHide: e.target.checked }))}
            />
            Ocultar lancamento nos calculos
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-secondary">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Regra ativa
          </label>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={closeModal} className="flex-1 rounded-2xl h-11">Cancelar</Button>
            <Button onClick={handleSaveRule} isLoading={saving} className="flex-1 rounded-2xl h-11">Salvar regra</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
