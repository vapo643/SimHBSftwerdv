import React from 'react';
import { useRoute } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const AnaliseManual: React.FC = () => {
  const [match, params] = useRoute("/credito/analise/:id");
  const id = params ? params.id : 'Carregando...';

  return (
    <DashboardLayout title={`Painel de Análise: ${id}`}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Coluna da esquerda - mais larga */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-4">Painel de Análise: Proposta {id}</h1>
          <Tabs defaultValue="dados-cadastrais" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados-cadastrais">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="analise-bureaus">Análise de Bureaus</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
            
            <TabsContent value="dados-cadastrais">
              <div className="p-4 border rounded-md mt-4">
                <p>Conteúdo da aba Dados Cadastrais.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="analise-bureaus">
              <div className="p-4 border rounded-md mt-4">
                <p>Conteúdo da aba Análise de Bureaus.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="historico">
              <div className="p-4 border rounded-md mt-4">
                <p>Conteúdo da aba Histórico.</p>
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Seção do Painel de Decisão */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Painel de Decisão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Button>Aprovar Proposta</Button>
                  <Button variant="destructive">Negar Proposta</Button>
                  <Button variant="outline">Pendenciar</Button>
                </div>
                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    rows={4}
                    placeholder="Adicione observações sobre a decisão..."
                  />
                </div>
                <Button type="submit" className="w-full">
                  Confirmar Decisão
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Coluna da direita - mais estreita */}
        <div className="w-full lg:w-1/3">
           <Card>
            <CardHeader>
              <CardTitle>Visualizador de Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Conteúdo do visualizador de documentos.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AnaliseManual;