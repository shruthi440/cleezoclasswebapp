import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import IncomeForm5 from "../shared/IncomeformTwo.jsx";
import DiscountsPanel from "./Accounatant_FeesManagement_Discounts.jsx";
import DashboardLayout from "../components/DashboardLayout.jsx";
import "./FrontDesk_Tickets.css";
import "./dashboardGlobal.css"
import "./PopupStyles.css";

import collectFeeIcon from "../assets/collect.png";
import addFeeIcon from "../assets/Navbar-AddFee.png";
import expenseIcon from "../assets/Navbar-Expenses.png";


import reportIcon from "../assets/Reports.png";
import dashboardIcon from "../assets/Dashboard.png";
import addStudentIcon from "../assets/Enrollment.png";
import createFeeIcon from "../assets/create-fee.png";

import { FaEdit, FaUser } from "react-icons/fa";
import TaskOfTheDay from "../shared/TaskOfTheDay.tsx";

import addFeesIcon from "../assets/add-fee.png";
import assistantIcon from "../assets/Assistant.png";
import logoab from "../assets/logoab.png";
import userAvatar from "../assets/user.png";
import premiumIcon from "../assets/Go Premium.png";

const ADMIN_API_BASE = "https://cleezoclass.com:4000/api/admin";

const assistantActionItems = [
  {
    title: "Top Unpaid Student Follow-up",
    detail: "Reduce overdue fee risk by contacting highest due students first.",
    procedure: [
      "Open Unpaid Students list and sort by due amount descending.",
      "Call guardian and confirm exact pending amount and due date.",
      "Share payment link or branch counter details by WhatsApp/SMS.",
      "Record follow-up status: Paid / Promise date / No response.",
      "Escalate no-response cases after 2 follow-ups to management.",
    ],
  },
  {
    title: "Discount Verification and Approval",
    detail: "Ensure discounts are valid, approved, and correctly posted.",
    procedure: [
      "Open Discount Students section and verify discount amount per student.",
      "Check approval source (principal/management) and reason.",
      "Cross-check fee ledger after discount application.",
      "Reject or hold requests missing approval proof.",
      "Publish final approved list for finance records.",
    ],
  },
  {
    title: "Weekly High Expense Review",
    detail: "Control cash outflow by reviewing top expense categories every week.",
    procedure: [
      "Open expense summary and identify top 3 categories.",
      "Compare this week spend vs last week trend.",
      "Flag unusual jumps greater than 20%.",
      "Validate bills/vouchers and payment method used.",
      "Send weekly variance summary to Chief/Admin.",
    ],
  },
  {
    title: "Balance Recovery Plan",
    detail: "Convert pending balances into collections through daily tracking.",
    procedure: [
      "Track class-wise pending balance each morning.",
      "Assign collector/caller with target amount for the day.",
      "Send reminder messages before school closing time.",
      "Update paid entries immediately after confirmation.",
      "Carry forward unresolved dues to next-day priority list.",
    ],
  },
  {
    title: "Fee Posting Audit",
    detail: "Prevent mismatches between collected amount and ledger entries.",
    procedure: [
      "Match cash/UPI/bank receipts with system entries.",
      "Verify installment, transport, and exam fee splits.",
      "Check discount and concession adjustments.",
      "Correct posting errors before day-end close.",
      "Keep audit note for corrected transactions.",
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

const stripClassPrefix = (value) =>
  String(value || "")
    .replace(/^Class\s+/i, "")
    .trim();



const AccountantDashboard = () => {
  const navigate = useNavigate();
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
  const [unpaidStudents, setUnpaidStudents] = useState([]);
  const [allFeeStatusRows, setAllFeeStatusRows] = useState([]);
  const [studentDirectory, setStudentDirectory] = useState([]);
  const [paymentSummaryMap, setPaymentSummaryMap] = useState({});
  const [selectedClassSectionFeeRows, setSelectedClassSectionFeeRows] = useState([]);
  const [selectedClassFeeStructure, setSelectedClassFeeStructure] = useState(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState("All");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("All");
  const [isPaymentPopupOpen, setIsPaymentPopupOpen] = useState(false);
  const [paymentPopupApiRows, setPaymentPopupApiRows] = useState([]);
  const [popupStudentPaymentData, setPopupStudentPaymentData] = useState(null);
  const [paymentPopupLoading, setPaymentPopupLoading] = useState(false);
  const [paymentPopupError, setPaymentPopupError] = useState("");
  const [paymentPopupTab, setPaymentPopupTab] = useState("studentData");
  const [popupFeeStatusRows, setPopupFeeStatusRows] = useState([]);
  const [popupFeeStructure, setPopupFeeStructure] = useState(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState("/default-logo.png");
  const [schoolName, setSchoolName] = useState("Loading...");
  const [instituteAddress, setInstituteAddress] = useState("");
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    gender: "",
    phone_no: "",
    email: "",
  });
  const [profileSaveStatus, setProfileSaveStatus] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [isStudentManagementPopupOpen, setIsStudentManagementPopupOpen] = useState(false);
  const [ticketActiveTab, setTicketActiveTab] = useState("staff");
  const [ticketTeachers, setTicketTeachers] = useState([]);
  const [ticketLoadingTeachers, setTicketLoadingTeachers] = useState(false);
  const [ticketSelectedTeacherId, setTicketSelectedTeacherId] = useState(null);
  const [ticketClassList, setTicketClassList] = useState([]);
  const [ticketSectionMap, setTicketSectionMap] = useState([]);
  const [ticketSelectedClassSection, setTicketSelectedClassSection] = useState("");
  const [ticketClassName, setTicketClassName] = useState("");
  const [ticketSection, setTicketSection] = useState("");
  const [ticketStudents, setTicketStudents] = useState([]);
  const [ticketSearchTerm, setTicketSearchTerm] = useState("");
  const [ticketDropdownLoading, setTicketDropdownLoading] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketTarget, setTicketTarget] = useState(null);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketSuccess, setTicketSuccess] = useState("");
  const [ticketError, setTicketError] = useState("");

  const [isAddFeesPopupOpen, setIsAddFeesPopupOpen] = useState(false);
  const [addFeesPanelTab, setAddFeesPanelTab] = useState("fees");
  const [addFeePreview, setAddFeePreview] = useState({
    className: "",
    section: "",
    rows: [],
  });
  const [popupSelection, setPopupSelection] = useState({ className: "", sectionName: "" });
  const [previousYearDue, setPreviousYearDue] = useState(0);
  const [dynamicFeeTypes, setDynamicFeeTypes] = useState([]);
  const [isCreateFeeTypePopupOpen, setIsCreateFeeTypePopupOpen] = useState(false);
  const [isAssistantPopupOpen, setIsAssistantPopupOpen] = useState(false);
  const [isOutgoingStudentsPopupOpen, setIsOutgoingStudentsPopupOpen] = useState(false);
  const [discountStudents, setDiscountStudents] = useState([]);
  const [discountStudentsLoading, setDiscountStudentsLoading] = useState(false);
  const [createFeeTypeLoading, setCreateFeeTypeLoading] = useState(false);
  const [createFeeTypeError, setCreateFeeTypeError] = useState("");
  const [newFeeTypeForm, setNewFeeTypeForm] = useState({
    feesType: "",
    scope: "",
    frequency: "",
    installments: "",
  });
  const previousYearLabel = "2024-2025";

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

  const getDiscountTotalForRow = useCallback(
    (row) => {
      const explicitDiscount = getAnyNumber(row, [
        "Discount",
        "Total_Discount",
        "Concession",
        "feeDiscount",
        "Discount_Amount",
        "discount_amount",
        "discount",
      ]);

      if (explicitDiscount > 0) return explicitDiscount;

      return getDynamicTotalBySuffix(row, "discount", [
        "discount",
        "Discount",
        "Total_Discount",
        "Concession",
        "feeDiscount",
        "Discount_Amount",
        "discount_amount",
      ]);
    },
    [getAnyNumber]
  );

  const getFeeTypeDiscountForRow = useCallback(
    (row, feeType) => {
      const normalized = String(feeType || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

      const discountKeys = [
        `${normalized}_discount`,
        `${normalized}_Discount`,
        `${normalized}Discount`,
      ];

      if (normalized === "class_fee" || normalized === "classfee") {
        return getDiscountTotalForRow(row);
      }

      if (normalized === "books" || normalized === "book" || normalized === "books_fee" || normalized === "book_fee") {
        discountKeys.push("fee_discount", "books_discount", "book_discount");
      }

      if (normalized === "tuition") {
        discountKeys.push("tuition_discount");
      }

      if (normalized === "bus") {
        discountKeys.push("bus_discount");
      }

      return getAnyNumber(row, discountKeys) || 0;
    },
    [getAnyNumber, getDiscountTotalForRow]
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

      const discount = getDiscountTotalForRow(row);
      const expected = expectedDirect > 0 ? expectedDirect : expectedFromParts;
      const effectiveExpected = Math.max(expected - discount, 0);
      const paid = paidDirect > 0 ? paidDirect : paidFromParts;
      let unpaid = Math.max(effectiveExpected - paid, 0);
      const explicitRemaining = getExplicitRemainingAmount(row);

      if (discount <= 0 && explicitRemaining > 0) {
        unpaid = explicitRemaining;
      }

      if (effectiveExpected === 0 && paid === 0) {
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

      return { expected: effectiveExpected, paid, unpaid };
    },
    [getAnyNumber, getDiscountTotalForRow, toNumber]
  );

  const normalizeUserPhoto = (rawPhoto) => {
    if (!rawPhoto) return "";
    if (typeof rawPhoto === "string") {
      const trimmed = rawPhoto.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("data:")) return trimmed;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      return `data:image/jpeg;base64,${trimmed}`;
    }
    if (rawPhoto?.data) {
      const bytes = rawPhoto.data?.data || rawPhoto.data;
      if (Array.isArray(bytes)) {
        const binary = bytes.map((byte) => String.fromCharCode(byte)).join("");
        return `data:image/jpeg;base64,${btoa(binary)}`;
      }
    }
    return "";
  };

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

  const formatDisplayDate = useCallback((value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

  const getStudentName = useCallback(
    (student) => student?.StudentName || student?.name || student?.studentName || "Student",
    []
  );

  const getDueAmount = useCallback(
    (student) =>
      Number(student?.Due_Amount ?? student?.Total_Due ?? student?.dueAmount ?? student?.unpaidAmount ?? 0),
    []
  );

  const getDiscountAmount = useCallback(
    (student) => Number(student?.Discount ?? student?.discount ?? student?.Discount_Amount ?? 0),
    []
  );

  const getStudentClassName = useCallback(
    (student) => String(student?.Class_name || student?.class_name || student?.className || "").trim(),
    []
  );

  const getStudentSectionName = useCallback(
    (student) => String(student?.Section || student?.section || student?.sectionName || "").trim(),
    []
  );

  const normalizeClassLabel = useCallback(
    (value) => String(value || "").replace(/^Class\s+/i, "").trim().toLowerCase(),
    []
  );
  const normalizeSectionLabel = useCallback((value) => String(value || "").trim().toLowerCase(), []);
  const formatFeeTypeLabel = useCallback((value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return "Fee";
    return normalized
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }, []);
  const allowedCustomFeeKeys = useMemo(() => {
    const keys = new Set([
      "sports",
      "stationary",
      "stationery",
      "guides",
      "belt",
      "tie",
      "tie_fee",
      "library",
      "books",
      "book",
      "transport",
      "transport_fee",
      "hostel",
      "mess",
      "saving",
      "savings",
    ]);

    (dynamicFeeTypes || []).forEach((fee) => {
      const normalized = String(fee?.feeName || fee?.feesType || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (normalized) keys.add(normalized);
    });

    return keys;
  }, [dynamicFeeTypes]);
  const schoolCode = useMemo(() => localStorage.getItem("schoolCode") || "", []);
  const normalizeTicketStudentList = useCallback((payload) => {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.students)
        ? payload.students
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    return list
      .map((student, index) => ({
        ...student,
        id: student?.id ?? student?.student_id ?? student?.studentId ?? index,
        name: student?.name ?? student?.student_name ?? student?.full_name ?? `Student ${index + 1}`,
      }))
      .filter((student) => student.id != null);
  }, []);
  const getTicketClassLabel = useCallback((cls) => {
    if (cls == null) return "";
    if (typeof cls === "string" || typeof cls === "number") return String(cls);
    return cls.class_name || cls.className || cls.class || cls.name || cls.label || "";
  }, []);
  const getTicketTeacherId = useCallback(
    (teacher, index) =>
      teacher?.teacher_id ??
      teacher?.id ??
      teacher?.user_id ??
      teacher?.staff_id ??
      teacher?.employee_id ??
      teacher?.emp_id ??
      teacher?.teacherId ??
      teacher?.teacherID ??
      `staff-${index}`,
    []
  );
  const getTicketTeacherName = useCallback(
    (teacher) => teacher?.teacher_name ?? teacher?.name ?? teacher?.full_name ?? "Staff",
    []
  );
  const getProgressRingColor = useCallback((value) => {
    const percent = Math.max(0, Math.min(Number(value) || 0, 100));
    if (percent < 25) return "#f36b79";
    if (percent < 50) return "#f0a43a";
    if (percent < 75) return "#4e9d68";
    return "#2d7ff9";
  }, []);
  const renderProgressRing = useCallback(
    (value, label, className = "") => {
      const percent = Math.max(0, Math.min(Number(value) || 0, 100));
      const color = getProgressRingColor(percent);
      const radius = 20;
      const strokeWidth = 2.5;
      const center = 22;
      const angle = (percent / 100) * 360;
      const startX = center;
      const startY = center - radius;
      const endAngle = ((angle - 90) * Math.PI) / 180;
      const endX = center + radius * Math.cos(endAngle);
      const endY = center + radius * Math.sin(endAngle);
      const largeArcFlag = angle > 180 ? 1 : 0;
      const arcPath =
        percent <= 0
          ? ""
          : angle >= 359.999
            ? `M ${center} ${center - radius}
               A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`
            : `M ${startX} ${startY}
               A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;

      return (
        <div className={`accountant-progress-ring ${className}`.trim()}>
          <svg
            viewBox="0 0 44 44"
            width="100%"
            height="100%"
            aria-hidden="true"
            style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0, overflow: "visible" }}
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#e3e3e3"
              strokeWidth={strokeWidth}
            />
            {arcPath ? (
              <path
                d={arcPath}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            ) : null}
          </svg>
          <div className="accountant-progress-ring-inner">{label}</div>
        </div>
      );
    },
    [getProgressRingColor]
  );

  const buildFeeRowsFromStudentSummary = useCallback(
    (row) => {
      if (!row) return [];

      const paidDate = formatDisplayDate(
        row?.paidDate || row?.record_date || row?.payment_date || row?.Receipt_Date || row?.createdAt || row?.date || ""
      );

      const feeConfigs = [
        {
          feeType: "Class Fee",
          totalKeys: ["CompleteFee", "complete_fee", "UpdatedCompleteFee", "updatedCompleteFee"],
          paidKeys: ["Paid_Amount", "paid_amount", "Total_Paid", "totalPaid", "dynamicFeePaidTotal"],
          dueKeys: ["Remaining_Amount", "remaining_amount", "Total_Due", "Due_Amount"],
        },
        {
          feeType: "Admission",
          totalKeys: ["admissionFee", "Admission_fees", "Admission_Fees"],
          paidKeys: ["admissionPaid", "Admission_paid"],
          dueKeys: ["admissionRemaining", "Admission_due", "Admission_Remaining"],
        },
        {
          feeType: "Books",
          totalKeys: ["bookFee", "Book_Fees", "StudentBooksFee"],
          paidKeys: ["bookPaid", "books_paid", "Books_Uniform_Paid"],
          dueKeys: ["bookRemaining", "book_due", "Book_Due", "Books_Due"],
        },
        {
          feeType: "Uniform",
          totalKeys: ["uniformFee", "Uniform_fees"],
          paidKeys: ["uniformPaid", "uniform_paid"],
          dueKeys: ["uniformRemaining", "uniform_due", "Uniform_Due"],
        },
        {
          feeType: "Bus",
          totalKeys: ["Bus_fees", "Bus_Fees", "busFee", "Transport_Fee"],
          paidKeys: ["bus_paid", "Bus_paid", "transport_paid"],
          dueKeys: ["bus_remaining", "Bus_Due", "transport_due", "Transport_Due"],
        },
        {
          feeType: "Exam",
          totalKeys: ["Exam_fees", "Exam_Fees", "examFee"],
          paidKeys: ["exam_paid", "Exam_paid"],
          dueKeys: ["exam_remaining", "Exam_Due", "exam_due"],
        },
        {
          feeType: "Others",
          totalKeys: ["Others", "otherFee", "Other_Fee"],
          paidKeys: ["others_paid", "Other_paid"],
          dueKeys: ["others_remaining", "Others_Due", "other_due"],
        },
        {
          feeType: "Tuition",
          totalKeys: ["Tuition_Fee", "TuitionFee", "Calculated_Tuition_Fee"],
          paidKeys: ["TuitionPaid", "paid_amount", "Paid_Amount"],
          dueKeys: ["tuitionRemaining", "Tuition_Due", "tuition_due", "TuitionDue"],
        },
        {
          feeType: "Sports",
          totalKeys: ["sports", "sport"],
          paidKeys: ["sports_paid", "sport_paid"],
          dueKeys: ["sports_due", "sport_due"],
        },
        {
          feeType: "Stationary",
          totalKeys: ["stationary", "stationery"],
          paidKeys: ["stationary_paid", "stationery_paid"],
          dueKeys: ["stationary_due", "stationery_due"],
        },
        {
          feeType: "Guides",
          totalKeys: ["guides", "guide"],
          paidKeys: ["guides_paid", "guide_paid"],
          dueKeys: ["guides_due", "guide_due"],
        },
        {
          feeType: "Belt",
          totalKeys: ["belt", "belt_fee"],
          paidKeys: ["belt_paid", "belt_fee_paid"],
          dueKeys: ["belt_due", "belt_fee_due"],
        },
        {
          feeType: "Tie",
          totalKeys: ["tie_fee", "tie"],
          paidKeys: ["tie_fee_paid", "tie_paid"],
          dueKeys: ["tie_fee_due", "tie_due"],
        },
        {
          feeType: "Saving",
          totalKeys: ["Saving_Fees", "saving_fees", "Savings_Fees"],
          paidKeys: ["Saving_paid", "saving_paid", "Savings_paid"],
          dueKeys: ["Saving_Due", "saving_due", "Savings_Due"],
        },
      ];

      const normalizeFeeKey = (value) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "");

      const coveredKeys = new Set(
        feeConfigs.flatMap((config) => [
          ...config.totalKeys.map((key) => normalizeFeeKey(key)),
          ...config.paidKeys.map((key) => normalizeFeeKey(key)),
          ...config.dueKeys.map((key) => normalizeFeeKey(key)),
          normalizeFeeKey(config.feeType),
        ])
      );
      const customRows = [];

      const standardRows = feeConfigs
        .map((config, index) => {
          const rawTotalAmount = getAnyNumber(row, config.totalKeys);
          const paidAmount = getAnyNumber(row, config.paidKeys);
          const discountAmount = getFeeTypeDiscountForRow(row, config.feeType);
          const totalAmount = rawTotalAmount;
          const dueAmount =
            getAnyNumber(row, config.dueKeys) ||
            (totalAmount > 0 || paidAmount > 0 ? Math.max(totalAmount - discountAmount - paidAmount, 0) : 0);
          const hasDetailedFeeValues = [...config.totalKeys, ...config.paidKeys].some((key) => {
            const value = row?.[key];
            return value !== undefined && value !== null && String(value).trim() !== "" && Number(value) !== 0;
          });

          if (!hasDetailedFeeValues) return null;
          if (totalAmount <= 0 && paidAmount <= 0 && dueAmount <= 0) return null;

          return {
            id: `${getStudentCompositeKey(row)}-${config.feeType}-${index}`,
            studentName: row?.StudentName || row?.studentName || row?.name || row?.Student_Name || "Student",
            className: row?.Class_name || row?.class_name || row?.className || "-",
            section: row?.Section || row?.section || row?.sectionName || "-",
            feeType: config.feeType,
            discountAmount,
            totalAmount,
            paidAmount,
            dueAmount,
            paymentDate: paidDate,
          };
        })
        .filter(Boolean);

      const dynamicRows = (dynamicFeeTypes || [])
        .map((fee, index) => {
          const rawFeeName = String(fee?.feeName || fee?.feesType || fee?.label || "").trim();
          const normalizedKey = normalizeFeeKey(fee?.columnBase || rawFeeName);
          if (!normalizedKey) return null;
          if (coveredKeys.has(normalizedKey)) return null;

          const aliases = [
            normalizedKey,
            rawFeeName,
            `${normalizedKey}_total`,
            `${normalizedKey}_amount`,
          ].filter(Boolean);

          const totalAmount = getAnyNumber(row, aliases);
          const paidAmount = getAnyNumber(row, [
            `${normalizedKey}_paid`,
            `${normalizedKey}Paid`,
            `${rawFeeName}_paid`,
            `${rawFeeName}Paid`,
          ]);
          const discountAmount = getAnyNumber(row, [
            `${normalizedKey}_discount`,
            `${normalizedKey}Discount`,
            `${rawFeeName}_discount`,
            `${rawFeeName}Discount`,
          ]);
          const dueAmount = getAnyNumber(row, [
            `${normalizedKey}_due`,
            `${normalizedKey}Due`,
            `${rawFeeName}_due`,
            `${rawFeeName}Due`,
          ]) || Math.max(totalAmount - discountAmount - paidAmount, 0);

          if (totalAmount <= 0 && paidAmount <= 0 && discountAmount <= 0 && dueAmount <= 0) {
            return null;
          }

          return {
            id: `${getStudentCompositeKey(row)}-${normalizedKey}-${index}`,
            studentName: row?.StudentName || row?.studentName || row?.name || row?.Student_Name || "Student",
            className: row?.Class_name || row?.class_name || row?.className || "-",
            section: row?.Section || row?.section || row?.sectionName || "-",
            feeType: formatFeeTypeLabel(rawFeeName || normalizedKey),
            discountAmount,
            totalAmount,
            paidAmount,
            dueAmount,
            paymentDate: paidDate,
          };
        })
        .filter(Boolean);

      Object.entries(row || {}).forEach(([rawKey, rawValue]) => {
        const normalizedKey = normalizeFeeKey(rawKey);
        if (!normalizedKey) return;
        if (coveredKeys.has(normalizedKey)) return;

        if (
          normalizedKey === "id" ||
          normalizedKey === "student_id" ||
          normalizedKey === "studentname" ||
          normalizedKey === "student_name" ||
          normalizedKey === "name" ||
          normalizedKey === "class_name" ||
          normalizedKey === "classname" ||
          normalizedKey === "section" ||
          normalizedKey === "section_name" ||
          normalizedKey === "father_name" ||
          normalizedKey === "mobile_no" ||
          normalizedKey === "phone_no" ||
          normalizedKey === "admission_no" ||
          normalizedKey === "gender" ||
          normalizedKey === "email" ||
          normalizedKey === "discount" ||
          normalizedKey === "record_date" ||
          normalizedKey === "payment_date" ||
          normalizedKey === "created_at" ||
          normalizedKey === "updated_at" ||
          normalizedKey === "completefee" ||
          normalizedKey === "complete_fee" ||
          normalizedKey.startsWith("total_") ||
          normalizedKey.startsWith("dynamicfee") ||
          normalizedKey.endsWith("_paid") ||
          normalizedKey.endsWith("_due") ||
          normalizedKey.endsWith("_discount")
        ) {
          return;
        }

        if (!allowedCustomFeeKeys.has(normalizedKey)) return;

        const totalAmount = Number(rawValue);
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) return;

        const paidAmount = getAnyNumber(row, [
          `${rawKey}_paid`,
          `${rawKey}_Paid`,
          `${normalizedKey}_paid`,
          `${normalizedKey}_Paid`,
        ]);
        const discountAmount = getAnyNumber(row, [
          `${rawKey}_discount`,
          `${rawKey}_Discount`,
          `${rawKey}Discount`,
          `${normalizedKey}_discount`,
          `${normalizedKey}_Discount`,
          `${normalizedKey}Discount`,
        ]);
        const dueAmount = getAnyNumber(row, [
          `${rawKey}_due`,
          `${rawKey}_Due`,
          `${normalizedKey}_due`,
          `${normalizedKey}_Due`,
        ]) || Math.max(totalAmount - discountAmount - paidAmount, 0);

        const label = formatFeeTypeLabel(rawKey);
        const rowIdKey = `${getStudentCompositeKey(row)}-${normalizedKey}`;

        customRows.push({
          id: rowIdKey,
          studentName: row?.StudentName || row?.studentName || row?.name || row?.Student_Name || "Student",
          className: row?.Class_name || row?.class_name || row?.className || "-",
          section: row?.Section || row?.section || row?.sectionName || "-",
          feeType: label,
          discountAmount,
          totalAmount,
          paidAmount,
          dueAmount,
          paymentDate: paidDate,
        });
      });

      const combinedRows = [...standardRows, ...dynamicRows, ...customRows];
      const dedupedRows = [];
      const seenRows = new Set();

      combinedRows.forEach((item) => {
        const dedupeKey = [
          String(item?.studentName || "").trim().toLowerCase(),
          String(item?.className || "").trim().toLowerCase(),
          String(item?.section || "").trim().toLowerCase(),
          String(item?.feeType || "").trim().toLowerCase(),
        ].join("|");

        if (seenRows.has(dedupeKey)) return;
        seenRows.add(dedupeKey);
        dedupedRows.push(item);
      });

      return dedupedRows;
    },
    [
      allowedCustomFeeKeys,
      dynamicFeeTypes,
      formatDisplayDate,
      getAnyNumber,
      getFeeTypeDiscountForRow,
    ]
  );

  const buildTransactionRowFromFeeRecord = useCallback(
    (row, index, fallbackSelection = {}) => {
      const rawFeeType = String(row?.fee_type || row?.feeType || row?.FeeType || row?.feeName || "Fee").trim();
      const normalizedFeeType = rawFeeType.toLowerCase().replace(/\s+/g, "_");
      const totals = getFeeTotalsForRow(row);

      const feeTypeColumnMap = {
        stationary: {
          totalKeys: ["stationary"],
          paidKeys: ["stationary_paid", "amount_paid"],
          dueKeys: ["stationary_due"],
        },
        sports: {
          totalKeys: ["sports"],
          paidKeys: ["sports_paid", "amount_paid"],
          dueKeys: ["sports_due"],
        },
        guides: {
          totalKeys: ["guides"],
          paidKeys: ["guides_paid", "amount_paid"],
          dueKeys: ["guides_due"],
        },
        belt: {
          totalKeys: ["belt"],
          paidKeys: ["belt_paid", "amount_paid"],
          dueKeys: ["belt_due"],
        },
        tie: {
          totalKeys: ["tie_fee", "tie"],
          paidKeys: ["tie_fee_paid", "tie_paid", "amount_paid"],
          dueKeys: ["tie_fee_due", "tie_due"],
        },
        books: {
          totalKeys: ["bookFee", "Book_Fees", "StudentBooksFee"],
          paidKeys: ["bookPaid", "books_paid", "Books_Uniform_Paid", "amount_paid"],
          dueKeys: ["bookRemaining", "book_due", "Book_Due", "Books_Due"],
        },
        tuition: {
          totalKeys: ["Tuition_Fee", "TuitionFee", "Calculated_Tuition_Fee"],
          paidKeys: ["TuitionPaid", "paid_amount", "Paid_Amount", "amount_paid"],
          dueKeys: ["tuitionRemaining", "Tuition_Due", "tuition_due", "TuitionDue"],
        },
        admission: {
          totalKeys: ["admissionFee", "Admission_fees", "Admission_Fees"],
          paidKeys: ["admissionPaid", "Admission_paid", "amount_paid"],
          dueKeys: ["admissionRemaining", "Admission_due", "Admission_Remaining"],
        },
        uniform: {
          totalKeys: ["uniformFee", "Uniform_fees"],
          paidKeys: ["uniformPaid", "uniform_paid", "amount_paid"],
          dueKeys: ["uniformRemaining", "uniform_due", "Uniform_Due"],
        },
      };

      const feeConfig = feeTypeColumnMap[normalizedFeeType];
      const paidAmount = feeConfig
        ? getAnyNumber(row, feeConfig.paidKeys)
        : getAnyNumber(row, ["amount_paid", "paid_amount", "Paid_Amount", "Total_Paid", "totalPaid", "dynamicFeePaidTotal"]) || totals.paid;
      const discountAmount = getFeeTypeDiscountForRow(row, rawFeeType);
      const totalAmount = feeConfig
        ? getAnyNumber(row, feeConfig.totalKeys)
        : totals.expected > 0
          ? totals.expected
          : Math.max(paidAmount + totals.unpaid, 0);
      const dueAmount = feeConfig
        ? ((discountAmount <= 0 && getAnyNumber(row, feeConfig.dueKeys)) || Math.max(totalAmount - discountAmount - paidAmount, 0))
        : ((discountAmount <= 0 && getExplicitRemainingAmount(row)) || Math.max(totalAmount - discountAmount - paidAmount, 0));

      return {
        id: row?.id ?? row?.receiptNumber ?? `${getStudentCompositeKey(row)}-${rawFeeType}-${index}`,
        studentName:
          row?.StudentName || row?.studentName || row?.name || row?.Student_Name || fallbackSelection?.studentName || "Student",
        className: row?.Class_name || row?.class_name || row?.className || fallbackSelection?.className || "-",
        section: row?.Section || row?.section || row?.sectionName || fallbackSelection?.sectionName || "-",
        feeType: rawFeeType || "Fee",
        discountAmount,
        totalAmount,
        paidAmount,
        dueAmount,
        paymentDate: formatDisplayDate(
          row?.record_date || row?.payment_date || row?.Receipt_Date || row?.createdAt || row?.date || row?.paidDate || ""
        ),
      };
    },
    [formatDisplayDate, getAnyNumber, getFeeTypeDiscountForRow, getFeeTotalsForRow]
  );

  const safeSessionSet = useCallback((key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Ignore session storage quota errors to avoid breaking dashboard render.
    }
  }, []);

  useEffect(() => {
    const lockClass = "accountant-dashboard-scroll-lock";
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const app = document.querySelector(".App");

    html.classList.add(lockClass);
    body.classList.add(lockClass);
    root?.classList.add(lockClass);
    app?.classList.add(lockClass);

    return () => {
      html.classList.remove(lockClass);
      body.classList.remove(lockClass);
      root?.classList.remove(lockClass);
      app?.classList.remove(lockClass);
    };
  }, []);

  const fetchDashboardData = useCallback(async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;
    const fromDate = "2000-01-01";
    const toDate = "2099-12-31";
    const summaryCacheKey = `accountantDashboardSummary:${schoolCode}`;
    const unpaidCacheKey = `accountantDashboardUnpaid:${schoolCode}`;
    const previousDueCacheKey = `accountantDashboardPreviousDue:${schoolCode}`;

    try {
      const cachedSummary = sessionStorage.getItem(summaryCacheKey);
      const cachedUnpaid = sessionStorage.getItem(unpaidCacheKey);
      const cachedPreviousDue = sessionStorage.getItem(previousDueCacheKey);

      if (cachedSummary) {
        try {
          setSummary(JSON.parse(cachedSummary));
        } catch {
          // ignore stale cache parse errors
        }
      }
      if (cachedUnpaid) {
        try {
          setUnpaidStudents(JSON.parse(cachedUnpaid));
        } catch {
          // ignore stale cache parse errors
        }
      }
      if (cachedPreviousDue) {
        const parsed = Number(cachedPreviousDue);
        if (Number.isFinite(parsed)) setPreviousYearDue(parsed);
      }

      setDashboardLoading(true);
      const [unpaidResult, summaryResult, allFeesResult, feeTypesResult, studentsResult] = await Promise.allSettled([
        axios.get("https://cleezoclass.com:4000/api/fee-records", {
          params: { type: "TotalDueList", schoolCode, fromDate, toDate },
        }),
        axios.get("https://cleezoclass.com:4000/api/fees-summary-ledgerData", {
          params: { schoolCode, year: "All", className: "All", section: "All" },
        }),
        axios.get("https://cleezoclass.com:4000/api/fee-records", {
          params: { type: "AllFeesStatusReport", schoolCode, fromDate, toDate },
        }),
        axios.get("https://cleezoclass.com:4000/api/fee-types", {
          params: { schoolCode, _t: Date.now() },
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
      const createdFeeTypes =
        feeTypesResult.status === "fulfilled" && Array.isArray(feeTypesResult.value.data?.data)
          ? feeTypesResult.value.data.data
          : [];
      const masterStudents =
        studentsResult?.status === "fulfilled" && Array.isArray(studentsResult.value?.data?.students)
          ? studentsResult.value.data.students
          : [];
      setUnpaidStudents(unpaid);
      setStudentDirectory(masterStudents);
      const createdFeeTypesNormalized = createdFeeTypes
        .filter((item) => String(item?.feeName || "").trim() !== "")
        .map((item) => ({
          id: item?.id,
          feeName: item?.feeName || "",
          feesType: item?.feesType || "Custom Fee",
          scope: item?.scope || "All",
          frequency: item?.frequency || "One time",
          installments: item?.installments || 1,
        }));
      setDynamicFeeTypes(createdFeeTypesNormalized);

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
        try {
          const fees = allFeesRows;

          let grossFallback = 0;
          let totalPaidFallback = 0;
          let concessionFallback = 0;
          let totalDueFallback = 0;

          fees.forEach((row) => {
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
        } catch (e) {
          // keep zero/default values when fallback API is unavailable
        }
      }
      const progress = netPayable > 0 ? (totalPaid / netPayable) * 100 : 0;
      const nextSummary = {
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
      };
      setSummary(nextSummary);
      safeSessionSet(summaryCacheKey, JSON.stringify(nextSummary));

      const compactUnpaid = (unpaid || []).slice(0, 400).map((row, index) => ({
        id: row?.id ?? row?.StudentId ?? row?.Admission_Number ?? `row-${index}`,
        StudentName: row?.StudentName || row?.studentName || row?.name || "",
        Class_name: row?.Class_name || row?.class_name || row?.className || "",
        Section: row?.Section || row?.section || "",
        unpaidAmount: getAnyNumber(row, ["unpaidAmount", "Due_Amount", "Total_Due", "Pending_Amount"]),
        Bus_Due: getAnyNumber(row, ["Bus_Due", "transport_due", "Transport_Due"]),
        Book_Due: getAnyNumber(row, ["Book_Due", "Books_Due", "books_due"]),
        Tuition_Due: getAnyNumber(row, ["Tuition_Due", "tuition_due", "TuitionDue"]),
      }));
      safeSessionSet(unpaidCacheKey, JSON.stringify(compactUnpaid));

      // Background fetch: do not block initial dashboard paint.
      void axios
        .get("https://cleezoclass.com:4000/api/fee-records-alldata", {
          params: { schoolCode, type: "PreviousPaidPendingReport", fromDate, toDate },
        })
        .then((res) => {
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
          safeSessionSet(previousDueCacheKey, String(due));
        })
        .catch(() => {
          // keep cached/current previous due value if background call fails
        });
    } catch (error) {
      console.error("Failed to load accountant dashboard data:", error);
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
      setDynamicFeeTypes([]);
    } finally {
      setDashboardLoading(false);
    }
  }, [getAnyNumber, getFeeTotalsForRow, safeSessionSet, toNumber]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!isAssistantPopupOpen && !(isAddFeesPopupOpen && addFeesPanelTab === "discount")) return;
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
      setDiscountStudents([]);
      return;
    }

    const fetchDiscountStudents = async () => {
      try {
        setDiscountStudentsLoading(true);
        const { data } = await axios.get("https://cleezoclass.com:4000/api/discounted-students", {
          params: { schoolCode },
        });
        setDiscountStudents(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load discount students:", error);
        setDiscountStudents([]);
      } finally {
        setDiscountStudentsLoading(false);
      }
    };

    fetchDiscountStudents();
  }, [addFeesPanelTab, isAddFeesPopupOpen, isAssistantPopupOpen]);

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
    if (!schoolCode || selectedClassFilter === "All" || selectedSectionFilter === "All") {
      setSelectedClassSectionFeeRows([]);
      return;
    }

    let isCancelled = false;

    axios
      .get("https://cleezoclass.com:4000/api/fee-payment-status", {
        params: {
          schoolCode,
          class_name: selectedClassFilter,
          section: selectedSectionFilter,
        },
      })
      .then((res) => {
        if (isCancelled) return;
        setSelectedClassSectionFeeRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (isCancelled) return;
        setSelectedClassSectionFeeRows([]);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedClassFilter, selectedSectionFilter]);

  useEffect(() => {
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

    let isCancelled = false;

    Promise.all(
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

          return [key, paymentPayload];
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (isCancelled) return;
      const nextMap = {};
      entries.forEach((entry) => {
        if (!entry) return;
        const [key, value] = entry;
        if (key) nextMap[key] = value;
      });
      setPaymentSummaryMap(nextMap);
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedClassFilter, selectedSectionFilter, studentDirectory]);

  const normalizedOutstandingStudents = useMemo(() => {
    const masterList = (studentDirectory || []).map((student, index) => ({
      id: student?.id ?? student?.student_id ?? `student-${index}`,
      name:
        student?.name ||
        student?.StudentName ||
        student?.studentName ||
        student?.Student_Name ||
        "Student",
      regNo:
        student?.admission_no ||
        student?.Admission_Number ||
        student?.admission_number ||
        student?.id ||
        "N/A",
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
      regNo:
        student?.Admission_Number ||
        student?.admission_no ||
        student?.admission_number ||
        student?.id ||
        "N/A",
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

  const paymentPopupTransactionRows = useMemo(() => {
    if (!isPaymentPopupOpen) return [];

    if (paymentPopupApiRows.length > 0) {
      return paymentPopupApiRows
        .map((row, index) => buildTransactionRowFromFeeRecord(row, index, popupSelection))
        .sort((a, b) => {
          if (a.studentName !== b.studentName) return a.studentName.localeCompare(b.studentName);
          if (a.feeType !== b.feeType) return a.feeType.localeCompare(b.feeType);
          return a.paymentDate.localeCompare(b.paymentDate);
        });
    }

    const selectedStudentKey = [
      String(popupSelection?.studentName || "").trim().toLowerCase(),
      String(popupSelection?.className || "").trim().toLowerCase(),
      String(popupSelection?.sectionName || "").trim().toLowerCase(),
    ].join("|");

    const matchesPopupSelection = (row) => {
      const sameClass =
        String(row?.Class_name || row?.class_name || row?.className || "").trim().toLowerCase() ===
        String(popupSelection?.className || "").trim().toLowerCase();
      const sameSection =
        String(row?.Section || row?.section || row?.sectionName || "").trim().toLowerCase() ===
        String(popupSelection?.sectionName || "").trim().toLowerCase();
      if (!sameClass || !sameSection) return false;
      if (!popupSelection?.studentName) return true;
      return getStudentCompositeKey(row) === selectedStudentKey;
    };

    const scopedRows = (allFeeStatusRows || []).filter(matchesPopupSelection);
    const fallbackRows = (unpaidStudents || []).filter(matchesPopupSelection);

    if (scopedRows.length > 0) {
      return scopedRows
        .map((row, index) => buildTransactionRowFromFeeRecord(row, index, popupSelection))
        .sort((a, b) => {
          if (a.studentName !== b.studentName) return a.studentName.localeCompare(b.studentName);
          if (a.feeType !== b.feeType) return a.feeType.localeCompare(b.feeType);
          return a.paymentDate.localeCompare(b.paymentDate);
        });
    }

    const summaryRows = fallbackRows.flatMap((row) => buildFeeRowsFromStudentSummary(row));

    if (summaryRows.length > 0) {
      return summaryRows.sort((a, b) => {
        if (a.studentName !== b.studentName) return a.studentName.localeCompare(b.studentName);
        return a.feeType.localeCompare(b.feeType);
      });
    }

    const rowsToRender = fallbackRows;

    return rowsToRender
      .map((row, index) => buildTransactionRowFromFeeRecord(row, index, popupSelection))
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [
    allFeeStatusRows,
    buildTransactionRowFromFeeRecord,
    buildFeeRowsFromStudentSummary,
    isPaymentPopupOpen,
    paymentPopupApiRows,
    popupSelection,
    unpaidStudents,
  ]);

  useEffect(() => {
    if (!isPaymentPopupOpen) {
      setPaymentPopupApiRows([]);
      setPopupStudentPaymentData(null);
      setPopupFeeStatusRows([]);
      setPopupFeeStructure(null);
      setPaymentPopupLoading(false);
      setPaymentPopupError("");
      setPaymentPopupTab("studentData");
      return;
    }

    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
      setPaymentPopupApiRows([]);
      setPaymentPopupError("School code missing.");
      return;
    }

    setPaymentPopupLoading(true);
    setPaymentPopupError("");

    axios
      .get("https://cleezoclass.com:4000/api/student-transactions-dynamic", {
        params: {
          schoolCode,
          studentName: popupSelection?.studentName || "",
          className: popupSelection?.className || "",
          section: popupSelection?.sectionName || "",
          includeUnpaid: 1,
        },
      })
      .then((res) => {
        setPaymentPopupApiRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch((error) => {
        console.error("Failed to load popup transactions:", error);
        setPaymentPopupApiRows([]);
        setPaymentPopupError("Failed to load transaction details.");
      })
      .finally(() => {
        setPaymentPopupLoading(false);
      });
  }, [isPaymentPopupOpen, popupSelection]);

  useEffect(() => {
    if (!isPaymentPopupOpen) {
      setPopupStudentPaymentData(null);
      return;
    }

    const schoolCode = localStorage.getItem("schoolCode");
    const studentId = popupSelection?.studentId;

    if (!schoolCode || !studentId) {
      setPopupStudentPaymentData(null);
      return;
    }

    let isCancelled = false;

    axios
      .get(`https://cleezoclass.com:4000/api/payment/${studentId}`, {
        params: { schoolCode },
      })
      .then((res) => {
        if (isCancelled) return;
        const paymentPayload = res?.data?.payments || res?.data?.payment || res?.data || null;
        setPopupStudentPaymentData(paymentPayload && typeof paymentPayload === "object" ? paymentPayload : null);
      })
      .catch((error) => {
        if (isCancelled) return;
        console.error("Failed to load popup student payment data:", error);
        setPopupStudentPaymentData(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [isPaymentPopupOpen, popupSelection?.studentId]);

  useEffect(() => {
    if (!isPaymentPopupOpen) {
      setPopupFeeStatusRows([]);
      return;
    }

    const schoolCode = localStorage.getItem("schoolCode");
    const className = stripClassPrefix(popupSelection?.className || "");
    const section = String(popupSelection?.sectionName || "").trim();

    if (!schoolCode || !className || !section) {
      setPopupFeeStatusRows([]);
      return;
    }

    let isCancelled = false;

    axios
      .get("https://cleezoclass.com:4000/api/fee-payment-status", {
        params: {
          schoolCode,
          class_name: className,
          section,
        },
      })
      .then((res) => {
        if (isCancelled) return;
        setPopupFeeStatusRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch((error) => {
        if (isCancelled) return;
        console.error("Failed to load popup fee status:", error);
        setPopupFeeStatusRows([]);
      });

    return () => {
      isCancelled = true;
    };
  }, [isPaymentPopupOpen, popupSelection]);

  useEffect(() => {
    if (!isPaymentPopupOpen) {
      setPopupFeeStructure(null);
      return;
    }

    const schoolCode = localStorage.getItem("schoolCode");
    const className = stripClassPrefix(popupSelection?.className || "");
    const section = String(popupSelection?.sectionName || "").trim();

    if (!schoolCode || !className || !section) {
      setPopupFeeStructure(null);
      return;
    }

    let isCancelled = false;

    axios
      .get(`https://cleezoclass.com:4000/feeStructure/${encodeURIComponent(className)}`, {
        params: {
          schoolCode,
          section,
        },
      })
      .then((res) => {
        if (isCancelled) return;
        setPopupFeeStructure(res.data?.feeStructure || res.data?.feeDetail || null);
      })
      .catch((error) => {
        if (isCancelled) return;
        console.error("Primary popup fee structure fetch failed:", error);
        return axios
          .get("https://cleezoclass.com:4000/api/feeDetailsByClassSection", {
            params: {
              schoolCode,
              className,
              section,
            },
          })
          .then((fallbackRes) => {
            if (isCancelled) return;
            setPopupFeeStructure(fallbackRes.data?.feeDetail || fallbackRes.data?.feeStructure || null);
          })
          .catch((fallbackError) => {
            if (isCancelled) return;
            console.error("Fallback popup fee structure fetch failed:", fallbackError);
            setPopupFeeStructure(null);
          });
      });

    return () => {
      isCancelled = true;
    };
  }, [isPaymentPopupOpen, popupSelection]);

  const paymentPopupSummary = useMemo(() => {
    const title = popupSelection?.studentName
      ? `${popupSelection.studentName} Fee Transactions`
      : `${popupSelection?.className || ""} ${popupSelection?.sectionName || ""} Student Transactions`.trim();

    return {
      title: title || "Student Transactions",
      studentCount: new Set(paymentPopupTransactionRows.map((row) => row.studentName)).size,
      totalAmount: paymentPopupTransactionRows.reduce((sum, row) => sum + row.totalAmount, 0),
      paidAmount: paymentPopupTransactionRows.reduce((sum, row) => sum + row.paidAmount, 0),
      dueAmount: paymentPopupTransactionRows.reduce((sum, row) => sum + row.dueAmount, 0),
    };
  }, [paymentPopupTransactionRows, popupSelection]);

  const paymentPopupGroupedRows = useMemo(() => {
    const grouped = new Map();

    paymentPopupTransactionRows.forEach((row) => {
      const key = [row.studentName, row.className, row.section, row.feeType].join("|");
      const currentTotal = Number(row.totalAmount || 0);
      const currentPaid = Number(row.paidAmount || 0);
      const currentDiscount = Number(row.discountAmount || 0);
      const currentDue = Number(row.dueAmount || 0);

      if (!grouped.has(key)) {
        grouped.set(key, {
          ...row,
          totalAmount: currentTotal,
          paidAmount: currentPaid,
          discountAmount: currentDiscount,
          dueAmount: currentDue,
        });
        return;
      }

      const existing = grouped.get(key);
      existing.totalAmount = Math.max(existing.totalAmount, currentTotal);
      existing.discountAmount = Math.max(existing.discountAmount, currentDiscount);
      existing.paidAmount += currentPaid;
      existing.paymentDate = row.paymentDate || existing.paymentDate;
      existing.dueAmount = Math.max(existing.totalAmount - existing.discountAmount - existing.paidAmount, 0);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.studentName !== b.studentName) return a.studentName.localeCompare(b.studentName);
      return a.feeType.localeCompare(b.feeType);
    });
  }, [paymentPopupTransactionRows]);

  const paymentPopupStudentDataFallbackRows = useMemo(() => {
    const popupStudentName = String(popupSelection?.studentName || "").trim().toLowerCase();
    const popupClassName = normalizeClassLabel(popupSelection?.className || "");
    const popupSectionName = normalizeSectionLabel(popupSelection?.sectionName || "");

    const selectedRows = (selectedClassSectionFeeRows || []).filter((row) => {
      const rowStudentName = String(
        row?.StudentName || row?.studentName || row?.name || row?.Student_Name || ""
      )
        .trim()
        .toLowerCase();
      const rowClassName = normalizeClassLabel(row?.Class_name || row?.class_name || row?.className || "");
      const rowSectionName = normalizeSectionLabel(row?.Section || row?.section || row?.sectionName || "");

      const classMatch = rowClassName === popupClassName || !popupClassName;
      const sectionMatch = rowSectionName === popupSectionName || !popupSectionName;
      const studentMatch = !popupStudentName || rowStudentName === popupStudentName;
      return classMatch && sectionMatch && studentMatch;
    });

    const mappedRows = selectedRows.flatMap((row) => buildFeeRowsFromStudentSummary(row));
    if (mappedRows.length > 0) {
      return mappedRows;
    }

    return [];
  }, [
    buildFeeRowsFromStudentSummary,
    popupSelection?.className,
    popupSelection?.sectionName,
    popupSelection?.studentName,
    selectedClassSectionFeeRows,
  ]);

  const popupSelectedFeeStatusRows = useMemo(() => {
    const popupStudentName = String(popupSelection?.studentName || "").trim().toLowerCase();
    const popupClassName = normalizeClassLabel(popupSelection?.className || "");
    const popupSectionName = normalizeSectionLabel(popupSelection?.sectionName || "");

    return (popupFeeStatusRows || []).filter((row) => {
      const rowStudentName = String(
        row?.StudentName || row?.studentName || row?.name || row?.Student_Name || ""
      )
        .trim()
        .toLowerCase();
      const rowClassName = normalizeClassLabel(row?.Class_name || row?.class_name || row?.className || "");
      const rowSectionName = normalizeSectionLabel(row?.Section || row?.section || row?.sectionName || "");

      const classMatch = rowClassName === popupClassName || !popupClassName;
      const sectionMatch = rowSectionName === popupSectionName || !popupSectionName;
      const studentMatch = !popupStudentName || rowStudentName === popupStudentName;

      return classMatch && sectionMatch && studentMatch;
    });
  }, [normalizeClassLabel, normalizeSectionLabel, popupFeeStatusRows, popupSelection?.className, popupSelection?.sectionName, popupSelection?.studentName]);

  const paymentPopupClassFeeStructureRows = useMemo(() => {
    const feeRowsFromStatus = popupSelectedFeeStatusRows.flatMap((row, index) =>
      buildFeeRowsFromStudentSummary({
        ...row,
        id: row?.id ?? `popup-fee-status-${index}`,
      })
    );

    if (feeRowsFromStatus.length > 0) {
      return feeRowsFromStatus;
    }

    const fallbackStudent = popupSelection?.studentName || "Student";
    const fallbackClass = popupSelection?.className || "-";
    const fallbackSection = popupSelection?.sectionName || "-";
    const fallbackKey = [
      String(fallbackStudent || "").trim().toLowerCase(),
      String(fallbackClass || "").trim().toLowerCase(),
      String(fallbackSection || "").trim().toLowerCase(),
    ].join("|");

    const normalizeFeeKey = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

    const prettyLabel = (value) =>
      String(value || "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());

    const ignoredKeys = new Set([
      "id",
      "login_id",
      "studentname",
      "student_name",
      "name",
      "classname",
      "class_name",
      "class",
      "section",
      "sectionname",
      "section_name",
      "feeclass",
      "feesection",
      "created_at",
      "updated_at",
      "record_date",
      "payment_date",
      "date",
      "discount",
      "totaldiscount",
      "concession",
      "paid_amount",
      "paidamount",
      "total_paid",
      "paid",
      "remaining_amount",
      "remaining",
      "due_amount",
      "due",
      "total_due",
      "completefee",
      "complete_fee",
      "calculated_tuition_fee",
      "updatedcompletefee",
      "updated_complete_fee",
      "advance_fee",
    ]);

    const rows = [];
    const entries = Object.entries(popupFeeStructure || {});

    entries.forEach(([rawKey, rawValue]) => {
      const normalizedKey = normalizeFeeKey(rawKey);
      if (!normalizedKey) return;
      if (ignoredKeys.has(normalizedKey)) return;
      if (normalizedKey.endsWith("_discount") || normalizedKey.endsWith("_paid") || normalizedKey.endsWith("_due")) {
        return;
      }

      const amount = Number(rawValue);
      if (!Number.isFinite(amount) || amount <= 0) return;

      rows.push({
        id: `popup-fee-${fallbackKey}-${normalizedKey}`,
        studentName: fallbackStudent,
        className: fallbackClass,
        section: fallbackSection,
        feeType: prettyLabel(rawKey),
        discountAmount: 0,
        totalAmount: amount,
        paidAmount: 0,
        dueAmount: amount,
        paymentDate: "-",
      });
    });

    rows.sort((a, b) => a.feeType.localeCompare(b.feeType));
    return rows;
  }, [
    buildFeeRowsFromStudentSummary,
    popupFeeStructure,
    popupSelectedFeeStatusRows,
    popupSelection?.className,
    popupSelection?.sectionName,
    popupSelection?.studentName,
  ]);

  const paymentPopupStudentPaymentRows = useMemo(() => {
    const payment = popupStudentPaymentData || {};
    const studentName = payment.studentName || payment.StudentName || popupSelection?.studentName || "Student";
    const className = payment.class || payment.Class_name || popupSelection?.className || "-";
    const section = payment.section || payment.Section || popupSelection?.sectionName || "-";
    const numeric = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const rows = [
      {
        id: "tuition-fee",
        studentName,
        className,
        section,
        feeType: "Tuition Fee",
        discountAmount: numeric(payment.tuitionDiscount || payment.discounts?.tuitionDiscount),
        totalAmount: numeric(payment.completeFee || payment.originalCompleteFee),
        paidAmount: numeric(payment.paidAmount),
        dueAmount: numeric(payment.tuitionRemaining),
        paymentDate: "-",
      },
      {
        id: "admission-fee",
        studentName,
        className,
        section,
        feeType: "Admission Fee",
        discountAmount: numeric(payment.admissionDiscount || payment.discounts?.admissionDiscount),
        totalAmount: numeric(payment.admissionFee || payment.originalAdmissionFee),
        paidAmount: numeric(payment.admissionPaid),
        dueAmount: numeric(payment.admissionRemaining),
        paymentDate: "-",
      },
      {
        id: "book-fee",
        studentName,
        className,
        section,
        feeType: "Books Fee",
        discountAmount: 0,
        totalAmount: numeric(payment.bookFee || payment.originalBookFee),
        paidAmount: numeric(payment.bookPaid),
        dueAmount: numeric(payment.bookRemaining),
        paymentDate: "-",
      },
      {
        id: "uniform-fee",
        studentName,
        className,
        section,
        feeType: "Uniform Fee",
        discountAmount: 0,
        totalAmount: numeric(payment.uniformFee || payment.originalUniformFee),
        paidAmount: numeric(payment.uniformPaid),
        dueAmount: numeric(payment.uniformRemaining),
        paymentDate: "-",
      },
      {
        id: "exam-fee",
        studentName,
        className,
        section,
        feeType: "Exam Fee",
        discountAmount: 0,
        totalAmount: numeric(payment.examFee || payment.originalExamFee),
        paidAmount: numeric(payment.examPaid),
        dueAmount: numeric(payment.examRemaining),
        paymentDate: "-",
      },
      {
        id: "bus-fee",
        studentName,
        className,
        section,
        feeType: "Bus Fee",
        discountAmount: numeric(payment.busDiscount || payment.discounts?.busDiscount),
        totalAmount: numeric(payment.busFee || payment.originalBusFee),
        paidAmount: numeric(payment.busPaid),
        dueAmount: numeric(payment.busRemaining),
        paymentDate: "-",
      },
      {
        id: "other-fee",
        studentName,
        className,
        section,
        feeType: "Other Fees",
        discountAmount: 0,
        totalAmount: numeric(payment.othersFee || payment.originalOthersFee),
        paidAmount: numeric(payment.othersPaid),
        dueAmount: numeric(payment.othersRemaining),
        paymentDate: "-",
      },
      {
        id: "residential-fee",
        studentName,
        className,
        section,
        feeType: "Residential Fee",
        discountAmount: 0,
        totalAmount: numeric(payment.residentialFee || payment.originalResidentialFee),
        paidAmount: numeric(payment.residentialPaid),
        dueAmount: numeric(payment.residentialRemaining),
        paymentDate: "-",
      },
    ];

    return rows.filter((row) => Number(row.totalAmount) > 0 || Number(row.paidAmount) > 0 || Number(row.dueAmount) > 0);
  }, [popupSelection?.className, popupSelection?.sectionName, popupSelection?.studentName, popupStudentPaymentData]);

  const paymentPopupStudentDataRows = useMemo(() => {
    const apiSummaryRows = paymentPopupApiRows.flatMap((row, index) =>
      buildFeeRowsFromStudentSummary({
        ...row,
        id: row?.id ?? `api-summary-${index}`,
      })
    );

    const combinedRows = [
      ...paymentPopupStudentPaymentRows,
      ...apiSummaryRows,
      ...paymentPopupGroupedRows,
      ...paymentPopupClassFeeStructureRows,
      ...paymentPopupStudentDataFallbackRows,
    ];

    const dedupedRows = [];
    const seen = new Set();

    combinedRows.forEach((row) => {
      const key = [
        String(row?.studentName || "").trim().toLowerCase(),
        String(row?.className || "").trim().toLowerCase(),
        String(row?.section || "").trim().toLowerCase(),
        String(row?.feeType || "").trim().toLowerCase(),
      ].join("|");

      if (!key.replace(/\|/g, "").trim() || seen.has(key)) return;
      seen.add(key);
      dedupedRows.push(row);
    });

    return dedupedRows;
  }, [
    buildFeeRowsFromStudentSummary,
    paymentPopupApiRows,
    paymentPopupClassFeeStructureRows,
    paymentPopupGroupedRows,
    paymentPopupStudentPaymentRows,
    paymentPopupStudentDataFallbackRows,
  ]);

  const paymentPopupStudentProfile = useMemo(() => {
    const apiRow = paymentPopupApiRows[0] || null;
    const selectedKey = [
      String(popupSelection?.studentName || "").trim().toLowerCase(),
      normalizeClassLabel(popupSelection?.className || ""),
      normalizeSectionLabel(popupSelection?.sectionName || ""),
    ].join("|");

    const directoryMatch = (studentDirectory || []).find((student) => {
      const key = [
        String(student?.name || student?.StudentName || student?.studentName || "").trim().toLowerCase(),
        normalizeClassLabel(student?.class_name || student?.Class_name || student?.className || ""),
        normalizeSectionLabel(student?.section || student?.Section || student?.sectionName || ""),
      ].join("|");
      return key === selectedKey;
    });

    return {
      studentName:
        apiRow?.StudentName ||
        popupSelection?.studentName ||
        directoryMatch?.name ||
        "Student",
      fatherName:
        apiRow?.father_name ||
        directoryMatch?.father_name ||
        directoryMatch?.fatherName ||
        "-",
      mobile:
        apiRow?.phone_no ||
        directoryMatch?.phone_no ||
        directoryMatch?.phoneNumber ||
        "-",
      admissionNo:
        apiRow?.admission_no ||
        directoryMatch?.admission_no ||
        directoryMatch?.Admission_Number ||
        "-",
      gender:
        apiRow?.gender ||
        directoryMatch?.gender ||
        "-",
      email:
        apiRow?.email ||
        directoryMatch?.email ||
        "-",
    };
  }, [paymentPopupApiRows, popupSelection, studentDirectory, normalizeClassLabel, normalizeSectionLabel]);

  const outstandingDueMap = useMemo(() => {
    const transactionDueMap = new Map();
    const explicitRemainingMap = new Map();

    (allFeeStatusRows || []).forEach((row) => {
      const name =
        row?.StudentName ||
        row?.studentName ||
        row?.name ||
        row?.Student_Name ||
        "";
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

      if (transactionPaid > 0 && explicitRemaining > 0) {
        return;
      }

      transactionDueMap.set(key, (transactionDueMap.get(key) || 0) + dueAmount);
    });

    (unpaidStudents || []).forEach((row) => {
      const name =
        row?.StudentName ||
        row?.studentName ||
        row?.name ||
        row?.Student_Name ||
        "";
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

  const unpaidSummaryDueMap = useMemo(() => {
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

  const groupedOutstandingStudents = useMemo(() => {
    const groups = new Map();

    normalizedOutstandingStudents.forEach((student, index) => {
      const key = String(student.id || "").trim() || [
        String(student.name || "").trim().toLowerCase(),
        String(student.className || "").trim().toLowerCase(),
        String(student.section || "").trim().toLowerCase(),
      ].join("|");
      const dueAmount = outstandingDueMap.get(key) || 0;

      const current = groups.get(key);
      if (!current) {
        groups.set(key, {
          ...student,
          id: student.id || `student-${index}`,
          dueAmount,
        });
      }
    });

    return [...groups.values()];
  }, [normalizedOutstandingStudents, outstandingDueMap]);

  const selectedClassDefaultDue = useMemo(() => {
    if (!selectedClassFeeStructure) return 0;
    const rawCompleteFee =
      Number(selectedClassFeeStructure?.CompleteFee) ||
      Number(selectedClassFeeStructure?.complete_fee) ||
      0;
    return Math.max(rawCompleteFee - getDiscountTotalForRow(selectedClassFeeStructure), 0);
  }, [getDiscountTotalForRow, selectedClassFeeStructure]);

  const selectedClassPaidTotalsMap = useMemo(() => {
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

  const selectedClassSectionOutstandingStudents = useMemo(() => {
    const classFee = selectedClassDefaultDue || 0;
    const baseStudents = (studentDirectory || [])
      .filter((student) => {
        const className = normalizeClassLabel(student?.class_name || student?.Class_name || student?.className || "");
        const section = normalizeSectionLabel(student?.section || student?.Section || student?.sectionName || "");
        return className === normalizeClassLabel(selectedClassFilter) && section === normalizeSectionLabel(selectedSectionFilter);
      })
      .map((student, index) => {
        const name = student?.name || student?.StudentName || student?.studentName || `Student ${index + 1}`;
        const className = student?.class_name || student?.Class_name || student?.className || selectedClassFilter || "";
        const section = student?.section || student?.Section || student?.sectionName || selectedSectionFilter || "";
        const key = [
          String(name || "").trim().toLowerCase(),
          String(className || "").trim().toLowerCase(),
          String(section || "").trim().toLowerCase(),
        ].join("|");

        const paymentSummary = paymentSummaryMap[key] || null;
        const summaryDue = unpaidSummaryDueMap.get(key) || 0;
        const totalPaidForStudent = selectedClassPaidTotalsMap.get(key) || 0;
        const transactionPaid = getExplicitRemainingAmount(paymentSummary) > 0
          ? getAnyNumber(paymentSummary, ["Paid_Amount", "Total_Paid", "totalPaid", "dynamicFeePaidTotal"])
          : totalPaidForStudent;
        const dueFromTransactions =
          getExplicitRemainingAmount(paymentSummary) > 0
            ? getExplicitRemainingAmount(paymentSummary)
            : summaryDue > 0
              ? summaryDue
              : Math.max(classFee - transactionPaid, 0);

        return {
          id: student?.id ?? student?.student_id ?? `selected-fee-${index}`,
          name,
          className,
          section,
          totalAmount: classFee,
          paidAmount: transactionPaid,
          dueAmount: classFee > 0 ? Math.max(classFee - transactionPaid, 0) : dueFromTransactions,
          feeBreakdown: [
            ["Class Fee", classFee],
          ].filter(([, value]) => Number(value) > 0),
        };
      });

    if (baseStudents.length > 0) {
      return baseStudents.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    return (selectedClassSectionFeeRows || [])
      .map((row, index) => {
        const name =
          row?.StudentName ||
          row?.studentName ||
          row?.name ||
          row?.Student_Name ||
          `Student ${index + 1}`;
        const className = row?.Class_name || row?.class_name || row?.className || selectedClassFilter || "";
        const section = row?.section || row?.Section || row?.sectionName || selectedSectionFilter || "";
        const totalAmount = Number(row?.CompleteFee || row?.complete_fee || classFee || 0);
        const paidAmount = Number(row?.Paid_Amount || row?.paid_amount || row?.Total_Paid || 0);
        const dueAmount = Number(
          row?.Remaining_Amount ||
          row?.Total_Installments_Remaining ||
          row?.Total_Due ||
          row?.Due_Amount ||
          Math.max(totalAmount - paidAmount, 0)
        );

        return {
          id: row?.student_id || row?.id || `selected-fee-${index}`,
          name,
          className,
          section,
          totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
          paidAmount: Number.isFinite(paidAmount) ? paidAmount : 0,
          dueAmount: Number.isFinite(dueAmount) ? dueAmount : 0,
          feeBreakdown: [["Class Fee", totalAmount]].filter(([, value]) => Number(value) > 0),
        };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [
    getAnyNumber,
    getExplicitRemainingAmount,
    paymentSummaryMap,
    unpaidSummaryDueMap,
    selectedClassDefaultDue,
    selectedClassFilter,
    selectedClassPaidTotalsMap,
    selectedClassSectionFeeRows,
    selectedSectionFilter,
    studentDirectory,
    normalizeClassLabel,
    normalizeSectionLabel,
  ]);

  const classOptions = useMemo(
    () => ["All", ...sortClassLabels([...new Set(normalizedOutstandingStudents.map((s) => s.className).filter(Boolean))])],
    [normalizedOutstandingStudents]
  );

  const sectionOptions = useMemo(() => {
    const source =
      selectedClassFilter === "All"
        ? normalizedOutstandingStudents
        : normalizedOutstandingStudents.filter(
            (s) => normalizeClassLabel(s.className) === normalizeClassLabel(selectedClassFilter)
          );
    return ["All", ...sortSectionLabels([...new Set(source.map((s) => s.section).filter(Boolean))])];
  }, [normalizedOutstandingStudents, selectedClassFilter, normalizeClassLabel]);

  const filteredOutstandingStudents = useMemo(() => {
    const list = groupedOutstandingStudents
    .map((student) => {
      const key = [
        String(student?.name || student?.StudentName || "").trim().toLowerCase(),
        String(student?.className || student?.Class_name || "").trim().toLowerCase(),
        String(student?.section || student?.Section || "").trim().toLowerCase(),
      ].join("|");
      const groupedDue = Number(student?.dueAmount) || 0;
      const paymentSummary = paymentSummaryMap[key] || null;
      const paymentApiDue = getExplicitRemainingAmount(paymentSummary);
      const summaryDue = unpaidSummaryDueMap.get(key) || 0;
      const overrideDue = getExplicitRemainingAmount(student);
      const resolvedStudentDue =
        paymentApiDue > 0
          ? paymentApiDue
          : summaryDue > 0
            ? summaryDue
            : overrideDue > 0
              ? overrideDue
              : groupedDue;
      const totalPaidForStudent = selectedClassPaidTotalsMap.get(key) || 0;
      const computedDueFromSelectedClass =
        selectedClassFilter !== "All" &&
        selectedSectionFilter !== "All" &&
        selectedClassDefaultDue > 0
          ? Math.max(selectedClassDefaultDue - totalPaidForStudent, 0)
          : 0;
      return {
        ...student,
        dueAmount:
          resolvedStudentDue > 0
            ? resolvedStudentDue
            : computedDueFromSelectedClass > 0
              ? computedDueFromSelectedClass
              : 0,
      };
    })
    .filter((student) => {
      const classMatch =
        selectedClassFilter === "All" ||
        normalizeClassLabel(student.className) === normalizeClassLabel(selectedClassFilter);
      const sectionMatch =
        selectedSectionFilter === "All" ||
        normalizeSectionLabel(student.section) === normalizeSectionLabel(selectedSectionFilter);
      return classMatch && sectionMatch;
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [
    groupedOutstandingStudents,
    paymentSummaryMap,
    unpaidSummaryDueMap,
    selectedClassDefaultDue,
    selectedClassFilter,
    selectedClassPaidTotalsMap,
    selectedSectionFilter,
  ]);

  const visibleOutstandingStudents =
    selectedClassFilter !== "All" &&
    selectedSectionFilter !== "All" &&
    selectedClassSectionOutstandingStudents.length
      ? selectedClassSectionOutstandingStudents
      : filteredOutstandingStudents;

  const filteredDiscountStudents = useMemo(() => {
    const activeClass = isAddFeesPopupOpen
      ? normalizeClassLabel(addFeePreview.className)
      : normalizeClassLabel(selectedClassFilter === "All" ? "" : selectedClassFilter);
    const activeSection = isAddFeesPopupOpen
      ? String(addFeePreview.section || "").trim()
      : String(selectedSectionFilter === "All" ? "" : selectedSectionFilter).trim();

    return (discountStudents || [])
      .filter((student) => {
        const classMatch =
          !activeClass || normalizeClassLabel(getStudentClassName(student)) === activeClass;
        const sectionMatch =
          !activeSection || normalizeSectionLabel(getStudentSectionName(student)) === normalizeSectionLabel(activeSection);
        return classMatch && sectionMatch;
      })
      .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));
  }, [
    addFeePreview.className,
    addFeePreview.section,
    discountStudents,
    getStudentClassName,
    getStudentName,
    getStudentSectionName,
    isAddFeesPopupOpen,
    normalizeClassLabel,
    selectedClassFilter,
    selectedSectionFilter,
  ]);

  useEffect(() => {
    if (!ticketSelectedClassSection) {
      setTicketClassName("");
      setTicketSection("");
      return;
    }
    const [cls, sec] = ticketSelectedClassSection.split("_");
    setTicketClassName(cls || "");
    setTicketSection(sec || "");
  }, [ticketSelectedClassSection]);

  useEffect(() => {
    if (!schoolCode) return;

    const fetchTicketMetadata = async () => {
      try {
        setTicketDropdownLoading(true);
        const [classRes, sectionRes] = await Promise.all([
          axios.get(`${ADMIN_API_BASE}/classes?schoolCode=${schoolCode}`),
          axios.get(`${ADMIN_API_BASE}/sectionFilter?schoolCode=${schoolCode}`),
        ]);

        const classesFromAPI = Array.isArray(classRes.data)
          ? classRes.data
          : classRes.data?.classes || classRes.data?.classList || classRes.data?.data || classRes.data?.result || [];
        const sectionsFromAPI = Array.isArray(sectionRes.data)
          ? sectionRes.data
          : sectionRes.data?.sections || sectionRes.data?.sectionList || sectionRes.data?.data || sectionRes.data?.result || [];

        setTicketClassList(classesFromAPI);
        setTicketSectionMap(sectionsFromAPI);
      } catch (error) {
        console.error("Error loading ticket class/section metadata", error);
        setTicketClassList([]);
        setTicketSectionMap([]);
      } finally {
        setTicketDropdownLoading(false);
      }
    };

    fetchTicketMetadata();
  }, [schoolCode]);

  useEffect(() => {
    if (!schoolCode) return;

    const fetchTicketTeachers = async () => {
      try {
        setTicketLoadingTeachers(true);
        const res = await axios.post("https://cleezoclass.com:4000/api/users", {
          schoolCode,
          user_type: "teacher",
        });
        setTicketTeachers(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error("Error loading accountant ticket teachers", error);
        setTicketTeachers([]);
      } finally {
        setTicketLoadingTeachers(false);
      }
    };

    fetchTicketTeachers();
  }, [schoolCode]);

  useEffect(() => {
    if (!schoolCode || !ticketClassName || !ticketSection) {
      setTicketStudents([]);
      return;
    }

    axios
      .get(
        `https://cleezoclass.com:4000/api/studentsNameAccountant/${ticketClassName}?schoolCode=${schoolCode}&section=${ticketSection}`
      )
      .then((res) => setTicketStudents(normalizeTicketStudentList(res.data)))
      .catch((error) => {
        console.error("Error loading accountant ticket students", error);
        setTicketStudents([]);
      });
  }, [normalizeTicketStudentList, schoolCode, ticketClassName, ticketSection]);

  const ticketDerivedClasses = useMemo(() => {
    if (ticketClassList.length > 0) return ticketClassList;
    const classSet = new Set();
    ticketSectionMap.forEach((item) => {
      const classValue = item?.class_name || item?.class || item?.className;
      if (classValue != null) classSet.add(String(classValue));
    });
    return Array.from(classSet);
  }, [ticketClassList, ticketSectionMap]);

  const filteredTicketStudents = useMemo(() => {
    const term = ticketSearchTerm.trim().toLowerCase();
    if (!term) return ticketStudents;
    return ticketStudents.filter((student) =>
      student.name?.toLowerCase().includes(term) ||
      student.student_name?.toLowerCase?.().includes(term) ||
      String(student.id).includes(term) ||
      String(student.student_id || "").includes(term)
    );
  }, [ticketSearchTerm, ticketStudents]);

  const TICKETS_ITEMS_PER_ROW = 6;

  const ticketStudentRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < filteredTicketStudents.length; i += TICKETS_ITEMS_PER_ROW) {
      rows.push(filteredTicketStudents.slice(i, i + TICKETS_ITEMS_PER_ROW));
    }
    return rows;
  }, [filteredTicketStudents]);

  const ticketTeacherRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < ticketTeachers.length; i += TICKETS_ITEMS_PER_ROW) {
      rows.push(ticketTeachers.slice(i, i + TICKETS_ITEMS_PER_ROW));
    }
    return rows;
  }, [ticketTeachers]);

  const openTicketModal = useCallback((payload) => {
    setTicketTarget(payload);
    setTicketTitle("");
    setTicketDescription("");
    setTicketSuccess("");
    setTicketError("");
    setShowTicketModal(true);
  }, []);

  const closeTicketModal = useCallback(() => {
    setShowTicketModal(false);
    setTicketTarget(null);
    setTicketSelectedTeacherId(null);
  }, []);

  const handleCreateTicket = useCallback(async () => {
    if (!ticketTarget || !ticketTitle.trim() || !ticketDescription.trim() || !schoolCode) return;

    try {
      const payload = {
        schoolCode,
        ticket_type: ticketTarget.type,
        teacher_id: ticketTarget.teacher?.teacher_id || null,
        teacher_name: ticketTarget.teacher?.teacher_name || null,
        student_id: ticketTarget.student?.id || null,
        student_name: ticketTarget.student?.name || null,
        class_name: ticketClassName || null,
        section: ticketSection || null,
        title: ticketTitle.trim(),
        description: ticketDescription.trim(),
      };
      await axios.post("https://cleezoclass.com:4000/api/tickets", payload);
      setTicketSuccess("Ticket created successfully.");
      setTicketError("");
      setTimeout(() => {
        closeTicketModal();
      }, 900);
    } catch (error) {
      console.error("Error creating accountant ticket", error);
      setTicketError("Failed to create ticket. Please try again.");
      setTicketSuccess("");
    }
  }, [closeTicketModal, schoolCode, ticketClassName, ticketDescription, ticketSection, ticketTarget, ticketTitle]);

  const outgoingStudentFeeRows = useMemo(() => {
    const fallbackStudents = (unpaidStudents || []).map((student, index) => ({
      id: student?.id ?? student?.StudentId ?? `outgoing-${index}`,
      name: getStudentName(student),
      className: student?.Class_name || student?.class_name || student?.className || "",
      section: student?.Section || student?.section || student?.sectionName || "",
    }));

    const baseStudents = (studentDirectory || []).length
      ? (studentDirectory || []).map((student, index) => ({
          id: student?.id ?? student?.student_id ?? `student-${index}`,
          name: student?.name || student?.StudentName || student?.studentName || "Student",
          className: student?.class_name || student?.Class_name || student?.className || "",
          section: student?.section || student?.Section || student?.sectionName || "",
        }))
      : fallbackStudents;

    return baseStudents
      .map((student) => {
        const studentKey = [
          String(student?.name || "").trim().toLowerCase(),
          String(student?.className || "").trim().toLowerCase(),
          String(student?.section || "").trim().toLowerCase(),
        ].join("|");

        const matchingFeeRows = (allFeeStatusRows || []).filter((row) => getStudentCompositeKey(row) === studentKey);
        const matchingUnpaidRow = (unpaidStudents || []).find((row) => getStudentCompositeKey(row) === studentKey);

        let expectedAmount = 0;
        let transactionPaidTotal = 0;
        let aggregatePaidFallback = 0;
        let dueAmount = 0;
        let latestDate = "";
        const summaryDue = unpaidSummaryDueMap.get(studentKey) || 0;
        const totalPaidForStudent = selectedClassPaidTotalsMap.get(studentKey) || 0;

        matchingFeeRows.forEach((row) => {
          const totals = getFeeTotalsForRow(row);
          expectedAmount = Math.max(expectedAmount, totals.expected || 0);

          const transactionPaid = getAnyNumber(row, ["amount_paid", "paid_amount"]);
          const aggregatePaid = getAnyNumber(row, ["Paid_Amount", "Total_Paid", "totalPaid", "dynamicFeePaidTotal"]);
          const explicitRemaining = getExplicitRemainingAmount(row);

          if (transactionPaid > 0) {
            transactionPaidTotal += transactionPaid;
          } else {
            aggregatePaidFallback = Math.max(aggregatePaidFallback, aggregatePaid, totals.paid || 0);
          }

          if (!(transactionPaid > 0 && explicitRemaining > 0)) {
            const rowDue = explicitRemaining || Math.max(totals.unpaid || 0, 0);
            dueAmount = Math.max(dueAmount, rowDue);
          }

          const rowDate =
            row?.record_date || row?.payment_date || row?.Receipt_Date || row?.createdAt || row?.date || "";
          if (rowDate && (!latestDate || new Date(rowDate) > new Date(latestDate))) {
            latestDate = rowDate;
          }
        });

        if (matchingUnpaidRow) {
          expectedAmount = Math.max(
            expectedAmount,
            getAnyNumber(matchingUnpaidRow, ["completeFee", "CompleteFee", "Total_Expected", "TotalFee"])
          );
          dueAmount = Math.max(
            dueAmount,
            getExplicitRemainingAmount(matchingUnpaidRow),
            getAnyNumber(matchingUnpaidRow, ["Due_Amount", "Total_Due", "unpaidAmount", "Pending_Amount"])
          );
          aggregatePaidFallback = Math.max(
            aggregatePaidFallback,
            getAnyNumber(matchingUnpaidRow, ["Paid_Amount", "Total_Paid", "totalPaid", "dynamicFeePaidTotal"])
          );
        }

        const paidAmount = transactionPaidTotal > 0 ? transactionPaidTotal : aggregatePaidFallback;
        const classTotal =
          selectedClassFilter !== "All" &&
          selectedSectionFilter !== "All" &&
          normalizeClassLabel(student?.className || "") === normalizeClassLabel(selectedClassFilter) &&
          normalizeSectionLabel(student?.section || "") === normalizeSectionLabel(selectedSectionFilter) &&
          selectedClassDefaultDue > 0
            ? selectedClassDefaultDue
            : expectedAmount;

        const resolvedPaid = totalPaidForStudent > 0 ? totalPaidForStudent : paidAmount;
        const computedDueFromSelectedClass = classTotal > 0 ? Math.max(classTotal - resolvedPaid, 0) : 0;
        const resolvedDue =
          summaryDue > 0
            ? summaryDue
            : dueAmount > 0
              ? dueAmount
              : computedDueFromSelectedClass > 0
                ? computedDueFromSelectedClass
                : Math.max(expectedAmount - resolvedPaid, 0);
        const resolvedTotal =
          classTotal > 0 ? classTotal : expectedAmount > 0 ? expectedAmount : resolvedPaid + resolvedDue;

        return {
          id: student.id,
          name: student.name,
          className: student.className || "-",
          section: student.section || "-",
          totalAmount: resolvedTotal,
          paidAmount: resolvedPaid,
          dueAmount: resolvedDue,
          latestDate: formatDisplayDate(latestDate),
        };
      })
      .filter((student) => student.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    allFeeStatusRows,
    formatDisplayDate,
    getAnyNumber,
    getFeeTotalsForRow,
    getStudentName,
    selectedClassDefaultDue,
    selectedClassFilter,
    selectedClassPaidTotalsMap,
    selectedSectionFilter,
    studentDirectory,
    unpaidSummaryDueMap,
    unpaidStudents,
  ]);

  const hasSelectedClassSection =
    selectedClassFilter !== "All" && selectedSectionFilter !== "All";

  const openPaymentGrid = useCallback(
    (student) => {
      const className = student?.className || (selectedClassFilter !== "All" ? selectedClassFilter : "");
      const sectionName = student?.section || (selectedSectionFilter !== "All" ? selectedSectionFilter : "");

      if (!className || !sectionName) return;

      const incomingId = student?.id;
      const incomingIdIsUsable =
        incomingId !== null &&
        incomingId !== undefined &&
        String(incomingId).trim() !== "" &&
        !String(incomingId).startsWith("student-");

      const resolvedStudent = normalizedOutstandingStudents.find((entry) => {
        const sameName =
          String(entry?.name || "").trim().toLowerCase() ===
          String(student?.name || "").trim().toLowerCase();
        const sameClass = normalizeClassLabel(entry?.className) === normalizeClassLabel(className);
        const sameSection = normalizeSectionLabel(entry?.section) === normalizeSectionLabel(sectionName);
        return sameName && sameClass && sameSection;
      });

      const resolvedStudentId = incomingIdIsUsable
        ? incomingId
        : resolvedStudent?.id || null;

      console.log("[Dashboard][openPaymentGrid]", {
        clickedStudent: student,
        incomingId,
        incomingIdIsUsable,
        resolvedStudent,
        resolvedStudentId,
        className,
        sectionName,
      });

      localStorage.setItem("selectedClassSection", `${className}_${sectionName}`);
      localStorage.setItem("className", className);
      localStorage.setItem("section", sectionName);

      setPopupSelection({
        className,
        sectionName,
        studentId: resolvedStudentId,
        studentName: student?.name || "",
      });
      setIsPaymentPopupOpen(true);
    },
    [
      normalizedOutstandingStudents,
      selectedClassFilter,
      selectedSectionFilter,
      normalizeClassLabel,
      normalizeSectionLabel,
    ]
  );

  const handleCreateFeeType = useCallback(
    async (event) => {
      event.preventDefault();
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) {
        setCreateFeeTypeError("School code not found.");
        return;
      }

      const feeName = String(newFeeTypeForm.feesType || "").trim();
      if (!feeName) {
        setCreateFeeTypeError("Fee name is required.");
        return;
      }

      const normalizedName = feeName.toLowerCase();
      const alreadyExists = dynamicFeeTypes.some(
        (item) => String(item.feeName || "").trim().toLowerCase() === normalizedName
      );
      if (alreadyExists) {
        setCreateFeeTypeError("This fee type already exists.");
        return;
      }

      setCreateFeeTypeLoading(true);
      setCreateFeeTypeError("");

      const nextFeeType = {
        feeName,
        feesType: feeName,
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

const openCreateFeeTypePopup = useCallback(() => {
    setIsAssistantPopupOpen(false);
    setCreateFeeTypeError("");
    setCreateFeeTypeLoading(false);
    setIsCreateFeeTypePopupOpen(true);
  }, []);

  const openAddFeesPopup = useCallback(() => {
    setIsAssistantPopupOpen(false);
    setAddFeesPanelTab("fees");
    setIsAddFeesPopupOpen(true);
  }, []);

  const openAssistantPanel = useCallback(() => {
    setIsAddFeesPopupOpen(false);
    setIsAssistantPopupOpen(true);
  }, []);

  const openOutgoingStudentsPopup = useCallback(() => {
    setIsAddFeesPopupOpen(false);
    setIsAssistantPopupOpen(false);
    setIsOutgoingStudentsPopupOpen(true);
  }, []);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;
    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${schoolCode}`)
      .then((res) => res.json())
      .then((data) => {
        setSchoolLogo(data.logo || "/default-logo.png");
      setSchoolName(data.institute_name || currentDbName);
        setInstituteAddress(data.address || "Address not available");
      })
      .catch(() => {
        setSchoolLogo("/default-logo.png");
        setSchoolName("School");
        setInstituteAddress("Address not available");
      });
  }, []);

  useEffect(() => {
    const username = localStorage.getItem("username");
    const schoolCode = localStorage.getItem("schoolCode");
    if (!username || !schoolCode) return;
    fetch(`https://cleezoclass.com:4000/api/api/user-info/${username}?schoolCode=${schoolCode}`)
      .then((res) => res.json())
      .then((data) => {
        setUserInfo({
          ...data,
          photo: normalizeUserPhoto(data?.photo)
        });
      })
      .catch(() => setUserInfo(null));
  }, []);

  useEffect(() => {
    if (!profileEditOpen || !userInfo) return;
    setProfileForm({
      gender: userInfo.gender || "",
      phone_no: userInfo.phone_no || "",
      email: userInfo.email || "",
    });
    setProfileSaveStatus("");
  }, [profileEditOpen, userInfo]);
  const userDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshUserInfo = async () => {
    const username = localStorage.getItem("username");
    const schoolCode = localStorage.getItem("schoolCode");
    if (!username || !schoolCode) return;

    try {
      const { data } = await axios.get(
        `https://cleezoclass.com:4000/api/api/user-info/${username}?schoolCode=${encodeURIComponent(schoolCode)}`
      );
      setUserInfo({
        ...data,
        photo: normalizeUserPhoto(data?.photo),
      });
    } catch (error) {
      console.error("Failed to refresh user info", error);
    }
  };

  const openProfileEditor = () => {
    setProfileEditOpen(true);
    setProfileSaveStatus("");
  };

  const closeProfileEditor = () => {
    setProfileEditOpen(false);
    setProfileSaveStatus("");
  };

  const handleSaveProfile = async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode || !userInfo?.id) {
      setProfileSaveStatus("Missing user or school information.");
      return;
    }

    setProfileSaving(true);
    setProfileSaveStatus("");

    try {
      const formData = new FormData();
      formData.append("schoolCode", schoolCode);
      formData.append("gender", profileForm.gender.trim());
      formData.append("phone_no", profileForm.phone_no.trim());
      formData.append("email", profileForm.email.trim());

      const { data } = await axios.put(
        `https://cleezoclass.com:4000/api/profile/users/${userInfo.id}?schoolCode=${encodeURIComponent(schoolCode)}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setProfileSaveStatus(data?.message || "Profile updated successfully.");
      await refreshUserInfo();
      setProfileEditOpen(false);
    } catch (error) {
      setProfileSaveStatus(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update profile details."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("schoolCode");
    localStorage.removeItem("userRole");
    localStorage.removeItem("name");
    sessionStorage.clear();
    window.location.replace(import.meta.env.BASE_URL || "/");
  };

  const studentManagementPopupUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${import.meta.env.BASE_URL}StudentManagement`;
  }, []);

    const sidebarItems = [
    { key: "home", label: "Dashboard", icon: dashboardIcon, iconAlt: "Dashboard", active: true },
    { key: "collect-fee", label: "Fees", icon: collectFeeIcon ,onClick: () => navigate("/AccountantFees") },
    { key: "add-fee", label: "Add Fees", icon: addFeeIcon ,onClick: openAddFeesPopup },
    { key: "add-student", label: "Add Student", icon: addStudentIcon, onClick: () => setIsStudentManagementPopupOpen(true) },
    {
      key: "add-expense",
      label: "Expense",
      icon: expenseIcon,
      onClick: () => navigate("/AccountantExpenses"),
    },
    { key: "report", label: "Reports", icon: reportIcon, onClick: () => navigate("/AccountantReportsPage") },
  ];

  const topbarTabs = [
    {
      key: "dashboard",
      label: "Dashboard",
      active: true,
      className: "accountant-topbar-tab-button",
      onClick: () => navigate("/AccountantDashboard"),
    },
    {
      key: "fees",
      label: "Fees",
      className: "accountant-topbar-tab-button",
      onClick: () => navigate("/AccountantFees"),
    },
    {
      key: "expense",
      label: "Expense",
      className: "accountant-topbar-tab-button",
      onClick: () => navigate("/AccountantExpenses"),
    },
    {
      key: "reports",
      label: "Reports",
      className: "accountant-topbar-tab-button",
      onClick: () => navigate("/AccountantReportsPage"),
    },
  ];

  const topbarRight = (
    <>
      <div ref={userDropdownRef} className="header-profile-wrap">
        <button
          type="button"
          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
          className="dashboard-user-btn accountant-user-btn"
          aria-label="Account"
        >
          <FaUser className="dashboard-user-icon accountant-user-icon" />
        </button>

        {userDropdownOpen && userInfo && (
          <div className="header-profile-dropdown">
            <div className="header-profile-card header-profile-card-editable">
              <button
                type="button"
                className="header-profile-edit-btn"
                onClick={profileEditOpen ? closeProfileEditor : openProfileEditor}
                aria-label="Edit profile"
                title="Edit profile"
              >
                <FaEdit />
              </button>

              <div className="header-profile-avatar">
                {userInfo?.photo ? (
                  <img src={userInfo.photo} alt="Profile" className="header-profile-avatar-image" />
                ) : (
                  <FaUser className="header-profile-avatar-fallback" />
                )}
              </div>
              <div className="header-profile-name">{userInfo.name}</div>
            </div>

            <hr className="header-profile-divider" />
            <div className="header-profile-info">
              <div><strong>Designation:</strong> {userInfo.designation}</div>

              {profileEditOpen ? (
                <div className="header-profile-form">
                  <label className="header-profile-label">
                    <strong>Gender:</strong>
                    <input
                      type="text"
                      value={profileForm.gender}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, gender: e.target.value }))}
                      className="header-profile-input"
                    />
                  </label>
                  <label className="header-profile-label">
                    <strong>Phone:</strong>
                    <input
                      type="text"
                      value={profileForm.phone_no}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, phone_no: e.target.value }))}
                      className="header-profile-input"
                    />
                  </label>
                  <label className="header-profile-label">
                    <strong>Email:</strong>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="header-profile-input"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div className="header-profile-field">
                    <strong>Gender:</strong>
                    <span>{userInfo.gender}</span>
                  </div>
                  <div className="header-profile-field">
                    <strong>Phone:</strong>
                    <span>{userInfo.phone_no}</span>
                  </div>
                  <div className="header-profile-email">
                    <strong>Email:</strong> {userInfo.email}
                  </div>
                </>
              )}

              <div><strong>School Name:</strong> {schoolName}</div>
              <div><strong>School Address:</strong> {instituteAddress}</div>
            </div>

            {profileEditOpen && (
              <>
                {profileSaveStatus && (
                  <div
                    className={`header-profile-status ${
                      profileSaveStatus.toLowerCase().includes("failed") ||
                      profileSaveStatus.toLowerCase().includes("missing")
                        ? "header-profile-status-error"
                        : "header-profile-status-success"
                    }`}
                  >
                    {profileSaveStatus}
                  </div>
                )}
                <div className="header-profile-actions">
                  <button
                    type="button"
                    onClick={closeProfileEditor}
                    className="header-profile-logout header-profile-cancel"
                    disabled={profileSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="header-profile-logout header-profile-save"
                    disabled={profileSaving}
                  >
                    {profileSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            )}

            <button onClick={handleLogout} className="header-profile-logout">
              Logout
            </button>
          </div>
        )}
      </div>
    </>
  );

    

return (
  <>
    <DashboardLayout
      pageClassName="frontdesk-dashboard-page accountant-dashboard-page accountant-dashboard-home-page dashboard-home-page"

    sidebarItems={sidebarItems}
    topbarTabs={topbarTabs}
    logoSrc={schoolLogo}
    logoAlt={schoolName || "Logo"}
      instituteName={schoolName}
    topbarRight={topbarRight}
    footerLogoSrc={logoab}
    footerLogoAlt="Cleezo Class"
  >
    <div className="accountant-grid">


 <div className="accountant-row accountant-row-top">

  {/* LEFT TEXT */}
  <div className="accountant-welcome-block">
            <h2>Hi, {userInfo?.name || "User"}!</h2>
    <p>Check Due Status,</p>
    <p>Report dues to Class Teacher</p>
    <p>Submit Day wise Ledger</p>
  </div>

  {/* TASK CARD */}
 <div className="accountant-task-card accountant-card">
    <div className="taskCardContent">
      <TaskOfTheDay />
    </div>
  </div>

  {/* QUICK CARDS */}
  <div className="accountant-mini-cards">
    <div
      className="accountant-quick-card accountant-card accountant-quick-card-clickable"
      role="button"
      tabIndex={0}
      onClick={openCreateFeeTypePopup}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openCreateFeeTypePopup();
      }}
    >
      <img src={createFeeIcon} alt="Create Fee type" />
      <h4>Create Fee type</h4>
    </div>

    <div
      className="accountant-quick-card accountant-card accountant-quick-card-clickable"
      role="button"
      tabIndex={0}
      onClick={openAddFeesPopup}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openAddFeesPopup();
      }}
    >
      <img src={addFeesIcon} alt="Add Fees" />
      <h4>Add Fees</h4>
      <p>Fees & Discounts list</p>
    </div>

    <div
      className="accountant-quick-card accountant-card accountant-quick-card-clickable"
      role="button"
      tabIndex={0}
      onClick={openAssistantPanel}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openAssistantPanel();
      }}
    >
      <img src={assistantIcon} alt="Assistant" />
      <h4>Assistant</h4>
      <p>Daily Activity check</p>
    </div>
  </div>

</div>

  <div className="accountant-row accountant-row-middle">
  <div className="accountant-collect-card accountant-card">
    <div className="collect-header">
      <div className="Heading">
        Collect Fees
      </div>

      <button type="button" className="collect-filter">
        <span>As on today</span>
      </button>
    </div>

    <button
      type="button"
      className="accountant-inline-plus accountant-inline-plus-below"
      onClick={() => navigate("/AccountantFees")}
    >
      +
    </button>


    <div className="accountant-collect-content">
      <div className="accountant-progress-panel">
        {renderProgressRing(
          summary.progress,
          dashboardLoading ? "..." : `${Math.round(summary.progress)}%`
        )}
      </div>

      <div className="collect-stats">
        <p><span className="normalText">Gross:</span><strong>{dashboardLoading ? "Loading..." : formatINR(summary.gross)}</strong></p>
        <p><span className="normalText">Concession:</span><strong>{dashboardLoading ? "Loading..." : formatINR(summary.concession)}</strong></p>
        <p><span className="normalText"> Net Payable:</span><strong>{dashboardLoading ? "Loading..." : formatINR(summary.netPayable)}</strong></p>
        <p><span className="normalText">Total Paid:</span><strong>{dashboardLoading ? "Loading..." : formatINR(summary.totalPaid)}</strong></p>
      </div>
    </div>

    <div className="accountant-total-due">
      <span>Total Due</span>
      <p>{dashboardLoading ? "Loading..." : formatINR(summary.totalDue)}</p>
    </div>
  </div>

  <div className="accountant-outstanding-card accountant-card">
    <div className="accountant-card-header">
      <div className="Heading">Outstanding</div>

      <div className="accountant-card-filters">
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

    <div className="accountant-student-list">
      {visibleOutstandingStudents.length ? (
        visibleOutstandingStudents.map((student, index) => (
          <div
            key={student.id}
            className={`accountant-student-mini ${index === 0 ? "is-active" : ""}`}
            onClick={() => openPaymentGrid(student)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openPaymentGrid(student);
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="accountant-student-avatar-wrap">
              <img src={userAvatar} alt="" />
            </div>
            <h4>{student.name}</h4>
            <p>
            Due: {formatINR(student.dueAmount)}
            </p>
            {Array.isArray(student.feeBreakdown) && student.feeBreakdown.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", justifyContent: "center", marginTop: "4px" }}>
                {student.feeBreakdown.map(([label, amount]) => (
                  <span
                    key={`${student.id}-${label}`}
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "999px",
                      background: "#f7f7f7",
                      border: "1px solid #e7e7e7",
                      color: "#444",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}: {formatINR(amount)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))
      ) : normalizedOutstandingStudents.length ? (
        normalizedOutstandingStudents.slice(0, 12).map((student, index) => (
          <div
            key={student.id || index}
            className={`accountant-student-mini ${index === 0 ? "is-active" : ""}`}
          >
            <div className="accountant-student-avatar-wrap">
              <img src={userAvatar} alt="" />
            </div>
            <h4>{student.name}</h4>
            <p>{student.className} {student.section}</p>
          </div>
        ))
      ) : (
        <div className="accountant-student-mini">
          <div className="accountant-student-avatar-wrap">
            <img src={userAvatar} alt="" />
          </div>
          <h4>{dashboardLoading ? "Loading students..." : "No students found"}</h4>
          <p>{dashboardLoading ? "Please wait..." : "Try changing Class/Section filters"}</p>
        </div>
      )}

      <div className="accountant-add-student accountant-add-student-grid">
        <button
          type="button"
          className="accountant-add-circle"
          onClick={() =>
            openPaymentGrid({
              className: selectedClassFilter,
              section: selectedSectionFilter,
            })
          }
          disabled={!hasSelectedClassSection}
          title={hasSelectedClassSection ? "Open payment grid" : "Select class and section first"}
        >
          +
        </button>
        <span>{hasSelectedClassSection ? "Open Grid" : "Choose Class & Section"}</span>
      </div>
    </div>
  </div>


  <div className="accountant-feetype-card accountant-card">
    <div className="accountant-card-header accountant-feetype-header">
      <div className="Heading"> 
        {isAddFeesPopupOpen
          ? addFeesPanelTab === "discount"
            ? "Discounts"
            : "Selected Class Fees"
          : isAssistantPopupOpen
            ? "Assistant"
            : "Fee Type"}
      </div>

      <div className="accountant-feetype-meta">
        {isAddFeesPopupOpen || isAssistantPopupOpen ? (
          <button
            type="button"
            className="accountant-create-new-btn"
            onClick={() => {
              setIsAddFeesPopupOpen(false);
              setIsAssistantPopupOpen(false);
              setAddFeesPanelTab("fees");
            }}
          >
            Close
          </button>
        ) : (
          <button
            type="button"
            className="accountant-create-new-btn"
            onClick={openCreateFeeTypePopup}
          >
            + Create New
          </button>
        )}
        <div className="accountant-feetype-count">
          <strong>
            {isAddFeesPopupOpen
              ? addFeesPanelTab === "discount"
                ? filteredDiscountStudents.length
                : addFeePreview.rows.length
              : isAssistantPopupOpen
                ? assistantActionItems.length
                : dynamicFeeTypes.length}
          </strong>
          <span className="normalText">
            {isAddFeesPopupOpen
              ? addFeesPanelTab === "discount"
                ? "Discount students"
                : "Selected fees"
              : isAssistantPopupOpen
                ? "Action items"
                : "Fee types"}
          </span>
        </div>
      </div>
    </div>

    <div className="accountant-feetype-table-wrap">
      {isAddFeesPopupOpen ? (
        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: "12px 12px 0",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="accountant-create-new-btn"
            onClick={() => setAddFeesPanelTab("fees")}
            style={{
              background: addFeesPanelTab === "fees" ? "#fdecef" : "#ffffff",
              color: "#c44755",
              border: "1px solid #f2c9cf",
            }}
          >
            Fees
          </button>
          <button
            type="button"
            className="accountant-create-new-btn"
            onClick={() => setAddFeesPanelTab("discount")}
            style={{
              background: addFeesPanelTab === "discount" ? "#fdecef" : "#ffffff",
              color: "#c44755",
              border: "1px solid #f2c9cf",
            }}
          >
            Discounts
          </button>
        </div>
      ) : null}
      {isAssistantPopupOpen ? (
        <div className="accountant-assistant-panel">
          <div className="accountant-assistant-summary">
            <div className="accountant-assistant-summary-card is-paid">
              <span>Paid</span>
              <strong>{dashboardLoading ? "Loading..." : formatINR(summary.totalPaid)}</strong>
            </div>
            <div className="accountant-assistant-summary-card is-balance">
              <span>Balance</span>
              <strong>{dashboardLoading ? "Loading..." : formatINR(summary.totalDue)}</strong>
            </div>
          </div>

          <div className="accountant-assistant-inline-grid">
            <section className="accountant-assistant-inline-section">
              <div className="accountant-assistant-inline-header">
                <h4>Unpaid Students</h4>
                <span>{unpaidStudents.length}</span>
              </div>
              <div className="accountant-assistant-inline-list">
                {unpaidStudents.length ? (
                  unpaidStudents.slice(0, 8).map((student, index) => (
                    <div key={student.id ?? index} className="accountant-assistant-inline-item">
                      <strong>{getStudentName(student)}</strong>
                      <span>{formatINR(getDueAmount(student))}</span>
                    </div>
                  ))
                ) : (
                  <div className="accountant-assistant-empty">No unpaid students found.</div>
                )}
              </div>
            </section>

            <section className="accountant-assistant-inline-section">
              <div className="accountant-assistant-inline-header">
                <h4>Discount Students</h4>
                <span>{discountStudentsLoading ? "..." : discountStudents.length}</span>
              </div>
              <div className="accountant-assistant-inline-list">
                {discountStudentsLoading ? (
                  <div className="accountant-assistant-empty">Loading discounts...</div>
                ) : discountStudents.length ? (
                  discountStudents.slice(0, 8).map((student, index) => (
                    <div key={student.id ?? index} className="accountant-assistant-inline-item">
                      <strong>{getStudentName(student)}</strong>
                      <span>{formatINR(getDiscountAmount(student))}</span>
                    </div>
                  ))
                ) : (
                  <div className="accountant-assistant-empty">No discount students found.</div>
                )}
              </div>
            </section>
          </div>

          <section className="accountant-assistant-inline-section accountant-assistant-inline-section-actions">
            <div className="accountant-assistant-inline-header">
              <h4>My Actions</h4>
              <span>{assistantActionItems.length}</span>
            </div>
            <div className="accountant-assistant-actions">
              {assistantActionItems.map((item, index) => (
                <article key={`${item.title}-${index}`} className="accountant-assistant-action-card">
                  <h5>{item.title}</h5>
                  <p>{item.detail}</p>
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
      ) : isAddFeesPopupOpen && addFeesPanelTab === "discount" ? (
        <div style={{ maxHeight: "152px", overflowY: "auto" }}>
          <table className="accountant-feetype-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Class</th>
                <th>Section</th>
                <th>Discount Amount</th>
              </tr>
            </thead>
            <tbody>
              {discountStudentsLoading ? (
                <tr>
                  <td colSpan={4}>Loading discounted students...</td>
                </tr>
              ) : filteredDiscountStudents.length ? (
                filteredDiscountStudents.map((student, index) => (
                  <tr key={student.id ?? `${getStudentName(student)}-${index}`}>
                    <td>{getStudentName(student)}</td>
                    <td>{getStudentClassName(student) || "-"}</td>
                    <td>{getStudentSectionName(student) || "-"}</td>
                    <td>{formatINR(getDiscountAmount(student))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    {selectedClassFilter !== "All" && selectedSectionFilter !== "All"
                      ? "No discounted students found for the selected class and section."
                      : "Select class and section in Add Fees to view discounted students."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <table className="accountant-feetype-table">
          <thead>
            {isAddFeesPopupOpen ? (
              <tr>
                <th>Fee Name</th>
                <th>Fees Type</th>
                <th>Class</th>
                <th>Section</th>
                <th>Amount</th>
                <th>Installment</th>
              </tr>
            ) : (
              <tr>
                <th>Fee Name</th>
                <th>Fees Type</th>
                <th>Priority</th>
                <th>Scope</th>
                <th>One time / Term fees</th>
                <th>Installment</th>
              </tr>
            )}
          </thead>
          <tbody>
            {isAddFeesPopupOpen ? (
              addFeePreview.rows.length ? (
                addFeePreview.rows.map((fee) => (
                  <tr key={fee.id}>
                    <td>{fee.feeName}</td>
                    <td>{fee.feesType}</td>
                    <td>{fee.className || addFeePreview.className || "-"}</td>
                    <td>{fee.section || addFeePreview.section || "-"}</td>
                    <td>{formatINR(fee.amount)}</td>
                    <td>{fee.installments}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    {addFeePreview.className && addFeePreview.section
                      ? "No fees added for the selected class and section."
                      : "Select class and section in Add Fees to view fee details."}
                  </td>
                </tr>
              )
            ) : (
              dynamicFeeTypes.length ? (
                dynamicFeeTypes.map((fee) => (
                  <tr key={fee.id}>
                    <td>{fee.feeName}</td>
                    <td>{fee.feesType}</td>
                    <td>{fee.priority}</td>
                    <td>{fee.scope}</td>
                    <td>{fee.frequency}</td>
                    <td>{fee.installments}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No fee types available for this school yet.</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  </div>
</div>

<div className="accountant-row accountant-row-bottom">
  <div className="accountant-bottom-left">
    <div className="accountant-ticket-card accountant-card">
      <div className="tickets-header-and-tabs">
        <div className="tickets-left">
          <div className="tickets-header">Tickets</div>

          <div className="tickets-tabs">
            <button
              className={`tickets-tab ${ticketActiveTab === "staff" ? "active" : ""}`}
              onClick={() => setTicketActiveTab("staff")}
            >
              Staff
            </button>

            <button
              className={`tickets-tab ${ticketActiveTab === "students" ? "active" : ""}`}
              onClick={() => setTicketActiveTab("students")}
            >
              Students
            </button>
          </div>
        </div>
      </div>

      {ticketActiveTab === "students" && (
        <div className="tickets-student-filter-row">
          <select
            value={ticketSelectedClassSection}
            onChange={(e) => setTicketSelectedClassSection(e.target.value)}
            disabled={ticketDropdownLoading}
            className="collect-filter tickets-class-dropdown-select"
          >
            <option value="">Select Class &amp; Section</option>
            {ticketDerivedClasses.map((cls) => {
              const classLabel = getTicketClassLabel(cls);
              if (!classLabel) return null;

              const sectionsForClass = ticketSectionMap
                .filter((item) => {
                  const classValue = item.class_name || item.class || item.className;
                  return String(classValue) === String(classLabel);
                })
                .map((item) => item.section || item.section_name || item.sectionName);

              return sectionsForClass.length > 0
                ? sectionsForClass.map((sec) => (
                    <option key={`${classLabel}_${sec}`} value={`${classLabel}_${sec}`}>
                      {classLabel} - {sec}
                    </option>
                  ))
                : null;
            })}
          </select>
        </div>
      )}

      <div className="tickets-content">
        {ticketActiveTab === "staff" && (
          <div className="tc-staffAssignSection">
            {ticketLoadingTeachers && <p>Loading teachers...</p>}

            {!ticketLoadingTeachers && (
              <div className="tc-teacherGrid">
                {ticketTeacherRows.map((row, idx) => (
                  <div key={idx} className="tc-teacherRow">
                    {row.map((teacher, teacherIndex) => {
                      const teacherId = getTicketTeacherId(
                        teacher,
                        idx * TICKETS_ITEMS_PER_ROW + teacherIndex
                      );
                      const teacherName = getTicketTeacherName(teacher);
                      const normalizedTeacher = {
                        ...teacher,
                        teacher_id: teacherId,
                        teacher_name: teacherName,
                      };

                      return (
                        <div
                          key={teacherId}
                          className="tc-teacherCard tickets-clickable"
                          onClick={() => {
                            setTicketSelectedTeacherId(teacherId);
                            openTicketModal({ type: "teacher", teacher: normalizedTeacher });
                          }}
                        >
                          <div
                            className="tc-teacherAvatar"
                            style={{
                              background:
                                ticketSelectedTeacherId === teacherId ? "#f6a5ab" : "#f1f2f4",
                            }}
                          >
                            <FaUser className="header-profile-avatar-fallback" />
                          </div>
                          <div className="tc-teacherName">{teacherName}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {ticketActiveTab === "students" && (
          <div className="tc-staffAssignSection tickets-student-panel">
            <div className="tc-teacherGrid tickets-student-grid">
              {filteredTicketStudents.length === 0 ? (
                <div className="payment-no-students">
                  {ticketClassName ? "No students found" : "Please select a class and section"}
                </div>
              ) : (
                ticketStudentRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="tc-teacherRow">
                    {row.map((student, studentIndex) => {
                      const studentId =
                        student.id ??
                        student.student_id ??
                        `student-${rowIndex * TICKETS_ITEMS_PER_ROW + studentIndex}`;
                      const studentName =
                        student.name ?? student.student_name ?? student.full_name ?? "Student";

                      return (
                        <div
                          key={studentId}
                          className="tc-teacherCard tickets-student-card tickets-clickable"
                          onClick={() => openTicketModal({ type: "student", student })}
                        >
                          <div
                            className="tc-teacherAvatar tickets-student-photo-placeholder"
                            style={{ background: "#f1f2f4" }}
                          >
                            <FaUser className="header-profile-avatar-fallback" />
                          </div>
                          <div className="tc-teacherName tickets-student-name">{studentName}</div>
                          <span className="tickets-student-id">ID: {studentId}</span>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showTicketModal && ticketTarget && (
        <div className="tickets-modal-overlay" onClick={closeTicketModal}>
          <div className="tickets-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tickets-modal-title">Raise Ticket</div>
            <div className="tickets-modal-subtitle">
              {ticketTarget.type === "teacher"
                ? `Teacher: ${ticketTarget.teacher?.teacher_name || "-"}`
                : `Student: ${ticketTarget.student?.name || "-"}${
                    ticketClassName ? ` | ${ticketClassName}-${ticketSection}` : ""
                  }`}
            </div>
            <input
              className="tickets-modal-input"
              placeholder="Title"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
            />
            <textarea
              className="tickets-modal-textarea"
              placeholder="Description"
              value={ticketDescription}
              onChange={(e) => setTicketDescription(e.target.value)}
            />
            <div className="tickets-modal-actions">
              <button className="tickets-btn ghost" onClick={closeTicketModal}>
                Cancel
              </button>
              <button
                className="btn-solid"
                onClick={handleCreateTicket}
                disabled={!ticketTitle.trim() || !ticketDescription.trim()}
                style={{ whiteSpace: "nowrap" }}
              >
                Create Ticket
              </button>
            </div>
            {ticketSuccess && <div className="tickets-success">{ticketSuccess}</div>}
            {ticketError && <div className="tickets-error">{ticketError}</div>}
          </div>
        </div>
      )}
    </div>
  </div>

   <div className="accountant-premium-card accountant-card">
    <img src={premiumIcon} alt="Go Premium" className="accountant-premium-icon" />

    <h3>Go Premium!</h3>
    <p>
      opt in for premium pack and get full access of LeadX - fully
      Automated Admission & 1000 leads every month.
    </p>

    <button type="button">Find out More</button>
  </div>

  <div className="accountant-bottom-right">
    <div className="accountant-income-card accountant-card">
      {renderProgressRing(45, "45%", "accountant-income-ring")}
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

        <div className="accountant-total-strip-item">
          <strong>{dashboardLoading ? "Loading..." : formatINR(summary.savingDue)}</strong>
          <span>Saving Due</span>
        </div>

        <div className="accountant-total-strip-item">
          <strong>{dashboardLoading ? "Loading..." : formatINR(summary.savingPaid)}</strong>
          <span>Saving Paid</span>
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

    </DashboardLayout>

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

  {isPaymentPopupOpen && (
    <div
      className="globalpopup-overlay"
      onClick={() => setIsPaymentPopupOpen(false)}
      style={{ zIndex: 3100 }}
    >
      <div
        className="globalpopup-content accountant-outgoing-students-popup"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="globalpopup-header accountant-create-fee-popup-header">
          <div className="accountant-create-fee-popup-heading">
            
            {paymentPopupError ? <p className="accountant-create-fee-error">{paymentPopupError}</p> : null}
          </div>
          <button
            type="button"
            className="globalpopup-close-btn"
            onClick={() => setIsPaymentPopupOpen(false)}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: "0 24px 12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setPaymentPopupTab("studentData")}
            style={{
              border: "1px solid #f2c9cf",
              background: paymentPopupTab === "studentData" ? "#fdecef" : "#ffffff",
              color: "#c44755",
              borderRadius: "999px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Student Data
          </button>
          <button
            type="button"
            onClick={() => setPaymentPopupTab("transactions")}
            style={{
              border: "1px solid #f2c9cf",
              background: paymentPopupTab === "transactions" ? "#fdecef" : "#ffffff",
              color: "#c44755",
              borderRadius: "999px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Student Transactions
          </button>
        </div>

        <div className="accountant-outgoing-students-summary">
          <div className="accountant-outgoing-students-pill">
            <span>Student</span>
            <strong>{paymentPopupStudentProfile.studentName}</strong>
          </div>
          <div className="accountant-outgoing-students-pill">
            <span>Father Name</span>
            <strong>{paymentPopupStudentProfile.fatherName}</strong>
          </div>
          <div className="accountant-outgoing-students-pill">
            <span>Mobile Number</span>
            <strong>{paymentPopupStudentProfile.mobile}</strong>
          </div>
          <div className="accountant-outgoing-students-pill">
            <span>Admission No</span>
            <strong>{paymentPopupStudentProfile.admissionNo}</strong>
          </div>
          <div className="accountant-outgoing-students-pill">
            <span>Gender</span>
            <strong>{paymentPopupStudentProfile.gender}</strong>
          </div>
          <div className="accountant-outgoing-students-pill">
            <span>Email</span>
            <strong>{paymentPopupStudentProfile.email}</strong>
          </div>
        </div>


        <div className="accountant-outgoing-students-table-wrap">
          <table className="accountant-outgoing-students-table">
            <thead>
              {paymentPopupTab === "transactions" ? (
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Receipt No.</th>
                  <th>Fee Type</th>
                  <th>Discount</th>
                  <th>Total Fee</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Date</th>
                </tr>
              ) : (
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Fee Type</th>
                  <th>Discount</th>
                  <th>Total Amount</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Date</th>
                </tr>
              )}
            </thead>
            <tbody>
              {paymentPopupLoading ? (
                <tr>
                  <td colSpan={paymentPopupTab === "transactions" ? 12 : 9}>Loading transaction details...</td>
                </tr>
              ) : paymentPopupTab === "transactions" && paymentPopupTransactionRows.length ? (
                paymentPopupTransactionRows.map((row, index) => (
                  <tr key={`${row.id}-${row.paymentDate}-${row.paidAmount}-${index}`}>
                    <td>{row.studentName}</td>
                    <td>{row.className}</td>
                    <td>{row.section}</td>
                    <td>{row.receiptNumber || "-"}</td>
                    <td>{row.feeType}</td>
                    <td>{formatINR(row.discountAmount)}</td>
                    <td>{formatINR(row.totalAmount)}</td>
                    <td>{formatINR(row.paidAmount)}</td>
                    <td>{formatINR(row.dueAmount)}</td>
                    <td>{row.paymentDate}</td>
                  </tr>
                ))
              ) : paymentPopupTab === "studentData" && paymentPopupStudentDataRows.length ? (
                paymentPopupStudentDataRows.map((row) => (
                  <tr key={`${row.id}-student-data`}>
                    <td>{row.studentName}</td>
                    <td>{row.className}</td>
                    <td>{row.section}</td>
                    <td>{row.feeType}</td>
                    <td>{formatINR(row.discountAmount)}</td>
                    <td>{formatINR(row.totalAmount)}</td>
                    <td>{formatINR(row.paidAmount)}</td>
                    <td>{formatINR(row.dueAmount)}</td>
                    <td>{row.paymentDate}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={paymentPopupTab === "transactions" ? 12 : 9}>
                    No fee details found for this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
        <div className="accountant-create-fee-intro">
          <p className="accountant-create-fee-intro-text">
            Create a clean fee master once, then reuse it for collection, due tracking, and reporting.
          </p>
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
                placeholder="Ex: Activity"
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

          {createFeeTypeError ? (
            <p className="accountant-create-fee-error">{createFeeTypeError}</p>
          ) : null}

          <div className="accountant-create-fee-note">
            Tip: keep the fee name short and specific so it becomes a clean column label in reports.
          </div>

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

  {isOutgoingStudentsPopupOpen && (
    <div
      className="globalpopup-overlay"
      onClick={() => setIsOutgoingStudentsPopupOpen(false)}
      style={{ zIndex: 3100 }}
    >
      <div
        className="globalpopup-content accountant-outgoing-students-popup"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="globalpopup-header accountant-create-fee-popup-header">
          <div className="accountant-create-fee-popup-heading">
            <span className="accountant-create-fee-kicker">Student Fees</span>
            <h3 className="accountant-create-fee-popup-title">Management Created Students</h3>
            <p className="accountant-create-fee-popup-subtitle">
              Fee summary with total amount, paid amount, due amount, and latest date
            </p>
          </div>
          <button
            type="button"
            className="globalpopup-close-btn"
            onClick={() => setIsOutgoingStudentsPopupOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="accountant-outgoing-students-summary">
          <div className="accountant-outgoing-students-pill">
            <span>Students</span>
            <strong>{outgoingStudentFeeRows.length}</strong>
          </div>
          <div className="accountant-outgoing-students-pill">
            <span>Total Paid</span>
            <strong>{formatINR(outgoingStudentFeeRows.reduce((sum, row) => sum + row.paidAmount, 0))}</strong>
          </div>
          <div className="accountant-outgoing-students-pill">
            <span>Total Due</span>
            <strong>{formatINR(outgoingStudentFeeRows.reduce((sum, row) => sum + row.dueAmount, 0))}</strong>
          </div>
        </div>

        <div className="accountant-outgoing-students-table-wrap">
          <table className="accountant-outgoing-students-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Section</th>
                <th>Total Amount</th>
                <th>Paid Amount</th>
                <th>Due Amount</th>
                <th>Latest Date</th>
              </tr>
            </thead>
            <tbody>
              {outgoingStudentFeeRows.length ? (
                outgoingStudentFeeRows.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.className}</td>
                    <td>{student.section}</td>
                    <td>{formatINR(student.totalAmount)}</td>
                    <td>{formatINR(student.paidAmount)}</td>
                    <td>{formatINR(student.dueAmount)}</td>
                    <td>{student.latestDate}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>No student fee details are available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

  {isAddFeesPopupOpen && (
    <div
      className="globalpopup-overlay"
      onClick={() => {
        setIsAddFeesPopupOpen(false);
        setAddFeesPanelTab("fees");
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
              setAddFeesPanelTab("fees");
              setAddFeePreview({ className: "", section: "", rows: [] });
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: "0 24px 12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="accountant-create-new-btn"
            onClick={() => setAddFeesPanelTab("fees")}
            style={{
              background: addFeesPanelTab === "fees" ? "#fdecef" : "#ffffff",
              color: "#c44755",
              border: "1px solid #f2c9cf",
            }}
          >
            Fees
          </button>
          <button
            type="button"
            className="accountant-create-new-btn"
            onClick={() => setAddFeesPanelTab("discount")}
            style={{
              background: addFeesPanelTab === "discount" ? "#fdecef" : "#ffffff",
              color: "#c44755",
              border: "1px solid #f2c9cf",
            }}
          >
            Discounts
          </button>
        </div>
        {addFeesPanelTab === "discount" ? (
          <div style={{ padding: "0 12px 12px" }}>
            <DiscountsPanel dynamicFeeTypes={dynamicFeeTypes} />
          </div>
        ) : (
          <IncomeForm5
            selectedClassSection={{
              class: selectedClassFilter !== "All" ? selectedClassFilter : "",
              section: selectedSectionFilter !== "All" ? selectedSectionFilter : "",
            }}
            onFeeStructurePreviewChange={setAddFeePreview}
            embeddedInPopup
          />
        )}
      </div>
      </div>
  )}
  </>

);
};

export default AccountantDashboard;
