import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { faBell, faAngleRight, faTimes, faSearch } from "@fortawesome/free-solid-svg-icons"; // Added faTimes for modal close button

const BiometricTeacher = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [popup, setPopup] = useState(null);
  const [rightPopup, setRightPopup] = useState(null);
  const font = "'Century Gothic', 'AppleGothic', sans-serif";

  // State for data
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [editedLogs, setEditedLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [recentHrActions, setRecentHrActions] = useState(() => {
    try {
      const saved = localStorage.getItem("hrBiometricTeacherRecentActions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const schoolCode = localStorage.getItem("schoolCode") || "NOVA";

  const logHrAction = (title, detail) => {
    const entry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title,
      detail,
      createdAt: new Date().toISOString(),
    };
    setRecentHrActions((prev) => [entry, ...prev].slice(0, 20));
  };

  useEffect(() => {
    localStorage.setItem("hrBiometricTeacherRecentActions", JSON.stringify(recentHrActions));
  }, [recentHrActions]);

  // Fetch user name
  useEffect(() => {
    const fetchUserName = async () => {
      const username = localStorage.getItem("username");
      if (!username) return;
      try {
        const response = await fetch(
          `https://cleezoclass.com:4000/getUserName?username=${encodeURIComponent(username)}`
        );
        if (!response.ok) return;
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return;
        const data = await response.json();
        if (data && typeof data.name === "string") setName(data.name);
      } catch (err) {
        console.error("Error fetching user name:", err);
      }
    };
    fetchUserName();
  }, []);

  const fetchDeletedUsers = async () => {
    try {
      const res = await axios.get("https://cleezoclass.com:4000/api/deleted-teachers", {
        params: { schoolCode },
      });
      setDeletedUsers(res.data);
    } catch (error) {
      console.error("Error fetching deleted users:", error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const res = await axios.get("https://cleezoclass.com:4000/teacher-leave-requests-list", {
        params: { schoolCode },
      });
      setLeaveRequests(res.data);
    } catch (err) {
      console.error("Error fetching leave requests:", err);
    }
  };

  const refreshHrActionsData = async (withLog = false) => {
    const storedLogs = JSON.parse(localStorage.getItem("editedAdmissionsLogs")) || [];
    setEditedLogs(storedLogs);
    await Promise.all([fetchDeletedUsers(), fetchLeaveRequests()]);
    if (withLog) {
      logHrAction("Actions refreshed", "Deleted teachers, leave requests, and edit logs reloaded");
    }
  };

  // Fetch deleted users, leave requests, and edited logs
  useEffect(() => {
    refreshHrActionsData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolCode]);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  // Toggle row to show popup
  const toggleRow = (key) => {
    const [prefix, className, section] = key.split("-");
    if (prefix === "deleted") {
      const users = groupedDeletedUsers[key];
      setRightPopup({
        title: `Exits - Class: ${className} | Section: ${section}`,
        content: (
          <div style={styles.userTableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>User Type</th>
                  <th style={styles.th}>Father Name</th>
                  <th style={styles.th}>Phone No</th>
                  <th style={styles.th}>Aadhar No</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr
                    key={user.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f1f5f9",
                    }}
                  >
                    <td style={styles.td}>{user.id}</td>
                    <td style={styles.td}>{user.name}</td>
                    <td style={styles.td}>{user.user_type}</td>
                    <td style={styles.td}>{user.father_name}</td>
                    <td style={styles.td}>{user.phone_no}</td>
                    <td style={styles.td}>{user.aadhar_no}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      });
      logHrAction("Viewed exits", `Class ${className}-${section} | ${users.length} entries`);
    } else if (prefix === "edit") {
      const logId = key.replace("edit-", "");
      const log = editedLogs.find((l) => l.id === logId);
      setRightPopup({
        title: `Enrollment Edit - ${log.student_name}`,
        content: (
          <div style={styles.userTableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Class</th>
                  <th style={styles.th}>Student Name</th>
                  <th style={styles.th}>Fields Edited</th>
                  <th style={styles.th}>Edited At</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: "#ffffff" }}>
                  <td style={styles.td}>{log.class}</td>
                  <td style={styles.td}>{log.student_name}</td>
                  <td style={styles.td}>{log.fieldsEdited.join(", ")}</td>
                  <td style={styles.td}>{log.editedAt}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ),
      });
      logHrAction("Viewed enrollment edit", `${log.student_name} | Class ${log.class}`);
    } else if (prefix === "leave") {
      const requests = groupedLeaveRequests[key];
      setRightPopup({
        title: "Teacher Leave Requests",
        content: (
          <div style={styles.userTableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Teacher Name</th>
                  <th style={styles.th}>Start Date</th>
                  <th style={styles.th}>End Date</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} style={{ backgroundColor: "#ffffff" }}>
                    <td style={styles.td}>{req.id}</td>
                    <td style={styles.td}>{req.teacher_name || req.student_name || "-"}</td>
                    <td style={styles.td}>{formatDate(req.leave_start_date || req.start_date)}</td>
                    <td style={styles.td}>{formatDate(req.leave_end_date || req.end_date)}</td>
                    <td style={styles.td}>{req.reason}</td>
                    <td style={styles.td}>{formatDate(req.submitted_at || req.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      });
      logHrAction("Viewed teacher leave requests", `${requests.length} requests`);
    }
  };

  // Group data
  const groupedDeletedUsers = deletedUsers.reduce((acc, user) => {
    const key = `deleted-${user.class_name}-${user.section}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(user);
    return acc;
  }, {});

  const groupedEditedLogs = editedLogs.reduce((acc, log) => {
    const key = `edit-${log.class}-${log.section}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  const groupedLeaveRequests = leaveRequests.reduce((acc, req) => {
    const key = "leave-all";
    if (!acc[key]) acc[key] = [];
    acc[key].push(req);
    return acc;
  }, {});

  // Styles
  const styles = {
    container: {
      fontFamily: font,
      backgroundColor: "#f8fafc",
      minHeight: "100vh",
      padding: "40px",
    },
    heading: {
      textAlign: "center",
      fontSize: "28px",
      fontWeight: "bold",
      color: "#0f172a",
      marginBottom: "0",
      textTransform: "uppercase",
      letterSpacing: "1px",
    },
    rowContainer: {
      width: "100%",
      cursor: "pointer",
      padding: "10px 12px",
      marginBottom: "8px",
      borderRadius: "10px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      transition: "background-color 0.2s",
      fontWeight: "600",
      border: "1px solid #e2e8f0",
      backgroundColor: "#fcfdff",
    },
    arrowLine: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    arrow: {
      display: "inline-block",
      transition: "transform 0.3s",
    },
    infoLine: {
      fontSize: "12px",
      color: "#1e293b",
      textAlign:'left'
    },
    userTableWrapper: {
      marginTop: "5px",
      marginBottom: "15px",
      overflowX: "auto",
      backgroundColor: "#fff",
      borderRadius: "10px",
      boxShadow: "0 3px 10px rgba(0, 0, 0, 0.08)",
       scrollbarWidth: 'thin', // for Firefox
  scrollbarColor: 'rgba(0,0,0,0) transparent', // for Firefox
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    th: {
      backgroundColor: "rgba(141,171,182,255)",
      color: "#fff",
      textAlign: "center",
      verticalAlign: "middle",
      padding: "12px 16px",
      fontSize: "15px",
      textTransform: "uppercase",
      borderBottom: "2px solid #cbd5e1",
      borderLeft: "1px solid #cbd5e1",
    },
    td: {
      textAlign: "center",
      verticalAlign: "middle",
      padding: "12px 16px",
      fontSize: "15px",
      color: "#1e293b",
      borderBottom: "1px solid #cbd5e1",
      borderLeft: "1px solid #cbd5e1",
    },
  };

  // Container and other styles
  const container = {
    fontFamily: font,
    backgroundColor: "#fff",
    minHeight: "40vh",
    padding: "20px",
    boxSizing: "border-box",
        borderRadius: '16px',

  };



  const logoBox = { display: "flex", alignItems: "center", gap: "10px" };
  const logo = {
    width: "40px",
    height: "40px",
    backgroundColor: "#001F3F",
    borderRadius: "8px",
  };
  const logoText = { fontSize: "18px", fontWeight: "600" };
  const logoSub = { fontSize: "12px", color: "#777" };
  const schoolTitle = {
    fontSize: "20px",
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "center",
  };
  const buttonGroup = { display: "flex", gap: "10px" };
  const btn = {
    backgroundColor: "#e0e0e0",
    border: "none",
    borderRadius: "10px",
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    fontFamily: font,
  };
const gridContainer = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)", // 2 columns, each takes 50% width
  gap: "8px", // Space between the items
  backgroundColor: "transparent",
  flex: 5, // Takes 5 parts of available space
  borderRadius: "16px",
  overflowY: "auto", // Optional: if you want the container to scroll
  height: "100%", // Ensures it takes the full height of the parent
  border: "1px solid #ccc",
  borderTop: "1px solid #ccc",
  borderBottom: "1px solid #ccc",
  padding: "0",
  position: "relative", // Important for the line to be positioned correctly
   scrollbarWidth: 'thin', // for Firefox
  scrollbarColor: 'rgba(0,0,0,0) transparent', // for Firefox
};

// Divider line (between columns)
const dividerLine = {
  width: "1px",
  backgroundColor: "#ccc",
  height: "100%", // Ensure it takes full height of the parent
  position: "absolute",
  left: "50%", // Place the divider at the midpoint
  top: 0,
};


const mainContent = {
  display: "flex",
  flexDirection: "row", // Makes the children lay out in a horizontal row
  gap: "10px", // Space between items
  alignItems: "stretch", // Ensures both containers stretch to the same height
  flexWrap: "nowrap", // Prevents wrapping to ensure side-by-side layout
  height: "55vh",
  maxHeight: "400px",  // Adjust this value based on your header and other fixed elements
};


const card = {
  backgroundColor: "transparent",
  borderRadius: "16px",
  marginLeft: "3%",
  marginTop: "3%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start", // Align items to the top
  height: "auto", // Adjust as needed
  backgroundColor: "transparent",


};
const rightContainer = {
flex: 2,
  minWidth: "250px",
  backgroundColor: "#fff",
  borderRadius: "16px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "20px",
  height: "100%", // Ensures it takes the full height of the parent
  overflowY: "auto", // Enables vertical scrolling
  position: "relative",
    scrollbarWidth: 'thin', // for Firefox
  scrollbarColor: 'rgba(0,0,0,0) transparent', // for Firefox
      borderLeft: "1px solid #ccc",
  borderRight:'1px solid #ccc',
    borderTop:'1px solid #ccc',
  borderBottom:'1px solid #ccc'
};
  const sectionTitleContainer = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "0",
  };
  const sectionCircle = (color) => ({
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: color,
  });
  const sectionTitle = { fontSize: "22px", fontWeight: "600", color: "#333" };
  const actionItemContainer = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px 0",
    cursor: "pointer",
  };
  const actionCircle = (color) => ({
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: color,
    flexShrink: 0,
  });
const actionText = {
  fontSize: "13px",      // Default font size for desktop
  textAlign: "left",     // Align text to the left
  lineHeight: "1.3",     // Default line-height for desktop
  margin: "0",           // Ensure no extra margins
  padding: "0",          // Ensure no extra padding
};
const actionSummaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
  margin: "8px 0 12px 0",
};
const actionSummaryCard = {
  border: "1px solid #dbe4ee",
  borderRadius: "10px",
  padding: "8px",
  background: "#fbfdff",
};
const actionSummaryLabel = {
  fontSize: "11px",
  color: "#64748b",
};
const actionSummaryValue = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#24364a",
};
const quickActionRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginBottom: "10px",
};
const recentActionCard = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "8px",
  marginBottom: "8px",
  background: "#fff",
};
const actionChipRow = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
  marginBottom: "10px",
};
const actionChip = {
  border: "1px solid #cbd5e1",
  borderRadius: "999px",
  padding: "4px 10px",
  fontSize: "11px",
  color: "#334155",
  cursor: "pointer",
  background: "#fff",
};

  const dropdownStyle = {
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #ccc",
  };
  const okBtn = { ...btn, backgroundColor: "#4CAF50", color: "#fff" };

  // Right popup styles (inside right container)
  const rightPopupOverlay = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    borderRadius: "16px",
  };

  const rightPopupContent = {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "20px",
    width: "60%",
    maxHeight: "80%",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    position: "relative",
    overflow: "auto",
     scrollbarWidth: 'thin', // for Firefox
  scrollbarColor: 'rgba(0,0,0,0) transparent', // for Firefox
  };
  

  const rightPopupCloseBtn = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: 'red',
  };

  // Data for cards
  const enrollmentActions = [
    { label: "New Enrollment", icon: true },
    { label: "Edit Previous Enrollment" },
    { label: "Delete Enrollment" },
    { label: "Exits" },
  ];
  const biometricsActions = [
    { label: "New Biometrics", icon: true },
    { label: "Edit Previous" },
    { label: "Delete Biometrics" },
  ];
   const payrollActions = [
    { label: "BreakUp Entry"},
    { label: "issue certificates" },
    { label: "Edit Payroll " },
    { label: "Delete Payroll" },
  ];
  const trackingActions = [
    { label: "List of Irregulars" },
    { label: "List of Late Comers" },
    { label: "List of Leave Requests" },
  ];
  const allActions = [
    { label: "Generate Report" },
    { label: "Export Data" },
    { label: "Settings" },
    { label: "Attendance Summary" },
    { label: "Payroll Audit" },
    { label: "Compliance Check" },
  ];
  const complaintTypes = ["Type A", "Type B", "Type C"];
  const submitToOptions = ["Admin", "Manager", "Principal"];
  const enrollmentColors = ["#000", "#000", "#000", "#000"];
  const attendanceColors = ["#000", "#000", "#000"];
  const biometricsColors = ["#000", "#000", "#000"];
  const actionsColors = ["#000", "#000", "#000"];
  const sectionColors = ["#D4C7B0", "#868C8F", "#705B56", "#D9EEF8", "#888888"];
  const exitPendingCount = deletedUsers.length;
  const editedCount = editedLogs.length;
  const leavePendingCount = leaveRequests.length;

  // Handle action click
  const handleActionClick = (label, prefix) => {
    const route = `/${prefix}/${label.toLowerCase().replace(/\s+/g, "-")}`;
    logHrAction("Action opened", label);
    setPopup({ title: label, route });
  };

  // Render action items
  const renderActionItems = (actions, routePrefix, colors) =>
    actions.map((action, idx) => (
      <div
        key={idx}
        style={actionItemContainer}
        onClick={() => handleActionClick(action.label, routePrefix)}
      >
        <div style={actionCircle(colors[idx % colors.length])}></div>
        {action.icon ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                border: "2px solid #000",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              +
            </div>
            <span style={actionText}>{action.label}</span>
          </div>
        ) : (
          <div style={actionText}>{action.label}</div>
        )}
      </div>
    ));

  // Popup styles for main popup
  const popupOverlay = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  };
  const popupContent = {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "0",
    width: "60%",
    height: "70%",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    position: "relative",
    overflow: "hidden", scrollbarWidth: 'thin', // for Firefox
  scrollbarColor: 'rgba(0,0,0,0) transparent', // for Firefox
  };
  const closeBtn = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: 'red',
  };

  return (
    <div style={container}>
   
      {/* Welcome */}
      <div
                   className="footprintsinner"

      >
        HR – ATTENDANCE & PAYROLL TEACHER
      </div>

      {/* Main Content */}
      <div className="global-mainContent">
        {/* Grid Container */}
<div className="global-gridContainer">
  {/* Left Column */}
     <div  className="global-card">

    <div className="global-sectionTitleContainer">
<div className="global-sectionCircle" style={{ backgroundColor: sectionColors[0] }}></div>
          <div className="global-sectionTitle">Recruitments</div>
        </div>
        {renderActionItems(enrollmentActions, "CRM/teacher", enrollmentColors)}
      </div>
  
  <div  className="global-card">

    <div className="global-sectionTitleContainer">
<div className="global-sectionCircle" style={{ backgroundColor: sectionColors[2] }}></div>
          <div className="global-sectionTitle">Biometrics</div>
        </div>
        {renderActionItems(biometricsActions, "CRM/biometrics", biometricsColors)}
      </div>

  {/* Divider Line */}
    <div className="global-dividerLine"></div>

  {/* Right Column */}
  <div  className="global-card">
    <div className="global-sectionTitleContainer">
<div className="global-sectionCircle" style={{ backgroundColor: sectionColors[1] }}></div>
          <div className="global-sectionTitle">Tracking</div>
        </div>
        {renderActionItems(trackingActions, "CRM/tracking", attendanceColors)}
      </div>

  <div  className="global-card">

    <div className="global-sectionTitleContainer">
<div className="global-sectionCircle" style={{ backgroundColor: sectionColors[3] }}></div>
          <div className="global-sectionTitle">Payroll</div>
        </div>
        {renderActionItems(payrollActions, "CRM/payroll", biometricsColors)}
      </div>
</div>
       

        {/* Right Container */}
<div className="global-rightContainerHR">
      <div className="global-sectionTitleContainer">
<div className="global-sectionCircle" style={{ backgroundColor: sectionColors[4] }}></div>
            <div className="global-sectionTitle">Actions</div>
          </div>
          <div style={actionSummaryGrid}>
            <div style={actionSummaryCard}>
              <div style={actionSummaryLabel}>Exits Pending</div>
              <div style={actionSummaryValue}>{exitPendingCount}</div>
            </div>
            <div style={actionSummaryCard}>
              <div style={actionSummaryLabel}>Edits Logged</div>
              <div style={actionSummaryValue}>{editedCount}</div>
            </div>
            <div style={actionSummaryCard}>
              <div style={actionSummaryLabel}>Teacher Leave Requests</div>
              <div style={actionSummaryValue}>{leavePendingCount}</div>
            </div>
            <div style={actionSummaryCard}>
              <div style={actionSummaryLabel}>Recent Actions</div>
              <div style={actionSummaryValue}>{recentHrActions.length}</div>
            </div>
          </div>
          <div style={quickActionRow}>
            <button className="btn-outline" onClick={() => refreshHrActionsData(true)}>Refresh</button>
            <button className="btn-outline" onClick={() => {
              setRightPopup(null);
              logHrAction("Popup cleared", "Closed all action popups");
            }}>Close Popups</button>
            <button className="btn-outline" onClick={() => setRecentHrActions([])}>Clear History</button>
          </div>
          <div style={actionChipRow}>
            {allActions.map((a) => (
              <button
                key={a.label}
                className="btn-outline"
                style={actionChip}
                onClick={() => handleActionClick(a.label, "CRM/actions")}
              >
                {a.label}
              </button>
            ))}
          </div>
          {recentHrActions.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              {recentHrActions.slice(0, 4).map((a) => (
                <div key={a.id} style={recentActionCard}>
                  <div style={{ fontSize: "12px", fontWeight: 700 }}>{a.title}</div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>{a.detail}</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>{new Date(a.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {/* Deleted Users Section */}
          {Object.keys(groupedDeletedUsers).length === 0 ? (
            <p style={{ textAlign: "center", fontSize: "16px", color: "#64748b" }}>
              No deleted users found.
            </p>
          ) : (
            Object.keys(groupedDeletedUsers).map((key) => {
              const users = groupedDeletedUsers[key];
              const [_, className, section] = key.split("-");
              return (
                <div key={key} style={styles.rowContainer} onClick={() => toggleRow(key)}>
                  <div style={styles.arrowLine}>
<FontAwesomeIcon icon={faArrowRight} style={styles.arrow} />
                    Exits
                  </div>
                  <div style={styles.infoLine}>
                    {` Pending: ${users.length}`}
                  </div>
                </div>
              );
            })
          )}

          {/* Edited Admissions Logs Section */}
          {editedLogs.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: "16px", color: "#64748b" }}>
            
            </p>
          ) : (
            editedLogs.map((log) => (
              <div
                key={`edit-${log.id}`}
                style={styles.rowContainer}
                onClick={() => toggleRow(`edit-${log.id}`)}
              >
                <div style={styles.arrowLine}>
<FontAwesomeIcon icon={faArrowRight} style={styles.arrow} />
                  Enrollment Edit
                </div>
                <div style={styles.infoLine}>
                  {`Class: ${log.class}  ${log.student_name} (${log.fieldsEdited.join(", ")})  ${log.editedAt}`}
                </div>
              </div>
            ))
          )}

          {/* Leave Requests Section */}
          {Object.keys(groupedLeaveRequests).length === 0 ? (
            <p style={{ textAlign: "center", fontSize: "16px", color: "#64748b" }}>
              No leave requests found.
            </p>
          ) : (
            Object.keys(groupedLeaveRequests).map((key) => {
              const requests = groupedLeaveRequests[key];
              return (
                <div key={key} style={styles.rowContainer} onClick={() => toggleRow(key)}>
                  <div style={styles.arrowLine}>
<FontAwesomeIcon icon={faArrowRight} style={styles.arrow} />
                    Teacher Leave Requests
                  </div>
                  <div style={styles.infoLine}>
                    {`Pending: ${requests.length}`}
                  </div>
                </div>
              );
            })
          )}

          {/* Right Popup (inside right container) */}
          {rightPopup && (
            <div style={rightPopupOverlay}>
              <div style={rightPopupContent}>
                <button
                  style={rightPopupCloseBtn}
                  onClick={() => setRightPopup(null)}
                >
                  Close
                </button>
                <h3 style={{ marginTop: "0", textAlign: "center" }}>
                  {rightPopup.title}
                </h3>
                {rightPopup.content}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Popup */}
 {popup && (
  <div
    style={popupOverlay}
    onClick={() => setPopup(null)}   // CLOSE ON OUTSIDE CLICK
  >
    <div
      style={popupContent}
      onClick={(e) => e.stopPropagation()}  // PREVENT CLOSE WHEN CLICK INSIDE
    >
      <button style={closeBtn} onClick={() => setPopup(null)}>
        <FontAwesomeIcon icon={faTimes} />
      </button>

      <iframe
        src={popup.route}
        title={popup.title}
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  </div>
)}

    </div>
  );
};

export default BiometricTeacher;
