export class SearchEngine {
    constructor(viewer) {
        this.viewer = viewer;
        this.searchIndex = new Map();
        this.cache = new Map();
        this.debounceTimeout = null;
        this.isIndexing = false;
        this.currentSearchTerm = '';
        this.searchHistory = [];
        this.suggestions = new Set();
        
        // Configuration
        this.config = {
            debounceDelay: 300,
            cacheSize: 100,
            maxResults: 10000,
            highlightMatches: true,
            maxHistory: 20,
            maxSuggestions: 10,
            enableFuzzySearch: true,
            fuzzyThreshold: 0.7
        };
    }

    /**
     * Indexation précalculée de tous les jobs
     */
    buildSearchIndex() {
        console.time('BuildSearchIndex');
        this.isIndexing = true;
        this.searchIndex.clear();
        this.suggestions.clear();
        
        for (const [jobName, job] of this.viewer.boxes) {
            const indexEntry = {
                job,
                searchableText: this.extractSearchableText(job),
                keywords: this.extractKeywords(job)
            };
            
            this.searchIndex.set(jobName, indexEntry);
            
            // Ajouter aux suggestions
            this.addToSuggestions(job.name);
            if (job.description) {
                this.addToSuggestions(job.description);
            }
        }
        
        this.isIndexing = false;
        console.timeEnd('BuildSearchIndex');
        console.log(`Index construit: ${this.searchIndex.size} jobs indexés, ${this.suggestions.size} suggestions`);
    }

    /**
     * Extrait tout le texte recherchable d'un job
     */
/**
 * Extrait tout le texte recherchable d'un job - VERSION COMPLÈTE
 */
extractSearchableText(job) {
    // Inclure TOUS les attributs systématiquement avec leur clé et valeur
    const attributeText = Object.entries(job.attributes)
        .map(([key, value]) => {
            // Convertir en string et nettoyer
            const stringValue = String(value).trim();
            // Retourner à la fois "clé:valeur" et "valeur" pour les recherches partielles
            return `${key} ${stringValue} ${key}:${stringValue}`;
        })
        .join(' ');

    const texts = [
        job.name,
        job.description || '',
        job.type,
        attributeText, // ← TOUS les attributs inclus ici
        ...job.dependsOn,
        ...job.requiredBy,
        job.parent || '' // Ajouter aussi le parent si disponible
    ];
    
    // Filtrer les valeurs vides et joindre
    return texts
        .filter(text => text && text.trim() !== '')
        .join(' ')
        .toLowerCase()
        .trim();
}

    /**
     * Extrait les mots-clés pour une recherche plus rapide
     */
    extractKeywords(job) {
        const text = this.extractSearchableText(job);
        const words = text.split(/\s+/).filter(word => word.length > 2);
        return [...new Set(words)]; // Déduplication
    }

    /**
     * Ajoute un terme aux suggestions
     */
    addToSuggestions(term) {
        if (!term || term.length < 3) return;
        
        const words = term.split(/\s+/);
        words.forEach(word => {
            if (word.length >= 3) {
                this.suggestions.add(word.toLowerCase());
            }
        });
    }

    /**
     * Recherche avec surlignage avancé
     */
    async searchWithHighlight(searchTerm) {
        this.currentSearchTerm = searchTerm;
        
        if (this.isIndexing) {
            await this.waitForIndexing();
        }

        // Ajouter à l'historique
        if (searchTerm.trim() && !this.searchHistory.includes(searchTerm)) {
            this.searchHistory.unshift(searchTerm);
            if (this.searchHistory.length > this.config.maxHistory) {
                this.searchHistory.pop();
            }
        }

        // Gestion du debounce
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        return new Promise((resolve) => {
            this.debounceTimeout = setTimeout(async () => {
                const results = await this.executeSearch(searchTerm);
                resolve(results);
            }, this.config.debounceDelay);
        });
    }

    /**
     * Exécute la recherche réelle avec cache
     */
    async executeSearch(searchTerm) {
        const cacheKey = searchTerm.toLowerCase().trim();
        
        // Vérifier le cache
        if (this.cache.has(cacheKey)) {
            console.log('Résultat servi depuis le cache');
            return this.cache.get(cacheKey);
        }

        const results = this.performSearch(searchTerm);
        
        // Mettre en cache (avec limite de taille)
        if (this.cache.size >= this.config.cacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(cacheKey, results);

        return results;
    }

    /**
     * Algorithme de recherche optimisé avec recherche floue
     */
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
        const term = searchTerm.toLowerCase().trim();
        const exactMatches = [];
        const partialMatches = [];
        const fuzzyMatches = [];

        // Détecter le type de recherche
        const searchType = this.detectSearchType(searchTerm);

        for (const [jobName, indexEntry] of this.searchIndex) {
            const searchText = indexEntry.searchableText;
            
            // Recherche exacte
            if (searchText.includes(term)) {
                exactMatches.push(indexEntry.job);
                continue;
            }

            // Recherche partielle par mots-clés
            const hasPartialMatch = indexEntry.keywords.some(keyword => 
                keyword.includes(term) || term.includes(keyword)
            );

            if (hasPartialMatch) {
                partialMatches.push(indexEntry.job);
                continue;
            }

            // Recherche floue (optionnelle)
            if (this.config.enableFuzzySearch && term.length > 2) {
                const fuzzyScore = this.calculateFuzzyScore(jobName, term);
                if (fuzzyScore >= this.config.fuzzyThreshold) {
                    fuzzyMatches.push({
                        job: indexEntry.job,
                        score: fuzzyScore
                    });
                }
            }
        }

        // Trier les résultats flous par score
        fuzzyMatches.sort((a, b) => b.score - a.score);
        const sortedFuzzyMatches = fuzzyMatches.map(item => item.job);

        const searchTime = performance.now() - startTime;
        const allMatches = [...exactMatches, ...partialMatches, ...sortedFuzzyMatches];
        
        console.log(`Recherche "${term}" (${searchType}): ${exactMatches.length} exacts, ${partialMatches.length} partiels, ${fuzzyMatches.length} flous en ${searchTime.toFixed(2)}ms`);

        return {
            exactMatches,
            partialMatches,
            fuzzyMatches: sortedFuzzyMatches,
            allMatches,
            searchTime,
            searchType
        };
    }

    /**
     * Détecte le type de recherche (simple, avancée, par attribut)
     */
    detectSearchType(searchTerm) {
        const term = searchTerm.toLowerCase();
        
        // Recherche par attribut (ex: "machine:server1")
        if (term.includes(':')) {
            return 'attribute';
        }
        
        // Recherche avec opérateurs (AND, OR, NOT)
        if (term.includes(' and ') || term.includes(' or ') || term.includes(' not ')) {
            return 'advanced';
        }
        
        // Recherche par wildcard
        if (term.includes('*') || term.includes('?')) {
            return 'wildcard';
        }
        
        return 'simple';
    }

    /**
     * Calcule un score de similarité floue
     */
    calculateFuzzyScore(text, searchTerm) {
        const str = text.toLowerCase();
        const term = searchTerm.toLowerCase();
        
        if (str === term) return 1.0;
        if (str.includes(term)) return 0.9;
        
        // Algorithme de similarité simple (Jaro-Winkler simplifié)
        let matches = 0;
        let transpositions = 0;
        const maxDistance = Math.max(str.length, term.length) / 2 - 1;
        
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const start = Math.max(0, i - maxDistance);
            const end = Math.min(i + maxDistance + 1, term.length);
            
            for (let j = start; j < end; j++) {
                if (term[j] === char) {
                    matches++;
                    if (i !== j) transpositions++;
                    break;
                }
            }
        }
        
        if (matches === 0) return 0.0;
        
        transpositions = transpositions / 2;
        const similarity = (matches / str.length + matches / term.length + (matches - transpositions) / matches) / 3;
        
        return Math.min(similarity, 1.0);
    }

    /**
     * Obtient les suggestions de recherche
     */
    getSuggestions(searchTerm, maxResults = this.config.maxSuggestions) {
        if (!searchTerm || searchTerm.length < 2) {
            return Array.from(this.suggestions).slice(0, maxResults);
        }
        
        const term = searchTerm.toLowerCase();
        const matchedSuggestions = [];
        
        // Suggestions exactes
        for (const suggestion of this.suggestions) {
            if (suggestion.includes(term)) {
                matchedSuggestions.push(suggestion);
                if (matchedSuggestions.length >= maxResults) break;
            }
        }
        
        // Suggestions floues si pas assez de résultats
        if (matchedSuggestions.length < maxResults && this.config.enableFuzzySearch) {
            const fuzzySuggestions = [];
            
            for (const suggestion of this.suggestions) {
                if (matchedSuggestions.includes(suggestion)) continue;
                
                const score = this.calculateFuzzyScore(suggestion, term);
                if (score >= this.config.fuzzyThreshold * 0.8) {
                    fuzzySuggestions.push({ suggestion, score });
                }
            }
            
            fuzzySuggestions.sort((a, b) => b.score - a.score);
            fuzzySuggestions.slice(0, maxResults - matchedSuggestions.length)
                .forEach(item => matchedSuggestions.push(item.suggestion));
        }
        
        return matchedSuggestions.slice(0, maxResults);
    }

    /**
     * Obtient l'historique de recherche
     */
    getSearchHistory(maxItems = this.config.maxHistory) {
        return this.searchHistory.slice(0, maxItems);
    }

    /**
     * Efface l'historique de recherche
     */
    clearSearchHistory() {
        this.searchHistory = [];
    }

    /**
     * Génère les données de surlignage pour l'affichage
     */
    generateHighlightData(job, searchTerm) {
        if (!searchTerm || !this.config.highlightMatches) {
            return null;
        }

        const term = searchTerm.toLowerCase();
        const highlights = {
            name: this.highlightText(job.name, term),
            description: job.description ? this.highlightText(job.description, term) : null,
            attributes: {}
        };

        // Surligner les attributs correspondants
        Object.entries(job.attributes).forEach(([key, value]) => {
            const stringValue = String(value).toLowerCase();
            if (stringValue.includes(term)) {
                highlights.attributes[key] = this.highlightText(String(value), term);
            }
        });

        return highlights;
    }

    /**
     * Applique le surlignage à un texte
     */
    highlightText(text, searchTerm) {
        if (!text || !searchTerm) return text;

        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    /**
     * Échappe les caractères spéciaux pour les regex
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Obtient les statistiques détaillées par type
     */
    getResultsByType(results) {
        const byType = {
            BOX: { count: 0, jobs: [] },
            CMD: { count: 0, jobs: [] },
            FT: { count: 0, jobs: [] },
            UNKNOWN: { count: 0, jobs: [] }
        };

        results.allMatches.forEach(job => {
            const type = job.type || 'UNKNOWN';
            if (byType[type]) {
                byType[type].count++;
                byType[type].jobs.push(job);
            }
        });

        return byType;
    }

    /**
     * Attend que l'indexation soit terminée
     */
    async waitForIndexing() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!this.isIndexing) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
        });
    }

    /**
     * Réinitialise l'index (après chargement nouveau fichier)
     */
    reset() {
        this.searchIndex.clear();
        this.cache.clear();
        this.suggestions.clear();
        this.searchHistory = [];
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }
    }

    /**
     * Statistiques de performance
     */
    getStats() {
        return {
            indexedJobs: this.searchIndex.size,
            cacheSize: this.cache.size,
            cacheHitRate: this.calculateCacheHitRate(),
            suggestionsCount: this.suggestions.size,
            searchHistoryCount: this.searchHistory.length,
            isIndexing: this.isIndexing
        };
    }

    calculateCacheHitRate() {
        // À implémenter avec des métriques réelles
        return 0;
    }
}