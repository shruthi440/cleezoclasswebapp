import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaUser } from "react-icons/fa";
import "./AdminReportsPage.css";
import "./AdminDashboardNew.css";
import "../frontdeskdahboard/FrontDesk.css";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";

import dashboardIcon from "../assets/Dashboard.png";
import academicsIcon from "../assets/Staff Assign.png";
import leadProfileIcon from "../assets/Lead Profile.png";
import enrollmentIcon from "../assets/Enrollment.png";
import reportsIcon from "../assets/Reports .png";
import timelineIcon from "../assets/Timeline.png";
import followupIcon from "../assets/Profile.png";
import assistantIcon from "../assets/Assistant.png";
import communicationIcon from "../assets/Communication Assign.png";

const API_BASE = "https://cleezoclass.com:4000/api";

type ReportType = "attendance" | "marks" | "topper" | "low" | "high";

type AttendanceRow = {
  name: string;
  class_name: string;
  section: string;
  present_days: number;
  informed_days: number;
  uninformed_days: number;
  total_days: number;
  attendance_percentage: number;
};

type MarksRow = {
  name: string;
  class_name: string;
  section: string;
  subject: string;
  test_type: string;
  marks: number;
  created_at: string;
};

type TopperRow = {
  name: string;
  class_name: string;
  section: string;
  total_marks: number;
  average_marks: number;
  total_tests: number;
};

const sidebarItems = [
  { key: "dashboard", label: "Dashboard", icon: dashboardIcon, route: "/AdminDashboard" },
  { key: "academics", label: "Academics", icon: academicsIcon, route: "/AdiminAcademicsNew" },
  { key: "events", label: "Events & Meetings", icon: leadProfileIcon, route: "/AdminEventsAndMeetings" },
  { key: "communication", label: "Generations", icon: communicationIcon, route: "/AdminGenerations" },
  { key: "enrollments", label: "Store", icon: enrollmentIcon, route: "/AdminStoreNew" },
  { key: "reports", label: "Reports", icon: reportsIcon, route: "/AdminReportsPage" },
];

const quickCards = [
  { key: "attendance" as const, title: "Attendance", subtitle: "Class wise attendance list", icon: timelineIcon },
  { key: "marks" as const, title: "Academic Marks", subtitle: "Student marks list", icon: academicsIcon },
  { key: "topper" as const, title: "Topper List", subtitle: "Highest average performers", icon: assistantIcon },
  { key: "low" as const, title: "Low Performance", subtitle: "Below 40 marks", icon: followupIcon },
  { key: "high" as const, title: "High Performance", subtitle: "80+ marks", icon: communicationIcon },
];

const monthOptions = (() => {
  const months: Array<{ value: string; label: string }> = [{ value: "", label: "All Months" }];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = date.toISOString().slice(0, 7);
    const label = date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    months.push({ value, label });
  }
  return months;
})();

const formatNumber = (value: unknown, decimals = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return decimals ? "0.00" : "0";
  return decimals ? parsed.toFixed(decimals) : String(Math.round(parsed));
};

const formatDate = (value: unknown) => {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB");
};

const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase();

const matchesSearch = (text: string, search: string) =>
  !search || normalizeText(text).includes(normalizeText(search));

const AdminReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeSidebar, setActiveSidebar] = useState("reports");
  const [activeTopTab, setActiveTopTab] = useState("Reports");
  const [schoolLogo, setSchoolLogo] = useState("/default-logo.png");
  const [schoolName, setSchoolName] = useState("Institute");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);

  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [sectionOptions, setSectionOptions] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [activeReport, setActiveReport] = useState<ReportType>("attendance");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [marksRows, setMarksRows] = useState<MarksRow[]>([]);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    let cancelled = false;
    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${encodeURIComponent(schoolCode)}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        setSchoolLogo(data?.logo || "/default-logo.png");
        setSchoolName(data?.institute_name || data?.schoolName || data?.name || schoolCode || "Institute");
      })
      .catch(() => {
        if (cancelled) return;
        setSchoolLogo("/default-logo.png");
        setSchoolName(schoolCode || "Institute");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    let cancelled = false;
    axios
      .get(`${API_BASE}/classes`, { params: { schoolCode } })
      .then((res) => {
        if (cancelled) return;
        const classes = Array.isArray(res.data) ? res.data.filter(Boolean) : [];
        setClassOptions(classes);
      })
      .catch(() => {
        if (cancelled) return;
        setClassOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    if (selectedClass === "All") {
      setSectionOptions([]);
      if (selectedSection !== "All") {
        setSelectedSection("All");
      }
      return;
    }

    let cancelled = false;
    axios
      .get(`${API_BASE}/sections/${encodeURIComponent(selectedClass)}`, { params: { schoolCode } })
      .then((res) => {
        if (cancelled) return;
        const sections = Array.isArray(res.data) ? res.data.filter(Boolean) : [];
        setSectionOptions(sections);
        if (selectedSection !== "All" && !sections.includes(selectedSection)) {
          setSelectedSection("All");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSectionOptions([]);
        setSelectedSection("All");
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClass, selectedSection]);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    let cancelled = false;

    const loadReports = async () => {
      setLoading(true);
      setError("");

      try {
        const params = {
          schoolCode,
          className: selectedClass,
          section: selectedSection,
          month: selectedMonth || "All",
        };

        const [attendanceRes, marksRes] = await Promise.all([
          axios.get(`${API_BASE}/admin/class-wise-attendance-list`, { params }),
          axios.get(`${API_BASE}/admin/class-wise-academic-marks-list`, { params }),
        ]);

        if (!cancelled) {
          setAttendanceRows(Array.isArray(attendanceRes.data) ? attendanceRes.data : []);
          setMarksRows(Array.isArray(marksRes.data) ? marksRes.data : []);
        }
      } catch (err: any) {
        if (cancelled) return;
        setAttendanceRows([]);
        setMarksRows([]);
        setError(
          err?.response?.data?.error ||
            err?.message ||
            "Failed to load admin reports."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [selectedClass, selectedSection, selectedMonth]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredAttendanceRows = useMemo(
    () =>
      attendanceRows.filter((row) =>
        [row.name, row.class_name, row.section, String(row.present_days), String(row.total_days)].some((value) =>
          matchesSearch(value, search)
        )
      ),
    [attendanceRows, search]
  );

  const filteredMarksRows = useMemo(
    () =>
      marksRows.filter((row) =>
        [row.name, row.class_name, row.section, row.subject, row.test_type, String(row.marks)].some((value) =>
          matchesSearch(value, search)
        )
      ),
    [marksRows, search]
  );

  const topperRows = useMemo<TopperRow[]>(() => {
    const studentMap = new Map<
      string,
      {
        name: string;
        class_name: string;
        section: string;
        totalMarks: number;
        totalTests: number;
        bestSubject: string;
        bestMarks: number;
      }
    >();

    filteredMarksRows.forEach((row) => {
      const key = `${row.name}|${row.class_name}|${row.section}`;
      const existing = studentMap.get(key) || {
        name: row.name,
        class_name: row.class_name,
        section: row.section,
        totalMarks: 0,
        totalTests: 0,
        bestSubject: "-",
        bestMarks: -1,
      };

      const marks = Number(row.marks) || 0;
      existing.totalMarks += marks;
      existing.totalTests += 1;
      if (marks >= existing.bestMarks) {
        existing.bestMarks = marks;
        existing.bestSubject = row.subject || "-";
      }
      studentMap.set(key, existing);
    });

    const classGroups = new Map<string, TopperRow[]>();

    Array.from(studentMap.values()).forEach((item) => {
      const totalMarks = item.totalMarks;
      const row: TopperRow = {
        name: item.name,
        class_name: item.class_name,
        section: item.section,
        total_marks: totalMarks,
        average_marks: item.totalTests ? item.totalMarks / item.totalTests : 0,
        total_tests: item.totalTests,
      };
      const groupKey = `${item.class_name}|${item.section}`;
      const bucket = classGroups.get(groupKey) || [];
      bucket.push(row);
      classGroups.set(groupKey, bucket);
    });

    return Array.from(classGroups.entries()).flatMap(([, rows]) =>
      rows
        .sort((a, b) => b.total_marks - a.total_marks || a.name.localeCompare(b.name))
        .slice(0, 3)
    );
  }, [filteredMarksRows]);

  const lowRows = useMemo(
    () =>
      [...filteredMarksRows]
        .sort((a, b) => Number(a.marks) - Number(b.marks) || a.name.localeCompare(b.name))
        .slice(0, 10),
    [filteredMarksRows]
  );

  const highRows = useMemo(
    () =>
      [...filteredMarksRows]
        .sort((a, b) => Number(b.marks) - Number(a.marks) || a.name.localeCompare(b.name))
        .slice(0, 10),
    [filteredMarksRows]
  );

  const visibleRows = useMemo(() => {
    switch (activeReport) {
      case "marks":
        return filteredMarksRows;
      case "topper":
        return topperRows;
      case "low":
        return lowRows;
      case "high":
        return highRows;
      case "attendance":
      default:
        return filteredAttendanceRows;
    }
  }, [activeReport, filteredAttendanceRows, filteredMarksRows, highRows, lowRows, topperRows]);

  const attendanceAverage = useMemo(() => {
    if (!filteredAttendanceRows.length) return 0;
    return filteredAttendanceRows.reduce((sum, row) => sum + Number(row.attendance_percentage || 0), 0) / filteredAttendanceRows.length;
  }, [filteredAttendanceRows]);

  const marksAverage = useMemo(() => {
    if (!filteredMarksRows.length) return 0;
    return filteredMarksRows.reduce((sum, row) => sum + Number(row.marks || 0), 0) / filteredMarksRows.length;
  }, [filteredMarksRows]);



  const handleSidebarClick = (key: string) => {
    setActiveSidebar(key);
    if (key === "dashboard") navigate("/AdminDashboard");
    if (key === "academics") navigate("/AdiminAcademicsNew");
    if (key === "events") navigate("/AdminEventsAndMeetings");
    if (key === "communication") navigate("/AdminGenerations");
    if (key === "enrollments") navigate("/AdminStoreNew");
    if (key === "reports") navigate("/AdminReportsPage");
  };

  const renderTable = () => {
    if (loading) {
      return <div className="admin-reports-empty-state">Loading reports...</div>;
    }

    if (!visibleRows.length) {
      return <div className="admin-reports-empty-state">{error || "No rows found for the selected filters."}</div>;
    }

    if (activeReport === "attendance") {
      const rows = visibleRows as AttendanceRow[];
      return (
        <table className="admin-reports-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Section</th>
              <th>Present</th>
              <th>Informed</th>
              <th>Uninformed</th>
              <th>Total Days</th>
              <th>Attendance %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.name}-${row.class_name}-${row.section}`}>
                <td>{row.name}</td>
                <td>{row.class_name}</td>
                <td>{row.section}</td>
                <td>{formatNumber(row.present_days)}</td>
                <td>{formatNumber(row.informed_days)}</td>
                <td>{formatNumber(row.uninformed_days)}</td>
                <td>{formatNumber(row.total_days)}</td>
                <td>{formatNumber(row.attendance_percentage, 2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeReport === "marks") {
      const rows = visibleRows as MarksRow[];
      return (
        <table className="admin-reports-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Section</th>
              <th>Subject</th>
              <th>Test Type</th>
              <th>Marks</th>
              <th>Created On</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.name}-${row.class_name}-${row.section}-${row.subject}-${row.created_at}`}>
                <td>{row.name}</td>
                <td>{row.class_name}</td>
                <td>{row.section}</td>
                <td>{row.subject}</td>
                <td>{row.test_type}</td>
                <td>{formatNumber(row.marks)}</td>
                <td>{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeReport === "topper") {
      const rows = visibleRows as TopperRow[];
      return (
        <table className="admin-reports-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Section</th>
              <th>Total Marks</th>
              <th>Tests</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.name}-${row.class_name}-${row.section}`}>
                <td>{row.name}</td>
                <td>{row.class_name}</td>
                <td>{row.section}</td>
                <td>{formatNumber(row.total_marks)}</td>
                <td>{formatNumber(row.total_tests)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    const rows = visibleRows as MarksRow[];
    return (
      <table className="admin-reports-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Class</th>
            <th>Section</th>
            <th>Subject</th>
            <th>Test Type</th>
            <th>Marks</th>
            <th>Created On</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.name}-${row.class_name}-${row.section}-${row.subject}-${row.created_at}`}>
              <td>{row.name}</td>
              <td>{row.class_name}</td>
              <td>{row.section}</td>
              <td>{row.subject}</td>
              <td>{row.test_type}</td>
              <td>{formatNumber(row.marks)}</td>
              <td>{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="dashboard-page frontdesk-dashboard-page admin-reports-page">
      <div className="dashboard-shell accountant-dashboard-shell">
        <aside className="dashboard-sidebar accountant-sidebar-strip">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`dashboard-sidebar-item accountant-sidebar-item ${activeSidebar === item.key ? "dashboard-sidebar-item-active accountant-sidebar-item-active" : ""}`}
              onClick={() => handleSidebarClick(item.key)}
            >
              <div className="dashboard-sidebar-item-icon accountant-sidebar-item-icon">
                <img src={item.icon} alt={item.label} />
              </div>
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        <div className="dashboard-main accountant-main-area admin-reports-main">
          <div className="dashboard-topbar accountant-topbar">
            <div className="dashboard-topbar-left accountant-topbar-left">
              {["Dashboard", "Academics", "Events & Meetings", "Reports"].map((tab) => (
                <div
                  key={tab}
                  className={`dashboard-topbar-tab accountant-topbar-tab ${activeTopTab === tab ? "dashboard-topbar-tab-active accountant-topbar-tab-active" : ""}`}
                >
                  <button
                    type="button"
                    className="accountant-topbar-tab-button"
                    onClick={() => {
                      setActiveTopTab(tab);
                      if (tab === "Dashboard") navigate("/AdminDashboard");
                      if (tab === "Academics") navigate("/AdiminAcademicsNew");
                      if (tab === "Events & Meetings") navigate("/AdminEventsAndMeetings");
                      if (tab === "Reports") navigate("/AdminReportsPage");
                    }}
                  >
                    {tab}
                  </button>
                </div>
              ))}
            </div>

            <div className="dashboard-topbar-center accountant-topbar-center">
              <img src={schoolLogo || "/default-logo.png"} alt={schoolName || "School Logo"} className="accountant-school-logo" />
              <span style={{ fontWeight: 700, marginLeft: "0.4rem" }}>{schoolName || "Unknown School"}</span>
            </div>

            <div className="dashboard-topbar-right accountant-topbar-right">
              <div className="header-profile-wrap" ref={userDropdownRef}>
                <button
                  className="header-profile-trigger"
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                >
                  <FaUser className="header-profile-trigger-icon" />
                </button>
                {userDropdownOpen && (
                  <div className="header-profile-dropdown">
                    <EditableProfileMenu />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="admin-reports-content">
            <div className="accountant-reports-label-grid admin-reports-filter-grid">
              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <span>Class</span>
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                  <option value="All">All Classes</option>
                  {classOptions.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </label>

              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <span>Section</span>
                <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={selectedClass === "All"}>
                  <option value="All">All Sections</option>
                  {sectionOptions.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </label>

              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <span>Month</span>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  {monthOptions.map((month) => (
                    <option key={month.value || "all"} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="accountant-reports-label-chip accountant-reports-field-chip">
                <span>Subject</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Student, subject, class..."
                />
              </label>
            </div>

        

            <div className="accountant-reports-card-row">
              {quickCards.map((card) => {
                const isActive = activeReport === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    className={`accountant-reports-card ${isActive ? "accountant-reports-card-active" : ""}`}
                    onClick={() => setActiveReport(card.key)}
                  >
                    <div className="accountant-reports-card-icon">
                      <img src={card.icon} alt={card.title} />
                    </div>
                    <div className="accountant-reports-card-title">{card.title}</div>
                    <div className="accountant-reports-card-subtitle">{card.subtitle}</div>
                  </button>
                );
              })}
            </div>

            <div className="accountant-reports-table-card">
              <div className="accountant-reports-toolbar">
                <div>
                  <strong>{activeReport === "attendance" ? "Attendance List" : activeReport === "marks" ? "Academic Marks List" : activeReport === "topper" ? "Topper List" : activeReport === "low" ? "Low Performance Top 10" : "High Performance Top 10"}</strong>
                  <p>
                    {selectedClass === "All" ? "All classes" : selectedClass}
                    {selectedSection !== "All" ? `, Section ${selectedSection}` : ""}
                    {selectedMonth ? `, ${selectedMonth}` : ""}
                  </p>
                </div>
                <div className="accountant-reports-toolbar-meta">
                  <span>{visibleRows.length} rows</span>
                </div>
              </div>

              {error && <div className="admin-reports-error">{error}</div>}

              <div className="accountant-reports-table-wrap">{renderTable()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReportsPage;
