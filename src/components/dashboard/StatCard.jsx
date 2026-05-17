import React from 'react';

export default function StatCard({ label, value, icon: Icon, gradient, textColor, iconBg }) {
  return (
    <div className="relative bg-white rounded-2xl p-5 shadow-sm border border-border overflow-hidden group hover:shadow-md transition-all duration-200">
      {/* Subtle gradient top strip */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${gradient}`} />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
          <p className={`text-3xl font-bold tracking-tight ${textColor}`}>{value}</p>
        </div>
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`h-5 w-5 ${textColor}`} />
        </div>
      </div>
    </div>
  );
}