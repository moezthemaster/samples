export class ExportManager {
    constructor(viewer) {
        this.viewer = viewer;
    }

    async exportToPNG() {
        if (typeof window.html2canvas === 'undefined') {
            alert('Fonctionnalité d\'export PNG non disponible - html2canvas non chargé');
            return;
        }
        
        if (this.viewer.boxes.size === 0) {
            alert('Veuillez charger un fichier JIL avant d\'exporter');
            return;
        }
        
        try {
            this.viewer.showLoading();
            
            // Sauvegarder l'état actuel et la position de défilement
            const originalStates = this.saveTreeState();
            const originalScroll = window.scrollY;
            
            // Déplier tout
            this.expandAllForExport();
            
            // Attendre que le DOM soit mis à jour
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const treeContainer = document.getElementById('treeContainer');
            
            // Créer un conteneur temporaire pour la capture complète
            const exportContainer = document.createElement('div');
            exportContainer.style.cssText = `
                position: absolute;
                left: 0;
                top: 0;
                width: ${treeContainer.scrollWidth}px;
                background: white;
                padding: 20px;
            `;
            
            // Cloner l'arbre complet
            const clonedTree = treeContainer.cloneNode(true);
            clonedTree.style.cssText = `
                width: 100%;
                height: auto;
                overflow: visible;
            `;
            
            // S'assurer que tout est visible dans le clone
            const clonedNodes = clonedTree.querySelectorAll('.tree-node');
            clonedNodes.forEach(node => {
                node.classList.add('expanded');
                node.classList.remove('collapsed');
                
                const children = node.querySelector('.children');
                if (children) {
                    children.style.cssText = `
                        display: block;
                        max-height: none;
                        opacity: 1;
                        visibility: visible;
                    `;
                }
            });
            
            exportContainer.appendChild(clonedTree);
            document.body.appendChild(exportContainer);
            
            // Capturer le conteneur complet
            const canvas = await window.html2canvas(exportContainer, {
                backgroundColor: '#ffffff',
                scale: 1.5,
                useCORS: true,
                allowTaint: false,
                logging: false,
                width: exportContainer.scrollWidth,
                height: exportContainer.scrollHeight,
                scrollX: 0,
                scrollY: 0,
                windowWidth: exportContainer.scrollWidth,
                windowHeight: exportContainer.scrollHeight
            });
            
            // Nettoyer
            document.body.removeChild(exportContainer);
            
            // Restaurer l'état original
            this.restoreTreeState(originalStates);
            window.scrollTo(0, originalScroll);
            
            // Télécharger
            const link = document.createElement('a');
            link.download = `autosys-${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
            
        } catch (error) {
            console.error('Erreur lors de l\'export PNG:', error);
            alert('Erreur lors de l\'export PNG: ' + error.message);
        } finally {
            this.viewer.hideLoading();
        }
    }

async exportToPDF() {
    if (typeof window.html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('Fonctionnalité d\'export PDF non disponible - librairies manquantes');
        return;
    }
    
    if (this.viewer.boxes.size === 0) {
        alert('Veuillez charger un fichier JIL avant d\'exporter');
        return;
    }
    
    try {
        this.viewer.showLoading();
        
        // Sauvegarder l'état actuel
        const originalStates = this.saveTreeState();
        
        // Déplier tout
        this.expandAllForExport();
        
        // Attendre que le DOM soit mis à jour
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const treeContainer = document.getElementById('treeContainer');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        
        // Calculer la hauteur totale nécessaire
        const totalHeight = treeContainer.scrollHeight;
        const scale = 1.5;
        
        // Capturer l'image complète en une seule fois
        const canvas = await window.html2canvas(treeContainer, {
            backgroundColor: '#ffffff',
            scale: scale,
            useCORS: true,
            allowTaint: false,
            logging: false,
            width: treeContainer.scrollWidth,
            height: totalHeight,
            scrollX: 0,
            scrollY: 0,
            windowWidth: treeContainer.scrollWidth,
            windowHeight: totalHeight,
            onclone: function(clonedDoc, element) {
                // S'assurer que tout est visible dans le clone
                const nodes = element.querySelectorAll('.tree-node');
                nodes.forEach(node => {
                    node.classList.add('expanded');
                    node.classList.remove('collapsed');
                    
                    const children = node.querySelector('.children');
                    if (children) {
                        children.style.cssText = `
                            display: block !important;
                            max-height: none !important;
                            opacity: 1 !important;
                            visibility: visible !important;
                            height: auto !important;
                        `;
                    }
                });
                
                // Forcer le style du conteneur
                element.style.cssText = `
                    width: 100% !important;
                    height: auto !important;
                    overflow: visible !important;
                    display: block !important;
                    position: relative !important;
                    top: 0 !important;
                    left: 0 !important;
                `;
            }
        });

        const imgData = canvas.toDataURL('image/png', 0.9);
        
        // Calculer les dimensions pour le PDF
        const imgWidth = canvas.width / scale;
        const imgHeight = canvas.height / scale;
        
        // Adapter à la largeur de la page
        const ratio = (pageWidth - 2 * margin) / imgWidth;
        const finalWidth = imgWidth * ratio;
        const finalHeight = imgHeight * ratio;
        
        // Calculer le nombre de pages nécessaires
        const pagesNeeded = Math.ceil(finalHeight / (pageHeight - 20));
        
        // Date d'extraction formatée
        const extractionDate = new Date().toLocaleDateString('fr-FR');
        
        for (let i = 0; i < pagesNeeded; i++) {
            if (i > 0) {
                pdf.addPage();
            }
            
            const yPos = -i * (pageHeight - 20);
            
            // Ajouter l'image avec découpage pour la page actuelle
            pdf.addImage({
                imageData: imgData,
                format: 'PNG',
                x: margin,
                y: yPos + margin,
                width: finalWidth,
                height: finalHeight
            });
            
            // Ajouter le pied de page discret en bas à droite
            pdf.setFontSize(8);
            pdf.setTextColor(120, 120, 120);
            
            const footerText = `${i + 1}/${pagesNeeded} - ${extractionDate}`;
            const textWidth = pdf.getTextWidth(footerText);
            const textX = pageWidth - margin - textWidth;
            
            pdf.text(footerText, textX, pageHeight - 5);
        }
        
        // Restaurer l'état original
        this.restoreTreeState(originalStates);
        
        // Sauvegarder
        pdf.save(`autosys-${new Date().toISOString().split('T')[0]}.pdf`);
        
    } catch (error) {
        console.error('Erreur détaillée lors de l\'export PDF:', error);
        alert('Erreur lors de l\'export PDF: ' + error.message);
    } finally {
        this.viewer.hideLoading();
    }
}

saveTreeState() {
    const states = new Map();
    const allNodes = document.querySelectorAll('.tree-node');
    
    allNodes.forEach(node => {
        states.set(node, {
            expanded: node.classList.contains('expanded'),
            collapsed: node.classList.contains('collapsed')
        });
    });
    
    return states;
}

expandAllForExport() {
    // Déplier tous les nodes
    document.querySelectorAll('.tree-node').forEach(node => {
        if (node.querySelector('.children')) {
            node.classList.add('expanded');
            node.classList.remove('collapsed');
        }
    });

    // Afficher tous les enfants
    document.querySelectorAll('.children').forEach(container => {
        container.style.cssText = `
            display: block !important;
            max-height: none !important;
            opacity: 1 !important;
            visibility: visible !important;
            height: auto !important;
        `;
    });
    
    // Forcer un reflow
    document.body.offsetHeight;
}

exportToHTML() {
    if (this.viewer.boxes.size === 0) {
        alert('Veuillez charger un fichier JIL avant d\'exporter');
        return;
    }
    
    try {
        // Extraire le nom de l'application depuis le JIL
        const applicationName = this.extractApplicationName();
        const displayAppName = applicationName ? `APPLICATION: ${applicationName}` : 'APPLICATION: Non spécifiée';
        
        let htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${applicationName}</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f7fa; 
            color: #2c3e50;
            line-height: 1.4;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
            padding: 30px; 
            overflow-wrap: break-word;
            word-wrap: break-word;
        }
        .header { 
            border-bottom: 2px solid #3498db; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .tree-node { 
            margin: 8px 0; 
            border-left: 3px solid #bdc3c7; 
            padding-left: 15px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .tree-node-header { 
            padding: 12px 15px; 
            background: #ecf0f1; 
            border-radius: 8px; 
            display: flex; 
            flex-direction: column;
            gap: 8px;
        }
        .job-header-main {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .job-name { 
            font-weight: 600; 
            font-size: 16px;
            word-break: break-word;
            overflow-wrap: break-word;
        }
        .job-type-BOX .job-name { color: #e74c3c; }
        .job-type-CMD .job-name { color: #27ae60; }
        .job-type-FT .job-name { color: #2980b9; }
        .job-type {
            font-size: 12px;
            color: #7f8c8d;
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #dee2e6;
            white-space: nowrap;
        }
        .job-description {
            font-size: 14px;
            color: #5a6c7d;
            font-style: italic;
            padding: 8px 0 0 0;
            word-break: break-word;
            overflow-wrap: break-word;
            border-top: 1px dashed #bdc3c7;
            margin-top: 8px;
        }
        .icon {
            font-size: 16px;
            min-width: 20px;
            text-align: center;
        }
        .children { 
            margin-left: 25px; 
            border-left: 2px dashed #bdc3c7; 
            padding-left: 15px; 
        }
        @media print {
            body { 
                padding: 10px; 
                background: white;
            }
            .container { 
                box-shadow: none; 
                border-radius: 0;
                padding: 15px;
            }
            .tree-node {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Boites Autosys de l'application: ${applicationName}</h1>
            <div>Export généré le ${new Date().toLocaleDateString()}</div>
        </div>
        <!--h2>Arborescence avec Ordre Logique</h2-->`;

        const generateTreeHTML = (box, level = 0) => {
            const icon = box.type === 'BOX' ? '📦' : box.type === 'CMD' ? '⚡' : '📁';
            
            let html = `
                <div class="tree-node job-type-${box.type}" style="margin-left: ${level * 25}px;">
                    <div class="tree-node-header">
                        <div class="job-header-main">
                            <span class="icon">${icon}</span>
                            <span class="job-name">${this.escapeHtml(box.name)}</span>
                            <span class="job-type">${box.type}</span>
                        </div>
                        ${box.description ? `
                        <div class="job-description">
                            ${this.escapeHtml(box.description)}
                        </div>
                        ` : ''}
                    </div>
                `;

            if (box.children && box.children.length > 0) {
                html += '<div class="children">';
                box.children.forEach(child => {
                    html += generateTreeHTML(child, level + 1);
                });
                html += '</div>';
            }

            html += '</div>';
            return html;
        };

        this.viewer.rootBoxes.forEach(box => {
            htmlContent += generateTreeHTML(box);
        });

        htmlContent += `
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const link = document.createElement('a');
        link.download = `jil-viewer-${applicationName ? applicationName.replace(/[^a-zA-Z0-9]/g, '-') : 'export'}-${new Date().toISOString().split('T')[0]}.html`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        
    } catch (error) {
        console.error('Erreur lors de l\'export HTML:', error);
        alert('Erreur lors de l\'export HTML: ' + error.message);
    }
}

// Méthode pour extraire le nom de l'application depuis le JIL
extractApplicationName() {
    // Chercher dans tous les jobs l'attribut "application"
    for (const [jobName, job] of this.viewer.boxes) {
        if (job.attributes && job.attributes.application) {
            return job.attributes.application;
        }
    }
    
    // Si pas trouvé, chercher l'attribut "APPLICATION" (en majuscules)
    for (const [jobName, job] of this.viewer.boxes) {
        if (job.attributes && job.attributes.APPLICATION) {
            return job.attributes.APPLICATION;
        }
    }
    
    return null;
}

// Méthode utilitaire pour échapper le HTML
escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

restoreTreeState(states) {
    states.forEach((state, node) => {
        node.classList.toggle('expanded', state.expanded);
        node.classList.toggle('collapsed', state.collapsed);
        
        const children = node.querySelector('.children');
        if (children) {
            children.style.cssText = '';
        }
    });
}


}