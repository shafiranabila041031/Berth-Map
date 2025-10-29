document.addEventListener('DOMContentLoaded', () => {
    const KD_MARKERS = Array.from({ length: (650 - 330) / 10 + 1 }, (_, i) => 330 + i * 10);
    const HOUR_WIDTH = 50;
    const KD_HEIGHT_UNIT = 40;
    const KD_MIN = Math.min(...KD_MARKERS);
    const PENDING_FORM_KEY = 'pendingShipForm';

    let shipSchedules = JSON.parse(localStorage.getItem('shipSchedules')) || [];
    let editingShipIndex = null;
    let currentStartDate = getStartOfWeek(new Date());

    let maintenanceSchedules = JSON.parse(localStorage.getItem('maintenanceSchedules')) || [];
    let editingMaintenanceIndex = null;

    let restSchedules = JSON.parse(localStorage.getItem('restSchedules')) || [];
    let editingRestIndex = null;

    let draggableLineLeft = JSON.parse(localStorage.getItem('draggableLinePosition')) || 200; 

    const grid = document.getElementById('grid');
    const yAxis = document.querySelector('.y-axis');
    const xAxis = document.querySelector('.x-axis');
    const hourAxis = document.getElementById('hour-axis');
    const modal = document.getElementById('ship-modal');
    const addShipBtn = document.getElementById('add-ship-btn');
    const closeModalBtn = modal.querySelector('.close-btn');
    const shipForm = document.getElementById('ship-form');
    const modalTitle = document.getElementById('modal-title');
    const formSubmitBtn = shipForm.querySelector('button[type="submit"]');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const weekRangeDisplay = document.getElementById('week-range-display');
    const clearDataBtn = document.getElementById('clear-data-btn');
    const berthLabelsContainer = document.querySelector('.berth-labels-container');
    const berthMapContainer = document.getElementById('berth-map-container');

    const addMaintenanceBtn = document.getElementById('add-maintenance-btn');
    const maintenanceModal = document.getElementById('maintenance-modal');
    const maintenanceCloseBtn = maintenanceModal.querySelector('.close-btn');
    const maintenanceForm = document.getElementById('maintenance-form');
    const maintenanceModalTitle = document.getElementById('maintenance-modal-title');
    const maintenanceSubmitBtn = maintenanceForm.querySelector('button[type="submit"]');

    const addRestBtn = document.getElementById('add-rest-btn');
    const restModal = document.getElementById('rest-modal');
    const restCloseBtn = restModal.querySelector('.close-btn');
    const restForm = document.getElementById('rest-form');
    const restModalTitle = document.getElementById('rest-modal-title');
    const restSubmitBtn = restForm.querySelector('button[type="submit"]');

    const deleteShipBtn = document.getElementById('delete-ship-btn');
    const deleteMaintenanceBtn = document.getElementById('delete-maintenance-btn');
    const deleteRestBtn = document.getElementById('delete-rest-btn');

    const berthDividerLine = document.getElementById('berth-divider-line');
    const currentTimeIndicator = document.getElementById('current-time-indicator'); // Tetap pakai ID ini

    function renderShips() {
        grid.querySelectorAll('.ship-wrapper').forEach(el => el.remove());

        const weekStart = new Date(currentStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const visibleShips = shipSchedules.filter(ship => {
            if (!ship.etaTime || !ship.endTime) {
                 console.warn("Skipping ship due to missing dates:", ship);
                 return false;
            }
            const shipETA = new Date(ship.etaTime);
            const shipETD = new Date(ship.endTime);
            if (isNaN(shipETA) || isNaN(shipETD)) {
                console.warn("Skipping ship due to invalid date format:", ship);
                return false;
            }
            return shipETA < weekEnd && shipETD > weekStart;
        });

        visibleShips.forEach((ship) => {
            const shipIndex = shipSchedules.indexOf(ship);
            const eta = new Date(ship.etaTime);
            const etb = new Date(ship.startTime);
            const etc = ship.etcTime ? new Date(ship.etcTime) : null;
            const etd = new Date(ship.endTime);

            if (isNaN(eta) || isNaN(etb) || isNaN(etd) || (etc && isNaN(etc)) ) {
                console.warn("Skipping ship render due to invalid date after filter:", ship);
                return; 
            }

            const getHoursSinceWeekStart = (date) => (date.getTime() - weekStart.getTime()) / (1000 * 60 * 60);
            const left = getHoursSinceWeekStart(eta) * HOUR_WIDTH;
            const width = Math.max(((etd.getTime() - eta.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH, HOUR_WIDTH / 2);
            const kdUnitPx = KD_HEIGHT_UNIT / (KD_MARKERS[1] - KD_MARKERS[0]);
            const top = (ship.berthLocation - KD_MIN) * kdUnitPx;
            const calculatedHeight = ship.length * kdUnitPx;
            const height = Math.max(calculatedHeight, KD_HEIGHT_UNIT / 2); 

            const contentLeft = Math.max(((etb.getTime() - eta.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH, 0);
            const contentWidth = Math.max(((etd.getTime() - etb.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH, HOUR_WIDTH / 4); 

            const finalTop = Math.max(top, 0);
            const finalLeft = Math.max(left, 0);


            const company = ship.company ? ship.company.toUpperCase() : 'UNKNOWN';
            let logoUrl = '', companyColor = '#718096';
            switch(company) {
                case 'MERATUS': logoUrl = './MRTS.png'; companyColor = '#000000'; break;
                case 'TANTO':   logoUrl = './TANTO.png'; companyColor = '#000000'; break;
                case 'SPIL':    logoUrl = './SPIL.png'; companyColor = '#000000'; break;
                case 'CTP':     logoUrl = './CTP.png'; companyColor = '#000000'; break;
                case 'PPNP':    logoUrl = './PPNP.png'; companyColor = '#000000'; break;
                case 'LINE':    logoUrl = './Lines.jpg'; companyColor = '#000000'; break;
                case 'ICON':    logoUrl = './icon.jpg'; companyColor = '#000000'; break;
            }
            const statusColors = {
                "VESSEL ALONGSIDE": "#00c853",
                "VESSEL ON PLOTTING": "#ffff00",
                "VESSEL ON PLANNING": "#bfbfbf",
                "VESSEL DEPART": "#9c27b0",
                "CRANE/BERTH MAINTENANCE": "#ffc000",
            };
            const footerColor = statusColors[ship.status] || '#718096';
            const bodyTextLines = [
                `${ship.length || '?'}m / ${ship.draft || '?'} / ${ship.destPort || '-'} `,
                `${ship.berthSide || '?'} / ${ship.berthLocation || '?'} / ${ship.nKd || '?'} / ${ship.minKd || '?'}`,
                `${formatDateTime(eta)} /${formatDateTime(etb)} / ${formatDateTime(etc)} / ${formatDateTime(etd)}`,
                `D ${ship.dischargeValue || 0} / L ${ship.loadValue || 0}`,
                `${ship.qccName || '?'} `,
            ];
            const bodyText = bodyTextLines.join('\n').trim();
            const wrapper = document.createElement('div');
            wrapper.className = 'ship-wrapper';
            wrapper.style.top = `${finalTop}px`;
            wrapper.style.left = `${finalLeft}px`;
            wrapper.style.width = `${width}px`;
            wrapper.style.height = `${height}px`;
            wrapper.innerHTML = `
                <div class="ship-content" style="left: ${contentLeft}px; width: ${contentWidth}px; border-color: ${companyColor};">
                    <div class="ship-header">
                        <div class="ship-header-text">
                            <span class="ship-main-title">${company} ${ship.shipName || 'N/A'}</span>
                            <span class="ship-sub-title">${ship.code || 'N/A'}</span>
                        </div>
                        ${logoUrl ? `<img src="${logoUrl}" class="ship-logo" alt="${company} logo" onerror="this.style.display='none'; console.warn('Gagal load logo kapal:', this.src)"/>` : ''}
                    </div>
                    <div class="ship-body">${bodyText}</div>
                </div>
                <div class="ship-footer" style="background-color: ${footerColor};">
                    <span class="footer-left"></span>
                    <span class="footer-center">${ship.status || 'N/A'}</span>
                    <span class="footer-right">BSH: ${ship.bsh || ''} / ${ship.berthSide || ''}</span>
                </div>
            `;
            wrapper.addEventListener('dblclick', () => editShip(shipIndex));
            wrapper.title = 'Double click untuk mengedit';
            grid.appendChild(wrapper); 
        });
    }

    function renderMaintenance() {
        grid.querySelectorAll('.maintenance-block').forEach(el => el.remove());
        const weekStart = new Date(currentStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const getHoursSinceWeekStart = (date) => (date.getTime() - weekStart.getTime()) / (1000 * 60 * 60);
        const visibleMaintenance = maintenanceSchedules.filter(item => {
             if (!item.startTime || !item.endTime) return false;
            const startTime = new Date(item.startTime);
            const endTime = new Date(item.endTime);
             if (isNaN(startTime) || isNaN(endTime)) return false;
            return startTime < weekEnd && endTime > weekStart;
        });
        visibleMaintenance.forEach((item, index) => {
            const itemIndex = maintenanceSchedules.indexOf(item);
            const startTime = new Date(item.startTime);
            const endTime = new Date(item.endTime);
            const left = getHoursSinceWeekStart(startTime) * HOUR_WIDTH;
            const width = Math.max(((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH, HOUR_WIDTH / 2);

            const kdUnitPx = KD_HEIGHT_UNIT / (KD_MARKERS[1] - KD_MARKERS[0]);
            const top = (item.startKd - KD_MIN) * kdUnitPx;

            const maintenanceLength = Math.max((item.endKd - item.startKd), 10); // Panjang minimum
            const height = Math.max(maintenanceLength * kdUnitPx, KD_HEIGHT_UNIT / 2); // Tinggi minimum

            const finalTop = Math.max(top, 0);
            const finalLeft = Math.max(left, 0);

            const block = document.createElement('div');
            block.className = 'maintenance-block';
            block.style.top = `${finalTop}px`;
            block.style.left = `${finalLeft}px`;
            block.style.width = `${width}px`;
            block.style.height = `${height}px`;
            block.textContent = item.keterangan;
            block.title = `Maintenance: ${item.keterangan} (Double click untuk mengedit)`;
            block.addEventListener('dblclick', () => editMaintenance(itemIndex));
            grid.appendChild(block);
        });
    }

    function renderRestTimes() {
        grid.querySelectorAll('.rest-block').forEach(el => el.remove());
        const weekStart = new Date(currentStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const getHoursSinceWeekStart = (date) => (date.getTime() - weekStart.getTime()) / (1000 * 60 * 60);
        const visibleRestTimes = restSchedules.filter(item => {
             if (!item.startTime || !item.endTime) return false;
            const startTime = new Date(item.startTime);
            const endTime = new Date(item.endTime);
             if (isNaN(startTime) || isNaN(endTime)) return false;
            return startTime < weekEnd && endTime > weekStart;
        });
        visibleRestTimes.forEach(item => {
            const itemIndex = restSchedules.indexOf(item);
            const startTime = new Date(item.startTime);
            const endTime = new Date(item.endTime);
            const left = getHoursSinceWeekStart(startTime) * HOUR_WIDTH;
            const width = Math.max(((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH, HOUR_WIDTH / 4);

             const finalLeft = Math.max(left, 0);

            const block = document.createElement('div');
            block.className = 'rest-block';
            block.style.top = '0px';
            block.style.height = grid.style.height; // Sesuaikan tinggi dengan grid
            block.style.left = `${finalLeft}px`;
            block.style.width = `${width}px`;
            block.textContent = item.keterangan || 'BREAK';
            block.title = `${item.keterangan} (Double click untuk mengedit)`;
            block.addEventListener('dblclick', () => editRestTime(itemIndex));
            grid.appendChild(block);
        });
    }

    function saveCommLog() {
        const table = document.getElementById('comm-log-table');
        const rows = table.querySelectorAll('tbody tr');
        const data = [];

        rows.forEach(row => {
            const cells = row.querySelectorAll('td[contenteditable="true"]');
            if (cells.length === 6) {
                const rowData = {
                    dateTime: cells[0].textContent,
                    petugas: cells[1].textContent,
                    stakeholder: cells[2].textContent,
                    pic: cells[3].textContent,
                    remark: cells[4].textContent,
                    commChannel: cells[5].textContent,
                };
                data.push(rowData);
            }
        });

        localStorage.setItem('communicationLogData', JSON.stringify(data));
    }
    function loadCommLog() {
        const data = JSON.parse(localStorage.getItem('communicationLogData'));
        if (!data) return;

        const table = document.getElementById('comm-log-table');
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach((row, index) => {
            if (!data[index]) return;

            const cells = row.querySelectorAll('td[contenteditable="true"]');
            if (cells.length === 6) {
                cells[0].textContent = data[index].dateTime;
                cells[1].textContent = data[index].petugas;
                cells[2].textContent = data[index].stakeholder;
                cells[3].textContent = data[index].pic;
                cells[4].textContent = data[index].remark;
                cells[5].textContent = data[index].commChannel;
            }
        });
    }

     function savePendingForm() {
        if (editingShipIndex === null) {
            const formData = new FormData(shipForm);
            const data = Object.fromEntries(formData.entries());
            sessionStorage.setItem(PENDING_FORM_KEY, JSON.stringify(data));
        }
    }
    function loadPendingForm() {
        const data = JSON.parse(sessionStorage.getItem(PENDING_FORM_KEY));
        if (data) {
            for (const key in data) {
                if (shipForm.elements[key]) {
                    shipForm.elements[key].value = data[key];
                }
            }
        }
    }
    function clearPendingForm() {
        sessionStorage.removeItem(PENDING_FORM_KEY);
        shipForm.reset();
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    function formatDate(date) {
        return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function formatDateTime(date) {
        if (!date || isNaN(new Date(date))) return '-';
        const d = new Date(date);
        const day = d.getDate().toString();
        const hour = d.getHours().toString().padStart(2, '0');
        const minute = d.getMinutes().toString().padStart(2, '0');
        const timeString = hour + minute;
        return `${day} / ${timeString}`;
    }
    function formatForInput(date) {
        if (!date) return '';
        try {
            const d = new Date(date);
            if (isNaN(d)) return '';
            const pad = (num) => num.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch (e) {
            console.error("Error formatting date for input:", date, e);
            return '';
        }
    }
    function formatDateForPDF(d) {
        return d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }


    function initialize() {
        updateDisplay(); 
        setupEventListeners();
        loadCommLog();
    }

    function drawGrid() {
        yAxis.innerHTML = ''; xAxis.innerHTML = ''; hourAxis.innerHTML = ''; berthLabelsContainer.innerHTML = '';
        grid.innerHTML = ''; 

        const oldSeparator = berthMapContainer.querySelector('.berth-separator');
        if (oldSeparator) oldSeparator.remove();

        const totalHours = 24 * 7; 
        const totalKdSteps = KD_MARKERS.length; 

       
        grid.style.position = 'relative'; 
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${totalHours}, ${HOUR_WIDTH}px)`;
        grid.style.gridTemplateRows = `repeat(${totalKdSteps - 1}, ${KD_HEIGHT_UNIT}px)`;
        grid.style.width = `${totalHours * HOUR_WIDTH}px`;
        grid.style.height = `${(totalKdSteps - 1) * KD_HEIGHT_UNIT}px`;

        for (let row = 0; row < totalKdSteps - 1; row++) {
            for (let col = 0; col < totalHours; col++) {
                const cell = document.createElement('div');
                cell.classList.add('grid-cell');
                grid.appendChild(cell);
            }
        }

        const divider = document.createElement('div');
        divider.id = 'berth-divider-line';
        grid.appendChild(divider);

        const timeIndicator = document.createElement('div');
        timeIndicator.id = 'current-time-indicator';
        grid.appendChild(timeIndicator);


        const kdUnitPx = KD_HEIGHT_UNIT; 
        KD_MARKERS.forEach(kd => {
            const label = document.createElement('div');
            label.className = 'kd-label';
            if (kd === 490) label.classList.add('bold');
            label.textContent = kd;
            label.style.height = `${kdUnitPx}px`;
            yAxis.appendChild(label);
        });

        const berths = [{ name: 'BERTH 2', startKd: 380, endKd: 490 },{ name: 'BERTH 1', startKd: 490, endKd: 600 }];
        berths.forEach(berth => {
            const berthLabelContainer = document.createElement('div');
            berthLabelContainer.className = 'berth-label-container';
            const berthLabel = document.createElement('div');
            berthLabel.className = 'berth-label';
            berthLabel.textContent = berth.name;
            const kdStepHeight = KD_HEIGHT_UNIT / (KD_MARKERS[1] - KD_MARKERS[0]); // Tinggi per 1 KD
            const top = (berth.startKd - KD_MIN) * kdStepHeight;
            const height = (berth.endKd - berth.startKd) * kdStepHeight;
            berthLabelContainer.style.top = `${top}px`;
            berthLabelContainer.style.height = `${height}px`;
            berthLabelContainer.appendChild(berthLabel);
            berthLabelsContainer.appendChild(berthLabelContainer);
        });


        const currentDay = new Date(currentStartDate);
        for (let i = 0; i < 7; i++) {
            const dayLabel = document.createElement('div');
            dayLabel.className = 'day-label';
            dayLabel.textContent = currentDay.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long' });
            dayLabel.style.width = `${24 * HOUR_WIDTH}px`;
            xAxis.appendChild(dayLabel);

            for (let h = 0; h < 24; h += 2) { 
                const hourLabel = document.createElement('div');
                hourLabel.className = 'hour-label';
                hourLabel.textContent = h.toString().padStart(2, '0');
                hourLabel.style.width = `${2 * HOUR_WIDTH}px`; 
                hourAxis.appendChild(hourLabel);
            }
            currentDay.setDate(currentDay.getDate() + 1);
        }

        updateBerthDividerPosition();
        const lineElement = document.getElementById('current-time-indicator');
        if (lineElement) {
             lineElement.style.left = `${draggableLineLeft}px`;
             makeLineDraggable(lineElement);
        } else {
            console.error("Element #current-time-indicator not found after grid creation");
        }
    }

    function updateBerthDividerPosition() {
        const divider = document.getElementById('berth-divider-line');
        if (divider) {
             const kdStepHeight = KD_HEIGHT_UNIT / (KD_MARKERS[1] - KD_MARKERS[0]); 
             const topPosition = (490 - KD_MIN) * kdStepHeight;
             divider.style.top = `${topPosition - 1}px`; 
        }
    }

    function updateCurrentTimeIndicator() {
         console.log("updateCurrentTimeIndicator called, but logic is disabled for manual dragging.");
    }

    function makeLineDraggable(line) {
        if (!line) {
            console.error("makeLineDraggable called with null element");
            return;
        }
        let isDragging = false;
        let initialX;
        let initialLeft;

        line.removeEventListener('mousedown', onMouseDown);

        function onMouseDown(e) {
             e.preventDefault();
             isDragging = true;
             initialX = e.clientX;
             initialLeft = line.offsetLeft;
             document.addEventListener('mousemove', onDrag);
             document.addEventListener('mouseup', onDragEnd);
             console.log("Draggable line: Mouse Down");
        }

        function onDrag(e) {
            if (!isDragging) return;
            e.preventDefault();

            const dx = e.clientX - initialX;
            let newLeft = initialLeft + dx;

            const gridWidth = grid.scrollWidth;
            newLeft = Math.max(0, Math.min(newLeft, gridWidth - line.offsetWidth));

            draggableLineLeft = newLeft; 
            line.style.left = `${newLeft}px`; 
        }

        function onDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', onDragEnd);
            localStorage.setItem('draggableLinePosition', JSON.stringify(draggableLineLeft));
            console.log("Draggable line: Mouse Up, Position saved:", draggableLineLeft);
        }

        line.addEventListener('mousedown', onMouseDown);

    }

    function updateDisplay() {
        const endDate = new Date(currentStartDate);
        endDate.setDate(endDate.getDate() + 6);
        weekRangeDisplay.textContent = `${formatDate(currentStartDate)} - ${formatDate(endDate)}`;
        drawGrid(); 
        renderRestTimes();
        renderMaintenance();
        renderShips();
    }

    function fillFormForEdit(ship) {
        document.getElementById('ship-company').value = ship.company;
        document.getElementById('ship-name').value = ship.shipName;
        document.getElementById('ship-code').value = ship.code;
        document.getElementById('ship-length').value = ship.length;
        document.getElementById('ship-draft').value = ship.draft;
        document.getElementById('dest-port').value = ship.destPort || '';
        document.getElementById('berth-location').value = ship.berthLocation;
        document.getElementById('n-kd').value = ship.nKd || '';
        document.getElementById('min-kd').value = ship.minKd || '';
        document.getElementById('load-value').value = ship.loadValue || 0;
        document.getElementById('discharge-value').value = ship.dischargeValue || 0;
        document.getElementById('eta-time').value = formatForInput(ship.etaTime);
        document.getElementById('start-time').value = formatForInput(ship.startTime);
        document.getElementById('etc-time').value = formatForInput(ship.etcTime);
        document.getElementById('end-time').value = formatForInput(ship.endTime);
        document.getElementById('ship-status').value = ship.status;
        document.getElementById('ship-berth-side').value = ship.berthSide;
        document.getElementById('ship-bsh').value = ship.bsh || '';
        document.getElementById('qcc-name').value = ship.qccName || '';
    }
    function editShip(index) {
        editingShipIndex = index;
        fillFormForEdit(shipSchedules[index]);
        modalTitle.textContent = 'Edit Jadwal Kapal';
        formSubmitBtn.textContent = 'Update Jadwal';
        shipForm.classList.add('edit-mode');
        deleteShipBtn.onclick = () => {
            if (confirm('Anda yakin ingin menghapus jadwal kapal ini?')) {
                shipSchedules.splice(editingShipIndex, 1);
                localStorage.setItem('shipSchedules', JSON.stringify(shipSchedules));
                updateDisplay();
                modal.style.display = 'none';
                shipForm.classList.remove('edit-mode');
            }
        };
        modal.style.display = 'block';
    }
    function editMaintenance(index) {
        editingMaintenanceIndex = index;
        const item = maintenanceSchedules[index];
        maintenanceForm.elements['startKd'].value = item.startKd;
        maintenanceForm.elements['endKd'].value = item.endKd;
        maintenanceForm.elements['startTime'].value = formatForInput(item.startTime);
        maintenanceForm.elements['endTime'].value = formatForInput(item.endTime);
        maintenanceForm.elements['keterangan'].value = item.keterangan;
        maintenanceModalTitle.textContent = 'Edit Maintenance';
        maintenanceSubmitBtn.textContent = 'Update';
        maintenanceForm.classList.add('edit-mode');
        deleteMaintenanceBtn.onclick = () => {
            if (confirm('Anda yakin ingin menghapus data maintenance ini?')) {
                maintenanceSchedules.splice(editingMaintenanceIndex, 1);
                localStorage.setItem('maintenanceSchedules', JSON.stringify(maintenanceSchedules));
                updateDisplay();
                maintenanceModal.style.display = 'none';
                maintenanceForm.classList.remove('edit-mode');
            }
        };
        maintenanceModal.style.display = 'block';
    }
    function editRestTime(index) {
        editingRestIndex = index;
        const item = restSchedules[index];
        restForm.elements['startTime'].value = formatForInput(item.startTime);
        restForm.elements['endTime'].value = formatForInput(item.endTime);
        restForm.elements['keterangan'].value = item.keterangan;
        restModalTitle.textContent = 'Edit Waktu Istirahat';
        restSubmitBtn.textContent = 'Update';
        restForm.classList.add('edit-mode');
        deleteRestBtn.onclick = () => {
            if (confirm('Anda yakin ingin menghapus waktu istirahat ini?')) {
                restSchedules.splice(editingRestIndex, 1);
                localStorage.setItem('restSchedules', JSON.stringify(restSchedules));
                updateDisplay();
                restModal.style.display = 'none';
                restForm.classList.remove('edit-mode');
            }
        };
        restModal.style.display = 'block';
    }


    async function exportToPDF(type = 'weekly') {
        console.log(`[PDF Export] Starting export process for type: ${type}`);
        const { jsPDF } = window.jspdf;

        
        const pdfHeader = document.getElementById('pdf-header');
        const pelindoLogoInHeader = pdfHeader.querySelector('.pdf-logo');
        const mainHeader = document.querySelector('.main-header');
        const berthMapContainer = document.getElementById('berth-map-container');
        const legendsScrollContainer = document.querySelector('.legends-scroll-container');
        const currentTimeIndicatorPDF = document.getElementById('current-time-indicator'); 
        const berthDividerLinePDF = document.getElementById('berth-divider-line');
        const exportBtn = document.getElementById('export-pdf-btn');
        const pdfOptions = document.getElementById('pdf-options');
        const gridScroll = document.querySelector('.grid-scroll-container');

        // Elemen untuk kalkulasi
        const yAxisColumn = document.querySelector('.y-axis-column');
        const gridContainer = document.querySelector('.grid-container');
        const legendsWrapper = document.querySelector('.bottom-legends-wrapper');

        if (!pelindoLogoInHeader) {
            console.error("[PDF Export] ERROR: Elemen logo Pelindo (.pdf-logo) tidak ditemukan di dalam #pdf-header!");
            alert("Error: Elemen logo Pelindo tidak ditemukan. Periksa struktur HTML Anda di bagian <div id='pdf-header'>.");
            exportBtn.disabled = false;
             exportBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
            return;
        } else {
             console.log("[PDF Export] Elemen logo Pelindo ditemukan.");
             console.log("[PDF Export] Path src logo Pelindo:", pelindoLogoInHeader.src);
        }

        const originalBtnHTML = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengekspor...';
        pdfOptions.style.display = 'none';

        if (pelindoLogoInHeader) {
            console.log("[PDF Export] Setting crossOrigin='anonymous' for Pelindo logo.");
            pelindoLogoInHeader.crossOrigin = "anonymous";
        }

        mainHeader.classList.add('hide-for-pdf'); 

        const oldHeaderWidth = pdfHeader.style.width;
        const oldMapWidth = berthMapContainer.style.width;
        const oldLegendsWidth = legendsScrollContainer.style.width;
        const oldGridScrollOverflow = gridScroll.style.overflowX;
        const oldGridScrollLeft = gridScroll.scrollLeft;
        const oldLegendsScrollLeft = legendsScrollContainer.scrollLeft;
        const oldTimeIndicatorDisplay = currentTimeIndicatorPDF ? currentTimeIndicatorPDF.style.display : 'none';
        const oldDividerDisplay = berthDividerLinePDF ? berthDividerLinePDF.style.display : 'block';

        let targetScrollLeft = 0;

        try {
            let pdfFileName, pdfDateRangeStr;
            let captureWidth;
            let captureStartX = 0;

            const mapFullWidth = gridContainer.scrollWidth + yAxisColumn.offsetWidth;
            const legendsFullWidth = legendsWrapper.scrollWidth;
            const fullWidth = Math.max(mapFullWidth, legendsFullWidth);

            const hourWidth = HOUR_WIDTH;
            const dayWidth = 24 * hourWidth;
            const yAxisWidth = yAxisColumn.offsetWidth;

            if (type === 'daily') {
                console.log("[PDF Export] Preparing for daily export...");
                let today = new Date(); today.setHours(0,0,0,0);
                let tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
                pdfDateRangeStr = `${formatDateForPDF(today)} to ${formatDateForPDF(tomorrow)}`;
                pdfFileName = `Berth-Allocation-Harian-${today.toISOString().split('T')[0]}.pdf`;

                let weekStart = new Date(currentStartDate); weekStart.setHours(0,0,0,0);
                let dayDiff = Math.round((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
                console.log(`[PDF Export] Day difference from week start: ${dayDiff}`);

                if (dayDiff < 0 || dayDiff >= 7) {
                    alert('Tanggal "Hari Ini" tidak ada di minggu yang sedang ditampilkan. Silakan navigasi ke minggu yang benar.');
                    throw new Error('Daily export failed: Date not in view.');
                }

                captureWidth = yAxisWidth + (2 * dayWidth);
                targetScrollLeft = dayDiff * dayWidth;
                captureStartX = targetScrollLeft;
                console.log(`[PDF Export] Daily - captureWidth: ${captureWidth}px, targetScrollLeft: ${targetScrollLeft}px, captureStartX: ${captureStartX}px`);

                gridScroll.style.overflowX = 'hidden';
                gridScroll.scrollLeft = targetScrollLeft;
                legendsScrollContainer.scrollLeft = targetScrollLeft;

            } else { 
                console.log("[PDF Export] Preparing for weekly export...");
                pdfDateRangeStr = weekRangeDisplay.textContent;
                pdfFileName = `Berth-Allocation-Mingguan-${pdfDateRangeStr.replace(/[\s/]/g, '')}.pdf`;
                captureWidth = fullWidth;
                captureStartX = 0;
                targetScrollLeft = 0;
                console.log(`[PDF Export] Weekly - captureWidth: ${captureWidth}px`);
                gridScroll.style.overflowX = 'visible';
                gridScroll.scrollLeft = 0;
                legendsScrollContainer.scrollLeft = 0;
            }

            pdfHeader.style.width = `${captureWidth}px`;
            berthMapContainer.style.width = `${captureWidth}px`;
            legendsScrollContainer.style.width = `${captureWidth}px`;
            pdfHeader.querySelector('.pdf-date-range').textContent = pdfDateRangeStr;
            pdfHeader.style.display = 'flex'; 
            if(berthDividerLinePDF) berthDividerLinePDF.style.display = 'block';
            if(currentTimeIndicatorPDF) currentTimeIndicatorPDF.style.display = 'block'; 


            await new Promise(resolve => setTimeout(resolve, 300)); 
            console.log("[PDF Export] Delay finished. Starting canvas capture...");

            const logoStyles = window.getComputedStyle(pelindoLogoInHeader);
            console.log("[PDF Export] Logo computed display:", logoStyles.display, "visibility:", logoStyles.visibility);
            if (logoStyles.display === 'none' || logoStyles.visibility === 'hidden') {
                 console.warn("[PDF Export] WARNING: Logo might be hidden!");
            }

            const scale = 2;
            const commonOptions = {
                scale: scale,
                useCORS: true,
                y: 0,
                scrollY: 0,
                windowWidth: captureWidth
            };

            const optionsBerthMap = {
                ...commonOptions,
                width: captureWidth, 
                height: berthMapContainer.scrollHeight,
                x: 0, 
                scrollX: (type === 'daily' ? targetScrollLeft : 0), 
            };

            const optionsLegends = {
                ...commonOptions,
                 width: captureWidth, 
                 height: legendsScrollContainer.scrollHeight,
                 x: 0, 
                 scrollX: (type === 'daily' ? targetScrollLeft : 0)
            };
            const optionsHeader = { ...commonOptions, width: captureWidth, height: pdfHeader.offsetHeight, x:0 };

            console.log("[PDF Export] Capturing header...");
            const canvasHeader = await html2canvas(pdfHeader, optionsHeader);
            console.log("[PDF Export] Header captured. Capturing Berth Map Container...");
            const canvasMapCombined = await html2canvas(berthMapContainer, optionsBerthMap);
            console.log("[PDF Export] Berth Map Container captured. Capturing Legends...");
            const canvasLegends = await html2canvas(legendsScrollContainer, optionsLegends);
            console.log("[PDF Export] Legends captured.");

            console.log("[PDF Export] Combining canvases into PDF...");

            const canvases = [canvasHeader, canvasMapCombined, canvasLegends];
            const pdfWidthMM = (canvasMapCombined.width / scale / 96) * 25.4; 
            const totalPdfHeightMM = canvases.reduce((sum, c) => sum + (c.height / scale / 96) * 25.4, 0);

            const doc = new jsPDF({
                orientation: pdfWidthMM > totalPdfHeightMM ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pdfWidthMM, totalPdfHeightMM]
            });

            let yOffset = 0;
            for (const canvas of canvases) {
                const imgData = canvas.toDataURL('image/png'); 
                const imgHeightMM = (canvas.height / scale / 96) * 25.4;
                const imgWidthMM = (canvas.width / scale / 96) * 25.4;
                doc.addImage(imgData, 'PNG', 0, yOffset, imgWidthMM, imgHeightMM);
                yOffset += imgHeightMM;
            }

            console.log("[PDF Export] Saving PDF...");
            doc.save(pdfFileName);
            console.log("[PDF Export] PDF saved successfully.");

        } catch (error) {
            console.error("[PDF Export] Error during export:", error);
            if (error.message.indexOf('Daily export failed') === -1) {
                 alert("Maaf, terjadi kesalahan saat membuat file PDF. Cek console (F12) untuk detail error.");
            }
        } finally {
            console.log("[PDF Export] Cleaning up...");
            mainHeader.classList.remove('hide-for-pdf');

            pdfHeader.style.display = 'none'; 
            pdfHeader.style.width = oldHeaderWidth;
            berthMapContainer.style.width = oldMapWidth;
            legendsScrollContainer.style.width = oldLegendsWidth;
            gridScroll.style.overflowX = oldGridScrollOverflow;
            gridScroll.scrollLeft = oldGridScrollLeft;
            legendsScrollContainer.scrollLeft = oldLegendsScrollLeft;
            if(currentTimeIndicator) currentTimeIndicator.style.display = oldTimeIndicatorDisplay; 
            if(berthDividerLine) berthDividerLine.style.display = oldDividerDisplay; 

            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnHTML;
            console.log("[PDF Export] Cleanup finished.");
        }
    }

    function setupEventListeners() {
        prevWeekBtn.addEventListener('click', () => { currentStartDate.setDate(currentStartDate.getDate() - 7); updateDisplay(); });
        nextWeekBtn.addEventListener('click', () => { currentStartDate.setDate(currentStartDate.getDate() + 7); updateDisplay(); });

        addShipBtn.addEventListener('click', () => {
            editingShipIndex = null;
            shipForm.reset();
            loadPendingForm();
            modalTitle.textContent = 'Tambah Jadwal Kapal';
            formSubmitBtn.textContent = 'Submit';
            shipForm.classList.remove('edit-mode');
            deleteShipBtn.onclick = null;
            modal.style.display = 'block';
        });
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            shipForm.classList.remove('edit-mode');
        });

        const pdfDropdownBtn = document.getElementById('export-pdf-btn');
        const pdfOptionsContainer = document.getElementById('pdf-options');
        const pdfOptionBtns = document.querySelectorAll('.pdf-option-btn');

        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                modal.style.display = 'none';
                shipForm.classList.remove('edit-mode');
            }
            if (event.target == maintenanceModal) {
                maintenanceModal.style.display = 'none';
                maintenanceForm.classList.remove('edit-mode');
            }
            if (event.target == restModal) {
                restModal.style.display = 'none';
                restForm.classList.remove('edit-mode');
            }

            if (pdfOptionsContainer.style.display === 'block' && !pdfDropdownBtn.contains(event.target)) {
                pdfOptionsContainer.style.display = 'none';
            }
        });

        shipForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const etaTime = shipForm.elements['etaTime'].value;
            const startTime = shipForm.elements['startTime'].value;
            const etcTime = shipForm.elements['etcTime'].value;
            const endTime = shipForm.elements['endTime'].value;
            if (!etaTime || !startTime || !etcTime || !endTime) {
                alert("Harap isi semua field waktu (ETA, ETB, ETC, ETD).");
                return;
            }
            if (new Date(startTime) < new Date(etaTime)) {
                alert("Waktu Sandar (ETB) tidak boleh sebelum Waktu Tiba (ETA).");
                return;
            }
            if (new Date(endTime) <= new Date(startTime)) {
                alert("Waktu Berangkat (ETD) harus setelah Waktu Sandar (ETB).");
                return;
            }
            const formData = new FormData(shipForm);
            const shipData = Object.fromEntries(formData.entries());
            shipData.length = parseInt(shipData.length, 10);
            shipData.draft = parseFloat(shipData.draft);
            shipData.berthLocation = parseInt(shipData.berthLocation, 10);
            shipData.nKd = parseInt(shipData.nKd, 10);
            shipData.minKd = parseInt(shipData.minKd, 10);
            shipData.bsh = parseInt(shipData.bsh, 10) || null;
            shipData.loadValue = parseInt(shipData.loadValue, 10) || 0;
            shipData.dischargeValue = parseInt(shipData.dischargeValue, 10) || 0;
            if (editingShipIndex !== null) {
                shipSchedules[editingShipIndex] = shipData;
            } else {
                shipSchedules.push(shipData);
            }
            localStorage.setItem('shipSchedules', JSON.stringify(shipSchedules));
            updateDisplay();
            modal.style.display = 'none';
            shipForm.classList.remove('edit-mode');
            clearPendingForm();
        });

        Array.from(shipForm.elements).forEach(input => {
            input.addEventListener('input', savePendingForm);
        });

        addMaintenanceBtn.addEventListener('click', () => {
            editingMaintenanceIndex = null;
            maintenanceForm.reset();
            maintenanceModalTitle.textContent = 'Tambah Maintenance';
            maintenanceSubmitBtn.textContent = 'Submit';
            maintenanceForm.classList.remove('edit-mode');
            deleteMaintenanceBtn.onclick = null;
            maintenanceModal.style.display = 'block';
        });
        maintenanceCloseBtn.addEventListener('click', () => {
            maintenanceModal.style.display = 'none';
            maintenanceForm.classList.remove('edit-mode');
        });
        maintenanceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const startTime = maintenanceForm.elements['startTime'].value;
            const endTime = maintenanceForm.elements['endTime'].value;
            if (new Date(endTime) <= new Date(startTime)) {
                alert("Waktu Selesai harus setelah Waktu Mulai.");
                return;
            }

            const formData = new FormData(maintenanceForm);
            const data = Object.fromEntries(formData.entries());
            data.startKd = parseInt(data.startKd, 10);
            data.endKd = parseInt(data.endKd, 10); 

            if (data.endKd <= data.startKd) {
                alert("End KD harus lebih besar dari Start KD.");
                return;
            }

            if (editingMaintenanceIndex !== null) {
                maintenanceSchedules[editingMaintenanceIndex] = data;
            } else {
                maintenanceSchedules.push(data);
            }
            localStorage.setItem('maintenanceSchedules', JSON.stringify(maintenanceSchedules));
            updateDisplay();
            maintenanceModal.style.display = 'none';
            maintenanceForm.classList.remove('edit-mode');
        });

        addRestBtn.addEventListener('click', () => {
            editingRestIndex = null;
            restForm.reset();
            restModalTitle.textContent = 'Tambah Waktu Istirahat';
            restSubmitBtn.textContent = 'Submit';
            restForm.classList.remove('edit-mode');
            deleteRestBtn.onclick = null;
            restModal.style.display = 'block';
        });
        restCloseBtn.addEventListener('click', () => {
            restModal.style.display = 'none';
            restForm.classList.remove('edit-mode');
        });
        restForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const startTime = restForm.elements['startTime'].value;
            const endTime = restForm.elements['endTime'].value;
            if (new Date(endTime) <= new Date(startTime)) {
                alert("Waktu Selesai harus setelah Waktu Mulai.");
                return;
            }
            const formData = new FormData(restForm);
            const data = Object.fromEntries(formData.entries());
            if (editingRestIndex !== null) {
                restSchedules[editingRestIndex] = data;
            } else {
                restSchedules.push(data);
            }
            localStorage.setItem('restSchedules', JSON.stringify(restSchedules));
            updateDisplay();
            restModal.style.display = 'none';
            restForm.classList.remove('edit-mode');
        });

        const commLogCells = document.querySelectorAll('#comm-log-table td[contenteditable="true"]');
        commLogCells.forEach(cell => {
            cell.addEventListener('input', saveCommLog);
        });

        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => {
                if (confirm('Anda yakin ingin menghapus SEMUA data jadwal kapal, maintenance, istirahat, DAN communication log?')) {
                    shipSchedules = [];
                    maintenanceSchedules = [];
                    restSchedules = [];

                    localStorage.removeItem('shipSchedules');
                    localStorage.removeItem('maintenanceSchedules');
                    localStorage.removeItem('restSchedules');
                    localStorage.removeItem('communicationLogData');
                    localStorage.removeItem('draggableLinePosition'); 

                    clearPendingForm();

                    document.querySelectorAll('#comm-log-table tbody tr').forEach(row => {
                        const cells = row.querySelectorAll('td[contenteditable="true"]');
                        cells.forEach((cell, index) => {
                            if (index === cells.length - 1) {
                                cell.textContent = 'WAG';
                            } else {
                                cell.textContent = '';
                            }
                        });
                    });

                    draggableLineLeft = 200; 
                    updateDisplay();
                }
            });
        }

        pdfDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const isVisible = pdfOptionsContainer.style.display === 'block';
            pdfOptionsContainer.style.display = isVisible ? 'none' : 'block';
        });

        pdfOptionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = e.target.dataset.type; 
                exportToPDF(type); 
            });
        });
    } 
    initialize();

}); 


