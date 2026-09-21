import {sqliteTable,text,index} from "drizzle-orm/sqlite-core";
export const polls=sqliteTable('polls',{id:text('id').primaryKey(),data:text('data').notNull()});
export const votes=sqliteTable('votes',{id:text('id').primaryKey(),pollId:text('poll_id').notNull().references(()=>polls.id),editHash:text('edit_hash').notNull(),data:text('data').notNull()},t=>[index('idx_votes_poll').on(t.pollId)]);
