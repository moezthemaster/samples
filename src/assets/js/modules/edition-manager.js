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

// Méthode pour réinitialiser un job spécifique
resetSingleJobModification(jobName) {
    const job = this.viewer.boxes.get(jobName);
    if (!job) return;

    // Vérifier si c'est un job nouvellement créé (n'existait pas dans l'original)
    const isNewJob = !this.originalValues.has(jobName) || 
                     (this.originalValues.get(jobName) && 
                      this.originalValues.get(jobName).size === 0);

    if (isNewJob) {
        // SUPPRIMER COMPLÈTEMENT le job créé
        this.deleteJob(jobName);
    } else {
        // C'est un job existant modifié - restaurer les valeurs originales
        const originalJobValues = this.originalValues.get(jobName);
        if (originalJobValues) {
            originalJobValues.forEach((originalValue, attributeName) => {
                job.attributes[attributeName] = originalValue;
            });
        }

        // Retirer de la liste des modifiés
        this.modifiedJobs.delete(jobName);
        job.modified = false;
        
        // Réinitialiser l'apparence dans l'arbre
        this.viewer.treeRenderer.resetJobAppearance(jobName);
    }
    
    // Nettoyer les sauvegardes
    this.originalValues.delete(jobName);
    
    console.log(`🔄 Job ${jobName} ${isNewJob ? 'supprimé' : 'réinitialisé'}`);
    
    // Rafraîchir l'affichage
    if (this.viewer.selectedJob && this.viewer.selectedJob.name === jobName) {
        setTimeout(() => {
            if (isNewJob) {
                // Si le job a été supprimé, vider les détails
                this.viewer.selectedJob = null;
                const detailsContent = document.getElementById('detailsContent');
                const detailsPanel = document.getElementById('detailsPanel');
                if (detailsContent && detailsPanel) {
                    detailsContent.classList.add('hidden');
                    detailsPanel.querySelector('.empty-details').classList.remove('hidden');
                }
            } else {
                // Sinon rafraîchir les détails
                this.viewer.showNormalJobDetails(job);
            }
        }, 100);
    }
}

// Nouvelle méthode pour supprimer un job
deleteJob(jobName) {
    const job = this.viewer.boxes.get(jobName);
    if (!job) return;

    // 1. Retirer des enfants du parent
    if (job.parent) {
        const parentJob = this.viewer.boxes.get(job.parent);
        if (parentJob && parentJob.children) {
            parentJob.children = parentJob.children.filter(child => child.name !== jobName);
        }
    } else {
        // C'est une box racine
        this.viewer.rootBoxes = this.viewer.rootBoxes.filter(box => box.name !== jobName);
    }

    // 2. Retirer de la map des boxes
    this.viewer.boxes.delete(jobName);

    // 3. Retirer de la liste des modifiés
    this.modifiedJobs.delete(jobName);

    // 4. Retirer l'apparence visuelle
    this.viewer.treeRenderer.resetJobAppearance(jobName);

    // 5. Supprimer physiquement du DOM
    const jobElements = document.querySelectorAll(`[data-job="${jobName}"]`);
    jobElements.forEach(element => {
        element.remove();
    });

    console.log(`🗑️ Job ${jobName} supprimé`);
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
generateModifiedJIL() {
    let jilContent = '';
    let jobCount = 0;
    
    this.viewer.boxes.forEach((job, jobName) => {
        jilContent += this.generateJobJIL(job);
        jobCount++;
    });
    
    console.log(`📁 Export JIL complet: ${jobCount} jobs`);
    return jilContent;
}

generateModifiedJobsJIL() {
    if (this.modifiedJobs.size === 0) {
        alert('Aucun job modifié à exporter. Modifiez d\'abord certains attributs dans les détails des jobs.');
        return '';
    }
    
    let jilContent = '';
    let modifiedCount = 0;
    
    this.modifiedJobs.forEach(jobName => {
        const job = this.viewer.boxes.get(jobName);
        if (job) {
            jilContent += this.generateJobJIL(job);
            modifiedCount++;
        }
    });
    
    console.log(`🔄 Export jobs modifiés: ${modifiedCount} jobs`);
    return jilContent;
}

generateJobJIL(job) {
    let jil = '';
    
    // Commentaire avec le nom du job
    jil += `/* ${job.name} - ${job.type} */\n`;
    
    // Ligne insert_job
    jil += `insert_job: ${job.name}\tjob_type: ${job.type}\n`;
    
    // Tous les attributs dans l'ordre standard
    const attributeOrder = [
        'description', 'box_name', 'command', 'machine', 'owner', 
        'permission', 'conditions', 'std_out_file', 'std_err_file',
        'min_run_alarm', 'max_run_alarm', 'alarm_if_fail', 'auto_delete',
        'date_conditions', 'start_times', 'start_mins', 'days_of_week',
        'run_calendar', 'exclude_calendar', 'timezone', 'application',
        'group', 'priority'
    ];
    
    // Ajouter les attributs dans l'ordre
    attributeOrder.forEach(attr => {
        if (job.attributes[attr] && job.attributes[attr] !== '') {
            jil += `${attr}: ${job.attributes[attr]}\n`;
        }
    });
    
    // Ajouter les autres attributs non standard
    Object.entries(job.attributes).forEach(([key, value]) => {
        if (!attributeOrder.includes(key) && value && value !== '') {
            jil += `${key}: ${value}\n`;
        }
    });
    
    jil += '\n'; // Séparation entre les jobs
    
    return jil;
}
}