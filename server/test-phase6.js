// Automated Test Suite for Smart Kirana Phase 6: Business Reports, Analytics & Intelligence Dashboard

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SMART KIRANA - PHASE 6 VERIFICATION TEST SUITE');
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

    // --- 2. RBAC ACCESS CONTROL TESTS ---
    console.log('\n--- 1. RBAC & Security Access Control ---');

    // A. Staff blocked from dashboard summary
    const staffDashRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffDashRes.status === 403, 'Staff blocked from business dashboard summary (403 Forbidden)');

    // B. Staff blocked from sales timeline
    const staffTimelineRes = await fetch(`${BASE_URL}/api/v1/reports/sales-timeline`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffTimelineRes.status === 403, 'Staff blocked from sales timeline analytics (403 Forbidden)');

    // C. Staff blocked from product profit reports
    const staffProdRes = await fetch(`${BASE_URL}/api/v1/reports/products`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffProdRes.status === 403, 'Staff blocked from product profit reports (403 Forbidden)');

    // D. Staff blocked from inventory valuation
    const staffInvRes = await fetch(`${BASE_URL}/api/v1/reports/inventory`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffInvRes.status === 403, 'Staff blocked from inventory valuation reports (403 Forbidden)');

    // E. Staff blocked from CSV export
    const staffExportRes = await fetch(`${BASE_URL}/api/v1/reports/export/sales`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffExportRes.status === 403, 'Staff blocked from exporting financial reports (403 Forbidden)');

    // F. Admin allowed into dashboard summary
    const adminDashRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminDashData = await adminDashRes.json();
    assert(
      adminDashRes.status === 200 && adminDashData.success && adminDashData.summary,
      'Admin successfully fetched business dashboard summary'
    );

    // --- 3. DATE RANGE PRESETS TESTS ---
    console.log('\n--- 2. Date Range Filter Testing ---');

    const rangesToTest = ['today', 'yesterday', 'last7days', 'last30days', 'thismonth', 'previousmonth'];
    for (const r of rangesToTest) {
      const res = await fetch(`${BASE_URL}/api/v1/reports/dashboard?range=${r}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert(
        res.status === 200 && data.summary && data.summary.period?.label,
        `Date filter preset '${r}' accepted and processed cleanly (${data.summary?.period?.label})`
      );
    }

    // Custom date range test
    const customRes = await fetch(
      `${BASE_URL}/api/v1/reports/dashboard?range=custom&startDate=2026-01-01&endDate=2026-12-31`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const customData = await customRes.json();
    assert(
      customRes.status === 200 && customData.summary && customData.summary.period?.range === 'custom',
      'Custom date range (2026-01-01 to 2026-12-31) accepted and parsed cleanly'
    );

    // --- 4. SALES, COGS & GROSS PROFIT CALCULATION VERIFICATION ---
    console.log('\n--- 3. Sales, COGS & Gross Profit Calculations ---');

    // Create a unique category and product with exact known purchase and selling price
    const catRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Analytics Cat ${Date.now()}` }),
    });
    const catData = await catRes.json();
    const testCatId = catData.category._id;

    // Cost: Rs 60 (6000 paise), Selling: Rs 100 (10000 paise), Margin per unit: Rs 40 (4000 paise)
    const prodRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Profit Test Item ${Date.now()}`,
        category: testCatId,
        purchasePricePaise: 6000,
        sellingPricePaise: 10000,
        mrpPaise: 12000,
        unit: 'piece',
        minStockLevel: 5,
        currentStock: 0,
      }),
    });
    const prodData = await prodRes.json();
    assert(prodRes.status === 201 && prodData.product?._id, 'Created test product with known cost and selling price');
    const testProdId = prodData.product._id;

    // Add 50 units initial stock via stock-in
    const stockInRes = await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        productId: testProdId,
        quantity: 50,
        reason: 'Initial test stock for profit analytics',
      }),
    });
    assert(stockInRes.status === 200 || stockInRes.status === 201, 'Added initial stock of 50 units');

    // Record baseline dashboard metrics for 'today'
    const baselineRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const baselineData = await baselineRes.json();
    const baseSummary = baselineData.summary;

    // Execute POS Checkout: 3 units @ Rs 100 = Rs 300 (30000 paise)
    // COGS: 3 * Rs 60 = Rs 180 (18000 paise)
    // Expected Gross Profit: Rs 300 - Rs 180 = Rs 120 (12000 paise)
    const saleRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: testProdId, quantity: 3 }],
        discountPaise: 0,
        payments: [{ method: 'UPI', amountPaise: 30000, reference: 'UPI/P6TEST1' }],
      }),
    });
    const saleData = await saleRes.json();
    assert(saleRes.status === 201 && saleData.sale?._id, 'Created test POS sale with known cost and selling price');
    const saleId = saleData.sale._id;

    // Verify Dashboard Metrics Update
    const afterSaleRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterSaleData = await afterSaleRes.json();
    const afterSummary = afterSaleData.summary;

    assert(
      afterSummary.netSalesRevenuePaise - baseSummary.netSalesRevenuePaise === 30000,
      `Net sales revenue increased by exactly 30000 paise (Rs 300) [diff: ${afterSummary.netSalesRevenuePaise - baseSummary.netSalesRevenuePaise}]`
    );

    const cogsDiff = (afterSummary.profit?.costOfGoodsSoldPaise || 0) - (baseSummary.profit?.costOfGoodsSoldPaise || 0);
    assert(
      cogsDiff === 18000,
      `COGS increased by exactly 18000 paise (Rs 180 = 3 units * Rs 60 purchase price) [diff: ${cogsDiff}]`
    );

    assert(
      afterSummary.grossProfitPaise - baseSummary.grossProfitPaise === 12000,
      `Gross profit increased by exactly 12000 paise (Rs 120 = Revenue - COGS) [diff: ${afterSummary.grossProfitPaise - baseSummary.grossProfitPaise}]`
    );

    assert(
      afterSummary.totalBills - baseSummary.totalBills === 1,
      'Completed bills incremented by 1'
    );

    assert(
      afterSummary.upiCollectionsPaise - baseSummary.upiCollectionsPaise === 30000,
      'UPI collections accurately incremented by 30000 paise'
    );

    // --- 5. SALES RETURNS IMPACT ON REVENUE & PROFIT ---
    console.log('\n--- 4. Sales Return Deduction Verification ---');

    // Return 1 unit: Refund Rs 100 (10000 paise).
    // Restored COGS: 1 * Rs 60 = Rs 60 (6000 paise).
    // Profit deduction: Rs 40 (4000 paise).
    const returnRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${saleId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        returnedItems: [{ productId: testProdId, quantity: 1 }],
        refundMethod: 'CASH',
        reason: 'Customer bought extra by mistake',
      }),
    });
    const returnData = await returnRes.json();
    assert(returnRes.status === 201 && returnData.saleReturn, 'Processed partial sales return for 1 unit');

    const afterReturnRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterReturnData = await afterReturnRes.json();
    const afterReturnSummary = afterReturnData.summary;

    assert(
      afterReturnSummary.netSalesRevenuePaise === afterSummary.netSalesRevenuePaise - 10000,
      'Net sales revenue correctly decreased by refunded amount (10000 paise)'
    );

    const cogsAfterReturnDiff = (afterSummary.profit?.costOfGoodsSoldPaise || 0) - (afterReturnSummary.profit?.costOfGoodsSoldPaise || 0);
    assert(
      cogsAfterReturnDiff === 6000,
      'COGS correctly decreased by returned cost (6000 paise)'
    );

    assert(
      afterReturnSummary.grossProfitPaise === afterSummary.grossProfitPaise - 4000,
      'Gross profit correctly adjusted down by return margin (4000 paise)'
    );

    // --- 6. VOIDED SALES EXCLUSION TEST ---
    console.log('\n--- 5. Voided Sales Exclusion Testing ---');

    // Create another sale to VOID
    const voidSaleRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: testProdId, quantity: 2 }],
        discountPaise: 0,
        payments: [{ method: 'CASH', amountPaise: 20000, cashTenderedPaise: 20000 }],
      }),
    });
    const voidSaleData = await voidSaleRes.json();
    const voidSaleId = voidSaleData.sale._id;

    // Void the sale
    const voidActionRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${voidSaleId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ voidReason: 'Accidental duplicate bill entered' }),
    });
    assert(voidActionRes.status === 200, 'Admin successfully voided test bill');

    const afterVoidRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterVoidData = await afterVoidRes.json();
    const afterVoidSummary = afterVoidData.summary;

    assert(
      afterVoidSummary.netSalesRevenuePaise === afterReturnSummary.netSalesRevenuePaise,
      'Voided sale excluded from net sales revenue'
    );

    assert(
      afterVoidSummary.grossProfitPaise === afterReturnSummary.grossProfitPaise,
      'Voided sale excluded from gross profit calculation'
    );

    const voidBills = afterVoidSummary.sales?.voidedBillsCount || 0;
    assert(
      voidBills >= 1,
      `Voided bills tracked separately in audit count (found: ${voidBills})`
    );

    // --- 7. TIMELINE & PRODUCT PERFORMANCE ANALYTICS ---
    console.log('\n--- 6. Timeline and Product Performance Analytics ---');

    const timelineRes = await fetch(`${BASE_URL}/api/v1/reports/sales-timeline?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const timelineData = await timelineRes.json();
    assert(
      timelineRes.status === 200 && Array.isArray(timelineData.timeline) && timelineData.timeline.length > 0,
      'Sales timeline returns daily breakdown points with revenue, cogs and profit'
    );

    const prodPerfRes = await fetch(`${BASE_URL}/api/v1/reports/products?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const prodPerfData = await prodPerfRes.json();
    assert(
      prodPerfRes.status === 200 &&
      Array.isArray(prodPerfData.bestSelling) &&
      Array.isArray(prodPerfData.categories),
      'Product performance returns best-selling ranking and category revenue aggregation'
    );

    const testProdInRanking = prodPerfData.bestSelling.find((p) => p._id?.toString() === testProdId.toString());
    assert(
      Boolean(testProdInRanking),
      'Test product appears accurately in best-selling list'
    );

    // --- 8. INVENTORY ANALYTICS & VALUATION ---
    console.log('\n--- 7. Inventory Analytics & Valuation ---');

    const invAnalyticsRes = await fetch(`${BASE_URL}/api/v1/reports/inventory`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const invAnalyticsData = await invAnalyticsRes.json();
    assert(
      invAnalyticsRes.status === 200 &&
      typeof invAnalyticsData.totalValuationPaise === 'number' &&
      Array.isArray(invAnalyticsData.categoryValuation) &&
      Array.isArray(invAnalyticsData.lowStockProducts),
      'Inventory analytics returns total valuation, category valuation, and low-stock alerts'
    );

    // --- 9. CSV REPORT EXPORT ENDPOINTS ---
    console.log('\n--- 8. CSV Report Exports (RFC-4180 Format) ---');

    const exportTypes = ['sales', 'products', 'inventory', 'customers', 'suppliers'];
    for (const expType of exportTypes) {
      const expRes = await fetch(`${BASE_URL}/api/v1/reports/export/${expType}?range=today`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const text = await expRes.text();
      const contentType = expRes.headers.get('content-type') || '';
      assert(
        expRes.status === 200 && contentType.includes('text/csv') && text.length > 10,
        `CSV export for '${expType}' returns valid text/csv content with formatted headers`
      );
    }

    // Invalid export type
    const invalidExpRes = await fetch(`${BASE_URL}/api/v1/reports/export/unknown_type`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      invalidExpRes.status === 400,
      'Invalid export type returns 400 Bad Request with informative message'
    );

    // --- 10. EDGE CASE: FUTURE DATE RANGE ---
    console.log('\n--- 9. Edge Cases & Robustness ---');

    const futureRes = await fetch(
      `${BASE_URL}/api/v1/reports/dashboard?range=custom&startDate=2099-01-01&endDate=2099-01-02`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const futureData = await futureRes.json();
    assert(
      futureRes.status === 200 &&
      futureData.summary?.netSalesRevenuePaise === 0 &&
      futureData.summary?.totalBills === 0,
      'Future date range with zero sales returns 0s without crashing or NaN'
    );

  } catch (err) {
    console.error('Unhandled exception during Phase 6 testing:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`📊 PHASE 6 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
