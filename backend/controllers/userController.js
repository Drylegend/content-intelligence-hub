import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

export async function registerUser(req, res, next) {
  try {
    const { name, email, password, role = "user" } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error("Name, email, and password are required.");
    }

    if (password.length < 8) {
      res.status(400);
      throw new Error("Password must be at least 8 characters.");
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409);
      throw new Error("An account with this email already exists.");
    }

    const user = await User.create({ name, email, password, role });
    res.status(201).json({
      token: signToken(user._id),
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error("Email and password are required.");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401);
      throw new Error("Invalid email or password.");
    }

    res.json({
      token: signToken(user._id),
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUser(req, res, next) {
  try {
    res.json({ user: sanitizeUser(req.user) });
  } catch (error) {
    next(error);
  }
}
