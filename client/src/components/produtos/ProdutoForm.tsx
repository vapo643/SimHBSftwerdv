
<old_str>import { useForm } from "react-hook-form";
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

const produtoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  status: z.enum(["ativo", "inativo"], { 
    errorMap: () => ({ message: "Status deve ser 'ativo' ou 'inativo'" })
  })
});

type ProdutoFormData = z.infer<typeof produtoSchema>;

interface ProdutoFormProps {
  produto?: {
    id: number;
    nome: string;
    status: "ativo" | "inativo";
    createdAt: string;
    updatedAt: string;
  } | null;
  onSubmit: (data: ProdutoFormData) => void;
  onCancel: () => void;
}

export function ProdutoForm({ produto, onSubmit, onCancel }: ProdutoFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProdutoFormData>({
    resolver: zodResolver(produtoSchema),
    defaultValues: produto ? {
      nome: produto.nome,
      status: produto.status,
    } : {
      nome: "",
      status: "ativo",
    },
  });

  const statusValue = watch("status");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome do Produto</Label>
        <Input
          id="nome"
          {...register("nome")}
          placeholder="Digite o nome do produto"
        />
        {errors.nome && (
          <p className="text-sm text-red-500 mt-1">{errors.nome.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={statusValue}
          onValueChange={(value: "ativo" | "inativo") => setValue("status", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        {errors.status && (
          <p className="text-sm text-red-500 mt-1">{errors.status.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {produto ? "Atualizar" : "Criar"} Produto
        </Button>
      </div>
    </form>
  );
}</old_str>
<new_str>import { useForm } from "react-hook-form";
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

const produtoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  status: z.enum(["ativo", "inativo"], { 
    errorMap: () => ({ message: "Status deve ser 'ativo' ou 'inativo'" })
  })
});

type ProdutoFormData = z.infer<typeof produtoSchema>;

interface ProdutoFormProps {
  produto?: {
    id: number;
    nome: string;
    status: "ativo" | "inativo";
    createdAt: string;
    updatedAt: string;
  } | null;
  onSubmit: (data: ProdutoFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ProdutoForm({ produto, onSubmit, onCancel, isSubmitting = false }: ProdutoFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProdutoFormData>({
    resolver: zodResolver(produtoSchema),
    defaultValues: produto ? {
      nome: produto.nome,
      status: produto.status,
    } : {
      nome: "",
      status: "ativo",
    },
  });

  const statusValue = watch("status");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome do Produto</Label>
        <Input
          id="nome"
          {...register("nome")}
          placeholder="Digite o nome do produto"
          disabled={isSubmitting}
        />
        {errors.nome && (
          <p className="text-sm text-red-500 mt-1">{errors.nome.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={statusValue}
          onValueChange={(value: "ativo" | "inativo") => setValue("status", value)}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        {errors.status && (
          <p className="text-sm text-red-500 mt-1">{errors.status.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting 
            ? `${produto ? "Atualizando" : "Criando"}...` 
            : `${produto ? "Atualizar" : "Criar"} Produto`
          }
        </Button>
      </div>
    </form>
  );
}</new_str>
