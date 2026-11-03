import Category from '../models/Category.js';
import Product from '../models/Product.js';

/**
 * @desc    Get all categories with active product count
 * @route   GET /api/v1/categories
 * @access  Private (Admin & Staff)
 */
export const getCategories = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const filter = {};

    // Only Admin can view inactive categories
    if (includeInactive === 'true' && req.user.role === 'ADMIN') {
      // include all
    } else {
      filter.isActive = true;
    }

    const categories = await Category.find(filter).sort({ name: 1 });

    // Aggregate product counts per category for efficient overview
    const productCounts = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    productCounts.forEach((pc) => {
      countMap[pc._id.toString()] = pc.count;
    });

    const enriched = categories.map((c) => ({
      ...c.toObject(),
      productCount: countMap[c._id.toString()] || 0,
    }));

    res.status(200).json({
      success: true,
      count: enriched.length,
      categories: enriched,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single category by ID
 * @route   GET /api/v1/categories/:id
 * @access  Private
 */
export const getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    const productCount = await Product.countDocuments({ category: category._id, isActive: true });

    res.status(200).json({
      success: true,
      category: {
        ...category.toObject(),
        productCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create category
 * @route   POST /api/v1/categories
 * @access  Private (Admin only)
 */
export const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.',
      });
    }

    const cleanName = name.trim();
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Category '${cleanName}' already exists.`,
      });
    }

    const category = await Category.create({
      name: cleanName,
      description: description ? description.trim() : '',
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category: {
        ...category.toObject(),
        productCount: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update category
 * @route   PUT /api/v1/categories/:id
 * @access  Private (Admin only)
 */
export const updateCategory = async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    if (name && name.trim()) {
      const cleanName = name.trim();
      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Category with name '${cleanName}' already exists.`,
        });
      }
      category.name = cleanName;
    }

    if (description !== undefined) {
      category.description = description.trim();
    }

    // Safety guard: if deactivating category, ensure no active products are associated
    if (isActive === false && category.isActive === true) {
      const activeProducts = await Product.countDocuments({ category: category._id, isActive: true });
      if (activeProducts > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot deactivate category '${category.name}' because ${activeProducts} active product(s) are assigned to it. Please reassign or deactivate the products first.`,
        });
      }
      category.isActive = false;
    } else if (isActive === true) {
      category.isActive = true;
    }

    await category.save();

    const productCount = await Product.countDocuments({ category: category._id, isActive: true });

    res.status(200).json({
      success: true,
      message: 'Category updated successfully.',
      category: {
        ...category.toObject(),
        productCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate or Delete category
 * @route   DELETE /api/v1/categories/:id
 * @access  Private (Admin only)
 */
export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    // Strict safety check: Prevent deletion if products exist
    const associatedProducts = await Product.countDocuments({ category: category._id });
    if (associatedProducts > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category '${category.name}' because ${associatedProducts} product(s) (active or archived) are associated with it. Deactivate or reassign them first.`,
      });
    }

    await Category.findByIdAndDelete(category._id);

    res.status(200).json({
      success: true,
      message: `Category '${category.name}' permanently deleted.`,
    });
  } catch (error) {
    next(error);
  }
};
