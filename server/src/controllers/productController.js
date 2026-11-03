import Product, { VALID_UNITS, LOOSE_UNITS } from '../models/Product.js';
import Category from '../models/Category.js';
import { parseCSV, getProductCSVTemplate } from '../utils/csvParser.js';

/**
 * @desc    Get paginated products with search & filters
 * @route   GET /api/v1/products
 * @access  Private (Admin & Staff)
 */
export const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      unit,
      lowStock,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};

    // Role-based active status filtering
    if (req.user.role === 'STAFF') {
      filter.isActive = true;
    } else if (isActive !== undefined) {
      if (isActive === 'true') filter.isActive = true;
      else if (isActive === 'false') filter.isActive = false;
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Unit filter
    if (unit && VALID_UNITS.includes(unit)) {
      filter.unit = unit;
    }

    // Low stock filter
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$minStockLevel'] };
    }

    // Search by name or barcode
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      filter.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { barcodes: { $in: [cleanSearch, new RegExp(`^${cleanSearch}`, 'i')] } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const allowedSortFields = ['name', 'currentStock', 'sellingPricePaise', 'createdAt', 'mrpPaise'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortDirection };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name isActive')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by ID
 * @route   GET /api/v1/products/:id
 * @access  Private (Admin & Staff)
 */
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name isActive')
      .populate('priceHistory.changedBy', 'name username');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Find product by barcode
 * @route   GET /api/v1/products/barcode/:barcode
 * @access  Private (Admin & Staff)
 */
export const getProductByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: 'Barcode parameter is required.',
      });
    }

    const cleanBarcode = barcode.trim();
    const product = await Product.findOne({
      barcodes: cleanBarcode,
      isActive: true,
    }).populate('category', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `No active product found for barcode '${cleanBarcode}'.`,
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new product
 * @route   POST /api/v1/products
 * @access  Private (Admin only)
 */
export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      barcodes,
      unit,
      purchasePricePaise,
      sellingPricePaise,
      mrpPaise,
      currentStock = 0,
      minStockLevel = 5,
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }

    const catDoc = await Category.findById(category);
    if (!catDoc || !catDoc.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Selected category does not exist or is inactive.',
      });
    }

    if (!unit || !VALID_UNITS.includes(unit)) {
      return res.status(400).json({
        success: false,
        message: `Valid unit of measurement is required: ${VALID_UNITS.join(', ')}`,
      });
    }

    // Validate prices as integer paise
    const pPrice = parseInt(purchasePricePaise, 10);
    const sPrice = parseInt(sellingPricePaise, 10);
    const mPrice = parseInt(mrpPaise, 10);

    if (isNaN(pPrice) || pPrice < 0) {
      return res.status(400).json({ success: false, message: 'Purchase price must be a non-negative integer in paise.' });
    }
    if (isNaN(sPrice) || sPrice < 0) {
      return res.status(400).json({ success: false, message: 'Selling price must be a non-negative integer in paise.' });
    }
    if (isNaN(mPrice) || mPrice < 0) {
      return res.status(400).json({ success: false, message: 'MRP must be a non-negative integer in paise.' });
    }

    if (sPrice > mPrice) {
      return res.status(400).json({
        success: false,
        message: `Selling price (₹${sPrice / 100}) cannot exceed Maximum Retail Price MRP (₹${mPrice / 100}).`,
      });
    }

    // Format & check barcode uniqueness
    let barcodeList = [];
    if (Array.isArray(barcodes)) {
      barcodeList = [...new Set(barcodes.map((b) => String(b).trim()).filter(Boolean))];
    } else if (typeof barcodes === 'string' && barcodes.trim()) {
      barcodeList = [barcodes.trim()];
    }

    if (barcodeList.length > 0) {
      const existingConflict = await Product.findOne({
        barcodes: { $in: barcodeList },
      });
      if (existingConflict) {
        return res.status(400).json({
          success: false,
          message: `One or more barcodes are already registered to existing product '${existingConflict.name}'.`,
        });
      }
    }

    // Validate decimal stock
    const parsedStock = parseFloat(currentStock) || 0;
    const isLoose = LOOSE_UNITS.includes(unit);

    if (!isLoose && !Number.isInteger(parsedStock)) {
      return res.status(400).json({
        success: false,
        message: `Unit '${unit}' represents discrete items and does not accept fractional stock. Use whole numbers or switch to loose unit.`,
      });
    }

    const product = await Product.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      category: catDoc._id,
      barcodes: barcodeList,
      unit,
      isLoose,
      purchasePricePaise: pPrice,
      sellingPricePaise: sPrice,
      mrpPaise: mPrice,
      currentStock: parsedStock,
      minStockLevel: Math.max(0, parseFloat(minStockLevel) || 0),
      isActive: true,
      priceHistory: [
        {
          purchasePricePaise: pPrice,
          sellingPricePaise: sPrice,
          mrpPaise: mPrice,
          changedAt: new Date(),
          changedBy: req.user._id,
        },
      ],
    });

    const populated = await Product.findById(product._id).populate('category', 'name');

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      product: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product & record price history
 * @route   PUT /api/v1/products/:id
 * @access  Private (Admin only)
 */
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    const {
      name,
      description,
      category,
      barcodes,
      unit,
      purchasePricePaise,
      sellingPricePaise,
      mrpPaise,
      currentStock,
      minStockLevel,
      isActive,
    } = req.body;

    if (name && name.trim()) {
      product.name = name.trim();
    }

    if (description !== undefined) {
      product.description = description.trim();
    }

    if (category) {
      const catDoc = await Category.findById(category);
      if (!catDoc || !catDoc.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Selected category does not exist or is inactive.',
        });
      }
      product.category = catDoc._id;
    }

    if (unit) {
      if (!VALID_UNITS.includes(unit)) {
        return res.status(400).json({
          success: false,
          message: `Unit must be one of: ${VALID_UNITS.join(', ')}`,
        });
      }
      product.unit = unit;
      product.isLoose = LOOSE_UNITS.includes(unit);
    }

    // Barcode updates & uniqueness check
    if (barcodes !== undefined) {
      let barcodeList = [];
      if (Array.isArray(barcodes)) {
        barcodeList = [...new Set(barcodes.map((b) => String(b).trim()).filter(Boolean))];
      } else if (typeof barcodes === 'string' && barcodes.trim()) {
        barcodeList = [barcodes.trim()];
      }

      if (barcodeList.length > 0) {
        const conflict = await Product.findOne({
          _id: { $ne: product._id },
          barcodes: { $in: barcodeList },
        });
        if (conflict) {
          return res.status(400).json({
            success: false,
            message: `Barcode already in use by product '${conflict.name}'.`,
          });
        }
      }
      product.barcodes = barcodeList;
    }

    // Stock updates
    if (currentStock !== undefined) {
      const parsedStock = parseFloat(currentStock);
      if (isNaN(parsedStock)) {
        return res.status(400).json({ success: false, message: 'Invalid current stock value.' });
      }
      if (!product.isLoose && !Number.isInteger(parsedStock)) {
        return res.status(400).json({
          success: false,
          message: `Unit '${product.unit}' represents discrete items and does not accept fractional stock.`,
        });
      }
      product.currentStock = parsedStock;
    }

    if (minStockLevel !== undefined) {
      product.minStockLevel = Math.max(0, parseFloat(minStockLevel) || 0);
    }

    if (isActive !== undefined) {
      product.isActive = Boolean(isActive);
    }

    // Price updates & Historical Snapshot preservation
    let pricesChanged = false;
    let newPurchase = product.purchasePricePaise;
    let newSelling = product.sellingPricePaise;
    let newMrp = product.mrpPaise;

    if (purchasePricePaise !== undefined) {
      const p = parseInt(purchasePricePaise, 10);
      if (isNaN(p) || p < 0) {
        return res.status(400).json({ success: false, message: 'Purchase price must be a non-negative integer in paise.' });
      }
      if (p !== product.purchasePricePaise) {
        pricesChanged = true;
        newPurchase = p;
      }
    }

    if (sellingPricePaise !== undefined) {
      const s = parseInt(sellingPricePaise, 10);
      if (isNaN(s) || s < 0) {
        return res.status(400).json({ success: false, message: 'Selling price must be a non-negative integer in paise.' });
      }
      if (s !== product.sellingPricePaise) {
        pricesChanged = true;
        newSelling = s;
      }
    }

    if (mrpPaise !== undefined) {
      const m = parseInt(mrpPaise, 10);
      if (isNaN(m) || m < 0) {
        return res.status(400).json({ success: false, message: 'MRP must be a non-negative integer in paise.' });
      }
      if (m !== product.mrpPaise) {
        pricesChanged = true;
        newMrp = m;
      }
    }

    if (newSelling > newMrp) {
      return res.status(400).json({
        success: false,
        message: `Selling price (₹${newSelling / 100}) cannot exceed MRP (₹${newMrp / 100}).`,
      });
    }

    if (pricesChanged) {
      product.purchasePricePaise = newPurchase;
      product.sellingPricePaise = newSelling;
      product.mrpPaise = newMrp;

      product.priceHistory.push({
        purchasePricePaise: newPurchase,
        sellingPricePaise: newSelling,
        mrpPaise: newMrp,
        changedAt: new Date(),
        changedBy: req.user._id,
      });
    }

    await product.save();
    const updated = await Product.findById(product._id).populate('category', 'name');

    res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      product: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle product active/deactivated status
 * @route   PATCH /api/v1/products/:id/status
 * @access  Private (Admin only)
 */
export const toggleProductStatus = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product '${product.name}' is now ${product.isActive ? 'Active' : 'Deactivated'}.`,
      product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download standard CSV template for catalog import
 * @route   GET /api/v1/products/csv/template
 * @access  Private (Admin only)
 */
export const downloadCSVTemplate = (req, res) => {
  const template = getProductCSVTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="smart_kirana_products_template.csv"');
  res.status(200).send(template);
};

/**
 * @desc    Import products via CSV with validation & duplicate prevention
 * @route   POST /api/v1/products/csv/import
 * @access  Private (Admin only)
 */
export const importProductsCSV = async (req, res, next) => {
  try {
    const { csvText, dryRun = false } = req.body;

    if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'CSV data string is required.',
      });
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV file contains no valid product rows.',
      });
    }

    const errors = [];
    const validatedProducts = [];
    const seenBarcodesInBatch = new Set();
    const seenNamesInBatch = new Set();

    // Cache categories to avoid repetitive queries
    const existingCategories = await Category.find();
    const categoryMap = new Map();
    existingCategories.forEach((c) => {
      categoryMap.set(c.name.toLowerCase().trim(), c);
      categoryMap.set(c._id.toString(), c);
    });

    // Check all existing barcodes in database
    const allDbProductsWithBarcodes = await Product.find(
      { 'barcodes.0': { $exists: true } },
      'name barcodes'
    );
    const existingDbBarcodeMap = new Map();
    allDbProductsWithBarcodes.forEach((p) => {
      p.barcodes.forEach((b) => existingDbBarcodeMap.set(b, p.name));
    });

    for (const row of rows) {
      const rowNum = row._rowNumber;
      const name = (row.Name || row.name || '').trim();
      const catName = (row.Category || row.category || '').trim();
      const unit = (row.Unit || row.unit || '').trim();
      const pPriceStr = (row.PurchasePriceRupees || row.purchasePriceRupees || row.purchase_price || '').trim();
      const sPriceStr = (row.SellingPriceRupees || row.sellingPriceRupees || row.selling_price || '').trim();
      const mrpStr = (row.MRPRupees || row.mrpRupees || row.mrp || '').trim();
      const stockStr = (row.CurrentStock || row.currentStock || row.stock || '0').trim();
      const minStockStr = (row.MinStockLevel || row.minStockLevel || row.min_stock || '5').trim();
      const barcodesRaw = (row.Barcodes || row.barcodes || row.barcode || '').trim();
      const description = (row.Description || row.description || '').trim();

      // 1. Validate Name
      if (!name) {
        errors.push({ row: rowNum, field: 'Name', message: 'Product name is required.' });
        continue;
      }
      if (seenNamesInBatch.has(name.toLowerCase())) {
        errors.push({ row: rowNum, field: 'Name', message: `Duplicate product name '${name}' within CSV.` });
        continue;
      }
      seenNamesInBatch.add(name.toLowerCase());

      // 2. Validate Category
      let categoryDoc = null;
      if (!catName) {
        errors.push({ row: rowNum, field: 'Category', message: 'Category is required.' });
      } else {
        const catKey = catName.toLowerCase();
        if (categoryMap.has(catKey)) {
          categoryDoc = categoryMap.get(catKey);
        } else {
          // If category doesn't exist, auto-create it
          categoryDoc = await Category.create({ name: catName, isActive: true });
          categoryMap.set(catKey, categoryDoc);
          categoryMap.set(categoryDoc._id.toString(), categoryDoc);
        }
      }

      // 3. Validate Unit
      if (!unit || !VALID_UNITS.includes(unit)) {
        errors.push({
          row: rowNum,
          field: 'Unit',
          message: `Invalid unit '${unit}'. Must be one of: ${VALID_UNITS.join(', ')}`,
        });
      }

      // 4. Validate Prices (Rupees to Integer Paise)
      const pRupees = parseFloat(pPriceStr);
      const sRupees = parseFloat(sPriceStr);
      const mrpRupees = parseFloat(mrpStr);

      if (isNaN(pRupees) || pRupees < 0) {
        errors.push({ row: rowNum, field: 'PurchasePriceRupees', message: 'Purchase price must be a valid positive number.' });
      }
      if (isNaN(sRupees) || sRupees < 0) {
        errors.push({ row: rowNum, field: 'SellingPriceRupees', message: 'Selling price must be a valid positive number.' });
      }
      if (isNaN(mrpRupees) || mrpRupees < 0) {
        errors.push({ row: rowNum, field: 'MRPRupees', message: 'MRP must be a valid positive number.' });
      }

      const pPaise = Math.round(pRupees * 100);
      const sPaise = Math.round(sRupees * 100);
      const mrpPaise = Math.round(mrpRupees * 100);

      if (sPaise > mrpPaise) {
        errors.push({
          row: rowNum,
          field: 'SellingPriceRupees',
          message: `Selling price (₹${sRupees}) cannot exceed MRP (₹${mrpRupees}).`,
        });
      }

      // 5. Validate Barcodes
      const barcodeList = barcodesRaw
        ? barcodesRaw
            .split(/[,;\s]+/)
            .map((b) => b.trim())
            .filter(Boolean)
        : [];

      for (const bc of barcodeList) {
        if (seenBarcodesInBatch.has(bc)) {
          errors.push({
            row: rowNum,
            field: 'Barcodes',
            message: `Barcode '${bc}' appears multiple times in the CSV.`,
          });
        }
        seenBarcodesInBatch.add(bc);

        if (existingDbBarcodeMap.has(bc)) {
          errors.push({
            row: rowNum,
            field: 'Barcodes',
            message: `Barcode '${bc}' already exists in database for product '${existingDbBarcodeMap.get(bc)}'.`,
          });
        }
      }

      // 6. Validate Stock
      const stock = parseFloat(stockStr);
      const minStock = parseFloat(minStockStr);
      const isLoose = LOOSE_UNITS.includes(unit);

      if (isNaN(stock) || stock < 0) {
        errors.push({ row: rowNum, field: 'CurrentStock', message: 'Current stock must be a non-negative number.' });
      }
      if (!isLoose && !Number.isInteger(stock)) {
        errors.push({
          row: rowNum,
          field: 'CurrentStock',
          message: `Unit '${unit}' represents discrete items and does not accept fractional stock.`,
        });
      }

      if (categoryDoc && errors.every((e) => e.row !== rowNum)) {
        validatedProducts.push({
          name,
          description,
          category: categoryDoc._id,
          unit,
          isLoose,
          purchasePricePaise: pPaise,
          sellingPricePaise: sPaise,
          mrpPaise,
          currentStock: stock || 0,
          minStockLevel: isNaN(minStock) ? 5 : minStock,
          barcodes: barcodeList,
          isActive: true,
          priceHistory: [
            {
              purchasePricePaise: pPaise,
              sellingPricePaise: sPaise,
              mrpPaise,
              changedAt: new Date(),
              changedBy: req.user._id,
            },
          ],
        });
      }
    }

    // If any validation errors exist, abort and return clean report
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `CSV validation failed with ${errors.length} error(s). No products were imported.`,
        totalRows: rows.length,
        invalidCount: errors.length,
        errors,
      });
    }

    // Dry Run mode
    if (dryRun === true || dryRun === 'true') {
      return res.status(200).json({
        success: true,
        dryRun: true,
        message: `Validation successful! All ${validatedProducts.length} rows are valid and ready to import.`,
        totalCount: validatedProducts.length,
        preview: validatedProducts.slice(0, 5),
      });
    }

    // Execute Batch Insert
    const inserted = await Product.insertMany(validatedProducts);

    res.status(201).json({
      success: true,
      message: `Successfully imported ${inserted.length} products.`,
      importedCount: inserted.length,
    });
  } catch (error) {
    next(error);
  }
};
