import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faAngleRight, faTimes } from "@fortawesome/free-solid-svg-icons"; // Added faTimes for modal close button
import './tabhower.css'
import abcLogo from "../assets/abc school.png"; // adjust path if needed
import { useNavigate } from "react-router-dom";

// --- START: Dummy Modal Components for demonstration ---
// In a real application, you would import these from the files you mentioned:
import EventAndMeetings from "./HR_EventsMettings.jsx";
import Biometric from "./HR_Biometric.jsx";
import BiometricTeacher from "./HR_BiometricTeacher.jsx";
import Header from "../shared/header.jsx";
    
import StudentData from '../shared/StudentData.jsx'
import { Bot, BotIcon, CalendarRange, Fingerprint, UserCog, UserPlus } from "lucide-react";

const ModalContent = ({ route, onClose }) => {
  let content;
  // This is where you would conditionally render your imported components
  // based on the 'route' prop.
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
    <div
   className="globalpopup-overlay"
    onClick={onClose}          // CLOSE WHEN CLICKING OUTSIDE
  >
    <div
     className="globalpopup-content"
      onClick={(e) => e.stopPropagation()}   // PREVENT CLOSE WHEN CLICKING INSIDE
    >
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



// --- END: Dummy Modal Components for demonstration ---


const AdminDashboard = () => {
  // Removed 'useNavigate' since we are using modals instead of navigation

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
const [activeComponent, setActiveComponent] = useState(null);
  const font = "'Century Gothic', 'AppleGothic', sans-serif";

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
const name=localStorage.getItem('name')

  const outerContainer = {
    display: "flex",
    flexDirection: "column",
    // gap: isMobile ? "20px" : "50px",
    minHeight: "100vh",
    width: "100%",
    padding: isMobile ? "10px" : "20px",
    boxSizing: "border-box",
    backgroundColor: "#6b7983ff",
  };
  const container = {
    fontFamily: font,
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: isMobile ? "10px 5px" : "5px",
    boxSizing: "border-box",
    width: "100%",
    minWidth: "300px",
  };

  const header = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: "16px 16px 0 0",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.2)",
    padding: isMobile ? "15px" : "25px",
    marginBottom: isMobile ? "15px" : "25px",
    flexWrap: isMobile ? "wrap" : "nowrap",
    gap: isMobile ? "10px" : "0",
    position: "sticky",
    top: 0,
    zIndex: 1000,
  };

  const logoBox = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    order: isMobile ? 1 : 0,
  };

const logo = {
  width: "60px",
  height: "60px",
  backgroundImage: `url(${abcLogo})`,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
  borderRadius: "8px",
};

  const logoText = { fontSize: isMobile ? "16px" : "18px", fontWeight: "600" };
  const logoSub = { fontSize: isMobile ? "10px" : "12px", color: "#777" };

  const schoolTitle = {
    fontSize: isMobile ? "16px" : "20px",
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    flex: isMobile ? "1 1 100%" : 1,
    order: isMobile ? 3 : 0,
    marginTop: isMobile ? "10px" : "0",
  };

  const buttonGroup = {
    display: "flex",
    gap: "10px",
    order: isMobile ? 2 : 0,
  };

  const btn = {
    backgroundColor: "#6b7983ff",
    border: "none",
    borderRadius: "16px",
    padding: isMobile ? "6px 10px" : "8px 16px",
    cursor: "pointer",
    fontSize: isMobile ? "12px" : "14px",
    fontWeight: "500",
    fontFamily: font,
    color: "#fff",
  };

  // Grid Structure Styles (No changes)
  const mainGrid = {
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    padding: "10px",
    gap: "20px",
  };

  const leftColumnContainer = {
    flex: isMobile ? "1 1 100%" : 6,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  };

  const rightColumnContainer = {
    flex: isMobile ? "1 1 100%" : 4,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  };

  // Card Styles (No changes)
  const card = {
    backgroundColor: "#fff",
    borderRadius: "16px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    padding: "20px",
    cursor: "pointer",
    height: "300px",
    display: "flex",
    flexDirection: "column",
    borderLeft: "8px solid #945f4aff",
    justifyContent: "flex-start",
    overflowY: "auto",
     scrollbarWidth: 'thin', // for Firefox
  scrollbarColor: 'rgba(0,0,0,0) transparent', // for Firefox
  };

  const sectionTitle = {
    fontSize: isMobile ? "18px" : "20px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "10px",
    textAlign: "left",
    padding: "0 10px",
    width: "100%",
    boxSizing: "border-box",
  };

  const listItem = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: isMobile ? "10px" : "5px",
    fontSize: isMobile ? "16px" : "22px",
    flexWrap: isMobile ? "wrap" : "nowrap",
  };

  const circle = (color) => ({
    width: isMobile ? "30px" : "50px",
    height: isMobile ? "30px" : "50px",
    minWidth: isMobile ? "30px" : "50px",
    borderRadius: "50%",
    backgroundColor: color,
    marginRight: "10px",
  });

  const progress = (c1, c2) => ({
    display: "flex",
    width: isMobile ? "60px" : "90px",
    height: "20px",
    borderRadius: "4px",
    overflow: "hidden",
    background: `linear-gradient(to right, ${c1} 60%, ${c2} 40%)`,
    marginLeft: isMobile ? "0" : "auto",
    marginTop: isMobile ? "10px" : "0",
  });

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

  const descBox = {
    backgroundColor: "#f0f0f0",
    padding: "2px 6px",
    borderRadius: "4px",
    margin: "0 2px",
    fontSize: isMobile ? "12px" : "14px",
  };

  // Data (No changes)
  const EventItems = [
    {
      color: "#868C8F",
      title: "Recruitments-shortlisted",
      desc: "add, delete, exit,edit",
      link: "/BiometricTeacher",
    },
    {
      color: "#705B56",
      title: "Payroll management",
      desc: "create, delete,edit, salaries, certificates",
      link: "/BiometricTeacher",
    },
    {
      color: "#D4C7B0",
      title: "Tracking",
      desc: "Report,unpunctuals,complaint management",
      link: "/BiometricTeacher",
    },
  ];

  const ActionItems = [
    {
      color: "#868C8F",
      title: "Chat approved",
      desc: "session no 1024",
      link: "/BiometricTeacher",
      buttonType: "Schedule",
    },
    {
      color: "#705B56",
      title: "Festive/Holiday",
      desc: "Reminder, greeting",
      link: "/BiometricTeacher",
      buttonType: "OK",
    },
    {
      color: "#868C8F",
      title: "Utilities",
      desc: "place drinking water",
      link: "/BiometricTeacher",
      buttonType: "OK",
    },
    {
      color: "#705B56",
      title: "Staffsyllabus",
      desc: "Homework not assigned",
      link: "/operations/timetable",
      buttonType: "OK",
    },
    {
      color: "#705B56",
      title: "Staff-Heads",
      desc: "Homework not assigned",
      link: "/operations/timetable",
      buttonType: "OK",
    },
  ];
  const assistantPanelItems = [
    {
      color: "#868C8F",
      title: "Enrollments & Biometrics Guidance",
      desc: "Use this section to manage enrollment flow, admission updates, and student biometric mapping. Ensure all new/edited enrollments are synced with attendance records.",
      link: "/Biometric",
    },
    {
      color: "#705B56",
      title: "Attendance & Payroll Guidance",
      desc: "Track attendance irregularities, latecomers, and payroll dependencies. Reconcile attendance before salary run to avoid payout errors.",
      link: "/BiometricTeacher",
    },
    {
      color: "#D4C7B0",
      title: "Recruitments & Exits Guidance",
      desc: "Monitor recruitment stages, interview scheduling, joining forms, and employee exits. Close every exit with biometrics cleanup and formal release steps.",
      link: "/BiometricTeacher",
    },
    {
      color: "#868C8F",
      title: "Events & Meetings Guidance",
      desc: "Plan HR events, publish meeting agendas, and follow up pending action points. Keep attendance and closure notes updated for every meeting.",
      link: "/EventAndMeetings",
    },
    {
      color: "#705B56",
      title: "Daily HR Checklist",
      desc: "Review latecomers, leave requests, pending interviews, and payroll blockers before day-close. Escalate unresolved items to management with status notes.",
      link: "/BiometricTeacher",
    },
  ];

  const EventItem = [
    {
      color: "#D4C7B0",
      title: "Exit-management",
      desc: "Delete biometrics, settlement noc, relieving formality",
      link: "/BiometricTeacher",
    },
    {
      color: "#868C8F",
      title: "Recruitment profiles",
      desc: "shortlisted list, Rounds of interviews, joining form",
      link: "/BiometricTeacher",
      buttonType: "OK",
    },
    {
      color: "#705B56",
      title: "Interview schedule",
      desc: "post jobs, roles, & responsibilities, schedules",
      link: "/BiometricTeacher",
      buttonType: "OK",
    },
  ];

  const marketingItems = [
    {
      color: "#D4C7B0",
      title: "Enrollments-Eligible",
      desc: "Hot Lead, Ward  Lead",
      link: "/Biometric",
    },
    {
      color: "#868C8F",
      title: "Enrollment-Admissions",
      desc: "add, delete, exit, edit",
      link: "/Biometric",
    },
       {
      color: "#868C8F",
      title: "Enroll-Students",
      desc: "add, delete, exit, edit",
      link: "/StudentData",
    },
  ];

  const marketingItem = [
    {
      color: "#D4C7B0",
      title: "Biometrics",
      desc: "add, edit, delete, exit",
      link: "/Biometric",
    },
    {
      color: "#705B56",
      title: "Attendance",
      desc: "Track students, unpunctuals",
      link: "/Biometric",
    },
    {
      color: "#868C8F",
      title: "Complain",
      desc: "Report unpunctuals, complain management",
      link: "/Biometric",
    },
  ];

  const hrItems = [
    {
      color: "#D9EEF8",
      title: "Events-upcoming",
      desc: "Manual actions, automatic actions, create events",
      link: "/EventAndMeetings",
    },
    {
      color: "#868C8F",
      title: "Meetings upcoming",
      desc: "schedule, edit, delete",
      link: "/EventAndMeetings",
    },
    {
      color: "#A39DBD",
      title: "Status-meetings",
      desc: "update agendas, report manage",
      link: "/EventAndMeetings",
    },
  ];
  const sidebarItems = [
  {
    title: "Enroll",
    icon: UserPlus,
    route: "/StudentData",
  },
  {
    title: "Biometric",
    icon: Fingerprint,
    route: "/Biometric",
  },
  {
    title: "HR",
    icon: UserCog,
    route: "/BiometricTeacher",
  },
  {
    title: "Assistant",
    icon: BotIcon,
    route: "/BiometricTeacher",
  },
  {
    title: "Events",
    icon: CalendarRange,
    route: "/EventAndMeetings",
  },
];

  // Render Card Function
  const renderCard = (title, items, homepageRoute, split = false, customCardStyle = {}) => {
    const renderDesc = (desc) => {
      if (Array.isArray(desc)) {
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {desc.map((d, idx) => (
              <React.Fragment key={idx}>
                {d.staticText && <span>{d.staticText}</span>}
                {d.boxedText && <span style={descBox}>{d.boxedText}</span>}
                {d.text && <span style={d.isBox ? descBox : {}}>{d.text}</span>}
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

    const arrowIconStyle = {
      fontSize: isMobile ? "16px" : "20px",
      color: "#945f4aff",
      marginRight: "10px",
      minWidth: isMobile ? "16px" : "20px",
      marginTop: "4px",
    };

 const renderItemContent = (i) => (
  <div
    style={listItem}
    key={i.title}
    onClick={() => openComponent(i.link)}   // <--- UPDATED: Open modal for individual item click
  >
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, height: "70px" }}>
      {items === ActionItems ? (
        <FontAwesomeIcon icon={faAngleRight} style={arrowIconStyle} />
      ) : (
        <div style={circle(i.color)}></div>
      )}

      <div className="title-hover" style={itemContent}>
        <div
          style={{ fontWeight: "500", cursor: "pointer", fontSize: isMobile ? "14px" : "18px" }}
        >
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
          e.stopPropagation();     // <--- Prevent modal opening when clicking button
          alert(`${i.buttonType} clicked for ${i.title}`);
        }}
      >
        {i.buttonType}
      </button>
    ) : (
      null
    )}
  </div>
);

    if (split) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1px",
            width: "100%",
            height: "300px",
            overflowY: "auto",
             scrollbarWidth: 'thin', // for Firefox
  scrollbarColor: 'rgba(0,0,0,0) transparent', // for Firefox
          }}
        >
          {items.map(renderItemContent)}
        </div>
      );
    } else {
      return (
        // <div style={{ ...card, ...customCardStyle }} onClick={() => navigate(homepageRoute)}>  <--- ORIGINAL LINE
        <div style={{ ...card, ...customCardStyle }} onClick={() =>openComponent(homepageRoute)}> 
          {items.map(renderItemContent)}
        </div>
      );
    }
  };
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/"); 
    alert("Logging out and navigating to root.");
  };
const renderActiveComponent = () => {
  switch (activeComponent) {
    case "/EventAndMeetings":
      return <EventAndMeetings />;

    case "/Biometric":
      return <Biometric />;

    case "/BiometricTeacher":
      return <BiometricTeacher />;

    case "/StudentData":
      return <StudentData />;

    default:
      return null;
  }
};
  return (
  <div style={outerContainer}>
  {/* TOP BAR */}
      <Header/>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 15px",
      background: "#fff",
      borderRadius: "1px",
  
    }}
  >

    <div className="section-header">
      {name ? `Welcome ${name}..!` : "Welcome Chief!"}
    </div>

    <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
      <button
        className="btn-dropdown-FeesManagement"
        onClick={() => navigate("/TeacherManagement")}
      >
        Student Data
      </button>

      <div style={{ position: "relative" }}>
        <FontAwesomeIcon
          icon={faBell}
          style={{
            fontSize: "24px",
            color: "#555",
          }}
        />
      </div>
    </div>
  </div>

  {/* BODY */}
<div
  style={{
    display: "flex",
    alignItems: "flex-start",
    width: "100%",
  }}
>
  <div
  style={{
    display: "flex",
    alignItems: "center", // vertical center
    justifyContent: "center",
    gap: "25px",
    width: "100%",
    minHeight: "calc(100vh - 120px)",
    backgroundColor:"white"
  }}
>
    {/* SIDEBAR */}
 <div
  style={{
    width: "100px",
    minWidth: "40px",
    background: "#f9b1b8",
    borderRight: "1px solid #e5e7eb",
    borderRadius:"50px",
height: "fit-content",
alignSelf: "center",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    zIndex:"999"


  }}
>
{sidebarItems.map((item) => {
  const Icon = item.icon;

  return (
    <div
      key={item.title}
      onClick={() => openComponent(item.route)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 18px",
        borderRadius: "999px",
        background: "#f8fafc",
        cursor: "pointer",
        border: "1px solid #e2e8f0",
        width: "60px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.width = "180px";
        e.currentTarget.style.background = "#f9b1b8";

        const text =
          e.currentTarget.querySelector(".sidebar-title");

        if (text) {
          text.style.opacity = "1";
          text.style.width = "auto";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.width = "60px";
        e.currentTarget.style.background = "#f8fafc";

        const text =
          e.currentTarget.querySelector(".sidebar-title");

        if (text) {
          text.style.opacity = "0";
          text.style.width = "0";
        }
      }}
    >
      <Icon size={40} />

      <span
        className="sidebar-title"
        style={{
          opacity: 0,
          width: 0,
          overflow: "hidden",
          transition: "all 0.3s ease",
          fontSize: "14px",
          fontWeight: "600",
        }}
      >
        {item.title}
      </span>
    </div>
  );
})}
</div>

    {/* RIGHT CONTENT */}
    <div
      style={{
        flex: 1,
        background: "#fff",
        borderRadius: "1px",
        padding: "20px",
        minHeight: "calc(100vh - 140px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        overflowY: "auto",
      }}
    >
      {activeComponent ? (
        <>
          {/* COMPONENT HEADER */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              paddingBottom: "15px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#334155",
              }}
            >
              Module View
            </h3>

            <button
              onClick={closeComponent}
              style={{
                border: "none",
                background: "#ef4444",
                color: "#fff",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              ✕
            </button>
          </div>

          {renderActiveComponent()}
        </>
      ) : (
        <>
    

          <div
            style={{
              display: "flex",
              gap: "20px",
            }}
          >
              <div style={leftColumnContainer}>
            {/* Enrollments & Biometrics */}
            <div style={{ flex: 1 }}>
              <div className="title-heading">Enrollments & Biometrics</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  borderLeft: "8px solid #738368ff",
                  backgroundColor: "#fff",
                  borderRadius: "16px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                  padding: "20px",
                  height: "330px",
                  justifyContent: "space-between",
                  alignItems: "stretch",
                  // Removed onClick here to rely on the item/split card clicks below
                }}
              >
                <div style={{ flex: 1, paddingRight: isMobile ? "0" : "4px", overflowY: "auto", scrollbarWidth: 'thin', 
  scrollbarColor: 'rgba(0,0,0,0) transparent',}}>
                  {renderCard("Marketing", marketingItems, "/marketing", true)}
                </div>
                {!isMobile && <div style={{ width: "2px", backgroundColor: "black", margin: "0 10px" }} />}
                <div style={{ flex: 1, paddingLeft: isMobile ? "0" : "10px", overflowY: "auto", scrollbarWidth: 'thin', 
  scrollbarColor: 'rgba(0,0,0,0) transparent'}}>
                  {renderCard("Marketing", marketingItem, "/marketing", true)}
                </div>
              </div>
            </div>

            {/* Attendance & Payroll, Recruitments & Exits */}
            <div style={{ display: "flex", gap: "20px" }}>
              <div style={{ flex: 1 }}>
                <div className="title-heading">Attendance & Payroll</div>
                <div
                  onClick={() => openComponent("/BiometricTeacher")} // <--- UPDATED: Open modal for the whole container click
                  style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    borderLeft: "8px solid #738368ff",
                    backgroundColor: "#fff",
                    borderRadius: "16px",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                    padding: "20px",
                    height: "300px",
                    justifyContent: "space-between",
                    alignItems: "stretch",
                    cursor: "pointer",
                    transition: "0.2s",
                  }}
                >
                  <div style={{ flex: 1, paddingRight: isMobile ? "0" : "10px", overflowY: "auto",scrollbarWidth: 'thin', 
  scrollbarColor: 'rgba(0,0,0,0) transparent' }}>
                    {renderCard("Marketing", EventItems, "/marketing", true)}
                  </div>
                  {!isMobile && <div style={{ width: "2px", margin: "0 10px" }} />}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div className="title-heading">Recruitments & Exits</div>
                <div>
                  {renderCard("Operations", EventItem, "/BiometricTeacher", false, {
                    borderLeft: "8px solid #738368ff",
                    height: "300px",
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={rightColumnContainer}>
            <div style={{ flex: 1 }}>
              <div className="title-heading">Assistant</div>
                {/* ActionItems are not meant to navigate the card as a whole, so homepageRoute is left empty/not used in renderCard */}
                {renderCard("Operations", assistantPanelItems, "", false, { height: "330px" })} 
            </div>

            <div style={{ flex: 1 }}>
              <div className="title-heading">Events & Meetings</div>
              <div>
                {renderCard("HR", hrItems, "/EventAndMeetings", false, { height: "300px" })}
              </div>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
    </div>
  </div>
</div> 
  );
};

export default AdminDashboard;
