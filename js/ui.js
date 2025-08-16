function showSection(id) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function toggleSubmenu() {
    const sub = document.getElementById("submenu");
    sub.style.display = sub.style.display === "none" ? "block" : "none";
}

document.querySelectorAll('.sidebar ul li').forEach(li => {
    li.addEventListener('click', function () {
    document.querySelectorAll('.sidebar ul li').forEach(item => item.classList.remove('active'));
    this.classList.add('active');
    });
});

document.getElementById('exportExcelBtn').addEventListener('click', () => {
    // Ambil data tabel (yang sedang tampil)
    const table = document.getElementById('dataTable');
    const wb = XLSX.utils.table_to_book(table, {sheet:"Data Downtime"});

    // Save file Excel
    XLSX.writeFile(wb, 'data-downtime.xlsx');
});

const btn = document.getElementById("toggleSidebar");
const sidebar = document.querySelector(".sidebar");
const main = document.querySelector(".main");
const overlay = document.getElementById('overlay');

btn.addEventListener("click", () => {
    if (window.innerWidth <= 576) {
        sidebar.classList.toggle("active");
    }
        else {
            sidebar.classList.toggle("collapsed");
            main.classList.toggle("expanded");
            /*document.querySelector(".main").classList.toggle("expanded");*/
        }
});

overlay.addEventListener("click", () => {
    sidebar.classList.remove("active");
});

window.showSection = showSection;
window.toggleSubmenu = toggleSubmenu;