# Minhas Finanças

Aplicativo para organizar suas finanças pessoais, que roda **no seu computador**. Seus dados não vão para nenhum servidor na internet: ficam num arquivo dentro da pasta do app.

## O que ele faz

- **Painel:** receitas, despesas e resultado do mês, saldo de cada conta, gráfico de gastos por categoria e comparação dos últimos 6 meses.
- **Lançamentos:** despesas, receitas e transferências entre contas. Tem busca e filtros por tipo, categoria e conta.
  - **Repetir:** conta fixa todo mês (mesmo valor) ou compra **parcelada** (divide o valor em N vezes).
  - **Pendente:** desmarque "Já paguei" para contas que ainda vão vencer. Elas não entram no saldo da conta até serem pagas.
- **Orçamento:** limite de gasto por mês em cada categoria. A barra fica amarela em 80% e vermelha quando passa do limite.
- **Metas:** objetivos de poupança (ex.: reserva de emergência) com quanto falta e quanto guardar por mês até o prazo.
- **Ajustes:** contas (carteira, banco, cartão…), categorias com cores, tema claro/escuro, backup e planilha.
- **Backup e planilha:** baixar/restaurar backup (.json), exportar CSV para Excel ou Google Planilhas e importar extrato em CSV.
- Atalhos de teclado: `d` = nova despesa, `r` = nova receita, `←` `→` = trocar de mês.

## Como abrir

Não precisa instalar nada.

1. Baixe esta pasta (no GitHub: botão verde **Code → Download ZIP**) e descompacte.
2. Dê dois cliques no arquivo **`index.html`**. Ele abre no navegador (Chrome, Edge, Firefox…) e funciona sem internet.

Dica: crie um atalho do `index.html` na área de trabalho ou salve nos favoritos do navegador.

Para conhecer o app antes de pôr os seus dados, vá em **Ajustes → Carregar dados de exemplo**. Depois, use **Apagar tudo** para começar do zero.

## Onde ficam os dados

Os dados ficam guardados **no navegador do seu computador** (nada vai para a internet). Por isso:

- Use sempre o **mesmo navegador** para abrir o app.
- Se limpar os dados de navegação ou trocar de navegador/computador, eles não vão junto. Para não perder nada, baixe um **backup** em **Ajustes → Baixar backup** de vez em quando (o app lembra você a cada 15 dias). Para recuperar, use **Restaurar backup**.

## Importar extrato (CSV)

O arquivo precisa ter, na primeira linha, pelo menos as colunas `data`, `descricao` e `valor` (separadas por `;` ou `,`). As colunas `categoria`, `conta` e `tipo` são opcionais.

```
data;descricao;valor;categoria;conta
05/10/2026;Salário;5200,00;Salário;Conta do banco
10/10/2026;Aluguel;-1600,00;Moradia;Conta do banco
```

Valor negativo vira despesa e valor positivo vira receita. Categorias e contas que não existirem são criadas na hora.

## Detalhes técnicos

- `index.html`, `style.css`, `app.js`: a interface toda, em HTML, CSS e JavaScript puro (sem instalação e sem etapa de build).
- `vendor/chart.umd.min.js`: [Chart.js](https://www.chartjs.org/) 4.4.7 (licença MIT, em `vendor/LICENSE-chartjs.md`), já incluído para funcionar sem internet.
- Valores guardados em centavos (números inteiros), para não ter erro de arredondamento.
