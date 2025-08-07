/**
 * Drag-and-Drop Field Positioning Component for CCB Template
 * Allows intuitive positioning of fields on PDF template
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Save, Download, Plus, Move, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useFieldPositioner } from '@/hooks/useFieldPositioner';
import { useToast } from '@/hooks/use-toast';

interface FieldPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  page: number;
  sampleText: string;
}

interface DragDropFieldPositionerProps {
  templateImageUrl?: string;
  pageHeight?: number;
  pageWidth?: number;
  onSave?: (positions: FieldPosition[]) => void;
}

const DragDropFieldPositioner: React.FC<DragDropFieldPositionerProps> = ({
  templateImageUrl,
  pageHeight = 842.25,
  pageWidth = 595.5,
  onSave
}) => {
  const { positions: loadedPositions, isLoading, savePositions, isSaving } = useFieldPositioner();
  const { toast } = useToast();
  
  const [fields, setFields] = useState<FieldPosition[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [templatePdfUrl, setTemplatePdfUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Load positions on mount
  useEffect(() => {
    if (loadedPositions && loadedPositions.length > 0) {
      setFields(loadedPositions);
    }
  }, [loadedPositions]);

  // Load template PDF URL
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const token = localStorage.getItem('token');
        console.log('🔍 Loading template info with token:', token ? 'Present' : 'Missing');
        
        const response = await fetch('/api/template/template-info', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const info = await response.json();
        
        console.log('📄 Template info response:', info);
        
        if (info.exists) {
          // Use public endpoint for PDF viewing (no auth required)
          setTemplatePdfUrl('/public/template.pdf');
          console.log('✅ Template PDF URL set successfully');
        } else {
          console.warn('❌ Template PDF not found:', info);
        }
      } catch (error) {
        console.error('❌ Error loading template info:', error);
      }
    };

    loadTemplate();
  }, []);

  // Predefined field templates
  const fieldTemplates = [
    { name: 'nomeCliente', sampleText: 'João Silva Santos', fontSize: 11 },
    { name: 'cpfCliente', sampleText: '123.456.789-01', fontSize: 10 },
    { name: 'valorPrincipal', sampleText: 'R$ 10.000,00', fontSize: 12, bold: true },
    { name: 'dataEmissao', sampleText: '15 de Janeiro de 2025', fontSize: 10 },
    { name: 'taxaJuros', sampleText: '2,95%', fontSize: 11, bold: true },
    { name: 'numeroParcelas', sampleText: '24x', fontSize: 10 },
    { name: 'valorParcela', sampleText: 'R$ 542,30', fontSize: 11 },
    { name: 'custoEfetivoTotal', sampleText: '45,67% a.a.', fontSize: 12, bold: true },
  ];

  // Convert visual coordinates to PDF coordinates
  const convertToPDF = useCallback((visualY: number) => {
    return pageHeight - visualY;
  }, [pageHeight]);

  // Convert PDF coordinates to visual coordinates
  const convertToVisual = useCallback((pdfY: number) => {
    return pageHeight - pdfY;
  }, [pageHeight]);

  // Add a new field
  const addField = useCallback((template?: typeof fieldTemplates[0]) => {
    const fieldId = `field_${Date.now()}`;
    const newField: FieldPosition = {
      id: fieldId,
      name: template?.name || newFieldName || `campo_${fields.length + 1}`,
      x: 100,
      y: 100,
      fontSize: template?.fontSize || 11,
      bold: template?.bold || false,
      align: 'left',
      page: currentPage,
      sampleText: template?.sampleText || 'Texto de exemplo'
    };
    
    setFields(prev => [...prev, newField]);
    setSelectedField(fieldId);
    setNewFieldName('');
  }, [newFieldName, fields.length, currentPage]);

  // Remove a field
  const removeField = useCallback((fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (selectedField === fieldId) {
      setSelectedField(null);
    }
  }, [selectedField]);

  // Update field properties
  const updateField = useCallback((fieldId: string, updates: Partial<FieldPosition>) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  }, []);

  // Handle mouse down on field
  const handleMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    setSelectedField(fieldId);
    setIsDragging(true);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - field.x,
        y: e.clientY - rect.top - field.y
      });
    }
  }, [fields]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedField || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 20, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(rect.height - 20, e.clientY - rect.top - dragOffset.y));

    updateField(selectedField, { x, y });
  }, [isDragging, selectedField, dragOffset, updateField]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Save to server and export coordinates
  const exportCoordinates = useCallback(async () => {
    try {
      // Prepare positions for saving
      const positionsForSave = fields.map(field => ({
        ...field,
        y: convertToPDF(field.y) // Convert visual Y to PDF Y for server
      }));

      // Save to server
      await savePositions(positionsForSave);
      
      toast({
        title: "Coordenadas Salvas",
        description: `${fields.length} campos foram salvos com sucesso!`
      });

      // Also download as JSON for backup
      const grouped = fields.reduce((acc, field) => {
        const pageKey = `page${field.page}`;
        if (!acc[pageKey]) acc[pageKey] = {};
        
        acc[pageKey][field.name] = {
          x: Math.round(field.x),
          y: Math.round(convertToPDF(field.y)),
          fontSize: field.fontSize,
          ...(field.bold && { bold: true }),
          ...(field.align !== 'left' && { align: field.align })
        };
        
        return acc;
      }, {} as Record<string, any>);

      const exportData = {
        timestamp: new Date().toISOString(),
        pageHeight,
        pageWidth,
        coordinates: grouped
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ccb-coordinates-backup.json';
      a.click();
      URL.revokeObjectURL(url);

      // Call onSave callback
      onSave?.(fields);
      
    } catch (error) {
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível salvar as coordenadas. Tente novamente.",
        variant: "destructive"
      });
      console.error('Error saving coordinates:', error);
    }
  }, [fields, convertToPDF, pageHeight, pageWidth, onSave, savePositions, toast]);

  // Get fields for current page
  const currentPageFields = fields.filter(f => f.page === currentPage);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Canvas Area */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Template CCB - Página {currentPage}</CardTitle>
              <div className="flex gap-2">
                <Select value={currentPage.toString()} onValueChange={(value) => setCurrentPage(Number(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Página 1</SelectItem>
                    <SelectItem value="2">Página 2</SelectItem>
                    <SelectItem value="8">Página 8</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              ref={canvasRef}
              className="relative border-2 border-dashed border-gray-300 bg-white overflow-hidden"
              style={{ 
                width: '100%', 
                height: `${(pageHeight / pageWidth) * 100}vh`,
                maxHeight: '80vh'
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* PDF Background */}
              {templatePdfUrl ? (
                <div className="absolute inset-0">
                  {/* Try multiple approaches for PDF display */}
                  
                  {/* Primary: iframe approach */}
                  <iframe
                    src={`${templatePdfUrl}#page=${currentPage}&view=FitH&toolbar=0&navpanes=0`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      pointerEvents: 'none',
                      opacity: 0.8,
                      zIndex: 1
                    }}
                    title={`Template CCB - Página ${currentPage}`}
                    onLoad={() => console.log('✅ PDF iframe loaded')}
                    onError={() => console.error('❌ PDF iframe failed')}
                  />

                  {/* Fallback: embed approach */}
                  <embed
                    src={`${templatePdfUrl}#page=${currentPage}&view=FitH&toolbar=0&navpanes=0`}
                    type="application/pdf"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      pointerEvents: 'none',
                      opacity: 0.6,
                      zIndex: 0
                    }}
                    title={`Template CCB Fallback - Página ${currentPage}`}
                  />
                  
                  {/* Debug info and controls */}
                  <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs p-2 rounded space-y-1">
                    <div>PDF: {templatePdfUrl?.split('/').pop()}</div>
                    <div>Página: {currentPage}/8</div>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        className="text-xs px-1 py-0"
                        onClick={() => window.open(templatePdfUrl, '_blank')}
                      >
                        Abrir PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-500 mb-2">Carregando template PDF...</p>
                    <Button 
                      onClick={async () => {
                        const response = await fetch('/api/template/test');
                        const result = await response.json();
                        console.log('Template test result:', result);
                      }}
                      className="text-xs"
                    >
                      Testar PDF
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Overlay for field positioning */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 10
                }}
              >
              {currentPageFields.map((field) => (
                <div
                  key={field.id}
                  className={`absolute cursor-move select-none ${
                    selectedField === field.id 
                      ? 'ring-2 ring-blue-500 bg-blue-100' 
                      : 'bg-yellow-100 hover:bg-yellow-200'
                  }`}
                  style={{
                    left: field.x,
                    top: field.y,
                    fontSize: `${field.fontSize}px`,
                    fontWeight: field.bold ? 'bold' : 'normal',
                    textAlign: field.align,
                    padding: '2px 4px',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    minWidth: '80px',
                    zIndex: 15, // Above PDF but below overlays
                    backgroundColor: selectedField === field.id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(254, 240, 138, 0.9)'
                  }}
                  onMouseDown={(e) => handleMouseDown(e, field.id)}
                  title={`${field.name} (${field.x}, ${Math.round(convertToPDF(field.y))})`}
                >
                  {field.sampleText}
                  <div className="text-xs text-gray-500 mt-1">
                    {field.name}
                  </div>
                </div>
              ))}
              
              {currentPageFields.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500" style={{ zIndex: 20 }}>
                  <div className="text-center bg-white bg-opacity-80 p-4 rounded">
                    <Move className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Arraste campos aqui ou clique em "Adicionar Campo"</p>
                  </div>
                </div>
              )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel */}
      <div className="space-y-4">
        {/* Add Field */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Campos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {fieldTemplates.map((template) => (
                <Button
                  key={template.name}
                  variant="outline"
                  size="sm"
                  onClick={() => addField(template)}
                  className="text-xs"
                >
                  {template.name}
                </Button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                placeholder="Nome do campo"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={() => addField()} disabled={!newFieldName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Field Properties */}
        {selectedField && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Propriedades do Campo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const field = fields.find(f => f.id === selectedField);
                if (!field) return null;

                return (
                  <>
                    <div>
                      <Label>Nome do Campo</Label>
                      <Input
                        value={field.name}
                        onChange={(e) => updateField(field.id, { name: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Texto de Exemplo</Label>
                      <Input
                        value={field.sampleText}
                        onChange={(e) => updateField(field.id, { sampleText: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>X: {field.x}</Label>
                        <Input
                          type="number"
                          value={field.x}
                          onChange={(e) => updateField(field.id, { x: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Y: {Math.round(convertToPDF(field.y))}</Label>
                        <Input
                          type="number"
                          value={field.y}
                          onChange={(e) => updateField(field.id, { y: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Tamanho da Fonte</Label>
                      <Input
                        type="number"
                        min="8"
                        max="20"
                        value={field.fontSize}
                        onChange={(e) => updateField(field.id, { fontSize: Number(e.target.value) })}
                      />
                    </div>

                    <div>
                      <Label>Alinhamento</Label>
                      <Select value={field.align} onValueChange={(value: 'left' | 'center' | 'right') => updateField(field.id, { align: value })}>
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

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="bold"
                        checked={field.bold}
                        onChange={(e) => updateField(field.id, { bold: e.target.checked })}
                      />
                      <Label htmlFor="bold">Negrito</Label>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeField(field.id)}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover Campo
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Field List */}
        <Card>
          <CardHeader>
            <CardTitle>Campos Mapeados ({fields.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={`flex justify-between items-center p-2 rounded cursor-pointer ${
                    selectedField === field.id ? 'bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedField(field.id)}
                >
                  <div>
                    <div className="font-medium text-sm">{field.name}</div>
                    <div className="text-xs text-gray-500">
                      Página {field.page} • ({field.x}, {Math.round(convertToPDF(field.y))})
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {field.fontSize}px
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Exportar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={exportCoordinates} 
              className="w-full" 
              disabled={fields.length === 0 || isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Salvando...' : 'Salvar Coordenadas'}
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              Gera arquivo JSON com todas as coordenadas no formato CCB
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DragDropFieldPositioner;