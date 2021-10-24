const Trends = require('../src/trends')
const base = {
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
}

describe('Trends', () => {

  let trends
  beforeEach(async () => {
    trends = new Trends()
    trends.setState({
      bids: {
        totalVolume: 10,
        totalAmount: 10,
        best: 5
      },
      asks: {
        totalVolume: 10,
        totalAmount: 10,
        best: 6
      }
    })
  })

  it('sets first state', async () => {
    expect(trends.state).toHaveProperty('asks')
  });

  it('process new state', async () => {
    trends.processNewState({
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
    })

    expect(trends.state.bids.best).toBe(4)
  });

  it('record change', async () => {
    trends.processNewState({
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
    })

    expect(trends.changes).toHaveLength(1)
    expect(trends.changes[0]).toBe(-0.1)
  });

  it('set negative trend', async () => {
    trends.processNewState({
      bids: {
        totalVolume: 10,
        totalAmount: 10,
        best: 4
      },
      asks: {
        totalVolume: 10,
        totalAmount: 10,
        best: 5
      }
    })

    expect(trends.trend).toBeLessThan(0)
  });

  it('set trend', async () => {
    trends.processNewState({
      bids: {
        totalVolume: 10,
        totalAmount: 10,
        best: 6
      },
      asks: {
        totalVolume: 10,
        totalAmount: 10,
        best: 7
      }
    })

    expect(trends.trend).toBeGreaterThan(0)
  });
})