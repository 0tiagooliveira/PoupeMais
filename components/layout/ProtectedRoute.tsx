import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const BRAND_LOGO_SRC = '/brand/logo-poup.png';

export const ProtectedRoute: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center">
          <div className="relative">
            <img 
                src={BRAND_LOGO_SRC}
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

  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
};