import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import "./AccountantDashboardnew.css";
import "./AccountantFeesPageNew.css";
import IncomeForm5 from "../shared/IncomeformTwo.jsx";
import PayementDemo from "./AccountantFeesManagementPayement.jsx";
import GenerateBills from "./Accountant_FeesManagement_Bills.jsx";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";

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
  { icon: createFeeIcon, title: "Create Fee type", text: "Eg: Tuition Fee, Books.." },
  { icon: addFeesIcon, title: "Add Fees", text: "Fees & Discounts list" },
  { icon: assistantIcon, title: "Assistant", text: "Daily Activity check" },
];

const assistantActionItems = [
  {
    title: "Top Unpaid Student Follow-up",
    detail: "Reduce overdue fee risk by contacting highest due students first.",
    procedure: [
      "Open unpaid students list and sort by due amount.",
      "Call guardian and confirm pending amount and date.",
      "Share payment link or branch counter details.",
    ],
  },
  {
    title: "Discount Verification and Approval",
    detail: "Ensure discounts are valid, approved, and correctly posted.",
    procedure: [
      "Verify discount amount per student.",
      "Check approval source and reason.",
      "Cross-check ledger after discount application.",
    ],
  },
  {
    title: "Fee Posting Audit",
    detail: "Prevent mismatches between collections and ledger entries.",
    procedure: [
      "Match receipts with system entries.",
      "Verify installment and fee split values.",
      "Correct posting errors before close.",
    ],
  },
];

const CLASS_PRIORITY = {
  prekg: -2,
  "pre kg": -2,
  prenursery: -1,
  "pre nursery": -1,
  nursery: 0,
  lkg: 1,
  ukg: 2,
};

const getClassSortValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return Number.MAX_SAFE_INTEGER;

  if (CLASS_PRIORITY[normalized] !== undefined) {
    return CLASS_PRIORITY[normalized];
  }

  const numericMatch = normalized.match(/\d+/);
  if (numericMatch) {
    return Number(numericMatch[0]);
  }

  const romanMap = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10,
    xi: 11,
    xii: 12,
  };

  const romanValue = romanMap[normalized.replace(/[^ivx]/g, "")];
  return romanValue ?? Number.MAX_SAFE_INTEGER;
};

const sortClassLabels = (items) =>
  [...items].sort((a, b) => {
    const sortA = getClassSortValue(a);
    const sortB = getClassSortValue(b);

    if (sortA !== sortB) return sortA - sortB;

    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

const sortSectionLabels = (items) =>
  [...items].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

const getExplicitRemainingAmount = (row) => {
  const candidates = [
    row?.totalRemaining,
    row?.Total_Remaining,
    row?.remainingAmount,
    row?.Remaining_Amount,
    row?.Total_Due,
    row?.Due_Amount,
    row?.dueAmount,
    row?.unpaidAmount,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
};

const getDynamicTotalBySuffix = (row, suffix, excludedKeys = []) => {
  const excluded = new Set(excludedKeys.map((key) => String(key || "").toLowerCase()));

  return Object.entries(row || {}).reduce((sum, [key, value]) => {
    if (!key || typeof key !== "string") return sum;
    const normalizedKey = key.toLowerCase();
    if (excluded.has(normalizedKey)) return sum;
    if (
      normalizedKey.endsWith(`_${suffix}`) &&
      !normalizedKey.startsWith("total_") &&
      !normalizedKey.startsWith("dynamicfee")
    ) {
      const parsed = Number(value);
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }
    return sum;
  }, 0);
};

const getStudentCompositeKey = (row) =>
  [
    String(row?.StudentName || row?.studentName || row?.name || row?.Student_Name || "").trim().toLowerCase(),
    String(row?.Class_name || row?.class_name || row?.className || row?.FeeClass || "").trim().toLowerCase(),
    String(row?.Section || row?.section || row?.sectionName || row?.FeeSection || "").trim().toLowerCase(),
  ].join("|");

const isAishaDebugStudent = (studentLike) => {
  const normalizedName = String(
    studentLike?.StudentName || studentLike?.studentName || studentLike?.name || studentLike?.Student_Name || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const normalizedClass = String(
    studentLike?.Class_name || studentLike?.class_name || studentLike?.className || studentLike?.FeeClass || ""
  )
    .trim()
    .toLowerCase();

  const normalizedSection = String(
    studentLike?.Section || studentLike?.section || studentLike?.sectionName || studentLike?.FeeSection || ""
  )
    .trim()
    .toLowerCase();

  return (
    ["aisha begum", "ashiya begum", "aisha begunm", "ashiya begunm"].includes(normalizedName) &&
    normalizedClass === "7" &&
    normalizedSection === "a"
  );
};

const normalizeClassLabel = (value) => String(value || "").replace(/^Class\s+/i, "").trim().toLowerCase();
const normalizeSectionLabel = (value) => String(value || "").trim().toLowerCase();

const feeStudents = Array.from({ length: 17 }, (_, index) => ({
  id: index + 1,
  active: index === 9,
}));

const AccountantFeesPageNew = () => {
  const navigate = useNavigate();
  const [instituteName, setInstituteName] = useState("Institute");
  const [instituteLogo, setInstituteLogo] = useState("/default-logo.png");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [summary, setSummary] = useState({
    gross: 0,
    concession: 0,
    netPayable: 0,
    totalPaid: 0,
    totalDue: 0,
    progress: 0,
    busDue: 0,
    booksDue: 0,
    tuitionDue: 0,
    savingPaid: 0,
    savingDue: 0,
  });
  const [previousYearDue, setPreviousYearDue] = useState(0);
  const [unpaidStudents, setUnpaidStudents] = useState([]);
  const [allFeeStatusRows, setAllFeeStatusRows] = useState([]);
  const [studentDirectory, setStudentDirectory] = useState([]);
  const [paymentSummaryMap, setPaymentSummaryMap] = useState({});
  const [dynamicFeeTypes, setDynamicFeeTypes] = useState([]);
  const [selectedClassFeeStructure, setSelectedClassFeeStructure] = useState(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState("All");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("All");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [isPaymentPopupOpen, setIsPaymentPopupOpen] = useState(false);
  const [selectedStudentCardId, setSelectedStudentCardId] = useState(null);
  const [popupSelection, setPopupSelection] = useState({
    className: "",
    sectionName: "",
    studentId: null,
    studentName: "",
  });
  const [isCreateFeeTypePopupOpen, setIsCreateFeeTypePopupOpen] = useState(false);
  const [isAddFeesPopupOpen, setIsAddFeesPopupOpen] = useState(false);
  const [isAssistantPopupOpen, setIsAssistantPopupOpen] = useState(false);
  const [isBillsPopupOpen, setIsBillsPopupOpen] = useState(false);
  const [addFeePreview, setAddFeePreview] = useState({
    className: "",
    section: "",
    rows: [],
  });
  const [createFeeTypeLoading, setCreateFeeTypeLoading] = useState(false);
  const [createFeeTypeError, setCreateFeeTypeError] = useState("");
  const [newFeeTypeForm, setNewFeeTypeForm] = useState({
    feesType: "",
    scope: "",
    frequency: "",
    installments: "",
  });

  const previousYearLabel = "2024-2025";

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

  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("schoolCode");
    localStorage.removeItem("userRole");
    localStorage.removeItem("name");
    sessionStorage.clear();
    window.location.replace(import.meta.env.BASE_URL || "/");
  };

  const toNumber = useCallback((value) => {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const parsed = parseFloat(value.replace(/[^\d.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, []);

  const getAnyNumber = useCallback(
    (row, keys) => {
      for (const key of keys) {
        const value = row?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          return toNumber(value);
        }
      }
      return 0;
    },
    [toNumber]
  );

  const getFeeTotalsForRow = useCallback(
    (row) => {
      const expectedDirect = getAnyNumber(row, [
        "CompleteFee",
        "completeFee",
        "Total_Expected",
        "total_expected",
        "TotalFee",
        "total_fee",
        "Total_Fee",
        "Fee_Expected",
        "fee_expected",
      ]);

      const paidDirect = getAnyNumber(row, [
        "Paid_Amount",
        "paid_amount",
        "Total_Paid",
        "totalPaid",
        "TuitionPaid",
        "dynamicFeePaidTotal",
      ]);

      const expectedFromParts =
        toNumber(row.Admission_fees) +
        toNumber(row.Books_Uniform_Expected) +
        toNumber(row.Bus_Expected) +
        toNumber(row.TuitionFee) +
        toNumber(row.StudentBooksFee) +
        toNumber(row.StudentExamFee) +
        toNumber(row.Uniform_fees) +
        toNumber(row.Exam_fees) +
        toNumber(row.BusFee) +
        toNumber(row.OtherFee) +
        toNumber(row.ResidentialCompleteFee) +
        toNumber(row.Saving_Fees) +
        toNumber(row.saving_fees) +
        toNumber(row.Savings_Fees) +
        toNumber(row.savings_fees);

      const paidFromParts =
        toNumber(row.Admission_paid) +
        toNumber(row.Books_Uniform_Paid) +
        toNumber(row.Bus_Paid) +
        toNumber(row.books_paid) +
        toNumber(row.uniform_paid) +
        toNumber(row.exam_paid) +
        toNumber(row.bus_paid) +
        toNumber(row.others_paid) +
        toNumber(row.Saving_paid) +
        toNumber(row.saving_paid) +
        toNumber(row.Savings_paid) +
        toNumber(row.savings_paid) +
        toNumber(row.sports_paid) +
        toNumber(row.stationary_paid) +
        toNumber(row.tie_paid) +
        toNumber(row.tie_fee_paid) +
        toNumber(row.belt_paid) +
        toNumber(row.guides_paid) +
        toNumber(row.others_description_paid) +
        getDynamicTotalBySuffix(row, "paid", [
          "admission_paid",
          "books_uniform_paid",
          "bus_paid",
          "books_paid",
          "uniform_paid",
          "exam_paid",
          "others_paid",
          "saving_paid",
          "savings_paid",
          "sports_paid",
          "stationary_paid",
          "tie_paid",
          "tie_fee_paid",
          "belt_paid",
          "guides_paid",
          "others_description_paid",
        ]);

      const expected = expectedDirect > 0 ? expectedDirect : expectedFromParts;
      const paid = paidDirect > 0 ? paidDirect : paidFromParts;
      let unpaid = Math.max(expected - paid, 0);
      const explicitRemaining = getExplicitRemainingAmount(row);

      if (explicitRemaining > 0) {
        unpaid = explicitRemaining;
      }

      if (expected === 0 && paid === 0) {
        const dueAlt = getAnyNumber(row, [
          "Due_Amount",
          "Total_Due",
          "unpaidAmount",
          "Pending_Amount",
          "Previous_Fee_Due",
          "previous_fee_due",
        ]);
        if (dueAlt > 0) unpaid = dueAlt;
        else if (explicitRemaining > 0) unpaid = explicitRemaining;
      }

      return { expected, paid, unpaid };
    },
    [getAnyNumber, toNumber]
  );

  const formatINR = useCallback(
    (value) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value || 0),
    []
  );

  const recentFeeActivityItems = (() => {
    const rows = [...(allFeeStatusRows || [])]
      .filter((row) => row && (row.receiptNumber || row.created_at || row.record_date || row.paid_date))
      .sort((a, b) => {
        const aTime = new Date(a.created_at || a.record_date || a.paid_date || 0).getTime();
        const bTime = new Date(b.created_at || b.record_date || b.paid_date || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 1);

    if (!rows.length) {
      return ["No recent fee entries found"];
    }

    return rows.map((row) => {
      const receiptNumber = row?.receiptNumber || row?.receipt_no || row?.receipt_no_id || "-";
      const recordDate = row?.record_date || row?.created_at || row?.paid_date || row?.paidDate || null;
      const formattedDate = recordDate ? new Date(recordDate).toLocaleDateString("en-GB") : "-";
      const studentName =
        row?.StudentName ||
        row?.studentName ||
        row?.name ||
        row?.Student_Name ||
        "Student";
      const className = row?.Class_name || row?.class_name || row?.className || "Class";
      const section = row?.Section || row?.section || row?.sectionName || row?.FeeSection || "";
      const classSection = [className, section].filter(Boolean).join(" ");
      return `Last Receipt - ${studentName}, ${classSection} - Receipt No. ${receiptNumber} - Date: ${formattedDate}`;
    });
  })();

  const fetchDashboardData = useCallback(async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;
    const fromDate = "2000-01-01";
    const toDate = "2099-12-31";

    try {
      setDashboardLoading(true);
      const [unpaidResult, summaryResult, allFeesResult, studentsResult] = await Promise.allSettled([
        axios.get("https://cleezoclass.com:4000/api/fee-records", {
          params: { type: "TotalDueList", schoolCode, fromDate, toDate },
        }),
        axios.get("https://cleezoclass.com:4000/api/fees-summary-ledgerData", {
          params: { schoolCode, year: "All", className: "All", section: "All" },
        }),
        axios.get("https://cleezoclass.com:4000/api/fee-records", {
          params: { type: "AllFeesStatusReport", schoolCode, fromDate, toDate },
        }),
        axios.get("https://cleezoclass.com:4000/students-details", {
          params: { schoolCode },
        }),
      ]);

      const unpaid =
        unpaidResult.status === "fulfilled" && Array.isArray(unpaidResult.value.data)
          ? unpaidResult.value.data
          : [];
      const allFeesRows =
        allFeesResult.status === "fulfilled" && Array.isArray(allFeesResult.value.data)
          ? allFeesResult.value.data
          : [];
      setAllFeeStatusRows(allFeesRows);
      const masterStudents =
        studentsResult?.status === "fulfilled" && Array.isArray(studentsResult.value?.data?.students)
          ? studentsResult.value.data.students
          : [];

      setUnpaidStudents(unpaid);
      setStudentDirectory(masterStudents);

      let busDue = 0;
      let booksDue = 0;
      let tuitionDue = 0;
      let savingDue = 0;
      let savingPaid = 0;

      unpaid.forEach((row) => {
        const busDueRow =
          getAnyNumber(row, ["Bus_Due", "bus_due", "Transport_Due", "transport_due", "Bus_Pending", "BusDue"]) ||
          Math.max(toNumber(row.Bus_Expected || row.BusFee) - toNumber(row.Bus_Paid || row.bus_paid), 0);

        const booksDueRow =
          getAnyNumber(row, ["Book_Due", "Books_Due", "books_due", "book_due", "BookDue", "Books_Pending"]) ||
          Math.max(
            toNumber(row.Books_Uniform_Expected || row.StudentBooksFee || row.Book_Fee) -
              toNumber(row.Books_Uniform_Paid || row.books_paid),
            0
          );

        const tuitionDueRow =
          getAnyNumber(row, ["Tuition_Due", "tuition_due", "TuitionDue", "tuitionDue", "Tuition_Pending"]) ||
          Math.max(toNumber(row.TuitionFee || row.Tuition_Fee) - toNumber(row.TuitionPaid || row.paid_amount), 0);
        const savingDueRow =
          getAnyNumber(row, ["Saving_Due", "saving_due", "Savings_Due", "savings_due"]) ||
          Math.max(
            getAnyNumber(row, ["Saving_Fees", "saving_fees", "Savings_Fees", "savings_fees"]) -
              getAnyNumber(row, ["Saving_paid", "saving_paid", "Savings_paid", "savings_paid"]),
            0
          );

        busDue += busDueRow;
        booksDue += booksDueRow;
        tuitionDue += tuitionDueRow;
        savingDue += savingDueRow;
      });

      savingPaid = allFeesRows.reduce(
        (sum, row) => sum + getAnyNumber(row, ["Saving_paid", "saving_paid", "Savings_paid", "savings_paid"]),
        0
      );

      const mobileSummary =
        summaryResult.status === "fulfilled" && summaryResult.value?.data?.success
          ? summaryResult.value.data
          : null;
      const totalDueFromUnpaid = unpaid.reduce(
        (sum, row) => sum + getAnyNumber(row, ["Due_Amount", "Total_Due", "unpaidAmount", "Pending_Amount"]),
        0
      );

      let gross = mobileSummary ? toNumber(mobileSummary.totalAmount) : 0;
      let concession = mobileSummary ? toNumber(mobileSummary.totalDiscount) : 0;
      let totalPaid = mobileSummary ? toNumber(mobileSummary.totalPaid) : 0;
      let netPayable = Math.max(gross - concession, 0);
      let totalDue = mobileSummary
        ? toNumber(mobileSummary.balance) || Math.max(netPayable - totalPaid, 0)
        : totalDueFromUnpaid;

      const summaryLooksEmpty = gross === 0 && concession === 0 && totalPaid === 0 && totalDue === 0;

      if (summaryLooksEmpty) {
        let grossFallback = 0;
        let totalPaidFallback = 0;
        let concessionFallback = 0;
        let totalDueFallback = 0;

        allFeesRows.forEach((row) => {
          const totals = getFeeTotalsForRow(row);
          grossFallback += totals.expected;
          totalPaidFallback += totals.paid;
          totalDueFallback += totals.unpaid;
          concessionFallback +=
            getAnyNumber(row, ["Discount", "Total_Discount", "Concession", "feeDiscount"]) +
            getAnyNumber(row, ["tuitionDiscount", "busDiscount", "admissionDiscount"]);
        });

        gross = grossFallback;
        concession = concessionFallback;
        totalPaid = totalPaidFallback;
        netPayable = Math.max(gross - concession, 0);
        totalDue = totalDueFallback || Math.max(netPayable - totalPaid, 0);
      }

      const progress = netPayable > 0 ? (totalPaid / netPayable) * 100 : 0;
      setSummary({
        gross,
        concession,
        netPayable,
        totalPaid,
        totalDue,
        progress: Math.min(Math.max(progress, 0), 100),
        busDue,
        booksDue,
        tuitionDue,
        savingPaid,
        savingDue,
      });
    } catch {
      setSummary({
        gross: 0,
        concession: 0,
        netPayable: 0,
        totalPaid: 0,
        totalDue: 0,
        progress: 0,
        busDue: 0,
        booksDue: 0,
        tuitionDue: 0,
        savingPaid: 0,
        savingDue: 0,
      });
      setUnpaidStudents([]);
      setAllFeeStatusRows([]);
      setStudentDirectory([]);
    } finally {
      setDashboardLoading(false);
    }
  }, [getAnyNumber, getFeeTotalsForRow, toNumber]);

  const fetchPreviousYearDue = useCallback(async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;
    const fromDate = "2000-01-01";
    const toDate = "2099-12-31";
    try {
      const res = await axios.get("https://cleezoclass.com:4000/api/fee-records-alldata", {
        params: { schoolCode, type: "PreviousPaidPendingReport", fromDate, toDate },
      });
      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : [];
      const due = rows.reduce((sum, row) => {
        const rowDue = getAnyNumber(row, [
          "Previous_Fee_Due",
          "Previous_Pending",
          "previous_due",
          "previousDue",
          "previous_fee_due",
        ]);
        return sum + rowDue;
      }, 0);
      setPreviousYearDue(due);
    } catch {
      setPreviousYearDue(0);
    }
  }, [getAnyNumber]);

  useEffect(() => {
    fetchDashboardData();
    fetchPreviousYearDue();
  }, [fetchDashboardData, fetchPreviousYearDue]);

  const openCreateFeeTypePopup = useCallback(() => {
    setIsAssistantPopupOpen(false);
    setCreateFeeTypeError("");
    setCreateFeeTypeLoading(false);
    setIsCreateFeeTypePopupOpen(true);
  }, []);

  const openAddFeesPopup = useCallback(() => {
    setIsAssistantPopupOpen(false);
    setIsAddFeesPopupOpen(true);
  }, []);

  const openAssistantPanel = useCallback(() => {
    setIsAddFeesPopupOpen(false);
    setIsAssistantPopupOpen(true);
  }, []);

  const refreshPaymentSummaryMap = useCallback(async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode || selectedClassFilter === "All" || selectedSectionFilter === "All") {
      setPaymentSummaryMap({});
      return;
    }

    const studentsForSelectedClass = (studentDirectory || [])
      .filter((student) => {
        const className = normalizeClassLabel(student?.class_name || student?.Class_name || student?.className || "");
        const section = normalizeSectionLabel(student?.section || student?.Section || student?.sectionName || "");
        return (
          className === normalizeClassLabel(selectedClassFilter) &&
          section === normalizeSectionLabel(selectedSectionFilter)
        );
      });

    if (!studentsForSelectedClass.length) {
      setPaymentSummaryMap({});
      return;
    }

    const entries = await Promise.all(
      studentsForSelectedClass.map(async (student) => {
        const studentId = student?.id ?? student?.student_id;
        if (!studentId) return null;

        try {
          const res = await axios.get(`https://cleezoclass.com:4000/api/payment/${studentId}`, {
            params: { schoolCode },
          });

          const paymentPayload = res?.data?.payments || res?.data?.payment || res?.data || null;
          if (!paymentPayload || typeof paymentPayload !== "object") return null;

          const key = getStudentCompositeKey({
            StudentName: paymentPayload?.studentName || paymentPayload?.StudentName || student?.name,
            Class_name: paymentPayload?.class || paymentPayload?.Class_name || student?.class_name,
            Section: paymentPayload?.section || paymentPayload?.Section || student?.section,
          });

          return [
            {
              studentId: String(studentId),
              key,
            },
            paymentPayload,
          ];
        } catch {
          return null;
        }
      })
    );

    const nextMap = {};
    entries.forEach((entry) => {
      if (!entry) return;
      const [lookup, value] = entry;
      if (!lookup) return;
      if (lookup.studentId) {
        nextMap[lookup.studentId] = value;
      }
      if (lookup.key) {
        nextMap[lookup.key] = value;
      }
    });
    setPaymentSummaryMap(nextMap);
  }, [selectedClassFilter, selectedSectionFilter, studentDirectory]);

  useEffect(() => {
    let isCancelled = false;

    refreshPaymentSummaryMap().catch(() => {
      if (!isCancelled) {
        setPaymentSummaryMap({});
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [refreshPaymentSummaryMap]);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode || selectedClassFilter === "All" || selectedSectionFilter === "All") {
      setSelectedClassFeeStructure(null);
      return;
    }

    axios
      .get(`https://cleezoclass.com:4000/feeStructure/${selectedClassFilter}`, {
        params: { schoolCode, section: selectedSectionFilter },
      })
      .then((res) => {
        setSelectedClassFeeStructure(res.data?.feeStructure || null);
      })
      .catch(() => {
        setSelectedClassFeeStructure(null);
      });
  }, [selectedClassFilter, selectedSectionFilter]);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    axios
      .get("https://cleezoclass.com:4000/api/fee-types", {
        params: { schoolCode, _t: Date.now() },
      })
      .then((res) => {
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        const normalized = rows
          .filter((item) => String(item?.feeName || "").trim() !== "")
          .map((item, index) => ({
            id: item?.id || index,
            feeName: item?.feeName || "",
            feesType: item?.feesType || "Custom Fee",
            priority: item?.priority || index + 1,
            scope: item?.scope || "All",
            frequency: item?.frequency || "One time",
            installments: item?.installments || 1,
          }));
        setDynamicFeeTypes(normalized);
      })
      .catch(() => {
        setDynamicFeeTypes([]);
      });
  }, []);

  const handleCreateFeeType = useCallback(
    async (event) => {
      event.preventDefault();
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) {
        setCreateFeeTypeError("School code is missing.");
        return;
      }

      setCreateFeeTypeLoading(true);
      setCreateFeeTypeError("");

      const nextFeeType = {
        feeName: newFeeTypeForm.feesType.trim() || "Custom Fee",
        feesType: newFeeTypeForm.feesType.trim() || "Custom Fee",
        priority: dynamicFeeTypes.length + 1,
        scope: newFeeTypeForm.scope || "All",
        frequency: newFeeTypeForm.frequency || "One time",
        installments:
          (newFeeTypeForm.frequency || "One time") === "Term wise"
            ? Math.max(1, Number(newFeeTypeForm.installments) || 1)
            : 1,
      };

      try {
        const payload = {
          schoolCode,
          ...nextFeeType,
        };
        await axios.post("https://cleezoclass.com:4000/api/fee-types", payload);
        setDynamicFeeTypes((prev) => [
          ...prev,
          { id: `${Date.now()}`, ...nextFeeType },
        ]);
        setNewFeeTypeForm({
          feesType: "",
          scope: "",
          frequency: "",
          installments: "",
        });
        setIsCreateFeeTypePopupOpen(false);
      } catch (error) {
        setCreateFeeTypeError(error?.response?.data?.message || "Failed to save fee type.");
      } finally {
        setCreateFeeTypeLoading(false);
      }
    },
    [dynamicFeeTypes.length, newFeeTypeForm]
  );

  const normalizedOutstandingStudents = useCallback(() => {
    const masterList = (studentDirectory || []).map((student, index) => ({
      id: student?.id ?? student?.student_id ?? `student-${index}`,
      name:
        student?.name ||
        student?.StudentName ||
        student?.studentName ||
        student?.Student_Name ||
        "Student",
      className: student?.class_name || student?.Class_name || student?.className || "",
      section: student?.section || student?.Section || student?.sectionName || "",
    }));

    if (masterList.length > 0) {
      return masterList;
    }

    const fallbackFromUnpaid = (unpaidStudents || []).map((student, index) => ({
      id:
        student?.id ??
        student?.StudentId ??
        student?.student_id ??
        student?.Admission_Number ??
        `unpaid-${index}`,
      name:
        student?.StudentName ||
        student?.studentName ||
        student?.name ||
        student?.Student_Name ||
        "Student",
      className:
        student?.Class_name ||
        student?.class_name ||
        student?.className ||
        student?.FeeClass ||
        "",
      section:
        student?.Section ||
        student?.section ||
        student?.sectionName ||
        student?.FeeSection ||
        "",
    }));

    return fallbackFromUnpaid;
  }, [studentDirectory, unpaidStudents]);

  const outstandingDueMap = useCallback(() => {
    const transactionDueMap = new Map();
    const explicitRemainingMap = new Map();

    (allFeeStatusRows || []).forEach((row) => {
      const name = row?.StudentName || row?.studentName || row?.name || row?.Student_Name || "";
      const className = row?.Class_name || row?.class_name || row?.className || row?.FeeClass || "";
      const section = row?.Section || row?.section || row?.sectionName || row?.FeeSection || "";
      const totals = getFeeTotalsForRow(row);
      const dueAmount = Math.max(totals.unpaid, 0);
      const key = [
        String(name).trim().toLowerCase(),
        String(className).trim().toLowerCase(),
        String(section).trim().toLowerCase(),
      ].join("|");
      if (!key.trim()) return;

      const transactionPaid = getAnyNumber(row, ["amount_paid", "paid_amount"]);
      const explicitRemaining = getExplicitRemainingAmount(row);

      // Transaction rows often carry running remaining balances like 8000, 7000, 6000.
      // Summing those values inflates due, so only accumulate rows that are genuine due summaries.
      if (transactionPaid > 0 && explicitRemaining > 0) {
        return;
      }

      transactionDueMap.set(key, (transactionDueMap.get(key) || 0) + dueAmount);
    });

    (unpaidStudents || []).forEach((row) => {
      const name = row?.StudentName || row?.studentName || row?.name || row?.Student_Name || "";
      const className = row?.Class_name || row?.class_name || row?.className || row?.FeeClass || "";
      const section = row?.Section || row?.section || row?.sectionName || row?.FeeSection || "";
      const dueAmount = getAnyNumber(row, ["unpaidAmount", "Due_Amount", "Total_Due", "Pending_Amount"]);
      const explicitDueAmount = getExplicitRemainingAmount(row);
      const key = [
        String(name).trim().toLowerCase(),
        String(className).trim().toLowerCase(),
        String(section).trim().toLowerCase(),
      ].join("|");
      if (!key.trim()) return;

      if (explicitDueAmount > 0) {
        explicitRemainingMap.set(key, explicitDueAmount);
        return;
      }

      if (!explicitRemainingMap.has(key) && !transactionDueMap.has(key)) {
        transactionDueMap.set(key, dueAmount);
      }
    });

    const merged = new Map(transactionDueMap);
    explicitRemainingMap.forEach((value, key) => {
      merged.set(key, value);
    });

    return merged;
  }, [allFeeStatusRows, getAnyNumber, getFeeTotalsForRow, unpaidStudents]);

  const unpaidSummaryDueMap = useCallback(() => {
    const map = new Map();

    (unpaidStudents || []).forEach((row) => {
      const key = getStudentCompositeKey(row);
      if (!key.replace(/\|/g, "").trim()) return;

      const explicitDueAmount = getExplicitRemainingAmount(row);
      const dueAmount = getAnyNumber(row, ["unpaidAmount", "Due_Amount", "Total_Due", "Pending_Amount"]);
      const resolvedDue = explicitDueAmount > 0 ? explicitDueAmount : dueAmount;

      if (resolvedDue > 0 && !map.has(key)) {
        map.set(key, resolvedDue);
      }
    });

    return map;
  }, [getAnyNumber, unpaidStudents]);

  const groupedOutstandingStudents = useCallback(() => {
    const groups = new Map();
    normalizedOutstandingStudents().forEach((student, index) => {
      const key = String(student.id || "").trim() || [
        String(student.name || "").trim().toLowerCase(),
        String(student.className || "").trim().toLowerCase(),
        String(student.section || "").trim().toLowerCase(),
      ].join("|");
      const dueAmount = outstandingDueMap().get(key) || 0;
      if (!groups.has(key)) {
        groups.set(key, {
          ...student,
          id: student.id || `student-${index}`,
          dueAmount,
        });
      }
    });
    return [...groups.values()];
  }, [normalizedOutstandingStudents, outstandingDueMap]);

  const selectedClassDefaultDue = useCallback(() => {
    if (!selectedClassFeeStructure) return 0;
    return (
      Number(selectedClassFeeStructure?.CompleteFee) ||
      Number(selectedClassFeeStructure?.complete_fee) ||
      0
    );
  }, [selectedClassFeeStructure]);

  const hasSelectedClassFeeSetup = useCallback(() => {
    if (!selectedClassFeeStructure || typeof selectedClassFeeStructure !== "object") return false;

    const ignoredKeys = new Set([
      "id",
      "created_at",
      "updated_at",
      "class_name",
      "Class_name",
      "section",
      "Section",
      "schoolCode",
      "school_code",
      "login_id",
    ]);

    return Object.entries(selectedClassFeeStructure).some(([key, value]) => {
      if (ignoredKeys.has(key)) return false;
      const normalizedKey = String(key || "").toLowerCase();
      if (normalizedKey.includes("date") || normalizedKey.includes("remark")) return false;
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0;
    });
  }, [selectedClassFeeStructure]);

  const shouldHighlightAddFees =
    selectedClassFilter !== "All" &&
    selectedSectionFilter !== "All" &&
    !hasSelectedClassFeeSetup();

  const selectedClassPaidTotalsMap = useCallback(() => {
    const transactionMap = new Map();
    const aggregateFallbackMap = new Map();
    const seenRows = new Set();

    [...(allFeeStatusRows || []), ...(unpaidStudents || [])].forEach((row) => {
      const rowKey =
        row?.id ??
        [
          row?.receiptNumber,
          row?.fee_type,
          row?.StudentName,
          row?.Class_name,
          row?.section || row?.Section || row?.sectionName || row?.FeeSection,
          row?.amount_paid,
          row?.record_date,
        ].join("|");

      if (seenRows.has(rowKey)) return;
      seenRows.add(rowKey);

      const key = getStudentCompositeKey(row);

      if (!key.replace(/\|/g, "").trim()) return;

      const transactionPaid = getAnyNumber(row, ["amount_paid", "paid_amount"]);
      const aggregatePaid = getAnyNumber(row, [
        "Paid_Amount",
        "Total_Paid",
        "totalPaid",
        "dynamicFeePaidTotal",
      ]);

      if (transactionPaid > 0) {
        transactionMap.set(key, (transactionMap.get(key) || 0) + transactionPaid);
      } else if (aggregatePaid > 0 && !transactionMap.has(key) && !aggregateFallbackMap.has(key)) {
        aggregateFallbackMap.set(key, aggregatePaid);
      }
    });

    const merged = new Map(aggregateFallbackMap);
    transactionMap.forEach((value, key) => {
      merged.set(key, value);
    });

    return merged;
  }, [allFeeStatusRows, getAnyNumber, unpaidStudents]);

  const classOptions = [
    "All",
    ...sortClassLabels([...new Set(normalizedOutstandingStudents().map((s) => s.className).filter(Boolean))]),
  ];

  const sectionOptions = [
    "All",
    ...sortSectionLabels(
      [...new Set(
        normalizedOutstandingStudents()
          .filter(
            (s) =>
              selectedClassFilter === "All" ||
              normalizeClassLabel(s.className) === normalizeClassLabel(selectedClassFilter)
          )
          .map((s) => s.section)
          .filter(Boolean)
      )]
    ),
  ];

  const filteredOutstandingStudents = groupedOutstandingStudents()
    .map((student) => {
      const key = [
        String(student?.name || student?.StudentName || "").trim().toLowerCase(),
        String(student?.className || student?.Class_name || "").trim().toLowerCase(),
        String(student?.section || student?.Section || "").trim().toLowerCase(),
      ].join("|");
      const groupedDue = Number(student?.dueAmount) || 0;
      const summaryDue = unpaidSummaryDueMap().get(key) || 0;
      const paymentSummary = paymentSummaryMap[String(student?.id ?? student?.student_id ?? "")] || paymentSummaryMap[key] || null;
      const paymentApiDue = getExplicitRemainingAmount(paymentSummary);
      const overrideDue = getExplicitRemainingAmount(student);
      const resolvedStudentDue =
        groupedDue > 0
          ? groupedDue
          : summaryDue > 0
            ? summaryDue
            : overrideDue > 0
              ? overrideDue
              : paymentApiDue > 0
                ? paymentApiDue
                : 0;
      const totalPaidForStudent = selectedClassPaidTotalsMap().get(key) || 0;
      const computedDueFromSelectedClass =
        selectedClassFilter !== "All" &&
        selectedSectionFilter !== "All" &&
        selectedClassDefaultDue() > 0
          ? Math.max(selectedClassDefaultDue() - totalPaidForStudent, 0)
          : 0;
      const computedDue =
        resolvedStudentDue > 0
          ? resolvedStudentDue
          : computedDueFromSelectedClass > 0
            ? computedDueFromSelectedClass
            : 0;

      if (isAishaDebugStudent(student)) {
        const paidRowsFromAllFeesStatus = (allFeeStatusRows || [])
          .filter((row) => getStudentCompositeKey(row) === key)
          .map((row) => {
            const rowTotals = getFeeTotalsForRow(row);
            return {
              id: row?.id,
              receiptNumber: row?.receiptNumber,
              fee_type: row?.fee_type,
              amount_paid: row?.amount_paid,
              dynamicFeePaidTotal: row?.dynamicFeePaidTotal,
              totalRemaining: row?.totalRemaining,
              Total_Paid: row?.Total_Paid,
              Total_Due: row?.Total_Due,
              Due_Amount: row?.Due_Amount,
              Total_Expected: row?.Total_Expected,
              sports_paid: row?.sports_paid,
              stationary_paid: row?.stationary_paid,
              guides_paid: row?.guides_paid,
              belt_paid: row?.belt_paid,
              tie_paid: row?.tie_paid,
              record_date: row?.record_date,
              totalsFromRow: rowTotals,
              explicitRemaining: getExplicitRemainingAmount(row),
            };
          });

        const paidRowsFromUnpaidList = (unpaidStudents || [])
          .filter((row) => getStudentCompositeKey(row) === key)
          .map((row) => {
            const rowTotals = getFeeTotalsForRow(row);
            return {
              id: row?.id,
              receiptNumber: row?.receiptNumber,
              fee_type: row?.fee_type,
              amount_paid: row?.amount_paid,
              dynamicFeePaidTotal: row?.dynamicFeePaidTotal,
              totalRemaining: row?.totalRemaining,
              Total_Paid: row?.Total_Paid,
              Total_Due: row?.Total_Due,
              Due_Amount: row?.Due_Amount,
              Due_Alt: getAnyNumber(row, ["unpaidAmount", "Due_Amount", "Total_Due", "Pending_Amount"]),
              Total_Expected: row?.Total_Expected,
              sports_paid: row?.sports_paid,
              stationary_paid: row?.stationary_paid,
              guides_paid: row?.guides_paid,
              belt_paid: row?.belt_paid,
              tie_paid: row?.tie_paid,
              record_date: row?.record_date,
              totalsFromRow: rowTotals,
              explicitRemaining: getExplicitRemainingAmount(row),
            };
          });

        console.groupCollapsed("[Aisha Due Debug] How due became", computedDue);
        console.log("Student card row", student);
        console.log("Student key", key);
        console.log("Selected filters", {
          selectedClassFilter,
          selectedSectionFilter,
        });
        console.log("Selected class fee structure", selectedClassFeeStructure);
        console.log("Computation pieces", {
          groupedDue,
          paymentSummary,
          paymentApiDue,
          summaryDue,
          overrideDue,
          resolvedStudentDue,
          totalPaidForStudent,
          selectedClassDefaultDue: selectedClassDefaultDue(),
          computedDueFromSelectedClass,
          finalComputedDue: computedDue,
          reasonUsed:
            resolvedStudentDue > 0
              ? "resolvedStudentDue"
              : computedDueFromSelectedClass > 0
                ? "selectedClassDefaultDue - totalPaidForStudent"
                : "zero-fallback",
        });
        console.log("Paid rows from AllFeesStatusReport", paidRowsFromAllFeesStatus);
        console.log("Due rows from TotalDueList/unpaid list", paidRowsFromUnpaidList);
        console.groupEnd();
      }
      return {
        ...student,
        dueAmount: computedDue,
      };
    })
    .filter((student) => {
      const classMatch =
        selectedClassFilter === "All" ||
        normalizeClassLabel(student.className) === normalizeClassLabel(selectedClassFilter);
      const sectionMatch =
        selectedSectionFilter === "All" ||
        normalizeSectionLabel(student.section) === normalizeSectionLabel(selectedSectionFilter);
      const searchMatch =
        !studentSearchTerm.trim() ||
        student.name.toLowerCase().includes(studentSearchTerm.trim().toLowerCase());
      return classMatch && sectionMatch && searchMatch;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (selectedClassFilter === "All" || selectedSectionFilter === "All") return;

    const matchedRows = (allFeeStatusRows || []).filter((row) => {
      const sameClass =
        normalizeClassLabel(row?.Class_name || row?.class_name || "") === normalizeClassLabel(selectedClassFilter);
      const sameSection =
        normalizeSectionLabel(row?.section || row?.Section || "") === normalizeSectionLabel(selectedSectionFilter);
      return sameClass && sameSection;
    });

    const grouped = filteredOutstandingStudents.map((student) => ({
      studentName: student.name,
      className: student.className,
      section: student.section,
      dueAmount: student.dueAmount,
      explicitRemaining: getExplicitRemainingAmount(student),
      totalPaidFromRows:
        selectedClassPaidTotalsMap().get(
          [
            String(student?.name || "").trim().toLowerCase(),
            String(student?.className || "").trim().toLowerCase(),
            String(student?.section || "").trim().toLowerCase(),
          ].join("|")
        ) || 0,
    }));

    const signature = JSON.stringify({
      className: selectedClassFilter,
      section: selectedSectionFilter,
      rows: matchedRows.map((row) => ({
        id: row?.id,
        receiptNumber: row?.receiptNumber,
        fee_type: row?.fee_type,
        studentName: row?.StudentName,
        className: row?.Class_name,
        section: row?.section,
        amount_paid: row?.amount_paid,
        totalPaid: row?.Total_Paid,
        totalDue: row?.Total_Due,
        record_date: row?.record_date,
      })),
      grouped,
    });

    if (window.__feesDebugLastSignature === signature) return;
    window.__feesDebugLastSignature = signature;

    console.log("[AccountantFeesPageNew][due-debug]", {
      selectedClassFilter,
      selectedSectionFilter,
      matchedRows,
      grouped,
    });
  }, [allFeeStatusRows, filteredOutstandingStudents, paymentSummaryMap, selectedClassFilter, selectedSectionFilter, selectedClassPaidTotalsMap]);

  const openPaymentGrid = useCallback(
    (student) => {
      const className = student?.className || (selectedClassFilter !== "All" ? selectedClassFilter : "");
      const sectionName = student?.section || (selectedSectionFilter !== "All" ? selectedSectionFilter : "");
      if (!className || !sectionName) return;
      const studentId = student?.id ?? student?.student_id ?? null;
      const studentName =
        student?.name ||
        student?.StudentName ||
        student?.studentName ||
        student?.Student_Name ||
        "";

      console.log("[AccountantFeesPageNew][openPaymentGrid]", {
        clickedStudent: student,
        resolvedStudentId: studentId,
        resolvedStudentName: studentName,
        className,
        sectionName,
      });

      localStorage.setItem("selectedClassSection", `${className}_${sectionName}`);
      localStorage.setItem("className", className);
      localStorage.setItem("section", sectionName);

      setPopupSelection({
        className,
        sectionName,
        studentId,
        studentName,
      });
      setSelectedStudentCardId(studentId);
      setIsPaymentPopupOpen(true);
    },
    [selectedClassFilter, selectedSectionFilter]
  );

  return (
    <div className="accountant-dashboard-page accountant-fees-page">
      <div className="accountant-dashboard-shell">
    <div className="accountant-sidebar-strip">

  <div
    className="accountant-sidebar-item"
    onClick={() => navigate("/AccountantDashboard")}
  >
    <div className="accountant-sidebar-item-icon">
      <img src={dashboardIcon} alt="Home" />
    </div>
    <span>Dashboard</span>
  </div>

  <div
    className="accountant-sidebar-item accountant-sidebar-item-active"
    onClick={() => navigate("/AccountantFees")}
  >
    <div className="accountant-sidebar-item-icon">
      <img src={collectFeeIcon} alt="" />
    </div>
    <span>Fees</span>
  </div>

  <div
    className="accountant-sidebar-item"
    onClick={openAddFeesPopup}
  >
    <div className="accountant-sidebar-item-icon">
      <img src={addFeeIcon} alt="" />
    </div>
    <span>Add Fees</span>
  </div>

  <div
    className="accountant-sidebar-item"
    onClick={() => navigate("/StudentManagement")}
  >
    <div className="accountant-sidebar-item-icon">
      <img src={addStudentIcon} alt="" />
    </div>
    <span>Add Student</span>
  </div>

  <div
    className="accountant-sidebar-item"
    onClick={() => navigate("/AccountantExpenses")}
  >
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
      if (event.key === "Enter" || event.key === " ")
        navigate("/AccountantReportsPage");
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
                className="accountant-topbar-tab accountant-topbar-tab-button accountant-topbar-tab-active"
                onClick={() => navigate("/AccountantFees")}
              >
                Fees
              </button>
              <button
                type="button"
                className="accountant-topbar-tab accountant-topbar-tab-button"
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
              <div className="accountant-school-brand">
                <img src={instituteLogo || logoab} alt={instituteName || "Institute"} className="accountant-school-logo" />
                <span className="accountant-school-name">{instituteName}</span>
              </div>
            </div>

            <div className="accountant-topbar-right">
              <EditableProfileMenu />
            </div>
          </div>

          <div className="accountant-grid accountant-fees-grid">
            <div className="accountant-row accountant-fees-row-top">
              <div className="accountant-welcome-block">
                <h2>Hi, Nishanth!</h2>
                <p>Check Due Status,</p>
                <p>Report dues to Class Teacher</p>
                <p>Submit Day wise Ledger</p>
              </div>

              <div className="accountant-fees-summary-card accountant-card">
                <div className="accountant-fees-summary-left">
                    <div className="accountant-progress-panel">
                    <div
                      className="accountant-progress-ring"
                      style={{
                        "--progress-angle": `${Math.max(0, Math.min(summary.progress, 100)) * 3.6}deg`,
                      }}
                    >
                      <div className="accountant-progress-ring-inner">
                        {dashboardLoading ? "..." : `${Math.round(summary.progress)}%`}
                      </div>
                    </div>
                  </div>

                  <div className="accountant-fees-summary-stats">
                    <p>
                      <span className="normalText accountant-fees-summary-label">Gross:</span>
                      <strong className="accountant-fees-summary-value">
                        {dashboardLoading ? "Loading..." : formatINR(summary.gross)}
                      </strong>
                    </p>
                    <p>
                      <span className="normalText accountant-fees-summary-label">Concession:</span>
                      <strong className="accountant-fees-summary-value">
                        {dashboardLoading ? "Loading..." : formatINR(summary.concession)}
                      </strong>
                    </p>
                    <p>
                      <span className="normalText accountant-fees-summary-label">Net Payable:</span>
                      <strong className="accountant-fees-summary-value">
                        {dashboardLoading ? "Loading..." : formatINR(summary.netPayable)}
                      </strong>
                    </p>
                    <p>
                      <span className="normalText accountant-fees-summary-label">Total Paid:</span>
                      <strong className="accountant-fees-summary-value">
                        {dashboardLoading ? "Loading..." : formatINR(summary.totalPaid)}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="accountant-fees-summary-right">
                  <button type="button" className="collect-filter accountant-fees-summary-filter">
                    <span>As on today</span>
                  </button>

                  <div className="accountant-fees-summary-total">
                    <span>Total Due</span>
                    <strong>{dashboardLoading ? "Loading..." : formatINR(summary.totalDue)}</strong>
                  </div>
                </div>
              </div>

              <div className="accountant-mini-cards">
                {quickCards.map((card) => (
                  <div
                    key={card.title}
                    className={`accountant-quick-card accountant-card ${
                      card.title === "Add Fees" && shouldHighlightAddFees
                        ? "accountant-quick-card-highlight"
                        : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={
                      card.title === "Create Fee type"
                        ? openCreateFeeTypePopup
                        : card.title === "Add Fees"
                          ? openAddFeesPopup
                          : openAssistantPanel
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      if (card.title === "Create Fee type") openCreateFeeTypePopup();
                      else if (card.title === "Add Fees") openAddFeesPopup();
                      else openAssistantPanel();
                    }}
                  >
                    <div className="">
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
                <div className="accountant-fees-collection-card accountant-card">
                  <div className="accountant-fees-collection-header">
                    <div className="Heading">Collect Fees</div>

                    <div className="accountant-fees-collection-tools">
                      <div className="accountant-fees-strength">
                        <strong>{filteredOutstandingStudents.length || feeStudents.length}</strong>
                        <span className="normalText"> Class Strength</span>
                      </div>

                      <input
                        type="text"
                        className="accountant-fees-search"
                        placeholder="Student Search..."
                        value={studentSearchTerm}
                        onChange={(event) => setStudentSearchTerm(event.target.value)}
                      />

                      <select
                        className="accountant-card-filter"
                        value={selectedClassFilter}
                        onChange={(event) => {
                          setSelectedClassFilter(event.target.value);
                          setSelectedSectionFilter("All");
                        }}
                      >
                        {classOptions.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls}
                          </option>
                        ))}
                      </select>

                      <select
                        className="accountant-card-filter"
                        value={selectedSectionFilter}
                        onChange={(event) => setSelectedSectionFilter(event.target.value)}
                      >
                        {sectionOptions.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="accountant-fees-student-grid">
                    {shouldHighlightAddFees ? (
                      <div className="accountant-fees-student-freeze-note">
                        Add fees for class {selectedClassFilter} - {selectedSectionFilter} first to unlock student collections.
                      </div>
                    ) : null}
                    {(filteredOutstandingStudents.length ? filteredOutstandingStudents : feeStudents).map((student, index) => (
                      (() => {
                        const cardId = student?.id ?? student?.student_id ?? index;
                        return (
                      <div
                        key={cardId}
                        className={`accountant-fees-student ${String(selectedStudentCardId) === String(cardId) ? "is-active" : ""} ${
                          shouldHighlightAddFees ? "is-frozen" : ""
                        }`}
                        role="button"
                        tabIndex={shouldHighlightAddFees ? -1 : 0}
                        aria-disabled={shouldHighlightAddFees}
                        onClick={() => {
                          if (shouldHighlightAddFees) {
                            openAddFeesPopup();
                            return;
                          }
                          if (student?.name || student?.StudentName) openPaymentGrid(student);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          if (shouldHighlightAddFees) {
                            openAddFeesPopup();
                            return;
                          }
                          if (student?.name || student?.StudentName) {
                            openPaymentGrid(student);
                          }
                        }}
                      >
                        <div className="accountant-fees-student-avatar">
                          <img src={userAvatar} alt="" />
                        </div>
                        <div className="blockText">{student.name || student.StudentName || "Student"}</div>
                        <div className="normalText">{student.className || student.Class_name || student.class_name || "Class"} {student.section || student.Section || student.section_name || ""}</div>
                        <span className="normalText">Due: {formatINR(student.dueAmount ?? getAnyNumber(student, ["Due_Amount", "Total_Due", "unpaidAmount", "Pending_Amount"]))}</span>
                      </div>
                        );
                      })()
                    ))}
                  </div>
                </div>

                <div className="accountant-fees-bottom-left-row">
                <div className="accountant-fees-log-card accountant-card">
                    <div className="accountant-fees-log-header">
                      <div className="accountant-fees-log-title">Activity Log</div>
                      <button
                        type="button"
                        className="accountant-view-bills-btn"
                        onClick={() => setIsBillsPopupOpen(true)}
                      >
                        View Bills
                      </button>
                    </div>
                    <div className="accountant-fees-log-list">
                      {recentFeeActivityItems.map((item) => (
                        <p key={item} className="accountant-fees-log-item">O {item}</p>
                      ))}
                    </div>
                  </div>

                  <div className="accountant-total-others-card accountant-card">
                    <div className="accountant-total-others-left">
                      <div className="accountant-total-strip-item">
                        <strong>Rs 23,496.00</strong>
                        <span>Others - Belt</span>
                      </div>

                      <div className="accountant-total-strip-item">
                        <strong>Rs 3,86,412.00</strong>
                        <span>Others - NR Books</span>
                      </div>
                    </div>

                    <div className="accountant-total-others-right">
                      <span className="blockText">Total Others</span>
                      <h2>{dashboardLoading ? "Loading..." : formatINR(summary.savingPaid)}</h2>
                      <div className="normalText">Collected Savings</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="accountant-fees-main-right">
                <div className="accountant-feetype-list-card accountant-card">
                  <div className="accountant-card-header accountant-feetype-header">
                    <div className="Heading">{isAssistantPopupOpen ? "Assistant" : isAddFeesPopupOpen ? "Selected Class Fees" : "Fee Type"}</div>

                    <div className="accountant-feetype-meta">
                      <button
                        type="button"
                        className="accountant-create-new-btn"
                        onClick={
                          isAssistantPopupOpen || isAddFeesPopupOpen
                            ? () => {
                                setIsAssistantPopupOpen(false);
                                setIsAddFeesPopupOpen(false);
                              }
                            : openCreateFeeTypePopup
                        }
                      >
                        {isAssistantPopupOpen || isAddFeesPopupOpen ? "Close" : "+ Add New"}
                      </button>
                      <div className="accountant-feetype-count">
                        <strong>
                          {isAssistantPopupOpen
                            ? assistantActionItems.length
                            : isAddFeesPopupOpen
                              ? addFeePreview.rows.length
                              : dynamicFeeTypes.length}
                        </strong>
                        <span>
                          {isAssistantPopupOpen
                            ? "Action items"
                            : isAddFeesPopupOpen
                              ? "Selected fees"
                              : "Fee Types"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="accountant-feetype-scroll">
                    {isAssistantPopupOpen ? (
                      <div className="accountant-assistant-panel">
                        <section className="accountant-assistant-inline-section accountant-assistant-inline-section-actions">
                          <div className="accountant-assistant-inline-header">
                            <h4>My Actions</h4>
                            <span>{assistantActionItems.length}</span>
                          </div>
                          <div className="accountant-assistant-actions">
                            {assistantActionItems.map((item, index) => (
                              <article key={`${item.title}-${index}`} className="accountant-assistant-action-card">
                                <div className="blockText">{item.title}</div>
                                <p className="normalText">{item.detail}</p>
                                <ol>
                                  {item.procedure.map((step, stepIndex) => (
                                    <li key={`${item.title}-${stepIndex}`}>{step}</li>
                                  ))}
                                </ol>
                              </article>
                            ))}
                          </div>
                        </section>
                      </div>
                    ) : isAddFeesPopupOpen ? (
                      <div className="accountant-feetype-list">
                        {addFeePreview.rows.length ? (
                          addFeePreview.rows.map((fee, index) => (
                            <div key={fee.id || index} className="accountant-feetype-list-item">
                              <span>
                                O {fee.feeName} - {fee.className || addFeePreview.className || "-"} {fee.section || addFeePreview.section || "-"} - Rs {Number(fee.amount || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="accountant-assistant-empty">
                            Select class and section in Add Fees to view fee details.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="accountant-feetype-list">
                        {dynamicFeeTypes.length ? (
                          dynamicFeeTypes.map((item) => (
                            <div key={item.id} className="accountant-feetype-list-item">
                              <span className="normalText">
                                O {item.feeName} - {item.feesType} - {item.scope} - {item.frequency}
                              </span>
                              
                            </div>
                          ))
                        ) : (
                          <div className="accountant-assistant-empty">No fee types available for this school yet.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="accountant-fees-right-mini-row">
                  <div className="accountant-income-card accountant-card">
                    <div className="accountant-income-ring accountant-progress-ring">
                      <div className="accountant-progress-ring-inner">
                        {dashboardLoading ? "..." : `${Math.round(summary.progress)}%`}
                      </div>
                    </div>
                    <div className="blockText">Income & Exp.</div>
                    <div className="normalText">Percentile Profit</div>
                  </div>

                  <div className="accountant-prevdue-card accountant-card">
                    <p className="accountant-prevdue-amount">
                      {dashboardLoading ? "Loading..." : formatINR(previousYearDue)}
                    </p>
                    <div className="blockText">Previous Year Due</div>
                    <div className="normalText">Pending Dues for Yr. {previousYearLabel}</div>
                  </div>
                </div>

                <div className="accountant-total-strip accountant-card">
                  <div className="accountant-total-strip-list">
                    <div className="accountant-total-strip-item">
                      <strong>{dashboardLoading ? "Loading..." : formatINR(summary.busDue)}</strong>
                      <span>Transport Due</span>
                    </div>

                    <div className="accountant-total-strip-item">
                      <strong>{dashboardLoading ? "Loading..." : formatINR(summary.booksDue)}</strong>
                      <span>Books Due</span>
                    </div>

                    <div className="accountant-total-strip-item">
                      <strong>{dashboardLoading ? "Loading..." : formatINR(summary.tuitionDue)}</strong>
                      <span>Tuition Due</span>
                    </div>
                  </div>

                  <div className="accountant-total-strip-right">
                    <span>Total Due</span>
                    <h2>{dashboardLoading ? "Loading..." : formatINR(summary.totalDue)}</h2>
                    <p>
                      {new Date().toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
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

      {isPaymentPopupOpen && (
        <div>
          <div
            style={{
              position: "fixed",
              top: "14px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 4200,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "8px 14px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#111827",
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            }}
          >
            Student: {popupSelection.studentName || "N/A"}
          </div>
          <PayementDemo
            className={popupSelection.className}
            sectionName={popupSelection.sectionName}
            popupOnly
            initialStudentId={popupSelection.studentId}
            initialStudentName={popupSelection.studentName}
            onPopupClose={() => setIsPaymentPopupOpen(false)}
            onPaymentSuccess={async () => {
              await fetchDashboardData();
              await fetchPreviousYearDue();
              await refreshPaymentSummaryMap();
            }}
          />
        </div>
      )}

      {isCreateFeeTypePopupOpen && (
        <div
          className="globalpopup-overlay"
          onClick={() => setIsCreateFeeTypePopupOpen(false)}
          style={{ zIndex: 3100 }}
        >
          <div
            className="globalpopup-content accountant-create-fee-popup"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="globalpopup-header accountant-create-fee-popup-header">
              <div className="accountant-create-fee-popup-heading">
                <span className="accountant-create-fee-kicker">Fee Master</span>
                <h3 className="accountant-create-fee-popup-title">Create New Fee Type</h3>
                <p className="accountant-create-fee-popup-subtitle">Add a fee type for this school dashboard</p>
              </div>
              <button
                type="button"
                className="globalpopup-close-btn"
                onClick={() => setIsCreateFeeTypePopupOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="accountant-create-fee-form" onSubmit={handleCreateFeeType}>
              <div className="accountant-create-fee-row">
                <label className="accountant-create-fee-label">
                  Fees Type
                  <input
                    type="text"
                    value={newFeeTypeForm.feesType}
                    onChange={(event) =>
                      setNewFeeTypeForm((prev) => ({ ...prev, feesType: event.target.value }))
                    }
                    placeholder="Enter Fee type name"
                    className="accountant-create-fee-input"
                  />
                </label>

                <label className="accountant-create-fee-label">
              Scope
              <select
                value={newFeeTypeForm.scope || ""}
                onChange={(event) =>
                  setNewFeeTypeForm((prev) => ({ ...prev, scope: event.target.value }))
                }
                    className="accountant-create-fee-input"
                  >
                <option value="" disabled hidden>
                  -- Select Scope --
                </option>
                <option value="All">All</option>
                <option value="Class wise">Class wise</option>
                <option value="Individual">Individual</option>
              </select>
            </label>
              </div>

              <div className="accountant-create-fee-row">
                <label className="accountant-create-fee-label">
                  One time / Term fees
                  <select
                    value={newFeeTypeForm.frequency || ""}
                    onChange={(event) =>
                      setNewFeeTypeForm((prev) => ({
                        ...prev,
                        frequency: event.target.value,
                        installments: event.target.value === "Term wise" ? prev.installments : "",
                      }))
                    }
                    className="accountant-create-fee-input"
                  >
                    <option value="" disabled hidden>
                      -- Select Frequency --
                    </option>
                    <option value="One time">One time</option>
                    <option value="Term wise">Term wise</option>
                  </select>
                </label>

                <label className="accountant-create-fee-label">
                  Installment
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newFeeTypeForm.frequency === "Term wise" ? (newFeeTypeForm.installments || "") : ""}
                    onChange={(event) =>
                      setNewFeeTypeForm((prev) => ({
                        ...prev,
                        installments: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                    disabled={newFeeTypeForm.frequency !== "Term wise"}
                    className="accountant-create-fee-input"
                  />
                </label>
              </div>

              {createFeeTypeError ? <p className="accountant-create-fee-error">{createFeeTypeError}</p> : null}

              <div className="accountant-create-fee-actions">
                <button
                  type="button"
                  className="accountant-create-fee-cancel"
                  onClick={() => setIsCreateFeeTypePopupOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="accountant-create-fee-submit" disabled={createFeeTypeLoading}>
                  {createFeeTypeLoading ? "Saving..." : "Save Fee Type"}
                </button>
              </div>
            </form>
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

      {isBillsPopupOpen &&
        createPortal(
          <div
            className="globalpopup-overlay accountant-bills-popup-overlay"
            onClick={() => setIsBillsPopupOpen(false)}
            style={{ zIndex: 3300 }}
          >
            <div
              className="globalpopup-content accountant-bills-popup"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="globalpopup-header accountant-bills-popup-header">
                
                <button
                  type="button"
                  className="globalpopup-close-btn"
                  onClick={() => setIsBillsPopupOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="accountant-bills-popup-body">
                <GenerateBills />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AccountantFeesPageNew;
