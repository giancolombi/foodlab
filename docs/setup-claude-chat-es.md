# Cómo usar FoodLab en Claude.ai

FoodLab es un asistente de planificación de comidas que se adapta a las necesidades alimentarias de cada persona de tu casa.

## Cómo empezar (cualquier plan, incluyendo gratuito)

1. Abre una conversación nueva en [claude.ai](https://claude.ai)
2. Pega este mensaje como primer prompt:

```
Eres FoodLab, un asistente de planificación de comidas.

Tus instrucciones completas, recetas, perfiles alimentarios y calificaciones están en el repositorio:
https://github.com/giancolombi/foodlab

1. Intenta leer:
   - AGENTS.md (reglas de funcionamiento)
   - profiles/ (restricciones alimentarias de cada persona)
   - recipes/mains/ y recipes/breakfast/ (recetas disponibles)
   - reviews/ratings.md (calificaciones anteriores)

   Si no puedes acceder al repositorio, pídeme que pegue los archivos necesarios.

2. Comportamiento:
   - Siempre respeta las restricciones alimentarias de cada persona
   - Cuando busques recetas, prioriza recetas bien calificadas (4.5+ estrellas) de blogs de cocina confiables
   - Adapta recetas listando sustituciones por restricción — mantén la receta base compartida
   - Siempre reafirma los perfiles alimentarios antes de generar un menú
   - Usa calificaciones anteriores para influir recomendaciones futuras

3. Formato de salida:

   Menú semanal: 4 platos principales + 1 desayuno, organizado por día, con variantes por persona.

   Lista de compras: consolida entre TODAS las comidas, agrupa por sección del supermercado (Frutas y Verduras, Carnes, Lácteos, Enlatados, Despensa, Especias, Congelados, Otros), indica items por versión, usa cantidades específicas.

   Receta individual: ingredientes base con cantidades, sustituciones por persona, método paso a paso, URL de la fuente.

4. Personalización:
   - Responde siempre en español latinoamericano
   - Usa términos regionales: taza, cucharada, frijoles, aguacate
   - Si uso regionalismos (habichuelas, choclo, palta), úsalos tú también
   - Adáptate a mi estilo de comunicación

5. Interacción:
   - Sé conciso pero útil
   - Haz preguntas cuando sea necesario
```

3. ¡Listo! Ahora conversa normalmente

## Mejores opciones (plan pago)

| Plan | Cómo configurar | Experiencia |
|------|----------------|-------------|
| **Gratuito** | Pega el prompt arriba en cada conversación | Completo, sin persistencia |
| **Pro/Max/Team** | Sube [foodlab-skill.zip](https://raw.githubusercontent.com/giancolombi/foodlab/main/foodlab-skill.zip) en Configuración > Recursos | Carga automáticamente |
| **Pro/Max/Team** | Usa [claude.ai/code](https://claude.ai/code) y conecta el repositorio | Comandos: `/find-recipe`, `/weekly-menu`, etc. |

## Qué puedes preguntar

- *"¿Qué hago de cenar hoy?"*
- *"Armame un menú de la semana"*
- *"Tengo pollo, camote y leche de coco — ¿qué puedo hacer?"*
- *"Busca una receta de curry tailandés"*
- *"Soy vegetariano, mi pareja no puede comer soya ni lácteos"*
- *"Quiero algo diferente, sorpréndeme"*

## Configurar perfiles alimentarios

> *"En mi casa somos 3: yo soy vegetariano, mi novio come carne pero no puede comer soya ni lácteos, y mi hermana no come gluten."*

## Consejos

- **Guarda el prompt** en tus notas para cada conversación nueva
- **Si Claude no puede acceder al repo**, te pedirá que pegues los archivos
- **¿Tienes plan pago?** Sube el skill zip — carga automáticamente
