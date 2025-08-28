/**
 * Abstração para Provedor de Armazenamento de Ficheiros
 * 
 * Aplica o Princípio de Inversão de Dependência (SOLID "D")
 * Permite desacoplar a lógica de negócio da implementação específica de storage
 */

export interface UploadResult {
  /** Caminho do ficheiro no storage */
  filePath: string;
  /** URL pública ou assinada para acesso ao ficheiro */
  publicUrl: string;
  /** URL completa incluindo bucket (se aplicável) */
  fullPath?: string;
}

export interface IStorageProvider {
  /**
   * Faz upload de um ficheiro para o storage
   * @param fileBuffer Buffer do ficheiro a ser enviado
   * @param destinationPath Caminho de destino no storage (incluindo nome do ficheiro)
   * @param bucketName Nome do bucket onde armazenar
   * @returns Resultado do upload com URLs de acesso
   */
  upload(fileBuffer: Buffer, destinationPath: string, bucketName: string): Promise<UploadResult>;

  /**
   * Obtém URL de download assinada (com tempo de expiração)
   * @param filePath Caminho do ficheiro no storage
   * @param bucketName Nome do bucket
   * @param expirationSeconds Tempo de expiração em segundos (padrão: 3600)
   * @returns URL assinada para download
   */
  getDownloadUrl(filePath: string, bucketName: string, expirationSeconds?: number): Promise<string>;

  /**
   * Obtém URL pública (permanente) do ficheiro
   * @param filePath Caminho do ficheiro no storage
   * @param bucketName Nome do bucket
   * @returns URL pública do ficheiro
   */
  getPublicUrl(filePath: string, bucketName: string): string;

  /**
   * Remove um ficheiro do storage
   * @param filePath Caminho do ficheiro a ser removido
   * @param bucketName Nome do bucket
   */
  delete(filePath: string, bucketName: string): Promise<void>;

  /**
   * Verifica se um ficheiro existe no storage
   * @param filePath Caminho do ficheiro
   * @param bucketName Nome do bucket
   * @returns True se o ficheiro existe
   */
  exists(filePath: string, bucketName: string): Promise<boolean>;

  /**
   * Lista ficheiros em um diretório
   * @param directoryPath Caminho do diretório
   * @param bucketName Nome do bucket
   * @returns Lista de ficheiros encontrados
   */
  listFiles(directoryPath: string, bucketName: string): Promise<string[]>;
}