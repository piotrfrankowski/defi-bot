const Bot = require('../src/bot')
const wait = require('util').promisify(setTimeout)

describe('Bot', () => {

  let bot, mockOrderBook
  beforeEach(async () => {
    mockOrderBook = jest.fn().mockImplementation(async () => ({ bids: { best: 2 }, asks: { best: 3 } }))
    bot = new Bot(mockOrderBook, {
      ETH: 10,
      USD: 2000,
    })
  })

  afterEach(() => {
    bot.stop()
  })

  it('returns correct balance at start', async () => {
    await bot.start()
    const ethBalance = await bot.getBalance("ETH")
    expect(ethBalance).toEqual(10)
  });

  it('places orders after start', async () => {
    await bot.start()
    const placedOrders = bot.getPlacedOrders()
    expect(placedOrders).toHaveLength(10)
  });

  it('calculates trend based on volume and price', async () => {
    mockOrderBook.mockImplementation(async () => ({
      bids: {
        totalVolume: 10,
        totalAmount: 10,
        best: 5
      },
      asks: {
        totalVolume: 9,
        totalAmount: 9,
        best: 6
      }
    }))

    bot._refreshEvery = 100
    await bot.start()

    mockOrderBook.mockImplementation(async () => ({
      bids: {
        totalVolume: 10,
        totalAmount: 10,
        best: 4
      },
      asks: {
        totalVolume: 9,
        totalAmount: 9,
        best: 5
      }
    }))
    await wait(100)

    trend = bot.trends.getTrend()
    expect(trend).toBeLessThan(0)
  });

  it('removes order after cancelling', async () => {
    await bot.start()

    let placedOrders = bot.getPlacedOrders()
    expect(placedOrders).toHaveLength(10)

    bot.cancelOrder(2)

    placedOrders = bot.getPlacedOrders()
    expect(placedOrders).toHaveLength(9)
    expect(bot.orders['2']).toBeUndefined()
  });

  it('recreates proper number of orders', async () => {
    await bot.start()

    let placedOrders = bot.getPlacedOrders()
    expect(placedOrders).toHaveLength(10)

    bot.cancelOrder(0)
    bot.cancelOrder(1)
    bot.cancelOrder(8)
    bot.cancelOrder(9)

    placedOrders = bot.getPlacedOrders()
    expect(placedOrders).toHaveLength(6)

    bot.trends.trend = 0
    bot.placeNewOrders()

    placedOrders = bot.getPlacedOrders()
    expect(placedOrders).toHaveLength(10)

    expect(bot.orders).toHaveProperty('13')
  });

  it('updates balance after fullfilling order', async () => {
    await bot.start()

    bot.fillOrder(5, 1)

    const eth = bot.getBalance('ETH')
    const usd = bot.getBalance('USD')

    expect(eth).toBe(11)
    expect(usd).toBe(1995)
  });
})