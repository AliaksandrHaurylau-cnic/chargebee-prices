import { ChargeBee } from "chargebee-typescript";
import * as config from "./config.json";

// Import necessary modules for certificate handling
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Path to the certificate
const certPath = '/usr/local/share/ca-certificates/CertEmulationCA.crt';

// Create an HTTPS agent with the custom certificate
let httpsAgent;
try {
  httpsAgent = new https.Agent({
    ca: fs.existsSync(certPath) ? fs.readFileSync(certPath) : undefined
  });
} catch (error) {
  console.warn(`Warning: Could not read certificate at ${certPath}. Using default certificate handling.`);
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

/**
 * Fetches all prices for a specific item/plan
 * @param itemId - The ID of the item/plan
 * @returns Promise with the price details
 */
async function getPricesForItem(itemId: string): Promise<any> {
  try {
    // Step 1: Get item details
    const itemResponse = await chargebee.item.retrieve(itemId).request();
    const item = itemResponse.item;
    
    console.log(`Fetching prices for item: ${item.name} (${itemId})`);
    
    // Step 2: Get all prices for the item
    const itemPriceParams: any = {
      limit: 100
    };
    
    itemPriceParams["item_id[is]"] = itemId;
    
    const itemPricesResponse = await chargebee.item_price.list(itemPriceParams).request();
    
    const prices = itemPricesResponse.list.map((priceItem: any) => {
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
    
    // Step 3: Get differential prices for each price
    for (const price of prices) {
      try {
        const diffPriceParams: any = {
          limit: 100
        };
        
        diffPriceParams["item_price_id[is]"] = price.id;
        
        const differentialPricesResponse = await chargebee.differential_price.list(diffPriceParams).request();
        
        if (differentialPricesResponse.list.length > 0) {
          price.differentialPrices = differentialPricesResponse.list.map((diffPriceItem: any) => {
            const diffPrice = diffPriceItem.differential_price;
            return {
              id: diffPrice.id,
              parentItemPriceId: diffPrice.parent_item_price_id,
              price: diffPrice.price / 100,
              currencyCode: diffPrice.currency_code,
              parentItemId: diffPrice.parent_item_id
            };
          });
        }
      } catch (error) {
        console.warn(`Could not fetch differential prices for price ID ${price.id}:`, error);
      }
    }
    
    return {
      item: {
        id: item.id,
        name: item.name,
        type: item.type,
        familyId: item.family_id
      },
      prices
    };
  } catch (error) {
    console.error("Error fetching item prices:", error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check if item ID is provided as a command-line argument
    const itemId = process.argv[2];
    
    if (!itemId) {
      console.error("Please provide an item ID as a command-line argument");
      process.exit(1);
    }
    
    // Fetch prices for the item
    const itemPrices = await getPricesForItem(itemId);
    
    // Output results
    console.log(JSON.stringify(itemPrices, null, 2));
    
    console.log(`\nSuccessfully fetched ${itemPrices.prices.length} prices for item: ${itemPrices.item.name}`);
  } catch (error) {
    console.error("Script execution failed:", error);
    process.exit(1);
  }
}

// Run the script
main();
