import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Download, Save, Eye, X, Copy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CoordinatePoint {
  id: string;
  x: number;
  y: number;
  page: number;
  fieldName: string;
  label: string;
  fontSize: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  maxWidth?: number;
}

interface TemplateInfo {
  pageCount: number;
  pages: Array<{
    pageNumber: number;
    width: number;
    height: number;
  }>;
}

export default function CoordinateMapper() {
  const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [coordinates, setCoordinates] = useState<CoordinatePoint[]>([]);
  const [selectedCoordinate, setSelectedCoordinate] = useState<CoordinatePoint | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [pdfScale, setPdfScale] = useState(1);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  
  // Form fields for new coordinate
  const [newField, setNewField] = useState({
    fieldName: '',
    label: '',
    fontSize: 12,
    bold: false,
    align: 'left' as const,
    maxWidth: 0
  });

  const fieldSuggestions = [
    { name: 'numeroCCB', label: 'Número CCB', page: 1, fontSize: 12, bold: true, align: 'right' as const },
    { name: 'dataEmissao', label: 'Data Emissão', page: 1, fontSize: 10, bold: false, align: 'right' as const },
    { name: 'nomeCliente', label: 'Nome Cliente', page: 1, fontSize: 14, bold: true, align: 'center' as const },
    { name: 'cpfCliente', label: 'CPF Cliente', page: 1, fontSize: 12, bold: false, align: 'center' as const },
    { name: 'valorTotalFinanciado', label: 'Valor Financiado', page: 1, fontSize: 16, bold: true, align: 'center' as const },
    { name: 'numeroParcelas', label: 'Número de Parcelas', page: 1, fontSize: 12, bold: false, align: 'center' as const },
    { name: 'valorParcela', label: 'Valor da Parcela', page: 1, fontSize: 12, bold: false, align: 'center' as const },
    { name: 'nomeCompleto', label: 'Nome Completo', page: 2, fontSize: 12, bold: false, align: 'left' as const },
    { name: 'cpf', label: 'CPF', page: 2, fontSize: 11, bold: false, align: 'left' as const },
    { name: 'rg', label: 'RG', page: 2, fontSize: 11, bold: false, align: 'left' as const },
    { name: 'dataNascimento', label: 'Data Nascimento', page: 2, fontSize: 11, bold: false, align: 'left' as const },
    { name: 'estadoCivil', label: 'Estado Civil', page: 2, fontSize: 11, bold: false, align: 'left' as const },
    { name: 'enderecoResidencial', label: 'Endereço', page: 2, fontSize: 10, bold: false, align: 'left' as const, maxWidth: 400 },
    { name: 'telefoneContato', label: 'Telefone', page: 2, fontSize: 11, bold: false, align: 'left' as const },
    { name: 'email', label: 'Email', page: 2, fontSize: 11, bold: false, align: 'left' as const },
  ];

  useEffect(() => {
    fetchTemplateInfo();
  }, []);

  const fetchTemplateInfo = async () => {
    try {
      const response = await fetch('/api/ccb-diagnostics/template-info');
      const data = await response.json();
      setTemplateInfo(data.template);
    } catch (error) {
      console.error('Erro ao buscar informações do template:', error);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !templateInfo) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / pdfScale;
    const y = (event.clientY - rect.top) / pdfScale;
    
    // Converter coordenadas da tela para coordenadas PDF (Y invertido)
    const currentPageInfo = templateInfo.pages.find(p => p.pageNumber === currentPage);
    if (!currentPageInfo) return;
    
    const pdfX = x;
    const pdfY = currentPageInfo.height - y; // Inverter Y para coordenadas PDF

    if (newField.fieldName && newField.label) {
      const newCoordinate: CoordinatePoint = {
        id: `${newField.fieldName}-${Date.now()}`,
        x: Math.round(pdfX),
        y: Math.round(pdfY),
        page: currentPage,
        fieldName: newField.fieldName,
        label: newField.label,
        fontSize: newField.fontSize,
        bold: newField.bold,
        align: newField.align,
        maxWidth: newField.maxWidth > 0 ? newField.maxWidth : undefined
      };

      setCoordinates(prev => [...prev, newCoordinate]);
      
      // Reset form
      setNewField({
        fieldName: '',
        label: '',
        fontSize: 12,
        bold: false,
        align: 'left',
        maxWidth: 0
      });
    }
  };

  const removeCoordinate = (id: string) => {
    setCoordinates(prev => prev.filter(c => c.id !== id));
    if (selectedCoordinate?.id === id) {
      setSelectedCoordinate(null);
    }
  };

  const exportCoordinates = () => {
    const grouped = coordinates.reduce((acc, coord) => {
      if (!acc[coord.page]) {
        acc[coord.page] = {};
      }
      
      acc[coord.page][coord.fieldName] = {
        x: coord.x,
        y: coord.y,
        fontSize: coord.fontSize,
        bold: coord.bold,
        align: coord.align,
        ...(coord.maxWidth && { maxWidth: coord.maxWidth })
      };
      
      return acc;
    }, {} as Record<number, Record<string, any>>);

    const exportData = `// Coordenadas mapeadas automaticamente
export const ccbCoordinates = {
${Object.entries(grouped).map(([page, fields]) => `  page${page}: {
${Object.entries(fields).map(([fieldName, config]) => 
  `    ${fieldName}: ${JSON.stringify(config, null, 6).replace(/^\s{6}/gm, '    ')}`
).join(',\n')}
  }`).join(',\n')}
};`;

    const blob = new Blob([exportData], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ccbCoordinates-mapped.ts';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadFieldSuggestion = (suggestion: typeof fieldSuggestions[0]) => {
    setNewField({
      fieldName: suggestion.name,
      label: suggestion.label,
      fontSize: suggestion.fontSize,
      bold: suggestion.bold,
      align: suggestion.align as 'left' | 'center' | 'right',
      maxWidth: suggestion.maxWidth || 0
    });
    setCurrentPage(suggestion.page);
  };

  const currentPageCoords = coordinates.filter(c => c.page === currentPage);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Mapeador Interativo de Coordenadas CCB</h1>
        <p className="text-muted-foreground">
          Clique no template para posicionar campos automaticamente
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Painel de Controles */}
        <div className="lg:col-span-1 space-y-4">
          {/* Seletor de Página */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Controles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Página Atual</Label>
                <Select value={currentPage.toString()} onValueChange={(v) => setCurrentPage(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateInfo?.pages.map(page => (
                      <SelectItem key={page.pageNumber} value={page.pageNumber.toString()}>
                        Página {page.pageNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={showGrid ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowGrid(!showGrid)}
                >
                  Grade: {showGrid ? "ON" : "OFF"}
                </Button>
              </div>

              <div>
                <Label>Zoom: {Math.round(pdfScale * 100)}%</Label>
                <Input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={pdfScale}
                  onChange={(e) => setPdfScale(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Novo Campo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Novo Campo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nome do Campo</Label>
                <Input
                  value={newField.fieldName}
                  onChange={(e) => setNewField(prev => ({ ...prev, fieldName: e.target.value }))}
                  placeholder="Ex: numeroCCB"
                />
              </div>

              <div>
                <Label>Label</Label>
                <Input
                  value={newField.label}
                  onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Ex: Número da CCB"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tamanho</Label>
                  <Input
                    type="number"
                    value={newField.fontSize}
                    onChange={(e) => setNewField(prev => ({ ...prev, fontSize: Number(e.target.value) }))}
                    min="8"
                    max="24"
                  />
                </div>

                <div>
                  <Label>Alinhamento</Label>
                  <Select value={newField.align} onValueChange={(v: any) => setNewField(prev => ({ ...prev, align: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Esquerda</SelectItem>
                      <SelectItem value="center">Centro</SelectItem>
                      <SelectItem value="right">Direita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bold"
                  checked={newField.bold}
                  onChange={(e) => setNewField(prev => ({ ...prev, bold: e.target.checked }))}
                />
                <Label htmlFor="bold">Negrito</Label>
              </div>

              <div>
                <Label>Largura Máxima (opcional)</Label>
                <Input
                  type="number"
                  value={newField.maxWidth}
                  onChange={(e) => setNewField(prev => ({ ...prev, maxWidth: Number(e.target.value) }))}
                  placeholder="0 = sem limite"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Preencha os campos e clique no template onde deseja posicionar
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Sugestões */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Campos Sugeridos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fieldSuggestions.slice(0, 6).map((suggestion) => (
                  <Button
                    key={suggestion.name}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => loadFieldSuggestion(suggestion)}
                  >
                    <Badge variant="outline" className="mr-2 text-xs">P{suggestion.page}</Badge>
                    {suggestion.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visualizador do Template */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Template - Página {currentPage}</CardTitle>
              <div className="text-xs text-muted-foreground">
                {templateInfo?.pages.find(p => p.pageNumber === currentPage) && (
                  <>Dimensões: {templateInfo.pages.find(p => p.pageNumber === currentPage)?.width} x {templateInfo.pages.find(p => p.pageNumber === currentPage)?.height} pontos</>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative border rounded overflow-auto" style={{ height: '70vh' }}>
                <div ref={pdfRef} className="relative">
                  <canvas
                    ref={canvasRef}
                    width={595.5 * pdfScale}
                    height={842.25 * pdfScale}
                    className="border cursor-crosshair"
                    onClick={handleCanvasClick}
                    style={{
                      backgroundImage: `url(/api/ccb-diagnostics/generate-grid?page=${currentPage})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                  
                  {/* Overlay de coordenadas */}
                  {currentPageCoords.map((coord) => (
                    <div
                      key={coord.id}
                      className="absolute w-2 h-2 bg-red-500 rounded-full cursor-pointer border-2 border-white shadow"
                      style={{
                        left: (coord.x * pdfScale) - 4,
                        top: ((templateInfo?.pages.find(p => p.pageNumber === currentPage)?.height || 842.25) - coord.y) * pdfScale - 4,
                        transform: 'translate(-50%, -50%)'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCoordinate(coord);
                      }}
                      title={`${coord.label} (${coord.x}, ${coord.y})`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Coordenadas */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Coordenadas Mapeadas</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={exportCoordinates} disabled={coordinates.length === 0}>
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {coordinates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma coordenada mapeada</p>
                ) : (
                  coordinates.map((coord) => (
                    <div
                      key={coord.id}
                      className={`p-2 border rounded cursor-pointer text-xs ${
                        selectedCoordinate?.id === coord.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedCoordinate(coord)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{coord.label}</div>
                          <div className="text-muted-foreground">
                            P{coord.page}: ({coord.x}, {coord.y})
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCoordinate(coord.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {coordinates.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-2">
                    Total: {coordinates.length} campos mapeados
                  </div>
                  <Button 
                    onClick={exportCoordinates}
                    className="w-full" 
                    size="sm"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Exportar Coordenadas
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}