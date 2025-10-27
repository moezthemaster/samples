export class JobCreator {
    constructor(viewer) {
        this.viewer = viewer;
    }

    // Ouvrir le modal de création

openCreateModal(parentJob = null) {
    if (!this.createModal) {
        this.createModalHTML();
    } else {
        this.createModal = document.getElementById('createJobModal');
    }
    
    this.currentParent = parentJob;
    this.createModal.classList.remove('hidden');
    
    // Générer les datalists d'autocomplétion
    this.generateDataLists();
    
    // Pré-remplir le parent si spécifié
    if (parentJob) {
        document.getElementById('createJobParent').value = parentJob.name;
    } else {
        document.getElementById('createJobParent').value = '';
    }
    
    // Essayer de pré-remplir l'application avec une valeur courante
    this.preFillApplication();
    
    // Réinitialiser le formulaire et les onglets
    document.getElementById('createJobForm').reset();
    this.toggleJobTypeFields(''); // Masquer tous les champs spécifiques
    this.switchToTab('basic'); // Revenir à l'onglet général
    
    console.log('✅ Modal création ouvert - Application obligatoire');
}

preFillApplication() {
    const appInput = document.getElementById('createJobApplication');
    if (!appInput) return;
    
    // Chercher une application courante dans les jobs existants
    for (const [jobName, job] of this.viewer.boxes) {
        if (job.attributes.application) {
            appInput.value = job.attributes.application;
            console.log('📋 Application pré-remplie:', job.attributes.application);
            break;
        }
    }
    
    // Focus sur le champ Application s'il est vide
    if (!appInput.value) {
        setTimeout(() => {
            appInput.focus();
        }, 100);
    }
}
    // Créer le HTML du modal
// Créer le HTML du modal
createModalHTML() {
    const modalHTML = `
        <div id="createJobModal" class="modal-overlay hidden">
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-plus-circle"></i> Créer un nouveau job</h3>
                    <button class="modal-close" id="closeCreateModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="createJobForm">
                    <div class="form-tabs">
                        <button type="button" class="tab-btn active" data-tab="basic">Général</button>
                        <button type="button" class="tab-btn" data-tab="schedule">Planification</button>
                        <button type="button" class="tab-btn" data-tab="dependencies">Dépendances</button>
                        <button type="button" class="tab-btn" data-tab="advanced">Avancé</button>
                    </div>
                    <div class="tab-content">
                        <!-- ONGLET GÉNÉRAL -->
                        <div id="tab-basic" class="tab-pane active">
                            <div class="form-group">
                                <label for="createJobName">Nom du job *</label>
                                <input type="text" id="createJobName" required 
                                       placeholder="ex: DAILY_BACKUP_JOB" pattern="[A-Za-z0-9_]+"
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
                                <label for="createJobApplication">Application *</label>
                                <input type="text" id="createJobApplication" list="existingApplications"
                                       placeholder="ex: MY_APPLICATION">
                                <datalist id="existingApplications"></datalist>
                            </div>                            
                            <div class="form-group">
                                <label for="createJobParent">Job parent (optionnel)</label>
                                <input type="text" id="createJobParent" 
                                       placeholder="Nom du job parent" list="existingJobs">
                                <datalist id="existingJobs"></datalist>
                            </div>
                            
                            <div class="form-group">
                                <label for="createJobDescription">Description</label>
                                <textarea id="createJobDescription" 
                                          placeholder="Description du job..."></textarea>
                            </div>

                            <div class="form-group">
                                <label for="createJobOwner">Owner</label>
                                <input type="text" id="createJobOwner" list="existingOwners" 
                                       placeholder="ex: autosys_user">
                                <datalist id="existingOwners"></datalist>
                            </div>

                            <!-- Champs spécifiques selon le type -->
                            <div id="cmdFields" class="job-type-fields hidden">
                                <div class="form-group">
                                    <label for="createJobCommand">Commande *</label>
                                    <input type="text" id="createJobCommand" 
                                           placeholder="ex: /scripts/backup.sh">
                                </div>
                                <div class="form-group">
                                    <label for="createJobMachine">Machine *</label>
                                    <input type="text" id="createJobMachine" list="existingMachines"
                                           placeholder="ex: server01">
                                    <datalist id="existingMachines"></datalist>
                                </div>
                            </div>
                            
                                <div id="ftFields" class="job-type-fields hidden">
                                    <div class="form-group">
                                        <label for="createJobSource">Fichier source *</label>
                                        <input type="text" id="createJobSource" 
                                               placeholder="ex: /data/input/file.txt">
                                    </div>
                                    <div class="form-group">
                                        <label for="createJobDest">Destination *</label>
                                        <input type="text" id="createJobDest" 
                                               placeholder="ex: /data/output/file.txt">
                                    </div>
                                    <div class="form-group">
                                        <label for="createJobMachineFT">Machine *</label>  <!-- ID CORRECT -->
                                        <input type="text" id="createJobMachineFT" list="existingMachines"
                                               placeholder="ex: server01">
                                        <datalist id="existingMachines"></datalist>
                                    </div>
                                </div>
                        </div>

                        <!-- ONGLET PLANIFICATION -->
                        <div id="tab-schedule" class="tab-pane">
                            <div class="form-group">
                                <label for="createJobStartTimes">Heures de début</label>
                                <input type="text" id="createJobStartTimes" 
                                       placeholder="ex: 08:00,12:00,18:00">
                                <small>Heures séparées par des virgules</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="createJobDaysOfWeek">Jours de la semaine</label>
                                <select id="createJobDaysOfWeek" multiple>
                                    <option value="su">Dimanche</option>
                                    <option value="mo">Lundi</option>
                                    <option value="tu">Mardi</option>
                                    <option value="we">Mercredi</option>
                                    <option value="th">Jeudi</option>
                                    <option value="fr">Vendredi</option>
                                    <option value="sa">Samedi</option>
                                </select>
                                <small>Maintenez Ctrl pour sélection multiple</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="createJobRunCalendar">Calendrier d'exécution</label>
                                <input type="text" id="createJobRunCalendar" list="existingRunCalendars"
                                       placeholder="ex: BUSINESS_DAYS">
                                <datalist id="existingRunCalendars"></datalist>
                            </div>
                            
                            <div class="form-group">
                                <label for="createJobExcludeCalendar">Calendrier d'exclusion</label>
                                <input type="text" id="createJobExcludeCalendar" list="existingExcludeCalendars"
                                       placeholder="ex: HOLIDAYS">
                                <datalist id="existingExcludeCalendars"></datalist>
                            </div>
                            
                            <div class="form-group">
                                <label for="createJobDateConditions">Conditions de date</label>
                                <input type="text" id="createJobDateConditions" 
                                       placeholder="ex: Mar-15,Jun-21,Dec-25">
                            </div>
                        </div>

                        <!-- ONGLET DÉPENDANCES -->
                        <div id="tab-dependencies" class="tab-pane">
                            <div class="form-group">
                                <label for="createJobCondition">Condition</label>
                                <input type="text" id="createJobCondition" 
                                       placeholder="ex: success(PRECEDENT_JOB)">
                                <small>Ex: success(JOB_A), failure(JOB_B), s(JOB_A) & f(JOB_B)</small>
                            </div>
                            
                            <div class="form-group field-cmd">
                                <label for="createJobWatchFile">Fichier à surveiller</label>
                                <input type="text" id="createJobWatchFile" 
                                       placeholder="ex: /data/trigger.file">
                            </div>
                            
                            <div class="form-group field-cmd">
                                <label for="createJobWatchFileMinSize">Taille minimale fichier (octets)</label>
                                <input type="number" id="createJobWatchFileMinSize" 
                                       placeholder="ex: 1024">
                            </div>
                        </div>

                        <!-- ONGLET AVANCÉ -->
                        <div id="tab-advanced" class="tab-pane">
                            <div class="form-group field-cmd field-ft">
                                <label for="createJobStdOutFile">Fichier STDOUT</label>
                                <input type="text" id="createJobStdOutFile" 
                                       placeholder="ex: /logs/job.out">
                            </div>
                            
                            <div class="form-group field-cmd field-ft">
                                <label for="createJobStdErrFile">Fichier STDERR</label>
                                <input type="text" id="createJobStdErrFile" 
                                       placeholder="ex: /logs/job.err">
                            </div>
                            
                            <div class="form-group field-cmd">
                                <label for="createJobProfile">Profile</label>
                                <input type="text" id="createJobProfile" list="existingProfiles"
                                       placeholder="ex: /etc/profile">
                                <datalist id="existingProfiles"></datalist>
                            </div>
                            
                            <!-- Priorité pour tous les types -->
                            <div class="form-group">
                                <label for="createJobPriority">Priorité</label>
                                <input type="number" id="createJobPriority" 
                                       placeholder="ex: 100" min="0" max="999">
                            </div>
                            
                            <!-- Max Exit Success pour BOX et CMD/FT -->
                            <div class="form-group">
                                <label for="createJobMaxExitSuccess">Code de sortie max pour succès</label>
                                <input type="number" id="createJobMaxExitSuccess" 
                                       placeholder="ex: 0" value="0">
                            </div>
                            
                            <div class="form-group field-cmd field-ft">
                                <label for="createJobAlarmIfFail">Alarme si échec</label>
                                <select id="createJobAlarmIfFail">
                                    <option value="true">Oui</option>
                                    <option value="false" selected>Non</option>
                                </select>
                            </div>
                            
                            <div class="form-group field-cmd field-ft">
                                <label for="createJobAutoDelete">Auto-suppression</label>
                                <select id="createJobAutoDelete">
                                    <option value="true">Oui</option>
                                    <option value="false" selected>Non</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="createJobGroup">Groupe</label>
                                <input type="text" id="createJobGroup" list="existingGroups"
                                       placeholder="ex: BATCH_GROUP">
                                <datalist id="existingGroups"></datalist>
                            </div>
                            
                            <div class="form-group field-cmd field-ft">
                                <label for="createJobPermission">Permissions</label>
                                <input type="text" id="createJobPermission" 
                                       placeholder="ex: rxw">
                            </div>
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
    this.attachModalEvents();
}

// Attacher les événements après création du HTML
attachModalEvents() {
    const closeBtn = document.getElementById('closeCreateModal');
    const cancelBtn = document.getElementById('cancelCreateJob');
    const typeSelect = document.getElementById('createJobType');
    const form = document.getElementById('createJobForm');
    this.createModal = document.getElementById('createJobModal');

    
    // Vérifier que tous les éléments essentiels existent
    if (!closeBtn || !cancelBtn || !typeSelect || !form || !this.createModal) {
        console.error('❌ Éléments essentiels du modal non trouvés:', {
            closeBtn: !!closeBtn,
            cancelBtn: !!cancelBtn,
            typeSelect: !!typeSelect,
            form: !!form,
            createModal: !!this.createModal
        });
        return;
    }

    // Vérifier que tous les éléments du formulaire existent
const requiredElements = [
    'createJobName', 'createJobType', 'createJobParent', 'createJobDescription',
    'createJobOwner', 'createJobCommand', 'createJobMachine', 'createJobSource',
    'createJobDest', 'createJobMachineFT', // CORRIGÉ
    'createJobStartTimes', 'createJobDaysOfWeek', 'createJobRunCalendar', 
    'createJobExcludeCalendar', 'createJobDateConditions', 'createJobCondition', 
    'createJobWatchFile', 'createJobWatchFileMinSize', 'createJobStdOutFile', 
    'createJobStdErrFile', 'createJobProfile', 'createJobPriority', 
    'createJobMaxExitSuccess', 'createJobAlarmIfFail', 'createJobAutoDelete',
    'createJobApplication', 'createJobGroup', 'createJobPermission'
];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        console.warn('⚠️ Éléments manquants dans le formulaire:', missingElements);
    } else {
        console.log('✅ Tous les éléments du formulaire trouvés');
    }
    
    // Fermer le modal
    closeBtn.addEventListener('click', () => {
        console.log('❌ Fermeture modal création');
        this.closeCreateModal();
    });
    
    cancelBtn.addEventListener('click', () => {
        console.log('❌ Annulation création job');
        this.closeCreateModal();
    });
    
    // Clic à l'extérieur pour fermer
    this.createModal.addEventListener('click', (e) => {
        if (e.target === this.createModal) {
            console.log('🎯 Clic à l\'extérieur du modal');
            this.closeCreateModal();
        }
    });
    
    // Changer les champs selon le type
    typeSelect.addEventListener('change', (e) => {
        console.log('🔄 Changement type job:', e.target.value);
        this.toggleJobTypeFields(e.target.value);
    });
    
    // Gestion des tabs
    this.setupTabs();
    
    // Soumission du formulaire
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('📝 Soumission formulaire création job');
        this.createJob();
    });
    
    // Événement Escape pour fermer le modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.createModal.classList.contains('hidden')) {
            console.log('⌨️ Fermeture par Escape');
            this.closeCreateModal();
        }
    });
    
    console.log('✅ Événements du modal configurés avec succès');
}

// Configuration des tabs
setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    if (tabBtns.length === 0 || tabPanes.length === 0) {
        console.error('❌ Tabs non trouvés');
        return;
    }
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            console.log('📑 Changement onglet:', tabId);
            
            // Désactiver tous les tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Activer le tab sélectionné
            btn.classList.add('active');
            
            const targetPane = document.getElementById(`tab-${tabId}`);
            if (targetPane) {
                targetPane.classList.add('active');
            } else {
                console.error('❌ Panneau tab non trouvé:', `tab-${tabId}`);
            }
        });
    });
    
    console.log('✅ Tabs configurés');
}

// Afficher/masquer les champs selon le type
toggleJobTypeFields(jobType) {
    console.log('🎛️  Configuration champs pour type:', jobType);
    
    // Masquer tous les champs spécifiques
    const allFields = document.querySelectorAll('.job-type-fields');
    if (allFields) {
        allFields.forEach(field => {
            if (field) field.classList.add('hidden');
        });
    }
    
    // Afficher les champs appropriés
    if (jobType === 'CMD') {
        const cmdFields = document.getElementById('cmdFields');
        if (cmdFields) {
            cmdFields.classList.remove('hidden');
            console.log('✅ Affichage champs CMD');
        }
    } else if (jobType === 'FT') {
        const ftFields = document.getElementById('ftFields');
        if (ftFields) {
            ftFields.classList.remove('hidden');
            console.log('✅ Affichage champs FT');
        }
    } else if (jobType === 'BOX') {
        console.log('✅ Type BOX - pas de champs spécifiques supplémentaires');
    }
    
    // Afficher seulement les onglets pertinents
    this.toggleRelevantTabs(jobType);
}

// Afficher seulement les onglets pertinents selon le type
toggleRelevantTabs(jobType) {
    const tabs = {
        'basic': true, // Toujours visible
        'schedule': true, // Planification pour tous les types
        'dependencies': true, // Dépendances pour tous les types  
        'advanced': jobType !== 'BOX' // Avancé surtout pour CMD/FT
    };
    
    document.querySelectorAll('.tab-btn').forEach(tabBtn => {
        const tabName = tabBtn.getAttribute('data-tab');
        if (tabs[tabName]) {
            tabBtn.style.display = 'block';
        } else {
            tabBtn.style.display = 'none';
        }
    });
    
    // Revenir à l'onglet Général si l'onglet actuel est masqué
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && activeTab.style.display === 'none') {
        this.switchToTab('basic');
    }
    
    console.log('🎛️  Onglets configurés pour type:', jobType);
}

// Changer d'onglet
switchToTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const targetPane = document.getElementById(`tab-${tabName}`);
    
    if (targetBtn && targetPane) {
        targetBtn.classList.add('active');
        targetPane.classList.add('active');
        console.log('📑 Navigation vers onglet:', tabName);
    } else {
        console.error('❌ Tab ou panneau non trouvé:', tabName);
    }
}

// Fermer le modal
closeCreateModal() {
    if (this.createModal) {
        this.createModal.classList.add('hidden');
        console.log('✅ Modal création fermé');
    }
}

// Configuration des tabs
setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Désactiver tous les tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Activer le tab sélectionné
            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
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
// Afficher/masquer les champs selon le type
toggleJobTypeFields(jobType) {
    // Masquer tous les champs spécifiques
    document.querySelectorAll('.job-type-fields').forEach(field => {
        if (field) field.classList.add('hidden');
    });
    
    // Masquer les onglets non pertinents
    this.toggleRelevantTabs(jobType);
    
    // Afficher les champs appropriés
    if (jobType === 'CMD') {
        const cmdFields = document.getElementById('cmdFields');
        if (cmdFields) cmdFields.classList.remove('hidden');
    } else if (jobType === 'FT') {
        const ftFields = document.getElementById('ftFields');
        if (ftFields) ftFields.classList.remove('hidden');
    }
    // BOX n'a pas de champs spécifiques supplémentaires
}

// Afficher seulement les onglets pertinents selon le type
// Afficher seulement les onglets pertinents selon le type
toggleRelevantTabs(jobType) {
    const tabs = {
        'basic': true, // Toujours visible
        'schedule': true, // Planification pour tous les types
        'dependencies': true, // Dépendances pour tous les types  
        'advanced': jobType !== 'BOX' // Avancé surtout pour CMD/FT
    };
    
    document.querySelectorAll('.tab-btn').forEach(tabBtn => {
        const tabName = tabBtn.getAttribute('data-tab');
        if (tabs[tabName]) {
            tabBtn.style.display = 'block';
        } else {
            tabBtn.style.display = 'none';
        }
    });
    
    // Revenir à l'onglet Général si l'onglet actuel est masqué
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && activeTab.style.display === 'none') {
        this.switchToTab('basic');
    }
}

// Changer d'onglet
switchToTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const targetPane = document.getElementById(`tab-${tabName}`);
    
    if (targetBtn && targetPane) {
        targetBtn.classList.add('active');
        targetPane.classList.add('active');
    }
}

    // Créer le job
// Créer le job
// Créer le job
createJob() {
    // Récupérer les éléments en vérifiant leur existence
    const getValue = (id) => {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    };

    const getSelectValue = (id) => {
        const element = document.getElementById(id);
        return element ? element.value : '';
    };

    const getMultipleSelectValues = (id) => {
        const element = document.getElementById(id);
        if (!element) return '';
        return Array.from(element.selectedOptions)
                   .map(opt => opt.value)
                   .join(',');
    };

    const jobData = {
        // Onglet Général
        name: getValue('createJobName'),
        type: getValue('createJobType'),
        application: getValue('createJobApplication'),
        parent: getValue('createJobParent'),
        description: getValue('createJobDescription'),
        owner: getValue('createJobOwner'),
        
        // Champs CMD
        command: getValue('createJobCommand'),
        machine: getValue('createJobMachine'),
        
        // Champs FT  
        sourceFile: getValue('createJobSource'),
        destFile: getValue('createJobDest'),
        machineFT: getValue('createJobMachineFT'),
        
        // Onglet Planification
        startTimes: getValue('createJobStartTimes'),
        daysOfWeek: getMultipleSelectValues('createJobDaysOfWeek'),
        runCalendar: getValue('createJobRunCalendar'),
        excludeCalendar: getValue('createJobExcludeCalendar'),
        dateConditions: getValue('createJobDateConditions'),
        
        // Onglet Dépendances
        condition: getValue('createJobCondition'),
        watchFile: getValue('createJobWatchFile'),
        watchFileMinSize: getValue('createJobWatchFileMinSize'),
        
        // Onglet Avancé
        stdOutFile: getValue('createJobStdOutFile'),
        stdErrFile: getValue('createJobStdErrFile'),
        profile: getValue('createJobProfile'),
        priority: getValue('createJobPriority'),
        maxExitSuccess: getValue('createJobMaxExitSuccess'),
        alarmIfFail: getSelectValue('createJobAlarmIfFail'),
        autoDelete: getSelectValue('createJobAutoDelete'),
        group: getValue('createJobGroup'),
        permission: getValue('createJobPermission')
    };
    
    console.log('📝 Données du formulaire:', jobData);
    
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

// Valider les données selon le type
validateJobData(jobData) {
    console.log('🔍 Validation des données:', jobData);
    
    // Validation de base
    if (!jobData.name) {
        alert('Le nom du job est obligatoire');
        return false;
    }
    
    if (this.viewer.boxes.has(jobData.name)) {
        alert(`Un job avec le nom "${jobData.name}" existe déjà`);
        return false;
    }
    
    if (!jobData.type) {
        alert('Le type de job est obligatoire');
        return false;
    }
    
    // Application est obligatoire pour tous les types
    if (!jobData.application) {
        alert('Le champ application est obligatoire');
        return false;
    }
    
    // Validation spécifique selon le type
    if (jobData.type === 'CMD') {
        if (!jobData.command) {
            alert('La commande est obligatoire pour un job CMD');
            return false;
        }
        if (!jobData.machine) {
            alert('La machine est obligatoire pour un job CMD');
            return false;
        }
    } else if (jobData.type === 'FT') {
        if (!jobData.sourceFile || !jobData.destFile) {
            alert('Les fichiers source et destination sont obligatoires pour un job FT');
            return false;
        }
        if (!jobData.machineFT) {
            alert('La machine est obligatoire pour un job FT');
            return false;
        }
    }
    // BOX n'a pas de validation spécifique supplémentaire
    
    // Vérifier le parent s'il est spécifié
    if (jobData.parent) {
        const parentJob = this.viewer.boxes.get(jobData.parent);
        if (!parentJob) {
            alert(`Le job parent "${jobData.parent}" n'existe pas`);
            return false;
        }
        if (parentJob.type !== 'BOX') {
            alert(`Le job parent "${jobData.parent}" doit être une BOX`);
            return false;
        }
    }
    
    return true;
}
    // Construire l'objet job

// Construire l'objet job avec les vraies propriétés Autosys
buildJobObject(jobData) {
    console.log('🔨 Construction job avec données:', jobData);
    
    // VÉRIFICATION CRITIQUE
    if (!jobData.name) {
        console.error('❌ jobData.name manquant:', jobData);
        throw new Error('Nom du job manquant');
    }
    if (!jobData.type) {
        console.error('❌ jobData.type manquant:', jobData);
        throw new Error('Type de job manquant');
    }
    if (!jobData.application) {
        console.error('❌ jobData.application manquant:', jobData);
        throw new Error('Application manquante');
    }
    
    const job = {
        name: jobData.name,
        type: jobData.type,
        attributes: {
            application: jobData.application // TOUJOURS DÉFINI
        },
        children: jobData.type === 'BOX' ? [] : undefined,
        dependsOn: [],
        requiredBy: [],
        modified: true
    };
    
    // Ajouter les autres attributs seulement s'ils existent
    const optionalAttributes = {
        // Général
        description: jobData.description,
        owner: jobData.owner,
        group: jobData.group,
        
        // Spécifique CMD
        command: jobData.command,
        machine: jobData.machine,
        profile: jobData.profile,
        permission: jobData.permission,
        
        // Spécifique FT
        source_file: jobData.sourceFile,
        dest_file: jobData.destFile,
        
        // Planification
        start_times: jobData.startTimes,
        days_of_week: jobData.daysOfWeek,
        run_calendar: jobData.runCalendar,
        exclude_calendar: jobData.excludeCalendar,
        date_conditions: jobData.dateConditions,
        
        // Dépendances
        condition: jobData.condition,
        watch_file: jobData.watchFile,
        watch_file_min_size: jobData.watchFileMinSize,
        
        // Avancé
        std_out_file: jobData.stdOutFile,
        std_err_file: jobData.stdErrFile,
        priority: jobData.priority,
        max_exit_success: jobData.maxExitSuccess,
        alarm_if_fail: jobData.alarmIfFail,
        auto_delete: jobData.autoDelete,
        
        // Propriétés BOX
        box_success: jobData.boxSuccess,
        box_failure: jobData.boxFailure,
        
        // Autres propriétés Autosys
        min_run_alarm: jobData.minRunAlarm,
        max_run_alarm: jobData.maxRunAlarm,
        timezone: jobData.timezone
    };
    
    Object.entries(optionalAttributes).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            job.attributes[key] = value;
        }
    });
    
    // GESTION SPÉCIFIQUE POUR LA MACHINE FT
    if (jobData.type === 'FT' && jobData.machineFT) {
        job.attributes.machine = jobData.machineFT;
    }

    console.log('✅ Job créé avec succès:', job);
    console.log('📋 Détails des attributs:', job.attributes);
    return job;
}

addJobToViewer(newJob, parentName) {
    // VÉRIFICATIONS DE SÉCURITÉ
    if (!newJob) {
        console.error('❌ Job est undefined dans addJobToViewer');
        return;
    }
    
    if (!newJob.name) {
        console.error('❌ Job name manquant dans addJobToViewer:', newJob);
        return;
    }
    
    console.log('🔨 Ajout du job au viewer:', newJob.name, 'Parent:', parentName);
    
    // Ajouter à la map des boxes
    this.viewer.boxes.set(newJob.name, newJob);
    
    // Gérer le parent - VÉRIFICATIONS RENFORCÉES
    if (parentName && parentName.trim() !== '') {
        const parentJob = this.viewer.boxes.get(parentName);
        console.log('🔍 Parent job trouvé:', parentJob);
        
        if (parentJob && parentJob.type === 'BOX') {
            newJob.parent = parentName;
            if (!parentJob.children) {
                parentJob.children = [];
            }
            parentJob.children.push(newJob);
            console.log('✅ Job ajouté comme enfant de:', parentName);
        } else {
            console.warn('⚠️ Parent non trouvé ou pas une BOX:', parentName);
            // Si le parent n'existe pas, ajouter comme racine
            this.viewer.rootBoxes.push(newJob);
            console.log('✅ Job ajouté comme box racine (parent invalide)');
        }
    } else {
        // C'est une box racine
        this.viewer.rootBoxes.push(newJob);
        console.log('✅ Job ajouté comme box racine');
    }
    
    // Marquer comme modifié dans l'edition manager - AVEC VÉRIFICATION
    if (this.viewer.editionManager) {
        this.viewer.editionManager.modifiedJobs.add(newJob.name);
        this.viewer.editionManager.originalValues.set(newJob.name, new Map());
    } else {
        console.warn('⚠️ EditionManager non disponible');
    }
    
    // Regénérer les datalists avec les nouvelles valeurs
    this.generateDataLists();
    
    // Rafraîchir l'affichage - AVEC VÉRIFICATION
    if (this.viewer.applyFilters) {
        this.viewer.applyFilters();
    } else {
        console.warn('⚠️ applyFilters non disponible');
    }
    
    // Développer le parent pour voir le nouveau job - AVEC VÉRIFICATION
    if (parentName && parentName.trim() !== '') {
        setTimeout(() => {
            try {
                const parentNode = document.querySelector(`[data-job="${parentName}"]`);
                if (parentNode) {
                    parentNode.classList.add('expanded');
                    parentNode.classList.remove('collapsed');
                    console.log('📂 Parent développé:', parentName);
                } else {
                    console.warn('⚠️ Parent node non trouvé dans le DOM:', parentName);
                }
            } catch (error) {
                console.error('❌ Erreur lors du développement du parent:', error);
            }
        }, 100);
    }
    
    console.log('✅ Job ajouté avec succès:', newJob.name);
    
    // DEBUG: Vérifier l'état final
    console.log('📊 État après ajout:', {
        totalJobs: this.viewer.boxes.size,
        rootBoxes: this.viewer.rootBoxes.length,
        jobDetails: newJob
    });
}


// Générer les datalists pour l'autocomplétion
generateDataLists() {
    const attributes = {
        'existingJobs': new Set(), // POUR JOB PARENT
        'existingApplications': new Set(),
        'existingOwners': new Set(),
        'existingMachines': new Set(),
        'existingGroups': new Set(),
        'existingRunCalendars': new Set(),
        'existingExcludeCalendars': new Set(),
        'existingProfiles': new Set()
    };

    // Collecter toutes les valeurs existantes
    this.viewer.boxes.forEach((job) => {
        // Pour Job parent - seulement les BOX peuvent être parents
        if (job.type === 'BOX') {
            attributes.existingJobs.add(job.name);
        }
        
        if (job.attributes.application) attributes.existingApplications.add(job.attributes.application);
        if (job.attributes.owner) attributes.existingOwners.add(job.attributes.owner);
        if (job.attributes.machine) attributes.existingMachines.add(job.attributes.machine);
        if (job.attributes.group) attributes.existingGroups.add(job.attributes.group);
        if (job.attributes.run_calendar) attributes.existingRunCalendars.add(job.attributes.run_calendar);
        if (job.attributes.exclude_calendar) attributes.existingExcludeCalendars.add(job.attributes.exclude_calendar);
        if (job.attributes.profile) attributes.existingProfiles.add(job.attributes.profile);
    });

    // Créer les datalists dans le DOM
    Object.keys(attributes).forEach(datalistId => {
        let datalist = document.getElementById(datalistId);
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = datalistId;
            document.body.appendChild(datalist);
        }
        
        // Vider et remplir le datalist
        datalist.innerHTML = '';
        attributes[datalistId].forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            datalist.appendChild(option);
        });
        
        console.log(`📋 Datalist ${datalistId}:`, Array.from(attributes[datalistId]));
    });

    console.log('✅ Datalists générés - Job parent inclus');
}
    closeCreateModal() {
        if (this.createModal) {
            this.createModal.classList.add('hidden');
        }
    }
}