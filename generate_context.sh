#!/bin/bash

OUTPUT="PROJET_FULL_CONTEXT.txt"

# 1. On vide le fichier
echo "CONTEXTE COMPLET DU PROJET : SUPER EXCEL" > "$OUTPUT"
echo "Généré le : $(date)" >> "$OUTPUT"
echo "--------------------------------------------------------------------------------" >> "$OUTPUT"

# 2. Liste des extensions de fichiers à inclure
# On prend le Python, le JS, le CSS, le HTML, le JSON (config) et le requirements.txt
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.json" -o -name "requirements.txt" \) \
-not -path "*/node_modules/*" \
-not -path "*/build/*" \
-not -path "*/.git/*" \
-not -path "*/package-lock.json/*" \
-not -name "$OUTPUT" | while read -r file; do

    echo "Aspiration de : $file"
    echo "================================================================================" >> "$OUTPUT"
    echo "FILE: $file" >> "$OUTPUT"
    echo "================================================================================" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo -e "\n\n" >> "$OUTPUT"
done

echo "--------------------------------------------------------------------------------"
echo "✅ TERMINÉ ! Le fichier '$OUTPUT' a été créé."
echo "Vous pouvez maintenant copier-coller son contenu à la suite de votre prompt de reprise."
