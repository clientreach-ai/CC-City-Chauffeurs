CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'editor' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiry_service_option" (
	"value" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_item" (
	"id" text PRIMARY KEY NOT NULL,
	"image" jsonb NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"vehicle_id" text,
	"row_id" text NOT NULL,
	"category" text DEFAULT 'vehicles' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_item_service" (
	"gallery_item_id" text NOT NULL,
	"service_id" text NOT NULL,
	CONSTRAINT "gallery_item_service_gallery_item_id_service_id_pk" PRIMARY KEY("gallery_item_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "gallery_row" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_section" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"headline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"standfirst" text DEFAULT '' NOT NULL,
	"hero_image" jsonb,
	"facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"detail" jsonb DEFAULT '{"heading":"","paragraphs":[],"image":null}'::jsonb NOT NULL,
	"gallery" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking" jsonb DEFAULT '{"needs":[],"note":""}'::jsonb NOT NULL,
	"enquiry" jsonb DEFAULT '{"heading":"","ctaLabel":"Request a quote"}'::jsonb NOT NULL,
	"seo" jsonb DEFAULT '{"title":"","description":""}'::jsonb NOT NULL,
	"template" text DEFAULT 'index' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_vehicle" (
	"service_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "service_vehicle_service_id_vehicle_id_pk" PRIMARY KEY("service_id","vehicle_id")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"business" jsonb NOT NULL,
	"contact" jsonb NOT NULL,
	"booking" jsonb NOT NULL,
	"social" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo" jsonb NOT NULL,
	"footer" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonial" (
	"id" text PRIMARY KEY NOT NULL,
	"quote" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"district" text DEFAULT '' NOT NULL,
	"service_id" text,
	"date" text DEFAULT '' NOT NULL,
	"permission" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet_category" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"src" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"filename" text NOT NULL,
	"origin" text DEFAULT 'local' NOT NULL,
	"bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"make" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"specs" jsonb DEFAULT '{"passengers":null,"luggage":"","year":null,"transmission":"","bodyType":""}'::jsonb NOT NULL,
	"availability" text DEFAULT 'chauffeur' NOT NULL,
	"ownership" text DEFAULT 'unconfirmed' NOT NULL,
	"suited_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing" jsonb DEFAULT '{"hourlyRate":null,"dayRate":null,"airportNote":"","notes":""}'::jsonb NOT NULL,
	"images" jsonb DEFAULT '{"main":null,"gallery":[]}'::jsonb NOT NULL,
	"seo" jsonb DEFAULT '{"title":"","description":"","shareImage":null}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_category" (
	"vehicle_id" text NOT NULL,
	"category_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vehicle_category_vehicle_id_category_id_pk" PRIMARY KEY("vehicle_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "vehicle_feature" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_feature_link" (
	"vehicle_id" text NOT NULL,
	"feature_id" text NOT NULL,
	CONSTRAINT "vehicle_feature_link_vehicle_id_feature_id_pk" PRIMARY KEY("vehicle_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "activity_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"enquiry_id" text,
	"booking_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"customer_id" text,
	"enquiry_id" text,
	"service" text DEFAULT '' NOT NULL,
	"vehicle_id" text,
	"date" text NOT NULL,
	"time" text DEFAULT '' NOT NULL,
	"pickup" text DEFAULT '' NOT NULL,
	"destination" text DEFAULT '' NOT NULL,
	"passengers" integer,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'private' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiry" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"customer_id" text,
	"contact" jsonb NOT NULL,
	"source" text DEFAULT 'website' NOT NULL,
	"reply_by" text DEFAULT 'whatsapp' NOT NULL,
	"journey" jsonb NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"lost_reason" text,
	"quote" jsonb,
	"booking_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiry_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "enquiry_note" (
	"id" text PRIMARY KEY NOT NULL,
	"enquiry_id" text NOT NULL,
	"body" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_item" ADD CONSTRAINT "gallery_item_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_item" ADD CONSTRAINT "gallery_item_row_id_gallery_row_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."gallery_row"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_item_service" ADD CONSTRAINT "gallery_item_service_gallery_item_id_gallery_item_id_fk" FOREIGN KEY ("gallery_item_id") REFERENCES "public"."gallery_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_item_service" ADD CONSTRAINT "gallery_item_service_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_vehicle" ADD CONSTRAINT "service_vehicle_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_vehicle" ADD CONSTRAINT "service_vehicle_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_category" ADD CONSTRAINT "vehicle_category_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_category" ADD CONSTRAINT "vehicle_category_category_id_fleet_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fleet_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_feature_link" ADD CONSTRAINT "vehicle_feature_link_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_feature_link" ADD CONSTRAINT "vehicle_feature_link_feature_id_vehicle_feature_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."vehicle_feature"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_entry" ADD CONSTRAINT "activity_entry_enquiry_id_enquiry_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_entry" ADD CONSTRAINT "activity_entry_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_enquiry_id_enquiry_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_note" ADD CONSTRAINT "enquiry_note_enquiry_id_enquiry_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "gallery_item_status_idx" ON "gallery_item" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gallery_item_row_idx" ON "gallery_item" USING btree ("row_id");--> statement-breakpoint
CREATE INDEX "homepage_section_position_idx" ON "homepage_section" USING btree ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "service_slug_uidx" ON "service" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "service_status_idx" ON "service" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_vehicle_vehicle_idx" ON "service_vehicle" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "testimonial_status_idx" ON "testimonial" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "fleet_category_slug_uidx" ON "fleet_category" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_slug_uidx" ON "vehicle" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "vehicle_status_idx" ON "vehicle" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicle_category_category_idx" ON "vehicle_category" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "activity_enquiry_idx" ON "activity_entry" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "activity_booking_idx" ON "activity_entry" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_status_idx" ON "booking" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_date_idx" ON "booking" USING btree ("date");--> statement-breakpoint
CREATE INDEX "booking_customer_idx" ON "booking" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_email_idx" ON "customer" USING btree ("email");--> statement-breakpoint
CREATE INDEX "enquiry_status_idx" ON "enquiry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enquiry_created_idx" ON "enquiry" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "enquiry_customer_idx" ON "enquiry" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "enquiry_note_enquiry_idx" ON "enquiry_note" USING btree ("enquiry_id");