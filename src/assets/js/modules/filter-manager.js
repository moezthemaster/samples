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

    applyAllFilters() {
        const startTime = performance.now();
        
        let filteredJobs = Array.from(this.viewer.boxes.values());
        
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

    applyTextFilter(jobs) {
        const searchTerm = this.activeFilters.textSearch.trim();
        
        if (!searchTerm) return jobs;
        
        const searchResults = this.viewer.searchEngine.performSearch(searchTerm);
        const matchingJobNames = new Set(searchResults.allMatches.map(job => job.name));
        
        return jobs.filter(job => matchingJobNames.has(job.name));
    }

    applyJobTypeFilter(jobs) {
        if (this.activeFilters.jobTypes.size === 0) return jobs;
        
        return jobs.filter(job => this.activeFilters.jobTypes.has(job.type));
    }

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

    applyAdvancedFilters(jobs) {
        const { hasDependencies, hasChildren, hasConditions } = this.activeFilters.advanced;
        
        return jobs.filter(job => {
            if (hasDependencies !== null) {
                const hasDeps = job.dependsOn.length > 0 || job.requiredBy.length > 0;
                if (hasDependencies !== hasDeps) return false;
            }
            
            if (hasChildren !== null) {
                const hasKids = job.children && job.children.length > 0;
                if (hasChildren !== hasKids) return false;
            }
            
            if (hasConditions !== null) {
                const hasCond = !!job.attributes.condition;
                if (hasConditions !== hasCond) return false;
            }
            
            return true;
        });
    }

    toggleJobTypeFilter(jobType) {
        if (this.activeFilters.jobTypes.has(jobType)) {
            this.activeFilters.jobTypes.delete(jobType);
        } else {
            this.activeFilters.jobTypes.add(jobType);
        }
        this.saveToHistory();
        return this.applyAllFilters();
    }

    setAttributeFilter(attribute, value) {
        if (!value || value.trim() === '') {
            this.activeFilters.attributes.delete(attribute);
        } else {
            this.activeFilters.attributes.set(attribute, new Set([value.trim()]));
        }
        this.saveToHistory();
        return this.applyAllFilters();
    }

    setAdvancedFilter(filterName, value) {
        if (this.activeFilters.advanced.hasOwnProperty(filterName)) {
            this.activeFilters.advanced[filterName] = value;
            this.saveToHistory();
            return this.applyAllFilters();
        }
        return { jobs: Array.from(this.viewer.boxes.values()), filterTime: 0, activeFilterCount: 0 };
    }

    setTextFilter(text) {
        this.activeFilters.textSearch = text;
        this.saveToHistory();
        return this.applyAllFilters();
    }

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

    saveToHistory() {
        const filterSnapshot = JSON.parse(JSON.stringify({
            jobTypes: Array.from(this.activeFilters.jobTypes),
            attributes: Array.from(this.activeFilters.attributes.entries()),
            textSearch: this.activeFilters.textSearch,
            advanced: this.activeFilters.advanced
        }));
        
        this.filterHistory.unshift(filterSnapshot);
        
        if (this.filterHistory.length > this.maxHistorySize) {
            this.filterHistory.pop();
        }
    }

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

    getCommonAttributes() {
        const attributeCount = new Map();
        
        for (const job of this.viewer.boxes.values()) {
            Object.keys(job.attributes).forEach(attr => {
                attributeCount.set(attr, (attributeCount.get(attr) || 0) + 1);
            });
        }
        
        return Array.from(attributeCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }

    exportFilters() {
        return {
            activeFilters: this.activeFilters,
            stats: this.getFilterStats(),
            exportDate: new Date().toISOString()
        };
    }

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