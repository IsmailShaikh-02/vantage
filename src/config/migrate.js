import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  // 1. Check out a dedicated client from the pool
  const client = await pool.connect();

  try {
    const migrationPath = path.join(__dirname, 'migrations', '001_deprovisioning_schema.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');

    console.log('Starting migration: 001_deprovisioning_schema.sql...');

    // 2. Wrap all DDL execution in a single atomic transaction
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('Migration completed successfully.');
  } catch (error) {
    // 3. Revert all changes if any query in the file fails
    await client.query('ROLLBACK');
    console.error('Migration failed. Rolled back all changes.');
    console.error(error);
    process.exit(1);
  } finally {
    // 4. Always release the client back to the pool and close the pool
    client.release();
    await pool.end();
  }
}

runMigration();