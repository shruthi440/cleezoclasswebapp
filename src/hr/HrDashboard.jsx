import React, { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faAngleRight, faTimes, faHome, faUserPlus } from "@fortawesome/free-solid-svg-icons";

import './HrDashboard.css';
import abcLogo from "../assets/abc school.png";
import { useNavigate } from "react-router-dom";

import EventAndMeetings from "./HR_EventsMettings.jsx";
import Biometric from "./HR_Biometric.jsx";
import BiometricTeacher from "./HR_BiometricTeacher.jsx";
import Header from "../shared/header.jsx";
import StudentData from '../shared/StudentData.jsx';
import { Bot, BotIcon, CalendarRange, Fingerprint, UserCog, UserPlus, LayoutDashboardIcon, School, GraduationCap, CalendarDays, UserRoundPlus, BookUser } from "lucide-react";
import { FaCalendarCheck, FaClock, FaFingerprint, FaHandsHelping, FaHireAHelper, FaRegCalendarCheck, FaTasks, FaUser, FaUserPlus, FaUserTie } from "react-icons/fa";
import TeacherManagement from "../shared/Teacherediting.jsx";
import TeacherUpload from "../shared/Teacherupload.jsx";

import createEmployeeIcon from "../assets/create-fee.png";
import addAttendanceIcon from "../assets/add-fee.png";
import assistantIcon from "../assets/Assistant.png";

import GlobalLoader from "../shared/GlobelLoading.tsx";
import axios from "axios";


const ModalContent = ({ route, onClose }) => {
  let content;
  switch (route) {
    case "/EventAndMeetings":
      content = <EventAndMeetings />;
      break;
    case "/Biometric":
      content = <Biometric />;
      break;
    case "/BiometricTeacher":
      content = <BiometricTeacher />;
      break;
    case "/StudentData":
      content = <StudentData />;
      break;
    case "/operations/timetable":
      content = <h3>Timetable Operations Content</h3>;
      break;
    default:
      content = <h3>Content for: {route}</h3>;
  }

  return (
    <div className="globalpopup-overlay" onClick={onClose}>
      <div className="globalpopup-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="globalpopup-close-btn">
          <FontAwesomeIcon icon={faTimes} />
        </button>
        <div className="globalpopup-innerContent">
          {content}
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeComponent, setActiveComponent] = useState(null);
  const font = "'Century Gothic', 'AppleGothic', sans-serif";
  const [loading,setLoading]=useState(false)
  const schoolCode = localStorage.getItem("schoolCode")
const [teacherLeaves, setTeacherLeaves] = useState([]);
const [studentLeaves, setStudentLeaves] = useState([]);
const [leaveLoading, setLeaveLoading] = useState(true);

useEffect(() => {
  const fetchLeaveCounts = async () => {
    try {
      const schoolCode = localStorage.getItem("schoolCode");
      
      // 1. Fetch Teacher Leaves
      const teacherRes = await axios.get(`https://cleezoclass.com:4000/teacher-leave-requests-list`, {
        params: { schoolCode }
      });
      setTeacherLeaves(teacherRes.data || []);

      // 2. Fetch Student Leaves
      const studentRes = await axios.get(`https://cleezoclass.com:4000/leave-requests-list`, {
        params: { schoolCode }
      });
      
      // Filter out teacher leaves if they are mixed in the student API
      const filteredStudents = (studentRes.data || []).filter(leave => leave.username !== 'teacher');
      setStudentLeaves(filteredStudents);

    } catch (error) {
      console.error("Error fetching leave data:", error);
    } finally {
      setLeaveLoading(false);
    }
  };

  fetchLeaveCounts();
}, []);

// Helper to calculate Total, Approved, and Pending
const getLeaveStats = (leaves) => {
  const total = leaves.length;
  const approved = leaves.filter(l => l.status?.toLowerCase() === 'approved').length;
  const pending = leaves.filter(l => l.status?.toLowerCase() === 'pending').length;
  return { total, approved, pending };
};

const teacherStats = getLeaveStats(teacherLeaves);
const studentStats = getLeaveStats(studentLeaves);

useEffect(()=>{
  setLoading(true)
  setTimeout(()=>{
    setLoading(false)
  },2000)
},[])



  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openComponent = (route) => {
    setActiveComponent(route);
  };

  const closeComponent = () => {
    setActiveComponent(null);
  };

  const name = localStorage.getItem('name');
  const navigate = useNavigate();

  const employeeStats = {
    total: 150,
    present: 142,
    absent: 8,
    onLeave: 5
  };

  const attendancePercentage = 94.67;

  const recruitmentPipeline = [
    { stage: "Applications", count: 45, desc: "New applications received" },
    { stage: "Screening", count: 28, desc: "Under initial review" },
    { stage: "Interview", count: 12, desc: "Scheduled for interview" },
    { stage: "Offer", count: 5, desc: "Offer letters sent" },
    { stage: "Onboarding", count: 3, desc: "Joining this week" }
  ];

  const upcomingEvents = [
    { day: 15, month: "Jan", title: "Staff Meeting", desc: "Monthly review meeting" },
    { day: 20, month: "Jan", title: "Training Session", desc: "New system training" },
    { day: 25, month: "Jan", title: "Team Building", desc: "Outdoor activity" },
    { day: 28, month: "Jan", title: "Performance Review", desc: "Q1 reviews" }
  ];

  const handleLogout = () => {
    navigate("/");
    alert("Logging out and navigating to root.");
  };

  const renderActiveComponent = () => {
    switch (activeComponent) {
      case "/TeacherManagement":
        return <TeacherManagement />;
      case "/EventAndMeetings":
        return <EventAndMeetings />;
      case "/Biometric":
        return <Biometric />;
      case "/BiometricTeacher":
        return <BiometricTeacher />;
      case "/StudentData":
        return <StudentData />;
      case "/TeacherUpload":
        return <TeacherUpload />;
      default:
        return null;
    }
  };

  const renderProgressRing = (percentage, label) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#f9b1b8"
          strokeWidth="8"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dy=".3em"
          fontSize="16"
          fontWeight="bold"
          fill="#1f2937"
        >
          {label}
        </text>
      </svg>
    );
  };

  const EventItems = [
    { color: "#868C8F", title: "Recruitments-shortlisted", desc: "add, delete, exit,edit", link: "/BiometricTeacher" },
    { color: "#705B56", title: "Payroll management", desc: "create, delete,edit, salaries, certificates", link: "/BiometricTeacher" },
    { color: "#D4C7B0", title: "Tracking", desc: "Report,unpunctuals,complaint management", link: "/BiometricTeacher" },
  ];

  const ActionItems = [
    { color: "#868C8F", title: "Chat approved", desc: "session no 1024", link: "/BiometricTeacher", buttonType: "Schedule" },
    { color: "#705B56", title: "Festive/Holiday", desc: "Reminder, greeting", link: "/BiometricTeacher", buttonType: "OK" },
    { color: "#868C8F", title: "Utilities", desc: "place drinking water", link: "/BiometricTeacher", buttonType: "OK" },
    { color: "#705B56", title: "Staffsyllabus", desc: "Homework not assigned", link: "/operations/timetable", buttonType: "OK" },
    { color: "#705B56", title: "Staff-Heads", desc: "Homework not assigned", link: "/operations/timetable", buttonType: "OK" },
  ];

  const assistantPanelItems = [
    { color: "#868C8F", title: "Enrollments & Biometrics Guidance", desc: "Use this section to manage enrollment flow, admission updates, and student biometric mapping.", link: "/Biometric" },
    { color: "#705B56", title: "Attendance & Payroll Guidance", desc: "Track attendance irregularities, latecomers, and payroll dependencies.", link: "/BiometricTeacher" },
    { color: "#D4C7B0", title: "Recruitments & Exits Guidance", desc: "Monitor recruitment stages, interview scheduling, joining forms, and employee exits.", link: "/BiometricTeacher" },
    { color: "#868C8F", title: "Events & Meetings Guidance", desc: "Plan HR events, publish meeting agendas, and follow up pending action points.", link: "/EventAndMeetings" },
    { color: "#705B56", title: "Daily HR Checklist", desc: "Review latecomers, leave requests, pending interviews, and payroll blockers before day-close.", link: "/BiometricTeacher" },
  ];

  const EventItem = [
    { color: "#D4C7B0", title: "Exit-management", desc: "Delete biometrics, settlement noc, relieving formality", link: "/BiometricTeacher" },
    { color: "#868C8F", title: "Recruitment profiles", desc: "shortlisted list, Rounds of interviews, joining form", link: "/BiometricTeacher", buttonType: "OK" },
    { color: "#705B56", title: "Interview schedule", desc: "post jobs, roles, & responsibilities, schedules", link: "/BiometricTeacher", buttonType: "OK" },
  ];

  const marketingItems = [
    { color: "#D4C7B0", title: "Enrollments-Eligible", desc: "Hot Lead, Ward Lead", link: "/Biometric" },
    { color: "#868C8F", title: "Enrollment-Admissions", desc: "add, delete, exit, edit", link: "/Biometric" },
    { color: "#868C8F", title: "Enroll-Students", desc: "add, delete, exit, edit", link: "/StudentData" },
  ];

  const marketingItem = [
    { color: "#D4C7B0", title: "Biometrics", desc: "add, edit, delete, exit", link: "/Biometric" },
    { color: "#705B56", title: "Attendance", desc: "Track students, unpunctuals", link: "/Biometric" },
    { color: "#868C8F", title: "Complain", desc: "Report unpunctuals, complain management", link: "/Biometric" },
  ];

  const hrItems = [
    { color: "#D9EEF8", title: "Events-upcoming", desc: "Manual actions, automatic actions, create events", link: "/EventAndMeetings" },
    { color: "#868C8F", title: "Meetings upcoming", desc: "schedule, edit, delete", link: "/EventAndMeetings" },
    { color: "#A39DBD", title: "Status-meetings", desc: "update agendas, report manage", link: "/EventAndMeetings" },
  ];

  const sidebarItems = [
    { title: "DashBoard", icon: LayoutDashboardIcon, route: null },
    { title: "Enrollment's", icon: UserRoundPlus, route: "/TeacherUpload" },
    { title: "Student", icon: BookUser, route: "/Biometric" },
    { title: "Teacher", icon: UserCog, route: "/BiometricTeacher" },
    { title: "Assistant", icon: BotIcon, route: "/BiometricTeacher" },
    { title: "HR Events", icon: CalendarDays, route: "/EventAndMeetings" },
  ];

  const renderCard = (title, items, homepageRoute, split = false, customCardStyle = {}) => {
    const renderDesc = (desc) => {
      if (Array.isArray(desc)) {
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {desc.map((d, idx) => (
              <React.Fragment key={idx}>
                {d.staticText && <span>{d.staticText}</span>}
                {d.boxedText && <span style={{ backgroundColor: "#f0f0f0", padding: "2px 6px", borderRadius: "4px" }}>{d.boxedText}</span>}
                {d.text && <span>{d.text}</span>}
              </React.Fragment>
            ))}
          </div>
        );
      } else {
        return desc;
      }
    };

    const actionBtn = (type) => ({
      backgroundColor: type === "OK" ? "#92D09B" : "#B97FA5",
      border: "none",
      borderRadius: "8px",
      padding: "4px 8px",
      cursor: "pointer",
      fontSize: isMobile ? "10px" : "12px",
      fontWeight: "500",
      fontFamily: font,
      color: "#fff",
      marginLeft: isMobile ? "0" : "auto",
      marginTop: isMobile ? "10px" : "0",
    });

    const listItem = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: isMobile ? "10px" : "5px",
      fontSize: isMobile ? "16px" : "22px",
      flexWrap: isMobile ? "wrap" : "nowrap",
    };

    const smallText = {
      fontSize: isMobile ? "12px" : "15px",
      color: "#666",
      textAlign: "left",
      marginBottom: "4px",
    };

    const itemContent = {
      display: "flex",
      alignItems: "flex-start",
      flexDirection: "column",
      textAlign: "left",
      flex: 1,
    };

    const renderItemContent = (i) => (
      <div
        style={listItem}
        key={i.title}
        onClick={() => openComponent(i.link)}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, height: "65px" }}>
          <div className="title-hover" style={itemContent}>
            <div style={{ fontWeight: "500", cursor: "pointer", fontSize: isMobile ? "14px" : "18px" }}>
              {i.title}
            </div>
            <div style={{ ...smallText, fontSize: isMobile ? "10px" : "12px" }}>
              {renderDesc(i.desc)}
            </div>
          </div>
        </div>

        {items === ActionItems && i.buttonType ? (
          <button
            style={actionBtn(i.buttonType)}
            onClick={(e) => {
              e.stopPropagation();
              alert(`${i.buttonType} clicked for ${i.title}`);
            }}
          >
            {i.buttonType}
          </button>
        ) : null}
      </div>
    );

    if (split) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "1px",
          width: "100%",
          height: "100%",
          overflowY: "auto",
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0) transparent',
        }}>
          {items.map(renderItemContent)}
        </div>
      );
    } else {
      return (
        <div 
          style={{ 
            backgroundColor: "#fff",
            borderRadius: "16px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            padding: "20px",
            cursor: "pointer",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            overflowY: "auto",
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,0,0,0) transparent',
            ...customCardStyle 
          }} 
          onClick={() => openComponent(homepageRoute)}
        >
          {items.map(renderItemContent)}
        </div>
      );
    }
  };

  


  return (
    <div style={{ minHeight: "90vh", }}>
      <Header />
  
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        backgroundColor: "white",
        padding: "10px 20px",
        height:"10px"
        // boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <div style={{ fontSize: "16px", fontWeight: "600", color: "#334155" }}>
     

<div className="hr-topbar">
  <nav className="hr-topbar-left">

    {/* Dashboard — clears active component, shows default grid */}
    <button
      className={`hr-topbar-tab ${activeComponent === null ? "hr-topbar-tab-active" : ""}`}
      onClick={() => setActiveComponent(null)}
    >
   Dashboard
    </button>
    <button
      className={`hr-topbar-tab ${activeComponent === "/TeacherUpload" ? "hr-topbar-tab-active" : ""}`}
      onClick={() => openComponent("/TeacherUpload")}
    >
    Enrollment's
    </button>
    {/* Student — same as sidebar Biometric */}
    <button
      className={`hr-topbar-tab ${activeComponent === "/Biometric" ? "hr-topbar-tab-active" : ""}`}
      onClick={() => openComponent("/Biometric")}
    >
  Student
    </button>

    {/* Teacher — same as sidebar BiometricTeacher */}
    <button
      className={`hr-topbar-tab ${activeComponent === "/BiometricTeacher" ? "hr-topbar-tab-active" : ""}`}
      onClick={() => openComponent("/BiometricTeacher")}
    >
   Teacher
    </button>

    {/* HR Events — same as sidebar Events */}
    <button
      className={`hr-topbar-tab ${activeComponent === "/EventAndMeetings" ? "hr-topbar-tab-active" : ""}`}
      onClick={() => openComponent("/EventAndMeetings")}
    >
  HR Events
    </button>

  </nav>

  {/* <div className="hr-topbar-right">
    <button
      className={`hr-topbar-tab ${activeComponent === "/TeacherManagement" ? "hr-topbar-tab-active" : ""}`}
      onClick={() => openComponent("/TeacherManagement")}
    >
    Employee Data
    </button>

  </div> */}
</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          {/* <button className="btn-dropdown" onClick={() => setActiveComponent("/TeacherManagement")}>
            Employee Data
          </button> */}
          <FontAwesomeIcon icon={faBell} style={{ fontSize: "24px", color: "#555", cursor: "pointer" }} />
        </div>
      </div>

      <div style={{
        display: "flex",
        alignItems: "flex-start",
        width: "100%",
        height: "calc(86vh - 110px)"
      }}>
        <div className="accountant-sidebar-strip">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`accountant-sidebar-item ${activeComponent === item.route ? "accountant-sidebar-item-active" : ""}`}
                onClick={() => openComponent(item.route)}
              >
                <div className="accountant-sidebar-item-icon">
                  <Icon size={28} />
                </div>
                <span>{item.title}</span>
              </div>
            );
          })}
        </div>

        <div style={{
          flex: 1,
          background: "#fff",
          borderRadius: "1px",
          padding: "0px",
          height: "calc(100vh - 140px)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          overflowY: "auto",
          overflowX: "hidden"
        }}>
          {activeComponent ? (
            <div style={{ padding: "20px" }}>
              {renderActiveComponent()}
            </div>
          ) : (
            <>
    

              <div className="hr-grid">
                <div className="hr-row-top">
                  <div className="hr-welcome-block">
                    <h2>Hi, {name || "HR Manager"}!</h2>
                    <p>Check Employee Status,</p>
                    <p>Review Attendance Reports</p>
                    <p>Manage Recruitment Pipeline</p>
                  </div>

                  <div className="hr-task-card hr-card">
                    <div className="task-header">
                      <h3>
                          <FaTasks className="bio-icon" />
                          Task of the Day</h3>
                    </div>
                    <div className="task-content">
                      <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px" }}>
                        <h4 style={{ margin: "0 0 0.5rem 0", color: "#1f2937" }}>Review Leave Requests</h4>
                        <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b7280" }}>
                          5 pending leave requests need approval
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="hr-mini-cards">
                    <div className="hr-quick-card" onClick={() => openComponent("/TeacherUpload")}>
                      <img src={createEmployeeIcon} alt="Add Employee" />
                      <h4>Add Student 
                        | Employee</h4>
                      <p>New  onboarding's</p>
                    </div>

                    <div className="hr-quick-card" onClick={() => openComponent("/Biometric")}>
                      <img src={addAttendanceIcon} alt="Mark Attendance" />
                      <h4>Mark Attendance</h4>
                      <p>Daily attendance log</p>
                    </div>

                    <div className="hr-quick-card" onClick={() => openComponent("/BiometricTeacher")}>
                      <img src={assistantIcon} alt="HR Assistant" />
                      <h4>HR Assistant</h4>
                      <p>Daily activity check</p>
                    </div>
                  </div>
                </div>

                <div className="hr-row-middle">
                  <div className="hr-employee-card hr-card">
                    <div className="hr-card-header">
                <h3 className="bio-section-heading">
  <FaUserPlus className="bio-icon" />
  Enrollments & Biometrics

</h3>
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      {renderCard("Marketing", marketingItems, "/marketing", true)}
                    </div>
                  </div>

                  <div className="hr-attendance-card hr-card">
                    <div className="hr-card-header">
                  
<h3 className="bio-section-heading">
  <FaCalendarCheck className="bio-icon" />
  Attendance & Payroll
</h3>
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      {renderCard("Operations", EventItems, "/BiometricTeacher", true)}
                    </div>
                  </div>

                  <div className="hr-recruitment-card hr-card">
                    <div className="hr-card-header">
                <h3 className="bio-section-heading">
  <FaUserTie className="bio-icon" />
  Recruitments & Exits
</h3>
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      {renderCard("Operations", EventItem, "/BiometricTeacher", false)}
                    </div>
                  </div>
                </div>

                <div className="hr-row-bottom">
                  <div className="hr-events-card hr-card">
                    <div className="hr-card-header">
                      <h3>  <FaTasks className="bio-icon" />
                      Assistant Panel</h3>
                      <button
                        type="button"
                        onClick={() => openComponent("/BiometricTeacher")}
                        style={{
                          background: "#f9b1b8",
                          color: "white",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.85rem"
                        }}
                      >
                        View All
                      </button>
                    </div>
                    <div className="events-content">
                      {renderCard("Operations", assistantPanelItems, "", false, { height: "100%" })}
                    </div>
                  </div>

                  <div className="hr-premium-card hr-card">
                    <div className="hr-card-header">
                 
                      <h3><FaRegCalendarCheck className="bio-icon" />
                      Events & Meetings</h3>
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      {renderCard("HR", hrItems, "/EventAndMeetings", false)}
                    </div>
                  </div>


                  
<div className="hr-bottom-right">
  <div className="hr-dashboard-stats-container">

    {/* Top Row */}
    <div className="hr-leaves-row">

      {/* Teacher */}
      <div
        className="hr-card hr-leaves-card"
        onClick={() => openComponent("/BiometricTeacher")}
      >
        <h3 className="hr-card-title">Teacher Leaves</h3>

        {leaveLoading ? (
          <p className="hr-loading">Loading...</p>
        ) : (
          <>
            <div className="hr-stat-item">
              <span>Total Requests</span>
              <strong>{teacherStats?.total || 0}</strong>
            </div>

            <div className="hr-stat-item">
              <span className="hr-approved">Approved</span>
              <strong className="hr-approved">
                {teacherStats?.approved || 0}
              </strong>
            </div>

            <div className="hr-stat-item">
              <span className="hr-pending">Pending</span>
              <strong className="hr-pending">
                {teacherStats?.pending || 0}
              </strong>
            </div>
          </>
        )}
      </div>

      {/* Student */}
      <div
        className="hr-card hr-leaves-card"
        onClick={() => openComponent("/Biometric")}
      >
        <h3 className="hr-card-title">Student Leaves</h3>

        {leaveLoading ? (
          <p className="hr-loading">Loading...</p>
        ) : (
          <>
            <div className="hr-stat-item">
              <span>Total Requests</span>
              <strong>{studentStats?.total || 0}</strong>
            </div>

            <div className="hr-stat-item">
              <span className="hr-approved">Approved</span>
              <strong className="hr-approved">
                {studentStats?.approved || 0}
              </strong>
            </div>

            <div className="hr-stat-item">
              <span className="hr-pending">Pending</span>
              <strong className="hr-pending">
                {studentStats?.pending || 0}
              </strong>
            </div>
          </>
        )}
      </div>

    </div>

<div className="hr-payroll-row" style={{ display: "flex", width: "100%" }}>

  <div className="hr-card hr-payroll-card" style={{ flex: 1 }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        height: "100%",
      }}
    >
      {renderProgressRing(75, "75%")}

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div className="blockText">Payroll Status</div>
        <div className="normalText">Monthly Progress</div>
      </div>
    </div>
  </div>

  {/* Pending Salaries */}
  <div className="hr-card hr-payroll-card" style={{ flex: 1 }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        height: "100%",
      }}
    >
      <p
        className="amount"
        style={{
          margin: 0,
          whiteSpace: "nowrap",
        }}
      >
        ₹45,000
      </p>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div className="blockText">Pending Salaries</div>
        <div className="normalText">For Current Month</div>
      </div>
    </div>
  </div>

</div>
  </div>
</div>
                </div>
              </div>
            </>
          )}
          {
            loading && <GlobalLoader timeoutSeconds={2}/>
          }
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;