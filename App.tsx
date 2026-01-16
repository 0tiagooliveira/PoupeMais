
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { Dashboard } from './features/dashboard/Dashboard';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { ChartsPage } from './features/charts/ChartsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { CategoriesPage } from './features/categories/CategoriesPage';
import { CreditCardsPage } from './features/credit-cards/CreditCardsPage';
import { AIAnalysisPage } from './features/ai/AIAnalysisPage';
import { PricingPage } from './features/pricing/PricingPage';
import { Layout } from './components/layout/Layout';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
               <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<TransactionsPage title="Todas as Transações" />} />
                  <Route path="/transactions/account/:accountId" element={<TransactionsPage title="Extrato da Conta" />} />
                  <Route path="/incomes" element={<TransactionsPage title="Receitas" filterType="income" />} />
                  <Route path="/expenses" element={<TransactionsPage title="Despesas" filterType="expense" />} />
                  <Route path="/charts" element={<ChartsPage />} />
                  <Route path="/ai-analysis" element={<AIAnalysisPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/credit-cards" element={<CreditCardsPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
               </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
