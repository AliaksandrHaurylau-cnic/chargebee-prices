#!/bin/bash

# Check if an argument is provided
if [ -z "$1" ]; then
    echo "Usage: ./fetch-item-prices.sh ITEM_ID"
    exit 1
fi

# Set environment variable to disable certificate validation
# NOTE: This is for testing purposes only. In production, proper certificate handling should be used.
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Run the script with the provided item ID
npx ts-node src/get-item-prices.ts "$1"
