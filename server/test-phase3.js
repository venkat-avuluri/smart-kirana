// Automated Test Suite for Smart Kirana Phase 3: Inventory Management & Immutable Stock Ledger

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SMART KIRANA - PHASE 3 VERIFICATION TEST SUITE');
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
    // 1. Authenticate Admin and Staff
    const adminLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'adminpassword123' }),
    });
    const adminData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminData.token, 'Admin session authenticated');
    const adminToken = adminData.token;

    const staffLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'staff', password: 'staffpassword123' }),
    });
    const staffData = await staffLoginRes.json();
    assert(staffLoginRes.status === 200 && staffData.token, 'Staff session authenticated');
    const staffToken = staffData.token;

    // Create a fresh test product for inventory tests
    const catRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const catData = await catRes.json();
    const categoryId = catData.categories[0]._id;

    const testBarcode = `INV${Date.now().toString().slice(-9)}`;
    const newProdRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Moong Dal Loose ${Date.now().toString().slice(-4)}`,
        category: categoryId,
        unit: 'kg',
        purchasePricePaise: 9000, // ₹90.00
        sellingPricePaise: 11000, // ₹110.00
        mrpPaise: 12000,          // ₹120.00
        currentStock: 0,
        minStockLevel: 10.000,
        barcodes: [testBarcode],
      }),
    });
    const newProdData = await newProdRes.json();
    assert(newProdRes.status === 201 && newProdData.product?._id, 'Created isolated test product for inventory flow');
    const productId = newProdData.product._id;

    // 2. OPENING STOCK & DUPLICATE PREVENTION
    console.log('\n--- 2. Opening Stock Tests ---');

    // 2.1 Record valid opening stock (50.500 kg)
    const openStockRes = await fetch(`${BASE_URL}/api/v1/inventory/opening-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId,
        quantity: 50.500,
        reason: 'Physical store count on rollout',
      }),
    });
    const openStockData = await openStockRes.json();
    assert(openStockRes.status === 201, 'Admin records opening stock successfully');
    assert(openStockData.transaction?.type === 'OPENING_STOCK', 'Ledger entry recorded with type OPENING_STOCK');
    assert(openStockData.transaction?.newStock === 50.500, 'Product cached stock updated to 50.500 kg');

    // 2.2 Attempt duplicate opening stock -> Must be rejected
    const dupOpenRes = await fetch(`${BASE_URL}/api/v1/inventory/opening-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId,
        quantity: 60,
      }),
    });
    assert(dupOpenRes.status === 500 || dupOpenRes.status === 400, 'Duplicate opening stock for same product is rejected');

    // 3. STOCK-IN (PURCHASE RECEIPT)
    console.log('\n--- 3. Stock-In Tests ---');

    // 3.1 Staff cannot perform stock-in
    const staffStockInRes = await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        productId,
        quantity: 20,
        reason: 'Staff purchase',
      }),
    });
    assert(staffStockInRes.status === 403, 'RBAC prevents Staff from performing stock-in (403)');

    // 3.2 Admin stocks in 25.250 kg
    const idempotencyTestKey = `IDEM-IN-${Date.now()}`;
    const stockInRes = await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId,
        quantity: 25.250,
        referenceId: 'PO-2026-001',
        reason: 'Supplier delivery from grain mandi',
        idempotencyKey: idempotencyTestKey,
      }),
    });
    const stockInData = await stockInRes.json();
    assert(stockInRes.status === 201, 'Admin successfully stocks in product (25.250 kg)');
    assert(stockInData.transaction?.previousStock === 50.500, 'Ledger previousStock correctly captured (50.500)');
    assert(stockInData.transaction?.newStock === 75.750, 'Ledger newStock correctly computed (75.750 kg)');

    // 3.3 Idempotency Replay Check (same key should not increase stock again)
    const idempotentReplayRes = await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId,
        quantity: 25.250,
        idempotencyKey: idempotencyTestKey,
      }),
    });
    const replayData = await idempotentReplayRes.json();
    assert(idempotentReplayRes.status === 201 && replayData.isIdempotentReplay === true, 'Idempotency key prevents duplicate stock-in mutation');

    // 4. STOCK-OUT (DAMAGE / WASTAGE)
    console.log('\n--- 4. Stock-Out Tests ---');

    const stockOutRes = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId,
        quantity: 5.750,
        type: 'DAMAGE',
        reason: 'Bag tear / moisture damage during transit',
      }),
    });
    const stockOutData = await stockOutRes.json();
    assert(stockOutRes.status === 201, 'Admin successfully records stock-out for damage (5.750 kg)');
    assert(stockOutData.transaction?.newStock === 70.000, 'Stock reduced accurately to 70.000 kg');
    assert(stockOutData.transaction?.type === 'DAMAGE', 'Ledger type recorded as DAMAGE');

    // 5. MANUAL ADJUSTMENT (INCREASE / DECREASE)
    console.log('\n--- 5. Stock Adjustment Tests ---');

    // 5.1 Set Target Mode: set to 65.000 kg
    const adjustRes = await fetch(`${BASE_URL}/api/v1/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId,
        adjustmentMode: 'SET_TARGET',
        value: 65.000,
        reason: 'Monthly physical inventory audit discrepancy',
      }),
    });
    const adjustData = await adjustRes.json();
    assert(adjustRes.status === 201, 'Stock adjustment (SET_TARGET mode) succeeds');
    assert(adjustData.transaction?.quantityDelta === -5.000, 'Calculates exact negative delta (-5.000 kg)');
    assert(adjustData.transaction?.newStock === 65.000, 'Stock matches target (65.000 kg)');

    // 6. NEGATIVE STOCK WARNING & OVERRIDE WORKFLOW
    console.log('\n--- 6. Negative Stock & Override Tests ---');

    // 6.1 Transaction causing negative stock without override -> Warning triggered
    const negWarnRes = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId,
        quantity: 100.000, // Stock is 65.000 -> would become -35.000!
        reason: 'Bulk removal',
        allowNegativeOverride: false,
      }),
    });
    const negWarnData = await negWarnRes.json();
    assert(negWarnRes.status === 400 && negWarnData.isNegativeWarning === true, 'Negative stock triggers non-blocking warning (400 with details)');
    assert(negWarnData.details?.resultingStock === -35.000, 'Accurately computes resulting negative stock (-35.000)');

    // 6.2 Transaction with authorized override -> Allowed and logged in ledger
    const negOverrideRes = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId,
        quantity: 100.000,
        reason: 'Emergency physical stock clearance',
        allowNegativeOverride: true,
        overrideReason: 'Shop owner authorized: Physical stock present on floor',
      }),
    });
    const negOverrideData = await negOverrideRes.json();
    assert(negOverrideRes.status === 201, 'Negative stock allowed with authorization override');
    assert(negOverrideData.transaction?.isNegativeStockOverride === true, 'Ledger flags isNegativeStockOverride: true');
    assert(negOverrideData.transaction?.newStock === -35.000, 'Accurately records negative stock in ledger (-35.000 kg)');

    // 7. LEDGER HISTORY & IMMUTABILITY
    console.log('\n--- 7. Ledger History & Immutability Tests ---');

    const ledgerRes = await fetch(`${BASE_URL}/api/v1/inventory/ledger?productId=${productId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const ledgerData = await ledgerRes.json();
    assert(ledgerRes.status === 200 && ledgerData.transactions?.length >= 5, 'Ledger captures every single stock movement');

    // Verify staff can read ledger
    const staffLedgerRes = await fetch(`${BASE_URL}/api/v1/inventory/ledger?limit=5`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffLedgerRes.status === 200, 'Staff can read inventory movement ledger');

    // 8. STOCK VALUATION REPORT
    console.log('\n--- 8. Stock Valuation Tests ---');

    // 8.1 Staff forbidden from viewing stock valuation
    const staffValRes = await fetch(`${BASE_URL}/api/v1/inventory/valuation`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffValRes.status === 403, 'RBAC prevents Staff from viewing store valuation (403)');

    // 8.2 Admin views valuation
    const valRes = await fetch(`${BASE_URL}/api/v1/inventory/valuation`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const valData = await valRes.json();
    assert(valRes.status === 200 && valData.valuationPaise >= 0, 'Admin fetches stock valuation at purchase cost');
    assert(typeof valData.methodology === 'string', 'Report explicitly documents purchase cost methodology');

    // 9. LOW STOCK REPORT
    console.log('\n--- 9. Low Stock Tests ---');

    const lowStockRes = await fetch(`${BASE_URL}/api/v1/inventory/low-stock`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const lowStockData = await lowStockRes.json();
    assert(lowStockRes.status === 200 && Array.isArray(lowStockData.items), 'Staff and Admin can access low-stock shortage report');

    // 10. CSV OPENING STOCK VALIDATION
    console.log('\n--- 10. CSV Opening Stock Import Tests ---');

    // Fresh product for CSV opening stock
    const csvTestProdRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `CSV Grain ${Date.now().toString().slice(-4)}`,
        category: categoryId,
        unit: 'kg',
        purchasePricePaise: 4000,
        sellingPricePaise: 5000,
        mrpPaise: 5000,
        currentStock: 0,
      }),
    });
    const csvTestProd = await csvTestProdRes.json();
    const csvProdName = csvTestProd.product.name;

    const validCsv = `Name,OpeningStock,Reason\n"${csvProdName}",120.000,"Physical stock audit"`;

    // Dry Run
    const dryRunRes = await fetch(`${BASE_URL}/api/v1/inventory/opening-stock/csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        csvText: validCsv,
        dryRun: true,
      }),
    });
    const dryRunData = await dryRunRes.json();
    assert(dryRunRes.status === 200 && dryRunData.dryRun === true, 'Opening stock CSV dry-run succeeds with preview');

    // Execute Import
    const commitCsvRes = await fetch(`${BASE_URL}/api/v1/inventory/opening-stock/csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        csvText: validCsv,
        dryRun: false,
      }),
    });
    const commitCsvData = await commitCsvRes.json();
    assert(commitCsvRes.status === 201 && commitCsvData.importedCount === 1, 'Opening stock CSV batch commits successfully');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`Phase 3 Test Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
