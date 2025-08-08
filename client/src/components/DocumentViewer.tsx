import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Download, Eye, Image, FileIcon, ExternalLink } from "lucide-react";

interface Document {
  name: string;
  url: string;
  type?: string;
  size?: string;
  uploadDate?: string;
}

interface DocumentViewerProps {
  propostaId: string;
  documents: Document[];
  ccbDocumentoUrl?: string;
}

export function DocumentViewer({ propostaId, documents }: DocumentViewerProps) {
  const [_selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [ccbRealUrl, setCcbRealUrl] = useState<string | null>(null);
  const [_ccbLoading, setCcbLoading] = useState(false);

  // Fetch real CCB URL - sempre usar endpoint padrão da API
  useEffect(() => {
    const fetchCcbUrl = async () => {
      if (propostaId) {
        setCcbLoading(true);
        try {
          const { api } = await import("@/lib/apiClient");
          // ✅ CORREÇÃO: Sempre usar endpoint padrão para buscar CCB
          const response = await api.get(`/api/formalizacao/${propostaId}/ccb`);

          if (response.ccb_gerado === false) {
            // CCB ainda não foi gerada - não mostrar na lista
            setCcbRealUrl(null);
          } else if (response.publicUrl) {
            setCcbRealUrl(response.publicUrl);
          } else {
            setCcbRealUrl(null);
          }
        } catch (error) {
          console.error("Erro ao buscar status da CCB:", error);
          setCcbRealUrl(null);
        } finally {
          setCcbLoading(false);
        }
      }
    };

    fetchCcbUrl();
  }, [propostaId]);

  // Prepare all documents list including CCB (apenas se foi gerada)
  const allDocuments: Document[] = [
    ...documents,
    // Mostrar CCB apenas se foi carregada com sucesso
    ...(ccbRealUrl
      ? [
          {
            name: "CCB - Cédula de Crédito Bancário",
            url: ccbRealUrl,
            type: "application/pdf",
            uploadDate: "Sistema",
          },
        ]
      : []),
  ];

  const getFileIcon = (type?: string, name?: string) => {
    const nameExt = name?.toLowerCase() || "";
    const fileType = type?.toLowerCase() || "";
    if (fileType.includes("pdf") || nameExt.endsWith(".pdf"))
      return <FileText className="h-4 w-4" />;
    if (
      fileType.includes("image") ||
      nameExt.endsWith(".jpg") ||
      nameExt.endsWith(".jpeg") ||
      nameExt.endsWith(".png")
    )
      return <Image className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  const getFileTypeLabel = (type?: string, name?: string) => {
    const nameExt = name?.toLowerCase() || "";
    const fileType = type?.toLowerCase() || "";
    if (fileType.includes("pdf") || nameExt.endsWith(".pdf")) return "PDF";
    if (
      fileType.includes("image") ||
      nameExt.endsWith(".jpg") ||
      nameExt.endsWith(".jpeg") ||
      nameExt.endsWith(".png")
    )
      return "Imagem";
    if (fileType.includes("doc")) return "DOC";
    return "Arquivo";
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Erro ao baixar documento:", error);
    }
  };

  const DocumentPreview = ({ document }: { document: Document }) => {
    const { url, type, name } = document;
    const nameExt = name?.toLowerCase() || "";
    const fileType = type?.toLowerCase() || "";

    // Check both type and file extension
    const isPDF = fileType.includes("pdf") || nameExt.endsWith(".pdf");
    const isImage =
      fileType.includes("image") ||
      nameExt.endsWith(".jpg") ||
      nameExt.endsWith(".jpeg") ||
      nameExt.endsWith(".png");

    if (isPDF) {
      return (
        <div className="h-[600px] w-full rounded border bg-gray-900">
          <iframe src={url} className="h-full w-full" title={name} />
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex max-h-[600px] w-full justify-center rounded bg-gray-900 p-4">
          <img src={url} alt={name} className="max-h-[550px] max-w-full object-contain" />
        </div>
      );
    }

    return (
      <div className="flex h-48 w-full items-center justify-center rounded border bg-gray-50">
        <div className="text-center">
          <FileIcon className="mx-auto mb-2 h-12 w-12 text-gray-400" />
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
          <div className="py-8 text-center text-gray-500">
            <FileText className="mx-auto mb-2 h-12 w-12" />
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
            className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              {getFileIcon(doc.type, doc.name)}
              <div>
                <p className="text-sm font-medium">{doc.name}</p>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    {getFileTypeLabel(doc.type, doc.name)}
                  </Badge>
                  {doc.size && <span className="text-xs text-gray-500">{doc.size}</span>}
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
                    disabled={doc.url === "#loading" || doc.url === "#error"}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    {doc.url === "#loading" ? "Carregando..." : "Visualizar"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>{doc.name}</DialogTitle>
                  </DialogHeader>
                  <div className="mt-4">
                    <DocumentPreview document={doc} />
                  </div>
                  <div className="mt-4 flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(doc.url, doc.name)}
                      disabled={doc.url === "#loading" || doc.url === "#error"}
                    >
                      <Download className="mr-1 h-4 w-4" />
                      Baixar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(doc.url, "_blank")}
                      disabled={doc.url === "#loading" || doc.url === "#error"}
                    >
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Abrir em Nova Aba
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(doc.url, doc.name)}
                disabled={doc.url === "#loading" || doc.url === "#error"}
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
