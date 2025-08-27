import React, { useRef } from 'react';
import { useProposal, useProposalActions } from '@/contexts/ProposalContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, X, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export function DocumentsStep() {
  const { user } = useAuth();
  const { state } = useProposal();
  const { addDocument, removeDocument } = useProposalActions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user has permission to upload documents
  // ATENDENTES podem fazer upload na criação de propostas
  // ANALISTAS podem adicionar documentos durante análise
  // ADMINISTRADORES têm acesso total
  const canUpload =
    user?.role === 'ADMINISTRADOR' || user?.role === 'ANALISTA' || user?.role === 'ATENDENTE';

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const document = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        file: file,
      };
      addDocument(document);
    });

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const requiredDocuments = state.context?.documentosObrigatorios || [
    'Documento de Identidade (RG ou CNH)',
    'CPF',
    'Comprovante de Residência',
    'Comprovante de Renda',
    'Extrato Bancário (últimos 3 meses)',
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos Obrigatórios
          </CardTitle>
          <CardDescription>
            Faça upload dos documentos necessários para a análise de crédito
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Documentos necessários:</strong>
              <ul className="ml-4 mt-2 list-disc">
                {requiredDocuments.map((doc, index) => (
                  <li key={index}>{doc}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {canUpload ? (
              <>
                <div
                  className="hover:border-border/70 bg-muted/30 hover:bg-muted/50 cursor-pointer rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="mb-2 text-lg font-medium text-foreground">
                    Clique para fazer upload
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ou arraste e solte os arquivos aqui
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Formatos aceitos: PDF, JPG, PNG (máx. 10MB por arquivo)
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
              </>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border/50 bg-muted/20 p-8 text-center opacity-60">
                <Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-2 text-lg font-medium text-muted-foreground">
                  Upload não disponível
                </p>
                <p className="text-sm text-muted-foreground">
                  Upload de documentos disponível para Atendentes, Analistas e Administradores
                </p>
              </div>
            )}
          </div>

          {state.documents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Documentos anexados:</h4>
              {state.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(doc.size)}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(doc.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {state.documents.length >= requiredDocuments.length && (
            <Alert className="border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-400">
                Todos os documentos obrigatórios foram anexados. Você pode enviar a proposta.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
