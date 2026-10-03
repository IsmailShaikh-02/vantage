import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                   // Maximum active sockets in the pool
  idleTimeoutMillis: 30000,  // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Error out after 2s if pool is exhausted
});

// Utility helper for single-query convenience
export const query = (text, params) => pool.query(text, params);