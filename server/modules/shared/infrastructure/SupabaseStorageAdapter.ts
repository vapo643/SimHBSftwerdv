/**
 * Adaptador Supabase Storage
 *
 * Implementa IStorageProvider usando Supabase Storage como provider concreto.
 * Aplica o Padrão Adapter para desacoplar a tecnologia específica.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IStorageProvider, UploadResult } from '../domain/IStorageProvider';

export class SupabaseStorageAdapter implements IStorageProvider {
  constructor(private supabaseClient: SupabaseClient) {}

  async upload(
    fileBuffer: Buffer,
    destinationPath: string,
    bucketName: string
  ): Promise<UploadResult> {
    try {
      console.log(
        `[STORAGE] Uploading file to bucket '${bucketName}' at path '${destinationPath}'`
      );

      const { data, error } = await this.supabaseClient.storage
        .from(bucketName)
        .upload(destinationPath, fileBuffer, {
          contentType: this.getContentType(destinationPath),
          upsert: true, // Permite sobrescrever ficheiros existentes
        });

      if (error) {
        console.error('[STORAGE] Upload error:', error);
        throw new Error(`Erro no upload do ficheiro: ${error.message}`);
      }

      // Obter URL pública
      const { data: urlData } = this.supabaseClient.storage
        .from(bucketName)
        .getPublicUrl(destinationPath);

      console.log(`[STORAGE] Upload successful: ${data.path}`);

      return {
        filePath: data.path,
        publicUrl: urlData.publicUrl,
        fullPath: `${bucketName}/${data.path}`,
      };
    } catch (error: any) {
      console.error('[STORAGE] Upload failed:', error);
      throw new Error(`Falha no upload: ${error.message}`);
    }
  }

  async getDownloadUrl(
    filePath: string,
    bucketName: string,
    expirationSeconds: number = 3600
  ): Promise<string> {
    try {
      console.log(
        `[STORAGE] Generating signed URL for '${filePath}' in bucket '${bucketName}' (expires in ${expirationSeconds}s)`
      );

      const { data, error } = await this.supabaseClient.storage
        .from(bucketName)
        .createSignedUrl(filePath, expirationSeconds);

      if (error) {
        console.error('[STORAGE] Signed URL error:', error);
        throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
      }

      console.log(`[STORAGE] Signed URL generated successfully`);
      return data.signedUrl;
    } catch (error: any) {
      console.error('[STORAGE] Failed to generate signed URL:', error);
      throw new Error(`Falha ao gerar URL de download: ${error.message}`);
    }
  }

  getPublicUrl(filePath: string, bucketName: string): string {
    const { data } = this.supabaseClient.storage.from(bucketName).getPublicUrl(filePath);

    console.log(`[STORAGE] Public URL generated for '${filePath}': ${data.publicUrl}`);
    return data.publicUrl;
  }

  async delete(filePath: string, bucketName: string): Promise<void> {
    try {
      console.log(`[STORAGE] Deleting file '${filePath}' from bucket '${bucketName}'`);

      const { error } = await this.supabaseClient.storage.from(bucketName).remove([filePath]);

      if (error) {
        console.error('[STORAGE] Delete error:', error);
        throw new Error(`Erro ao deletar ficheiro: ${error.message}`);
      }

      console.log(`[STORAGE] File deleted successfully: ${filePath}`);
    } catch (error: any) {
      console.error('[STORAGE] Delete failed:', error);
      throw new Error(`Falha ao deletar ficheiro: ${error.message}`);
    }
  }

  async exists(filePath: string, bucketName: string): Promise<boolean> {
    try {
      console.log(`[STORAGE] Checking if file exists: '${filePath}' in bucket '${bucketName}'`);

      const { data, error } = await this.supabaseClient.storage
        .from(bucketName)
        .list(this.getDirectoryFromPath(filePath));

      if (error) {
        console.error('[STORAGE] Exists check error:', error);
        return false;
      }

      const fileName = this.getFileNameFromPath(filePath);
      const exists = data.some((file: any) => file.name === fileName);

      console.log(`[STORAGE] File ${exists ? 'exists' : 'does not exist'}: ${filePath}`);
      return exists;
    } catch (error: any) {
      console.error('[STORAGE] Exists check failed:', error);
      return false;
    }
  }

  async listFiles(directoryPath: string, bucketName: string): Promise<string[]> {
    try {
      console.log(
        `[STORAGE] Listing files in directory '${directoryPath}' from bucket '${bucketName}'`
      );

      const { data, error } = await this.supabaseClient.storage
        .from(bucketName)
        .list(directoryPath);

      if (error) {
        console.error('[STORAGE] List files error:', error);
        throw new Error(`Erro ao listar ficheiros: ${error.message}`);
      }

      const fileNames = data
        .filter((item: any) => item.metadata !== null) // Filtrar apenas ficheiros (não diretórios)
        .map((file: any) => file.name);

      console.log(`[STORAGE] Found ${fileNames.length} files in directory '${directoryPath}'`);
      return fileNames;
    } catch (error: any) {
      console.error('[STORAGE] List files failed:', error);
      throw new Error(`Falha ao listar ficheiros: ${error.message}`);
    }
  }

  // ========== MÉTODOS AUXILIARES ==========

  /**
   * Determina o content-type baseado na extensão do ficheiro
   */
  private getContentType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv',
      json: 'application/json',
      xml: 'application/xml',
      zip: 'application/zip',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Extrai o diretório de um caminho de ficheiro
   */
  private getDirectoryFromPath(filePath: string): string {
    const lastSlashIndex = filePath.lastIndexOf('/');
    return lastSlashIndex >= 0 ? filePath.substring(0, lastSlashIndex) : '';
  }

  /**
   * Extrai o nome do ficheiro de um caminho completo
   */
  private getFileNameFromPath(filePath: string): string {
    const lastSlashIndex = filePath.lastIndexOf('/');
    return lastSlashIndex >= 0 ? filePath.substring(lastSlashIndex + 1) : filePath;
  }
}
