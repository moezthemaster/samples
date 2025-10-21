export class JILParser {
    constructor() {
        this.boxes = new Map();
        this.rootBoxes = [];
        this.jobOrder = [];
        this.dependencies = new Map();
        this.executionOrder = [];
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
        
        return {
            boxes: this.boxes,
            rootBoxes: this.rootBoxes,
            executionOrder: this.executionOrder
        };
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
}