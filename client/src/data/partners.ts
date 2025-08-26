export interface Loja {
  id: string;
  nome: string;
}
export interface Partner {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  lojas: Loja[];
}

export const mockPartners: Partner[] = [
  {
    id: '1',
    cnpj: '11.222.333/0001-44',
    razaoSocial: 'Comércio de Veículos A Ltda',
    nomeFantasia: 'Parceiro A',
    lojas: [{ id: '101', nome: 'Loja Centro' }],
  },
  {
    id: '2',
    cnpj: '44.555.666/0001-77',
    razaoSocial: 'Varejo de Bens B S.A.',
    nomeFantasia: 'Parceiro B',
    lojas: [
      { id: '201', nome: 'Loja Sul' },
      { id: '202', nome: 'Loja Norte' },
    ],
  },
];
