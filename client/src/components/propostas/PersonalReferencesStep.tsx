import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProposal, useProposalActions } from "@/contexts/ProposalContext";
import { Users, Briefcase } from "lucide-react";
import { MaskedInput } from "@/components/ui/MaskedInput";

export function PersonalReferencesStep() {
  const { state } = useProposal();
  const { addReference, updateReference, removeReference, setError, clearError } =
    useProposalActions();
  const { personalReferences, errors } = state;

  // PAM V1.0: Garantir exatamente 2 referências (uma pessoal e uma profissional)
  React.useEffect(() => {
    if (personalReferences.length === 0) {
      // Criar referência pessoal
      addReference({
        nomeCompleto: "",
        grauParentesco: "",
        telefone: "",
        tipo_referencia: "pessoal",
      });
      // Criar referência profissional
      addReference({
        nomeCompleto: "",
        grauParentesco: "",
        telefone: "",
        tipo_referencia: "profissional",
      });
    } else if (personalReferences.length === 1) {
      // Se tiver apenas uma, adicionar a segunda
      const tipoExistente = personalReferences[0].tipo_referencia;
      addReference({
        nomeCompleto: "",
        grauParentesco: "",
        telefone: "",
        tipo_referencia: tipoExistente === "pessoal" ? "profissional" : "pessoal",
      });
    }
    // Limpar referências extras se houver mais de 2
    while (personalReferences.length > 2) {
      removeReference(personalReferences.length - 1);
    }
  }, [personalReferences.length, addReference, removeReference]);

  const handleReferenceChange = (
    index: number,
    field: keyof (typeof personalReferences)[0],
    value: string
  ) => {
    const updatedReference = {
      ...personalReferences[index],
      [field]: value,
    };
    updateReference(index, updatedReference);

    // Validate the field
    const tipo = personalReferences[index]?.tipo_referencia || "pessoal";
    const errorKey = `reference_${tipo}_${field}`;
    if (!value || value.trim() === "") {
      const fieldLabel = field === "nomeCompleto" ? "Nome" : 
                        field === "grauParentesco" ? (tipo === "pessoal" ? "Grau de parentesco" : "Relação profissional") : 
                        "Telefone";
      setError(errorKey, `${fieldLabel} é obrigatório`);
    } else {
      clearError(errorKey);
    }
  };

  // Separar referências por tipo para facilitar renderização
  const referencePessoal = personalReferences.find(ref => ref.tipo_referencia === "pessoal");
  const referenceProfissional = personalReferences.find(ref => ref.tipo_referencia === "profissional");
  const indexPessoal = personalReferences.findIndex(ref => ref.tipo_referencia === "pessoal");
  const indexProfissional = personalReferences.findIndex(ref => ref.tipo_referencia === "profissional");

  return (
    <div className="space-y-6">
      {/* Referência Pessoal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Referência Pessoal
          </CardTitle>
          <CardDescription>Informações de contato de uma referência pessoal (obrigatório)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {referencePessoal && indexPessoal !== -1 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="nomeCompleto_pessoal">Nome Completo *</Label>
                <Input
                  id="nomeCompleto_pessoal"
                  type="text"
                  value={referencePessoal.nomeCompleto}
                  onChange={e => handleReferenceChange(indexPessoal, "nomeCompleto", e.target.value)}
                  className={errors["reference_pessoal_nomeCompleto"] ? "border-destructive" : ""}
                  data-testid="input-nome-referencia-pessoal"
                />
                {errors["reference_pessoal_nomeCompleto"] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors["reference_pessoal_nomeCompleto"]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="grauParentesco_pessoal">Grau de Parentesco *</Label>
                <Select
                  value={referencePessoal.grauParentesco}
                  onValueChange={value => handleReferenceChange(indexPessoal, "grauParentesco", value)}
                >
                  <SelectTrigger
                    className={errors["reference_pessoal_grauParentesco"] ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mae">Mãe</SelectItem>
                    <SelectItem value="pai">Pai</SelectItem>
                    <SelectItem value="irmao">Irmão(ã)</SelectItem>
                    <SelectItem value="conjuge">Cônjuge</SelectItem>
                    <SelectItem value="filho">Filho(a)</SelectItem>
                    <SelectItem value="amigo">Amigo(a)</SelectItem>
                    <SelectItem value="tio">Tio(a)</SelectItem>
                    <SelectItem value="primo">Primo(a)</SelectItem>
                    <SelectItem value="sogro">Sogro(a)</SelectItem>
                    <SelectItem value="cunhado">Cunhado(a)</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
                {errors["reference_pessoal_grauParentesco"] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors["reference_pessoal_grauParentesco"]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="telefone_pessoal">Telefone *</Label>
                <MaskedInput
                  mask="(99) 99999-9999"
                  value={referencePessoal.telefone}
                  onChange={(value) => handleReferenceChange(indexPessoal, "telefone", value)}
                  placeholder="(11) 98765-4321"
                  className={errors["reference_pessoal_telefone"] ? "border-destructive" : ""}
                  data-testid="input-telefone-referencia-pessoal"
                />
                {errors["reference_pessoal_telefone"] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors["reference_pessoal_telefone"]}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referência Profissional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Referência Profissional
          </CardTitle>
          <CardDescription>Informações de contato de uma referência profissional (obrigatório)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {referenceProfissional && indexProfissional !== -1 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="nomeCompleto_profissional">Nome Completo *</Label>
                <Input
                  id="nomeCompleto_profissional"
                  type="text"
                  value={referenceProfissional.nomeCompleto}
                  onChange={e => handleReferenceChange(indexProfissional, "nomeCompleto", e.target.value)}
                  className={errors["reference_profissional_nomeCompleto"] ? "border-destructive" : ""}
                  data-testid="input-nome-referencia-profissional"
                />
                {errors["reference_profissional_nomeCompleto"] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors["reference_profissional_nomeCompleto"]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="grauParentesco_profissional">Relação Profissional *</Label>
                <Select
                  value={referenceProfissional.grauParentesco}
                  onValueChange={value => handleReferenceChange(indexProfissional, "grauParentesco", value)}
                >
                  <SelectTrigger
                    className={errors["reference_profissional_grauParentesco"] ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supervisor">Supervisor/Gerente</SelectItem>
                    <SelectItem value="colega">Colega de Trabalho</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="parceiro">Parceiro de Negócios</SelectItem>
                    <SelectItem value="chefe">Chefe Direto</SelectItem>
                    <SelectItem value="subordinado">Subordinado</SelectItem>
                    <SelectItem value="rh">Recursos Humanos</SelectItem>
                    <SelectItem value="outro_profissional">Outro</SelectItem>
                  </SelectContent>
                </Select>
                {errors["reference_profissional_grauParentesco"] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors["reference_profissional_grauParentesco"]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="telefone_profissional">Telefone *</Label>
                <MaskedInput
                  mask="(99) 99999-9999"
                  value={referenceProfissional.telefone}
                  onChange={(value) => handleReferenceChange(indexProfissional, "telefone", value)}
                  placeholder="(11) 98765-4321"
                  className={errors["reference_profissional_telefone"] ? "border-destructive" : ""}
                  data-testid="input-telefone-referencia-profissional"
                />
                {errors["reference_profissional_telefone"] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors["reference_profissional_telefone"]}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
