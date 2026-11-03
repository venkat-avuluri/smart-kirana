// Automated Test Suite for Smart Kirana Phase 2: Product & Category Management

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SMART KIRANA - PHASE 2 VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  };

  try {
    // 1. Verify Phase 1 Auth integrity
    const adminLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'adminpassword123' }),
    });
    const adminData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminData.token, 'Admin authentication verified (Phase 1 preserved)');
    const adminToken = adminData.token;

    const staffLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'staff', password: 'staffpassword123' }),
    });
    const staffData = await staffLoginRes.json();
    assert(staffLoginRes.status === 200 && staffData.token, 'Staff authentication verified (Phase 1 preserved)');
    const staffToken = staffData.token;

    // 2. CATEGORY CRUD & PERMISSIONS
    console.log('\n--- Category Tests ---');

    // 2.1 Staff cannot create category
    const staffCreateCatRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ name: 'Staff Forbidden Cat' }),
    });
    assert(staffCreateCatRes.status === 403, 'RBAC prevents Staff from creating category (403)');

    // 2.2 Admin creates category
    const testCatName = `Grains & Pulses ${Date.now().toString().slice(-4)}`;
    const adminCreateCatRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: testCatName,
        description: 'Rice, wheat, dals, and whole grains',
      }),
    });
    const createdCat = await adminCreateCatRes.json();
    assert(adminCreateCatRes.status === 201 && createdCat.category?._id, 'Admin creates Category successfully');
    const categoryId = createdCat.category._id;

    // 2.3 Duplicate category name rejection
    const duplicateCatRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: testCatName }),
    });
    assert(duplicateCatRes.status === 400, 'Duplicate category name is rejected (400)');

    // 2.4 Staff can read categories
    const staffGetCatRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const staffCats = await staffGetCatRes.json();
    assert(staffGetCatRes.status === 200 && staffCats.categories.length > 0, 'Staff can read categories list');

    // 3. PRODUCT CRUD & VALIDATION
    console.log('\n--- Product Tests ---');

    const testBarcode = `890${Date.now().toString().slice(-10)}`;

    // 3.1 Price validation: Selling price > MRP must be rejected
    const invalidPriceRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Invalid Price Item',
        category: categoryId,
        unit: 'kg',
        purchasePricePaise: 5000,
        sellingPricePaise: 7000, // ₹70.00
        mrpPaise: 6000,          // ₹60.00 -> Invalid!
        currentStock: 10,
      }),
    });
    assert(invalidPriceRes.status === 400, 'Rejects product where Selling Price > MRP (400)');

    // 3.2 Decimal stock validation: Fractional stock for discrete units (piece/packet) must be rejected
    const invalidDecimalRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Soap Bar Piece',
        category: categoryId,
        unit: 'piece',
        purchasePricePaise: 2500,
        sellingPricePaise: 3000,
        mrpPaise: 3500,
        currentStock: 4.75, // Fractional piece -> Invalid!
      }),
    });
    assert(invalidDecimalRes.status === 400, 'Rejects fractional stock for discrete units (piece/packet) (400)');

    // 3.3 Create valid loose product with decimal quantity (e.g. 0.500 kg rice, 1.250 L oil)
    const validProductRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Premium Basmati Rice',
        description: 'Aged long grain rice',
        category: categoryId,
        barcodes: [testBarcode],
        unit: 'kg',
        purchasePricePaise: 8000, // ₹80.00
        sellingPricePaise: 9500,  // ₹95.00
        mrpPaise: 11000,          // ₹110.00
        currentStock: 25.500,     // 25.500 kg loose!
        minStockLevel: 5.000,
      }),
    });
    const validProdData = await validProductRes.json();
    assert(validProductRes.status === 201 && validProdData.product?._id, 'Admin creates loose product with decimal stock (25.5 kg)');
    const productId = validProdData.product._id;
    assert(validProdData.product.isLoose === true, 'Product automatically flagged as isLoose: true for kg unit');

    // 3.4 Barcode uniqueness test
    const duplicateBarcodeRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Duplicate Barcode Product',
        category: categoryId,
        unit: 'kg',
        purchasePricePaise: 4000,
        sellingPricePaise: 5000,
        mrpPaise: 5000,
        barcodes: [testBarcode], // Duplicate barcode!
        currentStock: 10,
      }),
    });
    assert(duplicateBarcodeRes.status === 400, 'Duplicate barcode registration is rejected (400)');

    // 3.5 Barcode fast lookup endpoint
    const barcodeLookupRes = await fetch(`${BASE_URL}/api/v1/products/barcode/${testBarcode}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const barcodeData = await barcodeLookupRes.json();
    assert(barcodeLookupRes.status === 200 && barcodeData.product?._id === productId, 'Fast barcode lookup returns correct product');

    // 3.6 Staff cannot edit product prices
    const staffEditRes = await fetch(`${BASE_URL}/api/v1/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ sellingPricePaise: 5000 }),
    });
    assert(staffEditRes.status === 403, 'RBAC prevents Staff from updating product prices or details (403)');

    // 3.7 Admin updates product price & checks price history preservation
    const adminPriceUpdateRes = await fetch(`${BASE_URL}/api/v1/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sellingPricePaise: 9800, // ₹98.00 (from ₹95.00)
      }),
    });
    const updatedProd = await adminPriceUpdateRes.json();
    assert(adminPriceUpdateRes.status === 200, 'Admin successfully updates product price');

    const getDetailRes = await fetch(`${BASE_URL}/api/v1/products/${productId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const detailData = await getDetailRes.json();
    assert(detailData.product.priceHistory?.length >= 2, 'Price history preserves previous price snapshots');

    // 4. CATEGORY DELETION SAFETY
    console.log('\n--- Category Safety Tests ---');

    // Attempt to delete category when product is assigned
    const deleteCatRes = await fetch(`${BASE_URL}/api/v1/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteCatRes.status === 400, 'Safety guard prevents deleting category with associated products (400)');

    // 5. CSV IMPORT & TEMPLATE TESTS
    console.log('\n--- CSV Import Tests ---');

    // 5.1 Template download
    const templateRes = await fetch(`${BASE_URL}/api/v1/products/csv/template`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const templateText = await templateRes.text();
    assert(templateRes.status === 200 && templateText.includes('PurchasePriceRupees'), 'CSV template download returns standard headers');

    // 5.2 CSV Validation: invalid selling price > MRP reported with row details
    const invalidCSV = `Name,Category,Unit,PurchasePriceRupees,SellingPriceRupees,MRPRupees,CurrentStock,MinStockLevel,Barcodes,Description
"Bad Row Product","Oils","L",100.00,150.00,120.00,10.000,5,"","Invalid price"`;

    const csvInvalidImportRes = await fetch(`${BASE_URL}/api/v1/products/csv/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ csvText: invalidCSV }),
    });
    const csvInvalidData = await csvInvalidImportRes.json();
    assert(csvInvalidImportRes.status === 400 && csvInvalidData.errors?.length > 0, 'CSV validation detects row-level errors (Selling price > MRP)');

    // 5.3 Valid CSV Import: Batch insertion
    const validCSV = `Name,Category,Unit,PurchasePriceRupees,SellingPriceRupees,MRPRupees,CurrentStock,MinStockLevel,Barcodes,Description
"CSV Imported Rice","${testCatName}","kg",45.00,52.00,55.00,100.500,20.000,"${Date.now()}1","Quality rice"
"CSV Imported Dal","${testCatName}","kg",110.00,125.00,130.00,45.250,10.000,"${Date.now()}2","Toor dal"`;

    const csvValidImportRes = await fetch(`${BASE_URL}/api/v1/products/csv/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ csvText: validCSV }),
    });
    const csvValidData = await csvValidImportRes.json();
    assert(csvValidImportRes.status === 201 && csvValidData.importedCount === 2, 'CSV batch import successfully inserts valid products');

    // 6. PAGINATION & SEARCH TESTS
    console.log('\n--- Search & Pagination Tests ---');

    const searchRes = await fetch(`${BASE_URL}/api/v1/products?search=Basmati`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const searchData = await searchRes.json();
    assert(searchRes.status === 200 && searchData.products?.length >= 1, 'Search query filters products by keyword');

    const pageRes = await fetch(`${BASE_URL}/api/v1/products?limit=2&page=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pageData = await pageRes.json();
    assert(pageRes.status === 200 && pageData.limit === 2 && pageData.totalPages >= 1, 'Pagination metadata calculated correctly');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`Phase 2 Test Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
