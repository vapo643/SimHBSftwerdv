import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const mockData = [
  { id: 'PRO-001', dataSolicitacao: '2025-07-16', cliente: 'Cliente A', cpf: '123.456.789-01', parceiro: 'Parceiro X', valorSolicitado: 'R$ 5.000,00', score: 750, status: 'Em Análise' },
  { id: 'PRO-002', dataSolicitacao: '2025-07-15', cliente: 'Cliente B', cpf: '123.456.789-02', parceiro: 'Parceiro Y', valorSolicitado: 'R$ 15.000,00', score: 820, status: 'Aprovado' },
  { id: 'PRO-003', dataSolicitacao: '2025-07-14', cliente: 'Cliente C', cpf: '123.456.789-03', parceiro: 'Parceiro X', valorSolicitado: 'R$ 7.500,00', score: 650, status: 'Rejeitado' },
];

const FilaAnalise: React.FC = () => {
  return (
    <DashboardLayout title="Fila de Análise de Crédito">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Fila de Análise de Crédito</h1>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Proposta</TableHead>
                  <TableHead>Data Solicitação</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Valor Solicitado</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockData.map(proposta => (
                  <TableRow key={proposta.id}>
                    <TableCell className="font-medium">{proposta.id}</TableCell>
                    <TableCell>{proposta.dataSolicitacao}</TableCell>
                    <TableCell>{proposta.cliente}</TableCell>
                    <TableCell>{proposta.cpf}</TableCell>
                    <TableCell>{proposta.parceiro}</TableCell>
                    <TableCell>{proposta.valorSolicitado}</TableCell>
                    <TableCell>{proposta.score}</TableCell>
                    <TableCell>{proposta.status}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">Analisar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FilaAnalise;