/* --- UTILS --- */
const Utils = {
    escape: (str) => str ? String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]) : '',
    
    // Debounce: Wait for user to stop typing before searching
    debounce: (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },
    
    formatDate: (str) => {
        const d = new Date(str);
        return isNaN(d) ? str : d.toLocaleDateString();
    }
};

/* --- APP CORE --- */
const App = {
    isSignup: false,
    init: () => {
        if(localStorage.getItem('ensTheme') === 'dark') document.body.classList.add('dark-mode');
        DataService.init();
        const user = JSON.parse(localStorage.getItem('ensCurrentUser'));
        user ? App.showDashboard(user) : App.showLogin();
        
        // Handle Logo Fallback if image fails
        const logoImg = document.getElementById('login-logo');
        logoImg.onerror = () => {
            logoImg.style.display = 'none';
            document.querySelector('.login-logo-text').style.display = 'block';
        };
    },

    toggleAuthMode: () => {
        App.isSignup = !App.isSignup;
        const els = {
            title: document.querySelector('.auth-subtitle'),
            btn: document.getElementById('auth-btn-label'),
            link: document.getElementById('auth-switch-link'),
            text: document.getElementById('auth-switch-text'),
            fields: document.querySelectorAll('.signup-field')
        };

        if(App.isSignup) {
            els.title.innerText = "Create a new account";
            els.btn.innerText = "Create Account";
            els.text.innerText = "Have an account?";
            els.link.innerText = "Sign In";
            els.fields.forEach(f => f.style.display = 'block');
        } else {
            els.title.innerText = "Enterprise Asset Management";
            els.btn.innerText = "Sign In";
            els.text.innerText = "Don't have an account?";
            els.link.innerText = "Sign Up";
            els.fields.forEach(f => f.style.display = 'none');
        }
    },

    handleAuth: (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-password').value.trim();
        const err = document.getElementById('login-error');
        const btn = document.getElementById('btn-login');

        if(!email || !pass) { err.innerText = "All fields required"; err.style.display = 'block'; return; }
        
        btn.classList.add('loading');
        err.style.display = 'none';

        setTimeout(() => {
            let users = DataService.get('ensUsers');
            
            if(App.isSignup) {
                const name = document.getElementById('signup-name').value.trim();
                const role = document.getElementById('signup-role').value;
                if(!name) { err.innerText = "Name required"; err.style.display='block'; btn.classList.remove('loading'); return; }
                if(users.find(u => u.username === email)) { err.innerText = "User exists"; err.style.display='block'; btn.classList.remove('loading'); return; }
                
                const newUser = { id: Date.now(), username: email, password: pass, name, role, office: 'HQ' };
                users.push(newUser);
                DataService.set('ensUsers', users);
                localStorage.setItem('ensCurrentUser', JSON.stringify(newUser));
                App.showDashboard(newUser);
            } else {
                const user = users.find(u => u.username === email && u.password === pass);
                if(user) {
                    localStorage.setItem('ensCurrentUser', JSON.stringify(user));
                    App.showDashboard(user);
                } else {
                    err.innerText = "Invalid credentials";
                    err.style.display = 'block';
                }
            }
            btn.classList.remove('loading');
        }, 600);
    },
    
    logout: () => {
        if(confirm("Sign out?")) {
            localStorage.removeItem('ensCurrentUser');
            location.reload();
        }
    },
    
    showDashboard: (user) => {
        UI.updateProfile(user);
        UI.applyPermissions(user);
        document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
        document.getElementById('view-login').style.display = 'none';
        document.body.classList.remove('login-mode');
        document.getElementById('view-app').style.display = 'flex';
        UI.renderDashboard();
        Workflow.initSig();
    }
};

/* --- DATA --- */
const DataService = {
    init: () => {
        if(!localStorage.getItem('ensUsers')) {
            localStorage.setItem('ensUsers', JSON.stringify([
                { id: 1, username: 'admin', password: 'password', name: 'Admin User', role: 'IT Manager', office: 'Sandton' }
            ]));
        }
        if(!localStorage.getItem('ensInventory')) {
            localStorage.setItem('ensInventory', JSON.stringify([
                { tag: 'ENS-L-001', type: 'Laptop', model: 'Dell Latitude 7420', user: 'System', status: 'Available' },
                { tag: 'ENS-M-102', type: 'Mobile', model: 'iPhone 13', user: 'Sarah Connor', status: 'Assigned' }
            ]));
            localStorage.setItem('ensActivity', JSON.stringify([]));
        }
    },
    get: (k) => JSON.parse(localStorage.getItem(k) || '[]'),
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    
    updateInv: (tag, data) => {
        let inv = DataService.get('ensInventory');
        const idx = inv.findIndex(i => i.tag === tag);
        if(idx > -1) inv[idx] = { ...inv[idx], ...data };
        else inv.push({ tag, ...data });
        DataService.set('ensInventory', inv);
    },
    
    log: (type, details, user) => {
        let log = DataService.get('ensActivity');
        log.unshift({ ref: `LOG-${Date.now().toString().slice(-4)}`, type, user, date: new Date().toISOString(), details });
        if(log.length > 200) log.pop(); // Performance limit
        DataService.set('ensActivity', log);
    },

    exportCSV: () => {
        const data = DataService.get('ensInventory');
        const csv = Papa.unparse(data);
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'ENS_Inventory.csv';
        link.click();
    }
};

/* --- UI --- */
const UI = {
    pg: 1,
    limit: 10,
    sort: { col: null, asc: true },
    
    toggleTheme: () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('ensTheme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    },
    
    applyPermissions: (user) => {
        const readOnly = ['Auditor', 'Viewer'].includes(user.role);
        document.getElementById('btn-add-new').style.display = readOnly ? 'none' : 'inline-flex';
    },
    
    updateProfile: (u) => {
        document.getElementById('user-name-display').innerText = u.name;
        document.getElementById('user-role-display').innerText = u.role;
        document.getElementById('user-avatar-display').innerText = u.name.substring(0,2).toUpperCase();
    },

    switchView: (view, btn) => {
        document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
        if(btn) btn.classList.add('active');
        document.querySelectorAll('.view-section').forEach(e => e.classList.remove('active-view'));
        document.getElementById('view-'+view).classList.add('active-view');
        
        // Close sidebar on mobile after click
        if(window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('active');
        
        if(view === 'dashboard') UI.renderDashboard();
        if(view === 'inventory') UI.renderInventory();
        if(view === 'history') UI.renderHistory();
    },

    toggleSidebar: () => document.getElementById('sidebar').classList.toggle('active'),

    /* --- DASHBOARD --- */
    renderDashboard: () => {
        const inv = DataService.get('ensInventory');
        const logs = DataService.get('ensActivity');
        
        document.getElementById('stat-total').innerText = inv.length;
        document.getElementById('stat-stock').innerText = inv.filter(i => i.status === 'Available').length;
        
        const tbody = document.querySelector('#activityTable tbody');
        tbody.innerHTML = logs.slice(0, 5).map(l => `
            <tr>
                <td><span style="font-family:monospace">${l.ref}</span></td>
                <td>${Utils.escape(l.user)}</td>
                <td>${Utils.escape(l.type)}</td>
                <td>${Utils.formatDate(l.date)}</td>
                <td><span class="live-badge" style="background:var(--success);animation:none">DONE</span></td>
            </tr>
        `).join('');

        // Chart
        const counts = {};
        inv.forEach(i => counts[i.type] = (counts[i.type]||0) + 1);
        
        if(window.myChart) window.myChart.destroy();
        const ctx = document.getElementById('assetChart').getContext('2d');
        window.myChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counts),
                datasets: [{ data: Object.values(counts), backgroundColor: ['#FFD200', '#111', '#3498db', '#e74c3c'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
        });
    },

    /* --- INVENTORY & SORTING --- */
    debouncedSearch: Utils.debounce(() => UI.renderInventory(), 300),
    
    sortData: (col) => {
        if(UI.sort.col === col) UI.sort.asc = !UI.sort.asc;
        else { UI.sort.col = col; UI.sort.asc = true; }
        UI.renderInventory();
    },
    
    renderInventory: () => {
        const search = document.getElementById('inv-search').value.toLowerCase();
        const filter = document.getElementById('inv-filter').value;
        let data = DataService.get('ensInventory');

        // Filter
        data = data.filter(i => {
            const matchSearch = Object.values(i).some(val => String(val).toLowerCase().includes(search));
            const matchFilter = filter === 'All' || i.status === filter;
            return matchSearch && matchFilter;
        });

        // Smart Sort
        if(UI.sort.col) {
            data.sort((a, b) => {
                let valA = a[UI.sort.col] || '';
                let valB = b[UI.sort.col] || '';
                
                // Number detection
                if(!isNaN(valA) && !isNaN(valB) && valA !== '' && valB !== '') {
                    return UI.sort.asc ? valA - valB : valB - valA;
                }
                // String compare
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
                if (valA < valB) return UI.sort.asc ? -1 : 1;
                if (valA > valB) return UI.sort.asc ? 1 : -1;
                return 0;
            });
        }

        // Pagination
        const total = data.length;
        const start = (UI.pg - 1) * UI.limit;
        const pageData = data.slice(start, start + UI.limit);
        
        document.getElementById('pg-info').innerText = `Showing ${Math.min(start+1, total)} - ${Math.min(start+UI.limit, total)} of ${total}`;
        document.getElementById('pg-prev').disabled = UI.pg === 1;
        document.getElementById('pg-next').disabled = start + UI.limit >= total;

        const tbody = document.getElementById('inv-body');
        tbody.innerHTML = '';
        
        // Use Fragment for Performance
        const frag = document.createDocumentFragment();
        pageData.forEach(row => {
            const tr = document.createElement('tr');
            let badgeClass = row.status === 'Available' ? 'st-good' : row.status === 'Assigned' ? 'st-assigned' : 'st-damaged';
            
            tr.innerHTML = `
                <td style="font-weight:bold">${Utils.escape(row.tag)}</td>
                <td>${Utils.escape(row.type)}</td>
                <td>${Utils.escape(row.model)}</td>
                <td>${Utils.escape(row.user)}</td>
                <td><span class="status-badge ${badgeClass}">${Utils.escape(row.status)}</span></td>
                <td>
                    <button class="btn-tiny" onclick="UI.showQR('${row.tag}')"><i class="fas fa-qrcode"></i></button>
                    <button class="btn-tiny" onclick="UI.openModal('edit', '${row.tag}')"><i class="fas fa-edit"></i></button>
                </td>
            `;
            frag.appendChild(tr);
        });
        tbody.appendChild(frag);
    },
    
    changePage: (dir) => { UI.pg += dir; UI.renderInventory(); },
    resetPagination: () => { UI.pg = 1; UI.renderInventory(); },

    /* --- MODALS --- */
    openModal: (mode, tag) => {
        const modal = document.getElementById('assetModal');
        document.getElementById('mod-mode').value = mode;
        const form = modal.querySelector('form');
        form.reset();
        
        if(mode === 'edit') {
            const item = DataService.get('ensInventory').find(i => i.tag === tag);
            document.getElementById('mod-tag').value = item.tag;
            document.getElementById('mod-tag').disabled = true;
            document.getElementById('mod-type').value = item.type;
            document.getElementById('mod-model').value = item.model;
            document.getElementById('mod-status').value = item.status;
            document.getElementById('mod-user').value = item.user;
            document.getElementById('btn-delete-asset').style.display = 'inline-block';
        } else {
            document.getElementById('mod-tag').disabled = false;
            document.getElementById('btn-delete-asset').style.display = 'none';
        }
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('open'), 10);
    },
    
    closeModal: (id) => {
        const modal = document.getElementById(id);
        modal.classList.remove('open');
        setTimeout(() => modal.style.display = 'none', 300);
    },

    saveAsset: (e) => {
        e.preventDefault();
        const tag = document.getElementById('mod-tag').value;
        const data = {
            type: document.getElementById('mod-type').value,
            model: document.getElementById('mod-model').value,
            status: document.getElementById('mod-status').value,
            user: document.getElementById('mod-user').value
        };
        
        DataService.updateInv(tag, data);
        DataService.log('Asset Update', `Updated ${tag}`, JSON.parse(localStorage.getItem('ensCurrentUser')).name);
        UI.closeModal('assetModal');
        UI.renderInventory();
        UI.renderDashboard();
    },
    
    showQR: (tag) => {
        const box = document.getElementById('qr-display');
        box.innerHTML = '';
        new QRCode(box, { text: tag, width: 128, height: 128 });
        document.getElementById('qr-tag-label').innerText = tag;
        document.getElementById('qrModal').style.display = 'flex';
    },
    
    /* --- PROFILE --- */
    openProfileModal: () => {
        const u = JSON.parse(localStorage.getItem('ensCurrentUser'));
        document.getElementById('profile-name').value = u.name;
        document.getElementById('profile-email').value = u.username;
        document.getElementById('profile-role').value = u.role;
        document.getElementById('profile-office').value = u.office || '';
        document.getElementById('profileModal').style.display = 'flex';
        setTimeout(() => document.getElementById('profileModal').classList.add('open'), 10);
    },
    
    saveProfile: (e) => {
        e.preventDefault();
        let u = JSON.parse(localStorage.getItem('ensCurrentUser'));
        u.name = document.getElementById('profile-name').value;
        u.role = document.getElementById('profile-role').value;
        u.office = document.getElementById('profile-office').value;
        localStorage.setItem('ensCurrentUser', JSON.stringify(u));
        UI.updateProfile(u);
        UI.closeModal('profileModal');
    }
};

/* --- WORKFLOWS --- */
const Workflow = {
    currentStep: 1,
    
    nextStep: (n) => {
        // Validations
        if(n === 2 && !document.getElementById('iss-name').value) return alert("Name required");
        if(n === 3 && !document.getElementById('iss-tag').value) return alert("Scan Asset Tag");
        
        document.querySelectorAll('[id^="form-step-"]').forEach(el => el.style.display = 'none');
        document.getElementById(`form-step-${n}`).style.display = 'block';
        
        document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
        document.getElementById(`i-step-${n}`).classList.add('active');
        
        if(n === 3) Workflow.initSig();
    },
    
    prevStep: (n) => {
        Workflow.nextStep(n); // Re-use logic, just backwards
    },
    
    autoFillEmail: () => {
        const name = document.getElementById('iss-name').value;
        const mail = document.getElementById('iss-email');
        if(name && !mail.value) mail.value = name.toLowerCase().replace(/ /g, '.') + '@ensafrica.com';
    },

    handleSigUpload: (e) => {
        const file = e.target.files[0];
        if(file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const img = new Image();
                img.onload = () => Workflow.ctx.drawImage(img, 0, 0, 300, 150);
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    },
    
    initSig: () => {
        const canvas = document.getElementById('sig-canvas');
        // Fix canvas resolution
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        Workflow.ctx = canvas.getContext('2d');
        Workflow.ctx.strokeStyle = "#000";
        Workflow.ctx.lineWidth = 2;
        
        let drawing = false;
        
        const start = (e) => { drawing = true; Workflow.ctx.beginPath(); Workflow.ctx.moveTo(getX(e), getY(e)); };
        const move = (e) => { if(drawing) { e.preventDefault(); Workflow.ctx.lineTo(getX(e), getY(e)); Workflow.ctx.stroke(); } };
        const end = () => drawing = false;
        
        const getX = (e) => e.type.includes('touch') ? e.touches[0].clientX - canvas.getBoundingClientRect().left : e.offsetX;
        const getY = (e) => e.type.includes('touch') ? e.touches[0].clientY - canvas.getBoundingClientRect().top : e.offsetY;

        canvas.onmousedown = start; canvas.onmousemove = move; canvas.onmouseup = end;
        canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = end;
    },
    
    clearSig: () => {
        const c = document.getElementById('sig-canvas');
        c.getContext('2d').clearRect(0,0,c.width,c.height);
        document.getElementById('sig-upload').value = '';
    },
    
    completeIssuance: () => {
        const tag = document.getElementById('iss-tag').value;
        const name = document.getElementById('iss-name').value;
        const init = document.getElementById('iss-initials').value;
        
        if(!init) return alert("Initials required");
        
        html2pdf().from(document.getElementById('issuance-card')).save(`ENS_Issue_${tag}.pdf`).then(() => {
            DataService.updateInv(tag, { user: name, status: 'Assigned' });
            DataService.log('Issuance', `Issued ${tag} to ${name}`, JSON.parse(localStorage.getItem('ensCurrentUser')).name);
            UI.switchView('dashboard');
        });
    }
};

document.addEventListener('DOMContentLoaded', App.init);
