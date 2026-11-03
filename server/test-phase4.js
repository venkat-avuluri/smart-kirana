// Automated Test Suite for Smart Kirana Phase 4: POS Billing & Invoicing System

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SMART KIRANA - PHASE 4 VERIFICATION TEST SUITE');
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

    // Fetch category
    const catRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const catData = await catRes.json();
    const categoryId = catData.categories[0]._id;

    // Create test products for POS tests
    const timestamp = Date.now().toString().slice(-6);
    const looseBarcode = `RICE${timestamp}`;
    const looseProdRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Sona Masoori Rice ${timestamp}`,
        category: categoryId,
        unit: 'kg',
        purchasePricePaise: 4500, // ₹45.00
        sellingPricePaise: 6000,  // ₹60.00
        mrpPaise: 7000,           // ₹70.00
        barcodes: [looseBarcode],
        minStockThreshold: 10,
      }),
    });
    const looseProdData = await looseProdRes.json();
    const looseProduct = looseProdData.product;
    assert(looseProduct && looseProduct.sellingPricePaise === 6000, 'Created loose test product (Rice - kg)');

    const discreteBarcode = `SOAP${timestamp}`;
    const discreteProdRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Bathing Soap 100g ${timestamp}`,
        category: categoryId,
        unit: 'piece',
        purchasePricePaise: 2500, // ₹25.00
        sellingPricePaise: 3500,  // ₹35.00
        mrpPaise: 4000,           // ₹40.00
        barcodes: [discreteBarcode],
        minStockThreshold: 5,
      }),
    });
    const discreteProdData = await discreteProdRes.json();
    const discreteProduct = discreteProdData.product;
    assert(discreteProduct && discreteProduct.sellingPricePaise === 3500, 'Created discrete test product (Soap - piece)');

    // Add initial stock via stock-in
    await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        productId: looseProduct._id,
        quantity: 50.0,
        reason: 'Initial test stock',
      }),
    });

    await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        productId: discreteProduct._id,
        quantity: 30,
        reason: 'Initial test stock',
      }),
    });

    // 2. Barcode and search verification
    const searchRes = await fetch(`${BASE_URL}/api/v1/products?search=${looseBarcode}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const searchData = await searchRes.json();
    assert(
      searchData.products.length === 1 && searchData.products[0]._id === looseProduct._id,
      'Product found accurately by barcode scan query'
    );

    // 3. Server-side price recalculation & Cash Payment with Change calculation
    // Loose item: 2.500 kg @ ₹60/kg = 15000 paise (₹150.00)
    // Discrete item: 2 pcs @ ₹35/pc = 7000 paise (₹70.00)
    // Client attempts to tamper price to ₹10/kg (1000 paise), server must ignore and use ₹60/kg
    // Total subtotal: 22000 paise (₹220.00). Discount: 2000 paise (₹20.00). Final: 20000 paise (₹200.00)
    // Cash tendered: ₹500.00 (50000 paise). Change: ₹300.00 (30000 paise).
    const checkout1Res = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [
          {
            productId: looseProduct._id,
            quantity: 2.5,
            unitPricePaise: 1000, // Tampered client price!
            totalPaise: 2500,     // Tampered client total!
          },
          {
            productId: discreteProduct._id,
            quantity: 2,
            unitPricePaise: 500,  // Tampered client price!
          },
        ],
        discountPaise: 2000,
        payments: [
          {
            method: 'CASH',
            amountPaise: 20000,
            cashTenderedPaise: 50000,
          },
        ],
        customerName: 'Ramesh Kumar',
        customerPhone: '9876543210',
      }),
    });
    const checkout1Data = await checkout1Res.json();
    assert(
      checkout1Res.status === 201 && checkout1Data.success,
      'Checkout completed successfully with cash payment'
    );
    assert(
      checkout1Data.sale.subtotalPaise === 22000,
      'Server enforced database price integrity (recalculated subtotal = ₹220.00, client tampering ignored)',
      `Got subtotal ${checkout1Data.sale?.subtotalPaise}`
    );
    assert(
      checkout1Data.sale.finalAmountPaise === 20000,
      'Final amount calculated accurately after discount (₹200.00)'
    );
    assert(
      checkout1Data.sale.payments[0].changeReturnedPaise === 30000,
      'Cash change returned computed accurately (₹300.00 for ₹500 tendered on ₹200 bill)'
    );
    assert(
      /^SK-\d{6}-\d{4}$/.test(checkout1Data.sale.invoiceNumber),
      `Sequential invoice number follows format SK-YYYYMM-XXXX (${checkout1Data.sale.invoiceNumber})`
    );

    const firstInvoice = checkout1Data.sale.invoiceNumber;
    const firstSaleId = checkout1Data.sale._id;

    // 4. Verify discrete unit validation (cannot buy 1.5 pieces of soap)
    const invalidDiscreteRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: discreteProduct._id, quantity: 1.5 }],
        payments: [{ method: 'CASH', amountPaise: 5250, cashTenderedPaise: 5250 }],
      }),
    });
    assert(
      invalidDiscreteRes.status >= 400,
      'Discrete unit rejection: fractional quantity (1.5 piece) rejected'
    );

    // 5. Verify payment amount mismatch rejection (payments sum != final amount)
    const paymentMismatchRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: discreteProduct._id, quantity: 1 }], // ₹35.00
        payments: [{ method: 'CASH', amountPaise: 2000, cashTenderedPaise: 2000 }], // Only ₹20.00
      }),
    });
    assert(
      paymentMismatchRes.status >= 400,
      'Payment mismatch rejection: total payments (₹20) less than bill total (₹35) rejected'
    );

    // 6. Verify insufficient cash tendered rejection
    const insufficientCashRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: discreteProduct._id, quantity: 1 }],
        payments: [{ method: 'CASH', amountPaise: 3500, cashTenderedPaise: 3000 }], // Tendered ₹30 on ₹35 bill
      }),
    });
    assert(
      insufficientCashRes.status >= 400,
      'Insufficient cash rejection: Cash tendered less than cash amount rejected'
    );

    // 7. Verify UPI payment with reference ID
    const upiRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: looseProduct._id, quantity: 1.0 }], // ₹60.00 (6000 paise)
        payments: [
          {
            method: 'UPI',
            amountPaise: 6000,
            reference: 'UPI/123456789012',
          },
        ],
      }),
    });
    const upiData = await upiRes.json();
    assert(
      upiRes.status === 201 && upiData.sale.payments[0].method === 'UPI' && upiData.sale.payments[0].reference === 'UPI/123456789012',
      'UPI payment processed with reference code'
    );

    // 8. Verify Split Payment (Cash + UPI)
    // 2 pcs Soap = ₹70.00 (7000 paise). Paid: ₹30 Cash + ₹40 UPI
    const splitRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: discreteProduct._id, quantity: 2 }],
        payments: [
          { method: 'CASH', amountPaise: 3000, cashTenderedPaise: 5000 }, // ₹30 paid, ₹50 tendered (₹20 change)
          { method: 'UPI', amountPaise: 4000, reference: 'UPI/SPLIT987' },
        ],
      }),
    });
    const splitData = await splitRes.json();
    assert(
      splitRes.status === 201 &&
        splitData.sale.payments.length === 2 &&
        splitData.sale.payments[0].changeReturnedPaise === 2000,
      'Split payment (Cash + UPI) processed with partial cash change returned'
    );

    // 9. Verify Udhaar Credit Sale
    const udhaarRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: discreteProduct._id, quantity: 1 }],
        payments: [{ method: 'CREDIT_UDHAAR', amountPaise: 3500 }],
        customerName: 'Suresh Babu',
        customerPhone: '9988776655',
      }),
    });
    const udhaarData = await udhaarRes.json();
    assert(
      udhaarRes.status === 201 && udhaarData.sale.paymentStatus === 'UDHAAR_CREDIT',
      'Udhaar credit sale flagged as UDHAAR_CREDIT paymentStatus'
    );

    // 10. Verify Atomic Inventory Reduction and SALE Ledger Movement
    const looseProdCheck = await fetch(`${BASE_URL}/api/v1/products/${looseProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const looseProdCheckData = await looseProdCheck.json();
    // Started with 50.0 kg. Sale 1 used 2.5 kg. Sale UPI used 1.0 kg. Stock should now be 46.5 kg.
    assert(
      looseProdCheckData.product.currentStock === 46.5,
      `Inventory reduced accurately after sales (expected 46.5 kg, got ${looseProdCheckData.product.currentStock} kg)`
    );

    const ledgerRes = await fetch(`${BASE_URL}/api/v1/inventory/ledger?productId=${looseProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const ledgerData = await ledgerRes.json();
    const saleTransactions = ledgerData.transactions.filter((t) => t.type === 'SALE');
    assert(
      saleTransactions.length >= 2 && saleTransactions[0].referenceId === upiData.sale.invoiceNumber,
      'Inventory ledger records immutable SALE transactions referencing invoice numbers'
    );

    // 11. Verify Negative Stock Warning Dialog
    // Current stock of looseProduct is 46.5 kg. Attempt to bill 50.0 kg without override
    const negWarnRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: looseProduct._id, quantity: 50.0 }],
        payments: [{ method: 'CASH', amountPaise: 300000, cashTenderedPaise: 300000 }],
      }),
    });
    const negWarnData = await negWarnRes.json();
    assert(
      negWarnRes.status === 400 && negWarnData.isNegativeWarning && negWarnData.warnings.length > 0,
      'Negative stock check intercepts overselling with warning payload and requires override'
    );

    // 12. Verify Negative Stock Override checkout
    const negOverrideRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: looseProduct._id, quantity: 50.0 }],
        payments: [{ method: 'CASH', amountPaise: 300000, cashTenderedPaise: 300000 }],
        allowNegativeOverride: true,
        overrideReason: 'Shop owner authorized negative billing for wedding bulk order',
      }),
    });
    const negOverrideData = await negOverrideRes.json();
    assert(
      negOverrideRes.status === 201 && negOverrideData.success,
      'Negative stock allowed with explicit authorization override'
    );

    // 13. Verify Idempotency Duplicate Prevention
    const testIdempotencyKey = `POS-IDEMPOTENT-${Date.now()}`;
    const idempReqBody = {
      idempotencyKey: testIdempotencyKey,
      items: [{ productId: discreteProduct._id, quantity: 1 }],
      payments: [{ method: 'CASH', amountPaise: 3500, cashTenderedPaise: 3500 }],
    };
    const idemp1Res = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify(idempReqBody),
    });
    const idemp1Data = await idemp1Res.json();

    const idemp2Res = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify(idempReqBody),
    });
    const idemp2Data = await idemp2Res.json();

    assert(
      idemp1Data.sale._id === idemp2Data.sale._id && idemp2Data.isIdempotentReplay === true,
      'Idempotency key prevents duplicate billing on network retry'
    );

    // 14. Verify Sequential Invoice Increment
    // Check that invoice numbers follow monotonic sequence
    const [invPrefix1, invMonth1, invNum1] = idemp1Data.sale.invoiceNumber.split('-');
    const nextCheckoutRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        items: [{ productId: discreteProduct._id, quantity: 1 }],
        payments: [{ method: 'CASH', amountPaise: 3500, cashTenderedPaise: 3500 }],
      }),
    });
    const nextCheckoutData = await nextCheckoutRes.json();
    const [invPrefix2, invMonth2, invNum2] = nextCheckoutData.sale.invoiceNumber.split('-');
    assert(
      parseInt(invNum2, 10) === parseInt(invNum1, 10) + 1,
      `Sequential invoice increment guaranteed without collisions (${idemp1Data.sale.invoiceNumber} -> ${nextCheckoutData.sale.invoiceNumber})`
    );

    // 15. Sales History Query with filters
    const historyRes = await fetch(`${BASE_URL}/api/v1/pos/sales?paymentMethod=CASH`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const historyData = await historyRes.json();
    assert(
      historyRes.status === 200 && historyData.sales.length > 0 && historyData.sales.every((s) => s.payments.some((p) => p.method === 'CASH')),
      'Sales history retrieved with paymentMethod filter and pagination'
    );

    // 16. Fetch sale by ID and Invoice number
    const getByIdRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${firstSaleId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const getByIdData = await getByIdRes.json();
    assert(
      getByIdRes.status === 200 && getByIdData.sale.invoiceNumber === firstInvoice,
      'Retrieve sale by database ID'
    );

    const getByInvRes = await fetch(`${BASE_URL}/api/v1/pos/sales/invoice/${firstInvoice}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const getByInvData = await getByInvRes.json();
    assert(
      getByInvRes.status === 200 && getByInvData.sale._id === firstSaleId,
      'Retrieve sale by invoice number for reprint/receipt search'
    );

    // 17. Staff cannot void sale (RBAC check - 403 Forbidden)
    const staffVoidRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${firstSaleId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ voidReason: 'Customer changed mind' }),
    });
    assert(
      staffVoidRes.status === 403,
      'RBAC enforcement: Staff cannot void sale bills (403 Forbidden)'
    );

    // 18. Admin voiding sale requires reason
    const adminVoidNoReasonRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${firstSaleId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ voidReason: '' }),
    });
    assert(
      adminVoidNoReasonRes.status >= 400,
      'Mandatory void reason enforcement: Admin cannot void without reason'
    );

    // Check stock before voiding first sale (first sale was 2.5 kg Rice and 2 pcs Soap)
    const discreteBeforeVoid = await fetch(`${BASE_URL}/api/v1/products/${discreteProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const discreteBeforeVoidData = await discreteBeforeVoid.json();
    const stockBeforeVoid = discreteBeforeVoidData.product.currentStock;

    // 19. Admin voiding sale succeeds & restores stock via STOCK_CORRECTION
    const adminVoidRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${firstSaleId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ voidReason: 'Customer entered wrong items and cancelled bill' }),
    });
    const adminVoidData = await adminVoidRes.json();
    assert(
      adminVoidRes.status === 200 && adminVoidData.sale.status === 'VOIDED',
      'Admin successfully voided sale invoice'
    );

    const discreteAfterVoid = await fetch(`${BASE_URL}/api/v1/products/${discreteProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const discreteAfterVoidData = await discreteAfterVoid.json();
    assert(
      discreteAfterVoidData.product.currentStock === stockBeforeVoid + 2,
      'Voiding sale restored 2 pieces of soap stock via ledger'
    );

    // 20. Already voided sale cannot be voided again
    const reVoidRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${firstSaleId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ voidReason: 'Void again' }),
    });
    assert(
      reVoidRes.status >= 400,
      'Void idempotency: Cannot re-void an already voided invoice'
    );

    // 21. Voided sale cannot be returned
    const returnVoidedRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${firstSaleId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        returnedItems: [{ productId: discreteProduct._id, quantity: 1 }],
        reason: 'Customer return',
      }),
    });
    assert(
      returnVoidedRes.status >= 400,
      'Cannot process returns on a voided invoice'
    );

    // 22. Sales return validation: cannot return more than sold quantity
    const targetSale = nextCheckoutData.sale; // Contains 1 piece of soap
    const overReturnRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${targetSale._id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        returnedItems: [{ productId: discreteProduct._id, quantity: 5 }], // Sold 1, attempting 5
        reason: 'Faulty item',
      }),
    });
    assert(
      overReturnRes.status >= 400,
      'Return quantity validation: cannot return more than sold quantity'
    );

    // 23. Valid partial sales return restores stock & creates SALE_RETURN ledger entry
    const validReturnRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${targetSale._id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        returnedItems: [{ productId: discreteProduct._id, quantity: 1 }],
        refundMethod: 'CASH',
        reason: 'Customer changed mind immediately',
      }),
    });
    const validReturnData = await validReturnRes.json();
    assert(
      validReturnRes.status === 201 && validReturnData.success,
      'Sales return processed successfully with refund'
    );
    assert(
      validReturnData.saleReturn.totalRefundPaise === 3500,
      'Return refund amount computed accurately in paise (₹35.00)'
    );
    assert(
      /^RET-\d{6}-\d{4}$/.test(validReturnData.saleReturn.returnNumber),
      `Return voucher generated with sequential number (${validReturnData.saleReturn.returnNumber})`
    );

    // 24. Return history query
    const returnsHistoryRes = await fetch(`${BASE_URL}/api/v1/pos/returns`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const returnsHistoryData = await returnsHistoryRes.json();
    assert(
      returnsHistoryRes.status === 200 && returnsHistoryData.returns.length > 0,
      'Sales returns history retrieved successfully'
    );

    console.log('\n====================================================');
    console.log(`📊 PHASE 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Unhandled exception during Phase 4 tests:', err);
    process.exit(1);
  }
}

runTests();
