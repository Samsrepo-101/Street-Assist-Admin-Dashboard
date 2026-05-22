import React, { useState, useEffect } from 'react';
import { FileText, Clock, TrendingUp, CheckCircle2, AlertTriangle, Megaphone } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import RecentReportsList from '../components/dashboard/RecentReportList';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { subscribeToReports } from '../api/reports.js';
import { subscribeToAnnouncements } from '../api/announcement.js';

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  useEffect(() => {
    const unsubReports = subscribeToReports((data) => {
      setReports(data);
      setReportsLoading(false);
    });
    const unsubAnnouncements = subscribeToAnnouncements(setAnnouncements);
    return () => {
      unsubReports();
      unsubAnnouncements();
    };
  }, []);

  const total = reports.filter(r => !r.deleted_at).length;
  const pending = reports.filter(r => r.status === 'Pending' && !r.deleted_at).length;
  const onProgress = reports.filter(r => (r.status === 'In Progress' || r.status === 'Verified') && !r.deleted_at).length;
  const resolved = reports.filter(r => r.status === 'Resolved' && !r.deleted_at).length;

  if (reportsLoading) {
    return (
      <div className="space-y-6 w-full">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">

      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Good morning, Admin 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), 'EEEE, MMMM dd, yyyy')} · Camarines Norte</p>
        </div>
        {pending > 0 && (
          <div className="hidden sm:flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-2 rounded-xl">
            <AlertTriangle className="h-3.5 w-3.5" />
            {pending} report{pending > 1 ? 's' : ''} need attention
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Reports"
          value={total}
          icon={FileText}
          gradient="bg-gradient-to-r from-primary to-emerald-500"
          textColor="text-primary"
          iconBg="bg-primary/10"
        />
        <StatCard
          label="Pending"
          value={pending}
          icon={Clock}
          gradient="bg-gradient-to-r from-amber-400 to-orange-400"
          textColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          label="On Progress"
          value={onProgress}
          icon={TrendingUp}
          gradient="bg-gradient-to-r from-teal-400 to-cyan-500"
          textColor="text-teal-600"
          iconBg="bg-teal-50"
        />
        <StatCard
          label="Resolved"
          value={resolved}
          icon={CheckCircle2}
          gradient="bg-gradient-to-r from-emerald-400 to-green-500"
          textColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RecentReportsList reports={reports} />
        </div>

        {/* Quick stats sidebar */}
        <div className="space-y-4">
          {/* Resolution rate */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
            <h4 className="text-sm font-bold text-foreground mb-4">Resolution Rate</h4>
            <div className="space-y-3">
              {[
                { label: 'Resolved', value: resolved, total, color: 'bg-emerald-500' },
                { label: 'On Progress', value: onProgress, total, color: 'bg-teal-400' },
                { label: 'Pending', value: pending, total, color: 'bg-amber-400' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground font-medium">{item.label}</span>
                    <span className="font-bold text-foreground">{item.total ? Math.round((item.value / item.total) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${item.color}`}
                      style={{ width: `${item.total ? (item.value / item.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Announcements quick list */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-foreground">Latest Announcements</h4>
              <Megaphone className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {announcements.slice(0, 3).map(ann => (
                <div key={ann.id} className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground line-clamp-1">{ann.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{ann.category}</p>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && (
                <p className="text-xs text-muted-foreground">No announcements yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
