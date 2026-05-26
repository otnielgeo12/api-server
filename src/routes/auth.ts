import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key-change-in-prod";

const router: IRouter = Router();

const LoginBody = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { username, password } = parsed.data;
  
  try {
    const [user] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.username, username))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "An error occurred during login" });
  }
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, authReq.user.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User no longer exists" });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "An error occurred" });
  }
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, authReq.user.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User no longer exists" });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(400).json({ error: "Incorrect current password" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(adminUsersTable)
      .set({ password: hashedPassword })
      .where(eq(adminUsersTable.id, user.id));

    res.json({ message: "Password updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "An error occurred" });
  }
});

export default router;
