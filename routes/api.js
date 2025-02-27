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
        
        // Get the user's IP (or use x-forwarded-for)
        const userIp = req.ip || req.headers['x-forwarded-for'] || '';
        const ipHash = anonymizeIP(userIp);

        if (!stock) {
          return res.status(400).json({ error: 'Stock parameter is required' });
        }

        // Helper to process a single stock
        const processStock = async (symbol, likeFlag) => {
          // Normalize the stock symbol to uppercase
          symbol = symbol.toUpperCase();

          // Find or create the stock document
          let stockDoc = await Stock.findOne({ stock: symbol });
          if (!stockDoc) {
            stockDoc = new Stock({ stock: symbol, likes: 0, ips: [] });
          }
          // Ensure ips is an array
          if (!Array.isArray(stockDoc.ips)) {
            stockDoc.ips = [];
          }
          // If like is true and IP hasn't liked before, update likes
          if (likeFlag && !stockDoc.ips.includes(ipHash)) {
            stockDoc.likes++;
            stockDoc.ips.push(ipHash);
            await stockDoc.save();
          }
          
          // Fetch live price from the proxy
          const response = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`);
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error("Error parsing JSON from proxy. Response text:", text);
            // Return a fallback in case of error
            return { stock: symbol, price: NaN, likes: stockDoc.likes };
          }

          return { stock: symbol, price: Number(data.latestPrice), likes: stockDoc.likes };
        };

        // If two stocks are provided
        if (Array.isArray(stock)) {
          const likeFlag = (like === 'true' || like === true);
          const promises = stock.map(s => processStock(s, likeFlag));
          const results = await Promise.all(promises);

          const [stock1, stock2] = results;
          const rel_likes1 = stock1.likes - stock2.likes;
          const rel_likes2 = stock2.likes - stock1.likes;

          return res.json({
            stockData: [
              { stock: stock1.stock, price: stock1.price, rel_likes: rel_likes1 },
              { stock: stock2.stock, price: stock2.price, rel_likes: rel_likes2 }
            ]
          });
        } else {
          // Single stock request
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


