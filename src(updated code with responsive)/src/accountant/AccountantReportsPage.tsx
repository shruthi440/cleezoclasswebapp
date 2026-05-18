import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "./AccountantDashboardnew.css";
import "./AccountantReportsPage.css";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";

import collectFeeIcon from "../assets/collect.png";
import addFeeIcon from "../assets/Navbar-AddFee.png";
import expenseIcon from "../assets/Navbar-Expenses.png";
import reportIcon from "../assets/Reports.png";
import dashboardIcon from "../assets/Dashboard.png";
import addStudentIcon from "../assets/Enrollment.png";
import logoab from "../assets/logoab.png";
import IncomeForm5 from "../shared/IncomeformTwo.jsx";

import transactionsIcon from "../assets/Communications.png";
import campaignAutomatedIcon from "../assets/Campaign_Automated.png";
import campaignDigitalIcon from "../assets/Campaign_Digital.png";
import campaignStaffIcon from "../assets/Campaign_Staff.png";
import timelineIcon from "../assets/Timeline.png";
import feesSearchIcon from "../assets/user (1).png";

type ReportView = "main" | "ledger" | "previous" | "complete" | "bus" | "studentTransactions" | "paid" | "unpaid";
type ReportRow = Record<string, any>;

type Filters = {
  studentName: string;
  className: string;
  section: string;
  year: string;
  fromDate: string;
  toDate: string;
};

const API_BASE_URL = "https://cleezoclass.com:4000";

const getCurrentFinancialYear = () => {
  const now = new Date();
  const startYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
};

const getAny = (row: ReportRow, keys: string[], fallback: any = "") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
};

const toAmount = (value: any) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "object" && typeof value.toString === "function") {
    return toAmount(value.toString());
  }
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePreviousItem = (row: ReportRow) => ({
  ...row,
  StudentName: getAny(row, ["StudentName", "student_name", "studentName"], ""),
  Class_name: getAny(row, ["Class_name", "class_name", "className"], ""),
  section: getAny(row, ["section", "Section"], ""),
  Previous_Fee_Due: toAmount(
    getAny(row, ["Previous_Fee_Due", "Previous_Pending", "previous_due", "previousDue", "previous_fee_due"])
  ),
  Previous_Paid: toAmount(
    getAny(row, ["Previous_Paid", "previous_paid", "previousPaid", "previous_paid_amount"])
  ),
  Due: Math.max(
    toAmount(
      getAny(row, ["Previous_Fee_Due", "Previous_Pending", "previous_due", "previousDue", "previous_fee_due"])
    ) - toAmount(getAny(row, ["Previous_Paid", "previous_paid", "previousPaid", "previous_paid_amount"])),
    0
  ),
  Payment_Date: getAny(row, ["Payment_Date", "paidDate", "record_date", "created_at"], ""),
});

const normalizeCompleteItem = (row: ReportRow) => {
  const completeFee = toAmount(
    getAny(row, ["CompleteFee", "completeFee", "UpdatedCompleteFee", "Final_Amount", "complete_fee", "TOTAL_FEE"])
  );
  const admissionFee = toAmount(getAny(row, ["Admission_fees", "admission_fees"]));
  const booksFee = toAmount(getAny(row, ["StudentBooksFee", "Book_Fees", "booksFee", "book_fees"]));
  const uniformFee = toAmount(getAny(row, ["Uniform_fees", "uniform_fees"]));
  const examFee = toAmount(getAny(row, ["StudentExamFee", "Exam_fees", "examFee", "exam_fees"]));
  const busFee = toAmount(getAny(row, ["BusFee", "Bus_fees", "busFee", "bus_fees"]));
  const otherFee = toAmount(getAny(row, ["OtherFee", "Others", "otherFee", "others"]));
  const explicitTuitionFee = toAmount(getAny(row, ["TuitionFee", "tuitionFee"]));
  const derivedTuitionFee = Math.max(completeFee - (admissionFee + booksFee + uniformFee + examFee + busFee + otherFee), 0);

  return {
    ...row,
    StudentName: getAny(row, ["StudentName", "student_name", "studentName"], ""),
    Class_name: getAny(row, ["Class_name", "class_name", "className"], ""),
    section: getAny(row, ["section", "Section"], ""),
    CompleteFee: completeFee,
    TuitionFee: explicitTuitionFee > 0 ? explicitTuitionFee : derivedTuitionFee,
    TuitionPaid: toAmount(getAny(row, ["TuitionPaid", "Paid_Amount", "paid_amount"])),
    StudentBooksFee: booksFee,
    StudentExamFee: examFee,
    BusFee: busFee,
    PreviousDue: toAmount(getAny(row, ["PreviousDue", "Previous_Fee_Due", "previousDue", "previous_fee_due"])),
    ResidentialCompleteFee: toAmount(
      getAny(row, ["ResidentialCompleteFee", "residentialCompleteFee", "residential_complete_fee"])
    ),
    OtherFee: otherFee,
  };
};

const normalizeUnpaidItem = (row: ReportRow) => ({
  ...row,
  StudentName: getAny(row, ["StudentName", "student_name", "studentName"], ""),
  Class_name: getAny(row, ["Class_name", "class_name", "className"], ""),
  section: getAny(row, ["section", "Section"], ""),
  unpaidAmount: toAmount(getAny(row, ["unpaidAmount", "Due", "due", "Pending", "pending"])),
  paidDate: getAny(row, ["paidDate", "paid_date", "Payment_Date", "created_at"], ""),
});

const getFinancialYearFromDate = (rawDate: any) => {
  if (!rawDate) return "";
  const dt = new Date(rawDate);
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const formatMoney = (value: any) =>
  toAmount(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value: any) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB");
};

const getDefaultMonthRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  return { firstDay, lastDay };
};

const reportCards = [
  { key: "ledger", title: "Ledger", subtitle: "Today Ledger", icon: timelineIcon },
  { key: "previous", title: "Previous Due", subtitle: "Pending Report", icon: reportIcon },
  { key: "complete", title: "Complete Fee", subtitle: "Summary Report", icon: campaignAutomatedIcon },
  { key: "bus", title: "Bus/Residential", subtitle: "Payment Report", icon: campaignStaffIcon },
  { key: "paid", title: "Paid", subtitle: "Collection Report", icon: transactionsIcon },
  { key: "main", title: "Unpaid", subtitle: "Due Report", icon: transactionsIcon },
  { key: "studentTransactions", title: "Transactions", subtitle: "Student Report", icon: transactionsIcon },
] as const;

const STATIC_TRANSACTION_PAID_KEYS = new Set([
  "paid_amount",
  "admission_paid",
  "books_paid",
  "uniform_paid",
  "exam_paid",
  "bus_paid",
  "others_paid",
  "previous_paid",
  "books_uniform_paid",
]);

const STATIC_FEE_BASE_KEYS = new Set([
  "tuition",
  "admission",
  "book",
  "books",
  "uniform",
  "exam",
  "bus",
  "other",
  "others",
  "residential",
  "previous",
  "saving",
  "savings",
]);

const NON_FEE_REPORT_KEYS = new Set([
  "studentname",
  "student_name",
  "class_name",
  "classname",
  "class",
  "section",
  "completefee",
  "updatedcompletefee",
  "final_amount",
  "total_fee",
  "total_expected",
  "tuitionfee",
  "tuitionpaid",
  "studentbooksfee",
  "studentexamfee",
  "busfee",
  "otherfee",
  "previousdue",
  "previous_fee_due",
  "previous_paid",
  "residentialcompletefee",
  "res_inst_1",
  "paid_amount",
  "paiddate",
  "payment_date",
  "record_date",
  "receipt_date",
  "created_at",
  "paymentmode",
  "transaction_id",
  "receiptnumber",
  "academic_year",
  "fee_type",
  "remarks",
  "amount_paid",
  "due",
  "pending",
  "unpaidamount",
]);

const formatHeaderLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getDynamicTransactionPaidKeys = (rows: ReportRow[]) => {
  const keys = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      const normalizedKey = String(key || "").trim();
      const lowerKey = normalizedKey.toLowerCase();

      if (!lowerKey.endsWith("_paid")) return;
      if (STATIC_TRANSACTION_PAID_KEYS.has(lowerKey)) return;
      if (toAmount(row?.[normalizedKey]) <= 0) return;

      keys.add(normalizedKey);
    });
  });

  return Array.from(keys).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
};

const getDynamicTransactionPaidLabel = (key: string) => {
  const withoutSuffix = key.replace(/_paid$/i, "");
  return `${formatHeaderLabel(withoutSuffix)} Paid`;
};

const normalizeFeeBaseKey = (key: string) =>
  String(key || "")
    .trim()
    .toLowerCase()
    .replace(/_fees?$/i, "")
    .replace(/_fee$/i, "")
    .replace(/_amount$/i, "")
    .replace(/_paid$/i, "")
    .replace(/_due$/i, "");

const getDynamicFeeBases = (rows: ReportRow[]) => {
  const bases = new Set<string>();

  rows.forEach((row) => {
    Object.entries(row || {}).forEach(([key, value]) => {
      const trimmedKey = String(key || "").trim();
      const lowerKey = trimmedKey.toLowerCase();
      if (!trimmedKey) return;
      if (NON_FEE_REPORT_KEYS.has(lowerKey)) return;
      if (toAmount(value) <= 0) return;

      const baseKey = normalizeFeeBaseKey(trimmedKey);
      if (!baseKey) return;
      if (STATIC_FEE_BASE_KEYS.has(baseKey)) return;
      if (NON_FEE_REPORT_KEYS.has(baseKey)) return;

      bases.add(baseKey);
    });
  });

  return Array.from(bases).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
};

const getDynamicFeeValue = (row: ReportRow, baseKey: string) =>
  toAmount(
    getAny(row, [baseKey, `${baseKey}_fee`, `${baseKey}_fees`, `${baseKey}_amount`, baseKey.toUpperCase()], 0)
  );

const getDynamicPaidValue = (row: ReportRow, baseKey: string) =>
  toAmount(getAny(row, [`${baseKey}_paid`, `${baseKey}_fee_paid`, `${baseKey.toUpperCase()}_PAID`], 0));

const hasAnyAmount = (rows: ReportRow[], getter: (row: ReportRow) => any) =>
  rows.some((row) => toAmount(getter(row)) > 0);

const AccountantReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const currentFinancialYear = getCurrentFinancialYear();
  const currentFyStart = Number(currentFinancialYear.split("-")[0]);
  const { firstDay, lastDay } = getDefaultMonthRange();
  const [instituteName, setInstituteName] = useState("Institute");
  const [instituteLogo, setInstituteLogo] = useState("/default-logo.png");

  const [filters, setFilters] = useState<Filters>({
    studentName: "",
    className: "All",
    section: "All",
    year: currentFinancialYear,
    fromDate: firstDay,
    toDate: lastDay,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [activeView, setActiveView] = useState<ReportView>("main");

  const [classList, setClassList] = useState<any[]>([]);
  const [sectionMap, setSectionMap] = useState<any[]>([]);
  const [filteredSections, setFilteredSections] = useState<string[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);

  const [ledgerData, setLedgerData] = useState<ReportRow[]>([]);
  const [previousData, setPreviousData] = useState<ReportRow[]>([]);
  const [busData, setBusData] = useState<ReportRow[]>([]);
  const [completeFeeData, setCompleteFeeData] = useState<ReportRow[]>([]);
  const [studentTransactions, setStudentTransactions] = useState<ReportRow[]>([]);
  const [mainData, setMainData] = useState<ReportRow[]>([]);
  const [paidListData, setPaidListData] = useState<ReportRow[]>([]);
  const [unpaidListData, setUnpaidListData] = useState<ReportRow[]>([]);

  const [mainLoading, setMainLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [extraLoading, setExtraLoading] = useState(false);
  const [studentTransactionsLoading, setStudentTransactionsLoading] = useState(false);
  const [loadingCardKey, setLoadingCardKey] = useState<ReportView | "">("");
  const [summaryDue, setSummaryDue] = useState(0);
  const [summaryDueLoading, setSummaryDueLoading] = useState(false);
  const [summaryPreviousDue, setSummaryPreviousDue] = useState(0);
  const [summaryPreviousPaid, setSummaryPreviousPaid] = useState(0);
  const [isAddFeesPopupOpen, setIsAddFeesPopupOpen] = useState(false);
  const [addFeePreview, setAddFeePreview] = useState({
    className: "",
    section: "",
    rows: [] as ReportRow[],
  });

  const rowsPerPage = 18;
  const studentTransactionsQueryRef = useRef("");

  useEffect(() => {
    const schoolCode = String(localStorage.getItem("schoolCode") || "").trim();
    if (!schoolCode) return;

    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${encodeURIComponent(schoolCode)}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        setInstituteLogo(data.logo || "/default-logo.png");
        setInstituteName(data.institute_name || data.schoolName || data.name || schoolCode || "Institute");
      })
      .catch(() => {
        setInstituteLogo("/default-logo.png");
        setInstituteName(schoolCode || "Institute");
      });
  }, []);

  const getFilterDateForRow = useCallback(
    (row: ReportRow) => {
      if (activeView === "studentTransactions" || activeView === "paid" || activeView === "unpaid") {
        return row?.record_date || row?.paidDate || row?.paid_date || row?.Payment_Date || row?.created_at || "";
      }
      return row?.record_date || row?.paidDate || row?.Payment_Date || row?.Bus_Payment_Date || row?.paid_date || row?.created_at;
    },
    [activeView]
  );

  const getRowYear = useCallback(
    (row: ReportRow) => getFinancialYearFromDate(getFilterDateForRow(row)),
    [getFilterDateForRow]
  );

  const yearOptions = useMemo(() => {
    const sources = [mainData, ledgerData, previousData, busData, completeFeeData, studentTransactions, paidListData, unpaidListData];
    const years = new Set<string>();
    sources.forEach((list) => {
      list.forEach((row) => {
        const year = getRowYear(row);
        if (year) years.add(year);
      });
    });
    years.add(currentFinancialYear);
    years.add(`${currentFyStart - 1}-${currentFyStart}`);
    years.add(`${currentFyStart - 2}-${currentFyStart - 1}`);
    return Array.from(years).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [busData, completeFeeData, currentFinancialYear, currentFyStart, getRowYear, ledgerData, mainData, paidListData, previousData, studentTransactions, unpaidListData]);

  const isPreviousFinancialYearSelected = useMemo(() => {
    const selectedYear = String(filters.year || "").trim();
    if (!selectedYear || selectedYear === "All") return false;
    if (!/^\d{4}\s*-\s*\d{4}$/.test(selectedYear)) return false;
    const [, end] = selectedYear.split("-").map((part) => Number(part.trim()));
    return end < currentFyStart + 1;
  }, [currentFyStart, filters.year]);

  const fetchMetadata = useCallback(async () => {
    setDropdownLoading(true);
    const schoolCode = localStorage.getItem("schoolCode") || "TAGSOLNOVALLP";
    try {
      const [classRes, sectionRes] = await Promise.all([
        axios.get(`https://cleezoclass.com:4000/api/admin/classes?schoolCode=${schoolCode}`),
        axios.get(`https://cleezoclass.com:4000/api/admin/sectionFilter?schoolCode=${schoolCode}`),
      ]);

      const classesArray = Array.isArray(classRes.data) ? classRes.data : [];
      const sectionsArray = Array.isArray(sectionRes.data) ? sectionRes.data : [];
      const allSections = [...new Set(sectionsArray.map((item: any) => String(item?.section || item || "").trim()).filter(Boolean))];

      setClassList(classesArray);
      setSectionMap(sectionsArray);
      setFilteredSections(allSections.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
    } catch (error) {
      console.error("Failed to load report filters:", error);
      setClassList([]);
      setSectionMap([]);
      setFilteredSections([]);
    } finally {
      setDropdownLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    if (!filters.className || filters.className === "All") {
      const allSections = [...new Set(sectionMap.map((item: any) => String(item?.section || item || "").trim()).filter(Boolean))];
      setFilteredSections(allSections.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
      return;
    }

    const nextSections = sectionMap
      .filter((item: any) => String(item?.class_name) === String(filters.className))
      .map((item: any) => String(item?.section || "").trim())
      .filter(Boolean);

    setFilteredSections([...new Set(nextSections)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
    setFilters((prev) => (prev.section === "All" ? prev : { ...prev, section: "All" }));
  }, [filters.className, sectionMap]);

  const fetchSummaryDue = useCallback(async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    setSummaryDueLoading(true);
    try {
      const selectedYear = String(filters.year || "").replace(/\s+/g, "");
      if (selectedYear === "2024-2025") {
        const params = new URLSearchParams({ schoolCode, type: "PreviousPaidPendingReport" });
        const response = await axios.get(`https://cleezoclass.com:4000/api/fee-records-alldata?${params.toString()}`);
        const rows = (Array.isArray(response.data) ? response.data : response.data?.data || []).map(normalizePreviousItem);
        const filteredRows = rows.filter((row: ReportRow) => {
          if (filters.className !== "All" && String(row.Class_name) !== String(filters.className)) return false;
          if (filters.section !== "All" && String(row.section) !== String(filters.section)) return false;
          return true;
        });

        setSummaryDue(filteredRows.reduce((sum: number, row: ReportRow) => sum + toAmount(row.Previous_Fee_Due), 0));
        setSummaryPreviousDue(filteredRows.reduce((sum: number, row: ReportRow) => sum + toAmount(row.Previous_Fee_Due), 0));
        setSummaryPreviousPaid(filteredRows.reduce((sum: number, row: ReportRow) => sum + toAmount(row.Previous_Paid), 0));
        return;
      }

      const params = new URLSearchParams({
        schoolCode,
        year: filters.year || "All",
        className: filters.className || "All",
        section: filters.section || "All",
      });
      const response = await axios.get(`https://cleezoclass.com:4000/api/fees-summary-ledgerData?${params.toString()}`);
      setSummaryDue(Number(response?.data?.balance) || 0);
      setSummaryPreviousDue(Number(response?.data?.previousDueTotal) || 0);
      setSummaryPreviousPaid(Number(response?.data?.previousPaidTotal) || 0);
    } catch (error) {
      console.error("Failed to fetch summary due:", error);
      setSummaryDue(0);
      setSummaryPreviousDue(0);
      setSummaryPreviousPaid(0);
    } finally {
      setSummaryDueLoading(false);
    }
  }, [filters.className, filters.section, filters.year]);

  useEffect(() => {
    fetchSummaryDue();
  }, [fetchSummaryDue]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const getStudentTransactionsQueryKey = useCallback(
    (nextFilters: Filters) =>
      JSON.stringify({
        studentName: nextFilters.studentName || "",
        className: nextFilters.className || "All",
        section: nextFilters.section || "All",
      }),
    []
  );

  const handleTodayLedger = async () => {
    setLoadingCardKey("ledger");
    setLedgerLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) throw new Error("School code missing");

      const params = new URLSearchParams({ schoolCode, type: "today" });
      const response = await axios.get(`https://cleezoclass.com:4000/api/ledger?${params.toString()}`);
      const rawLedger = Array.isArray(response.data.data) ? response.data.data : [];

      const getReceiptNumber = (value: any) => {
        const digits = String(value || "").match(/\d+/g);
        return digits ? Number(digits.join("")) || 0 : 0;
      };

      const sortedLedger = [...rawLedger].sort((a, b) => {
        const byReceipt = getReceiptNumber(a.receiptNumber) - getReceiptNumber(b.receiptNumber);
        if (byReceipt !== 0) return byReceipt;
        return new Date(a.paid_date || a.paidDate || a.created_at || 0).getTime() - new Date(b.paid_date || b.paidDate || b.created_at || 0).getTime();
      });

      const mergedMap = new Map<string, ReportRow>();
      sortedLedger.forEach((row) => {
        const key = `${row.receiptNumber || ""}__${row.StudentName || ""}__${row.Class_name || ""}__${row.section || ""}__${row.paid_date || row.paidDate || row.created_at || ""}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, {
            ...row,
            amount_paid: Number(row.amount_paid || 0),
            fee_type: row.fee_type ? [row.fee_type] : [],
          });
          return;
        }
        const existing = mergedMap.get(key)!;
        existing.amount_paid = Number(existing.amount_paid || 0) + Number(row.amount_paid || 0);
        if (row.fee_type) {
          const feeTypes = new Set(existing.fee_type);
          feeTypes.add(row.fee_type);
          existing.fee_type = Array.from(feeTypes);
        }
      });

      setLedgerData(
        Array.from(mergedMap.values()).map((row) => ({
          ...row,
          fee_type: Array.isArray(row.fee_type) ? row.fee_type.join(", ") : row.fee_type,
        }))
      );
      setActiveView("ledger");
    } catch (error) {
      console.error(error);
      alert("Failed to fetch today's ledger");
    } finally {
      setLedgerLoading(false);
      setLoadingCardKey("");
    }
  };

  const handleMainDueReport = useCallback(async () => {
    setLoadingCardKey("main");
    setMainLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) throw new Error("School code missing");
      const fromDate = filters.fromDate || firstDay;
      const toDate = filters.toDate || lastDay;

      const params = new URLSearchParams({
        type: "AllFeesStatusReport",
        fromDate,
        toDate,
        schoolCode,
      });

      const response = await axios.get(`${API_BASE_URL}/api/fee-records?${params.toString()}`);
      const result = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setMainData(result);
      setActiveView("main");
    } catch (error) {
      console.error(error);
      alert("Failed to fetch unpaid due report");
    } finally {
      setMainLoading(false);
      setLoadingCardKey("");
    }
  }, [filters.fromDate, filters.toDate, firstDay, lastDay]);

  const handlePreviousReport = async () => {
    setLoadingCardKey("previous");
    setExtraLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) throw new Error("School code missing");
      const params = new URLSearchParams({ schoolCode, type: "PreviousPaidPendingReport" });
      const response = await axios.get(`https://cleezoclass.com:4000/api/fee-records-alldata?${params.toString()}`);
      const rows = (Array.isArray(response.data) ? response.data : response.data.data || []).map(normalizePreviousItem);

      const groupedMap = new Map<string, ReportRow>();
      rows.forEach((row: ReportRow) => {
        const key = `${row.StudentName || ""}__${row.Class_name || ""}__${row.section || ""}`;
        const existing = groupedMap.get(key) || {
          StudentName: row.StudentName || "",
          Class_name: row.Class_name || "",
          section: row.section || "",
          Previous_Fee_Due: 0,
          Previous_Paid: 0,
          Payment_Date: "",
        };

        existing.Previous_Fee_Due += toAmount(row.Previous_Fee_Due);
        existing.Previous_Paid += toAmount(row.Previous_Paid);

        const currentDate = row.Payment_Date ? new Date(row.Payment_Date).getTime() : 0;
        const existingDate = existing.Payment_Date ? new Date(existing.Payment_Date).getTime() : 0;
        if (currentDate > existingDate) existing.Payment_Date = row.Payment_Date || existing.Payment_Date;

        groupedMap.set(key, existing);
      });

      setPreviousData(
        Array.from(groupedMap.values())
          .map((row) => ({ ...row, Due: Math.max(toAmount(row.Previous_Fee_Due) - toAmount(row.Previous_Paid), 0) }))
          .filter((row) => row.Due > 0)
      );
      setActiveView("previous");
    } catch (error) {
      console.error(error);
      alert("Failed to fetch previous report");
    } finally {
      setExtraLoading(false);
      setLoadingCardKey("");
    }
  };

  const handleCompleteFeeReport = async () => {
    setLoadingCardKey("complete");
    setExtraLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) throw new Error("School code missing");
      const params = new URLSearchParams({ schoolCode, type: "CompleteFeeSummaryReport" });
      const response = await axios.get(`https://cleezoclass.com:4000/api/fee-records-alldata?${params.toString()}`);
      const rows = (Array.isArray(response.data) ? response.data : response.data.data || []).map(normalizeCompleteItem);
      setCompleteFeeData(rows);
      setActiveView("complete");
    } catch (error) {
      console.error(error);
      alert("Failed to fetch complete fee report");
    } finally {
      setExtraLoading(false);
      setLoadingCardKey("");
    }
  };

  const handleBusReport = async () => {
    setLoadingCardKey("bus");
    setExtraLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) throw new Error("School code missing");
      const params = new URLSearchParams({ schoolCode, type: "BusFeePaymentReport" });
      const response = await axios.get(`https://cleezoclass.com:4000/api/fee-records-alldata?${params.toString()}`);
      const result = Array.isArray(response.data) ? response.data : response.data.data || [];

      const groupedMap = new Map<string, ReportRow>();
      result.forEach((row: ReportRow) => {
        const key = `${row?.StudentName || ""}__${row?.Class_name || ""}__${row?.section || ""}`;
        const existing = groupedMap.get(key) || {
          StudentName: row?.StudentName || "",
          Class_name: row?.Class_name || "",
          section: row?.section || "",
          Bus_Fee: 0,
          Bus_Paid: 0,
          Bus_Pending: 0,
          Residential_Amount: 0,
          Residential_Paid: 0,
          Residential_Due: 0,
          Bus_Payment_Date: "",
        };

        existing.Bus_Fee = Math.max(existing.Bus_Fee, toAmount(row?.Bus_Fee));
        existing.Residential_Amount = Math.max(existing.Residential_Amount, toAmount(row?.Residential_Amount));
        existing.Bus_Paid += toAmount(row?.Bus_Paid);
        existing.Residential_Paid += toAmount(row?.Residential_Paid);

        const currentDate = row?.Bus_Payment_Date ? new Date(row.Bus_Payment_Date).getTime() : 0;
        const existingDate = existing.Bus_Payment_Date ? new Date(existing.Bus_Payment_Date).getTime() : 0;
        if (currentDate > existingDate) existing.Bus_Payment_Date = row.Bus_Payment_Date;

        groupedMap.set(key, existing);
      });

      setBusData(
        Array.from(groupedMap.values()).map((row) => ({
          ...row,
          Bus_Pending: Math.max(toAmount(row.Bus_Fee) - toAmount(row.Bus_Paid), 0),
          Residential_Due: Math.max(toAmount(row.Residential_Amount) - toAmount(row.Residential_Paid), 0),
        }))
      );
      setActiveView("bus");
    } catch (error) {
      console.error(error);
      alert("Failed to fetch bus report");
    } finally {
      setExtraLoading(false);
      setLoadingCardKey("");
    }
  };

  const handleStudentTransactions = useCallback(async () => {
    setLoadingCardKey("studentTransactions");
    setStudentTransactionsLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) throw new Error("School code missing");

      const className = filters.className === "All" ? "" : filters.className || "";
      const section = filters.section === "All" ? "" : filters.section || "";
      const studentName = filters.studentName || "";

      const queryParams = {
        schoolCode,
        studentName,
        className,
        section,
      };

      const parseRows = (payload: any): ReportRow[] => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.rows)) return payload.rows;
        return [];
      };

      let result: ReportRow[] = [];
      try {
        const response = await axios.get("https://cleezoclass.com:4000/api/student-transactions", {
          params: queryParams,
        });
        result = parseRows(response.data);
      } catch (primaryError) {
        console.warn("Primary student-transactions endpoint failed, trying dynamic fallback:", primaryError);
        const fallbackResponse = await axios.get("https://cleezoclass.com:4000/api/student-transactions-dynamic", {
          params: queryParams,
        });
        result = parseRows(fallbackResponse.data);
      }

      const groupedMap = new Map<string, ReportRow>();
      result.forEach((row: ReportRow) => {
        const student = row?.StudentName || "";
        const className = row?.Class_name || "";
        const section = row?.section || "";
        const key = `${student}__${className}__${section}`;

        const existing = groupedMap.get(key) || {
          ...row,
          Paid_Amount: 0,
          Admission_paid: 0,
          books_paid: 0,
          uniform_paid: 0,
          exam_paid: 0,
          bus_paid: 0,
          others_paid: 0,
          RES_INST_1: 0,
          Previous_Fee_Due: 0,
          Previous_Paid: 0,
          paidDate: "",
          paymentMode: "",
          transaction_id: "",
          receiptNumber: "",
        };

        existing.CompleteFee = Math.max(Number(existing.CompleteFee) || 0, Number(row.CompleteFee) || 0);
        existing.Admission_fees = Math.max(Number(existing.Admission_fees) || 0, Number(row.Admission_fees) || 0);
        existing.Book_Fees = Math.max(Number(existing.Book_Fees) || 0, Number(row.Book_Fees) || 0);
        existing.Uniform_fees = Math.max(Number(existing.Uniform_fees) || 0, Number(row.Uniform_fees) || 0);
        existing.Exam_fees = Math.max(Number(existing.Exam_fees) || 0, Number(row.Exam_fees) || 0);
        existing.Bus_fees = Math.max(Number(existing.Bus_fees) || 0, Number(row.Bus_fees) || 0);
        existing.Others = Math.max(Number(existing.Others) || 0, Number(row.Others) || 0);
        existing.ResidentialCompleteFee = Math.max(
          Number(existing.ResidentialCompleteFee) || 0,
          Number(row.ResidentialCompleteFee) || 0
        );

        existing.Paid_Amount += Number(row.Paid_Amount) || 0;
        existing.Admission_paid += Number(row.Admission_paid) || 0;
        existing.books_paid += Number(row.books_paid) || 0;
        existing.uniform_paid += Number(row.uniform_paid) || 0;
        existing.exam_paid += Number(row.exam_paid) || 0;
        existing.bus_paid += Number(row.bus_paid) || 0;
        existing.others_paid += Number(row.others_paid) || 0;
        existing.RES_INST_1 += Number(row.RES_INST_1) || 0;
        existing.Previous_Fee_Due += Number(row.Previous_Fee_Due ?? row.PreviousDue) || 0;
        existing.Previous_Paid += Number(row.Previous_Paid) || 0;

        Object.entries(row || {}).forEach(([key, value]) => {
          const normalizedKey = String(key || "").trim();
          const lowerKey = normalizedKey.toLowerCase();

          if (!lowerKey.endsWith("_paid")) return;
          if (STATIC_TRANSACTION_PAID_KEYS.has(lowerKey)) return;

          existing[normalizedKey] = toAmount(existing[normalizedKey]) + toAmount(value);
        });

        const currentDate = row?.paidDate ? new Date(row.paidDate).getTime() : 0;
        const existingDate = existing.paidDate ? new Date(existing.paidDate).getTime() : 0;
        if (currentDate > existingDate) {
          existing.paidDate = row.paidDate || existing.paidDate;
        }

        groupedMap.set(key, existing);
      });

      setStudentTransactions(Array.from(groupedMap.values()));
      setActiveView("studentTransactions");
      studentTransactionsQueryRef.current = getStudentTransactionsQueryKey(filters);
    } catch (error) {
      console.error(error);
      studentTransactionsQueryRef.current = "";
      alert("Failed to fetch student transactions");
    } finally {
      setStudentTransactionsLoading(false);
      setLoadingCardKey("");
    }
  }, [filters, getStudentTransactionsQueryKey]);

  const handlePaidListReport = useCallback(async () => {
    setLoadingCardKey("paid");
    setMainLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) throw new Error("School code missing");
      const fromDate = filters.fromDate || firstDay;
      const toDate = filters.toDate || lastDay;

      const params = new URLSearchParams({
        type: "TotalPaidList",
        fromDate,
        toDate,
        schoolCode,
      });

      const response = await axios.get(`${API_BASE_URL}/api/fee-records?${params.toString()}`);
      const result = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setPaidListData(result);
      setActiveView("paid");
    } catch (error) {
      console.error(error);
      alert("Failed to fetch paid list");
    } finally {
      setMainLoading(false);
      setLoadingCardKey("");
    }
  }, [filters.fromDate, filters.toDate, firstDay, lastDay]);

  const handleUnpaidListReport = useCallback(async () => {
    setLoadingCardKey("unpaid");
    setExtraLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) throw new Error("School code missing");

      const params = new URLSearchParams({
        schoolCode,
        fromDate: filters.fromDate || "",
        toDate: filters.toDate || "",
        className: filters.className || "All",
        section: filters.section || "All",
      });

      const response = await axios.get(`https://cleezoclass.com:4000/api/unpaid-list?${params.toString()}`);
      const result = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setUnpaidListData(result.map(normalizeUnpaidItem));
      setActiveView("unpaid");
    } catch (error) {
      console.error(error);
      alert("Failed to fetch unpaid list");
    } finally {
      setExtraLoading(false);
      setLoadingCardKey("");
    }
  }, [filters.className, filters.fromDate, filters.section, filters.toDate]);

  useEffect(() => {
    if (activeView !== "studentTransactions") return;
    const nextKey = getStudentTransactionsQueryKey(filters);
    if (studentTransactionsQueryRef.current === nextKey) return;

    const timeoutId = window.setTimeout(() => {
      handleStudentTransactions();
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [activeView, filters, getStudentTransactionsQueryKey, handleStudentTransactions]);

  const applyFilters = useCallback(
    (rows: ReportRow[]) =>
      rows.filter((row) => {
        const studentName = String(getAny(row, ["StudentName", "student_name", "studentName"], "")).toLowerCase();
        const className = String(getAny(row, ["Class_name", "class_name", "className"], ""));
        const sectionName = String(getAny(row, ["section", "Section"], ""));
        if (!studentName) return false;
        if (filters.studentName && !studentName.includes(filters.studentName.toLowerCase())) return false;
        if (filters.className !== "All" && className !== String(filters.className)) return false;
        if (filters.section !== "All" && sectionName !== String(filters.section)) return false;

        if (filters.year !== "All") {
          const rowYear = getRowYear(row);
          if (rowYear && rowYear !== filters.year) return false;
        }

        const rowDate = getFilterDateForRow(row);
        if (filters.fromDate && rowDate && new Date(rowDate) < new Date(filters.fromDate)) return false;
        if (filters.toDate && rowDate && new Date(rowDate) > new Date(filters.toDate)) return false;
        return true;
      }),
    [filters, getFilterDateForRow, getRowYear]
  );

  const activeRows = useMemo(() => {
    switch (activeView) {
      case "main":
        return applyFilters(mainData);
      case "ledger":
        return applyFilters(ledgerData);
      case "previous":
        return applyFilters(previousData);
      case "complete":
        return applyFilters(completeFeeData);
      case "bus":
        return applyFilters(busData);
      case "studentTransactions":
        return applyFilters(studentTransactions);
      case "paid":
        return applyFilters(paidListData);
      case "unpaid":
        return applyFilters(unpaidListData);
      default:
        return [];
    }
  }, [activeView, applyFilters, busData, completeFeeData, ledgerData, mainData, paidListData, previousData, studentTransactions, unpaidListData]);

  const totalPages = Math.max(1, Math.ceil(activeRows.length / rowsPerPage));
  const paginatedRows = activeRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const dynamicTransactionPaidKeys = useMemo(
    () => (activeView === "studentTransactions" ? getDynamicTransactionPaidKeys(activeRows) : []),
    [activeRows, activeView]
  );
  const dynamicCompleteFeeBases = useMemo(
    () => (activeView === "complete" ? getDynamicFeeBases(activeRows) : []),
    [activeRows, activeView]
  );
  const visibleCompleteStaticColumns = useMemo(() => {
    if (activeView !== "complete") return [];

    const columns = [
      { key: "CompleteFee", label: "Complete Fee", getValue: (row: ReportRow) => toAmount(row.CompleteFee) },
      { key: "TuitionFee", label: "Tuition Fee", getValue: (row: ReportRow) => toAmount(row.TuitionFee) },
      { key: "TuitionPaid", label: "Tuition Paid", getValue: (row: ReportRow) => toAmount(row.TuitionPaid) },
      { key: "StudentBooksFee", label: "Books Fee", getValue: (row: ReportRow) => toAmount(row.StudentBooksFee) },
      { key: "StudentExamFee", label: "Exam Fee", getValue: (row: ReportRow) => toAmount(row.StudentExamFee) },
      { key: "BusFee", label: "Bus Fee", getValue: (row: ReportRow) => toAmount(row.BusFee) },
      { key: "PreviousDue", label: "Previous Due", getValue: (row: ReportRow) => toAmount(row.PreviousDue) },
      {
        key: "ResidentialCompleteFee",
        label: "Residential Fee",
        getValue: (row: ReportRow) => toAmount(row.ResidentialCompleteFee),
      },
      { key: "OtherFee", label: "Other Fee", getValue: (row: ReportRow) => toAmount(row.OtherFee) },
    ];

    return columns.filter((column) => hasAnyAmount(activeRows, column.getValue));
  }, [activeRows, activeView]);
  const visibleTransactionStaticColumns = useMemo(() => {
    if (activeView !== "studentTransactions") return [];

    const columns = [
      { key: "Paid_Amount", label: "Tuition Paid", getValue: (row: ReportRow) => toAmount(row.Paid_Amount) },
      { key: "Admission_paid", label: "Admission Paid", getValue: (row: ReportRow) => toAmount(row.Admission_paid) },
      { key: "books_paid", label: "Books Paid", getValue: (row: ReportRow) => toAmount(row.books_paid) },
      { key: "uniform_paid", label: "Uniform Paid", getValue: (row: ReportRow) => toAmount(row.uniform_paid) },
      { key: "exam_paid", label: "Exam Paid", getValue: (row: ReportRow) => toAmount(row.exam_paid) },
      { key: "bus_paid", label: "Bus Paid", getValue: (row: ReportRow) => toAmount(row.bus_paid) },
      { key: "others_paid", label: "Others Paid", getValue: (row: ReportRow) => toAmount(row.others_paid) },
      { key: "RES_INST_1", label: "Residential Paid", getValue: (row: ReportRow) => toAmount(row.RES_INST_1) },
      { key: "Previous_Paid", label: "Previous Paid", getValue: (row: ReportRow) => toAmount(row.Previous_Paid) },
      {
        key: "TuitionFee",
        label: "Tuition Fee",
        getValue: (row: ReportRow) => toAmount(normalizeCompleteItem(row).TuitionFee),
      },
      {
        key: "StudentBooksFee",
        label: "Books Fee",
        getValue: (row: ReportRow) => toAmount(normalizeCompleteItem(row).StudentBooksFee),
      },
      {
        key: "ResidentialCompleteFee",
        label: "Residential Fee",
        getValue: (row: ReportRow) => toAmount(normalizeCompleteItem(row).ResidentialCompleteFee),
      },
      { key: "BusFee", label: "Bus Fee", getValue: (row: ReportRow) => toAmount(normalizeCompleteItem(row).BusFee) },
      { key: "Previous_Fee_Due", label: "Previous Due", getValue: (row: ReportRow) => toAmount(row.Previous_Fee_Due) },
    ];

    return columns.filter((column) => hasAnyAmount(activeRows, column.getValue));
  }, [activeRows, activeView]);

  const renderedSummaryValue = isPreviousFinancialYearSelected ? summaryPreviousDue : summaryDue;
  const currentReportCard = activeView === "unpaid" ? "main" : activeView;

  const renderTable = () => {
    if (activeView === "main" && !activeRows.length) {
      return (
        <div className="accountant-reports-empty-state">
          <p>{mainLoading ? "Loading report..." : "Select a report button to load data."}</p>
        </div>
      );
    }

    if (activeView === "main") {
      const headers = activeRows.length ? Object.keys(activeRows[0]) : [];
      const headerLabels = headers.map((header) => {
        if (header === "Class_name") return "Class";
        if (header === "StudentName") return "Student Name";
        if (header === "Total_Expected") return "Total Fee";
        return header.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
      });

      return (
        <table className="accountant-reports-table">
          <thead>
            <tr>
              {headerLabels.map((label, index) => (
                <th key={`${label}-${index}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIndex) => (
              <tr key={`${row.StudentName || "row"}-${rowIndex}`}>
                {headers.map((header) => (
                  <td key={header}>{typeof row[header] === "object" && row[header] !== null ? "-" : row[header]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeView === "paid") {
      const headers = activeRows.length ? Object.keys(activeRows[0]) : [];
      const headerLabels = headers.map((header) => {
        if (header === "Class_name") return "Class";
        if (header === "StudentName") return "Student Name";
        if (header === "Total_Expected") return "Total Fee";
        return header.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
      });

      return (
        <table className="accountant-reports-table">
          <thead>
            <tr>
              {headerLabels.map((label, index) => (
                <th key={`${label}-${index}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIndex) => (
              <tr key={`${row.StudentName || "row"}-${rowIndex}`}>
                {headers.map((header) => (
                  <td key={header}>{typeof row[header] === "object" && row[header] !== null ? "-" : row[header]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeView === "ledger") {
      return (
        <table className="accountant-reports-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Student Name</th>
              <th>Class</th>
              <th>Section</th>
              <th>Receipt No</th>
              <th>Receipt Date</th>
              <th>Academic Year</th>
              <th>Fee Type</th>
              <th>Payment Mode</th>
              <th>Txn ID</th>
              <th>Remarks</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <tr key={`${row.receiptNumber}-${index}`}>
                <td>{(currentPage - 1) * rowsPerPage + index + 1}</td>
                <td>{row.StudentName}</td>
                <td>{row.Class_name}</td>
                <td>{row.section}</td>
                <td>{row.receiptNumber || "-"}</td>
                <td>{formatDate(row.paid_date || row.paidDate || row.created_at)}</td>
                <td>{row.academic_year || currentFinancialYear}</td>
                <td>{row.fee_type || "-"}</td>
                <td>{row.paymentMode || "-"}</td>
                <td>{row.transaction_id || "-"}</td>
                <td></td>
                <td>{formatMoney(row.amount_paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeView === "previous") {
      return (
        <table className="accountant-reports-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Section</th>
              <th>Previous Fee Due</th>
              <th>Previous Paid</th>
              <th>Payment Date</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <tr key={`${row.StudentName}-${index}`}>
                <td>{row.StudentName}</td>
                <td>{row.Class_name}</td>
                <td>{row.section}</td>
                <td>{formatMoney(row.Previous_Fee_Due)}</td>
                <td>{formatMoney(row.Previous_Paid)}</td>
                <td>{formatDate(row.Payment_Date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeView === "complete") {
      return (
        <table className="accountant-reports-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Section</th>
              <th>Student</th>
              {visibleCompleteStaticColumns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              {dynamicCompleteFeeBases.map((baseKey) => (
                <React.Fragment key={baseKey}>
                  <th>{formatHeaderLabel(baseKey)} Fee</th>
                  <th>{formatHeaderLabel(baseKey)} Paid</th>
                </React.Fragment>
              ))}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <tr key={`${row.StudentName}-${index}`}>
                <td>{row.Class_name}</td>
                <td>{row.section}</td>
                <td>{row.StudentName}</td>
                {visibleCompleteStaticColumns.map((column) => (
                  <td key={column.key}>{formatMoney(column.getValue(row))}</td>
                ))}
                {dynamicCompleteFeeBases.map((baseKey) => (
                  <React.Fragment key={baseKey}>
                    <td>{formatMoney(getDynamicFeeValue(row, baseKey))}</td>
                    <td>{formatMoney(getDynamicPaidValue(row, baseKey))}</td>
                  </React.Fragment>
                ))}
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeView === "bus") {
      return (
        <table className="accountant-reports-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Section</th>
              <th>Bus Fee</th>
              <th>Bus Paid</th>
              <th>Bus Pending</th>
              <th>Residential Fee</th>
              <th>Residential Paid</th>
              <th>Residential Due</th>
              <th>Payment Date</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <tr key={`${row.StudentName}-${index}`}>
                <td>{row.StudentName}</td>
                <td>{row.Class_name}</td>
                <td>{row.section}</td>
                <td>{formatMoney(row.Bus_Fee)}</td>
                <td>{formatMoney(row.Bus_Paid)}</td>
                <td>{formatMoney(row.Bus_Pending)}</td>
                <td>{formatMoney(row.Residential_Amount)}</td>
                <td>{formatMoney(row.Residential_Paid)}</td>
                <td>{formatMoney(row.Residential_Due)}</td>
                <td>{formatDate(row.Bus_Payment_Date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeView === "unpaid") {
      return (
        <table className="accountant-reports-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Unpaid</th>
              <th>Class</th>
              <th>Section</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <tr key={`${row.StudentName}-${index}`}>
                <td>{row.StudentName}</td>
                <td>{formatMoney(row.unpaidAmount)}</td>
                <td>{row.Class_name}</td>
                <td>{row.section}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="accountant-reports-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Class</th>
            <th>Section</th>
            {visibleTransactionStaticColumns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {dynamicTransactionPaidKeys.map((key) => (
              <th key={key}>{getDynamicTransactionPaidLabel(key)}</th>
            ))}
            <th>Paid Date</th>
            <th>Payment Mode</th>
            <th>Txn ID</th>
            <th>Receipt No</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {paginatedRows.map((row, index) => {
            return (
              <tr key={`${row.StudentName}-${index}`}>
                <td>{row.StudentName}</td>
                <td>{row.Class_name}</td>
                <td>{row.section}</td>
                {visibleTransactionStaticColumns.map((column) => (
                  <td key={column.key}>{formatMoney(column.getValue(row))}</td>
                ))}
                {dynamicTransactionPaidKeys.map((key) => (
                  <td key={key}>{formatMoney(row[key])}</td>
                ))}
                <td>{formatDate(row.paidDate)}</td>
                <td>{row.paymentMode || "-"}</td>
                <td>{row.transaction_id || "-"}</td>
                <td>{row.receiptNumber || "-"}</td>
                <td>-</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="accountant-dashboard-page accountant-reports-page">
      <div className="accountant-dashboard-shell">
        <div className="accountant-sidebar-strip">
          <Link to="/AccountantDashboard" className="accountant-sidebar-item">
            <div className="accountant-sidebar-item-icon">
              <img src={dashboardIcon} alt="Home" />
            </div>
            <span>Dashboard</span>
          </Link>

          <Link to="/AccountantFees" className="accountant-sidebar-item">
            <div className="accountant-sidebar-item-icon">
              <img src={collectFeeIcon} alt="Collect Fee" />
            </div>
            <span>Fees</span>
          </Link>

          <div className="accountant-sidebar-item" role="button" tabIndex={0} onClick={() => setIsAddFeesPopupOpen(true)}>
            <div className="accountant-sidebar-item-icon">
              <img src={addFeeIcon} alt="" />
            </div>
            <span>Add Fees</span>
          </div>

          <div className="accountant-sidebar-item" role="button" tabIndex={0} onClick={() => navigate("/StudentManagement")}>
            <div className="accountant-sidebar-item-icon">
              <img src={addStudentIcon} alt="" />
            </div>
            <span>Add Student</span>
          </div>

          <div className="accountant-sidebar-item" role="button" tabIndex={0} onClick={() => navigate("/AccountantExpenses")}>
            <div className="accountant-sidebar-item-icon">
              <img src={expenseIcon} alt="" />
            </div>
            <span>Expense</span>
          </div>

          <Link to="/AccountantReportsPage" className="accountant-sidebar-item accountant-sidebar-item-active">
            <div className="accountant-sidebar-item-icon">
              <img src={reportIcon} alt="Report" />
            </div>
            <span>Reports</span>
          </Link>
        </div>

        <div className="accountant-main-area">
          <div className="accountant-topbar">
            <nav className="accountant-topbar-left">
              <Link to="/AccountantDashboard" className="accountant-topbar-tab">
                Dashboard
              </Link>
              <Link to="/AccountantFees" className="accountant-topbar-tab">
                Fees
              </Link>
              <button
                type="button"
                className="accountant-topbar-tab accountant-topbar-tab-button"
                onClick={() => navigate("/AccountantExpenses")}
              >
                Expense
              </button>
              <Link to="/AccountantReportsPage" className="accountant-topbar-tab accountant-topbar-tab-active">
                Reports
              </Link>
            </nav>

            <div className="accountant-topbar-center">
              <div className="accountant-school-brand">
                <img src={instituteLogo || logoab} alt={instituteName || "Institute"} className="accountant-school-logo" />
                <span className="accountant-school-name">{instituteName}</span>
              </div>
            </div>

            <div className="accountant-topbar-right">
              <EditableProfileMenu />
            </div>
          </div>

          <div className="accountant-reports-content">
            <div className="accountant-reports-label-grid">
              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <img src={feesSearchIcon} alt="" aria-hidden="true" />
                <input
                  type="text"
                  name="studentName"
                  value={filters.studentName}
                  onChange={handleFilterChange}
                  placeholder="Student Name"
                />
              </label>

              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <img src={campaignStaffIcon} alt="" aria-hidden="true" />
                <select name="className" value={filters.className} onChange={handleFilterChange} disabled={dropdownLoading}>
                  <option value="All">All Classes</option>
                  {classList.map((item: any) => {
                    const value = String(item?.class_name || item?.className || item || "");
                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <img src={campaignDigitalIcon} alt="" aria-hidden="true" />
                <select name="section" value={filters.section} onChange={handleFilterChange} disabled={dropdownLoading}>
                  <option value="All">All Sections</option>
                  {filteredSections.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </label>

              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <img src={timelineIcon} alt="" aria-hidden="true" />
                <input type="date" name="fromDate" value={filters.fromDate} onChange={handleFilterChange} />
              </label>

              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <img src={timelineIcon} alt="" aria-hidden="true" />
                <input type="date" name="toDate" value={filters.toDate} onChange={handleFilterChange} />
              </label>

              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <img src={campaignAutomatedIcon} alt="" aria-hidden="true" />
                <select name="year" value={filters.year} onChange={handleFilterChange}>
                  <option value="All">All Years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="accountant-reports-card-row">
              {reportCards.map((card) => {
                const isActive = currentReportCard === card.key;
                let onClick = handleTodayLedger;
                let disabled = false;
                let subtitle = card.subtitle;

                if (card.key === "previous") {
                  onClick = handlePreviousReport;
                  disabled = extraLoading;
                  subtitle = loadingCardKey === "previous" ? "Loading..." : card.subtitle;
                } else if (card.key === "complete") {
                  onClick = handleCompleteFeeReport;
                  disabled = extraLoading;
                  subtitle = loadingCardKey === "complete" ? "Loading..." : card.subtitle;
                } else if (card.key === "bus") {
                  onClick = handleBusReport;
                  disabled = extraLoading;
                  subtitle = loadingCardKey === "bus" ? "Loading..." : card.subtitle;
                } else if (card.key === "paid") {
                  onClick = handlePaidListReport;
                  disabled = mainLoading;
                  subtitle = loadingCardKey === "paid" ? "Loading..." : card.subtitle;
                } else if (card.key === "main") {
                  onClick = handleMainDueReport;
                  disabled = mainLoading;
                  subtitle = loadingCardKey === "main" || loadingCardKey === "unpaid" ? "Loading..." : card.subtitle;
                } else if (card.key === "studentTransactions") {
                  onClick = handleStudentTransactions;
                  disabled = studentTransactionsLoading;
                  subtitle = loadingCardKey === "studentTransactions" ? "Loading..." : card.subtitle;
                } else if (card.key === "ledger") {
                  disabled = ledgerLoading;
                  subtitle = loadingCardKey === "ledger" ? "Loading..." : card.subtitle;
                }

                return (
                  <button
                    type="button"
                    key={card.key}
                    className={`accountant-reports-card ${isActive ? "accountant-reports-card-active" : ""}`}
                    onClick={onClick}
                    disabled={disabled}
                  >
                    <img src={card.icon} alt={card.subtitle} />
                    <div className="accountant-reports-card-title">{card.title}</div>
                    <div className="accountant-reports-card-subtitle">{subtitle}</div>
                  </button>
                );
              })}
            </div>

            <div className="accountant-reports-table-card">
              <div className="accountant-reports-toolbar">
                <input
                  type="text"
                  name="studentName"
                  value={filters.studentName}
                  onChange={handleFilterChange}
                  placeholder="Search student name"
                />
                <div className="accountant-reports-toolbar-meta">
                  <span>
                    {isPreviousFinancialYearSelected ? "Previous Due" : "Complete Due"} ({filters.year === "All" ? "All Years" : filters.year}): ₹{" "}
                    {summaryDueLoading ? "0.00" : formatMoney(renderedSummaryValue)}
                  </span>
                  {isPreviousFinancialYearSelected && (
                    <span>Previous Paid: ₹ {summaryDueLoading ? "0.00" : formatMoney(summaryPreviousPaid)}</span>
                  )}
                  <span>{activeRows.length} rows</span>
                </div>
              </div>

              <div className="accountant-reports-table-wrap">{renderTable()}</div>

              {activeView !== "main" && (
                <div className="accountant-reports-pagination">
                  <button type="button" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                    &lt;
                  </button>
                  <span>
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    &gt;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="accountant-footer-brand">
        <span>Powered By:</span>
        <img src={logoab} alt="Cleezo Class" className="accountant-footer-logo" />
      </div>

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
            style={{ width: "58vw", maxWidth: "760px", height: "64vh", overflow: "auto", marginRight: "22vw" }}
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
    </div>
  );
};

export default AccountantReportsPage;
