
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { GlobalProcessingStatus } from '../ui/GlobalProcessingStatus';

export const Layout: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <GlobalProcessingStatus />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8 pb-24 md:pb-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
};
