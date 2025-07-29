import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Eye, Copy, Trash2, Edit } from 'lucide-react';

interface PDFTemplate {
  id: string;
  name: string;
  description: string;
  pageSize: 'A4' | 'Letter';
  margins: { top: number; bottom: number; left: number; right: number };
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PDFTemplate | null>(null);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['pdf-templates'],
    queryFn: async () => {
      const response = await fetch('/api/admin/pdf-templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Falha ao carregar templates');
      }
      
      return response.json();
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/admin/pdf-templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir template');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-templates'] });
      toast({
        title: 'Sucesso',
        description: 'Template excluído com sucesso',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Duplicate template mutation
  const duplicateTemplateMutation = useMutation({
    mutationFn: async ({ templateId, name, description }: { templateId: string; name: string; description?: string }) => {
      const response = await fetch(`/api/admin/pdf-templates/${templateId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao duplicar template');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-templates'] });
      toast({
        title: 'Sucesso',
        description: 'Template duplicado com sucesso',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handlePreview = async (templateId: string) => {
    try {
      const response = await fetch(`/api/admin/pdf-templates/${templateId}/preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar preview');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preview-template-${templateId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Sucesso',
        description: 'Preview gerado com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao gerar preview',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = (template: PDFTemplate) => {
    const newName = prompt('Nome do novo template:', `Cópia de ${template.name}`);
    if (newName) {
      duplicateTemplateMutation.mutate({
        templateId: template.id,
        name: newName,
        description: `Cópia de ${template.description}`,
      });
    }
  };

  const handleDelete = (template: PDFTemplate) => {
    if (confirm(`Tem certeza que deseja excluir o template "${template.name}"?`)) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando templates...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Templates PDF</h1>
          <p className="text-gray-600 mt-2">
            Gerencie templates personalizados para geração de documentos CCB
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Editar Template' : 'Criar Novo Template'}
              </DialogTitle>
            </DialogHeader>
            <TemplateEditor
              template={editingTemplate}
              onClose={() => {
                setIsDialogOpen(false);
                setEditingTemplate(null);
              }}
              onSave={() => {
                queryClient.invalidateQueries({ queryKey: ['pdf-templates'] });
                setIsDialogOpen(false);
                setEditingTemplate(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template: PDFTemplate) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="truncate">{template.name}</span>
                <div className="flex gap-2 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(template.id)}
                    title="Visualizar Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingTemplate(template);
                      setIsDialogOpen(true);
                    }}
                    title="Editar Template"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDuplicate(template)}
                    title="Duplicar Template"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>

                  {template.id !== 'ccb-standard' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(template)}
                      title="Excluir Template"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                {template.description || 'Sem descrição'}
              </p>
              
              <div className="flex justify-between text-xs text-gray-500">
                <span>Formato: {template.pageSize}</span>
                <span>
                  {template.id === 'ccb-standard' ? 'Padrão' : 'Personalizado'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-gray-500 mb-4">
              <Plus className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">Nenhum template encontrado</p>
              <p className="text-sm">Crie seu primeiro template personalizado</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Simple template editor component
function TemplateEditor({ 
  template, 
  onClose, 
  onSave 
}: { 
  template: PDFTemplate | null; 
  onClose: () => void; 
  onSave: () => void; 
}) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const { toast } = useToast();

  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await fetch('/api/admin/pdf-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar template');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Template salvo com sucesso',
      });
      onSave();
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome do template é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    // For now, create a basic template structure
    // In a full implementation, this would be a visual editor
    const templateData = {
      id: template?.id || `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      pageSize: 'A4' as const,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      sections: template?.id ? undefined : [
        {
          id: 'header',
          title: 'DOCUMENTO PERSONALIZADO',
          position: { x: 0, y: 0 },
          fontSize: 18,
          fontStyle: 'bold' as const,
          alignment: 'center' as const,
          fields: []
        }
      ]
    };

    saveTemplateMutation.mutate(templateData);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Nome do Template</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Digite o nome do template"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Descrição</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva o propósito deste template"
          rows={3}
        />
      </div>

      {!template && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Nota:</strong> Esta é uma versão simplificada do editor de templates. 
            O template será criado com uma estrutura básica que pode ser personalizada posteriormente.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSave}
          disabled={saveTemplateMutation.isPending}
        >
          {saveTemplateMutation.isPending ? 'Salvando...' : 'Salvar Template'}
        </Button>
      </div>
    </div>
  );
}