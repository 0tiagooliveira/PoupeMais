import { db } from '../services/firebase';
import { AutomationRule, DetectedTransaction } from '../types';

const normalizeText = (value: string) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const fetchActiveAutomationRules = async (uid: string): Promise<AutomationRule[]> => {
  try {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('automation_rules')
      .where('isActive', '==', true)
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AutomationRule, 'id'>) }));
  } catch (whereError: any) {
    console.warn('[AUTOMATION] where(isActive=true) falhou, usando fallback:', whereError?.code);
    const snap = await db.collection('users').doc(uid).collection('automation_rules').get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AutomationRule, 'id'>) }))
      .filter((rule) => rule.isActive !== false);
  }
};

const transactionMatchesRule = (transaction: DetectedTransaction, rule: AutomationRule): boolean => {
  const condition = normalizeText(rule.conditions?.descriptionContains || '');
  const description = normalizeText(transaction.description || '');

  if (!condition || !description.includes(condition)) return false;
  if (rule.conditions?.amountMin && transaction.amount < parseFloat(rule.conditions.amountMin)) return false;
  if (rule.conditions?.amountMax && transaction.amount > parseFloat(rule.conditions.amountMax)) return false;

  return true;
};

const applyRuleActions = (transaction: DetectedTransaction, rule: AutomationRule): DetectedTransaction => {
  const updated = { ...transaction };

  if (rule.actions?.categoryId) updated.category = rule.actions.categoryId;
  if (rule.actions?.renameTo) updated.description = rule.actions.renameTo;
  if (rule.actions?.isIgnored !== undefined) (updated as any).isIgnored = rule.actions.isIgnored;

  return updated;
};

export const applyRulesToDetectedTransactions = (
  transactions: DetectedTransaction[],
  rules: AutomationRule[]
): { transactions: DetectedTransaction[]; appliedCount: number } => {
  let appliedCount = 0;

  const updated = transactions.map((transaction) => {
    let next = { ...transaction };

    for (const rule of rules) {
      if (!transactionMatchesRule(next, rule)) continue;
      next = applyRuleActions(next, rule);
      appliedCount += 1;
      break;
    }

    return next;
  });

  return { transactions: updated, appliedCount };
};
