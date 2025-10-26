export class JobCreator {
    constructor(viewer) {
        this.viewer = viewer;
    }

    // Ouvrir le modal de création
    openCreateModal(parentJob = null) {
        this.createModal = document.getElementById('createJobModal');
        if (!this.createModal) {
            this.createModalHTML();
        }
        
        this.currentParent = parentJob;
        this.createModal.classList.remove('hidden');
        
        // Pré-remplir le parent si spécifié
        if (parentJob) {
            document.getElementById('createJobParent').value = parentJob.name;
        } else {
            document.getElementById('createJobParent').value = '';
        }
        
        // Réinitialiser le formulaire
        document.getElementById('createJobForm').reset();
    }

    // Créer le HTML du modal
    createModalHTML() {
        const modalHTML = `
            <div id="createJobModal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>📝 Créer un nouveau job</h3>
                        <button class="close-modal" id="closeCreateModal">&times;</button>
                    </div>
                    <form id="createJobForm">
                        <div class="form-group">
                            <label for="createJobName">Nom du job *</label>
                            <input type="text" id="createJobName" required 
                                   placeholder="ex: MY_JOB_001" pattern="[A-Za-z0-9_]+"
                                   title="Seulement lettres, chiffres et underscores">
                        </div>
                        
                        <div class="form-group">
                            <label for="createJobType">Type de job *</label>
                            <select id="createJobType" required>
                                <option value="">Sélectionnez un type</option>
                                <option value="BOX">📦 BOX (Conteneur)</option>
                                <option value="CMD">⚡ CMD (Commande)</option>
                                <option value="FT">📁 FT (File Transfer)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="createJobParent">Job parent (optionnel)</label>
                            <input type="text" id="createJobParent" 
                                   placeholder="Nom du job parent" list="existingJobs">
                            <datalist id="existingJobs">
                                ${this.generateJobsList()}
                            </datalist>
                        </div>
                        
                        <div class="form-group">
                            <label for="createJobDescription">Description</label>
                            <textarea id="createJobDescription" 
                                      placeholder="Description du job..."></textarea>
                        </div>
                        
                        <!-- Champs spécifiques selon le type -->
                        <div id="cmdFields" class="job-type-fields hidden">
                            <div class="form-group">
                                <label for="createJobCommand">Commande *</label>
                                <input type="text" id="createJobCommand" 
                                       placeholder="ex: /path/to/script.sh">
                            </div>
                            <div class="form-group">
                                <label for="createJobMachine">Machine</label>
                                <input type="text" id="createJobMachine" 
                                       placeholder="ex: server01">
                            </div>
                        </div>
                        
                        <div id="ftFields" class="job-type-fields hidden">
                            <div class="form-group">
                                <label for="createJobSource">Fichier source</label>
                                <input type="text" id="createJobSource" 
                                       placeholder="ex: /source/file.txt">
                            </div>
                            <div class="form-group">
                                <label for="createJobDest">Destination</label>
                                <input type="text" id="createJobDest" 
                                       placeholder="ex: /destination/file.txt">
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-cancel" id="cancelCreateJob">Annuler</button>
                            <button type="submit" class="btn-primary">Créer le job</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupModalEvents();
    }

    // Générer la liste des jobs existants pour l'autocomplétion
    generateJobsList() {
        let options = '';
        this.viewer.boxes.forEach((job, jobName) => {
            options += `<option value="${jobName}">`;
        });
        return options;
    }

    // Configurer les événements du modal
// Configurer les événements du modal
setupModalEvents() {
    const setupEvents = () => {
        const closeBtn = document.getElementById('closeCreateModal');
        const cancelBtn = document.getElementById('cancelCreateJob');
        const typeSelect = document.getElementById('createJobType');
        const form = document.getElementById('createJobForm');
        
        if (!closeBtn || !cancelBtn || !typeSelect || !form) {
            console.log('⏳ Éléments du modal pas encore prêts, réessaye...');
            setTimeout(setupEvents, 50);
            return;
        }
        
        // Fermer le modal
        closeBtn.addEventListener('click', () => {
            this.closeCreateModal();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.closeCreateModal();
        });
        
        // Clic à l'extérieur pour fermer
        if (this.createModal) {
            this.createModal.addEventListener('click', (e) => {
                if (e.target === this.createModal) {
                    this.closeCreateModal();
                }
            });
        }
        
        // Changer les champs selon le type
        typeSelect.addEventListener('change', (e) => {
            this.toggleJobTypeFields(e.target.value);
        });
        
        // Soumission du formulaire
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createJob();
        });
        
        console.log('✅ Événements du modal configurés');
    };
    
    // Démarrer la configuration
    setupEvents();
}

    // Afficher/masquer les champs selon le type
    toggleJobTypeFields(jobType) {
        // Masquer tous les champs spécifiques
        document.querySelectorAll('.job-type-fields').forEach(field => {
            field.classList.add('hidden');
        });
        
        // Afficher les champs appropriés
        if (jobType === 'CMD') {
            document.getElementById('cmdFields').classList.remove('hidden');
        } else if (jobType === 'FT') {
            document.getElementById('ftFields').classList.remove('hidden');
        }
    }

    // Créer le job
    createJob() {
        const formData = new FormData(document.getElementById('createJobForm'));
        const jobData = {
            name: document.getElementById('createJobName').value.trim(),
            type: document.getElementById('createJobType').value,
            parent: document.getElementById('createJobParent').value.trim() || null,
            description: document.getElementById('createJobDescription').value.trim(),
            command: document.getElementById('createJobCommand')?.value.trim(),
            machine: document.getElementById('createJobMachine')?.value.trim(),
            sourceFile: document.getElementById('createJobSource')?.value.trim(),
            destFile: document.getElementById('createJobDest')?.value.trim()
        };
        
        // Validation
        if (!this.validateJobData(jobData)) {
            return;
        }
        
        // Créer l'objet job
        const newJob = this.buildJobObject(jobData);
        
        // Ajouter au viewer
        this.addJobToViewer(newJob, jobData.parent);
        
        // Fermer le modal et rafraîchir
        this.closeCreateModal();
        this.viewer.showNotification(`Job "${jobData.name}" créé avec succès !`, 'success');
        
        // Sélectionner le nouveau job
        setTimeout(() => {
            this.viewer.selectJob(newJob);
        }, 500);
    }

    // Valider les données
    validateJobData(jobData) {
        // Vérifier le nom
        if (!jobData.name) {
            alert('Le nom du job est obligatoire');
            return false;
        }
        
        // Vérifier que le nom n'existe pas déjà
        if (this.viewer.boxes.has(jobData.name)) {
            alert(`Un job avec le nom "${jobData.name}" existe déjà`);
            return false;
        }
        
        // Vérifier le type
        if (!jobData.type) {
            alert('Le type de job est obligatoire');
            return false;
        }
        
        // Validation spécifique selon le type
        if (jobData.type === 'CMD' && !jobData.command) {
            alert('La commande est obligatoire pour un job CMD');
            return false;
        }
        
        // Vérifier le parent s'il est spécifié
        if (jobData.parent && !this.viewer.boxes.has(jobData.parent)) {
            alert(`Le job parent "${jobData.parent}" n'existe pas`);
            return false;
        }
        
        return true;
    }

    // Construire l'objet job
    buildJobObject(jobData) {
        const job = {
            name: jobData.name,
            type: jobData.type,
            attributes: {
                description: jobData.description || ''
            },
            children: [],
            dependsOn: [],
            requiredBy: [],
            modified: true // Marquer comme modifié pour l'export
        };
        
        // Ajouter les attributs spécifiques
        if (jobData.type === 'CMD') {
            job.attributes.command = jobData.command;
            if (jobData.machine) {
                job.attributes.machine = jobData.machine;
            }
        } else if (jobData.type === 'FT') {
            if (jobData.sourceFile) job.attributes.source_file = jobData.sourceFile;
            if (jobData.destFile) job.attributes.dest_file = jobData.destFile;
        }
        
        return job;
    }

    // Ajouter le job au viewer
    addJobToViewer(newJob, parentName) {
        // Ajouter à la map des boxes
        this.viewer.boxes.set(newJob.name, newJob);
        
        // Gérer le parent
        if (parentName) {
            const parentJob = this.viewer.boxes.get(parentName);
            if (parentJob && parentJob.type === 'BOX') {
                newJob.parent = parentName;
                if (!parentJob.children) parentJob.children = [];
                parentJob.children.push(newJob);
            }
        } else {
            // C'est une box racine
            this.viewer.rootBoxes.push(newJob);
        }
        
        // Marquer comme modifié dans l'edition manager
        this.viewer.editionManager.modifiedJobs.add(newJob.name);
        
        // Rafraîchir l'affichage
        this.viewer.applyFilters();
        
        // Développer le parent pour voir le nouveau job
        if (parentName) {
            setTimeout(() => {
                const parentNode = document.querySelector(`[data-job="${parentName}"]`);
                if (parentNode) {
                    parentNode.classList.add('expanded');
                    parentNode.classList.remove('collapsed');
                }
            }, 100);
        }
    }

    closeCreateModal() {
        if (this.createModal) {
            this.createModal.classList.add('hidden');
        }
    }
}