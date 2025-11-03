import '../css/main.css';
import '../fonts/all.min.css';

import { JILParser } from './modules/jil-parser.js';
import { TreeRenderer } from './modules/tree-renderer.js';
import { ExportManager } from './modules/export-manager.js';
import { EventManager } from './modules/event-manager.js';
import { ComparisonManager } from './modules/comparison-manager.js';
import { ComparisonRenderer } from './modules/comparison-renderer.js';
import { SearchEngine } from './modules/search-engine.js';
import { FilterManager } from './modules/filter-manager.js';

class AutosysViewer {
    constructor() {
        console.log('AUTOSYSVIEWER: Constructeur appelé');
        
        try {
            this.boxes = new Map();
            this.rootBoxes = [];
            this.filteredBoxes = new Map();
            this.selectedJob = null;
            this.currentFileContent = null;
            this.currentMode = 'single';
            
            console.log('init modules');
            this.jilParser = new JILParser();
            this.treeRenderer = new TreeRenderer(this);
            this.exportManager = new ExportManager(this);
            this.eventManager = new EventManager(this);
            this.comparisonManager = new ComparisonManager(this);
            this.comparisonRenderer = new ComparisonRenderer(this);
            
            this.searchEngine = new SearchEngine(this);
            this.filterManager = new FilterManager(this);
            
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
        const fileInfo = document.getElementById('fileStatus');
        
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
            
            console.log('Construction de l\'index de recherche...');
            this.searchEngine.buildSearchIndex();
            
            this.filterManager.resetAllFilters();
            
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

    async applyFilters() {
        if (this.currentMode === 'compare' && this.comparisonManager.result) {
            this.comparisonRenderer.renderComparisonTree();
            this.updateComparisonCounter();
        } else {
            const filterResults = this.filterManager.applyAllFilters();
            this.applyFilterResults(filterResults);
        }
    }

    applyFilterResults(filterResults) {
        this.filteredBoxes.clear();
        
        const { jobs: filteredJobs, filterTime, activeFilterCount } = filterResults;
        
        if (activeFilterCount === 0) {
            this.filteredBoxes = new Map(this.boxes);
            const filteredRootBoxes = [...this.rootBoxes];
            this.treeRenderer.renderTree(filteredRootBoxes);
            this.treeRenderer.collapseAll();
        } else {
            const boxesToExpand = new Set();
            
            const searchTerm = this.filterManager.activeFilters.textSearch;
            const jobsWithHighlights = filteredJobs.map(job => ({
                ...job,
                highlights: this.searchEngine.generateHighlightData(job, searchTerm)
            }));
            
            const filteredRootBoxes = this.buildFilteredTree(filteredJobs, boxesToExpand);
            this.treeRenderer.renderTree(filteredRootBoxes, jobsWithHighlights);
            
            if (searchTerm) {
                setTimeout(() => {
                    this.treeRenderer.expandMatchingBoxes(boxesToExpand);
                }, 100);
            }
        }
        
        this.updateJobCounter();
        this.displayAdvancedFilterStats(filterResults);
    }

    buildFilteredTree(matchingJobs, boxesToExpand) {
        const jobSet = new Set(matchingJobs.map(job => job.name));
        const filteredRootBoxes = [];

        const filterRecursive = (box) => {
            const shouldKeep = jobSet.has(box.name);
            
            let filteredChildren = [];
            if (box.children && box.children.length > 0) {
                box.children.forEach(child => {
                    const filteredChild = filterRecursive(child);
                    if (filteredChild) {
                        filteredChildren.push(filteredChild);
                        
                        if (jobSet.has(child.name)) {
                            boxesToExpand.add(box.name);
                        }
                    }
                });
            }

            const hasMatchingChild = filteredChildren.length > 0;
            
            if (shouldKeep || hasMatchingChild) {
                const filteredBox = {
                    ...box,
                    children: filteredChildren
                };
                this.filteredBoxes.set(box.name, filteredBox);
                
                if (hasMatchingChild && !shouldKeep) {
                    boxesToExpand.add(box.name);
                }
                
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

        return filteredRootBoxes;
    }

    displayAdvancedFilterStats(filterResults) {
        const searchStats = document.getElementById('searchStats') || this.createSearchStatsElement();
        const { activeFilterCount, filterTime } = filterResults;
        const filterStats = this.filterManager.getFilterStats();
        
        if (activeFilterCount === 0) {
            searchStats.style.display = 'none';
            return;
        }

        let statsHTML = `
            <div class="search-stats-main">
                <strong>${filterResults.jobs.length}</strong> résultat${filterResults.jobs.length !== 1 ? 's' : ''} 
                <span class="search-time">• ${filterTime.toFixed(0)}ms</span>
                <span class="active-filters-count">• ${activeFilterCount} filtre${activeFilterCount !== 1 ? 's' : ''}</span>
            </div>
        `;

        const activeFilters = this.getActiveFiltersDisplay();
        if (activeFilters) {
            statsHTML += `<div class="active-filters">${activeFilters}</div>`;
        }

        const typeDistribution = filterStats.jobTypeDistribution;
        statsHTML += `<div class="search-stats-breakdown">`;
        
        if (typeDistribution.BOX > 0) {
            statsHTML += `<span class="stat-type-box">${typeDistribution.BOX} BOX</span>`;
        }
        if (typeDistribution.CMD > 0) {
            statsHTML += `<span class="stat-type-cmd">${typeDistribution.CMD} CMD</span>`;
        }
        if (typeDistribution.FT > 0) {
            statsHTML += `<span class="stat-type-ft">${typeDistribution.FT} FT</span>`;
        }
        if (typeDistribution.UNKNOWN > 0) {
            statsHTML += `<span class="stat-type-unknown">${typeDistribution.UNKNOWN} Autres</span>`;
        }
        
        statsHTML += `</div>`;

        const searchTerm = this.filterManager.activeFilters.textSearch;
        if (searchTerm && (searchTerm.includes('=') || searchTerm.includes(':'))) {
            statsHTML += `<div class="search-syntax-help" title="Syntaxe: owner=toto, owner=*admin*">
                <i class="fas fa-info-circle"></i> Recherche avancée active
            </div>`;
        }

        searchStats.innerHTML = statsHTML;
        searchStats.style.display = 'block';
    }

    getActiveFiltersDisplay() {
        const { activeFilters } = this.filterManager;
        const activeFiltersList = [];
        
        if (activeFilters.textSearch) {
            activeFiltersList.push(`<span class="active-filter-text">"${activeFilters.textSearch}"</span>`);
        }
        
        if (activeFilters.jobTypes.size > 0) {
            const types = Array.from(activeFilters.jobTypes).map(type => 
                `<span class="active-filter-type active-filter-${type.toLowerCase()}">${type}</span>`
            ).join('');
            activeFiltersList.push(types);
        }
        
        if (activeFilters.attributes.size > 0) {
            activeFilters.attributes.forEach((values, attr) => {
                values.forEach(value => {
                    activeFiltersList.push(
                        `<span class="active-filter-attr">${attr}: ${value}</span>`
                    );
                });
            });
        }
        
        Object.entries(activeFilters.advanced).forEach(([key, value]) => {
            if (value !== null) {
                const label = this.getAdvancedFilterLabel(key, value);
                activeFiltersList.push(`<span class="active-filter-advanced">${label}</span>`);
            }
        });
        
        return activeFiltersList.length > 0 ? activeFiltersList.join('') : null;
    }

    getAdvancedFilterLabel(filterKey, value) {
        const labels = {
            hasDependencies: { true: 'Avec dépendances', false: 'Sans dépendances' },
            hasChildren: { true: 'Avec enfants', false: 'Sans enfants' },
            hasConditions: { true: 'Avec conditions', false: 'Sans conditions' }
        };
        
        return labels[filterKey] ? labels[filterKey][value] : `${filterKey}: ${value}`;
    }

    createSearchStatsElement() {
        const statsEl = document.createElement('div');
        statsEl.id = 'searchStats';
        statsEl.className = 'search-stats';
        
        const searchContainer = document.querySelector('.filter-group');
        if (searchContainer) {
            searchContainer.appendChild(statsEl);
        }
        
        return statsEl;
    }

    toggleJobTypeFilter(jobType) {
        const filterResults = this.filterManager.toggleJobTypeFilter(jobType);
        this.applyFilterResults(filterResults);
        this.updateFilterUI();
    }

    setTextFilter(text) {
        const filterResults = this.filterManager.setTextFilter(text);
        this.applyFilterResults(filterResults);
        this.updateFilterUI();
    }

    setAdvancedFilter(filterName, value) {
        const filterResults = this.filterManager.setAdvancedFilter(filterName, value);
        this.applyFilterResults(filterResults);
        this.updateFilterUI();
    }

    resetAllFilters() {
        const filterResults = this.filterManager.resetAllFilters();
        this.applyFilterResults(filterResults);
        this.updateFilterUI();
        
        const searchFilter = document.getElementById('searchFilter');
        if (searchFilter) {
            searchFilter.value = '';
        }
    }

    updateFilterUI() {
        const typeButtons = document.querySelectorAll('.filter-type-btn');
        typeButtons.forEach(btn => {
            const jobType = btn.dataset.jobType;
            if (this.filterManager.activeFilters.jobTypes.has(jobType)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        const advancedFilters = document.querySelectorAll('.advanced-filter input');
        advancedFilters.forEach(input => {
            const filterName = input.name;
            const currentValue = this.filterManager.activeFilters.advanced[filterName];
            
            if (input.type === 'checkbox') {
                input.checked = currentValue === true;
            }
        });
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
        const searchTerm = document.getElementById('searchFilter').value.toLowerCase().trim();
        
        // Détection du type de recherche
        const isAttributeSearch = searchTerm.includes('=') || searchTerm.includes(':');
        let searchKey = null;
        let searchValue = null;
        
        if (isAttributeSearch) {
            const normalizedTerm = searchTerm.replace(':', '=');
            [searchKey, searchValue] = normalizedTerm.split('=').map(part => part.trim());
        }
        
        const highlightIfNeeded = (text, context = 'general') => {
            if (!text || !searchTerm) return text;
            
            if (isAttributeSearch && searchKey && context !== 'attribute-' + searchKey.toLowerCase()) {
                return text;
            }
            
            try {
                let actualSearchTerm = searchTerm;
                
                if (isAttributeSearch && searchValue) {
                    actualSearchTerm = searchValue;
                }
                
                let isWildcard = false;
                let actualValue = actualSearchTerm;
                
                if (actualSearchTerm.startsWith('*') && actualSearchTerm.endsWith('*')) {
                    actualValue = actualSearchTerm.slice(1, -1);
                    isWildcard = true;
                } else if (actualSearchTerm.startsWith('*')) {
                    actualValue = actualSearchTerm.slice(1);
                    isWildcard = 'end';
                } else if (actualSearchTerm.endsWith('*')) {
                    actualValue = actualSearchTerm.slice(0, -1);
                    isWildcard = 'start';
                }
                
                const escapedTerm = actualValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                if (isWildcard === true) {
                    const regex = new RegExp(`(${escapedTerm})`, 'gi');
                    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
                } else if (isWildcard === 'start') {
                    const regex = new RegExp(`(${escapedTerm})(?=[^]*$)`, 'gi');
                    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
                } else if (isWildcard === 'end') {
                    const regex = new RegExp(`(^[^]*?)(${escapedTerm})`, 'gi');
                    return text.replace(regex, '$1<mark class="search-highlight">$2</mark>');
                } else {
                    const regex = new RegExp(`(${escapedTerm})`, 'gi');
                    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
                }
            } catch (error) {
                return text;
            }
        };

        const mainSections = [
            {
                title: 'Informations générales',
                icon: 'fa-id-card',
                items: [
                    { 
                        label: 'Nom', 
                        value: job.name,
                        context: 'general'
                    },
                    { 
                        label: 'Type', 
                        value: job.type,
                        context: 'general'
                    },
                    { 
                        label: 'Description', 
                        value: job.description || 'Non spécifiée',
                        context: 'general'
                    },
                    { 
                        label: 'Parent', 
                        value: job.parent || 'Aucun (Box racine)',
                        context: 'general'
                    },
                    job.children && job.children.length > 0 ? 
                        { 
                            label: 'Enfants', 
                            value: `${job.children.length} job(s)`,
                            context: 'general'
                        } : null
                ].filter(Boolean)
            },
            job.attributes.command ? {
                title: 'Commande',
                icon: 'fa-terminal',
                items: [
                    { 
                        label: 'Commande', 
                        value: job.attributes.command,
                        context: 'attribute-command'
                    }
                ]
            } : null,
            job.attributes.machine ? {
                title: 'Machine',
                icon: 'fa-server',
                items: [
                    { 
                        label: 'Machine', 
                        value: job.attributes.machine,
                        context: 'attribute-machine'
                    }
                ]
            } : null,
            job.attributes.owner ? {
                title: 'Propriétaire',
                icon: 'fa-user',
                items: [
                    { 
                        label: 'Owner', 
                        value: job.attributes.owner,
                        context: 'attribute-owner'
                    }
                ]
            } : null
        ].filter(Boolean);

        const dependenciesSection = (job.dependsOn.length > 0 || job.requiredBy.length > 0 || job.attributes.condition) ? {
            title: 'Dépendances et Conditions',
            icon: 'fa-link',
            items: [
                job.attributes.condition ? { 
                    label: 'Condition', 
                    value: job.attributes.condition,
                    context: 'attribute-condition'
                } : null,
                job.dependsOn.length > 0 ? { 
                    label: 'Dépend de', 
                    value: job.dependsOn.join(', '),
                    context: 'general'
                } : null,
                job.requiredBy.length > 0 ? { 
                    label: 'Requis par', 
                    value: job.requiredBy.join(', '),
                    context: 'general'
                } : null
            ].filter(Boolean)
        } : null;

        const schedulingAttributes = ['run_calendar', 'start_times', 'date_conditions', 'exclude_calendar'];
        const schedulingItems = schedulingAttributes
            .filter(attr => job.attributes[attr])
            .map(attr => ({ 
                label: this.formatAttributeLabel(attr), 
                value: job.attributes[attr],
                context: 'attribute-' + attr
            }));
        
        const schedulingSection = schedulingItems.length > 0 ? {
            title: 'Planification',
            icon: 'fa-calendar-alt',
            items: schedulingItems
        } : null;

        const commonAttributes = [
            'command', 'machine', 'owner', 'condition', 'date_conditions', 
            'start_times', 'run_calendar', 'exclude_calendar', 'description'
        ];
        
        const otherAttributes = Object.entries(job.attributes)
            .filter(([key]) => !commonAttributes.includes(key))
            .map(([key, value]) => ({
                label: this.formatAttributeLabel(key),
                value: String(value),
                context: 'attribute-' + key
            }));

        const otherAttributesSection = otherAttributes.length > 0 ? {
            title: 'Tous les attributs',
            icon: 'fa-cogs',
            items: otherAttributes
        } : null;

        let html = '';

        // recherche par attribut
        if (isAttributeSearch && searchKey) {
            const attributeValue = job.attributes[searchKey.toLowerCase()];
            if (attributeValue) {
                html += this.generateHighlightedAttributeSection(searchKey, attributeValue, searchValue);
            }
        }

        // surlignage contextuel
        mainSections.forEach(section => {
            html += this.generateDetailSection(section, highlightIfNeeded);
        });

        if (dependenciesSection) {
            html += this.generateDetailSection(dependenciesSection, highlightIfNeeded);
        }

        if (schedulingSection) {
            html += this.generateDetailSection(schedulingSection, highlightIfNeeded);
        }

        if (otherAttributesSection) {
            html += this.generateDetailSection(otherAttributesSection, highlightIfNeeded);
        }

        return html;
    }

    generateHighlightedAttributeSection(attributeKey, attributeValue, searchValue) {
        const formattedKey = this.formatAttributeLabel(attributeKey);
        const highlightedValue = this.highlightSpecificText(String(attributeValue), searchValue);
        
        return `
            <div class="detail-section search-match-section">
                <h4><i class="fas fa-search"></i> Attribut correspondant à la recherche</h4>
                <div class="detail-item highlighted-search-match">
                    <span class="detail-label">${formattedKey}:</span>
                    <span class="detail-value">${highlightedValue}</span>
                </div>
            </div>
        `;
    }

    highlightSpecificText(text, searchTerm) {
        if (!text || !searchTerm) return text;
        
        try {
            const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedTerm})`, 'gi');
            return text.replace(regex, '<mark class="search-highlight">$1</mark>');
        } catch (error) {
            return text;
        }
    }

    generateDetailSection(section, highlightIfNeeded) {
        return `
            <div class="detail-section">
                <h4><i class="fas ${section.icon}"></i> ${section.title}</h4>
                ${section.items.map(item => `
                    <div class="detail-item">
                        <span class="detail-label">${item.label}:</span>
                        <span class="detail-value">${highlightIfNeeded(item.value, item.context)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    formatAttributeLabel(attribute) {
        return attribute
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    formatCondition(condition) {
        if (!condition) return '';
        
        let formatted = condition.replace(/(v\([^)]+\))/g, '<span class="global-variable" title="Variable globale">$1</span>');
        formatted = formatted.replace(/(&|\|)/g, '<span class="logic-operator"> $1 </span>');
        
        return formatted;
    }

    resetView() {
        this.resetAllFilters();
        
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

console.log('État du DOM:', {
    readyState: document.readyState,
    autosysViewer: window.autosysViewer
});

if (document.readyState === 'loading') {
    console.log('DOM encore en chargement - on attend DOMContentLoaded');
} else {
    console.log('DOM déjà chargé - initialisation');
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
