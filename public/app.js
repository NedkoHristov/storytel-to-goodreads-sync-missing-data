const datasetConfig = {
  goodreads: {
    inputId: "goodreads-input",
    statusId: "goodreads-status",
    fileLabelId: "goodreads-file",
    selects: {
      title: "goodreads-title",
      author: "goodreads-author",
      date: "goodreads-date",
    },
    requiredFields: ["title", "author", "date"],
  },
  storytel: {
    inputId: "storytel-input",
    statusId: "storytel-status",
    fileLabelId: "storytel-file",
    selects: {
      title: "storytel-title",
      author: "storytel-author",
      duration: "storytel-duration",
      started: "storytel-started",
      date: "storytel-date",
    },
    requiredFields: ["title", "date"],
  },
};

const formatSignatures = {
  goodreads: {
    requiredHeaders: ["Title", "Author", "Date Read"],
  },
  storytel: {
    requiredHeaders: ["Book Title", "Bookmark Insert Time", "Last Bookmark Update Time"],
  },
};

const heuristics = {
  title: ["title", "book"],
  author: ["author", "writer"],
  date: ["date", "finished", "completed", "time"],
  started: ["start", "insert"],
  duration: ["duration", "seconds"],
};

const state = {
  datasets: {
    goodreads: { rows: [], headers: [], fileName: "", detectedFormat: null },
    storytel: { rows: [], headers: [], fileName: "", detectedFormat: null },
  },
  missing: [],
  storytelWindowCount: 0,
  lastRunTs: null,
  searchTerm: "",
  sortField: "title",
  sortDirection: "asc",
};

const compareBtn = document.getElementById("compare-btn");
const searchInput = document.getElementById("search-input");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const statusEl = document.getElementById("comparison-status");
const resultsBody = document.getElementById("results-body");
const sortButtons = document.querySelectorAll(".sort-btn");
const sortIndicators = document.querySelectorAll(".sort-indicator");

init();

function init() {
  Object.entries(datasetConfig).forEach(([key, config]) => {
    const input = document.getElementById(config.inputId);
    input.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      setFileName(key, file.name);
      setStatusMessage(key, `Parsing ${file.name}…`);
      parseCsvFile(file)
        .then(({ rows, headers }) => {
          const detectedFormat = detectFormat(headers);
          const formatValid = detectedFormat === key;
          state.datasets[key] = {
            rows,
            headers,
            fileName: file.name,
            detectedFormat,
            formatValid,
          };
          const formatSummary = formatValid
            ? `Format check passed (${formatDisplayName(key)})`
            : `Format mismatch · looks like ${formatDisplayName(
                detectedFormat
              )}`;
          setStatusMessage(
            key,
            `Loaded ${rows.length.toLocaleString()} rows · ${headers.length} columns · ${formatSummary}`,
            formatValid ? "success" : "warn"
          );
          populateSelectors(key, headers);
          maybeAutoCompare();
        })
        .catch((error) => {
          console.error(error);
          state.datasets[key] = {
            rows: [],
            headers: [],
            fileName: file.name,
            detectedFormat: null,
            formatValid: false,
          };
          setStatusMessage(key, "Failed to parse file", "error");
        });
    });

    Object.values(config.selects).forEach((selectId) => {
      const select = document.getElementById(selectId);
      disableSelect(select);
      select.addEventListener("change", maybeAutoCompare);
    });
  });

  compareBtn.addEventListener("click", () => {
    runComparison();
  });

  [startDateInput, endDateInput].forEach((input) =>
    input.addEventListener("change", maybeAutoCompare)
  );

  searchInput.addEventListener("input", () => {
    state.searchTerm = searchInput.value.trim().toLowerCase();
    renderResults();
  });

  sortButtons.forEach((button) => {
    const field = button.dataset.sort;
    button.addEventListener("click", () => handleSortClick(field));
  });

  updateSortIndicators();
}

function disableSelect(select) {
  select.innerHTML = `<option value="">Select column</option>`;
  select.disabled = true;
}

function setFileName(dataset, name) {
  const el = document.getElementById(datasetConfig[dataset].fileLabelId);
  el.textContent = name || "No file yet";
}

function setStatusMessage(dataset, message, variant = "info") {
  const el = document.getElementById(datasetConfig[dataset].statusId);
  el.textContent = message;
  el.classList.remove("status--success", "status--warn", "status--error");
  if (variant === "success") {
    el.classList.add("status--success");
  } else if (variant === "warn") {
    el.classList.add("status--warn");
  } else if (variant === "error") {
    el.classList.add("status--error");
  }
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const rows = (result.data || [])
          .map((row) => sanitizeRow(row))
          .filter((row) => Object.values(row).some((value) => value !== ""));
        const headers = result.meta?.fields?.length
          ? result.meta.fields
          : Object.keys(rows[0] || {});
        resolve({ rows, headers });
      },
      error: reject,
    });
  });
}

function sanitizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ])
  );
}

function populateSelectors(dataset, headers) {
  const config = datasetConfig[dataset];
  Object.entries(config.selects).forEach(([field, selectId]) => {
    const select = document.getElementById(selectId);
    select.disabled = false;
    const isRequired = config.requiredFields?.includes(field) ?? true;
    const placeholder = isRequired
      ? "Select column"
      : "Skip if not available";
    select.innerHTML = `<option value="">${placeholder}</option>`;
    headers.forEach((header) => {
      const option = document.createElement("option");
      option.value = header;
      option.textContent = header;
      select.appendChild(option);
    });
    const guess = headers.find((header) =>
      (heuristics[field] || []).some((keyword) =>
        header.toLowerCase().includes(keyword)
      )
    );
    if (guess) {
      select.value = guess;
    }
  });
}

function detectFormat(headers = []) {
  const normalized = headers.map((header) => header.toLowerCase().trim());
  const matchesSignature = (key) =>
    (formatSignatures[key]?.requiredHeaders || []).every((requiredHeader) =>
      normalized.includes(requiredHeader.toLowerCase())
    );
  if (matchesSignature("goodreads")) {
    return "goodreads";
  }
  if (matchesSignature("storytel")) {
    return "storytel";
  }
  return null;
}

function formatDisplayName(key) {
  if (key === "goodreads") {
    return "Goodreads CSV";
  }
  if (key === "storytel") {
    return "Storytel CSV";
  }
  return "an unknown format";
}

function maybeAutoCompare() {
  const ready = isReadyForComparison();
  compareBtn.disabled = !ready;
  if (ready) {
    statusEl.textContent = "Ready · running comparison";
    runComparison();
  } else {
    statusEl.textContent = "Waiting for uploads";
  }
}

function isReadyForComparison() {
  return ["goodreads", "storytel"].every((dataset) => {
    const { rows } = state.datasets[dataset];
    if (!rows.length) {
      return false;
    }
    const mapping = getMapping(dataset);
    const required = datasetConfig[dataset].requiredFields || [];
    return required.every((field) => mapping[field]);
  });
}

function getMapping(dataset) {
  const config = datasetConfig[dataset];
  const mapping = {};
  Object.entries(config.selects).forEach(([field, selectId]) => {
    mapping[field] = document.getElementById(selectId)?.value ?? "";
  });
  return mapping;
}

function runComparison() {
  if (!isReadyForComparison()) {
    return;
  }
  const startDate = parseDateInput(startDateInput.value);
  const endDate = parseEndDateInput(endDateInput.value);
  const goodreadsMap = getMapping("goodreads");
  const storytelMap = getMapping("storytel");
  const matchFields = determineComparisonFields(goodreadsMap, storytelMap);

  const goodreadsKeys = new Set();
  state.datasets.goodreads.rows.forEach((row) => {
    const key = buildMatchKey(row, goodreadsMap, matchFields);
    if (key) {
      goodreadsKeys.add(key);
    }
  });

  let windowCount = 0;
  const missing = [];
  state.datasets.storytel.rows.forEach((row) => {
    const normalizedDate = extractDate(row[storytelMap.date]);
    const normalizedStart = storytelMap.started
      ? extractDate(row[storytelMap.started])
      : null;
    const withinWindow = isWithinWindow(normalizedDate, startDate, endDate);
    if (!withinWindow) {
      return;
    }
    windowCount += 1;
    const key = buildMatchKey(row, storytelMap, matchFields);
    if (!key) {
      return;
    }
    if (!goodreadsKeys.has(key)) {
      const authorField = storytelMap.author;
      missing.push({
        title: row[storytelMap.title] || "Untitled",
        author: authorField ? row[authorField] || "Unknown" : "Unknown",
        date: normalizedDate,
        rawDate: row[storytelMap.date] ?? "",
        started: normalizedStart,
        rawStarted: storytelMap.started ? row[storytelMap.started] ?? "" : "",
        durationSeconds: storytelMap.duration
          ? parseDuration(row[storytelMap.duration])
          : null,
      });
    }
  });

  state.missing = missing;
  state.storytelWindowCount = windowCount;
  state.lastRunTs = new Date();
  statusEl.textContent = `Compared ${windowCount} listens · ${missing.length} missing`;
  searchInput.disabled = false;
  searchInput.value = "";
  state.searchTerm = "";
  renderResults();
}

function buildMatchKey(row, mapping, fields) {
  const parts = [];
  for (const field of fields) {
    const column = mapping[field];
    const value = column ? normalizeText(row[column]) : null;
    if (field === "title" && !value) {
      return null;
    }
    parts.push(value ?? "");
  }
  return parts.join("__");
}

function determineComparisonFields(goodreadsMap, storytelMap) {
  const fields = ["title"];
  if (goodreadsMap.author && storytelMap.author) {
    fields.push("author");
  }
  return fields;
}

function normalizeText(value) {
  if (!value) {
    return null;
  }
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateInput(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEndDateInput(value) {
  const date = parseDateInput(value);
  if (!date) {
    return null;
  }
  date.setHours(23, 59, 59, 999);
  return date;
}

function extractDate(value) {
  if (!value) {
    return null;
  }
  const cleaned = value.trim();
  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }
  const normalized = cleaned.replace(/[\.\-]/g, "/");
  const parts = normalized.split("/").map((part) => part.trim());
  if (parts.length !== 3) {
    return null;
  }
  const numbers = parts.map((part) => parseInt(part, 10));
  if (numbers.some((num) => Number.isNaN(num))) {
    return null;
  }
  let year;
  let month;
  let day;
  if (parts[0].length === 4) {
    [year, month, day] = numbers;
  } else if (parts[2].length === 4) {
    year = numbers[2];
    if (numbers[0] > 12 && numbers[1] <= 12) {
      day = numbers[0];
      month = numbers[1];
    } else {
      month = numbers[0];
      day = numbers[1];
    }
  } else {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinWindow(date, start, end) {
  if (!start && !end) {
    return true;
  }
  if (!date) {
    return false;
  }
  if (start && date < start) {
    return false;
  }
  if (end && date > end) {
    return false;
  }
  return true;
}

function renderResults() {
  resultsBody.innerHTML = "";
  const filtered = applySearch(state.missing, state.searchTerm);
  const sorted = applySort(filtered);
  if (!sorted.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-state";
    cell.textContent = state.missing.length
      ? "Nothing matches that search"
      : "No missing books in the selected window";
    row.appendChild(cell);
    resultsBody.appendChild(row);
  } else {
    sorted.forEach((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="row-index">${index + 1}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${formatDuration(item.durationSeconds)}</td>
        <td>${formatDisplayDate(item.started, item.rawStarted)}</td>
        <td>${formatDisplayDate(item.date, item.rawDate)}</td>
      `;
      resultsBody.appendChild(row);
    });
  }
  document.getElementById("storytel-count").textContent = state.storytelWindowCount;
  document.getElementById("missing-count").textContent = state.missing.length;
  document.getElementById("last-run").textContent = state.lastRunTs
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(state.lastRunTs)
    : "—";
  updateSortIndicators();
}

function applySearch(items, term) {
  if (!term) {
    return items;
  }
  return items.filter((item) => {
    const haystack = `${item.title} ${item.author}`.toLowerCase();
    return haystack.includes(term);
  });
}

function handleSortClick(field) {
  if (!field) {
    return;
  }
  if (state.sortField === field) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortField = field;
    state.sortDirection = "asc";
  }
  renderResults();
}

function applySort(items) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  if (state.sortField === "title") {
    return [...items].sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }) *
      direction
    );
  }
  if (state.sortField === "duration") {
    return [...items].sort((a, b) => {
      const hasADuration =
        typeof a.durationSeconds === "number" && !Number.isNaN(a.durationSeconds);
      const hasBDuration =
        typeof b.durationSeconds === "number" && !Number.isNaN(b.durationSeconds);
      if (!hasADuration && !hasBDuration) {
        return (a.title || "").localeCompare(b.title || "", undefined, {
          sensitivity: "base",
        });
      }
      if (!hasADuration) {
        return 1;
      }
      if (!hasBDuration) {
        return -1;
      }
      if (a.durationSeconds === b.durationSeconds) {
        return (a.title || "").localeCompare(b.title || "", undefined, {
          sensitivity: "base",
        });
      }
      return (a.durationSeconds - b.durationSeconds) * direction;
    });
  }
  if (state.sortField === "started" || state.sortField === "date") {
    return [...items].sort((a, b) => {
      const aDate = state.sortField === "started" ? a.started : a.date;
      const bDate = state.sortField === "started" ? b.started : b.date;
      const aRaw = state.sortField === "started" ? a.rawStarted : a.rawDate;
      const bRaw = state.sortField === "started" ? b.rawStarted : b.rawDate;
      return compareDateValues(aDate, aRaw, bDate, bRaw) * direction;
    });
  }
  return items;
}

function updateSortIndicators() {
  sortIndicators.forEach((indicator) => {
    const field = indicator.dataset.field;
    if (field === state.sortField) {
      indicator.dataset.active = state.sortDirection;
    } else {
      indicator.dataset.active = "";
    }
  });
}

function compareDateValues(dateValueA, rawA, dateValueB, rawB) {
  const aTime = getDateTimestamp(dateValueA);
  const bTime = getDateTimestamp(dateValueB);
  if (aTime !== null && bTime !== null) {
    if (aTime === bTime) {
      return (rawA || "").localeCompare(rawB || "", undefined, { sensitivity: "base" });
    }
    return aTime - bTime;
  }
  if (aTime === null && bTime === null) {
    return (rawA || "").localeCompare(rawB || "", undefined, { sensitivity: "base" });
  }
  return aTime === null ? 1 : -1;
}

function getDateTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value)) {
    return value.getTime();
  }
  return null;
}

function formatDisplayDate(dateValue, rawValue) {
  const timestamp = getDateTimestamp(dateValue);
  if (timestamp !== null) {
    return new Date(timestamp).toLocaleDateString();
  }
  return rawValue || "—";
}

function parseDuration(value) {
  if (!value) {
    return null;
  }
  const trimmed = value.toString().trim();
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && asNumber >= 0) {
    return asNumber;
  }
  const colonParts = trimmed.split(":").map((part) => Number(part));
  if (colonParts.length >= 2 && colonParts.every((part) => !Number.isNaN(part))) {
    if (colonParts.length === 3) {
      const [hours, minutes, seconds] = colonParts;
      return hours * 3600 + minutes * 60 + seconds;
    }
    if (colonParts.length === 2) {
      const [minutes, seconds] = colonParts;
      return minutes * 60 + seconds;
    }
  }
  const match = trimmed.match(/(\d+)[^\d]+(\d+)/);
  if (match) {
    return Number(match[1]) * 3600 + Number(match[2]) * 60;
  }
  return null;
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) {
    return "—";
  }
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let display;
  if (hours === 0 && minutes === 0) {
    display = "<1m";
  } else {
    const parts = [];
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (!parts.length) {
      parts.push("0m");
    }
    display = parts.join(" ");
  }
  return `<span class="duration-chip">${escapeHtml(display)}</span>`;
}

function escapeHtml(value) {
  return value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

