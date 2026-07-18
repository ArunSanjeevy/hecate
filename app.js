'use strict';

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rTracer = require('cls-rtracer');
const path = require('path');

const env = process.env.NODE_ENV;
const config = require(path.join(__dirname, `./config/${env}-config.js`));
const logger = require('./lib/helpers/logger');
const errorHandler = require('./lib/middlewares/errorHandler');
const { authSdk, authControlPlane, authUser } = require('./lib/middlewares/authenticateRoute');

// Import routes
const healthRoute = require('./lib/routes/health-routes');
const authRoutes = require('./lib/routes/auth-routes');
const keysRoutes = require('./lib/routes/keys-routes');
const experimentsRoutes = require('./lib/routes/experiments-routes');
const assignmentsRoutes = require('./lib/routes/assignments-routes');
const eventsRoutes = require('./lib/routes/events-routes');
const resultsRoutes = require('./lib/routes/results-routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10kb' }));
app.use(rTracer.expressMiddleware());

if (env !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Public routes
app.use('/', healthRoute);
app.use('/api/v1/auth', authRoutes);
app.use('/sdk', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'js-sdk/dist')));

// The SDK receives only assignment/event access. Dashboard control-plane
// operations require a user JWT or a trusted server-side service key.
app.use('/api/v1/keys', authUser, keysRoutes);
app.use('/api/v1/experiments', authControlPlane, experimentsRoutes);
app.use('/api/v1/assignments', authSdk, assignmentsRoutes);
app.use('/api/v1/events', authSdk, eventsRoutes);
app.use('/api/v1/results', authControlPlane, resultsRoutes);

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'failed',
    error_code: 'route_not_found',
    message: "Sorry, can't find that!"
  });
});

// Centralized error handler
app.use(errorHandler);

// Database and Cache Startup logic
const { checkDbConnection } = require('./lib/data-accessors/db');
const { connectRedis } = require('./lib/cache/redis');
const migrate = require('./lib/helpers/migrate');

const startServer = async () => {
  try {
    // Connect to database and cache
    await checkDbConnection();
    await migrate();
    await connectRedis();

    if (env !== 'test') {
      const port = config.port || 4000;
      const server = app.listen(port, () => {
        logger.info(`Hecate server running on port ${port} [${env}]`);
      });
      const setupGracefulShutdown = require('./lib/helpers/graceful-shutdown');
      setupGracefulShutdown(server);
    }
  } catch (err) {
    logger.error('Failed to start Hecate server during startup checks', { error: err.message });
    if (env !== 'test') {
      process.exit(1);
    }
  }
};

// Execute startup sequence
startServer();

module.exports = app;
