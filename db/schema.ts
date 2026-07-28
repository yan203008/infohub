import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    type: text("type", {
      enum: ["youtube", "podcast", "daily", "builder", "wechat"],
    }).notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("sources_url_idx").on(table.url)],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const contents = sqliteTable(
  "contents",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull().default(""),
    keywords: text("keywords", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    status: text("status", {
      enum: ["pending", "processing", "ready", "retry"],
    })
      .notNull()
      .default("pending"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("contents_source_external_idx").on(
      table.sourceId,
      table.externalId,
    ),
  ],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    contentId: text("content_id")
      .notNull()
      .references(() => contents.id),
    body: text("body").notNull().default(""),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("notes_owner_content_idx").on(table.userEmail, table.contentId),
  ],
);

export const highlights = sqliteTable("highlights", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  exactText: text("exact_text").notNull(),
  prefix: text("prefix").notNull().default(""),
  suffix: text("suffix").notNull().default(""),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  color: text("color", { enum: ["yellow", "green", "red"] })
    .notNull()
    .default("yellow"),
  comment: text("comment").notNull().default(""),
  anchorStatus: text("anchor_status", {
    enum: ["anchored", "unanchored"],
  })
    .notNull()
    .default("anchored"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const readingProgress = sqliteTable(
  "reading_progress",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    contentId: text("content_id")
      .notNull()
      .references(() => contents.id),
    progress: integer("progress").notNull().default(0),
    scrollOffset: integer("scroll_offset").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("progress_owner_content_idx").on(
      table.userEmail,
      table.contentId,
    ),
  ],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email"),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("push_endpoint_idx").on(table.endpoint)],
);

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  r2Key: text("r2_key").notNull(),
  status: text("status", {
    enum: ["uploaded", "processing", "ready", "failed"],
  })
    .notNull()
    .default("uploaded"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
