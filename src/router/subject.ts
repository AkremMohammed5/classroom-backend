import express from "express";
import { eq, ilike, or, and, desc, sql, getTableColumns } from "drizzle-orm";

import { db } from "../db/index";
import { classes, departments, enrollments, subjects } from "../db/schema/index";
import { user } from "../db/schema/auth";

const router = express.Router();

// Get all subjects with optional search, department filter, and pagination
router.get("/", async (req, res) => {
  try {
    const { search, department, page = "1", limit = "10" } = req.query;

    const parsedPage = Number.parseInt(String(page), 10);
    const parsedLimit = Number.parseInt(String(limit), 10);

    const currentPage = Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1);
    const limitPerPage = Math.min(
      100,
      Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 10)
    );
    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    if (search) {
      filterConditions.push(
        or(
          ilike(subjects.name, `%${search}%`),
          ilike(subjects.code, `%${search}%`)
        )
      );
    }

    if (department) {
      filterConditions.push(ilike(departments.name, `%${department}%`));
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    // Count query MUST include the join
    const countResult = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    // Data query
    const subjectsList = await db
      .select({
        ...getTableColumns(subjects),
        department: {
          ...getTableColumns(departments),
        },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: subjectsList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error("GET /subjects error:", error);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { departmentId, name, code, description } = req.body;

    const parsedDepartmentId = Number(departmentId);

    if (!Number.isFinite(parsedDepartmentId) || parsedDepartmentId <= 0) {
      return res.status(400).json({ error: "departmentId is required and must be a positive number" });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({ error: "code is required" });
    }

    const [createdSubject] = await db
      .insert(subjects)
      .values({
        departmentId: parsedDepartmentId,
        name: name.trim(),
        code: code.trim(),
        description: typeof description === "string" ? description.trim() : description,
      })
      .returning({ id: subjects.id });

    if (!createdSubject) throw new Error("Insert failed");

    res.status(201).json({ data: createdSubject });
  } catch (error) {
    console.error("POST /subjects error:", error);

    const err = error as any;

    // PostgreSQL unique constraint violation
    if (err?.code === "23505" || err?.constraint === "subjects_code_unique") {
      return res.status(409).json({ error: "Subject code already exists" });
    }

    // PostgreSQL foreign key violation
    if (err?.code === "23503" || err?.constraint === "subjects_department_id_departments_id_fk") {
      return res.status(400).json({ error: "Invalid departmentId" });
    }

    if (err?.constraint) {
      return res.status(400).json({ error: `Constraint failed: ${err.constraint}` });
    }

    res.status(500).json({ error: "Failed to create subject" });
  }
});

// Get subject details with counts
router.get("/:id", async (req, res) => {
  try {
    const subjectId = Number(req.params.id);

    if (!Number.isFinite(subjectId)) {
      return res.status(400).json({ error: "Invalid subject id" });
    }

    const [subject] = await db
      .select({
        ...getTableColumns(subjects),
        department: {
          ...getTableColumns(departments),
        },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(eq(subjects.id, subjectId));

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    const classesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .where(eq(classes.subjectId, subjectId));

    res.status(200).json({
      data: {
        subject,
        totals: {
          classes: classesCount[0]?.count ?? 0,
        },
      },
    });
  } catch (error) {
    console.error("GET /subjects/:id error:", error);
    res.status(500).json({ error: "Failed to fetch subject details" });
  }
});

// List classes in a subject with pagination
router.get("/:id/classes", async (req, res) => {
  try {
    const subjectId = Number(req.params.id);
    const { page = "1", limit = "10" } = req.query;

    if (!Number.isFinite(subjectId)) {
      return res.status(400).json({ error: "Invalid subject id" });
    }

    const parsedPage = Number.parseInt(String(page), 10);
    const parsedLimit = Number.parseInt(String(limit), 10);

    const currentPage = Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1);
    const limitPerPage = Math.min(
      100,
      Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 10)
    );
    const offset = (currentPage - 1) * limitPerPage;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .where(eq(classes.subjectId, subjectId));

    const totalCount = countResult[0]?.count ?? 0;

    const classesList = await db
      .select({
        ...getTableColumns(classes),
        teacher: {
          ...getTableColumns(user),
        },
      })
      .from(classes)
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(eq(classes.subjectId, subjectId))
      .orderBy(desc(classes.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: classesList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error("GET /subjects/:id/classes error:", error);
    res.status(500).json({ error: "Failed to fetch subject classes" });
  }
});

// List users in a subject by role with pagination
router.get("/:id/users", async (req, res) => {
  try {
    const subjectId = Number(req.params.id);
    const { role, page = "1", limit = "10" } = req.query;

    if (!Number.isFinite(subjectId)) {
      return res.status(400).json({ error: "Invalid subject id" });
    }

    if (role !== "teacher" && role !== "student") {
      return res.status(400).json({ error: "Invalid role" });
    }

    const parsedPage = Number.parseInt(String(page), 10);
    const parsedLimit = Number.parseInt(String(limit), 10);

    const currentPage = Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1);
    const limitPerPage = Math.min(
      100,
      Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 10)
    );
    const offset = (currentPage - 1) * limitPerPage;

    const baseSelect = {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      imageCldPubId: user.imageCldPubId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const groupByFields = [
      user.id,
      user.name,
      user.email,
      user.emailVerified,
      user.image,
      user.role,
      user.imageCldPubId,
      user.createdAt,
      user.updatedAt,
    ];

    const countResult =
      role === "teacher"
        ? await db
            .select({ count: sql<number>`count(distinct ${user.id})` })
            .from(user)
            .leftJoin(classes, eq(user.id, classes.teacherId))
            .where(and(eq(user.role, role), eq(classes.subjectId, subjectId)))
        : await db
            .select({ count: sql<number>`count(distinct ${user.id})` })
            .from(user)
            .leftJoin(enrollments, eq(user.id, enrollments.studentId))
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .where(and(eq(user.role, role), eq(classes.subjectId, subjectId)));

    const totalCount = countResult[0]?.count ?? 0;

    const usersList =
      role === "teacher"
        ? await db
            .select(baseSelect)
            .from(user)
            .leftJoin(classes, eq(user.id, classes.teacherId))
            .where(and(eq(user.role, role), eq(classes.subjectId, subjectId)))
            .groupBy(...groupByFields)
            .orderBy(desc(user.createdAt))
            .limit(limitPerPage)
            .offset(offset)
        : await db
            .select(baseSelect)
            .from(user)
            .leftJoin(enrollments, eq(user.id, enrollments.studentId))
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .where(and(eq(user.role, role), eq(classes.subjectId, subjectId)))
            .groupBy(...groupByFields)
            .orderBy(desc(user.createdAt))
            .limit(limitPerPage)
            .offset(offset);

    res.status(200).json({
      data: usersList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error("GET /subjects/:id/users error:", error);
    res.status(500).json({ error: "Failed to fetch subject users" });
  }
});

export default router;