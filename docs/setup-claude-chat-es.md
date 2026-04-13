# Cómo usar FoodLab en Claude.ai

FoodLab es un asistente de planificación de comidas que se adapta a las necesidades alimentarias de cada persona de tu casa. Busca recetas en internet, arma menús semanales con lista de compras, y crea versiones diferentes para cada persona.

## Cómo empezar (cualquier plan, incluyendo gratuito)

1. Abre una conversación nueva en [claude.ai](https://claude.ai)
2. Pega este mensaje como primer prompt:

> Eres FoodLab, un asistente de planificación de comidas. Tus instrucciones completas, recetas, perfiles alimentarios y calificaciones están en el repositorio https://github.com/giancolombi/foodlab. Lee el archivo AGENTS.md para entender cómo funcionar. Lee todos los archivos en profiles/ para conocer las restricciones alimentarias de cada persona. Lee recipes/mains/ y recipes/breakfast/ para conocer las recetas disponibles. Lee reviews/ratings.md para saber cuáles recetas fueron bien calificadas. Cuando busques recetas nuevas, busca en internet en blogs y sitios de cocina. Responde siempre en español latinoamericano. Cuando crees menús semanales, consolida la lista de compras agrupando ingredientes por sección del supermercado. Crea una versión de cada receta para cada grupo alimentario de la casa.

3. ¡Listo! Ahora conversa normalmente

## Mejores opciones (si tienes plan pago)

| Plan | Cómo configurar | Experiencia |
|------|----------------|-------------|
| **Gratuito** | Pega el prompt arriba en cada conversación | Funcionalidad completa, sin persistencia |
| **Pro/Max/Team** | Sube [foodlab-skill.zip](https://raw.githubusercontent.com/giancolombi/foodlab/main/foodlab-skill.zip) en Configuración > Recursos | Skill carga automáticamente, sin pegar |
| **Pro/Max/Team** | Usa [claude.ai/code](https://claude.ai/code) y conecta el repositorio | Comandos completos (`/find-recipe`, `/weekly-menu`, etc.) |

## Qué puedes preguntar

- *"¿Qué hago de cenar hoy?"*
- *"Armame un menú de la semana"*
- *"Tengo pollo, camote y leite de coco — ¿qué puedo hacer?"*
- *"Busca una receta de curry tailandés"*
- *"Soy vegetariano, mi pareja no puede comer soya ni lácteos"*
- *"Muéstrame las recetas disponibles"*
- *"Quiero algo diferente, sorpréndeme"*
- *"Califica el tagine marroquí 5 estrellas — me encantó"*

## Configurar perfiles alimentarios

La primera vez, di algo como:

> *"En mi casa somos 3: yo soy vegetariano, mi novio come carne pero no puede comer soya ni lácteos, y mi hermana no come gluten."*

FoodLab va a recordar durante toda la conversación y crear versiones de cada receta para cada uno.

## Consejo

Guarda el prompt en tus notas para pegarlo al inicio de cada conversación. Si tienes plan Pro/Max/Team, sube el skill zip — carga automáticamente cada vez.
