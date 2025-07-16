interface PlanPriceDetails {
  itemId: string;
  itemName: string;
  itemType: string;
  itemFamily: string;
  prices: Array<{
    id: string;
    name: string;
    pricingModel: string;
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
  }>;
  charges?: Array<{
    id: string;
    name: string;
    type: string;
    price: number;
    currencyCode: string;
  }>;
  coupons?: Array<{
    id: string;
    name: string;
    discountType: string;
    discountAmount?: number;
    discountPercentage?: number;
    durationPeriod?: number;
    durationType?: string;
    maxRedemptions?: number;
    validTill?: Date;
    applyOn: string;
    itemConstraints: any;
  }>;
}

export type { PlanPriceDetails };