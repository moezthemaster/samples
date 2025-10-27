export class TreeRenderer {
    constructor(viewer) {
        this.viewer = viewer;
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

        // Appliquer les styles pour les jobs modifiés après le rendu
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

    const header = document.createElement('div');
    header.className = 'tree-node-header';
    
    const searchTerm = document.getElementById('searchFilter').value.toLowerCase();
    const isSearchMatch = box.name.toLowerCase().includes(searchTerm) || 
                         (box.description && box.description.toLowerCase().includes(searchTerm));
    
    if (isSearchMatch && searchTerm) {
        header.classList.add('search-match');
    }
    
    let conditionIcon = '';
    if (box.attributes.condition) {
        conditionIcon = '<i class="fas fa-link condition-icon" title="A des dépendances"></i>';
    }
    
    // Vérifier si le job est modifié
    const isModified = box.modified || this.viewer.editionManager.modifiedJobs.has(box.name);
    const modifiedIndicator = isModified ? '<span class="modified-indicator" title="Job modifié">✏️</span>' : '';
    
    header.innerHTML = `
        <div class="job-header-main">
            <i class="${this.getIconForType(box.type)}"></i>
            <span class="job-name">${box.name}</span>
            ${modifiedIndicator}
        </div>
    `;

    header.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Basculer l'état expand/collapse seulement si c'est un BOX avec enfants
        if (box.children && box.children.length > 0) {
            node.classList.toggle('expanded');
            node.classList.toggle('collapsed');
        }
        
        this.viewer.selectJob(box);
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

        const jobNode = document.querySelector(`[data-job="${job.name}"]`);
        if (jobNode) {
            jobNode.classList.add('selected');
            
            // Scroll vers le job sélectionné
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

    // Nouvelle méthode pour mettre à jour l'apparence d'un job modifié
// Nouvelle méthode pour mettre à jour l'apparence d'un job modifié
// Méthode pour mettre à jour l'apparence d'un job modifié
updateJobAppearance(jobName) {
    const jobNodes = document.querySelectorAll(`[data-job="${jobName}"]`);
    
    jobNodes.forEach(node => {
        // Vérifier que le node existe et a un header
        if (!node) return;
        
        // Ajouter la classe modified au node
        node.classList.add('modified');
        
        // Mettre à jour l'indicateur dans le header
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
                // Fallback: ajouter directement au header
                header.appendChild(indicator);
            }
        }
    });
}

// Méthode pour réinitialiser l'apparence d'un job modifié
// Méthode pour réinitialiser l'apparence d'un job modifié
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

    // Appliquer les styles pour tous les jobs modifiés
    applyModifiedStyles() {
        this.viewer.editionManager.modifiedJobs.forEach(jobName => {
            this.updateJobAppearance(jobName);
        });
    }

    // Méthode pour mettre à jour la description d'un job dans l'arbre
    updateJobDescription(jobName, newDescription) {
        const jobNodes = document.querySelectorAll(`[data-job="${jobName}"]`);
        
        jobNodes.forEach(node => {
            let descriptionElement = node.querySelector('.job-description');
            
            if (newDescription) {
                if (!descriptionElement) {
                    // Créer l'élément description s'il n'existe pas
                    descriptionElement = document.createElement('div');
                    descriptionElement.className = 'job-description';
                    const headerMain = node.querySelector('.job-header-main');
                    headerMain.parentNode.insertBefore(descriptionElement, headerMain.nextSibling);
                }
                descriptionElement.textContent = newDescription;
            } else if (descriptionElement) {
                // Supprimer l'élément description si vide
                descriptionElement.remove();
            }
        });
    }
}