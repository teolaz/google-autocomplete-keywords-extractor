// Globals
let resultsMap = {};
let totalRequests = 0;
let completedRequests = 0;
let currentSort = { key: "multiPos", asc: true };
let resultsPerPage = 800;
let currentPage = 1;
let queue = [];
let searching = false;

// Process JSONP queue
function processQueue() {
  if (!searching) return;
  if (queue.length) {
    queue.shift()();
    setTimeout(processQueue, 300);
  }
}

// Format ETA string
function formatETA(seconds) {
  if (seconds <= 0) return "ETA <1s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return (
    "ETA " +
    (h ? h + "h " : "") +
    (m ? m + "m " : "") +
    (s || (!h && !m) ? s + "s" : "")
  ).trim();
}

// Progress bar
function showProgressBar(count) {
  totalRequests = count;
  completedRequests = 0;
  document.getElementById("progressBar").style.width = "0%";
  document.getElementById("progressBarContainer").style.display = "block";
  updateTable();
}
function updateProgressBar() {
  const pct = totalRequests
    ? Math.round((completedRequests / totalRequests) * 100)
    : 100;
  document.getElementById("progressBar").style.width = pct + "%";
  if (completedRequests >= totalRequests) {
    setTimeout(() => {
      document.getElementById("progressBarContainer").style.display = "none";
      stopSearch();
      updateTable(); // this to clear ETA
    }, 300);
  } else {
    updateTable(); // this to update ETA as progress
  }
}

// Add a single result
function addResult(term, pos, isGoogle, isYouTube) {
  if (!resultsMap[term]) {
    resultsMap[term] = {
      googlePositions: [],
      ytPositions: [],
      monthlySearches: null,
    };
  }
  if (isGoogle) resultsMap[term].googlePositions.push(pos);
  if (isYouTube) resultsMap[term].ytPositions.push(pos);
}

// Build all rows for display
// modded 5/1/2025: added logic to order by presence of both googlePos and ytPos
function getAllRows() {
  return Object.entries(resultsMap)
    .map(([term, info]) => {
      const googleAvg = info.googlePositions.length
        ? (
            info.googlePositions.reduce((a, b) => a + b, 0) /
            info.googlePositions.length
          ).toFixed(1)
        : "not found";
      const ytAvg = info.ytPositions.length
        ? (
            info.ytPositions.reduce((a, b) => a + b, 0) /
            info.ytPositions.length
          ).toFixed(1)
        : "not found";
      const divider =
        googleAvg === "not found" || ytAvg === "not found" ? 1 : 2;
      const multi =
        ((googleAvg === "not found" ? 0 : parseFloat(googleAvg)) +
          (ytAvg === "not found" ? 0 : parseFloat(ytAvg))) /
        divider;
      return {
        term,
        multiPos: multi.toFixed(1),
        googlePos: googleAvg,
        ytPos: ytAvg,
        monthlySearches: info.monthlySearches,
      };
    })
    .sort((a, b) => {
      const key = currentSort.key;
      const asc = currentSort.asc ? 1 : -1;

      // Only apply "favor both platforms" logic for position columns
      const isPositionKey = ["multiPos", "googlePos", "ytPos"].includes(key);

      if (isPositionKey) {
        // 1. Sort by selected position column
        let vA = a[key] === "not found" ? Infinity : parseFloat(a[key]);
        let vB = b[key] === "not found" ? Infinity : parseFloat(b[key]);
        if (vA !== vB) return (vA - vB) * asc;

        // 2. Favor rows with both platforms present
        const aBoth = a.googlePos !== "not found" && a.ytPos !== "not found";
        const bBoth = b.googlePos !== "not found" && b.ytPos !== "not found";
        if (aBoth !== bBoth) return (bBoth - aBoth) * asc;

        // 3. Tie-breaker: googlePos, then ytPos, then term
        const aGoogle =
          a.googlePos === "not found" ? Infinity : parseFloat(a.googlePos);
        const bGoogle =
          b.googlePos === "not found" ? Infinity : parseFloat(b.googlePos);
        if (aGoogle !== bGoogle) return (aGoogle - bGoogle) * asc;

        const aYt = a.ytPos === "not found" ? Infinity : parseFloat(a.ytPos);
        const bYt = b.ytPos === "not found" ? Infinity : parseFloat(b.ytPos);
        if (aYt !== bYt) return (aYt - bYt) * asc;

        return a.term.localeCompare(b.term) * asc;
      } else {
        // For non-position columns, sort normally
        let vA = a[key];
        let vB = b[key];
        // Handle numbers and nulls
        if (key === "monthlySearches") {
          vA = vA === null ? -Infinity : parseFloat(vA) || 0;
          vB = vB === null ? -Infinity : parseFloat(vB) || 0;
          if (vA !== vB) return (vA - vB) * asc;
        } else {
          // String sort
          if (vA < vB) return -1 * asc;
          if (vA > vB) return 1 * asc;
        }
        return 0;
      }
    });
}

// Listen for changes on the input
const rowsPerPageInput = document.getElementById("rowsPerPageInput");
if (rowsPerPageInput) {
  rowsPerPageInput.value = resultsPerPage;
  rowsPerPageInput.addEventListener("input", (e) => {
    const newVal = parseInt(e.target.value, 10);
    if (!isNaN(newVal) && newVal > 0) {
      // Calculate the index of the first row currently shown
      const firstRowIndex = (currentPage - 1) * resultsPerPage;
      resultsPerPage = newVal;

      // Calculate the new page so the first visible row stays visible
      currentPage = Math.floor(firstRowIndex / resultsPerPage) + 1;
      updateTable();
    }
  });
}

// Render table
function updateTable() {
  const allRows = getAllRows();
  const total = allRows.length;
  const start = (currentPage - 1) * resultsPerPage;
  const end = Math.min(start + resultsPerPage, total);

  const tbody = document.querySelector("#resultsTable tbody");
  tbody.innerHTML = "";
  allRows.slice(start, end).forEach((item) => {
    const tr = document.createElement("tr");
    tr.classList.add("border-t", "border-gray-200");
    tr.innerHTML = `
          <td class="px-4 py-2">
            <input type="checkbox" class="row-select" data-term="${item.term}"/>
          </td>
          <td class="px-4 py-2">${item.term}</td>
          <td class="px-4 py-2">${item.multiPos}</td>
          <td class="px-4 py-2">${item.googlePos}</td>
          <td class="px-4 py-2">${item.ytPos}</td>
          <td class="px-4 py-2">${item.monthlySearches || ""}</td>
        `;
    tbody.appendChild(tr);
  });

  // --- ETA logic ---
  let etaStr = "";
  if (searching && totalRequests > 0 && completedRequests < totalRequests) {
    // 300ms throttle per request, so 1 request every 0.3s
    const remaining = totalRequests - completedRequests;
    const seconds = Math.ceil(remaining * 0.3);
    etaStr = " - " + formatETA(seconds);
  }

  document.getElementById("pageInfo").textContent = total
    ? `Showing ${start + 1}–${end} of ${total} rows${etaStr}`
    : `Showing 0–0 of 0 rows${etaStr}`;

  document.getElementById("prevPage").disabled = currentPage === 1;
  document.getElementById("nextPage").disabled = end >= total;

  document.getElementById("selectAll").onclick = () => {
    const checked = document.getElementById("selectAll").checked;
    document
      .querySelectorAll(".row-select")
      .forEach((cb) => (cb.checked = checked));
  };
}

// JSONP callbacks
function handleGoogleCallback(data) {
  (Array.isArray(data[1]) ? data[1] : []).forEach((s, i) =>
    addResult(s, i + 1, true, false)
  );
  completedRequests++;
  updateTable();
  updateProgressBar();
}
function handleYouTubeCallback(data) {
  const e = Array.isArray(data) ? data : [];
  if (e[1] && Array.isArray(e[1])) {
    e[1].forEach((x, i) => {
      let suggestion = x[0];
      if (Array.isArray(suggestion)) suggestion = suggestion[0];
      addResult(suggestion, i + 1, false, true);
    });
  }
  completedRequests++;
  updateTable();
  updateProgressBar();
}

// Enqueue JSONP calls
function enqueueGoogle(query) {
  queue.push(() => {
    const script = document.createElement("script");
    script.src = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(
      query
    )}&callback=handleGoogleCallback`;
    document.body.appendChild(script);
  });
}
function enqueueYouTube(query) {
  queue.push(() => {
    const script = document.createElement("script");
    script.src = `https://suggestqueries-clients6.youtube.com/complete/search?ds=yt&hl=en&client=youtube&q=${encodeURIComponent(
      query
    )}&callback=handleYouTubeCallback`;
    document.body.appendChild(script);
  });
}

// Modifier group toggles
document.querySelectorAll(".modifier-group").forEach((parentCheckbox) => {
  parentCheckbox.onchange = () => {
    document
      .querySelectorAll(`[data-group-child="${parentCheckbox.dataset.group}"]`)
      .forEach((child) => (child.checked = parentCheckbox.checked));
  };
});
document.querySelectorAll("[data-group-child]").forEach((childCheckbox) => {
  childCheckbox.onchange = () => {
    const group = childCheckbox.dataset.groupChild;
    const allChildren = document.querySelectorAll(
      `[data-group-child="${group}"]`
    );
    const parent = document.querySelector(
      `.modifier-group[data-group="${group}"]`
    );
    parent.checked = Array.from(allChildren).every((c) => c.checked);
  };
});

// Tab switching logic
document.getElementById("tab-new").onclick = function () {
  document.getElementById("tab-panel-new").classList.remove("hidden");
  document.getElementById("tab-panel-continue").classList.add("hidden");
  this.classList.add("border-blue-500", "text-blue-600");
  this.classList.remove("border-transparent", "text-gray-500");
  document
    .getElementById("tab-continue")
    .classList.remove("border-blue-500", "text-blue-600");
  document
    .getElementById("tab-continue")
    .classList.add("border-transparent", "text-gray-500");
};
document.getElementById("tab-continue").onclick = function () {
  document.getElementById("tab-panel-new").classList.add("hidden");
  document.getElementById("tab-panel-continue").classList.remove("hidden");
  this.classList.add("border-blue-500", "text-blue-600");
  this.classList.remove("border-transparent", "text-gray-500");
  document
    .getElementById("tab-new")
    .classList.remove("border-blue-500", "text-blue-600");
  document
    .getElementById("tab-new")
    .classList.add("border-transparent", "text-gray-500");
};

// CSV import for "Continue a research"
document.getElementById("continueCSVButton").onclick = () => {
  const input = document.getElementById("continueCSVInput");
  if (!input.files.length) {
    alert("Select one or more CSV files first");
    return;
  }
  let filesProcessed = 0;
  Array.from(input.files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      reader.result.split("\n").forEach((line) => {
        const [term, multiPos, googlePos, ytPos, monthlySearches] =
          line.split(";");
        if (term && term.trim()) {
          const t = term.trim();
          // If already exists, merge positions and recalculate averages
          if (!resultsMap[t]) {
            resultsMap[t] = {
              googlePositions:
                googlePos && googlePos !== "not found"
                  ? [parseFloat(googlePos)]
                  : [],
              ytPositions:
                ytPos && ytPos !== "not found" ? [parseFloat(ytPos)] : [],
              monthlySearches: monthlySearches || null,
            };
          } else {
            // Merge google positions
            if (googlePos && googlePos !== "not found") {
              resultsMap[t].googlePositions.push(parseFloat(googlePos));
            }
            // Merge yt positions
            if (ytPos && ytPos !== "not found") {
              resultsMap[t].ytPositions.push(parseFloat(ytPos));
            }
            // Update monthlySearches if present
            if (monthlySearches) {
              resultsMap[t].monthlySearches = monthlySearches;
            }
          }
        }
      });
      filesProcessed++;
      if (filesProcessed === input.files.length) {
        // After merging, recalculate averages for all terms
        Object.values(resultsMap).forEach((info) => {
          if (info.googlePositions.length > 1) {
            // Remove duplicates and average
            info.googlePositions = [
              info.googlePositions.reduce((a, b) => a + b, 0) /
                info.googlePositions.length,
            ];
          }
          if (info.ytPositions.length > 1) {
            info.ytPositions = [
              info.ytPositions.reduce((a, b) => a + b, 0) /
                info.ytPositions.length,
            ];
          }
        });
        currentPage = 1;
        updateTable();
        alert("All CSV files imported.");
      }
    };
    reader.readAsText(file);
  });
};

// Collect selected modifiers
function getModifiers() {
  return Array.from(
    document.querySelectorAll("#modifierMenu input[data-type]:checked")
  ).map((cb) => ({ tpl: cb.value, type: cb.dataset.type }));
}

// Start/stop search
function startSearch() {
  if (searching) return;
  searching = true;
  document.getElementById("startSearchButton").disabled = true;
  document.getElementById("stopSearchButton").disabled = false;
  performSearchAll();
}
function stopSearch() {
  searching = false;
  queue = [];
  document.getElementById("startSearchButton").disabled = false;
  document.getElementById("stopSearchButton").disabled = true;
}

// Perform full search
function performSearchAll() {
  resultsMap = {};
  currentPage = 1;
  updateTable();

  const terms = document
    .getElementById("searchInput")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const doTail = document.getElementById("tailCheckbox").checked;
  const doHead = document.getElementById("headCheckbox").checked;
  const doBetween = document.getElementById("betweenCheckbox").checked;

  const modifiers = getModifiers();
  const soupOnMods = document.getElementById("modifierSoupCheckbox").checked;

  const letters = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(97 + i)
  );

  // 1) Alphabet soup on originals
  let soupQueries = [];
  terms.forEach((term) => {
    soupQueries.push(term);
    letters.forEach((letter) => {
      if (doHead) soupQueries.push(`${letter} ${term}`.trim());
      if (doTail) soupQueries.push(`${term} ${letter}`);
      if (doBetween && term.includes(" ")) {
        const ws = term.split(/\s+/);
        ws.forEach((_, i) => {
          if (i < ws.length - 1) {
            const arr = [...ws];
            arr.splice(i + 1, 0, letter);
            soupQueries.push(arr.join(" "));
          }
        });
      }
    });
  });
  soupQueries = [...new Set(soupQueries)];

  // 2) Modifiers
  let modifierQueries = [];
  if (soupOnMods) {
    terms.forEach((term) => {
      const variants = new Set([term]);
      letters.forEach((letter) => {
        if (doHead) variants.add(`${letter} ${term}`.trim());
        if (doTail) variants.add(`${term} ${letter}`);
        if (doBetween && term.includes(" ")) {
          const ws = term.split(/\s+/);
          ws.forEach((_, i) => {
            if (i < ws.length - 1) {
              const arr = [...ws];
              arr.splice(i + 1, 0, letter);
              variants.add(arr.join(" "));
            }
          });
        }
      });
      modifiers.forEach((mod) => {
        variants.forEach((v) => {
          modifierQueries.push(mod.tpl.replace("*", v));
        });
      });
    });
  } else {
    terms.forEach((term) => {
      modifiers.forEach((mod) => {
        modifierQueries.push(mod.tpl.replace("*", term));
      });
    });
  }

  const allQueries = soupQueries.concat(modifierQueries);

  showProgressBar(allQueries.length * 2);
  allQueries.forEach((q) => {
    enqueueGoogle(q);
    enqueueYouTube(q);
  });
  processQueue();
}

// CSV import
document.getElementById("importCSVButton").onclick = () => {
  const input = document.getElementById("importCSVInput");
  if (!input.files.length) {
    alert("Select one or more CSV files first");
    return;
  }

  let filesProcessed = 0;

  Array.from(input.files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      reader.result.split("\n").forEach((line) => {
        const [kw, vol] = line.split(";").map((s) => s.trim());
        if (kw && resultsMap[kw]) {
          resultsMap[kw].monthlySearches = vol;
        }
      });
      filesProcessed++;
      if (filesProcessed === input.files.length) {
        currentPage = 1;
        updateTable();
        alert("All CSV files imported.");
      }
    };
    reader.readAsText(file);
  });
};

// Table operations: copy selected/all and table formats
document.getElementById("copySelectedButton").onclick = () => {
  const selected = Array.from(
    document.querySelectorAll(".row-select:checked")
  ).map((cb) => cb.dataset.term);
  navigator.clipboard
    .writeText(selected.join("\n"))
    .then(() => alert(`Copied ${selected.length} search terms`));
};
document.getElementById("copyAllButtonTop").onclick = () => {
  const all = Object.keys(resultsMap);
  navigator.clipboard
    .writeText(all.join("\n"))
    .then(() => alert(`Copied ${all.length} search terms`));
};
document.getElementById("copySelectedTable").onclick = () => {
  const selSet = new Set(
    Array.from(document.querySelectorAll(".row-select:checked")).map(
      (cb) => cb.dataset.term
    )
  );
  const rows = getAllRows()
    .filter((r) => selSet.has(r.term))
    .map((r) =>
      [r.term, r.multiPos, r.googlePos, r.ytPos, r.monthlySearches || ""].join(
        "\t"
      )
    );
  navigator.clipboard
    .writeText(rows.join("\n"))
    .then(() => alert(`Copied ${rows.length} rows`));
};
document.getElementById("copyAllTable").onclick = () => {
  const rows = getAllRows().map((r) =>
    [r.term, r.multiPos, r.googlePos, r.ytPos, r.monthlySearches || ""].join(
      "\t"
    )
  );
  navigator.clipboard
    .writeText(rows.join("\n"))
    .then(() => alert(`Copied ${rows.length} rows`));
};

// --- Export Selected (CSV) ---
document.getElementById("exportSelectedCSV").onclick = () => {
  const selSet = new Set(
    Array.from(document.querySelectorAll(".row-select:checked")).map(
      (cb) => cb.dataset.term
    )
  );
  const rows = getAllRows()
    .filter((r) => selSet.has(r.term))
    .map((r) =>
      [r.term, r.multiPos, r.googlePos, r.ytPos, r.monthlySearches || ""].join(
        ";"
      )
    );
  if (rows.length === 0) {
    alert("No rows selected.");
    return;
  }
  const csvContent = rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "selected_keywords.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// --- Export All (CSV) ---
document.getElementById("exportAllCSV").onclick = () => {
  const rows = getAllRows().map((r) =>
    [r.term, r.multiPos, r.googlePos, r.ytPos, r.monthlySearches || ""].join(
      ";"
    )
  );
  if (rows.length === 0) {
    alert("No data to export.");
    return;
  }
  const csvContent = rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "all_keywords.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Pagination & sorting
document.getElementById("prevPage").onclick = () => {
  if (currentPage > 1) {
    currentPage--;
    updateTable();
  }
};
document.getElementById("nextPage").onclick = () => {
  const total = getAllRows().length;
  const maxPage = Math.ceil(total / resultsPerPage);
  if (currentPage < maxPage) {
    currentPage++;
    updateTable();
  }
};
document.querySelectorAll("th.sortable").forEach((th) => {
  th.onclick = () => {
    const key = th.dataset.key;
    if (currentSort.key === key) {
      currentSort.asc = !currentSort.asc;
    } else {
      currentSort.key = key;
      currentSort.asc = true;
    }
    currentPage = 1;
    updateTable();
  };
});

// Activate
document.getElementById("startSearchButton").onclick = startSearch;
document.getElementById("stopSearchButton").onclick = stopSearch;
document.getElementById("modifierToggle").onclick = () => {
  const menu = document.getElementById("modifierMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
};
