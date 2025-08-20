#!/bin/bash

# PAM V1.0 - Script de Refatoração para Sistema de Status V2.0
# Arquivo alvo: client/src/pages/formalizacao.tsx

echo "🔧 Iniciando refatoração para Sistema de Status V2.0..."

# Fazer backup do arquivo original
cp client/src/pages/formalizacao.tsx client/src/pages/formalizacao.tsx.backup

# Substituições sistemáticas de status antigos para novos
sed -i '
# Substituir status nas funções getStatusColor
s/contratos_preparados: "bg-purple-500"/CCB_GERADA: "bg-purple-500"/g
s/contratos_assinados: "bg-indigo-500"/ASSINATURA_CONCLUIDA: "bg-indigo-500"/g
s/pronto_pagamento: "bg-orange-500"/BOLETOS_EMITIDOS: "bg-orange-500"/g
s/pago: "bg-green-600"/PAGAMENTO_CONFIRMADO: "bg-green-600"/g

# Substituir status nas funções getStatusText
s/contratos_preparados: "Contratos Preparados"/CCB_GERADA: "CCB Gerada"/g
s/contratos_assinados: "Contratos Assinados"/ASSINATURA_CONCLUIDA: "Assinatura Concluída"/g
s/pronto_pagamento: "Pronto para Pagamento"/BOLETOS_EMITIDOS: "Boletos Emitidos"/g
s/pago: "Pago"/PAGAMENTO_CONFIRMADO: "Pagamento Confirmado"/g

# Substituir labels de texto
s/"Contratos Preparados"/"CCB Gerada"/g
s/"Contratos Assinados"/"Assinatura Concluída"/g
s/"Pronto para Pagamento"/"Boletos Emitidos"/g
s/"Pago"/"Pagamento Confirmado"/g

# Substituir valores de status em comparações e condicionais
s/"contratos_preparados"/"CCB_GERADA"/g
s/"contratos_assinados"/"ASSINATURA_CONCLUIDA"/g
s/"pronto_pagamento"/"BOLETOS_EMITIDOS"/g
s/"pago"/"PAGAMENTO_CONFIRMADO"/g

# Substituir em type assertions e casts
s/contratos_preparados/CCB_GERADA/g
s/contratos_assinados/ASSINATURA_CONCLUIDA/g
s/pronto_pagamento/BOLETOS_EMITIDOS/g
# Cuidado com "pago" - é muito genérico, fazer apenas em contextos específicos
s/status === "pago"/status === "PAGAMENTO_CONFIRMADO"/g
s/value="pago"/value="PAGAMENTO_CONFIRMADO"/g

# Substituir em arrays e listas
s/{ status: "contratos_preparados"/{ status: "CCB_GERADA"/g
s/{ status: "contratos_assinados"/{ status: "ASSINATURA_CONCLUIDA"/g

# Timeline e progresso
s/contratos_preparados: 60/CCB_GERADA: 60/g
s/contratos_assinados: 80/ASSINATURA_CONCLUIDA: 80/g
s/pronto_pagamento: 90/BOLETOS_EMITIDOS: 90/g
' client/src/pages/formalizacao.tsx

echo "✅ Substituições concluídas"
echo "📊 Verificando alterações..."

# Contar ocorrências restantes de status antigos
OLD_COUNT=$(grep -c "contratos_assinados\|contratos_preparados\|pronto_pagamento" client/src/pages/formalizacao.tsx)
NEW_COUNT=$(grep -c "ASSINATURA_CONCLUIDA\|CCB_GERADA\|BOLETOS_EMITIDOS\|PAGAMENTO_CONFIRMADO" client/src/pages/formalizacao.tsx)

echo "Status antigos restantes: $OLD_COUNT"
echo "Status V2.0 aplicados: $NEW_COUNT"

echo "✅ Refatoração concluída!"