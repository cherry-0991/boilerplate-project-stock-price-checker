'use strict';

const fetch = require('node-fetch');
const crypto = require('crypto');
const Stock = require('../models/Stock');

// Helper function to anonymize IP (MD5 hash)
const anonymizeIP = (ip) => crypto.createHash('md5').update(ip).digest('hex');

module.exports = function (app) {
  
  app.route('/api/stock-prices')
    .get(async function (req, res) {
      try {
        let { stock, like } = req.query;
        
        // Get user's IP (behind a proxy, we might use x-forwarded-for).
        const userIp = req.ip || req.headers['x-forwarded-for'] || '';
        const ipHash = anonymizeIP(userIp);

        // If no stock symbol provided, respond with error
        if (!stock) {
          return res.status(400).json({ error: 'Stock parameter is required' });
        }

        // Helper function to fetch or create a stock in DB, update likes, and get price
        const processStock = async (symbol, likeFlag) => {
          // Normalize stock symbol to uppercase
          symbol = symbol.toUpperCase();

          // Find or create a Stock doc in Mongo
          let stockDoc = await Stock.findOne({ stock: symbol });
          if (!stockDoc) {
            stockDoc = new Stock({ stock: symbol, likes: 0, ips: [] });
          }

          // If "like" is requested and user hasn't liked before, increment likes
          if (likeFlag && !stockDoc.ips.includes(ipHash)) {
            stockDoc.likes++;
            stockDoc.ips.push(ipHash);
            await stockDoc.save();
          }

          // Fetch live price from the freeCodeCamp proxy
          const response = await fetch(
            `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`
          );
          const data = await response.json();

          // Return the data we need for the final response
          return {
            stock: symbol,
            price: data.latestPrice,
            likes: stockDoc.likes
          };
        };

        // If "stock" is an array, we have two stocks
        if (Array.isArray(stock)) {
          const likeFlag = (like === 'true' || like === true);
          
          // Process both in parallel
          const promises = stock.map(s => processStock(s, likeFlag));
          const results = await Promise.all(promises);

          // results is an array [stock1Data, stock2Data]
          const [stock1, stock2] = results;

          // Calculate relative likes
          const rel_likes1 = stock1.likes - stock2.likes;
          const rel_likes2 = stock2.likes - stock1.likes;

          return res.json({
            stockData: [
              { stock: stock1.stock, price: stock1.price, rel_likes: rel_likes1 },
              { stock: stock2.stock, price: stock2.price, rel_likes: rel_likes2 }
            ]
          });
        } else {
          // Single stock scenario
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
