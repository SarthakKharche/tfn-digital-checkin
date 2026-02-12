/**
 * ============================================
 * CSV Upload & QR Code Generation Module
 * ============================================
 *
 * Handles:
 * - CSV file selection (drag & drop + click)
 * - CSV parsing with PapaParse
 * - Data validation
 * - QR code generation for each attendee
 * - Batch upload to Firebase Firestore
 * - Duplicate detection (by PRN)
 */

const UploadModule = (() => {
  // --- DOM Elements ---
  const uploadArea    = document.getElementById("uploadArea");
  const fileInput     = document.getElementById("csvFileInput");
  const fileInfo      = document.getElementById("fileInfo");
  const fileName      = document.getElementById("fileName");
  const removeFileBtn = document.getElementById("removeFile");
  const processBtn    = document.getElementById("processBtn");
  const progressContainer = document.getElementById("progressContainer");
  const progressText  = document.getElementById("progressText");
  const progressPercent = document.getElementById("progressPercent");
  const progressFill  = document.getElementById("progressFill");
  const resultsContainer = document.getElementById("resultsContainer");
  const totalUploaded = document.getElementById("totalUploaded");
  const totalSkipped  = document.getElementById("totalSkipped");
  const totalFailed   = document.getElementById("totalFailed");
  const previewContainer = document.getElementById("previewContainer");
  const previewBody   = document.getElementById("previewBody");

  let parsedData = [];       // Holds parsed CSV rows
  let qrDataMap = {};        // PRN → base64 QR data URL
  let selectedFile = null;

  // --- Required CSV columns ---
  const REQUIRED_COLUMNS = ["name", "prn", "email", "mobile", "year"];

  /**
   * Initialize event listeners
   */
  function init() {
    // Click to open file dialog
    uploadArea.addEventListener("click", () => fileInput.click());

    // File input change
    fileInput.addEventListener("change", handleFileSelect);

    // Drag & drop support
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });
    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].name.endsWith(".csv")) {
        selectedFile = files[0];
        onFileReady();
      } else {
        showToast("Please drop a valid .csv file", "error");
      }
    });

    // Remove file
    removeFileBtn.addEventListener("click", resetUpload);

    // Process button
    processBtn.addEventListener("click", processAndUpload);
  }

  /**
   * Handle file input selection
   */
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      showToast("Please select a valid .csv file", "error");
      return;
    }
    selectedFile = file;
    onFileReady();
  }

  /**
   * Called when a file is ready — parse and show preview
   */
  function onFileReady() {
    // Show file info
    uploadArea.style.display = "none";
    fileInfo.style.display = "flex";
    fileName.textContent = selectedFile.name;

    // Parse the CSV
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: async (results) => {
        // Validate columns
        const headers = results.meta.fields.map((f) => f.toLowerCase());
        const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));

        if (missing.length > 0) {
          showToast(`Missing columns: ${missing.join(", ")}`, "error");
          resetUpload();
          return;
        }

        // Clean & store data
        parsedData = results.data
          .filter((row) => row.name && row.prn)  // Skip rows with no name/prn
          .map((row) => ({
            name:   (row.name   || "").trim(),
            prn:    (row.prn    || "").toString().trim(),
            email:  (row.email  || "").trim(),
            mobile: (row.mobile || "").toString().trim(),
            year:   (row.year   || "").toString().trim()
          }));

        if (parsedData.length === 0) {
          showToast("CSV has no valid rows", "error");
          resetUpload();
          return;
        }

        showToast(`Parsed ${parsedData.length} records — generating QR codes...`, "success");

        // Pre-generate all QR codes so they appear in the preview
        qrDataMap = {};
        for (const row of parsedData) {
          qrDataMap[row.prn] = await generateQRCode(row.prn);
        }

        showPreview();
        processBtn.disabled = false;
      },
      error: (err) => {
        showToast("Error parsing CSV: " + err.message, "error");
        resetUpload();
      }
    });
  }

  /**
   * Show a preview of parsed CSV data with QR codes
   */
  function showPreview() {
    previewBody.innerHTML = "";
    parsedData.forEach((row, i) => {
      const qrSrc = qrDataMap[row.prn] || "";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.prn)}</td>
        <td>${escapeHtml(row.email)}</td>
        <td>${escapeHtml(row.mobile)}</td>
        <td>${escapeHtml(row.year)}</td>
        <td>${qrSrc ? `<img src="${qrSrc}" alt="QR" class="qr-thumb" style="width:48px;height:48px;" />` : "—"}</td>
      `;
      previewBody.appendChild(tr);
    });
    previewContainer.style.display = "block";

    // Click QR thumbnail in preview to show large modal
    previewContainer.querySelectorAll(".qr-thumb").forEach((img, idx) => {
      img.addEventListener("click", () => {
        const row = parsedData[idx];
        const qrSrc = qrDataMap[row.prn];
        document.getElementById("qrModalTitle").textContent = `QR Code — ${row.prn}`;
        document.getElementById("qrModalPRN").textContent = `${row.name} (${row.prn})`;
        document.getElementById("qrModalCode").innerHTML = `<img src="${qrSrc}" alt="QR" style="width:256px;height:256px;" />`;
        document.getElementById("qrModal").style.display = "flex";
      });
    });
  }

  /**
   * Process: upload pre-generated QR codes + data to Firestore
   */
  async function processAndUpload() {
    if (parsedData.length === 0) return;

    processBtn.disabled = true;
    progressContainer.style.display = "block";
    resultsContainer.style.display = "none";

    // Quick connectivity check — try a simple Firestore read with 8s timeout
    updateProgress(0, 1, "Testing Firebase connection...");
    try {
      await withTimeout(attendeesRef.limit(1).get(), 8000);
    } catch (err) {
      console.error("Firebase connectivity check failed:", err);
      showToast(
        "Cannot reach Firebase! Disable ad-blockers / privacy extensions for this site, then retry.",
        "error"
      );
      processBtn.disabled = false;
      progressContainer.style.display = "none";
      return;
    }

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;
    const total = parsedData.length;

    for (let i = 0; i < total; i++) {
      const row = parsedData[i];
      updateProgress(i + 1, total, `Processing ${row.name}...`);

      try {
        // Check if PRN already exists in Firestore (duplicate detection) — 10s timeout
        const existing = await withTimeout(
          attendeesRef.where("prn", "==", row.prn).limit(1).get(),
          10000
        );

        if (!existing.empty) {
          skipped++;
          continue;
        }

        // Use pre-generated QR code
        const qrDataUrl = qrDataMap[row.prn] || "";

        // Build the Firestore document
        const docData = {
          name:        row.name,
          prn:         row.prn,
          email:       row.email,
          mobile:      row.mobile,
          year:        row.year,
          qrData:      qrDataUrl,
          checkedIn:   false,
          checkInTime: null,
          createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        };

        // Add to Firestore — 10s timeout
        await withTimeout(attendeesRef.add(docData), 10000);
        uploaded++;
      } catch (err) {
        console.error(`Failed to process ${row.prn}:`, err);
        failed++;
      }
    }

    // Show results
    updateProgress(total, total, "Complete!");
    totalUploaded.textContent = uploaded;
    totalSkipped.textContent = skipped;
    totalFailed.textContent = failed;
    resultsContainer.style.display = "block";

    showToast(
      `Upload complete: ${uploaded} added, ${skipped} skipped, ${failed} failed`,
      failed > 0 ? "warning" : "success"
    );
  }

  /**
   * Wrap a promise with a timeout — rejects if it doesn't resolve in time
   */
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
      )
    ]);
  }

  /**
   * Generate a QR code and return its base64 data URL
   * @param {string} data - Data to encode (PRN)
   * @returns {Promise<string>} Base64 data URL of the QR PNG
   */
  /**
   * Retry an async function up to maxRetries times with exponential backoff
   */
  async function retryAsync(fn, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  function generateQRCode(data) {
    return new Promise((resolve) => {
      // Create a temporary off-screen container (not display:none so canvas renders)
      const tempDiv = document.createElement("div");
      tempDiv.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
      document.body.appendChild(tempDiv);

      // Generate QR
      new QRCode(tempDiv, {
        text: data,
        width: 256,
        height: 256,
        colorDark: "#1e293b",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });

      // Wait for the canvas to render
      setTimeout(() => {
        const canvas = tempDiv.querySelector("canvas");
        const dataUrl = canvas ? canvas.toDataURL("image/png") : "";
        tempDiv.remove();
        resolve(dataUrl);
      }, 50);
    });
  }

  /**
   * Update the progress bar UI
   */
  function updateProgress(current, total, text) {
    const pct = Math.round((current / total) * 100);
    progressText.textContent = text;
    progressPercent.textContent = `${pct}%`;
    progressFill.style.width = `${pct}%`;
  }

  /**
   * Reset the upload interface
   */
  function resetUpload() {
    selectedFile = null;
    parsedData = [];
    qrDataMap = {};
    fileInput.value = "";
    uploadArea.style.display = "";
    fileInfo.style.display = "none";
    processBtn.disabled = true;
    progressContainer.style.display = "none";
    resultsContainer.style.display = "none";
    previewContainer.style.display = "none";
    previewBody.innerHTML = "";
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Public API
  return { init };
})();
