export class SearchEngine {
    constructor(viewer) {
        this.viewer = viewer;
        this.searchIndex = new Map();
        this.attributeKeysIndex = new Set();
        this.cache = new Map();
        this.debounceTimeout = null;
        this.isIndexing = false;
        this.currentSearchTerm = '';
        this.searchHistory = [];
        this.suggestions = new Set();
        
        this.config = {
            debounceDelay: 300,
            cacheSize: 100,
            maxResults: 10000,
            highlightMatches: true,
            maxHistory: 20,
            maxSuggestions: 10,
            enableFuzzySearch: false,
            fuzzyThreshold: 0.7
        };
    }

    buildSearchIndex() {
        console.time('BuildSearchIndex');
        this.isIndexing = true;
        this.searchIndex.clear();
        this.attributeKeysIndex.clear();
        this.suggestions.clear();
        
        for (const [jobName, job] of this.viewer.boxes) {
            const indexEntry = {
                job,
                searchableText: this.extractSearchableText(job),
                keywords: this.extractKeywords(job),
                attributes: this.extractAttributesForSearch(job)
            };
            
            this.searchIndex.set(jobName, indexEntry);
            
            Object.keys(job.attributes).forEach(key => {
                this.attributeKeysIndex.add(key.toLowerCase());
            });
            
            this.addToSuggestions(job.name);
            if (job.description) {
                this.addToSuggestions(job.description);
            }
        }
        
        this.isIndexing = false;
        console.timeEnd('BuildSearchIndex');
        console.log(`Index construit: ${this.searchIndex.size} jobs, ${this.attributeKeysIndex.size} clés d'attributs`);
    }

    extractAttributesForSearch(job) {
        const attributes = {};
        Object.entries(job.attributes).forEach(([key, value]) => {
            const normalizedKey = key.toLowerCase();
            const stringValue = String(value).toLowerCase();
            attributes[normalizedKey] = stringValue;
        });
        return attributes;
    }

    performSearch(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return {
                exactMatches: [],
                partialMatches: [],
                fuzzyMatches: [],
                allMatches: [],
                searchTime: 0,
                searchType: 'none'
            };
        }

        const startTime = performance.now();
        const term = searchTerm.trim();
        
        if (term.includes('=') || term.includes(':')) {
            return this.performAttributeSearch(term, startTime);
        }
        
        if (this.attributeKeysIndex.has(term.toLowerCase())) {
            return this.performAttributeKeySearch(term, startTime);
        }
        
        return this.performTextSearch(term, startTime);
    }

    performAttributeSearch(searchTerm, startTime) {
        const normalizedTerm = searchTerm.replace(':', '=');
        const [key, value] = normalizedTerm.split('=').map(part => part.trim());
        
        if (!key || !value) {
            return this.performTextSearch(searchTerm, startTime);
        }
        
        const normalizedKey = key.toLowerCase();
        
        let actualValue = value;
        let isWildcard = false;
        
        if (value.startsWith('*') && value.endsWith('*')) {
            actualValue = value.slice(1, -1).toLowerCase();
            isWildcard = true;
        } else if (value.startsWith('*')) {
            actualValue = value.slice(1).toLowerCase();
            isWildcard = 'end';
        } else if (value.endsWith('*')) {
            actualValue = value.slice(0, -1).toLowerCase();
            isWildcard = 'start';
        } else {
            actualValue = value.toLowerCase();
        }
        
        const matches = [];
        
        for (const [jobName, indexEntry] of this.searchIndex) {
            if (!indexEntry.attributes.hasOwnProperty(normalizedKey)) {
                continue;
            }
            
            const jobValue = indexEntry.attributes[normalizedKey];
            
            let isMatch = false;
            
            if (isWildcard === true) {
                // recherche  *value*
                isMatch = jobValue.includes(actualValue);
            } else if (isWildcard === 'start') {
                // recherche suffixe *value
                isMatch = jobValue.endsWith(actualValue);
            } else if (isWildcard === 'end') {
                // recherche préfixe value*
                isMatch = jobValue.startsWith(actualValue);
            } else {
                // recherche exacte
                isMatch = jobValue === actualValue;
            }
            
            if (isMatch) {
                matches.push(indexEntry.job);
            }
        }
        
        const searchTime = performance.now() - startTime;
        console.log(`Recherche attribut "${searchTerm}": ${matches.length} résultats en ${searchTime.toFixed(2)}ms`);

        return {
            exactMatches: matches,
            partialMatches: [],
            fuzzyMatches: [],
            allMatches: matches,
            searchTime: searchTime,
            searchType: 'attribute'
        };
    }

    performAttributeKeySearch(searchTerm, startTime) {
        const normalizedKey = searchTerm.toLowerCase();
        const matches = [];
        
        for (const [jobName, indexEntry] of this.searchIndex) {
            if (indexEntry.attributes.hasOwnProperty(normalizedKey)) {
                matches.push(indexEntry.job);
            }
        }
        
        const searchTime = performance.now() - startTime;
        console.log(`Recherche clé "${searchTerm}": ${matches.length} résultats en ${searchTime.toFixed(2)}ms`);

        return {
            exactMatches: matches,
            partialMatches: [],
            fuzzyMatches: [],
            allMatches: matches,
            searchTime: searchTime,
            searchType: 'attribute_key'
        };
    }

    performTextSearch(searchTerm, startTime) {
        const term = searchTerm.toLowerCase();
        const matches = [];

        let isWildcard = false;
        let actualValue = term;
        
        if (term.startsWith('*') && term.endsWith('*')) {
            actualValue = term.slice(1, -1);
            isWildcard = true;
        } else if (term.startsWith('*')) {
            actualValue = term.slice(1);
            isWildcard = 'end';
        } else if (term.endsWith('*')) {
            actualValue = term.slice(0, -1);
            isWildcard = 'start';
        }

        for (const [jobName, indexEntry] of this.searchIndex) {
            const searchText = indexEntry.searchableText;
            let isMatch = false;
            
            if (isWildcard === true) {

                isMatch = searchText.includes(actualValue);
            } else if (isWildcard === 'start') {
                isMatch = searchText.endsWith(actualValue);
            } else if (isWildcard === 'end') {
                isMatch = searchText.startsWith(actualValue);
            } else {
                isMatch = searchText.includes(term);
            }
            
            if (isMatch) {
                matches.push(indexEntry.job);
            }
        }
        
        const searchTime = performance.now() - startTime;
        const searchType = isWildcard ? 'wildcard' : 'text';
        console.log(`Recherche ${searchType} "${searchTerm}": ${matches.length} résultats en ${searchTime.toFixed(2)}ms`);

        return {
            exactMatches: matches,
            partialMatches: [],
            fuzzyMatches: [],
            allMatches: matches,
            searchTime: searchTime,
            searchType: searchType
        };
    }

    generateHighlightData(job, searchTerm) {
        if (!searchTerm || !this.config.highlightMatches) {
            return null;
        }

        const term = searchTerm.trim();
        
        if (term.includes('=') || term.includes(':')) {
            const normalizedTerm = term.replace(':', '=');
            const [key, value] = normalizedTerm.split('=').map(part => part.trim());
            
            if (!key || !value) {
                return this.generateTextHighlight(job, searchTerm, true); // true = forcer surlignage nom
            }
            
            const normalizedKey = key.toLowerCase();
            
            let actualValue = value;
            let isWildcard = false;
            
            if (value.startsWith('*') && value.endsWith('*')) {
                actualValue = value.slice(1, -1);
                isWildcard = true;
            } else if (value.startsWith('*')) {
                actualValue = value.slice(1);
                isWildcard = 'end';
            } else if (value.endsWith('*')) {
                actualValue = value.slice(0, -1);
                isWildcard = 'start';
            }
            
            const highlights = {
                name: job.name,
                description: job.description,
                attributes: {}
            };
            
            const attributeValue = job.attributes[normalizedKey];
            const hasMatchingAttribute = attributeValue && this.checkAttributeMatch(String(attributeValue), actualValue, isWildcard);
            
            if (hasMatchingAttribute) {
                highlights.name = `<mark class="search-highlight">${job.name}</mark>`;
                highlights.attributes[normalizedKey] = this.highlightText(String(attributeValue), actualValue);
            }
            
            return highlights;
        }
        
        if (this.attributeKeysIndex.has(term.toLowerCase())) {
            const highlights = {
                name: job.name,
                description: job.description,
                attributes: {}
            };
            
            const hasAttributeKey = Object.keys(job.attributes).some(key => 
                key.toLowerCase() === term.toLowerCase()
            );
            
            if (hasAttributeKey) {
                highlights.name = this.highlightText(job.name, term);
                
                Object.entries(job.attributes).forEach(([key, value]) => {
                    if (key.toLowerCase() === term.toLowerCase()) {
                        highlights.attributes[key] = this.highlightText(String(value), '');
                    }
                });
            }
            
            return highlights;
        }
        
        return this.generateTextHighlight(job, searchTerm, true);
    }

    checkAttributeMatch(attributeValue, searchValue, isWildcard) {
        const attrValueLower = attributeValue.toLowerCase();
        const searchLower = searchValue.toLowerCase();
        
        if (isWildcard === true) {
            return attrValueLower.includes(searchLower);
        } else if (isWildcard === 'start') {
            return attrValueLower.endsWith(searchLower);
        } else if (isWildcard === 'end') {
            return attrValueLower.startsWith(searchLower);
        } else {
            return attrValueLower === searchLower;
        }
    }

    generateTextHighlight(job, searchTerm) {
        const term = searchTerm.toLowerCase();

        let isWildcard = false;
        let actualValue = term;

        if (term.startsWith('*') && term.endsWith('*')) {
            actualValue = term.slice(1, -1);
            isWildcard = true;
        } else if (term.startsWith('*')) {
            actualValue = term.slice(1);
            isWildcard = 'end';
        } else if (term.endsWith('*')) {
            actualValue = term.slice(0, -1);
            isWildcard = 'start';
        }

        const highlights = {
            name: job.name,
            description: job.description,
            attributes: {}
        };

        const shouldHighlight = (text) => {
            if (!text) return false;
            const textLower = text.toLowerCase();

            if (isWildcard === true) {
                return textLower.includes(actualValue);
            } else if (isWildcard === 'start') {
                return textLower.endsWith(actualValue);
            } else if (isWildcard === 'end') {
                return textLower.startsWith(actualValue);
            } else {
                return textLower.includes(term);
            }
        };

        const hasAnyMatch = 
            shouldHighlight(job.name) ||
            (job.description && shouldHighlight(job.description)) ||
            Object.values(job.attributes).some(value => shouldHighlight(String(value)));

        if (hasAnyMatch) {
            highlights.name = `<mark class="search-highlight">${job.name}</mark>`;
        }

        if (job.description && shouldHighlight(job.description)) {
            const highlightTerm = isWildcard ? actualValue : searchTerm;
            highlights.description = this.highlightText(job.description, highlightTerm);
        }

        Object.entries(job.attributes).forEach(([key, value]) => {
            const stringValue = String(value);
            if (shouldHighlight(stringValue)) {
                const highlightTerm = isWildcard ? actualValue : searchTerm;
                highlights.attributes[key] = this.highlightText(stringValue, highlightTerm);
            }
        });

        return highlights;
    }

    highlightText(text, searchTerm) {
        if (!text || !searchTerm || searchTerm.trim() === '') {
            return text;
        }

        try {
            const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedTerm})`, 'gi');
            return text.replace(regex, '<mark class="search-highlight">$1</mark>');
        } catch (error) {
            console.warn('Erreur surlignage:', error);
            return text;
        }
    }

    extractSearchableText(job) {
        const attributeText = Object.entries(job.attributes)
            .map(([key, value]) => {
                const stringValue = String(value).trim();
                return `${key} ${stringValue} ${key}:${stringValue}`;
            })
            .join(' ');

        const texts = [
            job.name,
            job.description || '',
            job.type,
            attributeText,
            ...job.dependsOn,
            ...job.requiredBy,
            job.parent || ''
        ];
        
        return texts
            .filter(text => text && text.trim() !== '')
            .join(' ')
            .toLowerCase()
            .trim();
    }

    extractKeywords(job) {
        const text = this.extractSearchableText(job);
        const words = text.split(/\s+/).filter(word => word.length > 2);
        return [...new Set(words)];
    }

    addToSuggestions(term) {
        if (!term || term.length < 3) return;
        
        const words = term.split(/\s+/);
        words.forEach(word => {
            if (word.length >= 3) {
                this.suggestions.add(word.toLowerCase());
            }
        });
    }

    getSearchHistory(maxItems = this.config.maxHistory) {
        return this.searchHistory.slice(0, maxItems);
    }

    clearSearchHistory() {
        this.searchHistory = [];
    }

    reset() {
        this.searchIndex.clear();
        this.attributeKeysIndex.clear();
        this.cache.clear();
        this.suggestions.clear();
        this.searchHistory = [];
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }
    }
}