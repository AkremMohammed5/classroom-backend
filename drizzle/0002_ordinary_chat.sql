CREATE TABLE IF NOT EXISTS "cars" (
	"id" serial PRIMARY KEY NOT NULL,
	"make" varchar(255) NOT NULL,
	"model" text NOT NULL,
	"year" varchar(4) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"time" timestamp DEFAULT now()
);
