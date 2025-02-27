const express = require('express');
const router = express.Router();
const axios = require('axios');
const Stock = require('../models/Stock');

const proxyUrl = 'https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock';

function anonymizeIP(ip) {
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
  } else {
    const parts = ip.split(':');
    return parts.slice(0, 3).join(':') + '::0';
  }
  return ip;
}

router.get('/stock-prices', async (req, res) => {
  try {
    const { stock, like } = req.query;
    if (!stock) return res.status(400).json({ error: 'Missing stock symbol(s)' });

    const symbols = Array.isArray(stock) ? stock : [stock];
    if (symbols.length > 2) return res.status(400).json({ error: 'Maximum of 2 stocks allowed' });

    const ip = req.ip;
    const anonymizedIP = anonymizeIP(ip);

    const stockData = [];
    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      const response = await axios.get(`${proxyUrl}/${upperSymbol}/quote`);
      if (!response.data.latestPrice) throw new Error('Invalid stock symbol');

      let stockDoc = await Stock.findOne({ symbol: upperSymbol });
      if (!stockDoc) stockDoc = new Stock({ symbol: upperSymbol, likes: [] });

      if (like === 'true' && !stockDoc.likes.includes(anonymizedIP)) {
        stockDoc.likes.push(anonymizedIP);
        await stockDoc.save();
      }

      stockData.push({
        symbol: upperSymbol,
        price: response.data.latestPrice,
        likes: stockDoc.likes.length
      });
    }

    if (stockData.length === 1) {
      res.json({ stockData: { stock: stockData[0].symbol, price: stockData[0].price, likes: stockData[0].likes } });
    } else {
      const relLikes1 = stockData[0].likes - stockData[1].likes;
      const relLikes2 = stockData[1].likes - stockData[0].likes;
      res.json({
        stockData: [
          { stock: stockData[0].symbol, price: stockData[0].price, rel_likes: relLikes1 },
          { stock: stockData[1].symbol, price: stockData[1].price, rel_likes: relLikes2 }
        ]
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;





