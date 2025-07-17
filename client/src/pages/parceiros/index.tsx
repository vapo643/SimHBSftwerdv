import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PartnerForm from '@/components/parceiros/PartnerForm';
import { mockPartners, Partner } from '@/data/partners';
import DashboardLayout from '@/components/DashboardLayout';
import { Link } from 'wouter';

const PartnersPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>(mockPartners);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const handleCreateOrEdit = (partner: any) => {
    // Lógica para criar ou editar parceiros
    setIsModalOpen(false);
  };
  
  const openNewModal = () => {
    setSelectedPartner(null);
    setIsModalOpen(true);
  };

  return (
    <DashboardLayout title="Gestão de Parceiros">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Parceiros</h1>
        <Button onClick={openNewModal}>Novo Parceiro</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Razão Social</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Lojas</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map(partner => (
            <TableRow key={partner.id}>
              <TableCell>{partner.razaoSocial}</TableCell>
              <TableCell>{partner.cnpj}</TableCell>
              <TableCell>{partner.lojas.length}</TableCell>
              <TableCell>
                <Link to={`/parceiros/detalhe/${partner.id}`}>
                  <Button variant="outline" size="sm">Ver Detalhes</Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPartner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
          </DialogHeader>
          <PartnerForm 
            initialData={selectedPartner}
            onSubmit={handleCreateOrEdit}
            onCancel={() => { setIsModalOpen(false); setSelectedPartner(null); }}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};
export default PartnersPage;