import { db, ref, push, onValue, query, orderByChild } from "./firebase.js";

let allData = [];
let currentFilteredData = null;
let lemburanData = [];
let karyawanMap = {};
let idMesinList = [];
let chart;

const tableBody = document.querySelector("#dataTable tbody");
const nikInput = document.querySelector('input[name="nik"]');
const nikWarning = document.getElementById("nikWarning");
const form = document.getElementById('downtimeForm');

function toast(icon, title) {
  Swal.fire({
    icon,
    title,
    toast: true,
    position: 'top-end',
    timer: 2000,
    showConfirmButton: false,
    timerProgressBar: true
  });
}

function modalError(text) {
  Swal.fire({ 
    icon: 'error', 
    title: 'Oops…', 
    text 
  });
}

function modalSuccess(text) {
  Swal.fire({ 
    icon: 'success', 
    title: 'Berhasil!', 
    text, 
    timer: 1800, 
    showConfirmButton: false 
  });
}

//HANDLER SUBMIT DATA DOWNTIME
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('submitBtn');
    const spinner = document.getElementById('loadingSpinner');

    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    spinner.style.display = 'inline';

    let data = Object.fromEntries(new FormData(form).entries());

    const nikCleaned = data.nik.replace(/^0+/, ""); // hapus nol di depan
    
    if (!karyawanMap[nikCleaned]) {
      modalError("NIK tidak ditemukan di database!");
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      spinner.style.display = 'none';
      return;
    }

    for (let key in data) {
      if (key !== "mulai" && key !== "selesai") {
        data[key] = data[key].toUpperCase();
      }
    }
      
    data.nik = nikCleaned;
    data.nik = String(Number(data.nik));

    // ===== VALIDASI WAKTU MULAI & SELESAI =====
    const [hMulai, mMulai] = data.mulai.split(":").map(Number);
    const [hSelesai, mSelesai] = data.selesai.split(":").map(Number);

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hMulai, mMulai);
    let end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hSelesai, mSelesai);

    // Jika jam selesai <= jam mulai → anggap lintas hari
    if (end <= start) {
        end.setDate(end.getDate() + 1);
    }

    // Hitung durasi menit
    const durasiMenit = (end - start) / 60000;

    // Validasi durasi (misalnya max 12 jam biar tidak salah input)
    if (durasiMenit <= 0 || durasiMenit > 12 * 60) {
      modalError("Input waktu tidak valid. Periksa kembali jam mulai dan selesai.");
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      spinner.style.display = 'none';
      return;
    }

    data.durasiMenit = durasiMenit;

    const today = new Date();
    const tanggalLocal = today.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/')
    .reverse()
    .join('-');
    data.tanggal = tanggalLocal;
    data.timestamp = Date.now();

    const bulan = today.toLocaleString('id-ID', { month: 'long' });
    const tahun = today.getFullYear();
    const nodeBulan = `downtime_${bulan.toLowerCase()}_${tahun}`;

    await push(ref(db, `downtime/${nodeBulan}`), data);

    modalSuccess("Data berhasil dikirim");
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    spinner.style.display = 'none';

    form.reset();
});

//FUNGSI UTILITY DAN CHECK FILTER
function isFilterActiveTabel() {
    return (
        document.getElementById('filterNama').value.trim() !== "" ||
        document.getElementById('filterTanggal').value !== "" ||
        document.getElementById('filterFactory').value !== "" ||
        document.getElementById('filterArea').value !== ""
    );
}

function isFilterActiveGrafik() {
    return (
        document.getElementById('filterGrafikFrom').value !== "" ||
        document.getElementById('filterGrafikTo').value !== ""
    );
}

function isFilterActiveSummary() {
    return (
        document.getElementById('filterSummaryNama').value.trim() !== "" ||
        document.getElementById('filterSummaryFrom').value !== "" ||
        document.getElementById('filterSummaryTo').value !== ""
    );
}

function isFilterActiveTopMesin() {
    return (
        document.getElementById('filterTopFrom').value !== "" ||
        document.getElementById('filterTopTo').value !== ""
    );
}

//FIREBASE LISTENER
onValue(ref(db, "karyawan"), snapshot => {
    karyawanMap = snapshot.val() || {};
    console.log("✅ Data karyawan terload:", karyawanMap);
    console.log("🔑 Keys:", Object.keys(karyawanMap));
});

onValue(ref(db, "idMesinList"), snapshot => {
    idMesinList = [];
    snapshot.forEach(child => {
        idMesinList.push(child.val());
    });

    populateIdMesinOptions();

});

function listenDowntime(bulanNode) {
  allData.length = 0;

  const q = query(ref(db, `downtime/${bulanNode}`), orderByChild("tanggal"));
  onValue(q, snapshot => {

    allData.length = 0; // reset biar gak dobel

    if (!snapshot.exists()) {
      console.warn("Tidak ada data untuk", bulanNode);
      allData.length = 0;
      renderTable([]);
      renderSummaryMekanik([]);
      renderTopIdMesin([]);
      return;
    }
      
    snapshot.forEach(child => {
      const val = child.val();
      allData.push({
        ...val,
        id: child.key
      });
    });

    renderTable(allData);
    renderSummaryMekanik();
    renderTopIdMesin(allData);

    if (document.getElementById('grafik').classList.contains('active')) {
      applyGrafikFilter();
    }
  });
}

const today = new Date();
const bulan = today.toLocaleString('id-ID', { month: 'long' });
const tahun = today.getFullYear();
const bulanNode = `downtime_${bulan.toLowerCase()}_${tahun}`;

// panggil load untuk pertama kali
listenDowntime(bulanNode);

onValue(ref(db, "lemburan"), snapshot => {
    lemburanData.length = 0;
    snapshot.forEach(monthNode => {
        const bulan = monthNode.key;
        monthNode.forEach(tglNode => {
          const tanggal = tglNode.key;
          tglNode.forEach(nikNode => {
            const data = nikNode.val();
            lemburanData.push({
              tanggal: tanggal,
              nik: data.nik,
              nama: data.nama,
              keterangan: data.keterangan
            });
          });
        });
    });

    renderLemburanTable(lemburanData);

});

nikInput.addEventListener("input", () => {
    const nik = nikInput.value.trim();
    if (nik === "") {
        nikWarning.style.display = "none";
      return;
    }

    const nikCleaned = nik.replace(/^0+/, ""); // hapus nol di depan

    console.log("Input NIK:", nik, "Cleaned:", nikCleaned);
    console.log("karyawanMap:", karyawanMap);

    if (karyawanMap[nikCleaned]) {
        nikWarning.style.display = "none";
    }
    else {
        nikWarning.style.display = "block";
    }
});

//FUNGSI HELPER
function populateIdMesinOptions() {
    const datalist = document.getElementById('idMesinOptions');
    datalist.innerHTML = '';  // Clear existing options

    idMesinList.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        datalist.appendChild(option);
    });
}

function resizeChart() {
    if (chart) {
        chart.destroy();
    }

      applyGrafikFilter(); // Ini akan memanggil renderChart() ulang dengan data yang sama

}

function formatInputRupiah(element) {
    let value = element.value.replace(/\D/g, '');  // Hapus semua non-digit
    value = parseInt(value || 0, 10).toLocaleString('id-ID');
    element.value = value;
}

// FUNGSI APPLY DAN RESET FILTER
function applyFilter() {
    const nama = document.getElementById('filterNama').value.toLowerCase();
    const tanggal = document.getElementById('filterTanggal').value;
    const Factory = document.getElementById('filterFactory').value.toUpperCase();
    const area = document.getElementById('filterArea').value;

    const filtered = allData.filter(d => {
        const mekanik = (karyawanMap[d.nik] || "").toLowerCase();
        return (!nama || mekanik.includes(nama)) &&
            (!tanggal || d.tanggal === tanggal) &&
            (!Factory || (d.Factory || "").toUpperCase() === Factory) &&
            (!area || (d.area || "").toUpperCase() === area);
    });

    currentFilteredData = filtered;

    // ➜ CEK JIKA TIDAK ADA DATA
    if (filtered.length === 0) {
        toast('info', 'Tidak ditemukan data');
    }

    renderTable(filtered);

}

function resetFilterTabel() {
    document.getElementById('filterNama').value = "";
    document.getElementById('filterTanggal').value = "";
    document.getElementById('filterFactory').value = "";
    document.getElementById('filterArea').value = "";

    currentFilteredData = null;  // <-- Reset state filter

    renderTable(allData, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyGrafikFilter() {
    if (allData.length === 0) return;

    const from = document.getElementById("filterGrafikFrom").value;
    const to = document.getElementById("filterGrafikTo").value;

    let source = allData;

    if (!from && !to) {
        const today = new Date();
        const nowdate = today.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
        source = allData.filter(row => row.tanggal === nowdate);

        if (source.length === 0) {
          toast('info', 'Tidak ditemukan data grafik');
          if (chart) chart.destroy(); // Hapus chart jika ada
          return;
        }

    }
        else {
          source = allData.filter(row => {
            return (!from || row.tanggal >= from) && (!to || row.tanggal <= to);
          });

          if (source.length === 0) {
            toast('info', 'Tidak ditemukan data grafik');
            if (chart) chart.destroy(); // Hapus chart jika ada
            return;
          }
        }

    const areaMap = {};
      source.forEach(row => {
        areaMap[row.area] = (areaMap[row.area] || 0) + 1;
      });

      renderChart(areaMap);

}

function resetFilterGrafik() {
    document.getElementById('filterGrafikFrom').value = "";
    document.getElementById('filterGrafikTo').value = "";
    applyGrafikFilter();
}

function applySummaryFilter() {
    const nama = document.getElementById('filterSummaryNama').value.toLowerCase();
    const from = document.getElementById('filterSummaryFrom').value;
    const to = document.getElementById('filterSummaryTo').value;

    const today = new Date();
    const nowdate = today.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

    let filtered = allData;

    if (!isFilterActiveSummary()) {
        const today = new Date();
        const nowdate = today.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
        filtered = allData.filter(row => row.tanggal === nowdate);

        if (filtered.length === 0) {
          toast('info', 'Tidak ditemukan data summary');
          document.getElementById("summaryContainer").innerHTML = "<p>Tidak ditemukan data summary.</p>";
          return;
        }
    }
    else {
        filtered = allData.filter(row => {
            const mekanik = (karyawanMap[row.nik] || "").toLowerCase();
            return (!nama || mekanik.includes(nama)) &&
                   (!from || row.tanggal >= from) &&
                   (!to || row.tanggal <= to);
        });

        if (filtered.length === 0) {
            toast('info', 'Tidak ditemukan data summary');
            document.getElementById("summaryContainer").innerHTML = "<p>Tidak ditemukan data summary.</p>";
            return;
        }
    }

    const summaryContainer = document.getElementById("summaryContainer");
    summaryContainer.innerHTML = "";

    const grouped = {};
    filtered.forEach(item => {
        const nama = karyawanMap[item.nik] || "Unknown";
        const key = `${nama}_${item.tanggal}`;
        grouped[key] = (grouped[key] || 0) + 1;
    });

    const sortedEntries = Object.entries(grouped)
    .sort((a, b) => {
        const [namaA] = a[0].split("_");
        const [namaB] = b[0].split("_");
        if (b[1] !== a[1]) return b[1] - a[1]; // Urut jumlah input menurun
        return namaA.localeCompare(namaB);    // Urut abjad jika sama
    });

    sortedEntries.forEach(([key, count]) => {
        const [nama, tanggal] = key.split("_");
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <h4>${nama}</h4>
          <p><strong>Tanggal:</strong> ${tanggal}</p>
          <p><strong>Jumlah Input:</strong> ${count}</p>
        `;

        summaryContainer.appendChild(card);

    });
}

function resetFilterSummary() {
    document.getElementById('filterSummaryNama').value = "";
    document.getElementById('filterSummaryFrom').value = "";
    document.getElementById('filterSummaryTo').value = "";
    applySummaryFilter();
    renderSummaryMekanik();
}

function applyTopIdMesinFilter() {
    const from = document.getElementById("filterTopFrom").value;
    const to = document.getElementById("filterTopTo").value;

    const today = new Date();
    const nowdate = today.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

    let filtered = allData;

    if (!isFilterActiveTopMesin()) {
        filtered = allData.filter(row => row.tanggal === nowdate);
        if (filtered.length === 0) {
          toast('info', 'Tidak ditemukan data top ID mesin');
          document.getElementById("topIdMesinContainer").innerHTML = "<p>Tidak ditemukan data top ID mesin.</p>";
          return;
        }
    }
    else {
        filtered = allData.filter(row => {
            return (!from || row.tanggal >= from) && (!to || row.tanggal <= to);
        });
        if (filtered.length === 0) {
            toast('info', 'Tidak ditemukan data top ID mesin');
            document.getElementById("topIdMesinContainer").innerHTML = "<p>Tidak ditemukan data top ID mesin.</p>";
            return;
        }
    }

    const container = document.getElementById("topIdMesinContainer");
    container.innerHTML = "";
    const grouped = {};

    filtered.forEach(item => {
        const tanggal = item.tanggal;
        if (!grouped[tanggal]) grouped[tanggal] = {};
        grouped[tanggal][item.idMesin] = (grouped[tanggal][item.idMesin] || 0) + 1;
    });

    Object.entries(grouped).forEach(([tanggal, mesinMap]) => {
        const sorted = Object.entries(mesinMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `<h4>Top 5 ID Mesin - ${tanggal}</h4>` +
          sorted.map(([id, count]) => `<p><strong>${id}</strong>: ${count}x</p>`).join("");
        container.appendChild(card);
    });
}

function resetFilterTopIdMesin() {
    document.getElementById('filterTopFrom').value = "";
    document.getElementById('filterTopTo').value = "";
    applyTopIdMesinFilter();
    renderTopIdMesin();
}

function applyFilterLemburan() {
    const keyword = document.getElementById('searchNama').value.toLowerCase();
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;

    let filtered = lemburanData.filter(row => {
        const matchKeyword = !keyword || row.nama.toLowerCase().includes(keyword) || row.nik.includes(keyword);
        const matchDate = (!from || row.tanggal >= from) && (!to || row.tanggal <= to);
        return matchKeyword && matchDate;
    });

    renderLemburanTable(filtered);

}

// FUNGSI RENDER
function renderTable(data = allData, forceShowAll = false) {
    const isMobile = window.innerWidth <= 576;
      
    let filtered = data;

    // Jika ada data filter aktif, gunakan itu
    if (currentFilteredData !== null && !forceShowAll) {
        filtered = currentFilteredData;
    }

    // Jika tidak ada filter aktif, pakai default logic tanggal hari ini
    if (!isFilterActiveTabel() && !forceShowAll && currentFilteredData === null) {
        const today = new Date();
        const nowdate = today.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
        filtered = data.filter(row => row.tanggal === nowdate);
    }

    if (isMobile) {
        renderCardView(filtered);  // <-- Pastikan CardView pakai data hasil filter
    }
    else {
        tableBody.innerHTML = '';
        filtered.forEach(row => {
            const mekanik = karyawanMap[row.nik] || "Unknown";
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${row.tanggal}</td>
              <td>${row.nik}</td>
              <td>${mekanik}</td>
              <td>${row.Factory}</td>
              <td>${row.area}</td>
              <td>${row.idMesin}</td>
              <td>${row.masalah}</td>
              <td>${row.tindakan}</td>
              <td>${row.sparepart}</td>
              <td>${row.mulai}</td>
              <td>${row.selesai}</td>
            `;

            tableBody.appendChild(tr);

        });
    }

    const areaMap = {};
    filtered.forEach(row => {
        areaMap[row.area] = (areaMap[row.area] || 0) + 1;
    });

    renderChart(areaMap);

}

// CARD VIEW RENDERER
function renderCardView(data) {
    const container = document.getElementById('cardTableContainer');
    container.innerHTML = '';
    data.forEach(row => {
        const mekanik = karyawanMap[row.nik] || 'Unknown';
        const card = document.createElement('div');
        card.className = 'card-summary';
        card.innerHTML = `
          <h4>${mekanik}</h4>
          <p><strong>Tanggal:</strong> ${row.tanggal}</p>
          <p><strong>Factory:</strong> ${row.Factory}</p>
          <p><strong>Area:</strong> ${row.area}</p>
          <p><strong>Mesin:</strong> ${row.idMesin}</p>
          <p><strong>Masalah:</strong> ${row.masalah}</p>
          <p><strong>Tindakan:</strong> ${row.tindakan}</p>
          <p><strong>Sparepart:</strong> ${row.sparepart}</p>
          <p><strong>Mulai:</strong> ${row.mulai}</p>
          <p><strong>Selesai:</strong> ${row.selesai}</p>
        `;

        container.appendChild(card);

    });
}

function renderChart(areaMap) {
    const ctx = document.getElementById("chart").getContext("2d");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(areaMap),
          datasets: [{
            label: 'Jumlah Downtime per Area',
            data: Object.values(areaMap),
            backgroundColor: '#dc3545'
          }]
        }
    });
}

function renderSummaryMekanik(filteredData = null) {
      const summaryContainer = document.getElementById("summaryContainer");
      summaryContainer.innerHTML = "";

      const today = new Date();
      const nowdate = today.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

      const source = filteredData || allData.filter(row => row.tanggal === nowdate);

      const grouped = {};

      source.forEach(item => {
        const nama = karyawanMap[item.nik] || "Unknown";
        const key = `${nama}_${item.tanggal}`;
        grouped[key] = (grouped[key] || 0) + 1;
      });

      const sortedEntries = Object.entries(grouped)
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          const [namaA] = a[0].split("_");
          const [namaB] = b[0].split("_");
          return namaA.localeCompare(namaB);
        });

      sortedEntries.forEach(([key, count]) => {
        const [nama, tanggal] = key.split("_");
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <h4>${nama}</h4>
          <p><strong>Tanggal:</strong> ${tanggal}</p>
          <p><strong>Jumlah Input:</strong> ${count}</p>
        `;
        summaryContainer.appendChild(card);
      });
    }

    function renderTopIdMesin(filteredData = null) {
      const container = document.getElementById("topIdMesinContainer");
      container.innerHTML = "";

      const today = new Date();
      const nowdate = today.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');

      const source = filteredData || allData.filter(row => row.tanggal === nowdate);

      const grouped = {};

      source.forEach(item => {
        const tanggal = item.tanggal;
        if (!grouped[tanggal]) grouped[tanggal] = {};
        grouped[tanggal][item.idMesin] = (grouped[tanggal][item.idMesin] || 0) + 1;
      });

      Object.entries(grouped).forEach(([tanggal, mesinMap]) => {
        const sorted = Object.entries(mesinMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `<h4>Top 5 ID Mesin - ${tanggal}</h4>` +
          sorted.map(([id, count]) => `<p><strong>${id}</strong>: ${count}x</p>`).join("");
          container.appendChild(card);
      });
    }

    function renderSummary(filtered) {
      const summaryDiv = document.getElementById("summaryContent");
      summaryDiv.innerHTML = "";

      const mekanikSummary = {};

      filtered.forEach(row => {
        const nama = karyawanMap[row.nik] || "Unknown";
        if (!mekanikSummary[nama]) mekanikSummary[nama] = {};
        const tgl = row.tanggal;
        mekanikSummary[nama][tgl] = (mekanikSummary[nama][tgl] || 0) + 1;
      });

      Object.entries(mekanikSummary).forEach(([nama, tanggalMap]) => {
        const card = document.createElement("div");
        card.className = "card-summary";
        card.innerHTML = `<h4>${nama}</h4>`;
        const ul = document.createElement("ul");

        Object.entries(tanggalMap).forEach(([tgl, count]) => {
          const li = document.createElement("li");
          li.textContent = `📅 ${tgl}: ${count} input`;
          ul.appendChild(li);
        });

        card.appendChild(ul);
        summaryDiv.appendChild(card);
      });
    }

    // RENDER TABLE
    function renderLemburanTable(data) {
      const tbody = document.querySelector('#lemburanTable tbody');
      tbody.innerHTML = "";

      if (data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4'>Tidak ditemukan data</td></tr>";
        return;
      }

      data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.tanggal}</td>
          <td>${row.nama}</td>
          <td>${row.nik}</td>
          <td>${row.keterangan}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // FUNGSI GAJI & LEMBUR

    ['gajiPokok', 'tunjangan', 'insentif'].forEach(id => {
      const input = document.getElementById(id);
      input.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');  // Hapus non-digit
        this.value = parseInt(value || 0, 10).toLocaleString('id-ID');
      });
    });

    function hitungGajiBruto() {
      // Mengambil nilai input
      let gajiPokok = getInputValue('gajiPokok');
      let tunjangan = getInputValue('tunjangan');
      let lembur1jam = parseFloat(document.getElementById('lembur1jam').value) || 0;
      let lembur2jam = parseFloat(document.getElementById('lembur2jam').value) || 0;
      let lembur3jam = parseFloat(document.getElementById('lembur3jam').value) || 0;
      let lembur4jam = parseFloat(document.getElementById('lembur4jam').value) || 0;
      let insentif = getInputValue('insentif');

      // Validasi input agar tidak kosong atau NaN
      if (isNaN(gajiPokok) || isNaN(tunjangan) || isNaN(lembur1jam) || isNaN(lembur2jam) || isNaN(lembur3jam) || isNaN(lembur4jam) || isNaN(insentif)) {
          modalError('Mohon masukkan semua data dengan benar!');
        return;
      }

      // Menghitung upah per jam lembur
      let upahPerJam = (gajiPokok + tunjangan) / 173;

      // Menghitung upah lembur 1 jam
      let upahLembur1Jam = upahPerJam * lembur1jam * 1.5;

      // Menghitung upah lembur 2 jam
      let upahLembur2Jam = upahPerJam * lembur2jam * 2;

      // Menghitung upah lembur 3 jam
      let upahLembur3Jam = upahPerJam * lembur3jam * 3;

      // Menghitung upah lembur 4 jam
      let upahLembur4Jam = upahPerJam * lembur4jam * 4;

      // Menghitung gaji bruto
      let gajiBruto = gajiPokok + tunjangan + upahLembur1Jam + upahLembur2Jam + upahLembur3Jam + upahLembur4Jam + insentif;

      // Menampilkan hasil dengan format yang lebih rapi
      document.getElementById('hasil').innerHTML = formatRupiah(gajiBruto);
    }

    // Fungsi untuk mengosongkan semua input
    function resetForm() {
      document.getElementById('gajiPokok').value = '';
      document.getElementById('tunjangan').value = '';
      document.getElementById('lembur1jam').value = '';
      document.getElementById('lembur2jam').value = '';
      document.getElementById('lembur3jam').value = '';
      document.getElementById('lembur4jam').value = '';
      document.getElementById('insentif').value = '';
      document.getElementById('hasil').innerHTML = ''; // Menghapus hasil perhitungan
    }

    //Fungsi untuk menambahkan pemisah ribuan dan juta
    function formatRupiah(angka) {
      if (isNaN(angka)) return '0';
        return angka.toLocaleString('id-ID'); // Format angka sesuai dengan format Indonesia
      }

    function getInputValue(id) {
      const value = document.getElementById(id).value.replace(/\D/g, '');  // Hapus non-digit
      return value ? parseFloat(value) : 0;  // Jika kosong, return 0
    }

    window.applyFilter = applyFilter;
    window.applyGrafikFilter = applyGrafikFilter;
    window.applySummaryFilter = applySummaryFilter;
    window.applyTopIdMesinFilter = applyTopIdMesinFilter;
    window.resetFilterTabel = resetFilterTabel;
    window.resetFilterGrafik = resetFilterGrafik;
    window.resetFilterSummary = resetFilterSummary;
    window.resetFilterTopIdMesin = resetFilterTopIdMesin;
    window.applyFilterLemburan = applyFilterLemburan;
    window.addEventListener('resize', () => {
      renderTable()
      resizeChart();
    });

    document.addEventListener("DOMContentLoaded", () => {
        const btnHitung = document.getElementById("btnHitung");
        const btnReset = document.getElementById("btnReset");

        if (btnHitung) {
            btnHitung.addEventListener("click", hitungGajiBruto);
        }
        if (btnReset) {
            btnReset.addEventListener("click", resetForm);
        }
    });
