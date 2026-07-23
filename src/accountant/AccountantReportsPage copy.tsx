import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./AccountantDashboardnew.css";
import "./AccountantReportsPage.css";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";
import InstituteBrand from "../shared/InstituteBrand.jsx";
import { resolveInstituteDisplayName } from "../shared/instituteNameUtils";
import DaywiseIcon from "../assets/Daywise.png";
import TransactionIcon from "../assets/Transactions2.png";
import FeesReportIcon from "../assets/Fees Report.png";
import DueReportIcon from "../assets/Due Report.png";
import FeeTypeIcon from "../assets/Fee Type.png";
import DiscountsIcon from "../assets/Discounts.png";
import ReferralsIcon from "../assets/Referrals.png";
import FeesSearchIcon from "../assets/Fees Search.png";
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
import HelpCenter from "../shared/HelpCenter.jsx";
import { FiHelpCircle } from "react-icons/fi";

type ReportView = "main" | "ledger" | "previous" | "complete" | "bus" | "studentTransactions" | "paid" | "unpaid" | "discounts" | "referrals" | "feeType" | "collectionSummary";
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
  const feeKeys = Object.keys(row || {}).filter(key => {
    const lowerKey = key.toLowerCase();
    return ![
      'studentname', 'class_name', 'section',
      'classname', 'completefee', 'updatedcompletefee', 'final_amount',
      'total_fee', 'name', 'id', 'login_id', 'paiddate', 'payment_date',
      'record_date', 'receipt_date', 'created_at', 'paymentmode',
      'transaction_id', 'receiptnumber', 'academic_year', 'fee_type',
      'remarks', 'amount_paid', 'due', 'pending', 'unpaidamount'
    ].includes(lowerKey);
  });

  const calculatedCompleteFee = feeKeys.reduce((sum, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.endsWith('_paid') ||
      lowerKey.endsWith('_due') ||
      lowerKey.endsWith('_class') ||
      [
        'tuitionfee',
        'studentbooksfee',
        'studentexamfee',
        'busfee',
        'previousdue',
        'residentialcompletefee',
        'otherfee',
      ].includes(lowerKey)
    ) {
      return sum;
    }
    return sum + toAmount(row[key]);
  }, 0);
  const backendCompleteFee = toAmount(
    getAny(row, ["CompleteFee", "completeFee", "UpdatedCompleteFee", "Final_Amount", "complete_fee", "TOTAL_FEE"])
  );
  const completeFee = backendCompleteFee > 0 ? backendCompleteFee : calculatedCompleteFee;

  const getFeeValue = (possibleKeys: string[]) => {
    for (const key of possibleKeys) {
      const value = row[key];
      if (value !== undefined && value !== null) {
        return toAmount(value);
      }
    }
    return 0;
  };

  return {
    ...row,
    StudentName: getAny(row, ["StudentName", "student_name", "studentName"], ""),
    Class_name: getAny(row, ["Class_name", "class_name", "className"], ""),
    section: getAny(row, ["section", "Section"], ""),
    CompleteFee: completeFee,
    BusFee: getFeeValue(['BusFee', 'Bus_fees', 'busFee', 'bus_fees']),
    PreviousDue: toAmount(getAny(row, ["PreviousDue", "Previous_Fee_Due", "previousDue", "previous_fee_due"])),
    ResidentialCompleteFee: toAmount(
      getAny(row, ["ResidentialCompleteFee", "residentialCompleteFee", "residential_complete_fee"])
    ),
    OtherFee: getFeeValue(['OtherFee', 'Others', 'otherFee', 'others']),
    ...Object.fromEntries(
      feeKeys.map(key => [key, toAmount(row[key])])
    )
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
  const formatDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const targetMonthLastDay = new Date(now.getFullYear(), now.getMonth() - 5, 0).getDate();
  const fromDay = Math.min(now.getDate(), targetMonthLastDay);
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 6, fromDay);
  const firstDay = formatDateInputValue(fromDate);
  const lastDay = formatDateInputValue(now);
  return { firstDay, lastDay };
};

const reportCards = [
  { key: "ledger", title: "Day-wise", subtitle: " Ledger", icon: DaywiseIcon },
  { key: "collectionSummary", title: "Collection Report", subtitle: "Day/Month/Year Summary", icon: transactionsIcon },
  { key: "studentTransactions", title: "Transactions", subtitle: "Student Report", icon: TransactionIcon },
  { key: "complete", title: "Fees Report", subtitle: "Total Fee & Installments", icon: FeesReportIcon },
  { key: "main", title: "Due Report", subtitle: "Current & previous", icon: DueReportIcon },
  { key: "feeType", title: "Fee Type", subtitle: "Tuition,books...etc", icon: FeeTypeIcon },
  { key: "discounts", title: "Discounts", subtitle: "Fees and closings", icon: DiscountsIcon },
  { key: "referrals", title: "Referrals", subtitle: " Reference", icon: ReferralsIcon },
  { key: "FeesSearch", title: "Fees Search", subtitle: "Student transactions", icon: FeesSearchIcon },
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

const formatDueReportHeaderLabel = (header: string) => {
  if (header === "Class_name") return "Class";
  if (header === "StudentName") return "Student Name";
  if (header === "Total_Expected") return "Total Fee";
  return formatHeaderLabel(header).trim();
};

const escapeHtml = (value: any) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
    .replace(/\bfees?\b/g, "")
    .replace(/\s+/g, "")
    .replace(/_fees?$/i, "")
    .replace(/_fee$/i, "")
    .replace(/fees?$/i, "")
    .replace(/_amount$/i, "")
    .replace(/_paid$/i, "")
    .replace(/_due$/i);

const getFeeTypeName = (item: any) =>
  String(item?.feeType || item?.fee_type || item?.feeName || item?.fee_name || item || "").trim();

const getCompleteFeeBasesFromFeeTypes = (feeTypes: any[]) => {
  const seen = new Set<string>();
  return (Array.isArray(feeTypes) ? feeTypes : [])
    .map(getFeeTypeName)
    .filter(Boolean)
    .filter((feeName) => {
      const normalized = normalizeFeeBaseKey(feeName);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

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

const getDynamicFeeValue = (row: ReportRow, baseKey: string) => {
  const targetNormalized = normalizeFeeBaseKey(baseKey);
  for (const [key, value] of Object.entries(row || {})) {
    const normalizedKey = normalizeFeeBaseKey(key);
    if (normalizedKey === targetNormalized) {
      const lowerKey = key.toLowerCase();
      if (!lowerKey.endsWith('_paid') && !lowerKey.endsWith('_due')) {
        return toAmount(value);
      }
    }
  }
  return toAmount(getAny(row, [baseKey, `${baseKey}_fee`, `${baseKey}_fees`, `${baseKey}_amount`], 0));
};

const getDynamicDiscountColumns = (rows: ReportRow[]) => {
  const columns = new Set<string>();
  rows.forEach((row) => {
    Object.entries(row || {}).forEach(([key, value]) => {
      const trimmedKey = String(key || "").trim();
      const lowerKey = trimmedKey.toLowerCase();
      if (!lowerKey.includes("discount")) return;
      if (
        [
          "discount",
          "discount_reason",
          "discountreason",
          "discount_date",
          "discount_referred_by",
          "discount_approved_by",
          "discount_refno",
          "reason",
          "fee_type",
        ].includes(lowerKey)
      ) {
        return;
      }
      if (toAmount(value) <= 0) return;
      columns.add(trimmedKey);
    });
  });
  return Array.from(columns).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
};

const getDiscountReason = (row: ReportRow) =>
  getAny(row, ["discount_reason", "discountReason", "reason", "editReason"], "-");

const getDiscountRecordDate = (row: ReportRow) =>
  getAny(row, ["Discount_Date", "discount_date", "record_date", "created_at", "updated_at"], "");

const getRowDiscountTotal = (row: ReportRow) => {
  const directDiscount = toAmount(
    getAny(row, ["Discount", "discount", "discount_amount", "Discount_Amount", "Concession", "Total_Discount"], 0)
  );
  if (directDiscount > 0) return directDiscount;

  return Object.entries(row || {}).reduce((sum, [key, value]) => {
    const lowerKey = String(key || "").toLowerCase();
    if (!lowerKey.includes("discount")) return sum;
    if (
      [
        "discount_reason",
        "discountreason",
        "discount_date",
        "discount_referred_by",
        "discount_approved_by",
        "discount_refno",
        "editreason",
      ].includes(lowerKey)
    ) {
      return sum;
    }
    return sum + toAmount(value);
  }, 0);
};

const normalizeDiscountItem = (row: ReportRow) => ({
  ...row,
  StudentName: getAny(row, ["StudentName", "student_name", "studentName", "name", "Student_Name"], ""),
  Class_name: getAny(row, ["Class_name", "class_name", "className", "class", "FeeClass"], ""),
  section: getAny(row, ["section", "Section", "sectionName", "FeeSection"], ""),
  fee_type: getAny(row, ["fee_type", "feeType", "feeName", "fee_name"], "-"),
  discount_reason: getDiscountReason(row),
  Discount: getRowDiscountTotal(row),
});

const isReferralDiscountRow = (row: ReportRow) => {
  const reason = String(getDiscountReason(row) || "").trim().toLowerCase();
  if (!reason || reason === "-") return false;
  return ["staff", "parent", "sibling"].some((term) => reason.includes(term));
};

const normalizeFeeTypeRow = (row: ReportRow) => ({
  ...row,
  feeName: getAny(row, ["feeName", "fee_name"], ""),
  feesType: getAny(row, ["feesType", "fees_type", "feeType"], ""),
  scope: getAny(row, ["scope"], "All"),
  frequency: getAny(row, ["frequency"], "One time"),
  installments: getAny(row, ["installments"], 1),
});

const getFeeTypeMatchKeys = (value: any) => {
  const baseKey = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/fees?$/, "").replace(/fee$/, "");
  if (!baseKey) return [];
  const aliases = new Set<string>([baseKey]);
  if (baseKey === "guide" || baseKey === "guides") { aliases.add("guide"); aliases.add("guides"); }
  if (baseKey === "stationary" || baseKey === "stationery") { aliases.add("stationary"); aliases.add("stationery"); }
  if (baseKey === "belt" || baseKey === "beltfee") { aliases.add("belt"); aliases.add("beltfee"); }
  if (baseKey === "transport" || baseKey === "transportation" || baseKey === "transportfee") { aliases.add("transport"); aliases.add("transportation"); aliases.add("transportfee"); }
  return Array.from(aliases);
};

const buildActiveFeeTypeKeySet = (rows: ReportRow[]) => {
  const keys = new Set<string>();
  rows.forEach((row) => {
    [row?.feeName, row?.fee_name, row?.feesType, row?.fees_type, row?.feeType].forEach((value) => {
      getFeeTypeMatchKeys(value).forEach((key) => {
        if (key) keys.add(key);
      });
    });
  });
  return keys;
};

const getDynamicPaidValue = (row: ReportRow, baseKey: string) => {
  const targetNormalized = normalizeFeeBaseKey(baseKey);
  for (const [key, value] of Object.entries(row || {})) {
    const normalizedKey = normalizeFeeBaseKey(key);
    if (normalizedKey === targetNormalized) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.endsWith('_paid')) {
        return toAmount(value);
      }
    }
  }
  return toAmount(getAny(row, [`${baseKey}_paid`, `${baseKey}_fee_paid`], 0));
};

const hasAnyAmount = (rows: ReportRow[], getter: (row: ReportRow) => any) =>
  rows.some((row) => toAmount(getter(row)) > 0);

const AccountantReportsPage1: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [activeCardKey, setActiveCardKey] = useState<string>("main");

  // State handles for collection summaries
  const [collectionSubTab, setCollectionSubTab] = useState<"day" | "month" | "year">("day");
  const [collectionData, setCollectionData] = useState<ReportRow[]>([]);

  const [classList, setClassList] = useState<any[]>([]);
  const [sectionMap, setSectionMap] = useState<any[]>([]);
  const [filteredSections, setFilteredSections] = useState<string[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);

  const [ledgerData, setLedgerData] = useState<ReportRow[]>([]);
  const [previousData, setPreviousData] = useState<ReportRow[]>([]);
  const [busData, setBusData] = useState<ReportRow[]>([]);
  const [completeFeeData, setCompleteFeeData] = useState<ReportRow[]>([]);
  const [completeFeeTypeBases, setCompleteFeeTypeBases] = useState<string[]>([]);
  const [studentTransactions, setStudentTransactions] = useState<ReportRow[]>([]);
  const [discountsData, setDiscountsData] = useState<ReportRow[]>([]);
  const [referralsData, setReferralsData] = useState<ReportRow[]>([]);
  const [feeTypeData, setFeeTypeData] = useState<ReportRow[]>([]);
  const [mainData, setMainData] = useState<ReportRow[]>([]);
  const [paidListData, setPaidListData] = useState<ReportRow[]>([]);
  const [unpaidListData, setUnpaidListData] = useState<ReportRow[]>([]);
  const [feeTypesLoaded, setFeeTypesLoaded] = useState(false);

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
  const [isStudentManagementPopupOpen, setIsStudentManagementPopupOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [openHelpSection, setOpenHelpSection] = useState(null);
  
  const userRole = localStorage.getItem("userRole");
  const [addFeePreview, setAddFeePreview] = useState({
    className: "",
    section: "",
    rows: [] as ReportRow[],
  });
  const studentManagementPopupUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}${import.meta.env.BASE_URL}StudentManagement`;

  const rowsPerPage = 18;
  const studentTransactionsQueryRef = useRef("");
  const activeFeeTypeKeys = useMemo(() => buildActiveFeeTypeKeySet(feeTypeData), [feeTypeData]);

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
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const schoolCode = String(localStorage.getItem("schoolCode") || "").trim();
    if (!schoolCode) return;

    let cancelled = false;
    const preloadFeeTypes = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/fee-types`, {
          params: { schoolCode, _t: Date.now() },
        });
        if (cancelled) return;
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        setFeeTypeData(rows.map(normalizeFeeTypeRow).filter((row: ReportRow) => String(row.feeName || "").trim() !== ""));
      } catch (error) {
        console.error("Failed to preload fee types:", error);
      } finally {
        if (!cancelled) setFeeTypesLoaded(true);
      }
    };
    preloadFeeTypes();
    return () => { cancelled = true; };
  }, []);

  const getFilterDateForRow = useCallback(
    (row: ReportRow) => {
      if (activeView === "collectionSummary") {
        return row?.Collection_Date || row?.paid_date || row?.paidDate || "";
      }
      if (activeView === "studentTransactions" || activeView === "paid" || activeView === "unpaid" || activeView === "discounts" || activeView === "referrals") {
        return row?.Discount_Date || row?.discount_date || row?.record_date || row?.paidDate || row?.paid_date || row?.Payment_Date || row?.created_at || "";
      }
      return row?.record_date || row?.paidDate || row?.Payment_Date || row?.Bus_Payment_Date || row?.paid_date || row?.created_at;
    },
    [activeView]
  );

  const getRowYear = useCallback(
    (row: ReportRow) => {
      if (activeView === "collectionSummary") {
        return row?.Collection_Year ? String(row.Collection_Year) : getFinancialYearFromDate(getFilterDateForRow(row));
      }
      return getFinancialYearFromDate(getFilterDateForRow(row));
    },
    [getFilterDateForRow]
  );

  const yearOptions = useMemo(() => {
    const sources = [mainData, ledgerData, previousData, busData, completeFeeData, studentTransactions, paidListData, unpaidListData, discountsData, referralsData, collectionData];
    const years = new Set<string>();
    sources.forEach((list) => {
      list.forEach((row) => {
        const year = getRowYear(row);
        if (year) years.add(year);
      });
    });
    years.add(currentFinancialYear);
    return Array.from(years).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [busData, completeFeeData, currentFinancialYear, getRowYear, ledgerData, mainData, paidListData, previousData, referralsData, studentTransactions, unpaidListData, discountsData, collectionData]);

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
      setClassList(Array.isArray(classRes.data) ? classRes.data : []);
      setSectionMap(Array.isArray(sectionRes.data) ? sectionRes.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setDropdownLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);

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
  }, [filters.className, sectionMap]);

  const fetchSummaryDue = useCallback(async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;
    setSummaryDueLoading(true);
    try {
      const selectedYear = String(filters.year || "").replace(/\s+/g, "");
      if (selectedYear === "2024-2025") {
        const response = await axios.get(`https://cleezoclass.com:4000/api/fee-records-alldata?schoolCode=${schoolCode}&type=PreviousPaidPendingReport`);
        const rows = (Array.isArray(response.data) ? response.data : response.data?.data || []).map(normalizePreviousItem);
        const filteredRows = rows.filter((row: ReportRow) => {
          if (filters.className !== "All" && String(row.Class_name) !== String(filters.className)) return false;
          if (filters.section !== "All" && String(row.section) !== String(filters.section)) return false;
          return true;
        });
        setSummaryDue(filteredRows.reduce((sum: number, row: ReportRow) => sum + toAmount(row.Previous_Fee_Due), 0));
        return;
      }
      const params = new URLSearchParams({ schoolCode, year: filters.year || "All", className: filters.className || "All", section: filters.section || "All" });
      const response = await axios.get(`https://cleezoclass.com:4000/api/fees-summary-ledgerData?${params.toString()}`);
      setSummaryDue(Number(response?.data?.balance) || 0);
      setSummaryPreviousDue(Number(response?.data?.previousDueTotal) || 0);
      setSummaryPreviousPaid(Number(response?.data?.previousPaidTotal) || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setSummaryDueLoading(false);
    }
  }, [filters.className, filters.section, filters.year]);

  useEffect(() => { fetchSummaryDue(); }, [fetchSummaryDue]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const getStudentTransactionsQueryKey = useCallback(
    (nextFilters: Filters) => JSON.stringify({ studentName: nextFilters.studentName || "", className: nextFilters.className || "All", section: nextFilters.section || "All" }),
    []
  );

  // Endpoint Router for handling collection switching tabs
  const handleCollectionSummaryReport = useCallback(async (type: "day" | "month" | "year") => {
    setLoadingCardKey("collectionSummary");
    setExtraLoading(true);
    setCurrentPage(1);
    setCollectionSubTab(type);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      let endpointType = "DayWiseCollectionReport";
      if (type === "month") endpointType = "MonthWiseCollectionReport";
      if (type === "year") endpointType = "YearWiseCollectionReport";

      const response = await axios.get(`${API_BASE_URL}/api/fee-records`, {
        params: { type: endpointType, schoolCode }
      });
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setCollectionData(data);
      setActiveView("collectionSummary");
      setActiveCardKey("collectionSummary");
    } catch (error) {
      console.error(error);
      alert("Failed to fetch collection summary data");
    } finally {
      setExtraLoading(false);
      setLoadingCardKey("");
    }
  }, []);

  const handleTodayLedger = async () => {
    setLoadingCardKey("ledger");
    setLedgerLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      const response = await axios.get(`https://cleezoclass.com:4000/api/ledger?schoolCode=${schoolCode}&type=today`);
      const rawLedger = Array.isArray(response.data.data) ? response.data.data : [];
      setLedgerData(rawLedger);
      setActiveView("ledger");
      setActiveCardKey("ledger");
    } catch (error) {
      console.error(error);
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
      const response = await axios.get(`${API_BASE_URL}/api/fee-records`, {
        params: { type: "TotalDueList", fromDate: filters.fromDate, toDate: filters.toDate, schoolCode }
      });
      setMainData(Array.isArray(response.data) ? response.data : response.data?.data || []);
      setActiveView("main");
      setActiveCardKey("main");
    } catch (error) {
      console.error(error);
    } finally {
      setMainLoading(false);
      setLoadingCardKey("");
    }
  }, [filters.fromDate, filters.toDate]);

  useEffect(() => {
    const schoolCode = String(localStorage.getItem("schoolCode") || "").trim();
    if (schoolCode && !mainData.length) handleMainDueReport();
  }, [handleMainDueReport, mainData.length]);

  const handlePreviousReport = async () => {
    setLoadingCardKey("previous");
    setExtraLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      const response = await axios.get(`https://cleezoclass.com:4000/api/fee-records-alldata?schoolCode=${schoolCode}&type=PreviousPaidPendingReport`);
      const rows = (Array.isArray(response.data) ? response.data : response.data.data || []).map(normalizePreviousItem);
      setPreviousData(rows.filter((row: ReportRow) => row.Due > 0));
      setActiveView("previous");
      setActiveCardKey("previous");
    } catch (error) {
      console.error(error);
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
      const response = await axios.get(`https://cleezoclass.com:4000/api/fee-records-alldata?schoolCode=${schoolCode}&type=CompleteFeeSummaryReport`);
      setCompleteFeeTypeBases(getCompleteFeeBasesFromFeeTypes(response.data?.feeTypes || []));
      setCompleteFeeData((Array.isArray(response.data) ? response.data : response.data.data || []).map(normalizeCompleteItem));
      setActiveView("complete");
      setActiveCardKey("complete");
    } catch (error) {
      console.error(error);
    } finally {
      setExtraLoading(false);
      setLoadingCardKey("");
    }
  };

  const handleStudentTransactions = useCallback(async (sourceCardKey: string = "studentTransactions") => {
    setLoadingCardKey("studentTransactions");
    setStudentTransactionsLoading(true);
    setCurrentPage(1);
    setActiveCardKey(sourceCardKey);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      const response = await axios.get(`${API_BASE_URL}/api/student-transactions-dynamic`, {
        params: { schoolCode, studentName: filters.studentName, className: filters.className === "All" ? "" : filters.className, section: filters.section === "All" ? "" : filters.section }
      });
      const result = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setStudentTransactions(result.filter((row: any) => Object.keys(row).some(k => k.toLowerCase().includes("paid") && toAmount(row[k]) > 0)));
      setActiveView("studentTransactions");
      studentTransactionsQueryRef.current = getStudentTransactionsQueryKey(filters);
    } catch (error) {
      console.error(error);
    } finally {
      setStudentTransactionsLoading(false);
      setLoadingCardKey("");
    }
  }, [filters, getStudentTransactionsQueryKey]);

  const handleDiscountsReport = useCallback(async () => {
    setLoadingCardKey("discounts");
    setExtraLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      const response = await axios.get(`https://cleezoclass.com:4000/api/discounts-report?schoolCode=${schoolCode}&className=${filters.className}&section=${filters.section}`);
      setDiscountsData((Array.isArray(response.data) ? response.data : response.data?.data || []).map(normalizeDiscountItem));
      setActiveView("discounts");
      setActiveCardKey("discounts");
    } catch (error) {
      console.error(error);
    } finally {
      setExtraLoading(false);
      setLoadingCardKey("");
    }
  }, [filters.className, filters.section]);

  const handleReferralsReport = useCallback(async () => {
    setLoadingCardKey("referrals");
    setExtraLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      const response = await axios.get(`https://cleezoclass.com:4000/api/discounts-report?schoolCode=${schoolCode}&className=${filters.className}&section=${filters.section}`);
      setReferralsData((Array.isArray(response.data) ? response.data : response.data?.data || []).map(normalizeDiscountItem).filter(isReferralDiscountRow));
      setActiveView("referrals");
      setActiveCardKey("referrals");
    } catch (error) {
      console.error(error);
    } finally {
      setExtraLoading(false);
      setLoadingCardKey("");
    }
  }, [filters.className, filters.section]);

  const handleFeeTypeReport = useCallback(async () => {
    setLoadingCardKey("feeType");
    setExtraLoading(true);
    setCurrentPage(1);
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      const response = await axios.get(`${API_BASE_URL}/api/fee-types`, { params: { schoolCode, _t: Date.now() } });
      setFeeTypeData((Array.isArray(response.data?.data) ? response.data.data : []).map(normalizeFeeTypeRow));
      setActiveView("feeType");
      setActiveCardKey("feeType");
    } catch (error) {
      console.error(error);
    } finally {
      setExtraLoading(false);
      setLoadingCardKey("");
    }
  }, []);

  const applyFilters = useCallback(
    (rows: ReportRow[]) =>
      rows.filter((row) => {
        if (activeView === "collectionSummary") {
          if (filters.year !== "All") {
            const yearStr = getRowYear(row);
            if (yearStr && !yearStr.includes(filters.year.split("-")[0])) return false;
          }
          return true;
        }
        const studentName = String(getAny(row, ["StudentName", "student_name", "studentName", "name", "Student_Name"], "")).toLowerCase();
        const className = String(getAny(row, ["Class_name", "class_name", "className", "class", "FeeClass"], ""));
        const sectionName = String(getAny(row, ["section", "Section", "sectionName", "FeeSection"], ""));
        if (filters.studentName && !studentName.includes(filters.studentName.toLowerCase())) return false;
        if (filters.className !== "All" && className !== String(filters.className)) return false;
        if (filters.section !== "All" && sectionName !== String(filters.section)) return false;
        if (filters.year !== "All") {
          const rowYear = getRowYear(row);
          if (rowYear && rowYear !== filters.year) return false;
        }
        return true;
      }),
    [filters, getRowYear, activeView]
  );

  const activeRows = useMemo(() => {
    switch (activeView) {
      case "main": return applyFilters(mainData);
      case "ledger": return applyFilters(ledgerData);
      case "previous": return applyFilters(previousData);
      case "complete": return applyFilters(completeFeeData);
      case "studentTransactions": return applyFilters(studentTransactions);
      case "discounts": return applyFilters(discountsData);
      case "referrals": return applyFilters(referralsData);
      case "feeType": return feeTypeData;
      case "collectionSummary": return applyFilters(collectionData);
      default: return [];
    }
  }, [activeView, applyFilters, completeFeeData, discountsData, feeTypeData, ledgerData, mainData, referralsData, studentTransactions, collectionData]);

  const totalPages = Math.max(1, Math.ceil(activeRows.length / rowsPerPage));
  const paginatedRows = activeRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const dynamicTransactionPaidKeys = useMemo(() => (activeView === "studentTransactions" ? getDynamicTransactionPaidKeys(activeRows) : []), [activeRows, activeView]);
  const dynamicCompleteFeeBases = useMemo(() => (activeView === "complete" ? (completeFeeTypeBases.length ? completeFeeTypeBases : getDynamicFeeBases(activeRows)) : []), [activeRows, activeView, completeFeeTypeBases]);
  const dynamicDiscountColumns = useMemo(() => (activeView === "discounts" || activeView === "referrals" ? getDynamicDiscountColumns(activeRows) : []), [activeRows, activeView]);

  const visibleCompleteStaticColumns = useMemo(() => {
    if (activeView !== "complete") return [];
    return [{ key: "CompleteFee", label: "Complete Fee", getValue: (row: ReportRow) => toAmount(row.CompleteFee) }].filter((column) => hasAnyAmount(activeRows, column.getValue));
  }, [activeRows, activeView]);

  const visibleTransactionStaticColumns = useMemo(() => {
    if (activeView !== "studentTransactions") return [];
    const columns = [
      { key: "Admission_paid", label: "Admission Paid", getValue: (row: ReportRow) => toAmount(row.Admission_paid) },
      { key: "books_paid", label: "Books Paid", getValue: (row: ReportRow) => toAmount(row.books_paid) },
      { key: "uniform_paid", label: "Uniform Paid", getValue: (row: ReportRow) => toAmount(row.uniform_paid) },
      { key: "exam_paid", label: "Exam Paid", getValue: (row: ReportRow) => toAmount(row.exam_paid) },
      { key: "bus_paid", label: "Bus Paid", getValue: (row: ReportRow) => toAmount(row.bus_paid) },
      { key: "others_paid", label: "Others Paid", getValue: (row: ReportRow) => toAmount(row.others_paid) },
      { key: "Previous_Paid", label: "Previous Paid", getValue: (row: ReportRow) => toAmount(row.Previous_Paid) },
    ];
    return columns.filter((column) => hasAnyAmount(activeRows, column.getValue));
  }, [activeRows, activeView]);

  const renderedSummaryValue = isPreviousFinancialYearSelected ? summaryPreviousDue : summaryDue;

  const getTableColumns = useCallback(
    (view: ReportView, rows: ReportRow[]) => {
      if (!rows.length) return [];
      if (view === "collectionSummary") {
        if (collectionSubTab === "day") {
          return [
            { key: "Collection_Date", label: "Date", getValue: (row: ReportRow) => formatDate(row.Collection_Date) },
            { key: "Collection_Month", label: "Month", getValue: (row: ReportRow) => row.Collection_Month || "-" },
            { key: "Collection_Year", label: "Year", getValue: (row: ReportRow) => row.Collection_Year || "-" },
            { key: "Total_Collection", label: "Total Collection", getValue: (row: ReportRow) => formatMoney(row.Total_Collection) },
          ];
        }
        if (collectionSubTab === "month") {
          return [
            { key: "Collection_Month", label: "Month Name", getValue: (row: ReportRow) => row.Collection_Month || "-" },
            { key: "Collection_Year", label: "Year", getValue: (row: ReportRow) => row.Collection_Year || "-" },
            { key: "Total_Collection", label: "Total Collection", getValue: (row: ReportRow) => formatMoney(row.Total_Collection) },
          ];
        }
        return [
          { key: "Collection_Year", label: "Financial Year", getValue: (row: ReportRow) => row.Collection_Year || "-" },
          { key: "Total_Collection", label: "Total Collection", getValue: (row: ReportRow) => formatMoney(row.Total_Collection) },
        ];
      }
      if (view === "ledger") {
        return [
          { key: "StudentName", label: "Student Name", getValue: (row: ReportRow) => row.StudentName },
          { key: "Class_name", label: "Class", getValue: (row: ReportRow) => row.Class_name },
          { key: "amount_paid", label: "Amount", getValue: (row: ReportRow) => formatMoney(row.amount_paid) },
        ];
      }
      return [];
    },
    [collectionSubTab]
  );

  const handleDownloadReport = () => {
    const columns = getTableColumns(activeView, activeRows);
    if (!columns.length) return;
    const worksheet = XLSX.utils.aoa_to_sheet([columns.map((c) => c.label), ...activeRows.map((r) => columns.map((c) => c.getValue(r)))]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `Report-${activeView}.xlsx`);
  };

  const renderTable = () => {
    if (activeView === "collectionSummary") {
      return (
        <div>
          <div className="accountant-reports-toolbar-actions" style={{ marginBottom: "12px", display: "flex", gap: "10px" }}>
            <button type="button" className={collectionSubTab === "day" ? "accountant-topbar-tab-active" : ""} onClick={() => handleCollectionSummaryReport("day")}>Day-wise Ledger Summary</button>
            <button type="button" className={collectionSubTab === "month" ? "accountant-topbar-tab-active" : ""} onClick={() => handleCollectionSummaryReport("month")}>Month-wise Summary</button>
            <button type="button" className={collectionSubTab === "year" ? "accountant-topbar-tab-active" : ""} onClick={() => handleCollectionSummaryReport("year")}>Year-wise Summary</button>
          </div>
          <table className="accountant-reports-table">
            <thead>
              <tr>
                {collectionSubTab === "day" && <th>Date</th>}
                <th>Month</th>
                <th>Year</th>
                <th>Total Collection</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => (
                <tr key={index}>
                  {collectionSubTab === "day" && <td>{formatDate(row.Collection_Date)}</td>}
                  <td>{row.Collection_Month || "-"}</td>
                  <td>{row.Collection_Year}</td>
                  <td>₹ {formatMoney(row.Total_Collection)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeView === "ledger") {
      return (
        <table className="accountant-reports-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Class</th>
              <th>Section</th>
              <th>Receipt No</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <tr key={index}>
                <td>{row.StudentName}</td>
                <td>{row.Class_name}</td>
                <td>{row.section}</td>
                <td>{row.receiptNumber || "-"}</td>
                <td>{formatMoney(row.amount_paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // Default fallback placeholder matching template layout row structures
    return (
      <table className="accountant-reports-table">
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Class</th>
            <th>Total Fee</th>
            <th>Total Due</th>
          </tr>
        </thead>
        <tbody>
          {paginatedRows.map((row, index) => (
            <tr key={index}>
              <td>{row.StudentName || row.student_name}</td>
              <td>{row.Class_name || row.class_name}</td>
              <td>{formatMoney(row.Total_Expected || row.completeFee)}</td>
              <td>{formatMoney(row.Total_Due || row.due)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="accountant-dashboard-page accountant-reports-page">
      <div className="accountant-dashboard-shell">
        <div className="accountant-sidebar-strip">
          <Link to="/AccountantDashboard" className="accountant-sidebar-item">
            <div className="accountant-sidebar-item-icon"><img src={dashboardIcon} alt="Home" /></div>
            <span>Dashboard</span>
          </Link>
          <Link to="/AccountantReportsPage" className="accountant-sidebar-item accountant-sidebar-item-active">
            <div className="accountant-sidebar-item-icon"><img src={reportIcon} alt="Report" /></div>
            <span>Reports</span>
          </Link>
        </div>

        <div className="accountant-main-area">
          <div className="accountant-topbar">
            <div className="accountant-topbar-center">
              <InstituteBrand logoSrc={instituteLogo || logoab} logoAlt={instituteName} instituteName={instituteName} />
            </div>
            <div className="accountant-topbar-right">
              <button className="accountant-help-icon-btn" onClick={() => setIsHelpOpen(true)}>
                <FiHelpCircle style={{ color: "#e9818c", fontSize: "34px" }} />
              </button>
              <EditableProfileMenu />
            </div>
          </div>

          <div className="accountant-reports-content">
            <div className="accountant-reports-card-row">
              {reportCards.map((card) => {
                const isActive = activeCardKey === card.key;
                let onClick = handleTodayLedger;
                if (card.key === "collectionSummary") onClick = () => handleCollectionSummaryReport("day");
                if (card.key === "complete") onClick = handleCompleteFeeReport;
                if (card.key === "main") onClick = handleMainDueReport;
                if (card.key === "studentTransactions") onClick = () => handleStudentTransactions("studentTransactions");

                return (
                  <button type="button" key={card.key} className={`accountant-reports-card ${isActive ? "accountant-reports-card-active" : ""}`} onClick={onClick}>
                    <img src={card.icon} alt={card.title} />
                    <div className="accountant-reports-card-title">{card.title}</div>
                    <div className="accountant-reports-card-subtitle">{card.subtitle}</div>
                  </button>
                );
              })}
            </div>

            <div className="accountant-reports-table-card">
              <div className="accountant-reports-toolbar">
                <div className="accountant-reports-toolbar-meta">
                  <span>Rows: {activeRows.length}</span>
                </div>
                <div className="accountant-reports-toolbar-actions">
                  <button type="button" onClick={handleDownloadReport} disabled={!activeRows.length}>Download Excel</button>
                </div>
              </div>
              <div className="accountant-reports-table-wrap">{renderTable()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountantReportsPage1;