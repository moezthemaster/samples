export class AnimationManager {
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
