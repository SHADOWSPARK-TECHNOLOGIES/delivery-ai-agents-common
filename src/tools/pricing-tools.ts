import { ToolDefinition, ToolResult } from '../core/types.js';

export interface QuoteData {
  priceNgn: number;
  etaMinutes: number;
  service: '-' | string;
}

export interface PromoData {
  code: string;
  applied: boolean;
  amountOffNgn?: number;
  reason?: string;
}

export interface PricingToolClients {
  quoteDelivery: (input: {
    from?: string;
    to?: string;
    weightKg?: number;
    urgency?: '-' | 'standard' | 'express' | 'instant';
  }) => Promise<ToolResult<QuoteData>> | ToolResult<QuoteData>;
  applyPromo: (input: { code?: string; orderId?: string }) => Promise<ToolResult<PromoData>> | ToolResult<PromoData>;
}

function grab(input: string, re: RegExp, fallback = ''): string {
  const m = input.match(re);
  return m ? m[1] : fallback;
}

const paramSchema = {
  type: 'object' as const,
  properties: {
    from: { type: 'string' },
    to: { type: 'string' },
    weightKg: { type: 'number' },
    urgency: { type: 'string', enum: ['standard', 'express', 'instant'] },
    code: { type: 'string' },
    orderId: { type: 'string' },
  },
  required: [],
};

export function createPricingTools(clients: PricingToolClients): ToolDefinition[] {
  const { quoteDelivery, applyPromo } = clients;
  return [
    {
      name: 'quoteDelivery',
      description: 'Return a delivery price (₦) and ETA for a parcel between two areas, given weight + urgency.',
      keywords: ['quote', 'price', 'cost', 'how much', 'send ', 'deliver ', 'dispatch', 'parcel', 'charge', 'estimate'],
      extract: (text) => ({
        from: grab(text, /(?:from|pickup|pick)\s+([a-z0-9 ,-]{3,40})/i),
        to: grab(text, /(?:to|drop|deliver to)\s+([a-z0-9 ,-]{3,40})/i),
        weightKg: Number(grab(text, /(\d+(?:\.\d+)?)\s*kg/i) || 0) || undefined,
        urgency: (['instant', 'express', 'standard'].find((s) => text.toLowerCase().includes(s)) as '-' | undefined) || undefined,
      }),
      parameters: { ...paramSchema },
      execute: quoteDelivery,
    },
    {
      name: 'applyPromo',
      description: 'Apply a promo code to reduce the price of an order.',
      keywords: ['promo', 'discount', 'coupon', 'code', 'voucher'],
      extract: (text) => ({ code: grab(text, /([A-Z0-9]{4,})/i) }),
      parameters: { ...paramSchema },
      execute: applyPromo,
    },
  ];
}
