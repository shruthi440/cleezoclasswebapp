import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowDown, FaArrowUp, FaBook, FaClock, FaFileAlt, FaTrophy, FaUser, FaUserClock, FaCheckCircle } from "react-icons/fa";
import "./AdminReportsPage.css";
import "./AdminDashboardNew.css";
import "../frontdeskdahboard/FrontDesk.css";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";
import InstituteBrand from "../shared/InstituteBrand.jsx";
import { resolveInstituteDisplayName } from "../shared/instituteNameUtils";
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import dashboardIcon from "../assets/Dashboard.png";
import academicsIcon from "../assets/Staff Assign.png";
import leadProfileIcon from "../assets/Lead Profile.png";
import enrollmentIcon from "../assets/Enrollment.png";
import reportsIcon from "../assets/Reports .png";
import communicationIcon from "../assets/Communication Assign.png";
import { Download } from "lucide-react";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  marks_obtained: number;
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

type LatecomerRow = {
  id: string | number;
  name: string;
  date: string;
  time: string;
  loginTime: string;
  status: string;
};

type LeaveRequestRow = {
  id: string | number;
  name: string;
  dates: string;
  reason: string;
  status: string;
};

type UnarrivedTeacherRow = {
  id: string | number;
  name: string;
  absent_days: number | string;
};

type DetailView = "teacherAttendance" | "leaveRequests" | "latecomers" | null;

const sidebarItems = [
  { key: "dashboard", label: "Dashboard", icon: dashboardIcon, route: "/AdminDashboard" },
  { key: "academics", label: "Academics", icon: academicsIcon, route: "/AdiminAcademicsNew" },
  { key: "events", label: "Events & Meetings", icon: leadProfileIcon, route: "/AdminEventsAndMeetings" },
  { key: "communication", label: "Generations", icon: communicationIcon, route: "/AdminGenerations" },
  { key: "enrollments", label: "Store", icon: enrollmentIcon, route: "/AdminStoreNew" },
  { key: "reports", label: "Reports", icon: reportsIcon, route: "/AdminReportsPage" },
];

const quickCards = [
  { key: "attendance" as const, title: "Attendance", subtitle: "Class wise attendance list", icon: <FaCheckCircle /> },
  { key: "marks" as const, title: "Academic Marks", subtitle: "Student marks list", icon: <FaBook /> },
  { key: "topper" as const, title: "Topper List", subtitle: "Highest average performers", icon: <FaTrophy /> },
  { key: "low" as const, title: "Low Performance", subtitle: "Below 40 marks", icon: <FaArrowDown /> },
  { key: "high" as const, title: "High Performance", subtitle: "80+ marks", icon: <FaArrowUp /> },
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

const isTimeLikeValue = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  if (["pending", "approved", "rejected", "fever", "sick", "other", "n/a", "na", "-"].includes(lower)) return false;
  return (
    /^\d{1,2}:\d{2}(:\d{2})?\s?(am|pm)?$/i.test(text) ||
    /^\d{1,2}:\d{2}(:\d{2})?$/.test(text) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)
  );
};

const pickLateTimeValue = (...values: unknown[]) => {
  for (const value of values) {
    if (isTimeLikeValue(value)) return String(value).trim();
  }
  return "-";
};

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
  const [hrLoading, setHrLoading] = useState(false);
  const [latecomers, setLatecomers] = useState<LatecomerRow[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>([]);
  const [unarrivedTeachers, setUnarrivedTeachers] = useState<UnarrivedTeacherRow[]>([]);
  const [teacherAbsentCount, setTeacherAbsentCount] = useState(0);
  const [activeDetailView, setActiveDetailView] = useState<DetailView>(null);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    let cancelled = false;
    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${encodeURIComponent(schoolCode)}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        setSchoolLogo(data?.logo || "/default-logo.png");
        const resolvedSchoolName = resolveInstituteDisplayName({
          apiInstituteName: data?.institute_name || data?.instituteName || data?.school_name || data?.name || data?.schoolName,
          storedSchoolName: localStorage.getItem("schoolName"),
          storedInstituteName: localStorage.getItem("instituteName"),
          schoolCode,
          fallback: "Institute",
        });
        setSchoolName(resolvedSchoolName);
        localStorage.setItem("schoolName", resolvedSchoolName);
        localStorage.setItem("instituteName", resolvedSchoolName);
      })
      .catch(() => {
        if (cancelled) return;
        setSchoolLogo("/default-logo.png");
        const fallbackSchoolName = resolveInstituteDisplayName({
          storedSchoolName: localStorage.getItem("schoolName"),
          storedInstituteName: localStorage.getItem("instituteName"),
          schoolCode,
          fallback: "Institute",
        });
        setSchoolName(fallbackSchoolName);
        localStorage.setItem("schoolName", fallbackSchoolName);
        localStorage.setItem("instituteName", fallbackSchoolName);
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
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    let cancelled = false;

    const loadHrSummary = async () => {
      setHrLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const [latecomersRes, leaveRequestsRes, unarrivedRes] = await Promise.all([
          axios.get(`${API_BASE}/latecomers/today`, { params: { schoolCode } }).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/leave-requests/all`, { params: { schoolCode } }).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/teachers_attendance/unarrived`, { params: { date: today, schoolCode } }).catch(() => ({ data: [] })),
        ]);

        const latecomerRows = Array.isArray(latecomersRes.data)
          ? latecomersRes.data
              .filter((record) => String(record?.Login_time || "") > String(record?.time || ""))
              .map((record) => ({
                id: record?.id ?? `${record?.username || "late"}-${record?.date || ""}`,
                name: record?.username || record?.teacherName || record?.name || "-",
                date: String(record?.date || "-"),
                time: pickLateTimeValue(record?.time, record?.Logout_time, record?.logoutTime),
                loginTime: pickLateTimeValue(record?.Login_time, record?.loginTime),
                status: record?.status || "Late",
              }))
          : [];

        const leaveRequestRows = Array.isArray(leaveRequestsRes.data)
          ? leaveRequestsRes.data.map((req) => ({
              id: req?.teacherId ?? req?.id ?? `${req?.teacherName || "leave"}-${req?.leaveDates || ""}`,
              name: req?.teacherName || req?.name || "-",
              dates: req?.leaveDates || req?.dates || "-",
              reason: req?.reason || "-",
              status: req?.status || "pending",
            }))
          : [];

        if (cancelled) return;
        setLatecomers(latecomerRows);
        setLeaveRequests(leaveRequestRows);
        setUnarrivedTeachers(
          Array.isArray(unarrivedRes.data)
            ? unarrivedRes.data.map((teacher) => ({
                id: teacher?.id ?? teacher?.teacherId ?? teacher?.username ?? teacher?.name ?? `${teacher?.username || "teacher"}-${teacher?.absent_days || 0}`,
                name: teacher?.username || teacher?.teacherName || teacher?.name || "-",
                absent_days: teacher?.absent_days ?? teacher?.absentDays ?? teacher?.late_count ?? 0,
              }))
            : []
        );
        setTeacherAbsentCount(Array.isArray(unarrivedRes.data) ? unarrivedRes.data.length : 0);
      } catch (hrError) {
        if (cancelled) return;
        setLatecomers([]);
        setLeaveRequests([]);
        setUnarrivedTeachers([]);
        setTeacherAbsentCount(0);
      } finally {
        if (!cancelled) {
          setHrLoading(false);
        }
      }
    };

    loadHrSummary();

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (activeDetailView) return [];
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
  }, [activeDetailView, activeReport, filteredAttendanceRows, filteredMarksRows, highRows, lowRows, topperRows]);

  const attendanceAverage = useMemo(() => {
    if (!filteredAttendanceRows.length) return 0;
    return filteredAttendanceRows.reduce((sum, row) => sum + Number(row.attendance_percentage || 0), 0) / filteredAttendanceRows.length;
  }, [filteredAttendanceRows]);

  const marksAverage = useMemo(() => {
    if (!filteredMarksRows.length) return 0;
    return filteredMarksRows.reduce((sum, row) => sum + Number(row.marks || 0), 0) / filteredMarksRows.length;
  }, [filteredMarksRows]);

  const leaveRequestCounts = useMemo(() => {
    const normalizedStatus = (value: string) => value.trim().toLowerCase();
    return leaveRequests.reduce(
      (acc, request) => {
        const status = normalizedStatus(request.status);
        if (status === "pending") acc.pending += 1;
        else if (status === "approved" || status === "accept" || status === "accepted") acc.approved += 1;
        else if (status === "rejected" || status === "declined" || status === "deny" || status === "denied") acc.rejected += 1;
        else acc.pending += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 }
    );
  }, [leaveRequests]);

  const teacherAttendanceSummary = useMemo(() => {
    const late = latecomers.length;
    const leaves = leaveRequestCounts.pending;
    const absent = teacherAbsentCount;
    return { late, leaves, absent };
  }, [latecomers.length, leaveRequestCounts.pending, teacherAbsentCount]);

  const activeTableTitle = useMemo(() => {
    if (activeDetailView === "teacherAttendance") return "Teacher Attendance List";
    if (activeDetailView === "leaveRequests") return "Leave Requests";
    if (activeDetailView === "latecomers") return "Late Comers";
    if (activeReport === "attendance") return "Attendance List";
    if (activeReport === "marks") return "Academic Marks List";
    if (activeReport === "topper") return "Topper List";
    if (activeReport === "low") return "Low Performance Top 10";
    return "High Performance Top 10";
  }, [activeDetailView, activeReport]);



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

    if (activeDetailView === "teacherAttendance") {
      return (
        <table className="admin-reports-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Teacher Name</th>
              <th>Absences This Month</th>
            </tr>
          </thead>
          <tbody>
            {unarrivedTeachers.length > 0 ? (
              unarrivedTeachers.map((teacher) => (
                <tr key={String(teacher.id)}>
                  <td>{teacher.id}</td>
                  <td>{teacher.name}</td>
                  <td>{teacher.absent_days}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="admin-reports-empty-cell">
                  No unarrived teachers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    if (activeDetailView === "leaveRequests") {
      return (
        <table className="admin-reports-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Dates</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leaveRequests.length > 0 ? (
              leaveRequests.map((request) => (
                <tr key={String(request.id)}>
                  <td>{request.id}</td>
                  <td>{request.name}</td>
                  <td>{request.dates}</td>
                  <td>{request.reason}</td>
                  <td>{request.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="admin-reports-empty-cell">
                  No leave requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    if (activeDetailView === "latecomers") {
      return (
        <table className="admin-reports-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Date</th>
              <th>Time</th>
              <th>Login Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {latecomers.length > 0 ? (
              latecomers.map((person) => (
                <tr key={String(person.id)}>
                  <td>{person.id}</td>
                  <td>{person.name}</td>
                  <td>{person.date}</td>
                  <td>{person.time}</td>
                  <td>{person.loginTime}</td>
                  <td>{person.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="admin-reports-empty-cell">
                  No late comers found today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
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
                <td>{formatNumber(row.marks_obtained)}</td>
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
              <th>Marks</th>
              <th>Created On</th>
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

const handleDownloadExcel = () => {
  let data = [];
  let fileName = "report";

  if (activeDetailView === "teacherAttendance") {
    data = unarrivedTeachers.map((t) => ({
      ID: t.id,
      "Teacher Name": t.name,
      "Absences This Month": t.absent_days,
    }));
    fileName = "teacher_attendance";
  } else if (activeDetailView === "leaveRequests") {
    data = leaveRequests.map((r) => ({
      ID: r.id,
      Name: r.name,
      Dates: r.dates,
      Reason: r.reason,
      Status: r.status,
    }));
    fileName = "leave_requests";
  } else if (activeDetailView === "latecomers") {
    data = latecomers.map((p) => ({
      ID: p.id,
      Name: p.name,
      Date: p.date,
      Time: p.time,
      "Login Time": p.loginTime,
      Status: p.status,
    }));
    fileName = "latecomers";
  } else if (activeReport === "attendance") {
    data = visibleRows.map((r) => ({
      Student: r.name,
      Class: r.class_name,
      Section: r.section,
      Present: r.present_days,
      Informed: r.informed_days,
      Uninformed: r.uninformed_days,
      "Total Days": r.total_days,
      "Attendance %": r.attendance_percentage,
    }));
    fileName = "student_attendance";
  } else if (activeReport === "marks") {
    data = visibleRows.map((r) => ({
      Student: r.name,
      Class: r.class_name,
      Section: r.section,
      Subject: r.subject,
      "Test Type": r.test_type,
      Marks: r.marks_obtained,
      "Created On": r.created_at,
    }));
    fileName = "student_marks";
  } else if (activeReport === "topper") {
    data = visibleRows.map((r) => ({
      Student: r.name,
      Class: r.class_name,
      Section: r.section,
      "Total Marks": r.total_marks,
      "Total Tests": r.total_tests,
    }));
    fileName = "toppers";
  }

  if (data.length === 0) {
    alert("No data available to download.");
    return;
  }

  // Build Excel workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns for better readability
  const colWidths = Object.keys(data[0]).map((key) => ({
    wch: Math.max(key.length, ...data.map((row) => String(row[key]).length)) + 2,
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};


const handleDownloadImage = async () => {
  const tableElement = document.querySelector(".accountant-reports-table-wrap");
  
  if (!tableElement) {
    alert("Table not found.");
    return;
  }

  try {
    const canvas = await html2canvas(tableElement, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = image;
    link.download = `${activeDetailView || activeReport || "report"}_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error generating image:", error);
    alert("Failed to download image.");
  }
};

const handleDownloadPDF = () => {
  let data = [];
  let headers = [];
  let fileName = "report";
  let title = "Report";

  // 1. Determine Data and Headers based on Active View
  if (activeDetailView === "teacherAttendance") {
    title = "Teacher Attendance Report";
    fileName = "teacher_attendance";
    headers = ['ID', 'Teacher Name', 'Absences This Month'];
    data = unarrivedTeachers.map((t) => [t.id, t.name, t.absent_days]);
  } 
  else if (activeDetailView === "leaveRequests") {
    title = "Leave Requests Report";
    fileName = "leave_requests";
    headers = ['ID', 'Name', 'Dates', 'Reason', 'Status'];
    data = leaveRequests.map((r) => [r.id, r.name, r.dates, r.reason, r.status]);
  } 
  else if (activeDetailView === "latecomers") {
    title = "Latecomers Report";
    fileName = "latecomers";
    headers = ['ID', 'Name', 'Date', 'Time', 'Login Time', 'Status'];
    data = latecomers.map((p) => [p.id, p.name, p.date, p.time, p.loginTime, p.status]);
  } 
  else if (activeReport === "attendance") {
    title = "Student Attendance Report";
    fileName = "student_attendance";
    headers = ['Student', 'Class', 'Section', 'Present', 'Informed', 'Uninformed', 'Total Days', 'Attendance %'];
    data = visibleRows.map((r) => [r.name, r.class_name, r.section, r.present_days, r.informed_days, r.uninformed_days, r.total_days, `${r.attendance_percentage}%`]);
  } 
  else if (activeReport === "marks") {
    title = "Student Marks Report";
    fileName = "student_marks";
    headers = ['Student', 'Class', 'Section', 'Subject', 'Test Type', 'Marks', 'Created On'];
    data = visibleRows.map((r) => [r.name, r.class_name, r.section, r.subject, r.test_type, r.marks_obtained, formatDate(r.created_at)]);
  } 
  else if (activeReport === "topper") {
    title = "Toppers Report";
    fileName = "toppers";
    headers = ['Student', 'Class', 'Section', 'Total Marks', 'Total Tests'];
    data = visibleRows.map((r) => [r.name, r.class_name, r.section, r.total_marks, r.total_tests]);
  }

  if (data.length === 0) {
    alert("No data available to download.");
    return;
  }

  // 2. Generate PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header / Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(title, pageWidth / 2, 20, { align: 'center' });

  // Generated Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });

  // Table
  autoTable(doc, {
    startY: 35,
    head: [headers],
    body: data,
    theme: 'grid',
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 30, 30],
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 14, right: 14 },
  });

  // Footer (Page Numbers)
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // 3. Save File
  doc.save(`${fileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
              <InstituteBrand
                logoSrc={schoolLogo || "/default-logo.png"}
                logoAlt={schoolName || "School Logo"}
                instituteName={schoolName || "Unknown School"}
              />
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

        

            <div className="accountant-reports-card-row admin-reports-all-cards-row">
              {[
                ...quickCards.map((card) => ({
                  key: card.key,
                  title: card.title,
                  subtitle: card.subtitle,
                  icon: card.icon,
                  kind: "report" as const,
                })),
                {
                  key: "teacherAttendance",
                  title: "Teacher Attendance",
                  subtitle: hrLoading ? "Loading..." : `${teacherAttendanceSummary.late + teacherAttendanceSummary.leaves + teacherAttendanceSummary.absent} records`,
                  icon: <FaUserClock />,
                  kind: "detail" as const,
                },
                {
                  key: "leaveRequests",
                  title: "Leave Requests",
                  subtitle: hrLoading ? "Loading..." : `${leaveRequests.length} records`,
                  icon: <FaFileAlt />,
                  kind: "detail" as const,
                },
                {
                  key: "latecomers",
                  title: "Late Comers",
                  subtitle: hrLoading ? "Loading..." : `${latecomers.length} records`,
                  icon: <FaClock />,
                  kind: "detail" as const,
                },
              ].map((card) => {
                const isActive =
                  card.kind === "report"
                    ? activeDetailView === null && activeReport === card.key
                    : activeDetailView === card.key;

                return (
                  <button
                    key={String(card.key)}
                    type="button"
                    className={`accountant-reports-card admin-reports-hr-card ${isActive ? "accountant-reports-card-active admin-reports-hr-card-active" : ""}`}
                    onClick={() => {
                      if (card.kind === "report") {
                        setActiveDetailView(null);
                        setActiveReport(card.key as ReportType);
                      } else {
                        setActiveDetailView(card.key as DetailView);
                      }
                    }}
                  >
                    <div className="accountant-reports-card-icon">
                      {typeof card.icon === "string" ? (
                        <img src={card.icon} alt={card.title} />
                      ) : (
                        <span className="admin-reports-hr-icon">{card.icon}</span>
                      )}
                    </div>
                    <div className="accountant-reports-card-title">{card.title}</div>
                    <div className="accountant-reports-card-subtitle">{card.subtitle}</div>
                  </button>
                );
              })}
            </div>

            <div className="accountant-reports-table-card">
            
          <div className="accountant-reports-toolbar-meta">
             <div>
                  <strong>{activeTableTitle}</strong>
                  <p>
                    {activeDetailView
                      ? "HR summary"
                      : `${selectedClass === "All" ? "All classes" : selectedClass}${selectedSection !== "All" ? `, Section ${selectedSection}` : ""}${selectedMonth ? `, ${selectedMonth}` : ""}`}
                  </p>
                </div>
                {/* <div className="accountant-reports-toolbar-meta">
                  <span>{activeDetailView === "teacherAttendance" ? unarrivedTeachers.length : activeDetailView === "leaveRequests" ? leaveRequests.length : activeDetailView === "latecomers" ? latecomers.length : visibleRows.length} rows</span>
                </div> */}
              <div className="accountant-reports-download-group">
              
    <button
      type="button"
      className="accountant-reports-download-btn accountant-reports-btn-excel"
      onClick={handleDownloadExcel}
      title="Download as Excel"
    >
      <Download/> Excel
    </button>
    <button
      type="button"
      className="accountant-reports-download-btn accountant-reports-btn-image"
      onClick={handleDownloadImage}
      title="Download as Image"
    >
       Image
    </button>
    {/* Download All Leave Requests as PDF */}
    <button
      type="button"
      className="accountant-reports-download-btn accountant-reports-btn-image"
      onClick={handleDownloadPDF}
      title="Download as Image"
    >
       Download pdf
    </button>


 
  <span>
    {activeDetailView === "teacherAttendance"
      ? unarrivedTeachers.length
      : activeDetailView === "leaveRequests"
      ? leaveRequests.length
      : activeDetailView === "latecomers"
      ? latecomers.length
      : visibleRows.length}{" "}
    rows
  </span>
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