import { JILParser } from './modules/jil-parser.js';
import { TreeRenderer } from './modules/tree-renderer.js';
import { AnimationManager } from './modules/animation-manager.js';
import { ExportManager } from './modules/export-manager.js';
import { EventManager } from './modules/event-manager.js';
import { Helpers } from './utils/helpers.js';

class AutosysViewer {
    constructor() {
        this.boxes = new Map();
        this.rootBoxes = [];
        this.filteredBoxes = new Map();
        this.selectedJob = null;
        this.currentFileContent = null;
        
        // Initialiser les modules
        this.jilParser = new JILParser();
        this.treeRenderer = new TreeRenderer(this);
        this.animationManager = new AnimationManager(this);
        this.exportManager = new ExportManager(this);
        this.eventManager = new EventManager(this);
        
        console.log('=== AUTOSYS VIEWER INIT ===');
        this.eventManager.initializeEventListeners();
        this.eventManager.setupDragAndDrop();
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('Fichier sélectionné:', file.name);
        this.showLoading();

        try {
            const content = await Helpers.readFile(file);
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

    applyFilters() {
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
        this.updateJobCounter();
        
        if (searchTerm) {
            setTimeout(() => this.treeRenderer.expandMatchingBoxes(boxesToExpand), 100);
        } else {
            setTimeout(() => this.treeRenderer.collapseAll(), 100);
        }
    }

    updateJobCounter() {
        const totalJobs = this.boxes.size;
        const filteredJobs = this.filteredBoxes.size;
        const counter = document.getElementById('jobCounter');
        
        if (filteredJobs === totalJobs) {
            counter.textContent = `${totalJobs} jobs`;
        } else {
            counter.textContent = `${filteredJobs}/${totalJobs} jobs`;
        }
    }

    selectJob(job) {
        document.querySelectorAll('.tree-node.selected').forEach(item => {
            item.classList.remove('selected');
        });

        const allNodes = document.querySelectorAll('.tree-node');
        let targetNode = null;
        
        for (let node of allNodes) {
            const jobNameElement = node.querySelector('.job-name');
            if (jobNameElement && jobNameElement.textContent.trim().replace(' 📦', '') === job.name) {
                targetNode = node;
                break;
            }
        }

        if (targetNode) {
            targetNode.classList.add('selected');
        }

        this.selectedJob = job;
        this.showJobDetails(job);
    }

    showJobDetails(job) {
        const detailsContent = document.getElementById('detailsContent');
        const detailsPanel = document.getElementById('detailsPanel');
        
        detailsPanel.querySelector('.empty-details').classList.add('hidden');
        detailsContent.classList.remove('hidden');

        detailsContent.innerHTML = Helpers.generateJobDetailsHTML(job);
    }

    resetView() {
        document.getElementById('searchFilter').value = '';
        this.applyFilters();
        this.treeRenderer.collapseAll();
        
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
}

// Injecter le CSS pour l'animation
const animationCSS = `
.animation-controls-overlay {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    min-width: 300px;
    border: 1px solid #e1e5e9;
}

.animation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: var(--primary-color, #3498db);
    color: white;
    border-radius: 12px 12px 0 0;
}

.animation-header h3 {
    margin: 0;
    font-size: 1.1em;
    display: flex;
    align-items: center;
    gap: 8px;
}

.btn-close-animation {
    background: none;
    border: none;
    color: white;
    font-size: 1.1em;
    cursor: pointer;
    padding: 5px;
    border-radius: 3px;
}

.btn-close-animation:hover {
    background: rgba(255, 255, 255, 0.1);
}

.animation-controls-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 15px 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
}

.btn-control {
    background: var(--accent-color, #e74c3c);
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85em;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 0.2s ease;
}

.btn-control:hover {
    background: var(--primary-color, #3498db);
    transform: translateY(-1px);
}

.animation-progress {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    font-size: 0.8em;
    color: #666;
}

.progress-bar {
    width: 100px;
    height: 6px;
    background: #e9ecef;
    border-radius: 3px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--accent-color, #e74c3c);
    transition: width 0.3s ease;
    width: 0%;
}

.animation-legend {
    display: flex;
    gap: 15px;
    padding: 12px 20px;
    background: white;
    border-radius: 0 0 12px 12px;
    font-size: 0.8em;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.color-box {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    border: 1px solid #ddd;
}

.job-ready .color-box { 
    background: #9ca3af !important;
    border-color: #6b7280 !important; 
}
.job-executing .color-box { 
    background: #10b981 !important;
    border-color: #059669 !important; 
}
.job-completed .color-box { 
    background: #3b82f6 !important;
    border-color: #2563eb !important; 
}

.job-name.job-ready {
    color: #9ca3af !important;
    font-weight: normal;
}

.job-name.job-executing {
    color: #10b981 !important;
    font-weight: bold;
    animation: blink 1.5s ease-in-out infinite;
}

.job-name.job-completed {
    color: #3b82f6 !important;
    font-weight: bold;
}

.tree-node.job-ready,
.tree-node.job-executing, 
.tree-node.job-completed {
    background: inherit !important;
    border-left: 3px solid #bdc3c7 !important;
    transform: none;
    box-shadow: none;
}

.btn-animate {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9em;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    margin: 10px 0;
}

.btn-animate:hover {
    background: green !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.animation-controls-preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.animation-controls-preview small {
    color: #666;
    font-size: 0.8em;
}

.hidden {
    display: none !important;
}

/* Animation de clignotement pour l'état "executing" */
@keyframes blink {
    0%, 100% { 
        opacity: 1;
        text-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
    }
    50% { 
        opacity: 0.7;
        text-shadow: 0 0 4px rgba(16, 185, 129, 0.3);
    }
}
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = animationCSS;
document.head.appendChild(styleSheet);

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Application Autosys Viewer démarrée - VERSION MODULARISÉE');
    window.autosysViewer = new AutosysViewer();
});
