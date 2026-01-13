import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { Dashboard } from './features/dashboard/Dashboard';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { Layout } from './components/layout/Layout';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <HashRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
               <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  
                  {/* Novas Rotas de Listagem */}
                  <Route path="/transactions" element={<TransactionsPage title="Todas as Transações" />} />
                  <Route path="/incomes" element={<TransactionsPage title="Receitas" filterType="income" />} />
                  <Route path="/expenses" element={<TransactionsPage title="Despesas" filterType="expense" />} />
                  
                  {/* Rota para Despesas de Cartão (Placeholder para futura implementação de vínculo com cartão) */}
                  <Route path="/credit-expenses" element={<TransactionsPage title="Despesas do Cartão" filterType="credit_card" />} />
               </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;