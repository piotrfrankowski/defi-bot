const marketApi = require('./marketApi')
const Bot = require('./bot')

const baseUrl = 'https://api.deversifi.com/bfx/v2/book'
const startingBalance = {
    ETH: 10,
    USD: 2000,
}

// Can change and add more argments
const api = marketApi(baseUrl, 'tETHUSD', 'P0')

// Create an instance of a bot
const bot = new Bot(api.getOrderBook, startingBalance)

// Start the bot
bot.start()

// Cleanup bot on kill signal
process.on('SIGINT', () => { 
    bot.stop()
    process.exit()
})