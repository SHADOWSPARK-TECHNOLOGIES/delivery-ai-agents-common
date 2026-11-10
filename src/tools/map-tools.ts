import { ToolDefinition, ToolResult } from '../core/types.js';

export interface EtaData {
  etaMinutes: number;
  distanceKm?: number;
}

export interface RouteData {
  from: string;
  to: string;
  polyline?: string;
  waypoints?: string[];
}

export interface MapToolClients {
  calculateETA: (input: { from?: string; to?: string }) => Promise<ToolResult<EtaData>> | ToolResult<EtaData>;
  geocodeAddress: (input: { address?: string }) => Promise<ToolResult<{ lat: number; lng: number; label: string }>> | ToolResult<{ lat: number; lng: number; label: string }>;
  getRoute: (input: { from?: string; to?: string }) => Promise<ToolResult<RouteData>> | ToolResult<RouteData>;
}

function pickArea(text: string, current: Record<string, unknown>, key: string): Record<string, unknown> {
  // crude: take the last "PlaceX to PlaceY" pair
  const areas = text.match(/(?:from|to|areas?)\s+([a-z0-9 ,-]{3,40})/gi);
  if (text.includes(' to ') && key === 'to') {
    const m = text.split(' to ');
    if (m[1]) return { ...current, [key]: m[1].trim() };
  }
  if (areas) return { ...current, [key]: areas[areas.length - 1].replace(/^(from|to|areas?)\s+/i, '').trim() };
  return current;
}

const paramSchema = {
  type: 'object' as const,
  properties: {
    from: { type: 'string' },
    to: { type: 'string' },
    address: { type: 'string' },
  },
  required: [],
};

export function createMapTools(clients: MapToolClients): ToolDefinition[] {
  const { calculateETA, geocodeAddress, getRoute } = clients;
  return [
    {
      name: 'calculateETA',
      description: 'Estimate delivery time in minutes between two areas.',
      keywords: ['how long', 'eta', 'arrive', 'minutes', 'delivery time', 'how far'],
      extract: (text) => pickArea(text, pickArea(text, {}, 'to'), 'from') as { from?: string; to?: string },
      parameters: { ...paramSchema },
      execute: calculateETA,
    },
    {
      name: 'geocodeAddress',
      description: 'Resolve a free-text Nigerian address to coordinates + label.',
      keywords: ['geocode', 'coordinates', 'where is', 'address', 'find area'],
      extract: (text) => ({ address: text.replace(/geocode|coordinates|address|where is|for/gi, '').trim() }),
      parameters: { ...paramSchema },
      execute: geocodeAddress,
    },
    {
      name: 'getRoute',
      description: 'Return a route between two points for a driver.',
      keywords: ['route', 'directions', 'navigate', 'path', 'shortest'],
      extract: (text) => pickArea(text, pickArea(text, {}, 'to'), 'from') as { from?: string; to?: string },
      parameters: { ...paramSchema },
      execute: getRoute,
    },
  ];
}
