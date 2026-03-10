
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  icon,
  className = '',
  disabled,
  ...props 
}) => {
  const variants = {
    primary: 'bg-primary text-white hover:bg-emerald-600 shadow-sm shadow-success/20',
    secondary: 'bg-white text-secondary border border-gray-200 hover:bg-gray-50',
    danger: 'bg-danger text-white hover:bg-red-700',
    ghost: 'bg-transparent text-secondary hover:bg-gray-100',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`
        flex items-center justify-center gap-2 rounded-lg font-medium transition-all
        disabled:opacity-70 disabled:cursor-not-allowed
        ${variants[variant]} 
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
      ) : (
        <>
          {icon && <span className="material-symbols-outlined text-xl">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};
