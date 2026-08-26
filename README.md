# GBM ESTOQUE

Sistema Interno de Controle de Estoque e Compras — Brasão

Crie um sistema web interno para a Brasão, inicialmente executado em ambiente local (localhost), com interface profissional, simples, rápida e responsiva.

O objetivo principal é substituir uma planilha de controle de estoque por um sistema que permita:

cadastrar produtos;

registrar estoque atual;

registrar consumo médio semanal;

acompanhar histórico das contagens;

identificar automaticamente produtos que precisam de reposição;

sugerir quantidades de compra;

calcular como ficará o estoque após a compra;

registrar pedidos/ordens de compra;

manter histórico das movimentações.

O sistema deve ser desenvolvido de forma modular e preparada para futuramente receber banco de dados online, usuários, permissões e inteligência artificial.

1. ESTRUTURA PRINCIPAL DOS PRODUTOS

Cada produto deverá possuir os seguintes campos:

Descrição do produto

Categoria

Estoque atual

Unidade de medida/embalagem

Fornecedor

Consumo médio semanal

Estoque mínimo

Estoque desejado

Quantidade sugerida para compra

Observação

As unidades de medida disponíveis inicialmente serão:

Unidade (UN)

Quilograma (KG)

Caixa (CX)

Litro (L)

Pacote (PCT)

Fardo (FD)

Saco (SC)

Permitir adicionar novas unidades posteriormente.

2. TABELA PRINCIPAL DE ESTOQUE

Criar uma tela chamada:

Controle de Estoque

Mostrar uma tabela com as seguintes colunas:

ProdutoEstoque AtualEmbalagemFornecedorConsumo Médio SemanalCompra SugeridaEstoque FuturoStatusObservação

A tabela deve ser visualmente limpa e permitir:

pesquisa por produto;

filtro por fornecedor;

filtro por categoria;

filtro por status;

ordenação por qualquer coluna;

edição rápida;

visualização detalhada do produto.

3. LÓGICA DE ESTOQUE

O sistema deve calcular automaticamente a necessidade de reposição.

A lógica básica será:

Estoque projetado sem compra

Estoque Projetado = Estoque Atual - Consumo Médio Semanal

Porém, essa projeção deve servir para identificar risco de ruptura.

Exemplo:

Produto: Arroz

Estoque atual: 10 KG

Consumo médio semanal: 20 KG

Estoque projetado:

10 - 20 = -10 KG

Portanto:

🔴 NECESSITA DE COMPRA

4. CÁLCULO DA COMPRA SUGERIDA

O sistema deverá sugerir automaticamente uma quantidade de compra suficiente para cobrir o consumo semanal e deixar o estoque dentro do nível desejado.

Utilizar inicialmente a seguinte lógica:

Compra Sugerida = Estoque Desejado - Estoque Atual + Consumo Médio Semanal

Porém, nunca permitir resultado negativo.

Se o resultado for menor que zero, considerar:

Compra Sugerida = 0

Exemplo:

Estoque atual: 10 KG

Consumo semanal: 20 KG

Estoque desejado: 20 KG

Compra sugerida:

20 - 10 + 20 = 30 KG

Depois da compra:

Estoque futuro após consumo da semana:

10 + 30 - 20 = 20 KG

Resultado:

🟢 Estoque futuro: 20 KG

5. ESTOQUE FUTURO

Criar uma coluna chamada:

Estoque Futuro

Ela deve demonstrar quanto haverá de estoque após considerar o consumo médio semanal e a compra sugerida.

Fórmula:

Estoque Futuro = Estoque Atual + Compra Sugerida - Consumo Médio Semanal

Exemplo:

Estoque atual: 10

Compra: 30

Consumo semanal: 20

Estoque futuro:

10 + 30 - 20 = 20

Mostrar:

20 KG

6. STATUS AUTOMÁTICO

Criar um sistema visual de status.

🔴 CRÍTICO

Quando:

Estoque Atual < Consumo Médio Semanal

ou quando o estoque projetado ficar negativo.

Exemplo:

Estoque: 5

Consumo semanal: 20

Status:

🔴 CRÍTICO

🟠 ATENÇÃO

Quando o estoque atual for suficiente para cobrir o consumo, mas estiver próximo do estoque mínimo.

🟢 NORMAL

Quando o estoque atual estiver adequado e não houver necessidade imediata de compra.

7. SUGESTÃO DE COMPRA

Criar uma tela específica:

Sugestão de Compras

O sistema deverá listar automaticamente somente os produtos que precisam de reposição.

Exemplo:

ProdutoEstoque AtualConsumo SemanalCompra SugeridaEstoque FuturoArroz10 KG20 KG30 KG20 KGÓleo8 L15 L22 L15 LFrango30 KG50 KG70 KG50 KG

Permitir selecionar produtos através de checkbox.

Botão:

GERAR PEDIDO DE COMPRA

8. PEDIDO / ORDEM DE COMPRA

Ao clicar em "Gerar Pedido de Compra", criar uma ordem de compra com:

Número do pedido

Data

Fornecedor

Produtos

Quantidade

Unidade

Observação

Status

Status possíveis:

Rascunho

Solicitação enviada

Aguardando aprovação

Aprovado

Pedido realizado

Recebido

Cancelado

Permitir gerar um pedido agrupando produtos do mesmo fornecedor.

Exemplo:

PEDIDO DE COMPRA #0001

Fornecedor: Fornecedor X

ProdutoQuantidadeUnidadeArroz30KGÓleo22LFeijão40KG

9. RECEBIMENTO DA COMPRA

Criar funcionalidade para registrar o recebimento.

Ao marcar uma compra como "Recebida", o sistema deverá atualizar automaticamente o estoque.

Exemplo:

Estoque atual:

10 KG

Compra recebida:

30 KG

Novo estoque:

40 KG

Registrar essa movimentação no histórico.

10. HISTÓRICO DE ESTOQUE

Criar uma tela:

Histórico

Registrar todas as alterações de estoque.

Cada registro deverá conter:

Data

Hora

Produto

Tipo de movimentação

Quantidade anterior

Quantidade movimentada

Quantidade final

Usuário

Observação

Tipos de movimentação:

Contagem

Entrada de compra

Ajuste positivo

Ajuste negativo

Perda

Consumo

Correção

Nunca apagar o histórico de movimentações.

11. CONTAGEM DE ESTOQUE

Criar uma tela:

Nova Contagem

Permitir realizar uma contagem periódica dos produtos.

Exemplo:

Produto: Arroz

Estoque registrado: 40 KG

Quantidade encontrada: 37 KG

Diferença:

-3 KG

Ao confirmar:

registrar a contagem;

atualizar o estoque;

registrar a diferença;

salvar data/hora;

salvar usuário;

manter o registro no histórico.

12. DASHBOARD

Criar um dashboard inicial com indicadores:

ESTOQUE TOTAL

Quantidade de produtos cadastrados.

PRODUTOS CRÍTICOS

Quantidade de produtos que precisam de compra urgente.

PRODUTOS EM ATENÇÃO

Produtos próximos do estoque mínimo.

COMPRAS SUGERIDAS

Quantidade de produtos que possuem sugestão de compra.

PEDIDOS EM ABERTO

Pedidos de compra ainda não recebidos.

ÚLTIMAS MOVIMENTAÇÕES

Mostrar as últimas movimentações realizadas.

13. VISUALIZAÇÃO DOS PRODUTOS

Ao clicar em um produto, abrir uma página detalhada contendo:

Produto

Descrição

Categoria

Fornecedor

Unidade

Estoque atual

Consumo médio semanal

Estoque mínimo

Estoque desejado

Compra sugerida

Estoque futuro

Status

Observação

E abaixo:

Histórico do produto

Mostrar todas as movimentações.

Também mostrar um gráfico de evolução do estoque.

14. CONSUMO MÉDIO SEMANAL

Inicialmente, o sistema permitirá inserir manualmente o consumo médio semanal.

Porém, estruturar o banco de dados para futuramente calcular automaticamente:

consumo médio dos últimos 7 dias;

consumo médio dos últimos 30 dias;

consumo médio dos últimos 90 dias.

Futuramente, o sistema deverá comparar o consumo real com o consumo cadastrado e sugerir atualização do consumo médio.

15. REGRAS IMPORTANTES

Não tratar estoque como apenas um número editável.

Toda alteração relevante deverá gerar uma movimentação no histórico.

Exemplo:

Se o estoque mudar de:

50 → 42

deve existir um registro explicando a alteração.

Nunca apagar movimentações antigas.

16. IMPORTAÇÃO DA PLANILHA EXISTENTE

Criar uma funcionalidade para importar produtos inicialmente através de arquivo Excel/CSV.

A planilha atual possui aproximadamente estas colunas:

Descrição Produto

Estoque Atual

Embalagem

Fornecedor

Consumo Médio Semanal

Observação

Ao importar:

identificar automaticamente as colunas;

validar os dados;

mostrar uma prévia antes da importação;

permitir confirmar a importação;

cadastrar os produtos no banco.

17. DESIGN

O sistema deve ter aparência de software empresarial moderno.

Priorizar:

interface limpa;

fundo claro;

cards de indicadores;

tabelas profissionais;

boa hierarquia visual;

poucos elementos desnecessários;

navegação lateral;

responsividade;

boa visualização em computador e tablet.

Menu lateral:

Dashboard

Estoque

Contagens

Sugestões de Compra

Pedidos de Compra

Fornecedores

Histórico

Configurações

18. BANCO DE DADOS

Não criar apenas uma interface visual com dados fictícios.

Criar uma estrutura real de banco de dados.

As principais entidades deverão ser:

products

categories

suppliers

stock_movements

stock_counts

purchase_orders

purchase_order_items

users

Criar relacionamentos adequados entre as tabelas.

Utilizar IDs únicos.

Criar timestamps de criação e atualização.

19. PREPARAÇÃO PARA IA

Estruturar o sistema para futuramente possuir um assistente de compras com IA.

Esse assistente deverá poder analisar:

estoque atual;

consumo médio;

histórico;

fornecedores;

compras anteriores;

produtos críticos;

tendências de consumo.

No futuro, o usuário poderá perguntar:

"Quais produtos preciso comprar essa semana?"

E o sistema deverá responder baseado nos dados reais.

Também deverá futuramente responder:

"Qual fornecedor mais utilizamos para os produtos críticos?"

"Quais produtos estão consumindo mais?"

"Quais produtos tiveram maior divergência nas contagens?"

"Quanto compramos desse produto nos últimos 30 dias?"

20. IMPORTANTE SOBRE OS CÁLCULOS

Todos os cálculos devem ser feitos automaticamente pelo sistema.

Nunca exigir que o usuário faça contas manualmente.

Exemplo:

Produto:

Arroz

Estoque atual: 10 KG

Consumo médio semanal: 20 KG

Estoque desejado: 20 KG

O sistema deve calcular:

Estoque projetado = 10 - 20 = -10 KG

Compra sugerida = 20 - 10 + 20 = 30 KG

Estoque futuro = 10 + 30 - 20 = 20 KG

Exibir:

🔴 Necessita de compra

Compra sugerida: 30 KG

Estoque futuro: 20 KG

21. FLEXIBILIDADE DA REGRA DE COMPRA

Não deixar a fórmula de compra fixa no código.

Criar configurações para que futuramente seja possível alterar:

número de semanas de cobertura;

estoque mínimo;

estoque desejado;

estoque de segurança;

prazo de entrega;

margem de segurança.

Por exemplo, futuramente poderemos utilizar:

Compra sugerida =
(Consumo médio semanal × semanas de cobertura)

estoque de segurança

estoque atual

quantidade já comprada/em trânsito

Essa estrutura deverá estar preparada desde o início.

22. OBJETIVO FINAL

O sistema deve funcionar como um Centro de Controle de Estoque e Compras da Brasão.

O usuário deve conseguir abrir o sistema e saber imediatamente:

O que temos em estoque.

O que está acabando.

O que precisa ser comprado.

Quanto deve ser comprado.

Como ficará o estoque depois da compra.

Quais pedidos estão em aberto.

O que foi comprado anteriormente.

Como o estoque vem evoluindo ao longo do tempo.

Construir primeiro uma versão funcional e consistente da estrutura principal, evitando funcionalidades desnecessárias.

Priorizar dados reais, cálculos corretos, histórico e facilidade de uso.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://brasao-estoque.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7de08f64-b88c-4d55-a7f4-8ef199022d8c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
