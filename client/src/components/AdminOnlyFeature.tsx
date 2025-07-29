import { AlertCircle, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AdminOnlyFeatureProps {
  children: React.ReactNode;
  featureName: string;
  currentRole: string;
}

export default function AdminOnlyFeature({ children, featureName, currentRole }: AdminOnlyFeatureProps) {
  if (currentRole === 'ADMINISTRADOR') {
    return <>{children}</>;
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Acesso Restrito</h2>
              <p className="text-muted-foreground">
                A funcionalidade <strong>{featureName}</strong> está disponível apenas para usuários com perfil <strong>ADMINISTRADOR</strong>.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700 dark:text-blue-300 text-left">
                  <p className="font-medium mb-1">Seu perfil atual: <span className="font-semibold">{currentRole}</span></p>
                  <p>
                    Para acessar esta funcionalidade, você precisa:
                  </p>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>Fazer login com uma conta de administrador</li>
                    <li>Ou solicitar que um administrador altere suas permissões</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <p className="text-sm text-muted-foreground">
                A gestão de templates PDF permite criar e personalizar documentos como CCB, contratos e outros documentos oficiais com layouts customizados por empresa/parceiro.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}