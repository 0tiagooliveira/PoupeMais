
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { Dashboard } from './features/dashboard/Dashboard';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { ChartsPage } from './features/charts/ChartsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { CreditCardsPage } from './features/credit-cards/CreditCardsPage';
import { Layout } from './components/layout/Layout';

const AppRouter: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center">
          <div className="relative">
            <img 
                src="https://poup-beta.web.app/Icon/LogoPoup.svg" 
                alt="Carregando..." 
                className="h-12 w-auto animate-pulse" 
            />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
               <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-success" style={{ animationDelay: '0ms' }}></div>
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-success" style={{ animationDelay: '150ms' }}></div>
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-success" style={{ animationDelay: '300ms' }}></div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Rotas protegidas - apenas se usuário logado */}
        {currentUser ? (
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="transactions" element={<TransactionsPage title="Todas as Transações" />} />
            <Route path="transactions/account/:accountId" element={<TransactionsPage title="Extrato da Conta" />} />
            <Route path="incomes" element={<TransactionsPage title="Receitas" filterType="income" />} />
            <Route path="expenses" element={<TransactionsPage title="Despesas" filterType="expense" />} />
            <Route path="charts" element={<ChartsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="credit-cards" element={<CreditCardsPage />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
        
        {/* Redirecionar para login se não logado, ou para home se rota não existe */}
        <Route path="*" element={<Navigate to={currentUser ? "/" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppRouter />
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
