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
        this.setupNewUploadSystem();
        this.setupAdvancedFilters(); // NOUVEAU
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
        console.log('Configuration des événements de filtre optimisés');
        
        const searchFilter = document.getElementById('searchFilter');
        
        if (searchFilter) {
            // Recherche optimisée
            searchFilter.addEventListener('input', async (e) => {
                const searchTerm = e.target.value;
                console.log('Recherche optimisée déclenchée:', searchTerm);
                
                try {
                    this.viewer.setTextFilter(searchTerm);
                } catch (error) {
                    console.error('Erreur lors de la recherche:', error);
                }
            });

            // Indicateur visuel pendant la recherche
            searchFilter.addEventListener('input', (e) => {
                const searchContainer = e.target.closest('.search-input');
                if (e.target.value.trim() !== '') {
                    searchContainer.classList.add('search-loading');
                    setTimeout(() => {
                        searchContainer.classList.remove('search-loading');
                    }, 300);
                } else {
                    searchContainer.classList.remove('search-loading');
                }
            });

            // Raccourci clavier Ctrl+F
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                    e.preventDefault();
                    searchFilter.focus();
                    searchFilter.select();
                }
            });

            // Échap pour effacer la recherche
            searchFilter.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = '';
                    this.viewer.setTextFilter('');
                }
            });
        }
    }

    /**
     * NOUVEAU : Configuration des filtres avancés
     */
    setupAdvancedFilters() {
        console.log('Configuration des filtres avancés');
        
        // Créer l'interface des filtres avancés
        this.createAdvancedFiltersUI();
        
        // Filtres rapides par type
        this.setupQuickTypeFilters();
        
        // Filtres avancés
        this.setupAdvancedFilterControls();
        
        // Bouton reset
        this.setupResetFilter();
    }

    /**
     * Crée l'interface des filtres avancés
     */
    createAdvancedFiltersUI() {
        const filtersSection = document.querySelector('.filters-section');
        if (!filtersSection) return;

        // Ajouter les filtres rapides
        const quickFiltersHTML = `
            <div class="filter-group">
                <label>Filtres rapides:</label>
                <div class="quick-filters">
                    <button class="filter-type-btn" data-job-type="BOX">
                        <i class="fas fa-cube"></i> BOX
                    </button>
                    <button class="filter-type-btn" data-job-type="CMD">
                        <i class="fas fa-terminal"></i> CMD
                    </button>
                    <button class="filter-type-btn" data-job-type="FT">
                        <i class="fas fa-exchange-alt"></i> FT
                    </button>
                </div>
            </div>
        `;

        // Ajouter les filtres avancés
        const advancedFiltersHTML = `
            <div class="filter-group advanced-filters">
                <label>
                    <i class="fas fa-sliders-h"></i> Filtres avancés
                    <span class="toggle-advanced">▼</span>
                </label>
                <div class="advanced-filters-content hidden">
                    <div class="advanced-filter">
                        <label>
                            <input type="checkbox" name="hasDependencies">
                            Avec dépendances
                        </label>
                    </div>
                    <div class="advanced-filter">
                        <label>
                            <input type="checkbox" name="hasChildren">
                            Avec enfants
                        </label>
                    </div>
                    <div class="advanced-filter">
                        <label>
                            <input type="checkbox" name="hasConditions">
                            Avec conditions
                        </label>
                    </div>
                    <div class="filter-actions">
                        <button class="btn-reset-filters">
                            <i class="fas fa-times"></i> Réinitialiser
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Insérer après la recherche
        const searchGroup = filtersSection.querySelector('.filter-group');
        if (searchGroup) {
            searchGroup.insertAdjacentHTML('afterend', quickFiltersHTML + advancedFiltersHTML);
        }
    }

    /**
     * Configure les filtres rapides par type
     */
    setupQuickTypeFilters() {
        const typeButtons = document.querySelectorAll('.filter-type-btn');
        
        typeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const jobType = btn.dataset.jobType;
                console.log(`Filtre type activé: ${jobType}`);
                this.viewer.toggleJobTypeFilter(jobType);
            });
        });
    }

    /**
     * Configure les contrôles des filtres avancés
     */
    setupAdvancedFilterControls() {
        // Toggle des filtres avancés
        const toggleBtn = document.querySelector('.toggle-advanced');
        const advancedContent = document.querySelector('.advanced-filters-content');
        
        if (toggleBtn && advancedContent) {
            toggleBtn.addEventListener('click', () => {
                advancedContent.classList.toggle('hidden');
                toggleBtn.textContent = advancedContent.classList.contains('hidden') ? '▼' : '▲';
            });
        }

        // Filtres avancés
        const advancedFilters = document.querySelectorAll('.advanced-filter input');
        advancedFilters.forEach(input => {
            input.addEventListener('change', (e) => {
                const filterName = e.target.name;
                const value = e.target.checked;
                console.log(`Filtre avancé ${filterName}: ${value}`);
                this.viewer.setAdvancedFilter(filterName, value);
            });
        });
    }

    /**
     * Configure le bouton reset
     */
    setupResetFilter() {
        const resetBtn = document.querySelector('.btn-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                console.log('Réinitialisation de tous les filtres');
                this.viewer.resetAllFilters();
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