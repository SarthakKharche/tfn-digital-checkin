/**
 * ============================================
 * Dashboard Module
 * ============================================
 *
 * Handles:
 * - Loading all attendee records from Firestore
 * - Displaying real-time stats (total, checked-in, pending, rate)
 * - Searchable & filterable attendee table
 * - QR code modal view per attendee
 * - CSV export of attendee list with check-in status
 */

const DashboardModule = (() => {
  // --- DOM Elements ---
  const dashTotalRegistered = document.getElementById("dashTotalRegistered");
  const dashCheckedIn       = document.getElementById("dashCheckedIn");
  const dashPending         = document.getElementById("dashPending");
  const dashPercentage      = document.getElementById("dashPercentage");
  const searchInput         = document.getElementById("searchInput");
  const attendeesBody       = document.getElementById("attendeesBody");
  const emptyState          = document.getElementById("emptyState");
  const refreshBtn          = document.getElementById("refreshDashboard");
  const exportBtn           = document.getElementById("exportBtn");
  const qrModal             = document.getElementById("qrModal");
  const qrModalTitle        = document.getElementById("qrModalTitle");
  const qrModalCode         = document.getElementById("qrModalCode");
  const qrModalPRN          = document.getElementById("qrModalPRN");
  const closeQrModal        = document.getElementById("closeQrModal");
  const filterBtns          = document.querySelectorAll(".filter-btn");

  let allAttendees = [];   // Full cached list
  let currentFilter = "all";

  /**
   * Initialize event listeners
   */
  function init() {
    refreshBtn.addEventListener("click", loadDashboard);
    exportBtn.addEventListener("click", exportCSV);
    closeQrModal.addEventListener("click", () => (qrModal.style.display = "none"));
    qrModal.addEventListener("click", (e) => {
      if (e.target === qrModal) qrModal.style.display = "none";
    });

    // Search
    searchInput.addEventListener("input", renderTable);

    // Filter buttons
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        renderTable();
      });
    });
  }

  /**
   * Load all attendee data from Firestore
   */
  async function loadDashboard() {
    // Ensure an event is selected
    const eventId = EventsModule.getSelectedEventId();
    if (!eventId) {
      showToast("Please select an event first from the Events page!", "warning");
      allAttendees = [];
      updateStats();
      renderTable();
      return;
    }

    try {
      const snapshot = await attendeesRef
        .where("eventId", "==", eventId)
        .orderBy("createdAt", "desc")
        .get();
      allAttendees = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      updateStats();
      renderTable();
      showToast(`Loaded ${allAttendees.length} records`, "info");
    } catch (err) {
      console.error("Dashboard load error:", err);
      showToast("Failed to load data from Firebase", "error");
    }
  }

  /**
   * Update the stat cards
   */
  function updateStats() {
    const total = allAttendees.length;
    const checkedIn = allAttendees.filter((a) => a.checkedIn).length;
    const pending = total - checkedIn;
    const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    dashTotalRegistered.textContent = total;
    dashCheckedIn.textContent = checkedIn;
    dashPending.textContent = pending;
    dashPercentage.textContent = `${pct}%`;
  }

  /**
   * Render (or re-render) the attendees table with search & filter
   */
  function renderTable() {
    const query = searchInput.value.toLowerCase().trim();

    // Apply filter + search
    const filtered = allAttendees.filter((a) => {
      // Filter
      if (currentFilter === "checked-in" && !a.checkedIn) return false;
      if (currentFilter === "pending" && a.checkedIn) return false;

      // Search
      if (query) {
        const haystack = `${a.name} ${a.prn} ${a.email}`.toLowerCase();
        return haystack.includes(query);
      }
      return true;
    });

    attendeesBody.innerHTML = "";

    if (filtered.length === 0) {
      emptyState.style.display = "";
      return;
    }
    emptyState.style.display = "none";

    filtered.forEach((a, i) => {
      const checkInTime = a.checkInTime
        ? a.checkInTime.toDate().toLocaleString()
        : "—";

      const statusClass = a.checkedIn ? "checked-in" : "pending";
      const statusIcon  = a.checkedIn ? "fa-check" : "fa-clock";
      const statusText  = a.checkedIn ? "Checked In" : "Pending";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="#">${i + 1}</td>
        <td data-label="Name">${escapeHtml(a.name)}</td>
        <td data-label="PRN">${escapeHtml(a.prn)}</td>
        <td data-label="Email">${escapeHtml(a.email)}</td>
        <td data-label="Mobile">${escapeHtml(a.mobile)}</td>
        <td data-label="Year">${escapeHtml(a.year)}</td>
        <td data-label="Status">
          <span class="status-badge ${statusClass}">
            <i class="fas ${statusIcon}"></i> ${statusText}
          </span>
        </td>
        <td data-label="Check-In">${checkInTime}</td>
        <td data-label="QR">
          ${
            a.qrData
              ? `<img src="${a.qrData}" alt="QR" class="qr-thumb" data-prn="${escapeHtml(a.prn)}" data-qr="${a.qrData}" />`
              : "—"
          }
        </td>
      `;
      attendeesBody.appendChild(tr);
    });

    // QR thumbnail click → open modal
    document.querySelectorAll(".qr-thumb").forEach((img) => {
      img.addEventListener("click", () => {
        const prn = img.dataset.prn;
        const qrSrc = img.dataset.qr;
        qrModalTitle.textContent = `QR Code — ${prn}`;
        qrModalPRN.textContent = prn;
        qrModalCode.innerHTML = `<img src="${qrSrc}" alt="QR Code" style="width:256px;height:256px;" />`;
        qrModal.style.display = "flex";
      });
    });
  }

  /**
   * Export attendee data as a downloadable CSV
   */
  function exportCSV() {
    // Apply the same filter + search as the visible table
    const query = searchInput.value.toLowerCase().trim();
    const exportData = allAttendees.filter((a) => {
      if (currentFilter === "checked-in" && !a.checkedIn) return false;
      if (currentFilter === "pending" && a.checkedIn) return false;
      if (query) {
        const haystack = `${a.name} ${a.prn} ${a.email}`.toLowerCase();
        return haystack.includes(query);
      }
      return true;
    });

    if (exportData.length === 0) {
      showToast("No data to export. Refresh or change filters.", "warning");
      return;
    }

    const rows = [
      ["#", "Name", "PRN", "Email", "Mobile", "Year", "Status", "Check-In Time"]
    ];

    exportData.forEach((a, i) => {
      const checkInTime = a.checkInTime
        ? a.checkInTime.toDate().toLocaleString()
        : "";
      rows.push([
        i + 1,
        a.name,
        a.prn,
        a.email,
        a.mobile,
        a.year,
        a.checkedIn ? "Checked In" : "Pending",
        checkInTime
      ]);
    });

    // Convert to CSV string
    const csvContent = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `checkin-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    showToast("CSV exported successfully", "success");
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Public API
  return { init, loadDashboard };
})();
