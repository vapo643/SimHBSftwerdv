module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // Nova funcionalidade
        "fix", // Correção de bug
        "docs", // Mudanças na documentação
        "style", // Formatação, ponto e vírgula faltando, etc.; sem mudança de código
        "refactor", // Refatoração de código que não corrige um bug nem adiciona uma funcionalidade
        "perf", // Mudanças de código que melhoram a performance
        "test", // Adicionando testes faltando ou corrigindo testes existentes
        "chore", // Mudanças no processo de build ou ferramentas auxiliares
        "ci", // Mudanças nos arquivos e scripts de CI
        "build", // Mudanças que afetam o sistema de build ou dependências externas
        "revert", // Reverter um commit anterior
      ],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "scope-case": [2, "always", "lower-case"],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 72],
    "body-leading-blank": [1, "always"],
    "body-max-line-length": [2, "always", 100],
    "footer-leading-blank": [1, "always"],
    "footer-max-line-length": [2, "always", 100],
  },
};
