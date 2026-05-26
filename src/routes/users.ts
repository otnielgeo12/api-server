import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";
import { z } from "zod";
import { requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const CreateUserBody = z.object({
  username: z.string().min(1, "Username is required").max(100),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_admin", "admin"]),
});

const UpdateUserBody = z.object({
  username: z.string().min(1, "Username is required").max(100).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.enum(["super_admin", "admin"]).optional(),
});

// All user management routes require Super Admin privileges
router.use("/users", requireSuperAdmin);

router.get("/users", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: adminUsersTable.id,
        username: adminUsersTable.username,
        email: adminUsersTable.email,
        role: adminUsersTable.role,
        createdAt: adminUsersTable.createdAt,
        updatedAt: adminUsersTable.updatedAt,
      })
      .from(adminUsersTable);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "An error occurred listing users" });
  }
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { username, email, password, role } = parsed.data;

  try {
    // Check if username already exists
    const [existing] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.username, username))
      .limit(1);

    if (existing) {
      res.status(400).json({ error: "Username already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.insert(adminUsersTable).values({
      username,
      email: email || null,
      password: hashedPassword,
      role,
    });

    const [createdUser] = await db
      .select({
        id: adminUsersTable.id,
        username: adminUsersTable.username,
        email: adminUsersTable.email,
        role: adminUsersTable.role,
        createdAt: adminUsersTable.createdAt,
        updatedAt: adminUsersTable.updatedAt,
      })
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, result.insertId))
      .limit(1);

    res.status(201).json(createdUser);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "An error occurred creating user" });
  }
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { username, email, password, role } = parsed.data;

  try {
    const [existing] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Check if new username is taken
    if (username && username !== existing.username) {
      const [taken] = await db
        .select()
        .from(adminUsersTable)
        .where(eq(adminUsersTable.username, username))
        .limit(1);

      if (taken) {
        res.status(400).json({ error: "Username already taken" });
        return;
      }
    }

    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email || null;
    if (role !== undefined) updateData.role = role;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(adminUsersTable)
        .set(updateData)
        .where(eq(adminUsersTable.id, id));
    }

    const [updatedUser] = await db
      .select({
        id: adminUsersTable.id,
        username: adminUsersTable.username,
        email: adminUsersTable.email,
        role: adminUsersTable.role,
        createdAt: adminUsersTable.createdAt,
        updatedAt: adminUsersTable.updatedAt,
      })
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, id))
      .limit(1);

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "An error occurred updating user" });
  }
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  // Prevent self-deletion
  if (authReq.user && authReq.user.id === id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db
      .delete(adminUsersTable)
      .where(eq(adminUsersTable.id, id));

    res.sendStatus(204);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "An error occurred deleting user" });
  }
});

export default router;
