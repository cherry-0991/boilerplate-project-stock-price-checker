'use strict';

const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {
  // Sample test to ensure tests run
  test('Sample test to ensure tests run', function() {
    assert.isTrue(true);
  });

  // 1. Viewing one stock: GET request to /api/stock-prices
  test('Viewing one stock: GET request to /api/stock-prices', function(done) {
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: 'goog' })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        // Check that stockData exists and has the required properties
        assert.property(res.body, 'stockData');
        assert.property(res.body.stockData, 'stock');
        assert.property(res.body.stockData, 'price');
        assert.property(res.body.stockData, 'likes');
        assert.isString(res.body.stockData.stock, 'Stock symbol should be a string');
        assert.isNumber(res.body.stockData.price, 'Price should be a number');
        assert.isNumber(res.body.stockData.likes, 'Likes should be a number');
        done();
      });
  });

  // 2. Viewing one stock and liking it
  test('Viewing one stock and liking it: GET request to /api/stock-prices', function(done) {
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: 'msft', like: true })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.property(res.body, 'stockData');
        // Ensure stock symbol is returned as uppercase
        assert.equal(res.body.stockData.stock, 'MSFT');
        assert.property(res.body.stockData, 'price');
        assert.property(res.body.stockData, 'likes');
        // Expect likes to be at least 1 when liked for the first time
        assert.isAtLeast(res.body.stockData.likes, 1, 'Likes should be at least 1');
        done();
      });
  });

  // 3. Viewing the same stock and liking it again (should not increase like count)
  test('Viewing the same stock and liking it again: GET request to /api/stock-prices', function(done) {
    // First, like the stock
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: 'aapl', like: true })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        let initialLikes = res.body.stockData.likes;
        // Attempt to like it again from the same IP
        chai.request(server)
          .get('/api/stock-prices')
          .query({ stock: 'aapl', like: true })
          .end(function(err, res) {
            assert.equal(res.status, 200);
            let newLikes = res.body.stockData.likes;
            assert.equal(newLikes, initialLikes, 'Likes should not increase on repeated like from the same IP');
            done();
          });
      });
  });

  // 4. Viewing two stocks: GET request to /api/stock-prices with an array of two stocks
  test('Viewing two stocks: GET request to /api/stock-prices', function(done) {
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: ['goog', 'msft'] })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.property(res.body, 'stockData');
        assert.isArray(res.body.stockData, 'stockData should be an array');
        // Each object should have stock, price, and rel_likes properties
        res.body.stockData.forEach(stockData => {
          assert.property(stockData, 'stock');
          assert.property(stockData, 'price');
          assert.property(stockData, 'rel_likes');
        });
        done();
      });
  });

  // 5. Viewing two stocks and liking them: GET request to /api/stock-prices with like true
  test('Viewing two stocks and liking them: GET request to /api/stock-prices', function(done) {
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: ['goog', 'msft'], like: true })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.property(res.body, 'stockData');
        assert.isArray(res.body.stockData, 'stockData should be an array');
        res.body.stockData.forEach(stockData => {
          assert.property(stockData, 'stock');
          assert.property(stockData, 'price');
          assert.property(stockData, 'rel_likes');
        });
        done();
      });
  });
});

