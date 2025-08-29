import React from 'react';
import { CheckCircle2, Circle, User, Users, DollarSign, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ProposalProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const steps: Step[] = [
  { id: 'dados-cliente', title: 'Dados do Cliente', icon: User },
  { id: 'referencias-pessoais', title: 'Referências', icon: Users },
  { id: 'condicoes-emprestimo', title: 'Condições', icon: DollarSign },
  { id: 'anexo-documentos', title: 'Documentos', icon: FileText },
];

export function ProposalProgressIndicator({ currentStep, totalSteps }: ProposalProgressIndicatorProps) {
  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'pending';
  };

  const getProgressPercentage = () => {
    return ((currentStep + 1) / totalSteps) * 100;
  };

  return (
    <div className="w-full py-6" data-testid="proposal-progress-indicator">
      {/* Barra de progresso geral */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Progresso da Proposta</span>
          <span data-testid="progress-percentage">
            {Math.round(getProgressPercentage())}% concluído
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${getProgressPercentage()}%` }}
            data-testid="progress-bar"
          />
        </div>
      </div>

      {/* Indicador de passos */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const IconComponent = step.icon;
          
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center space-y-2">
                {/* Círculo do passo */}
                <div 
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200",
                    {
                      // Passo concluído
                      "bg-primary border-primary text-primary-foreground": status === 'completed',
                      // Passo atual
                      "bg-primary/10 border-primary text-primary": status === 'current',
                      // Passo pendente
                      "bg-muted border-muted-foreground/30 text-muted-foreground": status === 'pending',
                    }
                  )}
                  data-testid={`step-indicator-${index}`}
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : status === 'current' ? (
                    <IconComponent className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                
                {/* Título do passo */}
                <div className="text-center">
                  <p 
                    className={cn(
                      "text-xs font-medium transition-colors",
                      {
                        "text-primary": status === 'completed' || status === 'current',
                        "text-muted-foreground": status === 'pending',
                      }
                    )}
                    data-testid={`step-title-${index}`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Passo {index + 1}
                  </p>
                </div>
              </div>
              
              {/* Linha conectora (não mostrar após último passo) */}
              {index < steps.length - 1 && (
                <div 
                  className={cn(
                    "h-0.5 flex-1 transition-colors duration-300 mx-4 mt-[-20px]",
                    {
                      "bg-primary": index < currentStep,
                      "bg-muted": index >= currentStep,
                    }
                  )}
                  data-testid={`connector-${index}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default ProposalProgressIndicator;