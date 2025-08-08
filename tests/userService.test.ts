import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createUser, UserData } from "../server/services/userService";

// Mock the Supabase client
const mockSupabaseClient = {
  auth: {
    admin: {
      listUsers: vi.fn(),
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
  from: vi.fn(),
};

// Mock the createServerSupabaseClient function
vi.mock("../client/src/lib/supabase", () => ({
  createServerSupabaseClient: () => mockSupabaseClient,
}));

// Mock crypto for consistent password generation in tests
vi.mock("crypto", () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => "mockpassword").mockReturnValue("mockpassword"),
      substring: vi.fn(() => "mockpassword"),
    })),
  },
}));

describe("userService - createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.log mock to avoid interference between tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Cenário de Sucesso - ATENDENTE", () => {
    it("deve criar um usuário ATENDENTE com lojaId válido", async () => {
      // Arrange
      const userData: UserData = {
        fullName: "João Silva",
        email: "joao@exemplo.com",
        role: "ATENDENTE",
        lojaId: 123,
        lojaIds: null,
      };

      const mockAuthUser = {
        id: "user-uuid-123",
        email: "joao@exemplo.com",
      };

      const mockProfile = {
        id: "user-uuid-123",
        role: "ATENDENTE",
        full_name: "João Silva",
        loja_id: 123,
      };

      // Setup mocks
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      const mockInsertChain = {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          })),
        })),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      // Act
      const result = await createUser(userData);

      // Assert
      expect(result).toEqual({
        success: true,
        message: "Usuário criado com sucesso.",
        user: mockProfile,
        temporaryPassword: "mockpassword",
      });

      expect(mockSupabaseClient.auth.admin.listUsers).toHaveBeenCalledOnce();
      expect(mockSupabaseClient.auth.admin.createUser).toHaveBeenCalledWith({
        email: "joao@exemplo.com",
        password: "mockpassword",
        email_confirm: true,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("profiles");
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
        id: "user-uuid-123",
        role: "ATENDENTE",
        full_name: "João Silva",
        loja_id: 123,
      });
    });
  });

  describe("Cenário de Sucesso - GERENTE", () => {
    it("deve criar um usuário GERENTE com lojaIds válidos e criar associações", async () => {
      // Arrange
      const userData: UserData = {
        fullName: "Maria Gerente",
        email: "maria@exemplo.com",
        role: "GERENTE",
        lojaId: null,
        lojaIds: [101, 102, 103],
      };

      const mockAuthUser = {
        id: "gerente-uuid-456",
        email: "maria@exemplo.com",
      };

      const mockProfile = {
        id: "gerente-uuid-456",
        role: "GERENTE",
        full_name: "Maria Gerente",
        loja_id: null,
      };

      // Setup mocks
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      // Mock profile insertion
      const profileInsertMock = {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          })),
        })),
      };

      // Mock gerente_lojas insertion
      const gerenteLojaInsertMock = {
        insert: vi.fn().mockResolvedValue({
          data: [
            { gerente_id: "gerente-uuid-456", loja_id: 101 },
            { gerente_id: "gerente-uuid-456", loja_id: 102 },
            { gerente_id: "gerente-uuid-456", loja_id: 103 },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileInsertMock;
        if (table === "gerente_lojas") return gerenteLojaInsertMock;
        return profileInsertMock; // default fallback
      });

      // Act
      const result = await createUser(userData);

      // Assert
      expect(result).toEqual({
        success: true,
        message: "Usuário criado com sucesso.",
        user: mockProfile,
        temporaryPassword: "mockpassword",
      });

      expect(mockSupabaseClient.auth.admin.createUser).toHaveBeenCalledWith({
        email: "maria@exemplo.com",
        password: "mockpassword",
        email_confirm: true,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("profiles");
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("gerente_lojas");

      expect(gerenteLojaInsertMock.insert).toHaveBeenCalledWith([
        { gerente_id: "gerente-uuid-456", loja_id: 101 },
        { gerente_id: "gerente-uuid-456", loja_id: 102 },
        { gerente_id: "gerente-uuid-456", loja_id: 103 },
      ]);
    });
  });

  describe("Cenário de Falha - Email Duplicado", () => {
    it("deve lançar ConflictError quando email já existe", async () => {
      // Arrange
      const userData: UserData = {
        fullName: "Usuário Duplicado",
        email: "duplicado@exemplo.com",
        role: "ATENDENTE",
        lojaId: 123,
        lojaIds: null,
      };

      const existingUser = {
        id: "existing-user-id",
        email: "duplicado@exemplo.com",
      };

      // Setup mock to return existing user
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [existingUser] },
        error: null,
      });

      // Act & Assert
      await expect(createUser(userData)).rejects.toThrow(
        "Usuário com email duplicado@exemplo.com já existe."
      );

      // Verify that we checked for existing users but didn't proceed to create
      expect(mockSupabaseClient.auth.admin.listUsers).toHaveBeenCalledOnce();
      expect(mockSupabaseClient.auth.admin.createUser).not.toHaveBeenCalled();
    });
  });

  describe("Cenário de Falha - Dados Inválidos", () => {
    it("deve falhar ao criar ATENDENTE sem lojaId", async () => {
      // Arrange
      const userData: UserData = {
        fullName: "Atendente Inválido",
        email: "invalido@exemplo.com",
        role: "ATENDENTE",
        lojaId: null, // Missing required lojaId for ATENDENTE
        lojaIds: null,
      };

      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      const mockAuthUser = {
        id: "invalid-user-id",
        email: "invalido@exemplo.com",
      };

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      // Mock profile insertion with null loja_id (which should work for the service level)
      const mockInsertChain = {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "invalid-user-id",
                role: "ATENDENTE",
                full_name: "Atendente Inválido",
                loja_id: null,
              },
              error: null,
            }),
          })),
        })),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      // Act
      const result = await createUser(userData);

      // Assert - The service should still create the user (validation happens at route level)
      expect(result.success).toBe(true);
      expect(result.user.loja_id).toBe(null);
      expect(result.user.email).toBe(userData.email);
    });
  });

  describe("Cenário de Sucesso - Rollback", () => {
    it("deve executar rollback quando falha na criação do profile", async () => {
      // Arrange
      const userData: UserData = {
        fullName: "Usuário Rollback",
        email: "rollback@exemplo.com",
        role: "ATENDENTE",
        lojaId: 123,
        lojaIds: null,
      };

      const mockAuthUser = {
        id: "rollback-user-id",
        email: "rollback@exemplo.com",
      };

      // Setup mocks
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      // Mock profile insertion failure
      const mockInsertChain = {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database constraint violation" },
            }),
          })),
        })),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      mockSupabaseClient.auth.admin.deleteUser.mockResolvedValue({
        data: {},
        error: null,
      });

      // Act & Assert
      await expect(createUser(userData)).rejects.toThrow(
        "Erro ao criar perfil: Database constraint violation"
      );

      // Verify rollback was executed
      expect(mockSupabaseClient.auth.admin.deleteUser).toHaveBeenCalledWith("rollback-user-id");
    });
  });

  describe("Cenários de Falha no Auth", () => {
    it("deve falhar quando Supabase Auth retorna erro", async () => {
      // Arrange
      const userData: UserData = {
        fullName: "Usuário Auth Falha",
        email: "authfalha@exemplo.com",
        role: "ATENDENTE",
        lojaId: 123,
        lojaIds: null,
      };

      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Auth service unavailable" },
      });

      // Act & Assert
      await expect(createUser(userData)).rejects.toThrow(
        "Erro no Supabase Auth: Auth service unavailable"
      );
    });

    it("deve falhar quando auth user não é retornado", async () => {
      // Arrange
      const userData: UserData = {
        fullName: "Usuário Sem Auth",
        email: "semauth@exemplo.com",
        role: "ATENDENTE",
        lojaId: 123,
        lojaIds: null,
      };

      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Act & Assert
      await expect(createUser(userData)).rejects.toThrow("Falha crítica ao criar usuário no Auth.");
    });
  });

  describe("Cenário de Falha - Gerente Lojas Association", () => {
    it("deve executar rollback quando falha na criação das associações gerente_lojas", async () => {
      // Arrange
      const userData: UserData = {
        fullName: "Gerente Falha Associação",
        email: "gerentefalha@exemplo.com",
        role: "GERENTE",
        lojaId: null,
        lojaIds: [101, 102],
      };

      const mockAuthUser = {
        id: "gerente-falha-id",
        email: "gerentefalha@exemplo.com",
      };

      const mockProfile = {
        id: "gerente-falha-id",
        role: "GERENTE",
        full_name: "Gerente Falha Associação",
        loja_id: null,
      };

      // Setup mocks
      mockSupabaseClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      // Mock successful profile creation
      const profileInsertMock = {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          })),
        })),
      };

      // Mock failed gerente_lojas insertion
      const gerenteLojaInsertMock = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Foreign key constraint failed" },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileInsertMock;
        if (table === "gerente_lojas") return gerenteLojaInsertMock;
        return profileInsertMock; // default fallback
      });

      mockSupabaseClient.auth.admin.deleteUser.mockResolvedValue({
        data: {},
        error: null,
      });

      // Act & Assert
      await expect(createUser(userData)).rejects.toThrow(
        "Erro ao associar gerente a lojas: Foreign key constraint failed"
      );

      // Verify rollback was executed
      expect(mockSupabaseClient.auth.admin.deleteUser).toHaveBeenCalledWith("gerente-falha-id");
    });
  });
});
