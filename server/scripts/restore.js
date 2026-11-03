import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Smart Kirana - Database Restore Utility
 * Restores collections from a specified backup folder.
 * Usage: node scripts/restore.js [backup-folder-name]
 */
async function runRestore() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_kirana';
  const backupsBase = path.join(__dirname, '..', 'backups');

  // Determine target backup directory
  let targetFolder = process.argv[2];
  if (!targetFolder) {
    if (!fs.existsSync(backupsBase)) {
      console.error('❌ No backups directory found. Please run backup first.');
      process.exit(1);
    }
    const available = fs
      .readdirSync(backupsBase)
      .filter((d) => fs.statSync(path.join(backupsBase, d)).isDirectory() && d.startsWith('backup-'))
      .sort()
      .reverse();

    if (available.length === 0) {
      console.error('❌ No backup folders found in:', backupsBase);
      process.exit(1);
    }
    targetFolder = available[0];
    console.log(`ℹ️ No backup folder specified. Using latest available: ${targetFolder}`);
  }

  const targetDir = path.isAbsolute(targetFolder) ? targetFolder : path.join(backupsBase, targetFolder);

  if (!fs.existsSync(targetDir)) {
    console.error(`❌ Backup directory does not exist: ${targetDir}`);
    process.exit(1);
  }

  const manifestPath = path.join(targetDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Invalid backup folder: manifest.json is missing in ${targetDir}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  console.log('====================================================');
  console.log('🔄 SMART KIRANA - DATABASE RESTORE UTILITY');
  console.log(`Source Backup: ${targetDir}`);
  console.log(`Original Creation: ${manifest.createdAt}`);
  console.log('====================================================\n');

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to target database:', mongoose.connection.name);

    for (const [colName, colInfo] of Object.entries(manifest.collections)) {
      const filePath = path.join(targetDir, colInfo.file);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ File missing for collection '${colName}'. Skipping.`);
        continue;
      }

      const records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const collection = mongoose.connection.db.collection(colName);

      // Clean existing records in target collection
      await collection.deleteMany({});

      if (records.length > 0) {
        // Parse dates and ObjectIds where needed
        const processedRecords = records.map((rec) => {
          if (rec._id && typeof rec._id === 'string' && rec._id.length === 24) {
            rec._id = new mongoose.Types.ObjectId(rec._id);
          }
          return rec;
        });

        await collection.insertMany(processedRecords);
      }

      console.log(`📥 Restored collection '${colName}': ${records.length} records.`);
    }

    console.log('\n====================================================');
    console.log('✅ Database restore successfully completed!');
    console.log('====================================================');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Restore failed with error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runRestore();
