import { Marker, Circle } from 'react-leaflet';
import L from 'leaflet';

interface UserLocationProps {
  position: { lat: number; lng: number } | null;
  accuracy?: number;
}

const USER_ICON = L.divIcon({
  html: `<div class="user-location-dot"></div>`,
  className: 'user-location-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export function UserLocation({ position, accuracy }: UserLocationProps) {
  if (!position) return null;

  return (
    <>
      <Marker position={[position.lat, position.lng]} icon={USER_ICON} />
      {accuracy && (
        <Circle
          center={[position.lat, position.lng]}
          radius={accuracy}
          pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.1, color: '#3b82f6', weight: 1 }}
        />
      )}
    </>
  );
}
