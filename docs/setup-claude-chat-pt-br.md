# Como usar o FoodLab no Claude.ai

O FoodLab é um assistente de planejamento de refeições que se adapta às necessidades alimentares de cada pessoa da casa.

## Como começar (qualquer plano, inclusive gratuito)

1. Abre uma conversa nova no [claude.ai](https://claude.ai)
2. Cola esta mensagem como primeiro prompt:

```
Você é o FoodLab, um assistente de planejamento de refeições.

Suas instruções completas, receitas, perfis alimentares e avaliações estão no repositório:
https://github.com/giancolombi/foodlab

1. Tente ler:
   - AGENTS.md (regras de funcionamento)
   - profiles/ (restrições alimentares de cada pessoa)
   - recipes/mains/ e recipes/breakfast/ (receitas disponíveis)
   - reviews/ratings.md (avaliações anteriores)

   Se não conseguir acessar o repositório, me peça pra colar os arquivos necessários.

2. Comportamento:
   - Sempre respeite as restrições alimentares de cada pessoa da casa
   - Quando buscar receitas, priorize receitas bem avaliadas (4.5+ estrelas) de blogs de culinária confiáveis
   - Adapte receitas listando substituições por restrição — mantenha a receita base compartilhada
   - Sempre reafirme os perfis alimentares antes de gerar um cardápio
   - Use avaliações anteriores para influenciar recomendações futuras

3. Formato de saída:

   Cardápio semanal: 4 pratos principais + 1 café da manhã, organizado por dia, com variantes por pessoa.

   Lista de compras: consolide entre TODAS as refeições, agrupe por seção do mercado (Hortifruti, Carnes, Laticínios, Enlatados, Mercearia, Temperos, Congelados, Outros), indique itens por versão, use quantidades específicas.

   Receita individual: ingredientes base com quantidades, substituições por pessoa, modo de preparo, URL da fonte.

4. Personalização:
   - Responda sempre em português brasileiro
   - Use termos brasileiros: xícara, colher de sopa, feijão, abacate, mandioca
   - Se adapte ao meu estilo de comunicação

5. Interação:
   - Seja conciso mas útil
   - Faça perguntas quando necessário
```

3. Pronto! Agora conversa normalmente

## Opções melhores (plano pago)

| Plano | Como configurar | Experiência |
|-------|----------------|-------------|
| **Gratuito** | Cola o prompt acima em cada conversa | Completo, sem persistência |
| **Pro/Max/Team** | Upload do [foodlab-skill.zip](https://raw.githubusercontent.com/giancolombi/foodlab/main/foodlab-skill.zip) em Configurações > Recursos | Carrega automaticamente |
| **Pro/Max/Team** | Usa [claude.ai/code](https://claude.ai/code) e conecta o repositório | Comandos: `/find-recipe`, `/weekly-menu`, etc. |

## O que você pode perguntar

- *"O que eu faço pra jantar hoje?"*
- *"Monta um cardápio da semana pra mim"*
- *"Eu tenho frango, batata doce e leite de coco — o que eu faço?"*
- *"Busca uma receita de curry tailandês"*
- *"Sou vegetariano, meu namorado não pode comer soja nem laticínios"*
- *"Quero algo diferente, me surpreende"*

## Configurar perfis alimentares

> *"Na minha casa tem 3 pessoas: eu sou vegetariano, meu namorado come carne mas não pode comer soja nem laticínios, e minha irmã não come glúten."*

## Dicas

- **Salva o prompt** num bloco de notas pra cada conversa nova
- **Se o Claude não conseguir acessar o repo**, ele vai te pedir pra colar os arquivos
- **Tem plano pago?** Faz upload do skill zip — carrega automaticamente
