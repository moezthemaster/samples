class AutosysViewer {
    constructor() {
        this.boxes = new Map();
        this.rootBoxes = [];
        this.filteredBoxes = new Map();
        this.selectedJob = null;
        this.currentFileContent = null;
        this.jobOrder = [];
        this.dependencies = new Map();
        this.executionOrder = [];
        this.animationManager = new AnimationManager(this);
        
        console.log('=== AUTOSYS VIEWER INIT ===');
        this.initializeEventListeners();
        this.setupDragAndDrop();
    }

    initializeEventListeners() {
        document.getElementById('browseBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        document.getElementById('searchFilter').addEventListener('input', (e) => {
            this.applyFilters();
        });

        document.getElementById('expandAll').addEventListener('click', () => {
            this.expandAll();
        });

        document.getElementById('collapseAll').addEventListener('click', () => {
            this.collapseAll();
        });

        document.getElementById('resetView').addEventListener('click', () => {
            this.resetView();
        });

        document.getElementById('exportPNG').addEventListener('click', () => {
            this.exportToPNG();
        });

        document.getElementById('exportPDF').addEventListener('click', () => {
            this.exportToPDF();
        });

        document.getElementById('exportHTML').addEventListener('click', () => {
            this.exportToHTML();
        });

        document.getElementById('aboutBtn').addEventListener('click', () => {
            this.showAboutModal();
        });
        
        document.getElementById('closeAboutModal').addEventListener('click', () => {
            this.hideAboutModal();
        });
        
        document.getElementById('aboutModal').addEventListener('click', (e) => {
            if (e.target.id === 'aboutModal') {
                this.hideAboutModal();
            }
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect({ target: { files: files } });
            }
        });
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

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('Fichier sélectionné:', file.name);
        this.showLoading();

        try {
            const content = await this.readFile(file);
            this.currentFileContent = content;
            
            const fileInfoElement = document.getElementById('fileInfo');
            fileInfoElement.textContent = `${file.name} • ${(file.size / 1024).toFixed(2)} KB`;
            fileInfoElement.style.color = 'var(--accent-color)';
            fileInfoElement.style.fontWeight = '600';
            
            this.parseJILFile(content);
            this.applyFilters();
            
        } catch (error) {
            console.error('Erreur lors du chargement du fichier:', error);
            alert('Erreur lors du chargement du fichier: ' + error.message);
        } finally {
            this.hideLoading();
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

    parseJILFile(content) {
        console.log('=== DÉBUT PARSING JIL AVEC ORDRE PAR DÉPENDANCES ===');
        this.boxes.clear();
        this.rootBoxes = [];
        this.jobOrder = [];
        this.dependencies.clear();
        this.executionOrder = [];

        const lines = content.split('\n');
        let currentJob = null;
        let jobCount = 0;
        let inCommentBlock = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line.startsWith('/*')) {
                inCommentBlock = true;
                if (line.includes('*/')) {
                    inCommentBlock = false;
                }
                continue;
            }
            
            if (inCommentBlock) {
                if (line.includes('*/')) {
                    inCommentBlock = false;
                }
                continue;
            }

            if (line.startsWith('/*') && line.includes('---') && line.endsWith('*/')) {
                continue;
            }

            if (line === '') {
                if (currentJob) {
                    this.finalizeJob(currentJob);
                    jobCount++;
                    currentJob = null;
                }
                continue;
            }

            if (line.startsWith('//')) {
                continue;
            }

            const commentIndex = line.indexOf('//');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex).trim();
            }

            if (line.startsWith('insert_job:')) {
                if (currentJob) {
                    this.finalizeJob(currentJob);
                    jobCount++;
                }

                const afterInsertJob = line.substring(11);
                let jobName = afterInsertJob;
                let remainingLine = '';
                
                const nextAttributeIndex = afterInsertJob.search(/\s+(job_type|box_name|command|machine|owner|description|alarm_if_fail|alarm_if_terminated|group|application|condition):/i);
                
                if (nextAttributeIndex !== -1) {
                    jobName = afterInsertJob.substring(0, nextAttributeIndex).trim();
                    remainingLine = afterInsertJob.substring(nextAttributeIndex).trim();
                } else {
                    jobName = afterInsertJob.trim();
                }

                currentJob = {
                    name: jobName,
                    type: 'UNKNOWN',
                    children: [],
                    parent: null,
                    attributes: {},
                    description: '',
                    originalIndex: jobCount,
                    depth: 0,
                    dependsOn: [],
                    requiredBy: []
                };

                if (remainingLine) {
                    this.processAttributesFromLine(currentJob, remainingLine);
                }
            }
            else if (currentJob && line.includes(':')) {
                this.processAttributesFromLine(currentJob, line);
            }
        }

        if (currentJob) {
            this.finalizeJob(currentJob);
            jobCount++;
        }

        console.log(`✅ Parsing terminé: ${jobCount} jobs`);
        this.buildDependencyGraph();
        this.buildHierarchyWithExecutionOrder();
    }

    processAttributesFromLine(job, line) {
        const attributes = line.split(/\s+(?=\w+:)/);
        
        attributes.forEach(attr => {
            if (attr.includes(':')) {
                const colonIndex = attr.indexOf(':');
                const key = attr.substring(0, colonIndex).trim();
                let value = attr.substring(colonIndex + 1).trim();
                
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1);
                }

                this.processJobAttribute(job, key, value);
            }
        });
    }

    processJobAttribute(job, key, value) {
        const keyLower = key.toLowerCase();
        
        switch (keyLower) {
            case 'job_type':
                job.type = value.toUpperCase();
                break;
            case 'box_name':
                job.parent = value;
                break;
            case 'description':
                job.description = value;
                job.attributes[key] = value;
                break;
            case 'condition':
                job.attributes[key] = value;
                this.extractDependencies(job, value);
                break;
            default:
                if (key && value) {
                    job.attributes[key] = value;
                }
        }
    }

    extractDependencies(job, condition) {
        console.log(`🔍 Analyse des dépendances pour ${job.name}: ${condition}`);
        
        const dependencyPatterns = [
            /success\(([^)]+)\)/g,
            /failure\(([^)]+)\)/g,
            /done\(([^)]+)\)/g,
            /notrun\(([^)]+)\)/g,
            /terminated\(([^)]+)\)/g
        ];
        
        dependencyPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(condition)) !== null) {
                const dependentJobName = match[1];
                if (dependentJobName && !job.dependsOn.includes(dependentJobName)) {
                    job.dependsOn.push(dependentJobName);
                    console.log(`   📌 ${job.name} dépend de ${dependentJobName}`);
                    
                    if (!this.dependencies.has(job.name)) {
                        this.dependencies.set(job.name, []);
                    }
                    this.dependencies.get(job.name).push(dependentJobName);
                }
            }
        });
    }

    finalizeJob(job) {
        this.boxes.set(job.name, job);
        this.jobOrder.push(job.name);
    }

    buildDependencyGraph() {
        console.log('=== CONSTRUCTION DU GRAPHE DE DÉPENDANCES ===');
        
        for (const [jobName, job] of this.boxes) {
            job.dependsOn.forEach(depName => {
                if (this.boxes.has(depName)) {
                    const dependentJob = this.boxes.get(depName);
                    if (!dependentJob.requiredBy.includes(jobName)) {
                        dependentJob.requiredBy.push(jobName);
                    }
                }
            });
        }

        this.calculateExecutionOrder();
    }

    calculateExecutionOrder() {
        console.log('🔀 Calcul de l\'ordre d\'exécution par tri topologique');
        
        const visited = new Set();
        const temp = new Set();
        const order = [];

        const visit = (jobName) => {
            if (temp.has(jobName)) {
                console.log(`⚠️  Cycle détecté avec ${jobName}`);
                return;
            }
            
            if (!visited.has(jobName)) {
                temp.add(jobName);
                
                const job = this.boxes.get(jobName);
                if (job) {
                    job.dependsOn.forEach(depName => {
                        if (this.boxes.has(depName)) {
                            visit(depName);
                        }
                    });
                    
                    temp.delete(jobName);
                    visited.add(jobName);
                    order.push(jobName);
                }
            }
        };

        for (const [jobName, job] of this.boxes) {
            if (job.dependsOn.length === 0) {
                visit(jobName);
            }
        }

        for (const [jobName, job] of this.boxes) {
            visit(jobName);
        }

        this.executionOrder = order;
        console.log('📋 Ordre d\'exécution calculé:', this.executionOrder);
    }

    buildHierarchyWithExecutionOrder() {
        console.log('=== CONSTRUCTION HIÉRARCHIE AVEC ORDRE D\'EXÉCUTION ===');
        
        for (const job of this.boxes.values()) {
            job.children = [];
        }

        for (const [jobName, job] of this.boxes) {
            if (job.parent && this.boxes.has(job.parent)) {
                const parentBox = this.boxes.get(job.parent);
                parentBox.children.push(job);
            }
        }

        this.rootBoxes = [];
        for (const [jobName, job] of this.boxes) {
            if (!job.parent || !this.boxes.has(job.parent)) {
                this.rootBoxes.push(job);
            }
        }

        this.calculateDepthLevels();
        this.sortHierarchyByExecutionOrder();

        console.log(`✅ Hiérarchie construite: ${this.rootBoxes.length} racines`);
    }

    calculateDepthLevels() {
        const calculateDepth = (job, depth) => {
            job.depth = depth;
            if (job.children && job.children.length > 0) {
                job.children.forEach(child => calculateDepth(child, depth + 1));
            }
        };

        this.rootBoxes.forEach(root => calculateDepth(root, 0));
    }

    sortHierarchyByExecutionOrder() {
        console.log('🔀 Tri hiérarchique par ordre d\'exécution');
        
        const executionIndex = new Map();
        this.executionOrder.forEach((jobName, index) => {
            executionIndex.set(jobName, index);
        });

        const compareByExecutionOrder = (a, b) => {
            const indexA = executionIndex.get(a.name) ?? a.originalIndex;
            const indexB = executionIndex.get(b.name) ?? b.originalIndex;
            return indexA - indexB;
        };

        this.rootBoxes.sort(compareByExecutionOrder);
        
        const trierEnfantsParOrdreExecution = (job) => {
            if (job.children && job.children.length > 0) {
                job.children.sort(compareByExecutionOrder);
                job.children.forEach(trierEnfantsParOrdreExecution);
            }
        };
        
        this.rootBoxes.forEach(trierEnfantsParOrdreExecution);
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

        this.renderTree(filteredRootBoxes);
        this.updateJobCounter();
        
        if (searchTerm) {
            setTimeout(() => this.expandMatchingBoxes(boxesToExpand), 100);
        } else {
            setTimeout(() => this.collapseAll(), 100);
        }
    }

    expandMatchingBoxes(boxesToExpand) {
        boxesToExpand.forEach(boxName => {
            const boxElement = this.findTreeNodeByName(boxName);
            if (boxElement) {
                boxElement.classList.add('expanded');
                boxElement.classList.remove('collapsed');
                this.expandAllParents(boxElement);
            }
        });
    }

    findTreeNodeByName(boxName) {
        const allNodes = document.querySelectorAll('.tree-node');
        for (let node of allNodes) {
            const header = node.querySelector('.tree-node-header');
            if (header && header.textContent.includes(boxName)) {
                return node;
            }
        }
        return null;
    }

    expandAllParents(node) {
        let parent = node.parentElement;
        while (parent) {
            if (parent.classList.contains('tree-node')) {
                parent.classList.add('expanded');
                parent.classList.remove('collapsed');
            }
            parent = parent.parentElement;
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

    renderTree(rootBoxes = this.rootBoxes) {
        const container = document.getElementById('treeContainer');
        container.innerHTML = '';

        if (rootBoxes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Aucun job trouvé</h3>
                    <p>Ajustez vos filtres pour afficher les jobs</p>
                </div>
            `;
            return;
        }

        rootBoxes.forEach(box => {
            const node = this.createTreeNode(box);
            container.appendChild(node);
        });
    }

    createTreeNode(box) {
        const node = document.createElement('div');
        node.classList.add('tree-node', 'job-type-' + box.type);
        node.draggable = true;

        const header = document.createElement('div');
        header.className = 'tree-node-header';
        
        const searchTerm = document.getElementById('searchFilter').value.toLowerCase();
        const isSearchMatch = box.name.toLowerCase().includes(searchTerm) || 
                             (box.description && box.description.toLowerCase().includes(searchTerm));
        
        if (isSearchMatch && searchTerm) {
            header.classList.add('search-match');
        }
        
        header.innerHTML = `
            <i class="${this.getIconForType(box.type)}"></i>
            <span class="job-name">${box.name}</span>
        `;
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            node.classList.toggle('expanded');
            node.classList.toggle('collapsed');
            this.selectJob(box);
        });

        node.appendChild(header);

        if (box.children && box.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.classList.add('children');
            
            box.children.forEach(child => {
                const childNode = this.createTreeNode(child);
                childrenContainer.appendChild(childNode);
            });
            
            node.appendChild(childrenContainer);
            node.classList.add('collapsed');
        }

        return node;
    }

    getIconForType(type) {
        switch (type) {
            case 'BOX': return 'fas fa-cube';
            case 'CMD': return 'fas fa-terminal';
            case 'FT': return 'fas fa-exchange-alt';
            default: return 'fas fa-question';
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

        detailsContent.innerHTML = this.generateJobDetailsHTML(job);
    }

    generateJobDetailsHTML(job) {
        const importantAttributes = ['command', 'machine', 'owner', 'condition', 'date_conditions', 'start_times', 'run_calendar', 'exclude_calendar'];
        
        let dependenciesHTML = '';
        if (job.dependsOn.length > 0 || job.requiredBy.length > 0) {
            dependenciesHTML = `
            <div class="detail-section">
                <h4><i class="fas fa-link"></i> Dépendances</h4>
                ${job.attributes.condition ? `
                <div class="detail-item">
                    <span class="detail-label">Condition:</span>
                    <span class="detail-value">${job.attributes.condition}</span>
                </div>
                ` : ''}
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
        
        return `
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
                <div class="detail-item">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${job.description || 'Non spécifiée'}</span>
                </div>
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
            ${job.attributes.command ? `
            <div class="detail-section">
                <h4><i class="fas fa-terminal"></i> Commande</h4>
                <div class="detail-item">
                    <span class="detail-label">Commande:</span>
                    <span class="detail-value command">${job.attributes.command}</span>
                </div>
            </div>
            ` : ''}

            ${job.attributes.machine ? `
            <div class="detail-section">
                <h4><i class="fas fa-server"></i> Machine</h4>
                <div class="detail-item">
                    <span class="detail-label">Machine:</span>
                    <span class="detail-value">${job.attributes.machine}</span>
                </div>
            </div>
            ` : ''}

            ${dependenciesHTML}

            ${job.attributes.run_calendar || job.attributes.start_times || job.attributes.date_conditions ? `
            <div class="detail-section">
                <h4><i class="fas fa-calendar-alt"></i> Planification</h4>
                ${job.attributes.run_calendar ? `
                <div class="detail-item">
                    <span class="detail-label">Calendrier:</span>
                    <span class="detail-value">${job.attributes.run_calendar}</span>
                </div>
                ` : ''}
                ${job.attributes.start_times ? `
                <div class="detail-item">
                    <span class="detail-label">Heures de début:</span>
                    <span class="detail-value">${job.attributes.start_times}</span>
                </div>
                ` : ''}
                ${job.attributes.date_conditions ? `
                <div class="detail-item">
                    <span class="detail-label">Conditions de date:</span>
                    <span class="detail-value">${job.attributes.date_conditions}</span>
                </div>
                ` : ''}
            </div>
            ` : ''}

            <div class="detail-section">
                <h4><i class="fas fa-cogs"></i> Autres attributs</h4>
                ${Object.entries(job.attributes)
                    .filter(([key]) => !importantAttributes.includes(key))
                    .map(([key, value]) => `
                    <div class="detail-item">
                        <span class="detail-label">${key}:</span>
                        <span class="detail-value">${value}</span>
                    </div>
                    `).join('')}
                ${Object.entries(job.attributes).filter(([key]) => !importantAttributes.includes(key)).length === 0 ? `
                    <div class="detail-item">
                        <span class="detail-label">Aucun autre attribut</span>
                    </div>
                ` : ''}
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-play-circle"></i> Visualisation</h4>
                <div class="animation-controls-preview">
                    <button class="btn-animate" onclick="window.autosysViewer.animationManager.startAnimation('${job.name}')">
                        <i class="fas fa-play"></i> Visualiser l'exécution
                    </button>
                    <small>Montre la propagation depuis ce job</small>
                </div>
            </div>
        `;
    }

    expandAll() {
        document.querySelectorAll('.tree-node').forEach(node => {
            if (node.querySelector('.children')) {
                node.classList.add('expanded');
                node.classList.remove('collapsed');
            }
        });

        document.querySelectorAll('.children').forEach(container => {
            container.style.maxHeight = '500px';
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto';
        });
    }

    collapseAll() {
        document.querySelectorAll('.tree-node').forEach(node => {
            if (node.querySelector('.children')) {
                node.classList.add('collapsed');
                node.classList.remove('expanded');
            }
        });

        document.querySelectorAll('.children').forEach(container => {
            container.style.maxHeight = '0';
            container.style.opacity = '0';
            container.style.pointerEvents = 'none';
        });
    }

    resetView() {
        document.getElementById('searchFilter').value = '';
        this.applyFilters();
        this.collapseAll();
        
        this.selectedJob = null;
        document.querySelectorAll('.tree-node.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        const detailsContent = document.getElementById('detailsContent');
        const detailsPanel = document.getElementById('detailsPanel');
        detailsContent.classList.add('hidden');
        detailsPanel.querySelector('.empty-details').classList.remove('hidden');
    }

    async exportToPNG() {
        if (typeof html2canvas === 'undefined') {
            alert('Fonctionnalité d\'export PNG non disponible');
            return;
        }
        
        if (this.boxes.size === 0) {
            alert('Veuillez charger un fichier JIL avant d\'exporter');
            return;
        }
        
        try {
            this.showLoading();
            
            const originalStates = new Map();
            const allNodes = document.querySelectorAll('.tree-node');
            
            allNodes.forEach(node => {
                originalStates.set(node, {
                    expanded: node.classList.contains('expanded'),
                    collapsed: node.classList.contains('collapsed')
                });
                
                node.classList.add('expanded');
                node.classList.remove('collapsed');
                
                const children = node.querySelector('.children');
                if (children) {
                    children.style.display = 'block';
                    children.style.maxHeight = 'none';
                    children.style.opacity = '1';
                }
            });
            
            const treeContainer = document.getElementById('treeContainer');
            const exportContainer = document.createElement('div');
            
            exportContainer.style.cssText = `
                position: fixed !important;
                left: -10000px !important;
                top: -10000px !important;
                width: ${treeContainer.scrollWidth + 40}px;
                background: white;
                padding: 20px;
                z-index: -1 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                overflow: visible !important;
                height: auto !important;
            `;
            
            const clonedTree = treeContainer.cloneNode(true);
            
            clonedTree.style.cssText = `
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
                display: block !important;
                width: 100% !important;
            `;
            
            const clonedNodes = clonedTree.querySelectorAll('.tree-node');
            clonedNodes.forEach(node => {
                node.classList.add('expanded');
                node.classList.remove('collapsed');
                node.style.display = 'block';
                
                const children = node.querySelector('.children');
                if (children) {
                    children.style.cssText = `
                        display: block !important;
                        max-height: none !important;
                        opacity: 1 !important;
                        visibility: visible !important;
                        height: auto !important;
                    `;
                }
            });
            
            exportContainer.appendChild(clonedTree);
            document.body.appendChild(exportContainer);
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const canvas = await html2canvas(exportContainer, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                width: exportContainer.scrollWidth,
                height: exportContainer.scrollHeight,
                scrollX: 0,
                scrollY: 0,
                windowWidth: exportContainer.scrollWidth,
                windowHeight: exportContainer.scrollHeight
            });
            
            document.body.removeChild(exportContainer);
            
            allNodes.forEach(node => {
                const originalState = originalStates.get(node);
                if (originalState) {
                    node.classList.toggle('expanded', originalState.expanded);
                    node.classList.toggle('collapsed', originalState.collapsed);
                    
                    const children = node.querySelector('.children');
                    if (children) {
                        children.style.display = '';
                        children.style.maxHeight = '';
                        children.style.opacity = '';
                    }
                }
            });
            
            const link = document.createElement('a');
            link.download = `autosys-complet-${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
            
        } catch (error) {
            console.error('Erreur lors de l\'export PNG:', error);
            alert('Erreur lors de l\'export PNG: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async exportToPDF() {
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
            alert('Fonctionnalité d\'export PDF non disponible');
            return;
        }
        
        if (this.boxes.size === 0) {
            alert('Veuillez charger un fichier JIL avant d\'exporter');
            return;
        }
        
        try {
            this.showLoading();
            
            const originalStates = new Map();
            const allNodes = document.querySelectorAll('.tree-node');
            
            allNodes.forEach(node => {
                originalStates.set(node, {
                    expanded: node.classList.contains('expanded'),
                    collapsed: node.classList.contains('collapsed')
                });
                
                node.classList.add('expanded');
                node.classList.remove('collapsed');
                
                const children = node.querySelector('.children');
                if (children) {
                    children.style.display = 'block';
                    children.style.maxHeight = 'none';
                    children.style.opacity = '1';
                }
            });
            
            const treeContainer = document.getElementById('treeContainer');
            const exportContainer = document.createElement('div');
            
            exportContainer.style.cssText = `
                position: fixed;
                left: -10000px !important;
                top: -10000px !important;
                width: 800px;
                background: white;
                padding: 20px;
                z-index: -1 !important;
                opacity: 0 !important;
                visibility: hidden !important;
            `;
            
            const clonedTree = treeContainer.cloneNode(true);
            clonedTree.style.cssText = `
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
            `;
            
            const clonedNodes = clonedTree.querySelectorAll('.tree-node');
            clonedNodes.forEach(node => {
                node.classList.add('expanded');
                node.classList.remove('collapsed');
                
                const children = node.querySelector('.children');
                if (children) {
                    children.style.cssText = `
                        display: block !important;
                        max-height: none !important;
                        opacity: 1 !important;
                        visibility: visible !important;
                    `;
                }
            });
            
            exportContainer.appendChild(clonedTree);
            document.body.appendChild(exportContainer);
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const totalHeight = exportContainer.scrollHeight;
            const pageHeight = 1000;
            const totalPages = Math.ceil(totalHeight / pageHeight);
            
            const pdf = new jspdf.jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: 'a4',
                compress: true
            });
            
            pdf.setFont('helvetica');
            
            for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                if (pageNum > 0) {
                    pdf.addPage();
                }
                
                const startY = pageNum * pageHeight;
                const endY = Math.min(startY + pageHeight, totalHeight);
                
                const pageContainer = document.createElement('div');
                pageContainer.style.cssText = `
                    position: absolute;
                    top: -${startY}px;
                    left: 0;
                    width: 800px;
                    background: white;
                `;
                
                pageContainer.appendChild(clonedTree.cloneNode(true));
                exportContainer.innerHTML = '';
                exportContainer.appendChild(pageContainer);
                
                const canvas = await html2canvas(exportContainer, {
                    backgroundColor: '#ffffff',
                    scale: 1.5,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    width: 800,
                    height: pageHeight,
                    windowWidth: 800,
                    windowHeight: pageHeight,
                    scrollX: 0,
                    scrollY: 0
                });
                
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                pdf.addImage(imgData, 'JPEG', 10, 10, 575, pageHeight * 0.75);
                
                pdf.setFontSize(10);
                pdf.setTextColor(100);
                pdf.text(
                    `Page ${pageNum + 1}/${totalPages} - Autosys JIL Export - ${new Date().toLocaleDateString()}`,
                    20,
                    pageHeight * 0.75 + 30
                );
            }
            
            document.body.removeChild(exportContainer);
            
            allNodes.forEach(node => {
                const originalState = originalStates.get(node);
                if (originalState) {
                    node.classList.toggle('expanded', originalState.expanded);
                    node.classList.toggle('collapsed', originalState.collapsed);
                    
                    const children = node.querySelector('.children');
                    if (children) {
                        children.style.display = '';
                        children.style.maxHeight = '';
                        children.style.opacity = '';
                    }
                }
            });
            
            pdf.save(`autosys-complet-${new Date().toISOString().split('T')[0]}.pdf`);
            
        } catch (error) {
            console.error('Erreur lors de l\'export PDF:', error);
            alert('Erreur lors de l\'export PDF: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    exportToHTML() {
        if (this.boxes.size === 0) {
            alert('Veuillez charger un fichier JIL avant d\'exporter');
            return;
        }
        
        try {
            let htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autosys JIL Export - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; color: #2c3e50; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 30px; }
        .header { border-bottom: 2px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
        .tree-node { margin: 8px 0; border-left: 3px solid #bdc3c7; padding-left: 15px; }
        .tree-node-header { padding: 12px 15px; background: #ecf0f1; border-radius: 8px; display: flex; align-items: center; gap: 10px; }
        .job-name { font-weight: 600; font-size: 16px; }
        .job-type-BOX .job-name { color: #e74c3c; }
        .job-type-CMD .job-name { color: #27ae60; }
        .children { margin-left: 25px; border-left: 2px dashed #bdc3c7; padding-left: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Autosys JIL - Ordre par Dépendances</h1>
            <div>Export généré le ${new Date().toLocaleDateString()}</div>
        </div>
        <h2>🌳 Arborescence avec Ordre Logique</h2>`;

            const generateTreeHTML = (box, level = 0) => {
                const icon = box.type === 'BOX' ? '📦' : box.type === 'CMD' ? '⚡' : '📁';
                const boxIndicator = box.type === 'BOX' ? ' 📦' : '';
                
                let html = `
                <div class="tree-node job-type-${box.type}" style="margin-left: ${level * 25}px;">
                    <div class="tree-node-header">
                        <span>${icon}</span>
                        <span class="job-name">${box.name}${boxIndicator}</span>
                        <small>(${box.type})</small>
                        ${box.description ? `<small>- ${box.description}</small>` : ''}
                    </div>
                `;

                if (box.children && box.children.length > 0) {
                    html += '<div class="children">';
                    box.children.forEach(child => {
                        html += generateTreeHTML(child, level + 1);
                    });
                    html += '</div>';
                }

                html += '</div>';
                return html;
            };

            this.rootBoxes.forEach(box => {
                htmlContent += generateTreeHTML(box);
            });

            htmlContent += `
    </div>
</body>
</html>`;

            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            link.download = `autosys-ordre-dependances-${new Date().toISOString().split('T')[0]}.html`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            
        } catch (error) {
            console.error('Erreur lors de l\'export HTML:', error);
            alert('Erreur lors de l\'export HTML: ' + error.message);
        }
    }
}

class AnimationManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.isPlaying = false;
        this.currentSpeed = 0.5;
        this.animationInterval = null;
        this.executionQueue = [];
        this.executionGroups = [];
        this.executedJobs = new Set();
        this.currentStep = 0;
        
        // Tracking des états des boxes
        this.boxChildrenTracking = new Map();
    }

    startAnimation(startJobName) {
        console.log('🎬 Démarrage animation depuis:', startJobName);

        this.prepareAnimation();
        this.initializeBoxTracking();
        this.calculateHierarchicalExecutionOrder(startJobName);

        if (this.executionQueue.length === 0) {
            alert('Aucun chemin d\'exécution trouvé depuis ce job');
            return;
        }

        this.setAllJobsToReady();
        this.showAnimationControls();
        this.startPlayback();
    }

    // Initialiser le tracking des enfants des boxes
    initializeBoxTracking() {
        this.boxChildrenTracking.clear();
        
        // Pour chaque box, initialiser le tracking de ses enfants
        for (const [jobName, job] of this.viewer.boxes) {
            if (job.type === 'BOX' && job.children && job.children.length > 0) {
                this.boxChildrenTracking.set(jobName, {
                    totalChildren: job.children.length,
                    completedChildren: 0,
                    childrenStatus: new Map(job.children.map(child => [child.name, false]))
                });
                console.log(`📦 Initialisation tracking pour ${jobName}: ${job.children.length} enfants`);
            }
        }
    }

    // Mettre à jour le statut d'un enfant
    updateChildCompletion(parentBoxName, childName) {
        const tracking = this.boxChildrenTracking.get(parentBoxName);
        if (!tracking) return;

        if (!tracking.childrenStatus.get(childName)) {
            tracking.childrenStatus.set(childName, true);
            tracking.completedChildren++;
            console.log(`📊 ${parentBoxName}: ${tracking.completedChildren}/${tracking.totalChildren} enfants terminés`);
        }

        // Si tous les enfants sont terminés, marquer la box comme terminée
        if (tracking.completedChildren === tracking.totalChildren) {
            console.log(`🎉 TOUS les enfants de ${parentBoxName} sont terminés !`);
            this.markBoxAsCompleted(parentBoxName);
        }
    }

    // Marquer une box comme terminée
    markBoxAsCompleted(boxName) {
        const boxElement = this.findJobElement(boxName);
        if (boxElement) {
            const boxNameElement = boxElement.querySelector('.job-name');
            if (boxNameElement && boxNameElement.classList.contains('job-executing')) {
                console.log(`✅ ${boxName} -> COMPLETED`);
                boxNameElement.classList.remove('job-executing');
                boxNameElement.classList.add('job-completed');
                
                // Propager aux parents
                const box = this.viewer.boxes.get(boxName);
                if (box && box.parent) {
                    this.updateChildCompletion(box.parent, boxName);
                }
            }
        }
    }

    setAllJobsToReady() {
        const allJobElements = document.querySelectorAll('.job-name');
        allJobElements.forEach(element => {
            element.classList.remove('job-executing', 'job-completed');
            element.classList.add('job-ready');
        });
    }

    prepareAnimation() {
        this.isPlaying = false;
        this.currentSpeed = 0.5;
        this.executionQueue = [];
        this.executionGroups = [];
        this.executedJobs.clear();
        this.currentStep = 0;
        this.boxChildrenTracking.clear();
        this.clearAnimationStyles();
    }

    calculateHierarchicalExecutionOrder(startJobName) {
        console.log('🔀 Calcul de l\'ordre hiérarchique pour:', startJobName);
        
        const visited = new Set();
        const allJobs = [];
        
        const processJobHierarchy = (jobName) => {
            if (visited.has(jobName)) return;
            visited.add(jobName);
            
            const job = this.viewer.boxes.get(jobName);
            if (!job) return;
            
            // Traiter d'abord les dépendances
            job.dependsOn.forEach(depName => {
                if (this.viewer.boxes.has(depName) && !visited.has(depName)) {
                    processJobHierarchy(depName);
                }
            });
            
            // Si c'est une BOX, traiter ses enfants avec la logique de parallélisation
            if (job.type === 'BOX' && job.children && job.children.length > 0) {
                console.log(`📦 Box ${jobName} - Traitement des ${job.children.length} enfants`);
                
                // Un seul enfant = pas de parallélisme
                if (job.children.length === 1) {
                    console.log(`   ℹ️  Un seul enfant - pas de parallélisme`);
                    processJobHierarchy(job.children[0].name);
                } else {
                    // Identifier les enfants sans condition ET sans dépendances entre eux
                    const independentChildren = this.findIndependentChildren(job.children);
                    
                    // Au moins 2 enfants pour faire du parallélisme
                    if (independentChildren.length >= 2) {
                        console.log(`   📊 Enfants indépendants: ${independentChildren.length}`);
                        
                        const parallelGroup = {
                            parent: jobName,
                            jobs: independentChildren.map(child => child.name),
                            type: 'parallel'
                        };
                        this.executionGroups.push(parallelGroup);
                        console.log(`   🔄 Groupe parallèle créé pour ${jobName}:`, parallelGroup.jobs);
                        
                        // Marquer les enfants parallèles comme visités
                        independentChildren.forEach(child => {
                            visited.add(child.name);
                        });
                    } else {
                        console.log(`   ℹ️  Pas assez d'enfants indépendants pour le parallélisme`);
                    }
                    
                    // Traiter tous les enfants (séquentiellement ou déjà traités en parallèle)
                    job.children.forEach(child => {
                        if (!visited.has(child.name)) {
                            processJobHierarchy(child.name);
                        }
                    });
                }
            }
            
            // Ajouter le job à la queue seulement s'il n'est pas déjà dans un groupe parallèle
            if (!this.isInParallelGroup(jobName)) {
                allJobs.push(jobName);
                console.log(`✅ Ajouté à la queue: ${jobName} (${job.type})`);
            }
        };
        
        processJobHierarchy(startJobName);
        
        // Construire la queue finale en éliminant les doublons
        this.buildFinalExecutionQueue(allJobs);
        
        console.log('📋 Ordre d\'exécution final:', this.executionQueue);
        console.log('📦 Groupes parallèles:', this.executionGroups);
    }

    // Ne pas traiter les BOX comme des jobs normaux dans la queue
    buildFinalExecutionQueue(allJobs) {
        const finalQueue = [];
        const processed = new Set();
        
        const processJob = (jobName) => {
            if (processed.has(jobName)) {
                console.log(`⚠️  Job ${jobName} déjà traité - évité le doublon`);
                return;
            }
            processed.add(jobName);
            
            const job = this.viewer.boxes.get(jobName);
            if (!job) return;
            
            // Traiter d'abord les dépendances
            job.dependsOn.forEach(depName => {
                if (this.viewer.boxes.has(depName)) {
                    processJob(depName);
                }
            });
            
            // Ne pas ajouter les BOX à la queue d'exécution
            // Les BOX sont des conteneurs, pas des jobs exécutables
            if (job.type === 'BOX') {
                console.log(`📦 Box ${jobName} traitée comme conteneur, pas ajoutée à la queue`);
                
                // Mais traiter ses enfants
                if (job.children && job.children.length > 0) {
                    const parallelGroup = this.executionGroups.find(group => 
                        group.parent === jobName
                    );
                    
                    if (parallelGroup) {
                        console.log(`🔄 Insertion du groupe parallèle pour ${jobName}`);
                        finalQueue.push(parallelGroup);
                        
                        // Marquer les jobs du groupe comme traités
                        parallelGroup.jobs.forEach(childName => {
                            processed.add(childName);
                        });
                    } else {
                        // Traiter les enfants séquentiellement
                        job.children.forEach(child => {
                            processJob(child.name);
                        });
                    }
                }
            } else {
                // Ajouter seulement les jobs CMD/FT à la queue
                finalQueue.push(jobName);
                console.log(`✅ Ajouté à la queue: ${jobName} (${job.type})`);
            }
        };
        
        // Traiter tous les jobs dans l'ordre initial en évitant les doublons
        allJobs.forEach(jobName => {
            processJob(jobName);
        });
        
        this.executionQueue = finalQueue;
        console.log('📋 Queue d\'exécution finale (sans BOX):', this.executionQueue);
    }

    // Trouver les enfants qui peuvent s'exécuter en parallèle (au moins 2)
    findIndependentChildren(children) {
        const independentChildren = [];
        
        children.forEach(child => {
            // Un enfant est indépendant s'il n'a pas de condition ET n'a pas de dépendances
            const hasNoCondition = !child.attributes.condition && child.dependsOn.length === 0;
            
            // Vérifier qu'il ne dépend d'aucun autre enfant de la même box
            const dependsOnSibling = child.dependsOn.some(dep => 
                children.some(sibling => sibling.name === dep)
            );
            
            if (hasNoCondition && !dependsOnSibling) {
                independentChildren.push(child);
            }
        });
        
        // Retourner seulement s'il y a au moins 2 enfants indépendants
        return independentChildren.length >= 2 ? independentChildren : [];
    }

    runAnimationStep() {
        if (!this.isPlaying || this.currentStep >= this.executionQueue.length) {
            this.isPlaying = false;
            this.updatePlayButton();
            console.log('✅ Animation terminée');
            return;
        }

        const currentItem = this.executionQueue[this.currentStep];
        
        // Vérifier si c'est un job déjà exécuté
        if (typeof currentItem === 'string' && this.executedJobs.has(currentItem)) {
            console.log(`⏭️  Job ${currentItem} déjà exécuté - passage au suivant`);
            this.currentStep++;
            this.updateProgress();
            this.runAnimationStep();
            return;
        }
        
        if (currentItem && typeof currentItem === 'object' && currentItem.type === 'parallel') {
            console.log(`🎯 Étape ${this.currentStep + 1}: Groupe parallèle de ${currentItem.jobs.length} jobs`, currentItem.jobs);
            this.executeParallelGroup(currentItem);
        } else {
            const job = this.viewer.boxes.get(currentItem);
            console.log(`🎯 Étape ${this.currentStep + 1}: ${currentItem} (${job?.type})`);
            this.executeJob(currentItem);
        }
        
        this.currentStep++;
        this.updateProgress();

        const delay = 1500 / this.currentSpeed;
        this.animationInterval = setTimeout(() => {
            this.runAnimationStep();
        }, delay);
    }

    // Exécuter un groupe parallèle - ANIMATION SIMPLIFIÉE
    executeParallelGroup(parallelGroup) {
        const { parent: parentBoxName, jobs: jobNames } = parallelGroup;
        console.log(`🔄 Début de l'exécution parallèle pour ${jobNames.length} jobs de ${parentBoxName}`);
        
        const jobsToExecute = jobNames.filter(jobName => !this.executedJobs.has(jobName));
        
        if (jobsToExecute.length === 0) return;

        // Mettre la box parente en état "executing"
        if (parentBoxName) {
            this.setParentBoxToExecuting(parentBoxName);
        }
        
        let completedCount = 0;
        const totalJobs = jobsToExecute.length;
        
        jobsToExecute.forEach(jobName => {
            const jobElement = this.findJobElement(jobName);
            if (jobElement) {
                const jobNameElement = jobElement.querySelector('.job-name');
                if (jobNameElement) {
                    jobNameElement.classList.remove('job-ready');
                    jobNameElement.classList.add('job-executing'); // UNIQUEMENT job-executing
                }
                
                this.expandJobAndParents(jobName);
                jobElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                setTimeout(() => {
                    if (jobNameElement) {
                        jobNameElement.classList.remove('job-executing');
                        jobNameElement.classList.add('job-completed');
                    }
                    
                    this.executedJobs.add(jobName);
                    completedCount++;
                    console.log(`✅ Job parallèle terminé: ${jobName} (${completedCount}/${totalJobs})`);
                    
                    // Mettre à jour le tracking
                    if (parentBoxName) {
                        this.updateChildCompletion(parentBoxName, jobName);
                    }
                }, 1200 / this.currentSpeed);
            }
        });
    }

    // Exécuter un job - ANIMATION SIMPLIFIÉE
    executeJob(jobName) {
        if (this.executedJobs.has(jobName)) {
            return;
        }
        
        const jobElement = this.findJobElement(jobName);
        if (!jobElement) {
            console.warn(`❌ Job non trouvé: ${jobName}`);
            return;
        }

        const job = this.viewer.boxes.get(jobName);
        const jobNameElement = jobElement.querySelector('.job-name');
        
        if (!jobNameElement) return;

        // Mettre en état "executing" (vert clignotant)
        jobNameElement.classList.remove('job-ready');
        jobNameElement.classList.add('job-executing');

        // Mettre la box parente en état "executing"
        if (job && job.parent) {
            this.setParentBoxToExecuting(job.parent);
        }

        this.expandJobAndParents(jobName);
        jobElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Simuler l'exécution
        setTimeout(() => {
            jobNameElement.classList.remove('job-executing');
            jobNameElement.classList.add('job-completed');
            
            this.executedJobs.add(jobName);
            console.log(`✅ Job terminé: ${jobName}`);

            // Vérifier la box parente
            if (job && job.parent) {
                this.updateChildCompletion(job.parent, jobName);
            }
        }, 1200 / this.currentSpeed);
    }

    isInParallelGroup(jobName) {
        return this.executionGroups.some(group => 
            group.jobs.includes(jobName)
        );
    }

    expandJobAndParents(jobName) {
        const job = this.viewer.boxes.get(jobName);
        if (!job) return;
        
        this.expandJobElement(jobName);
        
        let currentJob = job;
        while (currentJob && currentJob.parent) {
            this.expandJobElement(currentJob.parent);
            currentJob = this.viewer.boxes.get(currentJob.parent);
        }
    }

    expandJobElement(jobName) {
        const jobElement = this.findJobElement(jobName);
        if (jobElement) {
            jobElement.classList.add('expanded');
            jobElement.classList.remove('collapsed');
            
            const childrenContainer = jobElement.querySelector('.children');
            if (childrenContainer) {
                childrenContainer.style.display = 'block';
                childrenContainer.style.maxHeight = 'none';
                childrenContainer.style.opacity = '1';
                childrenContainer.style.pointerEvents = 'auto';
            }
        }
    }

    findJobElement(jobName) {
        const allNodes = document.querySelectorAll('.tree-node');
        for (let node of allNodes) {
            const header = node.querySelector('.job-name');
            if (header) {
                const text = header.textContent.trim();
                if (text === jobName) {
                    return node;
                }
            }
        }
        return null;
    }

    setParentBoxToExecuting(parentBoxName) {
        const parentBoxElement = this.findJobElement(parentBoxName);
        if (parentBoxElement) {
            const parentNameElement = parentBoxElement.querySelector('.job-name');
            if (parentNameElement && !parentNameElement.classList.contains('job-executing')) {
                console.log(`📦 ${parentBoxName} -> EXECUTING`);
                parentNameElement.classList.remove('job-ready', 'job-completed');
                parentNameElement.classList.add('job-executing');
            }
        }
    }

    showAnimationControls() {
        if (!document.getElementById('animationControls')) {
            this.createAnimationControls();
        }
        
        document.getElementById('animationControls').classList.remove('hidden');
        document.body.classList.add('animation-mode');
        this.updateProgress();
    }

    createAnimationControls() {
        const controls = document.createElement('div');
        controls.id = 'animationControls';
        controls.className = 'animation-controls-overlay hidden';
        
        controls.innerHTML = `
    <div class="animation-header">
        <h3><i class="fas fa-play-circle"></i> Simulation d'exécution</h3>
        <button class="btn-close-animation">
            <i class="fas fa-times"></i>
        </button>
    </div>
    
    <div class="animation-controls-bar">
        <button class="btn-control" id="playPauseBtn">
            <i class="fas fa-play"></i>
        </button>
        <button class="btn-control" id="speedBtn">
            0.5x
        </button>
        <button class="btn-control" id="resetBtn">
            <i class="fas fa-redo"></i>
        </button>
        <div class="animation-progress">
            <span id="progressText">0/0</span>
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
        </div>
    </div>
    
    <div class="animation-legend">
        <div class="legend-item">
            <div class="color-box job-ready"></div>
            <span>En attente</span>
        </div>
        <div class="legend-item">
            <div class="color-box job-executing"></div>
            <span>En cours</span>
        </div>
        <div class="legend-item">
            <div class="color-box job-completed"></div>
            <span>Terminé</span>
        </div>
    </div>
`;
        
        document.body.appendChild(controls);
        this.setupControlListeners();
    }

    setupControlListeners() {
        document.getElementById('playPauseBtn').addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        document.getElementById('speedBtn').addEventListener('click', () => {
            this.changeSpeed();
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetAnimation();
        });
        
        document.querySelector('.btn-close-animation').addEventListener('click', () => {
            this.stopAnimation();
        });
    }

    startPlayback() {
        this.isPlaying = true;
        this.updatePlayButton();
        this.prepareBranchExpansion();
        this.runAnimationStep();
    }

    prepareBranchExpansion() {
        if (this.executionQueue.length > 0) {
            const startJobName = this.executionQueue[0];
            this.expandJobElement(startJobName);
        }
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        this.updatePlayButton();
        
        if (this.isPlaying) {
            this.runAnimationStep();
        } else {
            clearTimeout(this.animationInterval);
        }
    }

    changeSpeed() {
        const speeds = [0.25, 0.5, 1, 2];
        const currentIndex = speeds.indexOf(this.currentSpeed);
        this.currentSpeed = speeds[(currentIndex + 1) % speeds.length];
        
        document.getElementById('speedBtn').textContent = this.currentSpeed + 'x';
        
        if (this.isPlaying) {
            clearTimeout(this.animationInterval);
            this.runAnimationStep();
        }
    }

    resetAnimation() {
        this.stopAnimation();
        this.currentStep = 0;
        this.clearAnimationStyles();
        this.updateProgress();
    }

    stopAnimation() {
        this.isPlaying = false;
        clearTimeout(this.animationInterval);
        
        const controls = document.getElementById('animationControls');
        if (controls) {
            controls.classList.add('hidden');
        }
        
        document.body.classList.remove('animation-mode');
        this.clearAnimationStyles();
    }

    updatePlayButton() {
        const playBtn = document.getElementById('playPauseBtn');
        if (playBtn) {
            const icon = playBtn.querySelector('i');
            if (icon) {
                icon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
            }
        }
    }

    updateProgress() {
        const progressText = document.getElementById('progressText');
        const progressFill = document.getElementById('progressFill');
        
        const totalSteps = this.executionQueue.length;
        
        if (progressText) {
            progressText.textContent = `${this.currentStep}/${totalSteps}`;
        }
        
        if (progressFill && totalSteps > 0) {
            const progress = (this.currentStep / totalSteps) * 100;
            progressFill.style.width = progress + '%';
        }
    }

    clearAnimationStyles() {
        const allNameElements = document.querySelectorAll('.job-name');
        allNameElements.forEach(element => {
            element.classList.remove('job-ready', 'job-executing', 'job-completed');
            element.classList.add('job-ready');
        });
        this.executedJobs.clear();
    }
}

// CSS pour l'animation - VERSION SIMPLIFIÉE
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

// Injecter le CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = animationCSS;
document.head.appendChild(styleSheet);

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Application Autosys Viewer démarrée - VERSION SIMPLIFIÉE');
    window.autosysViewer = new AutosysViewer();
});
