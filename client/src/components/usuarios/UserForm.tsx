import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Info } from "lucide-react";
import { useUserFormData, useStoresByPartner } from "@/hooks/queries/useUserFormData";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

const userSchema = z
  .object({
    nome: z.string().min(3, "Nome é obrigatório."),
    email: z.string().email("Formato de e-mail inválido."),
    perfil: z.enum(["ADMINISTRADOR", "DIRETOR", "GERENTE", "ATENDENTE", "ANALISTA", "FINANCEIRO"]),
    parceiroId: z.string().optional(),
    lojaId: z.string().optional(), // For ATENDENTE
    lojaIds: z.array(z.string()).optional(), // For GERENTE (multiple stores)
  })
  .refine(
    data => {
      if (data.perfil === "ATENDENTE" && !data.lojaId) {
        return false;
      }
      if (data.perfil === "GERENTE" && (!data.lojaIds || data.lojaIds.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: "Loja(s) Associada(s) é obrigatória para este perfil.",
      path: ["lojaId", "lojaIds"],
    }
  );

type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  initialData?: any;
  onSubmit: (data: UserFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const UserForm: React.FC<UserFormProps> = ({ initialData, onSubmit, onCancel, isLoading = false }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    setValue,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: initialData || {},
  });

  const selectedPerfil = watch("perfil");
  const selectedParceiroId = watch("parceiroId");

  // Use the new comprehensive data hook
  const {
    partners,
    isLoading: isFormDataLoading,
    error: formDataError,
    filteringStrategy,
    getStoresByPartner,
    canFilterClientSide,
    isDataReady,
  } = useUserFormData();

  // Use server-side store fetching when needed
  const {
    data: serverStores = [],
    isLoading: isServerStoresLoading,
    error: serverStoresError,
  } = useStoresByPartner(
    selectedParceiroId ? parseInt(selectedParceiroId) : null,
    !canFilterClientSide && !!selectedParceiroId
  );

  // State management for multiple stores (GERENTE profile)
  const [selectedLojas, setSelectedLojas] = useState<string[]>(initialData?.lojaIds || []);

  // Get available stores based on filtering strategy
  const getAvailableStores = () => {
    if (!selectedParceiroId) return [];
    
    if (canFilterClientSide) {
      // Client-side filtering: use pre-loaded data
      return getStoresByPartner(parseInt(selectedParceiroId));
    } else {
      // Server-side filtering: use on-demand data
      return serverStores;
    }
  };

  const availableStores = getAvailableStores();
  const isStoresLoading = canFilterClientSide ? false : isServerStoresLoading;

  useEffect(() => {
    // Password is now handled server-side automatically
    // No need to set senhaProvisoria in form
  }, [initialData, setValue]);

  // Update form values when selected stores change for GERENTE
  useEffect(() => {
    if (selectedPerfil === "GERENTE") {
      setValue("lojaIds", selectedLojas);
    }
  }, [selectedLojas, selectedPerfil, setValue]);

  // Reset store selections when profile changes
  useEffect(() => {
    if (selectedPerfil !== "GERENTE") {
      setSelectedLojas([]);
      setValue("lojaIds", []);
    }
    if (selectedPerfil !== "ATENDENTE") {
      setValue("lojaId", "");
    }
  }, [selectedPerfil, setValue]);

  const handleAddLoja = (lojaId: string) => {
    if (!selectedLojas.includes(lojaId)) {
      setSelectedLojas([...selectedLojas, lojaId]);
    }
  };

  const handleRemoveLoja = (lojaId: string) => {
    setSelectedLojas(selectedLojas.filter(id => id !== lojaId));
  };

  const getLojaName = (lojaId: string) => {
    const loja = availableStores.find(l => l.id.toString() === lojaId);
    return loja ? loja.nomeLoja : "Loja não encontrada";
  };

  // Handle errors and loading states
  if (formDataError) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <h4 className="font-medium text-red-800">Erro ao carregar dados</h4>
            <p className="text-sm text-red-700">Não foi possível carregar os dados necessários para o formulário.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nome">Nome Completo</Label>
          <Input id="nome" {...register("nome")} />
          {errors.nome && <p className="mt-1 text-sm text-red-500">{errors.nome.message}</p>}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
        </div>
      </div>

      {!initialData?.id && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Senha Automática
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <p>
                  Uma senha temporária será gerada automaticamente e enviada por email para o usuário.
                  O usuário deverá alterar a senha no primeiro acesso ao sistema.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <Label>Perfil de Acesso</Label>
        <Controller
            name="perfil"
            control={control}
            render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger><SelectValue placeholder="Selecione um perfil..." /></SelectTrigger>
                    <SelectContent>
                        {["ADMINISTRADOR", "DIRETOR", "GERENTE", "ATENDENTE", "ANALISTA", "FINANCEIRO"].map((perfil) => (
                          <SelectItem key={perfil} value={perfil}>
                            {perfil}
                          </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        />
        {errors.perfil && <p className="mt-1 text-sm text-red-500">{errors.perfil.message}</p>}
      </div>

      {(selectedPerfil === "GERENTE" || selectedPerfil === "ATENDENTE") && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="parceiroId">Parceiro</Label>
            <Controller
              name="parceiroId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isFormDataLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={isFormDataLoading ? "Carregando parceiros..." : "Selecione um parceiro..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map(parceiro => (
                      <SelectItem key={parceiro.id} value={parceiro.id.toString()}>
                        {parceiro.razaoSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.parceiroId && <p className="mt-1 text-sm text-red-500">{errors.parceiroId.message}</p>}
          </div>

          {/* Single Store Selection for ATENDENTE */}
          {selectedPerfil === "ATENDENTE" && (
            <div>
              <div className="flex items-center gap-2">
                <Label>Loja Associada</Label>
                {serverStoresError && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Erro ao carregar lojas
                  </span>
                )}
                {filteringStrategy === 'server-side' && (
                  <span className="text-xs text-blue-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Modo otimizado ativo
                  </span>
                )}
              </div>
              <Controller
                name="lojaId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedParceiroId || isStoresLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={isStoresLoading ? "Carregando lojas..." : "Selecione uma loja..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStores.map(l => (
                        <SelectItem key={l.id} value={l.id.toString()}>{l.nomeLoja}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.lojaId && <p className="mt-1 text-sm text-red-500">{errors.lojaId.message}</p>}
            </div>
          )}

          {/* Multiple Store Selection for GERENTE */}
          {selectedPerfil === "GERENTE" && (
            <div>
              <div className="flex items-center gap-2">
                <Label>Lojas Associadas (Múltipla Seleção)</Label>
                {serverStoresError && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Erro ao carregar lojas
                  </span>
                )}
                {filteringStrategy === 'server-side' && (
                  <span className="text-xs text-blue-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Modo otimizado ativo
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <Select onValueChange={handleAddLoja} disabled={!selectedParceiroId || isStoresLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={isStoresLoading ? "Carregando lojas..." : "Selecione lojas para adicionar..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStores.filter(l => !selectedLojas.includes(l.id.toString())).map(l => (
                      <SelectItem key={l.id} value={l.id.toString()}>{l.nomeLoja}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Display selected stores */}
                {selectedLojas.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50">
                    {selectedLojas.map(lojaId => (
                      <Badge key={lojaId} variant="secondary" className="flex items-center gap-1">
                        {getLojaName(lojaId)}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => handleRemoveLoja(lojaId)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {errors.lojaIds && <p className="mt-1 text-sm text-red-500">{errors.lojaIds.message}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
};

export default UserForm;
