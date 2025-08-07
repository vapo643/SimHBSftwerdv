/**
 * Field Positioner Page - Intuitive drag-and-drop field positioning for CCB templates
 */

import React from 'react';
import DragDropFieldPositioner from '@/components/DragDropFieldPositioner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Lightbulb } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const FieldPositioner: React.FC = () => {
  const handleSave = async (positions: any[]) => {
    try {
      console.log('Saving positions:', positions);
      // Here you could save to the server or update the ccbCoordinates.ts file
    } catch (error) {
      console.error('Error saving positions:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Posicionamento Visual de Campos CCB</h1>
        <p className="text-muted-foreground">
          Interface intuitiva de arrastar e soltar para posicionar campos no template CCB
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Como usar:</strong> Clique em "Adicionar Campo", arraste para posicionar, 
              ajuste propriedades no painel lateral, e exporte as coordenadas quando terminar.
            </AlertDescription>
          </Alert>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Dicas de Uso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 border rounded">
                  <h4 className="font-medium mb-2">1. Adicionar Campos</h4>
                  <p className="text-muted-foreground">
                    Use os botões predefinidos ou digite um nome personalizado para criar novos campos
                  </p>
                </div>
                <div className="p-4 border rounded">
                  <h4 className="font-medium mb-2">2. Posicionar</h4>
                  <p className="text-muted-foreground">
                    Clique e arraste os campos amarelos para posicioná-los no template
                  </p>
                </div>
                <div className="p-4 border rounded">
                  <h4 className="font-medium mb-2">3. Exportar</h4>
                  <p className="text-muted-foreground">
                    Baixe o arquivo JSON com todas as coordenadas no formato correto para o sistema
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DragDropFieldPositioner
        pageHeight={842.25}
        pageWidth={595.5}
        onSave={handleSave}
      />
    </div>
  );
};

export default FieldPositioner;