#!/bin/bash
# Helper script para migrações de banco de dados
# Uso: ./migrate.sh [comando]

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Simpix Database Migration Tool     ║${NC}"
echo -e "${BLUE}║      Zero Downtime Strategy          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# Verificar se DATABASE_URL está configurada
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL não configurada${NC}"
    echo "Configure a variável de ambiente DATABASE_URL antes de continuar"
    exit 1
fi

# Função para confirmar ação
confirm() {
    read -p "$1 [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Operação cancelada${NC}"
        exit 1
    fi
}

# Comando principal
case "$1" in
    ""|"migrate")
        echo -e "${GREEN}🚀 Executando migração...${NC}"
        echo ""
        
        if [ "$NODE_ENV" == "production" ]; then
            echo -e "${RED}⚠️  ATENÇÃO: Ambiente de PRODUÇÃO detectado!${NC}"
            confirm "Tem certeza que deseja executar migração em PRODUÇÃO?"
        fi
        
        tsx scripts/migrate.ts
        ;;
        
    "rollback")
        STEPS=${2:-1}
        echo -e "${YELLOW}🔙 Executando rollback de $STEPS migração(ões)...${NC}"
        echo ""
        
        if [ "$NODE_ENV" == "production" ]; then
            echo -e "${RED}⚠️  ATENÇÃO: Rollback em PRODUÇÃO!${NC}"
            echo -e "${RED}Esta operação é DESTRUTIVA e pode causar perda de dados${NC}"
            confirm "Tem certeza que deseja fazer rollback em PRODUÇÃO?"
        fi
        
        tsx scripts/rollback.ts $STEPS
        ;;
        
    "status")
        echo -e "${BLUE}📊 Status das migrações${NC}"
        echo ""
        
        # Usar drizzle-kit para mostrar status
        npx drizzle-kit studio &
        STUDIO_PID=$!
        
        echo -e "${GREEN}✅ Drizzle Studio aberto${NC}"
        echo "Acesse http://localhost:4983 para ver o status"
        echo "Pressione Ctrl+C para fechar"
        
        # Aguardar Ctrl+C
        trap "kill $STUDIO_PID 2>/dev/null; echo -e '\n${YELLOW}Studio fechado${NC}'; exit" INT
        wait $STUDIO_PID
        ;;
        
    "generate")
        echo -e "${BLUE}📝 Gerando nova migração...${NC}"
        echo ""
        npx drizzle-kit generate
        echo -e "${GREEN}✅ Migração gerada${NC}"
        echo "Verifique a pasta ./migrations"
        ;;
        
    "push")
        echo -e "${YELLOW}⚡ Push direto (desenvolvimento apenas)${NC}"
        echo ""
        
        if [ "$NODE_ENV" == "production" ]; then
            echo -e "${RED}❌ ERRO: Push direto não permitido em produção${NC}"
            echo "Use './migrate.sh' para migrações seguras em produção"
            exit 1
        fi
        
        confirm "Push direto altera o schema imediatamente. Continuar?"
        npm run db:push
        ;;
        
    "backup")
        echo -e "${BLUE}💾 Criando backup...${NC}"
        echo ""
        
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="backup_${TIMESTAMP}.sql"
        
        echo "Fazendo dump do banco..."
        pg_dump $DATABASE_URL > $BACKUP_FILE
        
        echo "Comprimindo..."
        gzip $BACKUP_FILE
        
        echo -e "${GREEN}✅ Backup criado: ${BACKUP_FILE}.gz${NC}"
        ls -lh ${BACKUP_FILE}.gz
        ;;
        
    "help")
        echo "Uso: ./migrate.sh [comando] [opções]"
        echo ""
        echo "Comandos disponíveis:"
        echo "  migrate           Executar migrações pendentes (padrão)"
        echo "  rollback [n]      Reverter n migrações (padrão: 1)"
        echo "  status            Ver status das migrações no Drizzle Studio"
        echo "  generate          Gerar nova migração baseada no schema"
        echo "  push              Push direto do schema (dev apenas)"
        echo "  backup            Criar backup do banco de dados"
        echo "  help              Mostrar esta ajuda"
        echo ""
        echo "Exemplos:"
        echo "  ./migrate.sh                  # Executar migrações"
        echo "  ./migrate.sh rollback 2        # Reverter 2 migrações"
        echo "  ./migrate.sh status            # Ver status"
        echo ""
        echo "Variáveis de ambiente:"
        echo "  DATABASE_URL     URL de conexão com PostgreSQL (obrigatório)"
        echo "  NODE_ENV         Ambiente (development/staging/production)"
        ;;
        
    *)
        echo -e "${RED}❌ Comando inválido: $1${NC}"
        echo "Use './migrate.sh help' para ver comandos disponíveis"
        exit 1
        ;;
esac