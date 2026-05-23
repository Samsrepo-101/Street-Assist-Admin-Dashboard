import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeToReports, moveReportToTrash, archiveReport, getStatusConfig, STATUS_CONFIG } from '../api/reports.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Clock, Trash2, Download, User, FileText, ChevronRight, Archive } from 'lucide-react';
import { format, isAfter, subDays } from 'date-fns';
import ReportDetailDialog from '../components/report/ReportDetailDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { useAuth } from '../lib/AuthContext';
import { canAccessReport, isHomelessAdminRole, isMissingAnimalsAdminRole, isScopedReportAdminRole } from '../lib/adminRoles.js';

const CAM_NORTE_TOWNS = [
  'All Towns', 'Basud', 'Capalonga', 'Daet', 'Jose Panganiban', 'Labo',
  'Mercedes', 'Paracale', 'San Lorenzo Ruiz', 'San Vicente', 'Santa Elena',
  'Talisay', 'Vinzons'
];

// Status config imported from api/reports.js — uses exact Firestore values
const statusConfig = STATUS_CONFIG;

export default function Reports() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [townFilter, setTownFilter] = useState('All Towns');
  const [timeFilter, setTimeFilter] = useState('All Dates');
  const [selectedReport, setSelectedReport] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const { adminRole } = useAuth();
  const isMissingAnimalsAdmin = isMissingAnimalsAdminRole(adminRole);
  const isHomelessAdmin = isHomelessAdminRole(adminRole);
  const isScopedReportAdmin = isScopedReportAdminRole(adminRole);

  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToReports((data) => {
      setReports(data);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const location = useLocation();
  useEffect(() => {
    if (location.state?.selectedReportId && reports.length > 0) {
      const found = reports.find(r => r.id === location.state.selectedReportId);
      if (found) {
        setSelectedReport(found);
      }
    }
  }, [location.state?.selectedReportId, reports]);

  const filtered = useMemo(() => {
    return reports.filter(r => {
      // Exclude archived and soft-deleted reports
      if (r.deleted_at) return false;
      if (r.archived_at) return false;
      if (!canAccessReport(r, adminRole)) return false;

      const matchSearch = !search ||
        r.description?.toLowerCase().includes(search.toLowerCase()) ||
        (r.locationAddress || r.location_address)?.toLowerCase().includes(search.toLowerCase()) ||
        r.report_id?.toLowerCase().includes(search.toLowerCase()) ||
        r.reportId?.toLowerCase().includes(search.toLowerCase()) ||
        (r.fullName || r.reporter_name)?.toLowerCase().includes(search.toLowerCase()) ||
        r.reportType?.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const reportCategory = r.category || "Individual";
      const matchCategory = isScopedReportAdmin || categoryFilter === 'All' || reportCategory === categoryFilter;
      const matchTown = townFilter === 'All Towns' ||
        (r.locationAddress || r.location_address)?.toLowerCase().includes(townFilter.toLowerCase());

      const now = new Date();
      const created = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(0);
      const matchTime =
        timeFilter === 'All Dates'      ? true :
        timeFilter === 'Last 24h'      ? isAfter(created, subDays(now, 1)) :
        timeFilter === 'Last 7 days'   ? isAfter(created, subDays(now, 7)) :
        timeFilter === 'Last 30 days'  ? isAfter(created, subDays(now, 30)) : true;

      return matchSearch && matchStatus && matchCategory && matchTown && matchTime;
    });
  }, [reports, search, statusFilter, categoryFilter, townFilter, timeFilter, adminRole, isScopedReportAdmin]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const moveToTrash = async () => {
    try {
      for (const id of selected) {
        await moveReportToTrash(id);
      }
      toast.success(`${selected.size} report(s) moved to trash`);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to move reports to trash');
    }
  };

  const archiveSelected = async () => {
    try {
      for (const id of selected) {
        await archiveReport(id);
      }
      toast.success(`${selected.size} report(s) archived`);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to archive reports');
    }
  };

  const archiveSingleReport = async (reportId) => {
    try {
      await archiveReport(reportId);
      toast.success('Report archived');
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    } catch (err) {
      toast.error('Failed to archive report');
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(13, 148, 136);  // teal-600 — matches green theme
    doc.rect(0, 0, pageW, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('STREETASSIST — INCIDENT REPORTS', 14, 13);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Camarines Norte Community Safety Platform', 14, 20);
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy · hh:mm a')}  |  ${filtered.length} report(s)`, 14, 27);

    let y = 44;
    filtered.forEach((report) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFillColor(246, 250, 253);
      doc.roundedRect(12, y, pageW - 24, 40, 2, 2, 'F');
      doc.setDrawColor(210, 230, 245);
      doc.roundedRect(12, y, pageW - 24, 40, 2, 2, 'S');
      const sc = statusConfig[report.status] ?? statusConfig.pending;
      const rgb =
        sc.bar === '#F59E0B' ? [245, 158, 11] :
        sc.bar === '#0d9488' ? [13, 148, 136] :
        sc.bar === '#ef4444' ? [239, 68, 68] :
        [16, 185, 129];
      doc.setFillColor(...rgb);
      doc.rect(12, y, 3, 40, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(3, 100, 80);
      doc.text(report.report_id, 20, y + 9);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Status: ${report.status}`, 55, y + 9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(25, 25, 25);
      const desc = doc.splitTextToSize(report.description || '', pageW - 50);
      doc.text(desc[0] || '', 20, y + 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text(`Reporter: ${report.fullName || report.reporter_name || 'Anonymous'}${report.contactNumber ? '  ·  ' + report.contactNumber : ''}  ·  Type: ${report.reportType || 'N/A'}`, 20, y + 27);
      doc.text(`Status: ${sc.label}  ·  ${report.seenAt?.toDate ? format(report.seenAt.toDate(), 'MMM dd, yyyy · hh:mm a') : report.timestamp?.toDate ? format(report.timestamp.toDate(), 'MMM dd, yyyy · hh:mm a') : 'N/A'}`, 20, y + 34);
      y += 46;
    });
    doc.save(`streetassist-reports-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  if (isLoading) {
    return <div className="space-y-3 w-full">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  }

  const accessibleReports = reports.filter(r => !r.deleted_at && !r.archived_at && canAccessReport(r, adminRole));
  const pendingCount = accessibleReports.filter(r => r.status === 'Pending').length;
  const onProgressCount = accessibleReports.filter(r => r.status === 'In Progress').length;
  const newCount = accessibleReports.filter(r => !r.admin_seen).length;

  return (
    <div className="space-y-5 w-full">

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: isMissingAnimalsAdmin ? 'Animal Reports' : isHomelessAdmin ? 'Individual Reports' : 'Total', value: accessibleReports.length, color: 'bg-primary/10 text-primary' },
          { label: 'Pending', value: pendingCount, color: 'bg-amber-50 text-amber-700' },
          { label: 'On Progress', value: onProgressCount, color: 'bg-teal-50 text-teal-700' },
          { label: 'Unseen', value: newCount, color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <span key={s.label} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${s.color}`}>
            {s.label}: {s.value}
          </span>
        ))}
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-border p-4">
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative w-full sm:min-w-[180px] sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by report ID, description, reporter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm bg-muted/40 border-0 focus-visible:ring-1"
            />
          </div>
          {isScopedReportAdmin ? (
            <span className="h-9 inline-flex items-center rounded-md bg-blue-50 px-3 text-sm font-semibold text-blue-700">
              {isHomelessAdmin ? 'Individual reports only' : 'Animal reports only'}
            </span>
          ) : (
            <Select value={categoryFilter} onValueChange={setCategoryFilter} className="w-full sm:w-auto">
              <SelectTrigger className="w-full h-9 text-sm bg-muted/40 border-0 sm:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Categories</SelectItem>
                <SelectItem value="Individual">Individual</SelectItem>
                <SelectItem value="Animal">Animal</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
            <SelectTrigger className="w-full h-9 text-sm bg-muted/40 border-0 sm:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={townFilter} onValueChange={setTownFilter} className="w-full sm:w-auto">
            <SelectTrigger className="w-full h-9 text-sm bg-muted/40 border-0 sm:w-44">
              <SelectValue placeholder="Town" />
            </SelectTrigger>
            <SelectContent>
              {CAM_NORTE_TOWNS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={timeFilter} onValueChange={setTimeFilter} className="w-full sm:w-auto">
            <SelectTrigger className="w-full h-9 text-sm bg-muted/40 border-0 sm:w-36">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Dates">All Dates</SelectItem>
              <SelectItem value="Last 24h">Last 24h</SelectItem>
              <SelectItem value="Last 7 days">Last 7 days</SelectItem>
              <SelectItem value="Last 30 days">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            <Button variant="outline" size="sm" className="h-9 flex-1 text-sm font-medium sm:flex-none" onClick={downloadPDF}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export PDF
            </Button>
            {selected.size > 0 && (
              <>
                <Button variant="outline" size="sm" className="h-9 flex-1 text-sm sm:flex-none" onClick={archiveSelected}>
                  <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive ({selected.size})
                </Button>
                <Button variant="destructive" size="sm" className="h-9 flex-1 text-sm sm:flex-none" onClick={moveToTrash}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Trash ({selected.size})
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Reports list */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {filtered.length} Report{filtered.length !== 1 ? 's' : ''} Found
          </p>
          <p className="text-xs text-muted-foreground">Click any report to view or edit details</p>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-border">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No reports found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((report) => {
              const sc = statusConfig[report.status] ?? statusConfig.pending;
              return (
                <div
                  key={report.id}
                  className="group relative bg-white rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
                  onClick={() => setSelectedReport(report)}
                  style={{ borderLeft: `4px solid ${sc.bar}` }}
                >
                  {/* Card body */}
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">

                    {/* Checkbox — stop propagation */}
                    <div className="shrink-0 flex items-start pt-0.5">
                      <input
                        type="checkbox"
                        checked={selected.has(report.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(report.id); }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Top row: ID + NEW badge + status pill */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-primary">
                          {report.report_id || report.id}
                        </span>
                        {!report.admin_seen && (
                          <span className="text-[9px] font-bold bg-destructive text-white px-1.5 py-0.5 rounded-full tracking-widest animate-pulse">NEW</span>
                        )}
                        {report.reportType && (
                          <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                            {report.reportType}
                          </span>
                        )}
                        {/* Status badge — shown inline on mobile */}
                        <span className={`ml-auto sm:hidden text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sc.badge}`}>
                          {sc.label}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                        {report.description || 'No description'}
                      </p>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
                          <User className="h-3 w-3 text-primary/60 shrink-0" />
                          {report.fullName || report.reporter_name || 'Anonymous'}
                        </span>
                        {(report.locationAddress || report.location_address) && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[200px]">{report.locationAddress || report.location_address}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          {report.seenAt?.toDate
                            ? format(report.seenAt.toDate(), 'MMM dd, yyyy · hh:mm a')
                            : report.timestamp?.toDate
                            ? format(report.timestamp.toDate(), 'MMM dd, yyyy · hh:mm a')
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Right column: status + actions (desktop) */}
                    <div className="flex items-center gap-2 sm:shrink-0 sm:flex-col sm:items-end sm:gap-2">
                      {/* Status badge — hidden on mobile (shown inline above) */}
                      <span className={`hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sc.badge}`}>
                        {sc.label}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold hover:bg-primary/10 hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); setSelectedReport(report); }}
                        >
                          View / Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); archiveSingleReport(report.id); }}
                          title="Archive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReportDetailDialog
        report={selectedReport}
        open={!!selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );
}
