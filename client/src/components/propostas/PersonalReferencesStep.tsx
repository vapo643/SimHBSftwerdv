import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProposal, useProposalActions } from "@/contexts/ProposalContext";
import { Users, Plus, Trash2 } from "lucide-react";
import { MaskedInput } from "@/components/ui/MaskedInput";

export function PersonalReferencesStep() {
  const { state } = useProposal();
  const { addReference, updateReference, removeReference, setError, clearError } =
    useProposalActions();
  const { personalReferences, errors } = state;

  // Ensure at least one reference exists
  React.useEffect(() => {
    if (personalReferences.length === 0) {
      addReference({
        nomeCompleto: "",
        grauParentesco: "",
        telefone: "",
      });
    }
  }, [personalReferences.length, addReference]);

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
    const errorKey = `reference_${index}_${field}`;
    if (!value || value.trim() === "") {
      setError(
        errorKey,
        `${field === "nomeCompleto" ? "Nome" : field === "grauParentesco" ? "Grau de parentesco" : "Telefone"} é obrigatório`
      );
    } else {
      clearError(errorKey);
    }
  };

  const handleAddReference = () => {
    if (personalReferences.length < 3) {
      addReference({
        nomeCompleto: "",
        grauParentesco: "",
        telefone: "",
      });
    }
  };

  const handleRemoveReference = (index: number) => {
    if (personalReferences.length > 1) {
      removeReference(index);
      // Clear any errors for this reference
      clearError(`reference_${index}_nomeCompleto`);
      clearError(`reference_${index}_grauParentesco`);
      clearError(`reference_${index}_telefone`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Referências Pessoais
          </CardTitle>
          <CardDescription>Adicione pelo menos uma referência pessoal (máximo 3)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {personalReferences.map((reference, index) => (
            <div
              key={index}
              className="relative space-y-4 rounded-lg border border-border bg-muted p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium">Referência {index + 1}</h3>
                {personalReferences.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveReference(index)}
                    className="hover:text-destructive/80 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor={`nomeCompleto_${index}`}>Nome Completo *</Label>
                  <Input
                    id={`nomeCompleto_${index}`}
                    type="text"
                    value={reference.nomeCompleto}
                    onChange={e => handleReferenceChange(index, "nomeCompleto", e.target.value)}
                    className={
                      errors[`reference_${index}_nomeCompleto`] ? "border-destructive" : ""
                    }
                  />
                  {errors[`reference_${index}_nomeCompleto`] && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors[`reference_${index}_nomeCompleto`]}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`grauParentesco_${index}`}>Grau de Parentesco *</Label>
                  <Select
                    value={reference.grauParentesco}
                    onValueChange={value => handleReferenceChange(index, "grauParentesco", value)}
                  >
                    <SelectTrigger
                      className={
                        errors[`reference_${index}_grauParentesco`] ? "border-destructive" : ""
                      }
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
                  {errors[`reference_${index}_grauParentesco`] && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors[`reference_${index}_grauParentesco`]}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor={`telefone_${index}`}>Telefone *</Label>
                  <MaskedInput
                    mask="(99) 99999-9999"
                    value={reference.telefone}
                    onChange={(value) => handleReferenceChange(index, "telefone", value)}
                    placeholder="(11) 98765-4321"
                    className={
                      errors[`reference_${index}_telefone`] ? "border-destructive" : ""
                    }
                    data-testid={`input-telefone-referencia-${index}`}
                  />
                  {errors[`reference_${index}_telefone`] && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors[`reference_${index}_telefone`]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {personalReferences.length < 3 && (
            <Button type="button" variant="outline" onClick={handleAddReference} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Referência
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
