import { Filter, FileText, Download, Printer, Edit, Save, X } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useLocation, useNavigate } from 'react-router-dom';

export const getGridClass = (mode) => {
  switch (mode) {
    case 2: return 'grid-rows-2';
    case 4: return 'grid-rows-2 grid-cols-2';
    case 6: return 'grid-rows-3 grid-cols-2';
    default: return 'grid-rows-2';
  }
};

export const getScaleClass = (mode) => {
  switch (mode) {
    case 2: return 'scale-90';
    case 4: return 'scale-75';
    case 6: return 'scale-60';
    default: return 'scale-90';
  }
};

const PaidAmountdemo = ({ popupData, transactionId }) => {
const [studentData, setStudentData] = useState(null);
  const [previewMode, setPreviewMode] = useState(1);
  const [printMode, setPrintMode] = useState(1);
  const [totalPaid, setTotalPaid] = useState(0);
  const location = useLocation();
  const state = popupData || location.state;
  const paymentReceiptNumber = state?.receiptNumber || null;
  const [highlightedRow, setHighlightedRow] = useState(null);
  const [admissionFee, setAdmissionFee] = useState(0);
  const [admissionPaid, setAdmissionPaid] = useState(0);
  const [feeStructure, setFeeStructure] = useState({
    academicFee: 0,
    uniformFee: 0,
    bookFee: 0,
    transportFee: 0,
    labFee: 0,
    miscellaneousFee: 0,
    hostelFee: 0,
    messFee: 0,
    completeFee: 0
  });
  const [selectedClass, setSelectedClass] = useState(state?.className || "");
  const [responseData, setResponseData] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(state?.studentName || "");
  const [paidAmount, setPaidAmount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(state?.studentId || null);
  const [showPreviewDropdown, setShowPreviewDropdown] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [receiptNumber, setReceiptNumber] = useState(paymentReceiptNumber || '001');
  const [initialReceiptSet, setInitialReceiptSet] = useState(false);
  const [paymentMode, setPaymentMode] = useState(state?.paymentMode || '');
  const [paymentDate, setPaymentDate] = useState(state?.paymentDate || '');
  const [payments, setPayments] = useState(null);
  const [generatedBills, setGeneratedBills] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableBill, setEditableBill] = useState(null);
  const [dynamicLogoSrc, setDynamicLogoSrc] = useState('');
  const [dynamicSchoolCode, setDynamicSchoolCode] = useState('');
  const [examFee, setExamFee] = useState(0);
  const [busFee, setBusFee] = useState(0);
  const [bookFee, setBookFee] = useState(0);
  const [uniformFee, setUniformFee] = useState(0);
  const [othersFee, setOthersFee] = useState(0);
  const [tuitionFee, setTuitionFee] = useState(0);
  const [tuitionPaid, setTuitionPaid] = useState(0);
  const [examPaid, setExamPaid] = useState(0);
  const [busPaid, setBusPaid] = useState(0);
  const [bookPaid, setBookPaid] = useState(0);
  const [uniformPaid, setUniformPaid] = useState(0);
  const [othersPaid, setOthersPaid] = useState(0);
  const [residentialFee, setResidentialFee] = useState(0);
  const [residentialPaid, setResidentialPaid] = useState(0);
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookDiscount, setBookDiscount] = useState(0);
  const [tuitionDiscount, setTuitionDiscount] = useState(0);
  const [busDiscount, setBusDiscount] = useState(0);
  const [pendingBills, setPendingBills] = useState([]);
  const [isNextBillTop, setIsNextBillTop] = useState(() => {
    const storedValue = localStorage.getItem('isNextBillTop');
    return storedValue ? JSON.parse(storedValue) : true;
  });
  const [editedTotalDue, setEditedTotalDue] = useState(null);
  const currentReceiptNumberRef = useRef(paymentReceiptNumber || '001');
  const normalizeClassLabel = (value) =>
    String(value || "").replace(/^Class\s+/i, "").trim();
  const normalizeText = (value) => String(value || "").trim().toLowerCase();
  const getFirstPositiveNumber = (...values) => {
    for (const value of values) {
      const parsed = parseFloat(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    for (const value of values) {
      const parsed = parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  };
  const isDynamicFeeKey = (key) => {
    const reservedKeys = new Set([
      "id",
      "schoolCode",
      "school_code",
      "class_name",
      "className",
      "section",
      "sectionName",
      "StudentName",
      "studentName",
      "name",
      "created_at",
      "updated_at",
      "paymentDate",
      "paidDate",
      "paymentdate",
      "paiddate",
      "date",
      "receiptNumber",
      "paymentMode",
      "transactionId",
      "transactionID",
      "transaction_id",
      "Paid_Amount",
      "paidAmount",
      "completeFee",
      "CompleteFee",
      "academicFee",
      "uniformFee",
      "bookFee",
      "transportFee",
      "labFee",
      "miscellaneousFee",
      "hostelFee",
      "messFee",
      "Tuition_Fee",
      "TuitionFee",
      "Calculated_Tuition_Fee",
      "Admission_fees",
      "Admission_Fee",
      "admissionFee",
      "Exam_fees",
      "examFee",
      "Uniform_fees",
      "uniformFee",
      "Book_Fees",
      "bookFee",
      "Others",
      "OtherFee",
      "othersFee",
      "ResidentialCompleteFee",
      "residentialFee",
      "Bus_fees",
      "busFee",
      "bus_fee",
      "class",
      "Final_Amount",
      "finalAmount",
      "others_description",
      "discounts",
      "totalDiscount",
      "tuitionDiscount",
      "busDiscount",
      "feeDiscount",
      "admissionDiscount",
      "tuitionRemaining",
      "examRemaining",
      "busRemaining",
      "bookRemaining",
      "uniformRemaining",
      "othersRemaining",
      "admissionRemaining",
      "residentialRemaining",
      "dynamicFeeDueTotal",
      "dynamicFeePaidTotal",
      "totalRemaining",
    ]);

    return !reservedKeys.has(key) && !key.endsWith("_paid") && !key.endsWith("_due");
  };
  const getDynamicFeeKeysFromSource = (source = {}) =>
    Object.keys(source || {}).filter(isDynamicFeeKey);

  // Fetch last receipt number from DB
  useEffect(() => {
    if (paymentReceiptNumber) {
      setReceiptNumber(paymentReceiptNumber);
      currentReceiptNumberRef.current = paymentReceiptNumber;
      setInitialReceiptSet(true);
      console.log('[RECEIPT][GENERATE_BILL] using receipt from payment:', paymentReceiptNumber);
      return;
    }

    const fetchLastReceiptNumber = async () => {
      const schoolCode = localStorage.getItem('schoolCode');
      if (!schoolCode) return;
      try {
        const response = await axios.get(`https://cleezoclass.com:4000/api/getLastReceiptNumber?schoolCode=${schoolCode}`);
        const lastReceiptNumber = response.data.lastReceiptNumber || '001';
        setReceiptNumber(lastReceiptNumber);
        currentReceiptNumberRef.current = lastReceiptNumber;
        setInitialReceiptSet(true);
      } catch (error) {
        console.error('Error fetching last receipt number:', error);
        setReceiptNumber('001');
        currentReceiptNumberRef.current = '001';
        setInitialReceiptSet(true);
      }
    };
    fetchLastReceiptNumber();
  }, [paymentReceiptNumber]);

  // Save receipt number to DB
  const saveReceiptNumberToDB = async (receiptNumber) => {
    const schoolCode = localStorage.getItem('schoolCode');
    if (!schoolCode) return;
    try {
      await axios.post('https://cleezoclass.com:4000/api/saveLastReceiptNumber', {
        schoolCode,
        lastReceiptNumber: receiptNumber,
      });
    } catch (error) {
      console.error('Error saving receipt number:', error);
    }
  };

  // Increment Receipt Number in DB
  const incrementReceiptNumber = async () => {
    const currentValue = parseInt(currentReceiptNumberRef.current || receiptNumber || '0', 10);
    const newNumber = (currentValue + 1).toString().padStart(3, '0');
    setReceiptNumber(newNumber);
    currentReceiptNumberRef.current = newNumber;
    await saveReceiptNumberToDB(newNumber);
  };

  // Fetch School Logo
  useEffect(() => {
    const fetchSchoolLogo = async () => {
      const code = localStorage.getItem('schoolCode');
      if (!code) return;
      setDynamicSchoolCode(code);
      try {
        const response = await axios.post(
          'https://cleezoclass.com:4000/api/schoollogodynamic',
          { secretecode: code },
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (response.data.logoPath) {
          setDynamicLogoSrc(response.data.logoPath);
        }
      } catch (error) {
        console.error('Error fetching school logo:', error);
      }
    };
    fetchSchoolLogo();
  }, []);

  // Initialize School Name
  useEffect(() => {
    const storedSchoolCode = localStorage.getItem('schoolCode');
    if (storedSchoolCode) {
      const parts = storedSchoolCode.split('_');
      const formattedName = parts.slice(1).join(' ').trim();
      setSchoolName(formattedName);
    }
  }, []);

  // Fetch Students
  useEffect(() => {
    const fetchStudents = async () => {
      const schoolCode = localStorage.getItem('schoolCode');
      if (!selectedClass) return;
      try {
        const res = await axios.get(`https://cleezoclass.com:4000/api/studentsName/${selectedClass}?schoolCode=${schoolCode}`);
        const fetchedStudents = Array.isArray(res.data.students) ? res.data.students : [];
        setStudents(fetchedStudents);
        console.log('[GenerateBill] students loaded', {
          selectedClass,
          count: fetchedStudents.length,
          firstStudent: fetchedStudents[0] || null,
        });

        const targetId = state?.studentId ?? selectedStudentId;
        const targetName = normalizeText(state?.studentName || selectedStudent || "");
        const targetClass = normalizeClassLabel(state?.className || selectedClass);
        const targetSection = normalizeText(state?.sectionName || state?.section || "");

        const studentToSelect =
          fetchedStudents.find((s) => String(s.id) === String(targetId)) ||
          fetchedStudents.find((s) => {
            const studentName = normalizeText(s.name || s.studentName || s.StudentName);
            const studentClass = normalizeClassLabel(
              s.class_name || s.className || s.class || s.FeeClass || selectedClass
            );
            const studentSection = normalizeText(s.section || s.sectionName || s.Section || "");

            const matchesName = !targetName || studentName === targetName;
            const matchesClass = !targetClass || normalizeClassLabel(studentClass) === targetClass;
            const matchesSection = !targetSection || studentSection === targetSection;

            return matchesName && matchesClass && matchesSection;
          }) ||
          fetchedStudents[0];

        if (studentToSelect) {
          setSelectedStudentId(studentToSelect.id);
          setSelectedStudent(studentToSelect.name || studentToSelect.studentName || studentToSelect.StudentName || "");
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };
    fetchStudents();
  }, [selectedClass, selectedStudentId, selectedStudent, state?.studentId, state?.studentName, state?.className, state?.sectionName, state?.section]);

  const dynamicFeeKeys = useMemo(() => {
    const source = {
      ...(feeStructure || {}),
      ...(payments || {}),
    };
    return Object.keys(source).filter(isDynamicFeeKey);
  }, [feeStructure, payments]);

  const dynamicFeeRows = useMemo(() => {
    const columns = dynamicFeeKeys;
    return columns
      .map((column) => {
        const total = getFirstPositiveNumber(payments?.[column], feeStructure?.[column], 0);
        const paid = parseFloat(payments?.[`${column}_paid`] ?? 0) || 0;
        const storedDue = parseFloat(payments?.[`${column}_due`]);
        const due =
          Number.isFinite(storedDue) && storedDue > 0
            ? storedDue
            : Math.max(total - paid, 0);
        return {
          key: column,
          label: column.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
          total,
          paid,
          due,
        };
      })
      .filter((row) => row.total > 0 || row.paid > 0 || row.due > 0);
  }, [dynamicFeeKeys, feeStructure, payments]);

  // Fetch Fee Structure and Payment History
useEffect(() => {
  console.log("useEffect triggered for selectedStudentId:", selectedStudentId);

  if (!selectedStudentId) {
    console.log("No student selected, exiting useEffect.");
    return;
  }

  const selected = students.find(s => String(s.id) === String(selectedStudentId));
  console.log("Selected student object:", selected);

  if (!selected) {
    const fallbackTargetName = normalizeText(state?.studentName || selectedStudent || "");
    const fallbackTargetClass = normalizeClassLabel(state?.className || selectedClass);
    const fallbackTargetSection = normalizeText(state?.sectionName || state?.section || "");
    const fallbackSelected = students.find((s) => {
      const studentName = normalizeText(s.name || s.studentName || s.StudentName);
      const studentClass = normalizeClassLabel(s.class_name || s.className || s.class || s.FeeClass || selectedClass);
      const studentSection = normalizeText(s.section || s.sectionName || s.Section || "");

      const matchesName = !fallbackTargetName || studentName === fallbackTargetName;
      const matchesClass = !fallbackTargetClass || normalizeClassLabel(studentClass) === fallbackTargetClass;
      const matchesSection = !fallbackTargetSection || studentSection === fallbackTargetSection;

      return matchesName && matchesClass && matchesSection;
    });

    if (!fallbackSelected) {
      console.log("Student not found in students list.");
      return;
    }

    setSelectedStudentId(fallbackSelected.id);
    setSelectedStudent(fallbackSelected.name || fallbackSelected.studentName || fallbackSelected.StudentName || "");
    return;
  }

  setStudentData({
    name: selected.name,
    fatherName: selected.fatherName || '-',
    class: selectedClass,
    section: selected.section || 'A',
    rollNumber: selected.id.toString(),
    billType: 'full-package'
  });
  console.log("Student data set:", {
    name: selected.name,
    fatherName: selected.fatherName || '-',
    class: selectedClass,
    section: selected.section || 'A',
    rollNumber: selected.id.toString(),
    billType: 'full-package'
  });

  const schoolCode = localStorage.getItem('schoolCode');
  console.log("School code from localStorage:", schoolCode);

  Promise.all([
    axios.get(`https://cleezoclass.com:4000/api/feeStructure/${selectedClass}?schoolCode=${schoolCode}`),
    axios.get(`https://cleezoclass.com:4000/api/payment/${selectedStudentId}?schoolCode=${schoolCode}`),
  ])
    .then(([feeRes, paymentRes]) => {
      console.log("Fee structure response:", feeRes.data);
      if (feeRes.data?.feeStructure) {
        setFeeStructure(feeRes.data.feeStructure);
        console.log("Fee structure set:", feeRes.data.feeStructure);
      }

      console.log("Payment history response:", paymentRes.data);
      const paymentData = paymentRes.data.payments || {};
      const resolvedFeeStructure = feeRes.data?.feeStructure || {};
      setPayments(paymentData);
      console.log("Payments set:", paymentData);

      const discounts = paymentData.discounts || {};
      setBookDiscount(parseFloat(discounts.feeDiscount || 0));
      setTuitionDiscount(parseFloat(discounts.tuitionDiscount || 0));
      setBusDiscount(parseFloat(discounts.busDiscount || 0));
      console.log("Discounts applied:", discounts);

      const completeFeeOriginal = getFirstPositiveNumber(
        paymentData.completeFee,
        paymentData.CompleteFee,
        resolvedFeeStructure.CompleteFee
      );
      const examFeeOriginal = getFirstPositiveNumber(
        paymentData.examFee,
        paymentData.Exam_fees,
        resolvedFeeStructure.examFee,
        resolvedFeeStructure.Exam_fees
      );
      const busFeeOriginal = getFirstPositiveNumber(
        paymentData.busFee,
        paymentData.Bus_fees,
        resolvedFeeStructure.busFee,
        resolvedFeeStructure.Bus_fees
      );
      const bookFeeOriginal = getFirstPositiveNumber(
        paymentData.bookFee,
        paymentData.Book_Fees,
        resolvedFeeStructure.bookFee,
        resolvedFeeStructure.Book_Fees
      );
      const uniformFeeOriginal = getFirstPositiveNumber(
        paymentData.uniformFee,
        paymentData.Uniform_fees,
        resolvedFeeStructure.uniformFee,
        resolvedFeeStructure.Uniform_fees
      );
      const othersFeeOriginal = getFirstPositiveNumber(
        paymentData.othersFee,
        paymentData.Others,
        resolvedFeeStructure.othersFee,
        resolvedFeeStructure.Others
      );
      const admissionFeeOriginal = getFirstPositiveNumber(
        paymentData.admissionFee,
        paymentData.Admission_fees,
        resolvedFeeStructure.admissionFee,
        resolvedFeeStructure.Admission_fees
      );
      const residentialFeeOriginal = getFirstPositiveNumber(
        paymentData.residentialFee,
        paymentData.ResidentialCompleteFee,
        resolvedFeeStructure.residentialFee,
        resolvedFeeStructure.ResidentialCompleteFee
      );
      const customFeeColumns = getDynamicFeeKeysFromSource({
        ...resolvedFeeStructure,
        ...paymentData,
      }).filter((key) => !key.toLowerCase().endsWith("date"));
      console.log("[GenerateBill] dynamic fee keys from merged source", customFeeColumns);
      console.log("[GenerateBill] custom fee columns", customFeeColumns);
      const customFeeTotal = customFeeColumns.reduce((sum, key) => {
        const value = parseFloat(paymentData?.[key] ?? resolvedFeeStructure?.[key] ?? 0) || 0;
        return sum + value;
      }, 0);
      console.log("[GenerateBill] custom fee total", customFeeTotal);

      console.log("Original fees:", {
        completeFeeOriginal, examFeeOriginal, busFeeOriginal, bookFeeOriginal,
        uniformFeeOriginal, othersFeeOriginal, admissionFeeOriginal
      });

      const sumOtherFees =
        examFeeOriginal +
        bookFeeOriginal +
        uniformFeeOriginal +
        othersFeeOriginal +
        admissionFeeOriginal +
        residentialFeeOriginal +
        customFeeTotal;
      const baseTuitionFee =
        parseFloat(paymentData.Tuition_Fee) ||
        parseFloat(paymentData.Calculated_Tuition_Fee) ||
        parseFloat(resolvedFeeStructure?.Tuition_Fee) ||
        parseFloat(resolvedFeeStructure?.Calculated_Tuition_Fee) ||
        Math.max(0, completeFeeOriginal - sumOtherFees);
      const discountedTuitionFeeDue = Math.max(0, baseTuitionFee);
      const discountedBusFeeDue = Math.max(0, busFeeOriginal - (discounts.busDiscount || 0));
      const discountedBookFeeDue = Math.max(0, bookFeeOriginal - (discounts.feeDiscount || 0));

      const totalAmountAfterDiscount = discountedTuitionFeeDue + admissionFeeOriginal + examFeeOriginal + discountedBusFeeDue + discountedBookFeeDue + uniformFeeOriginal + othersFeeOriginal + residentialFeeOriginal + customFeeTotal;
      console.log("Total amount after discount:", totalAmountAfterDiscount);

      const examPaid = parseFloat(paymentData.examPaid) || 0;
      const busPaid = parseFloat(paymentData.busPaid) || 0;
      const bookPaid = parseFloat(paymentData.bookPaid) || 0;
      const uniformPaid = parseFloat(paymentData.uniformPaid) || 0;
      const othersPaid = parseFloat(paymentData.othersPaid) || 0;
      const generalPaid = parseFloat(paymentData.paidAmount) || 0;
      const tuitionPaid = generalPaid;
      const admissionPaid = parseFloat(paymentData.admissionPaid) || 0;
      const residentialPaid = parseFloat(paymentData.residentialPaid) || 0;
      const dynamicFeePaidTotal = customFeeColumns.reduce((sum, key) => {
        const paidValue = parseFloat(paymentData?.[`${key}_paid`] ?? 0) || 0;
        return sum + paidValue;
      }, 0);
      console.log("[GenerateBill] custom fee paid total", dynamicFeePaidTotal);

      setTuitionPaid(tuitionPaid);
      setAdmissionPaid(admissionPaid);

      const totalPaid = generalPaid + examPaid + busPaid + bookPaid + uniformPaid + othersPaid + admissionPaid + residentialPaid + dynamicFeePaidTotal;
      const totalAmountWithResidential = totalAmountAfterDiscount + residentialFeeOriginal;
      const remainingAmount = Math.max(0, totalAmountWithResidential - totalPaid);

      console.log("Payments breakdown:", {
        totalPaid, remainingAmount, tuitionPaid, admissionPaid,
        examPaid, busPaid, bookPaid, uniformPaid, othersPaid
      });

      setTotalAmount(totalAmountWithResidential);
      setPaidAmount(totalPaid);
      setRemainingAmount(remainingAmount);
      setTuitionFee(baseTuitionFee);
      setExamFee(examFeeOriginal);
      setBusFee(busFeeOriginal);
      setBookFee(bookFeeOriginal);
      setUniformFee(uniformFeeOriginal);
      setOthersFee(othersFeeOriginal);
      setExamPaid(examPaid);
      setBusPaid(busPaid);
      setBookPaid(bookPaid);
      setUniformPaid(uniformPaid);
      setOthersPaid(othersPaid);
      setAdmissionFee(admissionFeeOriginal);
      setResidentialFee(residentialFeeOriginal);
      setResidentialPaid(residentialPaid);

      console.log("[GenerateBill] fee states updated successfully", {
        baseTuitionFee,
        totalAmountAfterDiscount,
        totalAmountWithResidential,
        totalPaid,
        remainingAmount,
      });
    })
    .catch(err => console.error("Error fetching fee structure/payment history:", err));

}, [selectedStudentId, students, selectedClass]);

  const popupCustomFeeRows = (popupData?.customFees || [])
    .map((fee) => ({
      label: fee?.label || fee?.key || "Custom Fee",
      data: {
        paidThisTransaction: Number(fee?.paidThisTransaction) || 0,
      },
      description: fee?.description || "",
    }))
    .filter((item) => item.data.paidThisTransaction > 0);

  const popupCustomFeePaidTotal = popupCustomFeeRows.reduce(
    (sum, item) => sum + (Number(item.data?.paidThisTransaction) || 0),
    0
  );

  const currentPaidAmount =
    Number(popupData?.paidAmount) ||
    (popupData?.fees?.tuition?.paidThisTransaction || 0) +
      (popupData?.fees?.admission?.paidThisTransaction || 0) +
      (popupData?.fees?.exam?.paidThisTransaction || 0) +
      (popupData?.fees?.bus?.paidThisTransaction || 0) +
      (popupData?.fees?.book?.paidThisTransaction || 0) +
      (popupData?.fees?.uniform?.paidThisTransaction || 0) +
      (popupData?.fees?.others?.paidThisTransaction || 0) +
      (popupData?.fees?.residential?.paidThisTransaction || 0) +
      popupCustomFeePaidTotal;

  // Toggle Edit Mode
  const toggleEditMode = () => {
    if (isEditing) {
      setIsEditing(false);
      setEditableBill(null);
    } else {
      setIsEditing(true);
      setEditableBill({
        receiptNumber: currentReceiptNumberRef.current,
        studentData: {
          name: studentData?.name || '',
          fatherName: studentData?.fatherName || '',
          class: studentData?.class || '',
          section: studentData?.section || '',
          rollNumber: studentData?.rollNumber || '',
        },
        tuitionFee,
        admissionFee,
        examFee,
        busFee,
        bookFee,
        uniformFee,
        othersFee,
        tuitionPaid,
        admissionPaid,
        examPaid,
        busPaid,
        bookPaid,
        uniformPaid,
        othersPaid,
        tuitionDiscount,
        busDiscount,
        bookDiscount,
        paymentMode,
        paymentDate: paymentDate || (payments?.created_at || new Date()),
        schoolName,
        totalAmount: editedTotalDue ?? remainingAmount1(),
        paidAmount,
        remainingAmount,
      });
    }
  };

  // Handle Edit Change
  const handleEditChange = (field, value) => {
    if (field === 'totalDue') {
      setEditedTotalDue(parseFloat(value) || 0);
    }
    if (field === 'receiptNumber') {
      currentReceiptNumberRef.current = value;
    }

    setEditableBill(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value,
          },
        };
      }
      return { ...prev, [field]: value };
    });
  };

const saveEditedBill = async (e) => {
  if (e?.preventDefault) e.preventDefault();

  if (!editableBill) return;

  setTuitionPaid(parseFloat(editableBill.tuitionPaid) || 0);
  setAdmissionPaid(parseFloat(editableBill.admissionPaid) || 0);
  setExamPaid(parseFloat(editableBill.examPaid) || 0);
  setBusPaid(parseFloat(editableBill.busPaid) || 0);
  setBookPaid(parseFloat(editableBill.bookPaid) || 0);
  setUniformPaid(parseFloat(editableBill.uniformPaid) || 0);
  setOthersPaid(parseFloat(editableBill.othersPaid) || 0);
  setPaymentMode(editableBill.paymentMode || paymentMode || 'Cash');
  setPaymentDate(editableBill.paymentDate || paymentDate);

  if (editableBill.receiptNumber) {
    setReceiptNumber(editableBill.receiptNumber);
    currentReceiptNumberRef.current = editableBill.receiptNumber;
  }

  if (editableBill.studentData?.name) {
    setStudentData(editableBill.studentData);
  }

  setIsEditing(false);
  setSuccessMessage('Bill values updated. Image save disabled.');
  setShowSuccessModal(true);
};




  // Download and increment
const handleDownloadWithSave = async () => {
    await generatePDF(currentReceiptNumberRef.current);
    if (!paymentReceiptNumber) {
      await incrementReceiptNumber(); // Increment only for standalone bill flow
    }
  };

  // Generate PDF
const generatePDF = async (currentReceiptNumber) => {
  if (!studentData?.name || !currentReceiptNumber) {
    alert('Please select a student and set a receipt number before generating PDF.');
    return;
  }

  const receiptDiv = document.createElement('div');
  receiptDiv.id = 'temp-receipt-for-pdf';
  receiptDiv.style.width = '300px';
  receiptDiv.style.padding = '10px';
  receiptDiv.style.margin = '0 auto';
  receiptDiv.style.backgroundColor = 'white';
  receiptDiv.style.color = 'black';
  receiptDiv.style.fontWeight = 'bold';
  receiptDiv.style.lineHeight = '1.3';
  receiptDiv.style.transform = 'translateZ(0)';
  receiptDiv.style.webkitFontSmoothing = 'antialiased';
  receiptDiv.style.position = 'relative';
  document.body.appendChild(receiptDiv);

  const tuitionFeeDue = Math.max(0, tuitionFee);
  const busFeeDue = Math.max(0, busFee - busDiscount);
  const bookFeeDue = Math.max(0, bookFee - bookDiscount);
  const dynamicFeeDueTotal = dynamicFeeRows.reduce((sum, row) => sum + row.due, 0);
  const dynamicFeePaidTotal = dynamicFeeRows.reduce((sum, row) => sum + row.paid, 0);

  const overallTotalDue = editedTotalDue ?? (
    tuitionFeeDue +
    admissionFee +
    examFee +
    busFeeDue +
    bookFeeDue +
    uniformFee +
    othersFee +
    residentialFee +
    dynamicFeeDueTotal
  );

  console.log("[GenerateBill][due-breakdown]", {
    studentName: studentData?.name || "",
    completeFee,
    staticDueBreakdown: {
      tuitionFeeDue,
      admissionFee,
      examFee,
      busFeeDue,
      bookFeeDue,
      uniformFee,
      othersFee,
      residentialFee,
    },
    dynamicRows: dynamicFeeRows.map((row) => ({
      label: row.label,
      total: row.total,
      paid: row.paid,
      due: row.due,
    })),
    dynamicFeeDueTotal,
    dynamicFeePaidTotal,
    overallTotalDue,
    note: "If completeFee already includes dynamic fees, adding dynamicFeeDueTotal here will double count.",
  });

  let overallTotalPaid =
    Number(popupData?.paidAmount) ||
    (popupData?.fees?.tuition?.paidThisTransaction > 0 ? tuitionPaid : 0) +
      (popupData?.fees?.admission?.paidThisTransaction > 0 ? admissionPaid : 0) +
      (popupData?.fees?.exam?.paidThisTransaction > 0 ? examPaid : 0) +
      (popupData?.fees?.bus?.paidThisTransaction > 0 ? busPaid : 0) +
      (popupData?.fees?.book?.paidThisTransaction > 0 ? bookPaid : 0) +
      (popupData?.fees?.uniform?.paidThisTransaction > 0 ? uniformPaid : 0) +
      (popupData?.fees?.others?.paidThisTransaction > 0 ? othersPaid : 0) +
      (popupData?.fees?.residential?.paidThisTransaction > 0 ? residentialPaid : 0) +
      dynamicFeePaidTotal;

  console.log("[GenerateBill][paid-breakdown]", {
    popupPaidAmount: Number(popupData?.paidAmount) || 0,
    tuitionPaid,
    admissionPaid,
    examPaid,
    busPaid,
    bookPaid,
    uniformPaid,
    othersPaid,
    residentialPaid,
    dynamicFeePaidTotal,
    overallTotalPaid,
    note: "If popupData.paidAmount already includes dynamic fee payments, adding dynamicFeePaidTotal again will double count.",
  });
  const dynamicFeeReceiptHtml = dynamicFeeRows
    .map(
      (row) => `
        <tr>
          <td style="border: 1px solid black; padding: 2px; font-size: 8px;">${row.label}</td>
          <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${row.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${row.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${row.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${row.due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `
    )
    .join('');

  try {
    receiptDiv.innerHTML = `
      <div style="text-align: center; margin-bottom: 0.25rem;">
        <h1 style="font-size: 12px; font-weight: 700; color: #1e40af; margin-bottom: 0.1rem;">${schoolName || 'School Name'}</h1>
        <div style="border: 1px solid black; margin: 3px 0; padding: 2px 0; font-weight: bold; font-size: 10px;">FEES RECEIPT</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 0.25rem;">
        <tbody>
          <tr>
            <td style="text-align: left; width: 50%; font-size: 8px;"><strong>Receipt No.</strong> ${currentReceiptNumber}</td>
            <td style="text-align: right; width: 50%; font-size: 8px;"><strong>Paid Date:</strong> ${paymentDate ? formatDate1(paymentDate) : formatDate1(new Date())}</td>
          </tr>
          <tr>
            <td style="text-align: left; font-size: 8px;"><strong>Regn. No.</strong> ${studentData?.rollNumber || 'N/A'}</td>
            <td style="text-align: right; font-size: 8px;"><strong>Academic Year:</strong> ${getAcademicYear()}</td>
          </tr>
          <tr>
            <td style="text-align: left; font-size: 8px;"><strong>Student Name:</strong> ${studentData?.name || 'N/A'}</td>
            <td style="text-align: right; font-size: 8px;"><strong>Father's Name:</strong> ${studentData?.fatherName || 'N/A'}</td>
          </tr>
          <tr>
            <td style="text-align: left; font-size: 8px;"><strong>Class:</strong> ${studentData?.class?.toUpperCase() || 'N/A'}</td>
            <td style="text-align: right; font-size: 8px;"><strong>Section:</strong> ${studentData?.section || 'A'}</td>
          </tr>
        </tbody>
      </table>
      <table style="width: 100%; border: 1px solid black; border-collapse: collapse; margin-bottom: 0.25rem;">
        <thead>
          <tr style="background-color: #f0f0f0; font-size: 8px;">
            <th style="border: 1px solid black; padding: 2px;">Fee Details</th>
            <th style="border: 1px solid black; padding: 2px; text-align: right;">Amount (₹)</th>
            <th style="border: 1px solid black; padding: 2px; text-align: right;">Paid Now (₹)</th>
            <th style="border: 1px solid black; padding: 2px; text-align: right;">Total Paid (₹)</th>
            <th style="border: 1px solid black; padding: 2px; text-align: right;">Balance (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${popupData?.fees?.tuition?.paidThisTransaction > 0 ? `
            <tr style="background-color: ${popupData?.fees?.tuition?.highlight ? 'transparent' : 'transparent'};">
              <td style="border: 1px solid black; padding: 2px; font-size: 8px;">Tuition Fee ${tuitionDiscount > 0 ? `<span style="color: green; font-size: 7px;">(Discount: ₹${tuitionDiscount.toLocaleString('en-IN')})</span>` : ''}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${tuitionFeeDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${popupData?.fees?.tuition?.paidThisTransaction?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${tuitionPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${Math.max(tuitionFeeDue - tuitionPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          ${popupData?.fees?.admission?.paidThisTransaction > 0 ? `
            <tr style="background-color: ${popupData?.fees?.admission?.highlight ? 'transparent' : 'transparent'};">
              <td style="border: 1px solid black; padding: 2px; font-size: 8px;">Admission Fee</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${admissionFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${popupData?.fees?.admission?.paidThisTransaction?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${admissionPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${Math.max(admissionFee - admissionPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          ${popupData?.fees?.exam?.paidThisTransaction > 0 ? `
            <tr style="background-color: ${popupData?.fees?.exam?.highlight ? 'transparent' : 'transparent'};">
              <td style="border: 1px solid black; padding: 2px; font-size: 8px;">Exam Fee</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${examFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${popupData?.fees?.exam?.paidThisTransaction?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${examPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${Math.max(examFee - examPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          ${popupData?.fees?.bus?.paidThisTransaction > 0 ? `
            <tr style="background-color: ${popupData?.fees?.bus?.highlight ? 'transparent' : 'transparent'};">
              <td style="border: 1px solid black; padding: 2px; font-size: 8px;">Bus Fee ${busDiscount > 0 ? `<span style="color: green; font-size: 7px;">(Discount: ₹${busDiscount.toLocaleString('en-IN')})</span>` : ''}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${busFeeDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${popupData?.fees?.bus?.paidThisTransaction?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${busPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${Math.max(busFeeDue - busPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          ${popupData?.fees?.book?.paidThisTransaction > 0 ? `
            <tr style="background-color: ${popupData?.fees?.book?.highlight ? 'transparent' : 'transparent'};">
              <td style="border: 1px solid black; padding: 2px; font-size: 8px;">Book Fee ${bookDiscount > 0 ? `<span style="color: green; font-size: 7px;">(Discount: ₹${bookDiscount.toLocaleString('en-IN')})</span>` : ''}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${bookFeeDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${popupData?.fees?.book?.paidThisTransaction?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${bookPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${Math.max(bookFeeDue - bookPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          ${popupData?.fees?.uniform?.paidThisTransaction > 0 ? `
            <tr style="background-color: ${popupData?.fees?.uniform?.highlight ? 'transparent' : 'transparent'};">
              <td style="border: 1px solid black; padding: 2px; font-size: 8px;">Uniform Fee</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${uniformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${popupData?.fees?.uniform?.paidThisTransaction?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${uniformPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${Math.max(uniformFee - uniformPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          ${popupData?.fees?.others?.paidThisTransaction > 0 ? `
            <tr style="background-color: ${popupData?.fees?.others?.highlight ? 'transparent' : 'transparent'};">
              <td style="border: 1px solid black; padding: 2px; font-size: 8px;">
                Other Fees${popupData?.fees?.others?.description ? `<br/><span style="font-size: 7px;">${popupData.fees.others.description}</span>` : ""}
              </td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${othersFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${popupData?.fees?.others?.paidThisTransaction?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${othersPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${Math.max(othersFee - othersPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          ${popupData?.fees?.residential?.paidThisTransaction > 0 ? `
            <tr style="background-color: ${popupData?.fees?.residential?.highlight ? 'transparent' : 'transparent'};">
              <td style="border: 1px solid black; padding: 2px; font-size: 8px;">Residential Fee</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${residentialFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${popupData?.fees?.residential?.paidThisTransaction?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${residentialPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${Math.max(residentialFee - residentialPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          ${dynamicFeeReceiptHtml}
          <tr style="font-weight: bold; background-color: #f0f0f0;">
            <td style="border: 1px solid black; padding: 2px; text-align: left; font-size: 8px;">GRAND TOTAL</td>
            <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${overallTotalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px; color: green;">₹${popupData?.paidAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${overallTotalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="border: 1px solid black; padding: 2px; text-align: right; font-size: 8px;">₹${Math.max(overallTotalDue - overallTotalPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
      <p style="font-style: italic; margin-top: 3px; font-size: 7px;">Paid Amount (in words): ${convertAmountToWords(overallTotalPaid)}</p>
      <div style="margin-top: 5px; font-size: 7px;">
        <p><strong>Payment Mode:</strong> ${paymentMode || 'Cash/Cheque/Online'}</p>
        ${paymentMode === 'Cheque' || paymentMode === 'Online' ? `
          <p><strong>Cheque/Transaction No.:</strong> ${transactionId || 'N/A'}</p>
          <p><strong>Bank Name:</strong> ${'-------' || 'N/A'}</p>
        ` : ''}
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 10px;">
        <div style="border-top: 1px dashed black; width: 80px; text-align: center; padding-top: 3px; font-size: 7px;">Parent's Signature</div>
        <div style="text-align: center; width: 120px;">
          <div style="font-size: 10px; margin-bottom: 2px;">${localStorage.getItem("name")}</div>
          <div style="border-top: 1px dashed black; padding-top: 3px; font-size: 7px;">Authorised Signature</div>
        </div>
      </div>
      <div style="border-top: 1px dashed black; width: 80px; text-align: center; padding-top: 3px; margin: 5px auto 0; font-size: 7px;">Principal</div>
      <div style="margin-top: 5px; font-size: 7px; text-align: center;">
        <p>This is a computer generated receipt. No signature required.</p>
      </div>
    `;
    const watermark = document.createElement('img');
    watermark.src = dynamicLogoSrc || "/default-logo.png";
    watermark.style.position = 'absolute';
    watermark.style.top = '50%';
    watermark.style.left = '50%';
    watermark.style.transform = 'translate(-50%, -50%)';
    watermark.style.width = '150px';
    watermark.style.height = '150px';
    watermark.style.opacity = '0.1';
    watermark.style.zIndex = '100';
    watermark.style.pointerEvents = 'none';
    receiptDiv.appendChild(watermark);
    const pdf = new jsPDF({ unit: 'mm', format: [80, 200] });
    const canvas = await html2canvas(receiptDiv, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      letterRendering: true
    });
    const imgData = canvas.toDataURL('image/png');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Fee_Receipt_${currentReceiptNumber}.pdf`);

    const billData = {
      receiptNumber: currentReceiptNumber,
      studentData,
      tuitionFee,
      tuitionPaid,
      admissionFee,
      admissionPaid,
      residentialFee,
      residentialPaid,
      examFee,
      examPaid,
      busFee,
      busPaid,
      bookFee,
      bookPaid,
      uniformFee,
      uniformPaid,
      othersFee,
      othersPaid,
      totalAmount: overallTotalDue,
      paidAmount: overallTotalPaid,
      finalAmount: Math.max(overallTotalDue - overallTotalPaid, 0),
      paymentMode,
      currentDate: paymentDate || (payments?.created_at || new Date()),
      academicYear: getAcademicYear(),
      amountInWords: convertAmountToWords(overallTotalPaid),
      schoolName,
      discounts: { tuitionDiscount, busDiscount, bookDiscount }
    };
    const updatedBills = [...generatedBills, billData];
    setGeneratedBills(updatedBills);
    localStorage.setItem('generatedBills', JSON.stringify(updatedBills));

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
  } finally {
    if (document.body.contains(receiptDiv)) {
      document.body.removeChild(receiptDiv);
    }
  }
};


const confirmPrint = async (copies) => {
  setShowPrintDialog(false);
  const receiptNumberToUse = isEditing ? editableBill?.receiptNumber : currentReceiptNumberRef.current;

  const overallTotalDue = editedTotalDue ?? (
    tuitionFeeDue +
    admissionFee +
    residentialFee +
    examFee +
    busFeeDue +
    bookFeeDue +
    uniformFee +
    othersFee +
    dynamicFeeRows.reduce((sum, row) => sum + row.due, 0)
  );

  const overallTotalPaid =
    Number(popupData?.paidAmount) ||
    tuitionPaid +
      admissionPaid +
      residentialPaid +
      examPaid +
      busPaid +
      bookPaid +
      uniformPaid +
      othersPaid +
      dynamicFeeRows.reduce((sum, row) => sum + row.paid, 0);

  const remainingAmount = Math.max(overallTotalDue - overallTotalPaid, 0);

  const printData = {
    receiptNumber: receiptNumberToUse,
    studentData,
    tuitionFee: tuitionFeeDue,
    admissionFee,
    residentialFee,
    examFee,
    busFee: busFeeDue,
    bookFee: bookFeeDue,
    uniformFee,
    othersFee,
    tuitionPaid,
    admissionPaid,
    residentialPaid,
    examPaid,
    busPaid,
    bookPaid,
    uniformPaid,
    othersPaid,
    totalAmount: overallTotalDue,
    paidAmount: overallTotalPaid, // This is the total paid amount
    currentPaidAmount: overallTotalPaid,
    currentPaidInWords: convertAmountToWords(overallTotalPaid),
    remainingAmount,
    paymentMode,
    transactionId,
    currentDate: paymentDate || (payments?.created_at || new Date()),
    academicYear: getAcademicYear(),
      schoolName,
      logoUrl: dynamicLogoSrc || "/default-logo.png",
      popupData,
      dynamicFeeRows,
      discounts: {
        tuitionDiscount,
        busDiscount,
        bookDiscount,
    },
  };

  let billsToPrint = [];
  if (copies === 1) {
    billsToPrint = [{ ...printData }];
  } else if (copies === 2) {
    billsToPrint = [{ ...printData }];
  }

  printPendingBills(billsToPrint);
  if (!paymentReceiptNumber) {
    await incrementReceiptNumber(); // Increment only for standalone bill flow
  }
};


const printPendingBills = (billsToPrint) => {
  setTimeout(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fee Receipts</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            html, body { width: 210mm; height: 297mm; }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              width: 210mm;
              height: 297mm;
              padding: 12mm;
            }
            .page-container {
              width: 186mm;
              height: 273mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-after: always;
            }
            .bill-copy {
              width: 186mm;
              height: 134mm;
              border: 2px solid #000;
              padding: 12px;
              font-size: 11px;
              position: relative;
              overflow: hidden;
            }
            .page-container:last-child { page-break-after: auto; }
            .header-logo { height: 140px; width: 140px; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); opacity: 0.08; z-index: -1; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            table, th, td { border: 1px solid #000; }
            th, td { padding: 3px; font-size: 10px; }
            .signature-line { margin-top: 18px; border-top: 1px dashed #000; width: 120px; text-align: center; padding-top: 4px; font-size: 9px; }
            .copy-label { position: absolute; top: 8px; right: 8px; font-weight: bold; font-size: 11px; border: 1px solid #000; padding: 2px 6px; }
          </style>
        </head>
        <body>
          ${billsToPrint.map(printData => {
            // Function to create one receipt
            const createReceipt = (printData, copyType) => {
              const otherDescription = (printData.popupData?.fees?.others?.description || "").trim();
              const dynamicFeeRows = Array.isArray(printData.dynamicFeeRows) ? printData.dynamicFeeRows : [];
              // All fees greater than 0
              const allFees = [
                { label: "Tuition Fee", amount: printData.tuitionFee, paid: printData.tuitionPaid, discount: printData.discounts.tuitionDiscount },
                { label: "Admission Fee", amount: printData.admissionFee, paid: printData.admissionPaid },
                { label: "Residential Fee", amount: printData.residentialFee, paid: printData.residentialPaid },
                { label: "Exam Fee", amount: printData.examFee, paid: printData.examPaid },
                { label: "Bus Fee", amount: printData.busFee, paid: printData.busPaid, discount: printData.discounts.busDiscount },
                { label: "Book Fee", amount: printData.bookFee, paid: printData.bookPaid, discount: printData.discounts.bookDiscount },
                { label: "Uniform Fee", amount: printData.uniformFee, paid: printData.uniformPaid },
                { label: "Other Fees", amount: printData.othersFee, paid: printData.othersPaid, description: otherDescription },
                ...dynamicFeeRows.map((row) => ({
                  label: row.label,
                  amount: Number(row.total) || 0,
                  paid: Number(row.paid) || 0,
                  due: Number(row.due) || 0,
                })),
              ].filter(fee => fee.amount > 0);

              // Fees paid in this transaction
              const paidFees = [
                { label: "Tuition Fee", paid: printData.popupData?.fees?.tuition?.paidThisTransaction || 0 },
                { label: "Admission Fee", paid: printData.popupData?.fees?.admission?.paidThisTransaction || 0 },
                { label: "Residential Fee", paid: printData.popupData?.fees?.residential?.paidThisTransaction || 0 },
                { label: "Exam Fee", paid: printData.popupData?.fees?.exam?.paidThisTransaction || 0 },
                { label: "Bus Fee", paid: printData.popupData?.fees?.bus?.paidThisTransaction || 0 },
                { label: "Book Fee", paid: printData.popupData?.fees?.book?.paidThisTransaction || 0 },
                { label: "Uniform Fee", paid: printData.popupData?.fees?.uniform?.paidThisTransaction || 0 },
                { label: "Other Fees", paid: printData.popupData?.fees?.others?.paidThisTransaction || 0, description: otherDescription },
                ...dynamicFeeRows.map((fee) => ({
                  label: fee.label,
                  paid: Number(fee.paid) || 0,
                  description: "",
                })),
              ].filter(fee => fee.paid > 0);

              // Generate rows for all fees
              let allFeesRows = '';
              let totalAmount = 0;
              allFees.forEach((fee, index) => {
                totalAmount += fee.amount;
                allFeesRows += `
                  <tr>
                    <td style="text-align:center;">${index + 1}</td>
                    <td>
                      ${fee.label}${fee.description ? `<div style="font-size: 8px;">${fee.description}</div>` : ""}
                      ${fee.discount > 0 ? `<span style="color: green; font-size: 8px;"> (Discount: ₹${fee.discount.toLocaleString('en-IN')})</span>` : ''}
                    </td>
                    <td style="text-align:right;">₹${fee.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `;
              });

              // Generate rows for paid fees
              let paidFeesRows = '';
              let totalPaidThisTxn = 0;
              paidFees.forEach((fee, index) => {
                totalPaidThisTxn += fee.paid;
                paidFeesRows += `
                  <tr>
                    <td style="text-align:center;">${index + 1}</td>
                    <td>${fee.label}${fee.description ? `<div style="font-size: 8px;">${fee.description}</div>` : ""}</td>
                    <td style="text-align:right;color:green;">₹${fee.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `;
              });

              // Calculate total paid and total due
              const totalPaid = allFees.reduce((sum, fee) => sum + fee.paid, 0);
              const totalDue = totalAmount - totalPaid;

              return `
                <div class="bill-copy">
                  <div class="copy-label">${copyType === 'student' ? 'Student Copy' : 'School Copy'}</div>
                  <img src="${printData.logoUrl}" class="header-logo" />

                  <div class="text-center">
                    <h2 class="bold" style="font-size: 13px;">${printData.schoolName}</h2>
                    <div style="border:1px solid #000;margin:4px 0;padding:2px;font-weight:bold;">FEES RECEIPT</div>
                  </div>

                  <!-- Student Details -->
                  <table>
                    <tbody>
                      <tr>
                        <td><strong>Receipt No:</strong> ${printData.receiptNumber}</td>
                        <td class="text-right"><strong>Date:</strong> ${formatDate1(printData.currentDate)}</td>
                      </tr>
                      <tr>
                        <td><strong>Regn No:</strong> ${printData.studentData?.rollNumber || 'N/A'}</td>
                        <td class="text-right"><strong>Academic Year:</strong> ${printData.academicYear}</td>
                      </tr>
                      <tr>
                        <td><strong>Student Name:</strong></td>
                        <td class="text-right">${printData.studentData?.name || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td><strong>Father's Name:</strong></td>
                        <td class="text-right">${printData.studentData?.fatherName || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td><strong>Class:</strong> ${printData.studentData?.class?.toUpperCase() || 'N/A'}</td>
                        <td class="text-right"><strong>Section:</strong> ${printData.studentData?.section || 'A'}</td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- All Fees -->
                  <table>
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Fee Details</th>
                        <th>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${allFeesRows}
                      <tr>
                        <td colspan="2" style="text-align:right;"><strong>Total Amount</strong></td>
                        <td style="text-align:right;"><strong>₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Paid This Transaction -->
                  <table>
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Fee Paid This Transaction</th>
                        <th>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${paidFeesRows}
                      <tr>
                        <td colspan="2" style="text-align:right;"><strong>Total Paid This Transaction</strong></td>
                        <td style="text-align:right;color:green;"><strong>₹${totalPaidThisTxn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Total Paid and Total Due -->
                  <table>
                    <tbody>
                      <tr>
                        <td style="text-align:right;"><strong>Total Paid:</strong></td>
                        <td style="text-align:right;">₹${printData.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td style="text-align:right;"><strong>Total Due:</strong></td>
                        <td style="text-align:right;">₹${Math.max(printData.totalAmount - printData.paidAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>

                  <p style="font-style:italic;font-size:9px;margin-top:3px;">
                    Paid Amount (in words): ${printData.currentPaidInWords}
                  </p>

                  <div style="margin-top:6px;font-size:10px;">
                    <p><strong>Payment Mode:</strong> ${printData.paymentMode}</p>
                    ${printData.paymentMode === 'Cheque' || printData.paymentMode === 'Online'
                      ? `<p><strong>Transaction No:</strong> ${printData.transactionId || 'N/A'}</p>` : ''}
                  </div>

                  <div style="display:flex;justify-content:space-between;margin-top:15px;">
                    <div class="signature-line">Parent's Signature</div>
                    <div style="text-align:center;width:120px;">
                      <div style="font-size:9px;margin-bottom:2px;">${localStorage.getItem("name") || ''}</div>
                      <div class="signature-line">Authorised Signature</div>
                    </div>
                  </div>
                </div>
              `;
            };

            return `
              <div class="page-container">
                ${createReceipt(printData, 'student')}
                ${createReceipt(printData, 'school')}
              </div>
            `;
          }).join('')}

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }, 100);
};



  // Format Date
  const formatDate1 = (dateInput) => {
    if (!dateInput) return '';
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return '';
    }
  };

  // Get Current Date
  const getCurrentDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Get Academic Year
  const getAcademicYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  // Convert Amount to Words
  const convertAmountToWords = (num) => {
    if (isNaN(num)) return 'Invalid amount';
    if (num === 0) return 'Zero Rupees Only';
    const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const denominations = ['', 'Thousand', 'Lakh', 'Crore'];
    const getWords = (n) => {
      let word = '';
      if (n > 99) {
        word += single[Math.floor(n / 100)] + ' Hundred ';
        n = n % 100;
      }
      if (n > 19) {
        word += tens[Math.floor(n / 10)] + ' ';
        word += single[n % 10] + ' ';
      } else if (n >= 10) {
        word += double[n - 10] + ' ';
      } else if (n > 0) {
        word += single[n] + ' ';
      }
      return word.trim();
    };
    let rupees = Math.floor(num);
    let paise = Math.round((num - rupees) * 100);
    let str = '';
    const parts = [];
    const units = [
      rupees % 1000,
      Math.floor((rupees % 100000) / 1000),
      Math.floor((rupees % 10000000) / 100000),
      Math.floor(rupees / 10000000)
    ];
    for (let i = units.length - 1; i >= 0; i--) {
      if (units[i] !== 0) {
        parts.push(getWords(units[i]) + (denominations[i] ? ' ' + denominations[i] : ''));
      }
    }
    if (parts.length > 0) {
      str += parts.join(' ') + ' Rupees';
    }
    if (paise > 0) {
      str += (str ? ' and ' : '') + getWords(paise) + ' Paise';
    }
    return str.trim() + ' Only';
  };

  // Handle Print
  const handlePrint = () => {
    if (!initialReceiptSet) {
      alert('Please wait for the receipt number to be set');
      return;
    }
    setShowPrintDialog(true);
  };

  // Preview Options
  const previewOptions = [
    { value: 1, label: 'Preview: 1 Copy' },
    { value: 2, label: 'Preview: 2 Copies' },
    { value: 4, label: 'Preview: 4 Copies' },
    { value: 6, label: 'Preview: 6 Copies' }
  ];

  // Get Preview Display Name
  const getPreviewDisplayName = (mode) => {
    return previewOptions.find(option => option.value === mode)?.label || 'Preview: 1 Copy';
  };

  // Other Fees
  const otherFees = [
    { key: 'exam', label: 'Exam Fee', amount: examFee, paid: examPaid, discount: 0 },
    { key: 'bus', label: 'Bus Fee', amount: busFee, paid: busPaid, discount: busDiscount },
    { key: 'book', label: 'Book Fee', amount: bookFee, paid: bookPaid, discount: bookDiscount },
    { key: 'uniform', label: 'Uniform Fee', amount: uniformFee, paid: uniformPaid, discount: 0 },
    { key: 'others', label: 'Other Fees', amount: othersFee, paid: othersPaid, discount: 0, description: popupData?.fees?.others?.description || "" }
  ];

  // Get Paid Amount for Fee
  const getPaidAmountForFee = (key) => {
    const fee = otherFees.find(f => f.key === key);
    return fee ? (fee.paid || 0) : 0;
  };

  // Calculate Totals for Display
  const tuitionFeeDue = Math.max(0, tuitionFee);
  const busFeeDue = Math.max(0, busFee - busDiscount);
  const bookFeeDue = Math.max(0, bookFee - bookDiscount);

  let grandTotalDue = 0;
  let grandTotalPaid = 0;
  if (popupData?.fees?.tuition?.paidThisTransaction > 0) {
    grandTotalDue += tuitionFeeDue;
    grandTotalPaid += tuitionPaid;
  }
  if (popupData?.fees?.admission?.paidThisTransaction > 0) {
    grandTotalDue += admissionFee;
    grandTotalPaid += admissionPaid;
  }
  if (popupData?.fees?.exam?.paidThisTransaction > 0) {
    grandTotalDue += examFee;
    grandTotalPaid += examPaid;
  }
  if (popupData?.fees?.bus?.paidThisTransaction > 0) {
    grandTotalDue += busFeeDue;
    grandTotalPaid += busPaid;
  }
  if (popupData?.fees?.book?.paidThisTransaction > 0) {
    grandTotalDue += bookFeeDue;
    grandTotalPaid += bookPaid;
  }
  if (popupData?.fees?.uniform?.paidThisTransaction > 0) {
    grandTotalDue += uniformFee;
    grandTotalPaid += uniformPaid;
  }
  if (popupData?.fees?.others?.paidThisTransaction > 0) {
    grandTotalDue += othersFee;
    grandTotalPaid += othersPaid;
  }
  if (popupData?.fees?.residential?.paidThisTransaction > 0) {
    grandTotalDue += residentialFee;
    grandTotalPaid += residentialPaid;
  }
  const renderDynamicFeeDueTotal = dynamicFeeRows.reduce((sum, row) => sum + row.due, 0);
  const renderDynamicFeePaidTotal = dynamicFeeRows.reduce((sum, row) => sum + row.paid, 0);

  const authorisedName = localStorage.getItem("name");

  const overallTotalDue =
    (tuitionFeeDue) +
    admissionFee +
    residentialFee +
    examFee +
    (busFeeDue - (busDiscount || 0)) +
    (bookFeeDue - (bookDiscount || 0)) +
    uniformFee +
    othersFee +
    renderDynamicFeeDueTotal;
  const overallTotalPaid =
    Number(popupData?.paidAmount) ||
    tuitionPaid +
      admissionPaid +
      residentialPaid +
      examPaid +
      busPaid +
      bookPaid +
      uniformPaid +
      othersPaid +
      renderDynamicFeePaidTotal;

  const remainingAmount1 = () => {
    const overallTotalDue =
      (tuitionFeeDue - (tuitionDiscount || 0)) +
      admissionFee +
      residentialFee +
      examFee +
      (busFeeDue - (busDiscount || 0)) +
      (bookFeeDue - (bookDiscount || 0)) +
      uniformFee +
      othersFee +
      renderDynamicFeeDueTotal;

    const overallTotalPaid =
      Number(popupData?.paidAmount) ||
      tuitionPaid +
        admissionPaid +
        residentialPaid +
        examPaid +
        busPaid +
        bookPaid +
        uniformPaid +
        othersPaid +
        renderDynamicFeePaidTotal;

    return Math.max(overallTotalDue - overallTotalPaid, 0);
  };

  const otherDescription = (popupData?.fees?.others?.description || "").trim();
  const feeRows = [
    { label: "Tuition Fee", data: popupData?.fees?.tuition },
    { label: "Admission Fee", data: popupData?.fees?.admission },
    { label: "Residential Fee", data: popupData?.fees?.residential },
    { label: "Exam Fee", data: popupData?.fees?.exam },
    { label: "Bus Fee", data: popupData?.fees?.bus },
    { label: "Book Fee", data: popupData?.fees?.book },
    { label: "Uniform Fee", data: popupData?.fees?.uniform },
    { label: "Other Fees", data: popupData?.fees?.others, description: otherDescription },
    ...popupCustomFeeRows,
  ].filter(item => item?.data?.paidThisTransaction > 0);
  const dynamicReceiptRows = dynamicFeeRows;

  return (
    <div style={{ minHeight: '100vh', padding: '1rem', backgroundColor: 'white' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '1.5rem', backgroundColor: '#f9fafb' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="btn-group-FeesManagement">
              <label style={{ marginBottom: "0.2rem", fontWeight: "100", fontSize: "12px", display: "block" }}>Class</label>
              <div className="btn-dropdown-FeesManagement" style={{ backgroundColor: "#f3f3f3", padding: "5px", borderRadius: "5px", width: "200px" }}>
                {selectedClass || "N/A"}
              </div>
            </div>
            <div className="btn-group-FeesManagement">
              <label style={{ marginBottom: "0.2rem", fontWeight: "100", fontSize: "12px", display: "block" }}>Student</label>
              <div className="btn-dropdown-FeesManagement" style={{ backgroundColor: "#f3f3f3", padding: "5px", borderRadius: "5px", width: "200px" }}>
                {selectedStudent || "N/A"}
              </div>
            </div>
         
            <div className="btn-group-FeesManagement">
              <label style={{ marginBottom: "0.2rem", fontWeight: "100", fontSize: "12px", display: "block" }}>Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #ccc', width: '120px' }} />
            </div>
          </div>
        </div>
        {initialReceiptSet && (
          <div id="bill-preview-wrapper" style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '1.5rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Preview</h2>
              {studentData?.name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowPreviewDropdown(prev => !prev)} className="actionBtnStyle" style={{ minWidth: '150px' }}>
                      {getPreviewDisplayName(previewMode)}
                    </button>
                    {showPreviewDropdown && (
                      <div style={{ position: 'absolute', right: 0, marginTop: '5px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.375rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', zIndex: 10 }}>
                        {previewOptions.map(option => (
                          <div key={option.value} onClick={() => { setPreviewMode(option.value); setShowPreviewDropdown(false); }} style={{ padding: '0.5rem 1rem', cursor: 'pointer', hover: { backgroundColor: '#f3f4f6' } }}>
                            {option.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={toggleEditMode} className="actionBtnStyle" style={{ backgroundColor: isEditing ? '#dc2626' : 'transparent' }}>
                    {isEditing ? <X style={{ width: '1rem', height: '1rem' }} /> : <Edit style={{ width: '1rem', height: '1rem' }} />}
                  </button>
                  {isEditing && (
                    <button onClick={saveEditedBill} className="actionBtnStyle">
                      <Save style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} /> Save
                    </button>
                  )}
                  <button onClick={handleDownloadWithSave} className="actionBtnStyle">
                    <Download style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} /> Download
                  </button>
                  <button onClick={handlePrint} className="actionBtnStyle">
                    <Printer style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} /> Print
                  </button>
                </div>
              )}
            </div>
            <div id="bill-preview-content" style={{ display: 'grid', gridTemplateRows: getGridClass(previewMode).includes('grid-rows-2') ? '1fr 1fr' : '1fr', gridTemplateColumns: getGridClass(previewMode).includes('grid-cols-2') ? '1fr 1fr' : '1fr', gap: '1rem', justifyContent: 'center', alignItems: 'start', overflow: 'hidden', padding: '0.5rem', minHeight: '200px', position: 'relative' }}>
              {Array.from({ length: previewMode }).map((_, index) => (
                <div key={index} style={{ transform: getScaleClass(previewMode), transformOrigin: 'top center', width: `calc(100% / ${getGridClass(previewMode).includes('grid-cols-2') ? 2 : 1})`, boxSizing: 'border-box', padding: '0 0.5rem' }}>
                  {dynamicLogoSrc && (
                    <img src={dynamicLogoSrc} alt="Watermark" style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: '200px', height: '200px', opacity: 0.3, zIndex: 1, pointerEvents: 'none' }} />
                  )}
                  <div style={{ backgroundColor: '#ffffff', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
             
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <h1 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e40af', marginBottom: '0.1rem' }}>
                          {isEditing ? (
                            <input type="text" value={editableBill?.schoolName || schoolName} onChange={(e) => handleEditChange('schoolName', e.target.value)} style={{ width: '100%', padding: '2px', textAlign: 'center', fontSize: '1rem', fontWeight: '700', border: '1px solid #ccc' }} />
                          ) : (
                            schoolName || 'School Name'
                          )}
                        </h1>
                        <div style={{ border: '1px solid black', margin: '3px 0', padding: '2px 0', fontWeight: 'bold', fontSize: '10px' }}>FEES RECEIPT</div>
                      </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.25rem' }}>
                      <tbody>
                        <tr>
                          <td data-testid="receipt-number" style={{ textAlign: 'left', width: '50%', fontSize: '10px' }}>
                            <strong>Receipt No.</strong>
                            {isEditing ? (
                              <input type="text" value={editableBill?.receiptNumber || ''} onChange={(e) => handleEditChange('receiptNumber', e.target.value)} style={{ width: '100px', padding: '2px', marginLeft: '5px', border: '1px solid #ccc', fontSize: '10px', height: '16px' }} />
                            ) : (
                              ` ${currentReceiptNumberRef.current}`
                            )}
                          </td>
                          <td data-testid="paid-date" style={{ textAlign: 'left', width: '50%', fontSize: '10px' }}>
                            <strong>Paid Date:</strong>
                            {isEditing ? (
                              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={{ width: '100px', padding: '2px', marginLeft: '5px', border: '1px solid #ccc', fontSize: '10px', height: '16px' }} />
                            ) : (
                              ` ${paymentDate ? formatDate1(paymentDate) : formatDate1(new Date())}`
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ textAlign: 'left', fontSize: '10px' }}>
                            <strong>Regn. No.</strong>
                            {isEditing ? (
                              <input type="text" value={studentData?.rollNumber || ''} onChange={(e) => handleEditChange('studentData.rollNumber', e.target.value)} style={{ width: '100px', padding: '1px', marginLeft: '5px', border: '1px solid #ccc', fontSize: '10px', height: '16px' }} disabled />
                            ) : (
                              ` ${studentData?.rollNumber || 'N/A'}`
                            )}
                          </td>
                          <td style={{ textAlign: 'left', fontSize: '10px' }}>
                            <strong>Academic Year:</strong> {getAcademicYear()}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ textAlign: 'left', fontSize: '10px' }}>
                            <strong>Student Name:</strong>
                            {isEditing ? (
                              <input type="text" value={editableBill?.studentData?.studentName || studentData?.name || ''} onChange={(e) => handleEditChange('studentData.studentName', e.target.value)} style={{ width: '100px', padding: '1px', marginLeft: '5px', border: '1px solid #ccc', fontSize: '10px', height: '16px' }} />
                            ) : (
                              ` ${studentData?.name || 'N/A'}`
                            )}
                          </td>
                          <td style={{ textAlign: 'left', fontSize: '10px' }}>
                            <strong>Father's Name:</strong>
                            {isEditing ? (
                              <input type="text" value={studentData?.fatherName || ''} onChange={(e) => handleEditChange('studentData.fatherName', e.target.value)} style={{ width: '100px', padding: '1px', marginLeft: '5px', border: '1px solid #ccc', fontSize: '10px', height: '16px' }} />
                            ) : (
                              ` ${studentData?.fatherName}`
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ textAlign: 'left', fontSize: '10px' }}>
                            <strong>Class:</strong>
                            {isEditing ? (
                              <select value={editableBill?.studentData?.class || ''} onChange={(e) => handleEditChange('studentData.class', e.target.value)} style={{ width: '70px', padding: '1px', marginLeft: '5px', border: '1px solid #ccc', fontSize: '10px', height: '18px' }}>
                                {["nursery", "lkg", "ukg", ...Array.from({ length: 10 }, (_, i) => `class${i + 1}`)].map(cls => (
                                  <option key={cls} value={cls}>{cls.toUpperCase()}</option>
                                ))}
                              </select>
                            ) : (
                              ` ${studentData?.class?.toUpperCase()}`
                            )}
                          </td>
                          <td style={{ textAlign: 'left', fontSize: '10px' }}>
                            <strong>Section:</strong>
                            {isEditing ? (
                              <select value={editableBill?.studentData?.section || ''} onChange={(e) => handleEditChange('studentData.section', e.target.value)} style={{ width: '70px', padding: '1px', marginLeft: '5px', border: '1px solid #ccc', fontSize: '10px', height: '18px' }}>
                                {['A', 'B', 'C', 'D'].map(sec => (
                                  <option key={sec} value={sec}>{sec}</option>
                                ))}
                              </select>
                            ) : (
                              ` ${studentData?.section}`
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
<table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', marginBottom: '1rem' }}>
  <thead>
    <tr>
      <th style={{ textAlign: 'left', fontSize: '10px', borderBottom: '1px solid #ccc', paddingBottom: '2px' }}>Fee Type</th>
      <th style={{ textAlign: 'right', fontSize: '10px', borderBottom: '1px solid #ccc', paddingBottom: '2px' }}>Amount</th>
    </tr>
  </thead>
  <tbody>
    {payments &&
      [
        { label: 'Tuition Fee', value: getFirstPositiveNumber(payments?.Calculated_Tuition_Fee, payments?.Tuition_Fee, feeStructure?.Calculated_Tuition_Fee, feeStructure?.Tuition_Fee, tuitionFee) },
        { label: 'Admission Fee', value: getFirstPositiveNumber(payments?.admissionFee, payments?.Admission_fees, feeStructure?.admissionFee, feeStructure?.Admission_fees, admissionFee) },
        { label: 'Residential Fee', value: getFirstPositiveNumber(payments?.residentialFee, payments?.ResidentialCompleteFee, feeStructure?.residentialFee, feeStructure?.ResidentialCompleteFee, residentialFee) },
        { label: 'Exam Fee', value: getFirstPositiveNumber(payments?.examFee, payments?.Exam_fees, feeStructure?.examFee, feeStructure?.Exam_fees, examFee) },
        { label: 'Book Fee', value: getFirstPositiveNumber(payments?.bookFee, payments?.Book_Fees, feeStructure?.bookFee, feeStructure?.Book_Fees, bookFee) },
        { label: 'Bus Fee', value: getFirstPositiveNumber(payments?.busFee, payments?.Bus_fees, feeStructure?.busFee, feeStructure?.Bus_fees, busFee) },
        { label: 'Uniform Fee', value: getFirstPositiveNumber(payments?.uniformFee, payments?.Uniform_fees, feeStructure?.uniformFee, feeStructure?.Uniform_fees, uniformFee) },
        { label: `Other Fees${otherDescription ? ` - ${otherDescription}` : ""}`, value: getFirstPositiveNumber(payments?.othersFee, payments?.Others, feeStructure?.othersFee, feeStructure?.Others, othersFee) },
        ...dynamicReceiptRows.map((row) => ({ label: row.label, value: row.total }))
      ]
      .filter(fee => fee.value > 0) // Only show non-zero fees
      .map((fee, idx) => (
        <tr key={idx}>
          <td style={{ textAlign: 'left', fontSize: '10px', padding: '2px 0' }}>{fee.label}</td>
          <td style={{ textAlign: 'right', fontSize: '10px', padding: '2px 0' }}>{fee.value}</td>
        </tr>
      ))}
  </tbody>
</table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                          <th style={{ border: '1px solid black', padding: '3px', textAlign: 'left' }}>S.NO</th>
                          <th style={{ border: '1px solid black', padding: '3px', textAlign: 'left' }}>Fee Details</th>
                          <th style={{ border: '1px solid black', padding: '3px', textAlign: 'right' }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeRows.map((item, index) => (
                          <tr key={index}>
                            <td style={{ border: '1px solid black', padding: '3px', textAlign: 'left' }}>
                              {index + 1}
                            </td>
                          <td style={{ border: '1px solid black', padding: '3px', textAlign: 'left' }}>
                              {item.label}
                              {item.description ? (
                                <div style={{ fontSize: '9px', marginTop: '2px' }}>{item.description}</div>
                              ) : null}
                            </td>
                            <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right', color: 'green' }}>
                              ₹{(item.data?.paidThisTransaction || 0).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p style={{ fontStyle: 'italic', marginTop: '3px', fontSize: '10px' }}>
                      <strong>Paid Amount (in words):</strong> {convertAmountToWords(currentPaidAmount)}
                    </p>
<div style={{ display: 'flex', justifyContent: 'flex-end', fontWeight: 'bold',  padding: '5px 10px' }}>
  <div style={{ display: 'flex', gap: '20px' }}>
    <div>Total Paid: ₹{overallTotalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    <div>Total Due: ₹{remainingAmount1().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
  </div>
</div>
                    <div style={{ marginTop: '10px', fontSize: '11px' }}>
                      <p>
                        <strong>Payment Mode:</strong> {paymentMode || 'Cash/Cheque/Online'}
                      </p>
                      {(paymentMode === 'Cheque' || paymentMode === 'Online') && (
                        <>
                          <p>
                            <strong>Cheque/Transaction No.:</strong> {transactionId || 'N/A'}
                          </p>
                          <p>
                            <strong>Bank Name:</strong> {'----' || 'N/A'}
                          </p>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                      <div style={{ borderTop: '1px dashed #000', width: '120px', textAlign: 'center', paddingTop: '5px', fontSize: '10px' }}>Parent's Signature</div>
                      <div style={{ textAlign: 'center', width: '120px' }}>
                        <div style={{ fontSize: '10px', marginBottom: '2px' }}>{authorisedName}</div>
                        <div style={{ borderTop: '1px dashed #000', paddingTop: '5px', fontSize: '10px' }}>Authorised Signature</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '8px', textAlign: 'center' }}>
                      <p>This is a computer generated receipt. No signature required.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {showPrintDialog && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', textAlign: 'center', width: '300px' }}>
              <p style={{ marginBottom: '15px', fontWeight: '600' }}>Select number of copies to print:</p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button onClick={() => confirmPrint(1)} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#10b981', color: 'white', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontWeight: '500' }}>1 Copy</button>
              </div>
              <button onClick={() => setShowPrintDialog(false)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Cancel</button>
            </div>
          </div>
        )}
        {showSuccessModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', textAlign: 'center' }}>
              <p>{successMessage}</p>
              <button onClick={() => setShowSuccessModal(false)} style={{ marginTop: '15px', padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaidAmountdemo;
