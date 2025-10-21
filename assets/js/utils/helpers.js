export class Helpers {
    static readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static generateJobDetailsHTML(job) {
        const importantAttributes = ['command', 'machine', 'owner', 'condition', 'date_conditions', 'start_times', 'run_calendar', 'exclude_calendar'];
        
        let dependenciesHTML = '';
        if (job.dependsOn.length > 0 || job.requiredBy.length > 0) {
            dependenciesHTML = `
            <div class="detail-section">
                <h4><i class="fas fa-link"></i> Dépendances</h4>
                ${job.attributes.condition ? `
                <div class="detail-item">
                    <span class="detail-label">Condition:</span>
                    <span class="detail-value">${job.attributes.condition}</span>
                </div>
                ` : ''}
                ${job.dependsOn.length > 0 ? `
                <div class="detail-item">
                    <span class="detail-label">Dépend de:</span>
                    <span class="detail-value">${job.dependsOn.join(', ')}</span>
                </div>
                ` : ''}
                ${job.requiredBy.length > 0 ? `
                <div class="detail-item">
                    <span class="detail-label">Requis par:</span>
                    <span class="detail-value">${job.requiredBy.join(', ')}</span>
                </div>
                ` : ''}
            </div>
            `;
        }
        
        return `
            <div class="detail-section">
                <h4><i class="fas fa-id-card"></i> Informations générales</h4>
                <div class="detail-item">
                    <span class="detail-label">Nom:</span>
                    <span class="detail-value">${job.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${job.type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${job.description || 'Non spécifiée'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Parent:</span>
                    <span class="detail-value">${job.parent || 'Aucun (Box racine)'}</span>
                </div>
                ${job.children && job.children.length > 0 ? `
                <div class="detail-item">
                    <span class="detail-label">Enfants:</span>
                    <span class="detail-value">${job.children.length} job(s)</span>
                </div>
                ` : ''}
            </div>
            ${job.attributes.command ? `
            <div class="detail-section">
                <h4><i class="fas fa-terminal"></i> Commande</h4>
                <div class="detail-item">
                    <span class="detail-label">Commande:</span>
                    <span class="detail-value command">${job.attributes.command}</span>
                </div>
            </div>
            ` : ''}

            ${job.attributes.machine ? `
            <div class="detail-section">
                <h4><i class="fas fa-server"></i> Machine</h4>
                <div class="detail-item">
                    <span class="detail-label">Machine:</span>
                    <span class="detail-value">${job.attributes.machine}</span>
                </div>
            </div>
            ` : ''}

            ${dependenciesHTML}

            ${job.attributes.run_calendar || job.attributes.start_times || job.attributes.date_conditions ? `
            <div class="detail-section">
                <h4><i class="fas fa-calendar-alt"></i> Planification</h4>
                ${job.attributes.run_calendar ? `
                <div class="detail-item">
                    <span class="detail-label">Calendrier:</span>
                    <span class="detail-value">${job.attributes.run_calendar}</span>
                </div>
                ` : ''}
                ${job.attributes.start_times ? `
                <div class="detail-item">
                    <span class="detail-label">Heures de début:</span>
                    <span class="detail-value">${job.attributes.start_times}</span>
                </div>
                ` : ''}
                ${job.attributes.date_conditions ? `
                <div class="detail-item">
                    <span class="detail-label">Conditions de date:</span>
                    <span class="detail-value">${job.attributes.date_conditions}</span>
                </div>
                ` : ''}
            </div>
            ` : ''}

            <div class="detail-section">
                <h4><i class="fas fa-cogs"></i> Autres attributs</h4>
                ${Object.entries(job.attributes)
                    .filter(([key]) => !importantAttributes.includes(key))
                    .map(([key, value]) => `
                    <div class="detail-item">
                        <span class="detail-label">${key}:</span>
                        <span class="detail-value">${value}</span>
                    </div>
                    `).join('')}
                ${Object.entries(job.attributes).filter(([key]) => !importantAttributes.includes(key)).length === 0 ? `
                    <div class="detail-item">
                        <span class="detail-label">Aucun autre attribut</span>
                    </div>
                ` : ''}
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-play-circle"></i> Visualisation</h4>
                <div class="animation-controls-preview">
                    <button class="btn-animate" onclick="window.autosysViewer.animationManager.startAnimation('${job.name}')">
                        <i class="fas fa-play"></i> Visualiser l'exécution
                    </button>
                    <small>Montre la propagation depuis ce job</small>
                </div>
            </div>
        `;
    }
}
