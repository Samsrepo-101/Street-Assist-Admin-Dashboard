import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { getStatusConfig } from '../../api/reports.js';

export default function RecentReportsList({ reports }) {
  const recent = reports.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Recent Reports</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{reports.length} total incident reports</p>
        </div>
        <Link
          to="/reports"
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/8 hover:bg-primary/12 px-3 py-1.5 rounded-lg"
        >
          View All <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* List */}
      {recent.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No reports yet</div>
      ) : (
        <div className="divide-y divide-border">
          {recent.map((report) => {
            const sc = getStatusConfig(report.status);
            return (
              <Link
                key={report.id}
                to={`/reports`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors group"
              >
                {/* Status dot */}
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${sc.dot}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-primary">{report.report_id}</span>
                    {!report.admin_seen && (
                      <span className="text-[9px] font-bold bg-destructive text-white px-1.5 py-0.5 rounded-full tracking-wide">NEW</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {report.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {(report.fullName || report.reporter_name) && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />{report.fullName || report.reporter_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {report.locationAddress || report.location_address || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1 hidden sm:flex">
                      <Clock className="h-3 w-3" />
                      {report.seenAt?.toDate
                        ? format(report.seenAt.toDate(), 'MMM dd, yyyy')
                        : report.timestamp?.toDate
                        ? format(report.timestamp.toDate(), 'MMM dd, yyyy')
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${sc.badge}`}>
                  {sc.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}