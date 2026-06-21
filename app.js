const data = window.SUBSIDY_SITE_DATA;
const stateKey = "subsidy-tracker-progress-v1";

let progress = loadProgress();
let filters = {
  company: "all",
  area: "all",
  priority: "all",
  search: ""
};

const byId = (id) => document.getElementById(id);
const companiesById = Object.fromEntries(data.companies.map((company) => [company.id, company]));
const grantsById = Object.fromEntries(data.grants.map((grant) => [grant.id, grant]));
const today = new Date("2026-06-21T00:00:00+09:00");

function loadProgress() {
  try {
    const saved = localStorage.getItem(stateKey);
    return saved ? JSON.parse(saved) : { grants: {}, checklist: {} };
  } catch {
    return { grants: {}, checklist: {} };
  }
}

function saveProgress() {
  localStorage.setItem(stateKey, JSON.stringify(progress));
}

function companyNames(ids) {
  return ids.map((id) => companiesById[id]?.shortName || id).join(" / ");
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T00:00:00+09:00`);
  return Math.ceil((target - today) / 86400000);
}

function statusForGrant(grantId) {
  return progress.grants[grantId]?.status || "未着手";
}

function setupFilters() {
  const companyFilter = byId("companyFilter");
  companyFilter.innerHTML = [
    `<option value="all">すべて</option>`,
    ...data.companies.map((company) => `<option value="${company.id}">${company.name}</option>`)
  ].join("");

  const areas = [...new Set(data.grants.map((grant) => grant.area))];
  byId("areaFilter").innerHTML = [
    `<option value="all">すべて</option>`,
    ...areas.map((area) => `<option value="${area}">${area}</option>`)
  ].join("");

  companyFilter.addEventListener("change", (event) => {
    filters.company = event.target.value;
    render();
  });
  byId("areaFilter").addEventListener("change", (event) => {
    filters.area = event.target.value;
    render();
  });
  byId("priorityFilter").addEventListener("change", (event) => {
    filters.priority = event.target.value;
    render();
  });
  byId("searchInput").addEventListener("input", (event) => {
    filters.search = event.target.value.trim().toLowerCase();
    render();
  });
  byId("resetFilters").addEventListener("click", resetFilters);
}

function resetFilters() {
  filters = { company: "all", area: "all", priority: "all", search: "" };
  byId("companyFilter").value = "all";
  byId("areaFilter").value = "all";
  byId("priorityFilter").value = "all";
  byId("searchInput").value = "";
  render();
}

function filteredGrants() {
  return data.grants.filter((grant) => {
    const matchesCompany = filters.company === "all" || grant.companies.includes(filters.company);
    const matchesArea = filters.area === "all" || grant.area === filters.area;
    const matchesPriority = filters.priority === "all" || grant.priority === filters.priority;
    const haystack = [
      grant.name,
      grant.area,
      grant.scope,
      grant.fit,
      grant.expenses,
      grant.documents.join(" "),
      grant.nextAction
    ].join(" ").toLowerCase();
    const matchesSearch = !filters.search || haystack.includes(filters.search);
    return matchesCompany && matchesArea && matchesPriority && matchesSearch;
  });
}

function renderStats(grants) {
  byId("companyCount").textContent = data.companies.length;
  byId("grantCount").textContent = data.grants.length;
  byId("deadlineCount").textContent = data.grants.filter((grant) => grant.deadline).length;
  byId("urgentCount").textContent = data.grants.filter((grant) => {
    const days = daysUntil(grant.deadline);
    return days !== null && days >= 0 && days <= 30;
  }).length;
  byId("resultNote").textContent = `${grants.length}件を表示中。優先度Aから順に確認してください。`;
  byId("updatedAt").textContent = data.updatedAt;
}

function renderCompanyCards() {
  byId("companyCards").innerHTML = data.companies.map((company) => {
    const count = data.grants.filter((grant) => grant.companies.includes(company.id)).length;
    const active = filters.company === company.id ? " active" : "";
    return `
      <article class="company-card${active}" data-company="${company.id}">
        <h3>${company.name}</h3>
        <p class="meta">${company.municipality} / ${company.industry}</p>
        <p class="meta">${company.focus}</p>
        <div class="tag-row">
          <span class="tag">${count}制度</span>
          <span class="tag">就業規則: ${company.workRules}</span>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".company-card").forEach((card) => {
    card.addEventListener("click", () => {
      filters.company = card.dataset.company;
      byId("companyFilter").value = filters.company;
      render();
    });
  });
}

function renderGrantList(grants) {
  const priorityOrder = { A: 1, B: 2, C: 3 };
  const sorted = [...grants].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff) return priorityDiff;
    const ad = a.deadline || "9999-12-31";
    const bd = b.deadline || "9999-12-31";
    return ad.localeCompare(bd);
  });

  byId("grantList").innerHTML = sorted.map((grant) => {
    const days = daysUntil(grant.deadline);
    const deadlineText = grant.deadline
      ? days >= 0
        ? `${grant.deadline}（あと${days}日）`
        : `${grant.deadline}（期限経過）`
      : "未確定";
    return `
      <article class="grant-card">
        <header>
          <div>
            <span class="priority ${grant.priority.toLowerCase()}">優先度${grant.priority}</span>
            <span class="tag">${grant.scope}</span>
            <span class="tag">${grant.area}</span>
          </div>
          <span class="tag">${companyNames(grant.companies)}</span>
        </header>
        <div>
          <h3>${grant.name}</h3>
          <p class="meta">${grant.fit}</p>
        </div>
        <p><strong>期限:</strong> ${deadlineText}</p>
        <p><strong>次アクション:</strong> ${grant.nextAction}</p>
        <div class="grant-actions">
          <select class="status-select" data-status="${grant.id}" aria-label="${grant.name}の進捗">
            ${["未着手", "確認中", "申請準備中", "申請済み", "見送り"].map((status) => (
              `<option value="${status}" ${statusForGrant(grant.id) === status ? "selected" : ""}>${status}</option>`
            )).join("")}
          </select>
          <button class="ghost" data-open="${grant.id}">詳細を見る</button>
          <a href="${grant.source}" target="_blank" rel="noopener">公式URL</a>
        </div>
      </article>
    `;
  }).join("") || `<p class="meta">条件に合う制度がありません。</p>`;

  document.querySelectorAll("[data-status]").forEach((select) => {
    select.addEventListener("change", (event) => {
      progress.grants[event.target.dataset.status] = { status: event.target.value };
      saveProgress();
    });
  });
  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openGrant(button.dataset.open));
  });
}

function renderMilestones() {
  const sorted = [...data.milestones].sort((a, b) => a.date.localeCompare(b.date));
  byId("milestoneList").innerHTML = sorted.map((milestone) => {
    const grant = grantsById[milestone.grantId];
    const days = daysUntil(milestone.date);
    const urgent = days >= 0 && days <= 30 ? " urgent" : "";
    return `
      <article class="timeline-item${urgent}">
        <span class="priority ${milestone.priority.toLowerCase()}">優先度${milestone.priority}</span>
        <h3>${milestone.date} ${milestone.title}</h3>
        <p class="meta">${grant ? companyNames(grant.companies) : ""} / ${days >= 0 ? `あと${days}日` : "期限経過"}</p>
      </article>
    `;
  }).join("");
}

function renderChecklist() {
  byId("checklist").innerHTML = data.checklist.map((item) => {
    const done = progress.checklist[item.id]?.done === true;
    return `
      <article class="check-row${done ? " done" : ""}">
        <input type="checkbox" data-check="${item.id}" ${done ? "checked" : ""} />
        <div>
          <h3>${item.item}</h3>
          <p class="meta">${item.target} / ${item.status}</p>
          <p class="meta">${item.memo}</p>
        </div>
        <span class="tag">${done ? "完了" : "未完了"}</span>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-check]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      progress.checklist[event.target.dataset.check] = { done: event.target.checked };
      saveProgress();
      renderChecklist();
    });
  });
}

function openGrant(grantId) {
  const grant = grantsById[grantId];
  byId("dialogMeta").textContent = `${grant.area} / 優先度${grant.priority} / ${companyNames(grant.companies)}`;
  byId("dialogTitle").textContent = grant.name;
  byId("dialogBody").innerHTML = `
    <div class="detail-grid">
      <div class="detail-box"><strong>受付状況</strong>${grant.status}</div>
      <div class="detail-box"><strong>申請期間・締切</strong>${grant.period}</div>
      <div class="detail-box"><strong>上限額</strong>${grant.amount}</div>
      <div class="detail-box"><strong>補助率・助成率</strong>${grant.rate}</div>
    </div>
    <div class="detail-box"><strong>使える可能性のある経費・テーマ</strong>${grant.expenses}</div>
    <div class="detail-box"><strong>申請方法</strong>${grant.howToApply}</div>
    <div class="detail-box"><strong>次アクション</strong>${grant.nextAction}</div>
    <div class="detail-box">
      <strong>主な準備書類</strong>
      <ul class="doc-list">${grant.documents.map((doc) => `<li>${doc}</li>`).join("")}</ul>
    </div>
    <div class="detail-box">
      <strong>公式情報</strong>
      <a href="${grant.source}" target="_blank" rel="noopener">${grant.source}</a>
      <p class="meta">確認日: ${grant.sourceChecked}</p>
    </div>
  `;
  byId("grantDialog").showModal();
}

function setupDialog() {
  byId("closeDialog").addEventListener("click", () => byId("grantDialog").close());
  byId("grantDialog").addEventListener("click", (event) => {
    if (event.target.id === "grantDialog") byId("grantDialog").close();
  });
}

function setupProgressIO() {
  byId("exportProgress").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subsidy-progress-${data.updatedAt}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  byId("importProgress").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      progress = {
        grants: imported.grants || {},
        checklist: imported.checklist || {}
      };
      saveProgress();
      render();
    } catch {
      alert("進捗ファイルを読み込めませんでした。JSONファイルを確認してください。");
    } finally {
      event.target.value = "";
    }
  });
}

function render() {
  const grants = filteredGrants();
  renderStats(grants);
  renderCompanyCards();
  renderGrantList(grants);
  renderMilestones();
  renderChecklist();
}

setupFilters();
setupDialog();
setupProgressIO();
render();
