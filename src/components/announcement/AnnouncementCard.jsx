import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Trash2, MapPin, Calendar, Phone, User, Map } from 'lucide-react';
import MapViewModal from '../shared/MapViewModal';

const categoryColors = {
  'Missing Person': 'bg-violet-100 text-violet-700 border-violet-200',
  'Missing Animal': 'bg-amber-100 text-amber-700 border-amber-200',
};

const statusColors = {
  'open': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'closed': 'bg-slate-100 text-slate-700 border-slate-200',
  'Reported': 'bg-emerald-100 text-emerald-700',
  'Under Response': 'bg-amber-100 text-amber-700',
  'Assisted': 'bg-sky-100 text-sky-700',
  'Closed': 'bg-slate-100 text-slate-700',
};

export default function AnnouncementCard({ announcement, onViewComments, onUpdateStatus, onDelete }) {
  const [mapOpen, setMapOpen] = useState(false);
  const hasLocation = announcement.latitude && announcement.longitude;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow border border-border">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {(announcement.imageUrl || announcement.image_url) && (
            <div className="md:w-52 h-52 md:h-auto shrink-0">
              <img
                src={announcement.imageUrl || announcement.image_url}
                alt={announcement.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={categoryColors[announcement.category] || 'bg-slate-100 text-slate-700 border-slate-200'}>
                {announcement.category || 'Missing Person'}
              </Badge>
              <Badge className={statusColors[announcement.status] || 'bg-slate-100 text-slate-700'}>
                {announcement.status === 'open' ? 'Open' :
                 announcement.status === 'closed' ? 'Closed' :
                 (announcement.status || 'Open')}
              </Badge>
            </div>

            <h3 className="font-bold text-foreground text-base">{announcement.title}</h3>
            {announcement.subtitle && <p className="text-sm text-muted-foreground">{announcement.subtitle}</p>}

            {announcement.name && (
              <div className="flex items-center gap-1.5 text-sm bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                <User className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground">{announcement.name}</span>
                {announcement.age && <span className="text-muted-foreground">· Age {announcement.age}</span>}
                {announcement.sex && <span className="text-muted-foreground">· {announcement.sex}</span>}
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {announcement.contact && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{announcement.contact}</span>
              )}
              {announcement.incident_date && (
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{announcement.incident_date}{announcement.incident_time && ` · ${announcement.incident_time}`}</span>
              )}
              {announcement.location_address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {announcement.location_address}
                  {hasLocation && (
                    <button onClick={() => setMapOpen(true)} className="ml-1 text-primary hover:underline font-medium">
                      View Map
                    </button>
                  )}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => onViewComments(announcement)}>
                <MessageCircle className="h-3.5 w-3.5 mr-1" /> Comments
              </Button>
              <Button variant="outline" size="sm" onClick={() => onUpdateStatus(announcement)}>
                Update Status
              </Button>
              {hasLocation && (
                <Button variant="outline" size="sm" onClick={() => setMapOpen(true)}>
                  <Map className="h-3.5 w-3.5 mr-1" /> View Location
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(announcement)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <MapViewModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        latitude={announcement.latitude}
        longitude={announcement.longitude}
        title={announcement.title}
        address={announcement.location_address}
      />
    </Card>
  );
}