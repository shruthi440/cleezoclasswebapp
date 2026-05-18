import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";

const EventAndMeetings = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [popup, setPopup] = useState(null);
  const [rightPopup, setRightPopup] = useState(null);
  const font = "'Century Gothic', 'AppleGothic', sans-serif";
const [statusEventId, setStatusEventId] = useState("");
const [eventStatus, setEventStatus] = useState("");
const handleUpdateEventStatus = () => {
  console.log("Event: ", statusEventId);
  console.log("Status: ", eventStatus);
  // Add your API call here
};

  // State for data
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [editedLogs, setEditedLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isBelow1430, setIsBelow1430] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1430 : false
  );
    const [isBelow1800, setIsBelow1800] = useState(
    typeof window !== "undefined" ? window.innerWidth >1800 : false
  );
  const schoolCode = localStorage.getItem("schoolCode") || "NOVA";
const [activeTab, setActiveTab] = useState("manual");

  useEffect(() => {
    const handleResize = () => setIsBelow1430(window.innerWidth < 1430);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    const handleResize = () => setIsBelow1800(window.innerWidth < 1800);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
 const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recipientType, setRecipientType] = useState('students');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notificationLinks, setNotificationLinks] = useState(null);

  // Fetch events on mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const schoolCode = localStorage.getItem('schoolCode');
        const response = await axios.get('https://cleezoclass.com:4000/api/events', {
          params: { schoolCode },
        });
        setEvents(response.data);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Failed to load events.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Handle dropdown selection
  const handleEventChange = (e) => {
    const id = Number(e.target.value);
    const event = events.find((ev) => ev.id === id);
    setSelectedEvent(event);
    setEventDetails(null); // Clear previous details until Generate is clicked
  };

  // Manual Generate button
  const handleGenerateManual = () => {
    if (!selectedEvent || !title) {
      alert('Please select an event and enter a title.');
      return;
    }
    console.log('Manual Generate:', { event: selectedEvent, title, description });
    setEventDetails({ ...selectedEvent, title, description });
    alert(
      `Manual Event Generated:\nEvent: ${selectedEvent.event_name}\nTitle: ${title}\nDescription: ${description}`
    );
  };

  // Automatic Generate button
  const handleGenerateAutomatic = () => {
    if (!selectedEvent) {
      alert('Please select an event.');
      return;
    }
    console.log('Automatic Generate:', selectedEvent);
    setEventDetails(selectedEvent);
    alert(`Automatic Event Generated:\nEvent: ${selectedEvent.event_name}`);
  };

  // Handle image download
  const handleImageDownload = (imageData) => {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${imageData}`;
    link.download = `${eventDetails.event_name}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Send WhatsApp notification
  const handleSendNotification = async () => {
    if (!selectedEvent) return;
    try {
      setError(null);
      setIsLoading((prev) => ({ ...prev, notification: true }));
      const schoolCode = localStorage.getItem('schoolCode');
      const response = await axios.post('https://cleezoclass.com:4000/api/generate-whatsapp-links', {
        eventId: selectedEvent.id,
        recipientType,
        schoolCode,
      });
      setNotificationLinks(response.data);
    } catch (error) {
      console.error('Error generating WhatsApp links:', error);
      setError(error.response?.data?.error || 'Failed to generate WhatsApp links. Please try again.');
    } finally {
      setIsLoading((prev) => ({ ...prev, notification: false }));
    }
  };

  // Fetch deleted users, leave requests, and edited logs
  useEffect(() => {
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
        const res = await axios.get("https://cleezoclass.com:4000/leave-requests-list", {
          params: { schoolCode },
        });
        setLeaveRequests(res.data);
      } catch (err) {
        console.error("Error fetching leave requests:", err);
      }
    };

    const storedLogs = JSON.parse(localStorage.getItem("editedAdmissionsLogs")) || [];
    setEditedLogs(storedLogs);

    fetchDeletedUsers();
    fetchLeaveRequests();
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
    } else if (prefix === "leave") {
      const requests = groupedLeaveRequests[key];
      const [_, leaveClassName, leaveSection] = key.split("-");
      setRightPopup({
        title: `Leave Requests - Class: ${leaveClassName} | Section: ${leaveSection}`,
        content: (
          <div style={styles.userTableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Student Name</th>
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
                    <td style={styles.td}>{req.student_name}</td>
                    <td style={styles.td}>{formatDate(req.start_date)}</td>
                    <td style={styles.td}>{formatDate(req.end_date)}</td>
                    <td style={styles.td}>{req.reason}</td>
                    <td style={styles.td}>{formatDate(req.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      });
    }
  };
  const tabButton = {
  flex: 1,
  padding: "10px 15px",
  border: "1px solid #ccc",
  cursor: "pointer",
  borderRadius: "6px",
  marginRight: 10,
};

const label = {
  display: "block",
  marginBottom: 5,
  fontWeight: "600",
};

const inputBox = {
  width: "100%",
  padding: 10,
  marginBottom: 15,
  border: "1px solid #ccc",
  borderRadius: "6px",
};

const generateBtn = {
  width: "100%",
  padding: 12,
  backgroundColor: "rgba(141,171,182,255)",
  border: "none",
  color: "white",
  fontWeight: "bold",
  borderRadius: "6px",
  cursor: "pointer",
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
    const key = `leave-${req.class_name}-${req.section}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(req);
    return acc;
  }, {});

  // Styles
  const styles = {
    container: {
      fontFamily: font,
      backgroundColor: "#fff",
      minHeight: "40vh",
      padding: "40px",
    },
    heading: {
      textAlign: "center",
      fontSize: "28px",
      fontWeight: "bold",
      color: "#0f172a",
      marginBottom: "20px",
      textTransform: "uppercase",
      letterSpacing: "1px",
    },
    rowContainer: {
      width: "100%",
      cursor: "pointer",
      padding: "12px 16px",
      marginBottom: "5px",
      borderRadius: "6px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      transition: "background-color 0.2s",
      fontWeight: "600",
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
      fontSize: "14px",
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
    height: "70vh",
    padding: "20px",
    boxSizing: "border-box",
    borderRadius:'16px'
  };

  const header = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: "16px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    padding: "15px 25px",
    marginBottom: "25px",
    flexWrap: "wrap",
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
  display: "flex",
  flexWrap: "wrap",
  gap: "20px",
  flex: 3, // Takes 3 parts of the available space
  justifyContent: "space-between",
  alignItems: "stretch",
  backgroundColor: "#fff",
  borderRadius: "16px",
  borderLeft: "1px solid #ccc",
  overflowY: "auto", // Optional: if you want the left container to scroll as well
  height: "100%", // Ensures it takes the full height of the parent
};
  const sectionHeading = { fontSize: 20, fontWeight: '700', marginTop: 10, marginBottom: 15, color: '#333' };
  const row = { display: 'flex', gap: 15, marginBottom: 15 };
  const selectStyle = { flex: 1, padding: 6, borderRadius: 10, border: '1px solid #dcdcdc', fontSize: 15, outline: 'none', backgroundColor: '#fafafa' };
  const inputStyle = { flex: 1, padding: 12, borderRadius: 10, border: '1px solid #dcdcdc', fontSize: 15, outline: 'none', backgroundColor: '#fafafa' };
const textarea = { width: '100%', height: 70, padding: 20, borderRadius: '16px', border: '1px solid #dcdcdc', fontSize: 15, resize: 'none', outline: 'none', backgroundColor: '#fafafa' };
const mainContent = {
  display: "flex",
  flexDirection: isBelow1430 ? "column" : "row",
  gap: "20px",
  alignItems: "stretch", // Ensures both containers stretch to the same height
  flexWrap: "nowrap", // Prevents wrapping to ensure side-by-side layout
  height: isBelow1430 ? "auto" : isBelow1800 ? "75vh" : "55vh",
};
  const card = {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "20px",
    flex: "1 1 45%",
    minWidth: "300px",
    height: "280px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };
const rightContainer = {
  width: isBelow1430 ? "100%" : "35vw",
  backgroundColor: "#fff",
  borderRadius: "16px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "20px",
  height: isBelow1430 ? "auto" : isBelow1800 ? "75vh" : "55vh", // Adjust this value based on your header and other fixed elements
  minHeight: isBelow1430 ? "420px" : isBelow1800 ? "75vh" : "56vh",
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
    marginBottom: "15px",
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
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: color,
    flexShrink: 0,
  });
  const actionText = { fontSize: "16px", textAlign: "left" };
  const dropdownStyle = {
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #ccc",
  };
  const okBtn = { ...btn, backgroundColor: "rgba(141,171,182,255)", color: "#fff" };

  // Right popup styles (inside right container)
  const rightPopupOverlay = {
    position: "absolute",
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
    borderRadius: "12px",
    padding: "20px",
    width: "90%",
    maxHeight: "80%",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    position: "relative",
    overflow: "auto",
  };

  const rightPopupCloseBtn = {
    position: "absolute",
    top: "10px",
    right: "10px",
    backgroundColor: "rgb(160, 180,182)",
    border: "none",
    padding: "5px 10px",
    borderRadius: "5px",
    color: "#fff",
    fontSize: "14px",
    cursor: "pointer",
  };

  // Data for cards

  const biometricsActions = [
    { label: "New Meetings", icon: true },
    { label: "Edit Meetings" },
    { label: "Delete Meetings" },
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
  ];
  const complaintTypes = ["Type A", "Type B", "Type C"];
  const submitToOptions = ["Admin", "Manager", "Principal"];
  const enrollmentColors = ["#D9EEF8", "#868C8F", "#B5ACBC", "#A39DBD"];
  const attendanceColors = ["#D4C7B0", "#868C8F", "#705B56"];
  const biometricsColors = ["#D4C7B0", "#868C8F", "#705B56"];
  const actionsColors = ["#FFD700", "#FF8C00", "#FF4500"];
  const sectionColors = ["#D4C7B0", "#868C8F", "#705B56", "#D9EEF8", "#888888"];

  // Handle action click
  const handleActionClick = (label, prefix) => {
    const route = `/${prefix}/${label.toLowerCase().replace(/\s+/g, "-")}`;
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
                fontSize: "20px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              +
            </div>
            <span>{action.label}</span>
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
    borderRadius: "20px",
    padding: "0",
    width: "85%",
    height: "85%",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    position: "relative",
    overflow: "hidden",
  };
  const closeBtn = {
    position: "absolute",
    top: "10px",
    right: "10px",
    backgroundColor: "rgb(160, 180,182)",
    border: "none",
    padding: "10px 20px",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "15px",
    cursor: "pointer",
  };

  return (
    <div style={container}>
 

      {/* Welcome */}
      <div
       className="footprintsinner"
      >
        HR – Events and Meetings
      </div>

      {/* Main Content */}
      <div style={mainContent} className="hr-events-root">
        <style>{`.hr-events-root input, .hr-events-root select, .hr-events-root textarea { width: 100px !important; box-sizing: border-box; } .hr-events-root .btn-dropdown-FeesManagement { width: 100px !important; }`}</style>
        {/* Grid Container */}
    <div
  style={{
    display: "grid",
    gridTemplateColumns: isBelow1430 ? "1fr" : "2fr 1fr",
    gap: "20px",
    width: isBelow1430 ? "100%" : "60vw",
    backgroundColor:'#fff',
    padding:'30px',
    borderRadius:'16px',
  borderLeft: "1px solid #ccc",
  borderRight:'1px solid #ccc',
    borderTop:'1px solid #ccc',
  borderBottom:'1px solid #ccc'

  }}
>

  {/* LEFT COLUMN — EVENTS */}
  <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: isBelow1430 ? "100%" : "25vw" }}>
    
    {/* Event Card */}
  <div style={card}>
  {/* Manual Section */}
 <div style={sectionTitleContainer}>
        <div style={sectionCircle(sectionColors[2])}></div>
        <div style={sectionTitle}>Manual Event Entry</div>
      </div>
  <div style={row}>
                                    <div className="expense-input-field">

    <select       className="btn-dropdown-FeesManagement"  style={{width:'100px'}}
 value={selectedEvent?.id || ''} onChange={handleEventChange}>
      <option value="">Select Event</option>
      {events.map((event) => (
        <option key={event.id} value={event.id}>{event.event_name}</option>
      ))}
    </select>
</div>                             
   <div className="expense-input-field">

    <input
      type="text"
      maxLength={150}
      placeholder="Enter title…"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
 className="btn-dropdown-FeesManagement"  style={{width:'100px'}}   />
  </div></div>

  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                    <div className="expense-input-field">

    <textarea
      maxLength={150}
      placeholder="Write up to 150 characters..."
      value={description}
      onChange={(e) => setDescription(e.target.value)}
 className="btn-dropdown-FeesManagement"   style={{width:'100px'}}  />
 </div>
    <button
className="btn-solid"     
    onClick={handleGenerateManual}
    >
      Generate
    </button>
  </div>

  {/* Automatic Section */}
 <div style={sectionTitleContainer}>
        <div style={sectionCircle(sectionColors[2])}></div>
        <div style={sectionTitle}> Automatic Event Entry</div>
      </div>
  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
       <div className="expense-input-field">

    <select className="btn-dropdown-FeesManagement"
 style={{width:'100px'}}      value={selectedEvent?.id || ''}
      onChange={handleEventChange}
    >
      <option value="">Select Event</option>
      {events.map((event) => (
        <option key={event.id} value={event.id}>{event.event_name}</option>
      ))}
    </select>
</div>
    <button
className="btn-solid"      style={{marginTop:'0px'}}
    onClick={handleGenerateAutomatic}
    >
      Generate
    </button>
  </div>

  {/* Event Details */}
  {eventDetails && (
    <div
      style={{
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginTop: '2rem',
        border: '1px solid #e5e7eb',
        width: '100%',
        maxWidth: '800px',
        textAlign: 'center',
      }}
    >
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'semibold', marginBottom: '1rem' }}>
        Event Details
      </h2>

      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        {eventDetails.event_name}
      </h3>

      {eventDetails.title && (
        <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
          Title: {eventDetails.title}
        </p>
      )}

      {eventDetails.description && (
        <p style={{ marginBottom: '0.5rem' }}>
          Description: {eventDetails.description}
        </p>
      )}

      {eventDetails.image && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
          <img
            src={`data:image/jpeg;base64,${eventDetails.image}`}
            alt={eventDetails.event_name}
            style={{
              width: '100%',
              maxWidth: '300px',
              height: 'auto',
              objectFit: 'cover',
              borderRadius: '0.25rem',
              marginBottom: '0.75rem'
            }}
          />

          <button
            onClick={() => handleImageDownload(eventDetails.image)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              backgroundColor: '#5a7488',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Download Image
          </button>
        </div>
      )}
    </div>
  )}

  {/* ⭐ NEW — Event Status Section ⭐ */}
  <div >
    
    <div style={sectionTitleContainer}>
        <div style={sectionCircle(sectionColors[2])}></div>
        <div style={sectionTitle}> Event Status</div>
      </div>

    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <div className="expense-input-field">
 
      {/* Select Event */}
      <select
        className="btn-dropdown-FeesManagement"
        style={{width:'100px'}}
        value={statusEventId}
        onChange={(e) => setStatusEventId(e.target.value)}
      >
        <option value="">Select Event</option>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.event_name}
          </option>
        ))}
      </select>
</div>
   <div className="expense-input-field">

      {/* Status Selection */}
      <select
className="btn-dropdown-FeesManagement"
        style={{width:'100px'}}        value={eventStatus}
        onChange={(e) => setEventStatus(e.target.value)}
      >
        <option value="">Status</option>
        <option value="upcoming">Upcoming</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
</div>
      {/* Button */}
      <button
className="btn-solid"     style={{marginTop:'0px'}}
       onClick={handleUpdateEventStatus}
      >
        Update
      </button>

    </div>
  </div>

  {isLoading && <p>Loading...</p>}
  {error && <p style={{ color: 'red' }}>{error}</p>}
</div>

  </div>

  {/* RIGHT COLUMN — MEETINGS */}
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      width: isBelow1430 ? "100%" : "25vw",
      borderLeft: isBelow1430 ? "none" : "1px solid #ccc",
      borderTop: isBelow1430 ? "1px solid #ccc" : "none",
      paddingLeft: isBelow1430 ? "0" : "20px",
      paddingTop: isBelow1430 ? "20px" : "0",
    }}
  >
    
    {/* Meetings Upcoming */}
    <div style={card}>
      <div style={sectionTitleContainer}>
        <div style={sectionCircle(sectionColors[3])}></div>
        <div style={sectionTitle}>Meetings Upcoming</div>
      </div>
      {renderActionItems(biometricsActions, "meetings", biometricsColors)}
    </div>

    {/* Meeting Status */}
<div style={card}>
  <div style={sectionTitleContainer}>
    <div style={sectionCircle(sectionColors[3])}></div>
    <div style={sectionTitle}>Meeting Status</div>
  </div>

  {/* ==== ROW 1 ==== */}
  <div style={{ display: "flex", gap: "12px", marginTop: "15px" }}>
       <div className="expense-input-field">

    {/* Select by Meeting */}
    <select className="btn-dropdown-FeesManagement" style={{ width: '100px' }}>
      <option value="">Select Meeting</option>
      <option>Meeting 1</option>
      <option>Meeting 2</option>
      <option>Meeting 3</option>
    </select>
</div>
   <div className="expense-input-field">

    {/* Select by Date */}
    <input
      type="date"
      className="btn-dropdown-FeesManagement"
      
    /></div>

    {/* Status Button */}
    <button
    className="btn-solid"
    style={{marginTop:'0px'}}
    >
      Status
    </button>
  </div>

  {/* ==== ROW 2 ==== */}
  <div style={{ display: "flex", gap: "12px", marginTop: "15px" }}>
       <div className="expense-input-field">

    {/* Select by Meeting */}
    <select className="btn-dropdown-FeesManagement" style={{width:'100px'}}>
      <option value="">Select Meeting</option>
      <option>Meeting 1</option>
      <option>Meeting 2</option>
      <option>Meeting 3</option>
    </select></div>
   <div className="expense-input-field">

    {/* Select by Date */}
    <input
      type="date"
      className="btn-dropdown-FeesManagement"
     
    />
</div>
    {/* Update Button */}
    <button
         className="btn-solid"
    style={{marginTop:'0px'}}

    >
      Update
    </button>
  </div>
</div>


  </div>
</div>


        {/* Right Container */}
        <div style={rightContainer}>
          <div style={sectionTitleContainer}>
            <div style={sectionCircle(sectionColors[4])}></div>
            <div style={sectionTitle}>Actions</div>
          </div>

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
                    {`Class: ${className} | Section: ${section} | Pending: ${users.length}`}
                  </div>
                </div>
              );
            })
          )}

          {/* Edited Admissions Logs Section */}
          {editedLogs.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: "16px", color: "#64748b" }}>
              No edited admissions logs found.
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
              const [_, className, section] = key.split("-");
              return (
                <div key={key} style={styles.rowContainer} onClick={() => toggleRow(key)}>
                  <div style={styles.arrowLine}>
<FontAwesomeIcon icon={faArrowRight} style={styles.arrow} />
                    Leave Requests
                  </div>
                  <div style={styles.infoLine}>
                    {`Class: ${className} | Section: ${section} | Pending: ${requests.length}`}
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
                <h3 style={{ marginTop: "30px", textAlign: "center" }}>
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
        <div style={popupOverlay}>
          <div style={popupContent}>
            <button style={closeBtn} onClick={() => setPopup(null)}>
              Close
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

export default EventAndMeetings;
