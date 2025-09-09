CREATE TABLE "referencias_profissionais" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposta_id" text NOT NULL,
	"nome_completo" text NOT NULL,
	"cargo_funcao" text NOT NULL,
	"empresa_nome" text NOT NULL,
	"empresa_telefone" text NOT NULL,
	"tempo_conhecimento" text NOT NULL,
	"tipo_relacionamento" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "referencias_profissionais_proposta_id_unique" UNIQUE("proposta_id")
);
--> statement-breakpoint
ALTER TABLE "referencias_profissionais" ADD CONSTRAINT "referencias_profissionais_proposta_id_propostas_id_fk" FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas"("id") ON DELETE cascade ON UPDATE no action;