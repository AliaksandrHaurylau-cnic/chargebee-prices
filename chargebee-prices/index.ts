import { ChargeBee } from "chargebee-typescript";

// Import necessary modules for certificate handling
import { PlanPriceDetails } from "./PlanPriceDetails";

// Initialize ChargeBee with your site name, API key, and custom HTTPS agent
const chargebee = new ChargeBee();
chargebee.configure({
    site: process.env.CHARGEBEE_SITE,
    api_key: process.env.CHARGEBEE_API_KEY,
});

/**
 * Fetches all plans with their prices, charges and applicable coupons for a given product family ID

 * @param itemFamilyId - The ID of the product family
 * @returns Promise<PlanPriceDetails[]> - Array of plan details with prices
 */
async function getAllPricesForProductFamily(itemFamilyId: string): Promise<PlanPriceDetails[]> {
    try {
        console.log(`Fetching data for product family ID: ${itemFamilyId}`);

        const itemFamilyResponse = await chargebee.item_family.retrieve(itemFamilyId).request();
        console.log(`Found item family: ${itemFamilyResponse.item_family.name}`);

        // Step 2: Get all items (plans) in the family
        let allItems: any[] = [];
        let offset: string | undefined;

        do {
            const itemListParams: any = {
                limit: 100, // Maximum allowed by API
                item_family_id: { is: itemFamilyId },
            };

            if (offset) {
                itemListParams.offset = offset;
            }

            const itemListResponse = await chargebee.item.list(itemListParams).request();

            allItems = [...allItems, ...itemListResponse.list.map((item: any) => item.item)];
            offset = itemListResponse.next_offset;
        } while (offset);

        console.log(`Found ${allItems.length} items in the family`);

        // Step 3: Get prices and assemble results
        const allPlans: PlanPriceDetails[] = [];

        for (const item of allItems) {
            const planDetails: PlanPriceDetails = {
                itemId: item.id,
                itemName: item.name,
                itemType: item.type,
                itemFamily: itemFamilyId,
                prices: [],
            };

            // Step 3.1: Fetch item prices
            const itemPriceParams: any = {
                limit: 100,
            };

            itemPriceParams["item_id[is]"] = item.id;

            const itemPricesResponse = await chargebee.item_price.list(itemPriceParams).request();

            planDetails.prices = itemPricesResponse.list.map((priceItem: any) => {
                const price = priceItem.item_price;
                return {
                    id: price.id,
                    name: price.name || "",
                    pricingModel: price.pricing_model || "flat_fee",
                    currencyCode: price.currency_code,
                    price: price.price / 100, // Converting from cents to dollars/euros
                    period: price.period,
                    periodUnit: price.period_unit,
                    trialPeriod: price.trial_period,
                    trialPeriodUnit: price.trial_period_unit,
                    freeQuantity: price.free_quantity,
                };
            });

            // Step 3.2: Fetch differential prices for each item price
            for (const price of planDetails.prices) {
                try {
                    const diffPriceParams: any = {
                        limit: 100,
                    };

                    diffPriceParams["item_price_id[is]"] = price.id;

                    const differentialPricesResponse = await chargebee.differential_price
                        .list(diffPriceParams)
                        .request();

                    if (differentialPricesResponse.list.length > 0) {
                        price.differentialPrices = differentialPricesResponse.list.map((diffPriceItem: any) => {
                            const diffPrice = diffPriceItem.differential_price;
                            return {
                                id: diffPrice.id,
                                parentItemPriceId: diffPrice.parent_item_price_id,
                                price: diffPrice.price / 100, // Converting from cents to dollars/euros
                                currencyCode: diffPrice.currency_code,
                                parentItemId: diffPrice.parent_item_id,
                            };
                        });
                    }
                } catch (error) {
                    console.warn(`Could not fetch differential prices for item price ID ${price.id}:`, error);
                }
            }

            // Step 3.3: Get attached charges (if any) - Using item.list API since item_charge doesn't seem to be supported
            try {
                const chargeParams: any = {
                    limit: 100,
                };

                chargeParams["id[is]"] = item.id;
                chargeParams["type[is]"] = "charge";

                const chargesResponse = await chargebee.item.list(chargeParams).request();

                if (chargesResponse.list.length > 0) {
                    planDetails.charges = chargesResponse.list.map((chargeItem: any) => {
                        const charge = chargeItem.item;
                        return {
                            id: charge.id,
                            name: charge.name,
                            type: charge.type || "charge",
                            price: charge.price ? charge.price / 100 : 0, // Converting from cents to dollars/euros
                            currencyCode: charge.currency_code || "USD",
                        };
                    });
                }
            } catch (error) {
                console.warn(`Could not fetch charges for item ID ${item.id}:`, error);
            }

            // Step 3.4: Get applicable coupons
            try {
                const couponParams: any = {
                    limit: 100,
                };

                // We're only interested in active coupons
                couponParams["status[is]"] = "active";

                const couponsResponse = await chargebee.coupon.list(couponParams).request();

                // Filter coupons that apply to this item/plan
                const applicableCoupons = couponsResponse.list
                    .filter((couponItem: any) => {
                        const coupon = couponItem.coupon;

                        // Check if coupon applies to this item family
                        if (coupon.apply_on === "all_items_in_family") {
                            const applies = coupon.item_family_ids?.includes(itemFamilyId);
                            return applies;
                        }

                        // Check if coupon applies to this specific item
                        if (coupon.apply_on === "specific_items") {
                            const applies = coupon.item_ids?.includes(item.id);
                            return applies;
                        }

                        // Check if coupon applies to all items
                        const applies = coupon.apply_on === "all_items";
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
                                itemIds: coupon.item_ids,
                            },
                        };
                    });

                if (applicableCoupons.length > 0) {
                    planDetails.coupons = applicableCoupons;
                }
            } catch (error) {
                console.warn(`Could not fetch coupons:`, error);
            }

            allPlans.push(planDetails);
        }

        return allPlans;
    } catch (error) {
        console.error("Error fetching product family data:", error);
        throw error;
    }
}

/**
 * Main function to execute the script
 */
async function main(itemFamilyId: string) {
    try {
        if (!itemFamilyId) {
            console.error("Please provide a product family ID as a command-line argument");
            process.exit(1);
        }

        // Fetch all prices
        const allPrices = await getAllPricesForProductFamily(itemFamilyId);

        // Output results
        console.log(JSON.stringify(allPrices, null, 2));

        console.log(
            `\nSuccessfully fetched data for ${allPrices.length} items with their prices, charges, and applicable coupons.`
        );

        return allPrices;
    } catch (error) {
        console.error("Script execution failed:", error);
        process.exit(1);
    }
}

export const handler = async (event: any) => {
    console.log(event);

    return main(event.itemFamilyId);
};
