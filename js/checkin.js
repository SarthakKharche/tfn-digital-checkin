/**
 * ============================================
 * QR Scanner & Check-In Module
 * ============================================
 *
 * Handles:
 * - Camera-based QR code scanning (Html5-QRCode)
 * - Fetching attendee details from Firestore by PRN
 * - Marking attendee as checked-in with timestamp
 * - Duplicate check-in prevention
 * - Manual PRN lookup fallback
 */

const CheckInModule = (() => {
  // --- DOM Elements ---
  const startScanBtn   = document.getElementById("startScanBtn");
  const stopScanBtn    = document.getElementById("stopScanBtn");
  const manualPRN      = document.getElementById("manualPRN");
  const manualCheckInBtn = document.getElementById("manualCheckInBtn");

  // Result state containers
  const resultDefault  = document.getElementById("resultDefault");
  const resultLoading  = document.getElementById("resultLoading");
  const resultSuccess  = document.getElementById("resultSuccess");
  const resultAlready  = document.getElementById("resultAlready");
  const resultNotFound = document.getElementById("resultNotFound");
  const attendeeDetails       = document.getElementById("attendeeDetails");
  const attendeeDetailsAlready = document.getElementById("attendeeDetailsAlready");
  const alreadyTime    = document.getElementById("alreadyTime");

  let html5QrCode = null;   // Scanner instance
  let isScanning = false;
  let lastScannedCode = "";  // Prevent rapid duplicate scans
  let scanCooldown = false;

  /**
   * Initialize event listeners
   */
  function init() {
    startScanBtn.addEventListener("click", startScanner);
    stopScanBtn.addEventListener("click", stopScanner);
    manualCheckInBtn.addEventListener("click", handleManualCheckIn);

    // Allow Enter key for manual PRN input
    manualPRN.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleManualCheckIn();
    });
  }

  /**
   * Start the QR camera scanner
   */
  async function startScanner() {
    try {
      html5QrCode = new Html5Qrcode("qr-reader");

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1
      };

      await html5QrCode.start(
        { facingMode: "environment" },   // Use rear camera on mobile
        config,
        onScanSuccess,
        onScanFailure
      );

      isScanning = true;
      startScanBtn.style.display = "none";
      stopScanBtn.style.display = "inline-flex";
      showToast("Scanner started — point at a QR code", "info");
    } catch (err) {
      console.error("Scanner error:", err);
      showToast("Could not start camera. Check permissions.", "error");
    }
  }

  /**
   * Stop the QR camera scanner
   */
  async function stopScanner() {
    if (html5QrCode && isScanning) {
      try {
        await html5QrCode.stop();
      } catch (_) { /* ignore */ }
      isScanning = false;
    }
    startScanBtn.style.display = "inline-flex";
    stopScanBtn.style.display = "none";
  }

  /**
   * Called on successful QR decode
   * @param {string} decodedText - The decoded QR content (PRN)
   */
  function onScanSuccess(decodedText) {
    // Cooldown to prevent rapid repeated scans of same code
    if (scanCooldown || decodedText === lastScannedCode) return;

    lastScannedCode = decodedText;
    scanCooldown = true;
    setTimeout(() => {
      scanCooldown = false;
      lastScannedCode = "";
    }, 3000);  // 3-second cooldown

    // Play a subtle beep (optional)
    playBeep();

    // Look up and check-in
    lookupAndCheckIn(decodedText.trim());
  }

  /**
   * Called on scan failure (no QR in frame) — silently ignored
   */
  function onScanFailure(_message) {
    // No action needed — this fires continuously when no QR is in view
  }

  /**
   * Handle manual PRN entry
   */
  function handleManualCheckIn() {
    const prn = manualPRN.value.trim();
    if (!prn) {
      showToast("Please enter a PRN", "warning");
      return;
    }
    lookupAndCheckIn(prn);
    manualPRN.value = "";
  }

  /**
   * Look up an attendee by PRN and perform check-in
   * @param {string} prn - The PRN to search for
   */
  async function lookupAndCheckIn(prn) {
    showState("loading");

    // Ensure an event is selected
    const eventId = EventsModule.getSelectedEventId();
    if (!eventId) {
      showToast("Please select an event first from the Events page!", "warning");
      showState("default");
      return;
    }

    try {
      // Query Firestore for this PRN within the selected event
      const snapshot = await attendeesRef
        .where("prn", "==", prn)
        .where("eventId", "==", eventId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        showState("notFound");
        showToast("No registration found for this QR code", "error");
        return;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      // Check if already checked in
      if (data.checkedIn) {
        const checkInTime = data.checkInTime
          ? data.checkInTime.toDate().toLocaleString()
          : "Unknown time";
        alreadyTime.textContent = `Checked in at: ${checkInTime}`;
        renderAttendeeDetails(attendeeDetailsAlready, data);
        showState("already");
        showToast(`${data.name} is already checked in!`, "warning");
        return;
      }

      // Mark as checked in
      await doc.ref.update({
        checkedIn: true,
        checkInTime: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Show success
      renderAttendeeDetails(attendeeDetails, data);
      showState("success");
      showToast(`${data.name} checked in successfully!`, "success");

    } catch (err) {
      console.error("Check-in error:", err);
      showState("notFound");
      showToast("Error during check-in. Please try again.", "error");
    }
  }

  /**
   * Render attendee details in the given container
   */
  function renderAttendeeDetails(container, data) {
    container.innerHTML = `
      <div class="detail-row">
        <span class="detail-label">Name</span>
        <span class="detail-value">${escapeHtml(data.name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">PRN</span>
        <span class="detail-value">${escapeHtml(data.prn)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Email</span>
        <span class="detail-value">${escapeHtml(data.email)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Mobile</span>
        <span class="detail-value">${escapeHtml(data.mobile)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Year</span>
        <span class="detail-value">${escapeHtml(data.year)}</span>
      </div>
    `;
  }

  /**
   * Show a specific result state, hide all others
   * @param {"default"|"loading"|"success"|"already"|"notFound"} state
   */
  function showState(state) {
    resultDefault.style.display  = state === "default"  ? "" : "none";
    resultLoading.style.display  = state === "loading"  ? "" : "none";
    resultSuccess.style.display  = state === "success"  ? "" : "none";
    resultAlready.style.display  = state === "already"  ? "" : "none";
    resultNotFound.style.display = state === "notFound" ? "" : "none";
  }

  /**
   * Play a short beep sound on successful scan
   */
  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (_) { /* Audio not supported */ }
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
  return { init, stopScanner };
})();
