import PDFDocument from 'pdfkit';

export interface TemplateSection {
  id: string;
  title: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  fontSize?: number;
  fontStyle?: 'normal' | 'bold' | 'italic';
  alignment?: 'left' | 'center' | 'right' | 'justify';
  underline?: boolean;
  fields?: TemplateField[];
}

export interface TemplateField {
  id: string;
  label: string;
  position: { x: number; y: number };
  width?: number;
  fontSize?: number;
  fontStyle?: 'normal' | 'bold' | 'italic';
  dataPath: string; // e.g., 'clienteData.nome', 'condicoesData.valor'
  formatter?: 'currency' | 'date' | 'percentage' | 'text';
}

export interface PDFTemplate {
  id: string;
  name: string;
  description: string;
  pageSize: 'A4' | 'Letter';
  margins: { top: number; bottom: number; left: number; right: number };
  header?: TemplateSection;
  sections: TemplateSection[];
  footer?: TemplateSection;
}

export class PDFTemplateEngine {
  private doc: PDFKit.PDFDocument;
  private template: PDFTemplate;
  private data: any;

  constructor(template: PDFTemplate, data: any) {
    this.template = template;
    this.data = data;
    this.doc = new PDFDocument({
      size: template.pageSize,
      margin: 0, // We'll handle margins manually
      info: {
        Title: `Documento - ${template.name}`,
        Author: 'Sistema Simpix',
        Subject: template.description,
        Creator: 'Simpix Template Engine',
        Producer: 'PDFKit',
        CreationDate: new Date(),
        ModDate: new Date()
      }
    });
  }

  public async generate(): Promise<Buffer> {
    const chunks: Buffer[] = [];
    this.doc.on('data', chunk => chunks.push(chunk));

    // Render header if exists
    if (this.template.header) {
      this.renderSection(this.template.header);
    }

    // Render all sections
    for (const section of this.template.sections) {
      this.renderSection(section);
    }

    // Render footer if exists
    if (this.template.footer) {
      this.renderSection(this.template.footer);
    }

    this.doc.end();

    return new Promise((resolve, reject) => {
      this.doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      
      this.doc.on('error', (err) => {
        reject(err);
      });
    });
  }

  private renderSection(section: TemplateSection): void {
    // Set position for section
    this.doc.x = section.position.x + this.template.margins.left;
    this.doc.y = section.position.y + this.template.margins.top;

    // Render section title
    if (section.title) {
      this.doc
        .fontSize(section.fontSize || 14)
        .font(this.getFontName(section.fontStyle || 'bold'));

      if (section.underline) {
        this.doc.text(section.title, { underline: true, align: section.alignment || 'left' });
      } else {
        this.doc.text(section.title, { align: section.alignment || 'left' });
      }

      this.doc.moveDown(0.5);
    }

    // Render fields
    if (section.fields) {
      for (const field of section.fields) {
        this.renderField(field, section);
      }
    }
  }

  private renderField(field: TemplateField, section: TemplateSection): void {
    const value = this.getDataValue(field.dataPath);
    const formattedValue = this.formatValue(value, field.formatter);

    // Calculate absolute position
    const x = section.position.x + field.position.x + this.template.margins.left;
    const y = section.position.y + field.position.y + this.template.margins.top;

    // Render label if exists
    if (field.label) {
      this.doc
        .fontSize(field.fontSize || 10)
        .font(this.getFontName('bold'))
        .text(field.label, x, y, { width: field.width || 150 });
    }

    // Render value
    const valueY = field.label ? y + 12 : y;
    this.doc
      .fontSize(field.fontSize || 10)
      .font(this.getFontName(field.fontStyle || 'normal'))
      .text(formattedValue, x + (field.label ? 160 : 0), valueY, { 
        width: field.width || 200 
      });
  }

  private getDataValue(path: string): any {
    const keys = path.split('.');
    let value = this.data;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return 'N/A';
      }
    }
    
    return value || 'N/A';
  }

  private formatValue(value: any, formatter?: string): string {
    if (value === null || value === undefined || value === 'N/A') {
      return 'N/A';
    }

    switch (formatter) {
      case 'currency':
        return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
      case 'date':
        return new Date(value).toLocaleDateString('pt-BR');
      case 'percentage':
        return `${Number(value).toFixed(2)}%`;
      case 'text':
      default:
        return String(value);
    }
  }

  private getFontName(style: string): string {
    switch (style) {
      case 'bold':
        return 'Helvetica-Bold';
      case 'italic':
        return 'Helvetica-Oblique';
      default:
        return 'Helvetica';
    }
  }
}

// Pre-defined CCB template
export const CCB_TEMPLATE: PDFTemplate = {
  id: 'ccb-standard',
  name: 'CCB Padrão',
  description: 'Cédula de Crédito Bancário - Modelo Padrão',
  pageSize: 'A4',
  margins: { top: 40, bottom: 40, left: 60, right: 60 },
  
  header: {
    id: 'header',
    title: 'CÉDULA DE CRÉDITO BANCÁRIO',
    position: { x: 0, y: 0 },
    fontSize: 20,
    fontStyle: 'bold',
    alignment: 'center'
  },

  sections: [
    {
      id: 'identification',
      title: '',
      position: { x: 0, y: 60 },
      fields: [
        {
          id: 'cedula-number',
          label: 'Nº da Cédula:',
          position: { x: 0, y: 0 },
          dataPath: 'propostaId',
          fontSize: 10
        },
        {
          id: 'emission-date',
          label: 'Data de Emissão:',
          position: { x: 180, y: 0 },
          dataPath: 'dataEmissao',
          formatter: 'date',
          fontSize: 10
        },
        {
          id: 'due-date',
          label: 'Vencimento:',
          position: { x: 360, y: 0 },
          dataPath: 'dataVencimento',
          formatter: 'date',
          fontSize: 10
        }
      ]
    },

    {
      id: 'debtor',
      title: 'I. DEVEDOR (EMITENTE)',
      position: { x: 0, y: 120 },
      fontSize: 12,
      fontStyle: 'bold',
      underline: true,
      fields: [
        {
          id: 'debtor-name',
          label: 'Nome/Razão Social:',
          position: { x: 0, y: 25 },
          dataPath: 'clienteData.nome',
          width: 320,
          fontSize: 10
        },
        {
          id: 'debtor-document',
          label: 'CPF/CNPJ:',
          position: { x: 0, y: 45 },
          dataPath: 'clienteData.cpf',
          width: 320,
          fontSize: 10
        },
        {
          id: 'debtor-address',
          label: 'Endereço:',
          position: { x: 0, y: 65 },
          dataPath: 'clienteData.endereco',
          width: 320,
          fontSize: 10
        },
        {
          id: 'debtor-phone',
          label: 'Telefone:',
          position: { x: 0, y: 85 },
          dataPath: 'clienteData.telefone',
          width: 150,
          fontSize: 10
        },
        {
          id: 'debtor-email',
          label: 'Email:',
          position: { x: 260, y: 85 },
          dataPath: 'clienteData.email',
          width: 170,
          fontSize: 10
        }
      ]
    },

    {
      id: 'creditor',
      title: 'II. CREDOR ORIGINÁRIO',
      position: { x: 0, y: 240 },
      fontSize: 12,
      fontStyle: 'bold',
      underline: true,
      fields: [
        {
          id: 'creditor-name',
          label: 'Razão Social:',
          position: { x: 0, y: 25 },
          dataPath: 'credorData.razaoSocial',
          width: 320,
          fontSize: 10
        },
        {
          id: 'creditor-document',
          label: 'CNPJ:',
          position: { x: 0, y: 45 },
          dataPath: 'credorData.cnpj',
          width: 320,
          fontSize: 10
        }
      ]
    },

    {
      id: 'conditions',
      title: 'III. CONDIÇÕES DA OPERAÇÃO DE CRÉDITO',
      position: { x: 0, y: 320 },
      fontSize: 12,
      fontStyle: 'bold',
      underline: true,
      fields: [
        {
          id: 'principal-value',
          label: 'Valor Principal:',
          position: { x: 0, y: 25 },
          dataPath: 'condicoesData.valor',
          formatter: 'currency',
          width: 150,
          fontSize: 10
        },
        {
          id: 'installment-value',
          label: 'Valor da Parcela:',
          position: { x: 260, y: 25 },
          dataPath: 'condicoesData.parcela',
          formatter: 'currency',
          width: 100,
          fontSize: 10
        },
        {
          id: 'term',
          label: 'Prazo:',
          position: { x: 0, y: 45 },
          dataPath: 'condicoesData.prazoMeses',
          width: 150,
          fontSize: 10
        },
        {
          id: 'interest-rate',
          label: 'Taxa de Juros:',
          position: { x: 0, y: 65 },
          dataPath: 'condicoesData.taxaJuros',
          formatter: 'percentage',
          width: 150,
          fontSize: 10
        },
        {
          id: 'tac-value',
          label: 'TAC:',
          position: { x: 260, y: 45 },
          dataPath: 'condicoesData.valorTac',
          formatter: 'currency',
          width: 100,
          fontSize: 10
        },
        {
          id: 'iof-value',
          label: 'IOF:',
          position: { x: 260, y: 65 },
          dataPath: 'condicoesData.valorIof',
          formatter: 'currency',
          width: 100,
          fontSize: 10
        }
      ]
    },

    {
      id: 'payment-terms',
      title: 'IV. FORMA DE PAGAMENTO',
      position: { x: 0, y: 430 },
      fontSize: 12,
      fontStyle: 'bold',
      underline: true,
      fields: [
        {
          id: 'payment-info',
          label: '',
          position: { x: 0, y: 25 },
          dataPath: 'pagamentoInfo',
          width: 480,
          fontSize: 10
        }
      ]
    },

    {
      id: 'clauses',
      title: 'V. CLÁUSULAS GERAIS',
      position: { x: 0, y: 500 },
      fontSize: 12,
      fontStyle: 'bold',
      underline: true,
      fields: [
        {
          id: 'general-clauses',
          label: '',
          position: { x: 0, y: 25 },
          dataPath: 'clausulasGerais',
          width: 480,
          fontSize: 9
        }
      ]
    }
  ],

  footer: {
    id: 'signatures',
    title: 'VI. ASSINATURAS',
    position: { x: 0, y: 650 },
    fontSize: 12,
    fontStyle: 'bold',
    underline: true,
    fields: [
      {
        id: 'location-date',
        label: '',
        position: { x: 0, y: 25 },
        dataPath: 'localData',
        width: 480,
        fontSize: 10
      },
      {
        id: 'debtor-signature',
        label: 'DEVEDOR:',
        position: { x: 0, y: 70 },
        dataPath: 'assinaturaDevedor',
        width: 200,
        fontSize: 10
      },
      {
        id: 'creditor-signature',
        label: 'CREDOR:',
        position: { x: 260, y: 70 },
        dataPath: 'assinaturaCredor',
        width: 200,
        fontSize: 10
      }
    ]
  }
};