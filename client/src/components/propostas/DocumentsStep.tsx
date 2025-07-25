import React, { useRef } from "react";
import { useProposal, useProposalActions } from "@/contexts/ProposalContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, X, AlertCircle, CheckCircle2 } from "lucide-react";

export function DocumentsStep() {
  const { state } = useProposal();
  const { addDocument, removeDocument } = useProposalActions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
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
      <Card className="bg-black border-gray-800">
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
              <ul className="mt-2 ml-4 list-disc">
                {requiredDocuments.map((doc, index) => (
                  <li key={index}>{doc}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-gray-500 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">Clique para fazer upload</p>
              <p className="text-sm text-gray-500">ou arraste e solte os arquivos aqui</p>
              <p className="text-xs text-gray-600 mt-2">
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
          </div>

          {state.documents.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-300">Documentos anexados:</h4>
              {state.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-900 border border-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
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