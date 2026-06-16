import { ArrowLeft, Download, Share, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";
import ErrorPopup from '../shared/ErrorPopup';

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

const STATIC_FEE_OPTIONS = [
  { label: "Tuition Fee", value: "Tuition Fee" },
  { label: "Admission Fee", value: "Admission Fee" },
  { label: "Books Fee", value: "Books Fee" },
  { label: "Bus Fee", value: "Bus Fee" },
  { label: "Uniform Fee", value: "Uniform Fee" },
  { label: "Exam Fee", value: "Exam Fee" },
  { label: "Other Fees", value: "Other Fees" },
];

const CLASS_PRIORITY = {
  prekg: -4,
  "pre kg": -4,
  prenursery: -3,
  "pre nursery": -3,
  nursery: -2,
  lkg: -1,
  ukg: -0.5,
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

const IMAGE_BASE_URL = 'https://cleezoclass.com:4000';
const API_BASE = 'https://cleezoclass.com:4000/api/admin';

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
  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      backgroundColor: backgroundColor, color: 'white', padding: '15px 25px',
      borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10000,
      fontSize: '16px', fontWeight: 'bold', minWidth: '250px', textAlign: 'center'
    }}>
      {message}
    </div>
  );
};

const IncomeForm5 = ({ dynamicFeeTypes: externalDynamicFeeTypes = [] }) => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'discount'
  const [students, setStudents] = useState([]);
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [classList, setClassList] = useState([]);
  const [sectionMap, setSectionMap] = useState([]);
  const [filteredSections, setFilteredSections] = useState([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadStudentsValue, setLoadStudentsValue] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalFeeEntries, setModalFeeEntries] = useState([{ feeType: '', reason: '', discount: '' }]);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [localDynamicFeeTypes, setLocalDynamicFeeTypes] = useState([]);
  
  const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";
  const resolvedDynamicFeeTypes =
    Array.isArray(externalDynamicFeeTypes) && externalDynamicFeeTypes.length
      ? externalDynamicFeeTypes
      : localDynamicFeeTypes;

  const formatClassLabel = (value) => {
    const str = String(value || '').trim();
    return /^\d+$/.test(str) ? `Class ${str}` : str;
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      setDropdownLoading(true);
      try {
        const [classRes, sectionRes] = await Promise.all([
          axios.get(`${API_BASE}/classes`, { params: { schoolCode } }),
          axios.get(`${API_BASE}/sectionFilter`, { params: { schoolCode } }),
        ]);

        const rawClasses = Array.isArray(classRes.data) ? classRes.data : [];
        const normalizedClasses = sortClassLabels([
          ...new Set(
            rawClasses
              .map((item) =>
                String(item?.class_name ?? item?.className ?? item?.value ?? item).trim()
              )
              .filter(Boolean)
          ),
        ]);

        const sectionsArray = Array.isArray(sectionRes.data) ? sectionRes.data : [];
        setClassList(normalizedClasses);
        setSectionMap(sectionsArray);
      } catch (error) {
        console.error("Failed to fetch class/section metadata:", error);
        setPopupMsg("Unable to load class/section list.");
      } finally {
        setDropdownLoading(false);
      }
    };

    fetchMetadata();
  }, [schoolCode]);

  useEffect(() => {
    if (Array.isArray(externalDynamicFeeTypes) && externalDynamicFeeTypes.length) return;

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

        setLocalDynamicFeeTypes(normalized);
      } catch (error) {
        console.error("Failed to fetch dynamic fee types:", error);
      }
    };

    fetchDynamicFeeTypes();
  }, [externalDynamicFeeTypes]);

  useEffect(() => {
    if (!className) {
      setFilteredSections([]);
      setSection('');
      return;
    }

    const sections = sectionMap
      .filter((item) => String(item?.class_name) === String(className))
      .map((item) => item?.section)
      .filter(Boolean);

    const uniqueSections = [...new Set(sections)];
    setFilteredSections(uniqueSections);

    if (section && !uniqueSections.includes(section)) {
      setSection('');
    }
  }, [className, sectionMap, section]);

  const displayToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  const handleLoadStudents = () => {
    if (!className || !section) {
setPopupMsg("Kindly select both Class and Section to proceed.");
      return;
    }
    setViewMode('grid');
    setLoadStudentsValue(true);
    setShowIcon(true);
    loadStudents('normal');
  };

  const handleViewDiscount = async () => {
    if (!className || !section) {
setPopupMsg("Kindly select both Class and Section to view discounts.");
      return;
    }
    setViewMode('discount');
    setLoadStudentsValue(true);
    await loadStudents('discount');
  };

  const loadStudents = async (mode = 'normal') => {
    const apiClassName = className.replace("Class ", "");
    try {
      if (mode === 'discount') {
        const response = await axios.get('https://cleezoclass.com:4000/api/discounted-students', {
          params: { className: apiClassName, section, schoolCode }
        });
        setStudents(response.data);
      } else {
        const response = await fetch(`https://cleezoclass.com:4000/get-students?className=${apiClassName}&section=${section}&schoolCode=${schoolCode}`);
        const data = await response.json();
        if (data.success) {
          setStudents(data.students || []);
        } else {
          setStudents([]);
setPopupMsg("No student records were found for the selected class and section.");
        }
      }
    } catch (error) {
setPopupMsg("Unable to load student data. Please try again.");
      setStudents([]);
    }
  };

  const handleRemoveDiscount = async (studentId) => {
    if (window.confirm('Remove all discounts for this student?')) {
      try {
        await axios.put(`https://cleezoclass.com:4000/api/remove-discount/${studentId}`, { schoolCode });
        await loadStudents('discount');
        setPopupMsg("Discount removed successfully.");
      } catch (error) {
setPopupMsg("Unable to remove the discount. Kindly try again.");
      }
    }
  };
const [fees, setFees] = useState({ 
  tuition: 0, 
  exam: 0, 
   bus: 0, 
  uniform: 0, 
  books: 0, 
  admission: 0, // Added admission fee
  other: 0 
});
  // This filter works for both view modes
  const filteredStudents = students.filter(s => {
    const name = s.name || s.StudentName || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });
  const [defaultFees, setDefaultFees] = useState({
    admission: 0,
    tuition: 0,
    exam: 0,
    uniform: 0,
    books: 0,
    other: 0,
  });
  const [feeStructure, setFeeStructure] = useState({});
  
// Place this hook in your IncomeForm5 component, removing the old ones.
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
setPopupMsg(`No fee structure found for ${className}. Kindly configure it first.`);
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
        // Get tuition fee directly if available, otherwise calculate
        tuition: parseFloat(backendData.Tuition_Fee) || 
                (parseFloat(backendData.CompleteFee) || 0) - 
                (parseFloat(backendData.Book_Fee) + 
                 parseFloat(backendData.Uniform_Fee) + 
                 parseFloat(backendData.Exam_Fee) + 
                 parseFloat(backendData.Other_Fee) + 
                 parseFloat(backendData.Admission_Fee) + 
                 parseFloat(backendData.Bus_Fee))
      };
 
      setDefaultFees(fees);
      setFees(fees);
      
      setFeeStructure({
        ...backendData,
        ...fees,
        complete_fee: parseFloat(backendData.CompleteFee) || 0
      });
 
    } catch (error) {
      console.error("Failed to fetch fee structure:", error);
setPopupMsg("Failed to load fee structure. Please try again.");
    }
  };
 
  fetchFeeStructure();
}, [className, section]);

  const renderStudentPhoto = (student) => {
    const isPhotoValid = student.photo && student.photo.trim() !== "";
    const name = student.name || student.StudentName || "?";
    const firstLetter = name.charAt(0).toUpperCase();

    return (
      <div style={{
        width: "50px", height: "50px", borderRadius: "50%", display: "flex",
        alignItems: "center", justifyContent: "center", backgroundColor: "#0a3d62",
        color: "white", fontWeight: "600", fontSize: "16px", overflow: "hidden",
      }}>
        {showIcon && isPhotoValid ? (
          <img src={IMAGE_BASE_URL + student.photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span>{firstLetter}</span>
        )}
      </div>
    );
  };
const [popupMsg, setPopupMsg] = useState("");


const submitModalFeeEntries = async (e) => {
  e.preventDefault();
  const schoolCode = localStorage.getItem('schoolCode') || "TAGSOLNOVALLP";

  if (!selectedStudent) {
    setPopupMsg("❗ Please select a student before submitting.");
    return;
  }

  const filteredModalEntries = modalFeeEntries.filter(entry => 
    entry.feeType && entry.feeType.trim() !== ''
  );

  if (filteredModalEntries.length === 0) {
    setPopupMsg("❗ Please select at least one fee type for discount.");
    return;
  }

  const getBaseAmountForFeeType = (feeType) => {
    if (!feeType) return 0;
    const lower = feeType.toLowerCase();
    if (lower.includes("tuition")) {
      console.log("[Discounts] base amount resolved", { feeType, source: "static:tuition", amount: fees.tuition || 0 });
      return fees.tuition || 0;
    }
    if (lower.includes("admission")) {
      console.log("[Discounts] base amount resolved", { feeType, source: "static:admission", amount: fees.admission || 0 });
      return fees.admission || 0;
    }
    if (lower.includes("book")) {
      console.log("[Discounts] base amount resolved", { feeType, source: "static:book", amount: fees.book || 0 });
      return fees.book || 0;
    }
    if (lower.includes("uniform")) {
      console.log("[Discounts] base amount resolved", { feeType, source: "static:uniform", amount: fees.uniform || 0 });
      return fees.uniform || 0;
    }
    if (lower.includes("exam")) {
      console.log("[Discounts] base amount resolved", { feeType, source: "static:exam", amount: fees.exam || 0 });
      return fees.exam || 0;
    }
    if (lower.includes("other")) {
      console.log("[Discounts] base amount resolved", { feeType, source: "static:other", amount: fees.other || 0 });
      return fees.other || 0;
    }
    if (lower.includes("bus")) {
      console.log("[Discounts] base amount resolved", { feeType, source: "static:bus", amount: fees.bus || 0 });
      return fees.bus || 0;
    }

    const selectedBase = normalizeFeeColumnBase(feeType);
    const matchingDynamicFee = resolvedDynamicFeeTypes.find((fee) => {
      const feeNameBase = normalizeFeeColumnBase(fee?.feeName);
      const feeColumnBase = normalizeFeeColumnBase(fee?.columnBase);
      const exactName = String(fee?.feeName || "").trim().toLowerCase();
      return (
        lower === exactName ||
        selectedBase === feeNameBase ||
        selectedBase === feeColumnBase ||
        lower.includes(exactName)
      );
    });

    if (matchingDynamicFee) {
      const candidateKeys = [
        matchingDynamicFee.columnBase,
        normalizeFeeColumnBase(matchingDynamicFee.feeName),
        matchingDynamicFee.feeName,
        matchingDynamicFee.id,
      ].filter(Boolean);

      for (const key of candidateKeys) {
        const value = feeStructure?.[key];
        const parsed = Number(String(value ?? "").replace(/,/g, ""));
        if (Number.isFinite(parsed) && parsed >= 0) {
          console.log("[Discounts] base amount resolved", {
            feeType,
            source: "dynamic",
            matchedFee: matchingDynamicFee,
            key,
            amount: parsed,
          });
          return parsed;
        }
      }
    }

    console.log("[Discounts] base amount resolved", {
      feeType,
      source: "not-found",
      amount: 0,
      feeStructureKeys: Object.keys(feeStructure || {}),
    });
    return 0;
  };

  for (const entry of filteredModalEntries) {
    const feeTypeLower = entry.feeType.toLowerCase();
    if (feeTypeLower.includes('tuition')) {
      const actualTuitionFee = getBaseAmountForFeeType(entry.feeType);
      const enteredDiscount = parseFloat(entry.discount) || 0;

      if (enteredDiscount > actualTuitionFee) {
        setPopupMsg(
          `❗ Tuition discount ₹${enteredDiscount} cannot exceed actual tuition fee ₹${actualTuitionFee}.`
        );
        return;
      }
    }
  }

  const feeTypeToColumnMap = {
    'bus fee': 'bus_discount',
    'tuition fee': 'tuition_discount',
    'fee': 'fee_discount'
  };

  try {
    const apiClassName = className.replace("Class ", "");

    const payload = {
      studentName: selectedStudent.name,
      studentId: selectedStudent.id,
      className: apiClassName,
      sectionName: section,
      schoolCode,
      feeEntries: filteredModalEntries.map(entry => ({
        feeType: entry.feeType,
        amount: getBaseAmountForFeeType(entry.feeType),
        discount: parseFloat(entry.discount) || 0,
        reason: entry.reason,
        date: new Date().toISOString()
      })),
      discounts: filteredModalEntries.reduce((acc, entry) => {
        const feeTypeLower = entry.feeType.toLowerCase();
        const columnName = Object.keys(feeTypeToColumnMap).find(key => 
          feeTypeLower.includes(key)
        ) || 'fee_discount';
        acc[feeTypeToColumnMap[columnName]] = parseFloat(entry.discount) || 0;
        return acc;
      }, {})
    };

    const response = await axios.post(
      'https://cleezoclass.com:4000/pay-fee-details',
      payload
    );

    console.log("Backend response:", response.data);
    setPopupMsg("✅ Discounts submitted successfully!");

    setModalFeeEntries([{ feeType: '', reason: '', discount: '' }]);
    setShowModal(false);

  } catch (error) {
    console.error("❌ Failed to submit discounts:", error);
    setPopupMsg(
      `❌ Submission failed: ${error.response?.data?.message || error.message}`
    );
  }
};

  const modalOverlayStyle = {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: '15px',
    boxSizing: 'border-box'
  };
 
  const modalContentStyle = {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '500px',
    height: '40vh',
    overflowY: 'auto',
    textAlign: 'center',
    position: 'relative',
    '@media (max-width: 768px)': {
      padding: '15px',
      maxWidth: '95%'
    }
  };
   const closeButtonStyle = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    cursor: 'pointer',
    fontSize: '20px',
    backgroundColor: '#5a7488',
    color: 'white',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    lineHeight: '26px',
    display: 'inline-block',
    marginLeft: '10px',
    '@media (max-width: 768px)': {
      width: '24px',
      height: '24px',
      lineHeight: '22px',
      fontSize: '18px'
    }
  };
   

 


 


    // Handles changes for fee entries within the Special Privileges modal
  const handleModalFeeEntryChanges = (index, field, value) => {
    const updatedEntries = [...modalFeeEntries];
    updatedEntries[index][field] = value;
    setModalFeeEntries(updatedEntries);
    console.log("[Discounts] modal fee entry changed", {
      index,
      field,
      value,
      currentEntry: updatedEntries[index],
      allEntries: updatedEntries,
    });
  };
 
 const [studentDiscount, setStudentDiscount] = useState(null);
   // Adds a new empty row for dynamic fee entry in the modal
  const addModalFeeEntryRow = () => {
    setModalFeeEntries([...modalFeeEntries, { feeType: '', reason: '', discount: '' }]);
  };
 
  // Removes a dynamic fee entry row from the modal
  const removeModalFeeEntryRow = (index) => {
    setModalFeeEntries(modalFeeEntries.filter((_, i) => i !== index));
  };
  const formatAmount = (value) => {
  if (!value) return "";

  const number = Number(value);
  if (isNaN(number)) return "";

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
    });
  };

  const dynamicFeeTypeOptions = [
    ...new Map(
      resolvedDynamicFeeTypes
        .map((fee) => {
          const value = String(fee?.columnBase || fee?.feeName || fee?.feesType || "").trim();
          if (!value) return null;
          return [
            value.toLowerCase(),
            {
              label: fee?.feeName || fee?.feesType || value,
              value,
            },
          ];
        })
        .filter(Boolean)
    ).values(),
  ].sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true, sensitivity: "base" }));

  console.log("[Discounts] dynamic fee options loaded", {
    schoolCode,
    resolvedDynamicFeeTypes,
    dynamicFeeTypeOptions,
  });

return (
  <>
    {toast.show && (
      <ToastNotification
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ show: false, message: '', type: '' })}
      />
    )}

    <div className="Discount-mainContainer">
      {/* Side Container */}
      <div className="Discount-sideContainer">
        <h2 className="Discount-header">Discounts</h2>

        {/* Controls Row */}
        <div className="Discount-controlsRow">
          <select className="Discount-select" value={className} onChange={(e) => setClassName(e.target.value)}>
            <option value="">Class</option>
            {dropdownLoading ? (
              <option value="" disabled>Loading...</option>
            ) : (
              classList.map((cls) => (
                <option key={cls} value={cls}>
                  {formatClassLabel(cls)}
                </option>
              ))
            )}
          </select>

          <select
            className="Discount-select"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            disabled={!className || dropdownLoading}
          >
            <option value="">Sec</option>
            {filteredSections.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>

          <button onClick={handleLoadStudents}  style={{ marginTop:'-1%'}} className="Discount-button">Load Students</button>
          <button onClick={handleViewDiscount}  style={{ marginTop:'-1%'}} className="Discount-button">Discounts</button>

          <input 
            type="text"
            placeholder="Search by student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="Discount-search"
          />
        </div>

        {/* Student List */}
        <div style={{ flexGrow: 1, overflowY: 'auto', borderTop: '1px solid #eee', paddingTop: '10px' }}>
          {!loadStudentsValue ? (
            <p style={{ textAlign: 'center', color: '#888' }}>Select class/section and click Load</p>
          ) : filteredStudents.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888' }}>No records found</p>
          ) : viewMode === 'grid' ? (
            <div className="Discount-studentGrid">
              {filteredStudents.map((student) => (
                <div key={student.id} className="Discount-studentCard" onClick={() => { 
  setSelectedStudent(student); 
  setPopupMsg("");          // 👈 clear old messages
  setShowModal(true); 
}}
>
                  {renderStudentPhoto(student)}
                  <span className="Discount-studentName">{student.name || student.StudentName}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="Discount-tableContainer">
              <table className="Discount-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Discount</th>
                    <th>Details</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => (
                    <tr key={student.id}>
                      <td>{student.StudentName}</td>
                      <td className="Discount-discountAmount">₹{student.Discount}</td>
                      <td>
                        {student.tuition_discount>0 && <span style={{color:'#3498db'}}>Tuition: ₹{student.tuition_discount}</span>}
                        {student.fee_discount>0 && <span style={{color:'#27ae60'}}>Book: ₹{student.fee_discount}</span>}
                        {student.bus_discount>0 && <span style={{color:'#f39c12'}}>Bus: ₹{student.bus_discount}</span>}
                      </td>
                      <td>
                        <button className="Discount-removeButton" onClick={()=>handleRemoveDiscount(student.id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Discount Modal */}
      {showModal && (
        <div className="Discount-modalOverlay">
          <div className="Discount-modalContent">
            <span className="Discount-closeButton" onClick={() => { 
  setShowModal(false); 
  setModalFeeEntries([{ feeType:'', reason:'', discount:'' }]);
  setPopupMsg("");          // 👈 clear message
}}
>×</span>

            <h3 className="Discount-modalHeader">
              <span>Discount</span>
              <span className="Discount-modalStudentName">{selectedStudent?.name}</span>
            </h3>

            <p style={{ fontSize:'10px', marginBottom:'5px' }}>Date: {new Date().toLocaleDateString()}</p>
            <p style={{ fontSize:'10px', marginBottom:'15px' }}>Please enter the payment amount and select the fee type.</p>

            {studentDiscount && (
              <div className="Discount-totalBox">
                <div className="Discount-totalRow">
                  <div>
                    <strong>Tuition Discount:</strong> ₹{studentDiscount.tuition_discount}
                  </div>
                  <div>
                    <strong>Fee Discount:</strong> ₹{studentDiscount.fee_discount}
                  </div>
                </div>
                <div>Total Discount: ₹{parseFloat(studentDiscount.tuition_discount||0)+parseFloat(studentDiscount.fee_discount||0)}</div>
              </div>
            )}

            {/* Fee Entries Form */}
            <form onSubmit={submitModalFeeEntries}>
              <div style={{display:'grid', gap:'20px', marginBottom:'20px'}}>
                {modalFeeEntries.map((entry,index) => (
                  <div key={index} className="Discount-modalFeeEntry">
                    {modalFeeEntries.length>1 && <button type="button" className="Discount-removeRowButton" onClick={()=>removeModalFeeEntryRow(index)}>×</button>}
                                                   <div className="expense-input-field">

                    <select className="btn-dropdown-FeesManagement" value={entry.feeType} onChange={e=>handleModalFeeEntryChanges(index,'feeType',e.target.value)} required>
                      <option value="">Fee Type</option>
                      {dynamicFeeTypeOptions.length > 0 && (
                        <optgroup label="Dynamic Fee Types">
                          {dynamicFeeTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select></div>
                    {entry.feeType && (entry.reason==='Other' ? 

                      <input type="text" placeholder="Custom Reason" value={entry.customReason||''} className="Discount-modalInput" onChange={e=>handleModalFeeEntryChanges(index,'customReason',e.target.value)} autoFocus/> :
                                                                          <div className="expense-input-field">

                      
                      <select className="btn-dropdown-FeesManagement" value={entry.reason} onChange={e=>handleModalFeeEntryChanges(index,'reason',e.target.value)}>
                        <option value="">Reason</option>
                        <option value="Staff Concession">Staff</option>
                        <option value="VIP Concession">VIP</option>
                        <option value="caste/Religion">caste/Religion</option>
                       <option value="Parent Concession">Parent</option>

                        <option value="Sibling Concession">Sibling</option>
                        <option value="Other">Other</option>
                      </select></div>
                    )}
{entry.feeType && (
                                                      <div className="expense-input-field">

  <input
    type="text"
    value={entry.discount}
    onChange={(e) => {
      const rawValue = e.target.value.replace(/,/g, "");
      if (/^\d*$/.test(rawValue)) {
        handleModalFeeEntryChanges(index, "discount", rawValue);
      }
    }}
    onBlur={(e) => {
      const formatted = formatAmount(e.target.value);
      handleModalFeeEntryChanges(index, "discount", formatted.replace(/,/g, ""));
    }}
    placeholder="Discount"
    className="btn-dropdown-FeesManagement"
    style={{ width: '120px', textAlign: 'right' }}
  /></div>
)}
                 </div>
                ))}
              </div>

              <div className="Discount-modalActions">
                <button type="button" className="Discount-button" onClick={addModalFeeEntryRow}>Add Another Fee</button>
                <button type="submit" className="Discount-button">Submit Payment</button>
              </div>
            </form>


          </div>
        </div>
      )}

    </div>
    <ErrorPopup message={popupMsg} onClose={() => setPopupMsg("")} />

  </>
);

};

export default IncomeForm5;