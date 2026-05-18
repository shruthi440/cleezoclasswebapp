import { ArrowLeft, Calendar, CheckCircle, ChevronRight, Circle, Download, Share, Star } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

Modal.setAppElement('#root');
const schoolLogo = "";

const StudentManagementedit = () => {
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionMap, setSectionMap] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [deletePopupId, setDeletePopupId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    username: '',
    gender: '',
    phone_no: '',
    aadhar_no: '',
    father_name: '',
    class_name: '',
    section: '',
    class_teacher: '',
    school_name: '',
    address: '',
    dob: '',
    admission_no: '',
    cbse_reg_no: '',
    photo: '',
    curriculum: '',
  });
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    date: '',
    timeIn: '',
    timeOut: '',
    status: '',
    absenceReason: '',
  });
  const [activeContent, setActiveContent] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [activePage, setActivePage] = useState(null);
  const [showAttendance, setShowAttendance] = useState(false);

  const toUpperCaseText = (value) => {
    if (!value) return '';
    return String(value)
      .toUpperCase();
  };

  const getSectionsForClass = (cls) => {
    if (!cls) return [];
    const filtered = sectionMap
      .filter((s) => String(s.class_name) === String(cls))
      .map((s) => String(s.section || '').trim())
      .filter(Boolean);
    return [...new Set(filtered)];
  };

  const sortClassList = (items) => {
    const order = [
      'NURSERY',
      'LKG',
      'UKG',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
    ];
    const rank = new Map(order.map((v, i) => [v, i]));
    const normalized = (v) => String(v || '').trim().toUpperCase();
    return [...items].sort((a, b) => {
      const aVal = typeof a === 'string' ? a : a?.class_name;
      const bVal = typeof b === 'string' ? b : b?.class_name;
      const aKey = normalized(aVal);
      const bKey = normalized(bVal);
      const aRank = rank.has(aKey) ? rank.get(aKey) : 999;
      const bRank = rank.has(bKey) ? rank.get(bKey) : 999;
      if (aRank !== bRank) return aRank - bRank;
      return aKey.localeCompare(bKey);
    });
  };
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [teacherData, setTeacherData] = useState([]);
  const [isAbsent, setIsAbsent] = useState(false);
  const [status, setStatus] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [loadingIds, setLoadingIds] = useState([]);
  const [sending, setSending] = useState(false);
  const [messageStatus, setMessageStatus] = useState(null);
  const dateInputRef = useRef(null);
  const contentRef = useRef(null);
  const dashboardRef = useRef(null);
  const headerRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classTeachers, setClassTeachers] = useState({});
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [newStudentFormData, setNewStudentFormData] = useState({
    user_type: 'student',
    name: '',
    username: '',
    gender: '',
    phone_no: '',
    aadhar_no: '',
    father_name: '',
    class_name: '',
    section: '',
    class_teacher: '',
    school_name: '',
    address: '',
    dob: '',
    admission_no: '',
    cbse_reg_no: '',
    photo: '',
    curriculum: '',
  });

  const userRole = localStorage.getItem('userRole');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldOpenAdd =
      (params.get('openAdd') || '').toLowerCase() === 'true' ||
      params.get('openAdd') === '1';
    if (!shouldOpenAdd) return;

    const requestedUserType = (params.get('userType') || '').toLowerCase();
    const normalizedUserType =
      requestedUserType === 'teacher' || requestedUserType === 'management'
        ? requestedUserType
        : 'student';

    setNewStudentFormData((prev) => ({
      ...prev,
      user_type: normalizedUserType,
    }));
    setIsAddingStudent(true);
  }, [location.search]);

  const normalizePhotoUrl = (rawPhoto) => {
    if (!rawPhoto) return '';

    let photoPath = rawPhoto;

    if (typeof photoPath === 'object' && photoPath.type === 'Buffer' && Array.isArray(photoPath.data)) {
      try {
        photoPath = new TextDecoder().decode(new Uint8Array(photoPath.data));
      } catch {
        return '';
      }
    }

    if (typeof photoPath !== 'string') return '';
    photoPath = photoPath.trim();
    if (!photoPath) return '';

    if (photoPath.startsWith('data:image') || photoPath.startsWith('http')) {
      return photoPath;
    }

    if (photoPath.startsWith('0x')) {
      try {
        const hex = photoPath.slice(2);
        let decoded = '';
        for (let i = 0; i < hex.length; i += 2) {
          decoded += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
        }
        photoPath = decoded.trim();
      } catch {
        return '';
      }
    }

    if (photoPath.startsWith('/public/uploads/')) {
      photoPath = photoPath.replace('/public', '');
    }

    if (photoPath.startsWith('uploads/')) {
      photoPath = `/${photoPath}`;
    }

    if (!photoPath.startsWith('/uploads/')) {
      photoPath = `/uploads/${photoPath.replace(/^\/+/, '')}`;
    }

    return `https://cleezoclass.com:4000${photoPath}`;
  };

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 968;

  useEffect(() => {
    const code = localStorage.getItem("schoolCode");
    if (!code) {
      setError("schoolCode not found in localStorage");
      return;
    }
    setSchoolCode(code);
  }, []);

  useEffect(() => {
    const code = localStorage.getItem('schoolCode');
    if (!code) {
      setError("School code not found in localStorage");
      return;
    }
    setSchoolCode(code);
  }, []);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!schoolCode) return;
      setIsLoading(true);
      try {
        const [classRes, sectionRes] = await Promise.all([
          axios.get(`https://cleezoclass.com:4000/api/admin/classes`, { params: { schoolCode } }),
          axios.get(`https://cleezoclass.com:4000/api/admin/sectionFilter`, { params: { schoolCode } }),
        ]);
        setClasses(Array.isArray(classRes.data) ? classRes.data : []);
        setSectionMap(Array.isArray(sectionRes.data) ? sectionRes.data : []);
        setError(null);
      } catch (err) {
        setError('Failed to fetch classes/sections');
        console.error('Error fetching metadata:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMetadata();
  }, [schoolCode]);

  useEffect(() => {
    if (!selectedClass) {
      setSections([]);
      setSelectedSection('');
      return;
    }
    const filtered = sectionMap
      .filter((s) => String(s.class_name) === String(selectedClass))
      .map((s) => String(s.section || '').trim())
      .filter(Boolean);
    setSections([...new Set(filtered)]);
    setSelectedSection('');
  }, [selectedClass, sectionMap]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (selectedClass && selectedSection) {
        setIsLoading(true);
        try {
          const url = `https://cleezoclass.com:4000/api/users/${selectedClass}`;
          const params = {
            user_type: newStudentFormData.user_type || 'student',
            schoolCode,
            section: selectedSection
          };
          const response = await axios.get(url, { params });
          const updatedStudents = response.data.map(student => {
            const key = `${student.class_name}-${student.section}`;
            const teacher = student.class_teacher;
            return {
              ...student,
              class_teacher: teacher
            };
          });
          setStudents(updatedStudents);
          const teacherMapFromData = {};
          updatedStudents.forEach(student => {
            const key = `${student.class_name}-${student.section}`;
            if (!teacherMapFromData[key]) {
              teacherMapFromData[key] = student.class_teacher;
            }
          });
          setClassTeachers(teacherMapFromData);
          setError(null);
        } catch (err) {
          setError('Failed to fetch students');
          console.error('Error fetching students:', err);
        } finally {
          setIsLoading(false);
        }
      } else {
        setStudents([]);
      }
    };
    fetchStudents();
  }, [selectedClass, selectedSection, schoolCode, newStudentFormData.user_type]);

  const handleEditClick = (student) => {
    const key = `${student.class_name}-${student.section}`;
    const teacherName = classTeachers[key] || '';
    setEditingStudent(student.id);
    setEditFormData({
      name: student.name || '',
      username: student.username || '',
      gender: student.gender || '',
      phone_no: student.phone_no || '',
      aadhar_no: student.aadhar_no || '',
      father_name: student.father_name || '',
      class_name: student.class_name || '',
      section: student.section || '',
      class_teacher: teacherName,
      school_name: student.school_name || '',
      address: student.address || '',
      dob: student.dob || '',
      admission_no: student.admission_no || '',
      cbse_reg_no: student.cbse_reg_no || '',
      photo: student.photo || '',
      curriculum: student.curriculum || ''
    });
    setPhotoPreview(normalizePhotoUrl(student.photo));
    setPhotoFile(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNewStudentFormChange = (e, field) => {
    const { value } = e.target;
    setNewStudentFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const uploadPhoto = async () => {
    if (!photoFile) return editFormData.photo || newStudentFormData.photo;
    const formData = new FormData();
    formData.append('photo', photoFile);
    try {
      const response = await axios.post(`https://cleezoclass.com:4000/api/upload-photo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        params: { schoolCode }
      });
      return response.data.photoPath;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  };

  const handleDelete = async (studentId) => {
    if (window.confirm('Are you sure you want to move this student to deleted list?')) {
      try {
        await axios.delete(`https://cleezoclass.com:4000/api/users/${studentId}`, {
          params: { schoolCode },
        });
        const url = `https://cleezoclass.com:4000/api/users/${selectedClass}`;
        const params = { user_type: 'student', schoolCode, section: selectedSection };
        const response = await axios.get(url, { params });
        setStudents(response.data);
      } catch (error) {
        console.error('Error deleting student:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const key = `${editFormData.class_name}-${editFormData.section}`;
    setClassTeachers((prev) => ({
      ...prev,
      [key]: editFormData.class_teacher
    }));
    try {
      const photoPath = photoFile ? await uploadPhoto() : editFormData.photo;
      await axios.put(`https://cleezoclass.com:4000/api/users/${editingStudent}`, {
        ...editFormData,
        photo: photoPath
      }, {
        params: { schoolCode }
      });
      const url = `https://cleezoclass.com:4000/api/users/${selectedClass}`;
      const params = { user_type: 'student', schoolCode, section: selectedSection };
      const response = await axios.get(url, { params });
      setStudents(response.data);
      cancelEdit();
      setSuccessMessage('✔️ Student details saved successfully!');
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
        setSuccessMessage('');
      }, 5000);
    } catch (error) {
      console.error('Error saving student details:', error);
      alert('Failed to save student details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

const handleAddStudentSubmit = async (e) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    const schoolCode = localStorage.getItem('schoolCode');
    if (!schoolCode) throw new Error("School code not found in localStorage");

    const submittedUserType = newStudentFormData.user_type || 'student';
    const submittedClassName = newStudentFormData.class_name;
    const submittedSection = newStudentFormData.section;

    const photoPath = photoFile ? await uploadPhoto() : '';

    const response = await axios.post(
      'https://cleezoclass.com:4000/api/submit-studentData',
      {
        ...newStudentFormData,
        photo: photoPath,
        schoolCode,
        category: submittedUserType,
      },
      {
         params: { schoolCode }
      }
    );

    console.log('✅ Backend response:', response.data);
    console.log("Sending user data:", { ...newStudentFormData, schoolCode });

    // Reset form
    setNewStudentFormData({
      user_type: 'student',
      name: '',
      username: '',
      gender: '',
      phone_no: '',
      aadhar_no: '',
      father_name: '',
      class_name: '',
      section: '',
      class_teacher: '',
      school_name: '',
      address: '',
      dob: '',
      admission_no: '',
      cbse_reg_no: '',
      photo: '',
      curriculum: '',
      designation: '',
      teaches_to_1: '',
      teaches_to_2: '',
      teaches_to_3: '',
      teaches_to_4: '',
      teaches_to_5: '',
      teaches_to_6: '',
      teaches_to_7: '',
      teaches_to_8: '',
      teaches_to_9: '',
      teaches_to_10: '',
      teaches_to_11: '',
      teaches_to_12: '',
    });
    setPhotoPreview('');
    setPhotoFile(null);

    // Send Admission QR immediately when a teacher user is added
    if (submittedUserType === 'teacher') {
      const teacherPhone = String(newStudentFormData.phone_no || '').trim();
      const teacherName = String(newStudentFormData.name || '').trim() || 'Teacher';
      if (teacherPhone) {
        try {
          await axios.post(
            'https://cleezoclass.com:4000/api/campaigning/send-admission-qr-teachers',
            {
              schoolCode,
              teachers: [
                {
                  teacher_name: teacherName,
                  phone_no: teacherPhone,
                },
              ],
            }
          );
        } catch (qrErr) {
          console.error('⚠️ Teacher created but QR send failed:', qrErr?.response?.data || qrErr?.message || qrErr);
        }
      }
    }

    // Show success overlay with dynamic message
    let successMsg = '';
    switch (submittedUserType) {
      case 'teacher':
        successMsg = '✔️ Teacher added successfully!';
        break;
      case 'management':
        successMsg = '✔️ Management user added successfully!';
        break;
      default:
        successMsg = '✔️ Student added successfully!';
    }

    setSuccessMessage(successMsg);
    setShowSuccessOverlay(true);
    setTimeout(() => {
      setShowSuccessOverlay(false);
      setSuccessMessage('');
    }, 5000);

    if (submittedClassName) {
      const updatedStudents = await axios.get(
        `https://cleezoclass.com:4000/api/users/${submittedClassName}`,
        {
          params: {
            schoolCode,
            user_type: submittedUserType,
            section: submittedSection,
          }
        }
      );
      setStudents(updatedStudents.data);
    }

  } catch (error) {
    const apiMessage = error?.response?.data?.message;
    console.error('❌ Error adding user:', error.response?.data || error.message);
    alert(apiMessage || 'Failed to add user. Please try again.');
  } finally {
    setIsLoading(false);
  }
};



  const cancelEdit = () => {
    setEditingStudent(null);
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const [dynamicLogoSrc, setDynamicLogoSrc] = useState('');
  const [dynamicSchoolCode, setDynamicSchoolCode] = useState('');

  useEffect(() => {
    const fetchSchoolLogo = async () => {
      const code = localStorage.getItem('schoolCode');
      if (!code) return;
      setDynamicSchoolCode(code);
      try {
        const response = await axios.post(
          'https://cleezoclass.com:4000/api/schoollogodynamic',
          { secretecode: code },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        if (response.data.logoPath) {
          setDynamicLogoSrc(response.data.logoPath);
        }
      } catch (error) {
        console.error('Error fetching school logo:', error.response?.data || error.message);
      }
    };
    fetchSchoolLogo();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const styles = {
    editModal: {
      overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
      },
     content: {
  backgroundColor: '#fff',
  padding: '30px',
  borderRadius: '14px',
  width: '80vw',
  height: '80vh',
  overflowY: 'auto',
  boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
  position: 'absolute',

  top: '50%',        // ✅ correct
  left: '50%',       // ✅ correct
  transform: 'translate(-50%, -50%)', // ✅ perfect center
}
,
    },
    filterGroup: {
      flex: '1',
      minWidth: '250px'
    },
    filterLabel: {
      display: 'block',
      marginBottom: '8px',
      fontWeight: '600',
      color: '#34495e'
    },
    select: {
      width: '100%',
      padding: '10px',
      fontSize: '16px',
      borderRadius: '4px',
      border: '1px solid #bdc3c7',
      backgroundColor: 'white'
    },
    error: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '15px',
      border: '1px solid #f5c6cb'
    },
    loading: {
      backgroundColor: '#d1ecf1',
      color: '#0c5460',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '15px',
      border: '1px solid #bee5eb'
    },
    resultsContainer: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '5px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
    },
    resultsHeader: {
      color: '#2c3e50',
      marginBottom: '15px',
      paddingBottom: '10px',
      borderBottom: '1px solid #ecf0f1',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    resultCount: {
      fontSize: '14px',
      color: '#7f8c8d',
      fontWeight: 'normal'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: '#7f8c8d',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      fontStyle: 'italic'
    },
    tableContainer: {
      overflowX: 'auto',
      borderRadius: '4px',
      border: '1px solid #dfe6e9',
      width: '100%',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: isMobile ? '12px' : '14px',
      minWidth: '600px',
    },
    tableHeaderRow: {
      backgroundColor: '#2c3e50',
      color: 'white'
    },
    tableHeader: {
      padding: isMobile ? '8px 10px' : '12px 15px',
      textAlign: 'left',
      fontWeight: '600',
      fontSize: isMobile ? '12px' : 'inherit',
    },
    tableRow: {
      borderBottom: '1px solid #dfe6e9',
      ':hover': {
        backgroundColor: '#f8f9fa'
      }
    },
    tableCell: {
      padding: isMobile ? '8px 10px' : '12px 15px',
      verticalAlign: 'middle',
      fontSize: isMobile ? '12px' : 'inherit',
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: '#fff',
      padding: '30px',
      borderRadius: '8px',
      width: '90%',
      maxHeight: '90vh',
      overflowY: 'auto',
      maxWidth: '900px',
      position: 'relative'
    },
    closeModalButton: {
      position: 'absolute',
      top: '10px',
      right: '15px',
      background: 'transparent',
      border: 'none',
      fontSize: '20px',
      cursor: 'pointer'
    },
    iconButton: {
      backgroundColor: '#e9ecef',
      border: '1px solid #ced4da',
      borderRadius: '6px',
      padding: '6px',
      marginRight: '8px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonDanger: {
      backgroundColor: '#ffe8e8',
      border: '1px solid #ff6b6b',
      borderRadius: '6px',
      padding: '6px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    popup: {
      backgroundColor: '#fff',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
      maxWidth: '40%',
      width: '90%',
      textAlign: 'center',
    },
    popupButtons: {
      marginTop: '15px',
      display: 'flex',
      justifyContent: 'center',
      gap: '10px',
    },
    confirmButton: {
      backgroundColor: '#dc3545',
      color: '#fff',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    cancelButton: {
      backgroundColor: '#6c757d',
      color: '#fff',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    editFormContainer: {
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #dfe6e9'
    },
    editFormHeader: {
      color: '#2c3e50',
      marginBottom: '20px',
      paddingBottom: '10px',
      borderBottom: '1px solid #3498db'
    },
    editForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    formSection: {
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '4px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    sectionHeader: {
      color: '#3498db',
      marginBottom: '15px',
      paddingBottom: '5px',
      borderBottom: '1px solid #ecf0f1'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
      gap: '15px'
    },
    formGroup: {
      marginBottom: '10px'
    },
    formLabel: {
      display: 'block',
      marginBottom: '5px',
      fontWeight: '500',
      color: '#34495e',
      fontSize: '14px'
    },
    formInput: {
      width: '93%',
      padding: '8px',
      border: '1px solid #bdc3c7',
      borderRadius: '4px',
      fontSize: '14px',
      boxSizing: 'border-box',
      ':focus': {
        outline: 'none',
        borderColor: '#3498db',
        boxShadow: '0 0 0 2px rgba(52,152,219,0.2)'
      }
    },
    formActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px'
    },
    saveButton: {
      padding: '8px 20px',
      backgroundColor: '#27ae60',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      ':disabled': {
        backgroundColor: '#bdc3c7',
        cursor: 'not-allowed'
      }
    },
    studentPhoto: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      objectFit: 'cover'
    },
    photoPlaceholder: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: '#eee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      color: '#666'
    },
    photoPreview: {
      width: '120px',
      height: '120px',
      borderRadius: '4px',
      objectFit: 'cover',
      border: '1px solid #ddd'
    },
    photoPlaceholderLarge: {
      width: '120px',
      height: '120px',
      backgroundColor: '#eee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      color: '#666',
      borderRadius: '4px'
    },
    uploadButton: {
      padding: '8px 15px',
      backgroundColor: '#3498db',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      marginRight: '10px',
      ':hover': {
        backgroundColor: '#2980b9'
      }
    },
    removeButton: {
      padding: '8px 15px',
      backgroundColor: '#e74c3c',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px'
    },
  };

  const headingStyle = {
    color: '#333',
    marginBottom: '20px',
    textAlign: 'center',
    fontSize: isMobile ? '20px' : '32px',
    fontWeight: 'bold'
  };

  const buttonStyle = {
    padding: isMobile ? '12px' : '18px',
    fontSize: isMobile ? '14px' : '18px',
    backgroundColor: '#e9a0a5',
    color: 'white',
    border: 'none',
    fontWeight: 'bold',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '20px',
    width: '100%',
    maxWidth: '400px',
    display: 'block',
    margin: '0 auto 20px auto',
  };

  return (
    <div>
   
      <div className="outer-container">
        <div className="main-content">
          <style>
            {`
              @media (max-width: 968px) {
                .main-content div[style*="max-width: 1800px"] {
                  padding: 10px !important;
                  width: 100%;
                  box-sizing: border-box;
                }
                div[style*="backgroundColor: #f5f5f5"][style*="display: flex"] {
                  flex-direction: column !important;
                  width: 95% !important;
                  margin-left: auto !important;
                  margin-right: auto !important;
                  box-sizing: border-box !important;
                }
                div[style*="boxShadow: 0 2px 5px rgba(0,0,0,0.1)"][style*="padding: 20px"] {
                  width: 100%;
                  box-sizing: border-box;
                  padding: 10px !important;
                }
                table th, table td {
                  white-space: nowrap !important;
                }
              }
            `}
          </style>

          {showSuccessOverlay && (
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(0, 128, 0, 0.9)',
              color: '#fff',
              padding: '20px 30px',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 'bold',
              zIndex: 9999,
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            }}>
              {successMessage}
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#f4f6f9',
            padding: '20px',
          }}>
            <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1800px', margin: '0 auto' }}>
              <h1 style={headingStyle}>Student Management System</h1>
              <button
                onClick={() => navigate('/StudentUpload')}
                style={buttonStyle}
              >
                📤 CLICK HERE TO UPLOAD STUDENTS DATA
              </button>
              <button
                onClick={() => setIsAddingStudent(true)}
                style={buttonStyle}
              >
                ✚ ADD NEW USER
              </button>
              <div style={styles.filterGroup}>
                <label htmlFor="search-student" style={styles.filterLabel}>Search by Name:</label>
                <input
                  id="search-student"
                  type="text"
                  placeholder="Enter student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.select}
                />
              </div>
              <div style={{
                backgroundColor: '#f5f5f5',
                padding: '15px',
                borderRadius: '5px',
                marginBottom: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '15px'
              }}>
                <div style={styles.filterGroup}>
                  <label htmlFor="class-select" style={styles.filterLabel}>Class:</label>
                  <select
                    id="class-select"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    style={styles.select}
                    disabled={isLoading}
                  >
                    <option value="">-- Select Class --</option>
                    {sortClassList(classes).map((classItem, index) => {
                      const classValue = typeof classItem === 'string' ? classItem : classItem?.class_name;
                      if (!classValue) return null;
                      return (
                        <option key={index} value={classValue}>
                          {classValue}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div style={styles.filterGroup}>
                  <label htmlFor="section-select" style={styles.filterLabel}>Section:</label>
                  <select
                    id="section-select"
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    style={{
                      ...styles.select,
                      backgroundColor: !selectedClass ? '#f5f5f5' : 'white',
                      cursor: !selectedClass ? 'not-allowed' : 'pointer'
                    }}
                    disabled={!selectedClass || isLoading}
                  >
                    <option value="">-- Select Section --</option>
                    {sections.map((sec, index) => (
                      <option key={index} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>
              </div>
              {error && <div style={styles.error}>{error}</div>}
              {isLoading && <div style={styles.loading}>Loading...</div>}
              {selectedClass && (
                <div style={styles.resultsContainer}>
                  <h2 style={styles.resultsHeader}>
                    {typeof selectedClass === 'object' ? selectedClass.class_name : String(selectedClass)}
                    {selectedSection ? ` - Section ${selectedSection}` : ''}
                    <span style={styles.resultCount}>Total: {students.length}</span>
                  </h2>
                  {students.length === 0 ? (
                    <div style={styles.emptyState}>No students found</div>
                  ) : (
                    <div style={styles.tableContainer}>
                      <table style={styles.table}>
                        <thead>
                          <tr style={styles.tableHeaderRow}>
                            <th style={styles.tableHeader}>ID</th>
                            <th style={styles.tableHeader}>Adm No.</th>
                            <th style={styles.tableHeader}>Name</th>
                            <th style={styles.tableHeader}>Username</th>
                            <th style={styles.tableHeader}>Father</th>
                            <th style={styles.tableHeader}>Gender</th>
                            <th style={styles.tableHeader}>Phone</th>
                            <th style={styles.tableHeader}>Aadhar</th>
                            <th style={styles.tableHeader}>Class</th>
                            <th style={styles.tableHeader}>Class Teacher</th>
                            <th style={styles.tableHeader}>Curriculum</th>
                            <th style={styles.tableHeader}>Section</th>
                            <th style={styles.tableHeader}>Photo</th>
                            <th style={styles.tableHeader}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map((student) => (
                            <React.Fragment key={student.id}>
                              <tr style={{
                                ...styles.tableRow,
                                backgroundColor: editingStudent === student.id ? '#f8f9fa' : 'white'
                              }}>
                                <td style={styles.tableCell}>{student.id}</td>
                                <td style={styles.tableCell}>{student.admission_no || '-'}</td>
                                <td style={styles.tableCell}>{toUpperCaseText(student.name)}</td>
                                <td style={styles.tableCell}>{student.username || '-'}</td>
                                <td style={styles.tableCell}>{student.father_name ? toUpperCaseText(student.father_name) : '-'}</td>
                                <td style={styles.tableCell}>{student.gender || '-'}</td>
                                <td style={styles.tableCell}>{student.phone_no || '-'}</td>
                                <td style={styles.tableCell}>{student.aadhar_no || '-'}</td>
                                <td style={styles.tableCell}>
                                  {typeof student.class_name === 'object'
                                    ? student.class_name.class_name || '-'
                                    : student.class_name || '-'}
                                </td>
                                <td style={styles.tableCell}>
                                  {classTeachers[`${student.class_name}-${student.section}`] || '-'}
                                </td>
                                <td style={styles.tableCell}>
                                  {student.curriculum || '-'}
                                </td>
                                <td style={styles.tableCell}>{student.section || '-'}</td>
                                <td style={styles.tableCell}>
                                  {student.photo ? (
                                    <img
                                      src={normalizePhotoUrl(student.photo)}
                                      alt={`${student.name}'s photo`}
                                      style={styles.studentPhoto}
                                      onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.style.display = 'none';
                                        const placeholder = document.createElement('div');
                                        Object.assign(placeholder.style, styles.photoPlaceholder);
                                        placeholder.textContent = 'No Photo';
                                        e.target.parentNode.appendChild(placeholder);
                                      }}
                                    />
                                  ) : (
                                    <div style={styles.photoPlaceholder}>No Photo</div>
                                  )}
                                </td>
                                <td style={styles.tableCell}>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                      onClick={() => handleEditClick(student)}
                                      style={styles.iconButton}
                                      disabled={isLoading}
                                      title="Edit"
                                    >
                                      <Pencil size={18} />
                                    </button>
                                    <button
                                      onClick={() => setDeletePopupId(student.id)}
                                      style={styles.iconButtonDanger}
                                      disabled={isLoading}
                                      title="Delete"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                  {deletePopupId === student.id && (
                                    <div
                                      style={styles.overlay}
                                      onClick={() => setDeletePopupId(null)}
                                    >
                                      <div
                                        style={styles.popup}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <p>Are you sure you want to delete this student?</p>
                                        <div style={styles.popupButtons}>
                                          <button onClick={() => handleDelete(student.id)} style={styles.confirmButton}>Delete</button>
                                          <button onClick={() => setDeletePopupId(null)} style={styles.cancelButton}>Cancel</button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Student Modal */}
      <Modal
        isOpen={!!editingStudent}
        onRequestClose={cancelEdit}
        contentLabel="Edit Student"
        style={{
          overlay: styles.editModal.overlay,
          content: styles.editModal.content,
        }}
      >
        <form onSubmit={handleSubmit} style={styles.editForm}>
          <h3 style={styles.editFormHeader}>Edit Student Details (ID: {editFormData.id})</h3>
          <div style={styles.formSection}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Student ID</label>
                <input
                  type="text"
                  name="id"
                  value={editFormData.id}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>
            </div>
          </div>
          <div style={styles.formSection}>
            <h4 style={styles.sectionHeader}>Student Photo</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ position: 'relative' }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" style={styles.photoPreview} />
                ) : (
                  <div style={styles.photoPlaceholderLarge}>No Photo</div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={triggerFileInput}
                  style={styles.uploadButton}
                >
                  {photoFile ? 'Change Photo' : 'Upload Photo'}
                </button>
                {photoFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(normalizePhotoUrl(editFormData.photo));
                    }}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                )}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  JPEG, PNG or GIF (Max 5MB)
                </div>
              </div>
            </div>
          </div>
          <div style={styles.formSection}>
            <h4 style={styles.sectionHeader}>Personal Information</h4>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Full Name*</label>
                <input
                  type="text"
                  name="name"
                  value={editFormData.name}
                  onChange={handleFormChange}
                  style={{ ...styles.formInput, textTransform: 'uppercase' }}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Username</label>
                <input
                  type="text"
                  name="username"
                  value={editFormData.username}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Password</label>
                <input
                  type="password"
                  name="password"
                  value={editFormData.password}
                  onChange={handleFormChange}
                  placeholder="Leave blank to keep current"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Gender</label>
                <select
                  name="gender"
                  value={editFormData.gender}
                  onChange={handleFormChange}
                  style={styles.formInput}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={editFormData.dob}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>
            </div>
          </div>
          <div style={styles.formSection}>
            <h4 style={styles.sectionHeader}>Contact Information</h4>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Phone Number*</label>
                <input
                  type="text"
                  name="phone_no"
                  value={editFormData.phone_no}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Aadhar Number*</label>
                <input
                  type="text"
                  name="aadhar_no"
                  value={editFormData.aadhar_no}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Father's Name</label>
                <input
                  type="text"
                  name="father_name"
                  value={editFormData.father_name}
                  onChange={handleFormChange}
                  style={{ ...styles.formInput, textTransform: 'uppercase' }}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Address</label>
                <textarea
                  name="address"
                  value={editFormData.address}
                  onChange={handleFormChange}
                  style={{ ...styles.formInput, minHeight: '80px' }}
                />
              </div>
            </div>
          </div>
          <div style={styles.formSection}>
            <h4 style={styles.sectionHeader}>Academic Information</h4>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Class*</label>
                <select
                  name="class_name"
                  value={editFormData.class_name}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      class_name: e.target.value,
                      section: '',
                    }))
                  }
                  style={styles.formInput}
                >
                  <option value="">-- Select Class --</option>
                  {sortClassList(classes).map((classItem, index) => {
                    const classValue = typeof classItem === 'string' ? classItem : classItem?.class_name;
                    if (!classValue) return null;
                    return (
                      <option key={index} value={classValue}>
                        {classValue}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Section</label>
                <select
                  name="section"
                  value={editFormData.section}
                  onChange={handleFormChange}
                  style={styles.formInput}
                  disabled={!editFormData.class_name}
                >
                  <option value="">-- Select Section --</option>
                  {getSectionsForClass(editFormData.class_name).map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Class Teacher</label>
                <input
                  type="text"
                  name="class_teacher"
                  value={editFormData.class_teacher}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>School Name</label>
                <input
                  type="text"
                  name="school_name"
                  value={editFormData.school_name}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>
            </div>
          </div>
          <div style={styles.formSection}>
            <h4 style={styles.sectionHeader}>Academic IDs</h4>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Admission No.</label>
                <input
                  type="text"
                  name="admission_no"
                  value={editFormData.admission_no}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Curriculum</label>
                <input
                  type="text"
                  name="curriculum"
                  value={editFormData.curriculum || ''}
                  onChange={handleFormChange}
                  placeholder="e.g. CBSE / ICSE / State Board"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>CBSE Reg No.</label>
                <input
                  type="text"
                  name="cbse_reg_no"
                  value={editFormData.cbse_reg_no}
                  onChange={handleFormChange}
                  style={styles.formInput}
                />
              </div>
            </div>
          </div>
          <div style={styles.formActions}>
            <button type="submit" style={styles.saveButton} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={cancelEdit} style={styles.cancelButton} disabled={isLoading}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

     {/* Add Student Modal */}
<Modal
  isOpen={isAddingStudent}
  onRequestClose={() => setIsAddingStudent(false)}
  contentLabel="Add User"
  style={{
    overlay: styles.editModal.overlay,
    content: styles.editModal.content,
  }}
>
  <form onSubmit={handleAddStudentSubmit} style={styles.editForm}>
    <h3 style={styles.editFormHeader}>Add New User</h3>
    <div style={styles.formSection}>
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>User Type*</label>
          <select
            name="user_type"
            value={newStudentFormData.user_type}
            onChange={(e) => handleNewStudentFormChange(e, 'user_type')}
            style={styles.formInput}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="management">Management</option>
          </select>
        </div>
      </div>
    </div>

    {/* Common Fields for All User Types */}
    <div style={styles.formSection}>
      <h4 style={styles.sectionHeader}>User Photo</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ position: 'relative' }}>
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" style={styles.photoPreview} />
          ) : (
            <div style={styles.photoPlaceholderLarge}>No Photo</div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
        <div>
          <button
            type="button"
            onClick={triggerFileInput}
            style={styles.uploadButton}
          >
            {photoFile ? 'Change Photo' : 'Upload Photo'}
          </button>
          {photoFile && (
            <button
              type="button"
              onClick={() => {
                setPhotoFile(null);
                setPhotoPreview('');
              }}
              style={styles.removeButton}
            >
              Remove
            </button>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            JPEG, PNG or GIF (Max 5MB)
          </div>
        </div>
      </div>
    </div>

    <div style={styles.formSection}>
      <h4 style={styles.sectionHeader}>Personal Information</h4>
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Full Name*</label>
          <input
            type="text"
            name="name"
            value={newStudentFormData.name}
            onChange={(e) => handleNewStudentFormChange(e, 'name')}
            style={{ ...styles.formInput, textTransform: 'uppercase' }}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Username</label>
          <input
            type="text"
            name="username"
            value={newStudentFormData.username}
            onChange={(e) => handleNewStudentFormChange(e, 'username')}
            style={styles.formInput}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Password</label>
          <input
            type="password"
            name="password"
            value={newStudentFormData.password}
            onChange={(e) => handleNewStudentFormChange(e, 'password')}
            placeholder="Leave blank to keep current"
            style={styles.formInput}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Gender</label>
          <select
            name="gender"
            value={newStudentFormData.gender}
            onChange={(e) => handleNewStudentFormChange(e, 'gender')}
            style={styles.formInput}
          >
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Date of Birth</label>
          <input
            type="date"
            name="dob"
            value={newStudentFormData.dob}
            onChange={(e) => handleNewStudentFormChange(e, 'dob')}
            style={styles.formInput}
          />
        </div>
      </div>
    </div>

    <div style={styles.formSection}>
      <h4 style={styles.sectionHeader}>Contact Information</h4>
      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Phone Number</label>
          <input
            type="text"
            name="phone_no"
            value={newStudentFormData.phone_no}
            onChange={(e) => handleNewStudentFormChange(e, 'phone_no')}
            style={styles.formInput}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Aadhar Number</label>
          <input
            type="text"
            name="aadhar_no"
            value={newStudentFormData.aadhar_no}
            onChange={(e) => handleNewStudentFormChange(e, 'aadhar_no')}
            style={styles.formInput}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Father's Name</label>
          <input
            type="text"
            name="father_name"
            value={newStudentFormData.father_name}
            onChange={(e) => handleNewStudentFormChange(e, 'father_name')}
            style={{ ...styles.formInput, textTransform: 'uppercase' }}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Address</label>
          <textarea
            name="address"
            value={newStudentFormData.address}
            onChange={(e) => handleNewStudentFormChange(e, 'address')}
            style={{ ...styles.formInput, minHeight: '80px' }}
          />
        </div>
      </div>
    </div>

    {/* Conditional Fields Based on User Type */}
    {newStudentFormData.user_type === 'student' && (
      <div style={styles.formSection}>
        <h4 style={styles.sectionHeader}>Academic Information</h4>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Class*</label>
            <select
              name="class_name"
              value={newStudentFormData.class_name}
              onChange={(e) => {
                handleNewStudentFormChange(e, 'class_name');
                setNewStudentFormData((prev) => ({ ...prev, section: '' }));
              }}
              style={styles.formInput}
            >
              <option value="">-- Select Class --</option>
              {sortClassList(classes).map((classItem, index) => {
                const classValue = typeof classItem === 'string' ? classItem : classItem?.class_name;
                if (!classValue) return null;
                return (
                  <option key={index} value={classValue}>
                    {classValue}
                  </option>
                );
              })}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Section</label>
            <select
              name="section"
              value={newStudentFormData.section}
              onChange={(e) => handleNewStudentFormChange(e, 'section')}
              style={styles.formInput}
              disabled={!newStudentFormData.class_name}
            >
              <option value="">-- Select Section --</option>
              {getSectionsForClass(newStudentFormData.class_name).map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Class Teacher</label>
            <input
              type="text"
              name="class_teacher"
              value={newStudentFormData.class_teacher}
              onChange={(e) => handleNewStudentFormChange(e, 'class_teacher')}
              style={styles.formInput}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>School Name</label>
            <input
              type="text"
              name="school_name"
              value={newStudentFormData.school_name}
              onChange={(e) => handleNewStudentFormChange(e, 'school_name')}
              style={styles.formInput}
            />
          </div>
        </div>
      </div>
    )}

    {newStudentFormData.user_type === 'student' && (
      <div style={styles.formSection}>
        <h4 style={styles.sectionHeader}>Academic IDs</h4>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Admission No.</label>
            <input
              type="text"
              name="admission_no"
              value={newStudentFormData.admission_no}
              onChange={(e) => handleNewStudentFormChange(e, 'admission_no')}
              style={styles.formInput}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Curriculum</label>
            <input
              type="text"
              name="curriculum"
              value={newStudentFormData.curriculum || ''}
              onChange={(e) => handleNewStudentFormChange(e, 'curriculum')}
              placeholder="e.g. CBSE / ICSE / State Board"
              style={styles.formInput}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>CBSE Reg No.</label>
            <input
              type="text"
              name="cbse_reg_no"
              value={newStudentFormData.cbse_reg_no}
              onChange={(e) => handleNewStudentFormChange(e, 'cbse_reg_no')}
              style={styles.formInput}
            />
          </div>
        </div>
      </div>
    )}

    {/* Teacher and Management Specific Fields */}
    {(newStudentFormData.user_type === 'teacher' || newStudentFormData.user_type === 'management') && (
      <div style={styles.formSection}>
        <h4 style={styles.sectionHeader}>Designation</h4>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Designation</label>
            <input
              type="text"
              name="designation"
              value={newStudentFormData.designation || ''}
              onChange={(e) => handleNewStudentFormChange(e, 'designation')}
              style={styles.formInput}
            />
          </div>
        </div>
      </div>
    )}

    {/* Teacher-Specific Fields */}
    {newStudentFormData.user_type === 'teacher' && (
      <div style={styles.formSection}>
        <h4 style={styles.sectionHeader}>Teaching Classes</h4>
        <div style={styles.formGrid}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
            <div style={styles.formGroup} key={num}>
              <label style={styles.formLabel}>Teaches to Class {num}</label>
              <input
                type="text"
                name={`teaches_to_${num}`}
                value={newStudentFormData[`teaches_to_${num}`] || ''}
                onChange={(e) => handleNewStudentFormChange(e, `teaches_to_${num}`)}
                style={styles.formInput}
              />
            </div>
          ))}
        </div>
      </div>
    )}

    <div style={styles.formActions}>
      <button type="submit" style={styles.saveButton} disabled={isLoading}>
        {isLoading ? 'Adding...' : 'Add User'}
      </button>
      <button
        type="button"
        onClick={() => setIsAddingStudent(false)}
        style={styles.cancelButton}
        disabled={isLoading}
      >
        Cancel
      </button>
    </div>
  </form>
</Modal>

    </div>
  );
};

export default StudentManagementedit;
