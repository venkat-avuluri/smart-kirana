import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

const seedInitialUsers = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_kirana';

  try {
    console.log('[Seed] Connecting to MongoDB at:', uri);
    await mongoose.connect(uri);

    // 1. Seed or verify Admin
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const admin = await User.create({
        name: 'Store Owner',
        username: 'admin',
        password: 'adminpassword123',
        role: 'ADMIN',
        phone: '9876543210',
        isActive: true,
      });
      console.log(' [Seed] Created default Admin user:');
      console.log('   Username: admin');
      console.log('   Password: adminpassword123');
      console.log('   Role: ADMIN');
    } else {
      console.log('ℹ [Seed] Admin account already exists (username: admin).');
    }

    // 2. Seed or verify Staff
    const staffExists = await User.findOne({ username: 'staff' });
    if (!staffExists) {
      const staff = await User.create({
        name: 'Billing Counter Staff',
        username: 'staff',
        password: 'staffpassword123',
        role: 'STAFF',
        phone: '9876543211',
        isActive: true,
      });
      console.log(' [Seed] Created default Staff user:');
      console.log('   Username: staff');
      console.log('   Password: staffpassword123');
      console.log('   Role: STAFF');
    } else {
      console.log('ℹ [Seed] Staff account already exists (username: staff).');
    }

    console.log('[Seed] Seeding completed successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ [Seed] Error seeding users:', error);
    process.exit(1);
  }
};

seedInitialUsers();
