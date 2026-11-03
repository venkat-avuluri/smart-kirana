// Automated Test Suite for Smart Kirana Phase 7: Final End-to-End Workflows, Security & Integrity Audit

const BASE_URL = 'http://localhost:5000';

async function runPhase7Tests() {
  console.log('====================================================');
  console.log('🧪 SMART KIRANA - PHASE 7 PRODUCTION READINESS SUITE');
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

    // --- SETUP TEST PRODUCT WITH STOCK ---
    const timestamp = Date.now().toString().slice(-6);
    const catRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `P7 Category ${timestamp}` }),
    });
    const catData = await catRes.json();
    const testCatId = catData.category._id;

    const testBarcode = `BAR7${timestamp}`;
    const prodRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `P7 Basmati Rice ${timestamp}`,
        category: testCatId,
        purchasePricePaise: 5000, // ₹50.00
        sellingPricePaise: 8000,  // ₹80.00
        mrpPaise: 10000,          // ₹100.00
        unit: 'kg',
        barcodes: [testBarcode],
        minStockLevel: 5,
        currentStock: 0,
      }),
    });
    const prodData = await prodRes.json();
    assert(prodRes.status === 201 && prodData.product?._id, 'Created isolated test product');
    const testProductId = prodData.product._id;

    // Add 100 kg initial stock via Stock-In
    await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        productId: testProductId,
        quantity: 100,
        reason: 'Phase 7 Initial opening inventory',
      }),
    });

    // --- TEST A: NORMAL SALE WORKFLOW ---
    console.log('\n--- TEST A: Normal Sale Workflow ---');
    // 1. Search for product by barcode
    const searchRes = await fetch(`${BASE_URL}/api/v1/products?search=${testBarcode}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const searchData = await searchRes.json();
    assert(
      searchRes.status === 200 && searchData.products.length === 1 && searchData.products[0]._id === testProductId,
      'Step 1: Product found by barcode search query'
    );

    // 2-6. Add to cart (5 kg), calculate total (5 * ₹80 = ₹400), complete cash payment
    const saleARes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: testProductId, quantity: 5 }],
        discountPaise: 0,
        payments: [{ method: 'CASH', amountPaise: 40000, cashTenderedPaise: 50000 }],
        customerName: 'Asha Patel',
      }),
    });
    const saleAData = await saleARes.json();
    assert(saleARes.status === 201 && saleAData.sale?.invoiceNumber, 'Steps 2-6: Cash sale completed & invoice generated');
    const saleAInvoice = saleAData.sale.invoiceNumber;
    const saleAId = saleAData.sale._id;

    // 7. Verify inventory deduction (100 - 5 = 95 kg)
    const stockAfterSaleARes = await fetch(`${BASE_URL}/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockAfterSaleA = (await stockAfterSaleARes.json()).product.currentStock;
    assert(stockAfterSaleA === 95, `Step 7: Inventory atomically deducted (expected 95 kg, got ${stockAfterSaleA} kg)`);

    // 8. Verify sales report includes the sale
    const reportRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reportData = await reportRes.json();
    assert(
      reportRes.status === 200 && reportData.summary?.netSalesRevenuePaise >= 40000,
      'Step 8: Sales report accurately reflects new invoice revenue'
    );

    // --- TEST B: FAILED SALE & COMPENSATING ROLLBACK ---
    console.log('\n--- TEST B: Failed Sale Rollback Verification ---');
    // Attempt checkout of 10 kg with simulated failure
    const failedSaleRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: testProductId, quantity: 10 }],
        payments: [{ method: 'CASH', amountPaise: 80000, cashTenderedPaise: 80000 }],
        simulateFailure: true,
      }),
    });
    assert(failedSaleRes.status >= 500, 'Step 1-2: Simulated database crash intercepted during sale');

    // Verify inventory consistency (must still be exactly 95 kg!)
    const stockAfterFailedSaleRes = await fetch(`${BASE_URL}/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockAfterFailedSale = (await stockAfterFailedSaleRes.json()).product.currentStock;
    assert(
      stockAfterFailedSale === 95,
      `Step 3-4: Compensating rollback restored stock to 95 kg (got ${stockAfterFailedSale} kg)`
    );

    // --- TEST C: UDHAR CREDIT & REPAYMENT WORKFLOW ---
    console.log('\n--- TEST C: Udhaar Credit & Repayment Workflow ---');
    const custPhone = `97${Date.now().toString().slice(-8)}`;
    // 1. Create customer
    const createCustRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        name: 'Kishore Kumar',
        phone: custPhone,
        address: 'Bazar Street 12',
      }),
    });
    const createCustData = await createCustRes.json();
    assert(createCustRes.status === 201 && createCustData.customer?._id, 'Step 1: Created customer for Udhaar');
    const custId = createCustData.customer._id;

    // 2. Generate credit sale: 2 kg @ ₹80 = ₹160 (16000 paise)
    const udhaarSaleRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: testProductId, quantity: 2 }],
        payments: [{ method: 'CREDIT_UDHAAR', amountPaise: 16000 }],
        customerId: custId,
      }),
    });
    const udhaarSaleData = await udhaarSaleRes.json();
    assert(udhaarSaleRes.status === 201, 'Step 2: Generated credit sale (₹160.00)');

    // 3. Verify customer ledger
    const custLedgerRes = await fetch(`${BASE_URL}/api/v1/customers/${custId}/ledger`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const custLedgerData = await custLedgerRes.json();
    assert(
      custLedgerData.transactions.length === 1 && custLedgerData.transactions[0].type === 'CREDIT_SALE',
      'Step 3: Customer ledger accurately recorded CREDIT_SALE transaction'
    );

    // 4. Record partial repayment of ₹100 (10000 paise)
    const repayRes = await fetch(`${BASE_URL}/api/v1/customers/${custId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        amountPaise: 10000,
        paymentMethod: 'CASH',
        notes: 'Partial weekly repayment',
      }),
    });
    const repayData = await repayRes.json();
    assert(repayRes.status === 201 && repayData.transaction?.type === 'PAYMENT', 'Step 4: Recorded partial customer repayment');

    // 5. Verify outstanding balance is ₹60 (6000 paise)
    const custDetailsRes = await fetch(`${BASE_URL}/api/v1/customers/${custId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const custBalance = (await custDetailsRes.json()).customer.currentBalancePaise;
    assert(custBalance === 6000, `Step 5: Customer outstanding balance is ₹60.00 (expected 6000, got ${custBalance})`);

    // --- TEST D: PURCHASE & SUPPLIER PAYABLE WORKFLOW ---
    console.log('\n--- TEST D: Purchase & Supplier Payable Workflow ---');
    const suppPhone = `96${Date.now().toString().slice(-8)}`;
    // 1. Create supplier
    const suppRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Wholesaler Krishna ${timestamp}`,
        phone: suppPhone,
      }),
    });
    const suppData = await suppRes.json();
    assert(suppRes.status === 201 && suppData.supplier?._id, 'Step 1: Admin created wholesale supplier');
    const suppId = suppData.supplier._id;

    // 2. Record purchase: 50 kg @ ₹45/kg = ₹2250 (225000 paise), paid ₹1000, credit ₹1250
    const stockBeforePurRes = await fetch(`${BASE_URL}/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockBeforePur = (await stockBeforePurRes.json()).product.currentStock;

    const purRes = await fetch(`${BASE_URL}/api/v1/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        supplierId: suppId,
        supplierInvoiceNumber: `INV-SUPP-${timestamp}`,
        items: [{ productId: testProductId, quantity: 50, purchasePricePaise: 4500 }],
        totalAmountPaise: 225000,
        paidAmountPaise: 100000,
        paymentMethod: 'UPI',
      }),
    });
    const purData = await purRes.json();
    assert(purRes.status === 201 && purData.purchase?.purchaseNumber, 'Step 2: Purchase entry recorded with partial payment');

    // 3. Verify inventory increased by 50 kg
    const stockAfterPurRes = await fetch(`${BASE_URL}/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockAfterPur = (await stockAfterPurRes.json()).product.currentStock;
    assert(
      stockAfterPur === stockBeforePur + 50,
      `Step 3: Inventory atomically increased by 50 kg (before: ${stockBeforePur}, after: ${stockAfterPur})`
    );

    // 4. Record supplier payment for remaining ₹1250 (125000 paise)
    const suppPayRes = await fetch(`${BASE_URL}/api/v1/suppliers/${suppId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        amountPaise: 125000,
        paymentMethod: 'UPI',
        reference: 'UPI/P7SETTLE',
      }),
    });
    assert(suppPayRes.status === 201, 'Step 4: Settled supplier payment via UPI');

    // 5. Verify outstanding payable settled to 0
    const suppCheckRes = await fetch(`${BASE_URL}/api/v1/suppliers/${suppId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const suppPayable = (await suppCheckRes.json()).supplier.currentPayablePaise;
    assert(suppPayable === 0, `Step 5: Supplier payable settled to exactly ₹0.00 (got ${suppPayable} paise)`);

    // --- TEST E: SALES RETURNS WORKFLOW ---
    console.log('\n--- TEST E: Sales Returns & Adjustment Workflow ---');
    // Sale A sold 5 kg of testProductId. Return 2 kg.
    const stockBeforeRetRes = await fetch(`${BASE_URL}/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockBeforeRet = (await stockBeforeRetRes.json()).product.currentStock;

    // 1-3. Locate sale A and process return for 2 kg (refund: 2 * ₹80 = ₹160 / 16000 paise)
    const returnRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${saleAId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        returnedItems: [{ productId: testProductId, quantity: 2 }],
        refundMethod: 'CASH',
        reason: 'Customer took 2 kg extra by mistake',
      }),
    });
    const returnData = await returnRes.json();
    assert(
      returnRes.status === 201 && returnData.saleReturn?.totalRefundPaise === 16000,
      'Step 1-3: Processed partial return with exact ₹160.00 refund'
    );

    // 4. Verify inventory restored (+2 kg)
    const stockAfterRetRes = await fetch(`${BASE_URL}/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockAfterRet = (await stockAfterRetRes.json()).product.currentStock;
    assert(
      stockAfterRet === stockBeforeRet + 2,
      `Step 4: Stock restored (+2 kg) via immutable SALE_RETURN ledger entry (before: ${stockBeforeRet}, after: ${stockAfterRet})`
    );

    // 5. Verify sales report adjustment
    const reportAfterRetRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const repAfterRet = await reportAfterRetRes.json();
    assert(
      repAfterRet.summary?.sales?.returnsRefundPaise >= 16000,
      'Step 5: Sales report accurately reflects refund deduction in net revenue'
    );

    // --- TEST F: DUPLICATE BILLING & IDEMPOTENCY ---
    console.log('\n--- TEST F: Duplicate Billing Prevention ---');
    const testIdempotencyKey = `IDEMP-${Date.now()}`;
    const payload = {
      idempotencyKey: testIdempotencyKey,
      items: [{ productId: testProductId, quantity: 1 }],
      payments: [{ method: 'CASH', amountPaise: 8000, cashTenderedPaise: 8000 }],
    };

    const firstPostRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify(payload),
    });
    const firstPostData = await firstPostRes.json();

    const secondPostRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify(payload),
    });
    const secondPostData = await secondPostRes.json();

    assert(
      firstPostData.sale._id === secondPostData.sale._id && secondPostData.isIdempotentReplay === true,
      'Duplicate request returns existing invoice without double billing'
    );

    // Verify inventory only deducted once (1 kg)
    const stockAfterIdempRes = await fetch(`${BASE_URL}/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockAfterIdemp = (await stockAfterIdempRes.json()).product.currentStock;
    assert(
      stockAfterIdemp === stockAfterRet - 1,
      'Stock deducted exactly once for idempotent replay'
    );

    // --- SECURITY & WHOLESALE COST MASKING AUDIT ---
    console.log('\n--- Security & Sensitive Data Masking Audit ---');

    // 1. Staff query for products hides purchasePricePaise
    const staffProdListRes = await fetch(`${BASE_URL}/api/v1/products?search=${testBarcode}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const staffProdList = await staffProdListRes.json();
    const fetchedByStaff = staffProdList.products[0];
    assert(
      fetchedByStaff.purchasePricePaise === undefined,
      'Staff cannot view product purchasePricePaise in product catalog list'
    );
    assert(
      fetchedByStaff.priceHistory === undefined,
      'Staff cannot view priceHistory in product catalog list'
    );

    // 2. Staff query for single product hides purchasePricePaise
    const staffSingleProdRes = await fetch(`${BASE_URL}/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const staffSingleProd = (await staffSingleProdRes.json()).product;
    assert(
      staffSingleProd.purchasePricePaise === undefined,
      'Staff cannot view purchasePricePaise on single product endpoint'
    );

    // 3. Staff query for low-stock items hides purchasePricePaise
    const staffLowStockRes = await fetch(`${BASE_URL}/api/v1/inventory/low-stock`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const staffLowStockData = await staffLowStockRes.json();
    const lowStockHasCost = staffLowStockData.items.some((i) => i.purchasePricePaise !== undefined);
    assert(!lowStockHasCost, 'Staff cannot view purchasePricePaise in low-stock reports');

    // 4. Staff query for sales bills hides purchasePricePaise in items
    const staffSalesRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${saleAId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const staffSaleData = await staffSalesRes.json();
    const saleItemHasCost = staffSaleData.sale.items.some((i) => i.purchasePricePaise !== undefined);
    assert(!saleItemHasCost, 'Staff cannot view purchasePricePaise in sale bill items');

    // 5. Admin DOES receive purchasePricePaise (updated to 4500 by purchase entry)
    const adminProdRes = await fetch(`${BASE_URL}/api/v1/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminProd = (await adminProdRes.json()).product;
    assert(
      adminProd.purchasePricePaise === 4500 || adminProd.purchasePricePaise === 5000,
      `Admin successfully retains access to wholesale purchasePricePaise (${adminProd.purchasePricePaise})`
    );

    // 6. Staff blocked from supplier routes (403 Forbidden)
    const staffSuppRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffSuppRes.status === 403, 'Staff blocked from supplier endpoints (403 Forbidden)');

    // 7. Staff blocked from purchase entry (403 Forbidden)
    const staffPurRes = await fetch(`${BASE_URL}/api/v1/purchases`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffPurRes.status === 403, 'Staff blocked from purchase endpoints (403 Forbidden)');

    // 8. Staff blocked from financial reports (403 Forbidden)
    const staffRepRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffRepRes.status === 403, 'Staff blocked from financial report dashboard (403 Forbidden)');

    // --- DATABASE RECONCILIATION API AUDIT ---
    console.log('\n--- Database Reconciliation API Audit ---');

    const reconRes = await fetch(`${BASE_URL}/api/v1/reports/reconciliation`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reconData = await reconRes.json();
    assert(
      reconRes.status === 200 && reconData.report?.auditTimestamp && reconData.report?.summary,
      'Admin successfully ran on-demand ledger reconciliation audit'
    );

    assert(
      reconData.report.sales.verifiedSalesCount > 0 && reconData.report.sales.discrepanciesCount === 0,
      '100% Sales Invoices arithmetic integrity verified (Zero discrepancies)'
    );

  } catch (err) {
    console.error('Unhandled exception during Phase 7 testing:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`📊 PHASE 7 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase7Tests();
