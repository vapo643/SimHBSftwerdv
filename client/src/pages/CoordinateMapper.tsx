/**
 * Página para testar e mapear coordenadas CCB
 * Interface visual para debug das coordenadas
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Download, TestTube, Map, BookOpen } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const CoordinateMapper: React.FC = () => {
  const [singleTest, setSingleTest] = useState({
    x: '',
    y: '',
    testText: 'TESTE',
    page: '1'
  });

  const [multipleTest, setMultipleTest] = useState('');
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState(null);

  const testSingleCoordinate = async () => {
    if (!singleTest.x || !singleTest.y) {
      alert('Digite as coordenadas X e Y');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ccb-debug/test-single-coordinate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(singleTest)
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coordinate-test-${singleTest.x}-${singleTest.y}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Erro ao testar coordenada');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao testar coordenada');
    } finally {
      setLoading(false);
    }
  };

  const testMultipleCoordinates = async () => {
    if (!multipleTest.trim()) {
      alert('Digite as coordenadas no formato JSON');
      return;
    }

    try {
      const coordinates = JSON.parse(multipleTest);
      
      setLoading(true);
      const response = await fetch('/api/ccb-debug/test-multiple-coordinates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'multiple-coordinates-test.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Erro ao testar coordenadas');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro no formato JSON ou ao testar coordenadas');
    } finally {
      setLoading(false);
    }
  };

  const loadGuide = async () => {
    try {
      const response = await fetch('/api/ccb-debug/coordinate-guide');
      const data = await response.json();
      setGuide(data);
    } catch (error) {
      console.error('Erro ao carregar guia:', error);
    }
  };

  const exampleCoordinates = [
    {
      fieldName: 'nomeCliente',
      x: 150,
      y: 100,
      testText: 'João Silva',
      referenceType: 'left'
    },
    {
      fieldName: 'cpfCliente', 
      x: 300,
      y: 130,
      testText: '123.456.789-01',
      referenceType: 'center'
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Debug de Coordenadas CCB</h1>
        <p className="text-muted-foreground">
          Ferramentas para testar e ajustar o posicionamento dos campos no template CCB
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Sistema de Coordenadas:</strong> Origine no canto inferior esquerdo (PDF padrão). 
          Y cresce para cima. Use as ferramentas abaixo para testar diferentes interpretações.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teste de Coordenada Única */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Teste de Coordenada Única
            </CardTitle>
            <CardDescription>
              Testa uma coordenada específica com diferentes interpretações (esquerda, centro, direita)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="x">Coordenada X</Label>
                <Input
                  id="x"
                  type="number"
                  value={singleTest.x}
                  onChange={(e) => setSingleTest(prev => ({ ...prev, x: e.target.value }))}
                  placeholder="Ex: 150"
                />
              </div>
              <div>
                <Label htmlFor="y">Coordenada Y</Label>
                <Input
                  id="y"
                  type="number"
                  value={singleTest.y}
                  onChange={(e) => setSingleTest(prev => ({ ...prev, y: e.target.value }))}
                  placeholder="Ex: 100"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="testText">Texto de Teste</Label>
              <Input
                id="testText"
                value={singleTest.testText}
                onChange={(e) => setSingleTest(prev => ({ ...prev, testText: e.target.value }))}
                placeholder="Ex: João Silva"
              />
            </div>

            <div>
              <Label htmlFor="page">Página</Label>
              <Select value={singleTest.page} onValueChange={(value) => setSingleTest(prev => ({ ...prev, page: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Página 1</SelectItem>
                  <SelectItem value="2">Página 2</SelectItem>
                  <SelectItem value="8">Página 8</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={testSingleCoordinate} 
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {loading ? 'Gerando...' : 'Testar e Baixar PDF'}
            </Button>
          </CardContent>
        </Card>

        {/* Teste de Múltiplas Coordenadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Teste de Múltiplas Coordenadas
            </CardTitle>
            <CardDescription>
              Testa várias coordenadas de uma vez usando formato JSON
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="coordinates">Coordenadas (JSON)</Label>
              <Textarea
                id="coordinates"
                value={multipleTest}
                onChange={(e) => setMultipleTest(e.target.value)}
                placeholder={JSON.stringify(exampleCoordinates, null, 2)}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <Button 
              onClick={() => setMultipleTest(JSON.stringify(exampleCoordinates, null, 2))}
              variant="outline"
              className="w-full"
            >
              Carregar Exemplo
            </Button>

            <Button 
              onClick={testMultipleCoordinates} 
              disabled={loading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {loading ? 'Gerando...' : 'Testar Múltiplas Coordenadas'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Guia de Coordenadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Guia de Coordenadas
          </CardTitle>
          <CardDescription>
            Manual completo sobre como usar o sistema de coordenadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!guide ? (
            <Button onClick={loadGuide} variant="outline">
              Carregar Guia
            </Button>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Sistemas de Coordenadas:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded">
                    <h4 className="font-medium">Sistema Visual</h4>
                    <p className="text-sm text-muted-foreground">
                      {guide.systems?.visual?.description}
                    </p>
                    <p className="text-sm"><strong>Origem:</strong> {guide.systems?.visual?.origin}</p>
                    <p className="text-sm"><strong>Direção Y:</strong> {guide.systems?.visual?.yDirection}</p>
                  </div>
                  <div className="p-4 border rounded">
                    <h4 className="font-medium">Sistema PDF</h4>
                    <p className="text-sm text-muted-foreground">
                      {guide.systems?.pdf?.description}
                    </p>
                    <p className="text-sm"><strong>Origem:</strong> {guide.systems?.pdf?.origin}</p>
                    <p className="text-sm"><strong>Direção Y:</strong> {guide.systems?.pdf?.yDirection}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Tipos de Referência:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {guide.referenceTypes && Object.entries(guide.referenceTypes).map(([key, value]) => (
                    <div key={key} className="p-2 bg-muted rounded text-sm">
                      <strong>{key}:</strong> {value as string}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Recomendações:</h3>
                <ul className="text-sm space-y-1">
                  {guide.recommendations && Object.entries(guide.recommendations).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}:</strong> {value as string}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CoordinateMapper;