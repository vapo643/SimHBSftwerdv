import React from 'react';
import { useProposal, useProposalActions } from '@/contexts/ProposalContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, Package, Calculator, AlertCircle } from 'lucide-react';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { format } from 'date-fns';

export function LoanConditionsStep() {
  const { state } = useProposal();
  const { selectProduct, selectTable, updateLoanConditions } = useProposalActions();
  const { context, loanData, simulation, errors } = state;

  if (!context) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Erro ao carregar dados. Por favor, recarregue a página.</AlertDescription>
      </Alert>
    );
  }

  // Get selected product
  const selectedProduct = context.produtos.find((p) => p.id === loanData.produtoId);

  // Get available terms from selected table
  const selectedTable = selectedProduct?.tabelasDisponiveis.find(
    (t) => t.id === loanData.tabelaComercialId
  );
  const availableTerms = selectedTable?.prazos || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produto e Tabela Comercial
          </CardTitle>
          <CardDescription>Selecione o produto de crédito e a tabela comercial</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="produto">Produto de Crédito</Label>
            <Select
              value={loanData.produtoId?.toString() || ''}
              onValueChange={(value) => selectProduct(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto..." />
              </SelectTrigger>
              <SelectContent>
                {context.produtos.map((produto) => (
                  <SelectItem key={produto.id} value={produto.id.toString()}>
                    {produto.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.produtoId && (
              <p className="mt-1 text-sm text-destructive">{errors.produtoId}</p>
            )}
          </div>

          <div>
            <Label htmlFor="tabela">Tabela Comercial</Label>
            <Select
              value={loanData.tabelaComercialId?.toString() || ''}
              onValueChange={(value) => selectTable(parseInt(value))}
              disabled={!selectedProduct}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedProduct
                      ? 'Primeiro selecione um produto'
                      : 'Selecione uma tabela comercial...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {selectedProduct?.tabelasDisponiveis.map((tabela) => (
                  <SelectItem key={tabela.id} value={tabela.id.toString()}>
                    {tabela.nomeTabela}
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({tabela.taxaJuros}% a.m. - {tabela.tipo})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tabelaComercialId && (
              <p className="mt-1 text-sm text-destructive">{errors.tabelaComercialId}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Condições do Empréstimo
          </CardTitle>
          <CardDescription>Defina o valor, prazo e condições do empréstimo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="valorSolicitado">Valor Solicitado</Label>
            <CurrencyInput
              id="valorSolicitado"
              value={loanData.valorSolicitado}
              onChange={(e) => updateLoanConditions({ valorSolicitado: e.target.value })}
              placeholder={`Mín: R$ ${context.limites.valorMinimo.toLocaleString('pt-BR')} - Máx: R$ ${context.limites.valorMaximo.toLocaleString('pt-BR')}`}
              className={errors.valorSolicitado ? 'border-destructive' : ''}
            />
            {errors.valorSolicitado && (
              <p className="mt-1 text-sm text-destructive">{errors.valorSolicitado}</p>
            )}
          </div>

          <div>
            <Label htmlFor="prazo">Prazo (meses)</Label>
            <Select
              value={loanData.prazo?.toString() || ''}
              onValueChange={(value) => updateLoanConditions({ prazo: parseInt(value) })}
              disabled={!selectedTable}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedTable
                      ? 'Primeiro selecione uma tabela comercial'
                      : 'Selecione o prazo...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableTerms.map((prazo) => (
                  <SelectItem key={prazo} value={prazo.toString()}>
                    {prazo} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.prazo && <p className="mt-1 text-sm text-destructive">{errors.prazo}</p>}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="incluirTac"
              checked={loanData.incluirTac}
              onCheckedChange={(checked) => updateLoanConditions({ incluirTac: !!checked })}
            />
            <Label
              htmlFor="incluirTac"
              className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Incluir Taxa de Abertura de Crédito (TAC)
            </Label>
          </div>

          <div>
            <Label htmlFor="dataCarencia">Data de Carência (opcional)</Label>
            <Input
              id="dataCarencia"
              type="date"
              value={loanData.dataCarencia || ''}
              onChange={(e) => updateLoanConditions({ dataCarencia: e.target.value })}
              min={format(new Date(), 'yyyy-MM-dd')}
              max={format(new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}
            />
            <p className="mt-1 text-sm text-muted-foreground">Máximo de 45 dias a partir de hoje</p>
          </div>
        </CardContent>
      </Card>

      {simulation && (
        <Card className="border-2 border-green-500 dark:border-green-400">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Calculator className="h-5 w-5" />
              Simulação de Crédito
            </CardTitle>
            <CardDescription>Resumo das condições calculadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor da Parcela</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  R${' '}
                  {parseFloat(simulation.valorParcela).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Juros</p>
                <p className="text-lg font-semibold">{simulation.taxaJuros}% ao mês</p>
                {simulation.taxaJurosAnual && (
                  <p className="text-xs text-muted-foreground">
                    ({parseFloat(simulation.taxaJurosAnual).toFixed(2)}% ao ano)
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Solicitado:</span>
                <span className="text-foreground">
                  R${' '}
                  {parseFloat(loanData.valorSolicitado || '0').toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* IOF Detalhado */}
              {simulation.iofDetalhado ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IOF Diário:</span>
                    <span className="text-foreground">
                      R${' '}
                      {parseFloat(simulation.iofDetalhado.diario).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IOF Adicional:</span>
                    <span className="text-foreground">
                      R${' '}
                      {parseFloat(simulation.iofDetalhado.adicional).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">IOF Total:</span>
                    <span className="text-foreground">
                      R${' '}
                      {parseFloat(simulation.iofDetalhado.total).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IOF:</span>
                  <span className="text-foreground">
                    R${' '}
                    {parseFloat(simulation.valorIOF).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              {/* TAC */}
              {parseFloat(simulation.valorTAC) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TAC:</span>
                  <span className="text-foreground">
                    R${' '}
                    {parseFloat(simulation.valorTAC).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              {/* Comissão */}
              {simulation.comissao && parseFloat(simulation.comissao) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Comissão ({simulation.comissaoPercentual}%):
                  </span>
                  <span className="text-foreground">
                    R${' '}
                    {parseFloat(simulation.comissao).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              {/* Juros de Carência */}
              {simulation.jurosCarencia && parseFloat(simulation.jurosCarencia) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Juros de Carência ({simulation.diasCarencia} dias):
                  </span>
                  <span className="text-foreground">
                    R${' '}
                    {parseFloat(simulation.jurosCarencia).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              {/* Total Financiado */}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                <span className="text-foreground">Total Financiado:</span>
                <span className="text-foreground">
                  R${' '}
                  {parseFloat(simulation.valorTotalFinanciado).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Total a Pagar */}
              {simulation.valorTotalAPagar && (
                <div className="flex justify-between text-sm font-semibold text-blue-600 dark:text-blue-400">
                  <span>Total que o Cliente Pagará:</span>
                  <span>
                    R${' '}
                    {parseFloat(simulation.valorTotalAPagar).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              {/* Custo da Operação */}
              {simulation.custoTotalOperacao && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo Total da Operação:</span>
                  <span className="text-foreground">
                    R${' '}
                    {parseFloat(simulation.custoTotalOperacao).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              {/* CET Anual */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CET Anual:</span>
                <span className="font-semibold text-foreground">
                  {parseFloat(simulation.custoEfetivoTotal).toFixed(2)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
