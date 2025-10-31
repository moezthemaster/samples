export class FilterManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.activeFilters = {
            jobTypes: new Set(),
            attributes: new Map(),
            textSearch: '',
            advanced: {
                hasDependencies: null,
                hasChildren: null,
                hasConditions: null
            }
        };
        
        this.filterHistory = [];
        this.maxHistorySize = 10;
    }

    /**
     * Applique tous les filtres actifs
     */
    applyAllFilters() {
        const startTime = performance.now();
        
        let filteredJobs = Array.from(this.viewer.boxes.values());
        
        // Appliquer les filtres dans l'ordre
        filteredJobs = this.applyTextFilter(filteredJobs);
        filteredJobs = this.applyJobTypeFilter(filteredJobs);
        filteredJobs = this.applyAttributeFilters(filteredJobs);
        filteredJobs = this.applyAdvancedFilters(filteredJobs);
        
        const filterTime = performance.now() - startTime;
        
        console.log(`Filtrage terminé: ${filteredJobs.length} jobs en ${filterTime.toFixed(2)}ms`);
        
        return {
            jobs: filteredJobs,
            filterTime,
            activeFilterCount: this.getActiveFilterCount()
        };
    }

    /**
     * Filtre par texte (recherche)
     */
    applyTextFilter(jobs) {
        const searchTerm = this.activeFilters.textSearch.toLowerCase().trim();
        
        if (!searchTerm) return jobs;
        
        return jobs.filter(job => {
            const searchableText = [
                job.name,
                job.description || '',
                job.type,
                ...Object.values(job.attributes).map(val => String(val)),
                ...job.dependsOn,
                ...job.requiredBy
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
    }

    /**
     * Filtre par type de job
     */
    applyJobTypeFilter(jobs) {
        if (this.activeFilters.jobTypes.size === 0) return jobs;
        
        return jobs.filter(job => this.activeFilters.jobTypes.has(job.type));
    }

    /**
     * Filtre par attributs
     */
    applyAttributeFilters(jobs) {
        if (this.activeFilters.attributes.size === 0) return jobs;
        
        return jobs.filter(job => {
            for (const [attribute, values] of this.activeFilters.attributes) {
                const jobValue = job.attributes[attribute];
                if (!jobValue) return false;
                
                const jobValueStr = String(jobValue).toLowerCase();
                const hasMatch = Array.from(values).some(value => 
                    jobValueStr.includes(value.toLowerCase())
                );
                
                if (!hasMatch) return false;
            }
            return true;
        });
    }

    /**
     * Filtres avancés (dépendances, enfants, conditions)
     */
    applyAdvancedFilters(jobs) {
        const { hasDependencies, hasChildren, hasConditions } = this.activeFilters.advanced;
        
        return jobs.filter(job => {
            // Filtre dépendances
            if (hasDependencies !== null) {
                const hasDeps = job.dependsOn.length > 0 || job.requiredBy.length > 0;
                if (hasDependencies !== hasDeps) return false;
            }
            
            // Filtre enfants
            if (hasChildren !== null) {
                const hasKids = job.children && job.children.length > 0;
                if (hasChildren !== hasKids) return false;
            }
            
            // Filtre conditions
            if (hasConditions !== null) {
                const hasCond = !!job.attributes.condition;
                if (hasConditions !== hasCond) return false;
            }
            
            return true;
        });
    }

    /**
     * Gestion des filtres par type
     */
    toggleJobTypeFilter(jobType) {
        if (this.activeFilters.jobTypes.has(jobType)) {
            this.activeFilters.jobTypes.delete(jobType);
        } else {
            this.activeFilters.jobTypes.add(jobType);
        }
        this.saveToHistory();
        return this.applyAllFilters();
    }

    /**
     * Gestion des filtres par attributs
     */
    setAttributeFilter(attribute, value) {
        if (!value || value.trim() === '') {
            this.activeFilters.attributes.delete(attribute);
        } else {
            this.activeFilters.attributes.set(attribute, new Set([value.trim()]));
        }
        this.saveToHistory();
        return this.applyAllFilters();
    }

    /**
     * Gestion des filtres avancés
     */
    setAdvancedFilter(filterName, value) {
        if (this.activeFilters.advanced.hasOwnProperty(filterName)) {
            this.activeFilters.advanced[filterName] = value;
            this.saveToHistory();
            return this.applyAllFilters();
        }
        return { jobs: Array.from(this.viewer.boxes.values()), filterTime: 0, activeFilterCount: 0 };
    }

    /**
     * Définit la recherche texte
     */
    setTextFilter(text) {
        this.activeFilters.textSearch = text;
        this.saveToHistory();
        return this.applyAllFilters();
    }

    /**
     * Réinitialise tous les filtres
     */
    resetAllFilters() {
        this.activeFilters = {
            jobTypes: new Set(),
            attributes: new Map(),
            textSearch: '',
            advanced: {
                hasDependencies: null,
                hasChildren: null,
                hasConditions: null
            }
        };
        this.saveToHistory();
        return this.applyAllFilters();
    }

    /**
     * Réinitialise un type de filtre spécifique
     */
    resetFilterType(type) {
        switch (type) {
            case 'jobTypes':
                this.activeFilters.jobTypes.clear();
                break;
            case 'attributes':
                this.activeFilters.attributes.clear();
                break;
            case 'text':
                this.activeFilters.textSearch = '';
                break;
            case 'advanced':
                this.activeFilters.advanced = {
                    hasDependencies: null,
                    hasChildren: null,
                    hasConditions: null
                };
                break;
        }
        this.saveToHistory();
        return this.applyAllFilters();
    }

    /**
     * Historique des filtres
     */
    saveToHistory() {
        const filterSnapshot = JSON.parse(JSON.stringify({
            jobTypes: Array.from(this.activeFilters.jobTypes),
            attributes: Array.from(this.activeFilters.attributes.entries()),
            textSearch: this.activeFilters.textSearch,
            advanced: this.activeFilters.advanced
        }));
        
        this.filterHistory.unshift(filterSnapshot);
        
        // Limiter la taille de l'historique
        if (this.filterHistory.length > this.maxHistorySize) {
            this.filterHistory.pop();
        }
    }

    /**
     * Restaure un filtre depuis l'historique
     */
    restoreFromHistory(index) {
        if (index >= 0 && index < this.filterHistory.length) {
            const snapshot = this.filterHistory[index];
            
            this.activeFilters.jobTypes = new Set(snapshot.jobTypes);
            this.activeFilters.attributes = new Map(snapshot.attributes);
            this.activeFilters.textSearch = snapshot.textSearch;
            this.activeFilters.advanced = snapshot.advanced;
            
            return this.applyAllFilters();
        }
        return { jobs: Array.from(this.viewer.boxes.values()), filterTime: 0, activeFilterCount: 0 };
    }

    /**
     * Compte le nombre de filtres actifs
     */
    getActiveFilterCount() {
        let count = 0;
        
        if (this.activeFilters.textSearch) count++;
        if (this.activeFilters.jobTypes.size > 0) count++;
        if (this.activeFilters.attributes.size > 0) count++;
        
        Object.values(this.activeFilters.advanced).forEach(value => {
            if (value !== null) count++;
        });
        
        return count;
    }

    /**
     * Obtient les statistiques des filtres
     */
    getFilterStats() {
        const totalJobs = this.viewer.boxes.size;
        const commonAttributes = this.getCommonAttributes();
        
        return {
            totalJobs,
            activeFilters: this.getActiveFilterCount(),
            jobTypeDistribution: this.getJobTypeDistribution(),
            commonAttributes,
            filterHistory: this.filterHistory.length
        };
    }

    /**
     * Distribution des types de jobs
     */
    getJobTypeDistribution() {
        const distribution = { BOX: 0, CMD: 0, FT: 0, UNKNOWN: 0 };
        
        for (const job of this.viewer.boxes.values()) {
            const type = job.type || 'UNKNOWN';
            if (distribution[type] !== undefined) {
                distribution[type]++;
            }
        }
        
        return distribution;
    }

    /**
     * Attributs les plus communs
     */
    getCommonAttributes() {
        const attributeCount = new Map();
        
        for (const job of this.viewer.boxes.values()) {
            Object.keys(job.attributes).forEach(attr => {
                attributeCount.set(attr, (attributeCount.get(attr) || 0) + 1);
            });
        }
        
        return Array.from(attributeCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); // Top 10
    }

    /**
     * Exporte la configuration des filtres
     */
    exportFilters() {
        return {
            activeFilters: this.activeFilters,
            stats: this.getFilterStats(),
            exportDate: new Date().toISOString()
        };
    }

    /**
     * Importe une configuration de filtres
     */
    importFilters(config) {
        if (config.activeFilters) {
            this.activeFilters.jobTypes = new Set(config.activeFilters.jobTypes || []);
            this.activeFilters.attributes = new Map(config.activeFilters.attributes || []);
            this.activeFilters.textSearch = config.activeFilters.textSearch || '';
            this.activeFilters.advanced = config.activeFilters.advanced || {
                hasDependencies: null,
                hasChildren: null,
                hasConditions: null
            };
            
            this.saveToHistory();
            return this.applyAllFilters();
        }
        return { jobs: Array.from(this.viewer.boxes.values()), filterTime: 0, activeFilterCount: 0 };
    }
}