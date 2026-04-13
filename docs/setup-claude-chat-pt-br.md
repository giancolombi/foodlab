# Como usar o FoodLab no Claude.ai

O FoodLab é um assistente de planejamento de refeições que se adapta às necessidades alimentares de cada pessoa da casa. Ele busca receitas na internet, monta cardápios semanais com lista de compras, e cria versões diferentes pra cada pessoa.

## Como começar (qualquer plano, inclusive gratuito)

1. Abre uma conversa nova no [claude.ai](https://claude.ai)
2. Cola esta mensagem como primeiro prompt:

> Você é o FoodLab, um assistente de planejamento de refeições. Suas instruções completas, receitas, perfis alimentares e avaliações estão no repositório https://github.com/giancolombi/foodlab. Leia o arquivo AGENTS.md para entender como funcionar. Leia todos os arquivos em profiles/ para conhecer as restrições alimentares de cada pessoa. Leia recipes/mains/ e recipes/breakfast/ para conhecer as receitas disponíveis. Leia reviews/ratings.md para saber quais receitas foram bem avaliadas. Quando buscar receitas novas, pesquise na internet em blogs e sites de culinária. Responde sempre em português brasileiro. Quando criar cardápios semanais, consolide a lista de compras agrupando ingredientes por seção do mercado. Crie uma versão de cada receita pra cada grupo alimentar da casa.

3. Pronto! Agora conversa normalmente

## Opções melhores (se você tem plano pago)

| Plano | Como configurar | Experiência |
|-------|----------------|-------------|
| **Gratuito** | Cola o prompt acima em cada conversa | Funcionalidade completa, sem persistência |
| **Pro/Max/Team** | Faz upload do [foodlab-skill.zip](https://raw.githubusercontent.com/giancolombi/foodlab/main/foodlab-skill.zip) em Configurações > Recursos | Skill carrega automaticamente, sem precisar colar |
| **Pro/Max/Team** | Usa [claude.ai/code](https://claude.ai/code) e conecta o repositório | Comandos completos (`/find-recipe`, `/weekly-menu`, etc.) |

## O que você pode perguntar

- *"O que eu faço pra jantar hoje?"*
- *"Monta um cardápio da semana pra mim"*
- *"Eu tenho frango, batata doce e leite de coco — o que eu faço?"*
- *"Busca uma receita de curry tailandês"*
- *"Sou vegetariano, meu namorado não pode comer soja nem laticínios"*
- *"Me mostra as receitas disponíveis"*
- *"Quero algo diferente, me surpreende"*
- *"Avalia o tagine marroquino 5 estrelas — amei!"*

## Configurar perfis alimentares

Na primeira vez, diga algo como:

> *"Na minha casa tem 3 pessoas: eu sou vegetariano, meu namorado come carne mas não pode comer soja nem laticínios, e minha irmã não come glúten."*

O FoodLab vai lembrar durante toda a conversa e criar versões de cada receita pra cada um.

## Dica

Salva o prompt num bloco de notas pra colar no início de cada conversa. Se você tem plano Pro/Max/Team, faz upload do skill zip — ele carrega automaticamente toda vez.
