
# SpendWise – Personal Expense Tracker

SpendWise is a web-based personal finance management application built using Python, Flask, SQLite, HTML, CSS, and JavaScript. It helps users track income and expenses, manage monthly and category-wise budgets, and understand their spending habits through interactive charts and smart budget insights.

## Features

### 1. Dashboard
- View total income, expenses, and available balance.
- Monitor monthly budget and spending progress.
- View a quick financial overview.

### 2. Transaction Management
- Add income and expense transactions.
- Edit existing transactions.
- Delete transactions.
- Store transaction details such as title, amount, category, date, and type.

### 3. Transaction Search and Filtering
- Search transactions by title.
- Filter transactions by income or expense.
- Filter transactions by category.

### 4. Monthly Budget Planner
- Set and update a monthly spending budget.
- Track monthly expenses against the budget.
- View budget progress indicators.
- Dynamic progress colors:
  - Green: Spending is below 70%.
  - Orange: Spending is between 70% and 99%.
  - Red: Budget is reached or exceeded.

### 5. Category-wise Budget Management
- Set individual budgets for different expense categories.
- Monitor spending in each category.
- View category-wise progress bars.
- Identify categories that are approaching or exceeding their budgets.
- View remaining or exceeded budget amounts.

### 6. Smart Budget Insights
- Automatically generate spending insights.
- Identify categories without a budget.
- Warn users when spending approaches the budget limit.
- Highlight categories that exceed their budget.
- Show remaining budget amounts.

### 7. Interactive Charts and Reports
- Spending breakdown using a doughnut chart.
- Daily cashflow visualization.
- Monthly expense report chart.
- Visual representation of financial activity using Chart.js.

### 8. CSV Export
- Export transaction records as a CSV file.
- Use exported data for personal records and analysis.

### 9. User Interface
- Responsive design for desktop and mobile devices.
- Dark mode and light mode.
- Desktop sidebar navigation.
- Mobile bottom navigation.
- Active navigation indicators.

## Technologies Used

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| Flask | Web framework |
| SQLite | Database management |
| HTML5 | Page structure |
| CSS3 | Styling and responsive design |
| JavaScript | Frontend functionality |
| Chart.js | Interactive charts |

## Project Structure

```text
SpendWise/
│
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
│
├── templates/
│   └── index.html
│
├── static/
│   ├── style.css
│   └── app.js
│
└── spendwise.db
```

The SQLite database is created and managed by the application.

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/spendwise.git
```

### 2. Navigate to the Project Folder

```bash
cd spendwise
```

### 3. Create a Virtual Environment

```bash
python -m venv venv
```

### 4. Activate the Virtual Environment

For Windows:

```bash
venv\Scripts\activate
```

### 5. Install Dependencies

```bash
pip install -r requirements.txt
```

### 6. Run the Application

```bash
python app.py
```

### 7. Open in Browser

Visit:

```text
http://127.0.0.1:5000
```

## Database

SpendWise uses SQLite to store:
- Income and expense transactions.
- Monthly budget information.
- Category-wise budget information.

## Project Objective

The objective of SpendWise is to provide a simple and interactive platform for managing personal finances. It helps users understand their spending patterns, monitor budgets, and make better financial decisions.

## Future Improvements

- User authentication and personal accounts.
- Cloud database integration.
- Advanced spending analytics.
- Downloadable monthly financial reports.
- Automated recurring transaction tracking.

## Author

**Priyangshu**

Developed as a personal web development project to practise Python, Flask, database management, frontend development, and data visualization.
