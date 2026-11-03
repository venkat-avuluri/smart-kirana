import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import Customer from '../models/Customer.js';
import CustomerTransaction from '../models/CustomerTransaction.js';
import Supplier from '../models/Supplier.js';
import SupplierTransaction from '../models/SupplierTransaction.js';
import Sale from '../models/Sale.js';

dotenv.config();

/**
 * Audit & Reconcile Ledgers Utility
 * Verifies mathematical consistency across:
 * 1. Product Current Stock vs Sum of Immutable Inventory Ledger Movements
 * 2. Customer Current Udhaar Balance vs Sum of Immutable Customer Credit Movements
 * 3. Supplier Current Outstanding Payable vs Sum of Supplier Movements
 * 4. Sales Invoices Arithmetic Integrity (Subtotal - Discount = Final = Sum of Payments)
 *
 * NOTE: As per architectural requirements, discrepancies are NEVER silently repaired.
 * A comprehensive audit report is generated to require explicit store owner authorization.
 */
export const runLedgerReconciliation = async () => {
  const auditReport = {
    auditTimestamp: new Date().toISOString(),
    status: 'HEALTHY',
    summary: {
      totalChecks: 0,
      totalDiscrepancies: 0,
    },
    inventory: {
      verifiedProductsCount: 0,
      discrepanciesCount: 0,
      discrepancies: [],
    },
    customers: {
      verifiedCustomersCount: 0,
      discrepanciesCount: 0,
      discrepancies: [],
    },
    suppliers: {
      verifiedSuppliersCount: 0,
      discrepanciesCount: 0,
      discrepancies: [],
    },
    sales: {
      verifiedSalesCount: 0,
      discrepanciesCount: 0,
      discrepancies: [],
    },
  };

  // 1. RECONCILE INVENTORY LEDGER
  const products = await Product.find({});
  auditReport.inventory.verifiedProductsCount = products.length;

  const inventoryLedgerAgg = await InventoryTransaction.aggregate([
    {
      $group: {
        _id: '$product',
        sumDelta: { $sum: '$quantityDelta' },
        txCount: { $sum: 1 },
      },
    },
  ]);

  const inventoryMap = new Map();
  inventoryLedgerAgg.forEach((agg) => {
    inventoryMap.set(agg._id.toString(), {
      sumDelta: Math.round(agg.sumDelta * 1000) / 1000,
      txCount: agg.txCount,
    });
  });

  for (const prod of products) {
    const pId = prod._id.toString();
    const ledgerData = inventoryMap.get(pId) || { sumDelta: 0, txCount: 0 };
    const cachedStock = Math.round(prod.currentStock * 1000) / 1000;
    const ledgerStock = ledgerData.sumDelta;
    const diff = Math.round(Math.abs(cachedStock - ledgerStock) * 1000) / 1000;

    if (diff > 0.001) {
      auditReport.inventory.discrepanciesCount++;
      auditReport.inventory.discrepancies.push({
        productId: prod._id,
        productName: prod.name,
        unit: prod.unit,
        cachedStock,
        ledgerComputedStock: ledgerStock,
        difference: Math.round((cachedStock - ledgerStock) * 1000) / 1000,
        transactionCount: ledgerData.txCount,
      });
    }
  }

  // 2. RECONCILE CUSTOMER UDHAAR LEDGER
  const customers = await Customer.find({});
  auditReport.customers.verifiedCustomersCount = customers.length;

  const customerLedgerAgg = await CustomerTransaction.aggregate([
    {
      $group: {
        _id: '$customer',
        sumDeltaPaise: { $sum: '$deltaPaise' },
        txCount: { $sum: 1 },
      },
    },
  ]);

  const customerMap = new Map();
  customerLedgerAgg.forEach((agg) => {
    customerMap.set(agg._id.toString(), {
      sumDeltaPaise: agg.sumDeltaPaise,
      txCount: agg.txCount,
    });
  });

  for (const cust of customers) {
    const cId = cust._id.toString();
    const ledgerData = customerMap.get(cId) || { sumDeltaPaise: 0, txCount: 0 };
    const cachedBalance = cust.currentBalancePaise || 0;
    const ledgerBalance = ledgerData.sumDeltaPaise;

    if (cachedBalance !== ledgerBalance) {
      auditReport.customers.discrepanciesCount++;
      auditReport.customers.discrepancies.push({
        customerId: cust._id,
        customerName: cust.name,
        phone: cust.phone,
        cachedBalancePaise: cachedBalance,
        ledgerComputedBalancePaise: ledgerBalance,
        discrepancyPaise: cachedBalance - ledgerBalance,
        transactionCount: ledgerData.txCount,
      });
    }
  }

  // 3. RECONCILE SUPPLIER PAYABLES LEDGER
  const suppliers = await Supplier.find({});
  auditReport.suppliers.verifiedSuppliersCount = suppliers.length;

  const supplierLedgerAgg = await SupplierTransaction.aggregate([
    {
      $group: {
        _id: '$supplier',
        sumDeltaPaise: { $sum: '$deltaPaise' },
        txCount: { $sum: 1 },
      },
    },
  ]);

  const supplierMap = new Map();
  supplierLedgerAgg.forEach((agg) => {
    supplierMap.set(agg._id.toString(), {
      sumDeltaPaise: agg.sumDeltaPaise,
      txCount: agg.txCount,
    });
  });

  for (const supp of suppliers) {
    const sId = supp._id.toString();
    const ledgerData = supplierMap.get(sId) || { sumDeltaPaise: 0, txCount: 0 };
    const cachedPayable = supp.currentPayablePaise || 0;
    const ledgerPayable = ledgerData.sumDeltaPaise;

    if (cachedPayable !== ledgerPayable) {
      auditReport.suppliers.discrepanciesCount++;
      auditReport.suppliers.discrepancies.push({
        supplierId: supp._id,
        supplierName: supp.name,
        phone: supp.phone,
        cachedPayablePaise: cachedPayable,
        ledgerComputedPayablePaise: ledgerPayable,
        discrepancyPaise: cachedPayable - ledgerPayable,
        transactionCount: ledgerData.txCount,
      });
    }
  }

  // 4. RECONCILE SALES ARITHMETIC INTEGRITY
  const sales = await Sale.find({});
  auditReport.sales.verifiedSalesCount = sales.length;

  for (const sale of sales) {
    let saleError = null;

    // Check line totals sum to subtotal
    const calculatedSubtotal = sale.items.reduce((acc, item) => acc + (item.totalPaise || 0), 0);
    if (calculatedSubtotal !== sale.subtotalPaise) {
      saleError = `Item totals (${calculatedSubtotal}) do not match subtotal (${sale.subtotalPaise})`;
    }

    // Check subtotal - discount = finalAmount
    if (!saleError && (sale.subtotalPaise - sale.discountPaise !== sale.finalAmountPaise)) {
      saleError = `Subtotal (${sale.subtotalPaise}) minus discount (${sale.discountPaise}) does not equal final amount (${sale.finalAmountPaise})`;
    }

    // Check payments sum to finalAmount
    const totalPayments = sale.payments.reduce((acc, p) => acc + (p.amountPaise || 0), 0);
    if (!saleError && totalPayments !== sale.finalAmountPaise) {
      saleError = `Payment sum (${totalPayments}) does not match final amount (${sale.finalAmountPaise})`;
    }

    if (saleError) {
      auditReport.sales.discrepanciesCount++;
      auditReport.sales.discrepancies.push({
        saleId: sale._id,
        invoiceNumber: sale.invoiceNumber,
        error: saleError,
      });
    }
  }

  // Total summary computation
  const totalDiscrepancies =
    auditReport.inventory.discrepanciesCount +
    auditReport.customers.discrepanciesCount +
    auditReport.suppliers.discrepanciesCount +
    auditReport.sales.discrepanciesCount;

  auditReport.summary.totalChecks =
    auditReport.inventory.verifiedProductsCount +
    auditReport.customers.verifiedCustomersCount +
    auditReport.suppliers.verifiedSuppliersCount +
    auditReport.sales.verifiedSalesCount;

  auditReport.summary.totalDiscrepancies = totalDiscrepancies;
  auditReport.status = totalDiscrepancies === 0 ? 'HEALTHY' : 'DISCREPANCY_DETECTED';

  return auditReport;
};

// Standalone CLI execution
if (process.argv[1]?.endsWith('reconcileLedgers.js')) {
  const runStandalone = async () => {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_kirana';
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB. Running full ledger reconciliation audit...\n');

      const report = await runLedgerReconciliation();

      console.log('====================================================');
      console.log(`SMART KIRANA - LEDGER RECONCILIATION AUDIT`);
      console.log(`Status: ${report.status}`);
      console.log(`Timestamp: ${report.auditTimestamp}`);
      console.log('====================================================');
      console.log(`Inventory Items Verified: ${report.inventory.verifiedProductsCount} | Discrepancies: ${report.inventory.discrepanciesCount}`);
      console.log(`Customer Accounts Verified: ${report.customers.verifiedCustomersCount} | Discrepancies: ${report.customers.discrepanciesCount}`);
      console.log(`Suppliers Verified: ${report.suppliers.verifiedSuppliersCount} | Discrepancies: ${report.suppliers.discrepanciesCount}`);
      console.log(`Sales Bills Verified: ${report.sales.verifiedSalesCount} | Discrepancies: ${report.sales.discrepanciesCount}`);
      console.log('====================================================\n');

      if (report.summary.totalDiscrepancies > 0) {
        console.warn('⚠️ Discrepancies detected! Review details above. DO NOT silently repair.');
      } else {
        console.log('✅ 100% Ledger Consistency Verified. All cached balances perfectly match immutable ledgers.');
      }

      await mongoose.disconnect();
      process.exit(report.summary.totalDiscrepancies === 0 ? 0 : 1);
    } catch (err) {
      console.error('Reconciliation failed:', err);
      process.exit(1);
    }
  };

  runStandalone();
}
