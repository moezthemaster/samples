import '../css/main.css';
import '../fonts/all.min.css';

import { JILParser } from './modules/jil-parser.js';
import { TreeRenderer } from './modules/tree-renderer.js';
import { ExportManager } from './modules/export-manager.js';
import { EventManager } from './modules/event-manager.js';
import { ComparisonManager } from './modules/comparison-manager.js';
import { ComparisonRenderer } from './modules/comparison-renderer.js';
import { EditionManager } from './modules/edition-manager.js';
import { JobCreator } from './modules/job-creator.js';

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
            this.editionManager = new EditionManager(this);
            this.jobCreator = new JobCreator(this);
            this.eventManager.initializeEventListeners();
            
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
        
        const fileInfoElement = document.getElementById('fileInfoSingle');
        fileInfoElement.textContent = `${file.name} • ${(file.size / 1024).toFixed(2)} KB`;
        fileInfoElement.style.color = 'var(--accent-color)';
        fileInfoElement.style.fontWeight = '600';
        
        const parsingResult = this.jilParser.parseJILFile(content);
        this.boxes = parsingResult.boxes;
        this.rootBoxes = parsingResult.rootBoxes;
        
        // Regénérer les datalists d'autocomplétion
        this.jobCreator.generateDataLists();
        
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
        this.setupExportModifiedJIL();
    }

showNormalJobDetails(job) {
    const detailsContent = document.getElementById('detailsContent');
    const detailsPanel = document.getElementById('detailsPanel');
    
    if (!detailsContent || !detailsPanel) return;
    
    const emptyDetails = detailsPanel.querySelector('.empty-details');
    if (emptyDetails) {
        emptyDetails.classList.add('hidden');
    }
    
    detailsContent.classList.remove('hidden');
    detailsContent.innerHTML = this.generateJobDetailsHTML(job);
    this.setupExportModifiedJIL();
}

generateJobDetailsHTML(job) {
    const isModified = job.modified || this.editionManager.modifiedJobs.has(job.name);
    const resetButton = isModified ? `
        <button class="btn-reset-modification" id="resetJobModification" data-job="${job.name}">
            <i class="fas fa-undo"></i> Annuler les modifications
        </button>
    ` : '';
    
    const hasGlobalModifications = this.editionManager.getModifiedJobsCount() > 0;
    const exportSection = hasGlobalModifications ? `
        <div class="detail-section">
            <h4><i class="fas fa-download"></i> Export</h4>
            <div class="export-buttons" style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn-export" id="exportAllJIL">
                    <i class="fas fa-file-export"></i> JIL Complet
                </button>
                <button class="btn-export" id="exportModifiedJIL">
                    <i class="fas fa-file-code"></i> Jobs Modifiés
                </button>
            </div>
        </div>
    ` : '';
    
    // Générer toutes les sections de détails
    return `
        ${resetButton}
        
        <!-- Informations Générales -->
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
            ${this.generateAttributeHTML(job, 'description', 'Description')}
            ${this.generateAttributeHTML(job, 'owner', 'Owner')}
            ${this.generateAttributeHTML(job, 'application', 'Application')}
            ${this.generateAttributeHTML(job, 'group', 'Groupe')}
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

        <!-- Section spécifique au type -->
        ${job.type === 'CMD' ? this.generateCMDDetails(job) : ''}
        ${job.type === 'FT' ? this.generateFTDetails(job) : ''}
        ${job.type === 'BOX' ? this.generateBOXDetails(job) : ''}

        <!-- Planification -->
        ${this.generateScheduleDetails(job)}

        <!-- Dépendances et Conditions -->
        ${this.generateDependenciesDetails(job)}

        <!-- Propriétés Avancées -->
        ${this.generateAdvancedDetails(job)}

        ${exportSection}
    `;
}

// Méthode utilitaire pour générer un attribut éditable
generateAttributeHTML(job, attributeName, label) {
    const value = job.attributes[attributeName];
    if (!value) return '';
    
    return `
        <div class="detail-item">
            <span class="detail-label">${label}:</span>
            <span class="detail-value editable" data-attribute="${attributeName}" data-job="${job.name}">
                ${value}
            </span>
        </div>
    `;
}

// Détails spécifiques CMD
generateCMDDetails(job) {
    return `
        <div class="detail-section">
            <h4><i class="fas fa-terminal"></i> Commande</h4>
            ${this.generateAttributeHTML(job, 'command', 'Commande')}
            ${this.generateAttributeHTML(job, 'machine', 'Machine')}
            ${this.generateAttributeHTML(job, 'profile', 'Profile')}
            ${this.generateAttributeHTML(job, 'permission', 'Permissions')}
        </div>
    `;
}

// Détails spécifiques FT
generateFTDetails(job) {
    return `
        <div class="detail-section">
            <h4><i class="fas fa-exchange-alt"></i> Transfert de Fichier</h4>
            ${this.generateAttributeHTML(job, 'source_file', 'Fichier Source')}
            ${this.generateAttributeHTML(job, 'dest_file', 'Destination')}
            ${this.generateAttributeHTML(job, 'machine', 'Machine')}
            ${this.generateAttributeHTML(job, 'permission', 'Permissions')}
        </div>
    `;
}

// Détails spécifiques BOX
generateBOXDetails(job) {
    // SEULEMENT POUR LES BOX ET SEULEMENT SI ELLES ONT DES ATTRIBUTS SPÉCIFIQUES
    if (job.type !== 'BOX') return '';
    
    const hasBoxAttributes = job.attributes.box_success || job.attributes.box_failure;
    if (!hasBoxAttributes) return '';
    
    return `
        <div class="detail-section">
            <h4><i class="fas fa-cube"></i> Conteneur</h4>
            ${this.generateAttributeHTML(job, 'box_success', 'Box Success')}
            ${this.generateAttributeHTML(job, 'box_failure', 'Box Failure')}
        </div>
    `;
}

// Détails de Planification
generateScheduleDetails(job) {
    const scheduleAttributes = [
        'start_times', 'days_of_week', 'run_calendar', 
        'exclude_calendar', 'date_conditions'
    ];
    
    const hasSchedule = scheduleAttributes.some(attr => job.attributes[attr]);
    if (!hasSchedule) return '';
    
    return `
        <div class="detail-section">
            <h4><i class="fas fa-clock"></i> Planification</h4>
            ${this.generateAttributeHTML(job, 'start_times', 'Heures de début')}
            ${this.generateAttributeHTML(job, 'days_of_week', 'Jours de la semaine')}
            ${this.generateAttributeHTML(job, 'run_calendar', 'Calendrier d\'exécution')}
            ${this.generateAttributeHTML(job, 'exclude_calendar', 'Calendrier d\'exclusion')}
            ${this.generateAttributeHTML(job, 'date_conditions', 'Conditions de date')}
        </div>
    `;
}

// Détails des Dépendances
generateDependenciesDetails(job) {
    const dependencyAttributes = [
        'condition', 'watch_file', 'watch_file_min_size'
    ];
    
    const hasDependencies = dependencyAttributes.some(attr => job.attributes[attr]) || 
                           job.dependsOn.length > 0 || 
                           job.requiredBy.length > 0;
    
    if (!hasDependencies) return '';
    
    return `
        <div class="detail-section">
            <h4><i class="fas fa-link"></i> Dépendances et Conditions</h4>
            ${this.generateAttributeHTML(job, 'condition', 'Condition')}
            ${this.generateAttributeHTML(job, 'watch_file', 'Fichier à surveiller')}
            ${this.generateAttributeHTML(job, 'watch_file_min_size', 'Taille min fichier')}
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

// Détails Avancés
generateAdvancedDetails(job) {
    const advancedAttributes = [
        'std_out_file', 'std_err_file', 'priority', 'max_exit_success',
        'alarm_if_fail', 'auto_delete', 'min_run_alarm', 'max_run_alarm'
    ];
    
    const hasAdvanced = advancedAttributes.some(attr => job.attributes[attr]);
    if (!hasAdvanced) return '';
    
    return `
        <div class="detail-section">
            <h4><i class="fas fa-cogs"></i> Propriétés Avancées</h4>
            ${this.generateAttributeHTML(job, 'std_out_file', 'Fichier STDOUT')}
            ${this.generateAttributeHTML(job, 'std_err_file', 'Fichier STDERR')}
            ${this.generateAttributeHTML(job, 'priority', 'Priorité')}
            ${this.generateAttributeHTML(job, 'max_exit_success', 'Code sortie max succès')}
            ${this.generateAttributeHTML(job, 'alarm_if_fail', 'Alarme si échec')}
            ${this.generateAttributeHTML(job, 'auto_delete', 'Auto-suppression')}
            ${this.generateAttributeHTML(job, 'min_run_alarm', 'Alarme min durée')}
            ${this.generateAttributeHTML(job, 'max_run_alarm', 'Alarme max durée')}
        </div>
    `;
}

setupExportModifiedJIL() {
    const exportAllBtn = document.getElementById('exportAllJIL');
    const exportModifiedBtn = document.getElementById('exportModifiedJIL');
    const resetJobBtn = document.getElementById('resetJobModification');
    
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', () => {
            const jilContent = this.editionManager.generateModifiedJIL();
            if (jilContent) {
                const fileName = `jil_complet_${new Date().toISOString().split('T')[0]}.jil`;
                this.downloadJIL(jilContent, fileName);
            }
        });
    }
    
    if (exportModifiedBtn) {
        exportModifiedBtn.addEventListener('click', () => {
            const modifiedCount = this.editionManager.getModifiedJobsCount();
            if (modifiedCount === 0) {
                this.showNotification('Aucun job modifié à exporter', 'warning');
                return;
            }
            
            const jilContent = this.editionManager.generateModifiedJobsJIL();
            if (jilContent) {
                const fileName = `jobs_modifies_${new Date().toISOString().split('T')[0]}.jil`;
                this.downloadJIL(jilContent, fileName);
            }
        });
    }
    
    // Bouton pour annuler les modifications du job sélectionné
    if (resetJobBtn) {
        const jobName = resetJobBtn.getAttribute('data-job');
        resetJobBtn.addEventListener('click', () => {
            this.resetJobModification(jobName);
        });
    }
}

// Nouvelle méthode pour réinitialiser un job spécifique
resetJobModification(jobName) {
    const job = this.boxes.get(jobName);
    if (!job) return;
    
    const isNewJob = !this.editionManager.originalValues.has(jobName) || 
                    (this.editionManager.originalValues.get(jobName) && 
                     this.editionManager.originalValues.get(jobName).size === 0);
    
    const message = isNewJob 
        ? `Voulez-vous vraiment supprimer le job "${jobName}" ?` 
        : `Voulez-vous vraiment annuler les modifications pour le job "${jobName}" ?`;
    
    if (!confirm(message)) {
        return;
    }
    
    // Réinitialiser ce job spécifique
    this.editionManager.resetSingleJobModification(jobName);
    
    const notificationMessage = isNewJob 
        ? `Job "${jobName}" supprimé` 
        : `Modifications annulées pour ${jobName}`;
    
    this.showNotification(notificationMessage, 'success');
}

// Ajoutez cette méthode pour les notifications
showNotification(message, type = 'info') {
    // Créer une notification temporaire
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
    `;
    
    if (type === 'success') {
        notification.style.background = '#27ae60';
    } else if (type === 'warning') {
        notification.style.background = '#e67e22';
    } else {
        notification.style.background = '#3498db';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Supprimer après 3 secondes
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Méthode pour rafraîchir immédiatement l'affichage des détails
// Méthode pour rafraîchir immédiatement l'affichage des détails
refreshJobDetails() {
    if (this.selectedJob) {
        if (this.currentMode === 'compare' && this.comparisonManager.result) {
            this.showComparisonJobDetails(this.selectedJob);
        } else {
            this.showNormalJobDetails(this.selectedJob);
        }
    }
}

downloadJIL(content, filename) {
    if (!content) {
        this.showNotification('Aucun contenu à exporter', 'warning');
        return;
    }
    
    try {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(`Fichier ${filename} exporté avec succès`, 'success');
    } catch (error) {
        console.error('Erreur lors du téléchargement:', error);
        this.showNotification('Erreur lors de l\'export', 'error');
    }
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