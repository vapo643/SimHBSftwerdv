ALTER TABLE "gerente_lojas" DROP CONSTRAINT "gerente_lojas_gerente_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "gerente_lojas" ALTER COLUMN "gerente_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "tac_ativa_para_clientes_existentes" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "gerente_lojas" ADD CONSTRAINT "gerente_lojas_gerente_id_profiles_id_fk" FOREIGN KEY ("gerente_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "deleted_at";