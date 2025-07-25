import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  FileText, 
  Download, 
  Eye, 
  Image, 
  FileIcon,
  ExternalLink 
} from "lucide-react";

interface Document {
  name: string;
  url: string;
  type: string;
  size?: string;
  uploadDate?: string;
}

interface DocumentViewerProps {
  propostaId: string;
  documents: Document[];
  ccbDocumentoUrl?: string;
}

export function DocumentViewer({ propostaId, documents, ccbDocumentoUrl }: DocumentViewerProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  // Prepare all documents list including CCB
  const allDocuments: Document[] = [
    ...documents,
    ...(ccbDocumentoUrl ? [{
      name: "CCB - Cédula de Crédito Bancário",
      url: ccbDocumentoUrl,
      type: "application/pdf",
      uploadDate: "Sistema"
    }] : [])
  ];

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-4 w-4" />;
    if (type.includes('image')) return <Image className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  const getFileTypeLabel = (type: string) => {
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('image')) return 'Imagem';
    if (type.includes('doc')) return 'DOC';
    return 'Arquivo';
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Erro ao baixar documento:', error);
    }
  };

  const DocumentPreview = ({ document }: { document: Document }) => {
    const { url, type, name } = document;

    if (type.includes('pdf')) {
      return (
        <div className="w-full h-96 border rounded">
          <iframe
            src={url}
            className="w-full h-full"
            title={name}
          />
        </div>
      );
    }

    if (type.includes('image')) {
      return (
        <div className="w-full max-h-96 flex justify-center">
          <img
            src={url}
            alt={name}
            className="max-w-full max-h-96 object-contain"
          />
        </div>
      );
    }

    return (
      <div className="w-full h-48 border rounded flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">Visualização não disponível</p>
          <p className="text-xs text-gray-500">Use o botão de download para acessar o arquivo</p>
        </div>
      </div>
    );
  };

  if (allDocuments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documentos da Proposta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-2" />
            <p>Nenhum documento anexado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos da Proposta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {allDocuments.map((doc, index) => (
          <div 
            key={index}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              {getFileIcon(doc.type)}
              <div>
                <p className="font-medium text-sm">{doc.name}</p>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    {getFileTypeLabel(doc.type)}
                  </Badge>
                  {doc.size && (
                    <span className="text-xs text-gray-500">{doc.size}</span>
                  )}
                  {doc.uploadDate && (
                    <span className="text-xs text-gray-500">{doc.uploadDate}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Visualizar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>{doc.name}</DialogTitle>
                  </DialogHeader>
                  <div className="mt-4">
                    <DocumentPreview document={doc} />
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <Button 
                      variant="outline"
                      onClick={() => handleDownload(doc.url, doc.name)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.open(doc.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir em Nova Aba
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleDownload(doc.url, doc.name)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}