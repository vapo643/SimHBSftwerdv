import React, { useState, useCallback, useEffect } from 'react';
import { useProposal, useProposalActions } from '@/contexts/ProposalContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { CPF, CEP } from '@shared/value-objects';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { MaskedInput } from '@/components/ui/MaskedInput';
// Removido import do cpf-cnpj-validator
import { commonBanks, brazilianBanks } from '@/utils/brazilianBanks';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

// Interfaces para tipagem das respostas da API
interface CepApiResponse {
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

interface ClientDataApiResponse {
  exists: boolean;
  data?: {
    nome: string;
    email: string;
    telefone: string;
    dataNascimento?: string;
    rg?: string;
    orgaoEmissor?: string;
    rgUf?: string;
    rgDataEmissao?: string;
    localNascimento?: string;
    estadoCivil?: string;
    nacionalidade?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    ocupacao?: string;
    rendaMensal?: string;
    telefoneEmpresa?: string;
    metodoPagamento?: string;
    dadosPagamentoBanco?: string;
    dadosPagamentoAgencia?: string;
    dadosPagamentoConta?: string;
    dadosPagamentoDigito?: string;
    dadosPagamentoPix?: string;
    dadosPagamentoTipoPix?: string;
    dadosPagamentoPixBanco?: string;
    dadosPagamentoPixNomeTitular?: string;
    dadosPagamentoPixCpfTitular?: string;
  };
}

// VALIDAÇÕES REMOVIDAS - Aceitar qualquer input sem validação

export function ClientDataStep() {
  const { state } = useProposal();
  const { updateClient, setError, clearError } = useProposalActions();
  const { clientData, errors } = state;
  const { toast } = useToast();

  // Estados de loading para APIs
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCpfData, setLoadingCpfData] = useState(false);
  // 🚫 FLAGS PARA EVITAR RE-VALIDAÇÕES DESNECESSÁRIAS
  const [cepAlreadyFetched, setCepAlreadyFetched] = useState(false);
  const [cpfAlreadyFetched, setCpfAlreadyFetched] = useState(false);

  // UX-012: Estado para controlar feedback visual de auto-preenchimento
  const [addressFieldsJustFilled, setAddressFieldsJustFilled] = useState(false);

  // UX-006: Estados para validação em tempo real
  const [cpfValidation, setCpfValidation] = useState<{
    isValid: boolean;
    isValidating: boolean;
  }>({ isValid: false, isValidating: false });

  // UX-006: Debounce para CEP (500ms)
  const debouncedCep = useDebounce(clientData.cep, 500);

  const [progress, setProgress] = useState(0);

  // Estados para modal de confirmação de cliente encontrado
  const [clientFoundData, setClientFoundData] = useState<ClientDataApiResponse['data'] | null>(
    null
  );
  const [showClientConfirmDialog, setShowClientConfirmDialog] = useState(false);

  // Função para buscar CEP usando nosso backend
  const fetchAddressByCep = useCallback(
    async (cep: string) => {
      const cleanCep = cep.replace(/\D/g, '');
      if (cleanCep.length !== 8) return;

      setLoadingCep(true);
      try {
        const data = (await apiRequest(`/api/cep/${cleanCep}`, {
          method: 'GET',
        })) as CepApiResponse;

        if (data && data.logradouro) {
          // Auto-preencher os campos de endereço
          updateClient({
            logradouro: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: data.cidade || '',
            estado: data.estado || '',
          });

          // UX-012: Ativar efeito visual de flash nos campos preenchidos
          setAddressFieldsJustFilled(true);

          // Remover o efeito após a animação (1.8s)
          setTimeout(() => setAddressFieldsJustFilled(false), 1800);

          clearError('cep');
          toast({
            title: 'CEP encontrado!',
            description: 'Endereço preenchido automaticamente.',
          });
        } else {
          setError('cep', 'CEP não encontrado');
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        setError('cep', 'Erro ao buscar CEP');
      } finally {
        setLoadingCep(false);
      }
    },
    [updateClient, setError, clearError, toast]
  );

  // Função para buscar dados existentes do cliente por CPF
  const fetchClientDataByCpf = useCallback(
    async (cpf: string) => {
      const cleanCPF = cpf.replace(/\D/g, '');
      if (cleanCPF.length !== 11) return;

      setLoadingCpfData(true);
      try {
        const response = (await apiRequest(`/api/clientes/cpf/${cleanCPF}`, {
          method: 'GET',
        })) as ClientDataApiResponse;

        if (response && response.exists && response.data) {
          // ✅ NOVO: Armazenar dados e abrir modal
          setClientFoundData(response.data);
          setShowClientConfirmDialog(true);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do cliente:', error);
      } finally {
        setLoadingCpfData(false);
      }
    },
    [setClientFoundData, setShowClientConfirmDialog]
  );

  // ✅ NOVO: Handler para confirmação do modal
  const handleUseExistingClientData = useCallback(() => {
    if (!clientFoundData) return;

    // 🔍 MAPEAMENTO CORRETO DOS CAMPOS DA API
    // A API retorna dados com estrutura: clienteNome, clienteCep, etc. + sub-objeto clienteData
    const apiData = clientFoundData as any; // Type assertion para acessar propriedades corretas
    const clientData = apiData.clienteData || {};

    // Mapeamento otimizado baseado na estrutura real da API

    const clientUpdateData = {
      // Dados pessoais - priorizar campos diretos
      nome: apiData.clienteNome || clientData.nome || '',
      email: apiData.clienteEmail || clientData.email || '',
      telefone: apiData.clienteTelefone || clientData.telefone || '',
      dataNascimento:
        apiData.clienteDataNascimento ||
        clientData.dataNascimento ||
        clientData.data_nascimento ||
        '',

      // Documentos - verificar tanto campo direto quanto clienteData
      rg: apiData.clienteRg || clientData.rg || '',
      orgaoEmissor: apiData.clienteOrgaoEmissor || clientData.orgaoEmissor || '',
      rgUf: apiData.clienteRgUf || clientData.uf || '',
      rgDataEmissao: apiData.clienteRgDataEmissao || clientData.rgDataEmissao || '',

      // 🌍 Dados adicionais - APENAS CAMPOS REAIS
      localNascimento: clientData.localNascimento || apiData.clienteLocalNascimento || '',
      estadoCivil: clientData.estadoCivil || apiData.clienteEstadoCivil || '',
      nacionalidade: clientData.nacionalidade || apiData.clienteNacionalidade || '',

      // Endereço - verificar tanto campo direto quanto clienteData
      cep: apiData.clienteCep || clientData.cep || '',
      logradouro: apiData.clienteLogradouro || clientData.logradouro || '',
      numero: apiData.clienteNumero || clientData.numero || '',
      complemento: apiData.clienteComplemento || clientData.complemento || '',
      bairro: apiData.clienteBairro || clientData.bairro || '',
      cidade: apiData.clienteCidade || clientData.cidade || '',
      estado: apiData.clienteUf || clientData.estado || '',

      // 💼 Dados profissionais - APENAS CAMPOS REAIS
      ocupacao: apiData.clienteOcupacao || clientData.ocupacao || '',
      rendaMensal:
        // Converter centavos para reais se vier no formato {cents: number}
        clientData.rendaMensal?.cents
          ? (clientData.rendaMensal.cents / 100).toString()
          : clientData.renda_mensal || apiData.clienteRenda || apiData.clienteRendaMensal || '',
      telefoneEmpresa: clientData.telefoneEmpresa || apiData.clienteTelefoneEmpresa || '',

      // 🏭 Nome da empresa - usar campo REAL
      clienteEmpresaNome: clientData.empregador || apiData.clienteEmpresaNome || '',

      // 💼 Dados profissionais adicionais - CAMPOS REAIS
      clienteDividasExistentes:
        clientData.dividas_existentes || apiData.clienteDividasExistentes || '',
      clienteTempoEmprego: clientData.tempo_emprego || apiData.clienteTempoEmprego || '',
      clienteCargoFuncao: clientData.cargo_funcao || apiData.clienteCargoFuncao || '',

      // Dados de pagamento - usar estrutura correta
      metodoPagamento: (apiData.metodoPagamento as 'conta_bancaria' | 'pix') || 'conta_bancaria',
      dadosPagamentoBanco: apiData.dadosPagamentoBanco || '',
      dadosPagamentoAgencia: apiData.dadosPagamentoAgencia || '',
      dadosPagamentoConta: apiData.dadosPagamentoConta || '',
      dadosPagamentoDigito: apiData.dadosPagamentoDigito || '',
      dadosPagamentoPix: apiData.dadosPagamentoPix || '',
      dadosPagamentoTipoPix: apiData.dadosPagamentoTipoPix || '',
      dadosPagamentoPixBanco: apiData.dadosPagamentoPixBanco || '',
      dadosPagamentoPixNomeTitular: apiData.dadosPagamentoPixNomeTitular || '',
      dadosPagamentoPixCpfTitular: apiData.dadosPagamentoPixCpfTitular || '',
    };

    // Aplicar dados ao formulário

    updateClient(clientUpdateData);

    toast({
      title: 'Dados carregados!',
      description: 'Dados do cliente preenchidos automaticamente.',
    });

    // Fechar modal e limpar dados temporários
    setShowClientConfirmDialog(false);
    setClientFoundData(null);
  }, [clientFoundData, updateClient, toast]);

  // UX-006: Busca automática de CEP com debounce - OTIMIZADO
  useEffect(() => {
    const cleanCep = debouncedCep.replace(/\D/g, '');
    if (cleanCep.length === 8 && CEP.isValid(cleanCep) && !cepAlreadyFetched) {
      fetchAddressByCep(debouncedCep);
      setCepAlreadyFetched(true); // 🚫 Marcar como já buscado
    }
  }, [debouncedCep, fetchAddressByCep, cepAlreadyFetched]);

  // Handlers
  const handleTipoPessoaChange = (checked: boolean) => {
    updateClient({
      tipoPessoa: checked ? 'PJ' : 'PF',
      // Clear PJ fields if switching to PF
      ...(!checked && { razaoSocial: '', cnpj: '' }),
    });
  };

  // UX-006: Handler com validação em tempo real de CPF
  const handleCPFChange = (value: string) => {
    updateClient({ cpf: value });
    clearError('cpf');

    // 🚫 Resetar flag se CPF mudou para permitir nova busca
    if (value !== clientData.cpf) {
      setCpfAlreadyFetched(false);
    }

    // UX-006: Validação em tempo real
    const cleanCPF = value.replace(/\D/g, '');
    setCpfValidation({ isValidating: true, isValid: false });

    setTimeout(() => {
      const isValid = CPF.isValid(cleanCPF);
      setCpfValidation({ isValidating: false, isValid });

      // Buscar dados quando CPF for válido (11 dígitos) - OTIMIZADO
      if (cleanCPF.length === 11 && isValid && !cpfAlreadyFetched) {
        fetchClientDataByCpf(value);
        setCpfAlreadyFetched(true); // 🚫 Marcar como já buscado
      }
    }, 100); // Micro delay para UX suave
  };

  const handleCNPJChange = (value: string) => {
    updateClient({ cnpj: value });
    clearError('cnpj');
  };

  const handleEmailChange = (value: string) => {
    updateClient({ email: value });
    clearError('email');
  };

  const handlePhoneChange = (value: string) => {
    updateClient({ telefone: value });
    clearError('telefone');
  };

  // UX-006: Handler simplificado - busca via debounce em useEffect
  const handleCEPChange = (value: string) => {
    updateClient({ cep: value });
    clearError('cep');

    // 🚫 Resetar flag se CEP mudou para permitir nova busca
    if (value !== clientData.cep) {
      setCepAlreadyFetched(false);
    }
    // Busca automática via debouncedCep no useEffect
  };

  const handleNameChange = (value: string) => {
    updateClient({ nome: value });
    clearError('nome');
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
      (field) => field && field.toString().trim() !== ''
    ).length;
    const totalFields = requiredFields.length;
    const progressValue = Math.round((filledFields / totalFields) * 100);
    setProgress(progressValue);
  }, [clientData]);

  // AUTOSAVE REMOVIDO - Estava causando bugs ao carregar propostas finalizadas indevidamente

  return (
    <div className="space-y-6">
      {/* Indicador de Progresso */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progresso do Formulário</span>
              <span className="text-sm text-muted-foreground">{progress}% completo</span>
            </div>
            <Progress value={progress} className="h-2" />

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
              checked={clientData.tipoPessoa === 'PJ'}
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
            {clientData.tipoPessoa === 'PJ' ? 'Dados da Empresa' : 'Dados Pessoais'}
          </CardTitle>
          <CardDescription>
            {clientData.tipoPessoa === 'PJ'
              ? 'Informações da empresa'
              : 'Informações básicas do cliente'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <MaskedInput
                    mask="99.999.999/9999-99"
                    value={clientData.cnpj || ''}
                    onChange={(value) => handleCNPJChange(value)}
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    className={errors.cnpj ? 'border-destructive focus:border-destructive' : ''}
                    data-testid="input-cnpj"
                  />
                  {/* Ícone de validação CNPJ removido */}
                </div>
                {errors.cnpj && <p className="mt-1 text-sm text-destructive">{errors.cnpj}</p>}
                {/* Mensagem de CNPJ válido removida */}
              </div>
              <div>
                <Label htmlFor="nome">Representante Legal *</Label>
                <Input
                  id="nome"
                  type="text"
                  value={clientData.nome}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={errors.nome ? 'border-destructive focus:border-destructive' : ''}
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
                  <MaskedInput
                    mask="999.999.999-99"
                    value={clientData.cpf}
                    onChange={(value) => handleCPFChange(value)}
                    id="cpf"
                    placeholder="000.000.000-00"
                    className={`pr-10 ${
                      errors.cpf
                        ? 'border-destructive focus:border-destructive'
                        : cpfValidation.isValid
                          ? 'border-green-500 focus:border-green-600'
                          : ''
                    }`}
                    data-testid="input-cpf"
                  />
                  {/* UX-006: Ícone de validação em tempo real */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {cpfValidation.isValidating ? (
                      <Loader2
                        className="h-4 w-4 animate-spin text-gray-400"
                        data-testid="icon-cpf-loading"
                      />
                    ) : clientData.cpf && clientData.cpf.replace(/\D/g, '').length >= 3 ? (
                      cpfValidation.isValid ? (
                        <CheckCircle2
                          className="h-4 w-4 text-green-600"
                          data-testid="icon-cpf-valid"
                        />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" data-testid="icon-cpf-invalid" />
                      )
                    ) : null}
                  </div>
                </div>
                {errors.cpf && <p className="mt-1 text-sm text-destructive">{errors.cpf}</p>}
                {/* UX-006: Mensagem de feedback em tempo real */}
                {clientData.cpf && cpfValidation.isValid && (
                  <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    CPF válido
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
                  className={errors.nome ? 'border-destructive focus:border-destructive' : ''}
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
              className={errors.dataNascimento ? 'border-red-500' : ''}
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
            <Select
              value={clientData.nacionalidade || ''}
              onValueChange={(value) => updateClient({ nacionalidade: value })}
            >
              <SelectTrigger data-testid="select-nacionalidade">
                <SelectValue placeholder="Selecione a nacionalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRASILEIRO">BRASILEIRO</SelectItem>
                <SelectItem value="BRASILEIRA">BRASILEIRA</SelectItem>
              </SelectContent>
            </Select>
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
          <CardDescription>Informações de contato</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="telefone">Telefone/WhatsApp *</Label>
            <MaskedInput
              mask="(99) 99999-9999"
              value={clientData.telefone}
              onChange={(value) => handlePhoneChange(value)}
              id="telefone"
              type="tel"
              placeholder="(11) 98765-4321"
              className={errors.telefone ? 'border-destructive focus:border-destructive' : ''}
              data-testid="input-telefone"
            />
            {errors.telefone && <p className="mt-1 text-sm text-destructive">{errors.telefone}</p>}
          </div>

          <div>
            <Label htmlFor="email">E-mail *</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                value={clientData.email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={errors.email ? 'border-destructive focus:border-destructive' : ''}
                data-testid="input-email"
              />
              {/* Ícone de validação email removido */}
            </div>
            {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
            {/* Mensagem de email válido removida */}
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
              <MaskedInput
                mask="99999-999"
                value={clientData.cep}
                onChange={(value) => handleCEPChange(value)}
                id="cep"
                placeholder="00000-000"
                className={`${
                  errors.cep
                    ? 'border-destructive focus:border-destructive'
                    : clientData.logradouro && !loadingCep
                      ? 'border-green-500 focus:border-green-500'
                      : ''
                } pr-10`}
                data-testid="input-cep"
              />
              {/* UX-006: Indicador de carregamento CEP em tempo real */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {loadingCep ? (
                  <Loader2
                    className="h-4 w-4 animate-spin text-blue-500"
                    data-testid="icon-cep-loading"
                  />
                ) : clientData.logradouro ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" data-testid="icon-cep-success" />
                ) : null}
              </div>
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
              onChange={(e) => updateClient({ logradouro: e.target.value })}
              className={`${errors.logradouro ? 'border-destructive' : ''} ${addressFieldsJustFilled ? 'address-flash' : ''}`}
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
              className={addressFieldsJustFilled ? 'address-flash' : ''}
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
              className={addressFieldsJustFilled ? 'address-flash' : ''}
              data-testid="input-cidade"
            />
          </div>

          <div>
            <Label htmlFor="estado">Estado</Label>
            <Select
              value={clientData.estado}
              onValueChange={(value) => updateClient({ estado: value })}
            >
              <SelectTrigger
                className={addressFieldsJustFilled ? 'address-flash' : ''}
                data-testid="select-estado"
              >
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
              onChange={(e) => updateClient({ ocupacao: e.target.value })}
              className={errors.ocupacao ? 'border-destructive' : ''}
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
              className={errors.rendaMensal ? 'border-destructive' : ''}
              data-testid="input-renda-mensal"
            />
            {errors.rendaMensal && (
              <p className="mt-1 text-sm text-destructive">{errors.rendaMensal}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="telefoneEmpresa">Telefone da Empresa</Label>
            <MaskedInput
              mask="(99) 9999-9999"
              value={clientData.telefoneEmpresa}
              onChange={(value) => updateClient({ telefoneEmpresa: value })}
              id="telefoneEmpresa"
              type="tel"
              placeholder="(11) 3456-7890"
              className={
                errors.telefoneEmpresa ? 'border-destructive focus:border-destructive' : ''
              }
              data-testid="input-telefone-empresa"
            />
            {errors.telefoneEmpresa && (
              <p className="mt-1 text-sm text-destructive">{errors.telefoneEmpresa}</p>
            )}
          </div>

          {/* Novos campos PAM V1.0 - Dados do Empregador */}
          <div>
            <Label htmlFor="clienteEmpresaNome">Nome da Empresa</Label>
            <Input
              id="clienteEmpresaNome"
              type="text"
              value={clientData.clienteEmpresaNome || ''}
              onChange={(e) => updateClient({ clienteEmpresaNome: e.target.value })}
              placeholder="Ex: Empresa LTDA"
              data-testid="input-empresa-nome"
            />
          </div>

          <div>
            <Label htmlFor="clienteDataAdmissao">Data de Admissão</Label>
            <Input
              id="clienteDataAdmissao"
              type="date"
              value={clientData.clienteDataAdmissao || ''}
              onChange={(e) => updateClient({ clienteDataAdmissao: e.target.value })}
              data-testid="input-data-admissao"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="clienteDividasExistentes">Valor de Dívidas Existentes</Label>
            <CurrencyInput
              id="clienteDividasExistentes"
              value={clientData.clienteDividasExistentes?.toString() || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value.replace(/[^\d,.-]/g, '').replace(',', '.'));
                updateClient({ clienteDividasExistentes: isNaN(value) ? undefined : value });
              }}
              placeholder="R$ 0,00"
              data-testid="input-dividas-existentes"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Informe o valor total de dívidas em cartões, financiamentos, etc.
            </p>
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
                    value={clientData.dadosPagamentoBanco || ''}
                    onValueChange={(value) => updateClient({ dadosPagamentoBanco: value })}
                  >
                    <SelectTrigger data-testid="select-banco">
                      <SelectValue placeholder="Selecione o banco..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Bancos Populares
                      </div>
                      {commonBanks.map((bank) => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.code} - {bank.name}
                        </SelectItem>
                      ))}
                      <div className="mt-2 px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Todos os Bancos
                      </div>
                      {brazilianBanks
                        .filter((b) => !commonBanks.find((c) => c.code === b.code))
                        .map((bank) => (
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

                <div>
                  <Label htmlFor="tipoConta">Tipo de Conta *</Label>
                  <Select
                    value={clientData.dadosPagamentoTipo || ''}
                    onValueChange={(value) => updateClient({ dadosPagamentoTipo: value })}
                  >
                    <SelectTrigger data-testid="select-tipo-conta">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conta_corrente">Conta Corrente</SelectItem>
                      <SelectItem value="conta_poupanca">Conta Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pix" className="space-y-4">
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Bancos Populares
                      </div>
                      {commonBanks.map((bank) => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.code} - {bank.name}
                        </SelectItem>
                      ))}
                      <div className="mt-2 px-2 py-1 text-xs font-semibold text-muted-foreground">
                        Todos os Bancos
                      </div>
                      {brazilianBanks
                        .filter((b) => !commonBanks.find((c) => c.code === b.code))
                        .map((bank) => (
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
                    value={clientData.dadosPagamentoPixNomeTitular || ''}
                    onChange={(e) => updateClient({ dadosPagamentoPixNomeTitular: e.target.value })}
                    data-testid="input-pix-nome-titular"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="pixCpfTitular">CPF/CNPJ do Titular</Label>
                  <MaskedInput
                    mask={
                      clientData.dadosPagamentoPixCpfTitular &&
                      clientData.dadosPagamentoPixCpfTitular.length > 14
                        ? '99.999.999/9999-99'
                        : '999.999.999-99'
                    }
                    value={clientData.dadosPagamentoPixCpfTitular || ''}
                    onChange={(value) => updateClient({ dadosPagamentoPixCpfTitular: value })}
                    id="pixCpfTitular"
                    placeholder="CPF ou CNPJ do titular"
                    data-testid="input-pix-cpf-titular"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Cliente Encontrado */}
      <ConfirmationDialog
        isOpen={showClientConfirmDialog}
        onClose={() => {
          setShowClientConfirmDialog(false);
          setClientFoundData(null);
        }}
        onConfirm={handleUseExistingClientData}
        title="Cliente Encontrado"
        description={`Encontramos dados de: ${clientFoundData?.nome || 'Cliente'}\n\nDeseja preencher a proposta com os dados existentes?`}
        confirmText="Usar Dados"
        cancelText="Não Usar"
        variant="default"
        isLoading={loadingCpfData}
      />
    </div>
  );
}
