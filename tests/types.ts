// Type definitions for tests
export interface PriceDetail {
  id: string;
  name?: string;
  pricingModel?: string;
  currencyCode: string;
  price: number;
  period?: number;
  periodUnit?: string;
  trialPeriod?: number;
  trialPeriodUnit?: string;
  freeQuantity?: number;
  differentialPrices?: Array<{
    id: string;
    parentItemPriceId: string;
    price: number;
    currencyCode: string;
    parentItemId: string;
  }>;
}

export interface ItemDetail {
  itemId: string;
  itemName: string;
  itemType: string;
  itemFamily: string;
  prices: PriceDetail[];
  metadata?: any;
  charges?: Array<{
    id: string;
    name: string;
    type: string;
    price: number;
    currencyCode: string;
  }>;
  coupons?: Array<any>;
}

export interface DomainPriceInfo {
  id: string;
  price: number;
  currency: string;
}
