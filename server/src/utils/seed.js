import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

dotenv.config();

const seedInitialData = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_kirana';

  try {
    console.log('[Seed] Connecting to MongoDB at:', uri);
    await mongoose.connect(uri);

    // 1. Seed or verify Admin
    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      admin = await User.create({
        name: 'Store Owner',
        username: 'admin',
        password: 'adminpassword123',
        role: 'ADMIN',
        phone: '9876543210',
        isActive: true,
      });
      console.log('✅ [Seed] Created default Admin user (admin / adminpassword123)');
    } else {
      console.log('ℹ [Seed] Admin account already exists (username: admin).');
    }

    // 2. Seed or verify Staff
    let staff = await User.findOne({ username: 'staff' });
    if (!staff) {
      staff = await User.create({
        name: 'Billing Counter Staff',
        username: 'staff',
        password: 'staffpassword123',
        role: 'STAFF',
        phone: '9876543211',
        isActive: true,
      });
      console.log('✅ [Seed] Created default Staff user (staff / staffpassword123)');
    } else {
      console.log('ℹ [Seed] Staff account already exists (username: staff).');
    }

    // 3. Seed default Kirana Categories
    const defaultCategories = [
      { name: 'Grains & Staples', description: 'Raw rice, wheat flour, dals, and loose grains' },
      { name: 'Edible Oils & Ghee', description: 'Mustard, sunflower, groundnut oil, and pure ghee' },
      { name: 'Spices & Masalas', description: 'Turmeric, chilli powder, whole spices, and blends' },
      { name: 'Packaged Foods & Snacks', description: 'Biscuits, noodles, chips, and snacks' },
      { name: 'Beverages & Dairy', description: 'Tea powder, coffee, packaged milk, and health drinks' },
      { name: 'Cleaning & Household', description: 'Detergents, soaps, surface cleaners, and repellents' },
    ];

    const categoryDocs = {};
    for (const cat of defaultCategories) {
      let existingCat = await Category.findOne({ name: cat.name });
      if (!existingCat) {
        existingCat = await Category.create(cat);
        console.log(`✅ [Seed] Created category: ${cat.name}`);
      }
      categoryDocs[cat.name] = existingCat;
    }

    // 4. Seed initial Kirana Products
    const sampleProducts = [
      {
        name: 'Sona Masoori Rice (Loose)',
        description: 'Polished aged raw rice for daily cooking',
        categoryName: 'Grains & Staples',
        unit: 'kg',
        isLoose: true,
        purchasePricePaise: 5200, // ₹52.00
        sellingPricePaise: 5800,  // ₹58.00
        mrpPaise: 6200,          // ₹62.00
        currentStock: 120.500,   // 120.500 kg
        minStockLevel: 25.000,
        barcodes: ['8901234567890'],
      },
      {
        name: 'Madhur Pure Sugar (Loose)',
        description: 'Refined sulphurless crystalline white sugar',
        categoryName: 'Grains & Staples',
        unit: 'kg',
        isLoose: true,
        purchasePricePaise: 3850, // ₹38.50
        sellingPricePaise: 4200,  // ₹42.00
        mrpPaise: 4500,          // ₹45.00
        currentStock: 75.250,    // 75.250 kg
        minStockLevel: 20.000,
        barcodes: [],
      },
      {
        name: 'Fortune Sunlite Sunflower Oil Pouch',
        description: '1 Litre refined sunflower oil pouch',
        categoryName: 'Edible Oils & Ghee',
        unit: 'L',
        isLoose: true,
        purchasePricePaise: 11500, // ₹115.00
        sellingPricePaise: 13200,  // ₹132.00
        mrpPaise: 14500,          // ₹145.00
        currentStock: 30.000,
        minStockLevel: 6.000,
        barcodes: ['8906007280014'],
      },
      {
        name: 'Toor Dal Desi (Loose)',
        description: 'Unpolished premium pigeon pea yellow dal',
        categoryName: 'Grains & Staples',
        unit: 'kg',
        isLoose: true,
        purchasePricePaise: 13500, // ₹135.00
        sellingPricePaise: 15500,  // ₹155.00
        mrpPaise: 16500,          // ₹165.00
        currentStock: 4.500,      // Low stock item! (below 10 kg)
        minStockLevel: 10.000,
        barcodes: [],
      },
      {
        name: 'Maggi 2-Minute Masala Noodles',
        description: '70g instant noodles packet with tastemaker',
        categoryName: 'Packaged Foods & Snacks',
        unit: 'packet',
        isLoose: false,
        purchasePricePaise: 1200, // ₹12.00
        sellingPricePaise: 1400,  // ₹14.00
        mrpPaise: 1400,          // ₹14.00
        currentStock: 96,
        minStockLevel: 24,
        barcodes: ['8901058852331'],
      },
      {
        name: 'Red Label Tea 250g',
        description: 'Brooke Bond Red Label strong CTC leaf blend',
        categoryName: 'Beverages & Dairy',
        unit: 'packet',
        isLoose: false,
        purchasePricePaise: 11000, // ₹110.00
        sellingPricePaise: 12500,  // ₹125.00
        mrpPaise: 13000,          // ₹130.00
        currentStock: 18,
        minStockLevel: 5,
        barcodes: ['8901030383188'],
      },
      {
        name: 'Surf Excel Quick Wash Detergent Bar',
        description: '250g fabric washing soap bar',
        categoryName: 'Cleaning & Household',
        unit: 'piece',
        isLoose: false,
        purchasePricePaise: 2700, // ₹27.00
        sellingPricePaise: 3200,  // ₹32.00
        mrpPaise: 3500,          // ₹35.00
        currentStock: 48,
        minStockLevel: 12,
        barcodes: ['8901030703818'],
      },
    ];

    for (const prod of sampleProducts) {
      const existing = await Product.findOne({ name: prod.name });
      if (!existing && categoryDocs[prod.categoryName]) {
        await Product.create({
          name: prod.name,
          description: prod.description,
          category: categoryDocs[prod.categoryName]._id,
          unit: prod.unit,
          isLoose: prod.isLoose,
          purchasePricePaise: prod.purchasePricePaise,
          sellingPricePaise: prod.sellingPricePaise,
          mrpPaise: prod.mrpPaise,
          currentStock: prod.currentStock,
          minStockLevel: prod.minStockLevel,
          barcodes: prod.barcodes,
          isActive: true,
          priceHistory: [
            {
              purchasePricePaise: prod.purchasePricePaise,
              sellingPricePaise: prod.sellingPricePaise,
              mrpPaise: prod.mrpPaise,
              changedAt: new Date(),
              changedBy: admin._id,
            },
          ],
        });
        console.log(`✅ [Seed] Created product: ${prod.name}`);
      }
    }

    console.log('🎉 [Seed] Seeding completed successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ [Seed] Error seeding data:', error);
    process.exit(1);
  }
};

seedInitialData();
