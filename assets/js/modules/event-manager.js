export class EventManager {
    constructor(viewer) {
        this.viewer = viewer;
    }

    initializeEventListeners() {
        this.initializeFileListeners();
        this.initializeFilterListeners();
        this.initializeActionListeners();
        this.initializeExportListeners();
        this.initializeModalListeners();
    }

    initializeFileListeners() {
        document.getElementById('browseBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.viewer.handleFileSelect(e);
        });
    }

    initializeFilterListeners() {
        document.getElementById('searchFilter').addEventListener('input', (e) => {
            this.viewer.applyFilters();
        });
    }

    initializeActionListeners() {
        document.getElementById('expandAll').addEventListener('click', () => {
            this.viewer.treeRenderer.expandAll();
        });

        document.getElementById('collapseAll').addEventListener('click', () => {
            this.viewer.treeRenderer.collapseAll();
        });

        document.getElementById('resetView').addEventListener('click', () => {
            this.viewer.resetView();
        });
    }

    initializeExportListeners() {
        document.getElementById('exportPNG').addEventListener('click', () => {
            this.viewer.exportManager.exportToPNG();
        });

        document.getElementById('exportPDF').addEventListener('click', () => {
            this.viewer.exportManager.exportToPDF();
        });

        document.getElementById('exportHTML').addEventListener('click', () => {
            this.viewer.exportManager.exportToHTML();
        });
    }

    initializeModalListeners() {
        document.getElementById('aboutBtn').addEventListener('click', () => {
            this.viewer.showAboutModal();
        });
        
        document.getElementById('closeAboutModal').addEventListener('click', () => {
            this.viewer.hideAboutModal();
        });
        
        document.getElementById('aboutModal').addEventListener('click', (e) => {
            if (e.target.id === 'aboutModal') {
                this.viewer.hideAboutModal();
            }
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.viewer.handleFileSelect({ target: { files: files } });
            }
        });
    }
}