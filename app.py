from flask import Flask, render_template, request, jsonify, Response
import sqlite3
from pathlib import Path
from datetime import date, datetime
import csv
import io

app = Flask(__name__)
DB_PATH = Path(__file__).with_name("spendwise.db")

CATEGORIES = {
    "expense": ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Health", "Education", "Other"],
    "income": ["Salary", "Freelance", "Investment", "Gift", "Other"]
}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                amount REAL NOT NULL CHECK(amount > 0),
                kind TEXT NOT NULL CHECK(kind IN ('income', 'expense')),
                category TEXT NOT NULL,
                tx_date TEXT NOT NULL,
                note TEXT DEFAULT ''
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                month TEXT NOT NULL UNIQUE,
                amount REAL NOT NULL CHECK(amount >= 0)
            )
        """)
        
        db.execute("""
            CREATE TABLE IF NOT EXISTS category_budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                month TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL CHECK(amount >= 0),
                UNIQUE(month, category)
            )
        """)

        count = db.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        if count == 0:
            today = date.today()
            samples = [
                ("Monthly salary", 42000, "income", "Salary", today.replace(day=1).isoformat(), "Monthly income"),
                ("Groceries", 1850, "expense", "Food", today.isoformat(), "Weekly groceries"),
                ("Internet bill", 799, "expense", "Bills", today.isoformat(), ""),
                ("Freelance project", 6500, "income", "Freelance", today.isoformat(), "Website work"),
                ("Cab ride", 320, "expense", "Transport", today.isoformat(), ""),
                ("Movie night", 550, "expense", "Entertainment", today.isoformat(), "")
            ]
            db.executemany("""
                INSERT INTO transactions (title, amount, kind, category, tx_date, note)
                VALUES (?, ?, ?, ?, ?, ?)
            """, samples)
        month = date.today().strftime("%Y-%m")
        db.execute("INSERT OR IGNORE INTO budgets (month, amount) VALUES (?, ?)", (month, 12000))

@app.get("/")
def index():
    return render_template("index.html", categories=CATEGORIES)

@app.get("/api/summary")
def summary():
    month = request.args.get("month", date.today().strftime("%Y-%m"))
    with get_db() as db:
        totals = db.execute("""
            SELECT
              COALESCE(SUM(CASE WHEN kind='income' THEN amount END), 0) AS income,
              COALESCE(SUM(CASE WHEN kind='expense' THEN amount END), 0) AS expenses
            FROM transactions WHERE substr(tx_date, 1, 7)=?
        """, (month,)).fetchone()
        budget_row = db.execute("SELECT amount FROM budgets WHERE month=?", (month,)).fetchone()
        budget = budget_row["amount"] if budget_row else 0
        by_category = db.execute("""
            SELECT category, SUM(amount) AS total FROM transactions
            WHERE kind='expense' AND substr(tx_date,1,7)=?
            GROUP BY category ORDER BY total DESC
        """, (month,)).fetchall()
        daily = db.execute("""
            SELECT tx_date, SUM(CASE WHEN kind='income' THEN amount ELSE -amount END) AS net
            FROM transactions WHERE substr(tx_date,1,7)=?
            GROUP BY tx_date ORDER BY tx_date
        """, (month,)).fetchall()
    income, expenses = totals["income"], totals["expenses"]
    return jsonify({
        "month": month, "income": income, "expenses": expenses,
        "balance": income-expenses, "budget": budget,
        "budget_used": (expenses / budget * 100) if budget else 0,
        "categories": [{"name": r["category"], "total": r["total"]} for r in by_category],
        "daily": [{"date": r["tx_date"], "net": r["net"]} for r in daily]
    })

@app.get("/api/transactions")
def list_transactions():
    search = request.args.get("search", "").strip()
    kind = request.args.get("kind", "")
    category = request.args.get("category", "")
    month = request.args.get("month", date.today().strftime("%Y-%m"))
    query = "SELECT * FROM transactions WHERE substr(tx_date,1,7)=?"
    params = [month]
    if search:
        query += " AND (title LIKE ? OR note LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    if kind in ("income", "expense"):
        query += " AND kind=?"
        params.append(kind)
    if category:
        query += " AND category=?"
        params.append(category)
    query += " ORDER BY tx_date DESC, id DESC"
    with get_db() as db:
        rows = db.execute(query, params).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/transactions")
def add_transaction():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    kind = data.get("kind")
    category = data.get("category")
    tx_date = data.get("tx_date")
    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify(error="Enter a valid amount."), 400
    if not title or len(title) > 80:
        return jsonify(error="Title is required (maximum 80 characters)."), 400
    if amount <= 0 or amount > 100000000:
        return jsonify(error="Amount must be greater than zero."), 400
    if kind not in CATEGORIES or category not in CATEGORIES[kind]:
        return jsonify(error="Choose a valid transaction type and category."), 400
    try:
        datetime.strptime(tx_date, "%Y-%m-%d")
    except (TypeError, ValueError):
        return jsonify(error="Choose a valid date."), 400
    with get_db() as db:
        cur = db.execute("""
            INSERT INTO transactions (title, amount, kind, category, tx_date, note)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (title, amount, kind, category, tx_date, str(data.get("note", ""))[:200]))
        new_id = cur.lastrowid
    return jsonify(id=new_id, message="Transaction added.")

@app.put("/api/transactions/<int:tx_id>")
def update_transaction(tx_id):
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    kind, category, tx_date = data.get("kind"), data.get("category"), data.get("tx_date")
    try:
        amount = float(data.get("amount", 0))
        datetime.strptime(tx_date, "%Y-%m-%d")
    except (TypeError, ValueError):
        return jsonify(error="Enter a valid amount and date."), 400
    if not title or amount <= 0 or kind not in CATEGORIES or category not in CATEGORIES[kind]:
        return jsonify(error="Check the title, amount, type and category."), 400
    with get_db() as db:
        cur = db.execute("""
            UPDATE transactions SET title=?, amount=?, kind=?, category=?, tx_date=?, note=?
            WHERE id=?
        """, (title, amount, kind, category, tx_date, str(data.get("note", ""))[:200], tx_id))
    if cur.rowcount == 0:
        return jsonify(error="Transaction not found."), 404
    return jsonify(message="Transaction updated.")

@app.delete("/api/transactions/<int:tx_id>")
def delete_transaction(tx_id):
    with get_db() as db:
        cur = db.execute("DELETE FROM transactions WHERE id=?", (tx_id,))
    if cur.rowcount == 0:
        return jsonify(error="Transaction not found."), 404
    return jsonify(message="Transaction deleted.")

@app.put("/api/budget")
def update_budget():
    data = request.get_json(silent=True) or {}
    month = data.get("month", "")
    try:
        amount = float(data.get("amount", -1))
        datetime.strptime(month, "%Y-%m")
    except (TypeError, ValueError):
        return jsonify(error="Enter a valid month and budget."), 400
    if amount < 0 or amount > 100000000:
        return jsonify(error="Budget cannot be negative."), 400
    with get_db() as db:
        db.execute("""
            INSERT INTO budgets (month, amount) VALUES (?, ?)
            ON CONFLICT(month) DO UPDATE SET amount=excluded.amount
        """, (month, amount))
    return jsonify(message="Budget saved.")

@app.get("/export/csv")
def export_csv():
    month = request.args.get(
        "month",
        date.today().strftime("%Y-%m")
    )

    try:
        datetime.strptime(month, "%Y-%m")
    except ValueError:
        return jsonify(error="Invalid month."), 400

    with get_db() as db:
        transactions = db.execute("""
            SELECT title, amount, kind, category, tx_date, note
            FROM transactions
            WHERE substr(tx_date, 1, 7) = ?
            ORDER BY tx_date DESC
        """, (month,)).fetchall()

    output = io.StringIO()
    output.write("\ufeff")

    writer = csv.writer(output)

    writer.writerow([
        "Title", "Amount", "Type",
        "Category", "Date", "Note"
    ])

    for t in transactions:
        writer.writerow([
            t["title"], t["amount"], t["kind"],
            t["category"], t["tx_date"], t["note"]
        ])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition":
            f"attachment; filename=spendwise_{month}.csv"
        }
    )

@app.get("/api/monthly-report")
def monthly_report():
    from datetime import date
    from dateutil.relativedelta import relativedelta

    today = date.today()
    reports = []

    with get_db() as db:
        for i in range(5, -1, -1):
            month_date = today.replace(day=1) - relativedelta(months=i)
            month = month_date.strftime("%Y-%m")

            totals = db.execute("""
                SELECT
                    COALESCE(SUM(CASE WHEN kind='income'
                    THEN amount ELSE 0 END), 0) AS income,
                    COALESCE(SUM(CASE WHEN kind='expense'
                    THEN amount ELSE 0 END), 0) AS expenses
                FROM transactions
                WHERE substr(tx_date, 1, 7) = ?
            """, (month,)).fetchone()

            reports.append({
                "month": month,
                "income": totals["income"],
                "expenses": totals["expenses"],
                "savings": totals["income"] - totals["expenses"]
            })

    return jsonify(reports)


@app.get("/api/category-budgets")
def get_category_budgets():
    month = request.args.get("month", date.today().strftime("%Y-%m"))

    try:
        datetime.strptime(month, "%Y-%m")
    except ValueError:
        return jsonify(error="Invalid month."), 400

    with get_db() as db:
        rows = db.execute("""
            SELECT
                c.category,
                COALESCE(b.amount, 0) AS budget,
                COALESCE(SUM(t.amount), 0) AS spent
            FROM (
                SELECT category FROM category_budgets
                WHERE month = ?
                UNION
                SELECT DISTINCT category FROM transactions
                WHERE kind = 'expense'
                AND substr(tx_date, 1, 7) = ?
            ) c
            LEFT JOIN category_budgets b
                ON b.category = c.category AND b.month = ?
            LEFT JOIN transactions t
                ON t.category = c.category
                AND t.kind = 'expense'
                AND substr(t.tx_date, 1, 7) = ?
            GROUP BY c.category, b.amount
            ORDER BY c.category
        """, (month, month, month, month)).fetchall()

    return jsonify([
        {
            "category": r["category"],
            "budget": r["budget"],
            "spent": r["spent"],
            "remaining": r["budget"] - r["spent"]
        }
        for r in rows
    ])


@app.put("/api/category-budgets")
def save_category_budget():
    data = request.get_json(silent=True) or {}

    month = data.get("month", "")
    category = data.get("category", "")

    try:
        amount = float(data.get("amount", -1))
        datetime.strptime(month, "%Y-%m")
    except (TypeError, ValueError):
        return jsonify(error="Invalid month or amount."), 400

    if category not in CATEGORIES["expense"]:
        return jsonify(error="Invalid expense category."), 400

    if not 0 <= amount <= 100000000:
        return jsonify(error="Invalid budget amount."), 400

    with get_db() as db:
        db.execute("""
            INSERT INTO category_budgets (month, category, amount)
            VALUES (?, ?, ?)
            ON CONFLICT(month, category)
            DO UPDATE SET amount = excluded.amount
        """, (month, category, amount))

    return jsonify(message="Category budget saved.")

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
