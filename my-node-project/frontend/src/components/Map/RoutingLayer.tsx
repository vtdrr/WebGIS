import { GeoJSON as GeoJSONComponent } from 'react-leaflet';
import type { RoutingResponse } from '../../types';

type RouteData = RoutingResponse['routes'][number];

interface RoutingLayerProps {
  route: RouteData | null;
  /** Straight line with no path data at all */
  fallback?: boolean;
}

const ROUTE_STYLE_ON_PATH = { color: '#2563eb', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' } as const;
const ROUTE_STYLE_OFF_NETWORK = { color: '#f97316', weight: 4, opacity: 0.9, dashArray: '2,8', lineCap: 'round' } as const;

export function RoutingLayer({ route, fallback }: RoutingLayerProps) {
  if (!route) return null;

  const steps = route.legs?.[0]?.steps;
  const hasStepGeometry = !!steps?.length && steps.every((s) => typeof s.geometry !== 'string');

  // Draw each step so off-network legs (no path data) look different from mapped paths
  if (hasStepGeometry && !fallback) {
    return (
      <>
        {steps!.map((step, i) => (
          <GeoJSONComponent
            key={`${i}-${step.off_network ? 'off' : 'on'}-${step.distance}`}
            data={step.geometry as GeoJSON.LineString}
            style={() => (step.off_network ? ROUTE_STYLE_OFF_NETWORK : ROUTE_STYLE_ON_PATH)}
          />
        ))}
      </>
    );
  }

  if (typeof route.geometry === 'string') return null;
  return (
    <GeoJSONComponent
      key={`${route.distance}-${route.duration}`}
      data={route.geometry}
      style={() => (fallback ? ROUTE_STYLE_OFF_NETWORK : ROUTE_STYLE_ON_PATH)}
    />
  );
}
