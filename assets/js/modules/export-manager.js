export class ExportManager {
    constructor(viewer) {
        this.viewer = viewer;
    }

    async exportToPNG() {
        if (typeof html2canvas === 'undefined') {
            alert('Fonctionnalité d\'export PNG non disponible');
            return;
        }
        
        if (this.viewer.boxes.size === 0) {
            alert('Veuillez charger un fichier JIL avant d\'exporter');
            return;
        }
        
        try {
            this.viewer.showLoading();
            
            const { exportContainer, originalStates } = this.prepareExport();
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const canvas = await html2canvas(exportContainer, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                width: exportContainer.scrollWidth,
                height: exportContainer.scrollHeight,
                scrollX: 0,
                scrollY: 0,
                windowWidth: exportContainer.scrollWidth,
                windowHeight: exportContainer.scrollHeight
            });
            
            document.body.removeChild(exportContainer);
            this.restoreOriginalStates(originalStates);
            
            this.downloadCanvas(canvas, 'png', `autosys-complet-${new Date().toISOString().split('T')[0]}.png`);
            
        } catch (error) {
            console.error('Erreur lors de l\'export PNG:', error);
            alert('Erreur lors de l\'export PNG: ' + error.message);
        } finally {
            this.viewer.hideLoading();
        }
    }

    async exportToPDF() {
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
            alert('Fonctionnalité d\'export PDF non disponible');
            return;
        }
        
        if (this.viewer.boxes.size === 0) {
            alert('Veuillez charger un fichier JIL avant d\'exporter');
            return;
        }
        
        try {
            this.viewer.showLoading();
            
            const { exportContainer, originalStates } = this.prepareExport();
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const totalHeight = exportContainer.scrollHeight;
            const pageHeight = 1000;
            const totalPages = Math.ceil(totalHeight / pageHeight);
            
            const pdf = new jspdf.jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: 'a4',
                compress: true
            });
            
            pdf.setFont('helvetica');
            
            for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                if (pageNum > 0) {
                    pdf.addPage();
                }
                
                const startY = pageNum * pageHeight;
                const endY = Math.min(startY + pageHeight, totalHeight);
                
                const pageContainer = document.createElement('div');
                pageContainer.style.cssText = `
                    position: absolute;
                    top: -${startY}px;
                    left: 0;
                    width: 800px;
                    background: white;
                `;
                
                pageContainer.appendChild(exportContainer.querySelector('.tree-container').cloneNode(true));
                exportContainer.innerHTML = '';
                exportContainer.appendChild(pageContainer);
                
                const canvas = await html2canvas(exportContainer, {
                    backgroundColor: '#ffffff',
                    scale: 1.5,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    width: 800,
                    height: pageHeight,
                    windowWidth: 800,
                    windowHeight: pageHeight,
                    scrollX: 0,
                    scrollY: 0
                });
                
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                pdf.addImage(imgData, 'JPEG', 10, 10, 575, pageHeight * 0.75);
                
                pdf.setFontSize(10);
                pdf.setTextColor(100);
                pdf.text(
                    `Page ${pageNum + 1}/${totalPages} - Autosys JIL Export - ${new Date().toLocaleDateString()}`,
                    20,
                    pageHeight * 0.75 + 30
                );
            }
            
            document.body.removeChild(exportContainer);
            this.restoreOriginalStates(originalStates);
            
            pdf.save(`autosys-complet-${new Date().toISOString().split('T')[0]}.pdf`);
            
        } catch (error) {
            console.error('Erreur lors de l\'export PDF:', error);
            alert('Erreur lors de l\'export PDF: ' + error.message);
        } finally {
            this.viewer.hideLoading();
        }
    }

    exportToHTML() {
        if (this.viewer.boxes.size === 0) {
            alert('Veuillez charger un fichier JIL avant d\'exporter');
            return;
        }
        
        try {
            const htmlContent = this.generateHTMLExport();
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            link.download = `autosys-ordre-dependances-${new Date().toISOString().split('T')[0]}.html`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            
        } catch (error) {
            console.error('Erreur lors de l\'export HTML:', error);
            alert('Erreur lors de l\'export HTML: ' + error.message);
        }
    }

    prepareExport() {
        const originalStates = new Map();
        const allNodes = document.querySelectorAll('.tree-node');
        
        allNodes.forEach(node => {
            originalStates.set(node, {
                expanded: node.classList.contains('expanded'),
                collapsed: node.classList.contains('collapsed')
            });
            
            node.classList.add('expanded');
            node.classList.remove('collapsed');
            
            const children = node.querySelector('.children');
            if (children) {
                children.style.display = 'block';
                children.style.maxHeight = 'none';
                children.style.opacity = '1';
            }
        });
        
        const treeContainer = document.getElementById('treeContainer');
        const exportContainer = document.createElement('div');
        
        exportContainer.style.cssText = `
            position: fixed !important;
            left: -10000px !important;
            top: -10000px !important;
            width: ${treeContainer.scrollWidth + 40}px;
            background: white;
            padding: 20px;
            z-index: -1 !important;
            opacity: 0 !important;
            visibility: hidden !important;
            overflow: visible !important;
            height: auto !important;
        `;
        
        const clonedTree = treeContainer.cloneNode(true);
        clonedTree.classList.add('tree-container');
        
        clonedTree.style.cssText = `
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            display: block !important;
            width: 100% !important;
        `;
        
        const clonedNodes = clonedTree.querySelectorAll('.tree-node');
        clonedNodes.forEach(node => {
            node.classList.add('expanded');
            node.classList.remove('collapsed');
            node.style.display = 'block';
            
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
        
        exportContainer.appendChild(clonedTree);
        document.body.appendChild(exportContainer);

        return { exportContainer, originalStates };
    }

    restoreOriginalStates(originalStates) {
        originalStates.forEach((originalState, node) => {
            node.classList.toggle('expanded', originalState.expanded);
            node.classList.toggle('collapsed', originalState.collapsed);
            
            const children = node.querySelector('.children');
            if (children) {
                children.style.display = '';
                children.style.maxHeight = '';
                children.style.opacity = '';
            }
        });
    }

    downloadCanvas(canvas, format, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL(`image/${format}`, 1.0);
        link.click();
    }

    generateHTMLExport() {
        const generateTreeHTML = (box, level = 0) => {
            const icon = box.type === 'BOX' ? '📦' : box.type === 'CMD' ? '⚡' : '📁';
            const boxIndicator = box.type === 'BOX' ? ' 📦' : '';
            
            let html = `
                <div class="tree-node job-type-${box.type}" style="margin-left: ${level * 25}px;">
                    <div class="tree-node-header">
                        <span>${icon}</span>
                        <span class="job-name">${box.name}${boxIndicator}</span>
                        <small>(${box.type})</small>
                        ${box.description ? `<small>- ${box.description}</small>` : ''}
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

        let treeHTML = '';
        this.viewer.rootBoxes.forEach(box => {
            treeHTML += generateTreeHTML(box);
        });

        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autosys JIL Export - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; color: #2c3e50; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 30px; }
        .header { border-bottom: 2px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
        .tree-node { margin: 8px 0; border-left: 3px solid #bdc3c7; padding-left: 15px; }
        .tree-node-header { padding: 12px 15px; background: #ecf0f1; border-radius: 8px; display: flex; align-items: center; gap: 10px; }
        .job-name { font-weight: 600; font-size: 16px; }
        .job-type-BOX .job-name { color: #e74c3c; }
        .job-type-CMD .job-name { color: #27ae60; }
        .children { margin-left: 25px; border-left: 2px dashed #bdc3c7; padding-left: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Autosys JIL - Ordre par Dépendances</h1>
            <div>Export généré le ${new Date().toLocaleDateString()}</div>
        </div>
        <h2>🌳 Arborescence avec Ordre Logique</h2>
        ${treeHTML}
    </div>
</body>
</html>`;
    }
}
