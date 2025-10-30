export class ComparisonUI {
    constructor(viewer) {
        this.viewer = viewer;
        this.initializeUI();
    }

    initializeUI() {
        console.log('Initialisation de l\'UI de comparaison...');
        this.setupModeToggle();
        this.setupDropZones();
    }

    setupModeToggle() {
        const modeSingle = document.getElementById('modeSingle');
        const modeCompare = document.getElementById('modeCompare');
        
        if (!modeSingle || !modeCompare) {
            console.error('Boutons de mode non trouvés');
            return;
        }

        modeSingle.addEventListener('click', () => {
            console.log('Mode simple cliqué');
            this.viewer.toggleMode('single');
        });

        modeCompare.addEventListener('click', () => {
            console.log('Mode comparaison cliqué');
            this.viewer.toggleMode('compare');
        });

        console.log('Toggle de mode configuré');
    }

    setupDropZones() {
        const dropLeft = document.getElementById('compareDropLeft');
        const dropRight = document.getElementById('compareDropRight');
        const fileInputLeft = document.querySelector('.compare-file-input[data-side="left"]');
        const fileInputRight = document.querySelector('.compare-file-input[data-side="right"]');
        const startCompare = document.getElementById('startCompare');

        if (dropLeft && fileInputLeft) {
            this.setupDropZone(dropLeft, fileInputLeft, 'left');
        }
        if (dropRight && fileInputRight) {
            this.setupDropZone(dropRight, fileInputRight, 'right');
        }
        if (startCompare) {
            startCompare.addEventListener('click', () => {
                this.viewer.startComparison();
            });
        }
    }

    setupDropZone(dropZone, fileInput, side) {
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.viewer.handleCompareFileSelect(side, e.target.files[0]);
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('active');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('active');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('active');
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.name.endsWith('.jil') || file.name.endsWith('.txt')) {
                    this.viewer.handleCompareFileSelect(side, file);
                } else {
                    alert('Veuillez sélectionner un fichier .jil ou .txt');
                }
            }
        });
    }

    updateModeDisplay(mode) {
        const singleMode = document.querySelector('.single-mode');
        const compareMode = document.querySelector('.compare-mode');
        const modeButtons = document.querySelectorAll('.btn-mode');
        
        if (!singleMode || !compareMode || modeButtons.length === 0) {
            console.error('Éléments d\'UI non trouvés');
            return;
        }

        if (mode === 'compare') {
            singleMode.classList.add('hidden');
            compareMode.classList.remove('hidden');
            modeButtons[0].classList.remove('active');
            modeButtons[1].classList.add('active');
        } else {
            singleMode.classList.remove('hidden');
            compareMode.classList.add('hidden');
            modeButtons[0].classList.add('active');
            modeButtons[1].classList.remove('active');
        }
    }
}
