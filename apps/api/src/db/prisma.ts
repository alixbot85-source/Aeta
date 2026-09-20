import { Pool, type PoolClient } from "pg";
import { env } from "../config/env.js";

// Lightweight PostgreSQL data mapper used by the API runtime. The Prisma schema and migrations
// remain the source of truth for the relational model, but this mapper avoids shipping generated
// Prisma client artifacts/API keys in the repository and works in constrained sandboxes.
type Json = unknown;
type Where = Record<string, unknown>;
type Args = { where?: Where; data?: Record<string, unknown>; include?: Record<string, unknown>; select?: Record<string, boolean>; orderBy?: Record<string, "asc" | "desc">; take?: number };

const tableByModel: Record<string, string> = {
  user: "User",
  session: "Session",
  emailVerificationToken: "EmailVerificationToken",
  passwordResetToken: "PasswordResetToken",
  workspace: "Workspace",
  workspaceMember: "WorkspaceMember",
  project: "Project",
  file: "File",
  folder: "Folder",
  conversation: "Conversation",
  message: "Message",
  agentTask: "AgentTask",
  agentToolCall: "AgentToolCall",
  pendingChange: "PendingChange",
  terminalSession: "TerminalSession",
  gitRepository: "GitRepository",
  apiKey: "ApiKey",
  subscription: "Subscription",
  auditLog: "AuditLog",
  changeHistory: "ChangeHistory",
  aIUsageLog: "AIUsageLog"
};

const jsonColumns = new Set(["settings", "env", "metadata", "input", "output"]);

class PgMapper {
  private pool?: Pool;
  readonly user = new Delegate(this, "user");
  readonly session = new Delegate(this, "session");
  readonly emailVerificationToken = new Delegate(this, "emailVerificationToken");
  readonly passwordResetToken = new Delegate(this, "passwordResetToken");
  readonly workspace = new WorkspaceDelegate(this);
  readonly workspaceMember = new Delegate(this, "workspaceMember");
  readonly project = new Delegate(this, "project");
  readonly file = new Delegate(this, "file");
  readonly folder = new Delegate(this, "folder");
  readonly conversation = new Delegate(this, "conversation");
  readonly message = new Delegate(this, "message");
  readonly agentTask = new Delegate(this, "agentTask");
  readonly agentToolCall = new Delegate(this, "agentToolCall");
  readonly pendingChange = new Delegate(this, "pendingChange");
  readonly terminalSession = new Delegate(this, "terminalSession");
  readonly gitRepository = new Delegate(this, "gitRepository");
  readonly apiKey = new Delegate(this, "apiKey");
  readonly subscription = new Delegate(this, "subscription");
  readonly auditLog = new Delegate(this, "auditLog");
  readonly changeHistory = new Delegate(this, "changeHistory");
  readonly aIUsageLog = new Delegate(this, "aIUsageLog");

  getPool(): Pool {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required for database operations.");
    this.pool ??= new Pool({ connectionString: env.DATABASE_URL });
    return this.pool;
  }

  async query<T = Record<string, unknown>>(sql: string, values: unknown[] = [], client?: PoolClient): Promise<T[]> {
    const result = await (client ?? this.getPool()).query(sql, values);
    return result.rows as T[];
  }

  async $transaction<T>(operations: Array<Promise<T>>): Promise<T[]> {
    // Call sites pass already-created promises. They execute real DB writes; Promise.all preserves
    // Prisma-compatible ergonomics for this API surface. Multi-statement atomicity is implemented
    // in custom delegates for nested create flows that need it.
    return Promise.all(operations);
  }

  async $disconnect(): Promise<void> {
    await this.pool?.end();
  }
}

class Delegate {
  constructor(protected readonly db: PgMapper, protected readonly model: string) {}
  protected table() { return tableByModel[this.model]; }

  async findUnique(args: Args): Promise<any | null> {
    const rows = await this.findMany({ ...args, take: 1 });
    return rows[0] ?? null;
  }

  async findMany(args: Args = {}): Promise<any[]> {
    const values: unknown[] = [];
    const whereSql = whereToSql(args.where, values);
    const order = args.orderBy ? orderToSql(args.orderBy) : "";
    const limit = args.take ? ` LIMIT ${Number(args.take)}` : "";
    const rows = await this.db.query(`SELECT * FROM ${q(this.table())}${whereSql}${order}${limit}`, values);
    const enriched = await Promise.all(rows.map((row) => this.enrich(row, args.include)));
    return enriched.map((row) => applySelect(row, args.select));
  }

  async create(args: Args): Promise<any> {
    const data = cleanData(args.data ?? {});
    const columns = Object.keys(data);
    const values = columns.map((column) => encodeValue(column, data[column]));
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const rows = await this.db.query(`INSERT INTO ${q(this.table())} (${columns.map(q).join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`, values);
    return applySelect(await this.enrich(rows[0], args.include), args.select);
  }

  async update(args: Args): Promise<any> {
    const data = cleanData(args.data ?? {});
    const values: unknown[] = [];
    const assignments = Object.entries(data).map(([key, value]) => `${q(key)} = $${values.push(encodeValue(key, value))}`);
    if (!assignments.length) assignments.push(`${q("updatedAt")} = CURRENT_TIMESTAMP`);
    else if (await hasUpdatedAt(this.table())) assignments.push(`${q("updatedAt")} = CURRENT_TIMESTAMP`);
    const whereSql = whereToSql(args.where, values);
    const rows = await this.db.query(`UPDATE ${q(this.table())} SET ${assignments.join(", ")}${whereSql} RETURNING *`, values);
    return applySelect(await this.enrich(rows[0], args.include), args.select);
  }

  async updateMany(args: Args): Promise<{ count: number }> {
    const data = cleanData(args.data ?? {});
    const values: unknown[] = [];
    const assignments = Object.entries(data).map(([key, value]) => `${q(key)} = $${values.push(encodeValue(key, value))}`);
    if (!assignments.length) return { count: 0 };
    const whereSql = whereToSql(args.where, values);
    const rows = await this.db.query(`UPDATE ${q(this.table())} SET ${assignments.join(", ")}${whereSql} RETURNING "id"`, values);
    return { count: rows.length };
  }

  async delete(args: Args): Promise<any> {
    const values: unknown[] = [];
    const whereSql = whereToSql(args.where, values);
    const rows = await this.db.query(`DELETE FROM ${q(this.table())}${whereSql} RETURNING *`, values);
    return rows[0];
  }

  async deleteMany(args: Args): Promise<{ count: number }> {
    const values: unknown[] = [];
    const whereSql = whereToSql(args.where, values);
    const rows = await this.db.query(`DELETE FROM ${q(this.table())}${whereSql} RETURNING "id"`, values);
    return { count: rows.length };
  }

  async upsert(args: Args & { create: Record<string, unknown>; update: Record<string, unknown> }): Promise<any> {
    const existing = await this.findUnique({ where: args.where });
    if (existing) return this.update({ where: args.where, data: args.update });
    return this.create({ data: args.create });
  }

  protected async enrich(row: any, include?: Record<string, unknown>): Promise<any> {
    if (!row || !include) return row;
    if (this.model === "workspaceMember") {
      if (include.workspace) row.workspace = await prisma.workspace.findUnique({ where: { id: row.workspaceId }, ...(typeof include.workspace === "object" ? include.workspace as object : {}) });
      if (include.user) row.user = await prisma.user.findUnique({ where: { id: row.userId }, ...(typeof include.user === "object" ? include.user as object : {}) });
    }
    if (this.model === "workspace") {
      if (include.projects) row.projects = await prisma.project.findMany({ where: { workspaceId: row.id } });
      if (include.members) row.members = await prisma.workspaceMember.findMany({ where: { workspaceId: row.id } });
    }
    if (this.model === "agentTask") {
      if (include.pendingChanges) row.pendingChanges = await prisma.pendingChange.findMany({ where: { taskId: row.id } });
      if (include.toolCalls) row.toolCalls = await prisma.agentToolCall.findMany({ where: { taskId: row.id } });
    }
    return row;
  }
}

class WorkspaceDelegate extends Delegate {
  constructor(db: PgMapper) { super(db, "workspace"); }

  override async create(args: Args): Promise<any> {
    const data = args.data ?? {};
    const nestedMembers = (data.members as any)?.create;
    const nestedProjects = (data.projects as any)?.create;
    const workspaceData = cleanData({ ...data });
    delete workspaceData.members;
    delete workspaceData.projects;
    const client = await this.db.getPool().connect();
    try {
      await client.query("BEGIN");
      const columns = Object.keys(workspaceData);
      const values = columns.map((column) => encodeValue(column, workspaceData[column]));
      const rows = await this.db.query(`INSERT INTO ${q(this.table())} (${columns.map(q).join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`, values, client);
      const workspace = rows[0] as any;
      if (nestedMembers) {
        const members = Array.isArray(nestedMembers) ? nestedMembers : [nestedMembers];
        for (const member of members) await insertRaw(this.db, client, "WorkspaceMember", { ...member, workspaceId: workspace.id });
      }
      if (nestedProjects) {
        const projects = Array.isArray(nestedProjects) ? nestedProjects : [nestedProjects];
        for (const project of projects) await insertRaw(this.db, client, "Project", { ...project, workspaceId: workspace.id });
      }
      await client.query("COMMIT");
      return applySelect(await this.enrich(workspace, args.include), args.select);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function insertRaw(db: PgMapper, client: PoolClient, table: string, data: Record<string, unknown>): Promise<void> {
  const clean = cleanData(data);
  const columns = Object.keys(clean);
  const values = columns.map((column) => encodeValue(column, clean[column]));
  await db.query(`INSERT INTO ${q(table)} (${columns.map(q).join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})`, values, client);
}

function whereToSql(where: Where | undefined, values: unknown[]): string {
  if (!where || !Object.keys(where).length) return "";
  const clauses: string[] = [];
  const expanded = expandCompoundWhere(where);
  for (const [key, value] of Object.entries(expanded)) {
    if (value === undefined) continue;
    if (value === null) clauses.push(`${q(key)} IS NULL`);
    else if (Array.isArray(value)) clauses.push(`${q(key)} = ANY($${values.push(value)})`);
    else clauses.push(`${q(key)} = $${values.push(value)}`);
  }
  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

function expandCompoundWhere(where: Where): Where {
  const result: Where = {};
  for (const [key, value] of Object.entries(where)) {
    if (key.includes("_") && value && typeof value === "object" && !Array.isArray(value)) Object.assign(result, value);
    else result[key] = value;
  }
  return result;
}

function orderToSql(orderBy: Record<string, "asc" | "desc">): string {
  const [key, direction] = Object.entries(orderBy)[0] ?? [];
  return key ? ` ORDER BY ${q(key)} ${String(direction).toUpperCase() === "ASC" ? "ASC" : "DESC"}` : "";
}

function cleanData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function encodeValue(column: string, value: unknown): unknown {
  if (jsonColumns.has(column) && value !== null && value !== undefined) return JSON.stringify(value);
  return value;
}

function applySelect(row: any, select?: Record<string, boolean>): any {
  if (!row || !select) return row;
  return Object.fromEntries(Object.entries(select).filter(([, enabled]) => enabled).map(([key]) => [key, row[key]]));
}

function q(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

const tablesWithUpdatedAt = new Set(["User", "Workspace", "Project", "File", "Folder", "Conversation", "AgentTask", "PendingChange", "GitRepository", "ApiKey", "Subscription"]);
async function hasUpdatedAt(table: string): Promise<boolean> { return tablesWithUpdatedAt.has(table); }

export const prisma = new PgMapper();
