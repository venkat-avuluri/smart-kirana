import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/formatters';
import { ProductModal } from '../components/ProductModal';
import { CsvImportModal } from '../components/CsvImportModal';
import {
  Package,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Power,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Barcode,
  Layers,
  ArrowUpDown,
  Eye,
  Info,
} from 'lucide-react';

const VALID_UNITS = ['kg', 'g', 'L', 'ml', 'piece', 'packet'];

export const ProductsPage = () => {
  const { isAdmin } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState('true');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Fetch Categories for dropdown
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data } = await api.get('/categories');
        if (data.success) {
          setCategories(data.categories);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, []);

  // Fetch Products with filters
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const params = {
        page,
        limit: 15,
        search: searchTerm.trim(),
        category: selectedCategory,
        unit: selectedUnit,
        lowStock: showLowStockOnly ? 'true' : 'false',
        isActive: isAdmin ? activeFilter : 'true',
      };

      const { data } = await api.get('/products', { params });
      if (data.success) {
        setProducts(data.products);
        setTotalPages(data.totalPages);
        setTotalProducts(data.total);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to load products.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, selectedCategory, selectedUnit, showLowStockOnly, activeFilter, isAdmin]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [fetchProducts]);

  const handleOpenAddModal = () => {
    setSelectedProduct(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleToggleStatus = async (product) => {
    const actionText = product.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionText} product '${product.name}'?`)) {
      return;
    }

    try {
      const { data } = await api.patch(`/products/${product._id}/status`);
      setSuccessMessage(data.message);
      fetchProducts();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to update product status.');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            Product Catalog & Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage loose grains, liquids, packets and barcodes with integer paise precision.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Import CSV
            </button>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search by Name or Barcode */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name or scan barcode..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div>
            <select
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All Units</option>
              {VALID_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Quick Filter */}
          <div className="flex items-center gap-2 px-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={showLowStockOnly}
                onChange={(e) => {
                  setShowLowStockOnly(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
              />
              <span className="flex items-center gap-1 text-rose-700 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Low Stock Only
              </span>
            </label>
          </div>
        </div>

        {/* Status Filter for Admin */}
        {isAdmin && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[11px] font-semibold">Filter Status:</span>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('true');
                  setPage(1);
                }}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
                  activeFilter === 'true' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Active Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('false');
                  setPage(1);
                }}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
                  activeFilter === 'false' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Deactivated Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('');
                  setPage(1);
                }}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
                  activeFilter === '' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                All Products
              </button>
            </div>

            <span className="text-slate-500 text-[11px]">
              Found <strong>{totalProducts}</strong> products matching filters
            </span>
          </div>
        )}
      </div>

      {/* Products Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-14 text-center text-slate-500 flex flex-col items-center">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mb-2" />
            <p className="text-xs">Loading product catalog...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No products match your criteria</p>
            <p className="text-slate-400 mt-0.5">Try clearing filters or add a new product.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Barcodes</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Selling Price (MRP)</th>
                  {isAdmin && <th className="py-3 px-4">Purchase Price</th>}
                  <th className="py-3 px-4">Stock Level</th>
                  <th className="py-3 px-4">Status</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const isLowStock = p.currentStock <= p.minStockLevel;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition">
                      {/* Name & Description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{p.description}</div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {p.category?.name || 'Uncategorized'}
                        </span>
                      </td>

                      {/* Barcodes */}
                      <td className="py-3 px-4">
                        {p.barcodes && p.barcodes.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {p.barcodes.map((bc, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                              >
                                <Barcode className="w-3 h-3 text-slate-400" />
                                {bc}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">Loose / No barcode</span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-4 font-medium text-slate-700">
                        <span>{p.unit}</span>
                        {p.isLoose && (
                          <span className="ml-1 text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-semibold">
                            Loose
                          </span>
                        )}
                      </td>

                      {/* Selling Price & MRP */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {formatINR(p.sellingPricePaise)}
                        </div>
                        {p.mrpPaise > p.sellingPricePaise && (
                          <div className="text-[10px] text-slate-400">
                            MRP: <span className="line-through">{formatINR(p.mrpPaise)}</span>
                          </div>
                        )}
                      </td>

                      {/* Purchase Price (Admin Only) */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {formatINR(p.purchasePricePaise)}
                        </td>
                      )}

                      {/* Stock Level */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold font-mono ${
                              p.currentStock <= 0
                                ? 'text-rose-600'
                                : isLowStock
                                ? 'text-amber-600'
                                : 'text-slate-900'
                            }`}
                          >
                            {p.isLoose ? Number(p.currentStock).toFixed(3) : p.currentStock} {p.unit}
                          </span>
                          {isLowStock && (
                            <span
                              title={`Below minimum threshold of ${p.minStockLevel} ${p.unit}`}
                              className="p-0.5 rounded text-rose-600 bg-rose-50"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">Min: {p.minStockLevel} {p.unit}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            p.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {p.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Admin Actions */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              title="Edit Product"
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(p)}
                              title={p.isActive ? 'Deactivate Product' : 'Activate Product'}
                              className={`p-1.5 rounded-lg transition ${
                                p.isActive
                                  ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalProducts} items total)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-slate-800">{page}</span>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={selectedProduct}
        categories={categories}
        onSuccess={() => {
          setSuccessMessage(selectedProduct ? 'Product updated successfully.' : 'Product created successfully.');
          fetchProducts();
          setTimeout(() => setSuccessMessage(''), 4000);
        }}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={() => {
          setSuccessMessage('CSV import completed successfully.');
          fetchProducts();
          setTimeout(() => setSuccessMessage(''), 4000);
        }}
      />
    </div>
  );
};
