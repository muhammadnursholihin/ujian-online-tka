const URL_CLOUD = "https://script.google.com/macros/s/AKfycbx-1fOqct18WSUbdCd3SjSlyWqFKr0T98V8E7kDiWWQfzCGIXXgmNH_S_Q0o3L4qF8tgg/exec";
let bankSoal = JSON.parse(localStorage.getItem('bankSoalTKA')) || [];
let dataSiswa = JSON.parse(localStorage.getItem('dataSiswaTKA')) || [];
let settings = JSON.parse(localStorage.getItem('settingsTKA')) || { token: "TKA26", durasi: 60, toleransi: 3 };
let hasilUjian = JSON.parse(localStorage.getItem('hasilTKA')) || [];
let currentUser = null, jawabanSiswa = {}, timerVar, pelanggaran = 0;
let isWarningActive = false; // Mencegah looping blokir saat alert muncul

window.onload = () => {
    const sesi = sessionStorage.getItem('sesiTKA');
    if (sesi) { currentUser = JSON.parse(sesi); setDashboard(); }
};

function prosesLogin() {
    const u = document.getElementById('username').value, p = document.getElementById('password').value;
    if (u === "admin" && p === "admin123") currentUser = { nama: "Admin", role: "ADMIN" };
    else {
        const s = dataSiswa.find(x => x.username === u && x.password === p);
        if (s) {
            if (s.isBlokir) return alert("AKUN DIBLOKIR! Hubungi Admin.");
            currentUser = { nama: s.nama, role: "SISWA", user: s.username };
        } else return alert("Login Gagal!");
    }
    sessionStorage.setItem('sesiTKA', JSON.stringify(currentUser));
    setDashboard();
}

function setDashboard() {
    document.getElementById('login-overlay').style.display = "none";
    document.getElementById('main-dashboard').style.display = "flex";
    document.getElementById('user-active').innerText = currentUser.nama;
    document.getElementById('role-display').innerText = currentUser.role;
    if (currentUser.role === "SISWA") {
        document.querySelectorAll('#link-admin,#link-users,#link-settings,#link-rekap').forEach(el => el.style.display="none");
        startUjianSiswa();
    } else {
        document.getElementById('link-ujian').style.display="none";
        showPage('admin');
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.style.display = "none");
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(id + '-page').style.display = "block";
    if (document.getElementById('link-' + id)) document.getElementById('link-' + id).classList.add('active');
    if (id === 'admin') renderTabelSoal();
    if (id === 'users') renderTabelSiswa();
    if (id === 'rekap') renderRekap();
    if (id === 'settings') {
        document.getElementById('set-token').value = settings.token;
        document.getElementById('set-durasi').value = settings.durasi;
        document.getElementById('set-toleransi').value = settings.toleransi;
    }
}

// --- SECURITY & BLOKIR ---
function activateSecurity() {
    window.onblur = () => {
        if (isWarningActive || !currentUser || currentUser.role !== "SISWA") return;
        
        isWarningActive = true; 
        pelanggaran++;
        document.getElementById('warning-box').style.display = "block";
        document.getElementById('warning-box').innerText = `Pelanggaran: ${pelanggaran}/${settings.toleransi}`;

        if (pelanggaran >= settings.toleransi) {
            alert("BATAS PELANGGARAN HABIS! Akun Anda diblokir.");
            blokirSiswaOtomatis(currentUser.user);
        } else {
            setTimeout(() => {
                alert(`DILARANG PINDAH TAB!\nPelanggaran: ${pelanggaran} dari ${settings.toleransi}`);
                isWarningActive = false; 
            }, 100);
        }
    };

    window.addEventListener('keydown', (e) => {
        if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && e.keyCode == 73) || (e.ctrlKey && e.keyCode == 85)) {
            e.preventDefault(); return false;
        }
    });
}

function blokirSiswaOtomatis(username) {
    dataSiswa = dataSiswa.map(s => s.username === username ? { ...s, isBlokir: true, status: "DIBLOKIR" } : s);
    localStorage.setItem('dataSiswaTKA', JSON.stringify(dataSiswa));
    submitUjian("DISKUALIFIKASI (Curang)");
}

function bukaBlokir(id) {
    dataSiswa = dataSiswa.map(s => s.id == id ? { ...s, isBlokir: false, status: "Belum" } : s);
    localStorage.setItem('dataSiswaTKA', JSON.stringify(dataSiswa));
    renderTabelSiswa();
}

// --- DATA SISWA ---
function simpanSiswa() {
    const id = document.getElementById('s-id').value, nama = document.getElementById('s-nama').value, user = document.getElementById('s-user').value, pass = document.getElementById('s-pass').value;
    if (!nama || !user || !pass) return alert("Lengkapi!");
    if (id) {
        const idx = dataSiswa.findIndex(s => s.id == id);
        dataSiswa[idx] = { ...dataSiswa[idx], nama, username: user, password: pass };
    } else {
        dataSiswa.push({ id: Date.now(), nama, username: user, password: pass, status: 'Belum', isBlokir: false });
    }
    localStorage.setItem('dataSiswaTKA', JSON.stringify(dataSiswa));
    resetUserForm(); renderTabelSiswa();
}

function editSiswa(id) {
    const s = dataSiswa.find(x => x.id == id);
    document.getElementById('s-id').value = s.id;
    document.getElementById('s-nama').value = s.nama;
    document.getElementById('s-user').value = s.username;
    document.getElementById('s-pass').value = s.password;
    document.getElementById('form-user-title').innerText = "Edit Siswa";
    document.getElementById('btn-user-cancel').style.display = "block";
}

function renderTabelSiswa() {
    document.querySelector('#tabel-siswa tbody').innerHTML = dataSiswa.map(s => `
        <tr style="${s.isBlokir ? 'background:#fee2e2' : ''}">
            <td>${s.nama}</td><td>${s.username}</td><td>${s.password}</td>
            <td style="color:${s.isBlokir ? 'red' : 'green'}"><b>${s.isBlokir ? 'BLOKIR' : s.status}</b></td>
            <td>
                ${s.isBlokir ? `<button onclick="bukaBlokir(${s.id})" style="background:#10b981; color:white;">Buka</button>` : `<button onclick="editSiswa(${s.id})">Edit</button>`}
                <button onclick="hapusSiswa(${s.id})" style="color:red; margin-left:5px;">Hapus</button>
            </td>
        </tr>`).join('');
}

function hapusSiswa(id) { if(confirm("Hapus?")) { dataSiswa = dataSiswa.filter(x => x.id != id); localStorage.setItem('dataSiswaTKA', JSON.stringify(dataSiswa)); renderTabelSiswa(); } }
function resetUserForm() { document.getElementById('s-id').value = ""; document.getElementById('s-nama').value = ""; document.getElementById('s-user').value = ""; document.getElementById('s-pass').value = ""; document.getElementById('form-user-title').innerText = "Tambah Siswa"; document.getElementById('btn-user-cancel').style.display = "none"; }

// --- BANK SOAL ---
function toggleInputTipe() {
    document.getElementById('wrap-pg').style.display = (document.getElementById('in-tipe').value === 'PG') ? 'block' : 'none';
    document.getElementById('in-kunci-lain').style.display = (document.getElementById('in-tipe').value !== 'PG') ? 'block' : 'none';
}

function simpanSoal() {
    const mapel = document.getElementById('in-mapel').value.toUpperCase(), tipe = document.getElementById('in-tipe').value, tanya = document.getElementById('in-tanya').value;
    if (!mapel || !tanya) return alert("Lengkapi!");
    bankSoal.push({ id: Date.now(), mapel, tipe, tanya, A: document.getElementById('in-a').value, B: document.getElementById('in-b').value, C: document.getElementById('in-c').value, D: document.getElementById('in-d').value, kunci: (tipe === 'PG') ? document.getElementById('in-kunci-pg').value : document.getElementById('in-kunci-lain').value });
    localStorage.setItem('bankSoalTKA', JSON.stringify(bankSoal));
    renderTabelSoal(); document.getElementById('in-tanya').value = "";
}

function renderTabelSoal() {
    document.querySelector('#tabel-soal tbody').innerHTML = bankSoal.map((s, i) => `<tr><td>${i+1}</td><td><span class="badge-mapel">${s.mapel}</span></td><td>${s.tipe}</td><td>${s.tanya.substring(0,25)}..</td><td><button onclick="hapusSoal(${s.id})">Hapus</button></td></tr>`).join('');
}
function hapusSoal(id) { bankSoal = bankSoal.filter(x => x.id !== id); localStorage.setItem('bankSoalTKA', JSON.stringify(bankSoal)); renderTabelSoal(); }

// --- REKAP & UJIAN ---
function renderRekap() {
    document.querySelector('#tabel-rekap tbody').innerHTML = hasilUjian.map((h, i) => `<tr><td>${h.nama}</td><td>${h.skor}</td><td>${h.waktu}</td><td><small>${h.jawaban.substring(0,20)}..</small></td><td><button onclick="hapusSatuRekap(${i})" style="color:red">Hapus</button></td></tr>`).join('');
}
function hapusSatuRekap(idx) { if (confirm("Hapus?")) { hasilUjian.splice(idx,1); localStorage.setItem('hasilTKA', JSON.stringify(hasilUjian)); renderRekap(); } }
function hapusSemuaRekap() { if (confirm("Reset?")) { hasilUjian = []; localStorage.setItem('hasilTKA', JSON.stringify(hasilUjian)); renderRekap(); } }

function startUjianSiswa() {
    const tok = prompt("Token Ujian:");
    if (tok !== settings.token) { alert("Token Salah!"); logout(); }
    else { showPage('ujian'); renderSoalUjian(); startTimer(); activateSecurity(); }
}

function renderSoalUjian() {
    document.getElementById('render-soal-ujian').innerHTML = bankSoal.map((s, i) => {
        let h = `<div class="card soal-card"><span class="badge-mapel">${s.mapel}</span><p><strong>${i+1}.</strong> ${s.tanya}</p>`;
        if (s.tipe === 'PG') h += ['A','B','C','D'].map(o => `<label class="opsi-item"><input type="radio" name="q-${s.id}" value="${o}" onchange="jawabanSiswa['${s.id}']='${o}'"> ${o}. ${s[o]}</label>`).join('');
        else h += `<textarea onkeyup="jawabanSiswa['${s.id}']=this.value" placeholder="Ketik jawaban..."></textarea>`;
        return h + `</div>`;
    }).join('');
}

function startTimer() {
    let sisa = settings.durasi * 60;
    timerVar = setInterval(() => {
        let m = Math.floor(sisa/60), s = sisa % 60;
        document.getElementById('timer-box').innerText = `${m}:${s<10?'0':''}${s}`;
        if (sisa-- <= 0) { clearInterval(timerVar); submitUjian("WAKTU HABIS"); }
    }, 1000);
}

function submitUjian(statusManual) {
    clearInterval(timerVar); window.onblur = null;
    let benar = 0, pg = 0;
    bankSoal.forEach(s => { if (s.tipe === 'PG') { pg++; if (jawabanSiswa[s.id] === s.kunci) benar++; } });
    const skorFinal = statusManual ? statusManual : (benar/pg*100 || 0).toFixed(2);
    const data = { nama: currentUser.nama, skor: skorFinal, waktu: new Date().toLocaleString(), jawaban: JSON.stringify(jawabanSiswa) };
    hasilUjian.push(data);
    localStorage.setItem('hasilTKA', JSON.stringify(hasilUjian));
    dataSiswa = dataSiswa.map(x => x.username === currentUser.user ? {...x, status: statusManual ? statusManual : 'Selesai'} : x);
    localStorage.setItem('dataSiswaTKA', JSON.stringify(dataSiswa));
    if (URL_CLOUD !== "PASTE_LINK_GOOGLE_SCRIPT_KAMU") fetch(URL_CLOUD, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
    alert("Selesai!"); logout();
}

function simpanSettings() {
    settings.token = document.getElementById('set-token').value;
    settings.durasi = document.getElementById('set-durasi').value;
    settings.toleransi = document.getElementById('set-toleransi').value;
    localStorage.setItem('settingsTKA', JSON.stringify(settings));
    alert("Tersimpan!");
}
function logout() { sessionStorage.removeItem('sesiTKA'); location.reload(); }