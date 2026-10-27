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

Você precisa do **Python 3** (é grátis): <https://www.python.org/downloads/>. No Windows, durante a instalação, marque a opção **"Add python.exe to PATH"**. Não precisa instalar mais nada.

1. Baixe esta pasta (no GitHub: botão verde **Code → Download ZIP**) e descompacte.
2. Abra o app:
   - **Windows:** dois cliques em `Abrir no Windows.bat`.
   - **Mac / Linux:** no Terminal, dentro da pasta, rode `./abrir-mac-linux.sh` (ou `python3 financas.py`).
3. O navegador abre sozinho em <http://127.0.0.1:8765>. Deixe a janela preta aberta enquanto usa o app. Para fechar, feche essa janela (ou aperte `Ctrl+C`).

Para conhecer o app antes de pôr os seus dados, vá em **Ajustes → Carregar dados de exemplo**. Depois, use **Apagar tudo** para começar do zero.

### Sem Python?

Dá para abrir o arquivo `app/index.html` direto no navegador. Funciona tudo, mas os dados ficam guardados só naquele navegador (se limpar os dados de navegação, perde). Nesse modo, baixe backups com frequência. Quando abrir pelo Python pela primeira vez, ele traz esses dados para o arquivo do computador (se for o mesmo navegador).

## Onde ficam os dados

- `dados/financas.json`: todos os seus dados.
- `dados/backups/`: uma cópia automática por dia (guarda os últimos 30 dias).

Para levar para outro computador, copie a pasta `dados/` junto, ou use **Ajustes → Baixar backup** e depois **Restaurar backup** no outro computador.

## Importar extrato (CSV)

O arquivo precisa ter, na primeira linha, pelo menos as colunas `data`, `descricao` e `valor` (separadas por `;` ou `,`). As colunas `categoria`, `conta` e `tipo` são opcionais.

```
data;descricao;valor;categoria;conta
05/10/2026;Salário;5200,00;Salário;Conta do banco
10/10/2026;Aluguel;-1600,00;Moradia;Conta do banco
```

Valor negativo vira despesa e valor positivo vira receita. Categorias e contas que não existirem são criadas na hora.

## Detalhes técnicos

- `financas.py`: servidor local feito só com a biblioteca padrão do Python. Escuta apenas em `127.0.0.1` (outros computadores da rede não acessam). Opções: `--porta 8800` e `--sem-navegador`.
- `app/`: a interface (HTML, CSS e JavaScript puro, sem etapa de build).
- `app/vendor/chart.umd.min.js`: [Chart.js](https://www.chartjs.org/) 4.4.7 (licença MIT, em `app/vendor/LICENSE-chartjs.md`), já incluído para funcionar sem internet.
- Valores guardados em centavos (números inteiros), para não ter erro de arredondamento.
