// ==== CONFIGURAZIONE SUPABASE ====
const SUPABASE_URL = "https://mulnocojjsubalkazppb.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bG5vY29qanN1YmFsa2F6cHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODA0NDgsImV4cCI6MjA4MDI1NjQ0OH0.Bn5GWQrwoJ_XlGk1wWn0Y2G0emH-CpF_7G9TfhG60rs";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const listEl = document.getElementById("mangaList");
const totalEl = document.getElementById("total");
const boughtEl = document.getElementById("bought");
const progressBarEl = document.getElementById("progressBar");
const progressPercentEl = document.getElementById("progressPercent");
const searchEl = document.getElementById("search");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const userEmailDisplay = document.getElementById("userEmail");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const hideBoughtBtn = document.getElementById("hideBoughtBtn");
const toastEl = document.getElementById("toast");

let data = [];
let hideBoughtState = false;
let currentUser = null;
let deletingVolumeId = null;
let longPressTimer = null;

const sagas = [
  { start: 1, end: 11, class: "eb", name: "East Blue" },
  { start: 12, end: 23, class: "al", name: "Alabasta" },
  { start: 24, end: 31, class: "si", name: "Sky Island" },
  { start: 32, end: 45, class: "w7", name: "Water 7" },
  { start: 46, end: 50, class: "tb", name: "Thriller Bark" },
  { start: 51, end: 60, class: "sw", name: "Marineford" },
  { start: 61, end: 65, class: "fi", name: "Fish-Man Island" },
  { start: 66, end: 79, class: "dr", name: "Dressrosa" },
  { start: 80, end: 89, class: "wc", name: "Whole Cake Island" },
  { start: 90, end: 104, class: "wa", name: "Wano" },
  { start: 105, end: 200, class: "eh", name: "Egghead" },
];

function showToast(msg) {
  if (msg) toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function handleApiError(operation, error, userMessage) {
  console.error(`[${operation}]`, error);
  showToast(userMessage || "Si e verificato un errore");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

async function fetchData() {
  const { data: rows, error } = await client.from("manga").select("*");

  if (error) throw error;
  return rows || [];
}

async function toggleStatus(item, checked) {
  if (!currentUser?.email) return;

  const { error } = await client
    .from("manga")
    .update({ bought: checked })
    .eq("id", item.id)
    .eq("owner", currentUser.email);

  if (error) throw error;
}

async function deleteVolume(id) {
  if (!currentUser?.email) return;

  try {
    const { error } = await client
      .from("manga")
      .delete()
      .eq("id", id)
      .eq("owner", currentUser.email);

    if (error) throw error;

    deletingVolumeId = null;
    await refresh();
  } catch (error) {
    handleApiError("deleteVolume", error, "Errore durante l'eliminazione");
  }
}

async function addNextVolume() {
  if (!currentUser?.email) {
    showToast("Devi fare il login per aggiungere volumi");
    return;
  }

  const maxVolNum = data.reduce(
    (max, item) => Math.max(max, getVolumeNumber(item.title) || 0),
    0,
  );
  const nextVolNum = maxVolNum + 1;

  if (!Number.isInteger(nextVolNum) || nextVolNum <= 0) {
    showToast("Numero volume non valido");
    return;
  }

  const alreadyExists = data.some(
    (item) => getVolumeNumber(item.title) === nextVolNum,
  );
  if (alreadyExists) {
    showToast("Il prossimo volume esiste gia");
    return;
  }

  try {
    const { error } = await client.from("manga").insert([
      {
        title: `Vol. ${nextVolNum}`,
        bought: false,
        owner: currentUser.email,
      },
    ]);

    if (error) throw error;
    await refresh();
  } catch (error) {
    handleApiError("addNextVolume", error, "Errore durante l'aggiunta");
  }
}

function getVolumeNumber(title) {
  const match = String(title).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function formatTitle(title) {
  if (!title) return "";
  const s = String(title).trim();
  if (/\bvol(?:\.|ume)?\b/i.test(s)) return s;
  const m = s.match(/\d+/);
  return m ? s.replace(m[0], "Vol. " + m[0]) : s;
}

function render() {
  const filterText = searchEl.value.toLowerCase();
  listEl.innerHTML = "";

  const filtered = data
    .filter((item) => {
      const matchesSearch = String(item.title)
        .toLowerCase()
        .includes(filterText);
      if (hideBoughtState && item.bought) return false;
      return matchesSearch;
    })
    .sort(
      (a, b) =>
        (getVolumeNumber(a.title) || 0) - (getVolumeNumber(b.title) || 0),
    );

  const lastItem = filtered.length > 0 ? filtered[filtered.length - 1] : null;

  filtered.forEach((item) => {
    const volNum = getVolumeNumber(item.title);
    const cell = document.createElement("div");
    cell.className = "item-cell";

    if (deletingVolumeId === item.id) cell.classList.add("deleting");

    const saga = sagas.find(
      (s) => volNum !== null && volNum >= s.start && volNum <= s.end,
    );

    if (saga) {
      cell.classList.add(`arc-${saga.class}`);
      if (volNum === saga.start) {
        cell.classList.add("arc-start", `arc-start-${saga.class}`);
      }
    }

    const box = document.createElement("label");
    box.className = "vol-box";

    if (!currentUser) {
      box.onclick = (e) => {
        e.preventDefault();
        showToast("Fai il login per segnare i volumi comprati");
      };
    }

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!item.bought;

    if (currentUser && lastItem && item.id === lastItem.id) {
      const startPress = () => {
        if (deletingVolumeId === item.id) return;
        longPressTimer = setTimeout(() => {
          deletingVolumeId = item.id;
          render();
        }, 600);
      };

      const endPress = () => clearTimeout(longPressTimer);

      box.addEventListener("mousedown", startPress);
      box.addEventListener("touchstart", startPress);
      box.addEventListener("mouseup", endPress);
      box.addEventListener("mouseleave", endPress);
      box.addEventListener("touchend", endPress);

      box.onclick = (e) => {
        if (deletingVolumeId === item.id) {
          e.preventDefault();
          deleteVolume(item.id);
        }
      };
    }

    chk.onchange = async () => {
      if (!currentUser) return;
      if (deletingVolumeId === item.id) {
        chk.checked = !chk.checked;
        return;
      }
      try {
        await toggleStatus(item, chk.checked);
        item.bought = chk.checked;
        updateCounters();
      } catch (error) {
        chk.checked = !chk.checked;
        handleApiError(
          "toggleStatus",
          error,
          "Errore durante il salvataggio del volume",
        );
      }
    };

    const span = document.createElement("span");
    span.className = "vol-label";
    span.textContent = formatTitle(item.title);

    const trash = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    trash.setAttribute("viewBox", "0 0 24 24");
    trash.setAttribute("class", "trash-icon");
    trash.innerHTML =
      '<path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';

    box.append(chk, span, trash);
    cell.append(box);
    listEl.append(cell);
  });

  if (!filterText) {
    const addCell = document.createElement("div");
    addCell.className = "item-cell add-tile";
    if (!currentUser) addCell.classList.add("logged-out");

    const maxVolNum = data.reduce(
      (max, item) => Math.max(max, getVolumeNumber(item.title) || 0),
      0,
    );
    const nextNum = maxVolNum + 1;
    const saga = sagas.find((s) => nextNum >= s.start && nextNum <= s.end);

    if (saga) addCell.classList.add(`arc-${saga.class}`);
    else if (maxVolNum > 0) addCell.classList.add("arc-eh");

    const addBtn = document.createElement("div");
    addBtn.className = "vol-box";
    addBtn.innerHTML = '<span class="vol-label">+</span>';
    addBtn.onclick = () => {
      if (!currentUser) {
        showToast("Fai il login per aggiungere nuovi manga");
      } else {
        addNextVolume();
      }
    };

    addCell.appendChild(addBtn);
    listEl.append(addCell);
  }

  totalEl.textContent = data.length;
  updateCounters();
}

function updateCounters() {
  const boughtCount = data.filter((i) => i.bought).length;
  const totalCount = data.length;
  boughtEl.textContent = boughtCount;

  if (totalCount > 0) {
    const percentage = Math.round((boughtCount / totalCount) * 100);
    progressBarEl.style.width = percentage + "%";
    progressPercentEl.textContent = percentage + "%";
  } else {
    progressBarEl.style.width = "0%";
    progressPercentEl.textContent = "0%";
  }
}

async function refresh() {
  try {
    data = await fetchData();
    render();
  } catch (error) {
    handleApiError("refresh", error, "Errore durante il caricamento dei dati");
  }
}

function updateAuthUI(user) {
  currentUser = user;
  const logged = !!user;
  emailEl.classList.toggle("hidden", logged);
  passwordEl.classList.toggle("hidden", logged);
  loginBtn.classList.toggle("hidden", logged);
  logoutBtn.classList.toggle("hidden", !logged);
  userEmailDisplay.textContent = logged ? user.email : "";
  refresh();
}

const performLogin = async () => {
  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!isValidEmail(email)) {
    showToast("Inserisci una email valida");
    return;
  }

  if (!password || password.length < 6) {
    showToast("La password deve avere almeno 6 caratteri");
    return;
  }

  try {
    const { data: authData, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    passwordEl.value = "";
    updateAuthUI(authData.user);
  } catch (error) {
    handleApiError("performLogin", error, "Credenziali errate");
  }
};

loginBtn.onclick = performLogin;
emailEl.onkeydown = (e) => {
  if (e.key === "Enter") passwordEl.focus();
};
passwordEl.onkeydown = (e) => {
  if (e.key === "Enter") performLogin();
};
logoutBtn.onclick = async () => {
  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    updateAuthUI(null);
  } catch (error) {
    handleApiError("logout", error, "Errore durante il logout");
  }
};
searchEl.oninput = render;
hideBoughtBtn.onclick = () => {
  hideBoughtState = !hideBoughtState;
  hideBoughtBtn.classList.toggle("active", hideBoughtState);
  render();
};

document.addEventListener("click", (e) => {
  if (deletingVolumeId && !e.target.closest(".vol-box")) {
    deletingVolumeId = null;
    render();
  }
});

(async () => {
  const {
    data: { session },
  } = await client.auth.getSession();
  updateAuthUI(session?.user || null);
})();
