/**
 * ============================================
 * App Initialization & Navigation
 * ============================================
 *
 * Handles SPA-style page switching between:
 *   - Upload CSV
 *   - Check-In (QR Scanner)
 *   - Dashboard
 */

document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();

  // --- DOM references ---
  const loginPage   = document.getElementById("page-login");
  const mainApp     = document.getElementById("mainApp");
  const loginForm   = document.getElementById("loginForm");
  const loginEmail  = document.getElementById("loginEmail");
  const loginPass   = document.getElementById("loginPassword");
  const loginError  = document.getElementById("loginError");
  const togglePwBtn = document.getElementById("togglePassword");
  const logoutBtn   = document.getElementById("logoutBtn");

  // --- Firebase Auth state listener (auto-restores session) ---
  auth.onAuthStateChanged((user) => {
    if (user) {
      showApp();
    } else {
      mainApp.style.display = "none";
      loginPage.style.display = "flex";
    }
  });

  // --- Login form submit ---
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";

    const email = loginEmail.value.trim();
    const pass  = loginPass.value;

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      // onAuthStateChanged will handle showing the app
    } catch (err) {
      console.error("Login failed:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        loginError.textContent = "Invalid email or password.";
      } else if (err.code === "auth/too-many-requests") {
        loginError.textContent = "Too many attempts. Try again later.";
      } else {
        loginError.textContent = "Login failed. Please try again.";
      }
      loginPass.value = "";
      loginPass.focus();
    }
  });

  // --- Toggle password visibility ---
  togglePwBtn.addEventListener("click", () => {
    const isPassword = loginPass.type === "password";
    loginPass.type = isPassword ? "text" : "password";
    togglePwBtn.querySelector("i").className = isPassword
      ? "fas fa-eye-slash"
      : "fas fa-eye";
  });

  // --- Logout ---
  logoutBtn.addEventListener("click", async () => {
    CheckInModule.stopScanner();
    await auth.signOut();
    loginEmail.value = "";
    loginPass.value = "";
    loginError.textContent = "";
  });

  // --- Show main app & initialize modules ---
  function showApp() {
    loginPage.style.display = "none";
    mainApp.style.display = "block";
    initApp();
  }

  let appInitialized = false;
  function initApp() {
    if (appInitialized) return;
    appInitialized = true;

    UploadModule.init();
    CheckInModule.init();
    DashboardModule.init();
    EventsModule.init();

    // --- Hamburger Menu Toggle ---
    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const navLinksEl   = document.getElementById("navLinks");
    const navOverlay   = document.getElementById("navOverlay");

    function openMenu() {
      hamburgerBtn.classList.add("active");
      navLinksEl.classList.add("open");
      navOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    function closeMenu() {
      hamburgerBtn.classList.remove("active");
      navLinksEl.classList.remove("open");
      navOverlay.classList.remove("active");
      document.body.style.overflow = "";
    }

    hamburgerBtn.addEventListener("click", () => {
      navLinksEl.classList.contains("open") ? closeMenu() : openMenu();
    });

    navOverlay.addEventListener("click", closeMenu);

    // --- Page Navigation ---
    const navBtns = document.querySelectorAll(".nav-btn[data-page]");
    const pages   = document.querySelectorAll(".page");

    navBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetPage = btn.dataset.page;

        // Update active nav button
        navBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        // Show target page, hide others
        pages.forEach((p) => {
          p.classList.toggle("active", p.id === `page-${targetPage}`);
        });

        // Close hamburger menu on mobile after navigation
        closeMenu();

        // Stop scanner when navigating away from Check-In
        if (targetPage !== "checkin") {
          CheckInModule.stopScanner();
        }

        // Auto-refresh dashboard when navigating to it
        if (targetPage === "dashboard") {
          DashboardModule.loadDashboard();
        }

        // Auto-refresh events list when navigating to it
        if (targetPage === "events") {
          EventsModule.loadEvents();
        }
      });
    });
  }
});
