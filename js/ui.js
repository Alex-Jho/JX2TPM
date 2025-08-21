import { auth } from "./firebase.js";

function showSection(id) {
    const user = auth.currentUser;

    // Kalau belum login → hanya bisa lihat login & register
    if (!user && id !== "login") {
        id = "login";
    }

    // kalau sudah login, jangan izinkan balik ke login/register
    if (user && (id === "login")) {
        id = "petunjuk";
    }

    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById(id);
    if (targetSection) {
        targetSection.classList.add("active");
    }
}

function togglePassword(inputId, el) {
  const input = document.getElementById(inputId);
  const icon = el.querySelector("i");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("bi-eye");
    icon.classList.add("bi-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("bi-eye-slash");
    icon.classList.add("bi-eye");
  }
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

document.querySelectorAll(".accordion-header").forEach(btn => {
  btn.addEventListener("click", function () {
    const item = this.parentElement;
    item.classList.toggle("active");

    // Tutup accordion lain (jika hanya mau satu terbuka)
    document.querySelectorAll(".accordion-item").forEach(other => {
      if (other !== item) {
        other.classList.remove("active");
      }
    });
  });
});

window.showSection = showSection;
window.toggleSubmenu = toggleSubmenu;
window.togglePassword = togglePassword;
