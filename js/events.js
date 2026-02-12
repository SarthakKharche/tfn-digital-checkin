/**
 * ============================================
 * Events Management Module
 * ============================================
 *
 * Handles:
 * - Creating new events
 * - Deleting events (with all associated attendees)
 * - Listing all events
 * - Selecting the active event for other modules
 *
 * Firestore Schema:
 * Collection: "events"
 * Document fields:
 *   - name        (string)    : Event name
 *   - date        (string)    : Event date
 *   - description (string)    : Short description
 *   - createdAt   (timestamp) : Record creation time
 */

const EventsModule = (() => {
  // --- DOM Elements ---
  const eventsList      = document.getElementById("eventsList");
  const addEventBtn     = document.getElementById("addEventBtn");
  const eventNameInput  = document.getElementById("eventName");
  const eventDateInput  = document.getElementById("eventDate");
  const eventDescInput  = document.getElementById("eventDescription");
  const addEventForm    = document.getElementById("addEventForm");
  const noEventsMsg     = document.getElementById("noEventsMsg");
  const globalEventBar  = document.getElementById("globalEventBar");
  const globalEventName = document.getElementById("globalEventName");

  // Firestore collection (defined in firebase-config.js as eventsRef)

  // Currently selected event
  let selectedEventId   = null;
  let selectedEventName = "";
  let allEvents = [];

  /**
   * Initialize module
   */
  function init() {
    addEventForm.addEventListener("submit", handleAddEvent);
    loadEvents();
  }

  /**
   * Load all events from Firestore
   */
  async function loadEvents() {
    try {
      const snapshot = await eventsRef.orderBy("createdAt", "desc").get();
      allEvents = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      renderEvents();

      // Auto-select first event if none selected
      if (!selectedEventId && allEvents.length > 0) {
        selectEvent(allEvents[0].id, allEvents[0].name);
      }

      // Update global bar visibility
      updateGlobalBar();
    } catch (err) {
      console.error("Failed to load events:", err);
      showToast("Failed to load events from Firebase", "error");
    }
  }

  /**
   * Render the events list
   */
  function renderEvents() {
    eventsList.innerHTML = "";

    if (allEvents.length === 0) {
      noEventsMsg.style.display = "";
      return;
    }
    noEventsMsg.style.display = "none";

    allEvents.forEach((evt) => {
      const card = document.createElement("div");
      card.className = `event-card${evt.id === selectedEventId ? " selected" : ""}`;
      card.innerHTML = `
        <div class="event-card-body" data-id="${evt.id}" data-name="${escapeHtml(evt.name)}">
          <div class="event-card-icon">
            <i class="fas fa-calendar-alt"></i>
          </div>
          <div class="event-card-info">
            <h4>${escapeHtml(evt.name)}</h4>
            <span class="event-card-date"><i class="fas fa-clock"></i> ${escapeHtml(evt.date || "No date set")}</span>
            ${evt.description ? `<p class="event-card-desc">${escapeHtml(evt.description)}</p>` : ""}
          </div>
          ${evt.id === selectedEventId ? '<span class="event-active-badge"><i class="fas fa-check"></i> Active</span>' : ""}
        </div>
        <div class="event-card-actions">
          <button class="btn btn-primary btn-sm event-select-btn" data-id="${evt.id}" data-name="${escapeHtml(evt.name)}" ${evt.id === selectedEventId ? "disabled" : ""}>
            <i class="fas fa-hand-pointer"></i> ${evt.id === selectedEventId ? "Selected" : "Select"}
          </button>
          <button class="btn btn-danger btn-sm event-delete-btn" data-id="${evt.id}" data-name="${escapeHtml(evt.name)}">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      `;
      eventsList.appendChild(card);
    });

    // Bind select buttons
    eventsList.querySelectorAll(".event-select-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectEvent(btn.dataset.id, btn.dataset.name);
        renderEvents(); // Re-render to update UI
      });
    });

    // Bind delete buttons
    eventsList.querySelectorAll(".event-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        handleDeleteEvent(btn.dataset.id, btn.dataset.name);
      });
    });
  }

  /**
   * Handle adding a new event
   */
  async function handleAddEvent(e) {
    e.preventDefault();

    const name = eventNameInput.value.trim();
    const date = eventDateInput.value;
    const desc = eventDescInput.value.trim();

    if (!name) {
      showToast("Please enter an event name", "warning");
      return;
    }

    try {
      addEventBtn.disabled = true;
      await eventsRef.add({
        name,
        date: date || "",
        description: desc,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast(`Event "${name}" created!`, "success");
      eventNameInput.value = "";
      eventDateInput.value = "";
      eventDescInput.value = "";
      addEventBtn.disabled = false;

      await loadEvents();

    } catch (err) {
      console.error("Failed to create event:", err);
      showToast("Failed to create event", "error");
      addEventBtn.disabled = false;
    }
  }

  /**
   * Handle deleting an event and all its attendees
   */
  async function handleDeleteEvent(eventId, eventName) {
    const confirmDelete = confirm(
      `Are you sure you want to delete "${eventName}"?\n\nThis will also delete ALL attendees registered for this event. This cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      showToast(`Deleting "${eventName}" and its attendees...`, "info");

      // Delete all attendees for this event
      const attendeesSnapshot = await attendeesRef
        .where("eventId", "==", eventId)
        .get();

      const batch = db.batch();
      attendeesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Delete the event itself
      await eventsRef.doc(eventId).delete();

      // If this was the selected event, deselect
      if (selectedEventId === eventId) {
        selectedEventId = null;
        selectedEventName = "";
      }

      showToast(`Event "${eventName}" deleted with ${attendeesSnapshot.size} attendee(s)`, "success");
      await loadEvents();

    } catch (err) {
      console.error("Failed to delete event:", err);
      showToast("Failed to delete event", "error");
    }
  }

  /**
   * Select an event as the currently active event
   */
  function selectEvent(eventId, eventName) {
    selectedEventId = eventId;
    selectedEventName = eventName;
    updateGlobalBar();
    showToast(`Switched to event: ${eventName}`, "info");
  }

  /**
   * Update the global event indicator bar
   */
  function updateGlobalBar() {
    if (selectedEventId) {
      globalEventBar.style.display = "flex";
      globalEventName.textContent = selectedEventName;
    } else {
      globalEventBar.style.display = "none";
      globalEventName.textContent = "";
    }
  }

  /**
   * Get the currently selected event ID (used by other modules)
   */
  function getSelectedEventId() {
    return selectedEventId;
  }

  /**
   * Get the currently selected event name
   */
  function getSelectedEventName() {
    return selectedEventName;
  }

  /**
   * Escape HTML
   */
  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Public API
  return {
    init,
    loadEvents,
    getSelectedEventId,
    getSelectedEventName
  };
})();
