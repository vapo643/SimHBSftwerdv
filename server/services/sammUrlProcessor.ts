// SAMM URL Processor Service
// Processa as URLs do OWASP SAMM para integração com o sistema

export interface SAMMUrl {
  category: string;
  subcategory: string;
  stream?: string;
  url: string;
  description: string;
}

export class SAMMUrlProcessor {
  private sammUrls: SAMMUrl[] = [];

  constructor() {
    this.initializeUrls();
  }

  private initializeUrls(): void {
    // URLs organizadas por categoria baseadas no arquivo fornecido
    this.sammUrls = [
      // Página Principal
      {
        category: 'Model',
        subcategory: 'Overview',
        url: 'https://owaspsamm.org/model/',
        description: 'Modelo SAMM Geral',
      },

      // Governance
      {
        category: 'Governance',
        subcategory: 'Overview',
        url: 'https://owaspsamm.org/model/governance/',
        description: 'Visão Geral de Governance',
      },
      {
        category: 'Governance',
        subcategory: 'Strategy and Metrics',
        url: 'https://owaspsamm.org/model/governance/strategy-and-metrics/',
        description: 'Estratégia e Métricas',
      },
      {
        category: 'Governance',
        subcategory: 'Strategy and Metrics',
        stream: 'A',
        url: 'https://owaspsamm.org/model/governance/strategy-and-metrics/stream-a/',
        description: 'Stream A - Create and Promote',
      },
      {
        category: 'Governance',
        subcategory: 'Strategy and Metrics',
        stream: 'B',
        url: 'https://owaspsamm.org/model/governance/strategy-and-metrics/stream-b/',
        description: 'Stream B - Measure and Improve',
      },
      {
        category: 'Governance',
        subcategory: 'Policy and Compliance',
        url: 'https://owaspsamm.org/model/governance/policy-and-compliance/',
        description: 'Política e Conformidade',
      },
      {
        category: 'Governance',
        subcategory: 'Policy and Compliance',
        stream: 'A',
        url: 'https://owaspsamm.org/model/governance/policy-and-compliance/stream-a/',
        description: 'Stream A - Policy & Standards',
      },
      {
        category: 'Governance',
        subcategory: 'Policy and Compliance',
        stream: 'B',
        url: 'https://owaspsamm.org/model/governance/policy-and-compliance/stream-b/',
        description: 'Stream B - Compliance Management',
      },
      {
        category: 'Governance',
        subcategory: 'Education and Guidance',
        url: 'https://owaspsamm.org/model/governance/education-and-guidance/',
        description: 'Educação e Orientação',
      },
      {
        category: 'Governance',
        subcategory: 'Education and Guidance',
        stream: 'A',
        url: 'https://owaspsamm.org/model/governance/education-and-guidance/stream-a/',
        description: 'Stream A - Training and Awareness',
      },
      {
        category: 'Governance',
        subcategory: 'Education and Guidance',
        stream: 'B',
        url: 'https://owaspsamm.org/model/governance/education-and-guidance/stream-b/',
        description: 'Stream B - Organization and Culture',
      },

      // Design
      {
        category: 'Design',
        subcategory: 'Overview',
        url: 'https://owaspsamm.org/model/design/',
        description: 'Visão Geral de Design',
      },
      {
        category: 'Design',
        subcategory: 'Threat Assessment',
        url: 'https://owaspsamm.org/model/design/threat-assessment/',
        description: 'Avaliação de Ameaças',
      },
      {
        category: 'Design',
        subcategory: 'Threat Assessment',
        stream: 'A',
        url: 'https://owaspsamm.org/model/design/threat-assessment/stream-a/',
        description: 'Stream A - Application Risk Profile',
      },
      {
        category: 'Design',
        subcategory: 'Threat Assessment',
        stream: 'B',
        url: 'https://owaspsamm.org/model/design/threat-assessment/stream-b/',
        description: 'Stream B - Threat Modeling',
      },
      {
        category: 'Design',
        subcategory: 'Security Requirements',
        url: 'https://owaspsamm.org/model/design/security-requirements/',
        description: 'Requisitos de Segurança',
      },
      {
        category: 'Design',
        subcategory: 'Security Requirements',
        stream: 'A',
        url: 'https://owaspsamm.org/model/design/security-requirements/stream-a/',
        description: 'Stream A - Software Requirements',
      },
      {
        category: 'Design',
        subcategory: 'Security Requirements',
        stream: 'B',
        url: 'https://owaspsamm.org/model/design/security-requirements/stream-b/',
        description: 'Stream B - Supplier Security',
      },
      {
        category: 'Design',
        subcategory: 'Secure Architecture',
        url: 'https://owaspsamm.org/model/design/secure-architecture/',
        description: 'Arquitetura Segura',
      },
      {
        category: 'Design',
        subcategory: 'Secure Architecture',
        stream: 'A',
        url: 'https://owaspsamm.org/model/design/secure-architecture/stream-a/',
        description: 'Stream A - Architecture Design',
      },
      {
        category: 'Design',
        subcategory: 'Secure Architecture',
        stream: 'B',
        url: 'https://owaspsamm.org/model/design/secure-architecture/stream-b/',
        description: 'Stream B - Technology Management',
      },

      // Implementation
      {
        category: 'Implementation',
        subcategory: 'Overview',
        url: 'https://owaspsamm.org/model/implementation/',
        description: 'Visão Geral de Implementation',
      },
      {
        category: 'Implementation',
        subcategory: 'Secure Build',
        url: 'https://owaspsamm.org/model/implementation/secure-build/',
        description: 'Construção Segura',
      },
      {
        category: 'Implementation',
        subcategory: 'Secure Build',
        stream: 'A',
        url: 'https://owaspsamm.org/model/implementation/secure-build/stream-a/',
        description: 'Stream A - Build Process',
      },
      {
        category: 'Implementation',
        subcategory: 'Secure Build',
        stream: 'B',
        url: 'https://owaspsamm.org/model/implementation/secure-build/stream-b/',
        description: 'Stream B - Software Dependencies',
      },
      {
        category: 'Implementation',
        subcategory: 'Secure Deployment',
        url: 'https://owaspsamm.org/model/implementation/secure-deployment/',
        description: 'Implantação Segura',
      },
      {
        category: 'Implementation',
        subcategory: 'Secure Deployment',
        stream: 'A',
        url: 'https://owaspsamm.org/model/implementation/secure-deployment/stream-a/',
        description: 'Stream A - Deployment Process',
      },
      {
        category: 'Implementation',
        subcategory: 'Secure Deployment',
        stream: 'B',
        url: 'https://owaspsamm.org/model/implementation/secure-deployment/stream-b/',
        description: 'Stream B - Secret Management',
      },
      {
        category: 'Implementation',
        subcategory: 'Defect Management',
        url: 'https://owaspsamm.org/model/implementation/defect-management/',
        description: 'Gestão de Defeitos',
      },
      {
        category: 'Implementation',
        subcategory: 'Defect Management',
        stream: 'A',
        url: 'https://owaspsamm.org/model/implementation/defect-management/stream-a/',
        description: 'Stream A - Defect Tracking',
      },
      {
        category: 'Implementation',
        subcategory: 'Defect Management',
        stream: 'B',
        url: 'https://owaspsamm.org/model/implementation/defect-management/stream-b/',
        description: 'Stream B - Metrics and Feedback',
      },

      // Verification
      {
        category: 'Verification',
        subcategory: 'Overview',
        url: 'https://owaspsamm.org/model/verification/',
        description: 'Visão Geral de Verification',
      },
      {
        category: 'Verification',
        subcategory: 'Architecture Assessment',
        url: 'https://owaspsamm.org/model/verification/architecture-assessment/',
        description: 'Avaliação de Arquitetura',
      },
      {
        category: 'Verification',
        subcategory: 'Architecture Assessment',
        stream: 'A',
        url: 'https://owaspsamm.org/model/verification/architecture-assessment/stream-a/',
        description: 'Stream A - Architecture Validation',
      },
      {
        category: 'Verification',
        subcategory: 'Architecture Assessment',
        stream: 'B',
        url: 'https://owaspsamm.org/model/verification/architecture-assessment/stream-b/',
        description: 'Stream B - Architecture Compliance',
      },
      {
        category: 'Verification',
        subcategory: 'Requirements-driven Testing',
        url: 'https://owaspsamm.org/model/verification/requirements-driven-testing/',
        description: 'Testes Orientados por Requisitos',
      },
      {
        category: 'Verification',
        subcategory: 'Requirements-driven Testing',
        stream: 'A',
        url: 'https://owaspsamm.org/model/verification/requirements-driven-testing/stream-a/',
        description: 'Stream A - Control Verification',
      },
      {
        category: 'Verification',
        subcategory: 'Requirements-driven Testing',
        stream: 'B',
        url: 'https://owaspsamm.org/model/verification/requirements-driven-testing/stream-b/',
        description: 'Stream B - Misuse/Abuse Testing',
      },
      {
        category: 'Verification',
        subcategory: 'Security Testing',
        url: 'https://owaspsamm.org/model/verification/security-testing/',
        description: 'Testes de Segurança',
      },
      {
        category: 'Verification',
        subcategory: 'Security Testing',
        stream: 'A',
        url: 'https://owaspsamm.org/model/verification/security-testing/stream-a/',
        description: 'Stream A - Scalable Baseline',
      },
      {
        category: 'Verification',
        subcategory: 'Security Testing',
        stream: 'B',
        url: 'https://owaspsamm.org/model/verification/security-testing/stream-b/',
        description: 'Stream B - Deep Understanding',
      },

      // Operations
      {
        category: 'Operations',
        subcategory: 'Overview',
        url: 'https://owaspsamm.org/model/operations/',
        description: 'Visão Geral de Operations',
      },
      {
        category: 'Operations',
        subcategory: 'Incident Management',
        url: 'https://owaspsamm.org/model/operations/incident-management/',
        description: 'Gestão de Incidentes',
      },
      {
        category: 'Operations',
        subcategory: 'Incident Management',
        stream: 'A',
        url: 'https://owaspsamm.org/model/operations/incident-management/stream-a/',
        description: 'Stream A - Incident Detection',
      },
      {
        category: 'Operations',
        subcategory: 'Incident Management',
        stream: 'B',
        url: 'https://owaspsamm.org/model/operations/incident-management/stream-b/',
        description: 'Stream B - Incident Response',
      },
      {
        category: 'Operations',
        subcategory: 'Environment Management',
        url: 'https://owaspsamm.org/model/operations/environment-management/',
        description: 'Gestão de Ambiente',
      },
      {
        category: 'Operations',
        subcategory: 'Environment Management',
        stream: 'A',
        url: 'https://owaspsamm.org/model/operations/environment-management/stream-a/',
        description: 'Stream A - Configuration Hardening',
      },
      {
        category: 'Operations',
        subcategory: 'Environment Management',
        stream: 'B',
        url: 'https://owaspsamm.org/model/operations/environment-management/stream-b/',
        description: 'Stream B - Patching and Updating',
      },
      {
        category: 'Operations',
        subcategory: 'Operational Management',
        url: 'https://owaspsamm.org/model/operations/operational-management/',
        description: 'Gestão Operacional',
      },
      {
        category: 'Operations',
        subcategory: 'Operational Management',
        stream: 'A',
        url: 'https://owaspsamm.org/model/operations/operational-management/stream-a/',
        description: 'Stream A - Data Protection',
      },
      {
        category: 'Operations',
        subcategory: 'Operational Management',
        stream: 'B',
        url: 'https://owaspsamm.org/model/operations/operational-management/stream-b/',
        description: 'Stream B - System Decomissioning',
      },

      // Recursos Adicionais
      {
        category: 'Resources',
        subcategory: 'Guidance',
        url: 'https://owaspsamm.org/stream-guidance/',
        description: 'Orientação para Streams',
      },
    ];
  }

  public getUrls(): SAMMUrl[] {
    return this.sammUrls; }
  }

  public getUrlsByCategory(category: string): SAMMUrl[] {
    return this.sammUrls.filter((url) => url.category == category); }
  }

  public getUrlsBySubcategory(subcategory: string): SAMMUrl[] {
    return this.sammUrls.filter((url) => url.subcategory == subcategory); }
  }

  public getUrlsByStream(stream: string): SAMMUrl[] {
    return this.sammUrls.filter((url) => url.stream == stream); }
  }

  public generateUrlReport(): string {
    let _report = '# OWASP SAMM URLs - Relatório Completo\n\n';
    report += `Total de URLs: ${this.sammUrls.length}\n\n`;

    const _categories = [
      'Model',
      'Governance',
      'Design',
      'Implementation',
      'Verification',
      'Operations',
      'Resources',
    ];

    categories.forEach((category) => {
      const _urls = this.getUrlsByCategory(category);
      if (urls.length > 0) {
        report += `## ${category} (${urls.length} URLs)\n\n`;
        urls.forEach((url) => {
          report += `- **${url.subcategory}${url.stream ? ` - Stream ${url.stream}` : ''}**: ${url.description}\n`;
          report += `  - URL: ${url.url}\n`;
        });
        report += '\n';
      }
    });

    return report; }
  }
}
