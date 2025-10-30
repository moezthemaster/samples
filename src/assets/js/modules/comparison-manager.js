export class ComparisonManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.fileA = null;
        this.fileB = null;
        this.result = null;
        this.isComparing = false;
        this.currentFilter = 'all';
    }

    async loadFile(side, file) {
        try {
            console.log(`CHARGEMENT ${side}:`, file.name);
            
            const content = await this.readFile(file);
            console.log(`CONTENU ${side} (premières 200 chars):`, content.substring(0, 200));
            
            // Créer un NOUVEAU parser pour chaque fichier
            const jilParser = new this.viewer.jilParser.constructor();
            const parsingResult = jilParser.parseJILFile(content);
            
            console.log(`PARSING ${side} TERMINÉ:`, {
                jobs: Array.from(parsingResult.boxes.keys()),
                nbJobs: parsingResult.boxes.size,
                tousLesJobs: parsingResult.boxes
            });
            
            if (side === 'left') {
                this.fileA = {
                    file,
                    content,
                    boxes: parsingResult.boxes,
                    rootBoxes: parsingResult.rootBoxes,
                    name: file.name
                };
                console.log(`FICHIER A stocké: ${this.fileA.boxes.size} jobs`);
            } else {
                this.fileB = {
                    file,
                    content,
                    boxes: parsingResult.boxes,
                    rootBoxes: parsingResult.rootBoxes,
                    name: file.name
                };
                console.log(`FICHIER B stocké: ${this.fileB.boxes.size} jobs`);
            }
            
            this.updateFileInfo(side, file);
            this.checkReadyToCompare();
            
            return true;
        } catch (error) {
            console.error(`ERREUR chargement ${side}:`, error);
            alert(`Erreur lors du chargement du fichier ${side}: ${error.message}`);
            return false;
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    updateFileInfo(side, file) {
        const element = document.getElementById(`fileInfo${side === 'left' ? 'Left' : 'Right'}`);
        if (element) {
            element.textContent = `${file.name} • ${(file.size / 1024).toFixed(2)} KB`;
            element.style.color = 'var(--accent-color)';
        }
    }

    checkReadyToCompare() {
        const compareBtn = document.getElementById('startCompare');
        if (this.fileA && this.fileB && compareBtn) {
            compareBtn.classList.remove('hidden');
            console.log('PRÊT À COMPARER:', {
                fichierA: this.fileA.boxes.size + ' jobs',
                fichierB: this.fileB.boxes.size + ' jobs'
            });
        }
    }

    async compare() {
        if (!this.fileA || !this.fileB) {
            alert('Veuillez charger les deux fichiers à comparer');
            return;
        }

        console.log('DÉBUT COMPARAISON...');
        console.log('FICHIERS:', {
            A: this.fileA.name + ' (' + this.fileA.boxes.size + ' jobs)',
            B: this.fileB.name + ' (' + this.fileB.boxes.size + ' jobs)'
        });

        this.isComparing = true;
        this.viewer.showLoading();

        try {
            this.result = this.findDifferences(this.fileA.boxes, this.fileB.boxes);
            console.log('COMPARAISON TERMINÉE:', this.result);
            
            this.updateComparisonStatus();
            this.applyFilter('all'); // Afficher tous les jobs par défaut
            
        } catch (error) {
            console.error('ERREUR lors de la comparaison:', error);
            alert('Erreur lors de la comparaison: ' + error.message);
        } finally {
            this.viewer.hideLoading();
            this.isComparing = false;
        }
    }

    findDifferences(boxesA, boxesB) {
        console.log('COMPARAISON: Début findDifferences');
        console.log('STATS:', {
            boxesA: boxesA.size,
            boxesB: boxesB.size,
            jobsA: Array.from(boxesA.keys()),
            jobsB: Array.from(boxesB.keys())
        });

        const allJobNames = new Set([
            ...Array.from(boxesA.keys()),
            ...Array.from(boxesB.keys())
        ]);

        console.log('TOUS LES JOBS UNIQUES:', Array.from(allJobNames));

        const result = {
            newJobs: [],      // Dans A mais pas dans B
            deletedJobs: [],  // Dans B mais pas dans A
            modifiedJobs: [], // Dans les deux mais differents
            identicalJobs: [], // Identiques
            jobDetails: new Map()
        };

        allJobNames.forEach(jobName => {
            const jobA = boxesA.get(jobName);
            const jobB = boxesB.get(jobName);

            console.log(`ANALYSE "${jobName}":`, {
                dansA: !!jobA,
                dansB: !!jobB,
                jobA: jobA ? {type: jobA.type, command: jobA.attributes.command} : null,
                jobB: jobB ? {type: jobB.type, command: jobB.attributes.command} : null
            });

            if (jobA && !jobB) {
                result.newJobs.push(jobName);
                result.jobDetails.set(jobName, { type: 'new', jobA, jobB: null });
                console.log(`"${jobName}" - NOUVEAU dans A`);
            } else if (!jobA && jobB) {
                result.deletedJobs.push(jobName);
                result.jobDetails.set(jobName, { type: 'deleted', jobA: null, jobB });
                console.log(`"${jobName}" - SUPPRIMÉ (dans B seulement)`);
            } else if (jobA && jobB) {
                const differences = this.compareJobDetails(jobA, jobB);
                console.log(`"${jobName}" - ${differences.length} DIFFÉRENCES:`, differences);
                
                if (differences.length > 0) {
                    result.modifiedJobs.push(jobName);
                    result.jobDetails.set(jobName, { 
                        type: 'modified', 
                        jobA, 
                        jobB, 
                        differences 
                    });
                    console.log(`"${jobName}" - MODIFIÉ`);
                } else {
                    result.identicalJobs.push(jobName);
                    result.jobDetails.set(jobName, { 
                        type: 'identical', 
                        jobA, 
                        jobB 
                    });
                    console.log(`"${jobName}" - IDENTIQUE`);
                }
            }
        });

        console.log('RÉSULTAT FINAL COMPARAISON:', {
            nouveaux: result.newJobs,
            supprimés: result.deletedJobs,
            modifiés: result.modifiedJobs,
            identiques: result.identicalJobs
        });

        return result;
    }

    compareJobDetails(jobA, jobB) {
        console.log(`COMPARISON DÉTAILLÉE:`, {
            jobA: jobA.name,
            jobB: jobB.name
        });

        const differences = [];
        const importantAttributes = ['command', 'machine', 'owner', 'condition', 'description'];

        // Comparer les attributs principaux
        importantAttributes.forEach(attr => {
            const valueA = jobA.attributes[attr] || '';
            const valueB = jobB.attributes[attr] || '';
            
            console.log(`COMPARE ${attr}:`, {
                A: valueA,
                B: valueB,
                equal: valueA === valueB
            });
            
            if (valueA !== valueB) {
                differences.push({
                    attribute: attr,
                    valueA,
                    valueB
                });
                console.log(`DIFFÉRENCE ${attr}: "${valueA}" vs "${valueB}"`);
            }
        });

        // Comparer les dépendances
        const dependsOnA = jobA.dependsOn.join(', ');
        const dependsOnB = jobB.dependsOn.join(', ');
        
        console.log(`COMPARE dependsOn:`, {
            A: dependsOnA,
            B: dependsOnB,
            equal: dependsOnA === dependsOnB
        });
        
        if (dependsOnA !== dependsOnB) {
            differences.push({
                attribute: 'dependsOn',
                valueA: dependsOnA,
                valueB: dependsOnB
            });
            console.log(`DIFFÉRENCE dependsOn: "${dependsOnA}" vs "${dependsOnB}"`);
        }

        console.log(`TOTAL DIFFÉRENCES: ${differences.length}`);
        return differences;
    }

    updateComparisonStatus() {
        const statusElement = document.getElementById('compareStatus');
        if (statusElement && this.result) {
            statusElement.classList.remove('hidden');
            statusElement.innerHTML = `
                <span class="compare-badge new filter-badge" data-filter="new">
                    <i class="fas fa-plus-circle"></i> +${this.result.newJobs.length} nouveaux
                </span>
                <span class="compare-badge modified filter-badge" data-filter="modified">
                    <i class="fas fa-pencil-alt"></i> ${this.result.modifiedJobs.length} modifiés
                </span>
                <span class="compare-badge deleted filter-badge" data-filter="deleted">
                    <i class="fas fa-minus-circle"></i> -${this.result.deletedJobs.length} supprimés
                </span>
                <span class="compare-badge identical filter-badge" data-filter="identical">
                    <i class="fas fa-check-circle"></i> ${this.result.identicalJobs.length} identiques
                </span>
                <span class="compare-badge all filter-badge active" data-filter="all">
                    <i class="fas fa-layer-group"></i> Tous
                </span>
            `;

            // Ajouter les événements de clic
            this.setupFilterBadges();
        }
    }

    setupFilterBadges() {
        const filterBadges = document.querySelectorAll('.filter-badge');
        filterBadges.forEach(badge => {
            badge.addEventListener('click', () => {
                const filterType = badge.getAttribute('data-filter');
                console.log(`Filtre appliqué: ${filterType}`);
                
                // Retirer la classe active de tous les badges
                filterBadges.forEach(b => b.classList.remove('active'));
                // Activer le badge cliqué
                badge.classList.add('active');
                
                // Appliquer le filtre
                this.applyFilter(filterType);
            });
        });
    }

    applyFilter(filterType) {
        console.log(`Application du filtre: ${filterType}`);
        this.currentFilter = filterType;
        
        if (this.viewer.comparisonRenderer) {
            this.viewer.comparisonRenderer.renderComparisonTree(filterType);
            this.updateFilterCounter(filterType);
        }
    }

    updateFilterCounter(filterType) {
        const counter = document.getElementById('jobCounter');
        if (!this.result) {
            counter.textContent = '0 jobs';
            return;
        }

        const { newJobs, deletedJobs, modifiedJobs, identicalJobs } = this.result;
        
        let totalJobs, displayText;
        
        switch (filterType) {
            case 'new':
                totalJobs = newJobs.length;
                displayText = `${totalJobs} nouveau${totalJobs > 1 ? 'x' : ''}`;
                break;
            case 'modified':
                totalJobs = modifiedJobs.length;
                displayText = `${totalJobs} modifié${totalJobs > 1 ? 's' : ''}`;
                break;
            case 'deleted':
                totalJobs = deletedJobs.length;
                displayText = `${totalJobs} supprimé${totalJobs > 1 ? 's' : ''}`;
                break;
            case 'identical':
                totalJobs = identicalJobs.length;
                displayText = `${totalJobs} identique${totalJobs > 1 ? 's' : ''}`;
                break;
            case 'all':
            default:
                totalJobs = newJobs.length + deletedJobs.length + modifiedJobs.length + identicalJobs.length;
                displayText = `${totalJobs} job${totalJobs > 1 ? 's' : ''} comparé${totalJobs > 1 ? 's' : ''}`;
        }
        
        counter.textContent = displayText;
    }

    resetComparison() {
        this.fileA = null;
        this.fileB = null;
        this.result = null;
        this.isComparing = false;
        this.currentFilter = 'all';
        
        // Réinitialiser l'interface
        const startCompare = document.getElementById('startCompare');
        const compareStatus = document.getElementById('compareStatus');
        const fileInfoLeft = document.getElementById('fileInfoLeft');
        const fileInfoRight = document.getElementById('fileInfoRight');
        
        if (startCompare) startCompare.classList.add('hidden');
        if (compareStatus) compareStatus.classList.add('hidden');
        if (fileInfoLeft) fileInfoLeft.textContent = 'Aucun fichier';
        if (fileInfoRight) fileInfoRight.textContent = 'Aucun fichier';
    }

    getJobComparisonInfo(jobName) {
        if (!this.result || !this.result.jobDetails.has(jobName)) {
            return null;
        }
        return this.result.jobDetails.get(jobName);
    }

    // Méthode utilitaire pour obtenir les jobs selon le filtre actuel
    getFilteredJobs() {
        if (!this.result) return [];
        
        switch (this.currentFilter) {
            case 'new':
                return this.result.newJobs;
            case 'modified':
                return this.result.modifiedJobs;
            case 'deleted':
                return this.result.deletedJobs;
            case 'identical':
                return this.result.identicalJobs;
            case 'all':
            default:
                return [
                    ...this.result.newJobs,
                    ...this.result.modifiedJobs,
                    ...this.result.deletedJobs,
                    ...this.result.identicalJobs
                ];
        }
    }
}
