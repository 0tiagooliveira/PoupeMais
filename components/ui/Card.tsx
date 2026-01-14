
import React from 'react';

interface CardProps {
  title?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ 
  title, 
  icon, 
  children, 
  className = '',
  action
}) => {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-surface p-6 shadow-sm transition-shadow hover:shadow-md ${className}`}>
      {(title || icon || action) && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                <span className="material-symbols-outlined text-lg">{icon}</span>
              </div>
            )}
            {title && <h3 className="text-lg font-semibold text-slate-800">{title}</h3>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};
