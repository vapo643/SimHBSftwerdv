import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProposal, useProposalActions } from '@/contexts/ProposalContext';
import { Users, Briefcase } from 'lucide-react';
import { MaskedInput } from '@/components/ui/MaskedInput';

export function PersonalReferencesStep() {
  const { state } = useProposal();
  const { addReference, updateReference, removeReference, setError, clearError } =
    useProposalActions();
  const { personalReferences, errors, clientData } = state;
  
  // 🎆 AUTO-PREENCHIMENTO: Preencher referências se cliente já existe
  const [referenciasPreenchidas, setReferenciasPreenchidas] = React.useState(false);

  // PAM V1.1: Garantir exatamente 2 referências (primeira pessoal, segunda flexível)
  React.useEffect(() => {
    if (personalReferences.length === 0) {
      // Criar primeira referência (obrigatoriamente pessoal)
      addReference({
        nomeCompleto: '',
        grauParentesco: '',
        telefone: '',
        tipo_referencia: 'pessoal',
      });
      // Criar segunda referência (padrão profissional, mas pode ser alterada)
      addReference({
        nomeCompleto: '',
        grauParentesco: '',
        telefone: '',
        tipo_referencia: 'profissional',
      });
    } else if (personalReferences.length === 1) {
      // Se tiver apenas uma, garantir que a primeira seja pessoal e adicionar a segunda
      if (personalReferences[0].tipo_referencia !== 'pessoal') {
        updateReference(0, { ...personalReferences[0], tipo_referencia: 'pessoal' });
      }
      // Adicionar segunda referência (padrão profissional)
      addReference({
        nomeCompleto: '',
        grauParentesco: '',
        telefone: '',
        tipo_referencia: 'profissional',
      });
    } else if (personalReferences.length >= 2) {
      // Garantir que a primeira seja sempre pessoal
      if (personalReferences[0].tipo_referencia !== 'pessoal') {
        updateReference(0, { ...personalReferences[0], tipo_referencia: 'pessoal' });
      }
    }
    // Limpar referências extras se houver mais de 2
    while (personalReferences.length > 2) {
      removeReference(personalReferences.length - 1);
    }
  }, [personalReferences.length, addReference, removeReference, updateReference]);
  
  // REMOVIDO: Auto-preenchimento de referências até que dados reais sejam implementados na API

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
    const tipo = personalReferences[index]?.tipo_referencia || 'pessoal';
    const errorKey = `reference_${tipo}_${field}`;
    if (!value || value.trim() === '') {
      const fieldLabel =
        field === 'nomeCompleto'
          ? 'Nome'
          : field === 'grauParentesco'
            ? tipo === 'pessoal'
              ? 'Grau de parentesco'
              : 'Relação profissional'
            : 'Telefone';
      setError(errorKey, `${fieldLabel} é obrigatório`);
    } else {
      clearError(errorKey);
    }
  };

  // PAM V1.1: Separar referências por posição (primeira sempre pessoal, segunda flexível)
  const referencePessoal = personalReferences[0]; // Primeira referência (sempre pessoal)
  const segundaReferencia = personalReferences[1]; // Segunda referência (pessoal ou profissional)
  const indexPessoal = 0;
  const indexSegundaReferencia = 1;

  return (
    <div className="space-y-6">
      {/* Referência Pessoal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Referência Pessoal
          </CardTitle>
          <CardDescription>
            Informações de contato de uma referência pessoal (obrigatório)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {referencePessoal && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="nomeCompleto_pessoal">Nome Completo *</Label>
                <Input
                  id="nomeCompleto_pessoal"
                  type="text"
                  value={referencePessoal.nomeCompleto}
                  onChange={(e) =>
                    handleReferenceChange(indexPessoal, 'nomeCompleto', e.target.value)
                  }
                  className={errors['reference_pessoal_nomeCompleto'] ? 'border-destructive' : ''}
                  data-testid="input-nome-referencia-pessoal"
                />
                {errors['reference_pessoal_nomeCompleto'] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors['reference_pessoal_nomeCompleto']}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="grauParentesco_pessoal">Grau de Parentesco *</Label>
                <Select
                  value={referencePessoal.grauParentesco}
                  onValueChange={(value) =>
                    handleReferenceChange(indexPessoal, 'grauParentesco', value)
                  }
                >
                  <SelectTrigger
                    className={
                      errors['reference_pessoal_grauParentesco'] ? 'border-destructive' : ''
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
                {errors['reference_pessoal_grauParentesco'] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors['reference_pessoal_grauParentesco']}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="telefone_pessoal">Telefone *</Label>
                <MaskedInput
                  mask="(99) 99999-9999"
                  value={referencePessoal.telefone}
                  onChange={(value) => handleReferenceChange(indexPessoal, 'telefone', value)}
                  placeholder="(11) 98765-4321"
                  className={errors['reference_pessoal_telefone'] ? 'border-destructive' : ''}
                  data-testid="input-telefone-referencia-pessoal"
                />
                {errors['reference_pessoal_telefone'] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors['reference_pessoal_telefone']}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Segunda Referência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Segunda Referência
          </CardTitle>
          <CardDescription>
            Informações de contato de uma segunda referência - pode ser pessoal ou profissional
            (obrigatório)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {segundaReferencia && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Seletor de Tipo de Referência */}
              <div>
                <Label htmlFor="tipo_segunda_referencia">Tipo de Referência *</Label>
                <Select
                  value={segundaReferencia.tipo_referencia}
                  onValueChange={(value) =>
                    handleReferenceChange(indexSegundaReferencia, 'tipo_referencia', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pessoal">Pessoal</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="nomeCompleto_segunda">Nome Completo *</Label>
                <Input
                  id="nomeCompleto_segunda"
                  type="text"
                  value={segundaReferencia.nomeCompleto}
                  onChange={(e) =>
                    handleReferenceChange(indexSegundaReferencia, 'nomeCompleto', e.target.value)
                  }
                  className={
                    errors[`reference_${segundaReferencia.tipo_referencia}_nomeCompleto`]
                      ? 'border-destructive'
                      : ''
                  }
                  data-testid="input-nome-segunda-referencia"
                />
                {errors[`reference_${segundaReferencia.tipo_referencia}_nomeCompleto`] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors[`reference_${segundaReferencia.tipo_referencia}_nomeCompleto`]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="grauParentesco_segunda">
                  {segundaReferencia.tipo_referencia === 'pessoal'
                    ? 'Grau de Parentesco *'
                    : 'Relação Profissional *'}
                </Label>
                <Select
                  value={segundaReferencia.grauParentesco}
                  onValueChange={(value) =>
                    handleReferenceChange(indexSegundaReferencia, 'grauParentesco', value)
                  }
                >
                  <SelectTrigger
                    className={
                      errors[`reference_${segundaReferencia.tipo_referencia}_grauParentesco`]
                        ? 'border-destructive'
                        : ''
                    }
                  >
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {segundaReferencia.tipo_referencia === 'pessoal' ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        <SelectItem value="supervisor">Supervisor/Gerente</SelectItem>
                        <SelectItem value="colega">Colega de Trabalho</SelectItem>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="parceiro">Parceiro de Negócios</SelectItem>
                        <SelectItem value="chefe">Chefe Direto</SelectItem>
                        <SelectItem value="subordinado">Subordinado</SelectItem>
                        <SelectItem value="rh">Recursos Humanos</SelectItem>
                        <SelectItem value="outro_profissional">Outro</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {errors[`reference_${segundaReferencia.tipo_referencia}_grauParentesco`] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors[`reference_${segundaReferencia.tipo_referencia}_grauParentesco`]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="telefone_segunda">Telefone *</Label>
                <MaskedInput
                  mask="(99) 99999-9999"
                  value={segundaReferencia.telefone}
                  onChange={(value) =>
                    handleReferenceChange(indexSegundaReferencia, 'telefone', value)
                  }
                  placeholder="(11) 98765-4321"
                  className={
                    errors[`reference_${segundaReferencia.tipo_referencia}_telefone`]
                      ? 'border-destructive'
                      : ''
                  }
                  data-testid="input-telefone-segunda-referencia"
                />
                {errors[`reference_${segundaReferencia.tipo_referencia}_telefone`] && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors[`reference_${segundaReferencia.tipo_referencia}_telefone`]}
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
