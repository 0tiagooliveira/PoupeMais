import React from 'react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ className = '' }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className={`flex items-center justify-center rounded-full p-2 text-secondary hover:bg-gray-100 hover:text-slate-800 transition-colors ${className}`}
      title="Voltar"
    >
      <span className="material-symbols-outlined text-xl">arrow_back</span>
    </button>
  );
};