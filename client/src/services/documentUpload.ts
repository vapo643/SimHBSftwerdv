import { api } from '@/lib/apiClient';
import { createClientSupabaseClient } from '@/lib/supabase';
import type { DocumentState } from '@/contexts/ProposalContext';

interface ProposalData {
  clientData: any;
  loanData: any;
  documents: DocumentState[];
}

interface ProposalResponse {
  id: string;
  [key: string]: any;
}

export class DocumentUploadService {
  // Phase 1: Create proposal with document placeholders
  async createProposal(data: ProposalData): Promise<ProposalResponse> {
    const proposalPayload = {
      ...data.clientData,
      ...data.loanData,
      documentos: data.documents.map(d => ({
        nome: d.file.name,
        tamanho: d.file.size,
        tipo: d.file.type,
        uploadId: d.uploadId,
        status: 'pending_upload'
      }))
    };

    const response = await api.post('/api/propostas', proposalPayload);
    return response.data;
  }

  // Phase 2: Upload documents with reference to proposal
  async uploadDocuments(
    proposalId: string, 
    documents: DocumentState[]
  ): Promise<Array<{ success: boolean; uploadId: string; storageUrl?: string; error?: any }>> {
    const supabase = createClientSupabaseClient();
    const uploadPromises = documents.map(async (doc) => {
      try {
        // Upload to Supabase Storage
        const filePath = `propostas/${proposalId}/${doc.uploadId}-${doc.file.name}`;
        const { data, error } = await supabase.storage
          .from('documentos')
          .upload(filePath, doc.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;

        // Update document status in backend
        await api.patch(`/api/propostas/${proposalId}/documentos/${doc.uploadId}`, {
          storageUrl: data.path,
          status: 'uploaded'
        });

        return { 
          success: true, 
          uploadId: doc.uploadId,
          storageUrl: data.path 
        };
      } catch (error) {
        console.error(`Failed to upload document ${doc.uploadId}:`, error);
        return { 
          success: false, 
          uploadId: doc.uploadId, 
          error 
        };
      }
    });

    return Promise.all(uploadPromises);
  }

  // Generate temporary URL for document preview
  async getDocumentUrl(storageUrl: string): Promise<string> {
    const supabase = createClientSupabaseClient();
    const { data } = supabase.storage
      .from('documentos')
      .createSignedUrl(storageUrl, 3600); // 1 hour expiry

    return data?.signedUrl || '';
  }

  // Cleanup orphaned files (to be called by backend cron job)
  async cleanupOrphanFiles(): Promise<void> {
    // This would typically be implemented on the backend
    // as it requires admin privileges to list and delete files
    console.warn('Cleanup should be performed by backend cron job');
  }

  // Retry failed uploads
  async retryFailedUploads(
    proposalId: string,
    failedDocuments: DocumentState[]
  ): Promise<Array<{ success: boolean; uploadId: string; storageUrl?: string; error?: any }>> {
    return this.uploadDocuments(proposalId, failedDocuments);
  }

  // Validate file before upload
  validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (file.size > maxSize) {
      return { valid: false, error: 'Arquivo muito grande. Tamanho máximo: 10MB' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Tipo de arquivo não permitido' };
    }

    return { valid: true };
  }
}

export const documentUploadService = new DocumentUploadService();