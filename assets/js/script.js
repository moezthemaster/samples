import { JILParser } from './modules/jil-parser.js';
import { TreeRenderer } from './modules/tree-renderer.js';
import { ExportManager } from './modules/export-manager.js';
import { EventManager } from './modules/event-manager.js';
import { ComparisonManager } from './modules/comparison-manager.js';
import { ComparisonRenderer } from './modules/comparison-renderer.js';

class AutosysViewer {
    constructor() {
        console.log('🔍 AUTOSYSVIEWER: Constructeur appelé');
        
        try {
            this.boxes = new Map();
            this.rootBoxes = [];
            this.filteredBoxes = new Map();
            this.selectedJob = null;
            this.currentFileContent = null;
            this.currentMode = 'single';
            
            console.log('init modlules');
            this.jilParser = new JILParser();
            this.treeRenderer = new TreeRenderer(this);
            this.exportManager = new ExportManager(this);
            this.eventManager = new EventManager(this);
            this.comparisonManager = new ComparisonManager(this);
            this.comparisonRenderer = new ComparisonRenderer(this);
            this.eventManager.initializeEventListeners();
            this.eventManager.setupDragAndDrop();
            
            console.log('Constructeur ok');
            
        } catch (error) {
            console.error('constructeur ko:', error);
            throw error;
        }
    }

    toggleMode(mode) {

    this.currentMode = mode;
    const singleMode = document.querySelector('.single-mode');
    const compareMode = document.querySelector('.compare-mode');
    const modeButtons = document.querySelectorAll('.btn-mode');
    const fileInfo = document.getElementById('fileInfo');
    const fileStatus = document.getElementById('fileStatus');
    
    console.log('UI:', {
        singleMode: !!singleMode,
        compareMode: !!compareMode,
        modeButtons: modeButtons.length,
        fileInfo: !!fileInfo
    });
    
    if (mode === 'compare') {
        document.body.classList.add('compare-mode-active');
        singleMode.classList.add('hidden');
        compareMode.classList.remove('hidden');
        modeButtons[0].classList.remove('active');
        modeButtons[1].classList.add('active');
        
        if (fileStatus) {
            fileStatus.classList.add('hidden');
        }
        
        console.log('comparaison ');
    } else {
        document.body.classList.remove('compare-mode-active');
        singleMode.classList.remove('hidden');
        compareMode.classList.add('hidden');
        modeButtons[0].classList.add('active');
        modeButtons[1].classList.remove('active');
        
        if (fileStatus) {
            fileStatus.classList.remove('hidden');
        }
        
        if (this.comparisonManager) {
            this.comparisonManager.resetComparison();
        }
        console.log('visualistion');
    }
    
    this.resetView();
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('Fichier sélectionné:', file.name);
        this.showLoading();

        try {
            const content = await this.readFile(file);
            this.currentFileContent = content;
            
            const fileInfoElement = document.getElementById('fileInfo');
            fileInfoElement.textContent = `${file.name} • ${(file.size / 1024).toFixed(2)} KB`;
            fileInfoElement.style.color = 'var(--accent-color)';
            fileInfoElement.style.fontWeight = '600';
            
            const parsingResult = this.jilParser.parseJILFile(content);
            this.boxes = parsingResult.boxes;
            this.rootBoxes = parsingResult.rootBoxes;
            
            this.applyFilters();
            
        } catch (error) {
            console.error('Erreur lors du chargement du fichier:', error);
            alert('Erreur lors du chargement du fichier: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async handleCompareFileSelect(side, file) {
        console.log(`Chargement fichier ${side}:`, file.name);
        this.showLoading();

        try {
            const success = await this.comparisonManager.loadFile(side, file);
            if (success) {
                console.log(`fichier ${side} chargé avec succès`);
            }
        } catch (error) {
            console.error(`Erreur lors du chargement du fichier ${side}:`, error);
            alert(`Erreur lors du chargement du fichier ${side}: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async startComparison() {
        await this.comparisonManager.compare();
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    applyFilters() {
        if (this.currentMode === 'compare' && this.comparisonManager.result) {
            this.comparisonRenderer.renderComparisonTree();
            this.updateComparisonCounter();
        } else {
            const searchTerm = document.getElementById('searchFilter').value.toLowerCase();

            this.filteredBoxes.clear();
            const filteredRootBoxes = [];
            const boxesToExpand = new Set();

            const filterRecursive = (box) => {
                const matchesSearch = searchTerm === '' || 
                                    box.name.toLowerCase().includes(searchTerm) || 
                                    (box.description && box.description.toLowerCase().includes(searchTerm));

                let filteredChildren = [];
                if (box.children && box.children.length > 0) {
                    box.children.forEach(child => {
                        const filteredChild = filterRecursive(child);
                        if (filteredChild) {
                            filteredChildren.push(filteredChild);
                            
                            if (searchTerm && (child.name.toLowerCase().includes(searchTerm) || 
                                (child.description && child.description.toLowerCase().includes(searchTerm)))) {
                                boxesToExpand.add(box.name);
                            }
                        }
                    });
                }

                const shouldKeep = matchesSearch || filteredChildren.length > 0;

                if (shouldKeep) {
                    const filteredBox = {
                        ...box,
                        children: filteredChildren
                    };
                    this.filteredBoxes.set(box.name, filteredBox);
                    return filteredBox;
                }

                return null;
            };

            this.rootBoxes.forEach(box => {
                const filteredBox = filterRecursive(box);
                if (filteredBox) {
                    filteredRootBoxes.push(filteredBox);
                }
            });

            this.treeRenderer.renderTree(filteredRootBoxes);
            
            if (searchTerm) {
                setTimeout(() => this.treeRenderer.expandMatchingBoxes(boxesToExpand), 100);
            } else {
                setTimeout(() => this.treeRenderer.collapseAll(), 100);
            }
        }
        this.updateJobCounter();
    }

    updateJobCounter() {
        if (this.currentMode === 'compare' && this.comparisonManager.result) {
            this.updateComparisonCounter();
            return;
        }

        const totalJobs = this.boxes.size;
        const filteredJobs = this.filteredBoxes.size;
        const counter = document.getElementById('jobCounter');
        
        if (filteredJobs === totalJobs) {
            counter.textContent = `${totalJobs} jobs`;
        } else {
            counter.textContent = `${filteredJobs}/${totalJobs} jobs`;
        }
    }

    updateComparisonCounter() {
        const counter = document.getElementById('jobCounter');
        if (!this.comparisonManager.result) {
            counter.textContent = '0 jobs';
            return;
        }

        const { newJobs, deletedJobs, modifiedJobs, identicalJobs } = this.comparisonManager.result;
        const totalJobs = newJobs.length + deletedJobs.length + modifiedJobs.length + identicalJobs.length;
        
        counter.textContent = `${totalJobs} jobs comparés`;
    }

    selectJob(job) {
        this.treeRenderer.selectJob(job);
        this.selectedJob = job;
        
        if (this.currentMode === 'compare' && this.comparisonManager.result) {
            this.showComparisonJobDetails(job);
        } else {
            this.showNormalJobDetails(job);
        }
    }

    showComparisonJobDetails(job) {
        const detailsContent = document.getElementById('detailsContent');
        const detailsPanel = document.getElementById('detailsPanel');
        
        detailsPanel.querySelector('.empty-details').classList.add('hidden');
        detailsContent.classList.remove('hidden');

        detailsContent.innerHTML = this.comparisonRenderer.renderComparisonDetails(job);
    }

    showNormalJobDetails(job) {
        const detailsContent = document.getElementById('detailsContent');
        const detailsPanel = document.getElementById('detailsPanel');
        
        detailsPanel.querySelector('.empty-details').classList.add('hidden');
        detailsContent.classList.remove('hidden');

        detailsContent.innerHTML = this.generateJobDetailsHTML(job);
    }

    generateJobDetailsHTML(job) {
        const importantAttributes = ['command', 'machine', 'owner', 'condition', 'date_conditions', 'start_times', 'run_calendar', 'exclude_calendar'];
        
        let dependenciesHTML = '';
        if (job.dependsOn.length > 0 || job.requiredBy.length > 0 || job.attributes.condition) {
            dependenciesHTML = `
            <div class="detail-section">
                <h4><i class="fas fa-link"></i> Dépendances et Conditions</h4>
                ${job.attributes.condition ? `
                <div class="detail-item">
                    <span class="detail-label">Condition:</span>
                    <span class="detail-value condition-code">${this.formatCondition(job.attributes.condition)}</span>
                </div>
                ` : ''}
                ${job.dependsOn.length > 0 ? `
                <div class="detail-item">
                    <span class="detail-label">Dépend de:</span>
                    <span class="detail-value">${job.dependsOn.join(', ')}</span>
                </div>
                ` : ''}
                ${job.requiredBy.length > 0 ? `
                <div class="detail-item">
                    <span class="detail-label">Requis par:</span>
                    <span class="detail-value">${job.requiredBy.join(', ')}</span>
                </div>
                ` : ''}
            </div>
            `;
        }
        
        return `
            <div class="detail-section">
                <h4><i class="fas fa-id-card"></i> Informations générales</h4>
                <div class="detail-item">
                    <span class="detail-label">Nom:</span>
                    <span class="detail-value">${job.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${job.type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${job.description || 'Non spécifiée'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Parent:</span>
                    <span class="detail-value">${job.parent || 'Aucun (Box racine)'}</span>
                </div>
                ${job.children && job.children.length > 0 ? `
                <div class="detail-item">
                    <span class="detail-label">Enfants:</span>
                    <span class="detail-value">${job.children.length} job(s)</span>
                </div>
                ` : ''}
            </div>

            ${job.attributes.command ? `
            <div class="detail-section">
                <h4><i class="fas fa-terminal"></i> Commande</h4>
                <div class="detail-item">
                    <span class="detail-label">Commande:</span>
                    <span class="detail-value command">${job.attributes.command}</span>
                </div>
            </div>
            ` : ''}

            ${job.attributes.machine ? `
            <div class="detail-section">
                <h4><i class="fas fa-server"></i> Machine</h4>
                <div class="detail-item">
                    <span class="detail-label">Machine:</span>
                    <span class="detail-value">${job.attributes.machine}</span>
                </div>
            </div>
            ` : ''}

            ${dependenciesHTML}

            ${job.attributes.run_calendar || job.attributes.start_times || job.attributes.date_conditions ? `
            <div class="detail-section">
                <h4><i class="fas fa-calendar-alt"></i> Planification</h4>
                ${job.attributes.run_calendar ? `
                <div class="detail-item">
                    <span class="detail-label">Calendrier:</span>
                    <span class="detail-value">${job.attributes.run_calendar}</span>
                </div>
                ` : ''}
                ${job.attributes.start_times ? `
                <div class="detail-item">
                    <span class="detail-label">Heures de début:</span>
                    <span class="detail-value">${job.attributes.start_times}</span>
                </div>
                ` : ''}
                ${job.attributes.date_conditions ? `
                <div class="detail-item">
                    <span class="detail-label">Conditions de date:</span>
                    <span class="detail-value">${job.attributes.date_conditions}</span>
                </div>
                ` : ''}
            </div>
            ` : ''}

            <div class="detail-section">
                <h4><i class="fas fa-cogs"></i> Autres attributs</h4>
                ${Object.entries(job.attributes)
                    .filter(([key]) => !importantAttributes.includes(key))
                    .map(([key, value]) => `
                    <div class="detail-item">
                        <span class="detail-label">${key}:</span>
                        <span class="detail-value">${value}</span>
                    </div>
                    `).join('')}
                ${Object.entries(job.attributes).filter(([key]) => !importantAttributes.includes(key)).length === 0 ? `
                    <div class="detail-item">
                        <span class="detail-label">Aucun autre attribut</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    formatCondition(condition) {
        if (!condition) return '';
        
        let formatted = condition.replace(/(v\([^)]+\))/g, '<span class="global-variable" title="Variable globale">$1</span>');
        formatted = formatted.replace(/(&|\|)/g, '<span class="logic-operator"> $1 </span>');
        
        return formatted;
    }

    resetView() {
        document.getElementById('searchFilter').value = '';
        this.applyFilters();
        
        if (this.currentMode === 'single') {
            this.treeRenderer.collapseAll();
        }
        
        this.selectedJob = null;
        document.querySelectorAll('.tree-node.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        const detailsContent = document.getElementById('detailsContent');
        const detailsPanel = document.getElementById('detailsPanel');
        detailsContent.classList.add('hidden');
        detailsPanel.querySelector('.empty-details').classList.remove('hidden');
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    showAboutModal() {
        document.getElementById('aboutModal').classList.remove('hidden');
    }

    hideAboutModal() {
        document.getElementById('aboutModal').classList.add('hidden');
    }

    exportToPNG() {
        this.exportManager.exportToPNG();
    }

    exportToPDF() {
        this.exportManager.exportToPDF();
    }

    exportToHTML() {
        this.exportManager.exportToHTML();
    }

    expandAll() {
        this.treeRenderer.expandAll();
    }

    collapseAll() {
        this.treeRenderer.collapseAll();
    }
}

// initialisation
console.log('🔍 État du DOM:', {
    readyState: document.readyState,
    autosysViewer: window.autosysViewer
});

if (document.readyState === 'loading') {
    console.log('🔍 DOM encore en chargement - on attend DOMContentLoaded');
} else {
    console.log('🔍 DOM déjà chargé - initialisation immédiate');
    try {
        window.autosysViewer = new AutosysViewer();
        console.log('iitialisé IMMEDIAT OK');
    } catch (error) {
        console.error('initialisation immédiate KO:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 demarrage app');
    console.log('🔍 autosysViewer avant initialisation:', window.autosysViewer);
    
    try {
        if (!window.autosysViewer) {
            window.autosysViewer = new AutosysViewer();
            console.log('✅ AUTOSYSVIEWER: Initialisé dans DOMContentLoaded');
        } else {
            console.log('ℹ️ AUTOSYSVIEWER: Déjà initialisé');
        }
    } catch (error) {
        console.error('❌ ERREUR dans AutosysViewer:', error);
        console.error('Stack:', error.stack);
    }
});