# TypeScript tests for getDomainPrices function

This file tests the `getDomainPrices` function that was recently added to the project.

## Test Cases:

1. **Filtering by TLD in metadata**
   - Test that the function correctly filters items based on the TLD in metadata
   - Verify that items with matching TLD are included in the results

2. **Fallback to item ID check**
   - Test that the function falls back to checking item IDs when metadata is not available
   - Verify items with IDs containing the domain name are included

3. **Empty results**
   - Test that the function returns an empty array when no matching domains are found

4. **Error handling**
   - Test that errors from the underlying API call are properly propagated

## Implementation Approach:

The implementation should:
1. Mock the `getAllPricesForProductFamily` function to return controlled test data
2. Call the `getDomainPrices` function with various test parameters
3. Verify the results match expectations

## Manual Test Steps:

1. Run the test with: `npm test`
2. Verify all test cases pass
3. Check code coverage (if available)

## Expected Results:

- All tests pass
- Function correctly filters prices by TLD
- Function correctly handles error cases
