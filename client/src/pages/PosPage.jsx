import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  IndianRupee,
  CreditCard,
  QrCode,
  Users,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Clock,
  Printer,
  ChevronRight,
  Info,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatINR, rupeesToPaise, paiseToRupees } from '../utils/formatters';
import ReceiptPrintModal from '../components/ReceiptPrintModal';

const LOOSE_UNITS = ['kg', 'g', 'L', 'ml'];

export const PosPage = () => {
  const { user } = useAuth();

  // Search & Catalog State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  // Cart State: [{ product: {...}, quantity: 1, isLoose: false }]
  const [cart, setCart] = useState([]);
  const [discountRupees, setDiscountRupees] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Payment State: 'CASH' | 'UPI' | 'SPLIT' | 'UDHAAR'
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [cashTenderedRupees, setCashTenderedRupees] = useState('');
  const [upiReference, setUpiReference] = useState('');
  const [splitCashRupees, setSplitCashRupees] = useState('');
  const [splitUpiRupees, setSplitUpiRupees] = useState('');
  const [splitUpiRef, setSplitUpiRef] = useState('');

  // Negative Stock Override Modal State
  const [negativeWarningData, setNegativeWarningData] = useState(null);
  const [overrideReason, setOverrideReason] = useState('Stock available physically in store');

  // Checkout Status & Receipt Modal
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [errorToast, setErrorToast] = useState('');

  const barcodeInputRef = useRef(null);
  const searchDebounceRef = useRef(null);

  // Focus barcode input on mount and on shortcuts
  useEffect(() => {
    barcodeInputRef.current?.focus();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data?.categories || []);
    } catch (e) {
      console.error('Failed to load categories', e);
    }
  };

  // Keyboard shortcuts (F2: focus search, Esc: clear/close)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'Escape') {
        setSearchResults([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search products when query changes
  useEffect(() => {
    if (!searchQuery.trim() && !selectedCategory) {
      setSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = { limit: 12 };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        if (selectedCategory) params.category = selectedCategory;

        const res = await api.get('/products', { params });
        setSearchResults(res.data?.products || []);
      } catch (err) {
        console.error('Product search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, selectedCategory]);

  // Handle direct Barcode Enter scan
  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    const code = searchQuery.trim();
    if (!code) return;

    try {
      setIsSearching(true);
      // Query exact barcode
      const res = await api.get('/products', { params: { search: code } });
      const products = res.data?.products || [];

      if (products.length > 0) {
        // If exact barcode matched, pick it, else first match
        const exactMatch = products.find((p) => p.barcodes?.includes(code)) || products[0];
        addToCart(exactMatch);
        setSearchQuery('');
        setSearchResults([]);
      } else {
        setErrorToast(`No product found with barcode/name: "${code}"`);
        setTimeout(() => setErrorToast(''), 4000);
      }
    } catch (err) {
      console.error('Barcode lookup failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Add product to cart or increment quantity if already exists
  const addToCart = (product) => {
    const isLoose = LOOSE_UNITS.includes(product.unit);
    const step = isLoose ? 1.0 : 1;

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product._id === product._id);
      if (existingIdx >= 0) {
        const next = [...prev];
        const updatedQty = isLoose
          ? Math.round((next[existingIdx].quantity + step) * 1000) / 1000
          : next[existingIdx].quantity + 1;
        next[existingIdx] = { ...next[existingIdx], quantity: updatedQty };
        return next;
      } else {
        return [...prev, { product, quantity: step, isLoose }];
      }
    });

    // Re-focus search for rapid scanning
    barcodeInputRef.current?.focus();
  };

  // Update quantity for a cart line
  const updateQuantity = (index, newQty) => {
    const item = cart[index];
    if (!item) return;

    const isLoose = item.isLoose;
    const num = parseFloat(newQty);

    if (isNaN(num) || num <= 0) {
      removeFromCart(index);
      return;
    }

    const cleanQty = isLoose ? Math.round(num * 1000) / 1000 : Math.max(1, Math.floor(num));

    setCart((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: cleanQty };
      return next;
    });
  };

  // Remove item from cart
  const removeFromCart = (index) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Clear entire cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from the current cart?')) {
      setCart([]);
      setDiscountRupees('');
      setCashTenderedRupees('');
      setCustomerName('');
      setCustomerPhone('');
      barcodeInputRef.current?.focus();
    }
  };

  // Financial Calculations (in Paise)
  const cartCalculations = useMemo(() => {
    let subtotalPaise = 0;
    const itemsWarnings = [];

    cart.forEach((item) => {
      const linePaise = Math.round(item.quantity * item.product.sellingPricePaise);
      subtotalPaise += linePaise;

      const remainingStock = item.product.currentStock - item.quantity;
      if (remainingStock < 0) {
        itemsWarnings.push({
          productName: item.product.name,
          currentStock: item.product.currentStock,
          requestedQty: item.quantity,
          shortage: Math.abs(remainingStock),
          unit: item.product.unit,
        });
      }
    });

    const discountPaise = Math.max(0, rupeesToPaise(discountRupees || 0));
    const finalAmountPaise = Math.max(0, subtotalPaise - discountPaise);

    return {
      subtotalPaise,
      discountPaise,
      finalAmountPaise,
      itemsWarnings,
    };
  }, [cart, discountRupees]);

  // Cash change calculations
  const cashChangePaise = useMemo(() => {
    if (paymentMode !== 'CASH') return 0;
    const tenderedPaise = rupeesToPaise(cashTenderedRupees || 0);
    return Math.max(0, tenderedPaise - cartCalculations.finalAmountPaise);
  }, [paymentMode, cashTenderedRupees, cartCalculations.finalAmountPaise]);

  // Quick Cash denomination setter
  const setExactCash = () => {
    setCashTenderedRupees(paiseToRupees(cartCalculations.finalAmountPaise).toString());
  };

  const addCashTendered = (amountRupees) => {
    const current = parseFloat(cashTenderedRupees) || 0;
    setCashTenderedRupees((current + amountRupees).toString());
  };

  // Complete Checkout Request
  const handleCheckout = async (allowOverride = false) => {
    if (cart.length === 0) {
      setErrorToast('Shopping cart is empty!');
      return;
    }

    const { subtotalPaise, discountPaise, finalAmountPaise } = cartCalculations;

    // Validate payments matching final amount
    const paymentsPayload = [];

    if (paymentMode === 'CASH') {
      const tenderedPaise = rupeesToPaise(cashTenderedRupees || paiseToRupees(finalAmountPaise));
      if (tenderedPaise < finalAmountPaise) {
        setErrorToast(`Cash tendered (₹${tenderedPaise / 100}) is less than bill amount (₹${finalAmountPaise / 100})`);
        return;
      }
      paymentsPayload.push({
        method: 'CASH',
        amountPaise: finalAmountPaise,
        cashTenderedPaise: tenderedPaise,
      });
    } else if (paymentMode === 'UPI') {
      paymentsPayload.push({
        method: 'UPI',
        amountPaise: finalAmountPaise,
        reference: upiReference ? upiReference.trim() : 'UPI-POS',
      });
    } else if (paymentMode === 'SPLIT') {
      const cashPaise = rupeesToPaise(splitCashRupees || 0);
      const upiPaise = rupeesToPaise(splitUpiRupees || 0);

      if (cashPaise + upiPaise !== finalAmountPaise) {
        setErrorToast(
          `Split amounts (₹${(cashPaise + upiPaise) / 100}) do not match final bill amount (₹${finalAmountPaise / 100})`
        );
        return;
      }
      if (cashPaise > 0) {
        paymentsPayload.push({
          method: 'CASH',
          amountPaise: cashPaise,
          cashTenderedPaise: cashPaise,
        });
      }
      if (upiPaise > 0) {
        paymentsPayload.push({
          method: 'UPI',
          amountPaise: upiPaise,
          reference: splitUpiRef ? splitUpiRef.trim() : 'SPLIT-UPI',
        });
      }
    } else if (paymentMode === 'UDHAAR') {
      if (!customerName.trim() || !customerPhone.trim()) {
        setErrorToast('Customer Name and Contact Phone are required for Udhaar (Store Credit).');
        return;
      }
      paymentsPayload.push({
        method: 'CREDIT_UDHAAR',
        amountPaise: finalAmountPaise,
      });
    }

    const payload = {
      items: cart.map((i) => ({
        productId: i.product._id,
        quantity: i.quantity,
      })),
      discountPaise,
      payments: paymentsPayload,
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim(),
      notes: orderNotes.trim(),
      allowNegativeOverride: allowOverride,
      overrideReason: allowOverride ? overrideReason : '',
      idempotencyKey: `POS-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    };

    setIsSubmitting(true);
    setErrorToast('');

    try {
      const res = await api.post('/pos/checkout', payload);
      const sale = res.data?.sale;

      setLastSale(sale);
      setIsReceiptOpen(true);
      setSuccessToast(`Sale completed! Invoice ${sale.invoiceNumber}`);

      // Reset cart and checkout console
      setCart([]);
      setDiscountRupees('');
      setCashTenderedRupees('');
      setSplitCashRupees('');
      setSplitUpiRupees('');
      setCustomerName('');
      setCustomerPhone('');
      setNegativeWarningData(null);

      // Re-focus barcode input
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 500);
    } catch (err) {
      if (err.response?.data?.isNegativeWarning) {
        // Intercept negative stock warning and show override prompt modal
        setNegativeWarningData(err.response.data);
      } else {
        setErrorToast(err.response?.data?.message || err.message || 'Failed to complete sale checkout.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-100 overflow-hidden">
      {/* Toast Alerts */}
      {successToast && (
        <div className="fixed top-18 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-semibold animate-in slide-in-from-top duration-200">
          <CheckCircle className="w-5 h-5 text-emerald-200" />
          {successToast}
        </div>
      )}

      {errorToast && (
        <div className="fixed top-18 right-6 z-50 bg-red-600 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-semibold animate-in slide-in-from-top duration-200">
          <AlertTriangle className="w-5 h-5 text-red-200" />
          {errorToast}
          <button onClick={() => setErrorToast('')} className="ml-2 font-bold text-red-200 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* Main Split Layout: Left 62% Product Search & Cart, Right 38% Payment Console */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: Top Search + Shopping Cart Items Table */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          
          {/* Top Barcode Scanner & Search Bar */}
          <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-800 text-white flex flex-col sm:flex-row items-center gap-2.5">
            <form onSubmit={handleBarcodeSubmit} className="flex-1 relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Barcode className="w-5 h-5 text-emerald-400" />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode or type product name... (Press F2 to focus)"
                className="w-full pl-11 pr-24 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              <div className="absolute inset-y-0 right-1.5 flex items-center">
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-md shadow-xs transition"
                >
                  {isSearching ? 'Scanning...' : 'Enter / Add'}
                </button>
              </div>
            </form>

            {/* Category Quick Filter */}
            <div className="w-full sm:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Real-time Search Dropdown / Panel */}
          {searchResults.length > 0 && (
            <div className="bg-slate-50 border-b border-slate-300 p-2 max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 shadow-inner">
              {searchResults.map((prod) => (
                <div
                  key={prod._id}
                  onClick={() => {
                    addToCart(prod);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="p-2.5 bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs rounded-lg cursor-pointer transition flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-xs text-slate-800 truncate">{prod.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Stock: <span className={prod.currentStock <= 0 ? 'text-red-600 font-bold' : 'text-slate-700'}>
                        {prod.currentStock} {prod.unit}
                      </span>
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-bold text-xs text-emerald-700">{formatINR(prod.sellingPricePaise)}</p>
                    <button className="text-[10px] text-emerald-600 font-medium hover:underline flex items-center gap-0.5 justify-end">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cart Header & Counter */}
          <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <h2 className="font-semibold text-xs sm:text-sm text-slate-800">
                Cart Items ({cart.length} distinct items)
              </h2>
            </div>
            {cart.length > 0 && (
              <button
                onClick={handleClearCart}
                className="text-xs text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Cart
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-300">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <p className="text-sm font-semibold text-slate-600">Your POS cart is empty</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Scan a barcode with your USB barcode scanner, or type a product name in the search bar above to begin billing.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
                  <Info className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tip: Press <strong>F2</strong> to jump straight to the search box anytime.</span>
                </div>
              </div>
            ) : (
              cart.map((item, idx) => {
                const lineTotalPaise = Math.round(item.quantity * item.product.sellingPricePaise);
                const isOverStock = item.product.currentStock - item.quantity < 0;

                return (
                  <div key={item.product._id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    
                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900">{idx + 1}.</span>
                        <h4 className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                          {item.product.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span>Rate: <strong className="text-slate-700">{formatINR(item.product.sellingPricePaise)}</strong> / {item.product.unit}</span>
                        {item.product.mrpPaise > item.product.sellingPricePaise && (
                          <span className="line-through text-slate-400">MRP {formatINR(item.product.mrpPaise)}</span>
                        )}
                        <span>• In Stock: {item.product.currentStock} {item.product.unit}</span>
                      </div>

                      {/* Negative stock warning badge */}
                      {isOverStock && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-fit">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Exceeds shop stock ({item.product.currentStock} {item.product.unit} available)</span>
                        </div>
                      )}
                    </div>

                    {/* Quantity Controls & Quick Weight Chips */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(idx, item.isLoose ? item.quantity - 0.25 : item.quantity - 1)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Decrease Quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          
                          <input
                            type="number"
                            step={item.isLoose ? '0.001' : '1'}
                            min={item.isLoose ? '0.001' : '1'}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(idx, e.target.value)}
                            className="w-16 py-1 text-center font-bold text-xs text-slate-800 focus:outline-none"
                          />
                          
                          <span className="pr-1.5 text-[10px] text-slate-400 font-medium">
                            {item.product.unit}
                          </span>

                          <button
                            type="button"
                            onClick={() => updateQuantity(idx, item.isLoose ? item.quantity + 0.25 : item.quantity + 1)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Increase Quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Quick loose unit buttons for loose items */}
                        {item.isLoose && (
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, 0.25)}
                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                            >
                              250g
                            </button>
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, 0.5)}
                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                            >
                              500g
                            </button>
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, 1.0)}
                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                            >
                              1kg
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Line Subtotal */}
                      <div className="w-24 text-right">
                        <span className="font-bold text-sm text-slate-900 block">
                          {formatINR(lineTotalPaise)}
                        </span>
                      </div>

                      {/* Delete Item */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* Quick summary strip at bottom of cart */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Items Count: <strong className="text-slate-800">{cart.length}</strong>
            </span>
            <span>
              Subtotal: <strong className="text-slate-900 text-sm">{formatINR(cartCalculations.subtotalPaise)}</strong>
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Payment Console & Tender Drawer */}
        <div className="w-full lg:w-[420px] bg-white flex flex-col justify-between border-t lg:border-t-0 border-slate-200 overflow-y-auto">
          
          <div className="p-4 sm:p-5 space-y-4">
            
            {/* Net Amount Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100">
                Total Net Payable
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  {formatINR(cartCalculations.finalAmountPaise)}
                </span>
                {cartCalculations.discountPaise > 0 && (
                  <span className="text-xs bg-emerald-500/40 text-emerald-100 px-2 py-0.5 rounded-full font-medium">
                    Saved {formatINR(cartCalculations.discountPaise)}
                  </span>
                )}
              </div>
            </div>

            {/* Discount & Customer Details (Collapsible / Compact) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Discount (₹)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={discountRupees}
                    onChange={(e) => setDiscountRupees(e.target.value)}
                    className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Customer Phone
                </label>
                <input
                  type="text"
                  placeholder="Optional (10 digits)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Select Payment Mode
              </label>
              
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPaymentMode('CASH')}
                  className={`py-2 text-xs font-semibold rounded-md flex flex-col items-center gap-1 transition ${
                    paymentMode === 'CASH'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <IndianRupee className="w-4 h-4" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('UPI')}
                  className={`py-2 text-xs font-semibold rounded-md flex flex-col items-center gap-1 transition ${
                    paymentMode === 'UPI'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>UPI / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('SPLIT');
                    setSplitCashRupees('');
                    setSplitUpiRupees(paiseToRupees(cartCalculations.finalAmountPaise).toString());
                  }}
                  className={`py-2 text-xs font-semibold rounded-md flex flex-col items-center gap-1 transition ${
                    paymentMode === 'SPLIT'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Split</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('UDHAAR')}
                  className={`py-2 text-xs font-semibold rounded-md flex flex-col items-center gap-1 transition ${
                    paymentMode === 'UDHAAR'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Udhaar</span>
                </button>
              </div>
            </div>

            {/* Dynamic Payment Details Area */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              
              {/* MODE 1: CASH */}
              {paymentMode === 'CASH' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-semibold text-slate-700">Cash Received / Tendered (₹):</span>
                      <button
                        type="button"
                        onClick={setExactCash}
                        className="text-emerald-600 hover:underline font-semibold"
                      >
                        Exact Amount
                      </button>
                    </div>

                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={cashTenderedRupees}
                        onChange={(e) => setCashTenderedRupees(e.target.value)}
                        placeholder={paiseToRupees(cartCalculations.finalAmountPaise).toString()}
                        className="w-full pl-8 pr-3 py-2 text-base font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Quick Denomination Buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[50, 100, 200, 500].map((note) => (
                      <button
                        key={note}
                        type="button"
                        onClick={() => addCashTendered(note)}
                        className="py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-md transition shadow-2xs"
                      >
                        +{note}
                      </button>
                    ))}
                  </div>

                  {/* Change to Return Banner */}
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-800">Change to Return:</span>
                    <span className="text-base font-extrabold text-emerald-700">
                      {formatINR(cashChangePaise)}
                    </span>
                  </div>
                </div>
              )}

              {/* MODE 2: UPI / QR */}
              {paymentMode === 'UPI' && (
                <div className="space-y-2 text-xs">
                  <p className="text-slate-600">
                    Show store QR code to customer for amount{' '}
                    <strong className="text-slate-900 font-bold">
                      {formatINR(cartCalculations.finalAmountPaise)}
                    </strong>
                  </p>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      UPI Ref / UTR / Auth Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 331245678901"
                      value={upiReference}
                      onChange={(e) => setUpiReference(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* MODE 3: SPLIT */}
              {paymentMode === 'SPLIT' && (
                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Cash Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={splitCashRupees}
                        onChange={(e) => {
                          const cash = parseFloat(e.target.value) || 0;
                          setSplitCashRupees(e.target.value);
                          const remaining = Math.max(0, paiseToRupees(cartCalculations.finalAmountPaise) - cash);
                          setSplitUpiRupees(remaining.toString());
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">UPI Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={splitUpiRupees}
                        onChange={(e) => setSplitUpiRupees(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="UPI Ref ID (Optional)"
                      value={splitUpiRef}
                      onChange={(e) => setSplitUpiRef(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* MODE 4: UDHAAR / STORE CREDIT */}
              {paymentMode === 'UDHAAR' && (
                <div className="space-y-2 text-xs">
                  <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>This bill will be added to the customer's store credit (Udhaar) ledger.</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Chandra"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Action Bar & Complete Button */}
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <button
              type="button"
              disabled={isSubmitting || cart.length === 0}
              onClick={() => handleCheckout(false)}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              <span>{isSubmitting ? 'Processing Bill...' : 'Complete Sale & Print Memo'}</span>
            </button>
            <div className="mt-2 text-center text-[11px] text-slate-400">
              Operated by {user?.name || 'Staff'} • Unregistered Retail Cash Memo
            </div>
          </div>

        </div>

      </div>

      {/* Negative Stock Warning Dialog Modal */}
      {negativeWarningData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-amber-300 overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="bg-amber-500 text-white p-4 flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-100 shrink-0" />
              <div>
                <h3 className="font-bold text-base">Negative Stock Authorization Required</h3>
                <p className="text-xs text-amber-100">
                  Transaction will cause shop inventory to drop below zero.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                The following items have insufficient recorded ledger balance:
              </p>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-40 overflow-y-auto p-2 bg-slate-50">
                {negativeWarningData.warnings?.map((w, idx) => (
                  <div key={idx} className="py-1.5 flex justify-between text-slate-800">
                    <span className="font-medium">{w.productName}</span>
                    <span className="text-red-600 font-bold">
                      {w.resultingStock} {w.unit} (short by {Math.abs(w.resultingStock)} {w.unit})
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cashier / Owner Override Authorization Reason:
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                  placeholder="e.g. Physical inventory verified on shelf"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNegativeWarningData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg"
              >
                Cancel & Adjust Cart
              </button>
              <button
                type="button"
                onClick={() => handleCheckout(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
              >
                Authorize & Complete Sale
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptPrintModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={lastSale}
      />
    </div>
  );
};

export default PosPage;
