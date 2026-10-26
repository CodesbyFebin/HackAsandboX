import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", {id:text("id").primaryKey(), owner:text("owner").notNull(), kind:text("kind").notNull(), body:text("body").notNull(), created:text("created").notNull(), deleted:text("deleted")},table=>[index("records_owner_kind").on(table.owner,table.kind),index("records_kind_deleted").on(table.kind,table.deleted)]);
export const catalogEntries = sqliteTable("catalog_entries", {url:text("url").primaryKey(),body:text("body").notNull(),seen:text("seen").notNull()});
export const syncState = sqliteTable("sync_state", {id:text("id").primaryKey(),body:text("body").notNull(),updated:text("updated").notNull()});
