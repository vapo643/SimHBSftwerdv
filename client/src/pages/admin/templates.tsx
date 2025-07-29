import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Eye, Copy, Trash2, Edit } from 'lucide-react';
import AdminOnlyFeature from '@/components/AdminOnlyFeature';

interface PDFTemplate {
  id: string;
  name: string;
  description: string;
  pageSize: 'A4' | 'Letter';
  margins: { top: number; bottom: number; left: number; right: number };
}

export default function TemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PDFTemplate | null>(null);

  // Fetch templates using apiClient
  const { data: templatesResponse, isLoading, error } = useQuery({
    queryKey: ['pdf-templates'],
    queryFn: async () => {
      const { api } = await import('@/lib/apiClient');
      const response = await api.get('/api/admin/pdf-templates');
      return response.data;
    },
  });

  // Ensure templates is always an array - Handle both array responses and error responses
  const templates = Array.isArray(templatesResponse) ? templatesResponse : [];
  
  // Debug log to see what we're getting
  console.log('🔍 [TEMPLATES DEBUG] Response from API:', {
    type: typeof templatesResponse,
    isArray: Array.isArray(templatesResponse),
    value: templatesResponse,
    templatesLength: templates.length
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { api } = await import('@/lib/apiClient');
      const response = await api.delete(`/api/admin/pdf-templates/${templateId}`);
      return response.data;
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
      const { api } = await import('@/lib/apiClient');
      const response = await api.post(`/api/admin/pdf-templates/${templateId}/duplicate`, { name, description });
      return response.data;
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
      const { api } = await import('@/lib/apiClient');
      const response = await api.post(`/api/admin/pdf-templates/${templateId}/preview`);
      
      if (response.data instanceof Blob) {
        const blob = response.data;
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
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error) {
      console.error('Error generating preview:', error);
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
      <AdminOnlyFeature featureName="Gestão de Templates PDF" currentRole={user?.role || 'VISITANTE'}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Carregando templates...</div>
        </div>
      </AdminOnlyFeature>
    );
  }

  if (error) {
    return (
      <AdminOnlyFeature featureName="Gestão de Templates PDF" currentRole={user?.role || 'VISITANTE'}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg text-red-500">Erro ao carregar templates: {error.message}</div>
        </div>
      </AdminOnlyFeature>
    );
  }

  return (
    <AdminOnlyFeature featureName="Gestão de Templates PDF" currentRole={user?.role || 'VISITANTE'}>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão de Templates PDF</h1>
            <p className="text-muted-foreground mt-2">
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">
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
    </AdminOnlyFeature>
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
      const { api } = await import('@/lib/apiClient');
      const response = await api.post('/api/admin/pdf-templates', templateData);
      return response.data;
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

    // Create a complete template structure based on CCB template
    const templateData = {
      id: template?.id || `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      pageSize: 'A4' as const,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      
      header: {
        id: 'header',
        title: name.trim().toUpperCase(),
        position: { x: 0, y: 0 },
        fontSize: 20,
        fontStyle: 'bold' as const,
        alignment: 'center' as const
      },

      sections: [
        {
          id: 'identification',
          title: '',
          position: { x: 0, y: 60 },
          fields: [
            {
              id: 'document-number',
              label: 'Nº do Documento:',
              position: { x: 0, y: 0 },
              dataPath: 'propostaId',
              fontSize: 10
            },
            {
              id: 'emission-date',
              label: 'Data de Emissão:',
              position: { x: 180, y: 0 },
              dataPath: 'dataEmissao',
              formatter: 'date' as const,
              fontSize: 10
            }
          ]
        },
        {
          id: 'client-info',
          title: 'I. INFORMAÇÕES DO CLIENTE',
          position: { x: 0, y: 120 },
          fontSize: 12,
          fontStyle: 'bold' as const,
          underline: true,
          fields: [
            {
              id: 'client-name',
              label: 'Nome:',
              position: { x: 0, y: 25 },
              dataPath: 'clienteData.nome',
              width: 320,
              fontSize: 10
            },
            {
              id: 'client-document',
              label: 'CPF:',
              position: { x: 0, y: 45 },
              dataPath: 'clienteData.cpf',
              width: 320,
              fontSize: 10
            }
          ]
        }
      ],

      footer: {
        id: 'signatures',
        title: 'ASSINATURAS',
        position: { x: 0, y: 650 },
        fontSize: 12,
        fontStyle: 'bold' as const,
        underline: true,
        fields: [
          {
            id: 'location-date',
            label: '',
            position: { x: 0, y: 25 },
            dataPath: 'localData',
            width: 480,
            fontSize: 10
          }
        ]
      }
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
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Nota:</strong> O template será criado com uma estrutura baseada no modelo CCB padrão. 
            Você pode duplicar e modificar templates existentes para criar variações personalizadas.
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