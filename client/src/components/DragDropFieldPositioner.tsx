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

// PDF Upload Component
const PDFUploader: React.FC<{ onPdfUploaded: (url: string) => void }> = ({ onPdfUploaded }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');

    if (!pdfFile) {
      toast({
        title: "Arquivo Inválido",
        description: "Por favor, selecione um arquivo PDF.",
        variant: "destructive"
      });
      return;
    }

    await uploadPdf(pdfFile);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadPdf(file);
    }
  };

  const uploadPdf = async (file: File) => {
    setIsUploading(true);
    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('template', file);

      // Get auth token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Upload to server
      const response = await fetch('/api/pdf-upload/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        // Use the server URL for the uploaded PDF
        onPdfUploaded(result.accessUrl);
        
        toast({
          title: "PDF Carregado",
          description: `${file.name} foi enviado e está pronto para uso!`
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('PDF upload error:', error);
      
      // Fallback to local URL for immediate use
      const tempUrl = URL.createObjectURL(file);
      onPdfUploaded(tempUrl);
      
      toast({
        title: "PDF Carregado (Local)",
        description: `${file.name} carregado localmente. Upload para servidor falhou.`,
        variant: "default"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const loadDefaultTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/template/template-info', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const info = await response.json();
      
      if (info.exists) {
        onPdfUploaded('/public/template.pdf');
        toast({
          title: "Template Carregado",
          description: "Template CCB padrão carregado com sucesso!"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar o template padrão.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="text-center space-y-4 p-8">
      <h3 className="text-lg font-medium text-gray-700">Carregar Template PDF</h3>
      
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
      >
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 text-gray-400">
            📄
          </div>
          
          {isUploading ? (
            <div>
              <p className="text-gray-600">Carregando PDF...</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-600">
                Arraste e solte um arquivo PDF aqui
              </p>
              <p className="text-sm text-gray-500">ou</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Selecionar Arquivo PDF
                </Button>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Default Template Option */}
      <div className="border-t pt-4">
        <p className="text-sm text-gray-500 mb-2">ou use o template padrão:</p>
        <Button 
          variant="outline" 
          onClick={loadDefaultTemplate}
          className="w-full"
        >
          Carregar Template CCB Padrão
        </Button>
      </div>

      {/* Debug Options */}
      <div className="border-t pt-4 space-y-2">
        <p className="text-xs text-gray-400">Debug:</p>
        <div className="flex gap-2 justify-center">
          <Button 
            size="sm" 
            variant="ghost"
            onClick={async () => {
              const response = await fetch('/api/template/test');
              const result = await response.json();
              console.log('Template test:', result);
              toast({ title: "Debug", description: JSON.stringify(result) });
            }}
          >
            Testar API
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => window.open('/public/template.pdf', '_blank')}
          >
            Abrir PDF Direto
          </Button>
        </div>
      </div>
    </div>
  );
};

// PDF Viewer Component with fallbacks
const PDFViewer: React.FC<{
  pdfUrl: string;
  zoom: number;
  currentPage: number;
  onLoadError: () => void;
}> = ({ pdfUrl, zoom, currentPage, onLoadError }) => {
  const [loadMethod, setLoadMethod] = useState<'iframe' | 'object' | 'embed' | 'failed'>('iframe');
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      
      // Try different loading methods in sequence
      if (loadMethod === 'iframe') {
        setLoadMethod('object');
      } else if (loadMethod === 'object') {
        setLoadMethod('embed');
      } else if (loadMethod === 'embed') {
        setLoadMethod('failed');
        onLoadError();
      }
    }
  };

  // Reset error state when URL changes
  React.useEffect(() => {
    setHasError(false);
    setLoadMethod('iframe');
  }, [pdfUrl]);

  const commonStyles = {
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
    width: `${100 / zoom}%`,
    height: `${100 / zoom}%`
  };

  if (loadMethod === 'iframe') {
    return (
      <iframe
        src={`${pdfUrl}#page=${currentPage}`}
        className="w-full h-full border-0"
        style={commonStyles}
        title={`Template CCB - Página ${currentPage}`}
        onError={handleError}
        onLoad={() => console.log('📄 Iframe loaded successfully')}
      />
    );
  }

  if (loadMethod === 'object') {
    return (
      <object
        data={`${pdfUrl}#page=${currentPage}`}
        type="application/pdf"
        className="w-full h-full"
        style={commonStyles}
        onError={handleError}
      >
        <p>PDF cannot be displayed. <a href={pdfUrl} target="_blank">Open in new tab</a></p>
      </object>
    );
  }

  if (loadMethod === 'embed') {
    return (
      <embed
        src={`${pdfUrl}#page=${currentPage}`}
        type="application/pdf"
        className="w-full h-full"
        style={commonStyles}
        onError={handleError}
      />
    );
  }

  // Fallback when all methods fail
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="text-4xl text-gray-400">📄</div>
        <div>
          <p className="text-gray-600 mb-2">Não foi possível exibir o PDF diretamente</p>
          <Button onClick={() => window.open(pdfUrl, '_blank')}>
            Abrir PDF em Nova Aba
          </Button>
        </div>
      </div>
    </div>
  );
};

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
                  
                  {/* Enhanced PDF Viewer with multiple fallbacks */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.8, zIndex: 1 }}>
                    <PDFViewer 
                      pdfUrl={templatePdfUrl} 
                      zoom={1} 
                      currentPage={currentPage}
                      onLoadError={() => {
                        toast({
                          title: "Erro ao carregar PDF",
                          description: "Tentando abrir em nova aba...",
                          variant: "default"
                        });
                        window.open(templatePdfUrl, '_blank');
                      }}
                    />
                  </div>
                  
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
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-xs px-1 py-0"
                        onClick={() => setTemplatePdfUrl(null)}
                      >
                        Trocar PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <PDFUploader onPdfUploaded={setTemplatePdfUrl} />
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