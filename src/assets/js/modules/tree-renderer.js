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
            conditionIcon = '<i title="A des dépendances"></i>';
        }
        
        let boxIndicator = '';
        if (box.type === 'BOX') {
            boxIndicator = ' ';
        }
        
        header.innerHTML = `
            <i class="${this.getIconForType(box.type)}"></i>
            <span class="job-name">${box.name}${boxIndicator}</span>
            ${conditionIcon}
        `;

        header.addEventListener('click', (e) => {
            e.stopPropagation();
            node.classList.toggle('expanded');
            node.classList.toggle('collapsed');
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

        const allNodes = document.querySelectorAll('.tree-node');
        let targetNode = null;
        
        for (let node of allNodes) {
            const jobNameElement = node.querySelector('.job-name');
            if (jobNameElement && jobNameElement.textContent.trim().replace(' ', '') === job.name) {
                targetNode = node;
                break;
            }
        }

        if (targetNode) {
            targetNode.classList.add('selected');
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
        const allNodes = document.querySelectorAll('.tree-node');
        for (let node of allNodes) {
            const header = node.querySelector('.tree-node-header');
            if (header && header.textContent.includes(boxName)) {
                return node;
            }
        }
        return null;
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
}