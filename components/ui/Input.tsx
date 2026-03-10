import React, { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, type, className, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-secondary">{label}</label>
      <div className="relative">
        {/* Ícone da esquerda (opcional) */}
        {icon && (
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none">
            {icon}
          </span>
        )}
        
        <input
          type={inputType}
          className={`w-full rounded-lg border bg-surface py-2 outline-none transition-all
            ${icon ? 'pl-10' : 'pl-4'}
            ${isPassword ? 'pr-10' : 'pr-4'}
            ${error 
              ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger' 
              : 'border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary'
            }
          `}
          {...props}
        />

        {/* Botão de Mostrar/Ocultar Senha */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            title={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            <span className="material-symbols-outlined text-lg">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
};