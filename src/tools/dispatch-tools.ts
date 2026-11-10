import { ToolDefinition, ToolResult } from '../core/types.js';

export interface DriverAssignment {
  shipmentId?: string;
  driverId?: string;
  driverName?: string;
  etaMinutes?: number;
}

export interface DispatchToolClients {
  assignDriver: (input: { shipmentId?: string; driverId?: string }) => Promise<ToolResult<DriverAssignment>> | ToolResult<DriverAssignment>;
  getNearestDriver: (input: { area?: string; count?: number }) => Promise<ToolResult<DriverAssignment>> | ToolResult<DriverAssignment>;
}

const paramSchema = {
  type: 'object' as const,
  properties: {
    shipmentId: { type: 'string' },
    driverId: { type: 'string' },
    area: { type: 'string' },
    count: { type: 'number' },
  },
  required: [],
};

export function createDispatchTools(clients: DispatchToolClients): ToolDefinition[] {
  const { assignDriver, getNearestDriver } = clients;
  return [
    {
      name: 'assignDriver',
      description: 'Assign the nearest available driver to a shipment.',
      keywords: ['assign driver', 'find a driver', 'send a driver', 'who can pick up'],
      extract: (text) => {
        const m = text.match(/\b([A-Z]{2,3}[-_])?([A-Z0-9]{6,})\b/i);
        return { shipmentId: m ? m[0].toUpperCase() : undefined };
      },
      parameters: { ...paramSchema },
      execute: assignDriver,
    },
    {
      name: 'getNearestDriver',
      description: 'Return the nearest available driver for an area.',
      keywords: ['nearest driver', 'available driver', 'driver nearby', 'closest driver'],
      extract: (text) => {
        const m = text.match(/(?:in|at|near)\s+([a-z0-9 ,-]{3,40})/i);
        return { area: m ? m[1].trim() : undefined, count: 1 };
      },
      parameters: { ...paramSchema },
      execute: getNearestDriver,
    },
  ];
}
