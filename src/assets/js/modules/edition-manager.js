export class EditionManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.modifiedJobs = new Set();
        this.originalValues = new Map(); // Stocker les valeurs originales
    }

makeFieldEditable(element, job, attributeName) {
    const originalValue = element.textContent;
    const parentElement = element.parentNode;
    
    if (!parentElement) return;
    
    // Sauvegarder la valeur originale
    if (!this.originalValues.has(job.name)) {
        this.originalValues.set(job.name, new Map());
    }
    if (!this.originalValues.get(job.name).has(attributeName)) {
        this.originalValues.get(job.name).set(attributeName, originalValue);
    }
    
    // Créer l'input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalValue;
    input.className = 'edit-input';
    input.style.cssText = `
        width: 100%;
        padding: 4px 8px;
        border: 2px solid #3498db;
        border-radius: 4px;
        font-family: inherit;
        font-size: inherit;
        background: #fff;
    `;
    
    // Remplacer l'élément
    parentElement.replaceChild(input, element);
    input.focus();
    input.select();
    
    const finishEdit = (shouldSave) => {
        const newValue = shouldSave ? input.value.trim() : originalValue;
        const hasChanged = shouldSave && newValue !== originalValue;
        
        // Créer le nouvel élément span
        const newSpan = document.createElement('span');
        newSpan.className = 'detail-value editable';
        newSpan.setAttribute('data-attribute', attributeName);
        newSpan.setAttribute('data-job', job.name);
        newSpan.textContent = newValue || 'Non spécifiée';
        
        // Remplacer seulement si l'input est toujours dans le parent
        if (input.parentNode === parentElement) {
            parentElement.replaceChild(newSpan, input);
        }
        
        if (hasChanged) {
            job.attributes[attributeName] = newValue;
            this.modifiedJobs.add(job.name);
            job.modified = true;
            
            // Mettre à jour l'apparence dans l'arbre
            this.markJobAsModifiedInTree(job.name);
            
            // Rafraîchir les détails
            setTimeout(() => {
                if (this.viewer.selectedJob && this.viewer.selectedJob.name === job.name) {
                    this.viewer.showNormalJobDetails(job);
                }
            }, 100);
        }
    };
    
    // Événements
    input.addEventListener('blur', () => {
        setTimeout(() => finishEdit(true), 150);
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEdit(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finishEdit(false);
        }
    });
}

resetSingleJobModification(jobName) {
    const job = this.viewer.boxes.get(jobName);
    if (!job) return;

    // Restaurer les valeurs originales
    const originalJobValues = this.originalValues.get(jobName);
    if (originalJobValues) {
        originalJobValues.forEach((originalValue, attributeName) => {
            job.attributes[attributeName] = originalValue;
        });
    }

    // Retirer de la liste des modifiés
    this.modifiedJobs.delete(jobName);
    
    // Réinitialiser le flag
    job.modified = false;
    
    // Nettoyer les sauvegardes
    this.originalValues.delete(jobName);
    
    // Réinitialiser l'apparence dans l'arbre
    this.viewer.treeRenderer.resetJobAppearance(jobName);
    
    console.log(`🔄 Job ${jobName} réinitialisé`);
    
    // RAFRAÎCHIR IMMÉDIATEMENT l'affichage
    if (this.viewer.selectedJob && this.viewer.selectedJob.name === jobName) {
        setTimeout(() => {
            this.viewer.refreshJobDetails();
        }, 10);
    }
}

    // Méthode pour réinitialiser tous les jobs modifiés
resetModifiedJobs() {
    // Restaurer toutes les valeurs originales
    this.modifiedJobs.forEach(jobName => {
        const job = this.viewer.boxes.get(jobName);
        const originalJobValues = this.originalValues.get(jobName);
        
        if (job && originalJobValues) {
            originalJobValues.forEach((originalValue, attributeName) => {
                job.attributes[attributeName] = originalValue;
            });
        }
        
        this.viewer.treeRenderer.resetJobAppearance(jobName);
    });
    
    this.modifiedJobs.clear();
    this.originalValues.clear();
    this.viewer.boxes.forEach(job => {
        job.modified = false;
    });
    
    console.log('🔄 Tous les jobs réinitialisés avec valeurs originales');
    
    // Rafraîchir l'affichage si un job est sélectionné
    if (this.viewer.selectedJob) {
        setTimeout(() => {
            this.viewer.selectJob(this.viewer.selectedJob);
        }, 100);
    }
}

markJobAsModifiedInTree(jobName) {
    // Vérifier que TreeRenderer existe avant d'appeler
    if (this.viewer.treeRenderer && typeof this.viewer.treeRenderer.updateJobAppearance === 'function') {
        this.viewer.treeRenderer.updateJobAppearance(jobName);
    }
}

    getModifiedJobsCount() {
        return this.modifiedJobs.size;
    }
}