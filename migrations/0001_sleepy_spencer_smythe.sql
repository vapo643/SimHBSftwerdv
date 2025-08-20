ALTER TYPE "public"."status" ADD VALUE 'aguardando_analise' BEFORE 'aprovado';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'em_analise' BEFORE 'aprovado';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'pendente' BEFORE 'aprovado';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'pendenciado' BEFORE 'aprovado';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'aguardando_aceite_atendente' BEFORE 'CCB_GERADA';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'aceito_atendente' BEFORE 'CCB_GERADA';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'ASSINATURA_PENDENTE' BEFORE 'ASSINATURA_CONCLUIDA';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'documentos_enviados' BEFORE 'BOLETOS_EMITIDOS';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'contratos_preparados' BEFORE 'BOLETOS_EMITIDOS';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'em_formalizacao' BEFORE 'BOLETOS_EMITIDOS';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'contratos_assinados' BEFORE 'BOLETOS_EMITIDOS';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'assinado' BEFORE 'BOLETOS_EMITIDOS';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'PAGAMENTO_PENDENTE' BEFORE 'pagamento_autorizado';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'PAGAMENTO_PARCIAL' BEFORE 'pagamento_autorizado';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'INADIMPLENTE' BEFORE 'pagamento_autorizado';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'QUITADO' BEFORE 'pagamento_autorizado';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'pronto_pagamento' BEFORE 'pagamento_autorizado';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'pago' BEFORE 'suspensa';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'cancelado' BEFORE 'suspensa';--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "cliente_empresa_nome" text;--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "cliente_empresa_cnpj" text;--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "cliente_cargo_funcao" text;--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "cliente_tempo_emprego" text;--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "cliente_renda_comprovada" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "cliente_dividas_existentes" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "cliente_comprometimento_renda" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "cliente_score_serasa" integer;--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "cliente_restricoes_cpf" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "propostas" ADD CONSTRAINT "check_comprometimento_renda" CHECK ("cliente_comprometimento_renda" >= 0 AND "cliente_comprometimento_renda" <= 100.00);