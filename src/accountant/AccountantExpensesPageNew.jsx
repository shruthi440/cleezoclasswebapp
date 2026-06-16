import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import "./AccountantDashboardnew.css";
import "./AccountantFeesPageNew.css";
import "./AccountantExpensesPageNew.css";
import ErrorPopup from "../shared/ErrorPopup";
import CreateMasterExpenseForm from "./ExpensesAccountant";
import IncomeForm5 from "../shared/IncomeformTwo.jsx";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";
import InstituteBrand from "../shared/InstituteBrand.jsx";
import { resolveInstituteDisplayName } from "../shared/instituteNameUtils";

import collectFeeIcon from "../assets/collect.png";
import addFeeIcon from "../assets/Navbar-AddFee.png";
import expenseIcon from "../assets/Navbar-Expenses.png";
import reportIcon from "../assets/Reports.png";
import dashboardIcon from "../assets/Dashboard.png";
import addStudentIcon from "../assets/Enrollment.png";
import createFeeIcon from "../assets/create-fee.png";
import addFeesIcon from "../assets/add-fee.png";
import assistantIcon from "../assets/Assistant.png";
import logoab from "../assets/logoab.png";
import userAvatar from "../assets/user.png";

const quickCards = [
  { icon: createFeeIcon, title: "Create Expense", text: "Expense type & category" },
  { icon: addFeesIcon, title: "Add Expense", text: "Expense entry & bills" },
  { icon: assistantIcon, title: "Assistant", text: "Daily activity check" },
];

const predefinedExpenseOptions = {
  "Maintenance Services": [
    "Building Maintenance and Repair",
    "Furniture Repair",
    "Electrical & Plumbing Services",
    "Gardening and Landscaping Services",
    "Fire Safety Maintenance",
    "Pest Control",
  ],
  "Digital & IT Services": [
    "Internet Services",
    "IT support & Maintenance",
    "Digital Learning tools",
    "Website Maintenance",
    "Smart Class AMC",
  ],
  "Transport-related Services": [
    "Vehicle Maintenance & Repair",
    "Fuel & Oil Services",
    "GPS Tracking System Services",
    "Transport Contract Services",
  ],
  "Administrative Financial Services": [
    "Accounting and Auditing Services",
    "Legal and Compliance Services",
    "Document Printing and Photocopying Services",
    "Courier & Postage Services",
    "Office Supplies Procurement Services",
  ],
  "Health & Safety Services": [
    "Medical Checkup Camps",
    "First Aid & Emergency Care Supplies",
    "Health Insurance",
    "Sanitization and Hygiene Services",
  ],
};

const activityItems = [
  "Expense logged - Office supplies - Voucher 8556",
  "Salary updated - March payroll processed",
];

const assistantRecentActions = [
  { id: 1, text: "Expense bills matched with submitted entries", status: "OK" },
  { id: 2, text: "Salary register reviewed for current cycle", status: "OK" },
  { id: 3, text: "High-value expense requires final verification", status: "PENDING" },
];

const summaryCards = [
  { amount: "₹0.00", label: "Transport Due" },
  { amount: "₹22,000.00", label: "Books Due" },
  { amount: "₹7,05,320.00", label: "Tuition Due" },
];

const expenseActionPlans = [
  {
    title: "Daily Expense Verification",
    detail: "Verify every submitted expense with bills and payment mode.",
    procedure: [
      "Open day expenses list and sort by date/time.",
      "Match each entry with bill/voucher.",
      "Validate payment mode and vendor/person name.",
      "Fix mismatches before day-close.",
    ],
  },
  {
    title: "High Spend Category Control",
    detail: "Monitor categories where spend is unusually high.",
    procedure: [
      "Review top expense categories from reports.",
      "Compare current week vs previous week.",
      "Flag category increase above 20%.",
      "Escalate repeated spikes to management.",
    ],
  },
  {
    title: "Salary Payout Reconciliation",
    detail: "Ensure salary payouts match ledger and approvals.",
    procedure: [
      "Match salary paid with approved ledger.",
      "Validate deductions and adjustments.",
      "Confirm payment date and method.",
      "Log unresolved mismatches for follow-up.",
    ],
  },
];

const AccountantExpensesPageNew = () => {
  const navigate = useNavigate();
  const userName = useMemo(() => localStorage.getItem("name") || "Nishanth", []);
  const [instituteName, setInstituteName] = useState("Institute");
  const [instituteLogo, setInstituteLogo] = useState("/default-logo.png");
  const [isCreateExpensePopupOpen, setIsCreateExpensePopupOpen] = useState(false);
  const [isAddExpensePopupOpen, setIsAddExpensePopupOpen] = useState(false);
  const [isAddFeesPopupOpen, setIsAddFeesPopupOpen] = useState(false);
  const [isStudentManagementPopupOpen, setIsStudentManagementPopupOpen] = useState(false);
  const [addFeePreview, setAddFeePreview] = useState({
    className: "",
    section: "",
    rows: [],
  });
  const [expenseTransactionForm, setExpenseTransactionForm] = useState({
    expenseType: "",
    expenseName: "",
    personName: "",
    mobileNumber: "",
    description: "",
    price: "",
  });
  const [expensePaymentForm, setExpensePaymentForm] = useState({
    paymentMode: "BANK",
    totalAmount: "",
    paidAmount: "",
    balance: "",
  });
  const [addExpenseStep, setAddExpenseStep] = useState(1);
  const [dynamicExpenseOptions, setDynamicExpenseOptions] = useState({});
  const [expenseRows, setExpenseRows] = useState([]);
  const [expenseRowsLoading, setExpenseRowsLoading] = useState(false);
  const [popup, setPopup] = useState({ message: "", type: "" });
  const [expenseSubmitLoading, setExpenseSubmitLoading] = useState(false);
  const [activeRightPanel, setActiveRightPanel] = useState("master");
  const [assistantSalaryRows, setAssistantSalaryRows] = useState([]);
  const [assistantLoadingLists, setAssistantLoadingLists] = useState(false);
  const [showAllAssistantExpenses, setShowAllAssistantExpenses] = useState(false);
  const [showAllAssistantSalaries, setShowAllAssistantSalaries] = useState(false);
  const [ledgerFromDate, setLedgerFromDate] = useState("");
  const [ledgerToDate, setLedgerToDate] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const studentManagementPopupUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${import.meta.env.BASE_URL}StudentManagement`;

  useEffect(() => {
    const schoolCode = String(localStorage.getItem("schoolCode") || "").trim();
    if (!schoolCode) return;

    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${encodeURIComponent(schoolCode)}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        const resolvedInstituteName = resolveInstituteDisplayName({
          apiInstituteName: data?.institute_name || data?.instituteName || data?.schoolName || data?.name,
          storedSchoolName: localStorage.getItem("schoolName"),
          storedInstituteName: localStorage.getItem("instituteName"),
          schoolCode,
          fallback: "Institute",
        });
        setInstituteLogo(data.logo || "/default-logo.png");
        setInstituteName(resolvedInstituteName);
        localStorage.setItem("schoolName", resolvedInstituteName);
        localStorage.setItem("instituteName", resolvedInstituteName);
      })
      .catch(() => {
        const fallbackInstituteName = resolveInstituteDisplayName({
          storedSchoolName: localStorage.getItem("schoolName"),
          storedInstituteName: localStorage.getItem("instituteName"),
          schoolCode,
          fallback: "Institute",
        });
        setInstituteLogo("/default-logo.png");
        setInstituteName(fallbackInstituteName);
        localStorage.setItem("schoolName", fallbackInstituteName);
        localStorage.setItem("instituteName", fallbackInstituteName);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("schoolCode");
    localStorage.removeItem("userRole");
    localStorage.removeItem("name");
    sessionStorage.clear();
    window.location.replace(import.meta.env.BASE_URL || "/");
  };

  useEffect(() => {
    const fetchDynamicOptions = async () => {
      try {
        const schoolCode = localStorage.getItem("schoolCode");
        if (!schoolCode) return;

        const response = await fetch(
          `https://cleezoclass.com:4000/api/admin/get-expense-master?schoolCode=${schoolCode}`
        );
        const data = await response.json();
        setDynamicExpenseOptions(data && typeof data === "object" ? data : {});
      } catch (error) {
        console.error("Failed to load expense dropdown options:", error);
        setDynamicExpenseOptions({});
      }
    };

    fetchDynamicOptions();
  }, []);

  const combinedExpenseOptions = useMemo(
    () => ({ ...predefinedExpenseOptions, ...dynamicExpenseOptions }),
    [dynamicExpenseOptions]
  );
  const masterExpenseItems = useMemo(
    () =>
      Object.entries(combinedExpenseOptions).flatMap(([category, expenseNames]) =>
        (expenseNames || []).map((expenseName) => ({
          id: `${category}-${expenseName}`,
          category,
          expenseName,
        }))
      ),
    [combinedExpenseOptions]
  );

  const fetchCombinedExpenseRows = async (schoolCode) => {
    const [expenseResponse, billsResponse] = await Promise.all([
      axios.get(`https://cleezoclass.com:4000/totalexpensesData?schoolCode=${schoolCode}`),
      fetch("https://cleezoclass.com:4000/getAllBills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode }),
      }),
    ]);

    const expenseRows = Array.isArray(expenseResponse.data) ? expenseResponse.data : expenseResponse.data?.data || [];
    const rawBills = billsResponse.ok ? await billsResponse.json() : [];
    const billRows = (Array.isArray(rawBills) ? rawBills : []).map((bill, index) => ({
      id: bill.id || `uploaded-bill-${index}`,
      expense_name: bill.bill_type || "Uploaded Bill",
      expense_type: bill.bill_type || "Uploaded Bill",
      description: bill.description || "Uploaded bill",
      payment_mode: "N/A",
      paymentMode: "N/A",
      price: Number(bill.amount) || 0,
      amount: Number(bill.amount) || 0,
      paid_amount: Number(bill.amount) || 0,
      paidAmount: Number(bill.amount) || 0,
      totalAmount: Number(bill.amount) || 0,
      balance: 0,
      expense_date: bill.date || "",
      date: bill.date || "",
      imageUrl: bill.imageUrl || "",
      isUploadedBill: true,
    }));

    return [...expenseRows, ...billRows].sort(
      (a, b) =>
        new Date(b.payment_date || b.expense_date || b.date || 0) -
        new Date(a.payment_date || a.expense_date || a.date || 0)
    );
  };

  const fetchExpenseRows = async () => {
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) return;

      setExpenseRowsLoading(true);
      const rows = await fetchCombinedExpenseRows(schoolCode);
      setExpenseRows(rows);
    } catch (error) {
      console.error("Failed to load expense list:", error);
      setExpenseRows([]);
    } finally {
      setExpenseRowsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenseRows();
  }, []);

  useEffect(() => {
    const fetchAssistantLists = async () => {
      try {
        const schoolCode = localStorage.getItem("schoolCode");
        if (!schoolCode) return;

        setAssistantLoadingLists(true);
        const [nextExpenseRows, salaryResponse] = await Promise.all([
          fetchCombinedExpenseRows(schoolCode),
          axios.get("https://cleezoclass.com:4000/api/salarymanagement", {
            params: { schoolCode },
          }),
        ]);

        const nextSalaryRows = Array.isArray(salaryResponse.data)
          ? salaryResponse.data
          : salaryResponse.data?.data || [];

        setExpenseRows(nextExpenseRows);
        setAssistantSalaryRows(nextSalaryRows);
      } catch (error) {
        console.error("Failed to fetch assistant expense/salary lists:", error);
        setAssistantSalaryRows([]);
      } finally {
        setAssistantLoadingLists(false);
      }
    };

    fetchAssistantLists();
  }, []);

  useEffect(() => {
    const total = Number(expensePaymentForm.totalAmount) || 0;
    const paid = Number(expensePaymentForm.paidAmount) || 0;
    const balance = Math.max(total - paid, 0);
    setExpensePaymentForm((prev) => {
      const nextBalance = balance ? balance.toFixed(2) : "0.00";
      return prev.balance === nextBalance ? prev : { ...prev, balance: nextBalance };
    });
  }, [expensePaymentForm.totalAmount, expensePaymentForm.paidAmount]);

  const resetAddExpenseFlow = () => {
    setExpenseTransactionForm({
      expenseType: "",
      expenseName: "",
      personName: "",
      mobileNumber: "",
      description: "",
      price: "",
    });
    setExpensePaymentForm({
      paymentMode: "BANK",
      totalAmount: "",
      paidAmount: "",
      balance: "",
    });
    setAddExpenseStep(1);
  };

  const formatINR = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const openImageModal = (imageUrl) => {
    if (!imageUrl) return;
    window.open(imageUrl, "_blank");
  };

  const formatDisplayDate = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-");
      return `${month}/${day}/${year}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split("/");
      return `${month}/${day}/${year}`;
    }
    return value;
  };

  const assistantVisibleExpenses = showAllAssistantExpenses ? expenseRows : expenseRows.slice(0, 4);
  const assistantVisibleSalaries = showAllAssistantSalaries
    ? assistantSalaryRows
    : assistantSalaryRows.slice(0, 4);
  const totalExpenseAmount = useMemo(
    () => expenseRows.reduce((sum, item) => sum + Number(item.price || item.amount || item.paid_amount || 0), 0),
    [expenseRows]
  );
  const totalSalaryAmount = useMemo(
    () =>
      assistantSalaryRows.reduce(
        (sum, row) => sum + Number(row.final_salary || row.salary_amount || row.base_salary || 0),
        0
      ),
    [assistantSalaryRows]
  );
  const stationaryTotal = useMemo(
    () =>
      expenseRows.reduce((sum, item) => {
        const label = `${item.expense_name || ""} ${item.expense_type || ""}`.toLowerCase();
        return label.includes("stationary") ? sum + Number(item.price || item.amount || item.paid_amount || 0) : sum;
      }, 0),
    [expenseRows]
  );
  const utilitiesTotal = useMemo(
    () =>
      expenseRows.reduce((sum, item) => {
        const label = `${item.expense_name || ""} ${item.expense_type || ""}`.toLowerCase();
        return label.includes("utility") || label.includes("electric") || label.includes("water")
          ? sum + Number(item.price || item.amount || item.paid_amount || 0)
          : sum;
      }, 0),
    [expenseRows]
  );
  const transportTotal = useMemo(
    () =>
      expenseRows.reduce((sum, item) => {
        const label = `${item.expense_name || ""} ${item.expense_type || ""}`.toLowerCase();
        return label.includes("transport") || label.includes("fuel") || label.includes("bus")
          ? sum + Number(item.price || item.amount || item.paid_amount || 0)
          : sum;
      }, 0),
    [expenseRows]
  );
  const filteredLedgerRows = useMemo(() => {
    const parseRowDate = (item) => {
      const raw = item.payment_date || item.expense_date || item.date || "";
      if (!raw) return "";
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
        const [day, month, year] = raw.split("/");
        return `${year}-${month}-${day}`;
      }
      return "";
    };

    return expenseRows.filter((item) => {
      const rowDate = parseRowDate(item);
      const searchText = `${item.expense_name || ""} ${item.expense_type || ""} ${item.description || ""} ${item.paymentMode || item.payment_mode || ""}`.toLowerCase();
      if (expenseSearch && !searchText.includes(expenseSearch.toLowerCase())) return false;
      if (ledgerFromDate && (!rowDate || rowDate < ledgerFromDate)) return false;
      if (ledgerToDate && (!rowDate || rowDate > ledgerToDate)) return false;
      return true;
    });
  }, [expenseRows, expenseSearch, ledgerFromDate, ledgerToDate]);
  const filteredLedgerTotalAmount = useMemo(
    () => filteredLedgerRows.reduce((sum, item) => sum + Number(item.totalAmount || item.amount || item.price || 0), 0),
    [filteredLedgerRows]
  );
  const filteredLedgerPaidAmount = useMemo(
    () => filteredLedgerRows.reduce((sum, item) => sum + Number(item.paidAmount || item.paid_amount || item.price || 0), 0),
    [filteredLedgerRows]
  );
  const filteredLedgerBalance = useMemo(
    () =>
      filteredLedgerRows.reduce(
        (sum, item) =>
          sum +
          Number(
            item.balance ||
              (Number(item.totalAmount || item.amount || item.price || 0) -
                Number(item.paidAmount || item.paid_amount || item.price || 0))
          ),
        0
      ),
    [filteredLedgerRows]
  );

const handleSubmitExpense = async () => {
  const schoolCode = localStorage.getItem("schoolCode");
  if (!schoolCode) {
    setPopup({ message: "School code not found!", type: "error" });
    return;
  }

  if (!expenseTransactionForm.expenseType || !expenseTransactionForm.expenseName) {
    setPopup({ message: "Please select Expense Type and Expense Name.", type: "error" });
    return;
  }

  if (!expensePaymentForm.totalAmount || !expensePaymentForm.paidAmount) {
    setPopup({ message: "Please enter Total Amount and Paid Amount.", type: "error" });
    return;
  }

  setExpenseSubmitLoading(true);

  try {
    const payload = {
      expenseName: expenseTransactionForm.expenseName,
      expenseType: expenseTransactionForm.expenseType,
      description: expenseTransactionForm.description,
      paymentMode: expensePaymentForm.paymentMode,
      totalAmount: parseFloat(expensePaymentForm.totalAmount) || 0,
      paidAmount: parseFloat(expensePaymentForm.paidAmount) || 0,
      balance: parseFloat(expensePaymentForm.balance) || 0,
      personName: expenseTransactionForm.personName,
      mobileNumber: expenseTransactionForm.mobileNumber,
      price: parseFloat(expenseTransactionForm.price) || 0,
      schoolCode,
    };

    // Submit the expense
    await axios.post("https://cleezoclass.com:4000/Accountntdata", payload);

    // Refetch the expense rows immediately after submission
    const nextExpenseRows = await fetchCombinedExpenseRows(schoolCode);
    setExpenseRows(nextExpenseRows);

    // Update the assistant lists as well
    setAssistantSalaryRows(nextExpenseRows.filter(row => row.final_salary || row.salary_amount || row.base_salary));

    // Reset the form and close the popup
    setPopup({ message: "Expense created successfully!", type: "success" });
    setIsAddExpensePopupOpen(false);
    resetAddExpenseFlow();
  } catch (error) {
    console.error("Error submitting expense:", error);
    setPopup({
      message: error?.response?.data?.message || "Failed to create expense!",
      type: "error",
    });
  } finally {
    setExpenseSubmitLoading(false);
  }
};
const isFormValid =
  expenseTransactionForm.expenseType &&
  expenseTransactionForm.expenseName &&
  expenseTransactionForm.description.trim();
  return (
    <div className="accountant-dashboard-page accountant-fees-page accountant-expenses-page">
      <div className="accountant-dashboard-shell">
        <div className="accountant-sidebar-strip">
          <div
            className="accountant-sidebar-item"
            onClick={() => navigate("/AccountantDashboard")}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") navigate("/AccountantDashboard");
            }}
          >
            <div className="accountant-sidebar-item-icon">
              <img src={dashboardIcon} alt="Home" />
            </div>
            <span>Dashboard</span>
          </div>

          <div
            className="accountant-sidebar-item"
            onClick={() => navigate("/AccountantFees")}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") navigate("/AccountantFees");
            }}
          >
            <div className="accountant-sidebar-item-icon"
            >
              <img src={collectFeeIcon} alt="" />
            </div>
            <span>Fees</span>
          </div>

          <div className="accountant-sidebar-item"

              onClick={() => setIsAddFeesPopupOpen(true)}
            >
            
            <div className="accountant-sidebar-item-icon">
              <img src={addFeeIcon} alt="" />
            </div>
            <span>Add Fees</span>
          </div>

          <div
            className={`accountant-sidebar-item ${isStudentManagementPopupOpen ? "accountant-sidebar-item-active" : ""}`.trim()}
            onClick={() => setIsStudentManagementPopupOpen(true)}
          >
            <div className="accountant-sidebar-item-icon">
              <img src={addStudentIcon} alt="" />
            </div>
            <span>Add Student</span>
          </div>

          <div className="accountant-sidebar-item accountant-sidebar-item-active">
            <div className="accountant-sidebar-item-icon">
              <img src={expenseIcon} alt="" />
            </div>
            <span>Expense</span>
          </div>

          <div
            className="accountant-sidebar-item"
            onClick={() => navigate("/AccountantReportsPage")}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") navigate("/AccountantReportsPage");
            }}
          >
            <div className="accountant-sidebar-item-icon">
              <img src={reportIcon} alt="" />
            </div>
            <span>Reports</span>
          </div>
        </div>

        <div className="accountant-main-area">
          <div className="accountant-topbar">
            <nav className="accountant-topbar-left">
              <button
                type="button"
                className="accountant-topbar-tab accountant-topbar-tab-button"
                onClick={() => navigate("/AccountantDashboard")}
              >
                Dashboard
              </button>
              <button
                type="button"
                className="accountant-topbar-tab accountant-topbar-tab-button"
                onClick={() => navigate("/AccountantFees")}
              >
                Fees
              </button>
              <button
                type="button"
                className="accountant-topbar-tab accountant-topbar-tab-button accountant-topbar-tab-active"
                onClick={() => navigate("/AccountantExpenses")}
              >
                Expense
              </button>
              <button
                type="button"
                className="accountant-topbar-tab accountant-topbar-tab-button"
                onClick={() => navigate("/AccountantReportsPage")}
              >
                Reports
              </button>
            </nav>

            <div className="accountant-topbar-center">
              <InstituteBrand
                logoSrc={instituteLogo || logoab}
                logoAlt={instituteName || "Institute"}
                instituteName={instituteName}
              />
            </div>

            <div className="accountant-topbar-right">
              <EditableProfileMenu />
            </div>
          </div>

          <div className="accountant-grid accountant-fees-grid accountant-expenses-grid">
            <div className="accountant-row accountant-fees-row-top">
              <div className="accountant-welcome-block">
                <h2>Hi, {userName}!</h2>
                <p>Track expense status,</p>
                <p>review bills and salary,</p>
                <p>submit day wise records</p>
              </div>

              <div className="accountant-fees-summary-card accountant-card">
                <div className="accountant-fees-summary-left">
                  <div className="accountant-progress-panel">
                    <div className="accountant-progress-ring" style={{ "--progress-angle": "10.8deg" }}>
                      <div className="accountant-progress-ring-inner">3%</div>
                    </div>
                  </div>

                  <div className="accountant-fees-summary-stats">
                    <p>
                      <span className="normalText accountant-fees-summary-label">Total Expenses:</span>
                      <strong className="accountant-fees-summary-value">{formatINR(totalExpenseAmount)}</strong>
                    </p>
                    <p>
                      <span className="normalText accountant-fees-summary-label">Total Salaries:</span>
                      <strong className="accountant-fees-summary-value">{formatINR(totalSalaryAmount)}</strong>
                    </p>
                    <p>
                      <span className="normalText accountant-fees-summary-label">Total Store Expenses:</span>
                      <strong className="accountant-fees-summary-value">{formatINR(stationaryTotal)}</strong>
                    </p>
                    <p>
                      <span className="normalText accountant-fees-summary-label">Total Utilities:</span>
                      <strong className="accountant-fees-summary-value">{formatINR(utilitiesTotal)}</strong>
                    </p>
                  </div>
                </div>

                <div className="accountant-fees-summary-right">
                  <button type="button" className="collect-filter accountant-fees-summary-filter">
                    <span>As on today</span>
                  </button>

                  <div className="accountant-fees-summary-total">
                    <span>Total Bus Expenses</span>
                    <strong>{formatINR(transportTotal)}</strong>
                  </div>
                </div>
              </div>

              <div className="accountant-mini-cards">
                {quickCards.map((card) => (
                  <div
                    key={card.title}
                    className="accountant-quick-card accountant-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (card.title === "Create Expense") {
                        setActiveRightPanel("master");
                        setIsCreateExpensePopupOpen(true);
                      } else if (card.title === "Add Expense") {
                        setActiveRightPanel("transactions");
                        resetAddExpenseFlow();
                        setIsAddExpensePopupOpen(true);
                      } else if (card.title === "Assistant") {
                        setShowAllAssistantExpenses(false);
                        setShowAllAssistantSalaries(false);
                        setActiveRightPanel("assistant");
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      if (card.title === "Create Expense") {
                        setActiveRightPanel("master");
                        setIsCreateExpensePopupOpen(true);
                      } else if (card.title === "Add Expense") {
                        setActiveRightPanel("transactions");
                        resetAddExpenseFlow();
                        setIsAddExpensePopupOpen(true);
                      } else if (card.title === "Assistant") {
                        setShowAllAssistantExpenses(false);
                        setShowAllAssistantSalaries(false);
                        setActiveRightPanel("assistant");
                      }
                    }}
                  >
                    <div>
                      <img src={card.icon} alt="" />
                    </div>
                    <h4>{card.title}</h4>
                    <p>{card.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="accountant-fees-main-section">
              <div className="accountant-fees-main-left">
                <div className="accountant-fees-collection-card accountant-card accountant-expenses-inline-card">
                  <div className="accountant-fees-collection-header">
                    <h3>Expense Management</h3>

                    <div className="accountant-fees-collection-tools">
                      <div className="accountant-fees-strength">
                        <strong>{filteredLedgerRows.length}</strong>
                        <span>
                          {ledgerFromDate || ledgerToDate
                            ? `of ${expenseRows.length} Records`
                            : "Records"}
                        </span>
                      </div>

                      <input
                        type="text"
                        className="accountant-fees-search"
                        placeholder="Expense Search..."
                        value={expenseSearch}
                        onChange={(event) => setExpenseSearch(event.target.value)}
                      />
                      <select
                        className="accountant-card-filter"
                        value="All"
                        onChange={() => {}}
                      >
                        <option value="All">All</option>
                      </select>
                      <select
                        className="accountant-card-filter"
                        value="All"
                        onChange={() => {}}
                      >
                        <option value="All">All</option>
                      </select>
                    </div>
                  </div>

                  <div className="accountant-expense-ledger-card">
                    <div className="accountant-expense-ledger-toolbar">
                      <label className="accountant-expense-ledger-filter">
                        <span>From:</span>
                        <input
                          type="date"
                          value={ledgerFromDate}
                          onChange={(event) => setLedgerFromDate(event.target.value)}
                        />
                      </label>
                      <label className="accountant-expense-ledger-filter">
                        <span>To:</span>
                        <input
                          type="date"
                          value={ledgerToDate}
                          onChange={(event) => setLedgerToDate(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="accountant-expense-ledger-reset"
                        onClick={() => {
                          setLedgerFromDate("");
                          setLedgerToDate("");
                        }}
                      >
                        Reset
                      </button>
                    </div>

                    <div className="accountant-expense-ledger-table-wrap">
                      <table className="accountant-expense-ledger-table">
                        <thead>
                          <tr>
                            <th>Bill No.</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Mode</th>
                            <th>Total Amt</th>
                            <th>Paid Amt</th>
                            <th>Balance</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseRowsLoading ? (
                            <tr>
                              <td colSpan="9" className="accountant-expense-ledger-empty">
                                Loading expenses...
                              </td>
                            </tr>
                          ) : filteredLedgerRows.length ? (
                            filteredLedgerRows.map((item, index) => {
                              const totalAmount = Number(item.totalAmount || item.amount || item.price || 0);
                              const paidAmount = Number(item.paidAmount || item.paid_amount || item.price || 0);
                              const balanceAmount = Number(item.balance || totalAmount - paidAmount);
                              const displayDate = item.payment_date || item.expense_date || item.date || "-";

                              return (
                                <tr key={`${item.expense_name || item.description || "ledger"}-${index}`}>
                                  <td>{index + 1}</td>
                                  <td>{formatDisplayDate(displayDate)}</td>
                                  <td>{item.expense_type || "-"}</td>
                                  <td>{item.description || item.expense_name || "-"}</td>
                                  <td>{item.paymentMode || item.payment_mode || "-"}</td>
                                  <td>{formatINR(totalAmount)}</td>
                                  <td>{formatINR(paidAmount)}</td>
                                  <td>{formatINR(balanceAmount)}</td>
                                  <td>
                                    {item.isUploadedBill && item.imageUrl ? (
                                      <button
                                        type="button"
                                        className="accountant-feetype-edit"
                                        onClick={() => openImageModal(item.imageUrl)}
                                      >
                                        View
                                      </button>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="9" className="accountant-expense-ledger-empty">
                                No expense ledger records found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan="5">Total</td>
                            <td>{formatINR(filteredLedgerTotalAmount)}</td>
                            <td>{formatINR(filteredLedgerPaidAmount)}</td>
                            <td>{formatINR(filteredLedgerBalance)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="accountant-fees-bottom-left-row">
                  <div className="accountant-fees-log-card accountant-card">
                    <div className="accountant-fees-log-list">
                      {activityItems.map((item) => (
                        <p key={item} className="accountant-fees-log-item">O {item}</p>
                      ))}
                    </div>
                  </div>

                  <div className="accountant-total-others-card accountant-card">
                    <div className="accountant-total-others-left">
                      <div className="accountant-total-strip-item">
                        <strong>Rs 23,496.00</strong>
                        <span>Office Expense</span>
                      </div>

                      <div className="accountant-total-strip-item">
                        <strong>Rs 3,86,412.00</strong>
                        <span>Salary Expense</span>
                      </div>
                    </div>

                    <div className="accountant-total-others-right">
                      <span>Total Others</span>
                      <h2>₹0.00</h2>
                      <p>Expense Summary</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="accountant-fees-main-right">
                <div className="accountant-feetype-list-card accountant-card">
                  <div className="accountant-card-header accountant-feetype-header">
                    <h3>
                      {activeRightPanel === "assistant"
                        ? "Assistant"
                        : activeRightPanel === "transactions"
                          ? "Expense Transactions"
                          : "Expense List"}
                    </h3>
                  </div>

                  <div className="accountant-feetype-scroll" key={activeRightPanel}>
                    {activeRightPanel === "assistant" ? (
                      <div className="action-container" style={{ padding: "10px" }}>
                        <div
                          className="action-item"
                          style={{ marginBottom: "12px", display: "block", width: "100%" }}
                        >
                          <strong style={{ fontSize: "13px" }}>Expense List ({expenseRows.length})</strong>
                          <div
                          className="normalText"
                            style={{
                              marginTop: "6px",
                              maxHeight: showAllAssistantExpenses ? "220px" : "120px",
                              overflowY: "auto",
                              display: "grid",
                              gap: "8px",
                              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                            }}
                          >
                            {assistantLoadingLists && (
                              <div style={{ fontSize: "12px" }}>Loading expense list...</div>
                            )}
                            {!assistantLoadingLists &&
                              assistantVisibleExpenses.map((item, index) => (
                                <div
                                  key={`${item.expense_name || item.description || "expense"}-${index}`}
                                  style={{
                                    border: "1px solid #e6e6e6",
                                    borderRadius: "8px",
                                    padding: "8px",
                                    background: "#fafafa",
                                  }}
                                >
                                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#222" }}>
                                    {item.expense_name || item.expense_type || "Expense"}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>
                                    {item.expense_type || "Type N/A"}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#333", marginTop: "2px" }}>
                                    {formatINR(item.price || item.amount || item.paid_amount)}
                                  </div>
                                </div>
                              ))}
                            {!assistantLoadingLists && expenseRows.length > 4 && !showAllAssistantExpenses && (
                              <button
                                type="button"
                                onClick={() => setShowAllAssistantExpenses(true)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "#1a73e8",
                                  textAlign: "left",
                                  padding: 0,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  textDecoration: "underline",
                                }}
                              >
                                + {expenseRows.length - 4} more... (View all)
                              </button>
                            )}
                            {!assistantLoadingLists && expenseRows.length > 4 && showAllAssistantExpenses && (
                              <button
                                type="button"
                                onClick={() => setShowAllAssistantExpenses(false)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "#1a73e8",
                                  textAlign: "left",
                                  padding: 0,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  textDecoration: "underline",
                                }}
                              >
                                Show less
                              </button>
                            )}
                          </div>
                        </div>

                        <div
                          className="action-item"
                          style={{ marginBottom: "12px", display: "block", width: "100%" }}
                        >
                          <strong style={{ fontSize: "13px" }}>
                            Teacher Salaries ({assistantSalaryRows.length})
                          </strong>
                          <div
                            style={{
                              marginTop: "6px",
                              maxHeight: showAllAssistantSalaries ? "220px" : "120px",
                              overflowY: "auto",
                              display: "grid",
                              gap: "8px",
                              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                            }}
                          >
                            {assistantLoadingLists && (
                              <div style={{ fontSize: "12px" }}>Loading salary list...</div>
                            )}
                            {!assistantLoadingLists &&
                              assistantVisibleSalaries.map((row, index) => (
                                <div
                                  key={`${row.teacher_name || row.teacher_id || "teacher"}-${index}`}
                                  style={{
                                    border: "1px solid #e6e6e6",
                                    borderRadius: "8px",
                                    padding: "8px",
                                    background: "#fafafa",
                                  }}
                                >
                                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#222" }}>
                                    {row.teacher_name || row.teacher_id || "Teacher"}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#333", marginTop: "2px" }}>
                                    {formatINR(row.final_salary || row.salary_amount || row.base_salary)}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
                                    {row.salary_month || row.payment_date || ""}
                                  </div>
                                </div>
                              ))}
                            {!assistantLoadingLists &&
                              assistantSalaryRows.length > 4 &&
                              !showAllAssistantSalaries && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllAssistantSalaries(true)}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#1a73e8",
                                    textAlign: "left",
                                    padding: 0,
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    textDecoration: "underline",
                                  }}
                                >
                                  + {assistantSalaryRows.length - 4} more... (View all)
                                </button>
                              )}
                            {!assistantLoadingLists &&
                              assistantSalaryRows.length > 4 &&
                              showAllAssistantSalaries && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllAssistantSalaries(false)}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#1a73e8",
                                    textAlign: "left",
                                    padding: 0,
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    textDecoration: "underline",
                                  }}
                                >
                                  Show less
                                </button>
                              )}
                          </div>
                        </div>

                        <div
                          className="action-item"
                          style={{ marginBottom: "12px", display: "block", width: "100%" }}
                        >
                          <strong style={{ fontSize: "13px" }}>
                            My Actions ({expenseActionPlans.length})
                          </strong>
                          <div
                            style={{
                              marginTop: "6px",
                              maxHeight: "180px",
                              overflowY: "auto",
                              display: "grid",
                              gap: "8px",
                              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                            }}
                          >
                            {expenseActionPlans.map((item) => (
                              <div
                                key={item.title}
                                style={{
                                  border: "1px solid #e6e6e6",
                                  borderRadius: "8px",
                                  padding: "8px",
                                  background: "#fafafa",
                                }}
                              >
                                <div style={{ fontSize: "12px", fontWeight: 600, color: "#222" }}>
                                  {item.title}
                                </div>
                                {item.detail && (
                                  <div style={{ fontSize: "11px", color: "#555", marginTop: "3px" }}>
                                    {item.detail}
                                  </div>
                                )}
                                {Array.isArray(item.procedure) && item.procedure.length > 0 && (
                                  <ol
                                    style={{
                                      margin: "6px 0 0 16px",
                                      padding: 0,
                                      fontSize: "11px",
                                      color: "#333",
                                    }}
                                  >
                                    {item.procedure.map((step, stepIndex) => (
                                      <li key={`${item.title}-${stepIndex}`} style={{ marginBottom: "2px" }}>
                                        {step}
                                      </li>
                                    ))}
                                  </ol>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                   
                      </div>
                    ) : activeRightPanel === "transactions" ? (
                      <div className="accountant-feetype-list">
                        {expenseRowsLoading ? (
                          <div className="accountant-assistant-empty">Loading expenses...</div>
                        ) : expenseRows.length ? (
                          expenseRows.map((item, index) => (
                            <div key={`${item.expense_name || item.description || "expense"}-${index}`} className="accountant-feetype-list-item">
                              <span>
                                O {item.expense_name || item.description || "Expense"} - {item.expense_type || "Type"} - Rs{" "}
                                {Number(item.price || item.amount || item.paid_amount || 0).toLocaleString("en-IN")}
                              </span>
                              {item.isUploadedBill && item.imageUrl ? (
                                <button
                                  type="button"
                                  className="accountant-feetype-edit"
                                  onClick={() => openImageModal(item.imageUrl)}
                                >
                                  View
                                </button>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="accountant-assistant-empty">No saved expense entries found.</div>
                        )}
                      </div>
                    ) : (
                      <div className="accountant-feetype-list">
                        {masterExpenseItems.length ? (
                          masterExpenseItems.map((item) => (
                            <div key={item.id} className="accountant-feetype-list-item">
                              <span>
                                O {item.expenseName} - {item.category}
                              </span>
                             
                            </div>
                          ))
                        ) : (
                          <div className="accountant-assistant-empty">No created expenses found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="accountant-fees-right-mini-row">
                  <div className="accountant-income-card accountant-card">
                    <div className="accountant-income-ring accountant-progress-ring">
                      <div className="accountant-progress-ring-inner">3%</div>
                    </div>
                    <div className="blockText">Income & Exp.</div>
                    <div className="normalText">Percentile Profit</div>
                  </div>

                  <div className="accountant-prevdue-card accountant-card">
                    <p className="accountant-prevdue-amount">₹0.00</p>
                    <div className="blockText">Previous Year Due</div>
                    <div className="normalText">Pending Dues for Yr. 2024-2025</div>
                  </div>
                </div>

                <div className="accountant-total-strip accountant-card">
                  <div className="accountant-total-strip-list">
                    {summaryCards.map((item) => (
                      <div key={item.label} className="accountant-total-strip-item">
                        <strong>{item.amount}</strong>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="accountant-total-strip-right">
                    <span>Total Due</span>
                    <h2>₹6,86,757.00</h2>
                    <p>Apr 2026</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="accountant-footer-brand">
        <span>Powered By:</span>
        <img src={logoab} alt="Cleezo Class" className="accountant-footer-logo" />
      </div>

      {isCreateExpensePopupOpen && (
        <div className="globalpopup-overlay" onClick={() => setIsCreateExpensePopupOpen(false)}>
          <div
            className="globalpopup-content accountant-create-fee-popup accountant-expense-category-popup"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="globalpopup-header accountant-create-fee-popup-header">
              <div className="accountant-create-fee-popup-heading">
                <span className="accountant-create-fee-kicker">Expense Master</span>
                <h3 className="accountant-create-fee-popup-title">Expense Category Manager</h3>
                <p className="accountant-create-fee-popup-subtitle">
                  Create a category and add expense names one by one.
                </p>
              </div>
              <button
                type="button"
                className="globalpopup-close-btn"
                onClick={() => setIsCreateExpensePopupOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="accountant-expense-master-embed">
              <CreateMasterExpenseForm />
            </div>
          </div>
        </div>
      )}

      {isAddExpensePopupOpen && (
        <div
          className="globalpopup-overlay"
          onClick={() => {
            setIsAddExpensePopupOpen(false);
            resetAddExpenseFlow();
          }}
        >
          <div
            className="globalpopup-content accountant-expense-transaction-popup"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="globalpopup-close-btn"
              onClick={() => {
                setIsAddExpensePopupOpen(false);
                resetAddExpenseFlow();
              }}
            >
              ×
            </button>

            <div className="accountant-expense-popup-body">
              <div className="accountant-expense-popup-panel">
                <div className="accountant-expense-popup-panel-actions">
                  <button type="button" className="accountant-expense-popup-action accountant-expense-popup-action-active">
                    Add Expense
                  </button>
                </div>

                {addExpenseStep === 1 ? (
                  <>
                    <div className="accountant-expense-popup-form">
                      <label className="accountant-create-fee-label">
                        Expense Type
                        <select
                          value={expenseTransactionForm.expenseType}
                          onChange={(event) =>
                            setExpenseTransactionForm((prev) => ({
                              ...prev,
                              expenseType: event.target.value,
                              expenseName: "",
                            }))
                          }
                        >
                          <option value="">-- Select Category --</option>
                          {Object.keys(combinedExpenseOptions).map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="accountant-create-fee-label">
                        Expense Name
                        <select
                          value={expenseTransactionForm.expenseName}
                          onChange={(event) =>
                            setExpenseTransactionForm((prev) => ({ ...prev, expenseName: event.target.value }))
                          }
                          disabled={!expenseTransactionForm.expenseType}
                        >
                          <option value="">-- Select Expense --</option>
                          {(combinedExpenseOptions[expenseTransactionForm.expenseType] || []).map((expenseName) => (
                            <option key={expenseName} value={expenseName}>
                              {expenseName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="accountant-create-fee-label">
                        Name (Optional)
                        <input
                          type="text"
                          value={expenseTransactionForm.personName}
                          onChange={(event) =>
                            setExpenseTransactionForm((prev) => ({ ...prev, personName: event.target.value }))
                          }
                          placeholder="Name"
                        />
                      </label>
                      <label className="accountant-create-fee-label">
                        Mobile Number (Optional)
                        <input
                          type="text"
                          value={expenseTransactionForm.mobileNumber}
                          onChange={(event) =>
                            setExpenseTransactionForm((prev) => ({ ...prev, mobileNumber: event.target.value }))
                          }
                          placeholder="Mobile Number"
                        />
                      </label>
                      <label className="accountant-create-fee-label">
                        Description
                        <textarea
                          value={expenseTransactionForm.description}
                          onChange={(event) =>
                            setExpenseTransactionForm((prev) => ({ ...prev, description: event.target.value }))
                          }
                          placeholder="Description"
                          rows={3}
                        />
                      </label>
                      <label className="accountant-create-fee-label">
                        Price (Optional)
                        <input
                          type="text"
                          value={expenseTransactionForm.price}
                          onChange={(event) =>
                            setExpenseTransactionForm((prev) => ({ ...prev, price: event.target.value }))
                          }
                          placeholder="Price"
                        />
                      </label>
                    </div>

                    <div className="accountant-expense-category-actions">
                      <button
                        type="button"
                        className="accountant-expense-popup-action"
                        onClick={() => {
                          setIsAddExpensePopupOpen(false);
                          resetAddExpenseFlow();
                        }}
                      >
                        Cancel
                      </button>
                      <button
  type="submit"
  className="btn-solid"
  disabled={!isFormValid}
  style={{
    opacity: isFormValid ? 1 : 0.5,
    cursor: isFormValid ? "pointer" : "not-allowed"
  }}
>
  Next: Add Payment
</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="accountant-expense-popup-form">
                      <label className="accountant-create-fee-label">
                        Expense Type
                        <input type="text" value={expenseTransactionForm.expenseType} readOnly />
                      </label>
                      <label className="accountant-create-fee-label">
                        Expense Name
                        <input type="text" value={expenseTransactionForm.expenseName} readOnly />
                      </label>
                      <label className="accountant-create-fee-label accountant-expense-span-two">
                        Description
                        <textarea value={expenseTransactionForm.description} readOnly rows={3} />
                      </label>
                      <label className="accountant-create-fee-label">
                        Payment Mode
                        <select
                          value={expensePaymentForm.paymentMode}
                          onChange={(event) =>
                            setExpensePaymentForm((prev) => ({ ...prev, paymentMode: event.target.value }))
                          }
                        >
                          <option value="BANK">BANK</option>
                          <option value="CASH">CASH</option>
                          <option value="UPI">UPI</option>
                          <option value="CHECK">CHECK</option>
                        </select>
                      </label>
                      <label className="accountant-create-fee-label">
                        Total Amount
                        <input
                          type="number"
                          value={expensePaymentForm.totalAmount}
                          onChange={(event) =>
                            setExpensePaymentForm((prev) => ({ ...prev, totalAmount: event.target.value }))
                          }
                          placeholder="Total Amount"
                        />
                      </label>
                      <label className="accountant-create-fee-label">
                        Paid
                        <input
                          type="number"
                          value={expensePaymentForm.paidAmount}
                          onChange={(event) =>
                            setExpensePaymentForm((prev) => ({ ...prev, paidAmount: event.target.value }))
                          }
                          placeholder="Paid Amount"
                        />
                      </label>
                      <label className="accountant-create-fee-label">
                        Balance
                        <input type="text" value={expensePaymentForm.balance} readOnly />
                      </label>
                    </div>

                    <div className="accountant-expense-category-actions">
                      <button
                        type="button"
                        className="accountant-expense-popup-action"
                        onClick={() => setAddExpenseStep(1)}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="accountant-expense-popup-action accountant-expense-popup-action-active"
                        onClick={handleSubmitExpense}
                        disabled={expenseSubmitLoading}
                      >
                        {expenseSubmitLoading ? "Submitting..." : "Submit Expense"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {isAddFeesPopupOpen && (
        <div
          className="globalpopup-overlay"
          onClick={() => {
            setIsAddFeesPopupOpen(false);
            setAddFeePreview({ className: "", section: "", rows: [] });
          }}
          style={{ zIndex: 3200 }}
        >
          <div
            className="globalpopup-content accountant-add-fee-popup"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "72vw", maxWidth: "980px", height: "74vh", overflow: "auto", marginRight: "0" }}
          >
            <div className="globalpopup-header">
              <div className="accountant-create-fee-popup-heading">
                <span className="accountant-create-fee-kicker">Add Fees</span>
              </div>
              <button
                type="button"
                className="globalpopup-close-btn"
                onClick={() => {
                  setIsAddFeesPopupOpen(false);
                  setAddFeePreview({ className: "", section: "", rows: [] });
                }}
              >
                ×
              </button>
            </div>
            <IncomeForm5
              selectedClassSection={{ class: "", section: "" }}
              onFeeStructurePreviewChange={setAddFeePreview}
              embeddedInPopup
            />
          </div>
        </div>
      )}
      {isStudentManagementPopupOpen && (
        <div
          className="globalpopup-overlay accountant-student-management-popup-overlay"
          onClick={() => setIsStudentManagementPopupOpen(false)}
          style={{ zIndex: 3200 }}
        >
          <div
            className="globalpopup-content accountant-student-management-popup"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="globalpopup-header accountant-student-management-popup-header">
              <div>
                <div className="Heading">Add Student</div>
                <div className="normalText">Open the student form inside a popup</div>
              </div>
              <button
                type="button"
                className="globalpopup-close-btn accountant-student-management-close-btn"
                onClick={() => setIsStudentManagementPopupOpen(false)}
                aria-label="Close add student popup"
              >
                ×
              </button>
            </div>
            <div className="accountant-student-management-popup-body">
              <iframe
                title="Student Management Add Popup"
                src={studentManagementPopupUrl}
                className="accountant-student-management-iframe"
              />
            </div>
          </div>
        </div>
      )}
      <ErrorPopup
        message={popup.message}
        type={popup.type}
        onClose={() => setPopup({ message: "", type: "" })}
      />
    </div>
  );
};

export default AccountantExpensesPageNew;