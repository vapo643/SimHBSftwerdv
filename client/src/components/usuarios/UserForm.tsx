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
import { X } from "lucide-react";

// Mock data - no mundo real, viria de uma API
const mockParceiros = [
  { id: "1", nome: "Parceiro A" },
  { id: "2", nome: "Parceiro B" },
];
const mockLojas: { [key: string]: { id: string; nome: string }[] } = {
  "1": [{ id: "101", nome: "Loja Matriz A" }],
  "2": [
    { id: "201", nome: "Loja Filial Sul" },
    { id: "202", nome: "Loja Filial Norte" },
  ],
};

const userSchema = z
  .object({
    nome: z.string().min(3, "Nome é obrigatório."),
    email: z.string().email("Formato de e-mail inválido."),
    senhaProvisoria: z.string().optional(),
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
  const selectedParceiro = watch("parceiroId");
  const [selectedLojas, setSelectedLojas] = useState<string[]>(initialData?.lojaIds || []);

  useEffect(() => {
    if (!initialData?.id) {
      const generatedPassword = Math.random().toString(36).slice(-8);
      setValue("senhaProvisoria", generatedPassword);
    }
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
    for (const parceiro in mockLojas) {
      const loja = mockLojas[parceiro].find(l => l.id === lojaId);
      if (loja) return loja.nome;
    }
    return "Loja não encontrada";
  };

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
        <div>
          <Label htmlFor="senhaProvisoria">Senha Provisória (copie antes de salvar)</Label>
          <Input id="senhaProvisoria" readOnly {...register("senhaProvisoria")} />
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um parceiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockParceiros.map(parceiro => (
                      <SelectItem key={parceiro.id} value={parceiro.id}>
                        {parceiro.nome}
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
              <Label>Loja Associada</Label>
              <Controller
                name="lojaId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedParceiro}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma loja..." /></SelectTrigger>
                    <SelectContent>
                      {mockLojas[selectedParceiro!]?.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
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
              <Label>Lojas Associadas (Múltipla Seleção)</Label>
              <div className="space-y-2">
                <Select onValueChange={handleAddLoja} disabled={!selectedParceiro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione lojas para adicionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockLojas[selectedParceiro!]?.filter(l => !selectedLojas.includes(l.id)).map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
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
