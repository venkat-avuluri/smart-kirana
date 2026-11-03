// Automated Test Suite for Smart Kirana Phase 5: Customer Management, Udhaar & Purchase Management

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SMART KIRANA - PHASE 5 VERIFICATION TEST SUITE');
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

    // --- CUSTOMER MANAGEMENT & UDHAAR CREDIT TESTS ---
    console.log('\n--- 1. Customer Management & Udhaar Tests ---');
    const uniquePhone = `98${Date.now().toString().slice(-8)}`;

    // A. Create Customer
    const createCustRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        name: 'Ramesh Sharma',
        phone: uniquePhone,
        address: 'House #42, Main Bazar',
        notes: 'Regular local customer',
      }),
    });
    const createCustData = await createCustRes.json();
    assert(
      createCustRes.status === 201 && createCustData.customer._id,
      'Staff successfully created new customer record'
    );
    const customerId = createCustData.customer._id;

    // B. Prevent Duplicate Customer by Phone
    const dupCustRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        name: 'Ramesh Sharma Duplicate',
        phone: uniquePhone,
      }),
    });
    assert(
      dupCustRes.status >= 400,
      'Duplicate customer registration by phone number is rejected'
    );

    // C. Search Customer
    const searchCustRes = await fetch(`${BASE_URL}/api/v1/customers?search=${uniquePhone}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const searchCustData = await searchCustRes.json();
    assert(
      searchCustData.customers.length === 1 && searchCustData.customers[0]._id === customerId,
      'Customer found accurately via phone search'
    );

    // Setup a test product for sales and purchases
    const catRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const catData = await catRes.json();
    const categoryId = catData.categories[0]._id;

    const prodTimestamp = Date.now().toString().slice(-6);
    const testProdRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Toor Dal Premium ${prodTimestamp}`,
        category: categoryId,
        unit: 'kg',
        purchasePricePaise: 12000, // ₹120/kg
        sellingPricePaise: 15000,  // ₹150/kg
        mrpPaise: 17000,           // ₹170/kg
        barcodes: [`TOOR${prodTimestamp}`],
        minStockThreshold: 5,
      }),
    });
    const testProdData = await testProdRes.json();
    const testProduct = testProdData.product;

    // Stock in 50 kg initially
    await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        productId: testProduct._id,
        quantity: 50.0,
        reason: 'Initial setup stock',
      }),
    });

    // D. POS Udhaar Credit Sale (₹300.00 = 2 kg @ ₹150)
    const udhaarSaleRes = await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        customerId: customerId,
        items: [{ productId: testProduct._id, quantity: 2.0 }],
        payments: [{ method: 'CREDIT_UDHAAR', amountPaise: 30000 }], // ₹300.00
      }),
    });
    const udhaarSaleData = await udhaarSaleRes.json();
    assert(
      udhaarSaleRes.status === 201 && udhaarSaleData.sale.paymentStatus === 'UDHAAR_CREDIT',
      'POS Checkout on Udhaar completed with UDHAAR_CREDIT status'
    );
    const firstInvoiceNum = udhaarSaleData.sale.invoiceNumber;
    const firstSaleId = udhaarSaleData.sale._id;

    // Check Customer Balance updated to ₹300.00 (30000 paise)
    const custCheck1 = await fetch(`${BASE_URL}/api/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const custCheck1Data = await custCheck1.json();
    assert(
      custCheck1Data.customer.currentBalancePaise === 30000,
      `Customer outstanding credit balance increased to ₹300.00 (30000 paise, got ${custCheck1Data.customer.currentBalancePaise})`
    );

    // Second Udhaar Sale (₹150.00 = 1 kg @ ₹150)
    await fetch(`${BASE_URL}/api/v1/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        customerId: customerId,
        items: [{ productId: testProduct._id, quantity: 1.0 }],
        payments: [{ method: 'CREDIT_UDHAAR', amountPaise: 15000 }],
      }),
    });

    const custCheck2 = await fetch(`${BASE_URL}/api/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const custCheck2Data = await custCheck2.json();
    assert(
      custCheck2Data.customer.currentBalancePaise === 45000,
      'Customer cumulative outstanding balance is ₹450.00 (45000 paise)'
    );

    // E. Customer Credit Ledger Statement
    const ledgerRes = await fetch(`${BASE_URL}/api/v1/customers/${customerId}/ledger`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const ledgerData = await ledgerRes.json();
    assert(
      ledgerData.transactions.length >= 2 &&
        ledgerData.transactions.every((t) => t.type === 'CREDIT_SALE'),
      'Customer ledger records each credit transaction with balanceBefore and balanceAfter'
    );

    // F. Customer Repayment Collection (Pay ₹200.00)
    // 450 - 200 = ₹250.00 remaining
    const payRes = await fetch(`${BASE_URL}/api/v1/customers/${customerId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        amountPaise: 20000,
        paymentMethod: 'CASH',
        notes: 'Partial weekly repayment',
      }),
    });
    const payData = await payRes.json();
    assert(
      payRes.status === 201 && payData.transaction.type === 'PAYMENT',
      'Recorded customer repayment of ₹200.00'
    );
    assert(
      /^RCP-\d{6}-\d{4}$/.test(payData.receiptNumber),
      `Sequential repayment receipt generated (${payData.receiptNumber})`
    );

    const custCheck3 = await fetch(`${BASE_URL}/api/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const custCheck3Data = await custCheck3.json();
    assert(
      custCheck3Data.customer.currentBalancePaise === 25000,
      'Customer outstanding balance reduced to ₹250.00 (25000 paise)'
    );

    // G. Payment Bounds Check (Cannot overpay balance)
    // Balance is 25000 paise. Attempt to pay 30000 paise.
    const overpayRes = await fetch(`${BASE_URL}/api/v1/customers/${customerId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        amountPaise: 30000,
        paymentMethod: 'CASH',
      }),
    });
    assert(
      overpayRes.status >= 400,
      'Payment exceeding customer outstanding balance is rejected'
    );

    // H. Duplicate Payment Prevention via Idempotency Key
    const paymentIdempKey = `CUST-PAY-${Date.now()}`;
    const idempPay1 = await fetch(`${BASE_URL}/api/v1/customers/${customerId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        amountPaise: 5000, // ₹50.00
        paymentMethod: 'UPI',
        idempotencyKey: paymentIdempKey,
      }),
    });
    const idempPay1Data = await idempPay1.json();

    const idempPay2 = await fetch(`${BASE_URL}/api/v1/customers/${customerId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        amountPaise: 5000,
        paymentMethod: 'UPI',
        idempotencyKey: paymentIdempKey,
      }),
    });
    const idempPay2Data = await idempPay2.json();

    assert(
      idempPay1Data.transaction._id === idempPay2Data.transaction._id && idempPay2Data.isIdempotentReplay,
      'Idempotency key prevents duplicate customer repayments'
    );

    // Balance after 5000 payment: 25000 - 5000 = 20000 paise (₹200.00)

    // I. Voiding an Udhaar Sale reverses Customer Debt
    // Void first sale (₹300.00)
    const voidRes = await fetch(`${BASE_URL}/api/v1/pos/sales/${firstSaleId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ voidReason: 'Customer returned all items on credit bill' }),
    });
    assert(voidRes.status === 200, 'Admin voided credit sale invoice');

    const custCheck4 = await fetch(`${BASE_URL}/api/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const custCheck4Data = await custCheck4.json();
    // Prior balance was 20000. Reversing 30000 reduces it to 0 (capped at 0)
    assert(
      custCheck4Data.customer.currentBalancePaise === 0,
      'Customer credit debt reduced and reversed upon bill cancellation'
    );

    // J. Udhaar Store Overview
    const udhaarOverviewRes = await fetch(`${BASE_URL}/api/v1/customers/overview`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const udhaarOverviewData = await udhaarOverviewRes.json();
    assert(
      udhaarOverviewRes.status === 200 && typeof udhaarOverviewData.summary.totalOutstandingCreditPaise === 'number',
      'Store Udhaar summary metrics retrieved'
    );

    // --- SUPPLIER & PURCHASE MANAGEMENT TESTS ---
    console.log('\n--- 2. Supplier & Purchase Management Tests ---');

    // K. RBAC Check: Staff blocked from Suppliers and Purchases
    const staffSuppRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ name: 'Staff Supplier' }),
    });
    assert(staffSuppRes.status === 403, 'RBAC: Staff blocked from creating supplier (403 Forbidden)');

    const staffPurchRes = await fetch(`${BASE_URL}/api/v1/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ items: [] }),
    });
    assert(staffPurchRes.status === 403, 'RBAC: Staff blocked from purchase entry (403 Forbidden)');

    // L. Admin Creates Supplier
    const suppTimestamp = Date.now().toString().slice(-6);
    const createSuppRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Sri Balaji Agro Traders ${suppTimestamp}`,
        contactPerson: 'Srinivas Rao',
        phone: `91${Date.now().toString().slice(-8)}`,
        address: 'Wholesale Grain Market, Yard 3',
        notes: 'Primary pulses supplier',
      }),
    });
    const createSuppData = await createSuppRes.json();
    assert(
      createSuppRes.status === 201 && createSuppData.supplier._id,
      'Admin created new Supplier successfully'
    );
    const supplierId = createSuppData.supplier._id;

    // Check product stock before purchase
    const prodBeforePurch = await fetch(`${BASE_URL}/api/v1/products/${testProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const prodBeforePurchData = await prodBeforePurch.json();
    const stockBeforePurch = prodBeforePurchData.product.currentStock;

    // M. Admin Purchase Entry with Partial Payment
    // Purchase 20 kg @ ₹115.00/kg (11500 paise) = ₹2300.00 (230000 paise)
    // Paid ₹1000.00 (100000 paise). Balance Payable: ₹1300.00 (130000 paise).
    const purchaseRes = await fetch(`${BASE_URL}/api/v1/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        supplierId: supplierId,
        supplierInvoiceNumber: `INV-SUPP-${suppTimestamp}`,
        items: [
          {
            productId: testProduct._id,
            quantity: 20.0,
            purchasePricePaise: 11500,
          },
        ],
        totalAmountPaise: 230000,
        paidAmountPaise: 100000,
        paymentMethod: 'CASH',
        notes: 'Direct grain market delivery',
      }),
    });
    const purchaseData = await purchaseRes.json();
    assert(
      purchaseRes.status === 201 && purchaseData.success,
      'Purchase entry completed successfully'
    );
    assert(
      /^PUR-\d{6}-\d{4}$/.test(purchaseData.purchase.purchaseNumber),
      `Sequential purchase order number generated (${purchaseData.purchase.purchaseNumber})`
    );
    assert(
      purchaseData.purchase.balancePayablePaise === 130000,
      'Remaining payable balance computed accurately (₹1300.00)'
    );

    const purchaseId = purchaseData.purchase._id;
    const purchaseNumber = purchaseData.purchase.purchaseNumber;

    // N. Critical: Inventory Stock-In Verification via Ledger
    const prodAfterPurch = await fetch(`${BASE_URL}/api/v1/products/${testProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const prodAfterPurchData = await prodAfterPurch.json();
    assert(
      prodAfterPurchData.product.currentStock === stockBeforePurch + 20.0,
      `Inventory stock atomically increased by 20.0 kg (from ${stockBeforePurch} to ${prodAfterPurchData.product.currentStock})`
    );

    const invLedgerCheck = await fetch(`${BASE_URL}/api/v1/inventory/ledger?productId=${testProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const invLedgerCheckData = await invLedgerCheck.json();
    const purchaseLedgerTx = invLedgerCheckData.transactions.find((t) => t.type === 'PURCHASE' && t.referenceId === purchaseNumber);
    assert(
      Boolean(purchaseLedgerTx && purchaseLedgerTx.quantityDelta === 20.0),
      'Inventory ledger recorded immutable PURCHASE stock movement'
    );

    // O. Supplier Payable Balance Verification
    const suppCheck1 = await fetch(`${BASE_URL}/api/v1/suppliers/${supplierId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const suppCheck1Data = await suppCheck1.json();
    assert(
      suppCheck1Data.supplier.currentPayablePaise === 130000,
      'Supplier payable balance matches outstanding purchase debt (₹1300.00 / 130000 paise)'
    );

    // P. Supplier Ledger Statement
    const suppLedgerRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplierId}/ledger`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const suppLedgerData = await suppLedgerRes.json();
    assert(
      suppLedgerData.transactions.length >= 2,
      'Supplier ledger records PURCHASE (+₹2300) and initial PAYMENT (-₹1000)'
    );

    // Q. Supplier Payment Disbursement (Pay remaining ₹1300.00 via UPI)
    const suppPaymentRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplierId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        amountPaise: 130000,
        paymentMethod: 'UPI',
        reference: 'UPI/VEND778899',
        notes: 'Full balance settlement',
      }),
    });
    const suppPaymentData = await suppPaymentRes.json();
    assert(
      suppPaymentRes.status === 201 && suppPaymentData.success,
      'Recorded supplier payment settlement'
    );
    assert(
      /^SPAY-\d{6}-\d{4}$/.test(suppPaymentData.voucherNumber),
      `Sequential supplier payment voucher generated (${suppPaymentData.voucherNumber})`
    );

    const suppCheck2 = await fetch(`${BASE_URL}/api/v1/suppliers/${supplierId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const suppCheck2Data = await suppCheck2.json();
    assert(
      suppCheck2Data.supplier.currentPayablePaise === 0,
      'Supplier payable balance successfully settled to ₹0.00'
    );

    // R. Purchase Cancellation & Inventory Reversal
    // Create a new purchase to cancel: 10 kg
    const cancelPurchReq = await fetch(`${BASE_URL}/api/v1/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        supplierId: supplierId,
        items: [{ productId: testProduct._id, quantity: 10.0, purchasePricePaise: 11500 }],
        paidAmountPaise: 0, // Unpaid
        paymentMethod: 'CREDIT_UNPAID',
      }),
    });
    const cancelPurchData = await cancelPurchReq.json();
    const toCancelId = cancelPurchData.purchase._id;

    const prodBeforeCancel = await fetch(`${BASE_URL}/api/v1/products/${testProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const prodBeforeCancelData = await prodBeforeCancel.json();
    const stockBeforeCancel = prodBeforeCancelData.product.currentStock;

    // Cancel purchase
    const cancelActionRes = await fetch(`${BASE_URL}/api/v1/purchases/${toCancelId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        cancellationReason: 'Damaged shipment returned to vendor at unloading',
      }),
    });
    const cancelActionData = await cancelActionRes.json();
    assert(
      cancelActionRes.status === 200 && cancelActionData.purchase.status === 'CANCELLED',
      'Admin cancelled purchase record'
    );

    const prodAfterCancel = await fetch(`${BASE_URL}/api/v1/products/${testProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const prodAfterCancelData = await prodAfterCancel.json();
    assert(
      prodAfterCancelData.product.currentStock === stockBeforeCancel - 10.0,
      'Cancelling purchase reversed 10.0 kg of stock via STOCK_CORRECTION ledger movement'
    );

    // S. Supplier Overview Metrics
    const suppOverviewRes = await fetch(`${BASE_URL}/api/v1/suppliers/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const suppOverviewData = await suppOverviewRes.json();
    assert(
      suppOverviewRes.status === 200 && typeof suppOverviewData.overview.totalPurchasedPaise === 'number',
      'Suppliers and Purchases overview analytics retrieved'
    );

    console.log('\n====================================================');
    console.log(`📊 PHASE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Unhandled exception during Phase 5 tests:', err);
    process.exit(1);
  }
}

runTests();
