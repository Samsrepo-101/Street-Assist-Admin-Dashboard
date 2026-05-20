import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeToReports, moveReportToTrash, getStatusConfig, STATUS_CONFIG } from '../api/reports.js';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Clock, Trash2, Download, User, FileText, ChevronRight } from 'lucide-react';
import { format, isAfter, subDays } from 'date-fns';
import ReportDetailDialog from '../components/report/ReportDetailDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

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
      // Exclude soft-deleted reports
      if (r.deleted_at) return false;

      const matchSearch = !search ||
        r.description?.toLowerCase().includes(search.toLowerCase()) ||
        (r.locationAddress || r.location_address)?.toLowerCase().includes(search.toLowerCase()) ||
        r.report_id?.toLowerCase().includes(search.toLowerCase()) ||
        r.reportId?.toLowerCase().includes(search.toLowerCase()) ||
        (r.fullName || r.reporter_name)?.toLowerCase().includes(search.toLowerCase()) ||
        r.reportType?.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const reportCategory = r.category || "Individual";
      const matchCategory = categoryFilter === 'All' || reportCategory === categoryFilter;
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
  }, [reports, search, statusFilter, categoryFilter, townFilter, timeFilter]);

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

  const pendingCount = reports.filter(r => r.status === 'pending' && !r.deleted_at).length;
  const onProgressCount = reports.filter(r => r.status === 'on_progress' && !r.deleted_at).length;
  const newCount = reports.filter(r => !r.admin_seen && !r.deleted_at).length;

  return (
    <div className="space-y-5 w-full">

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Total', value: reports.filter(r => !r.deleted_at).length, color: 'bg-primary/10 text-primary' },
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
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by report ID, description, reporter..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm bg-muted/40 border-0 focus-visible:ring-1"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-9 text-sm bg-muted/40 border-0">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              <SelectItem value="Individual">Individual</SelectItem>
              <SelectItem value="Animal">Animal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-sm bg-muted/40 border-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={townFilter} onValueChange={setTownFilter}>
            <SelectTrigger className="w-44 h-9 text-sm bg-muted/40 border-0">
              <SelectValue placeholder="Town" />
            </SelectTrigger>
            <SelectContent>
              {CAM_NORTE_TOWNS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-36 h-9 text-sm bg-muted/40 border-0">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Dates">All Dates</SelectItem>
              <SelectItem value="Last 24h">Last 24h</SelectItem>
              <SelectItem value="Last 7 days">Last 7 days</SelectItem>
              <SelectItem value="Last 30 days">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" className="h-9 text-sm font-medium" onClick={downloadPDF}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export PDF
            </Button>
            {selected.size > 0 && (
              <Button variant="destructive" size="sm" className="h-9 text-sm" onClick={moveToTrash}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Trash ({selected.size})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Reports list */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-3.5 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {filtered.length} Report{filtered.length !== 1 ? 's' : ''} Found
          </p>
          <p className="text-xs text-muted-foreground">Click any report to view or edit details</p>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No reports found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((report) => {
              const sc = statusConfig[report.status] ?? statusConfig.pending;
              return (
                <div
                  key={report.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors cursor-pointer group"
                  onClick={() => setSelectedReport(report)}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(report.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(report.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-border accent-primary shrink-0"
                  />

                  {/* Color bar */}
                  <div className="w-0.5 h-12 rounded-full shrink-0" style={{ backgroundColor: sc.bar }} />

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-primary">
                        {report.report_id || report.id}
                      </span>
                      {!report.admin_seen && (
                        <span className="text-[9px] font-bold bg-destructive text-white px-1.5 py-0.5 rounded-full tracking-widest">NEW</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {report.description || 'No description'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                      <span className="flex items-center gap-1 text-xs font-medium text-foreground/70">
                        <User className="h-3 w-3 text-primary/60" />
                        {report.fullName || report.reporter_name || 'Anonymous'}
                      </span>
                      {(report.locationAddress || report.location_address) && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {report.locationAddress || report.location_address}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {report.seenAt?.toDate
                          ? format(report.seenAt.toDate(), 'MMM dd, yyyy · hh:mm a')
                          : report.timestamp?.toDate
                          ? format(report.timestamp.toDate(), 'MMM dd, yyyy · hh:mm a')
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Status + chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sc.badge}`}>
                      {sc.label}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReport(report);
                      }}
                    >
                      Edit
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
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
