/**
 * Trends class responsible for calculating possible asset value changes
 */
class Trends {
  _historyLength = 3
  _trendMultiplier = 20

  constructor() {
    this.trend = 0
    this.changes = []
    this.state = null
  }

  /**
   * Resets state with new ordersbook 
   * @param {State} state current ordersbook
   */
  setState(state) {
    this.state = state
  }

  /**
   * Processes change between current and new state 
   * @param {State} state current ordersbook
   */
  processNewState(state) {
    const oldState = this.state

    const amountDiff = (state.bids.totalAmount - state.asks.totalAmount) / (state.bids.totalAmount + state.asks.totalAmount)
    const volumeDiff = (state.bids.totalVolume - state.asks.totalVolume) / (state.bids.totalVolume + state.asks.totalVolume)
    const avgChange = ((state.bids.best + state.asks.best) - (oldState.bids.best + oldState.asks.best)) / ((state.bids.best + state.asks.best) + (oldState.bids.best + oldState.asks.best))
    const bidChange = (state.bids.best / oldState.bids.best) / (state.asks.best / oldState.asks.best)

    this.changes.unshift(avgChange)
    if (this.changes.length > this._historyLength) {
      this.changes.length = this._historyLength
    }
    const historicChange = this.getHistoricChanges()

    this.trend = this._trendMultiplier * (
      (historicChange * amountDiff) + 
      (historicChange * volumeDiff) + 
      (historicChange * bidChange) + 
      (historicChange)
      ) / 4

    this.setState(state)
  }

  /**
   * Calculates weighted average of storef historic changes of average price 
   * @returns {number} historic changes
   */
  getHistoricChanges() {
    const len = this.changes.length
    const base = this.changes.reduce((sum, _, i) => sum + (len - i), 0)
    const sum = this.changes.reduce((sum, t, i) => sum + (t * (len - i)), 0)

    return sum / base || 0
  }

  /**
   * Returns trend value for current state
   * @returns {number} current trend
   */
  getTrend() {
    return this.trend
  }
}

module.exports = Trends