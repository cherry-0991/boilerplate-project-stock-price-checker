'use strict';
require('dotenv').config();
const express     = require('express');
const bodyParser  = require('body-parser');
const cors        = require('cors');
const helmet      = require('helmet');      // Using latest Helmet
const mongoose    = require('mongoose');    // Mongoose for MongoDB

const apiRoutes         = require('./routes/api.js');
const fccTestingRoutes  = require('./routes/fcctesting.js');
const runner            = require('./test-runner');

const app = express();

// Use Helmet for security.
app.use(helmet());

// Set Content Security Policy so only your own scripts and styles load.
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"]
    }
  })
);

app.use('/public', express.static(process.cwd() + '/public'));
app.use(cors({origin: '*'})); // For FCC testing purposes only

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB (update your URI as needed)
// If running locally, ensure that MongoDB is running on localhost:27017,
// or use a remote connection string (e.g., from MongoDB Atlas) via process.env.MONGO_URI.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/stockChecker';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

// For FCC testing purposes
fccTestingRoutes(app);

// Routing for API 
// Call the function directly with app instead of mounting as middleware.
apiRoutes(app);

// 404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

// Only start the server if this module is run directly
if (require.main === module) {
  const listener = app.listen(process.env.PORT || 3000, function () {
    console.log('Your app is listening on port ' + listener.address().port);
    if (process.env.NODE_ENV === 'test') {
      console.log('Running Tests...');
      setTimeout(function () {
        try {
          runner.run();
        } catch (e) {
          console.log('Tests are not valid:');
          console.error(e);
        }
      }, 3500);
    }
  });
}

module.exports = app; // Export the app for testing










