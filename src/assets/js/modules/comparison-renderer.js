export class ComparisonRenderer {
    constructor(viewer) {
        this.viewer = viewer;
    }

renderComparisonTree(filterType = null) {
    const container = document.getElementById('treeContainer');
    if (!this.viewer.comparisonManager.result) {
        container.innerHTML = this.getEmptyComparisonHTML();
        return;
    }

    const { result } = this.viewer.comparisonManager;
    
    let jobsToShow = [];
    
    // Appliquer le filtre si spécifié
    if (filterType) {
        switch (filterType) {
            case 'new':
                jobsToShow = result.newJobs.map(name => ({ name, type: 'new' }));
                break;
            case 'modified':
                jobsToShow = result.modifiedJobs.map(name => ({ name, type: 'modified' }));
                break;
            case 'deleted':
                jobsToShow = result.deletedJobs.map(name => ({ name, type: 'deleted' }));
                break;
            case 'identical':
                jobsToShow = result.identicalJobs.map(name => ({ name, type: 'identical' }));
                break;
            default:
                jobsToShow = this.getAllComparisonJobs(result);
        }
    } else {
        jobsToShow = this.getAllComparisonJobs(result);
    }

    if (jobsToShow.length === 0) {
        container.innerHTML = this.getEmptyFilterHTML(filterType);
        return;
    }

    container.innerHTML = '';
    jobsToShow.forEach(jobInfo => {
        const job = this.getJobData(jobInfo.name, jobInfo.type);
        if (job) {
            const node = this.createComparisonNode(job, jobInfo.type);
            container.appendChild(node);
        }
    });
}

getAllComparisonJobs(result) {
    return [
        ...result.newJobs.map(name => ({ name, type: 'new' })),
        ...result.deletedJobs.map(name => ({ name, type: 'deleted' })),
        ...result.modifiedJobs.map(name => ({ name, type: 'modified' })),
        ...result.identicalJobs.map(name => ({ name, type: 'identical' }))
    ];
}

getEmptyFilterHTML(filterType) {
    const messages = {
        new: 'Aucun job nouveau',
        modified: 'Aucun job modifié',
        deleted: 'Aucun job supprimé',
        identical: 'Aucun job identique'
    };
    
    return `
        <div class="empty-state">
            <i class="fas fa-filter"></i>
            <h3>${messages[filterType] || 'Aucun résultat'}</h3>
            <p>Aucun job ne correspond au filtre sélectionné</p>
        </div>
    `;
}

getAllComparisonJobs(result) {
    return [
        ...result.newJobs.map(name => ({ name, type: 'new' })),
        ...result.deletedJobs.map(name => ({ name, type: 'deleted' })),
        ...result.modifiedJobs.map(name => ({ name, type: 'modified' })),
        ...result.identicalJobs.map(name => ({ name, type: 'identical' }))
    ];
}

getEmptyFilterHTML(filterType) {
    const messages = {
        new: 'Aucun job nouveau',
        modified: 'Aucun job modifié',
        deleted: 'Aucun job supprimé',
        identical: 'Aucun job identique'
    };
    
    return `
        <div class="empty-state">
            <i class="fas fa-filter"></i>
            <h3>${messages[filterType] || 'Aucun résultat'}</h3>
            <p>Aucun job ne correspond au filtre sélectionné</p>
        </div>
    `;
}

    getJobData(jobName, type) {
        const { result } = this.viewer.comparisonManager;
        const jobInfo = result.jobDetails.get(jobName);
        
        switch (type) {
            case 'new': return jobInfo.jobA;
            case 'deleted': return jobInfo.jobB;
            case 'modified': 
            case 'identical': return jobInfo.jobA;
            default: return null;
        }
    }

    createComparisonNode(job, comparisonType) {
        const node = document.createElement('div');
        node.classList.add('tree-node', 'job-type-' + job.type);
        
        const header = document.createElement('div');
        header.className = 'tree-node-header';
        
        const typeIcon = this.getComparisonTypeIcon(comparisonType);
        const colorClass = this.getComparisonColorClass(comparisonType);
        
        header.innerHTML = `
            <i class="${this.getIconForType(job.type)}"></i>
            <span class="job-name">${job.name}</span>
            <div class="compare-indicator ${colorClass}" title="${this.getComparisonTooltip(comparisonType)}"></div>
            ${typeIcon}
        `;

        header.addEventListener('click', (e) => {
            e.stopPropagation();
            this.viewer.selectJob(job);
        });

        node.appendChild(header);
        return node;
    }

    getComparisonTypeIcon(comparisonType) {
        const icons = {
            new: '<i class="fas fa-plus-circle" style="color: #10b981; margin-left: 8px;"></i>',
            deleted: '<i class="fas fa-minus-circle" style="color: #ef4444; margin-left: 8px;"></i>',
            modified: '<i class="fas fa-pencil-alt" style="color: #f59e0b; margin-left: 8px;"></i>',
            identical: '<i class="fas fa-check-circle" style="color: #64748b; margin-left: 8px;"></i>'
        };
        return icons[comparisonType] || '';
    }

    getComparisonColorClass(comparisonType) {
        const classes = {
            new: 'compare-new',
            deleted: 'compare-deleted', 
            modified: 'compare-modified',
            identical: 'compare-identical'
        };
        return classes[comparisonType] || '';
    }

    getComparisonTooltip(comparisonType) {
        const tooltips = {
            new: 'Nouveau - Présent seulement dans le fichier A',
            deleted: 'Supprimé - Présent seulement dans le fichier B',
            modified: 'Modifié - Présent dans les deux fichiers mais différent',
            identical: 'Identique - Aucune différence'
        };
        return tooltips[comparisonType] || '';
    }

    getIconForType(type) {
        switch (type) {
            case 'BOX': return 'fas fa-cube';
            case 'CMD': return 'fas fa-terminal';
            case 'FT': return 'fas fa-exchange-alt';
            default: return 'fas fa-question';
        }
    }

    renderComparisonDetails(job) {
        const jobName = job.name;
        const jobInfo = this.viewer.comparisonManager.getJobComparisonInfo(jobName);
        
        if (!jobInfo) {
            return this.generateJobDetailsHTML(job); // Fallback normal
        }

        return this.generateComparisonDetailsHTML(jobInfo);
    }

    generateComparisonDetailsHTML(jobInfo) {
        const { type, jobA, jobB, differences = [] } = jobInfo;
        
        return `
            <div class="detail-section">
                <h4><i class="fas fa-code-compare"></i> État de la comparaison</h4>
                <div class="detail-item">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value ${this.getComparisonColorClass(type)}">
                        ${this.getComparisonTypeLabel(type)}
                    </span>
                </div>
            </div>

            ${this.renderJobComparisonSections(jobA, jobB, differences)}

            ${differences.length > 0 ? `
            <div class="detail-section">
                <h4><i class="fas fa-list"></i> Différences détectées</h4>
                ${differences.map(diff => `
                    <div class="detail-item">
                        <span class="detail-label">${diff.attribute}:</span>
                        <span class="detail-value">
                            <div style="color: #ef4444; font-size: 0.8em;">Fichier A: ${diff.valueA || 'N/A'}</div>
                            <div style="color: #10b981; font-size: 0.8em;">Fichier B: ${diff.valueB || 'N/A'}</div>
                        </span>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        `;
    }

    renderJobComparisonSections(jobA, jobB, differences) {
        const sections = [];
        const importantAttributes = ['command', 'machine', 'condition', 'description'];
        
        importantAttributes.forEach(attr => {
            const valueA = jobA?.attributes[attr] || 'N/A';
            const valueB = jobB?.attributes[attr] || 'N/A';
            const isDifferent = differences.some(diff => diff.attribute === attr);
            
            if (valueA !== 'N/A' || valueB !== 'N/A') {
                sections.push(`
                    <div class="detail-section">
                        <h4><i class="${this.getAttributeIcon(attr)}"></i> ${this.getAttributeLabel(attr)}</h4>
                        <div class="compare-details">
                            <div class="compare-detail-section file-a ${isDifferent ? 'diff-highlight' : ''}">
                                <div class="compare-file-label">Fichier A</div>
                                <div class="detail-value">${valueA}</div>
                            </div>
                            <div class="compare-detail-section file-b ${isDifferent ? 'diff-highlight' : ''}">
                                <div class="compare-file-label">Fichier B</div>
                                <div class="detail-value">${valueB}</div>
                            </div>
                        </div>
                    </div>
                `);
            }
        });
        
        return sections.join('');
    }

    getComparisonTypeLabel(type) {
        const labels = {
            new: '🆕 Nouveau',
            deleted: '🗑️ Supprimé', 
            modified: '✏️ Modifié',
            identical: '✅ Identique'
        };
        return labels[type] || type;
    }

    getAttributeIcon(attribute) {
        const icons = {
            command: 'fas fa-terminal',
            machine: 'fas fa-server',
            condition: 'fas fa-link',
            description: 'fas fa-info-circle'
        };
        return icons[attribute] || 'fas fa-cog';
    }

    getAttributeLabel(attribute) {
        const labels = {
            command: 'Commande',
            machine: 'Machine',
            condition: 'Condition',
            description: 'Description'
        };
        return labels[attribute] || attribute;
    }

    getEmptyComparisonHTML() {
        return `
            <div class="empty-state">
                <i class="fas fa-code-compare"></i>
                <h3>Aucune comparaison en cours</h3>
                <p>Chargez deux fichiers JIL pour commencer la comparaison</p>
            </div>
        `;
    }
}
