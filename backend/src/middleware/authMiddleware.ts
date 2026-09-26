import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

/**
 * Express middleware that validates JWT from Authorization header.
 * Attaches `req.userId` for downstream handlers.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = AuthService.validateToken(token);
    (req as any).userId = decoded.userId;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
}
