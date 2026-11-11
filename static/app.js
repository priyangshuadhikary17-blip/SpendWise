const $ = (s) => document.querySelector(s);
const money = (n) => new Intl.NumberFormat("en-IN", {style:"currency", currency:"INR", maximumFractionDigits:0}).format(Number(n || 0));
const today = new Date();
const monthString = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
let currentKind = "expense";
let editingId = null;
let chart = null;
let summaryData = null;
let cashflowChart = null;

$("#monthPicker").value = monthString;
$("#transactionForm").elements.tx_date.value = today.toISOString().slice(0,10);

function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}
async function api(url, options={}) {
  const response = await fetch(url, {headers:{"Content-Type":"application/json"}, ...options});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function month() { return $("#monthPicker").value || monthString; }
function populateCategories(kind, selected="") {
  const select = $("#formCategory");
  select.innerHTML = (window.SPENDWISE_CATEGORIES[kind] || []).map(c => `<option ${c===selected?"selected":""} value="${c}">${c}</option>`).join("");
}
function populateFilterCategories() {
  const cats = [...new Set(Object.values(window.SPENDWISE_CATEGORIES).flat())];
  $("#categoryFilter").innerHTML = '<option value="">All categories</option>' + cats.map(c=>`<option>${c}</option>`).join("");
}
function updateType(kind) {
  currentKind = kind;
  document.querySelectorAll(".type-option").forEach(b=>b.classList.toggle("selected", b.dataset.kind===kind));
  populateCategories(kind);
}
function drawChart(categories) {
  const canvas = $("#spendingChart"), empty = $("#chartEmpty");
  if (chart) { chart.destroy(); chart = null; }
  if (!categories.length) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); $("#categoryLegend").innerHTML=""; return; }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");
  const palette = ["#207b56","#80b89a","#d4a85d","#7995b1","#c77e73","#9b8cc1","#78a7a5","#b5bdb7"];
  chart = new Chart(canvas, {type:"doughnut",data:{labels:categories.map(x=>x.name),datasets:[{data:categories.map(x=>x.total),backgroundColor:palette,borderWidth:0,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:"72%",plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>` ${ctx.label}: ${money(ctx.raw)}`}}}}});
  $("#categoryLegend").innerHTML = categories.slice(0,5).map((c,i)=>`<span class="legend-item"><i class="legend-dot" style="background:${palette[i]}"></i>${c.name}</span>`).join("");
}

function drawCashflowChart(daily) {
    const canvas = $("#cashflowChart");

    if (cashflowChart) {
        cashflowChart.destroy();
    }

    cashflowChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: daily.map(item => {
                return new Date(item.date + "T00:00:00")
                    .toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short"
                    });
            }),
            datasets: [{
                label: "Daily net cash flow",
    data: daily.map(item => item.net),
    backgroundColor: "#23815a",
    borderRadius: 6,
    barThickness: 35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: "top"
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => "₹" + value
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

async function loadSummary() {
  summaryData = await api(`/api/summary?month=${month()}`);
  $("#balanceValue").textContent = money(summaryData.balance);
  $("#incomeValue").textContent = money(summaryData.income);
  $("#expenseValue").textContent = money(summaryData.expenses);
  $("#budgetValue").textContent = money(summaryData.budget);
  const pct = summaryData.budget ? Math.round(summaryData.budget_used) : 0;
  $("#budgetProgress").style.width = `${Math.min(pct,100)}%`;

  $("#budgetProgress").style.background =
    pct >= 100 ? "#E05252" :
    pct >= 70 ? "#E9A64B" :
    "#21966A";
  $("#budgetPercent").textContent = `${pct}% used`;
  $("#ringPercent").textContent = `${pct}%`;
 const ringColor = pct >= 100 ? "#E05252" :
                  pct >= 70 ? "#E9A64B" :
                  "#21966A";

$("#budgetRing").style.background =
    `conic-gradient(${ringColor} ${Math.min(pct,100)*3.6}deg, #eaf0ec 0deg)`;
  $("#spentAmount").textContent = money(summaryData.expenses);
  $("#remainingAmount").textContent = money(Math.max(summaryData.budget-summaryData.expenses,0));
  $("#budgetNote").textContent = !summaryData.budget ? "Set a monthly budget to start tracking your progress." : pct>100 ? "You have gone over your monthly budget." : `${money(Math.max(summaryData.budget-summaryData.expenses,0))} left in your monthly budget.`;
  drawChart(summaryData.categories);
  drawCashflowChart(summaryData.daily);
}
async function loadTransactions() {
  const params = new URLSearchParams({month:month(),search:$("#searchInput").value,kind:$("#typeFilter").value,category:$("#categoryFilter").value});
  const rows = await api(`/api/transactions?${params}`);
  $("#transactionRows").innerHTML = rows.map(t=>`
    <tr>
      <td><div class="transaction-title"><span class="tx-icon ${t.kind}">${t.kind==="income"?"↙":"↗"}</span><span>${escapeHtml(t.title)}</span></div></td>
      <td><span class="category-chip">${escapeHtml(t.category)}</span></td>
      <td>${new Date(t.tx_date+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</td>
      <td><span class="type-chip ${t.kind}">${t.kind}</span></td>
      <td class="amount ${t.kind}">${t.kind==="income"?"+":"−"} ${money(t.amount)}</td>
      <td class="actions"><button class="action-btn" title="Edit" data-edit="${t.id}">✎</button><button class="action-btn" title="Delete" data-delete="${t.id}">×</button></td>
    </tr>`).join("");
  $("#emptyState").classList.toggle("hidden", rows.length!==0);
  $("#transactionCount").textContent = `Showing ${rows.length} transaction${rows.length===1?"":"s"}`;
}


function populateBudgetCategories() {
    const select = $("#budgetCategory");

    if (!select) return;

    const categories = window.SPENDWISE_CATEGORIES.expense;

    select.innerHTML = categories.map(category =>
        `<option value="${category}">${category}</option>`
    ).join("");
}


async function loadCategoryBudgets() {
    const container = $("#categoryBudgetList");

    if (!container) return;

    const rows = await api(
        `/api/category-budgets?month=${encodeURIComponent(month())}`
    );

    
const insightsBox = document.querySelector("#insightsList");

if (insightsBox) {
    const insights = rows.map(item => {
        const budget = Number(item.budget);
        const spent = Number(item.spent);
        const percent = budget > 0 ? (spent / budget) * 100 : 0;

        if (budget === 0) {
            return `⚪ ${item.category}: No budget set. Set a limit to track spending.`;
        }

        if (percent > 100) {
            return `🔴 ${item.category}: You exceeded your budget by ₹${(spent - budget).toFixed(2)}.`;
        }

        if (percent >= 80) {
            return `🟠 ${item.category}: ${percent.toFixed(0)}% of your budget used. Spend carefully!`;
        }

        const remaining = budget - spent;

return `🟢 ${item.category}: Spending is under control. ${percent.toFixed(0)}% used. ₹${remaining.toFixed(2)} remaining.`;
    });

    insightsBox.innerHTML = insights
        .map(message => `<p>${message}</p>`)
        .join("");
}


    if (rows.length === 0) {
        container.innerHTML = `
            <p class="budget-empty">
                No category budgets yet. Set one to start tracking.
            </p>
        `;
        return;
    }

    container.innerHTML = rows.map(item => {
        const budget = Number(item.budget);
        const spent = Number(item.spent);
        const remaining = budget - spent;

       
const percent = budget > 0
    ? (spent / budget) * 100
    : 0;

const width = Math.min(percent, 100);

const overBudget = budget > 0 && spent > budget;
const atLimit = budget > 0 && spent >= budget;

let progressColor;
let statusColor;

if (budget > 0 && percent >= 100) {
    progressColor = "#E05252";
    statusColor = "#E05252";
} else if (percent >= 70) {
    progressColor = "#E9A64B";
    statusColor = "#E9A64B";
} else {
    progressColor = "#21966A";
    statusColor = "#8FC9A9";
}

const status = budget === 0
    ? "No budget set"
    : overBudget
        ? "Over budget!"
        : atLimit
            ? "Budget reached!"
            : `${Math.round(percent)}% used`;


        return `
            <div class="category-budget-item">

                <div class="category-budget-heading">
                    <strong>${escapeHtml(item.category)}</strong>
                    <span style="color:${statusColor}">${status}</span>
                </div>

                <div class="category-budget-amounts">
                    <span>Spent: ${money(spent)}</span>
                    <span>Budget: ${money(budget)}</span>
                </div>

                <div class="category-progress-track">
                    <div class="category-progress-fill"
                         style="width:${width}%; background:${progressColor}">
                    </div>
                </div>

                <div class="category-budget-footer">
                    ${budget === 0
    ? "Set a budget to track this category."
    : overBudget
        ? `Exceeded by ${money(Math.abs(remaining))}`
        : atLimit
            ? "Your entire budget has been used."
            : `${money(remaining)} remaining`
}
                </div>

            </div>
        `;
    }).join("");
}


// Save category budget
$("#saveCategoryBudget").addEventListener("click", async () => {

    const category = $("#budgetCategory").value;
    const amountInput = $("#categoryBudgetAmount").value;

    if (amountInput.trim() === "") {
        toast("Enter a budget amount.");
        return;
    }

    const amount = Number(amountInput);

    if (!Number.isFinite(amount) || amount < 0 ||
        amount > 100000000) {
        toast("Enter a valid budget amount.");
        return;
    }

    try {
        await api("/api/category-budgets", {
            method: "PUT",
            body: JSON.stringify({
                month: month(),
                category: category,
                amount: amount
            })
        });

        $("#categoryBudgetAmount").value = "";

        await refresh();

        toast("Category budget saved!");

    } catch (error) {
        toast(error.message);
    }
});

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function refresh() {
    await loadSummary();
    await loadTransactions();
    await loadCategoryBudgets();
}
function openModal(transaction=null) {
  editingId = transaction ? transaction.id : null;
  $("#transactionForm").reset();
  $("#formError").textContent = "";
  $("#modalTitle").textContent = transaction ? "Edit transaction" : "Add transaction";
  $("#saveTransaction").textContent = transaction ? "Save changes" : "Save transaction";
  updateType(transaction?.kind || "expense");
  if (transaction) {
    const f=$("#transactionForm");
    f.elements.title.value=transaction.title; f.elements.amount.value=transaction.amount;
    f.elements.tx_date.value=transaction.tx_date; f.elements.note.value=transaction.note || "";
    populateCategories(transaction.kind,transaction.category);
  } else {
    $("#transactionForm").elements.tx_date.value=today.toISOString().slice(0,10);
  }
  $("#transactionModal").classList.remove("hidden");
}
function closeModal() { $("#transactionModal").classList.add("hidden"); }
document.querySelectorAll(".type-option").forEach(b=>b.addEventListener("click",()=>updateType(b.dataset.kind)));
$("#openAdd").onclick=()=>openModal(); $("#openAdd2").onclick=()=>openModal();
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeModal);
$("#transactionModal").addEventListener("click",e=>{if(e.target.id==="transactionModal")closeModal();});
$("#transactionForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const f=e.currentTarget;
  const data={title:f.elements.title.value.trim(),amount:f.elements.amount.value,kind:currentKind,category:f.elements.category.value,tx_date:f.elements.tx_date.value,note:f.elements.note.value};
  try {
    await api(editingId?`/api/transactions/${editingId}`:"/api/transactions",{method:editingId?"PUT":"POST",body:JSON.stringify(data)});
    closeModal(); await refresh(); toast(editingId?"Transaction updated.":"Transaction added.");
  } catch(err) { $("#formError").textContent=err.message; }
});
$("#transactionRows").addEventListener("click",async e=>{
  const edit=e.target.closest("[data-edit]"), del=e.target.closest("[data-delete]");
  if(edit) {
    try { const rows=await api(`/api/transactions?month=${month()}`); const item=rows.find(x=>x.id===Number(edit.dataset.edit)); if(item)openModal(item); } catch(err){toast(err.message);}
  }
  if(del && confirm("Delete this transaction? This cannot be undone.")) {
    try { await api(`/api/transactions/${del.dataset.delete}`,{method:"DELETE"}); await refresh(); toast("Transaction deleted."); } catch(err){toast(err.message);}
  }
});
$("#editBudget").onclick=async()=>{
  const current=summaryData?.budget || 0;
  const value=prompt(`Set your budget for ${month()} (₹):`,current);
  if(value===null)return;
  try { await api("/api/budget",{method:"PUT",body:JSON.stringify({month:month(),amount:value})}); await refresh(); toast("Monthly budget saved."); }
  catch(err){toast(err.message);}
};
let searchTimer;
$("#searchInput").addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadTransactions,220);});
$("#typeFilter").addEventListener("change",loadTransactions);
$("#categoryFilter").addEventListener("change",loadTransactions);
$("#monthPicker").addEventListener("change",refresh);
populateFilterCategories();
populateBudgetCategories();
updateType("expense");

refresh().catch(err => toast(err.message));

document.querySelectorAll(".nav-link, .mobile-nav-link").forEach(link => {
    link.addEventListener("click", function () {

        const href = this.getAttribute("href");

        
        document.querySelectorAll(".nav-link, .mobile-nav-link")
            .forEach(item => item.classList.remove("active"));

        
        document.querySelectorAll(
            `.nav-link[href="${href}"], .mobile-nav-link[href="${href}"]`
        ).forEach(item => item.classList.add("active"));

        
        const target = document.querySelector(href);

        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
});

$("#exportCsv").addEventListener("click", () => {
    window.location.href =
        `/export/csv?month=${encodeURIComponent(month())}`;
});


async function loadMonthlyReport() {
    const canvas = document.getElementById("monthlyReportChart");

    if (!canvas) return;

    try {
        const response = await fetch("/api/monthly-report");

        if (!response.ok) {
            throw new Error("Could not load monthly reports");
        }

        const reports = await response.json();

        new Chart(canvas, {
            type: "bar",
            data: {
                labels: reports.map(item => {
                    const [year, month] = item.month.split("-");
                    return new Date(Number(year), Number(month) - 1)
                        .toLocaleDateString("en-IN", {
                            month: "short",
                            year: "2-digit"
                        });
                }),
                datasets: [
                    {
                        label: "Income",
                        data: reports.map(item => item.income),
                        backgroundColor: "#23815a",
                        borderRadius: 5
                    },
                    {
                        label: "Expenses",
                        data: reports.map(item => item.expenses),
                        backgroundColor: "#e6a65c",
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top"
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => "₹" + value
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error("Monthly report error:", error);
    }
}

loadMonthlyReport();


const themeToggle = document.getElementById("themeToggle");


const savedTheme = localStorage.getItem("spendwise-theme");

if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
}

if (themeToggle) {

    
    themeToggle.textContent =
        document.body.classList.contains("dark-mode") ? "☀️" : "🌙";

    themeToggle.addEventListener("click", function () {

        document.body.classList.toggle("dark-mode");

        const isDark = document.body.classList.contains("dark-mode");

        
        localStorage.setItem(
            "spendwise-theme",
            isDark ? "dark" : "light"
        );

      
        themeToggle.textContent = isDark ? "☀️" : "🌙";

      
        themeToggle.setAttribute(
            "aria-label",
            isDark ? "Switch to light mode" : "Switch to dark mode"
        );
    });
}
