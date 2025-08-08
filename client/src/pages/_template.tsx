import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 🎯 TEMPLATE PADRÃO PARA NOVAS PÁGINAS
 *
 * ⚠️  REGRA OBRIGATÓRIA:
 * Para criar qualquer nova página no sistema, SEMPRE copie este arquivo e renomeie-o.
 * NUNCA crie páginas do zero para garantir consistência do layout.
 *
 * ✅ Como usar:
 * 1. Copie este arquivo: cp _template.tsx nova-pagina.tsx
 * 2. Renomeie o componente: MinhaNovaPageTemplate → MinhaNovaPagina
 * 3. Altere o title e substitua o conteúdo dentro de CardContent
 * 4. Mantenha SEMPRE a estrutura DashboardLayout > Card
 */

export default function MinhaNovaPageTemplate() {
  return (
    <DashboardLayout title="Título da Minha Página">
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Título da Seção</CardTitle>
            <CardDescription>Descrição do que esta página faz</CardDescription>
          </CardHeader>
          <CardContent>
            {/* 🔄 SUBSTITUA ESTE CONTEÚDO PELA SUA IMPLEMENTAÇÃO */}
            <div className="py-12 text-center">
              <h3 className="text-lg font-semibold">// O conteúdo da sua página vai aqui</h3>
              <p className="mt-2 text-sm text-gray-500">
                Substitua este placeholder pela implementação da sua funcionalidade
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
