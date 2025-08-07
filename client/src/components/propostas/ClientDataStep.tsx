import React, { useState, useCallback } from "react";
import { useProposal, useProposalActions } from "@/contexts/ProposalContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  Building2, 
  CreditCard,
  Smartphone,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import CurrencyInput from "@/components/ui/CurrencyInput";
import InputMask from "react-input-mask";
import axios from "axios";
import { cpf as cpfValidator, cnpj as cnpjValidator } from "cpf-cnpj-validator";

// Validation helpers
const validateCPF = (cpf: string): { isValid: boolean; message: string | null } => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length === 0) return { isValid: false, message: null };
  if (cleanCPF.length < 11) return { isValid: false, message: 'CPF deve ter 11 dígitos' };
  if (cleanCPF.length > 11) return { isValid: false, message: 'CPF inválido' };
  
  const isValid = cpfValidator.isValid(cpf);
  return {
    isValid,
    message: isValid ? null : 'CPF inválido'
  };
};

const validateCNPJ = (cnpj: string): { isValid: boolean; message: string | null } => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length === 0) return { isValid: false, message: null };
  if (cleanCNPJ.length < 14) return { isValid: false, message: 'CNPJ deve ter 14 dígitos' };
  if (cleanCNPJ.length > 14) return { isValid: false, message: 'CNPJ inválido' };
  
  const isValid = cnpjValidator.isValid(cnpj);
  return {
    isValid,
    message: isValid ? null : 'CNPJ inválido'
  };
};

const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'Email é obrigatório';
  if (!emailRegex.test(email)) return 'Email inválido';
  return null;
};

const validatePhone = (phone: string): string | null => {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) return 'Telefone deve ter pelo menos 10 dígitos';
  return null;
};

const validateCEP = (cep: string): string | null => {
  const cleanCEP = cep.replace(/\D/g, '');
  if (cleanCEP.length < 8) return 'CEP deve ter 8 dígitos';
  return null;
};

export function ClientDataStep() {
  const { state } = useProposal();
  const { updateClient, setError, clearError } = useProposalActions();
  const { clientData, errors } = state;
  
  // Estados para validação visual
  const [cpfValidation, setCpfValidation] = useState<{ isValid: boolean; message: string | null }>({ isValid: false, message: null });
  const [cnpjValidation, setCnpjValidation] = useState<{ isValid: boolean; message: string | null }>({ isValid: false, message: null });
  const [loadingCep, setLoadingCep] = useState(false);
  
  // Função para buscar CEP
  const fetchAddressByCep = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    
    setLoadingCep(true);
    try {
      const response = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = response.data;
      
      if (!data.erro) {
        // Auto-preencher os campos de endereço
        updateClient({
          logradouro: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
        });
        
        clearError('cep');
      } else {
        setError('cep', 'CEP não encontrado');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      setError('cep', 'Erro ao buscar CEP');
    } finally {
      setLoadingCep(false);
    }
  }, [updateClient, setError, clearError]);

  // Handlers
  const handleTipoPessoaChange = (checked: boolean) => {
    updateClient({ 
      tipoPessoa: checked ? 'PJ' : 'PF',
      // Clear PJ fields if switching to PF
      ...(!checked && { razaoSocial: '', cnpj: '' })
    });
  };

  const handleCPFChange = (value: string) => {
    updateClient({ cpf: value });
    const validation = validateCPF(value);
    setCpfValidation(validation);
    
    if (validation.message) {
      setError('cpf', validation.message);
    } else {
      clearError('cpf');
    }
  };

  const handleCNPJChange = (value: string) => {
    updateClient({ cnpj: value });
    const validation = validateCNPJ(value);
    setCnpjValidation(validation);
    
    if (validation.message) {
      setError('cnpj', validation.message);
    } else {
      clearError('cnpj');
    }
  };

  const handleEmailChange = (value: string) => {
    updateClient({ email: value });
    const error = validateEmail(value);
    if (error) {
      setError('email', error);
    } else {
      clearError('email');
    }
  };

  const handlePhoneChange = (value: string) => {
    updateClient({ telefone: value });
    const error = validatePhone(value);
    if (error) {
      setError('telefone', error);
    } else {
      clearError('telefone');
    }
  };

  const handleCEPChange = (value: string) => {
    updateClient({ cep: value });
    const error = validateCEP(value);
    if (error) {
      setError('cep', error);
    } else {
      clearError('cep');
      // Auto-buscar endereço quando CEP for válido
      const cleanCep = value.replace(/\D/g, '');
      if (cleanCep.length === 8) {
        fetchAddressByCep(value);
      }
    }
  };

  const handleNameChange = (value: string) => {
    updateClient({ nome: value });
    if (!value || value.trim().length === 0) {
      setError('nome', 'Nome é obrigatório');
    } else {
      clearError('nome');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tipo de Pessoa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tipo de Pessoa
          </CardTitle>
          <CardDescription>
            Selecione se é Pessoa Física ou Jurídica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Label htmlFor="tipo-pessoa" className="text-base">Pessoa Física</Label>
            <Switch
              id="tipo-pessoa"
              checked={clientData.tipoPessoa === 'PJ'}
              onCheckedChange={handleTipoPessoaChange}
              data-testid="switch-tipo-pessoa"
            />
            <Label htmlFor="tipo-pessoa" className="text-base">Pessoa Jurídica</Label>
          </div>
        </CardContent>
      </Card>

      {/* Dados Pessoais / Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {clientData.tipoPessoa === 'PJ' ? 'Dados da Empresa' : 'Dados Pessoais'}
          </CardTitle>
          <CardDescription>
            {clientData.tipoPessoa === 'PJ' ? 'Informações da empresa' : 'Informações básicas do cliente'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clientData.tipoPessoa === 'PJ' ? (
            <>
              <div className="md:col-span-2">
                <Label htmlFor="razaoSocial">Razão Social *</Label>
                <Input
                  id="razaoSocial"
                  type="text"
                  value={clientData.razaoSocial || ''}
                  onChange={(e) => updateClient({ razaoSocial: e.target.value })}
                  placeholder="Nome da empresa"
                  data-testid="input-razao-social"
                />
              </div>
              <div>
                <Label htmlFor="cnpj">CNPJ *</Label>
                <div className="relative">
                  <InputMask
                    mask="99.999.999/9999-99"
                    value={clientData.cnpj || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCNPJChange(e.target.value)}
                  >
                    {(inputProps: any) => (
                      <Input
                        {...inputProps}
                        id="cnpj"
                        type="text"
                        placeholder="00.000.000/0000-00"
                        className={`${
                          errors.cnpj ? "border-destructive focus:border-destructive" : 
                          cnpjValidation.isValid && clientData.cnpj ? "border-green-500 focus:border-green-500" : ""
                        } pr-10`}
                        data-testid="input-cnpj"
                      />
                    )}
                  </InputMask>
                  {clientData.cnpj && cnpjValidation.message === null && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {cnpjValidation.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {errors.cnpj && <p className="mt-1 text-sm text-destructive">{errors.cnpj}</p>}
                {clientData.cnpj && !errors.cnpj && (
                  <p className={`mt-1 text-xs flex items-center gap-1 ${
                    cnpjValidation.isValid ? "text-green-600" : "text-red-600"
                  }`}>
                    {cnpjValidation.isValid ? (
                      <><CheckCircle2 className="h-3 w-3" /> CNPJ válido</>
                    ) : (
                      <><XCircle className="h-3 w-3" /> CNPJ inválido</>
                    )}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="nome">Representante Legal *</Label>
                <Input
                  id="nome"
                  type="text"
                  value={clientData.nome}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={errors.nome ? "border-destructive focus:border-destructive" : ""}
                  placeholder="Nome do representante"
                  data-testid="input-nome-representante"
                />
                {errors.nome && <p className="mt-1 text-sm text-destructive">{errors.nome}</p>}
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <div className="relative">
                  <InputMask
                    mask="999.999.999-99"
                    value={clientData.cpf}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCPFChange(e.target.value)}
                  >
                    {(inputProps: any) => (
                      <Input
                        {...inputProps}
                        id="cpf"
                        type="text"
                        placeholder="000.000.000-00"
                        className={`${
                          errors.cpf ? "border-destructive focus:border-destructive" : 
                          cpfValidation.isValid && clientData.cpf ? "border-green-500 focus:border-green-500" : ""
                        } pr-10`}
                        data-testid="input-cpf"
                      />
                    )}
                  </InputMask>
                  {clientData.cpf && cpfValidation.message === null && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {cpfValidation.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {errors.cpf && <p className="mt-1 text-sm text-destructive">{errors.cpf}</p>}
                {clientData.cpf && !errors.cpf && (
                  <p className={`mt-1 text-xs flex items-center gap-1 ${
                    cpfValidation.isValid ? "text-green-600" : "text-red-600"
                  }`}>
                    {cpfValidation.isValid ? (
                      <><CheckCircle2 className="h-3 w-3" /> CPF válido</>
                    ) : (
                      <><XCircle className="h-3 w-3" /> CPF inválido</>
                    )}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  type="text"
                  value={clientData.nome}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={errors.nome ? "border-destructive focus:border-destructive" : ""}
                  data-testid="input-nome"
                />
                {errors.nome && <p className="mt-1 text-sm text-destructive">{errors.nome}</p>}
              </div>
            </>
          )}

          <div>
            <Label htmlFor="dataNascimento">Data de Nascimento</Label>
            <Input
              id="dataNascimento"
              type="date"
              value={clientData.dataNascimento}
              onChange={(e) => updateClient({ dataNascimento: e.target.value })}
              className={errors.dataNascimento ? "border-red-500" : ""}
              data-testid="input-data-nascimento"
            />
            {errors.dataNascimento && <p className="mt-1 text-sm text-red-500">{errors.dataNascimento}</p>}
          </div>

          <div>
            <Label htmlFor="localNascimento">Local de Nascimento</Label>
            <Input
              id="localNascimento"
              type="text"
              placeholder="Cidade - UF"
              value={clientData.localNascimento}
              onChange={(e) => updateClient({ localNascimento: e.target.value })}
              data-testid="input-local-nascimento"
            />
          </div>

          <div>
            <Label htmlFor="estadoCivil">Estado Civil</Label>
            <Select
              value={clientData.estadoCivil}
              onValueChange={(value) => updateClient({ estadoCivil: value })}
            >
              <SelectTrigger data-testid="select-estado-civil">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                <SelectItem value="casado">Casado(a)</SelectItem>
                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                <SelectItem value="uniao_estavel">União Estável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nacionalidade">Nacionalidade</Label>
            <Input
              id="nacionalidade"
              type="text"
              value={clientData.nacionalidade}
              onChange={(e) => updateClient({ nacionalidade: e.target.value })}
              data-testid="input-nacionalidade"
            />
          </div>
        </CardContent>
      </Card>

      {/* Documentação Completa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documento de Identidade
          </CardTitle>
          <CardDescription>
            Informações completas do RG
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="rg">RG</Label>
            <Input
              id="rg"
              type="text"
              value={clientData.rg}
              onChange={(e) => updateClient({ rg: e.target.value })}
              data-testid="input-rg"
            />
          </div>

          <div>
            <Label htmlFor="orgaoEmissor">Órgão Emissor</Label>
            <Input
              id="orgaoEmissor"
              type="text"
              placeholder="SSP, Detran, etc."
              value={clientData.orgaoEmissor}
              onChange={(e) => updateClient({ orgaoEmissor: e.target.value })}
              data-testid="input-orgao-emissor"
            />
          </div>

          <div>
            <Label htmlFor="rgUf">UF de Emissão</Label>
            <Select
              value={clientData.rgUf}
              onValueChange={(value) => updateClient({ rgUf: value })}
            >
              <SelectTrigger data-testid="select-rg-uf">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AC">AC</SelectItem>
                <SelectItem value="AL">AL</SelectItem>
                <SelectItem value="AP">AP</SelectItem>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="BA">BA</SelectItem>
                <SelectItem value="CE">CE</SelectItem>
                <SelectItem value="DF">DF</SelectItem>
                <SelectItem value="ES">ES</SelectItem>
                <SelectItem value="GO">GO</SelectItem>
                <SelectItem value="MA">MA</SelectItem>
                <SelectItem value="MT">MT</SelectItem>
                <SelectItem value="MS">MS</SelectItem>
                <SelectItem value="MG">MG</SelectItem>
                <SelectItem value="PA">PA</SelectItem>
                <SelectItem value="PB">PB</SelectItem>
                <SelectItem value="PR">PR</SelectItem>
                <SelectItem value="PE">PE</SelectItem>
                <SelectItem value="PI">PI</SelectItem>
                <SelectItem value="RJ">RJ</SelectItem>
                <SelectItem value="RN">RN</SelectItem>
                <SelectItem value="RS">RS</SelectItem>
                <SelectItem value="RO">RO</SelectItem>
                <SelectItem value="RR">RR</SelectItem>
                <SelectItem value="SC">SC</SelectItem>
                <SelectItem value="SP">SP</SelectItem>
                <SelectItem value="SE">SE</SelectItem>
                <SelectItem value="TO">TO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="rgDataEmissao">Data de Emissão do RG</Label>
            <Input
              id="rgDataEmissao"
              type="date"
              value={clientData.rgDataEmissao}
              onChange={(e) => updateClient({ rgDataEmissao: e.target.value })}
              data-testid="input-rg-data-emissao"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contato
          </CardTitle>
          <CardDescription>
            Informações de contato
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="telefone">Telefone/WhatsApp *</Label>
            <InputMask
              mask="(99) 99999-9999"
              value={clientData.telefone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePhoneChange(e.target.value)}
            >
              {(inputProps: any) => (
                <Input
                  {...inputProps}
                  id="telefone"
                  type="tel"
                  placeholder="(11) 98765-4321"
                  className={errors.telefone ? "border-destructive focus:border-destructive" : ""}
                  data-testid="input-telefone"
                />
              )}
            </InputMask>
            {errors.telefone && <p className="mt-1 text-sm text-destructive">{errors.telefone}</p>}
          </div>

          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={clientData.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              className={errors.email ? "border-destructive focus:border-destructive" : ""}
              data-testid="input-email"
            />
            {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Endereço Detalhado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Endereço Detalhado
          </CardTitle>
          <CardDescription>
            Endereço completo para o CCB
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cep">CEP</Label>
            <div className="relative">
              <InputMask
                mask="99999-999"
                value={clientData.cep}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCEPChange(e.target.value)}
              >
                {(inputProps: any) => (
                  <Input
                    {...inputProps}
                    id="cep"
                    type="text"
                    placeholder="00000-000"
                    className={`${
                      errors.cep ? "border-destructive focus:border-destructive" : 
                      clientData.logradouro && !loadingCep ? "border-green-500 focus:border-green-500" : ""
                    } pr-10`}
                    data-testid="input-cep"
                  />
                )}
              </InputMask>
              {loadingCep && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                </div>
              )}
              {!loadingCep && clientData.logradouro && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
            {errors.cep && <p className="mt-1 text-sm text-destructive">{errors.cep}</p>}
            {loadingCep && (
              <p className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando endereço...
              </p>
            )}
            {!loadingCep && clientData.logradouro && !errors.cep && (
              <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Endereço encontrado e preenchido automaticamente
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="logradouro">Logradouro (Rua/Avenida)</Label>
            <Input
              id="logradouro"
              type="text"
              placeholder="Ex: Rua das Flores, Avenida Brasil"
              value={clientData.logradouro}
              onChange={(e) => updateClient({ logradouro: e.target.value })}
              className={errors.logradouro ? "border-destructive" : ""}
              data-testid="input-logradouro"
            />
            {errors.logradouro && <p className="mt-1 text-sm text-destructive">{errors.logradouro}</p>}
          </div>

          <div>
            <Label htmlFor="numero">Número</Label>
            <Input
              id="numero"
              type="text"
              value={clientData.numero}
              onChange={(e) => updateClient({ numero: e.target.value })}
              data-testid="input-numero"
            />
          </div>

          <div>
            <Label htmlFor="complemento">Complemento</Label>
            <Input
              id="complemento"
              type="text"
              placeholder="Apto, Bloco, Sala, etc."
              value={clientData.complemento}
              onChange={(e) => updateClient({ complemento: e.target.value })}
              data-testid="input-complemento"
            />
          </div>

          <div>
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              type="text"
              value={clientData.bairro}
              onChange={(e) => updateClient({ bairro: e.target.value })}
              data-testid="input-bairro"
            />
          </div>

          <div>
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              type="text"
              value={clientData.cidade}
              onChange={(e) => updateClient({ cidade: e.target.value })}
              data-testid="input-cidade"
            />
          </div>

          <div>
            <Label htmlFor="estado">Estado</Label>
            <Select
              value={clientData.estado}
              onValueChange={(value) => updateClient({ estado: value })}
            >
              <SelectTrigger data-testid="select-estado">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AC">Acre</SelectItem>
                <SelectItem value="AL">Alagoas</SelectItem>
                <SelectItem value="AP">Amapá</SelectItem>
                <SelectItem value="AM">Amazonas</SelectItem>
                <SelectItem value="BA">Bahia</SelectItem>
                <SelectItem value="CE">Ceará</SelectItem>
                <SelectItem value="DF">Distrito Federal</SelectItem>
                <SelectItem value="ES">Espírito Santo</SelectItem>
                <SelectItem value="GO">Goiás</SelectItem>
                <SelectItem value="MA">Maranhão</SelectItem>
                <SelectItem value="MT">Mato Grosso</SelectItem>
                <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
                <SelectItem value="MG">Minas Gerais</SelectItem>
                <SelectItem value="PA">Pará</SelectItem>
                <SelectItem value="PB">Paraíba</SelectItem>
                <SelectItem value="PR">Paraná</SelectItem>
                <SelectItem value="PE">Pernambuco</SelectItem>
                <SelectItem value="PI">Piauí</SelectItem>
                <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                <SelectItem value="RN">Rio Grande do Norte</SelectItem>
                <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                <SelectItem value="RO">Rondônia</SelectItem>
                <SelectItem value="RR">Roraima</SelectItem>
                <SelectItem value="SC">Santa Catarina</SelectItem>
                <SelectItem value="SP">São Paulo</SelectItem>
                <SelectItem value="SE">Sergipe</SelectItem>
                <SelectItem value="TO">Tocantins</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Dados Profissionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Dados Profissionais
          </CardTitle>
          <CardDescription>
            Informações sobre ocupação e renda
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ocupacao">Ocupação/Profissão</Label>
            <Input
              id="ocupacao"
              type="text"
              value={clientData.ocupacao}
              onChange={(e) => updateClient({ ocupacao: e.target.value })}
              className={errors.ocupacao ? "border-destructive" : ""}
              data-testid="input-ocupacao"
            />
            {errors.ocupacao && <p className="mt-1 text-sm text-destructive">{errors.ocupacao}</p>}
          </div>

          <div>
            <Label htmlFor="rendaMensal">Renda Mensal</Label>
            <CurrencyInput
              id="rendaMensal"
              value={clientData.rendaMensal}
              onChange={(e) => updateClient({ rendaMensal: e.target.value })}
              className={errors.rendaMensal ? "border-destructive" : ""}
              data-testid="input-renda-mensal"
            />
            {errors.rendaMensal && <p className="mt-1 text-sm text-destructive">{errors.rendaMensal}</p>}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="telefoneEmpresa">Telefone da Empresa</Label>
            <InputMask
              mask="(99) 9999-9999"
              value={clientData.telefoneEmpresa}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                updateClient({ telefoneEmpresa: e.target.value });
              }}
            >
              {(inputProps: any) => (
                <Input
                  {...inputProps}
                  id="telefoneEmpresa"
                  type="tel"
                  placeholder="(11) 3456-7890"
                  className={errors.telefoneEmpresa ? "border-destructive focus:border-destructive" : ""}
                  data-testid="input-telefone-empresa"
                />
              )}
            </InputMask>
            {errors.telefoneEmpresa && <p className="mt-1 text-sm text-destructive">{errors.telefoneEmpresa}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Dados de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Dados para Recebimento
          </CardTitle>
          <CardDescription>
            Escolha como deseja receber o valor do empréstimo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={clientData.metodoPagamento} onValueChange={(value: any) => updateClient({ metodoPagamento: value })}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="conta_bancaria" data-testid="tab-conta-bancaria">
                <CreditCard className="h-4 w-4 mr-2" />
                Conta Bancária
              </TabsTrigger>
              <TabsTrigger value="pix" data-testid="tab-pix">
                <Smartphone className="h-4 w-4 mr-2" />
                PIX
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conta_bancaria" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="banco">Banco</Label>
                  <Select
                    value={clientData.dadosPagamentoBanco || ''}
                    onValueChange={(value) => updateClient({ dadosPagamentoBanco: value })}
                  >
                    <SelectTrigger data-testid="select-banco">
                      <SelectValue placeholder="Selecione o banco..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="001">001 - Banco do Brasil</SelectItem>
                      <SelectItem value="033">033 - Santander</SelectItem>
                      <SelectItem value="104">104 - Caixa Econômica</SelectItem>
                      <SelectItem value="237">237 - Bradesco</SelectItem>
                      <SelectItem value="341">341 - Itaú</SelectItem>
                      <SelectItem value="077">077 - Inter</SelectItem>
                      <SelectItem value="260">260 - Nubank</SelectItem>
                      <SelectItem value="336">336 - C6 Bank</SelectItem>
                      <SelectItem value="290">290 - PagBank</SelectItem>
                      <SelectItem value="212">212 - Banco Original</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="agencia">Agência</Label>
                  <Input
                    id="agencia"
                    type="text"
                    placeholder="0000"
                    value={clientData.dadosPagamentoAgencia || ''}
                    onChange={(e) => updateClient({ dadosPagamentoAgencia: e.target.value })}
                    data-testid="input-agencia"
                  />
                </div>

                <div>
                  <Label htmlFor="conta">Conta</Label>
                  <Input
                    id="conta"
                    type="text"
                    placeholder="00000-0"
                    value={clientData.dadosPagamentoConta || ''}
                    onChange={(e) => updateClient({ dadosPagamentoConta: e.target.value })}
                    data-testid="input-conta"
                  />
                </div>

                <div>
                  <Label htmlFor="digito">Dígito</Label>
                  <Input
                    id="digito"
                    type="text"
                    placeholder="0"
                    maxLength={2}
                    value={clientData.dadosPagamentoDigito || ''}
                    onChange={(e) => updateClient({ dadosPagamentoDigito: e.target.value })}
                    data-testid="input-digito"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pix" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="tipoPix">Tipo de Chave PIX</Label>
                  <Select
                    value={clientData.dadosPagamentoTipoPix || ''}
                    onValueChange={(value) => updateClient({ dadosPagamentoTipoPix: value })}
                  >
                    <SelectTrigger data-testid="select-tipo-pix">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="chavePix">Chave PIX</Label>
                  <Input
                    id="chavePix"
                    type="text"
                    placeholder="Digite a chave PIX"
                    value={clientData.dadosPagamentoPix || ''}
                    onChange={(e) => updateClient({ dadosPagamentoPix: e.target.value })}
                    data-testid="input-chave-pix"
                  />
                </div>

                <div>
                  <Label htmlFor="pixBanco">Banco do PIX</Label>
                  <Select
                    value={clientData.dadosPagamentoPixBanco || ''}
                    onValueChange={(value) => updateClient({ dadosPagamentoPixBanco: value })}
                  >
                    <SelectTrigger data-testid="select-pix-banco">
                      <SelectValue placeholder="Selecione o banco..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="001">001 - Banco do Brasil</SelectItem>
                      <SelectItem value="033">033 - Santander</SelectItem>
                      <SelectItem value="104">104 - Caixa Econômica</SelectItem>
                      <SelectItem value="237">237 - Bradesco</SelectItem>
                      <SelectItem value="341">341 - Itaú</SelectItem>
                      <SelectItem value="077">077 - Inter</SelectItem>
                      <SelectItem value="260">260 - Nubank</SelectItem>
                      <SelectItem value="336">336 - C6 Bank</SelectItem>
                      <SelectItem value="290">290 - PagBank</SelectItem>
                      <SelectItem value="212">212 - Banco Original</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="pixNomeTitular">Nome do Titular</Label>
                  <Input
                    id="pixNomeTitular"
                    type="text"
                    placeholder="Nome completo"
                    value={clientData.dadosPagamentoPixNomeTitular || ''}
                    onChange={(e) => updateClient({ dadosPagamentoPixNomeTitular: e.target.value })}
                    data-testid="input-pix-nome-titular"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="pixCpfTitular">CPF/CNPJ do Titular</Label>
                  <InputMask
                    mask={clientData.dadosPagamentoPixCpfTitular && clientData.dadosPagamentoPixCpfTitular.length > 14 ? "99.999.999/9999-99" : "999.999.999-99"}
                    value={clientData.dadosPagamentoPixCpfTitular || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateClient({ dadosPagamentoPixCpfTitular: e.target.value })}
                  >
                    {(inputProps: any) => (
                      <Input
                        {...inputProps}
                        id="pixCpfTitular"
                        type="text"
                        placeholder="CPF ou CNPJ do titular"
                        data-testid="input-pix-cpf-titular"
                      />
                    )}
                  </InputMask>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}