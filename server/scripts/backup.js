import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Smart Kirana - Production Database Backup Utility
 * Exports clean collection snapshots with audit metadata.
 * Can be run manually or configured via cron/scheduled task.
 */
async function runBackup() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_kirana';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', `backup-${timestamp}`);

  console.log('====================================================');
  console.log('📦 SMART KIRANA - DATABASE BACKUP UTILITY');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Target Directory: ${backupDir}`);
  console.log('====================================================\n');

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database.');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const collections = await mongoose.connection.db.listCollections().toArray();
    const manifest = {
      createdAt: new Date().toISOString(),
      database: mongoose.connection.name,
      collectionsCount: collections.length,
      collections: {},
    };

    for (const col of collections) {
      const colName = col.name;
      // Skip system collections
      if (colName.startsWith('system.')) continue;

      const data = await mongoose.connection.db.collection(colName).find({}).toArray();
      const filePath = path.join(backupDir, `${colName}.json`);

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      manifest.collections[colName] = {
        documentCount: data.length,
        file: `${colName}.json`,
        sizeBytes: fs.statSync(filePath).size,
      };

      console.log(`📁 Backed up collection '${colName}': ${data.length} records.`);
    }

    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    console.log('\n====================================================');
    console.log(`✅ Backup successfully completed! Stored at:\n${backupDir}`);
    console.log('====================================================');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Backup failed with error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runBackup();
