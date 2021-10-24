const Trends = require('./trends')

/**
 * @typedef Order
 * @property {Number} price
 * @property {Number} amount
 */

/**
 * @typedef Balance
 * @property {Number} ETH
 * @property {Number} USD
 */

/**
 * Helper function that logs out debug messages depending on environment
 * @param {any} message data to be printed out
 */
const debug = process.env.LOG !== 'debug' ? () => { } : console.log

/**
 * Helper function that logs out operations
 * @param {any} message data to be printed out
 */
const log = process.env.ENV === 'test' ? () => { } : console.log

/**
 * Bot class responsible for trading
 * @param {function} getOrderBook fetches the order book split by bids and asks
 * @param {Balance} balance starting balance
 */
class Bot {
  _refreshEvery = 5000
  _reportEvery = 30000
  _reservedPercent = 0.05

  constructor(getOrderBook, balance) {
    this.getOrderBook = getOrderBook
    this.balance = balance

    this.balanceReserve = {}
    for (const symbol in balance) {
      this.balanceReserve[symbol] = this.balance[symbol] * this._reservedPercent
    }

    this.orders = {}
    this.orderId = 0
    this.tick = 0

    this.trends = new Trends()
  }

  /**
   * Start the bot and place initial orders
   * Watch for changes and fill on interval
   */
  async start() {
    debug("[Starting the bot]")

    const state = await this.getOrderBook()
    this.trends.setState(state)
    this.bestAsk = state.asks.best
    this.bestBid = state.bids.best

    debug("[Placing random orders]")

    this.placeStartingOrders()
    this.tick++

    debug("[Entering main loop]")

    this.refreshInterval = setInterval(() => { this.refresh() }, this._refreshEvery)
    this.raportInterval = setInterval(() => { this.raportBalance() }, this._reportEvery)
  }

  /**
   * Clears intervals for stopping the bot
   */
  stop() {
    debug("[Stopping the bot]")

    this.raportBalance()

    clearInterval(this.refreshInterval)
    clearInterval(this.raportInterval)
  }

  /**
   * Logs out balances
   */
  raportBalance() {
    for (const symbol in this.balance) {
      log(`BALANCE ${symbol} @ ${this.getBalance(symbol)}`)
    }
  }

  /**
   * Refreshes order book, based on it calculates trends and places, fills, and cancels orders
   */
  async refresh() {
    const newState = await this.getOrderBook()
    this.trends.processNewState(newState)
    this.bestAsk = newState.asks.best
    this.bestBid = newState.bids.best

    this.fillOrders()
    this.cancelOrders()
    this.placeNewOrders()

    this.tick++
  }

  /**
   * Places 5 random BID and 5 random ASK offers within 5% of best bid and best ask price
   */
  placeStartingOrders() {
    const bidThreshold = this.bestBid * 0.05
    const askThreshold = this.bestAsk * 0.05

    const estimatedETHinUSD = this.getBalance('USD') / this.bestBid

    const expandableETH = this.getBalance('ETH') / 5
    const expandableUSD = estimatedETHinUSD / 5

    for (let i = 0; i < 5; i++) {
      const bidPrice = this.bestBid + ((Math.random() * bidThreshold * 2) - bidThreshold)
      const askPrice = this.bestAsk + ((Math.random() * askThreshold * 2) - askThreshold)

      const bidAmount = Math.random() * expandableUSD
      const askAmount = Math.random() * expandableETH * -1

      this.placeOrder(bidPrice, bidAmount)
      this.placeOrder(askPrice, askAmount)
    }
  }

  /**
   * Should return a orders matching
   * @returns {Order[]} list of all placed orders (bids and asks) no ordering required
   */
  getPlacedOrders() {
    const orders = []
    for (const id in this.orders) {
      orders.push(this.orders[id])
    }

    return orders
  }

  /**
   * Should return available balance of the symbol
   * Total balance - placed orders
   * @param {String} symbol e.g. USD or ETH
   */
  getBalance(symbol) {
    return this.balance[symbol]
  }

  /**
   * trigger filling of orders which are in range
   * e.g. asks bellow bestAsk and bids above bestBid should be filled
   */
  async fillOrders() {
    for (const id in this.orders) {
      const order = this.orders[id]
      if ((order.amount > 0 && order.price > this.bestBid) || order.amount < 0 && order.price < this.bestAsk) {
        this.fillOrder(order.price, order.amount)
        delete this.orders[id]
      }
    }
  }

  /**
   * Updates balances and logs operation
   * @param {Number} price price of order filled
   * @param {Number} amount amount of asset
   */
  fillOrder(price, amount) {
    const dUSD = -1 * amount * price
    const eth = `ETH ${amount > 0 ? '+' : ''}${amount.toFixed(4)}`
    const usd = `USD ${amount < 0 ? '+' : ''}${dUSD.toFixed(4)}`

    this.balance.ETH += amount
    this.balance.USD += dUSD

    log(`FILLED ${amount > 0 ? 'BID' : 'ASK'} @ ${price.toFixed(8)} ${amount.toFixed(8)} (${eth} ${usd})`)
  }

  /**
   * Updates order list and logs operation
   * @param {Number} price price of order filled
   * @param {Number} amount amount of asset
   */
  placeOrder(price, amount) {
    this.orders[this.orderId++] = {
      price,
      amount,
      //at: this.trends.getTrend(),
      at: amount > 0 ? this.bestBid : this.bestAsk,
      tick: this.tick
    }

    log(`PLACE ${amount > 0 ? 'BID' : 'ASK'} @ ${price.toFixed(8)} ${amount.toFixed(8)}`)
  }

  /**
   * Based on trend and current prices, cancel orders that are 
   * not worth having
   */
  cancelOrders() {
    const trend = this.trends.getTrend()
    const expectedBid = this.bestBid * (1 + trend)
    const expectedAsk = this.bestAsk * (1 + trend)

    for (const id in this.orders) {
      const order = this.orders[id]
      // remove stuck orders
      if (order.tick < this.tick - 5) {
        this.cancelOrder(id)
        continue
      }
      // remove orders outside range
      if (order.amount > 0 && (order.price > expectedBid || order.at < this.bestBid)) {
        this.cancelOrder(id)
        continue
      }
      if (order.amount < 0 && (order.price < expectedAsk || order.at > this.bestAsk)) {
        this.cancelOrder(id)
      }
    }
  }

  /**
   * Cancel order based on its id
   * @param {Number} id order id
   */
  cancelOrder(id) {
    const order = this.orders[id]
    log(`CANCELLED ${order.amount > 0 ? 'BID' : 'ASK'} @ ${order.price.toFixed(8)} ${order.amount.toFixed(8)}`)

    delete this.orders[id]
  }

  /**
   * Based on trend and current prices, place new orders
   */
  placeNewOrders() {
    // find out how many needs to be placed
    let asksToPlace = 5
    let bidsToPlace = 5
    for (const id in this.orders) {
      if (this.orders[id].amount > 0) {
        bidsToPlace--
      } else {
        asksToPlace--
      }
    }

    const trend = this.trends.getTrend()

    debug(`[TREND: ${trend.toFixed(5)} ${this.bestBid.toFixed(1)} ${(this.bestBid * (trend + 1)).toFixed(1)}]`)

    // no expected movement of the market, place offers around current bests
    if (trend === 0) {
      const askGap = this.bestAsk * 0.001
      const bidGap = this.bestBid * 0.001

      for (let i = 0; i < asksToPlace; i++) {
        const price = this.bestAsk + (Math.random() * askGap)
        const amount = this.getAmountToAsk(asksToPlace)
        this.placeOrder(price, amount)
      }
      for (let i = 0; i < bidsToPlace; i++) {
        const price = this.bestBid - (Math.random() * bidGap)
        const amount = this.getAmountToBid(bidsToPlace)
        this.placeOrder(price, amount)
      }

      return
    }

    // expected change, try to estimate where next bests are going to be
    let expectedBid = this.bestBid + (this.bestBid * trend)
    let expectedAsk = this.bestAsk + (this.bestAsk * trend)

    if (expectedAsk < expectedBid) {
      expectedAsk += expectedBid - expectedAsk
      expectedBid -= expectedBid - expectedAsk
    }

    for (let i = 0; i < asksToPlace; i++) {
      const price = expectedAsk + (Math.random() * 5)
      const amount = this.getAmountToAsk(asksToPlace)
      this.placeOrder(price, amount)
    }
    for (let i = 0; i < bidsToPlace; i++) {
      const price = expectedBid - (Math.random() * 5)
      const amount = this.getAmountToBid(bidsToPlace)
      this.placeOrder(price, amount)
    }

    return
  }

  /**
   * Get amount for ask offer based on balance
   * @param {Number} parts number of parts to divide remaining balance by
   * @returns {Number} amount to offer
   */
  getAmountToAsk(parts) {
    // value between 0.001 and 1, based on trend , use tanh as sigmoid
    const amount = Math.max(0.001, (Math.tanh(-10 * this.trends.getTrend()) + 1) / 2)
    const ratio = (this.getBalance('ETH') - this.balanceReserve.ETH) / parts

    return -1 * ratio * amount
  }

  /**
   * Get amount for bid offer based on balance
   * @param {Number} parts number of parts to divide remaining balance by
   * @returns {Number} amount to offer
   */
  getAmountToBid(parts) {
    // value between 0 and 1, based on trend, use tanh as sigmoid
    const amount = Math.max(0.001, (Math.tanh(10 * this.trends.getTrend()) + 1) / 2)
    const estimatedETHinUSD = (this.getBalance('USD') - this.balanceReserve.USD) / this.bestBid
    const ratio = estimatedETHinUSD / parts

    return ratio * amount
  }
}

module.exports = Bot