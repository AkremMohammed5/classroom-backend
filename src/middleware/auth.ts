import { Request, Response, NextFunction } from "express";

export type UserWithRole = {
  id?: string;
  role: string;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const roleHeader = String(req.headers["x-user-role"] ?? "").trim();
  const userIdHeader = String(req.headers["x-user-id"] ?? "").trim();

  let role = "";

  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    role = authHeader.slice("Bearer ".length).trim();
  } else if (roleHeader) {
    role = roleHeader;
  }

  if (!role) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  (req as any).user = {
    id: userIdHeader || undefined,
    role,
  } as UserWithRole;

  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as UserWithRole | undefined;
    if (!user?.role || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
