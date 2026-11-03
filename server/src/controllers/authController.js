import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';

/**
 * @desc    Authenticate user & get JWT token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username and password.',
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the store owner.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently logged-in user profile
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new staff account
 * @route   POST /api/v1/auth/users
 * @access  Private (Admin only)
 */
export const createUser = async (req, res, next) => {
  try {
    const { name, username, password, role = 'STAFF', phone } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, username, and password are required fields.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Username '${cleanUsername}' is already taken.`,
      });
    }

    const newUser = await User.create({
      name: name.trim(),
      username: cleanUsername,
      password,
      role: role === 'ADMIN' ? 'ADMIN' : 'STAFF',
      phone: phone ? phone.trim() : '',
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: `${newUser.role} user created successfully`,
      user: newUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List all store users (Admin and Staff)
 * @route   GET /api/v1/auth/users
 * @access  Private (Admin only)
 */
export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle user active/inactive status
 * @route   PATCH /api/v1/auth/users/:id/status
 * @access  Private (Admin only)
 */
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Safety checks: Cannot deactivate oneself
    if (req.user.id.toString() === targetUser._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own active session account.',
      });
    }

    // Prevent deactivating the last active Admin
    if (targetUser.role === 'ADMIN' && targetUser.isActive) {
      const activeAdminCount = await User.countDocuments({ role: 'ADMIN', isActive: true });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the sole active Admin account of the store.',
        });
      }
    }

    targetUser.isActive = !targetUser.isActive;
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: `User '${targetUser.username}' is now ${targetUser.isActive ? 'Active' : 'Deactivated'}.`,
      user: targetUser,
    });
  } catch (error) {
    next(error);
  }
};
