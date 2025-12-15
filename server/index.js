const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const SUPPORTED_STOCKS = ['GOOG', 'TSLA', 'AMZN', 'META', 'NVDA'];
let stockPrices = {
  GOOG: 140.50,
  TSLA: 250.00,
  AMZN: 130.00,
  META: 300.00,
  NVDA: 450.00
};

// MARKET SIMULATOR
setInterval(() => {
  SUPPORTED_STOCKS.forEach(ticker => {
    const volatility = 3.0;
    const change = (Math.random() * volatility * 2) - volatility;
    
    let newPrice = stockPrices[ticker] + change;
    if(newPrice < 1) newPrice = 1;
    
    stockPrices[ticker] = parseFloat(newPrice.toFixed(2));
  });

  io.emit('market-update', stockPrices);
}, 1000);

io.on('connection', (socket) => {
  socket.emit('market-update', stockPrices);
});

server.listen(3001, () => {
  console.log('MARKET SERVER RUNNING ON PORT 3001');
});