import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { Download, Share, ArrowLeft, Circle, X } from 'lucide-react';
import { CheckCircle, Star } from "lucide-react";
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaWhatsapp } from 'react-icons/fa';

const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.cleezoclass&pcampaignid=web_share';
const buildInviteMessage = ({ greeting, name, username, password, schoolName }) => (
  `${greeting} ${name},\n\n` +
  `Your staff account for ${schoolName} is ready.\n\n` +
  `Download the app here:\n${PLAY_STORE_LINK}\n\n` +
  `Login credentials:\nUsername: ${username}\nPassword: ${password}\n\n` +
  `Please sign in using these details and keep them secure.`
);


const TeacherUpload = () => {
  const [uploadedData, setUploadedData] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const navigate = useNavigate();
  const dashboardRef = useRef(null);
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setShowPreview(false);
  }; const [teachers, setteachers] = useState([]);
    const [file, setFile] = useState(null);
    const [popupteacher, setPopupteacher] = useState(null);
    const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    else if (hour < 17) return "Good afternoon";
    else return "Good evening";
  };
  const senderName = localStorage.getItem("schoolCode") || "your school";
 const [dynamicLogoSrc, setDynamicLogoSrc] = useState('');
  const [dynamicSchoolCode, setDynamicSchoolCode] = useState('');
const sendWhatsApp = (teacher) => {
  if (!teacher.phone_no) {
    alert("No phone number available for this teacher");
    return;
  }

  // Clean and format phone number
  const cleanedPhone = String(teacher.phone_no).replace(/\D/g, '');
  let formattedPhone = cleanedPhone.startsWith('91') ? cleanedPhone : `91${cleanedPhone}`;
  formattedPhone = formattedPhone.replace(/^0+/, '');

  // Generate password: first 4 of username + last 4 of phone
  const usernamePart = teacher.username ? teacher.username.slice(0, 4) : 'user';
  const phonePart = cleanedPhone.slice(-4);
  const generatedPassword = teacher.password || `${usernamePart}${phonePart}`;

  const message = buildInviteMessage({
    greeting: getGreeting(),
    name: teacher.name || 'Teacher',
    username: teacher.username || 'Not provided',
    password: generatedPassword,
    schoolName: senderName || 'your school'
  });

  // WhatsApp URL
  const whatsappUrl = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}&app_absent=1`;
  
  window.open(whatsappUrl, '_blank');
};

const sendWhatsAppMessage = async (teacher) => {
  const schoolId = localStorage.getItem("schoolCode");
  const message = buildInviteMessage({
    greeting: getGreeting(),
    name: teacher.name || 'Teacher',
    username: teacher.username || 'Not provided',
    password: teacher.password || 'Not provided',
    schoolName: senderName || 'your school'
  });
  try {
    const response = await axios.post('https://cleezoclass.com:4000/api/whatsapp/send-messagewhatsapp', {
      number: teacher.phone,
      message: message,
      schoolId: schoolId
    });
    alert('✅ WhatsApp message sent!');
  } catch (error) {
    console.error('❌ Failed to send WhatsApp message:', error);
    alert('❌ Failed to send WhatsApp message');
  }
};


const cancelPopup = () => {
    setPopupteacher(null);
  };


const confirmSend = async () => {
  if (popupteacher) {
    const greeting = getGreeting();
    const name = popupteacher.name || "Teacher";
    const username = popupteacher.username;
    const password = popupteacher.password;
    const number = popupteacher.phone_no;

    if (!number) {
      alert("Phone number is missing for this teacher.");
      return;
    }

    const message = buildInviteMessage({
      greeting,
      name,
      username,
      password,
      schoolName: senderName || 'your school'
    });
    const cleanedPhone = String(number).replace(/\D/g, '');
    const formattedPhone = cleanedPhone.startsWith('91') ? cleanedPhone : `91${cleanedPhone}`;
    window.open(
      `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}&app_absent=1`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  setPopupteacher(null);
};








useEffect(() => {
  const fetchSchoolLogo = async () => {
    console.log('🚀 Starting logo fetch process...');

    const code = localStorage.getItem('schoolCode');
    console.log('🧾 localStorage.getItem("schoolCode") =', code, '| Type:', typeof code);

    if (!code) {
      console.warn('❌ No school code found in localStorage. Aborting fetch.');
      return;
    }

    setDynamicSchoolCode(code);
    console.log('📦 Set dynamic school code in state:', code);

    try {
      console.log('📡 Sending POST request to backend with secretecode...');
      const response = await axios.post(
        'https://cleezoclass.com:4000/api/schoollogodynamic',
        { secretecode: code },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📬 Response from backend:', response);
      console.log('📬 Response.data:', response.data);

      if (response.data.logoPath) {
        console.log('✅ Logo fetched successfully from backend.');
        setDynamicLogoSrc(response.data.logoPath);
      } else {
        console.warn('⚠️ No logo path found in backend response.');
      }
    } catch (error) {
      console.error('🔥 Error fetching school logo:', error.response?.data || error.message);
    }
  };

  fetchSchoolLogo();
}, []);

  const normalizeData = (data) => {
    console.log("Raw data from backend:", data);
    return data.map((item) => ({
      name: item.name || "N/A",
      gender: item.gender || "N/A",
      phone: item.phone || item.phone_no || "N/A",
      fatherName: item.father_name || item.fatherName || "N/A",
      username: item.username || "N/A",
      password: item.password || "N/A",
      role: item.user_type || item.role || "N/A"
    }));
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      alert("Please select a file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setPreviewData(jsonData);
      setShowPreview(true);
    };
    reader.readAsArrayBuffer(selectedFile);
  };
const handleConfirmSubmit = async () => {
  setIsLoading(true);
  const formData = new FormData();
  const schoolCode = localStorage.getItem("schoolCode");

  console.log("📤 Submitting file for teacher upload");
  console.log("🏫 School Code:", schoolCode);
  console.log("📄 Selected file:", selectedFile?.name);

  if (!selectedFile) {
    alert("Please select a file.");
    setIsLoading(false);
    return;
  }

  if (!schoolCode) {
    alert("School code missing in localStorage.");
    setIsLoading(false);
    return;
  }

  formData.append("file", selectedFile);

  try {
    const response = await fetch(`https://cleezoclass.com:4000/api/upload-excel/teacher?schoolCode=${encodeURIComponent(schoolCode)}`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    console.log("✅ Server response:", data);

    if (!response.ok) {
      alert(`❌ Upload failed: ${data.message || "Unknown error."}`);
      setIsLoading(false);
      return;
    }

    const inserted = data.insertedRecords || [];
    const duplicates = data.duplicates || [];

    let alertMessage = `📦 ${data.message || "Upload result"}\n\n`;

    if (inserted.length > 0) {
      alertMessage += `✅ ${inserted.length} record(s) inserted successfully.\n\n`;
    }

    if (duplicates.length > 0) {
      alertMessage += `⚠️ ${duplicates.length} duplicate record(s) skipped:\n\n`;
      duplicates.forEach((dup, index) => {
        alertMessage += `${index + 1})\n`;
        alertMessage += `   Name: ${dup.name || "-"}\n`;
        alertMessage += `   Username: ${dup.username || "-"}\n`;
      });
    }

    if (!inserted.length && !duplicates.length) {
      alertMessage = "⚠️ No valid records found in the uploaded file.";
    }

    alert(alertMessage);
    setSuccessMessage(`${inserted.length} inserted, ${duplicates.length} duplicate(s) skipped`);
    setUploadedData([...inserted, ...duplicates]);
    setSelectedFile(null);
    setShowPreview(false);
  } catch (err) {
    console.error("❗ Network error:", err);
    alert("❗ Network or server error. Please try again later.");
    setSuccessMessage("");
    setUploadedData([{ error: "An error occurred." }]);
  } finally {
    setIsLoading(false);
  }
};
const linkStyle = {
  margin: "0 10px",
  textDecoration: "none",
  display: "flex",
  alignItems: "center"
};

const iconStyle = {
  padding: "10px",
  borderRadius: "50%",
  fontSize: "25px",
  transition: "all 0.3s",
  width: "40px",
  height: "40px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};
  // const handleConfirmSubmit = async () => {
  //   setIsLoading(true);
  //   const formData = new FormData();
  //   const schoolCode = localStorage.getItem("schoolCode");

  //   if (!selectedFile) {
  //     alert("Please select a file.");
  //     setIsLoading(false);
  //     return;
  //   }

  //   if (!schoolCode) {
  //     alert("School code missing in localStorage.");
  //     setIsLoading(false);
  //     return;
  //   }

  //   formData.append("file", selectedFile);
  //   formData.append("school_Code", schoolCode);

  //   try {
  //     const response = await fetch(`https://cleezoclass.com:4000/api/upload-excel/teacher`, {
  //       method: "POST",
  //       body: formData,
  //     });

  //     const data = await response.json();
  //     console.log("✅ Server response:", data);

  //     if (!response.ok) {
  //       alert(`❌ Upload failed: ${data.message || "Unknown error."}`);
  //       setIsLoading(false);
  //       return;
  //     }

  //     const inserted = data.insertedRecords || [];
  //     const duplicates = data.duplicates || [];
  //     let alertMessage = `📦 ${data.message || "Upload result"}\n\n`;

  //     if (inserted.length > 0) {
  //       alertMessage += `✅ ${inserted.length} record(s) inserted successfully.\n\n`;
  //     }

  //     if (duplicates.length > 0) {
  //       alertMessage += `⚠️ ${duplicates.length} duplicate record(s) skipped:\n\n`;
  //       duplicates.forEach((dup, index) => {
  //         alertMessage += `${index + 1})\n`;
  //         Object.entries(dup).forEach(([key, value]) => {
  //           alertMessage += `   ${key}: ${value || "-"}\n`;
  //         });
  //         alertMessage += "\n";
  //       });
  //     }

  //     if (!inserted.length && !duplicates.length) {
  //       alertMessage = "⚠️ No valid records found in the uploaded file.";
  //     }

  //     alert(alertMessage);
  //     setSuccessMessage(`${inserted.length} inserted, ${duplicates.length} duplicate(s) skipped`);
  //     setUploadedData([...inserted, ...duplicates]);
  //     setSelectedFile(null);
  //     setShowPreview(false);
  //   } catch (err) {
  //     console.error("❗ Network error:", err);
  //     alert("❗ Network or server error. Please try again later.");
  //     setSuccessMessage("");
  //     setUploadedData([{ error: "An error occurred." }]);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  const downloadExcel = () => {
    if (uploadedData.length === 0) {
      alert("No data to download");
      return;
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(uploadedData);
    XLSX.utils.book_append_sheet(wb, ws, "TeacherData");
    XLSX.writeFile(wb, `teacher_data.xlsx`);
  };
const renderTableHeaders = (data, isPreview = false) => {
  if (data.length === 0) return null;
  return (
    <tr style={{ backgroundColor: "#5a7488", color: "white" }}>
      {Object.keys(data[0]).map((key) => (
        <th key={key} style={thStyle}>{key}</th>
      ))}
      {!isPreview && <th style={thStyle}>WhatsApp</th>}
    </tr>
  );
};



useEffect(() => {
  console.log("Popup teacher state changed:", popupteacher);
}, [popupteacher]);

const renderTableData = (data, isPreview = false) => {
  console.log("Data being rendered:", data); // Debugging line
  if (data.length === 0) return (
    <tr>
      <td colSpan={Object.keys(data[0] || {}).length + (isPreview ? 0 : 1)} style={{ textAlign: "center", padding: "20px" }}>
        No data available
      </td>
    </tr>
  );
  return data.map((item, index) => (
    <tr key={index} style={{ backgroundColor: index % 2 === 0 ? "#f1f1f1" : "white" }}>
      {Object.values(item).map((value, idx) => (
        <td key={idx} style={tdStyle}>{value}</td>
      ))}
      {/* Render WhatsApp icon only in the preview table */}
      {!isPreview && item.phone_no ? (
        <td style={tdStyle}>
          <button
            onClick={() => sendWhatsApp(item)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Send WhatsApp Message"
          >
            <FaWhatsapp size={22} color="green" />
          </button>
        </td>
      ) : null}
    </tr>
  ));
};

  const thStyle = {
    padding: "10px",
    border: "1px solid #ddd",
  };

  const tdStyle = {
    padding: "10px",
    border: "1px solid #ddd",
  };

  const handleBackClick = () => {
    navigate('/TeacherManagement');
  };

  const userRole = localStorage.getItem('userRole');

  return (
    <>
    <header style={{
  backgroundColor: '#fff',
  color: 'white',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  position: 'fixed',
  width: '100%',
  top: '0',
  zIndex: '50',
  height: '100px',
  display: 'flex',
  alignItems: 'center',
  borderBottom: '12px solid black' // Add this line
}}>
  {/* Responsive styles via style tag */}
  <style>
    {`
      @media (max-width: 768px) {
        .header-logo {
          height: 50px !important;
          left: 1rem !important;
        }
        .header-title {
          font-size: 1rem !important;
          padding: 0 0.5rem !important;
        }
        .header-wrapper {
          padding: 0.5rem !important;
        }
      }

      @media (max-width: 480px) {
        .header-logo {
          height: 40px !important;
          left: 0.5rem !important;
        }
        .header-title {
          font-size: 0.9rem !important;
        }
      }
    `}
  </style>

  {/* Logo */}
  <Link to="/RecruitmentDashboard">
       <img
         src={dynamicLogoSrc || "/default-logo.png"}
         alt="School Logo"
         className="header-logo"
         style={{
           height: '80px',
           width: 'auto',
           borderRadius: '1px',
           position: 'absolute',
           left: '3rem',
           top: '50%',
           transform: 'translateY(-50%)',
           paddingLeft: '1rem'
         }}
       />
     </Link>

  {/* Flex Wrapper */}
  <div
    className="header-wrapper"
    style={{
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0.75rem 1rem',
      display: 'flex',
      justifyContent: 'center',
      position: 'relative'
    }}
  >
    <h1
      className="header-title"
      style={{
        fontSize: '1.5rem',
        fontWeight: '600',
        margin: 0,
        whiteSpace: 'nowrap',
        color: 'black'
      }}
    >
      {dynamicSchoolCode.replace(/_/g, ' ')} SCHOOL
    </h1>
  </div>
</header>

      <div className="outer-container" style={{ paddingTop: '100px' }}>
        <aside className="sidebar">
          <div className="logo"></div>
       <nav className="nav-icons">
  {/* Operations */}
  {['superadmin','director','management', 'Teacher', 'Admin'].includes(userRole) ? (
    <Link to="/homepage3" style={linkStyle}>
      <i className="fa fa-graduation-cap" title="Operations" style={iconStyle}></i>
    </Link>
  ) : (
    <span style={{ ...linkStyle, pointerEvents: 'none', opacity: 0.5 }}>
      <i className="fa fa-graduation-cap" title="Operations (Access Restricted)" style={iconStyle}></i>
    </span>
  )}

  {/* Admissions */}
  {['superadmin','director', 'Admin','management', 'Admission Counsellor'].includes(userRole) ? (
    <Link to="/marketing" style={linkStyle}>
      <i className="fa fa-id-card" title="Admissions" style={iconStyle}></i>
    </Link>
  ) : (
    <span style={{ ...linkStyle, pointerEvents: 'none', opacity: 0.5 }}>
      <i className="fa fa-id-card" title="Admissions (Access Restricted)" style={iconStyle}></i>
    </span>
  )}

  {/* Commerce */}
  {['superadmin','director','management', 'accountant'].includes(userRole) ? (
    <Link to="/AccountantDashboard" style={linkStyle}>
      <i className="fa fa-calculator" title="Commerce" style={iconStyle}></i>
    </Link>
  ) : (
    <span style={{ ...linkStyle, pointerEvents: 'none', opacity: 0.5 }}>
      <i className="fa fa-calculator" title="Commerce (Access Restricted)" style={iconStyle}></i>
    </span>
  )}

  {/* Services */}
  {['superadmin', 'director','management','Admin'].includes(userRole) ? (
    <Link to="/services" style={linkStyle}>
      <i className="fa fa-tasks" title="School Services" style={iconStyle}></i>
    </Link>
  ) : (
    <span style={{ ...linkStyle, pointerEvents: 'none', opacity: 0.5 }}>
      <i className="fa fa-tasks" title="School Services (Access Restricted)" style={iconStyle}></i>
    </span>
  )}

  {/* Support */}
  {['superadmin','management', 'Admin'].includes(userRole) ? (
    <Link to="/SupportTeamCategories" style={linkStyle}>
      <i className="fa fa-users" title="Support" style={iconStyle}></i>
    </Link>
  ) : (
    <span style={{ ...linkStyle, pointerEvents: 'none', opacity: 0.5 }}>
      <i className="fa fa-users" title="Support (Access Restricted)" style={iconStyle}></i>
    </span>
  )}

  {/* Settings */}
  {['superadmin','director', 'management','Admin'].includes(userRole) ? (
    <Link to="/settings" style={linkStyle}>
      <i className="fa fa-cog" title="Settings" style={iconStyle}></i>
    </Link>
  ) : (
    <span style={{ ...linkStyle, pointerEvents: 'none', opacity: 0.5 }}>
      <i className="fa fa-cog" title="Settings (Access Restricted)" style={iconStyle}></i>
    </span>
  )}

  {/* Nova Web App - Always enabled */}
  <a
    href="https://nova.tagsol.tech/"
    target="_blank"
    rel="noopener noreferrer"
    style={linkStyle}
  >
    <i className="fa fa-globe" title="Nova Web App" style={iconStyle}></i>
  </a>
</nav>
        </aside>
        <div className="main-content">
        
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              fontFamily: 'Segoe UI, sans-serif',
              backgroundColor: '#f4f6f9',
              boxSizing: 'border-box',
             
              width: '100%',
            }}
            ref={dashboardRef}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                fontFamily: 'Arial, sans-serif',
                backgroundColor: 'white',
                color: 'black',
                boxSizing: 'border-box',
                width: '90%',
                maxWidth: '1000px',
                margin: '0 auto',
                border: '1px solid #ccc',
                borderRadius: '10px',
                boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
                minHeight: '420px'
              }}
            >
              <h1 style={{
                textAlign: 'center',
                fontSize: '38px',
                fontWeight: 'bold',
                marginBottom: '30px'
              }}>
                Teacher Data Upload
              </h1>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '27px',
              }}>
                Upload a file for TEACHER
              </h3>
              <div style={{
                width: "100%",
                margin: "10px auto",
                padding: "5px",
                fontFamily: "Arial, sans-serif",
                overflow: "hidden"
              }}>
                <p style={{ margin: "5px 0" }}>
                  <span style={{ fontWeight: "bold", fontSize: '19px', color: "#b71c1c" }}>⚠️ Mandatory fields:</span>
                  <span style={{
                    fontFamily: "Arial",
                    color: '#b71c1c',
                    paddingLeft: '16px',
                    fontStyle: 'italic',
                    fontWeight: 'bold',
                    fontSize: '16px'
                  }}>
                    Name, Mobile number, Class_assigned_1 to 5, Designation
                  </span>
                </p>
                <p style={{
                  margin: "15px 0",
                  fontWeight: "bold",
                  color: "#b71c1c"
                }}>
                  🔴 Upload teacher XL data in this Order format only:
                </p>
                <div style={{
                  width: "100%",
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                  position: "relative",
                  paddingBottom: "10px"
                }}>
                  <table style={{
                    borderCollapse: "collapse",
                    backgroundColor: "#ffebee",
                    fontSize: "15px",
                    marginBottom: "0px"
                  }}>
                    <thead>
                      <tr>
                        {[
                          "name", "gender", "phone_no", "aadhar_no", "father_name", "designation",
                          "class_assigned_1", "class_assigned_2", "class_assigned_3", "class_assigned_4",
                          "class_assigned_5", "address", "teacher_photo"
                        ].map((header, index) => (
                          <td key={index} style={{
                            border: "1px solid #ddd",
                            padding: "6px 12px",
                            textAlign: "center",
                            color: "#b71c1c",
                            fontWeight: "bold",
                            whiteSpace: "nowrap"
                          }}>
                            {header}
                          </td>
                        ))}
                      </tr>
                    </thead>
                  </table>
                </div>
              </div>
              <div style={{
                marginBottom: '20px',
                textAlign: 'center',
                width: '100%',
                marginBottom: '33px'
              }}>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileChange}
                  value={selectedFile ? "" : undefined}
                  style={{ fontSize: '16px' }}
                />
                {selectedFile && (
                  <p style={{ color: 'blue', marginTop: '10px' }}>
                    Selected file: {selectedFile.name}
                  </p>
                )}
              </div>
              <button
                onClick={handleSubmit}
                style={{
                  padding: '10px 30px',
                  backgroundColor: '#5a7488',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Circle size={18} className="spin" style={{ marginRight: '8px' }} />
                    Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
              {successMessage && (
                <div style={{
                  color: 'green',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginBottom: '20px'
                }}>
                  {successMessage}
                </div>
              )}
                         {showPreview && (
                <div style={{ width: '100%', marginTop: '20px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      Preview of Uploaded Teacher Data
                    </h2>
                    <button
                      onClick={handleConfirmSubmit}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'rgb(125,103,101)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Confirm and Upload
                    </button>
                  </div>
                  {/* Render Preview Table Directly - NO WhatsApp Column */}
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                      <thead>
                         {/* Use renderTableHeaders but indicate it's preview */}
                         {renderTableHeaders(previewData, true)}
                      </thead>
                      <tbody>
                        {/* Render preview data rows directly - NO WhatsApp Cell */}
                        {previewData.length > 0 ? (
                          previewData.map((item, index) => (
                            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? "#f1f1f1" : "white" }}>
                              {Object.values(item).map((value, idx) => (
                                <td key={idx} style={tdStyle}>{value}</td>
                              ))}
                              {/* NO WhatsApp Cell here */}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={Object.keys(previewData[0] || {}).length} style={{ textAlign: "center", padding: "20px" }}>
                              No data available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => setShowPreview(false)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'gray',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      marginTop: '10px'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div style={{ width: '100%', marginTop: '20px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    Uploaded Teacher Data
                  </h2>
                  {uploadedData.length > 0 && (
                    <button
                      onClick={downloadExcel}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'rgb(125,103,101)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Download as Excel
                    </button>
                  )}
                </div>
           {uploadedData.length > 0 ? (
  <div style={{ overflowX: 'auto', width: '100%' }}>
    {/* Render Uploaded Data Table Directly - WITH WhatsApp Column */}
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
       {/* Explicitly define headers including WhatsApp */}
      <thead>
        <tr style={{ backgroundColor: "#5a7488", color: "white" }}>
           {/* Dynamically create headers based on keys of the first item */}
           {Object.keys(uploadedData[0]).map((key) => (
             <th key={key} style={thStyle}>{key}</th>
           ))}
           {/* Add WhatsApp header explicitly */}
          <th style={thStyle}>WhatsApp</th>
        </tr>
      </thead>
      <tbody>
         {/* Render uploaded data rows directly - WITH WhatsApp Cell */}
        {uploadedData.map((item, index) => (
          <tr key={index} style={{ backgroundColor: index % 2 === 0 ? "#f1f1f1" : "white" }}>
            {/* Render data cells */}
            {Object.values(item).map((value, idx) => (
              <td key={idx} style={tdStyle}>{value}</td>
            ))}
            {/* Render WhatsApp Cell only for uploaded data */}
            <td style={tdStyle}>
              {/* Check if phone number exists before showing icon */}
              {item.phone_no ? (
                <button
                  onClick={() => sendWhatsApp(item)} // Use existing function
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  title="Send WhatsApp Message"
                >
                  <FaWhatsapp size={22} color="green" />
                </button>
              ) : (
                'N/A'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
) : (
  <p style={{ textAlign: 'center', padding: '10px', fontSize: '16px', fontWeight: 'bold', color: 'red' }}>
    No records uploaded.
  </p>
)}

{/* WhatsApp QR modal removed in favor of direct Play Store invite messaging. */}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherUpload;

const linkStyle = {
  margin: "0 10px",
  textDecoration: "none",
  display: "flex",
  alignItems: "center"
};
const popupOverlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const popupBoxStyle = {
  backgroundColor: '#fff',
  padding: '20px',
  borderRadius: '8px',
  width: '300px',
  color: '#000',
  boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
};

const cancelBtn = {
  backgroundColor: 'gray',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '4px'
};

const sendBtn = {
  backgroundColor: 'green',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '4px'
};

const buttonStyle = {
  padding: '10px 20px',
  backgroundColor: '#4CAF50',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer'
};

const iconStyle = {
  padding: "10px",
  borderRadius: "50%",
  fontSize: "25px",
  transition: "all 0.3s",
  width: "40px",
  height: "40px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};
