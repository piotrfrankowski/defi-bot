const https = require('https');
const http = require('http');

async function get(url) {
  return new Promise((resolve, reject) => {
    getProtocol(url)
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', (err) => reject(err));
  })
}

function getProtocol(url) {
  return url.startsWith('https')
    ? https
    : http
}

/**
 * @typedef {Object} OrderBookItem
 * @property {Number} totalVolume
 * @property {Number} totalAmount
 * @property {Number} best
 */

/**
 * @typedef {Object} OrderBook
 * @property {OrderBookItem} bids
 * @property {OrderBookItem} asks
 */

/**
 * Creates a market api fetcher for a single symbol:percision
 * @param {String} baseUrl 
 * @param {String} symbol 
 * @param {String} percision 25 or 250
 */
module.exports = (baseUrl, symbol, percision) => {
  const uri = `${baseUrl}/${symbol}/${percision}`

  /**
   * Fetches orders and splits into bids and asks
   * @returns {OrderBook}
   */
  const getOrderBook = async () => {
    const prices = await get(uri);

    const ordersMap = prices.reduce((orders, [price, count, amount]) => {
      let operation
      // Whereas observed behaviour shows that first price point is the bestBid and bestAsk respectively
      // lack of corresponding info in docs makes it necessary to determine best price points programmatically
      if (amount > 0) {
        operation = orders.bids
        if (operation.best < price) {
          operation.best = price
        }
      } else {
        operation = orders.asks
        if (operation.best > price) {
          operation.best = price
        }
      }

      amount = Math.abs(amount)

      operation.totalAmount += amount
      operation.totalVolume += count

      return orders
    }, {
      bids: {
        totalVolume: 0,
        totalAmount: 0,
        best: 0
      },
      asks: {
        totalVolume: 0,
        totalAmount: 0,
        best: +Infinity
      }
    })

    return ordersMap
  }

  return {
    getOrderBook
  }
}
