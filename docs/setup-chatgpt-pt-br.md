# Como usar o FoodLab no ChatGPT

O FoodLab é um assistente de planejamento de refeições que se adapta às necessidades alimentares de cada pessoa da casa. Ele busca receitas na internet, monta cardápios semanais com lista de compras, e cria versões diferentes pra cada pessoa (vegetariano, sem lactose, sem soja, sem glúten, etc.).

## Como começar

1. Abre uma conversa nova no [chatgpt.com](https://chatgpt.com)
2. Cola esta mensagem como primeiro prompt:

> Você é o FoodLab, um assistente de planejamento de refeições. Suas instruções completas, receitas, perfis alimentares e avaliações estão no repositório https://github.com/giancolombi/foodlab. Leia o arquivo AGENTS.md para entender como funcionar. Leia todos os arquivos em profiles/ para conhecer as restrições alimentares de cada pessoa. Leia recipes/mains/ e recipes/breakfast/ para conhecer as receitas disponíveis. Leia reviews/ratings.md para saber quais receitas foram bem avaliadas. Quando buscar receitas novas, pesquise na internet em blogs e sites de culinária. Responde sempre em português brasileiro. Quando criar cardápios semanais, consolide a lista de compras agrupando ingredientes por seção do mercado. Crie uma versão de cada receita pra cada grupo alimentar da casa.

3. Pronto! Agora conversa normalmente

## O que você pode perguntar

- *"O que eu faço pra jantar hoje?"*
- *"Monta um cardápio da semana pra mim"*
- *"Eu tenho frango, batata doce e leite de coco — o que eu faço?"*
- *"Busca uma receita de curry tailandês"*
- *"Sou vegetariano, meu namorado não pode comer soja nem laticínios"*
- *"Me mostra as receitas disponíveis"*
- *"Quero algo diferente, me surpreende"*
- *"Avalia o tagine marroquino 5 estrelas — amei!"*

## Como funciona

- Ele acessa o repositório no GitHub e lê seus perfis alimentares, receitas e avaliações
- Busca receitas novas na internet de blogs e sites de culinária
- Cria uma versão de cada receita pra cada pessoa da casa
- Monta lista de compras organizada por seção do mercado
- Lembra das restrições alimentares durante a conversa

## Dica

Salva o prompt acima num bloco de notas pra não ter que digitar de novo. Cada vez que abrir uma conversa nova, cola ele primeiro.

## Configurar perfis alimentares

Na primeira vez, diga algo como:

> *"Na minha casa tem 3 pessoas: eu sou vegetariano, meu namorado come carne mas não pode comer soja nem laticínios, e minha irmã não come glúten."*

O FoodLab vai lembrar durante toda a conversa e criar versões de cada receita pra cada um.
