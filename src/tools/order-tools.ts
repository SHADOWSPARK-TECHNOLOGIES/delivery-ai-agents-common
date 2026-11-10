import { ToolDefinition, ToolResult } from '../core/types.js';

export interface OrderRefInput {
  orderId?: string;
  note?: string;
}

export interface AddressInput extends OrderRefInput {
  address?: string;
}

export interface OrderStatusData {
  orderId: string;
  status: 'placed' | 'confirmed' | 'preparing' | 'en_route' | 'delivered' | string;
  eta?: string;
  driver?: string;
}

export interface UpdateAddressData {
  orderId: string;
  updated: boolean;
}

export interface RescheduleData {
  orderId: string;
  time: string;
  changed: boolean;
}

/** Injected data access a vertical must supply. */
export interface OrderToolClients {
  getStatus: (input: OrderRefInput) => Promise<ToolResult<OrderStatusData>> | ToolResult<OrderStatusData>;
  updateAddress: (input: AddressInput) => Promise<ToolResult<UpdateAddressData>> | ToolResult<UpdateAddressData>;
  reschedule: (input: { orderId?: string; time?: string }) => Promise<ToolResult<RescheduleData>> | ToolResult<RescheduleData>;
  initiateReturn: (input: OrderRefInput) => Promise<ToolResult> | ToolResult;
}

// Matches whole order references like ORD-FG-7W2K9P, SSK-1001, ORD-123ABC.
const orderIdRe = /\b[A-Z]{2,4}[-_][A-Z0-9][A-Z0-9-]{2,}\b/gi;

function grabOrderId(text: string, existing: Record<string, unknown>): Record<string, unknown> {
  const candidates = text.match(orderIdRe);
  if (candidates && candidates.length > 0) {
    const best = [...candidates].sort((a, b) => b.length - a.length)[0];
    return { ...existing, orderId: best.toUpperCase() };
  }
  return existing;
}

const paramSchema = {
  type: 'object' as const,
  properties: {
    orderId: { type: 'string', description: 'Order reference, e.g. ORD-123456' },
    address: { type: 'string' },
    time: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['orderId'],
};

/** Builds the standard order-domain tools; the vertical injects its DB/API access. */
export function createOrderTools(clients: OrderToolClients): ToolDefinition[] {
  const { getStatus, updateAddress, reschedule, initiateReturn } = clients;
  return [
    {
      name: 'getOrderStatus',
      description: 'Return the current status and ETA of an order.',
      keywords: ['where is my order', 'order status', 'status of my order', 'track my order', 'my delivery status'],
      extract: (text) => grabOrderId(text, {}) as Record<string, unknown>,
      parameters: { ...paramSchema },
      execute: getStatus,
    },
    {
      name: 'updateAddress',
      description: "Change the delivery address of an order ('deliver to my office instead').",
      keywords: ['change address', 'deliver to', 'new address', 'different address', 'office instead', 'wrong address'],
      extract: (text) =>
        grabOrderId(text, { address: text.replace(/(change|deliver|address|to|instead|my)/gi, '').trim() }),
      parameters: { ...paramSchema },
      execute: updateAddress,
    },
    {
      name: 'rescheduleOrder',
      description: "Change the delivery time of an order (only valid when status is 'placed').",
      keywords: ['delivery time', 'reschedule', 'change delivery', 'new time', 'deliver at', 'change time', 'move it to', 'arrive later', 'arrive earlier'],
      extract: (text) => grabOrderId(text, { time: (text.match(/\d{1,2}(:\d{2})?\s*(am|pm)?/i) || [])[0] || 'this evening' }),
      parameters: { ...paramSchema },
      execute: reschedule,
    },
    {
      name: 'initiateReturn',
      description: 'Start a return or refund for an order against the return policy.',
      keywords: ['return', 'refund', 'return this', 'want a refund', 'return my order'],
      extract: (text) => grabOrderId(text, {}),
      parameters: { ...paramSchema },
      execute: initiateReturn,
    },
  ];
}
