'use strict';

const fetch = require('node-fetch');
const crypto = require('crypto');
const Stock = require('../models/Stock');

// Helper function to anonymize IP using an MD5 hash
const anonymizeIP = (ip) => crypto.createHash('md5').update(ip).digest('hex');

module.exports = function (app) {
  app.route('/api/stock-prices')
    .get(async function (req, res) {
      try {
        let { stock, like } = req.query;
        
        // Get user's IP (or use x-forwarded-for if available)
        const userIp = req.ip || req.headers['x-forwarded-for'] || '';
        const ipHash = anonymizeIP(userIp);

        // If no stock symbol provided, return an error
        if (!stock) {
          return res.status(400).json({ error: 'Stock parameter is required' });
        }

        // Helper function to process a single stock:
        const processStock = async (symbol, likeFlag) => {
          // Normalize symbol to uppercase
          symbol = symbol.toUpperCase();

          // Find existing stock or create a new one
          let stockDoc = await Stock.findOne({ stock: symbol });
          if (!stockDoc) {
            stockDoc = new Stock({ stock: symbol, likes: 0, ips: [] });
          }
          // Ensure ips is always an array
          if (!Array.isArray(stockDoc.ips)) {
            stockDoc.ips = [];
          }
          // If like is requested and this IP hasn't liked before, update the document
          if (likeFlag && !stockDoc.ips.includes(ipHash)) {
            stockDoc.likes++;
            stockDoc.ips.push(ipHash);
            await stockDoc.save();
          }
          
          // Fetch live stock price from the proxy
          const response = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`);
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error("Error parsing JSON from proxy. Response text:", text);
            return { stock: symbol, price: NaN, likes: stockDoc.likes };
          }

          // Explicitly convert latestPrice to a Number
          return { stock: symbol, price: Number(data.latestPrice), likes: stockDoc.likes };
        };

        // If stock is an array (i.e., two stocks provided)
        if (Array.isArray(stock)) {
          const likeFlag = (like === 'true' || like === true);
          const promises = stock.map(s => processStock(s, likeFlag));
          const results = await Promise.all(promises);

          const [stock1, stock2] = results;
          // Calculate relative likes for each stock
          const rel_likes1 = stock1.likes - stock2.likes;
          const rel_likes2 = stock2.likes - stock1.likes;

          return res.json({
            stockData: [
              { stock: stock1.stock, price: stock1.price, rel_likes: rel_likes1 },
              { stock: stock2.stock, price: stock2.price, rel_likes: rel_likes2 }
            ]
          });
        } else {
          // For a single stock request
          const likeFlag = (like === 'true' || like === true);
          const result = await processStock(stock, likeFlag);
          return res.json({
            stockData: {
              stock: result.stock,
              price: result.price,
              likes: result.likes
            }
          });
        }
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });
};

