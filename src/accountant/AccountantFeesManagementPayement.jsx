import { ArrowLeft, ChevronRight, Circle, Download, Share } from "lucide-react";
import { CheckCircle, Star } from "lucide-react";
import React, { useContext, useEffect, useRef, useState,useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Link, useNavigate, useLocation } from "react-router-dom"; // CORRECTED: Added useLocation
import PaidAmountdemo from "./Accountant_commerce_income_GenerateBill";
import './Payment.css'
import ErrorPopup from "../shared/ErrorPopup";
const API_BASE = 'https://cleezoclass.com:4000/api/admin';
const API_BASE_URL = "https://cleezoclass.com:4000"; 
const schoolLogo = ""; // Optional custom logo
const normalizeClassLabel = (value) =>
  String(value || "").replace(/^Class\s+/i, "").trim();

const PayementDemo = ({
  className: propClassName,
  sectionName: propSectionName,
  popupOnly = false,
  initialStudentId = null,
  initialStudentName = "",
  onPopupClose = null,
  onPaymentSuccess = null,
}) => {
  console.log("[Payment][props]", {
    propClassName,
    propSectionName,
    popupOnly,
    initialStudentId,
    initialStudentName,
  });
  // CORRECTED: Added useLocation hook call
  const location = useLocation();

  // ... more state declarations ...
const [popupMsg, setPopupMsg] = useState("");
  const [classList, setClassList] = useState([]);
  const [sectionMap, setSectionMap] = useState([]);
  const [filteredSections, setFilteredSections] = useState([]);
  // Call useLocation to access the navigation state
// Try props first, then fallback to localStorage, otherwise empty string
const initialClassSection =
  (propClassName && propSectionName)
    ? `${propClassName}_${propSectionName}`
    : localStorage.getItem("selectedClassSection") || "";

const [selectedClassSection, setSelectedClassSection] = useState(initialClassSection);

// Parse class and section from props or localStorage
const [className, setClassName] = useState(
  propClassName || localStorage.getItem("className") || ""
);
const [section, setSection] = useState(
  propSectionName || localStorage.getItem("section") || ""
);

  // useEffect to retrieve class and section from state and set the combined value
  useEffect(() => {
    if (location.state) {
      const { className: stateClass, sectionName: stateSection } = location.state;
      if (stateClass && stateSection) {
        // Set the combined value based on navigation state
        setSelectedClassSection(`${stateClass}_${stateSection}`);
        setClassName(stateClass);
        setSection(stateSection);
      } else if (stateClass) {
        setClassName(stateClass);
      }
      if (stateSection) {
        setSection(stateSection);
      }
      // Log for confirmation (optional)
    }
  }, [location.state]);

  const [showInstallments, setShowInstallments] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  //   const logoSrc = schoolLogo || "/default-logo.png";
  const dateInputRef = useRef(null);
  const [studentData, setStudentData] = useState(null);
  const [feeStructure, setFeeStructure] = useState({
    academicFee: 0,
    uniformFee: 0,
    bookFee: 0,
    transportFee: 0,
    labFee: 0,
    miscellaneousFee: 0,
    hostelFee: 0,
    messFee: 0,
    completeFee: 0,
  });const [installments, setInstallments] = useState({});
  const [selectedStudentFeeDetails, setSelectedStudentFeeDetails] = useState(null);
 // Convert number → "1,23,456.00"
const formatAmount = (value) => {
  if (value === "" || value === null || isNaN(value)) return "";
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const unformatAmount = (value) => {
  if (!value) return "";
  return value.replace(/,/g, "");
};

  const [installmentOptions, setInstallmentOptions] = useState([]); // Store installments for tuition
  const [finalAmount, setFinalAmount] = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  // const [selectedClass, setSelectedClass] = useState("nursery");
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [showPreviewDropdown, setShowPreviewDropdown] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [receiptNumber, setReceiptNumber] = useState('001');
  const [initialReceiptSet, setInitialReceiptSet] = useState(false);
  const [paymentMode, setPaymentMode] = useState("");
const [transactionId, setTransactionId] = useState("");
  const [payments, setPayments] = useState(null);
  const [generatedBills, setGeneratedBills] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableBill, setEditableBill] = useState(null);
  const [examFee, setExamFee] = useState(0);
  const [busFee, setBusFee] = useState(0);
  const [bookFee, setBookFee] = useState(0);
  const [uniformFee, setUniformFee] = useState(0);
  const [othersFee, setOthersFee] = useState(0);
  const [residentialFee, setResidentialFee] = useState(0);
  const [tuitionFee, setTuitionFee] = useState(0);
  const [tuitionPaid, setTuitionPaid] = useState(0);
  const [examPaid, setExamPaid] = useState(0);
  const [busPaid, setBusPaid] = useState(0);
  const [bookPaid, setBookPaid] = useState(0);
  const [uniformPaid, setUniformPaid] = useState(0);
  const [othersPaid, setOthersPaid] = useState(0);
  const [residentialPaid, setResidentialPaid] = useState(0);
  const contentRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [activePage, setActivePage] = useState(null);
  const headerRef = useRef();
  const [showAttendance, setShowAttendance] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dynamicFeeTypes, setDynamicFeeTypes] = useState([]);
  const [dynamicFeeValues, setDynamicFeeValues] = useState({});
  const [task, setTask] = useState("");
  const [sending, setSending] = useState(false);
  const [messageStatus, setMessageStatus] = useState(null);
  const dashboardRef = useRef(null);
  const [employeeId, setEmployeeId] = useState("");
  const [attendanceData, setAttendanceData] = useState([]);
  const [error, setError] = useState("");
  const [presentDays, setPresentDays] = useState(0);
  const [halfDays, setHalfDays] = useState(0);
  const [baseSalary, setBaseSalary] = useState("");
  const [totalSalary, setTotalSalary] = useState(null);
  const [salaryDate, setSalaryDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [deductions, setDeductions] = useState(0.0);
  const [bonuses, setBonuses] = useState(0.0);
  const [salaryMonth, setSalaryMonth] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [institutionData, setInstitutionData] = useState(null);
  const [logo, setLogo] = useState(null);
  const navigate = useNavigate();
  const [incomeType, setIncomeType] = useState("fees");

  const [distance, setDistance] = useState("");
  const [feesExam, setFeesExam] = useState("");
  const [feesBus, setFeesBus] = useState("");
  const [feesUniform, setFeesUniform] = useState("");
  const [feesBooks, setFeesBooks] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donationAmount, setDonationAmount] = useState("");
  const [donationDate, setDonationDate] = useState("");
  const [investmentName, setInvestmentName] = useState("");
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [investmentDate, setInvestmentDate] = useState("");
  const [other, setOther] = useState("");
  const [message, setMessage] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [activeContent, setActiveContent] = useState(null);
  const [feeType, setFeeType] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [dynamicLogoSrc, setDynamicLogoSrc] = useState("");
  const [dynamicSchoolCode, setDynamicSchoolCode] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  // CORRECTED: Fixed TypeError by wrapping the array in useState()
  const [feeEntries, setFeeEntries] = useState([{ type: "", amount: "" }]);
  const [feesList, setFeesList] = useState([]); // Stores all selected fees
  // NEW STATE: To manage the active tab in the right container
  const [activeTab, setActiveTab] = useState("feesCollection"); 

  const [fees, setFees] = useState({
    tuition: 0, // Main tuition fee
    exam: 0, // Examination fee
    bus: 0, // Bus transportation fee
    uniform: 0, // Uniform fee
    books: 0, // Books and materials fee
    other: 0, // Miscellaneous fees
    residential: 0, // Residential fee
  });
 
useEffect(() => {
  if (selectedStudentId) {
    setShowModal(true);
  }
}, [selectedStudentId]);

useEffect(() => {
  const schoolCode = localStorage.getItem("schoolCode");
  const selectedName = String(selectedStudent || initialStudentName || "").trim();
  const selectedClass = String(className || "").trim();
  const selectedSection = String(section || "").trim();

  console.log("[Payment][student-fee-details] request", {
    schoolCode,
    selectedName,
    selectedClass,
    selectedSection,
    selectedStudentId,
    initialStudentId,
  });

  if (!schoolCode || !selectedName || !selectedClass || !selectedSection) {
    console.log("[Payment][student-fee-details] skipped - missing selection", {
      hasSchoolCode: Boolean(schoolCode),
      hasSelectedName: Boolean(selectedName),
      hasSelectedClass: Boolean(selectedClass),
      hasSelectedSection: Boolean(selectedSection),
    });
    setSelectedStudentFeeDetails(null);
    return;
  }

  let isCancelled = false;

  const normalizeStudentName = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const getStudentFeeScore = (row) => {
    const scoreFields = [
      "uniform",
      "uniformFee",
      "Uniform_Fee",
      "uniform_paid",
      "Uniform_paid",
      "admission",
      "Admission_Fee",
      "exam",
      "Exam_Fee",
      "bus",
      "Bus_Fee",
      "books",
      "Book_Fee",
      "other",
      "Other_Fee",
      "residential",
      "ResidentialCompleteFee",
    ];

    return scoreFields.reduce((sum, field) => {
      const value = Number(row?.[field]);
      return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);
  };

  const normalizeStudentId = (value) => String(value || "").trim();

  const pickBestStudentFeeRow = (rows) => {
    const normalizedSelectedName = normalizeStudentName(selectedName);
    const normalizedSelectedId = normalizeStudentId(selectedStudentId || initialStudentId);
    const matchedRows = rows.filter((row) => {
      const rowName = normalizeStudentName(row?.StudentName || row?.studentName || row?.name || "");
      const rowId = normalizeStudentId(row?.id || row?.studentId || row?.StudentId || row?.student_id);
      const nameMatches = rowName === normalizedSelectedName;
      const idMatches =
        normalizedSelectedId && rowId && rowId === normalizedSelectedId;

      return nameMatches || idMatches;
    });

    if (!matchedRows.length) return null;

    return matchedRows
      .slice()
      .sort((a, b) => getStudentFeeScore(b) - getStudentFeeScore(a))[0] || null;
  };

  axios
    .get("https://cleezoclass.com:4000/api/student-fee-details", {
      params: {
        schoolCode,
        class: selectedClass,
        section: selectedSection,
        name: selectedName,
      },
    })
    .then((res) => {
      if (isCancelled) return;

      const payload = res?.data;
      console.log("[Payment][student-fee-details] raw response", {
        isArray: Array.isArray(payload),
        topLevelKeys: payload && !Array.isArray(payload) ? Object.keys(payload) : [],
      });
      const normalizedSelectedName = normalizeStudentName(selectedName);
      const resolvedDetails = Array.isArray(payload)
        ? pickBestStudentFeeRow(payload)
        : (() => {
            const candidate =
              payload?.studentDetails ||
              payload?.FeesDetails ||
              payload?.feeDetails ||
              payload ||
              null;
            const candidateName = normalizeStudentName(
              candidate?.StudentName || candidate?.studentName || candidate?.name || ""
            );
            return candidateName === normalizedSelectedName ? candidate : null;
          })();

      console.log("[Payment][student-fee-details] resolved", {
        normalizedSelectedName,
        normalizedSelectedId: normalizeStudentId(selectedStudentId || initialStudentId),
        hasMatch: Boolean(resolvedDetails),
        resolvedKeys: resolvedDetails ? Object.keys(resolvedDetails) : [],
        resolvedStudentName:
          resolvedDetails?.StudentName || resolvedDetails?.studentName || resolvedDetails?.name || null,
        resolvedStudentId: resolvedDetails?.id || resolvedDetails?.studentId || resolvedDetails?.StudentId || resolvedDetails?.student_id || null,
        score: resolvedDetails ? getStudentFeeScore(resolvedDetails) : 0,
        uniform:
          resolvedDetails?.uniform ??
          resolvedDetails?.uniformFee ??
          resolvedDetails?.Uniform_Fee ??
          null,
      });
      setSelectedStudentFeeDetails(resolvedDetails);
    })
    .catch((error) => {
      console.error("[Payment][student-fee-details] fetch failed", error?.response?.data || error?.message || error);
      if (!isCancelled) setSelectedStudentFeeDetails(null);
    });

  return () => {
    isCancelled = true;
  };
}, [className, initialStudentName, section, selectedStudent]);

useEffect(() => {
  console.log("[Payment][student-fee-details] state update", {
    resolvedStudentName:
      selectedStudentFeeDetails?.StudentName ||
      selectedStudentFeeDetails?.studentName ||
      selectedStudentFeeDetails?.name ||
      null,
    uniform:
      selectedStudentFeeDetails?.uniform ??
      selectedStudentFeeDetails?.uniformFee ??
      selectedStudentFeeDetails?.Uniform_Fee ??
      null,
    snapshot: selectedStudentFeeDetails,
  });
}, [selectedStudentFeeDetails]);
  const [showReceipt, setShowReceipt] = useState(false);
const [showPaymentPopup, setShowPaymentPopup] = useState(false);
// Save receipt number to DB
  // Fetch last receipt number from DB

// Helper function to safely convert Buffer data (Uint8Array) to a clean path string
const bufferToPathString = (bufferData) => {
  if (!bufferData) return "";
  try {
    const bytes = new Uint8Array(bufferData);
    let pathString = "";
    // Converts Uint8Array (bytes) to a string
    for (let i = 0; i < bytes.byteLength; i++) {
      pathString += String.fromCharCode(bytes[i]);
    }
    // Clean up potential null bytes (\u0000) and trim whitespace
    return pathString.trim().replace(/\u0000/g, ''); 
  } catch (error) {
    console.error("Error converting buffer to string (path):", error);
    return ""; // Return empty string on error
  }
};
 const [showBusFeePopup, setShowBusFeePopup] = useState(false);
const [busFeeStudents, setBusFeeStudents] = useState([]);
const [showIndividualStudentPopup, setShowIndividualStudentPopup] = useState(false);
  const currentReceiptNumberRef = useRef(receiptNumber);

  const [installmentCount, setInstallmentCount] = useState();
  const [installmentsPaid, setInstallmentsPaid] = useState({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
});

const handleAddInstallments = () => {
  if (fees.tuition <= 0) {
    displayToast("Tuition fee must be greater than zero.", "error");
    return;
  }
 
  if (installmentCount <= 0) {
    displayToast("Installment count must be greater than zero.", "error");
    return;
  }
 
  const total = fees.tuition;
  const rawAmount = total / installmentCount;
  
  // Calculate the base amount (rounded down to nearest 100)
  const baseAmount = Math.floor(rawAmount / 100) * 100; // 10300 for 10333.33
  
  // Calculate the remainder that needs to be distributed
  const remainder = total - (baseAmount * installmentCount);
  
  // Build installments
  const newInstallments = Array.from({ length: installmentCount }, (_, index) => {
    const amount = index === 0 
      ? baseAmount + remainder 
      : baseAmount;
      
    return {
      id: index + 1,
      amount: parseFloat(amount.toFixed(2)),
      date: new Date(new Date().setMonth(new Date().getMonth() + index + 1)).toISOString().split('T')[0],
    };
  });
 
  setInstallments(newInstallments);
};
 
   const handleSaveClassInstallments = async () => {
    try {
      if (!className || !section) {
        displayToast(' Please select both a class and a section.', 'error');
        return;
      }
      const schoolCode = localStorage.getItem('schoolCode');
      if (!schoolCode) {
        throw new Error('School code not found in localStorage');
      }
      const updateData = {
        schoolCode,
        FeeClass: className,
        FeeSection: section,
        UpdatedCompleteFee: tuitionFee,
      };
 
      installments.forEach((installment, index) => {
        updateData[`Installment${index + 1}_Amount`] = installment.amount;
        updateData[`Installment${index + 1}_Deadline_Date`] = installment.date;
        updateData[`Installment${index + 1}_Fine`] = 0;
      });
 
      for (let i = installments.length; i < 5; i++) {
        updateData[`Installment${i + 1}_Amount`] = null;
        updateData[`Installment${i + 1}_Deadline_Date`] = null;
        updateData[`Installment${i + 1}_Fine`] = null;
      }
 
      const response = await fetch('https://cleezoclass.com:4000/api/installmentdetails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
 
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save class installments');
      }
 
      displayToast('✅ Installments for the class/section saved successfully!', 'success');
      setShowInstallmentModal(false);
    } catch (error) {
      console.error('Error saving class installments:', error);
      displayToast(error.message || 'Error saving class installments. Please try again.', 'error');
    }
  };
const [admissionRemaining, setAdmissionRemaining] = useState(0);
const [tuitionRemaining, setTuitionRemaining] = useState(0);
const [busRemaining, setBusRemaining] = useState(0);
const [examRemaining, setExamRemaining] = useState(0);
const [bookRemaining, setBookRemaining] = useState(0);
const [uniformRemaining, setUniformRemaining] = useState(0);
const [othersRemaining, setOthersRemaining] = useState(0);
const [residentialRemaining, setResidentialRemaining] = useState(0);


    const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
   const displayToast = (message, type) => {
    setToast({ show: true, message, type });
    // The ToastNotification component itself handles auto-hide via its useEffect
  };
 
const handleSubmit = async (event) => {
    event.preventDefault();
    const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
 
 
    if (!incomeType) {
      displayToast("❗ Please select an income type.", "error");
      return;
    }
 
    let incomeData = {
      income_type: incomeType,
      schoolCode: schoolCode,
    };
 
   if (incomeType === 'fees') {
  if (!className || !section) {
    displayToast("❗ Please select Class and Section for fees income.", "error");
    return;
  }
 
  // Ensure all amounts are numbers
  const sanitizedFeeEntries = feeEntries
    .filter(entry => entry.type && entry.amount !== '')
    .map(entry => ({
      type: entry.type,
      amount: parseFloat(entry.amount) || 0
    }));
 
  // Build fees object dynamically from sanitizedFeeEntries
  const calculatedFees = {};
  sanitizedFeeEntries.forEach(entry => {
    calculatedFees[entry.type] = entry.amount;
  });
 
  incomeData = {
    ...incomeData,
    class_name: className,
    class_section: section,
    ...calculatedFees,      // all fee types as keys
    feeEntries: sanitizedFeeEntries
  };
 
}
 
else if (incomeType === 'donations') {
      if (!donorName || !donationAmount || !donationDate) {
        displayToast("❗ Please fill out all fields for Donations (Name, Amount, Date).", "error");
        return;
      }
 
      incomeData = {
        ...incomeData,
        donor_name: donorName,
        donation_amount: parseFloat(donationAmount) || 0,
        donation_date: donationDate
      };
 
    } else if (incomeType === 'investments') {
      if (!investmentName || !investmentAmount || !investmentDate) {
        displayToast("❗ Please fill out all fields for Investments (Name, Amount, Date).", "error");
        return;
      }
 
      incomeData = {
        ...incomeData,
        investor_name: investmentName,
        investment_amount: parseFloat(investmentAmount) || 0,
        investment_date: investmentDate
      };
 
    } else if (incomeType === 'other') {
      if (!other) {
        displayToast("❗ Please enter the amount for Other Income.", "error");
        return;
      }
 
      incomeData = {
        ...incomeData,
        other_amount: parseFloat(other) || 0
      };
 
    } else if (incomeType === 'installments') {
        if (!className || !section) {
            displayToast("❗ Please select Class and Section for installments.", "error");
            return;
        }
        await handleSaveClassInstallments();
        displayToast('✅ Installments saved for the selected class/section!', 'success');
        return;
    }
 
    try {
      const response = await axios.put('https://cleezoclass.com:4000/income', incomeData);
      
      let successMessage = `✅ Income data added successfully for school: ${schoolCode}!`;
      if (incomeType === 'fees') {
        successMessage = `✅ Fees submitted successfully for Class ${className} Section ${section}!`;
      }
      displayToast(successMessage, "success");
 
      // Reset form fields after successful submission
      setClassName('');
      setSection('');
      setDistance('');
      setFees({ tuition: 0, exam: 0, bus: 0, uniform: 0, books: 0, other: 0, admission: 0, residential: 0 });
      setFeeEntries([{ type: '', amount: '' }]);
      setDonorName('');
      setDonationAmount('');
      setDonationDate('');
      setInvestmentName('');
      setInvestmentAmount('');
      setInvestmentDate('');
      setOther('');
      setIncomeType('fees');
 
    } catch (error) {
      console.error('[DEBUG] Error submitting income data:', error);
      displayToast(`❌ Error submitting income data: ${error.response?.data?.message || error.message}`, "error");
    }
};
 const [selectedBusStudent, setSelectedBusStudent] = useState(null);
 
  const handleBusFeeSelect = async () => {
  if (!className || !section) {
    displayToast('Please select both class and section', "error");
    return;
  }
  try {
    const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
    // Strip "Class " from className if present
    const apiClassName = className.replace("Class ", "");
    const response = await axios.get(`https://cleezoclass.com:4000/get-students?className=${apiClassName}&section=${section}&schoolCode=${schoolCode}`);
    if (response.data.success && response.data.students) {
      setBusFeeStudents(response.data.students);
      setShowBusFeePopup(true);
    } else {
      displayToast('No students found for the selected class and section', "error");
    }
  } catch (error) {
    console.error('Error loading students:', error);
    displayToast('Error loading students', "error");
  }
};
 const [defaultFees, setDefaultFees] = useState({
   admission: 0,
   tuition: 0,
   exam: 0,
   uniform: 0,
   books: 0,
   other: 0,
   residential: 0,
 });
 
  
const getUnpaidInstallmentIds = () => {
  if (!installmentOptions?.length) return [];
  return installmentOptions
    .sort((a, b) => a.id - b.id)
    .filter(inst => !paidInstallments.includes(inst.id))
    .map(inst => inst.id);
};
const feeLabelToKey = {
 "Admission Fee": "admission",
 "Tuition Fee": "tuition",
 "Residential Fee": "residential",
 "Bus Fee": "bus",
 "Exam Fee": "exam",
 "Books Fee": "books",
 "Uniform Fee": "uniform",
 "Other Fees": "other",
};

const normalizeFeeColumnBase = (feeName) => {
  const normalized = String(feeName || "")
    .trim()
    .toLowerCase()
    .replace(/\bfees?\b/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (!normalized) return "";
  return /^[0-9]/.test(normalized) ? `fee_${normalized}` : normalized;
};

const normalizeFeeFieldName = (key = "") =>
  String(key).toLowerCase().replace(/[\s_]+/g, "");

const isStaticOrMetaFeeField = (key = "") => {
  const normalized = normalizeFeeFieldName(key);
  const staticKeys = new Set([
    "admissionfee",
    "admissionfees",
    "tuitionfee",
    "residentialfee",
    "busfee",
    "busfees",
    "examfee",
    "examfees",
    "bookfee",
    "bookfees",
    "uniformfee",
    "uniformfees",
    "otherfee",
    "otherfees",
    "others",
    "completefee",
    "updatedcompletefee",
    "paidamount",
    "finalamount",
    "amountpaid",
  ]);
  const metaSuffixes = ["_paid", "_due", "_discount", "_fine", "_date"];
  const metaKeys = new Set([
    "id",
    "login_id",
    "created_at",
    "updated_at",
    "studentname",
    "studentid",
    "class_name",
    "classname",
    "section",
    "feaclass",
    "feasection",
    "feeclass",
    "feesection",
    "fee_type",
    "discount_reason",
    "uploadfeedetails",
    "receiptnumber",
    "paymentmode",
    "transaction_id",
    "transactionid",
    "paiddate",
    "paymentdate",
    "date",
  ]);

  if (staticKeys.has(normalized) || metaKeys.has(normalized)) {
    return true;
  }

  if (normalized.startsWith("installment") || normalized.startsWith("resinst")) {
    return true;
  }

  return metaSuffixes.some((suffix) => normalized.endsWith(suffix.replace("_", "")));
};

const formatCustomFeeLabel = (key = "") =>
  String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();

const getFeeKeyAliases = (key = "") => {
  const raw = String(key || "").trim();
  const normalized = normalizeFeeFieldName(raw);
  const aliases = new Set([raw]);

  if (!normalized) return [];

  aliases.add(normalized);

  const addAll = (...keys) => keys.filter(Boolean).forEach((item) => aliases.add(item));

  if (normalized === "stationary" || normalized === "stationery") {
    addAll("stationary", "stationery");
  }

  if (normalized === "sport" || normalized === "sports") {
    addAll("sport", "sports");
  }

  if (normalized === "guide" || normalized === "guides") {
    addAll("guide", "guides");
  }

  if (normalized === "book" || normalized === "books") {
    addAll("book", "books");
  }

  if (normalized === "tie" || normalized === "tiefee") {
    addAll("tie", "tie_fee", "tiefee");
  }

  if (normalized === "belt" || normalized === "beltfee") {
    addAll("belt", "belt_fee", "beltfee");
  }

  return Array.from(aliases);
};

const readFirstNumericValue = (source, keys = []) => {
  if (!source) return 0;

  const entries = Object.entries(source);

  for (const key of keys) {
    if (!key) continue;
    const normalizedKey = normalizeFeeFieldName(key);

    for (const [sourceKey, raw] of entries) {
      if (normalizeFeeFieldName(sourceKey) !== normalizedKey) continue;
      if (raw === undefined || raw === null || raw === "") continue;
      const value = Number(raw);
      if (Number.isFinite(value)) return value;
    }
  }

  return 0;
};

const readFeeDiscountValue = (source, feeKey = "", feeLabel = "") => {
  const keyAliases = getFeeKeyAliases(feeKey);
  const labelAliases = getFeeKeyAliases(feeLabel);
  const normalizedKey = normalizeFeeFieldName(feeKey);
  const normalizedLabel = normalizeFeeFieldName(feeLabel);

  const discountKeys = [
    ...keyAliases.flatMap((key) => [
      `${key}_discount`,
      `${key}_Discount`,
      `${key}Discount`,
    ]),
    ...labelAliases.flatMap((key) => [
      `${key}_discount`,
      `${key}_Discount`,
      `${key}Discount`,
    ]),
  ];

  if (normalizedKey === "tuition" || normalizedLabel.includes("tuition")) {
    discountKeys.push("tuition_discount", "tuitionDiscount");
  }
  if (normalizedKey === "bus" || normalizedLabel.includes("bus")) {
    discountKeys.push("bus_discount", "busDiscount");
  }
  if (
    normalizedKey === "book" ||
    normalizedKey === "books" ||
    normalizedLabel.includes("book") ||
    normalizedLabel.includes("books")
  ) {
    discountKeys.push("fee_discount", "feeDiscount", "books_discount", "book_discount");
  }

  return readFirstNumericValue(source, Array.from(new Set(discountKeys)));
};

const DYNAMIC_FEE_TRANSACTION_FIELD_MAP = {
  stationary: {
    totalKeys: ["stationary"],
    paidKeys: ["amount_paid", "stationary_paid"],
    dueKeys: ["stationary_due"],
    totalField: "stationary",
    paidField: "stationary_paid",
    dueField: "stationary_due",
    discountField: "stationary_discount",
  },
  sports: {
    totalKeys: ["sports"],
    paidKeys: ["amount_paid", "sports_paid"],
    dueKeys: ["sports_due"],
    totalField: "sports",
    paidField: "sports_paid",
    dueField: "sports_due",
    discountField: "sports_discount",
  },
  guides: {
    totalKeys: ["guides"],
    paidKeys: ["amount_paid", "guides_paid"],
    dueKeys: ["guides_due"],
    totalField: "guides",
    paidField: "guides_paid",
    dueField: "guides_due",
    discountField: "guides_discount",
  },
  belt: {
    totalKeys: ["belt"],
    paidKeys: ["amount_paid", "belt_paid"],
    dueKeys: ["belt_due"],
    totalField: "belt",
    paidField: "belt_paid",
    dueField: "belt_due",
    discountField: "belt_discount",
  },
  tie: {
    totalKeys: ["tie_fee", "tie"],
    paidKeys: ["amount_paid", "tie_fee_paid", "tie_paid"],
    dueKeys: ["tie_fee_due", "tie_due"],
    totalField: "tie_fee",
    paidField: "tie_fee_paid",
    dueField: "tie_fee_due",
    discountField: "tie_fee_discount",
  },
};

const mergePaymentDataWithDynamicTransactions = (paymentData = {}, rows = []) => {
  const merged = { ...(paymentData || {}) };
  const aggregateByPaidField = {};

  rows.forEach((row) => {
    const rawFeeType = String(
      row?.fee_type || row?.feeType || row?.FeeType || row?.feeName || ""
    ).trim();
    const normalizedFeeType = normalizeFeeFieldName(rawFeeType);
    const feeConfig = DYNAMIC_FEE_TRANSACTION_FIELD_MAP[normalizedFeeType];

    if (!feeConfig) return;

    const total = readFirstNumericValue(row, feeConfig.totalKeys);
    const paid = readFirstNumericValue(row, feeConfig.paidKeys);
    const due = readFirstNumericValue(row, feeConfig.dueKeys);
    const discount = readFeeDiscountValue(row, feeConfig.totalField, rawFeeType);

    const bucketKey = feeConfig.paidField;
    if (!aggregateByPaidField[bucketKey]) {
      aggregateByPaidField[bucketKey] = {
        totalField: feeConfig.totalField,
        paidField: feeConfig.paidField,
        dueField: feeConfig.dueField,
        discountField: feeConfig.discountField || `${feeConfig.totalField}_discount`,
        total: Number(merged?.[feeConfig.totalField]) || 0,
        paidFromRows: 0,
        dueFromRows: Number(merged?.[feeConfig.dueField]) || 0,
        discountFromRows: Number(merged?.[feeConfig.discountField || `${feeConfig.totalField}_discount`]) || 0,
      };
    }

    aggregateByPaidField[bucketKey].total = Math.max(
      Number(aggregateByPaidField[bucketKey].total) || 0,
      total
    );
    aggregateByPaidField[bucketKey].paidFromRows += Number(paid) || 0;
    aggregateByPaidField[bucketKey].dueFromRows = Math.max(
      Number(aggregateByPaidField[bucketKey].dueFromRows) || 0,
      Number(due) || 0
    );
    aggregateByPaidField[bucketKey].discountFromRows = Math.max(
      Number(aggregateByPaidField[bucketKey].discountFromRows) || 0,
      Number(discount) || 0
    );
  });

  Object.values(aggregateByPaidField).forEach((bucket) => {
    const existingPaid = Number(merged?.[bucket.paidField]) || 0;
    const paid = Math.max(existingPaid, Number(bucket.paidFromRows) || 0);
    const total = Math.max(Number(bucket.total) || 0, Number(merged?.[bucket.totalField]) || 0);
    const discount = Math.max(Number(bucket.discountFromRows) || 0, readFeeDiscountValue(merged, bucket.totalField, bucket.totalField));
    const effectiveTotal = Math.max(total - discount, 0);
    const computedDue = Math.max(effectiveTotal - paid, 0);
    const due = Math.max(Number(bucket.dueFromRows) || 0, computedDue);

    merged[bucket.totalField] = total;
    merged[bucket.paidField] = paid;
    merged[bucket.dueField] = due;
    merged[bucket.discountField] = discount;
  });

  return merged;
};

const paidInstallments = React.useMemo(() => {
  if (!installmentOptions || tuitionPaid == null) return [];
  const paid = [];
  let runningTotal = 0;
  const sortedInstallments = [...installmentOptions]
    .filter(inst => inst.amount && parseFloat(inst.amount) > 0)
    .sort((a, b) => a.id - b.id);
  sortedInstallments.forEach(inst => {
    const amount = parseFloat(inst.amount);
    runningTotal += amount;
    if (tuitionPaid >= runningTotal - 0.01) {
      paid.push(inst.id);
    }
  });
  return paid;
}, [installmentOptions, tuitionPaid]);
 
    // Initialize receipt formatting options from localStorage
  const [prefix, setPrefix] = useState(localStorage.getItem('receiptPrefix') || '');
  const [suffix, setSuffix] = useState(localStorage.getItem('receiptSuffix') || '');
  const [yearPosition, setYearPosition] = useState(localStorage.getItem('yearPosition') || 'after');
  const [year, setYear] = useState(localStorage.getItem('receiptYear') || new Date().getFullYear());
useEffect(() => {

 
  // Load prefix
  const savedPrefix = localStorage.getItem('receiptPrefix');
  if (savedPrefix) {
    setPrefix(savedPrefix);
  }
 
  // Load suffix
  const savedSuffix = localStorage.getItem('receiptSuffix');
  if (savedSuffix) {
    setSuffix(savedSuffix);
  }
 
  // Load year position
  const savedYearPosition = localStorage.getItem('yearPosition');
  if (savedYearPosition) {
    setYearPosition(savedYearPosition);
  }
 
  // Load year
  const savedYear = localStorage.getItem('receiptYear');
  if (savedYear) {
    setYear(parseInt(savedYear));
  }
}, []);
 // Reset function
const resetPopup = () => {
  setFeeEntries([]);            
  setShowInstallments(false);    
  setPaymentMode("");           
  setCashAmount(0);              
  setOnlineAmount(0);            
};

// Close handler
const handleClosePopup = () => {
  resetPopup();
  setShowPopup(false);
  if (popupOnly && typeof onPopupClose === "function") {
    onPopupClose();
  }
};

  useEffect(() => {
    const fetchSchoolLogo = async () => {
      const code = localStorage.getItem("schoolCode");
      if (!code) {
        return;
      }
      setDynamicSchoolCode(code);
      try {
        const response = await axios.post(
          "https://cleezoclass.com:4000/api/schoollogodynamic",
          { secretecode: code },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        if (response.data.logoPath) {
          setDynamicLogoSrc(response.data.logoPath);
        }
      } catch (error) {
        console.error("Error fetching school logo:", error);
      }
    };
    fetchSchoolLogo();
  }, []);
 const [busFeeAmount, setBusFeeAmount] = useState('');
 const [busFeeFrequency, setBusFeeFrequency] = useState('monthly');
 const [oldBusFee, setOldBusFee] = useState(null);
 const [oldFrequencyType, setOldFrequencyType] = useState('');
 const [loginId, setLoginId] = useState(null);

 const saveReceiptNumberToDB = async (nextReceiptNumber) => {
  const schoolCode = localStorage.getItem("schoolCode");
  if (!schoolCode) return;
  try {
    await axios.post("https://cleezoclass.com:4000/api/saveLastReceiptNumber", {
      schoolCode,
      lastReceiptNumber: nextReceiptNumber,
    });
  } catch (error) {
    console.error("[RECEIPT][PAYMENT] failed to persist receipt number:", error);
  }
 };

  const incrementReceiptNumber = async (baseReceiptNumber = receiptNumber) => {
    const current = parseInt(baseReceiptNumber || "0", 10);
    const next = (Number.isNaN(current) ? 1 : current + 1).toString().padStart(3, "0");
    await saveReceiptNumberToDB(next);
    setReceiptNumber(next);
    currentReceiptNumberRef.current = next;
    return next;
  };
 

  // Image imports
  const [admissionFee, setAdmissionFee] = useState(0);
  const [admissionPaid, setAdmissionPaid] = useState(0);

  const handleBackClick = () => {
    navigate("/income");
  };


    const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  
  const handleDownload = async () => {
    const input = dashboardRef.current;
    if (!input) return;
    const originalStyle = {
      height: input.style.height,
      overflow: input.style.overflow,
    };
    const fullHeight = input.scrollHeight;
    input.style.height = fullHeight + "px";
    input.style.overflow = "visible";
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        width: input.scrollWidth,
        height: input.scrollHeight,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pageHeight = 297;
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save("WarmLeads.pdf");
    } catch (error) {
      console.error("Error generating full PDF:", error);
    } finally {
      input.style.height = originalStyle.height;
      input.style.overflow = originalStyle.overflow;
    }
  };
    // Adds a new empty row for dynamic fee entry in the main form
  const addFeeEntryRow = () => {
    setFeeEntries([...feeEntries, { type: '', amount: '' }]);
  };
 
  // Removes a dynamic fee entry row from the main form
  const removeFeeEntryRow = (index) => {
    const updatedEntries = feeEntries.filter((_, i) => i !== index);
    setFeeEntries(updatedEntries);
 
    // Recalculate fees summary after removal
    const newFees = { tuition: 0, exam: 0, bus: 0, uniform: 0, books: 0, other: 0, residential: 0 };
    updatedEntries.forEach(entry => {
      const typeKey = entry.type?.toLowerCase();
      const amount = parseFloat(entry.amount) || 0;
      if (typeKey && newFees.hasOwnProperty(typeKey)) {
        newFees[typeKey] += amount;
      }
    });
    setFees(newFees);
  };
  const generatePDFBlob = async () => {
    const element = dashboardRef.current;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    return pdf.output("blob");
  };
 


useEffect(() => {
  const fetchFeeStructure = async () => {
    if (!className || !section) return;
 
    try {
      const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
      const response = await axios.get(
        `https://cleezoclass.com:4000/feeStructure/${className}`,
        { params: { schoolCode, section } }
      );
 
      if (!response.data?.feeStructure) {
        displayToast(`No fee structure found for Class ${className}.`, "error");
        return;
      }
 
      const backendData = response.data.feeStructure;
      
      // Get all fees directly from the response
      const fees = {
        admission: parseFloat(backendData.Admission_Fee) || 0,
        book: parseFloat(backendData.Book_Fee) || 0,
        uniform: parseFloat(backendData.Uniform_Fee) || 0,
        exam: parseFloat(backendData.Exam_Fee) || 0,
        other: parseFloat(backendData.Other_Fee) || 0,
        bus: parseFloat(backendData.Bus_Fee) || 0,
        residential: parseFloat(backendData.ResidentialCompleteFee) || 0,
        // Tuition should only appear when it is explicitly stored for the class.
        tuition: parseFloat(backendData.Tuition_Fee) || parseFloat(backendData.Calculated_Tuition_Fee) || 0
      };
 
      setDefaultFees(fees);
      setFees(fees);
      
      setFeeStructure({
        ...fees,
        complete_fee: parseFloat(backendData.CompleteFee) || 0
      });
 
    } catch (error) {
      console.error("Failed to fetch fee structure:", error);
      displayToast("Failed to load fee structure.", "error");
    }
  };
 
  fetchFeeStructure();
}, [className, section]);


   const allFeeTypes = [
    { value: 'admission', label: 'Admission Fee' },
    { value: 'tuition', label: 'Tuition Fee' },
   { value: 'exam', label: 'Exam Fee' },
   { value: 'bus', label: 'Bus Fee' },
   { value: 'uniform', label: 'Uniform Fee' },
   { value: 'books', label: 'Books Fee' },
   { value: 'residential', label: 'Residential Fee' },
   { value: 'other', label: 'Other Fees' },
  ];
  const formatReceiptNumber = () => {
  let formattedNumber = '';
 
  // Add prefix if exists
  if (prefix) {
    formattedNumber += prefix;
  }
 
  // Add year if exists and position is before
  if (year && yearPosition === 'before') {
    formattedNumber += year;
  }
 
  // Add the actual receipt number
  formattedNumber += receiptNumber.toString().padStart(4, '0'); // Assuming you want 4 digits
 
 
  // Add suffix if exists
  if (suffix) {
    formattedNumber += suffix;
  }
 
  // Add year if exists and position is after
  if (year && yearPosition === 'after') {
    formattedNumber += year;
  }
  return formattedNumber;
};
// REPLACE THE ENTIRE EXISTING useEffect BLOCK WITH THIS ONE
useEffect(() => {

  // 🔁 RESET STATE
  setStudentData({ name: "", fatherName: "", class: "", section: "", rollNumber: "", billType: "full-package" });
  setPayments({});
  setTotalAmount(0);
  setPaidAmount(0);
  setRemainingAmount(0);

  setTuitionFee(0);
  setExamFee(0);
  setBusFee(0);
  setBookFee(0);
  setUniformFee(0);
  setOthersFee(0);
  setAdmissionFee(0);

  setTuitionPaid(0);
  setExamPaid(0);
  setBusPaid(0);
  setBookPaid(0);
  setUniformPaid(0);
  setOthersPaid(0);
  setAdmissionPaid(0);

  setTuitionRemaining(0);
  setExamRemaining(0);
  setBusRemaining(0);
  setBookRemaining(0);
  setUniformRemaining(0);
  setOthersRemaining(0);
  setAdmissionRemaining(0);
  setResidentialRemaining(0);

  if (!selectedStudentId) return;

  const selected =
    students.find((s) => String(s.id) === String(selectedStudentId)) || null;
  const selectedName =
    selected?.name || initialStudentName || selectedStudent || "";
  const selectedSection = selected?.section || section || "A";

  console.log("[Payment][feeChain:start]", {
    selectedStudentId,
    selectedFoundInStudents: Boolean(selected),
    selectedName,
    selectedSection,
    className,
  });

  setStudentData((prev) => ({
    ...(prev || {}),
    name: selectedName,
    fatherName: selected?.fatherName || prev?.fatherName || "Not Available",
    class: className,
    section: selectedSection,
    rollNumber: String(selectedStudentId),
    billType: "full-package",
    photo: selected?.photo || prev?.photo || null,
  }));

  const schoolCode = localStorage.getItem("schoolCode");
  let liveBusFee = 0;

  axios
    .post("https://cleezoclass.com:4000/get-bus-fee", {
      studentName: selectedName,
      className: className.replace("Class ", "").trim(),
      sectionName: selectedSection,
      schoolCode,
    })
    .then((busFeeRes) => {
      console.log("[Payment][feeChain:busFee]", {
        selectedStudentId,
        selectedName,
        busFeeResponse: busFeeRes.data,
      });

      liveBusFee = parseFloat(busFeeRes.data?.Bus_fees) || 0;

      console.log("[Payment][feeChain:paymentRequest]", {
        selectedStudentId,
        schoolCode,
        url: `https://cleezoclass.com:4000/api/payment/${selectedStudentId}?schoolCode=${schoolCode}`,
      });
      return axios.get(
        `https://cleezoclass.com:4000/api/payment/${selectedStudentId}?schoolCode=${schoolCode}`
      );
    })
    .then((paymentRes) => {
      console.log("[Payment][feeChain:paymentResponse]", {
        selectedStudentId,
        paymentRes: paymentRes.data,
      });

      const basePaymentData = paymentRes.data.payments || {};
      const hasDynamicFields = [
        "sports",
        "sports_paid",
        "sports_due",
        "stationary",
        "stationary_paid",
        "stationary_due",
        "guides",
        "guides_paid",
        "guides_due",
        "belt",
        "belt_paid",
        "belt_due",
        "tie_fee",
        "tie_fee_paid",
        "tie_fee_due",
        "tie",
        "tie_paid",
        "tie_due",
      ].some((key) => Number(basePaymentData?.[key]) > 0);

      if (hasDynamicFields) {
        return { paymentData: basePaymentData };
      }

      return axios
        .get("https://cleezoclass.com:4000/api/student-transactions-dynamic", {
          params: {
            schoolCode,
            studentName: selectedName,
            className: className.replace("Class ", "").trim(),
            section: selectedSection,
          },
        })
        .then((transactionRes) => {
          const transactionRows = Array.isArray(transactionRes.data)
            ? transactionRes.data
            : [];
          const mergedPaymentData = mergePaymentDataWithDynamicTransactions(
            basePaymentData,
            transactionRows
          );

          console.log("[Payment][dynamicTransactionBackfill]", {
            selectedStudentId,
            selectedName,
            transactionCount: transactionRows.length,
            mergedDynamicFields: {
              sports: Number(mergedPaymentData.sports) || 0,
              sports_paid: Number(mergedPaymentData.sports_paid) || 0,
              sports_due: Number(mergedPaymentData.sports_due) || 0,
              stationary: Number(mergedPaymentData.stationary) || 0,
              stationary_paid: Number(mergedPaymentData.stationary_paid) || 0,
              stationary_due: Number(mergedPaymentData.stationary_due) || 0,
              guides: Number(mergedPaymentData.guides) || 0,
              guides_paid: Number(mergedPaymentData.guides_paid) || 0,
              guides_due: Number(mergedPaymentData.guides_due) || 0,
              belt: Number(mergedPaymentData.belt) || 0,
              belt_paid: Number(mergedPaymentData.belt_paid) || 0,
              belt_due: Number(mergedPaymentData.belt_due) || 0,
              tie_fee: Number(mergedPaymentData.tie_fee) || 0,
              tie_fee_paid: Number(mergedPaymentData.tie_fee_paid) || 0,
              tie_fee_due: Number(mergedPaymentData.tie_fee_due) || 0,
            },
          });

          return { paymentData: mergedPaymentData };
        })
        .catch((dynamicError) => {
          console.error(
            "[Payment] Failed to backfill dynamic fee transactions:",
            dynamicError?.response?.data || dynamicError?.message
          );
          return { paymentData: basePaymentData };
        });
    })
    .then(({ paymentData }) => {
      setPayments(paymentData);

      // ---------- BASE ----------
      const completeFee =
        getClassFeeValue("CompleteFee", "completeFee") ||
        parseFloat(paymentData.completeFee) ||
        0;
      const examFee =
        getClassFeeValue("Exam_fees", "Exam_Fees", "examFee") ||
        parseFloat(paymentData.examFee) ||
        0;
      const bookFee =
        getClassFeeValue("Book_Fees", "bookFee") ||
        parseFloat(paymentData.bookFee) ||
        0;
      const uniformFee =
        getClassFeeValue("Uniform_fees", "uniformFee") ||
        parseFloat(paymentData.uniformFee) ||
        0;
      const othersFee =
        getClassFeeValue("Others", "OtherFee", "othersFee") ||
        parseFloat(paymentData.othersFee) ||
        0;
      const admissionFee =
        getClassFeeValue("Admission_fees", "Admission_Fee", "admissionFee") ||
        parseFloat(paymentData.admissionFee) ||
        0;
      const residentialFee =
        getClassFeeValue("ResidentialCompleteFee", "residentialFee") ||
        parseFloat(paymentData.residentialFee) ||
        0;

      // ---------- PAID ----------
      const tuitionPaid = parseFloat(paymentData.paidAmount) || 0;
      const examPaid = parseFloat(paymentData.examPaid) || 0;
      const busPaid = parseFloat(paymentData.busPaid) || 0;
      const bookPaid = parseFloat(paymentData.bookPaid) || 0;
      const uniformPaid = parseFloat(paymentData.uniformPaid) || 0;
      const othersPaid = parseFloat(paymentData.othersPaid) || 0;
      const admissionPaid = parseFloat(paymentData.admissionPaid) || 0;
      const residentialPaid = parseFloat(paymentData.residentialPaid) || 0;

      // ---------- DISCOUNTS ----------
      const tuitionDiscount =
        parseFloat(paymentData.tuitionDiscount) ||
        parseFloat(paymentData.discounts?.tuitionDiscount) ||
        0;
      const busDiscount =
        parseFloat(paymentData.busDiscount) ||
        parseFloat(paymentData.discounts?.busDiscount) ||
        0;
      const bookDiscount =
        parseFloat(paymentData.feeDiscount) ||
        parseFloat(paymentData.discounts?.feeDiscount) ||
        0;
      const admissionDiscount =
        parseFloat(paymentData.admissionDiscount) ||
        0;

      // ================= FIXED LOGIC =================

      // ✅ TUITION (apply tuition discount on tuition fee)
      const dynamicFeeTotal =
        (Number(paymentData.sports) || 0) +
        (Number(paymentData.stationary) || 0) +
        (Number(paymentData.guides) || 0) +
        (Number(paymentData.belt) || 0) +
        (Number(paymentData.tie_fee || paymentData.tie) || 0);

      const tuitionFeeBase =
        parseFloat(paymentData.Tuition_Fee) ||
        parseFloat(paymentData.Calculated_Tuition_Fee) ||
        parseFloat(paymentData.tuitionFee) ||
        0;
      const finalTuitionFee = Math.max(tuitionFeeBase - tuitionDiscount, 0);
      const finalTuitionRemaining = finalTuitionFee - tuitionPaid;

      // ✅ BUS FIX
      const finalBusFee =
        liveBusFee === 0 && busPaid > 0
          ? busPaid
          : liveBusFee;

      const finalBusRemaining =
        finalBusFee - busPaid - busDiscount;

      // ✅ BOOK FIX
      const finalBookFee =
        bookFee === 0 && bookPaid > 0
          ? bookPaid
          : bookFee;

      const finalBookRemaining =
        finalBookFee - bookPaid - bookDiscount;

      // ✅ OTHER FIX
      const finalOthersFee =
        othersFee === 0 && othersPaid > 0
          ? othersPaid
          : othersFee;

      const finalOthersRemaining = 0;

      // ================= TOTAL =================

      const totalAmount =
        finalTuitionFee +
        finalBusFee +
        finalBookFee +
        uniformFee +
        finalOthersFee +
        admissionFee +
        examFee +
        residentialFee;

      const totalPaid =
        tuitionPaid +
        examPaid +
        busPaid +
        bookPaid +
        uniformPaid +
        othersPaid +
        admissionPaid +
        residentialPaid;

      const totalDiscount =
        parseFloat(paymentData?.discounts?.totalDiscount) ||
        parseFloat(paymentData?.totalDiscount) ||
        parseFloat(paymentData?.discountAmount) ||
        0;

      const finalRemaining =
        totalAmount - totalPaid - totalDiscount;

      console.log("[Payment][calculation-breakdown]", {
        studentName: paymentData.studentName || selectedStudent || initialStudentName || "",
        className: paymentData.class || className,
        sectionName: paymentData.section || section,
        completeFee,
        completeFeeAlreadyIncludesDynamic:
          completeFee > 0 &&
          completeFee ===
            (
              finalTuitionFee +
              admissionFee +
              examFee +
              finalBusFee +
              finalBookFee +
              uniformFee +
              finalOthersFee +
              residentialFee +
              (Number(paymentData.sports) || 0) +
              (Number(paymentData.stationary) || 0) +
              (Number(paymentData.guides) || 0) +
              (Number(paymentData.belt) || 0) +
              (Number(paymentData.tie_fee || paymentData.tie) || 0)
            ),
        staticBreakdown: {
          tuitionFeeBase,
          finalTuitionFee,
          tuitionPaid,
          tuitionDiscount,
          admissionFee,
          admissionPaid,
          examFee,
          examPaid,
          finalBusFee,
          busPaid,
          busDiscount,
          finalBookFee,
          bookPaid,
          bookDiscount,
          uniformFee,
          uniformPaid,
          finalOthersFee,
          othersPaid,
          residentialFee,
          residentialPaid,
        },
        dynamicBreakdown: {
          sports: Number(paymentData.sports) || 0,
          sports_paid: Number(paymentData.sports_paid) || 0,
          sports_due: Number(paymentData.sports_due) || 0,
          stationary: Number(paymentData.stationary) || 0,
          stationary_paid: Number(paymentData.stationary_paid) || 0,
          stationary_due: Number(paymentData.stationary_due) || 0,
          guides: Number(paymentData.guides) || 0,
          guides_paid: Number(paymentData.guides_paid) || 0,
          guides_due: Number(paymentData.guides_due) || 0,
          belt: Number(paymentData.belt) || 0,
          belt_paid: Number(paymentData.belt_paid) || 0,
          belt_due: Number(paymentData.belt_due) || 0,
          tie_fee: Number(paymentData.tie_fee || paymentData.tie) || 0,
          tie_fee_paid: Number(paymentData.tie_fee_paid || paymentData.tie_paid) || 0,
          tie_fee_due: Number(paymentData.tie_fee_due || paymentData.tie_due) || 0,
          dynamicFeePaidTotal: Number(paymentData.dynamicFeePaidTotal) || 0,
          dynamicFeeDueTotal: Number(paymentData.dynamicFeeDueTotal) || 0,
        },
        totals: {
          totalAmount,
          totalPaid,
          totalDiscount,
          finalRemaining,
          paymentDataTotalRemaining: Number(paymentData.totalRemaining) || 0,
        },
        rawPaymentData: paymentData,
      });


      // ================= SET STATES =================

      setTotalAmount(totalAmount);
      setPaidAmount(totalPaid);
      setRemainingAmount(finalRemaining);

      setTuitionFee(finalTuitionFee);
      setTuitionPaid(tuitionPaid);
      setTuitionRemaining(finalTuitionRemaining);

      setBusFee(finalBusFee);
      setBusPaid(busPaid);
      setBusRemaining(finalBusRemaining);

      setBookFee(finalBookFee);
      setBookPaid(bookPaid);
      setBookRemaining(finalBookRemaining);

      setUniformFee(uniformFee);
      setUniformPaid(uniformPaid);
      setUniformRemaining(uniformFee - uniformPaid);

      setOthersFee(finalOthersFee);
      setOthersPaid(othersPaid);
      setOthersRemaining(finalOthersRemaining);

      setAdmissionFee(admissionFee);
      setResidentialFee(residentialFee);
      setAdmissionPaid(admissionPaid);
      setResidentialPaid(residentialPaid);
      setResidentialRemaining(residentialFee - residentialPaid);
      setAdmissionRemaining(admissionFee - admissionPaid - admissionDiscount);

      setExamFee(examFee);
      setExamPaid(examPaid);
      setExamRemaining(examFee - examPaid);
    })
    .catch((err) => {
      console.error("Error in Fee Chain:", err.response?.data || err.message);
    });

}, [selectedStudentId, className, section, students, initialStudentName, selectedStudent]);

  // Function to handle changes in tuition installment amount
const handleTuitionInstallmentAmountChange = (index, installmentId, newAmountPaid) => {
  const parsedNewAmount = parseFloat(newAmountPaid);
 
  // Update the amount for the current fee entry
  setFeeEntries((prevFeeEntries) => {
    const updatedFeeEntries = [...prevFeeEntries];
    updatedFeeEntries[index].amount = newAmountPaid;
    return updatedFeeEntries;
  });
 
  if (isNaN(parsedNewAmount)) {
    return;
  }
 
  setInstallmentOptions((prevInstallmentOptions) => {
    const newInstallmentOptions = prevInstallmentOptions.map((inst) => ({
      ...inst,
    }));
    const currentInstallmentIndex = newInstallmentOptions.findIndex(
      (inst) => inst.id.toString() === installmentId.toString()
    );
 
    if (currentInstallmentIndex === -1) {
      console.error("Selected installment not found in options.");
      return prevInstallmentOptions;
    }
 
    // Reset all upcoming unpaid installments to their original amounts
    for (
      let i = currentInstallmentIndex + 1;
      i < newInstallmentOptions.length;
      i++
    ) {
      const inst = newInstallmentOptions[i];
      if (!inst.paid) {
        inst.amount = parseFloat(inst.originalAmount);
      }
    }
 
    const currentInstallment = newInstallmentOptions[currentInstallmentIndex];
    const originalInstallmentDue = parseFloat(currentInstallment.originalAmount);
    let difference = parsedNewAmount - originalInstallmentDue;
 
    const upcomingUnpaidInstallments = newInstallmentOptions.filter(
      (inst, idx) =>
        idx > currentInstallmentIndex && !inst.paid && inst.originalAmount > 0
    );
 
    if (difference !== 0 && upcomingUnpaidInstallments.length > 0) {
      if (difference > 0) {
        // Payment is more than the current installment (overpayment)
        // Calculate the total due for all upcoming unpaid installments
        const totalUpcomingDue = upcomingUnpaidInstallments.reduce(
          (sum, inst) => sum + parseFloat(inst.originalAmount),
          0
        );
 
        // Calculate the total remaining amount to be paid after applying the difference
        let remainingTotal = totalUpcomingDue - difference;
 
        if (remainingTotal > 0) {
          // Distribute the remaining total equally among the unpaid installments
          const newAmountPerInstallment = remainingTotal / upcomingUnpaidInstallments.length;
          upcomingUnpaidInstallments.forEach((inst) => {
            inst.amount = newAmountPerInstallment;
          });
        } else {
          // If the payment is enough to cover all upcoming installments, set them to 0
          upcomingUnpaidInstallments.forEach((inst) => {
            inst.amount = 0;
          });
        }
      } else {
        // Payment is less than the current installment (underpayment)
        // Add the remaining amount to the next unpaid installments
        const remainingAmount = Math.abs(difference);
        const amountPerInstallment = remainingAmount / upcomingUnpaidInstallments.length;
        
        upcomingUnpaidInstallments.forEach((inst) => {
          inst.amount = parseFloat(inst.originalAmount) + amountPerInstallment;
        });
      }
    }
 
    // Update the current installment amount to reflect the payment
    currentInstallment.amount = parsedNewAmount;
 
    return newInstallmentOptions;
  });
};
const [showPopup, setShowPopup] = useState(Boolean(popupOnly));

const handleFeeEntryChange = (index, field, value) => {
  const updatedEntries = [...feeEntries];
  updatedEntries[index][field] = value;

  let newFees = { ...fees };

  if (field === 'type') {
    const selectedType = value;
    if (!updatedEntries[index].amount) {
      const amount = selectedType === "other" || selectedType === "books" ? 0 : (defaultFees[selectedType] || 0);
      updatedEntries[index].amount = amount;
    }
    newFees[selectedType] = parseFloat(updatedEntries[index].amount) || 0;

  } else if (field === 'amount') {
    const selectedType = updatedEntries[index].type;
    const amount = parseFloat(value) || 0;
    if (selectedType) {
      newFees[selectedType] = amount;
    }
  }

  setFeeEntries(updatedEntries);
  setFees(newFees);

};


const [showPaidPopup, setShowPaidPopup] = useState(false);
const [paidPageData, setPaidPageData] = useState(null);
 const [cashAmount, setCashAmount] = useState();
const [onlineAmount, setOnlineAmount] = useState();
const [duplicateConfirmState, setDuplicateConfirmState] = useState({
  isOpen: false,
  message: "",
});
const duplicateConfirmResolverRef = useRef(null);

const askDuplicateConfirmation = (message) => {
  return new Promise((resolve) => {
    duplicateConfirmResolverRef.current = resolve;
    setDuplicateConfirmState({
      isOpen: true,
      message,
    });
  });
};

const closeDuplicateConfirmation = (confirmed) => {
  setDuplicateConfirmState({
    isOpen: false,
    message: "",
  });

  if (duplicateConfirmResolverRef.current) {
    duplicateConfirmResolverRef.current(confirmed);
    duplicateConfirmResolverRef.current = null;
  }
};

const buildPaymentSignature = (paymentData) => {
  const normalizedFeeDescriptions = (paymentData.feeDescriptions || [])
    .filter((entry) => entry && parseFloat(entry.amount) > 0)
    .map((entry) => ({
      type: entry.type || "",
      amount: Number(parseFloat(entry.amount || 0).toFixed(2)),
      description: (entry.description || "").trim(),
      installmentId: entry.installmentId || null,
    }))
    .sort((a, b) => {
      const keyA = `${a.type}|${a.installmentId || ""}|${a.description}|${a.amount}`;
      const keyB = `${b.type}|${b.installmentId || ""}|${b.description}|${b.amount}`;
      return keyA.localeCompare(keyB);
    });

  return JSON.stringify({
    studentName: paymentData.studentName,
    className: paymentData.className,
    sectionName: paymentData.sectionName,
    schoolCode: paymentData.schoolCode,
    paymentDate: paymentData.paymentDate,
    paymentMode: paymentData.paymentMode,
    transactionId: (paymentData.transactionId || "").trim(),
    discount: Number(parseFloat(paymentData.Discount || 0).toFixed(2)),
    paid: {
      tuition: Number(parseFloat(paymentData.Paid_Amount || 0).toFixed(2)),
      books: Number(parseFloat(paymentData.books_paid || 0).toFixed(2)),
      bus: Number(parseFloat(paymentData.bus_paid || 0).toFixed(2)),
      uniform: Number(parseFloat(paymentData.uniform_paid || 0).toFixed(2)),
      exam: Number(parseFloat(paymentData.exam_paid || 0).toFixed(2)),
      admission: Number(parseFloat(paymentData.admission_paid || 0).toFixed(2)),
      others: Number(parseFloat(paymentData.others_paid || 0).toFixed(2)),
      residential: Number(parseFloat(paymentData.residential_paid || 0).toFixed(2)),
      cash: Number(parseFloat(cashAmount || 0).toFixed(2)),
      online: Number(parseFloat(onlineAmount || 0).toFixed(2)),
    },
    feeDescriptions: normalizedFeeDescriptions,
  });
};

// Inside your component
const fetchLastReceiptNumber = async () => {
  const cachedReceiptNumber = localStorage.getItem('lastReceiptNumber');
  if (cachedReceiptNumber) {
    setReceiptNumber(cachedReceiptNumber);
    currentReceiptNumberRef.current = cachedReceiptNumber;
    return;
  }

  setReceiptNumber('001');
  currentReceiptNumberRef.current = '001';
};

useEffect(() => {
  fetchLastReceiptNumber(); // ✅ Call from useEffect
}, []);

const handlePaymentSubmission = async (e) => {
  e.preventDefault();
  setIsLoading(true);

  console.log("[Payment][submit] starting", {
    selectedStudentId,
    selectedStudent,
    className,
    section,
    paymentDate,
    paymentMode,
    receiptNumber,
    tuitionFee,
    examFee,
    busFee,
    bookFee,
    uniformFee,
    othersFee,
    admissionFee,
    residentialFee,
    tuitionPaid,
    examPaid,
    busPaid,
    bookPaid,
    uniformPaid,
    othersPaid,
    admissionPaid,
    residentialPaid,
  });

  const schoolCode = localStorage.getItem("schoolCode");
  if (!schoolCode) {
    showPopupMessage("School code not found in localStorage", "error");
    setIsLoading(false);
    return;
  }

  if (!selectedStudent) {
    showPopupMessage("Please select a student to make a payment for.", "error");
    setIsLoading(false);
    return;
  }

  if (!paymentDate || !paymentMode) {
    showPopupMessage(
      "Please fill in all payment details: Date, Receipt No., and Payment Mode.",
      "error"
    );
    setIsLoading(false);
    return;
  }


  const fees = {
    tuition: tuitionFee,
    books: bookFee,
    bus: busFee,
    uniform: uniformFee,
    exam: examFee,
    admission: admissionFee,
    other: othersFee,
    residential: residentialFee,
  };

  const alreadyPaidAmounts = {
    tuition: tuitionPaid,
    books: bookPaid,
    bus: busPaid,
    uniform: uniformPaid,
    exam: examPaid,
    admission: admissionPaid,
    other: othersPaid,
    residential: residentialPaid,
  };

  const feeTypesPaid = {
    tuition: 0,
    books: 0,
    bus: 0,
    uniform: 0,
    exam: 0,
    admission: 0,
    other: 0,
    residential: 0,
  };

  const customFeeEntries = dynamicFeeTypes
    .map((fee) => {
      const amount = parseFloat(dynamicFeeValues[fee.columnBase] || 0);
      const feeRow = dynamicFeeRows.find((row) => row.key === fee.columnBase);
      return {
        type: fee.feeName,
        columnBase: fee.columnBase,
        amount: Number.isFinite(amount) ? amount : 0,
        total: feeRow?.total || 0,
        paid: feeRow?.paid || 0,
        remaining: feeRow?.remaining || 0,
      };
    })
    .filter((entry) => entry.amount > 0);

  console.log("[Payment][submit] customFeeEntries", customFeeEntries);
  console.log("[Payment][submit] feeEntries", feeEntries);

  let currentTransactionTotal = 0;
  let tuitionInstallmentIdBeingPaid = null;

  // Add fee validation and accumulate amounts
  for (let i = 0; i < feeEntries.length; i++) {
    const entry = feeEntries[i];
    if (!entry) continue;
    if (entry.type && entry.amount) {
      const amount = parseFloat(entry.amount);
      if (!isNaN(amount) && amount > 0) {
        // Skip validation for "other" fees
        if (entry.type !== "other") {
          const totalPaidForTypeIncludingCurrent =
            (alreadyPaidAmounts[entry.type] || 0) + amount;
          const totalFeeForType = fees[entry.type];
          if (totalPaidForTypeIncludingCurrent > totalFeeForType + 0.001) {
            showPopupMessage(
              `Payment for ${entry.type} exceeds the total fee. Total ${entry.type} Fee: Rs. ${totalFeeForType.toFixed(
                2
              )}. Already Paid: Rs. ${(alreadyPaidAmounts[entry.type] || 0).toFixed(
                2
              )}.`,
              "error"
            );
            setIsLoading(false);
            return;
          }
        }

        feeTypesPaid[entry.type] += amount;
        currentTransactionTotal += amount;

        if (entry.type === "tuition" && entry.installmentId) {
          tuitionInstallmentIdBeingPaid = entry.installmentId;
        }
      }
    }
  }

  for (const entry of customFeeEntries) {
    const remaining = Math.max(Number(entry.remaining) || 0, 0);
    console.log("[Payment][submit] validating custom fee", {
      type: entry.type,
      columnBase: entry.columnBase,
      amount: entry.amount,
      total: entry.total,
      paid: entry.paid,
      remaining,
    });
    if (entry.total > 0 && entry.amount > remaining + 0.001) {
      showPopupMessage(
        `Payment for ${entry.type} exceeds the remaining fee. Total ${entry.type} Fee: Rs. ${entry.total.toFixed(2)}. Already Paid: Rs. ${(entry.paid || 0).toFixed(2)}.`,
        "error"
      );
      setIsLoading(false);
      return;
    }

    currentTransactionTotal += entry.amount;
  }

  // Filter feeEntries to include only those with a non-zero amount
  const submittedFeeEntries = feeEntries.filter(
    (entry) => entry && entry.amount && parseFloat(entry.amount) > 0
  );

  if (currentTransactionTotal <= 0) {
    showPopupMessage(
      "Payment amount must be greater than 0. Please add a valid fee.",
      "error"
    );
    setIsLoading(false);
    return;
  }

  // Prepare payment data
  const paymentData = {
    studentId: selectedStudentId,
    studentName: selectedStudent,
    className,
    sectionName: section,
    schoolCode,
    Paid_Amount: feeTypesPaid.tuition,
    books_paid: feeTypesPaid.books,
    bus_paid: feeTypesPaid.bus,
    uniform_paid: feeTypesPaid.uniform,
    exam_paid: feeTypesPaid.exam,
    admission_paid: feeTypesPaid.admission,
    others_paid: feeTypesPaid.other,
    residential_paid: feeTypesPaid.residential,
    tuition_paid_this_transaction: feeTypesPaid.tuition,
    tuition_installment_id: tuitionInstallmentIdBeingPaid,
    Discount: parseFloat(discountAmount) || 0,
    paymentDate,
    receiptNumber,
    paymentMode,
    transactionId,
    adjustedInstallments: installmentOptions.map((inst) => ({
      id: inst.id,
      amount: inst.amount,
      paid: inst.paid,
      originalAmount: inst.originalAmount,
    })),
    feeDescriptions: feeEntries
      .filter(entry => entry !== undefined)
      .map((entry) => ({
        type: entry.type,
        amount: entry.amount,
        description: entry.type === "other" ? entry.description || null : null,
        installmentId: entry.installmentId || null,
      })),
    customFeeEntries,
    allowDuplicate: false,
  };
  const currentSignature = buildPaymentSignature(paymentData);

  console.log("[Payment][submit] paymentData", paymentData);
  console.log("[Payment][submit] signature", currentSignature);

try {
  const duplicateCheckResponse = await fetch(
    "https://cleezoclass.com:4000/api/check-duplicate-fee-payment",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentData),
    }
  );

  if (duplicateCheckResponse.ok) {
    const duplicateCheckData = await duplicateCheckResponse.json();
    if (duplicateCheckData?.exists) {
      const confirmMessage = `Already you have paid this amount with receipt number ${duplicateCheckData.receiptNumber}. Do you want to pay again?`;
      const proceedWithDuplicate = await askDuplicateConfirmation(confirmMessage);
      if (!proceedWithDuplicate) {
        setIsLoading(false);
        return;
      }
      paymentData.allowDuplicate = true;
    }
  }

  const response = await fetch(
    "https://cleezoclass.com:4000/pay-fee-detailsincome",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentData),
    }
  );

  let data;
  try {
    data = await response.json();
  } catch (err) {
    console.error("Failed to parse JSON:", err);
    data = {};
  }


  // Check success flag if your backend sends it
  if (response.status === 409 && data?.duplicate) {
    const confirmMessage = `Already you have paid this amount with receipt number ${data.receiptNumber}. Do you want to pay again?`;
    const proceedWithDuplicate = await askDuplicateConfirmation(confirmMessage);
    if (!proceedWithDuplicate) {
      setIsLoading(false);
      return;
    }

    paymentData.allowDuplicate = true;
    const retryResponse = await fetch(
      "https://cleezoclass.com:4000/pay-fee-detailsincome",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      }
    );
    data = await retryResponse.json().catch(() => ({}));
  }

  if ((response.ok && data.success !== false) || data.success === true) {
    const usedReceiptNumber = data?.receiptNumber || receiptNumber;
    console.log("[Payment][submit] success response", data);
    setReceiptNumber(usedReceiptNumber);
    currentReceiptNumberRef.current = usedReceiptNumber;

    // Your existing success logic
    const paidPopupData = {
      studentId: selectedStudentId,
      studentName: selectedStudent,
      className,
      section,
      paymentDate,
      receiptNumber: usedReceiptNumber,
      paymentMode,
      discountAmount: parseFloat(discountAmount) || 0,
      paidAmount: currentTransactionTotal,
      fees: {
        admission: {
          totalPaid: alreadyPaidAmounts.admission + feeTypesPaid.admission,
          paidThisTransaction: feeTypesPaid.admission,
          highlight: feeTypesPaid.admission > 0,
        },
        tuition: {
          totalPaid: alreadyPaidAmounts.tuition + feeTypesPaid.tuition,
          paidThisTransaction: feeTypesPaid.tuition,
          highlight: feeTypesPaid.tuition > 0,
        },
        bus: {
          totalPaid: alreadyPaidAmounts.bus + feeTypesPaid.bus,
          paidThisTransaction: feeTypesPaid.bus,
          highlight: feeTypesPaid.bus > 0,
        },
        book: {
          totalPaid: alreadyPaidAmounts.books + feeTypesPaid.books,
          paidThisTransaction: feeTypesPaid.books,
          highlight: feeTypesPaid.books > 0,
        },
        uniform: {
          totalPaid: alreadyPaidAmounts.uniform + feeTypesPaid.uniform,
          paidThisTransaction: feeTypesPaid.uniform,
          highlight: feeTypesPaid.uniform > 0,
        },
        exam: {
          totalPaid: alreadyPaidAmounts.exam + feeTypesPaid.exam,
          paidThisTransaction: feeTypesPaid.exam,
          highlight: feeTypesPaid.exam > 0,
        },
        residential: {
          totalPaid: alreadyPaidAmounts.residential + feeTypesPaid.residential,
          paidThisTransaction: feeTypesPaid.residential,
          highlight: feeTypesPaid.residential > 0,
        },
        others: {
          totalPaid: alreadyPaidAmounts.other + feeTypesPaid.other,
          paidThisTransaction: feeTypesPaid.other,
          highlight: feeTypesPaid.other > 0,
          description: feeEntries.find((f) => f?.type === "other")?.description || "",
        },
      },
      customFees: customFeeEntries.map((entry) => ({
        key: entry.columnBase,
        label: entry.type,
        paidThisTransaction: entry.amount,
        totalPaid: (Number(entry.paid) || 0) + (Number(entry.amount) || 0),
        total: Number(entry.total) || 0,
        remaining:
          entry.total > 0
            ? Math.max((Number(entry.remaining) || 0) - (Number(entry.amount) || 0), 0)
            : 0,
      })),
      submittedFeeEntries,
    };

    setPaidPageData(paidPopupData);
    setShowPopup(false);
    setShowPaidPopup(true);

    showPopupMessage(data.message || "Payment submitted successfully!", "success");

    if (typeof onPaymentSuccess === "function") {
      try {
        await onPaymentSuccess({
          studentId: selectedStudentId,
          studentName: selectedStudent,
          className,
          section,
          paymentDate,
          receiptNumber: usedReceiptNumber,
          paymentMode,
          paidAmount: currentTransactionTotal,
        });
      } catch (refreshError) {
        console.error("[Payment][submit] refresh callback failed:", refreshError);
      }
    }

    // Reset form
    setSelectedStudent("");
    setPaidAmount(0);
    setDiscountAmount(0);
    setFeeEntries([{ type: "", amount: "" }]);
    setPaymentDate("");
    setPaymentMode("");
    setShowModal(false);
    const refreshStudentId = selectedStudentId;
    if (refreshStudentId !== null && refreshStudentId !== undefined) {
      console.log("[Payment][submit] refreshing student data after payment", {
        refreshStudentId,
      });
      setSelectedStudentId(null);
      setTimeout(() => {
        setSelectedStudentId(refreshStudentId);
      }, 0);
    }
    await fetchLastReceiptNumber();
  } else {
    // Show backend message even if response.ok is false
    showPopupMessage(data.message || "Payment submission failed. Please try again.", "error");
  }
} catch (err) {
  console.error("Payment failed:", err);
  showPopupMessage("Payment submission failed. Please try again.", "error");
} finally {
  setIsLoading(false);
}

};

  // Save Edited Bill
const saveEditedBill = async (e) => {
  if (e?.preventDefault) e.preventDefault();


    // Update state with edited values
    setReceiptNumber(editableBill.receiptNumber);
    setStudentData(editableBill.studentData);
    setTuitionFee(editableBill.tuitionFee);
    setAdmissionFee(editableBill.admissionFee);
    setExamFee(editableBill.examFee);
    setBusFee(editableBill.busFee);
    setBookFee(editableBill.bookFee);
    setUniformFee(editableBill.uniformFee);
    setOthersFee(editableBill.othersFee);
    setTuitionPaid(editableBill.tuitionPaid);
    setAdmissionPaid(editableBill.admissionPaid);
    setExamPaid(editableBill.examPaid);
    setBusPaid(editableBill.busPaid);
    setBookPaid(editableBill.bookPaid);
    setUniformPaid(editableBill.uniformPaid);
    setOthersPaid(editableBill.othersPaid);
    setTuitionDiscount(editableBill.tuitionDiscount);
    setBusDiscount(editableBill.busDiscount);
    setBookDiscount(editableBill.bookDiscount);
    setPaymentMode(editableBill.paymentMode);
    setPaymentDate(editableBill.paymentDate);
    setSchoolName(editableBill.schoolName);
    setTotalAmount(editableBill.totalAmount);
    setPaidAmount(editableBill.paidAmount);
    setRemainingAmount(editableBill.remainingAmount);

    const sourceElement = document.getElementById('bill-preview-content')?.children[0];
    if (!sourceElement) {
      alert("Could not find the bill content to generate the image.");
      return;
    }
    if (!studentData?.name) {
      alert("Please select a student before saving.");
      return;
    }

    // Create a hidden div to hold the cleaned clone
    const hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'absolute';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.width = '280px';
    hiddenDiv.style.overflow = 'visible';
    hiddenDiv.style.backgroundColor = '#ffffff';
    document.body.appendChild(hiddenDiv);

    // Clone the element and remove all edit inputs
    const clonedElement = sourceElement.cloneNode(true);
    const inputs = clonedElement.querySelectorAll('input, select, button');
    inputs.forEach(input => input.remove());

    // Set explicit widths for table cells to ensure columns are visible
    const amountCells = clonedElement.querySelectorAll('td:nth-child(2), th:nth-child(2)');
    amountCells.forEach(cell => {
      cell.style.width = '80px';
      cell.style.minWidth = '80px';
    });
    const paidCells = clonedElement.querySelectorAll('td:nth-child(3), th:nth-child(3)');
    paidCells.forEach(cell => {
      cell.style.width = '80px';
      cell.style.minWidth = '80px';
    });

    // Append the cleaned clone to the hidden div
    hiddenDiv.appendChild(clonedElement);

    // Add styles to ensure table borders and text are visible
    const style = document.createElement('style');
    style.innerHTML = `
      * {
        font-family: Arial, sans-serif !important;
        color: #000 !important;
        font-weight: 400 !important;
        -webkit-font-smoothing: none !important;
        font-smooth: never !important;
        text-rendering: geometricPrecision !important;
      }
      table {
        border-collapse: collapse !important;
        width: 100% !important;
      }
      td, th {
        border: 1px solid #000 !important;
        padding: 2px 4px !important;
        text-align: right !important;
      }
      th {
        background-color: #f0f0f0 !important;
      }
      .text-right {
        text-align: right !important;
      }
      .text-left {
        text-align: left !important;
      }
    `;
    hiddenDiv.appendChild(style);

    try {
      // Use html2canvas to capture the cleaned clone
      const canvas = await html2canvas(hiddenDiv, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        letterRendering: true,
        removeContainer: true,
        logging: true,
        allowTaint: true,
        width: clonedElement.offsetWidth,
        height: clonedElement.offsetHeight,
        windowWidth: clonedElement.offsetWidth,
        windowHeight: clonedElement.offsetHeight,
      });

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
      if (!blob) throw new Error("Failed to create image blob.");

      const schoolCode = localStorage.getItem('schoolCode');
      if (!schoolCode) throw new Error("School code not found.");

      const formData = new FormData();
      formData.append('billImage', blob, `receipt-${receiptNumber}-${studentData.name}.png`);
      formData.append('receiptNumber', receiptNumber);
      formData.append('studentName', studentData.name);
      formData.append('class', studentData.class);
      formData.append('section', studentData.section);
      formData.append('schoolCode', schoolCode);
      formData.append('regn_no', studentData.rollNumber);

      const response = await axios.post('https://cleezoclass.com:4000/api/bill/save', formData);
      if (response.status === 200) {
        setSuccessMessage("Bill saved successfully!");
        setShowSuccessModal(true);
        incrementReceiptNumber();
      } else {
        throw new Error(response.data.message || 'Server responded with an error.');
      }
    } catch (error) {
      console.error('Error saving bill image:', error);
      alert(`Failed to save image: ${error.message}`);
    } finally {
      // Clean up the hidden div
      if (document.body.contains(hiddenDiv)) {
        document.body.removeChild(hiddenDiv);
      }
    }
  };



  
  
const showPopupMessage = (message) => {
  setPopupMsg(message);
};

  const handleShare = async () => {
    const blob = await generatePDFBlob();
    const file = new File([blob], "Warmleads.pdf", { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "Management Report",
          text: "Please find the Management report attached.",
          files: [file],
        });
      } catch (err) {
        showPopupMessage(
          "Sharing was cancelled or failed: " + err.message,
          "error"
        );
      }
    } else {
      showPopupMessage(
        "This device or browser does not support file sharing. Please download and share manually.",
        "error"
      );
    }
  };

  const [studentName, setStudentName] = useState("");


  const [loading, setLoading] = useState(false);

  // Example classes and sections (can be dynamic if you fetch from backend)
  const classes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const sections = ["A", "B", "C", "D"];


const [totals, setTotals] = useState({
  Total_Calculated_Due: 0,
  Total_Paid_Without_Admission: 0,
  Total_Admission_Paid: 0,
  Percent_Due: 0,
  Percent_Paid: 0,
  Percent_Admission_Paid: 0,
  Percent_Admission_Due: 0
});

const fetchTotals = async () => {
  if (!className || !section) return;
  setLoading(true);
  setError("");

  try {
    const schoolCode = localStorage.getItem("schoolCode"); // ⬅️ Get from localStorage

    let res;

    if (studentName) {
      // 🔵 Student totals API (GET)
      res = await axios.get("https://cleezoclass.com:4000/api/admin/getStudentTotals", {
        params: { className, section, studentName, schoolCode }, 
      });

    } else {
      // 🔵 Class-section totals API (POST)
      res = await axios.post(
        "https://cleezoclass.com:4000/api/admin/getClassSectionFeeTotal",
        { className, section, schoolCode }  // ⬅️ Put in body
      );

    }

    const data = res.data;

    setTotals({
      Total_Calculated_Due: data.Total_Calculated_Due,
      Total_Paid_Without_Admission: data.Total_Paid_Without_Admission,
      Total_Admission_Paid: data.Total_Admission_Paid,
      Percent_Due: data.Percent_Due,
      Percent_Paid: data.Percent_Paid,
      Percent_Admission_Paid: data.Percent_Admission_Paid,
      Percent_Admission_Due: data.Percent_Admission_Due
    });

  } catch (err) {
    console.error(err);
    setError(err.response?.data?.message || "Failed to fetch totals.");
  } finally {
    setLoading(false);
  }
};




  // Refetch totals whenever selections change
  useEffect(() => {
    fetchTotals();
  }, [className, section, studentName]);
  
 const isLaptop = window.innerWidth >= 1024; 
useEffect(() => {
  const today = new Date().toISOString().split("T")[0];
  setPaymentDate(today);
  }, []);
  // FETCH DROPDOWNS
const [classFeeData, setClassFeeData] = useState({});
  const [studentFeesMap, setStudentFeesMap] = useState({});


  // --------------------------------------------
  // STEP 1 → Fetch CLASS fee when dropdown changes
  // --------------------------------------------
  useEffect(() => {
    if (!selectedClassSection) return;

    const [cls, sec] = selectedClassSection.split("_");
    console.log("[Payment][selectedClassSection]", {
      selectedClassSection,
      cls,
      sec,
      className,
      section,
    });
    setClassName(cls);
    setSection(sec);

    fetchClassFee(cls, sec);
  }, [selectedClassSection]);

  const fetchClassFee = async (cls, sec) => {
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      console.log("[Payment][fetchClassFee] request", { cls, sec, schoolCode });

      const res = await axios.get(`https://cleezoclass.com:4000/feeStructure/${cls}`, {
        params: { className: cls, section: sec, schoolCode },
      });

      const resolvedFeeDetail = res.data.feeStructure || {};
      console.log("[Payment][fetchClassFee] response", res.data);
      console.log("[Payment][fetchClassFee] resolved keys", Object.keys(resolvedFeeDetail || {}));
      console.log("[Payment][fetchClassFee] resolved values", resolvedFeeDetail);

      setClassFeeData(resolvedFeeDetail);
    } catch (error) {
      console.error("Error fetching class fees:", error);
      setClassFeeData({});
    }
  };
useEffect(() => {
  if (selectedClassSection) {
    const [cls, sec] = selectedClassSection.split("_");
    setClassName(cls);
    setSection(sec);
  }
}, [selectedClassSection]);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
    if (initialStudentName) {
      setSelectedStudent(initialStudentName);
    }
    console.log("[Payment][initialStudentSync]", {
      initialStudentId,
      initialStudentName,
    });
  }, [initialStudentId, initialStudentName]);

  useEffect(() => {
    if (!students.length) return;

    const normalizedTargetClass = normalizeClassLabel(className);
    const normalizedTargetSection = String(section || "").trim().toLowerCase();
    const normalizedTargetName = String(
      initialStudentName || selectedStudent || ""
    )
      .trim()
      .toLowerCase();

    const currentMatch = students.find(
      (student) => String(student.id) === String(selectedStudentId)
    );

    if (currentMatch) {
      return;
    }

    if (!normalizedTargetName) return;

    const resolvedStudent = students.find((student) => {
      const studentName = String(student.name || student.studentName || student.StudentName || "")
        .trim()
        .toLowerCase();
      const studentClass = normalizeClassLabel(
        student.class_name || student.className || student.class || student.FeeClass || ""
      ).toLowerCase();
      const studentSection = String(
        student.section || student.sectionName || student.Section || student.FeeSection || ""
      )
        .trim()
        .toLowerCase();

      const nameMatches = studentName === normalizedTargetName;
      const classMatches = !normalizedTargetClass || studentClass === normalizedTargetClass.toLowerCase();
      const sectionMatches =
        !normalizedTargetSection || studentSection === normalizedTargetSection;

      return nameMatches && classMatches && sectionMatches;
    });

    if (resolvedStudent) {
      console.log("[Payment][resolvedStudentByName]", {
        initialStudentId,
        selectedStudentId,
        initialStudentName,
        selectedStudent,
        resolvedStudent,
      });
      setSelectedStudentId(resolvedStudent.id);
      setSelectedStudent(resolvedStudent.name);
    }
  }, [students, selectedStudentId, initialStudentName, selectedStudent, className, section]);

useEffect(() => {
  if (popupOnly) {
    setShowPopup(true);
  }
}, [popupOnly]);

  useEffect(() => {
    const fetchDynamicFeeTypes = async () => {
      try {
      const schoolCode = localStorage.getItem("schoolCode");
      if (!schoolCode) return;

      const response = await axios.get("https://cleezoclass.com:4000/api/fee-types", {
        params: { schoolCode },
      });

      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      const normalized = rows
        .map((item) => {
          const columnBase = normalizeFeeColumnBase(item?.feeName);
          if (!columnBase) return null;
          return {
            id: item?.id,
            feeName: item?.feeName || columnBase,
            feesType: item?.feesType || "Custom Fee",
            scope: item?.scope || "All",
            frequency: item?.frequency || "One time",
            installments: item?.installments || 1,
            columnBase,
          };
        })
        .filter(Boolean);

        setDynamicFeeTypes(normalized);
        setDynamicFeeValues((prev) => {
          const next = { ...prev };
          normalized.forEach((fee) => {
            if (!(fee.columnBase in next)) next[fee.columnBase] = "";
          });
          return next;
        });
      } catch (error) {
        console.error("Error loading custom fee types:", error);
        setDynamicFeeTypes([]);
      }
    };

  fetchDynamicFeeTypes();
}, []);

  // Fetch students whenever className or section changes
useEffect(() => {
  // In popupOnly mode we still need the student list so the selected student id
  // can be resolved by name if the parent didn't pass a concrete id.
  if (showPopup && !popupOnly) return;

  if (!className || !section) {
    setStudents([]);
    return;
  }

  const schoolCode = localStorage.getItem("schoolCode");

  const fetchStudents = () => {
    axios
      .get(
        `https://cleezoclass.com:4000/api/studentsNameAccountant/${className}?schoolCode=${schoolCode}&section=${section}`
      )
      .then((res) => {
        console.log("[Payment][studentsNameAccountant] response", {
          className,
          section,
          count: res.data?.students?.length || 0,
          initialStudentId,
          initialStudentName,
        });
        setStudents(res.data?.students || []);
      })
      .catch(() => {
        setStudents([]);
      });
  };

  // 🚀 fetch immediately after popup closes
  fetchStudents();
  return undefined;
}, [showPopup, className, section, popupOnly, initialStudentId, initialStudentName]);




  // --------------------------------------------
  // HANDLE CLASS-SECTION CHANGE
  // --------------------------------------------
  const handleClassSectionChange = (e) => {
    setSelectedClassSection(e.target.value);
    setStudentFeesMap({});
    setClassFeeData({});
  };

const [feeDetail, setFeeDetail] = useState(null);

const [feeError, setFeeError] = useState("");

const normalizedClassFeeStructure = React.useMemo(() => {
  const source = feeStructure && typeof feeStructure === "object" ? feeStructure : {};
  const admission = Number(source.admission ?? source.Admission_Fee ?? source.Admission_fees ?? 0) || 0;
  const tuition = Number(source.tuition ?? source.Tuition_Fee ?? source.Calculated_Tuition_Fee ?? 0) || 0;
  const exam = Number(source.exam ?? source.Exam_Fee ?? source.Exam_fees ?? 0) || 0;
  const bus = Number(source.bus ?? source.Bus_Fee ?? source.Bus_fees ?? 0) || 0;
  const uniform = Number(source.uniform ?? source.Uniform_Fee ?? source.Uniform_fees ?? 0) || 0;
  const books = Number(source.books ?? source.Book_Fee ?? source.Book_Fees ?? 0) || 0;
  const others = Number(source.other ?? source.Other_Fee ?? source.Others ?? 0) || 0;
  const residential = Number(source.residential ?? source.ResidentialCompleteFee ?? 0) || 0;
  const completeFee = Number(source.complete_fee ?? source.CompleteFee ?? 0) || 0;

  return {
    Admission_Fee: admission,
    Admission_fees: admission,
    Tuition_Fee: tuition,
    Calculated_Tuition_Fee: tuition,
    Exam_Fee: exam,
    Exam_fees: exam,
    Bus_Fee: bus,
    Bus_fees: bus,
    Uniform_Fee: uniform,
    Uniform_fees: uniform,
    Book_Fee: books,
    Book_Fees: books,
    Other_Fee: others,
    Others: others,
    ResidentialCompleteFee: residential,
    CompleteFee: completeFee,
    complete_fee: completeFee,
  };
}, [feeStructure]);

const customClassFeeSource = React.useMemo(() => {
  const source = classFeeData && Object.keys(classFeeData).length > 0 ? classFeeData : feeDetail || {};
  return Object.keys(source).reduce((acc, key) => {
    if (isStaticOrMetaFeeField(key)) return acc;
    const normalized = normalizeFeeFieldName(key);
    if (normalized.endsWith("paid") || normalized.endsWith("due")) return acc;
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      acc[key] = value;
    }
    return acc;
  }, {});
}, [classFeeData, feeDetail]);

const classFeeSource = React.useMemo(
  () => ({
    ...normalizedClassFeeStructure,
    ...customClassFeeSource,
  }),
  [normalizedClassFeeStructure, customClassFeeSource]
);

const dynamicFeeRows = React.useMemo(() => {
  const source = {
    ...(classFeeSource || {}),
    ...(payments || {}),
  };
  const selectedStudentNameNormalized = String(
    selectedStudent || initialStudentName || payments?.studentName || payments?.StudentName || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const selectedStudentIdNormalized = String(selectedStudentId || initialStudentId || "").trim();
  const individualAssignments = Array.isArray(payments?.individualFeeAssignments)
    ? payments.individualFeeAssignments
    : [];
  console.log("[Payment][dynamicFeeRows] source keys", Object.keys(source || {}));
  console.log("[Payment][dynamicFeeRows] selection context", {
    selectedStudent,
    initialStudentName,
    selectedStudentId,
    initialStudentId,
    selectedStudentNameNormalized,
    selectedStudentIdNormalized,
    individualAssignmentCount: individualAssignments.length,
  });
  const normalizedDynamicTypes = dynamicFeeTypes.length
    ? dynamicFeeTypes
    : Object.keys(source)
        .filter((key) => !isStaticOrMetaFeeField(key))
        .filter((key) => {
          const normalized = normalizeFeeFieldName(key);
          return !normalized.endsWith("paid") && !normalized.endsWith("due");
        })
        .map((key) => ({
          id: key,
          feeName: formatCustomFeeLabel(key),
          columnBase: key,
        }));

  return normalizedDynamicTypes
    .map((fee) => {
      const sourceKey = fee.columnBase || fee.id;
      const feeScope = String(fee.scope || "").trim().toLowerCase();
      const sourceAliases = getFeeKeyAliases(sourceKey);
      const labelAliases = getFeeKeyAliases(fee.feeName);
      const allAliases = Array.from(new Set([sourceKey, fee.feeName, ...sourceAliases, ...labelAliases]));
      const paidKeys = allAliases.flatMap((key) => [`${key}_paid`, `${key}_Paid`]);
      const dueKeys = allAliases.flatMap((key) => [`${key}_due`, `${key}_Due`]);

      const matchingIndividualAssignment = individualAssignments.find((entry) => {
        const entryStudentId = String(
          entry?.studentId || entry?.student_id || entry?.StudentId || entry?.Student_ID || ""
        ).trim();
        const entryStudentName = String(
          entry?.studentName || entry?.StudentName || entry?.name || entry?.student || ""
        )
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
        const studentMatch =
          (selectedStudentIdNormalized && entryStudentId && selectedStudentIdNormalized === entryStudentId) ||
          (selectedStudentNameNormalized && entryStudentName && selectedStudentNameNormalized === entryStudentName);
        if (!studentMatch) return false;

        const entryKey = normalizeFeeFieldName(
          entry?.type || entry?.columnBase || entry?.feeName || entry?.label || ""
        );
        return (
          entryKey === normalizeFeeFieldName(sourceKey) ||
          entryKey === normalizeFeeFieldName(fee.feeName)
        );
      });
      const selectedStudentFeeSource =
        selectedStudentFeeDetails?.feeStructure ||
        selectedStudentFeeDetails?.studentDetails ||
        selectedStudentFeeDetails ||
        {};
      const studentSpecificDynamicAmount = readFirstNumericValue(selectedStudentFeeSource, allAliases);
      const individualDiscount =
        readFeeDiscountValue(selectedStudentFeeSource, sourceKey, fee.feeName) ||
        readFeeDiscountValue(classFeeSource, sourceKey, fee.feeName) ||
        readFeeDiscountValue(payments, sourceKey, fee.feeName);

      console.log("[Payment][dynamicFeeRows] fee evaluation", {
        feeName: fee.feeName,
        sourceKey,
        feeScope,
        hasMatchingIndividualAssignment: Boolean(matchingIndividualAssignment),
        studentSpecificDynamicAmount,
        matchingStudentName: matchingIndividualAssignment?.studentName || matchingIndividualAssignment?.StudentName || null,
        matchingStudentId: matchingIndividualAssignment?.studentId || matchingIndividualAssignment?.student_id || null,
      });

      if (feeScope === "individual" && !matchingIndividualAssignment) {
        if (!studentSpecificDynamicAmount) {
          console.log("[Payment][dynamicFeeRows] skipping unmatched individual fee", {
            feeName: fee.feeName,
            sourceKey,
          });
          return null;
        }
      }

      if (feeScope === "individual" && matchingIndividualAssignment) {
        const amount = Math.max(
          0,
          Number(
            matchingIndividualAssignment?.amount ??
              matchingIndividualAssignment?.total ??
              source?.[sourceKey] ??
              source?.[fee.feeName] ??
              0
          ) || 0
        );
        const paid = Math.max(
          0,
          Number(matchingIndividualAssignment?.paid ?? matchingIndividualAssignment?.paidAmount ?? 0) || 0
        );
        const netTotal = Math.max(amount - individualDiscount, 0);
        const remaining = Math.max(netTotal - paid, 0);

        return {
          key: sourceKey,
          label: fee.feeName,
          total: netTotal,
          paid,
          remaining,
          discount: individualDiscount,
          isCustom: true,
          source: "individual",
        };
      }

      if (feeScope === "individual" && studentSpecificDynamicAmount) {
        const paid = Math.max(
          0,
          readFirstNumericValue(selectedStudentFeeSource, paidKeys) ||
            readFirstNumericValue(selectedStudentFeeSource, [`${sourceKey}_paid`, `${sourceKey}_Paid`]) ||
            0
        );
        const netTotal = Math.max(studentSpecificDynamicAmount - individualDiscount, 0);
        const remaining = Math.max(netTotal - paid, 0);

        return {
          key: sourceKey,
          label: fee.feeName,
          total: netTotal,
          paid,
          remaining,
          discount: individualDiscount,
          isCustom: true,
          source: "student",
        };
      }

      const discount =
        readFeeDiscountValue(classFeeSource, sourceKey, fee.feeName) ||
        readFeeDiscountValue(payments, sourceKey, fee.feeName);
      const classTotalByKey = readFirstNumericValue(classFeeSource, allAliases);
      const classTotalByLabel = readFirstNumericValue(classFeeSource, [fee.feeName]);
      const studentTotal = readFirstNumericValue(payments, allAliases);
      const rawTotal = studentTotal || classTotalByKey || classTotalByLabel || 0;
      const total = Math.max(rawTotal - discount, 0);
      const studentPaidLower = readFirstNumericValue(payments, paidKeys);
      const studentPaidUpper = 0;
      const classPaidLower = readFirstNumericValue(classFeeSource, paidKeys);
      const classPaidUpper = 0;
      const paid =
        studentPaidLower ||
        studentPaidUpper ||
        classPaidLower ||
        classPaidUpper ||
        0;
      const remaining = Math.max(total - paid, 0);

      console.log("[Payment][dynamicFeeSourceResolution]", {
        feeName: fee.feeName,
        sourceKey,
        feeScope,
        classSource: {
          totalByKey: classTotalByKey,
          totalByLabel: classTotalByLabel,
          paidLower: classPaidLower,
          paidUpper: classPaidUpper,
          dueLower: Number(classFeeSource?.[`${sourceKey}_due`]) || 0,
          dueUpper: Number(classFeeSource?.[`${sourceKey}_Due`]) || 0,
        },
        studentSource: {
          total: studentTotal,
          paidLower: studentPaidLower,
          paidUpper: studentPaidUpper,
        },
        chosen: {
          total,
          paid,
          remaining,
          totalSource: studentTotal
            ? "student"
            : classTotalByKey || classTotalByLabel
              ? "class"
              : "none",
          remainingSource: "calculated_from_total_minus_paid",
        },
      });

      return {
        key: sourceKey,
        label: fee.feeName,
        total,
        paid,
        remaining,
        discount,
        isCustom: true,
      };
    })
    .filter(Boolean)
    .filter((fee) => {
      const keep = Number(fee.total) > 0;
      console.log("[Payment][dynamicFeeRows] post-filter", {
        feeLabel: fee?.label || null,
        total: fee?.total,
        paid: fee?.paid,
        remaining: fee?.remaining,
        keep,
      });
      return keep;
    });
}, [classFeeSource, dynamicFeeTypes, payments]);

const individualFeeRows = React.useMemo(() => {
  const selectedStudentNameNormalized = String(
    selectedStudent || initialStudentName || payments?.studentName || payments?.StudentName || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const selectedStudentIdNormalized = String(selectedStudentId || initialStudentId || "").trim();

  const rawAssignments = [
    ...(Array.isArray(payments?.individualFeeAssignments) ? payments.individualFeeAssignments : []),
    ...(Array.isArray(payments?.feeDescriptions) ? payments.feeDescriptions : []),
    ...(Array.isArray(payments?.feeEntries) ? payments.feeEntries : []),
  ];

  const existingRowKeys = new Set(
    dynamicFeeRows.flatMap((row) => [
      normalizeFeeFieldName(row?.key || row?.label || ""),
      normalizeFeeFieldName(row?.label || ""),
    ])
  );

  return rawAssignments
    .map((entry, index) => {
      const studentId = String(
        entry?.studentId || entry?.student_id || entry?.StudentId || entry?.Student_ID || ""
      ).trim();
      const studentName = String(
        entry?.studentName || entry?.StudentName || entry?.name || entry?.student || ""
      )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      const isSelectedStudentAssignment =
        (selectedStudentIdNormalized && studentId && selectedStudentIdNormalized === studentId) ||
        (selectedStudentNameNormalized && studentName && selectedStudentNameNormalized === studentName);

      if (!isSelectedStudentAssignment) return null;

      const scope = String(entry?.scope || "").trim().toLowerCase();
      if (scope && scope !== "individual") return null;

      const amount = Math.max(
        0,
        Number(entry?.amount ?? entry?.total ?? entry?.feeAmount ?? entry?.value ?? 0) || 0
      );
      const paid = Math.max(
        0,
        Number(entry?.paid ?? entry?.amount_paid ?? entry?.paidAmount ?? 0) || 0
      );
      const due = Math.max(
        0,
        Number(entry?.remaining ?? entry?.due ?? entry?.amount_due ?? amount - paid) || 0
      );

      const keyBase = String(entry?.type || entry?.feeName || entry?.label || `individual-${index}`).trim();
      const normalizedKey = normalizeFeeFieldName(keyBase);
      if (!normalizedKey || existingRowKeys.has(normalizedKey)) return null;

      const label = String(entry?.feeName || entry?.label || entry?.type || "Individual Fee").replace(
        /_/g,
        " "
      );

      return {
        key: keyBase,
        label: `${label} (Individual)`,
        total: amount,
        paid,
        remaining: due,
        discount: Math.max(0, Number(entry?.discount || entry?.discountAmount || 0) || 0),
        isCustom: false,
        source: "individual",
      };
    })
    .filter(Boolean);
}, [dynamicFeeRows, initialStudentId, initialStudentName, payments, selectedStudent, selectedStudentId]);

const staticFeeRows = React.useMemo(() => {
  const studentFeeSource = selectedStudentFeeDetails?.feeStructure || selectedStudentFeeDetails || {};
  const studentDetailsSource = selectedStudentFeeDetails?.studentDetails || selectedStudentFeeDetails || {};

  console.log("[Payment][staticFeeRows] source snapshot", {
    hasSelectedStudentFeeDetails: Boolean(selectedStudentFeeDetails),
    studentFeeKeys: Object.keys(studentFeeSource || {}),
    studentDetailsKeys: Object.keys(studentDetailsSource || {}),
  });

  const resolveFeeAmount = (...keys) => {
    const value =
      readFirstNumericValue(studentFeeSource, keys) ||
      readFirstNumericValue(studentDetailsSource, keys);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const resolveFeePaid = (...keys) => {
    const value =
      readFirstNumericValue(studentDetailsSource, keys) ||
      readFirstNumericValue(studentFeeSource, keys);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };

  const resolveFeeDiscount = (...keys) => {
    const value =
      readFirstNumericValue(studentDetailsSource, keys) ||
      readFirstNumericValue(studentFeeSource, keys);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const tuitionDiscountValue = resolveFeeDiscount(
    "Tuition_Discount",
    "tuition_discount",
    "tuitionDiscount"
  );
  const admissionDiscountValue = resolveFeeDiscount(
    "Admission_Discount",
    "admission_discount",
    "admissionDiscount"
  );
  const examDiscountValue = resolveFeeDiscount(
    "Exam_Discount",
    "exam_discount",
    "examDiscount"
  );
  const busDiscountValue = resolveFeeDiscount(
    "Bus_Discount",
    "bus_discount",
    "busDiscount",
    "transport_discount",
    "transportation_discount"
  );
  const bookDiscountValue = resolveFeeDiscount(
    "Book_Discount",
    "book_discount",
    "bookDiscount",
    "books_discount",
    "feeDiscount"
  );
  const uniformDiscountValue = resolveFeeDiscount(
    "Uniform_Discount",
    "uniform_discount",
    "uniformDiscount"
  );
  const othersDiscountValue = resolveFeeDiscount(
    "Other_Discount",
    "other_discount",
    "othersDiscount",
    "cultural_activities_discount",
    "school_discount"
  );
  const residentialDiscountValue = resolveFeeDiscount(
    "Residential_Discount",
    "residential_discount",
    "residentialDiscount"
  );

  const rowDefs = [
    (() => {
      const total = resolveFeeAmount("Tuition_Fee", "Calculated_Tuition_Fee", "tuitionFee") || Number(tuitionFee) || 0;
      const discount = tuitionDiscountValue;
      const paid = resolveFeePaid("Paid_Amount", "tuition_paid", "tuitionPaid") || Number(tuitionPaid) || 0;
      const netTotal = Math.max(total - discount, 0);
      return {
        key: "tuition",
        label: "Tuition Fee",
        total: netTotal,
        paid,
        remaining: Math.max(netTotal - paid, 0),
        discount,
        isCustom: false,
      };
    })(),
    {
      key: "admission",
      label: "Admission Fee",
      total: Math.max(
        (resolveFeeAmount("Admission_Fee", "Admission_fees", "admissionFee") || Number(admissionFee) || 0) -
          admissionDiscountValue,
        0
      ),
      paid: resolveFeePaid("admission_paid", "Admission_paid", "admissionPaid") || Number(admissionPaid) || 0,
      remaining: Math.max(
        (resolveFeeAmount("Admission_Fee", "Admission_fees", "admissionFee") || Number(admissionFee) || 0) -
          admissionDiscountValue -
          (resolveFeePaid("admission_paid", "Admission_paid", "admissionPaid") || Number(admissionPaid) || 0),
        0
      ),
      isCustom: false,
    },
    {
      key: "exam",
      label: "Exam Fee",
      total: Math.max(
        (resolveFeeAmount("Exam_Fee", "Exam_fees", "examFee") || Number(examFee) || 0) -
          examDiscountValue,
        0
      ),
      paid: resolveFeePaid("exam_paid", "Exam_paid", "examPaid") || Number(examPaid) || 0,
      remaining: Math.max(
        (resolveFeeAmount("Exam_Fee", "Exam_fees", "examFee") || Number(examFee) || 0) -
          examDiscountValue -
          (resolveFeePaid("exam_paid", "Exam_paid", "examPaid") || Number(examPaid) || 0),
        0
      ),
      isCustom: false,
    },
    {
      key: "bus",
      label: "Bus Fee",
      total: Math.max(
        (resolveFeeAmount("Bus_Fee", "Bus_fees", "busFee") || Number(busFee) || 0) -
          busDiscountValue,
        0
      ),
      paid: resolveFeePaid("bus_paid", "Bus_paid", "busPaid") || Number(busPaid) || 0,
      remaining: Math.max(
        (resolveFeeAmount("Bus_Fee", "Bus_fees", "busFee") || Number(busFee) || 0) -
          busDiscountValue -
          (resolveFeePaid("bus_paid", "Bus_paid", "busPaid") || Number(busPaid) || 0),
        0
      ),
      isCustom: false,
    },
    {
      key: "books",
      label: "Books Fee",
      total: Math.max(
        (resolveFeeAmount("Book_Fee", "Book_Fees", "bookFee") || Number(bookFee) || 0) -
          bookDiscountValue,
        0
      ),
      paid: resolveFeePaid("books_paid", "book_paid", "Book_paid", "bookPaid") || Number(bookPaid) || 0,
      remaining: Math.max(
        (resolveFeeAmount("Book_Fee", "Book_Fees", "bookFee") || Number(bookFee) || 0) -
          bookDiscountValue -
          (resolveFeePaid("books_paid", "book_paid", "Book_paid", "bookPaid") || Number(bookPaid) || 0),
        0
      ),
      isCustom: false,
    },
    {
      key: "uniform",
      label: "Uniform Fee",
      total: Math.max(
        resolveFeeAmount("Uniform_Fee", "Uniform_fees", "uniformFee", "uniform") -
          uniformDiscountValue,
        0
      ),
      paid: resolveFeePaid("uniform_paid", "Uniform_paid", "uniformPaid"),
      remaining:
        Math.max(
          0,
          resolveFeeAmount("Uniform_Fee", "Uniform_fees", "uniformFee", "uniform") -
            uniformDiscountValue -
            resolveFeePaid("uniform_paid", "Uniform_paid", "uniformPaid")
        ) || 0,
      isCustom: false,
    },
    {
      key: "other",
      label: "Other Fees",
      total: Math.max(
        (resolveFeeAmount("Other_Fee", "Others", "otherFee") || Number(othersFee) || 0) -
          othersDiscountValue,
        0
      ),
      paid: resolveFeePaid("others_paid", "other_paid", "Others_paid", "otherPaid") || Number(othersPaid) || 0,
      remaining: Math.max(
        (resolveFeeAmount("Other_Fee", "Others", "otherFee") || Number(othersFee) || 0) -
          othersDiscountValue -
          (resolveFeePaid("others_paid", "other_paid", "Others_paid", "otherPaid") || Number(othersPaid) || 0),
        0
      ),
      isCustom: false,
    },
    {
      key: "residential",
      label: "Residential Fee",
      total: Math.max(
        (resolveFeeAmount("ResidentialCompleteFee", "residentialFee") || Number(residentialFee) || 0) -
          residentialDiscountValue,
        0
      ),
      paid: resolveFeePaid("residential_paid", "Residential_paid", "residentialPaid") || Number(residentialPaid) || 0,
      remaining: Math.max(
        (resolveFeeAmount("ResidentialCompleteFee", "residentialFee") || Number(residentialFee) || 0) -
          residentialDiscountValue -
          (resolveFeePaid("residential_paid", "Residential_paid", "residentialPaid") || Number(residentialPaid) || 0),
        0
      ),
      isCustom: false,
    },
  ];

  return rowDefs.filter((row) => Number(row.total) > 0 || Number(row.paid) > 0 || Number(row.remaining) > 0);
}, [
  admissionFee,
  admissionPaid,
  admissionRemaining,
  bookFee,
  bookPaid,
  bookRemaining,
  busFee,
  busPaid,
  busRemaining,
  examFee,
  examPaid,
  examRemaining,
  othersFee,
  othersPaid,
  othersRemaining,
  residentialFee,
  residentialPaid,
  residentialRemaining,
  tuitionFee,
  tuitionPaid,
  tuitionRemaining,
  uniformFee,
  uniformPaid,
  uniformRemaining,
  selectedStudentFeeDetails,
]);

const displayFeeRows = React.useMemo(() => {
  const merged = [];
  const seen = new Set();

  [...staticFeeRows, ...dynamicFeeRows, ...individualFeeRows].forEach((row) => {
    const key = normalizeFeeFieldName(row?.key || row?.label || "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  });

  return merged;
}, [dynamicFeeRows, individualFeeRows, staticFeeRows]);

useEffect(() => {
  console.log("[Payment][classFeeSource] keys", Object.keys(classFeeSource || {}));
  console.log(
    "[Payment][dynamicFeeTypes]",
    (dynamicFeeTypes || []).map((fee) => ({
      id: fee.id,
      feeName: fee.feeName,
      columnBase: fee.columnBase,
    }))
  );
  console.log("[Payment][dynamicFeeValues]", dynamicFeeValues);
}, [classFeeSource, dynamicFeeTypes, dynamicFeeValues]);

const handleDynamicFeeAmountChange = useCallback((feeKey, value, maxAmount = null) => {
  let sanitized = String(value ?? "").replace(/[^0-9.]/g, "");
  const parts = sanitized.split(".");
  if (parts.length > 2) return;

  const numericValue = parts[0] ? parseFloat(sanitized) : 0;
  if (maxAmount !== null && Number.isFinite(maxAmount) && maxAmount > 0 && numericValue > maxAmount) {
    console.log("[Payment][dynamicFeeChange] blocked over max", {
      feeKey,
      attemptedValue: sanitized,
      maxAmount,
    });
    return;
  }

  console.log("[Payment][dynamicFeeChange]", {
    feeKey,
    rawValue: value,
    sanitized,
    numericValue,
    maxAmount,
  });
  setDynamicFeeValues((prev) => ({
    ...prev,
    [feeKey]: sanitized,
  }));
}, []);

useEffect(() => {
  if (!selectedClassSection) return;

  setFeeError("");  

  const [className, sectionName] = selectedClassSection.split("_");

  const schoolCode = localStorage.getItem("schoolCode");

  axios
    .get("https://cleezoclass.com:4000/api/feeDetailsByClassSection", {
      params: { className, section: sectionName, schoolCode },
    })
    .then((res) => {
      const resolvedFeeDetail =
        res.data.feeDetails ||      // correct key
        res.data.feeDetail  ||      // fallback
        null;

      console.log("[Payment][feeDetailsByClassSection] request", {
        className,
        sectionName,
        schoolCode,
      });
      console.log("[Payment][feeDetailsByClassSection] response", res.data);
      console.log("[Payment][feeDetailsByClassSection] resolved values", resolvedFeeDetail);

      setFeeDetail(resolvedFeeDetail);

      const configuredCompleteFee = Number(
        normalizedClassFeeStructure.CompleteFee ||
        normalizedClassFeeStructure.complete_fee ||
        0
      );
      const hasCustomFeeColumns = Object.keys(resolvedFeeDetail || {}).some((key) => {
        if (isStaticOrMetaFeeField(key)) return false;
        const normalized = normalizeFeeFieldName(key);
        return !normalized.endsWith("paid") && !normalized.endsWith("due");
      });

      if (configuredCompleteFee <= 0 && !hasCustomFeeColumns) {
        setFeeError(`Add Fee not updated for ${className} ${sectionName}`);
      } else {
        setFeeError("");
      }
    })
    .catch((err) => {
      console.error("Error fetching fee details:", err);
      setFeeDetail(null);
      setFeeError("Unable to fetch fee details");
  });
}, [selectedClassSection, normalizedClassFeeStructure]);

const getClassFeeValue = useCallback(
  (...keys) => {
    for (const key of keys) {
      const value = classFeeSource?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return Number(value) || 0;
      }
    }
    return 0;
  },
  [classFeeSource]
);

const formatPopupAmount = useCallback((value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}, []);

const paidInstallmentMap = {};

if (installments && typeof installments === "object") {
  Object.keys(installments).forEach((key) => {
    if (key.startsWith("installment")) {
      const installmentId = parseInt(key.replace("installment", ""), 10);
      paidInstallmentMap[installmentId] =
        parseFloat(installments[key]) || 0;
    }
  });
}
  const [dropdownLoading, setDropdownLoading] = useState(false);

const filteredStudents = students.filter((student) =>
  student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  String(student.id).includes(searchTerm)
);
const [selectedFeeRow, setSelectedFeeRow] = useState(null);
const fetchMetadata = useCallback(async () => {
  setDropdownLoading(true);
  const schoolCode = localStorage.getItem("schoolCode") || "TAGSOLNOVALLP";

  try {
    const [classRes, sectionRes] = await Promise.all([
      axios.get(`${API_BASE}/classes?schoolCode=${schoolCode}`),
      axios.get(`${API_BASE}/sectionFilter?schoolCode=${schoolCode}`)
    ]);

    // ✅ Handle dynamic class format safely
    const classesFromAPI = Array.isArray(classRes.data)
      ? classRes.data
      : classRes.data?.classes || [];

    setClassList(classesFromAPI);

    // ✅ Handle dynamic section format safely
    const sectionsFromAPI = Array.isArray(sectionRes.data)
      ? sectionRes.data
      : sectionRes.data?.sections || [];

    setSectionMap(sectionsFromAPI);

  } catch (err) {
    console.error("===== FETCH METADATA ERROR =====", err.message, err);

    setClassList([]);
    setSectionMap([]);
  } finally {
    setDropdownLoading(false);
  }
}, [API_BASE]);

useEffect(() => {
  fetchMetadata();
}, [fetchMetadata]);

if (popupOnly) {
  return (
    <>
      {showPopup && (
        <div className="income-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClosePopup()}>
          <div
            className="payment-modal-content "
            onClick={(e) => e.stopPropagation()}
          >
            <div className="payment-modal-body">
              <div className="payment-fee-table-container">
                <table className="payment-fee-table">
                  <thead>
                    <tr>
                      <th>Fee Type</th>
                      <th>Total</th>
                      <th>Remaining</th>
                      <th>Pay Now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayFeeRows.map((fee, idx) => {
                      const remaining = Math.max(Number(fee.remaining) || 0, 0);

                      return (
                        <tr
                          key={idx}
                          onMouseEnter={() => fee.label === "Tuition Fee" && setShowInstallments(true)}
                          onMouseLeave={() => setShowInstallments(false)}
                          style={{ position: "relative" }}
                        >
                          <td style={{ border: "1px solid #ccc", padding: "5px", position: "relative" }}>
                            {fee.label}

                            {fee.label === "Tuition Fee" && showInstallments && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  right: -300,
                                  background: "#fff",
                                  border: "1px solid #ccc",
                                  padding: "8px",
                                  fontSize: "10px",
                                  borderRadius: "8px",
                                  width: "200px",
                                  boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                                  zIndex: 999,
                                }}
                              >
                                <strong>Select Installment</strong>
                                <ul style={{ paddingLeft: 0, marginTop: 8, listStyle: "none" }}>
                                  {installmentOptions.map((inst) => {
                                    const original = Number(inst.amount);
                                    const paid = Number(installments[`installment${inst.installment}`] || 0);
                                    const remainingAmt = original - paid;
                                    const isPaid = remainingAmt <= 0;

                                    return (
                                      <li
                                        key={inst.installment}
                                        onClick={() => {
                                          if (isPaid) return;

                                          const newEntries = [...feeEntries];
                                          newEntries[idx] = {
                                            ...newEntries[idx],
                                            type: feeLabelToKey["Tuition Fee"],
                                            installmentId: inst.installment,
                                            amount: remainingAmt,
                                          };

                                          setFeeEntries(newEntries);
                                          setShowInstallments(false);
                                        }}
                                        style={{
                                          padding: "6px 8px",
                                          borderBottom: "1px solid #eee",
                                          cursor: isPaid ? "not-allowed" : "pointer",
                                          color: isPaid ? "#a0a0a0" : "#000",
                                          background: isPaid ? "#f5f5f5" : "transparent",
                                          opacity: isPaid ? 0.6 : 1,
                                        }}
                                      >
                                        {isPaid
                                          ? `Installment ${inst.installment} — Paid`
                                          : `Installment ${inst.installment} — Rs. ${remainingAmt.toFixed(2)}`}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {fee.label === "Other Fees" && (
                              <input
                                value={feeEntries[idx]?.description || ""}
                                onChange={(e) => {
                                  const updated = [...feeEntries];
                                  updated[idx] = {
                                    ...updated[idx],
                                    description: e.target.value,
                                    type: feeLabelToKey[fee.label],
                                  };
                                  setFeeEntries(updated);
                                }}
                                placeholder="Description (optional)"
                              />
                            )}
                          </td>

                          <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>
                            {formatPopupAmount(fee.total) ? `Rs. ${formatPopupAmount(fee.total)}` : ""}
                          </td>

                          <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>
                            {formatPopupAmount(remaining) ? `Rs. ${formatPopupAmount(remaining)}` : ""}
                          </td>

                          <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>
                            {fee.source === "individual" ? (
                              <span style={{ fontSize: "12px", color: "#374151" }}>
                                {formatPopupAmount(remaining) ? `Rs. ${formatPopupAmount(remaining)}` : ""}
                              </span>
                            ) : fee.isCustom ? (
                              <input
                                type="text"
                                value={dynamicFeeValues[fee.key] || ""}
                                onChange={(e) =>
                                  handleDynamicFeeAmountChange(
                                    fee.key,
                                    e.target.value,
                                    remaining
                                  )
                                }
                                placeholder="Enter Amount"
                                style={{ width: "100px", padding: "5px", textAlign: "right" }}
                              />
                            ) : (
                              <input
                                type="text"
                                value={feeEntries[idx]?.raw || ""}
                                onChange={(e) => {
                                  let val = e.target.value;
                                  val = val.replace(/[^0-9.]/g, "");
                                  const parts = val.split(".");
                                  if (parts.length > 2) return;

                                  const num = parts[0] ? parseFloat(val) : 0;
                                  if (fee.label !== "Other Fees") {
                                    if (num > fee.total - fee.paid) return;
                                  }

                                  const updated = [...feeEntries];
                                  updated[idx] = {
                                    ...(updated[idx] || {}),
                                    raw: val,
                                    amount: num,
                                    type: feeLabelToKey[fee.label],
                                  };

                                  setFeeEntries(updated);

                                  const typeKey = feeLabelToKey[fee.label];
                                  if (typeKey) {
                                    setFees((prev) => ({
                                      ...prev,
                                      [typeKey]: num
                                    }));
                                  }
                                }}
                                onBlur={() => {
                                  const updated = [...feeEntries];
                                  if (!updated[idx]) return;

                                  const num = updated[idx].amount || 0;
                                  updated[idx].raw = num.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  });
                                  setFeeEntries(updated);
                                }}
                                placeholder="Enter Amount"
                                style={{ width: "100px", padding: "5px", textAlign: "right" }}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="payment-payment-details">
                <div className="payment-details-row">
                  <div className="payment-detail-item">
                    <label>Payment Date:</label>
                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </div>
                </div>

                <div className="payment-details-row">
                  <div className="payment-detail-item">
                    <label>Payment Mode:</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                    >
                      <option value="">-- Select Mode --</option>
                      <option value="Cash">Cash</option>
                      <option value="Online">Online</option>
                      <option value="Card">Card</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash+Online">Cash+Online</option>
                    </select>
                  </div>

                  {(paymentMode === "Online" || paymentMode === "Cash+Online") && (
                    <div className="payment-detail-item">
                      <label>Transaction ID:</label>
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Enter Transaction ID"
                      />
                    </div>
                  )}
                </div>

                {paymentMode === "Cash+Online" && (
                  <div className="payment-details-row">
                    <div className="payment-detail-item">
                      <label>Cash Amount:</label>
                      <input type="number" value={cashAmount} onChange={(e) => setCashAmount(Number(e.target.value))} placeholder="Enter cash" />
                    </div>
                    <div className="payment-detail-item">
                      <label>Online Amount:</label>
                      <input type="number" value={onlineAmount} onChange={(e) => setOnlineAmount(Number(e.target.value))} placeholder="Enter online amount" />
                    </div>
                  </div>
                )}
                <button
                  className="payment-submit-button"
                  onClick={handlePaymentSubmission}
                  disabled={isLoading}
                >
                  {isLoading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPaidPopup && (
        <div
          className="Payment-paidPopupOverlay"
          onClick={() => setShowPaidPopup(false)}
        >
          <div
            className="Payment-paidPopupContent"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="Payment-paidPopupCloseButton"
              onClick={() => setShowPaidPopup(false)}
            >
              X
            </button>
            <PaidAmountdemo
              popupData={paidPageData}
              className={className}
              section={section}
              selectedStudent={selectedStudent}
              selectedStudentId={selectedStudentId}
              paymentDate={paymentDate}
              receiptNumber={paidPageData?.receiptNumber || receiptNumber}
              paymentMode={paymentMode}
              discountAmount={discountAmount}
              transactionId={transactionId}
            />
          </div>
        </div>
      )}
    </>
  );
}

return (
  <>
    <div className={`payment-flex-container${popupOnly ? " payment-popup-only" : ""}`}>
      <div className="payment-header-row">
        {/* Total Paid Card */}
        <div className="payment-card">
          <div className="payment-card-label">Total paid:</div>
          <div className="payment-card-values">
            <span>₹{(totals?.Total_Paid_Without_Admission ?? 0).toLocaleString()}</span>
            <span>{totals?.Percent_Paid ?? 0}% of total</span>
          </div>
        </div>

        {/* Due Card */}
        <div className="payment-card">
          <div className="payment-card-label">Due:</div>
          <div className="payment-card-values">
            <span>₹{(totals?.Total_Calculated_Due ?? 0).toLocaleString()}</span>
            <span>{totals?.Percent_Due ?? 0}% of total</span>
          </div>
        </div>

        {/* Total Admission Paid Card */}
        <div className="payment-card">
          <div className="payment-card-label">Total Admission Fee</div>
          <div className="payment-card-values">
            <span>₹{(totals?.Total_Admission_Paid ?? 0).toLocaleString()}</span>
            <span>{totals?.Percent_Admission_Paid ?? 0}% of total</span>
          </div>
        </div>

        {/* Overview Card */}
        <div className="payment-card payment-overview-card">
          <div className="payment-overview-header">
            <div>Overview</div>
            <div>
              <span>₹{Number(
                payments?.discounts?.totalDiscount ||
                  payments?.totalDiscount ||
                  payments?.discountAmount ||
                  0
              ).toLocaleString()}</span>
              Discounts
            </div>
          </div>
          {installmentOptions?.length > 0 ? (
            <div className="payment-installment-list">
              {installmentOptions
                .slice()
                .filter((inst) => {
                  const paidAmount = paidInstallmentMap[inst.installment] || 0;
                  const dueAmount = inst.amount - paidAmount;
                  return dueAmount > 0;
                })
                .map((inst) => {
                  const paidAmount = paidInstallmentMap[inst.installment] || 0;
                  const dueAmount = inst.amount - paidAmount;
                  return (
                    <div key={inst.installment} className="payment-installment-item">
                      <span>Inst {inst.installment}</span>
                      <span>₹{inst.amount.toLocaleString()}</span>
                      <span style={{ color: "orange" }}>{dueAmount.toLocaleString()}</span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="payment-no-installments">No installments configured</div>
          )}
        </div>
      </div>

      {/* Student List Panel */}
      <div className="payment-student-list-panel">
        <div className="payment-panel-header">
          <div className="payment-total-strength">
            <span>{className && section ? filteredStudents.length : 0}</span>
            <span>Total Strength</span>
          </div>
          <div className="payment-search-box">
  <input
    type="text"
    placeholder="Search student..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
</div>

          <div className="payment-class-section-dropdown">
<select
  value={selectedClassSection}
  onChange={(e) => {
    const selectedValue = e.target.value;

    setSelectedClassSection(selectedValue);
    localStorage.setItem("selectedClassSection", selectedValue);

    if (selectedValue) {
      const [cls, sec] = selectedValue.split("_");

      setClassName(cls);
      setSection(sec);

      localStorage.setItem("className", cls);
      localStorage.setItem("section", sec);
    } else {
      setClassName("");
      setSection("");
      localStorage.removeItem("className");
      localStorage.removeItem("section");
    }

    setInstallmentOptions([]);
    setPaidInstallmentMap({});
    setFeeError("");
  }}
>
  <option value="">-- Select Class & Section --</option>

  {classList.map((cls) => {
    const sectionsForClass = sectionMap
      .filter(item => {
        const classValue =
          item.class_name || item.class || item.className;

        return String(classValue) === String(cls);
      })
      .map(item =>
        item.section || item.section_name || item.sectionName
      );

    return sectionsForClass.map((sec) => (
      <option key={`${cls}_${sec}`} value={`${cls}_${sec}`}>
        {cls} - {sec}
      </option>
    ));
  })}
</select>
            <div className="payment-error-message">{feeError}</div>
          </div>
        </div>
        <div className="payment-student-grid">
          {filteredStudents.length === 0 ? (
            <div className="payment-no-students">
              {className ? "No students found" : "Please select a class and section"}
            </div>
          ) : (
            filteredStudents.map((student) => {
          const totalPaid = Number(
                student.total_paid ||
                  student.totalPaid ||
                  student.paidAmountTotal ||
                  student.tuition_paid ||
                  student.Paid_Amount ||
                  0
              );
              const totalDiscount = Number(
                student.total_due != null
                  ? 0
                  : student.total_discount ||
                    student.totalDiscount ||
                    student.discount ||
                    student.Discount ||
                    0
              );
              const completeFee = Number(classFeeData?.CompleteFee || 0);
              const backendDue = Number(
                student.total_due ||
                  student.totalDue ||
                  student.totalRemaining ||
                  student.remainingAmount ||
                  student.Remaining_Amount ||
                  student.Total_Installments_Remaining ||
                  student.total_remaining ||
                  0
              );
              const dueAmount = backendDue > 0 ? backendDue : Math.max(completeFee - totalPaid - totalDiscount, 0);
              console.log("[Payment][student-card-due]", {
                studentId: student.id,
                studentName: student.name,
                className,
                section,
                completeFee,
                totalPaid,
                totalDiscount,
                backendDue,
                dueAmount,
                rawStudent: {
                  total_paid: student.total_paid,
                  totalPaid: student.totalPaid,
                  paidAmountTotal: student.paidAmountTotal,
                  tuition_paid: student.tuition_paid,
                  Paid_Amount: student.Paid_Amount,
                  total_due: student.total_due,
                  totalDue: student.totalDue,
                  totalRemaining: student.totalRemaining,
                  remainingAmount: student.remainingAmount,
                  Remaining_Amount: student.Remaining_Amount,
                  Total_Installments_Remaining: student.Total_Installments_Remaining,
                  total_discount: student.total_discount,
                  totalDiscount: student.totalDiscount,
                  discount: student.discount,
                  Discount: student.Discount,
                },
              });
              return (
                <div
                  key={student.id}
                  onClick={() => {
                    if (feeError) return;
                    setSelectedStudentId(student.id);
                    setSelectedStudent(student.name);
                  }}
                  className={`payment-student-card ${student.id === selectedStudentId ? "payment-student-card-selected" : ""}`}
                >
                  {student.photo?.data ? (
                    <img
                      src={`https://cleezoclass.com:4000${bufferToPathString(student.photo.data)}`}
                      alt={student.name}
                      className="payment-student-photo"
                    />
                  ) : (
                    <div className="payment-student-photo-placeholder">
                      {student.name?.charAt(0)}
                    </div>
                  )}
                  <span className="payment-student-name">{student.name}</span>
                  <span className="payment-student-name">
                    {student.father_name || student.fatherName || student.Father_Name || student.father || ""}
                  </span>
                  <div className="payment-student-paid">Paid: ₹{totalPaid.toLocaleString()}</div>
                  <div className="payment-student-due">Due: ₹{dueAmount.toLocaleString()}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Student Details Panel */}
      <div className="payment-student-details-panel">
        <div className="payment-student-details-header">
          {selectedStudentId && (
            <div className="payment-student-info">
              {studentData?.photo?.data ? (
                <img
                  src={`https://cleezoclass.com:4000${bufferToPathString(studentData.photo.data)}`}
                  alt="student"
                  className="payment-student-info-photo"
                />
              ) : (
                <div className="payment-student-info-photo-placeholder">
                  {studentData?.name?.charAt(0)}
                </div>
              )}
              <p className="payment-student-info-name">
                <strong>{studentData?.name} ({className}-{section})</strong>
                {payments && totals && (
                  <span>
                    - Total Due: ₹
                    {Math.max(Number(remainingAmount) || 0, 0).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="payment-tab-navigation">
          {["feesCollection", "discounts"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`payment-tab-button ${activeTab === tab ? "payment-tab-button-active" : ""}`}
            >
              {tab.replace(/([A-Z])/g, ' $1').replace('fees', 'Fees ')}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="payment-tab-content">
          {activeTab === "feesCollection" && (
            <div>
              {selectedStudentId ? (
                <div>
                  {/* Fee Summary Section */}
                  <div className="payment-fee-summary">
                    <div className="payment-fee-breakdown">
                      <table className="payment-fee-table">
                        <thead>
                          <tr>
                            <th>Fee Type</th>
                            <th>Total Fee</th>
                            <th>Paid</th>
                            <th>Remaining</th>
                          </tr>
                        </thead>
                        <tbody>
            {displayFeeRows.map((fee, idx) => (
                            <tr key={idx}>
                              <td>{fee.label}</td>
                              <td>{formatPopupAmount(fee.total) ? `Rs. ${formatPopupAmount(fee.total)}` : ""}</td>
                              <td>{formatPopupAmount(fee.paid) ? `Rs. ${formatPopupAmount(fee.paid)}` : ""}</td>
                              <td>{formatPopupAmount(fee.remaining) ? `Rs. ${formatPopupAmount(fee.remaining)}` : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td>Total</td>
                            <td>
                              Rs. {displayFeeRows.reduce((sum, fee) => sum + (Number(fee.total) || 0), 0).toFixed(2)}
                            </td>
                            <td>
                              Rs. {displayFeeRows.reduce((sum, fee) => sum + (Number(fee.paid) || 0), 0).toFixed(2)}
                            </td>
                            <td>
                              Rs. {displayFeeRows.reduce((sum, fee) => sum + (Number(fee.remaining) || 0), 0).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <button className="payment-pay-button" onClick={() => setShowPopup(true)}>
                      Pay
                    </button>
                  </div>
                </div>
              ) : (
                <p className="payment-select-student-prompt">
                  Please select a student from the left panel to begin fees collection.
                </p>
              )}
            </div>
          )}

          {activeTab === "discounts" && (
            <div className="payment-discounts-tab">
              <h3>Discounts</h3>
              <p>Use this area to define or apply <strong>Fee Discounts</strong> for the selected student.</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Popup */}
  {showPopup && (
        <div className="income-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClosePopup()}>
<div
    className="payment-modal-content "
    onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside modal
  >    
    <div className="payment-modal-body">

          <div className="payment-fee-table-container">
              <table className="payment-fee-table">
                <thead>
                  <tr>
                    <th>Fee Type</th>
                    <th>Total</th>
                    <th>Remaining</th>
                    <th>Pay Now</th>
                  </tr>
                </thead>

          <tbody>
            {displayFeeRows.map((fee, idx) => {
              const remaining = Math.max(Number(fee.remaining) || 0, 0);

              return (
             <tr
  key={idx}
  onMouseEnter={() => fee.label === "Tuition Fee" && setShowInstallments(true)}
  onMouseLeave={() => setShowInstallments(false)}
  style={{ position: "relative" }}
>
  <td style={{ border: "1px solid #ccc", padding: "5px", position: "relative" }}>
    {fee.label}

    {/* HOVER INSTALLMENT SELECTION BOX */}
    {fee.label === "Tuition Fee" && showInstallments && (
      <div
        style={{
          position: "absolute",
          top: "100%",
          right: -300,
          background: "#fff",
          border: "1px solid #ccc",
          padding: "8px",
          fontSize: "10px",
          borderRadius: "8px",
          width: "200px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          zIndex: 999,
        }}
      >
        <strong>Select Installment</strong>
       <ul style={{ paddingLeft: 0, marginTop: 8, listStyle: "none" }}>
  {installmentOptions.map((inst) => {
    const original = Number(inst.amount);
    const paid = Number(installments[`installment${inst.installment}`] || 0);
    const remainingAmt = original - paid;
    const isPaid = remainingAmt <= 0;

    return (
      <li
        key={inst.installment}
        onClick={() => {
          if (isPaid) return; // disable if paid

          const newEntries = [...feeEntries];
          newEntries[idx] = {
            ...newEntries[idx],
            type: feeLabelToKey["Tuition Fee"],
            installmentId: inst.installment,
            amount: remainingAmt,
          };

          setFeeEntries(newEntries);
          setShowInstallments(false);
        }}
        style={{
          padding: "6px 8px",
          borderBottom: "1px solid #eee",
          cursor: isPaid ? "not-allowed" : "pointer",
          color: isPaid ? "#a0a0a0" : "#000",
          background: isPaid ? "#f5f5f5" : "transparent",
          opacity: isPaid ? 0.6 : 1,
        }}
      >
        {isPaid
          ? `Installment ${inst.installment} — Paid`
          : `Installment ${inst.installment} — Rs. ${remainingAmt.toFixed(2)}`}
      </li>
    );
  })}
</ul>

      </div>
    )}
    {fee.label === "Other Fees" && (
  <input
    value={feeEntries[idx]?.description || ""}
    onChange={(e) => {
      const updated = [...feeEntries];
      updated[idx] = {
        ...updated[idx],
        description: e.target.value,
        type: feeLabelToKey[fee.label],
      };
      setFeeEntries(updated);
    }}
    placeholder="Description (optional)"
  />
)}

  </td>

  <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>
    {formatPopupAmount(fee.total) ? `Rs. ${formatPopupAmount(fee.total)}` : ""}
  </td>

  <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>
    {formatPopupAmount(remaining) ? `Rs. ${formatPopupAmount(remaining)}` : ""}
  </td>

                          <td style={{ border: "1px solid #ccc", padding: "5px", textAlign: "right" }}>
  {fee.source === "individual" ? (
    <span style={{ fontSize: "12px", color: "#374151" }}>
      {formatPopupAmount(remaining) ? `Rs. ${formatPopupAmount(remaining)}` : ""}
    </span>
  ) : fee.isCustom ? (
  <input
    type="text"
    value={dynamicFeeValues[fee.key] || ""}
    onChange={(e) =>
      handleDynamicFeeAmountChange(
        fee.key,
        e.target.value,
        remaining
      )
    }
    placeholder="Enter Amount"
    style={{ width: "100px", padding: "5px", textAlign: "right" }}
  />
  ) : (
  <input
    type="text"
    value={feeEntries[idx]?.raw || ""}
    onChange={(e) => {
      let val = e.target.value;

      // 1. Allow only numbers and a single decimal point
      val = val.replace(/[^0-9.]/g, "");
      const parts = val.split(".");
      if (parts.length > 2) return;

      const num = parts[0] ? parseFloat(val) : 0;

      // 2. VALIDATION LOGIC:
      // Remove restriction if the label is "Other Fees". 
      // Otherwise, prevent exceeding the remaining balance.
      if (fee.label !== "Other Fees") {
        if (num > fee.total - fee.paid) return;
      }

      // 3. Update state for both the list and the numeric calculations
      const updated = [...feeEntries];
      updated[idx] = {
        ...(updated[idx] || {}), // Ensure object exists to avoid errors
        raw: val,           
        amount: num,        
        type: feeLabelToKey[fee.label],
      };
      
      setFeeEntries(updated);

      // 4. Synchronize with the central fees state to ensure both columns have the same value
      const typeKey = feeLabelToKey[fee.label];
      if (typeKey) {
        setFees(prev => ({
          ...prev,
          [typeKey]: num
        }));
      }
    }}
    onBlur={() => {
      const updated = [...feeEntries];
      if (!updated[idx]) return;

      const num = updated[idx].amount || 0;

      // Format the number for display (e.g., 1000.00)
      updated[idx].raw = num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      setFeeEntries(updated);
    }}
    placeholder="Enter Amount"
      style={{ width: "100px", padding: "5px", textAlign: "right" }}
  />
  )}
</td>
</tr>

              );
            })}
          </tbody>
        </table>
      </div>

      {/* RIGHT SIDE: PAYMENT DETAILS */}
    <div className="payment-payment-details">
              <div className="payment-details-row">
                <div className="payment-detail-item">
                  <label>Payment Date:</label>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
           
              </div>
         <div className="payment-details-row">
  <div className="payment-detail-item">
    <label>Payment Mode:</label>
    <select
      value={paymentMode}
      onChange={(e) => setPaymentMode(e.target.value)}
    >
      <option value="">-- Select Mode --</option>
      <option value="Cash">Cash</option>
      <option value="Online">Online</option>
      <option value="Card">Card</option>
      <option value="Cheque">Cheque</option>
      <option value="Cash+Online">Cash+Online</option>
    </select>
  </div>

  {/* Show Transaction ID input only if Online or Cash+Online is selected */}
  {(paymentMode === "Online" || paymentMode === "Cash+Online") && (
    <div className="payment-detail-item">
      <label>Transaction ID:</label>
      <input
        type="text"
        value={transactionId}
        onChange={(e) => setTransactionId(e.target.value)}
        placeholder="Enter Transaction ID"
      />
    </div>
  )}
</div>

              {paymentMode === "Cash+Online" && (
                <div className="payment-details-row">
                  <div className="payment-detail-item">
                    <label>Cash Amount:</label>
                    <input type="number" value={cashAmount} onChange={(e) => setCashAmount(Number(e.target.value))} placeholder="Enter cash" />
                  </div>
                  <div className="payment-detail-item">
                    <label>Online Amount:</label>
                    <input type="number" value={onlineAmount} onChange={(e) => setOnlineAmount(Number(e.target.value))} placeholder="Enter online amount" />
                  </div>
                </div>
              )}
            <button
  className="payment-submit-button"
  onClick={handlePaymentSubmission}
  disabled={isLoading}   // 🔹 Disable while loading
>
  {isLoading ? "Submitting..." : "Submit"}
</button>

            </div>

    </div></div>
  </div>
)}

      {showPaidPopup && (
        <div
          className="Payment-paidPopupOverlay"
          onClick={() => setShowPaidPopup(false)}
        >
          <div
            className="Payment-paidPopupContent"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="Payment-paidPopupCloseButton"
              onClick={() => setShowPaidPopup(false)}
            >
              X
            </button>
     <PaidAmountdemo
  popupData={paidPageData}
  className={className}
  section={section}
  selectedStudent={selectedStudent}
  selectedStudentId={selectedStudentId}
  paymentDate={paymentDate}
  receiptNumber={paidPageData?.receiptNumber || receiptNumber}
  paymentMode={paymentMode}
  discountAmount={discountAmount}
  transactionId={transactionId}   // ✅ ADD THIS
/>

          </div>
        </div>
      )}

      {duplicateConfirmState.isOpen && (
        <div
          className="Payment-paidPopupOverlay"
          onClick={() => closeDuplicateConfirmation(false)}
        >
          <div
            className="Payment-paidPopupContent payment-duplicate-popup-content"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="payment-duplicate-popup-message">
              {duplicateConfirmState.message}
            </p>
            <div className="payment-duplicate-popup-actions">
              <button
                className="payment-submit-button payment-duplicate-popup-btn payment-duplicate-popup-btn-cancel"
                onClick={() => closeDuplicateConfirmation(false)}
              >
                No
              </button>
              <button
                className="payment-submit-button payment-duplicate-popup-btn"
                onClick={() => closeDuplicateConfirmation(true)}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Success/Error Popups */}
      {showSuccessPopup && (
        <div className="payment-success-popup">
          <CheckCircle />
          {popupMessage}
        </div>
      )}
      {showErrorPopup && (
        <div className="payment-error-popup">
          <Circle />
          {popupMessage}
        </div>
      )}
    
    </div>
    <ErrorPopup message={popupMsg} onClose={() => setPopupMsg("")} />

    </>
);

};
export default PayementDemo;
