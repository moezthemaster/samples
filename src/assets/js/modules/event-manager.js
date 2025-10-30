export class EventManager {
    constructor(viewer) {
        this.viewer = viewer;
    }

    initializeEventListeners() {
        console.log('Initialisation de tous les événements');
        this.setupFilterEvents();
        this.setupExportEvents();
        this.setupActionEvents();
        this.setupModalEvents();
        this.setupComparisonEvents();
        this.setupNewUploadSystem(); // Nouveau système unifié
        console.log('Tous les événements initialisés');
    }

    setupNewUploadSystem() {
        console.log('Configuration du système d\'upload unifié');
        
        const singleDropZone = document.getElementById('singleDropZone');
        const singleFileInput = document.getElementById('fileInput');
    
        if (!singleDropZone || !singleFileInput) {
            console.log('Éléments du nouveau système non trouvés');
            return;
        }
    
        // Clic sur la zone de drop
        singleDropZone.addEventListener('click', () => {
            console.log('Zone d\'upload cliquée');
            singleFileInput.click();
        });
    
        // Gestion de la sélection de fichier
        singleFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                console.log('Fichier sélectionné:', e.target.files[0].name);
                this.viewer.handleFileSelect(e);
            }
        });
    
        // Drag & drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            singleDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
    
        ['dragenter', 'dragover'].forEach(eventName => {
            singleDropZone.addEventListener(eventName, () => {
                singleDropZone.classList.add('drag-over');
                singleDropZone.closest('.compare-area').classList.add('drag-over');
            });
        });
    
        ['dragleave', 'drop'].forEach(eventName => {
            singleDropZone.addEventListener(eventName, () => {
                singleDropZone.classList.remove('drag-over');
                singleDropZone.closest('.compare-area').classList.remove('drag-over');
            });
        });
    
        singleDropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                console.log('Fichier déposé:', file.name);
                
                if (file.name.endsWith('.jil') || file.name.endsWith('.txt')) {
                    singleFileInput.files = files;
                    singleFileInput.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    alert('Veuillez sélectionner un fichier .jil ou .txt');
                }
            }
        });
    
        console.log('Nouveau système d\'upload configuré');
    }

    setupComparisonEvents() {
        console.log('Configuration des événements de comparaison');
        
        // Événements pour le toggle de mode
        const modeSingle = document.getElementById('modeSingle');
        const modeCompare = document.getElementById('modeCompare');
        
        console.log('Boutons de mode trouvés:', {
            modeSingle: !!modeSingle,
            modeCompare: !!modeCompare
        });

        if (modeSingle) {
            modeSingle.addEventListener('click', () => {
                console.log('Mode Simple cliqué');
                this.viewer.toggleMode('single');
            });
        }

        if (modeCompare) {
            modeCompare.addEventListener('click', () => {
                console.log('🔍 Mode Comparaison cliqué');
                this.viewer.toggleMode('compare');
            });
        }

        // Configuration des zones de drop pour la comparaison
        this.setupComparisonDropZones();
        
        console.log('Événements de comparaison configurés');
    }

    setupComparisonDropZones() {
        console.log('Configuration des zones de drop de comparaison');
        
        const dropLeft = document.getElementById('compareDropLeft');
        const dropRight = document.getElementById('compareDropRight');
        const fileInputLeft = document.querySelector('.compare-file-input[data-side="left"]');
        const fileInputRight = document.querySelector('.compare-file-input[data-side="right"]');
        const startCompare = document.getElementById('startCompare');

        console.log('Zones de drop trouvées:', {
            dropLeft: !!dropLeft,
            dropRight: !!dropRight,
            fileInputLeft: !!fileInputLeft,
            fileInputRight: !!fileInputRight,
            startCompare: !!startCompare
        });

        if (dropLeft && fileInputLeft) {
            this.setupComparisonDropZone(dropLeft, fileInputLeft, 'left');
        }

        if (dropRight && fileInputRight) {
            this.setupComparisonDropZone(dropRight, fileInputRight, 'right');
        }

        if (startCompare) {
            startCompare.addEventListener('click', () => {
                console.log('Lancement de la comparaison');
                this.viewer.startComparison();
            });
        }
    }

    setupComparisonDropZone(dropZone, fileInput, side) {
        // Clic pour sélectionner un fichier
        dropZone.addEventListener('click', () => {
            console.log(`Zone ${side} cliquée`);
            fileInput.click();
        });

        // Gestion de la sélection de fichier
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                console.log(`Fichier sélectionné pour ${side}:`, e.target.files[0].name);
                this.viewer.handleCompareFileSelect(side, e.target.files[0]);
            }
        });

        // Drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
                dropZone.closest('.compare-area').classList.add('drag-over');
                console.log(`Drag over zone ${side}`);
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
                dropZone.closest('.compare-area').classList.remove('drag-over');
                console.log(`Drag leave zone ${side}`);
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                console.log(`Fichier déposé dans zone ${side}:`, file.name);
                
                if (file.name.endsWith('.jil') || file.name.endsWith('.txt')) {
                    fileInput.files = files;
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    alert('Veuillez sélectionner un fichier .jil ou .txt');
                }
            }
        });
    }

    setupFilterEvents() {
        console.log('Configuration des événements de filtre');
        
        const searchFilter = document.getElementById('searchFilter');
        
        if (searchFilter) {
            searchFilter.addEventListener('input', () => {
                console.log('Filtre de recherche modifié:', searchFilter.value);
                this.viewer.applyFilters();
            });
        }
    }

    setupExportEvents() {
        console.log('Configuration des événements d\'export');
        
        const exportPNG = document.getElementById('exportPNG');
        const exportPDF = document.getElementById('exportPDF');
        const exportHTML = document.getElementById('exportHTML');

        console.log('Boutons d\'export trouvés:', {
            exportPNG: !!exportPNG,
            exportPDF: !!exportPDF,
            exportHTML: !!exportHTML
        });

        if (exportPNG) {
            exportPNG.addEventListener('click', () => {
                console.log('Export PNG demandé');
                this.viewer.exportToPNG();
            });
        }

        if (exportPDF) {
            exportPDF.addEventListener('click', () => {
                console.log('Export PDF demandé');
                this.viewer.exportToPDF();
            });
        }

        if (exportHTML) {
            exportHTML.addEventListener('click', () => {
                console.log('Export HTML demandé');
                this.viewer.exportToHTML();
            });
        }
    }

    setupActionEvents() {
        console.log('Configuration des événements d\'action');
        
        const expandAll = document.getElementById('expandAll');
        const collapseAll = document.getElementById('collapseAll');
        const resetView = document.getElementById('resetView');

        console.log('Boutons d\'action trouvés:', {
            expandAll: !!expandAll,
            collapseAll: !!collapseAll,
            resetView: !!resetView
        });

        if (expandAll) {
            expandAll.addEventListener('click', () => {
                console.log('Expand All demandé');
                this.viewer.expandAll();
            });
        }

        if (collapseAll) {
            collapseAll.addEventListener('click', () => {
                console.log('Collapse All demandé');
                this.viewer.collapseAll();
            });
        }

        if (resetView) {
            resetView.addEventListener('click', () => {
                console.log('Reset View demandé');
                this.viewer.resetView();
            });
        }
    }

    setupModalEvents() {
        console.log('🔧 Configuration des événements de modal');
        
        const aboutBtn = document.getElementById('aboutBtn');
        const aboutModal = document.getElementById('aboutModal');
        const closeAboutModal = document.getElementById('closeAboutModal');

        console.log('🔍 Éléments de modal trouvés:', {
            aboutBtn: !!aboutBtn,
            aboutModal: !!aboutModal,
            closeAboutModal: !!closeAboutModal
        });

        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => {
                console.log('Bouton À propos cliqué');
                this.viewer.showAboutModal();
            });
        }

        if (closeAboutModal) {
            closeAboutModal.addEventListener('click', () => {
                console.log('Fermeture modal À propos');
                this.viewer.hideAboutModal();
            });
        }

        // Fermer la modal en cliquant à l'extérieur
        if (aboutModal) {
            aboutModal.addEventListener('click', (e) => {
                if (e.target === aboutModal) {
                    console.log('Clic à l\'extérieur de la modal');
                    this.viewer.hideAboutModal();
                }
            });
        }
    }
}
