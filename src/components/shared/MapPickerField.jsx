import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Camarines Norte center
const CAM_NORTE_CENTER = [14.2285, 122.6868];

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapPickerField({ latitude, longitude, onChange, disabled }) {
  const [showMap, setShowMap] = useState(false);

  const handlePick = (lat, lng) => {
    if (disabled) return;
    onChange(lat, lng);
  };

  const useMyLocation = () => {
    if (disabled) return;
    navigator.geolocation.getCurrentPosition(pos => {
      onChange(pos.coords.latitude, pos.coords.longitude);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowMap(v => !v)}>
          <MapPin className="h-3.5 w-3.5 mr-1.5" />
          {showMap ? 'Hide Map' : (latitude ? (disabled ? 'View on Map' : 'Change Pin') : 'Pin on Map')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={useMyLocation} disabled={disabled}>
          <Navigation className="h-3.5 w-3.5 mr-1.5" /> Use My Location
        </Button>
        {latitude && longitude && (
          <span className="text-xs text-muted-foreground font-mono">{Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}</span>
        )}
      </div>
      {showMap && (
        <div className="h-56 rounded-lg overflow-hidden border border-border">
          <MapContainer
            center={latitude && longitude ? [latitude, longitude] : CAM_NORTE_CENTER}
            zoom={latitude && longitude ? 14 : 11}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {!disabled && <ClickHandler onPick={handlePick} />}
            {latitude && longitude && <Marker position={[latitude, longitude]} />}
          </MapContainer>
        </div>
      )}
    </div>
  );
}