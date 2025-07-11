# ChargeBee Price Fetcher

This script fetches all prices, charges, and applicable coupons for all plans within a provided ChargeBee product family ID using ChargeBee's TypeScript SDK 2.0 and Product Catalog 2.0.

## Prerequisites

- Node.js (v14+)
- npm or yarn
- ChargeBee account with Product Catalog 2.0 enabled
- ChargeBee API credentials
- Certificate file for HTTPS connections (optional)

## Setup

1. Clone this repository or download the source code
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your ChargeBee credentials by editing `src/config.json`:
   ```json
   {
     "CHARGEBEE_SITE": "YOUR_SITE_NAME",
     "CHARGEBEE_API_KEY": "YOUR_API_KEY"
   }
   ```
4. Certificate configuration:
   - The script is configured to use a certificate at `/usr/local/share/ca-certificates/CertEmulationCA.crt`
   - If you need to use a different certificate or path, update the `certPath` variable in the source files

## Usage

### Main Script - Get All Prices for a Product Family

Run the script by providing a product family ID as a command-line argument:

```bash
npm run start YOUR_PRODUCT_FAMILY_ID
```

Or using ts-node directly:

```bash
npx ts-node src/index.ts YOUR_PRODUCT_FAMILY_ID
```

### Item-Specific Script - Get Prices for a Specific Item

To fetch prices for a specific item/plan:

```bash
npx ts-node src/get-item-prices.ts YOUR_ITEM_ID
```

### Using Environment Variables

You can also use environment variables instead of config.json:

1. Copy `.env.example` to `.env` and fill in your ChargeBee credentials
2. Use the example in `src/env-example.ts` as a reference for your implementation

## Output

The script outputs a JSON array containing all items (plans) in the specified product family, along with:

- Basic item details (ID, name, type)
- All item prices with their details (pricing model, currency, amount, period, etc.)
- Differential prices (if any)
- Associated charges (if any)
- Applicable coupons (active coupons that can be applied to the item or its family)

## API References

This script uses the following ChargeBee API endpoints:

- [Item Families](https://apidocs.eu.chargebee.com/docs/api/item_families)
- [Items](https://apidocs.eu.chargebee.com/docs/api/items)
- [Item Prices](https://apidocs.eu.chargebee.com/docs/api/item_prices)
- [Differential Prices](https://apidocs.eu.chargebee.com/docs/api/differential_prices)
- [Item Charges](https://apidocs.eu.chargebee.com/docs/api/charges_api)
- [Coupons](https://apidocs.eu.chargebee.com/docs/api/coupons)

## Notes

- The script converts all price values from cents to whole currency units (dollars, euros, etc.)
- Pagination is handled automatically for all API requests
- Error handling is implemented for each step of the process
