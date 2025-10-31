export class ExportManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.exportConfig = {
            png: { scale: 2, quality: 1.0, timeout: 30000 },
            pdf: { scale: 1.5, quality: 0.9, timeout: 45000 },
            html: { includeMetadata: true, timeout: 10000 }
        };
        this.isExporting = false;
    }

    validateExportPrerequisites() {
        const errors = [];
        
        if (this.viewer.boxes.size === 0) {
            errors.push('Veuillez charger un fichier JIL avant d\'exporter');
        }
        
        if (!document.getElementById('treeContainer')) {
            errors.push('Élément d\'arborescence non trouvé dans le DOM');
        }
        
        return errors;
    }

    validateLibrary(format) {
        const libraryChecks = {
            png: () => typeof window.html2canvas !== 'undefined',
            pdf: () => typeof window.html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined',
            html: () => true
        };
        
        const check = libraryChecks[format];
        return check ? check() : false;
    }

    handleExportError(format, error, userMessage = null) {
        console.error(`Erreur export ${format.toUpperCase()}:`, error);
        
        const defaultMessages = {
            png: 'Erreur lors de l\'export PNG',
            pdf: 'Erreur lors de l\'export PDF', 
            html: 'Erreur lors de l\'export HTML'
        };
        
        const message = userMessage || defaultMessages[format] || 'Erreur lors de l\'export';
        alert(`${message}: ${error.message || error}`);
    }

    async withTimeout(promise, timeoutMs, operation) {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`${operation} a dépassé le temps imparti (${timeoutMs}ms)`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    saveExportState() {
        return {
            rootBoxes: this.viewer.rootBoxes,
            boxes: this.viewer.boxes,
            filteredBoxes: this.viewer.filteredBoxes,
            treeStates: this.saveTreeState(),
            scrollY: window.scrollY,
            timestamp: Date.now()
        };
    }

    restoreExportState(state) {
        this.viewer.rootBoxes = state.rootBoxes;
        this.viewer.boxes = state.boxes;
        this.viewer.filteredBoxes = state.filteredBoxes;
        this.restoreTreeState(state.treeStates);
        window.scrollTo(0, state.scrollY);
        this.viewer.treeRenderer.renderTree(state.rootBoxes);
    }

    calculateOptimalDelay() {
        const totalJobs = this.viewer.boxes.size;
        if (totalJobs < 50) return 500;
        if (totalJobs < 200) return 1000;
        if (totalJobs < 500) return 1500;
        return 2000;
    }

    waitForDOMUpdate(delay = null) {
        const actualDelay = delay || this.calculateOptimalDelay();
        return new Promise(resolve => {
            // Forcer un reflow pour s'assurer que le DOM est à jour
            document.body.offsetHeight;
            setTimeout(resolve, actualDelay);
        });
    }

    async showExportProgress(message, duration = 2000) {
        // notification de progression
        const progressEl = document.createElement('div');
        progressEl.className = 'export-progress-notification';
        progressEl.innerHTML = `
            <div class="export-progress-content">
                <i class="fas fa-spinner fa-spin"></i>
                <span>${message}</span>
            </div>
        `;
        
        progressEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--accent-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;

        document.body.appendChild(progressEl);

        if (duration > 0) {
            setTimeout(() => {
                if (progressEl.parentNode) {
                    progressEl.style.animation = 'slideOutRight 0.3s ease';
                    setTimeout(() => progressEl.remove(), 300);
                }
            }, duration);
        }

        return progressEl;
    }

    async withExportProgress(operation, format) {
        if (this.isExporting) {
            throw new Error('Un export est déjà en cours');
        }

        this.isExporting = true;
        const progressEl = await this.showExportProgress(`Préparation de l'export ${format.toUpperCase()}...`, 0);

        try {
            const result = await operation();
            progressEl.querySelector('span').textContent = `Export ${format.toUpperCase()} terminé !`;
            progressEl.querySelector('i').className = 'fas fa-check-circle';
            progressEl.style.background = '#10b981';
            
            setTimeout(() => {
                if (progressEl.parentNode) {
                    progressEl.style.animation = 'slideOutRight 0.3s ease';
                    setTimeout(() => progressEl.remove(), 300);
                }
            }, 2000);

            return result;
        } catch (error) {
            if (progressEl.parentNode) {
                progressEl.querySelector('span').textContent = `Échec de l'export ${format.toUpperCase()}`;
                progressEl.querySelector('i').className = 'fas fa-exclamation-circle';
                progressEl.style.background = '#ef4444';
                
                setTimeout(() => {
                    if (progressEl.parentNode) progressEl.remove();
                }, 3000);
            }
            throw error;
        } finally {
            this.isExporting = false;
        }
    }

    createOptimizedExportContainer(sourceElement) {
        const container = document.createElement('div');
        const padding = 40;
        const width = Math.max(sourceElement.scrollWidth, 800) + padding;
        
        container.style.cssText = `
            position: absolute;
            left: -10000px;
            top: -10000px;
            width: ${width}px;
            background: white;
            padding: ${padding}px;
            z-index: -1;
            box-sizing: border-box;
        `;
        
        const clonedElement = sourceElement.cloneNode(true);
        this.prepareElementForExport(clonedElement);
        container.appendChild(clonedElement);
        document.body.appendChild(container);
        
        return container;
    }

    prepareElementForExport(element) {
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
                    overflow: visible !important;
                `;
            }
        });

        element.style.cssText = `
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            background: white !important;
        `;
    }

    async exportToPNG() {
        return this.withExportProgress(async () => {
            // Validation
            const errors = this.validateExportPrerequisites();
            if (errors.length > 0) {
                throw new Error(errors.join(', '));
            }

            if (!this.validateLibrary('png')) {
                throw new Error('Fonctionnalité PNG non disponible - html2canvas non chargé');
            }

            const originalState = this.saveExportState();
            
            try {
                this.expandAllForExport();
                await this.waitForDOMUpdate();

                const treeContainer = document.getElementById('treeContainer');
                const exportContainer = this.createOptimizedExportContainer(treeContainer);

                const canvas = await this.withTimeout(
                    window.html2canvas(exportContainer, {
                        backgroundColor: '#ffffff',
                        scale: this.exportConfig.png.scale,
                        useCORS: true,
                        allowTaint: false,
                        logging: false,
                        width: exportContainer.scrollWidth,
                        height: exportContainer.scrollHeight,
                        scrollX: 0,
                        scrollY: 0,
                        windowWidth: exportContainer.scrollWidth,
                        windowHeight: exportContainer.scrollHeight
                    }),
                    this.exportConfig.png.timeout,
                    'Capture PNG'
                );

                document.body.removeChild(exportContainer);
                this.downloadCanvasAsPNG(canvas, `autosys-${this.getFormattedDate()}.png`);
                
            } finally {
                this.restoreExportState(originalState);
            }
        }, 'png');
    }

    async exportToPDF() {
        return this.withExportProgress(async () => {
            const errors = this.validateExportPrerequisites();
            if (errors.length > 0) {
                throw new Error(errors.join(', '));
            }

            if (!this.validateLibrary('pdf')) {
                throw new Error('Fonctionnalité PDF non disponible - librairies manquantes');
            }

            const originalState = this.saveExportState();
            
            try {
                this.expandAllForExport();
                await this.waitForDOMUpdate(1000);

                const treeContainer = document.getElementById('treeContainer');
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');

                const canvas = await this.withTimeout(
                    window.html2canvas(treeContainer, {
                        backgroundColor: '#ffffff',
                        scale: this.exportConfig.pdf.scale,
                        useCORS: true,
                        allowTaint: false,
                        logging: false,
                        width: treeContainer.scrollWidth,
                        height: treeContainer.scrollHeight,
                        scrollX: 0,
                        scrollY: 0,
                        windowWidth: treeContainer.scrollWidth,
                        windowHeight: treeContainer.scrollHeight,
                        onclone: (clonedDoc, element) => {
                            this.prepareElementForExport(element);
                        }
                    }),
                    this.exportConfig.pdf.timeout,
                    'Capture PDF'
                );

                const imgData = canvas.toDataURL('image/png', this.exportConfig.pdf.quality);
                this.generatePDFFromImage(pdf, imgData, `autosys-${this.getFormattedDate()}.pdf`);
                
            } finally {
                this.restoreExportState(originalState);
            }
        }, 'pdf');
    }

    async exportToHTML() {
        return this.withExportProgress(async () => {
            const errors = this.validateExportPrerequisites();
            if (errors.length > 0) {
                throw new Error(errors.join(', '));
            }

            try {
                const htmlContent = this.generateHTMLContent();
                this.downloadHTML(htmlContent, this.generateHTMLFilename());
            } catch (error) {
                throw new Error(`Erreur génération HTML: ${error.message}`);
            }
        }, 'html');
    }

    downloadCanvasAsPNG(canvas, filename) {
        try {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png', this.exportConfig.png.quality);
            link.click();
        } catch (error) {
            throw new Error(`Échec du téléchargement PNG: ${error.message}`);
        }
    }

    generatePDFFromImage(pdf, imgData, filename) {
        try {
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;

            const imgProps = pdf.getImageProperties(imgData);
            const ratio = (pageWidth - 2 * margin) / imgProps.width;
            const finalWidth = imgProps.width * ratio;
            const finalHeight = imgProps.height * ratio;

            const pagesNeeded = Math.ceil(finalHeight / (pageHeight - 20));
            const extractionDate = new Date().toLocaleDateString('fr-FR');

            for (let i = 0; i < pagesNeeded; i++) {
                if (i > 0) pdf.addPage();
                
                const yPos = -i * (pageHeight - 20);
                pdf.addImage({
                    imageData: imgData,
                    format: 'PNG',
                    x: margin,
                    y: yPos + margin,
                    width: finalWidth,
                    height: finalHeight
                });

                pdf.setFontSize(8);
                pdf.setTextColor(120, 120, 120);
                const footerText = `${i + 1}/${pagesNeeded} - ${extractionDate}`;
                const textWidth = pdf.getTextWidth(footerText);
                pdf.text(footerText, pageWidth - margin - textWidth, pageHeight - 5);
            }

            pdf.save(filename);
        } catch (error) {
            throw new Error(`Génération PDF échouée: ${error.message}`);
        }
    }

    downloadHTML(htmlContent, filename) {
        try {
            const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
            
            // nettoyage la memoire
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            throw new Error(`Échec téléchargement HTML: ${error.message}`);
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
        document.querySelectorAll('.tree-node').forEach(node => {
            if (node.querySelector('.children')) {
                node.classList.add('expanded');
                node.classList.remove('collapsed');
            }
        });
        
        document.querySelectorAll('.children').forEach(container => {
            container.style.cssText = `
                display: block !important;
                max-height: none !important;
                opacity: 1 !important;
                visibility: visible !important;
                height: auto !important;
            `;
        });
        
        // reflow forcé
        document.body.offsetHeight;
    }

    restoreTreeState(states) {
        states.forEach((state, node) => {
            if (node.parentNode) {
                node.classList.toggle('expanded', state.expanded);
                node.classList.toggle('collapsed', state.collapsed);
                
                const children = node.querySelector('.children');
                if (children) {
                    children.style.cssText = '';
                }
            }
        });
    }

    extractApplicationName() {
        for (const [jobName, job] of this.viewer.boxes) {
            if (job.attributes?.application) {
                return job.attributes.application;
            }
            if (job.attributes?.APPLICATION) {
                return job.attributes.APPLICATION;
            }
        }
        return null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getFormattedDate() {
        return new Date().toISOString().split('T')[0];
    }

    generateHTMLFilename() {
        const appName = this.extractApplicationName();
        const baseName = appName ? appName.replace(/[^a-zA-Z0-9]/g, '-') : 'export';
        return `autosys-${baseName}-${this.getFormattedDate()}.html`;
    }

    generateHTMLContent() {
        const applicationName = this.extractApplicationName();
        const displayAppName = applicationName ? `APPLICATION: ${applicationName}` : 'APPLICATION: Non spécifiée';
        
        let htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${applicationName || 'Export Autosys'}</title>
    <meta name="generator" content="JIL Viewer">
    <meta name="created" content="${new Date().toISOString()}">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; color: #2c3e50; line-height: 1.4; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 30px; overflow-wrap: break-word; }
        .header { border-bottom: 2px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
        .tree-node { margin: 8px 0; border-left: 3px solid #bdc3c7; padding-left: 15px; page-break-inside: avoid; }
        .tree-node-header { padding: 12px 15px; background: #ecf0f1; border-radius: 8px; display: flex; flex-direction: column; gap: 8px; }
        .job-header-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .job-name { font-weight: 600; font-size: 16px; word-break: break-word; }
        .job-type-BOX .job-name { color: #e74c3c; }
        .job-type-CMD .job-name { color: #27ae60; }
        .job-type-FT .job-name { color: #2980b9; }
        .job-type { font-size: 12px; color: #7f8c8d; background: #f8f9fa; padding: 2px 6px; border-radius: 4px; border: 1px solid #dee2e6; }
        .job-description { font-size: 14px; color: #5a6c7d; font-style: italic; padding: 8px 0 0 0; border-top: 1px dashed #bdc3c7; margin-top: 8px; }
        .icon { font-size: 16px; min-width: 20px; text-align: center; }
        .children { margin-left: 25px; border-left: 2px dashed #bdc3c7; padding-left: 15px; }
        @media print { body { padding: 10px; background: white; } .container { box-shadow: none; border-radius: 0; padding: 15px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Boites Autosys de l'application: ${applicationName || 'Non spécifiée'}</h1>
            <div>Export généré le ${new Date().toLocaleDateString('fr-FR')} • ${this.viewer.boxes.size} jobs</div>
        </div>`;

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
                    </div>`;

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

        return htmlContent;
    }

    exportSubtree(job) {
        try {
            if (this.isExporting) {
                alert('Un export est déjà en cours. Veuillez patienter.');
                return;
            }

            console.log(`Export du sous-arbre: ${job.name}`);
            const subtree = this.extractSubtree(job);
            this.showExportSubtreeModal(subtree, job.name);
            
        } catch (error) {
            this.handleExportError('sous-arbre', error, 'Erreur lors de la préparation de l\'export');
        }
    }

    extractSubtree(job) {
        const subtree = {
            name: job.name,
            type: job.type,
            description: job.description,
            attributes: { ...job.attributes },
            children: []
        };
        
        const extractChildren = (parentJob, parentNode) => {
            if (parentJob.children && parentJob.children.length > 0) {
                parentJob.children.forEach(child => {
                    const childNode = {
                        name: child.name,
                        type: child.type,
                        description: child.description,
                        attributes: { ...child.attributes },
                        children: []
                    };
                    parentNode.children.push(childNode);
                    extractChildren(child, childNode);
                });
            }
        };
        
        extractChildren(job, subtree);
        return subtree;
    }

    showExportSubtreeModal(subtree, jobName) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content export-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-download"></i> Exporter "${jobName}"</h3>
                    <button class="modal-close" id="modalCloseBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Export du job <strong>${jobName}</strong> et de ses ${this.countSubtreeJobs(subtree)} jobs enfants</p>
                    <div class="export-options">
                        <button class="btn-export-option" data-format="png">
                            <i class="fas fa-image"></i>
                            <span>PNG</span>
                        </button>
                        <button class="btn-export-option" data-format="pdf">
                            <i class="fas fa-file-pdf"></i>
                            <span>PDF</span>
                        </button>
                        <button class="btn-export-option" data-format="html">
                            <i class="fas fa-code"></i>
                            <span>HTML</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#modalCloseBtn');
        closeBtn.addEventListener('click', () => modal.remove());

        modal.querySelectorAll('.btn-export-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const format = btn.getAttribute('data-format');
                modal.remove();
                this.executeSubtreeExport(subtree, jobName, format);
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    countSubtreeJobs(subtree) {
        let count = 0;
        const countRecursive = (node) => {
            if (node.children) {
                node.children.forEach(child => {
                    count++;
                    countRecursive(child);
                });
            }
        };
        countRecursive(subtree);
        return count;
    }

    executeSubtreeExport(subtree, jobName, format) {
        const exportOperation = async () => {
            const originalState = this.saveExportState();
            
            try {
                // arborescence temp
                this.viewer.rootBoxes = [subtree];
                this.viewer.boxes = new Map();
                this.viewer.filteredBoxes = new Map();
                this.populateBoxesMap(subtree);
                
                // forcer le rendu
                this.viewer.treeRenderer.renderTree([subtree]);
                this.viewer.treeRenderer.expandAll();
                await this.waitForDOMUpdate(1000);

                // export
                switch (format) {
                    case 'png':
                        await this.exportToPNG();
                        break;
                    case 'pdf':
                        await this.exportToPDF();
                        break;
                    case 'html':
                        await this.exportToHTML();
                        break;
                    default:
                        throw new Error(`Format non supporté: ${format}`);
                }
                
            } finally {
                this.restoreExportState(originalState);
            }
        };

        exportOperation().catch(error => {
            this.handleExportError(format, error, `Erreur lors de l'export ${format.toUpperCase()} du sous-arbre`);
        });
    }

    populateBoxesMap(node) {
        this.viewer.boxes.set(node.name, node);
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => this.populateBoxesMap(child));
        }
    }
}
