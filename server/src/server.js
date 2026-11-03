import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import posRoutes from './routes/posRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Security Middlewares
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, automated test suites)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);

// General API rate limiter for DDoS and request flooding protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000, // 2000 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this network. Please retry shortly.',
  },
});
app.use('/api', apiLimiter);

// Request body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP logging in development
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiter for auth endpoints (prevents brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Smart Kirana API is active and healthy',
    systemTime: new Date().toISOString(),
    database: {
      connected: mongoose.connection.readyState === 1,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    },
    version: '1.0.0',
  });
});

// Mount Routes
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/pos', posRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/purchases', purchaseRoutes);
app.use('/api/v1/reports', reportRoutes);

// Catch-all 404 handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handler
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`[Smart Kirana Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`[Smart Kirana Server] API Base: http://localhost:${PORT}/api/v1`);
});

// Handle graceful shutdown
const gracefulShutdown = () => {
  console.log('\n[Smart Kirana Server] Gracefully shutting down...');
  server.close(async () => {
    await mongoose.connection.close(false);
    console.log('[Smart Kirana Server] HTTP server and MongoDB connections closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;
