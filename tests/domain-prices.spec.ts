import { describe, expect, test, jest } from '@jest/globals';
import { getDomainPrices } from '../src/index';

// Mock the getAllPricesForProductFamily function
jest.mock('../src/index', () => {
  const actual = jest.requireActual('../src/index');
  return {
    ...actual,
    getAllPricesForProductFamily: jest.fn()
  };
});

describe('getDomainPrices', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('filters prices correctly', async () => {
    // Mock implementation
    const mockGetAll = require('../src/index').getAllPricesForProductFamily as jest.Mock;
    mockGetAll.mockResolvedValueOnce([
      {
        itemId: 'com-domain-1y',
        itemName: '.com Domain',
        itemType: 'plan',
        itemFamily: 'test-family',
        prices: [
          {
            id: 'price1',
            currencyCode: 'USD',
            price: 10
          }
        ],
        metadata: { tld: 'com' }
      }
    ]);

    const result = await getDomainPrices('test-family', 'com');
    expect(result).toEqual([
      {
        id: 'price1',
        price: 10,
        currency: 'USD'
      }
    ]);
  });
});
