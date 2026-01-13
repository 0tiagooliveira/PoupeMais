import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    // Can replace with a proper Spinner component later
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-primary flex flex-col items-center">
          <span className="material-symbols-outlined animate-spin text-4xl">
            progress_activity
          </span>
          <span className="mt-2 text-sm font-medium">Carregando Poup+...</span>
        </div>
      </div>
    );
  }

  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
};