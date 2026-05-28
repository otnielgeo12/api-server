import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key-change-in-prod";

export type AdminRole = "super_admin" | "admin" | "admin_fnb" | "admin_entertainment";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: AdminRole;
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      role: AdminRole;
    };
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== "super_admin") {
      res.status(403).json({ error: "Super Admin privileges required" });
      return;
    }
    next();
  });
}
