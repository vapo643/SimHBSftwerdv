import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Proposta {
  id: string;
  cliente: string;
  status: string;
}

const FilaFormalizacao: React.FC = () => {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPropostas = async () => {
      try {
        const response = await fetch("/api/formalizacao/propostas");
        if (!response.ok) {
          throw new Error("Falha ao buscar propostas");
        }
        const data = await response.json();
        setPropostas(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Um erro desconhecido ocorreu.");
      } finally {
        setLoading(false);
      }
    };

    fetchPropostas();
  }, []);

  return (
    <DashboardLayout title="Fila de Formalização">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Fila de Formalização</h1>
        <Card>
          <CardContent className="p-0">
            {loading && <p className="p-4 text-center">Carregando propostas...</p>}
            {error && <p className="p-4 text-center text-red-500">{error}</p>}
            {!loading && !error && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Proposta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status da Formalização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propostas.length > 0 ? (
                    propostas.map(proposta => (
                      <TableRow key={proposta.id}>
                        <TableCell className="font-medium">{proposta.id}</TableCell>
                        <TableCell>{proposta.cliente}</TableCell>
                        <TableCell>{proposta.status}</TableCell>
                        <TableCell className="text-right">
                          <Link to={`/formalizacao/acompanhamento/${proposta.id}`}>
                            <Button variant="outline" size="sm">
                              Acompanhar
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        Nenhuma proposta na fila de formalização.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FilaFormalizacao;
