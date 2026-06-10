import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey', (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
      }

      req.user = decoded as UserPayload;
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
};

export const requireAgent = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'AGENT') {
    return res.status(403).json({ error: 'Forbidden: Access restricted to agents' });
  }
  next();
};

export const requireCustomer = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Forbidden: Access restricted to customers' });
  }
  next();
};
