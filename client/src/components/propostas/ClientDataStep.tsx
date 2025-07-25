import React from "react";
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
import { User, Phone, Mail, Calendar, MapPin, Briefcase } from "lucide-react";
import CurrencyInput from "@/components/ui/CurrencyInput";

export function ClientDataStep() {
  const { state } = useProposal();
  const { updateClient } = useProposalActions();
  const { clientData, errors } = state;

  return (
    <div className="space-y-6">
      <Card className="bg-black border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados Pessoais
          </CardTitle>
          <CardDescription>
            Informações básicas do cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              type="text"
              placeholder="000.000.000-00"
              value={clientData.cpf}
              onChange={(e) => updateClient({ cpf: e.target.value })}
              className={errors.cpf ? "border-red-500" : ""}
            />
            {errors.cpf && <p className="mt-1 text-sm text-red-500">{errors.cpf}</p>}
          </div>

          <div>
            <Label htmlFor="nome">Nome Completo</Label>
            <Input
              id="nome"
              type="text"
              value={clientData.nome}
              onChange={(e) => updateClient({ nome: e.target.value })}
              className={errors.nome ? "border-red-500" : ""}
            />
            {errors.nome && <p className="mt-1 text-sm text-red-500">{errors.nome}</p>}
          </div>

          <div>
            <Label htmlFor="rg">RG</Label>
            <Input
              id="rg"
              type="text"
              value={clientData.rg}
              onChange={(e) => updateClient({ rg: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="orgaoEmissor">Órgão Emissor</Label>
            <Input
              id="orgaoEmissor"
              type="text"
              placeholder="SSP-SP"
              value={clientData.orgaoEmissor}
              onChange={(e) => updateClient({ orgaoEmissor: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="dataEmissao">Data de Emissão</Label>
            <Input
              id="dataEmissao"
              type="date"
              value={clientData.dataEmissao}
              onChange={(e) => updateClient({ dataEmissao: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="dataNascimento">Data de Nascimento</Label>
            <Input
              id="dataNascimento"
              type="date"
              value={clientData.dataNascimento}
              onChange={(e) => updateClient({ dataNascimento: e.target.value })}
              className={errors.dataNascimento ? "border-red-500" : ""}
            />
            {errors.dataNascimento && <p className="mt-1 text-sm text-red-500">{errors.dataNascimento}</p>}
          </div>

          <div>
            <Label htmlFor="estadoCivil">Estado Civil</Label>
            <Select
              value={clientData.estadoCivil}
              onValueChange={(value) => updateClient({ estadoCivil: value })}
            >
              <SelectTrigger>
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
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-black border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contato
          </CardTitle>
          <CardDescription>
            Informações de contato do cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="telefone">Telefone/WhatsApp</Label>
            <Input
              id="telefone"
              type="tel"
              placeholder="(11) 98765-4321"
              value={clientData.telefone}
              onChange={(e) => updateClient({ telefone: e.target.value })}
              className={errors.telefone ? "border-red-500" : ""}
            />
            {errors.telefone && <p className="mt-1 text-sm text-red-500">{errors.telefone}</p>}
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={clientData.email}
              onChange={(e) => updateClient({ email: e.target.value })}
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-black border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Endereço
          </CardTitle>
          <CardDescription>
            Endereço residencial completo
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              type="text"
              placeholder="00000-000"
              value={clientData.cep}
              onChange={(e) => updateClient({ cep: e.target.value })}
              className={errors.cep ? "border-red-500" : ""}
            />
            {errors.cep && <p className="mt-1 text-sm text-red-500">{errors.cep}</p>}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              type="text"
              value={clientData.endereco}
              onChange={(e) => updateClient({ endereco: e.target.value })}
              className={errors.endereco ? "border-red-500" : ""}
            />
            {errors.endereco && <p className="mt-1 text-sm text-red-500">{errors.endereco}</p>}
          </div>

          <div>
            <Label htmlFor="numero">Número</Label>
            <Input
              id="numero"
              type="text"
              value={clientData.numero}
              onChange={(e) => updateClient({ numero: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="complemento">Complemento</Label>
            <Input
              id="complemento"
              type="text"
              placeholder="Apto, Casa, etc."
              value={clientData.complemento}
              onChange={(e) => updateClient({ complemento: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              type="text"
              value={clientData.bairro}
              onChange={(e) => updateClient({ bairro: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              type="text"
              value={clientData.cidade}
              onChange={(e) => updateClient({ cidade: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="estado">Estado</Label>
            <Select
              value={clientData.estado}
              onValueChange={(value) => updateClient({ estado: value })}
            >
              <SelectTrigger>
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

      <Card className="bg-black border-gray-800">
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
              className={errors.ocupacao ? "border-red-500" : ""}
            />
            {errors.ocupacao && <p className="mt-1 text-sm text-red-500">{errors.ocupacao}</p>}
          </div>

          <div>
            <Label htmlFor="rendaMensal">Renda Mensal</Label>
            <CurrencyInput
              id="rendaMensal"
              value={clientData.rendaMensal}
              onChange={(e) => updateClient({ rendaMensal: e.target.value })}
              className={errors.rendaMensal ? "border-red-500" : ""}
            />
            {errors.rendaMensal && <p className="mt-1 text-sm text-red-500">{errors.rendaMensal}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}