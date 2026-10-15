import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../database/connection';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response) => {
  const { username, email, password } = registerSchema.parse(req.body);

  // Check if user exists
  const existingUser = await pool.query(
    'SELECT * FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );

  if (existingUser.rows.length > 0) {
    throw new AppError(400, 'User already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const result = await pool.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, role, created_at',
    [username, email, passwordHash]
  );

  const user = result.rows[0];

  // Generate token
  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  res.status(201).json({
    status: 'success',
    data: {
      user,
      token,
    },
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  // Find user
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new AppError(401, 'Invalid credentials');
  }

  const user = result.rows[0];

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    throw new AppError(401, 'Invalid credentials');
  }

  // Generate token
  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  // Remove password from response
  delete user.password_hash;

  res.json({
    status: 'success',
    data: {
      user,
      token,
    },
  });
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
    [req.user!.id]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'User not found');
  }

  res.json({
    status: 'success',
    data: {
      user: result.rows[0],
    },
  });
};
