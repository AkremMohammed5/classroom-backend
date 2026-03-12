ALTER TABLE "users" RENAME COLUMN "email" TO "Email";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_Email_unique" UNIQUE("Email");