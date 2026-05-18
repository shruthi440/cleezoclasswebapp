import { ArrowLeft, Download, Share, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";

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

const normalizeClassSelectionValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(Nursery|LKG|UKG)$/i.test(raw)) {
    return raw.toUpperCase() === "NURSERY" ? "Nursery" : raw.toUpperCase();
  }
  if (/^Class\s+/i.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `Class ${raw}`;
  return raw;
};

const ToastNotification = ({ message, type, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
  const textColor = 'white';
  const borderColor = type === 'success' ? '#388E3C' : '#D32F2F';

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: backgroundColor,
      color: textColor,
      padding: '15px 25px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${borderColor}`,
      fontSize: '16px',
      fontWeight: 'bold',
      transition: 'opacity 0.3s ease-in-out',
      opacity: visible ? 1 : 0,
      minWidth: '250px',
      textAlign: 'center'
    }}>
      {message}
    </div>
  );
};

const IncomeForm5 = ({ selectedClassSection, embeddedInPopup = false, onFeeStructurePreviewChange }) => {
  const popupLayout = embeddedInPopup;
  const [fees, setFees] = useState({
    tuition: 0,
    exam: 0,
    bus: 0,
    uniform: 0,
    books: 0,
    admission: 0,
    other: 0,
    previousfeedue: 0,
    residential: 0,

  });
  const [students, setStudents] = useState([]);
  const [studentDiscount, setStudentDiscount] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [incomeType, setIncomeType] = useState('fees');
  const [showBusFeePopup, setShowBusFeePopup] = useState(false);
  const [busFeeStudents, setBusFeeStudents] = useState([]);
  const [showIndividualStudentPopup, setShowIndividualStudentPopup] = useState(false);
  const [selectedBusStudent, setSelectedBusStudent] = useState(null);
  const [busFeeAmount, setBusFeeAmount] = useState('');
  const [busFeeFrequency, setBusFeeFrequency] = useState('monthly');
  const [oldBusFee, setOldBusFee] = useState(null);
  const [oldFrequencyType, setOldFrequencyType] = useState('');
  const [loginId, setLoginId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feeEntries, setFeeEntries] = useState([
    { type: '', amount: '' }
  ]);
  const [dynamicFeeTypes, setDynamicFeeTypes] = useState([]);
  const [dynamicFeeValues, setDynamicFeeValues] = useState({});
const allFeeTypes = [
  { value: 'admission', label: 'Admission Fee' },
  { value: 'tuition', label: 'Tuition Fee' },
  { value: 'exam', label: 'Exam Fee' },
  { value: 'bus', label: 'Bus Fee' },
  { value: 'residential', label: 'Residential Fee' },
  { value: 'uniform', label: 'Uniform Fee' },
  { value: 'books', label: 'Books Fee' },
  { value: 'other', label: 'Other Fees' },
  { value: 'previousfeedue', label: 'Previous Fee Due' },
];


  const handleBusFeeSelect = async () => {
    if (!className || !section) {
      displayToast('Please select both class and section', "error");
      return;
    }
    try {
      const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
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
  admission: "",
  tuition: "",
  exam: "",
  uniform: "",
  books: "",
  other: "",
  previousfeedue: "",
  residential: "",
});


  useEffect(() => {
    const fetchOldBusFee = async () => {
      try {
        const schoolCode = localStorage.getItem('schoolCode');
        const response = await axios.post('https://cleezoclass.com:4000/get-bus-fee', {
          studentName: selectedBusStudent?.name,
          className: className.replace("Class ", ""),
          sectionName: section,
          schoolCode: schoolCode,
        });
        if (response.data.FeesDetails) {
          setOldBusFee(response.data.FeesDetails.Bus_fees);
          setOldFrequencyType(response.data.FeesDetails.frequency_type);
          setLoginId(response.data.login_id);
        }
      } catch (error) {
        console.error('Error fetching old bus fee:', error);
      }
    };
    if (showIndividualStudentPopup) {
      fetchOldBusFee();
    }
  }, [showIndividualStudentPopup]);

  const handleEdit = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || 0);
  };

  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');

  useEffect(() => {
    const incomingClass = normalizeClassSelectionValue(selectedClassSection?.class || '');
    const incomingSection = selectedClassSection?.section || '';

    // Only prefill from parent when a real class/section is supplied.
    // Otherwise parent rerenders would keep wiping out manual dropdown selection.
    if (incomingClass) {
      setClassName(incomingClass);
    }
    if (incomingSection) {
      setSection(incomingSection);
    }
  }, [selectedClassSection]);

  useEffect(() => {
    const fetchDynamicFeeTypes = async () => {
      try {
        const schoolCode = localStorage.getItem('schoolCode');
        if (!schoolCode) return;

        const response = await axios.get('https://cleezoclass.com:4000/api/fee-types', {
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
              feesType: item?.feesType || 'Custom Fee',
              scope: item?.scope || 'All',
              frequency: item?.frequency || 'One time',
              installments: item?.installments || 1,
              columnBase,
            };
          })
          .filter(Boolean);

        setDynamicFeeTypes(normalized);
        setDynamicFeeValues((prev) => {
          const next = { ...prev };
          normalized.forEach((fee) => {
            if (!(fee.columnBase in next)) next[fee.columnBase] = 0;
          });
          Object.keys(next).forEach((key) => {
            if (!normalized.some((fee) => fee.columnBase === key)) delete next[key];
          });
          return next;
        });
      } catch (error) {
        console.error('Failed to fetch dynamic fee types:', error);
      }
    };

    fetchDynamicFeeTypes();
  }, []);

  const [feeStructure, setFeeStructure] = useState({});

  useEffect(() => {
    if (selectedStudentId) {
      const selected = students.find(s => s.id === selectedStudentId);
      if (selected) {
        setStudentData({
          name: selected.name,
          fatherName: selected.fatherName || 'Not Available',
          class: selected.class,
          section: selected.section || 'A',
          rollNumber: selected.id.toString(),
          billType: 'full-package'
        });

        const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
        axios.get(`https://cleezoclass.com:4000/api/paymentHistory/${selectedStudentId}?schoolCode=${schoolCode}`)
          .then(res => {
            const paymentData = res.data.payments || {};
            const tuitionFee = parseFloat(paymentData.completeFee || 0) -
              (parseFloat(paymentData.examFee || 0) +
                parseFloat(paymentData.busFee || 0) +
                parseFloat(paymentData.bookFee || 0) +
                parseFloat(paymentData.uniformFee || 0) +
                parseFloat(paymentData.othersFee || 0) +
                parseFloat(paymentData.admissionFee || 0));

            const paid = parseFloat(paymentData.paidAmount || 0);
            const completeFee = parseFloat(paymentData.completeFee || 0);
            const residentialFee = parseFloat(paymentData.residentialFee || 0);
            const totalAmountWithResidential = completeFee + residentialFee;

            setPaidAmount(paid);
            setTotalAmount(totalAmountWithResidential);
            setRemainingAmount(totalAmountWithResidential - paid);
            setTuitionFee(tuitionFee);
          })
          .catch(err => console.error("Error fetching payment history:", err));
      }
    }
  }, [selectedStudentId, students]);

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
        const dynamicFeeSnapshot = dynamicFeeTypes.reduce((acc, fee) => {
          const value = backendData?.[fee.columnBase];
          if (value !== undefined && value !== null && value !== "") {
            const numericValue = parseFloat(value);
            if (!Number.isNaN(numericValue)) {
              acc[fee.columnBase] = numericValue;
            }
          }
          return acc;
        }, {});
        console.log('[feeStructure] Dynamic fee snapshot from backend:', dynamicFeeSnapshot);

        const fetchedFees = {
          admission: parseFloat(backendData.Admission_Fee) || 0,
          books: parseFloat(backendData.Book_Fee) || 0,
          uniform: parseFloat(backendData.Uniform_Fee) || 0,
          exam: parseFloat(backendData.Exam_Fee) || 0,
          other: parseFloat(backendData.Other_Fee) || 0,
          bus: parseFloat(backendData.Bus_Fee) || 0,
          residential: parseFloat(backendData.ResidentialCompleteFee) || 0,
          tuition: parseFloat(
            backendData.Calculated_Tuition_Fee ?? backendData.Tuition_Fee ?? 0
          ) || 0,
                previousfeedue: parseFloat(backendData.Previous_Fee_Due) || 0, // Include this line

        };

        setDefaultFees(fetchedFees);
        setFees(fetchedFees);
        setDynamicFeeValues((prev) => ({
          ...prev,
          ...dynamicFeeSnapshot,
        }));
        setFeeStructure({
          ...fetchedFees,
          ...dynamicFeeSnapshot,
          complete_fee: parseFloat(backendData.CompleteFee) || 0
        });
        if (onFeeStructurePreviewChange) {
          const staticFeeRows = [
            { id: "tuition", feeName: "Tuition Fee", feesType: "Tuition Fee", installments: 1, amount: fetchedFees.tuition || 0 },
            { id: "admission", feeName: "Admission Fee", feesType: "Admission Fee", installments: 1, amount: fetchedFees.admission || 0 },
            { id: "exam", feeName: "Exam Fee", feesType: "Exam Fee", installments: 1, amount: fetchedFees.exam || 0 },
            { id: "bus", feeName: "Bus Fee", feesType: "Bus Fee", installments: 1, amount: fetchedFees.bus || 0 },
            { id: "uniform", feeName: "Uniform Fee", feesType: "Uniform Fee", installments: 1, amount: fetchedFees.uniform || 0 },
            { id: "books", feeName: "Books Fee", feesType: "Books Fee", installments: 1, amount: fetchedFees.books || 0 },
            { id: "other", feeName: "Other Fees", feesType: "Other Fee", installments: 1, amount: fetchedFees.other || 0 },
            { id: "previousfeedue", feeName: "Previous Fee Due", feesType: "Previous Fee Due", installments: 1, amount: fetchedFees.previousfeedue || 0 },
            { id: "residential", feeName: "Residential Fee", feesType: "Residential Fee", installments: 1, amount: fetchedFees.residential || 0 },
          ].filter((fee) => fee.amount > 0);

          const dynamicPreviewRows = dynamicFeeTypes
            .map((fee) => ({
              id: fee.id || fee.columnBase,
              feeName: fee.feeName,
              feesType: fee.feesType || "Custom Fee",
              installments: fee.installments || 1,
              amount: parseFloat(dynamicFeeSnapshot[fee.columnBase]) || 0,
            }))
            .filter((fee) => fee.amount > 0);

          onFeeStructurePreviewChange({
            className,
            section,
            rows: [...staticFeeRows, ...dynamicPreviewRows].map((fee) => ({
              ...fee,
              className,
              section,
            })),
          });
        }
        console.log('[feeStructure] Tuition used in form:', fetchedFees.tuition);

      } catch (error) {
        console.error("Failed to fetch fee structure:", error);
        displayToast("Failed to load fee structure.", "error");
      }
    };

    fetchFeeStructure();
  }, [className, section, dynamicFeeTypes]);

  useEffect(() => {
    if (!className || !section) {
      setStudents([]);
      setLoadStudentsValue(false);
      setShowIcon(false);
    }
  }, [className, section]);



  const [modalEntries, setModalEntries] = useState([]);
const [showIndividualPreviousFeeDuePopup, setShowIndividualPreviousFeeDuePopup] = useState(false);

const [showPreviousFeeDuePopup, setShowPreviousFeeDuePopup] = useState(false);
const [previousFeeDueStudents, setPreviousFeeDueStudents] = useState([]);
const [selectedPreviousFeeDueStudent, setSelectedPreviousFeeDueStudent] = useState(null);
const [previousFeeDueAmount, setPreviousFeeDueAmount] = useState('');
const [oldPreviousFeeDue, setOldPreviousFeeDue] = useState(null);
const [showResidentialFeePopup, setShowResidentialFeePopup] = useState(false);
const [residentialFeeStudents, setResidentialFeeStudents] = useState([]);
const [selectedResidentialStudent, setSelectedResidentialStudent] = useState(null);
const [residentialFeeAmount, setResidentialFeeAmount] = useState('');
const [oldResidentialFee, setOldResidentialFee] = useState(null);
const [showIndividualResidentialFeePopup, setShowIndividualResidentialFeePopup] = useState(false);
const handlePreviousFeeDueSelect = async () => {
  if (!className || !section) {
    displayToast('Please select both class and section', "error");
    return;
  }
  try {
    const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
    const apiClassName = className.replace("Class ", "");
    const response = await axios.get(`https://cleezoclass.com:4000/get-students?className=${apiClassName}&section=${section}&schoolCode=${schoolCode}`);
    if (response.data.success && response.data.students) {
      setPreviousFeeDueStudents(response.data.students);
      setShowPreviousFeeDuePopup(true);
    } else {
      displayToast('No students found for the selected class and section', "error");
    }
  } catch (error) {
    console.error('Error loading students:', error);
    displayToast('Error loading students', "error");
  }
};
const handleResidentialFeeSelect = async () => {
  if (!className || !section) {
    displayToast('Please select both class and section', "error");
    return;
  }
  try {
    const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
    const apiClassName = className.replace("Class ", "");
    const response = await axios.get(`https://cleezoclass.com:4000/get-students?className=${apiClassName}&section=${section}&schoolCode=${schoolCode}`);
    if (response.data.success && response.data.students) {
      setResidentialFeeStudents(response.data.students);
      setShowResidentialFeePopup(true);
    } else {
      displayToast('No students found for the selected class and section', "error");
    }
  } catch (error) {
    console.error('Error loading students:', error);
    displayToast('Error loading students', "error");
  }
};
useEffect(() => {
  const fetchOldPreviousFeeDue = async () => {
    try {
      const schoolCode = localStorage.getItem('schoolCode');
      const response = await axios.post('https://cleezoclass.com:4000/get-previous-feedue', {
        studentName: selectedPreviousFeeDueStudent?.name,
        className: className.replace("Class ", ""),
        sectionName: section,
        schoolCode: schoolCode,
      });
      if (response.data.FeesDetails) {
        setOldPreviousFeeDue(response.data.FeesDetails.Previous_Fee_Due);
        setLoginId(response.data.login_id);
      }
    } catch (error) {
      console.error('Error fetching old previous fee due:', error);
    }
  };
  if (showIndividualPreviousFeeDuePopup) {
    fetchOldPreviousFeeDue();
  }
}, [showIndividualPreviousFeeDuePopup]);
useEffect(() => {
  const fetchOldResidentialFee = async () => {
    try {
      const schoolCode = localStorage.getItem('schoolCode');
      const response = await axios.post('https://cleezoclass.com:4000/get-residential-fee', {
        studentName: selectedResidentialStudent?.name,
        className: className.replace("Class ", ""),
        sectionName: section,
        schoolCode: schoolCode,
      });
      if (response.data) {
        setOldResidentialFee(response.data.ResidentialCompleteFee);
        setLoginId(response.data.login_id);
      }
    } catch (error) {
      console.error('Error fetching old residential fee:', error);
    }
  };
  if (showIndividualResidentialFeePopup) {
    fetchOldResidentialFee();
  }
}, [showIndividualResidentialFeePopup]);

  const dashboardRef = useRef(null);
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [modalFeeEntries, setModalFeeEntries] = useState([{ feeType: '', reason: '', discount: '' }]);
  const [dynamicLogoSrc, setDynamicLogoSrc] = useState('');
  const [dynamicSchoolCode, setDynamicSchoolCode] = useState('');
  const [institutionData, setInstitutionData] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [installmentOptions, setInstallmentOptions] = useState([]);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [installmentCount, setInstallmentCount] = useState();
  const [installments, setInstallments] = useState([]);
  const [tuitionFee, setTuitionFee] = useState(0);

  const handleAddInstallments = () => {
    const currentTuitionFee = parseFloat(fees.tuition) || 0;

    if (currentTuitionFee <= 0) {
      displayToast("Tuition fee must be greater than zero.", "error");
      return;
    }

    if (!installmentCount || installmentCount <= 0) {
      displayToast("Installment count must be greater than zero.", "error");
      return;
    }

    const total = currentTuitionFee;
    const rawAmount = total / installmentCount;
    // Calculate base amount to the nearest 100 for better distribution
    const baseAmount = Math.floor(rawAmount / 100) * 100; 
    const remainder = total - (baseAmount * installmentCount);

    const newInstallments = Array.from({ length: installmentCount }, (_, index) => {
      // Add the remainder to the first installment for clean total
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

  const [loadStudentsValue, setLoadStudentsValue] = useState(false);
  const [showDiscountBillModal, setShowDiscountBillModal] = useState(false);
  const [schoolCode, setSchoolCode] = useState('');

  useEffect(() => {
    const code = localStorage.getItem('schoolCode');
    if (code) {
      setSchoolCode(code);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (schoolCode) {
        try {
          const response = await axios.get('https://cleezoclass.com:4000/api/discounted-students', {
            params: {
              className,
              section,
              schoolCode
            }
          });
          setStudents(response.data);
        } catch (error) {
          console.error('Error fetching data: ', error);
        }
      }
    };

    fetchData();
  }, [className, section, schoolCode]);



  const [studentData, setStudentData] = useState(null);

  const handleDateChange = (index, newDate) => {
    const updatedInstallments = [...installments];
    updatedInstallments[index].date = newDate;
    setInstallments(updatedInstallments);
  };


  const handleAmountChange = (index, newAmount) => {
    const updatedInstallments = [...installments];
    updatedInstallments[index].amount = parseFloat(newAmount) || 0;
    setInstallments(updatedInstallments);
  };

  const openDiscountModal = () => {
    setShowDiscountBillModal(true);
  };



  const [showIcon, setShowIcon] = useState(false);

  const handleLoadStudents = () => {
    setLoadStudentsValue(true);
    setStudents([]);
    loadStudents();
    setShowIcon(true);
  };

  const selectedClassSectionFeeRows = dynamicFeeTypes
    .map((fee) => ({
      id: fee.id || fee.columnBase,
      feeName: fee.feeName,
      feesType: fee.feesType || "Custom Fee",
      scope: fee.scope || "All",
      frequency: fee.frequency || "One time",
      installments: fee.installments || 1,
      amount: parseFloat(dynamicFeeValues[fee.columnBase]) || 0,
    }))
    .filter((fee) => fee.amount > 0);

  useEffect(() => {
    if (!onFeeStructurePreviewChange) return;

    const staticFeeRows = [
      { id: "tuition", feeName: "Tuition Fee", feesType: "Tuition Fee", installments: 1, amount: parseFloat(fees.tuition) || 0 },
      { id: "admission", feeName: "Admission Fee", feesType: "Admission Fee", installments: 1, amount: parseFloat(fees.admission) || 0 },
      { id: "exam", feeName: "Exam Fee", feesType: "Exam Fee", installments: 1, amount: parseFloat(fees.exam) || 0 },
      { id: "bus", feeName: "Bus Fee", feesType: "Bus Fee", installments: 1, amount: parseFloat(fees.bus) || 0 },
      { id: "uniform", feeName: "Uniform Fee", feesType: "Uniform Fee", installments: 1, amount: parseFloat(fees.uniform) || 0 },
      { id: "books", feeName: "Books Fee", feesType: "Books Fee", installments: 1, amount: parseFloat(fees.books) || 0 },
      { id: "other", feeName: "Other Fees", feesType: "Other Fee", installments: 1, amount: parseFloat(fees.other) || 0 },
      { id: "previousfeedue", feeName: "Previous Fee Due", feesType: "Previous Fee Due", installments: 1, amount: parseFloat(fees.previousfeedue) || 0 },
      { id: "residential", feeName: "Residential Fee", feesType: "Residential Fee", installments: 1, amount: parseFloat(fees.residential) || 0 },
    ].filter((fee) => fee.amount > 0);

    onFeeStructurePreviewChange({
      className,
      section,
      rows: [...staticFeeRows, ...selectedClassSectionFeeRows].map((fee) => ({
        ...fee,
        className,
        section,
      })),
    });
  }, [className, section, fees, selectedClassSectionFeeRows, onFeeStructurePreviewChange]);

  const handleViewDiscount = async () => {
    if (!className || !section) {
      displayToast('Please select both class and section', "error");
      return;
    }

    setStudents([]);
    await loadStudents('discount');
    openDiscountModal();
  };

  const loadStudents = async (mode = 'normal') => {
    if (!className || !section) {
      displayToast('Please select both class and section', "error");
      return;
    }
    const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
    const apiClassName = className.replace("Class ", "");

    try {
      let responseData;
      if (mode === 'discount') {
        const response = await axios.get('https://cleezoclass.com:4000/api/discounted-students', {
          params: { className: apiClassName, section: section, schoolCode }
        });
        responseData = response.data;
        setStudents(responseData);
      } else {
        const response = await fetch(`https://cleezoclass.com:4000/get-students?className=${apiClassName}&section=${section}&schoolCode=${schoolCode}`);
        if (!response.ok) throw new Error('Failed to fetch students');
        responseData = await response.json();
        if (responseData.success && responseData.students?.length > 0) {
          setStudents(responseData.students);
        } else {
          setStudents([]);
          displayToast('No students found for the selected class and section', "error");
        }
      }
    } catch (error) {
      console.error('Error loading students:', error);
      displayToast('Error loading students', "error");
      setStudents([]);
    }
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
        UpdatedCompleteFee: fees.tuition, // Use the current tuition fee from state
      };

      if(installments.length === 0) {
        displayToast(' Please generate installments first.', 'error');
        return;
      }

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
      setInstallments([]); // Clear installments after saving
    } catch (error) {
      console.error('Error saving class installments:', error);
      displayToast(error.message || 'Error saving class installments. Please try again.', 'error');
    }
  };

const handleSubmit = async (event) => {
  event.preventDefault();
  console.log('[SUBMIT] Form submission started');

  const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
  console.log('[SUBMIT] School Code:', schoolCode);

  if (!incomeType) {
    console.warn('[VALIDATION] Income type not selected');
    displayToast("❗ Please select an income type.", "error");
    return;
  }

  let incomeData = {
    income_type: incomeType,
    schoolCode: schoolCode,
  };

  console.log('[SUBMIT] Initial incomeData:', incomeData);

  if (incomeType === 'fees') {
    console.log('[FEES] Selected Class:', className, 'Section:', section);

    if (!className || !section) {
      console.warn('[VALIDATION] Class or Section missing');
      displayToast("❗ Please select Class and Section for fees income.", "error");
      return;
    }

    const calculatedFees = {};
    let totalAmount = 0;

  console.log('[FEES] Raw fee input:', fees);
  console.log('[FEES] Dynamic fee types:', dynamicFeeTypes.map((fee) => ({
    feeName: fee.feeName,
    columnBase: fee.columnBase,
  })));
  console.log('[FEES] Dynamic fee values snapshot:', dynamicFeeValues);

    Object.keys(fees).forEach(key => {
      const amount = parseFloat(fees[key]) || 0;
      calculatedFees[key] = Math.max(0, amount);
      totalAmount += calculatedFees[key];
    });

    const calculatedDynamicFees = {};
    dynamicFeeTypes.forEach((fee) => {
      const amount = Math.max(0, parseFloat(dynamicFeeValues[fee.columnBase]) || 0);
      calculatedDynamicFees[fee.columnBase] = amount;
      totalAmount += amount;
    });

    console.log('[FEES] Calculated Fees:', calculatedFees);
    console.log('[FEES] Calculated Dynamic Fees:', calculatedDynamicFees);
    console.log('[FEES] Total Fee Amount:', totalAmount);

    if (totalAmount === 0) {
      console.warn('[VALIDATION] Total fee is zero');
      displayToast(
        "❗ Total fee amount cannot be zero. Please enter amounts in the Fee Summary box.",
        "error"
      );
      return;
    }

    incomeData = {
      ...incomeData,
      class_name: className,
      class_section: section,
      ...calculatedFees,
      ...calculatedDynamicFees,
      feeEntries: Object.keys(calculatedFees).map(key => ({
        type: key,
        amount: calculatedFees[key],
      })).concat(
        dynamicFeeTypes.map((fee) => ({
          type: fee.columnBase,
          amount: calculatedDynamicFees[fee.columnBase] || 0,
        }))
      ),
    };

    console.log('[FEES] Final incomeData:', incomeData);
    console.log('[FEES] feeEntries payload:', incomeData.feeEntries);
  }

  else if (incomeType === 'installments') {
    // This part is redundant as installments are now handled by a separate button/section
    displayToast("❗ Please use the 'Save Installments for Class' button in the installment panel.", "error");
    return;
  }

  try {
    console.log('[API] Sending PUT request to /income');
    console.log('[API] Payload:', incomeData);

    const response = await axios.put(
      'https://cleezoclass.com:4000/income',
      incomeData
    );

    console.log('[API] Response:', response.data);

    let successMessage = `✅ Income data added successfully for school: ${schoolCode}!`;
    if (incomeType === 'fees') {
      successMessage = `✅ Fees submitted successfully for Class ${className} Section ${section}!`;
    }

    displayToast(successMessage, "success");

    console.log('[RESET] Clearing form state');

    setClassName('');
    setSection('');
setFees({
  tuition: 0,
  exam: 0,
  bus: 0,
  residential: 0,
  uniform: 0,
  books: 0,
  other: 0,
  admission: 0,
  previousfeedue: 0,
});
    setDynamicFeeValues(
      dynamicFeeTypes.reduce((acc, fee) => {
        acc[fee.columnBase] = 0;
        return acc;
      }, {})
    );

    setIncomeType('fees');
    setInstallments([]); // Reset installments on successful fee submission

  } catch (error) {
    console.error('[API ERROR] Submission failed:', error);
    console.error('[API ERROR] Server response:', error.response?.data);

    displayToast(
      `❌ Error submitting income data: ${
        error.response?.data?.message || error.message
      }`,
      "error"
    );
  }
};

  const generatePDFBlob = async () => {
    const element = dashboardRef.current;
    if (!element) return null;

    if (typeof window.html2canvas === 'undefined') {
      console.error('html2canvas is not defined.');
      displayToast('html2canvas library is not loaded. Please ensure the CDN script is included.', 'error');
      return null;
    }
    const canvas = await window.html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    if (typeof window.jsxpdf === 'undefined' || typeof window.jsxpdf.jsxPDF === 'undefined') {
      console.error('jsPDF is not defined.');
      displayToast('jsPDF library is not loaded. Please ensure the CDN script is included.', 'error');
      return null;
    }
    const { jsPDF } = window.jsxpdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    return pdf.output('blob');
  };






  useEffect(() => {
    const fetchSchoolLogo = async () => {
      const code = localStorage.getItem('schoolCode');
      if (!code) {
        console.warn('No school code found in localStorage. Aborting fetch.');
        return;
      }
      setDynamicSchoolCode(code);
      try {
        const response = await axios.post(
          'https://cleezoclass.com:4000/api/schoollogodynamic',
          { secretecode: code },
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (response.data.logoPath) {
          setDynamicLogoSrc(response.data.logoPath);
        } else {
          console.warn('No logo path found in backend response.');
        }
      } catch (error) {
        console.error('Error fetching school logo:', error.response?.data || error.message);
      }
    };

    const data = localStorage.getItem('institutionData');
    if (data) {
      setInstitutionData(JSON.parse(data));
    }
    fetchSchoolLogo();
  }, []);

  useEffect(() => {
    if (!selectedStudent || !showModal) return;

    const fetchStudentDiscount = async () => {
      try {
        const schoolCode = localStorage.getItem("schoolCode") || "TAGSOLNOVALLP";
        const apiClassName = className.replace("Class ", "");
        const response = await fetch(
          `https://cleezoclass.com:4000/get-student-discount?studentName=${encodeURIComponent(selectedStudent.name)}&className=${apiClassName}&sectionName=${section}&schoolCode=${schoolCode}`
        );
        const data = await response.json();

        if (data.success && data.discounts) {
          setStudentDiscount(data.discounts);
        } else {
          setStudentDiscount(null);
        }
      } catch (err) {
        console.error("Failed to fetch student discount", err);
        setStudentDiscount(null);
      }
    };

    fetchStudentDiscount();
  }, [selectedStudent, showModal, className, section]);

  const displayToast = (message, type) => {
    setToast({ show: true, message, type });
  };


  const formatINR = (value) => {
    if (value === 0 || value === "") return "";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };





  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '10px',
    color: '#333',
    fontWeight: '500',
  };

const [showAdmissionFeePopup, setShowAdmissionFeePopup] = useState(false);
const [admissionFeeStudents, setAdmissionFeeStudents] = useState([]);
const [selectedAdmissionStudent, setSelectedAdmissionStudent] = useState(null);
const [admissionFeeAmount, setAdmissionFeeAmount] = useState('');
const [oldAdmissionFee, setOldAdmissionFee] = useState(null);
const handleAdmissionFeeSelect = async () => {
  if (!className || !section) {
    displayToast('Please select both class and section', "error");
    return;
  }
  try {
    const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
    const apiClassName = className.replace("Class ", "");
    const response = await axios.get(`https://cleezoclass.com:4000/get-students?className=${apiClassName}&section=${section}&schoolCode=${schoolCode}`);
    if (response.data.success && response.data.students) {
      setAdmissionFeeStudents(response.data.students);
      setShowAdmissionFeePopup(true);
    } else {
      displayToast('No students found for the selected class and section', "error");
    }
  } catch (error) {
    console.error('Error loading students:', error);
    displayToast('Error loading students', "error");
  }
};

  const [showIndividualAdmissionFeePopup, setShowIndividualAdmissionFeePopup] = useState(false);
useEffect(() => {
  const fetchOldAdmissionFee = async () => {
    try {
      const schoolCode = localStorage.getItem('schoolCode');
      const response = await axios.post('https://cleezoclass.com:4000/pay-admission-fee', {
        studentName: selectedAdmissionStudent?.name,
        className: className.replace("Class ", ""),
        sectionName: section,
        schoolCode: schoolCode,
      });
      if (response.data.FeesDetails) {
        setOldAdmissionFee(response.data.FeesDetails.Admission_Fee);
        setLoginId(response.data.login_id);
      }
    } catch (error) {
      console.error('Error fetching old admission fee:', error);
    }
  };
  if (showIndividualAdmissionFeePopup) {
    fetchOldAdmissionFee();
  }
}, [showIndividualAdmissionFeePopup]);

useEffect(() => {
  // Run only when class or section changes
  if (className && section) {
    setShowInstallmentModal(false); // close popup
    setInstallments([]);            // clear old installments
    setInstallmentCount(0);          // reset count
  }
}, [className, section]);

 return (
  <>
    {toast.show && (
      <ToastNotification
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ show: false, message: '', type: '' })}
      />
    )}

    <div
      ref={dashboardRef}
      className={`FeesManagement-dashboardContainer${popupLayout ? " FeesManagement-popupMode" : ""}`}
    >
      <div className="FeesManagement-formContainer">
        <form onSubmit={handleSubmit}>
          {incomeType === 'fees' && (
            <div className="FeesManagement-innerPadding">
              <div className="FeesManagement-leftRightFlex">
                {/* LEFT BLOCK */}
                <div className="FeesManagement-leftBlock">
                  <h2 className="footprintsinner">Add Fee per class</h2>
                </div>

                {/* RIGHT BLOCK - Class & Section */}
                <div className="FeesManagement-rightBlock">
                  <div className={`FeesManagement-dropdown${popupLayout ? " FeesManagement-dropdown-static" : ""}`}>
                    <div>
                      <label className="footprintsinner">Class</label>
                      <div className="expense-input-field">
                        <select
                          value={className}
                          onChange={(e) => {
                            setClassName(e.target.value);
                            setSection("");
                          }}
                          className="btn-dropdown-FeesManagement"
                        >
                          <option value="">Select Class</option>
                          <option value="Nursery">Nursery</option>
                          <option value="LKG">LKG</option>
                          <option value="UKG">UKG</option>
                          {[...Array(10)].map((_, i) => (
                            <option key={i + 1} value={`Class ${i + 1}`}>
                              Class {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="footprintsinner">Section</label>
                      <div className="expense-input-field">
                        <select
                          value={section}
                          onChange={(e) => setSection(e.target.value)}
                          disabled={!className}
                          className="btn-dropdown-FeesManagement"
                        >
                          <option value="">Select Section</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="Brainy Badgers">Brainy Badgers</option>
                          <option value="Wondering Minds">Wondering Minds</option>
                          <option value="CBSE">CBSE</option>
                          <option value="Aakash">Aakash</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FEE STRUCTURE SECTION */}
       <div className="FeesManagement-sectionContainer">
  <h3 className="FeesManagement-sectionHeader footprintsinner">
    Created Fee Types
  </h3>

{dynamicFeeTypes.map((fee) => (
  <div key={fee.columnBase} className="FeesManagement-feeRow">
    <label className="FeesManagement-feeLabel">
      {fee.feeName}:
    </label>
    <div className="FeesManagement-labelInputFlex" style={{ flex: 1 }}>
      <span style={{ marginRight: "5px", color: "#555" }}>₹</span>
      <div className="expense-input-field">
        <input
          type="text"
          className="btn-dropdown-FeesManagement FeesManagement"
          value={
            editingField === fee.columnBase
              ? (dynamicFeeValues[fee.columnBase] === 0 ? "" : String(dynamicFeeValues[fee.columnBase]))
              : (dynamicFeeValues[fee.columnBase] === 0 ? "" : formatINR(dynamicFeeValues[fee.columnBase]))
          }
          onFocus={() => setEditingField(fee.columnBase)}
          onBlur={() => setEditingField(null)}
          onChange={(e) => {
            const rawValue = e.target.value;
            if (rawValue === "") {
              setDynamicFeeValues((prev) => ({ ...prev, [fee.columnBase]: 0 }));
              return;
            }
            if (/^\d*\.?\d*$/.test(rawValue)) {
              const numericValue = parseFloat(rawValue);
              if (!isNaN(numericValue)) {
                setDynamicFeeValues((prev) => ({ ...prev, [fee.columnBase]: numericValue }));
              }
            }
          }}
        />
      </div>
    </div>
  </div>
))}


  <div className="FeesManagement-totalRow">
    <span>Total Fees:</span>
    <span>
      ₹
      {Object.values(dynamicFeeValues)
        .reduce((a, b) => parseFloat(a) + (parseFloat(b) || 0), 0)
        .toFixed(2)}
    </span>
  </div>
</div>

              {/* BOTTOM BUTTONS */}
              <div className="FeesManagement-bottomBtns">
                {Number(fees.tuition) > 0 && (
                  <button
                    type="button"
                    className="btn-solid"
                    style={{ width: "200px", flexShrink: 0 }}
                    onClick={() => setShowInstallmentModal(!showInstallmentModal)}
                  >
                    {showInstallmentModal ? "Hide Installments" : "Add Installments"}
                  </button>
                )}

                <button
                  type="submit"
                  className="btn-solid"
                  style={{ width: "200px", flexShrink: 0 }}
                >
                  Submit Fees
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
{showPreviousFeeDuePopup && (
  <div className="FeesManagement-popupOverlay" onClick={() => setShowPreviousFeeDuePopup(false)}>
    <div className="FeesManagement-popupContent" onClick={(e) => e.stopPropagation()}>
      <button className="FeesManagement-popupCloseBtn" onClick={() => setShowPreviousFeeDuePopup(false)}>
        &times;
      </button>
      <h2 className="FeesManagement-popupTitle">
        Previous Fee Due Students - Class {className.replace("Class ", "")} Section {section}
      </h2>
      <p style={{ textAlign: "center", marginBottom: "20px", color: "#f44336", fontWeight: "bold" }}>
        Click on a student's name to set their individual Previous Fee Due.
      </p>
      <div className="FeesManagement-studentGrid">
        {previousFeeDueStudents.length > 0 ? (
          previousFeeDueStudents.map((student, index) => (
            <div
              key={index}
              onClick={() => {
                setSelectedPreviousFeeDueStudent(student);
                setShowIndividualPreviousFeeDuePopup(true);
              }}
              className="FeesManagement-studentCard"
            >
              <div className="FeesManagement-studentAvatar">
                {student.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {student.name}
              </span>
            </div>
          ))
        ) : (
          <p style={{ textAlign: "center", gridColumn: "1 / -1", fontSize: "14px" }}>No students found.</p>
        )}
      </div>
    </div>
  </div>
)}

{showIndividualPreviousFeeDuePopup && (
  <div className="FeesManagement-popupOverlay" onClick={() => setShowIndividualPreviousFeeDuePopup(false)}>
    <div className="FeesManagement-popupContent" style={{ width: 'min(90%, 480px)' }} onClick={(e) => e.stopPropagation()}>
      <button className="FeesManagement-popupCloseBtn" onClick={() => setShowIndividualPreviousFeeDuePopup(false)}>
        &times;
      </button>
      <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
        Previous Fee Due for {selectedPreviousFeeDueStudent?.name}
      </h3>
      <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
        <p><strong>Student ID:</strong> {loginId || 'Not set'}</p>
      </div>
      <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
        <p><strong>Previous Fee Due:</strong> {oldPreviousFeeDue || 'Not set'}</p>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Amount:</label>
        <input
          type="number"
          value={previousFeeDueAmount}
          onChange={(e) => setPreviousFeeDueAmount(e.target.value)}
          onWheel={(e) => e.target.blur()}
          className="no-spinner btn-dropdown-FeesManagement"
          placeholder="Enter Previous Fee Due Amount"
          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
        />
      </div>
      <button
        className="btn-solid"
        style={{ width: "100%" }}
        onClick={async () => {
          try {
            const schoolCode = localStorage.getItem("schoolCode") || "TAGSOLNOVALLP";
            const response = await axios.post(
              "https://cleezoclass.com:4000/pay-previous-feedue",
              {
                studentName: selectedPreviousFeeDueStudent.name,
                className: className.replace("Class ", ""),
                sectionName: section,
                schoolCode: schoolCode,
                previousFeeDue: previousFeeDueAmount,
              }
            );
            if (response.data.success) {
              displayToast(`Previous fee due for ${selectedPreviousFeeDueStudent.name} saved successfully!`, "success");
              setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
              setShowIndividualPreviousFeeDuePopup(false);
            } else {
              displayToast(`Failed to save previous fee due: ${response.data.message}`, "error");
            }
          } catch (error) {
            console.error("Error saving previous fee due:", error);
            displayToast(
              `Error saving previous fee due: ${error.response?.data?.message || error.message}`,
              "error"
            );
          }
        }}
      >
        Submit
      </button>
    </div>
  </div>
)}

{showResidentialFeePopup && (
  <div className="FeesManagement-popupOverlay" onClick={() => setShowResidentialFeePopup(false)}>
    <div className="FeesManagement-popupContent" onClick={(e) => e.stopPropagation()}>
      <button className="FeesManagement-popupCloseBtn" onClick={() => setShowResidentialFeePopup(false)}>
        &times;
      </button>
      <h2 className="FeesManagement-popupTitle">
        Residential Fee Students - Class {className.replace("Class ", "")} Section {section}
      </h2>
      <p style={{ textAlign: "center", marginBottom: "20px", color: "#f44336", fontWeight: "bold" }}>
        Click on a student's name to set their individual Residential Fee.
      </p>
      <div className="FeesManagement-studentGrid">
        {residentialFeeStudents.length > 0 ? (
          residentialFeeStudents.map((student, index) => (
            <div
              key={index}
              onClick={() => {
                setSelectedResidentialStudent(student);
                setShowIndividualResidentialFeePopup(true);
              }}
              className="FeesManagement-studentCard"
            >
              <div className="FeesManagement-studentAvatar">
                {student.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {student.name}
              </span>
            </div>
          ))
        ) : (
          <p style={{ textAlign: "center", gridColumn: "1 / -1", fontSize: "14px" }}>No students found.</p>
        )}
      </div>
    </div>
  </div>
)}

{showIndividualResidentialFeePopup && (
  <div className="FeesManagement-popupOverlay" onClick={() => setShowIndividualResidentialFeePopup(false)}>
    <div className="FeesManagement-popupContent" style={{ width: 'min(90%, 480px)' }} onClick={(e) => e.stopPropagation()}>
      <button className="FeesManagement-popupCloseBtn" onClick={() => setShowIndividualResidentialFeePopup(false)}>
        &times;
      </button>
      <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
        Residential Fee for {selectedResidentialStudent?.name}
      </h3>
      <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
        <p><strong>Student ID:</strong> {loginId || 'Not set'}</p>
      </div>
      <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
        <p><strong>Previous Residential Fee:</strong> {oldResidentialFee || 'Not set'}</p>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Amount:</label>
        <input
          type="number"
          value={residentialFeeAmount}
          onChange={(e) => setResidentialFeeAmount(e.target.value)}
          onWheel={(e) => e.target.blur()}
          className="no-spinner btn-dropdown-FeesManagement"
          placeholder="Enter Residential Fee Amount"
          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
        />
      </div>
      <button
        className="btn-solid"
        style={{ width: "100%" }}
        onClick={async () => {
          try {
            const schoolCode = localStorage.getItem("schoolCode") || "TAGSOLNOVALLP";
            const response = await axios.post(
              "https://cleezoclass.com:4000/pay-residential-fee",
              {
                studentName: selectedResidentialStudent.name,
                className: className.replace("Class ", ""),
                sectionName: section,
                schoolCode: schoolCode,
                residentialFee: residentialFeeAmount,
              }
            );
            if (response.data.success) {
              displayToast(`Residential fee for ${selectedResidentialStudent.name} saved successfully!`, "success");
              setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
              setShowIndividualResidentialFeePopup(false);
            } else {
              displayToast(`Failed to save residential fee: ${response.data.message}`, "error");
            }
          } catch (error) {
            console.error("Error saving residential fee:", error);
            displayToast(
              `Error saving residential fee: ${error.response?.data?.message || error.message}`,
              "error"
            );
          }
        }}
      >
        Submit
      </button>
    </div>
  </div>
)}

      {/* INSTALLMENT MODAL */}
      {showInstallmentModal && (
        <div className="FeesManagement-installmentModal">
          <div style={{ textAlign: "center" }}>
            <h3 className="footprintsinner FeesManagement-sectionHeader">
              Set Installments for {className} Section {section}
            </h3>

            <label className="footprintsinner">
              Number of Installments:
              <input
                type="number"
                value={installmentCount}
                onChange={(e) =>
                  setInstallmentCount(Math.min(parseInt(e.target.value) || 0, 5))
                }
                min="1"
                max="5"
                onWheel={(e) => e.target.blur()}
                className="btn-dropdown-FeesManagement FeesManagement-installmentInput"
              />
            </label>

            <p>
              <strong>Tuition Fee:</strong> ₹{Number(fees.tuition).toFixed(2)}
            </p>

            <button className="btn-solid" onClick={handleAddInstallments} style={{ marginBottom: '15px' }}>
              Generate Installments
            </button>

            {installments.length > 0 && (
              <>
                <h4 className="footprintsinner">Installment Details:</h4>
                <div className="FeesManagement-installmentsList">
                  {installments.map((inst, index) => (
                    <div key={inst.id} className="FeesManagement-installmentRow">
                      <span style={{ flex: 1 }}>Inst {inst.id}:</span>
                      <input
                        type="number"
                        value={inst.amount}
                        onChange={(e) => handleAmountChange(index, e.target.value)}
                        onWheel={(e) => e.target.blur()}
                        className="btn-dropdown-FeesManagement FeesManagement-installmentInput"
                      />
                      <input
                        type="date"
                        className="btn-dropdown-FeesManagement"
                        value={inst.date}
                        onChange={(e) => handleDateChange(index, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <button className="btn-solid" onClick={handleSaveClassInstallments} style={{ marginTop: '15px' }}>
                  Save Installments for Class
                </button>
              </>
            )}
          </div>
        </div>
      )}{showAdmissionFeePopup && (
  <div className="FeesManagement-popupOverlay" onClick={() => setShowAdmissionFeePopup(false)}>
    <div className="FeesManagement-popupContent" onClick={(e) => e.stopPropagation()}>
      <button className="FeesManagement-popupCloseBtn" onClick={() => setShowAdmissionFeePopup(false)}>
        &times;
      </button>
      <h2 className="FeesManagement-popupTitle">
        Admission Fee Students - Class {className.replace("Class ", "")} Section {section}
      </h2>
      <p style={{ textAlign: "center", marginBottom: "20px", color: "#f44336", fontWeight: "bold" }}>
        Click on a student's name to set their individual Admission Fee.
      </p>
      <div className="FeesManagement-studentGrid">
        {admissionFeeStudents.length > 0 ? (
          admissionFeeStudents.map((student, index) => (
            <div
              key={index}
              onClick={() => {
                setSelectedAdmissionStudent(student);
                setShowIndividualAdmissionFeePopup(true);
              }}
              className="FeesManagement-studentCard"
            >
              <div className="FeesManagement-studentAvatar">
                {student.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {student.name}
              </span>
            </div>
          ))
        ) : (
          <p style={{ textAlign: "center", gridColumn: "1 / -1", fontSize: "14px" }}>No students found.</p>
        )}
      </div>
    </div>
  </div>
)}
{showIndividualAdmissionFeePopup && (
  <div className="FeesManagement-popupOverlay" onClick={() => setShowIndividualAdmissionFeePopup(false)}>
    <div className="FeesManagement-popupContent" style={{ width: 'min(90%, 480px)' }} onClick={(e) => e.stopPropagation()}>
      <button className="FeesManagement-popupCloseBtn" onClick={() => setShowIndividualAdmissionFeePopup(false)}>
        &times;
      </button>
      <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
        Admission Fee for {selectedAdmissionStudent?.name}
      </h3>
      <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
        <p><strong>Student ID:</strong> {loginId || 'Not set'}</p>
      </div>
      <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
        <p><strong>Previous Admission Fee:</strong> {oldAdmissionFee || 'Not set'}</p>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Amount:</label>
        <input
          type="number"
          value={admissionFeeAmount}
          onChange={(e) => setAdmissionFeeAmount(e.target.value)}
          onWheel={(e) => e.target.blur()}
          className="no-spinner btn-dropdown-FeesManagement"
          placeholder="Enter Admission Fee Amount"
          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
        />
      </div>
      <button
        className="btn-solid"
        style={{ width: "100%" }}
        onClick={async () => {
          try {
            const schoolCode = localStorage.getItem("schoolCode") || "TAGSOLNOVALLP";
            const response = await axios.post(
              "https://cleezoclass.com:4000/pay-admission-fee",
              {
                studentName: selectedAdmissionStudent.name,
                className: className.replace("Class ", ""),
                sectionName: section,
                schoolCode: schoolCode,
                admissionFee: admissionFeeAmount,
              }
            );
            if (response.data.success) {
              displayToast(`Admission fee for ${selectedAdmissionStudent.name} saved successfully!`, "success");
              setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
              setShowIndividualAdmissionFeePopup(false);
            } else {
              displayToast(`Failed to save admission fee: ${response.data.message}`, "error");
            }
          } catch (error) {
            console.error("Error saving admission fee:", error);
            displayToast(
              `Error saving admission fee: ${error.response?.data?.message || error.message}`,
              "error"
            );
          }
        }}
      >
        Submit
      </button>
    </div>
  </div>
)}



      {/* BUS FEE POPUPS */}
      {showBusFeePopup && (
        <div className="FeesManagement-popupOverlay" onClick={() => setShowBusFeePopup(false)}>
          <div className="FeesManagement-popupContent" onClick={(e) => e.stopPropagation()}>
            <button className="FeesManagement-popupCloseBtn" onClick={() => setShowBusFeePopup(false)}>
              &times;
            </button>

            <h2 className="FeesManagement-popupTitle">
              Bus Fee Students - Class {className.replace("Class ", "")} Section {section}
            </h2>
            <p style={{ textAlign: "center", marginBottom: "20px", color: "#f44336", fontWeight: "bold" }}>
              Click on a student's name to set their individual Bus Fee and Frequency.
            </p>

            <div className="FeesManagement-studentGrid">
              {busFeeStudents.length > 0 ? (
                busFeeStudents.map((student, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setSelectedBusStudent(student);
                      setShowIndividualStudentPopup(true);
                    }}
                    className="FeesManagement-studentCard"
                  >
                    <div className="FeesManagement-studentAvatar">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {student.name}
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: "center", gridColumn: "1 / -1", fontSize: "14px" }}>No students found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL STUDENT POPUP */}
      {showIndividualStudentPopup && (
        <div className="FeesManagement-popupOverlay" onClick={() => setShowIndividualStudentPopup(false)}>
          <div className="FeesManagement-popupContent" style={{ width: 'min(90%, 480px)' }} onClick={(e) => e.stopPropagation()}>
            <button className="FeesManagement-popupCloseBtn" onClick={() => setShowIndividualStudentPopup(false)}>
              &times;
            </button>
            <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
              Bus Fee for {selectedBusStudent?.name}
            </h3>

            <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
              <p><strong>Student ID:</strong> {loginId || 'Not set'}</p>
            </div>

            <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
              <p><strong>Previous Bus Fee:</strong> {oldBusFee || 'Not set'}</p>
              <p><strong>Previous Frequency:</strong> {oldFrequencyType || 'Not set'}</p>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Frequency:</label>
              <select
                value={busFeeFrequency}
                onChange={(e) => setBusFeeFrequency(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
              >
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>Amount:</label>
              <input
                type="number"
                value={busFeeAmount}
                onChange={(e) => setBusFeeAmount(e.target.value)}
                onWheel={(e) => e.target.blur()}
                className="no-spinner btn-dropdown-FeesManagement"
                placeholder="Enter Bus Fee Amount"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
              />
            </div>

            <button
              className="btn-solid"
              style={{ width: "100%" }}
              onClick={async () => {
                try {
                  const schoolCode = localStorage.getItem("schoolCode") || "TAGSOLNOVALLP";
                  const response = await axios.post(
                    "https://cleezoclass.com:4000/pay-bus-fee",
                    {
                      studentName: selectedBusStudent.name,
                      className: className.replace("Class ", ""),
                      sectionName: section,
                      schoolCode: schoolCode,
                      busFee: busFeeAmount,
                      frequency_type: busFeeFrequency,
                    }
                  );
                  if (response.data.success) {
                    displayToast(`Bus fee for ${selectedBusStudent.name} saved successfully!`, "success");
                    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
                    setShowIndividualStudentPopup(false);
                  } else {
                    displayToast(`Failed to save bus fee: ${response.data.message}`, "error");
                  }
                } catch (error) {
                  console.error("Error saving bus fee:", error);
                  displayToast(
                    `Error saving bus fee: ${error.response?.data?.message || error.message}`,
                    "error"
                  );
                }
              }}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  </>
);

};

export default IncomeForm5;
