import React, { useState, useCallback, useEffect } from "react";
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
  MapPin,
  Briefcase,
  Building2,
  CreditCard,
  Smartphone,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
} from "lucide-react";
import CurrencyInput from "@/components/ui/CurrencyInput";
import InputMask from "react-input-mask";
import { cpf as cpfValidator, cnpj as cnpjValidator } from "cpf-cnpj-validator";
import { commonBanks, brazilianBanks } from "@/utils/brazilianBanks";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

// Validation helpers
const validateCPF = (cpf: string): { isValid: boolean; message: string | null } => {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length === 0) return { isValid: false, message: null };
  if (cleanCPF.length < 11) return { isValid: false, message: "CPF deve ter 11 dígitos" };
  if (cleanCPF.length > 11) return { isValid: false, message: "CPF inválido" };

  const isValid = cpfValidator.isValid(cpf);
  return {
    isValid,
    message: isValid ? null : "CPF inválido",
  };
};

const validateCNPJ = (cnpj: string): { isValid: boolean; message: string | null } => {
  const cleanCNPJ = cnpj.replace(/\D/g, "");
  if (cleanCNPJ.length === 0) return { isValid: false, message: null };
  if (cleanCNPJ.length < 14) return { isValid: false, message: "CNPJ deve ter 14 dígitos" };
  if (cleanCNPJ.length > 14) return { isValid: false, message: "CNPJ inválido" };

  const isValid = cnpjValidator.isValid(cnpj);
  return {
    isValid,
    message: isValid ? null : "CNPJ inválido",
  };
};

const validateEmail = (email: string): { isValid: boolean; message: string | null } => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return { isValid: false, message: "Email é obrigatório" };
  if (!emailRegex.test(email)) return { isValid: false, message: "Email inválido" };
  return { isValid: true, message: null };
};

const validatePhone = (phone: string): string | null => {
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 10) return "Telefone deve ter pelo menos 10 dígitos";
  return null;
};

const validateCEP = (cep: string): string | null => {
  const cleanCEP = cep.replace(/\D/g, "");
  if (cleanCEP.length < 8) return "CEP deve ter 8 dígitos";
  return null;
};

export function ClientDataStep() {
  const { state } = useProposal();
  const { updateClient, setError, clearError } = useProposalActions();
  const { clientData, errors } = state;
  const { toast } = useToast();

  // Estados para validação visual
  const [cpfValidation, setCpfValidation] = useState<{ isValid: boolean; message: string | null }>({
    isValid: false,
    message: null,
  });
  const [cnpjValidation, setCnpjValidation] = useState<{
    isValid: boolean;
    message: string | null;
  }>({ isValid: false, message: null });
  const [emailValidation, setEmailValidation] = useState<{
    isValid: boolean;
    message: string | null;
  }>({ isValid: false, message: null });
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCpfData, setLoadingCpfData] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [progress, setProgress] = useState(0);

  // Função para buscar CEP usando nosso backend
  const fetchAddressByCep = useCallback(
    async (cep: string) => {
      const cleanCep = cep.replace(/\D/g, "");
      if (cleanCep.length !== 8) return;

      setLoadingCep(true);
      try {
        const data = await apiRequest(`/api/cep/${cleanCep}`, {
          method: "GET",
        });

        if (data && data.logradouro) {
          // Auto-preencher os campos de endereço
          updateClient({
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.cidade || "",
            estado: data.estado || "",
          });

          clearError("cep");
          toast({
            title: "CEP encontrado!",
            description: "Endereço preenchido automaticamente.",
          });
        } else {
          setError("cep", "CEP não encontrado");
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
        setError("cep", "Erro ao buscar CEP");
      } finally {
        setLoadingCep(false);
      }
    },
    [updateClient, setError, clearError, toast]
  );

  // Função para buscar dados existentes do cliente por CPF
  const fetchClientDataByCpf = useCallback(
    async (cpf: string) => {
      const cleanCPF = cpf.replace(/\D/g, "");
      if (cleanCPF.length !== 11) return;

      setLoadingCpfData(true);
      try {
        const response = await apiRequest(`/api/clientes/cpf/${cleanCPF}`, {
          method: "GET",
        });

        if (response && response.exists) {
          const data = response.data;

          // Mostrar diálogo confirmando que encontrou dados
          const userConfirmed = window.confirm(
            `Cliente já cadastrado!\n\nEncontramos dados de: ${data.nome}\n\nDeseja usar os dados existentes para esta nova proposta?`
          );

          if (userConfirmed) {
            // Preencher todos os campos com dados existentes
            updateClient({
              nome: data.nome,
              email: data.email,
              telefone: data.telefone,
              dataNascimento: data.dataNascimento,
              rg: data.rg,
              orgaoEmissor: data.orgaoEmissor,
              rgUf: data.rgUf,
              rgDataEmissao: data.rgDataEmissao,
              localNascimento: data.localNascimento,
              estadoCivil: data.estadoCivil,
              nacionalidade: data.nacionalidade,
              cep: data.cep,
              logradouro: data.logradouro,
              numero: data.numero,
              complemento: data.complemento,
              bairro: data.bairro,
              cidade: data.cidade,
              estado: data.estado,
              ocupacao: data.ocupacao,
              rendaMensal: data.rendaMensal,
              telefoneEmpresa: data.telefoneEmpresa,
              metodoPagamento: data.metodoPagamento,
              dadosPagamentoBanco: data.dadosPagamentoBanco,
              dadosPagamentoAgencia: data.dadosPagamentoAgencia,
              dadosPagamentoConta: data.dadosPagamentoConta,
              dadosPagamentoDigito: data.dadosPagamentoDigito,
              dadosPagamentoPix: data.dadosPagamentoPix,
              dadosPagamentoTipoPix: data.dadosPagamentoTipoPix,
              dadosPagamentoPixBanco: data.dadosPagamentoPixBanco,
              dadosPagamentoPixNomeTitular: data.dadosPagamentoPixNomeTitular,
              dadosPagamentoPixCpfTitular: data.dadosPagamentoPixCpfTitular,
            });

            toast({
              title: "Dados carregados!",
              description: "Dados do cliente preenchidos automaticamente.",
            });
          }
        }
      } catch (error) {
        console.error("Erro ao buscar dados do cliente:", error);
      } finally {
        setLoadingCpfData(false);
      }
    },
    [updateClient, toast]
  );

  // Handlers
  const handleTipoPessoaChange = (checked: boolean) => {
    updateClient({
      tipoPessoa: checked ? "PJ" : "PF",
      // Clear PJ fields if switching to PF
      ...(!checked && { razaoSocial: "", cnpj: "" }),
    });
  };

  const handleCPFChange = (value: string) => {
    updateClient({ cpf: value });
    const validation = validateCPF(value);
    setCpfValidation(validation);

    if (validation.message) {
      setError("cpf", validation.message);
    } else {
      clearError("cpf");
      // Buscar dados existentes quando CPF for válido
      if (validation.isValid) {
        fetchClientDataByCpf(value);
      }
    }
  };

  const handleCNPJChange = (value: string) => {
    updateClient({ cnpj: value });
    const validation = validateCNPJ(value);
    setCnpjValidation(validation);

    if (validation.message) {
      setError("cnpj", validation.message);
    } else {
      clearError("cnpj");
    }
  };

  const handleEmailChange = (value: string) => {
    updateClient({ email: value });
    const validation = validateEmail(value);
    setEmailValidation(validation);

    if (validation.message) {
      setError("email", validation.message);
    } else {
      clearError("email");
    }
  };

  const handlePhoneChange = (value: string) => {
    updateClient({ telefone: value });
    const error = validatePhone(value);
    if (error) {
      setError("telefone", error);
    } else {
      clearError("telefone");
    }
  };

  const handleCEPChange = (value: string) => {
    updateClient({ cep: value });
    const error = validateCEP(value);
    if (error) {
      setError("cep", error);
    } else {
      clearError("cep");
      // Auto-buscar endereço quando CEP for válido
      const cleanCep = value.replace(/\D/g, "");
      if (cleanCep.length === 8) {
        fetchAddressByCep(value);
      }
    }
  };

  const handleNameChange = (value: string) => {
    updateClient({ nome: value });
    if (!value || value.trim().length === 0) {
      setError("nome", "Nome é obrigatório");
    } else {
      clearError("nome");
    }
  };

  // Calcular progresso do formulário
  useEffect(() => {
    const requiredFields = [
      clientData.nome,
      clientData.cpf || clientData.cnpj,
      clientData.email,
      clientData.telefone,
      clientData.dataNascimento,
      clientData.cep,
      clientData.logradouro,
      clientData.numero,
      clientData.cidade,
      clientData.estado,
      clientData.ocupacao,
      clientData.rendaMensal,
    ];

    const filledFields = requiredFields.filter(
      field => field && field.toString().trim() !== ""
    ).length;
    const totalFields = requiredFields.length;
    const progressValue = Math.round((filledFields / totalFields) * 100);
    setProgress(progressValue);
  }, [clientData]);

  // Auto-save no localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("proposalDraft", JSON.stringify(clientData));
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 1000);

    return () => clearTimeout(timer);
  }, [clientData]);

  // Carregar dados salvos do localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("proposalDraft");
    if (savedData && !clientData.nome) {
      const parsed = JSON.parse(savedData);
      updateClient(parsed);
      toast({
        title: "Dados recuperados",
        description: "Seus dados foram restaurados da sessão anterior.",
      });
    }
  }, [clientData.nome, toast, updateClient]);

  return (
    <div className="space-y-6">
      {/* Indicador de Progresso e Auto-Save */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progresso do Formulário</span>
              <span className="text-sm text-muted-foreground">{progress}% completo</span>
            </div>
            <Progress value={progress} className="h-2" />
            {autoSaved && (
              <p className="flex items-center gap-1 text-xs text-green-600">
                <Save className="h-3 w-3" /> Dados salvos automaticamente
              </p>
            )}
            {loadingCpfData && (
              <p className="flex items-center gap-1 text-xs text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando dados do cliente...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tipo de Pessoa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tipo de Pessoa
          </CardTitle>
          <CardDescription>Selecione se é Pessoa Física ou Jurídica</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Label htmlFor="tipo-pessoa" className="text-base">
              Pessoa Física
            </Label>
            <Switch
              id="tipo-pessoa"
              checked={clientData.tipoPessoa === "PJ"}
              onCheckedChange={handleTipoPessoaChange}
              data-testid="switch-tipo-pessoa"
            />
            <Label htmlFor="tipo-pessoa" className="text-base">
              Pessoa Jurídica
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Dados Pessoais / Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {clientData.tipoPessoa === "PJ" ? "Dados da Empresa" : "Dados Pessoais"}
          </CardTitle>
          <CardDescription>
            {clientData.tipoPessoa === "PJ"
              ? "Informações da empresa"
              : "Informações básicas do cliente"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clientData.tipoPessoa === "PJ" ? (
            <>
              <div className="md:col-span-2">
                <Label htmlFor="razaoSocial">Razão Social *</Label>
                <Input
                  id="razaoSocial"
                  type="text"
                  value={clientData.razaoSocial || ""}
                  onChange={e => updateClient({ razaoSocial: e.target.value })}
                  placeholder="Nome da empresa"
                  data-testid="input-razao-social"
                />
              </div>
              <div>
                <Label htmlFor="cnpj">CNPJ *</Label>
                <div className="relative">
                  <InputMask
                    mask="99.999.999/9999-99"
                    value={clientData.cnpj || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleCNPJChange(e.target.value)
                    }
                  >
                    {(inputProps: any) => (
                      <Input
                        {...inputProps}
                        id="cnpj"
                        type="text"
                        placeholder="00.000.000/0000-00"
                        className={`${
                          errors.cnpj
                            ? "border-destructive focus:border-destructive"
                            : cnpjValidation.isValid && clientData.cnpj
                              ? "border-green-500 focus:border-green-500"
                              : ""
                        } pr-10`}
                        data-testid="input-cnpj"
                      />
                    )}
                  </InputMask>
                  {clientData.cnpj && cnpjValidation.message === null && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 transform">
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
                  <p
                    className={`mt-1 flex items-center gap-1 text-xs ${
                      cnpjValidation.isValid ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {cnpjValidation.isValid ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> CNPJ válido
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" /> CNPJ inválido
                      </>
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
                  onChange={e => handleNameChange(e.target.value)}
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleCPFChange(e.target.value)
                    }
                  >
                    {(inputProps: any) => (
                      <Input
                        {...inputProps}
                        id="cpf"
                        type="text"
                        placeholder="000.000.000-00"
                        className={`${
                          errors.cpf
                            ? "border-destructive focus:border-destructive"
                            : cpfValidation.isValid && clientData.cpf
                              ? "border-green-500 focus:border-green-500"
                              : ""
                        } pr-10`}
                        data-testid="input-cpf"
                      />
                    )}
                  </InputMask>
                  {clientData.cpf && cpfValidation.message === null && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 transform">
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
                  <p
                    className={`mt-1 flex items-center gap-1 text-xs ${
                      cpfValidation.isValid ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {cpfValidation.isValid ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> CPF válido
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" /> CPF inválido
                      </>
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
                  onChange={e => handleNameChange(e.target.value)}
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
              onChange={e => updateClient({ dataNascimento: e.target.value })}
              className={errors.dataNascimento ? "border-red-500" : ""}
              data-testid="input-data-nascimento"
            />
            {errors.dataNascimento && (
              <p className="mt-1 text-sm text-red-500">{errors.dataNascimento}</p>
            )}
          </div>

          <div>
            <Label htmlFor="localNascimento">Local de Nascimento</Label>
            <Input
              id="localNascimento"
              type="text"
              placeholder="Cidade - UF"
              value={clientData.localNascimento}
              onChange={e => updateClient({ localNascimento: e.target.value })}
              data-testid="input-local-nascimento"
            />
          </div>

          <div>
            <Label htmlFor="estadoCivil">Estado Civil</Label>
            <Select
              value={clientData.estadoCivil}
              onValueChange={value => updateClient({ estadoCivil: value })}
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
              onChange={e => updateClient({ nacionalidade: e.target.value })}
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
          <CardDescription>Informações completas do RG</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="rg">RG</Label>
            <Input
              id="rg"
              type="text"
              value={clientData.rg}
              onChange={e => updateClient({ rg: e.target.value })}
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
              onChange={e => updateClient({ orgaoEmissor: e.target.value })}
              data-testid="input-orgao-emissor"
            />
          </div>

          <div>
            <Label htmlFor="rgUf">UF de Emissão</Label>
            <Select value={clientData.rgUf} onValueChange={value => updateClient({ rgUf: value })}>
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
              onChange={e => updateClient({ rgDataEmissao: e.target.value })}
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
          <CardDescription>Informações de contato</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="telefone">Telefone/WhatsApp *</Label>
            <InputMask
              mask="(99) 99999-9999"
              value={clientData.telefone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handlePhoneChange(e.target.value)
              }
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
            <div className="relative">
              <Input
                id="email"
                type="email"
                value={clientData.email}
                onChange={e => handleEmailChange(e.target.value)}
                className={`${
                  errors.email
                    ? "border-destructive focus:border-destructive"
                    : emailValidation.isValid && clientData.email
                      ? "border-green-500 focus:border-green-500"
                      : ""
                } pr-10`}
                data-testid="input-email"
              />
              {clientData.email && emailValidation.message === null && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 transform">
                  {emailValidation.isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              )}
            </div>
            {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
            {clientData.email && !errors.email && emailValidation.isValid && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" /> E-mail válido
              </p>
            )}
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
          <CardDescription>Endereço completo para o CCB</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="cep">CEP</Label>
            <div className="relative">
              <InputMask
                mask="99999-999"
                value={clientData.cep}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleCEPChange(e.target.value)
                }
              >
                {(inputProps: any) => (
                  <Input
                    {...inputProps}
                    id="cep"
                    type="text"
                    placeholder="00000-000"
                    className={`${
                      errors.cep
                        ? "border-destructive focus:border-destructive"
                        : clientData.logradouro && !loadingCep
                          ? "border-green-500 focus:border-green-500"
                          : ""
                    } pr-10`}
                    data-testid="input-cep"
                  />
                )}
              </InputMask>
              {loadingCep && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 transform">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                </div>
              )}
              {!loadingCep && clientData.logradouro && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 transform">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
            {errors.cep && <p className="mt-1 text-sm text-destructive">{errors.cep}</p>}
            {loadingCep && (
              <p className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando endereço...
              </p>
            )}
            {!loadingCep && clientData.logradouro && !errors.cep && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
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
              onChange={e => updateClient({ logradouro: e.target.value })}
              className={errors.logradouro ? "border-destructive" : ""}
              data-testid="input-logradouro"
            />
            {errors.logradouro && (
              <p className="mt-1 text-sm text-destructive">{errors.logradouro}</p>
            )}
          </div>

          <div>
            <Label htmlFor="numero">Número</Label>
            <Input
              id="numero"
              type="text"
              value={clientData.numero}
              onChange={e => updateClient({ numero: e.target.value })}
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
              onChange={e => updateClient({ complemento: e.target.value })}
              data-testid="input-complemento"
            />
          </div>

          <div>
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              type="text"
              value={clientData.bairro}
              onChange={e => updateClient({ bairro: e.target.value })}
              data-testid="input-bairro"
            />
          </div>

          <div>
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              type="text"
              value={clientData.cidade}
              onChange={e => updateClient({ cidade: e.target.value })}
              data-testid="input-cidade"
            />
          </div>

          <div>
            <Label htmlFor="estado">Estado</Label>
            <Select
              value={clientData.estado}
              onValueChange={value => updateClient({ estado: value })}
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
          <CardDescription>Informações sobre ocupação e renda</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="ocupacao">Ocupação/Profissão</Label>
            <Input
              id="ocupacao"
              type="text"
              value={clientData.ocupacao}
              onChange={e => updateClient({ ocupacao: e.target.value })}
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
              onChange={e => updateClient({ rendaMensal: e.target.value })}
              className={errors.rendaMensal ? "border-destructive" : ""}
              data-testid="input-renda-mensal"
            />
            {errors.rendaMensal && (
              <p className="mt-1 text-sm text-destructive">{errors.rendaMensal}</p>
            )}
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
                  className={
                    errors.telefoneEmpresa ? "border-destructive focus:border-destructive" : ""
                  }
                  data-testid="input-telefone-empresa"
                />
              )}
            </InputMask>
            {errors.telefoneEmpresa && (
              <p className="mt-1 text-sm text-destructive">{errors.telefoneEmpresa}</p>
            )}
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
          <CardDescription>Escolha como deseja receber o valor do empréstimo</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={clientData.metodoPagamento}
            onValueChange={(value: any) => updateClient({ metodoPagamento: value })}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="conta_bancaria" data-testid="tab-conta-bancaria">
                <CreditCard className="mr-2 h-4 w-4" />
                Conta Bancária
              </TabsTrigger>
              <TabsTrigger value="pix" data-testid="tab-pix">
                <Smartphone className="mr-2 h-4 w-4" />
                PIX
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conta_bancaria" className="space-y-4">
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="banco">Banco</Label>
                  <Select
                    value={clientData.dadosPagamentoBanco || ""}
                    onValueChange={value => updateClient({ dadosPagamentoBanco: value })}
                  >
                    <SelectTrigger data-testid="select-banco">
                      <SelectValue placeholder="Selecione o banco..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Bancos Populares
                      </div>
                      {commonBanks.map(bank => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.code} - {bank.name}
                        </SelectItem>
                      ))}
                      <div className="mt-2 px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Todos os Bancos
                      </div>
                      {brazilianBanks
                        .filter(b => !commonBanks.find(c => c.code === b.code))
                        .map(bank => (
                          <SelectItem key={bank.code} value={bank.code}>
                            {bank.code} - {bank.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="agencia">Agência</Label>
                  <Input
                    id="agencia"
                    type="text"
                    placeholder="0000"
                    value={clientData.dadosPagamentoAgencia || ""}
                    onChange={e => updateClient({ dadosPagamentoAgencia: e.target.value })}
                    data-testid="input-agencia"
                  />
                </div>

                <div>
                  <Label htmlFor="conta">Conta</Label>
                  <Input
                    id="conta"
                    type="text"
                    placeholder="00000-0"
                    value={clientData.dadosPagamentoConta || ""}
                    onChange={e => updateClient({ dadosPagamentoConta: e.target.value })}
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
                    value={clientData.dadosPagamentoDigito || ""}
                    onChange={e => updateClient({ dadosPagamentoDigito: e.target.value })}
                    data-testid="input-digito"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pix" className="space-y-4">
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="tipoPix">Tipo de Chave PIX</Label>
                  <Select
                    value={clientData.dadosPagamentoTipoPix || ""}
                    onValueChange={value => updateClient({ dadosPagamentoTipoPix: value })}
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
                    value={clientData.dadosPagamentoPix || ""}
                    onChange={e => updateClient({ dadosPagamentoPix: e.target.value })}
                    data-testid="input-chave-pix"
                  />
                </div>

                <div>
                  <Label htmlFor="pixBanco">Banco do PIX</Label>
                  <Select
                    value={clientData.dadosPagamentoPixBanco || ""}
                    onValueChange={value => updateClient({ dadosPagamentoPixBanco: value })}
                  >
                    <SelectTrigger data-testid="select-pix-banco">
                      <SelectValue placeholder="Selecione o banco..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Bancos Populares
                      </div>
                      {commonBanks.map(bank => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.code} - {bank.name}
                        </SelectItem>
                      ))}
                      <div className="mt-2 px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Todos os Bancos
                      </div>
                      {brazilianBanks
                        .filter(b => !commonBanks.find(c => c.code === b.code))
                        .map(bank => (
                          <SelectItem key={bank.code} value={bank.code}>
                            {bank.code} - {bank.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="pixNomeTitular">Nome do Titular</Label>
                  <Input
                    id="pixNomeTitular"
                    type="text"
                    placeholder="Nome completo"
                    value={clientData.dadosPagamentoPixNomeTitular || ""}
                    onChange={e => updateClient({ dadosPagamentoPixNomeTitular: e.target.value })}
                    data-testid="input-pix-nome-titular"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="pixCpfTitular">CPF/CNPJ do Titular</Label>
                  <InputMask
                    mask={
                      clientData.dadosPagamentoPixCpfTitular &&
                      clientData.dadosPagamentoPixCpfTitular.length > 14
                        ? "99.999.999/9999-99"
                        : "999.999.999-99"
                    }
                    value={clientData.dadosPagamentoPixCpfTitular || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateClient({ dadosPagamentoPixCpfTitular: e.target.value })
                    }
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
