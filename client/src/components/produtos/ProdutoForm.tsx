import { useForm } from "react-hook-form";
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

export default function ProdutoForm({ produto, onSubmit, onCancel, isSubmitting = false }: ProdutoFormProps) {
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

  const handleFormSubmit = (data: ProdutoFormData) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome do Produto</Label>
        <Input
          id="nome"
          {...register("nome")}
          disabled={isSubmitting}
          placeholder="Digite o nome do produto"
        />
        {errors.nome && (
          <p className="text-sm text-red-600 mt-1">{errors.nome.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          onValueChange={(value) => setValue("status", value as "ativo" | "inativo")}
          defaultValue={watch("status")}
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
          <p className="text-sm text-red-600 mt-1">{errors.status.message}</p>
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? produto
              ? "Atualizando..."
              : "Criando..."
            : produto
            ? "Atualizar"
            : "Criar"
          }
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}