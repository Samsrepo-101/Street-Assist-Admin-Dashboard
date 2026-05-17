import React from 'react';
import { Menu } from 'lucide-react';

export default function TopBar({ onMenuClick, title }) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-border h-12 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div>
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="hidden sm:inline text-muted-foreground text-xs ml-2">
            — Camarines Norte Community Safety
          </span>
        </div>
      </div>
    </header>
  );
}
