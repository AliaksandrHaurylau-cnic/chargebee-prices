import { ChargeBee } from "chargebee-typescript";
import * as config from "./config.json";

// Import necessary modules for certificate handling
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Debug mode flag - can be enabled with DEBUG=true environment variable
const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

/**
 * Debug logging function that only logs when DEBUG is enabled
 * @param message - The message to log
 * @param data - Optional data to log
 */
function debug(message: string, data?: any): void {
  if (DEBUG) {
    if (data) {
      if (typeof data === 'object') {
        console.log(`[DEBUG] ${message}`);
        console.dir(data, { depth: null, colors: true });
      } else {
        console.log(`[DEBUG] ${message}`, data);
      }
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }
}

// Path to the certificate
const certPath = '/usr/local/share/ca-certificates/CertEmulationCA.crt';

// Create an HTTPS agent with the custom certificate
let httpsAgent;
try {
  // For development/testing only - disable SSL verification
  httpsAgent = new https.Agent({
    ca: fs.existsSync(certPath) ? fs.readFileSync(certPath) : undefined,
    rejectUnauthorized: false // WARNING: Only use for development/testing
  });
  debug('HTTPS agent created with custom certificate and SSL verification disabled');
} catch (error) {
  console.warn(`Warning: Could not read certificate at ${certPath}. Using default certificate handling.`);
  debug('Certificate error:', error);
  httpsAgent = undefined;
}

// Initialize ChargeBee with your site name, API key, and custom HTTPS agent
const chargebee = new ChargeBee();
chargebee.configure({
  site: process.env.CHARGEBEE_SITE || config.CHARGEBEE_SITE,
  api_key: process.env.CHARGEBEE_API_KEY || config.CHARGEBEE_API_KEY,
  // Add the HTTPS agent to the configuration if available
  ...(httpsAgent ? { __request: { agent: httpsAgent } } : {})
});
debug('ChargeBee initialized with site:', process.env.CHARGEBEE_SITE || config.CHARGEBEE_SITE);

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
  metadata?: any; // New metadata field
}

/**
 * Fetches all plans with their prices, charges and applicable coupons for a given product family ID
 * @param itemFamilyId - The ID of the product family
 * @returns Promise<PlanPriceDetails[]> - Array of plan details with prices
 */
async function getAllPricesForProductFamily(itemFamilyId: string): Promise<PlanPriceDetails[]> {
  try {
    console.log(`Fetching data for product family ID: ${itemFamilyId}`);
    debug('Starting getAllPricesForProductFamily', { itemFamilyId });
    
    // Step 1: Verify item family exists
    debug('Step 1: Verifying item family exists');
    const itemFamilyResponse = await chargebee.item_family.retrieve(itemFamilyId).request();
    console.log(`Found item family: ${itemFamilyResponse.item_family.name}`);
    debug('Item family details:', itemFamilyResponse.item_family);
    
    // Step 2: Get all items (plans) in the family
    debug('Step 2: Getting all items in the family');
    let allItems: any[] = [];
    let offset: string | undefined;
    
    do {
      const itemListParams: any = {
        limit: 100 // Maximum allowed by API
        , item_family_id: { is: itemFamilyId }
      };
      
      if (offset) {
        itemListParams.offset = offset;
        debug('Using pagination offset', { offset });
      }
      
      debug('Fetching items with params', JSON.stringify(itemListParams, null, 2));
      const itemListResponse = await chargebee.item.list(itemListParams).request();
      
      debug('Item list response received', { 
        count: itemListResponse.list.length,
        hasNextPage: !!itemListResponse.next_offset
      });
      debug('Full item list response', JSON.stringify(itemListResponse, null, 2));
      debug('Raw item list array', itemListResponse.list);
      
      allItems = [...allItems, ...itemListResponse.list.map((item: any) => item.item)];
      offset = itemListResponse.next_offset;
    } while (offset);
    
    console.log(`Found ${allItems.length} items in the family`);
    
    // Step 3: Get prices and assemble results
    const allPlans: PlanPriceDetails[] = [];
    
    for (const item of allItems) {
      debug('Processing item', { id: item.id, name: item.name, type: item.type });
      
      const planDetails: PlanPriceDetails = {
        itemId: item.id,
        itemName: item.name,
        itemType: item.type,
        itemFamily: itemFamilyId,
        prices: [],
        metadata: item.metadata // Add metadata field from item response
      };
      
      // Step 3.1: Fetch item prices
      debug('Step 3.1: Fetching prices for item', item.id);
      const itemPriceParams: any = {
        limit: 100
      };
      
      itemPriceParams["item_id[is]"] = item.id;
      debug('Item price params', itemPriceParams);
      
      const itemPricesResponse = await chargebee.item_price.list(itemPriceParams).request();
      debug('Retrieved item prices', { count: itemPricesResponse.list.length });
      
      planDetails.prices = itemPricesResponse.list.map((priceItem: any) => {
        const price = priceItem.item_price;
        return {
          id: price.id,
          name: price.name || '',
          pricingModel: price.pricing_model || 'flat_fee',
          currencyCode: price.currency_code,
          price: price.price / 100, // Converting from cents to dollars/euros
          period: price.period,
          periodUnit: price.period_unit,
          trialPeriod: price.trial_period,
          trialPeriodUnit: price.trial_period_unit,
          freeQuantity: price.free_quantity
        };
      });
      
      // Step 3.2: Fetch differential prices for each item price
      for (const price of planDetails.prices) {
        debug('Step 3.2: Fetching differential prices for price', { priceId: price.id });
        try {
          const diffPriceParams: any = {
            limit: 100
          };
          
          diffPriceParams["item_price_id[is]"] = price.id;
          debug('Differential price params', diffPriceParams);
          
          const differentialPricesResponse = await chargebee.differential_price.list(diffPriceParams).request();
          debug('Retrieved differential prices', { count: differentialPricesResponse.list.length });
          
          if (differentialPricesResponse.list.length > 0) {
            price.differentialPrices = differentialPricesResponse.list.map((diffPriceItem: any) => {
              const diffPrice = diffPriceItem.differential_price;
              return {
                id: diffPrice.id,
                parentItemPriceId: diffPrice.parent_item_price_id,
                price: diffPrice.price / 100, // Converting from cents to dollars/euros
                currencyCode: diffPrice.currency_code,
                parentItemId: diffPrice.parent_item_id
              };
            });
            debug('Mapped differential prices', { count: price.differentialPrices?.length || 0 });
          }
        } catch (error) {
          console.warn(`Could not fetch differential prices for item price ID ${price.id}:`, error);
          debug('Error fetching differential prices', { priceId: price.id, error });
        }
      }
      
      // Step 3.3: Get attached charges (if any) - Using item.list API since item_charge doesn't seem to be supported
      debug('Step 3.3: Fetching charges for item', { itemId: item.id });
      try {
        const chargeParams: any = {
          limit: 100
        };
        
        chargeParams["id[is]"] = item.id;
        chargeParams["type[is]"] = "charge";
        debug('Charge params', chargeParams);
        
        const chargesResponse = await chargebee.item.list(chargeParams).request();
        debug('Retrieved charges', { count: chargesResponse.list.length });
        
        if (chargesResponse.list.length > 0) {
          planDetails.charges = chargesResponse.list.map((chargeItem: any) => {
            const charge = chargeItem.item;
            return {
              id: charge.id,
              name: charge.name,
              type: charge.type || 'charge',
              price: charge.price ? charge.price / 100 : 0, // Converting from cents to dollars/euros
              currencyCode: charge.currency_code || 'USD'
            };
          });
          debug('Mapped charges', { count: planDetails.charges?.length || 0 });
        }
      } catch (error) {
        console.warn(`Could not fetch charges for item ID ${item.id}:`, error);
        debug('Error fetching charges', { itemId: item.id, error });
      }
      
      // Step 3.4: Get applicable coupons
      debug('Step 3.4: Fetching applicable coupons');
      try {
        const couponParams: any = {
          limit: 100
        };
        
        // We're only interested in active coupons
        couponParams["status[is]"] = "active";
        debug('Coupon params', couponParams);
        
        const couponsResponse = await chargebee.coupon.list(couponParams).request();
        debug('Retrieved coupons', { count: couponsResponse.list.length });
        
        // Filter coupons that apply to this item/plan
        debug('Filtering coupons for item', { itemId: item.id, familyId: itemFamilyId });
        const applicableCoupons = couponsResponse.list
          .filter((couponItem: any) => {
            const coupon = couponItem.coupon;
            
            // Check if coupon applies to this item family
            if (coupon.apply_on === 'all_items_in_family') {
              const applies = coupon.item_family_ids?.includes(itemFamilyId);
              debug('Coupon family check', { 
                couponId: coupon.id, 
                applies,
                applyOn: coupon.apply_on,
                familyIds: coupon.item_family_ids
              });
              return applies;
            }
            
            // Check if coupon applies to this specific item
            if (coupon.apply_on === 'specific_items') {
              const applies = coupon.item_ids?.includes(item.id);
              debug('Coupon specific item check', { 
                couponId: coupon.id, 
                applies,
                applyOn: coupon.apply_on,
                itemIds: coupon.item_ids
              });
              return applies;
            }
            
            // Check if coupon applies to all items
            const applies = coupon.apply_on === 'all_items';
            debug('Coupon all items check', { 
              couponId: coupon.id, 
              applies,
              applyOn: coupon.apply_on
            });
            return applies;
          })
          .map((couponItem: any) => {
            const coupon = couponItem.coupon;
            return {
              id: coupon.id,
              name: coupon.name,
              discountType: coupon.discount_type,
              discountAmount: coupon.discount_amount ? coupon.discount_amount / 100 : undefined,
              discountPercentage: coupon.discount_percentage,
              durationPeriod: coupon.duration_period,
              durationType: coupon.duration_type,
              maxRedemptions: coupon.max_redemptions,
              validTill: coupon.valid_till ? new Date(coupon.valid_till * 1000) : undefined,
              applyOn: coupon.apply_on,
              itemConstraints: {
                itemFamilyIds: coupon.item_family_ids,
                itemIds: coupon.item_ids
              }
            };
          });
        
        debug('Filtered applicable coupons', { count: applicableCoupons.length });
        if (applicableCoupons.length > 0) {
          planDetails.coupons = applicableCoupons;
        }
      } catch (error) {
        console.warn(`Could not fetch coupons:`, error);
        debug('Error fetching coupons', { error });
      }
      
      debug('Adding plan details to results', { 
        itemId: planDetails.itemId,
        priceCount: planDetails.prices.length,
        chargeCount: planDetails.charges?.length || 0,
        couponCount: planDetails.coupons?.length || 0
      });
      allPlans.push(planDetails);
    }
    
    debug('Completed fetching all plan details', { count: allPlans.length });
    return allPlans;
  } catch (error) {
    console.error("Error fetching product family data:", error);
    debug('Fatal error in getAllPricesForProductFamily', { error });
    throw error;
  }
}

/**
 * Simplified interface for domain price information
 */
interface DomainPriceInfo {
  id: string;
  price: number;
  currency: string;
}

/**
 * Gets simplified price information for a specific domain TLD
 * @param itemFamilyId - The ID of the product family (e.g. "DoMain-Domains")
 * @param domainName - The TLD to filter by (e.g. "com", "info")
 * @returns Promise<DomainPriceInfo[]> - Array of simplified price information
 */
async function getDomainPrices(itemFamilyId: string, domainName: string): Promise<DomainPriceInfo[]> {
  try {
    debug('Starting getDomainPrices', { itemFamilyId, domainName });
    
    // Get all prices from the product family
    const allPrices = await getAllPricesForProductFamily(itemFamilyId);
    debug('Retrieved all prices', { count: allPrices.length });
    
    // Filter items by the domain TLD in metadata
    const filteredItems = allPrices.filter(item => {
      // Check if metadata exists and contains the specified TLD
      if (item.metadata && item.metadata.tld === domainName) {
        return true;
      }
      
      // Fallback to checking item ID/name if metadata is not available
      return (
        item.itemId.startsWith(`${domainName}-`) ||
        item.itemId.startsWith(`${domainName}domain-`) ||
        item.itemId.includes(`-${domainName}-`)
      );
    });
    
    debug('Filtered items by domain TLD', { count: filteredItems.length, domainName });
    
    // Extract simplified price information from filtered items
    const simplifiedPrices: DomainPriceInfo[] = [];
    
    filteredItems.forEach(item => {
      if (item.prices && item.prices.length > 0) {
        item.prices.forEach(price => {
          simplifiedPrices.push({
            id: price.id,
            price: price.price,
            currency: price.currencyCode
          });
        });
      }
    });
    
    debug('Generated simplified price information', { count: simplifiedPrices.length });
    return simplifiedPrices;
  } catch (error) {
    console.error(`Error fetching domain prices for ${domainName}:`, error);
    debug('Error in getDomainPrices', { error, domainName });
    throw error;
  }
}

/**
 * Main function to execute the script
 */
async function main() {
  debug('Script started');
  try {
    // Check if product family ID is provided as a command-line argument
    const itemFamilyId = process.argv[2];
    const operation = process.argv[3]; // Can be "domain" to use the new function
    const domainName = process.argv[4]; // Domain TLD if operation is "domain"
    
    debug('Command line arguments', { 
      argv: process.argv, 
      itemFamilyId, 
      operation, 
      domainName 
    });
    
    if (!itemFamilyId) {
      console.error("Please provide a product family ID as a command-line argument");
      debug('No product family ID provided, exiting');
      process.exit(1);
    }
    
    let result;
    
    // Check if we're using the simplified domain prices function
    if (operation === "domain" && domainName) {
      debug('Using getDomainPrices function');
      console.log(`Fetching prices for domain TLD: ${domainName}`);
      result = await getDomainPrices(itemFamilyId, domainName);
      console.log(`\nSuccessfully fetched ${result.length} prices for .${domainName} domain`);
    } else {
      // Default behavior: fetch all prices
      debug('Calling getAllPricesForProductFamily');
      result = await getAllPricesForProductFamily(itemFamilyId);
      debug('Retrieved all prices', { count: result.length });
      console.log(`\nSuccessfully fetched data for ${result.length} items with their prices, charges, and applicable coupons.`);
    }
    
    // Output results
    debug('Outputting JSON results');
    console.log(JSON.stringify(result, null, 2));
    
    debug('Script completed successfully');
  } catch (error) {
    console.error("Script execution failed:", error);
    debug('Script failed with error', { error });
    process.exit(1);
  }
}

// Export functions for testing
export { getAllPricesForProductFamily, getDomainPrices };

// Only run the script when this file is executed directly (not when imported in tests)
if (require.main === module) {
  main();
}
