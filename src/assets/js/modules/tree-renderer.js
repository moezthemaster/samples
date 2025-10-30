export class TreeRenderer {
    constructor(viewer) {
        this.viewer = viewer;
        this.setupContextMenu();
    }

    setupContextMenu() {
        // Créer le menu contextuel s'il n'existe pas
        if (!document.getElementById('treeContextMenu')) {
            this.contextMenu = document.createElement('div');
            this.contextMenu.id = 'treeContextMenu';
            this.contextMenu.className = 'context-menu hidden';
            this.contextMenu.innerHTML = `
                <div class="context-menu-item" data-action="expand-recursive">
                    <i class="fas fa-expand-arrows-alt"></i>
                    Développer récursivement
                </div>
                <div class="context-menu-item" data-action="collapse-recursive">
                    <i class="fas fa-compress-arrows-alt"></i>
                    Replier récursivement
                </div>
            `;
            document.body.appendChild(this.contextMenu);

            // Fermer le menu en cliquant ailleurs
            document.addEventListener('click', () => {
                this.hideContextMenu();
            });

            // Gérer les clics sur les items du menu
            this.contextMenu.addEventListener('click', (e) => {
                const menuItem = e.target.closest('.context-menu-item');
                if (menuItem && !menuItem.classList.contains('disabled')) {
                    const action = menuItem.dataset.action;
                    this.handleContextMenuAction(action);
                }
            });
        } else {
            this.contextMenu = document.getElementById('treeContextMenu');
        }
    }

    renderTree(rootBoxes = this.viewer.rootBoxes) {
        const container = document.getElementById('treeContainer');
        container.innerHTML = '';

        if (rootBoxes.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        rootBoxes.forEach(box => {
            const node = this.createTreeNode(box);
            container.appendChild(node);
        });

        this.applyModifiedStyles();
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Aucun job trouvé</h3>
                <p>Ajustez vos filtres pour afficher les jobs</p>
            </div>
        `;
    }

    createTreeNode(box) {
        const node = document.createElement('div');
        node.classList.add('tree-node', 'job-type-' + box.type);
        node.setAttribute('data-job', box.name);
        node.draggable = true;

        const header = this.createTreeNodeHeader(box, node);
        node.appendChild(header);

        if (box.children && box.children.length > 0) {
            const childrenContainer = this.createChildrenContainer(box);
            node.appendChild(childrenContainer);
            node.classList.add('collapsed');
        }

        return node;
    }

    createTreeNodeHeader(box, node) {
        const header = document.createElement('div');
        header.className = 'tree-node-header';
        
        const searchTerm = document.getElementById('searchFilter')?.value.toLowerCase() || '';
        const isSearchMatch = box.name.toLowerCase().includes(searchTerm) || 
                             (box.description && box.description.toLowerCase().includes(searchTerm));
        
        if (isSearchMatch && searchTerm) {
            header.classList.add('search-match');
        }
        
        const isModified = box.modified || this.viewer.editionManager.modifiedJobs.has(box.name);
        const modifiedIndicator = isModified ? '<span class="modified-indicator" title="Job modifié">✏️</span>' : '';
        
        header.innerHTML = `
            <div class="job-header-main">
                <i class="${this.getIconForType(box.type)}"></i>
                <span class="job-name">${box.name}</span>
                ${modifiedIndicator}
            </div>
        `;

        this.setupHeaderEvents(header, node, box);
        return header;
    }

    setupHeaderEvents(header, node, box) {
        // Clic gauche - bascule expand/collapse et sélection
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (box.children && box.children.length > 0) {
                node.classList.toggle('expanded');
                node.classList.toggle('collapsed');
                this.updateChildrenContainers();
            }
            
            this.viewer.selectJob(box);
            this.hideContextMenu();
        });

        // Clic droit - afficher le menu contextuel
        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            this.showContextMenu(e, node, box);
        });
    }

    showContextMenu(e, node, box) {
        this.currentNode = node;
        this.currentJob = box;
        
        // Positionner le menu
        this.contextMenu.style.left = e.pageX + 'px';
        this.contextMenu.style.top = e.pageY + 'px';
        this.contextMenu.classList.remove('hidden');
        
        // Mettre à jour les options selon le type de job
        this.updateContextMenuOptions(box);
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.add('hidden');
        }
        this.currentNode = null;
        this.currentJob = null;
    }

    updateContextMenuOptions(box) {
        const expandItem = this.contextMenu.querySelector('[data-action="expand-recursive"]');
        const collapseItem = this.contextMenu.querySelector('[data-action="collapse-recursive"]');
        
        // Activer/désactiver les options selon si c'est une box avec enfants
        const hasChildren = box.children && box.children.length > 0;
        
        if (hasChildren) {
            expandItem.classList.remove('disabled');
            collapseItem.classList.remove('disabled');
        } else {
            expandItem.classList.add('disabled');
            collapseItem.classList.add('disabled');
        }
    }

    handleContextMenuAction(action) {
        if (!this.currentNode || !this.currentJob) return;
        
        switch (action) {
            case 'expand-recursive':
                this.expandRecursively(this.currentNode, this.currentJob);
                break;
            case 'collapse-recursive':
                this.collapseRecursively(this.currentNode, this.currentJob);
                break;
        }
        
        this.hideContextMenu();
    }

    createChildrenContainer(box) {
        const childrenContainer = document.createElement('div');
        childrenContainer.classList.add('children');
        
        box.children.forEach(child => {
            const childNode = this.createTreeNode(child);
            childrenContainer.appendChild(childNode);
        });
        
        return childrenContainer;
    }

    expandRecursively(node, box) {
        // Développer le node courant
        node.classList.add('expanded');
        node.classList.remove('collapsed');

        // Développer récursivement tous les enfants
        if (box.children && box.children.length > 0) {
            box.children.forEach(child => {
                const childNode = this.findTreeNodeByName(child.name);
                if (childNode) {
                    this.expandRecursively(childNode, child);
                }
            });
        }
        
        this.updateChildrenContainers();
    }

    collapseRecursively(node, box) {
        // Replier le node courant
        node.classList.add('collapsed');
        node.classList.remove('expanded');

        // Replier récursivement tous les enfants
        if (box.children && box.children.length > 0) {
            box.children.forEach(child => {
                const childNode = this.findTreeNodeByName(child.name);
                if (childNode) {
                    this.collapseRecursively(childNode, child);
                }
            });
        }
        
        this.updateChildrenContainers();
    }

    getIconForType(type) {
        const icons = {
            'BOX': 'fas fa-cube',
            'CMD': 'fas fa-terminal', 
            'FT': 'fas fa-exchange-alt'
        };
        return icons[type] || 'fas fa-question';
    }

    selectJob(job) {
        document.querySelectorAll('.tree-node.selected').forEach(item => {
            item.classList.remove('selected');
        });

        const jobNode = this.findTreeNodeByName(job.name);
        if (jobNode) {
            jobNode.classList.add('selected');
            jobNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    expandAll() {
        document.querySelectorAll('.tree-node').forEach(node => {
            if (node.querySelector('.children')) {
                node.classList.add('expanded');
                node.classList.remove('collapsed');
            }
        });

        this.updateChildrenContainers();
    }

    collapseAll() {
        document.querySelectorAll('.tree-node').forEach(node => {
            if (node.querySelector('.children')) {
                node.classList.add('collapsed');
                node.classList.remove('expanded');
            }
        });

        this.updateChildrenContainers();
    }

    updateChildrenContainers() {
        document.querySelectorAll('.children').forEach(container => {
            if (container.parentElement.classList.contains('expanded')) {
                container.style.maxHeight = '500px';
                container.style.opacity = '1';
                container.style.pointerEvents = 'auto';
            } else {
                container.style.maxHeight = '0';
                container.style.opacity = '0';
                container.style.pointerEvents = 'none';
            }
        });
    }

    findTreeNodeByName(boxName) {
        return document.querySelector(`[data-job="${boxName}"]`);
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
        this.updateChildrenContainers();
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
        this.updateChildrenContainers();
    }

    updateJobAppearance(jobName) {
        const jobNodes = document.querySelectorAll(`[data-job="${jobName}"]`);
        
        jobNodes.forEach(node => {
            if (!node) return;
            
            node.classList.add('modified');
            
            const header = node.querySelector('.tree-node-header');
            if (!header) return;
            
            const existingIndicator = header.querySelector('.modified-indicator');
            
            if (!existingIndicator) {
                const indicator = document.createElement('span');
                indicator.className = 'modified-indicator';
                indicator.title = 'Job modifié';
                indicator.innerHTML = '✏️';
                
                const jobHeaderMain = header.querySelector('.job-header-main');
                if (jobHeaderMain) {
                    jobHeaderMain.appendChild(indicator);
                } else {
                    header.appendChild(indicator);
                }
            }
        });
    }

    resetJobAppearance(jobName) {
        const jobNodes = document.querySelectorAll(`[data-job="${jobName}"]`);
        
        jobNodes.forEach(node => {
            if (!node) return;
            
            node.classList.remove('modified');
            
            const header = node.querySelector('.tree-node-header');
            if (header) {
                const indicator = header.querySelector('.modified-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }
        });
    }

    applyModifiedStyles() {
        this.viewer.editionManager.modifiedJobs.forEach(jobName => {
            this.updateJobAppearance(jobName);
        });
    }

    updateJobDescription(jobName, newDescription) {
        const jobNodes = document.querySelectorAll(`[data-job="${jobName}"]`);
        
        jobNodes.forEach(node => {
            let descriptionElement = node.querySelector('.job-description');
            
            if (newDescription) {
                if (!descriptionElement) {
                    descriptionElement = document.createElement('div');
                    descriptionElement.className = 'job-description';
                    const headerMain = node.querySelector('.job-header-main');
                    headerMain.parentNode.insertBefore(descriptionElement, headerMain.nextSibling);
                }
                descriptionElement.textContent = newDescription;
            } else if (descriptionElement) {
                descriptionElement.remove();
            }
        });
    }
}