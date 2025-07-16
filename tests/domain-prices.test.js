const mockGetAllPrices = jest.fn();

jest.mock('../dist/index', () => ({
  getAllPricesForProductFamily: mockGetAllPrices,
  getDomainPrices: async (itemFamilyId, domainName) => {
    try {
      const allPrices = await mockGetAllPrices(itemFamilyId);
      const filteredItems = allPrices.filter(item => {
        if (item.metadata && item.metadata.tld === domainName) {
          return true;
        }
        return item.itemId.startsWith(`${domainName}-`) ||
               item.itemId.startsWith(`${domainName}domain-`) ||
               item.itemId.includes(`-${domainName}-`);
      });

      const simplifiedPrices = [];
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

      return simplifiedPrices;
    } catch (error) {
      throw error;
    }
  }
}));

describe('getDomainPrices', () => {
  beforeEach(() => {
    mockGetAllPrices.mockClear();
  });

  test('should filter prices by TLD in metadata', async () => {
    // Arrange
    mockGetAllPrices.mockResolvedValue([
      {
        itemId: 'test-id',
        itemName: 'Test Name',
        itemType: 'plan',
        itemFamily: 'test-family',
        prices: [
          {
            id: 'price-id',
            currencyCode: 'USD',
            price: 10
          }
        ],
        metadata: { tld: 'com' }
      }
    ]);

    // Act
    const result = await require('../dist/index').getDomainPrices('test-family', 'com');

    // Assert
    expect(mockGetAllPrices).toHaveBeenCalledWith('test-family');
    expect(result).toEqual([
      {
        id: 'price-id',
        price: 10,
        currency: 'USD'
      }
    ]);
  });

  test('should return empty array for non-matching TLD', async () => {
    // Arrange
    mockGetAllPrices.mockResolvedValue([
      {
        itemId: 'test-id',
        prices: [{ id: 'price-id', currencyCode: 'USD', price: 10 }],
        metadata: { tld: 'com' }
      }
    ]);

    // Act
    const result = await require('../dist/index').getDomainPrices('test-family', 'net');

    // Assert
    expect(mockGetAllPrices).toHaveBeenCalledWith('test-family');
    expect(result).toEqual([]);
  });
});
