import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; username: string; role: string }
}

const JWT_SECRET = process.env.JWT_SECRET

export function generateToken(payload: { userId: string; username: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '7d' })
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) {
    res.status(401).json({ success: false, message: '需要提供访问令牌' })
    return
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: string; username: string; role: string }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ success: false, message: '无效或过期的访问令牌' })
  }
}
