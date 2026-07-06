import React, { useEffect, useState } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserClock,
  faUserTimes,
  faBookReader,
  faUserCheck,
  faTrophy,
  faExclamationCircle,
  faAward,
} from "@fortawesome/free-solid-svg-icons";

export default function EnrollmentBiometrics() {
  // COMMON STYLES
  const outerContainer = {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#fff",
    minHeight: "70vh",
    padding: "10px",
    boxSizing: "border-box",
  };
  const innerContainer = {
    width: "95%",
    maxWidth: "1200px",
    display: "flex",
    gap: "20px",
    padding: "30px",
    background: "#fff",
    borderRadius: "16px",
    //boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
    marginTop: "80px",
  };
  const leftColumn = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    
    gap: "20px",
  };
  const rightColumn = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  };
  const card = {
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    minHeight: "130px",
    boxShadow: "0px 2px 12px rgba(0,0,0,0.1)",
    fontSize: "12px",
    height: "100%",
    border: "1px solid #ccc",
  };
  const cardLarge = {
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    minHeight: "205px",
    boxShadow: "0px 2px 12px rgba(0,0,0,0.1)",
    height: "auto",
    border: "1px solid #ccc",
  };
  const btnStyle = {
    padding: "8px 12px",
    borderRadius: "8px",
    background: "none",
    color: "#3498db",
    border: "none",
    cursor: "pointer",
    fontSize: "12px",
    width: "150px",
    margin: 0,
  };
  const headingStyle = {
    position: "absolute",
    top: "30px",
    fontSize: "28px",
    fontWeight: "700",
  };
  const thStyle = {
    padding: "12px",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "14px",
    borderBottom: "2px solid #ccc",
    borderLeft: "1px solid #ddd",
  };
  const tdStyle = {
    padding: "12px",
    textAlign: "center",
    fontSize: "14px",
    borderBottom: "1px solid #e0e0e0",
    borderLeft: "1px solid #f0f0f0",
  };
  const boxStyle = {
    flex: 1,
    padding: "8px",
    borderRight: "1px solid #ccc",
    borderRadius: "4px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    height: "140px",
    margin: "0 2px",
  };
  const iconStyle = { fontSize: "16px", marginBottom: "5px", color: "#000" };
  // END COMMON STYLES

  // STATES
  const [records, setRecords] = useState([]);
  const [biometricsRecords, setBiometricsRecords] = useState([]);
  const [filter, setFilter] = useState("");
  const [admissions, setAdmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [student, setStudent] = useState([]);

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState({
    records: true,
    biometrics: true,
    admissions: true,
    students: true,
    teachers: true,
  });
  const [error, setError] = useState({
    records: "",
    biometrics: "",
    admissions: "",
    students: "",
    teachers: "",
  });
  const [showAttendancePopup, setShowAttendancePopup] = useState(false);
  const [showAdmissionsPopup, setShowAdmissionsPopup] = useState(false);
  const [showStudentsPopup, setShowStudentsPopup] = useState(false);
  const [showTeachersPopup, setShowTeachersPopup] = useState(false);
  const [attendanceSource, setAttendanceSource] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedMonthForBiometrics, setSelectedMonthForBiometrics] =
    useState("");
  const [showLeavesPopup, setShowLeavesPopup] = useState(false);
  const [requests, setRequests] = useState([]);
  const [walkInsCount, setWalkInsCount] = useState(420);
  const [passedTestsCount, setPassedTestsCount] = useState(0);
  const [showHighScorePopup, setshowHighScorePopup] = useState(false);
  const schoolCode = localStorage.getItem("schoolCode") || "NOVA";
  const months = [
    "2025-01",
    "2025-02",
    "2025-03",
    "2025-04",
    "2025-05",
    "2025-06",
    "2025-07",
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
  ];

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    if (dateString.includes("T")) {
      dateString = dateString.split("T")[0];
    }
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  /**
   * Function to filter Irregular records by the selected month.
   */
  const filterIrregularsByMonth = (data, monthYear) => {
    if (!monthYear || !data || data.length === 0) return [];
    return data.filter((record) => {
      const recordDate = record.date;
      if (!recordDate) return false;
      const recordMonthYear = recordDate.substring(0, 7);
      return recordMonthYear === monthYear;
    });
  };

  // Fetch top students with scores
  useEffect(() => {
    fetchTopStudents();
  }, []);

  const fetchTopStudents = async () => {
    try {
      const response = await axios.get(
        "https://skhoolo.com:4000/top-students",
        {
          params: { schoolCode },
        }
      );
      console.log("Fetched students:", response.data); // Log the response
      setStudent(response.data);
      setPassedTestsCount(response.data.filter((s) => s.score > 65).length);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading((prev) => ({ ...prev, student: false }));
    }
  };

  // DATA FETCHING: Initial Load for other data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [admissionsRes, studentsRes, teachersRes] = await Promise.all([
          axios.get("https://skhoolo.com:4000/newadmissions", {
            params: { schoolCode },
          }),
          axios.get("https://skhoolo.com:4000/students-details", {
            params: { schoolCode },
          }),
          axios.post("https://skhoolo.com:4000/api/users", {
            schoolCode,
            user_type: "teacher",
          }),
        ]);
        setAdmissions(admissionsRes.data);
        setStudents(studentsRes.data.students || []);
        setTeachers(teachersRes.data);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError((prev) => ({
          ...prev,
          admissions: "Failed to fetch admissions",
          students: "Failed to fetch students",
          teachers: "Failed to fetch teachers",
        }));
      } finally {
        setLoading((prev) => ({
          ...prev,
          admissions: false,
          students: false,
          teachers: false,
        }));
      }
    };
    fetchData();
  }, [schoolCode]);

  // DATA FETCHING: Attendance and Leaves based on selectedMonth
  const fetchAttendanceAndLeaves = async (month, isBiometrics = false) => {
    if (!month) return;
    const loadingKey = isBiometrics ? "biometrics" : "records";
    const errorKey = isBiometrics ? "biometrics" : "records";
    setLoading((prev) => ({ ...prev, [loadingKey]: true }));
    setError((prev) => ({ ...prev, [errorKey]: "" }));
    try {
      const [irregularsRes, leavesRes] = await Promise.all([
        axios.get("https://skhoolo.com:4000/list-of-irregulars", {
          params: { schoolCode, month },
        }),
        axios.get("https://skhoolo.com:4000/leave-requests-list", {
          params: { schoolCode, month },
        }),
      ]);

      const allIrregulars = irregularsRes.data.filter(
        (rec) =>
          rec.leavetype &&
          (rec.leavetype.toLowerCase() === "informed" ||
            rec.leavetype.toLowerCase() === "uninformed")
      );
      const filteredIrregulars = filterIrregularsByMonth(allIrregulars, month);

      const filteredLeaves = leavesRes.data.filter((req) => {
        const recordDate = req.start_date;
        if (!recordDate) return false;
        const recordMonthYear = recordDate.substring(0, 7);
        return recordMonthYear === month;
      });

      if (isBiometrics) {
        setBiometricsRecords(filteredIrregulars);
      } else {
        setRecords(filteredIrregulars);
        const currentWalkIns = 420;
        setWalkInsCount(currentWalkIns);
      }
      setRequests(filteredLeaves);
    } catch (err) {
      console.error("Error fetching attendance and leaves:", err);
      setError((prev) => ({
        ...prev,
        [errorKey]: "Failed to fetch attendance/leaves for selected month.",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  // Trigger data fetch when the month changes (Enrollments card)
  useEffect(() => {
    if (selectedMonth) {
      fetchAttendanceAndLeaves(selectedMonth);
    } else {
      setRecords([]);
    }
  }, [selectedMonth, schoolCode]);

  // Trigger data fetch when the month changes (Biometrics card)
  useEffect(() => {
    if (selectedMonthForBiometrics) {
      fetchAttendanceAndLeaves(selectedMonthForBiometrics, true);
    } else {
      setBiometricsRecords([]);
      setRequests([]);
    }
  }, [selectedMonthForBiometrics, schoolCode]);

  const handleShowAttendancePopup = (source) => {
    setAttendanceSource(source);
    setShowAttendancePopup(true);
  };

  return (
    <div style={outerContainer}>
      <h2 style={headingStyle}>Enrollments and Biometrics</h2>
      <div style={innerContainer}>
        {/* LEFT COLUMN */}
        <div style={leftColumn}>
          {/* Card 1: Enrollments */}
          <div style={cardLarge}>
            <div style={{ marginBottom: "15px", textAlign: "right" }}>
              <select
                id="month"
                style={{
                  padding: "6px",
                  fontSize: "13px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  minWidth: "120px",
                }}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="">Select Month</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "5px",
                marginBottom: "15px",
                paddingBottom: "15px",
                borderBottom: "1px solid #ccc",
              }}
            >
              <div style={boxStyle}>
                <FontAwesomeIcon icon={faBookReader} style={iconStyle} />
                <h4 style={{ margin: "0 0 5px 0", fontSize: "12px" }}>
                  walk-ins
                </h4>
                <p
                  style={{ fontSize: "16px", fontWeight: "bold", margin: "0" }}
                >
                  {walkInsCount}
                </p>
                <button
                  style={btnStyle}
                  onClick={() => setShowAdmissionsPopup(true)}
                >
                  View List
                </button>
              </div>
              <div style={boxStyle}>
                <FontAwesomeIcon icon={faUserCheck} style={iconStyle} />
                <h4 style={{ margin: "0 0 5px 0", fontSize: "12px" }}>
                  passed tests
                </h4>
                <p
                  style={{ fontSize: "16px", fontWeight: "bold", margin: "0" }}
                >
                  {passedTestsCount}
                </p>
                <button
                  style={btnStyle}
                  onClick={() => setshowHighScorePopup(true)}
                >
                  View List
                </button>
              </div>
              <div style={boxStyle}>
                <FontAwesomeIcon icon={faTrophy} style={iconStyle} />
                <h4 style={{ margin: "0 0 5px 0", fontSize: "12px" }}>
                  Admissions
                </h4>
                <p
                  style={{ fontSize: "16px", fontWeight: "bold", margin: "0" }}
                >
                  {admissions.length}
                </p>
                <button
                  style={btnStyle}
                  onClick={() => setShowAdmissionsPopup(true)}
                >
                  View List
                </button>
              </div>
            </div>
            <div style={{ marginTop: "15px" }}>
              <h2
                style={{
                  textAlign: "left",
                  fontSize: "12px",
                  margin: "0 0 15px 0",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <FontAwesomeIcon
                  icon={faExclamationCircle}
                  style={{ marginRight: "5px", fontSize: "12px" }}
                />
                14 admissions pending for approval
              </h2>
              <h2
                style={{
                  textAlign: "left",
                  fontSize: "12px",
                  margin: "0 0 15px 0",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <FontAwesomeIcon
                  icon={faAward}
                  style={{ marginRight: "5px", fontSize: "12px" }}
                />
                100 rejected in written test
              </h2>
              <h2
                style={{
                  textAlign: "left",
                  fontSize: "12px",
                  margin: "0 0 15px 0",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <FontAwesomeIcon
                  icon={faAward}
                  style={{ marginRight: "5px", fontSize: "12px" }}
                />
                50 rejected in counselling
              </h2>
            </div>
          </div>
          {/* Card 2: Biometrics/Attendance Data */}
          <div style={cardLarge}>
            <div style={{ marginBottom: "15px", textAlign: "right" }}>
              <select
                id="monthForBiometrics"
                style={{
                  padding: "6px",
                  fontSize: "13px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  minWidth: "120px",
                }}
                value={selectedMonthForBiometrics}
                onChange={(e) => setSelectedMonthForBiometrics(e.target.value)}
              >
                <option value="">Select Month</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {selectedMonthForBiometrics && loading.biometrics ? (
              <p style={{ textAlign: "center" }}>Loading...</p>
            ) : selectedMonthForBiometrics && error.biometrics ? (
              <p style={{ textAlign: "center", color: "red" }}>
                {error.biometrics}
              </p>
            ) : (
              <div
                style={{
                  flex: "0 0 60%",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "15px",
                  background: "#f9f9f9",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "5px",
                  }}
                >
                  <div
                    style={{
                      ...boxStyle,
                      borderRight: "1px solid #ccc",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <FontAwesomeIcon icon={faUserClock} style={iconStyle} />
                    <h4 style={{ margin: "0 0 5px 0", fontSize: "12px" }}>
                      Irregulars
                    </h4>
                    <p
                      style={{
                        fontSize: "16px",
                        fontWeight: "bold",
                        margin: "5px 0",
                      }}
                    >
                      {biometricsRecords.length}
                    </p>
                    <button
                      onClick={() => handleShowAttendancePopup("biometrics")}
                      style={{
                        padding: "6px 10px", // Adjust padding to make the button compact
                        borderRadius: "8px", // Rounded corners
                        background: "transparent", // Transparent background
                        color: "#3498db", // Button text color
                        border: "1px solid #3498db", // Optional: Adds a blue border to make the button visible
                        cursor: "pointer",
                        fontSize: "12px",
                        margin: 0, // Removes any extra margin
                        width: "auto", // Auto width based on text size
                      }}
                    >
                      view list
                    </button>
                  </div>
                  <div
                    style={{
                      ...boxStyle,
                      borderRight: "1px solid #ccc",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <FontAwesomeIcon icon={faUserTimes} style={iconStyle} />
                    <h4 style={{ margin: "0 0 5px 0", fontSize: "12px" }}>
                      Absentees
                    </h4>
                    <p
                      style={{
                        fontSize: "16px",
                        fontWeight: "bold",
                        margin: "5px 0",
                      }}
                    >
                      {biometricsRecords.length}
                    </p>
                    <button
                      onClick={() => handleShowAttendancePopup("biometrics")}
                      style={{
                        padding: "6px 10px", // Adjust padding to make the button compact
                        borderRadius: "8px", // Rounded corners
                        background: "transparent", // Transparent background
                        color: "#3498db", // Button text color
                        border: "1px solid #3498db", // Optional: Adds a blue border to make the button visible
                        cursor: "pointer",
                        fontSize: "12px",
                        margin: 0, // Removes any extra margin
                        width: "auto", // Auto width based on text size
                      }}
                    >
                      view list
                    </button>
                  </div>
                  <div
                    style={{
                      ...boxStyle,
                      borderRight: "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <FontAwesomeIcon icon={faUserTimes} style={iconStyle} />
                    <h4
                      style={{
                        margin: "0 0 5px 0",
                        fontSize: "12px",
                      }}
                    >
                      Leaves
                    </h4>
                    <p
                      style={{
                        fontSize: "16px",
                        fontWeight: "bold",
                        margin: "5px 0",
                      }}
                    >
                      {requests.length}
                    </p>
                    <button
                      onClick={() => setShowLeavesPopup(true)}
                      style={{
                        padding: "6px 10px", // Adjust padding to make the button compact
                        borderRadius: "8px", // Rounded corners
                        background: "transparent", // Transparent background
                        color: "#3498db", // Button text color
                        border: "1px solid #3498db",
                        cursor: "pointer",
                        fontSize: "12px",
                        width: "auto",
                      }}
                    >
                      View List
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* RIGHT COLUMN */}
        <div style={rightColumn}>
          <div style={card}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "600",
                margin: "0 0 5px 0",
              }}
            >
              Student Strength
            </h3>
            <h3 style={{ fontSize: "16px", margin: "0 0 5px 0" }}>
              {students.length}
            </h3>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "8px",
              }}
            >
              <button
                onClick={() => setShowStudentsPopup(true)}
                style={{
                  padding: "6px 10px", // Adjust padding to make the button compact
                  borderRadius: "8px", // Rounded corners
                  background: "transparent", // Transparent background
                  color: "#3498db", // Button text color
                  border: "1px solid #3498db", // Optional: Adds a blue border to make the button visible
                  cursor: "pointer",
                  fontSize: "12px",
                  margin: 0, // Removes any extra margin
                  width: "auto", // Auto width based on text size
                }}
              >
                view list
              </button>
            </div>
          </div>
          <div style={card}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "600",
                margin: "0 0 5px 0",
              }}
            >
              Attendance
            </h3>
            <h3 style={{ fontSize: "16px", margin: "0 0 5px 0" }}>
              {biometricsRecords.length}
            </h3>
            <h3 style={{ fontSize: "12px", margin: "0 0 5px 0" }}>
              Unpunctuals
            </h3>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "8px",
              }}
            >
              <button
                onClick={() => handleShowAttendancePopup("biometrics")}
                style={{
                  padding: "6px 10px", // Adjust padding to make the button compact
                  borderRadius: "8px", // Rounded corners
                  background: "transparent", // Transparent background
                  color: "#3498db", // Button text color
                  border: "1px solid #3498db", // Optional: Adds a blue border to make the button visible
                  cursor: "pointer",
                  fontSize: "12px",
                  margin: 0, // Removes any extra margin
                  width: "auto", // Auto width based on text size
                }}
              >
                view list
              </button>
            </div>
          </div>
          <div style={card}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "600",
                margin: "0 0 5px 0",
              }}
            >
              {" "}
              Admissions{" "}
            </h3>
            <h3 style={{ fontSize: "16px", margin: "0 0 5px 0" }}>
              {admissions.length}
            </h3>
            <h3 style={{ fontSize: "12px", margin: "0 0 5px 0" }}>
              Pending Approvals
            </h3>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "8px",
              }}
            >
              <button
                onClick={() => setShowAdmissionsPopup(true)}
                style={{
                  padding: "6px 10px", // Adjust padding to make the button compact
                  borderRadius: "8px", // Rounded corners
                  background: "transparent", // Transparent background
                  color: "#3498db", // Button text color
                  border: "1px solid #3498db",
                  cursor: "pointer",
                  fontSize: "12px",
                  width: "auto",
                }}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* POPUPS */}
      {showLeavesPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
              Leave Requests ({selectedMonthForBiometrics || "All Time"})
            </h2>
            {loading.biometrics ? (
              <p style={{ textAlign: "center" }}>Loading...</p>
            ) : error.biometrics ? (
              <p style={{ textAlign: "center", color: "red" }}>
                {error.biometrics}
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "rgba(141,171,182,255)",
                      color: "#fff",
                      textAlign: "left",
                    }}
                  >
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Class</th>
                    <th style={thStyle}>Section</th>
                    <th style={thStyle}>Student Name</th>
                    <th style={thStyle}>Start Date</th>
                    <th style={thStyle}>End Date</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req, index) => (
                    <tr
                      key={req.id}
                      style={{
                        background: index % 2 === 0 ? "#fdfdfd" : "#f5f9fc",
                      }}
                    >
                      <td style={tdStyle}>{req.id}</td>
                      <td style={tdStyle}>{req.class_name}</td>
                      <td style={tdStyle}>{req.section}</td>
                      <td style={tdStyle}>{req.student_name}</td>
                      <td style={tdStyle}>{formatDate(req.start_date)}</td>
                      <td style={tdStyle}>{formatDate(req.end_date)}</td>
                      <td style={tdStyle}>{req.reason}</td>
                      <td style={tdStyle}>{formatDate(req.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              onClick={() => setShowLeavesPopup(false)}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                background: "rgba(141,171,182,255)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                float: "right",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showStudentsPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
              Student Details
            </h2>
            {loading.students ? (
              <p style={{ textAlign: "center" }}>Loading...</p>
            ) : error.students ? (
              <p style={{ textAlign: "center", color: "red" }}>
                {error.students}
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "rgba(141,171,182,255)",
                      color: "#fff",
                    }}
                  >
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Gender</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Father Name</th>
                    <th style={thStyle}>Class</th>
                    <th style={thStyle}>Section</th>
                    <th style={thStyle}>School</th>
                    <th style={thStyle}>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, index) => (
                    <tr
                      key={s.id}
                      style={{
                        background: index % 2 === 0 ? "#fcfcfc" : "#f3f8fb",
                      }}
                    >
                      <td style={tdStyle}>{s.id}</td>
                      <td style={tdStyle}>{s.name}</td>
                      <td style={tdStyle}>{s.gender}</td>
                      <td style={tdStyle}>{s.phone_no}</td>
                      <td style={tdStyle}>{s.father_name}</td>
                      <td style={tdStyle}>{s.class_name}</td>
                      <td style={tdStyle}>{s.section}</td>
                      <td style={tdStyle}>{s.school_name}</td>
                      <td style={tdStyle}>{s.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              onClick={() => setShowStudentsPopup(false)}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                background: "rgba(141,171,182,255)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                float: "right",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showAttendancePopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
              Irregular Attendance (
              {attendanceSource === "enrollments"
                ? selectedMonth
                : selectedMonthForBiometrics || "All Time"}
              )
            </h2>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              {["All", "Informed", "UnInformed"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type === "All" ? "" : type)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    background:
                      filter === type || (type === "All" && filter === "")
                        ? "#3498db"
                        : "#ecf0f1",
                    color:
                      filter === type || (type === "All" && filter === "")
                        ? "#fff"
                        : "#2c3e50",
                    border: "none",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
            {(() => {
              let displayRecords = [];
              let isLoading = false;
              let errorMessage = "";
              let selectedM = "";
              if (attendanceSource === "enrollments") {
                displayRecords = records;
                isLoading = loading.records;
                errorMessage = error.records;
                selectedM = selectedMonth;
              } else {
                displayRecords = biometricsRecords;
                isLoading = loading.biometrics;
                errorMessage = error.biometrics;
                selectedM = selectedMonthForBiometrics;
              }
              const filteredList = displayRecords.filter(
                (rec) =>
                  filter === "" ||
                  (rec.leavetype &&
                    rec.leavetype.toLowerCase() === filter.toLowerCase())
              );
              if (isLoading) {
                return (
                  <p style={{ textAlign: "center", color: "#2980b9" }}>
                    Loading irregulars...
                  </p>
                );
              }
              if (errorMessage) {
                return (
                  <p style={{ textAlign: "center", color: "red" }}>
                    {errorMessage}
                  </p>
                );
              }
              if (filteredList.length === 0 && selectedM) {
                return (
                  <p style={{ textAlign: "center", color: "#555" }}>
                    No irregular records found for the selected month and
                    filter.
                  </p>
                );
              }
              return (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        background: "rgba(141,171,182,255)",
                        color: "#fff",
                        textAlign: "left",
                      }}
                    >
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Class</th>
                      <th style={thStyle}>Section</th>
                      <th style={thStyle}>Leave Type</th>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Username</th>
                      <th style={thStyle}>Submission Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((rec, index) => (
                      <tr
                        key={index}
                        style={{
                          background: index % 2 === 0 ? "#fdfdfd" : "#f5f9fc",
                        }}
                      >
                        <td style={tdStyle}>{rec.ID}</td>
                        <td style={tdStyle}>{rec.name}</td>
                        <td style={tdStyle}>{rec.class}</td>
                        <td style={tdStyle}>{rec.section}</td>
                        <td style={tdStyle}>{rec.leavetype}</td>
                        <td style={tdStyle}>{formatDate(rec.date)}</td>
                        <td style={tdStyle}>{rec.username}</td>
                        <td style={tdStyle}>{rec.submission_time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
            <button
              onClick={() => {
                setShowAttendancePopup(false);
                setAttendanceSource("");
              }}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                background: "rgba(141,171,182,255)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                float: "right",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showAdmissionsPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
              {" "}
              Admissions ({admissions.length})
            </h2>
            {loading.admissions ? (
              <p style={{ textAlign: "center", color: "#2980b9" }}>
                Loading admissions...
              </p>
            ) : error.admissions ? (
              <p style={{ textAlign: "center", color: "red" }}>
                {error.admissions}
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "rgba(141,171,182,255)",
                      color: "#fff",
                      textAlign: "left",
                    }}
                  >
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Student Name</th>
                    <th style={thStyle}>DOB</th>
                    <th style={thStyle}>Gender</th>
                    <th style={thStyle}>Class Applied</th>
                    <th style={thStyle}>Father Name</th>
                    <th style={thStyle}>Mother Name</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>City</th>
                    <th style={thStyle}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {admissions.map((student, index) => (
                    <tr
                      key={student.id}
                      style={{
                        background: index % 2 === 0 ? "#fdfdfd" : "#f5f9fc",
                      }}
                    >
                      <td style={tdStyle}>{student.id}</td>
                      <td style={tdStyle}>{student.student_name}</td>
                      <td style={tdStyle}>{formatDate(student.dob)}</td>
                      <td style={tdStyle}>{student.gender}</td>
                      <td style={tdStyle}>{student.applying_for}</td>
                      <td style={tdStyle}>{student.father_name}</td>
                      <td style={tdStyle}>{student.mother_name}</td>
                      <td style={tdStyle}>{student.phone}</td>
                      <td style={tdStyle}>{student.city}</td>
                      <td style={tdStyle}>
                        {formatDate(student.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              onClick={() => setShowAdmissionsPopup(false)}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                background: "rgba(141,171,182,255)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                float: "right",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showHighScorePopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
              High Scorers (Above 35 Marks) (
              {student.filter((s) => s.score > 35).length})
            </h2>
            {loading.student ? (
              <p style={{ textAlign: "center", color: "#2980b9" }}>
                Loading scores...
              </p>
            ) : student.filter((s) => s.score > 35).length === 0 ? (
              <p style={{ textAlign: "center", color: "red" }}>
                No students found with score above 35.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "rgba(141,171,182,255)",
                      color: "#fff",
                      textAlign: "left",
                    }}
                  >
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Student Name</th>
                    <th style={thStyle}>Class</th>
                    <th style={thStyle}>Subject</th>
                    <th style={thStyle}>Score</th>
                    <th style={thStyle}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {student
                    .filter((s) => s.score > 35)
                    .map((s, index) => (
                      <tr
                        key={s.id}
                        style={{
                          background: index % 2 === 0 ? "#fdfdfd" : "#f5f9fc",
                        }}
                      >
                        <td style={tdStyle}>{s.id}</td>
                        <td style={tdStyle}>{s.student_name}</td>
                        <td style={tdStyle}>{s.student_class}</td>
                        <td style={tdStyle}>{s.subject}</td>
                        <td style={tdStyle}>{s.score}</td>
                        <td style={tdStyle}>{formatDate(s.created_at)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            <button
              onClick={() => setshowHighScorePopup(false)}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                background: "rgba(141,171,182,255)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                float: "right",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
