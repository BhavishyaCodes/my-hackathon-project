
function getDB() { return JSON.parse(localStorage.getItem('fairshare_db')) || {}; }
function saveDB(data) { localStorage.setItem('fairshare_db', JSON.stringify(data)); }

// In-memory view of whichever group is currently logged in
let state = { groupId: null, members: [], expenses: [] };

// Which month the calendar card is currently showing
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();

function persistState() {
  if (!state.groupId) return;
  const db = getDB();
  const existing = db[state.groupId] || {};
  db[state.groupId] = {
    password: existing.password,
    members: state.members,
    expenses: state.expenses
  };
  saveDB(db);
}


function showHomeView() {
  document.getElementById('homeView').style.display = 'block';
  document.getElementById('dashboardView').style.display = 'none';
  document.body.style.background = 'var(--bg)';
}

function showDashboardView(groupId) {
  const db = getDB();
  const groupData = db[groupId];
  if (!groupData) { showHomeView(); return; }

  state.groupId = groupId;
  state.members = groupData.members && groupData.members.length ? groupData.members.slice() : ["You"];
  state.expenses = groupData.expenses ? groupData.expenses.slice() : [];

  
  calViewYear = new Date().getFullYear();
  calViewMonth = new Date().getMonth();

  document.getElementById('homeView').style.display = 'none';
  document.getElementById('dashboardView').style.display = 'block';
  document.body.style.background = 'var(--d-bg)';
  document.getElementById('groupPillText').textContent = groupId;

  renderDashboard();
}


function openModal(which) {
  document.getElementById('authModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  document.getElementById('signinError').style.display = 'none';
  document.getElementById('signupError').style.display = 'none';
  switchTab(which);
}

function closeModal() {
  document.getElementById('authModal').classList.remove('active');
  document.body.style.overflow = '';
}

function switchTab(which) {
  const signinTab = document.getElementById('tabSignin');
  const signupTab = document.getElementById('tabSignup');
  const formSignin = document.getElementById('formSignin');
  const formSignup = document.getElementById('formSignup');

  if (which === 'signup') {
    signupTab.classList.add('active'); signinTab.classList.remove('active');
    formSignup.style.display = 'block'; formSignin.style.display = 'none';
  } else {
    signinTab.classList.add('active'); signupTab.classList.remove('active');
    formSignin.style.display = 'block'; formSignup.style.display = 'none';
  }
}

function handleSignup(e) {
  e.preventDefault();
  const groupId = document.getElementById('signupId').value.trim();
  const password = document.getElementById('signupPass').value;
  const membersRaw = document.getElementById('signupMembers').value;
  const members = membersRaw.split(',').map(n => n.trim()).filter(Boolean);
  const db = getDB();

  if (db[groupId]) {
    document.getElementById('signupError').style.display = 'block';
    return;
  }
  if (members.length === 0) members.push('You');

  db[groupId] = { password: password, members: members, expenses: [] };
  saveDB(db);
  logUserIn(groupId);
}

function handleSignin(e) {
  e.preventDefault();
  const groupId = document.getElementById('signinId').value.trim();
  const password = document.getElementById('signinPass').value;
  const db = getDB();

  if (db[groupId] && db[groupId].password === password) {
    logUserIn(groupId);
  } else {
    document.getElementById('signinError').style.display = 'block';
  }
}

function logUserIn(groupId) {
  closeModal();
  sessionStorage.setItem('currentUser', groupId);
  showDashboardView(groupId);
}

function logUserOut() {
  sessionStorage.removeItem('currentUser');
  state = { groupId: null, members: [], expenses: [] };
  showHomeView();
}

document.getElementById('authModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});


const AV_COLORS = ["#6C63FF", "#D6567F", "#1FA463", "#D98A2E", "#2BAFAE", "#4C7EF3"];

const fmt = n => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const initial = name => (name.trim()[0] || "?").toUpperCase();
const colorFor = i => AV_COLORS[i % AV_COLORS.length];

function totalsByMember() {
  const totals = {};
  state.members.forEach(m => totals[m] = 0);
  state.expenses.forEach(e => {
    totals[e.who] = (totals[e.who] || 0) + e.amount;
  });
  return totals;
}

function grandTotal() {
  return state.expenses.reduce((s, e) => s + e.amount, 0);
}

function avatarHTML(name, i, size) {
  return `<span class="dash-avatar" style="background:${colorFor(i)};${size?`width:${size}px;height:${size}px;font-size:${size*0.4}px;`:""}">${initial(name)}</span>`;
}

function renderDashboard() {
  const total = grandTotal();
  const fairShare = state.members.length ? total / state.members.length : 0;
  const totals = totalsByMember();

  document.getElementById("totalAmt").textContent = fmt(total);

  const headerAv = document.getElementById("headerAvatars");
  headerAv.innerHTML = state.members.slice(0,4).map((m,i)=>avatarHTML(m,i,22)).join("");

  // Ledger rows
  const ledger = document.getElementById("ledger");
  ledger.innerHTML = "";
  if (state.members.length === 0) {
    ledger.innerHTML = `<p class="empty-note">Add a member to start tracking balances.</p>`;
  }
  state.members.forEach((m,i) => {
    const paid = totals[m] || 0;
    const delta = paid - fairShare;
    let deltaClass = "zero", deltaText = "₹0.00";
    if (total > 0){
      if (Math.abs(delta) < 0.005){ deltaClass = "zero"; deltaText = "settled up"; }
      else if (delta > 0){ deltaClass = "pos"; deltaText = "+" + fmt(delta); }
      else { deltaClass = "neg"; deltaText = "−" + fmt(Math.abs(delta)); }
    }
    const row = document.createElement("div");
    row.className = "member-row";
    row.innerHTML = `
      ${avatarHTML(m, i)}
      <div class="info">
        <div class="name">${m}</div>
        <div class="sub">paid ${fmt(paid)}</div>
      </div>
      <div class="delta ${deltaClass}">${deltaText}</div>
    `;
    ledger.appendChild(row);
  });

  // Members strip
  const list = document.getElementById("membersList");
  list.innerHTML = "";
  state.members.forEach((m,i) => {
    const chip = document.createElement("div");
    chip.className = "member-chip";
    chip.innerHTML = `${avatarHTML(m, i)}<span>${m}</span><button class="remove-member" data-name="${m}" title="Remove ${m}">&times;</button>`;
    list.appendChild(chip);
  });
  list.querySelectorAll('.remove-member').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.members.length <= 1) return;
      state.members = state.members.filter(n => n !== btn.dataset.name);
      persistState();
      renderDashboard();
    });
  });

  // Member select
  const sel = document.getElementById("memberSelect");
  const prevVal = sel.value;
  sel.innerHTML = "";
  state.members.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m; opt.textContent = m;
    sel.appendChild(opt);
  });
  if (prevVal && state.members.includes(prevVal)) sel.value = prevVal;

  // Recent list
  const rl = document.getElementById("recentList");
  rl.innerHTML = "";
  if (state.expenses.length === 0){
    rl.innerHTML = `<p class="empty-note">Nothing logged yet — it'll show up here.</p>`;
  } else {
    state.expenses.slice().reverse().slice(0,8).forEach(r => {
      const idx = state.members.indexOf(r.who);
      const el = document.createElement("div");
      el.className = "recent-row";
      el.innerHTML = `
        ${avatarHTML(r.who, idx >= 0 ? idx : 0, 28)}
        <span class="who">${r.who}</span>
        <span class="tag-pill">${r.what}</span>
        <span class="spacer"></span>
        <span class="amt">${fmt(r.amount)}</span>
      `;
      rl.appendChild(el);
    });
  }

  renderCalendar();
}


function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const label = document.getElementById("calMonthLabel");
  const totalEl = document.getElementById("calendarTotal");
  grid.innerHTML = "";

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  label.textContent = `${monthNames[calViewMonth]} ${calViewYear}`;

  ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d => {
    const dow = document.createElement("div");
    dow.className = "calendar-dow";
    dow.textContent = d;
    grid.appendChild(dow);
  });

  const firstDow = new Date(calViewYear, calViewMonth, 1).getDay();
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();

  // bucket this month's expenses by day-of-month
  const dayTotals = {};
  let monthTotal = 0;
  state.expenses.forEach(e => {
    const d = new Date(e.ts);
    if (d.getFullYear() === calViewYear && d.getMonth() === calViewMonth) {
      dayTotals[d.getDate()] = (dayTotals[d.getDate()] || 0) + e.amount;
      monthTotal += e.amount;
    }
  });

  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-cell empty";
    grid.appendChild(blank);
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === calViewYear && today.getMonth() === calViewMonth;

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell" + (isCurrentMonth && today.getDate() === day ? " today" : "");
    const amt = dayTotals[day];
    cell.innerHTML = `
      <span class="calendar-date">${day}</span>
      <span class="calendar-amt ${amt ? "" : "none"}">${amt ? fmt(amt) : "—"}</span>
    `;
    grid.appendChild(cell);
  }

  totalEl.innerHTML = `<b>${fmt(monthTotal)}</b> logged in ${monthNames[calViewMonth]}`;
}

document.getElementById("calPrevBtn").addEventListener("click", () => {
  calViewMonth--;
  if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
  renderCalendar();
});

document.getElementById("calNextBtn").addEventListener("click", () => {
  calViewMonth++;
  if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
  renderCalendar();
});

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=> t.classList.remove("show"), 2200);
}

document.getElementById("confirmBtn").addEventListener("click", () => {
  const amountEl = document.getElementById("amount");
  const reasonEl = document.getElementById("reason");
  const memberEl = document.getElementById("memberSelect");

  const amount = parseFloat(amountEl.value);
  const reason = reasonEl.value.trim() || "General";
  const who = memberEl.value;

  if (!who) { showToast("Add a member first."); return; }
  if (!amount || amount <= 0){
    amountEl.focus();
    showToast("Enter an amount above ₹0.");
    return;
  }

  state.expenses.push({ who, what: reason, amount, ts: Date.now() });
  persistState();

  amountEl.value = ""; reasonEl.value = "";
  showToast(`Logged ${fmt(amount)} for ${who}.`);
  renderDashboard();
});

document.getElementById("addMemberBtn").addEventListener("click", () => {
  const input = document.getElementById("newMemberName");
  const name = input.value.trim();
  if (!name) return;
  if (state.members.some(m => m.toLowerCase() === name.toLowerCase())) {
    showToast(`${name} is already in this group.`);
    return;
  }
  state.members.push(name);
  persistState();
  input.value = "";
  renderDashboard();
});

window.onload = function() {
  const activeUser = sessionStorage.getItem('currentUser');
  if (activeUser && getDB()[activeUser]) {
    showDashboardView(activeUser);
  } else {
    sessionStorage.removeItem('currentUser');
    showHomeView();
  }
}
