import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUser } from "react-icons/fa";
import axios from "axios";
import "./AccountantDashboardnew.css";
import "../frontdeskdahboard/FrontDesk.css";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";

import abcLogo from "../assets/logoab.png";
import dashboardIcon from "../assets/Dashboard.png";
import academicsIcon from "../assets/Staff Assign.png";
import leadProfileIcon from "../assets/Lead Profile.png";
import enrollmentIcon from "../assets/Enrollment.png";
import communicationIcon from "../assets/Communication Assign.png";
import reportsIcon from "../assets/Reports .png";
import timelineIcon from "../assets/Timeline.png";
import followupIcon from "../assets/Profile.png";
import assistantIcon from "../assets/Assistant.png";

const sidebarItems = [
  { key: "dashboard", label: "Dashboard", icon: dashboardIcon, route: "/AdminDashboard" },
  { key: "academics", label: "Academics", icon: academicsIcon, route: "/AdiminAcademicsNew" },
  { key: "events", label: "Events & Meetings", icon: leadProfileIcon, route: "/AdminEventsAndMeetings" },
        { key: "communication", label: "Generations", icon: communicationIcon ,route: "/AdminGenerations"},
  { key: "store", label: "Store", icon: enrollmentIcon, route: "/AdminStoreNew" },
  
  { key: "report", label: "Report", icon: reportsIcon, route: "/AdminReportsPage" },
];

const quickCards = [
  { key: "livechat", title: "Live Chat", subtitle: "Approvals / Requests", icon: timelineIcon },
  { key: "storepo", title: "Store PO", subtitle: "Request Order / PO issue", icon: followupIcon },
  { key: "assistant", title: "Assistant", subtitle: "Daily Activity check", icon: assistantIcon },
];

const footerCards = [
  { title: "12/02/2026", subtitle: "Strike", meta: "Announcements" },
  { title: "14/04/2026", subtitle: "Gurunanak Jayn", meta: "Calendar" },
  { title: "524 / 534", subtitle: "2 Fail / 8 Exits", meta: "Promotions" },
  { title: "Complaints", subtitle: "Live Chat", meta: "Unofficial" },
];

const API_BASE = "https://cleezoclass.com:4000/api/admin";

const formatDateLabel = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTimeLabel = (value) => {
  if (!value) return "--";
  const raw = String(value).trim();
  if (!raw) return "--";
  const [hour = "00", minute = "00"] = raw.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
};

const formatChatDateTime = (dateValue, timeValue) => {
  const dateLabel = dateValue ? formatDateLabel(dateValue) : "-";
  const timeLabel = timeValue ? formatTimeLabel(timeValue) : "--";
  return `${dateLabel}, ${timeLabel}`;
};

const formatAttendanceClock = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatStoredTime = (value) => {
  if (!value) return "--";
  const raw = String(value).trim();
  if (!raw) return "--";

  if (raw.includes("T") || raw.includes("-") || raw.length > 8) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  const [hour = "00", minute = "00"] = raw.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
};

const normalizeInstituteLogo = (rawLogo) => {
  if (!rawLogo) return "";

  let logo = rawLogo;

  if (typeof logo === "object" && logo?.type === "Buffer" && Array.isArray(logo?.data)) {
    try {
      logo = new Uint8Array(logo.data);
    } catch {
      return "";
    }
  }

  if (logo instanceof Uint8Array) {
    const binary = Array.from(logo, (byte) => String.fromCharCode(byte)).join("");
    return `data:image/png;base64,${btoa(binary)}`;
  }

  if (typeof logo !== "string") return "";
  logo = logo.trim();
  if (!logo) return "";
  if (logo.startsWith("data:image")) return logo;
  if (logo.startsWith("http")) return logo;

  if (logo.startsWith("0x")) {
    try {
      const hex = logo.slice(2);
      let binary = "";
      for (let i = 0; i < hex.length; i += 2) {
        binary += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
      }
      return `data:image/png;base64,${btoa(binary)}`;
    } catch {
      return "";
    }
  }

  if (logo.startsWith("uploads/")) {
    return `https://cleezoclass.com:4000/${logo}`;
  }
  if (logo.startsWith("/uploads/")) {
    return `https://cleezoclass.com:4000${logo}`;
  }

  if (/^[A-Za-z0-9+/=]+$/.test(logo) && logo.length > 100) {
    return `data:image/png;base64,${logo}`;
  }

  return "";
};

const bufferToPathString = (bufferData) => {
  if (!bufferData) return "";
  try {
    const bytes = new Uint8Array(bufferData);
    let pathString = "";
    for (let i = 0; i < bytes.byteLength; i += 1) {
      pathString += String.fromCharCode(bytes[i]);
    }
    return pathString.trim().replace(/\u0000/g, "");
  } catch {
    return "";
  }
};

const getAnyNumber = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return NaN;
};

const buildPerformanceSummary = (apiData) => {
  const performance = Array.isArray(apiData)
    ? apiData
    : Array.isArray(apiData?.performance)
      ? apiData.performance
      : [];

  if (!performance.length) {
    return { obtained: 0, total: 0, percent: null };
  }

  let obtained = 0;
  let total = 0;

  performance.forEach((subj) => {
    const subjectObtained = getAnyNumber(subj, [
      "obtainedMarks",
      "marksObtained",
      "total_obtained",
      "totalObtained",
      "marks",
      "score",
    ]);
    const subjectTotal = getAnyNumber(subj, [
      "totalMarks",
      "maxMarks",
      "maximumMarks",
      "total",
      "max",
    ]);

    if (!Number.isNaN(subjectObtained) && !Number.isNaN(subjectTotal) && subjectTotal > 0) {
      obtained += subjectObtained;
      total += subjectTotal;
      return;
    }

    const tests = subj?.tests && typeof subj.tests === "object" ? subj.tests : {};
    Object.values(tests).forEach((entry) => {
      const mark = Number(entry?.obtained ?? entry?.marks ?? entry?.value);
      const max = Number(entry?.max ?? entry?.total ?? entry?.maximumMarks);
      if (!Number.isNaN(mark) && !Number.isNaN(max) && max > 0) {
        obtained += mark;
        total += max;
      }
    });
  });

  const percentValue = total > 0 ? (obtained / total) * 100 : null;
  let grade = null;
  if (percentValue != null) {
    if (percentValue >= 90) grade = "A+";
    else if (percentValue >= 80) grade = "A";
    else if (percentValue >= 70) grade = "B+";
    else if (percentValue >= 60) grade = "B";
    else if (percentValue >= 50) grade = "C";
    else grade = "D";
  }

  return {
    obtained,
    total,
    percent: percentValue != null ? percentValue.toFixed(1) : null,
    grade,
  };
};

const buildAttendanceSummary = (apiData) => {
  const monthly = Array.isArray(apiData?.monthly) ? apiData.monthly.slice(-6) : [];
  if (!monthly.length) return null;

  const totalPercentage = monthly.reduce((acc, month) => {
    const present = Number(month?.present || 0);
    const total = Number(month?.total || 0);
    if (total <= 0) return acc;
    return acc + (present / total) * 100;
  }, 0);

  return (totalPercentage / monthly.length).toFixed(2);
};

const fallbackTermRows = [
  { key: "FA1", label: "FA1", type: "FA", index: 0 },
  { key: "FA2", label: "FA2", type: "FA", index: 1 },
  { key: "SA1", label: "SA1", type: "SA", index: 0 },
  { key: "FA3", label: "FA3", type: "FA", index: 2 },
  { key: "FA4", label: "FA4", type: "FA", index: 3 },
  { key: "SA2", label: "SA2", type: "SA", index: 1 },
];

const getPopupTermRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return fallbackTermRows;

  const keys = new Map();
  rows.forEach((row) => {
    const tests = row?.tests && typeof row.tests === "object" ? row.tests : {};
    Object.keys(tests).forEach((key) => {
      if (!keys.has(key)) keys.set(key, { key, label: key });
    });
  });

  return keys.size > 0 ? Array.from(keys.values()) : fallbackTermRows;
};

const getPopupMarkForRow = (subj, row) => {
  const tests = subj?.tests && typeof subj.tests === "object" ? subj.tests : {};
  const testEntry = tests[row?.key];
  if (testEntry?.obtained !== undefined && testEntry?.obtained !== null) {
    return testEntry.obtained;
  }
  if (testEntry?.marks !== undefined && testEntry?.marks !== null) {
    return testEntry.marks;
  }
  if (testEntry?.value !== undefined && testEntry?.value !== null) {
    return testEntry.value;
  }

  const match = String(row?.key || "").toUpperCase().match(/^(FA|SA)(\d+)$/);
  if (!match) return "-";
  const type = match[1];
  const index = Number(match[2]) - 1;
  const legacyValue = type === "FA" ? subj?.FA?.[index] : subj?.SA?.[index];
  return legacyValue ?? "-";
};

const getPopupTermMaxMarks = (termKey) => {
  const match = String(termKey || "").toUpperCase().match(/^(FA|SA)(\d+)$/);
  if (!match) return 0;
  return match[1] === "FA" ? 20 : 80;
};

const getPopupSubjectLabel = (row) =>
  String(row?.subject || row?.subject_name || row?.name || "").trim();

const buildPopupTrendFromRows = (rows, termRows) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const points = termRows.map((term) => {
    let obtained = 0;
    let total = 0;
    const termMaxMarks = getPopupTermMaxMarks(term.key);
    sourceRows.forEach((item) => {
      const mark = Number(getPopupMarkForRow(item, term));
      if (!Number.isNaN(mark)) {
        obtained += mark;
        total += termMaxMarks > 0 ? termMaxMarks : mark;
      }
    });
    return {
      key: term.key,
      label: term.label,
      value: total > 0 ? Number(((obtained / total) * 100).toFixed(2)) : null,
    };
  });

  const validPoints = points.filter((point) => point.value !== null);
  const transitions = [];
  for (let i = 1; i < validPoints.length; i += 1) {
    const prev = validPoints[i - 1];
    const current = validPoints[i];
    const diff = Number((current.value - prev.value).toFixed(2));
    transitions.push({
      from: prev.label,
      to: current.label,
      diff,
      improved: diff > 0,
      status: diff > 0 ? "Improved" : diff < 0 ? "Declined" : "No Change",
    });
  }

  const overallDiff =
    validPoints.length >= 2
      ? Number((validPoints[validPoints.length - 1].value - validPoints[0].value).toFixed(2))
      : null;

  return {
    points,
    validPoints,
    transitions,
    overallDiff,
  };
};

const getPopupRowTotal = (subj, termRows) => {
  const directTotal = getAnyNumber(subj, [
    "totalMarks",
    "maxMarks",
    "maximumMarks",
    "total",
    "max",
    "obtainedMarks",
    "marksObtained",
    "total_obtained",
    "totalObtained",
    "marks",
    "score",
  ]);

  if (!Number.isNaN(directTotal)) return directTotal;

  let sum = 0;
  let found = false;
  termRows.forEach((term) => {
    const mark = getPopupMarkForRow(subj, term);
    const num = Number(mark);
    if (!Number.isNaN(num)) {
      sum += num;
      found = true;
    }
  });
  return found ? sum : "-";
};

const getPopupRowGrade = (subj, termRows) => {
  if (subj?.grade) return subj.grade;

  const total = getPopupRowTotal(subj, termRows);
  const numericTotal = Number(total);
  if (Number.isNaN(numericTotal)) return "-";

  const maxTotal = termRows.reduce((sum, term) => {
    const match = String(term?.key || "").toUpperCase().match(/^(FA|SA)(\d+)$/);
    if (!match) return sum;
    return sum + (match[1] === "FA" ? 20 : 80);
  }, 0);

  if (!maxTotal) return "-";
  const percent = (numericTotal / maxTotal) * 100;
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B+";
  if (percent >= 60) return "B";
  if (percent >= 50) return "C";
  return "D";
};

const mockConduct = {
  punctuality: { description: "Admin: 1 Avg Time Delay Issue", grade: "B" },
  discipline: { description: "Class Teacher: Moderate Noisy", grade: "C" },
  behavior: { description: "PTE: Argues with class marks", grade: "B+" },
  cooperation: { description: "Class Teacher: Homework Incomplete", grade: "C+" },
};

const AdiminAcademicsNew = () => {
  const navigate = useNavigate();
  const [performanceTab, setPerformanceTab] = useState("staff");
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [classList, setClassList] = useState([]);
  const [sectionMap, setSectionMap] = useState([]);
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [students, setStudents] = useState([]);
  const [studentMarksMap, setStudentMarksMap] = useState({});
  const [studentAttendanceMap, setStudentAttendanceMap] = useState({});
  const [loadingStudentMarks, setLoadingStudentMarks] = useState(false);
  const [poItems, setPoItems] = useState([]);
  const [loadingPoItems, setLoadingPoItems] = useState(false);
  const [processingPoId, setProcessingPoId] = useState(null);
  const [activeQuickPanel, setActiveQuickPanel] = useState("livechat");
  const [chatRequests, setChatRequests] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentPopupTab, setStudentPopupTab] = useState("academics");
  const [studentPopupLoading, setStudentPopupLoading] = useState(false);
  const [studentPopupAcademics, setStudentPopupAcademics] = useState([]);
  const [studentPopupAttendance, setStudentPopupAttendance] = useState([]);
  const [trendSubjectKey, setTrendSubjectKey] = useState("__all__");
  const [schoolName, setSchoolName] = useState("Unknown School");
  const [schoolLogo, setSchoolLogo] = useState("/default-logo.png");
  const [studentAlertTime, setStudentAlertTime] = useState(null);
  const [teacherAttendanceTimes, setTeacherAttendanceTimes] = useState(null);
  const [attendanceRadius, setAttendanceRadius] = useState(localStorage.getItem("attendanceRadius") || "");
  const [attendanceRadiusDate, setAttendanceRadiusDate] = useState(localStorage.getItem("attendanceRadiusDate") || "");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const schoolCode = localStorage.getItem("schoolCode") || "";
  const assistantPanelItems = [
    {
      title: "Academics Tab Guidance",
      desc:
        "Use this tab to manage syllabus, exams, heads and student performance. Check pending exam tasks, syllabus tracking, and update discipline/performance records class-wise.",
    },
    {
      title: "Events & Meetings Tab Guidance",
      desc:
        "Plan meetings, assign live chat sessions, publish event calendar updates, and track agenda completion. Review parent meeting status and unresolved discussion points.",
    },
    {
      title: "Store Tab Guidance",
      desc:
        "Track and manage academic/store inventory like books, uniforms, IDs, and utility stock. Validate stock movement and raise replenishment requests early.",
    },
  ];

  const requestItems = useMemo(
    () =>
      chatRequests.filter((item) => {
        const status = String(item?.status || item?.approval_status || "pending").toLowerCase();
        return status === "pending" || status === "requested" || status === "awaiting";
      }),
    [chatRequests]
  );

  const scheduledItems = useMemo(
    () =>
      chatRequests.filter((item) => {
        const status = String(item?.status || item?.approval_status || "").toLowerCase();
        return status === "approved" || status === "scheduled" || status === "fixed";
      }),
    [chatRequests]
  );

  const fetchPoItems = async () => {
    if (!schoolCode) return;
    setLoadingPoItems(true);
    try {
      const res = await fetch(`https://cleezoclass.com:4000/api/po/requests?schoolCode=${schoolCode}`);
      const data = res.ok ? await res.json() : [];
      setPoItems(Array.isArray(data) ? data : []);
    } catch {
      setPoItems([]);
    } finally {
      setLoadingPoItems(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("schoolCode");
    localStorage.removeItem("userRole");
    localStorage.removeItem("name");
    sessionStorage.clear();
    window.location.replace(import.meta.env.BASE_URL || "/");
  };

  useEffect(() => {
    fetchPoItems();
  }, [schoolCode]);

  useEffect(() => {
    if (!schoolCode) return;
    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${schoolCode}`)
      .then((res) => res.json())
      .then((data) => {
        const resolvedSchoolName = String(
          data?.institute_name ||
          data?.instituteName ||
          data?.school_name ||
          data?.name ||
          data?.schoolName ||
          "Unknown School"
        ).trim();
        const normalizedLogo = normalizeInstituteLogo(data?.logo);
        setSchoolName(resolvedSchoolName);
        setSchoolLogo(normalizedLogo || "/default-logo.png");
        localStorage.setItem("schoolName", resolvedSchoolName);
        localStorage.setItem("schoolLogo", normalizedLogo || "/default-logo.png");
      })
      .catch(() => {
        setSchoolName("Unknown School");
        setSchoolLogo("/default-logo.png");
      });
  }, [schoolCode]);

  useEffect(() => {
    if (!schoolCode) return;

    const loadAttendanceSettings = async () => {
      try {
        const [alertRes, teacherRes] = await Promise.all([
          axios.get("https://cleezoclass.com:4000/api/attendance/get-alert-time", {
            params: { schoolCode },
          }),
          axios.get("https://cleezoclass.com:4000/attendance/get-login-logout-time", {
            params: { schoolCode },
          }),
        ]);

        setStudentAlertTime(alertRes?.data?.data || null);
        setTeacherAttendanceTimes(teacherRes?.data?.data || null);
        const savedRadius = localStorage.getItem("attendanceRadius") || "";
        const savedRadiusDate = localStorage.getItem("attendanceRadiusDate") || "";
        console.log("[Academics][attendance-radius][load]", {
          schoolCode,
          savedRadius,
          savedRadiusDate,
        });
        setAttendanceRadius(savedRadius);
        setAttendanceRadiusDate(savedRadiusDate);
      } catch (error) {
        console.error("Failed to load attendance time settings", error);
        setStudentAlertTime(null);
        setTeacherAttendanceTimes(null);
        const savedRadius = localStorage.getItem("attendanceRadius") || "";
        const savedRadiusDate = localStorage.getItem("attendanceRadiusDate") || "";
        console.log("[Academics][attendance-radius][load-fallback]", {
          schoolCode,
          savedRadius,
          savedRadiusDate,
        });
        setAttendanceRadius(savedRadius);
        setAttendanceRadiusDate(savedRadiusDate);
      }
    };

    loadAttendanceSettings();
  }, [schoolCode]);

  const handleResetStudentAlertTime = async () => {
    if (!schoolCode) return;
    const confirmed = window.confirm("Reset student alert time?");
    if (!confirmed) return;

    try {
      await axios.post("https://cleezoclass.com:4000/api/attendance/reset-alert-time", {
        schoolCode,
      });
      setStudentAlertTime(null);
    } catch (error) {
      console.error("Failed to reset student alert time", error);
    }
  };

  const handleResetTeacherAttendanceTime = async () => {
    if (!schoolCode) return;
    const confirmed = window.confirm("Reset teacher attendance time?");
    if (!confirmed) return;

    try {
      await axios.post("https://cleezoclass.com:4000/attendance/reset-login-logout-time", {
        schoolCode,
      });
      setTeacherAttendanceTimes(null);
    } catch (error) {
      console.error("Failed to reset teacher attendance time", error);
    }
  };

  useEffect(() => {
    if (!schoolCode) return;

    const loadChatRequests = async () => {
      setChatLoading(true);
      setChatError("");
      try {
        const { data } = await axios.get(`https://cleezoclass.com:4000/api/chat-requests`, {
          params: { schoolCode },
        });
        setChatRequests(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load chat requests", error);
        setChatError("Failed to load live chat requests.");
        setChatRequests([]);
      } finally {
        setChatLoading(false);
      }
    };

    loadChatRequests();
  }, [schoolCode]);

  const handleProcessPO = async (item, newStatus) => {
    const poId = item?.id || item?.po_id || item?.request_id;
    if (!poId || !schoolCode) return;

    if (newStatus === "OK" && (!item?.stockName && !item?.stock_name)) {
      alert("Missing stock details for accept action.");
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to ${newStatus} PO ID ${poId}?`);
    if (!confirmed) return;

    setProcessingPoId(String(poId));
    try {
      const response = await fetch("https://cleezoclass.com:4000/api/po/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: poId,
          new_status: newStatus,
          stockName: item?.stockName || item?.stock_name || null,
          quantity: item?.quantity || null,
          category: item?.category || null,
          schoolCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData?.error || `Failed to ${newStatus} PO.`);
        return;
      }

      await fetchPoItems();
    } catch (error) {
      alert(`Error processing PO: ${error.message}`);
    } finally {
      setProcessingPoId(null);
    }
  };

  useEffect(() => {
    if (!schoolCode) return;
    setLoadingTeachers(true);
    axios
      .post("https://cleezoclass.com:4000/api/users", {
        schoolCode,
        user_type: "teacher",
      })
      .then((res) => {
        setTeachers(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        setTeachers([]);
      })
      .finally(() => {
        setLoadingTeachers(false);
      });
  }, [schoolCode]);

  useEffect(() => {
    if (!schoolCode) return;
    setDropdownLoading(true);
    Promise.all([
      axios.get(`${API_BASE}/classes?schoolCode=${schoolCode}`),
      axios.get(`${API_BASE}/sectionFilter?schoolCode=${schoolCode}`),
    ])
      .then(([classRes, sectionRes]) => {
        const classesFromAPI = Array.isArray(classRes.data)
          ? classRes.data
          : classRes.data?.classes || [];
        const sectionsFromAPI = Array.isArray(sectionRes.data)
          ? sectionRes.data
          : sectionRes.data?.sections || [];
        setClassList(classesFromAPI);
        setSectionMap(sectionsFromAPI);
      })
      .catch(() => {
        setClassList([]);
        setSectionMap([]);
      })
      .finally(() => {
        setDropdownLoading(false);
      });
  }, [schoolCode]);

  useEffect(() => {
    if (!className || !section || !schoolCode) {
      setStudents([]);
      setStudentMarksMap({});
      setStudentAttendanceMap({});
      return;
    }

    axios
      .get(
        `https://cleezoclass.com:4000/api/studentsNameAccountant/${className}?schoolCode=${schoolCode}&section=${section}`
      )
      .then((res) => {
        setStudents(res.data?.students || []);
      })
      .catch(() => {
        setStudents([]);
        setStudentMarksMap({});
        setStudentAttendanceMap({});
      });
  }, [className, section, schoolCode]);

  useEffect(() => {
    if (!schoolCode || !className || !section || students.length === 0) {
      setStudentMarksMap({});
      setStudentAttendanceMap({});
      return;
    }

    let ignore = false;
    setLoadingStudentMarks(true);

    Promise.all(
      students.map(async (student) => {
        try {
          const payload = {
            name: student.name,
            class_name: className,
            section,
            schoolCode,
          };
          const [performanceRes, attendanceRes] = await Promise.all([
            axios.post(
              "https://cleezoclass.com:4000/api/overall/academic-performance",
              payload
            ),
            axios.post(
              "https://cleezoclass.com:4000/api/report/attendance/monthly",
              payload
            ),
          ]);
          return [
            student.id,
            {
              performance: buildPerformanceSummary(performanceRes.data),
              attendance: buildAttendanceSummary(attendanceRes.data),
            },
          ];
        } catch {
          return [
            student.id,
            {
              performance: { obtained: 0, total: 0, percent: null, grade: null },
              attendance: null,
            },
          ];
        }
      })
    )
      .then((entries) => {
        if (ignore) return;
        const combined = Object.fromEntries(entries);
        const marks = {};
        const attendance = {};
        Object.entries(combined).forEach(([studentId, value]) => {
          marks[studentId] = value.performance;
          attendance[studentId] = value.attendance;
        });
        setStudentMarksMap(marks);
        setStudentAttendanceMap(attendance);
      })
      .finally(() => {
        if (!ignore) setLoadingStudentMarks(false);
      });

    return () => {
      ignore = true;
    };
  }, [students, schoolCode, className, section]);

  const getClassLabel = (cls) => {
    if (cls == null) return "";
    if (typeof cls === "string" || typeof cls === "number") return String(cls);
    return cls.class_name || cls.className || cls.class || cls.name || cls.label || "";
  };

  const derivedClasses = useMemo(() => {
    if (classList.length > 0) return classList;
    const classSet = new Set();
    sectionMap.forEach((item) => {
      const classValue = item?.class_name || item?.class || item?.className;
      if (classValue != null) classSet.add(String(classValue));
    });
    return Array.from(classSet);
  }, [classList, sectionMap]);

  const derivedSections = useMemo(() => {
    if (!className) return [];
    return sectionMap
      .filter((item) => {
        const classValue = item?.class_name || item?.class || item?.className;
        return String(classValue) === String(className);
      })
      .map((item) => item.section || item.section_name || item.sectionName)
      .filter(Boolean);
  }, [sectionMap, className]);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (student) =>
        student.name?.toLowerCase().includes(term) || String(student.id).includes(term)
    );
  }, [students, searchTerm]);

  const hasTeacherAttendanceTimes =
    Boolean(teacherAttendanceTimes?.LOGIN_TIME) || Boolean(teacherAttendanceTimes?.LOGOUT_TIME);
  const teacherAttendanceDate = teacherAttendanceTimes?.UPLOADED_DATE
    ? new Date(teacherAttendanceTimes.UPLOADED_DATE).toLocaleDateString("en-IN")
    : "";
  const teacherAttendanceSummary = hasTeacherAttendanceTimes
    ? `   Login: ${formatAttendanceClock(teacherAttendanceTimes?.LOGIN_TIME)} | Logout: ${formatAttendanceClock(teacherAttendanceTimes?.LOGOUT_TIME)}`
    : "Teacher Attendance - No time set yet.";
  const hasStudentAlertTime = Boolean(studentAlertTime?.alert_time);
  const studentAlertDate = studentAlertTime?.uploaded_date
    ? new Date(studentAlertTime.uploaded_date).toLocaleDateString("en-IN")
    : "";
  const studentAlertSummary = hasStudentAlertTime
    ? `Student Alert - ${formatStoredTime(studentAlertTime?.alert_time)}`
    : "Student Alert - No time set yet.";
  const hasAttendanceRadius = Boolean(attendanceRadius);
  const attendanceRadiusSummary = hasAttendanceRadius
    ? `${attendanceRadius} meters`
    : "No radius set yet.";
  const attendanceRadiusAddedDate = attendanceRadiusDate ? `Added on: ${attendanceRadiusDate}` : "";

  const popupTermRows = useMemo(
    () => getPopupTermRows(studentPopupAcademics),
    [studentPopupAcademics]
  );

  const popupSubjectOptions = useMemo(() => {
    const seen = new Set();
    return studentPopupAcademics
      .map((row, index) => {
        const label = getPopupSubjectLabel(row);
        if (!label) return null;
        const key = `${label.toLowerCase()}-${index}`;
        if (seen.has(label.toLowerCase())) return null;
        seen.add(label.toLowerCase());
        return { key, label };
      })
      .filter(Boolean);
  }, [studentPopupAcademics]);

  const popupAcademicTrend = useMemo(() => {
    return buildPopupTrendFromRows(studentPopupAcademics, popupTermRows);
  }, [popupTermRows, studentPopupAcademics]);

  const selectedSubjectRow = useMemo(() => {
    if (trendSubjectKey === "__all__") return null;
    return studentPopupAcademics.find((row, index) => {
      const label = getPopupSubjectLabel(row);
      return `${label.toLowerCase()}-${index}` === trendSubjectKey;
    }) || null;
  }, [trendSubjectKey, studentPopupAcademics]);

  const activeTrend = useMemo(() => {
    if (!selectedSubjectRow) return popupAcademicTrend;
    return buildPopupTrendFromRows([selectedSubjectRow], popupTermRows);
  }, [selectedSubjectRow, popupAcademicTrend, popupTermRows]);

  const activeTrendTitle = selectedSubjectRow
    ? `Test Type Trend (${getPopupSubjectLabel(selectedSubjectRow)})`
    : "Test Type Performance Trend (All Subjects)";

  useEffect(() => {
    if (!selectedStudent || !schoolCode || !className || !section) return;

    let ignore = false;
    setStudentPopupLoading(true);

    const payload = {
      name: selectedStudent.name,
      class_name: className,
      section,
      schoolCode,
    };

    Promise.all([
      axios.post("https://cleezoclass.com:4000/api/overall/academic-performance", payload),
      axios.post("https://cleezoclass.com:4000/api/report/attendance/monthly", payload),
    ])
      .then(([performanceRes, attendanceRes]) => {
        if (ignore) return;
        const performanceData = Array.isArray(performanceRes.data)
          ? performanceRes.data
          : performanceRes.data?.performance || [];
        const attendanceData = Array.isArray(attendanceRes.data?.monthly)
          ? attendanceRes.data.monthly
          : [];
        setStudentPopupAcademics(performanceData);
        setStudentPopupAttendance(attendanceData);
      })
      .catch(() => {
        if (ignore) return;
        setStudentPopupAcademics([]);
        setStudentPopupAttendance([]);
      })
      .finally(() => {
        if (!ignore) setStudentPopupLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [selectedStudent, schoolCode, className, section]);

  useEffect(() => {
    setTrendSubjectKey("__all__");
  }, [selectedStudent]);

  return (
    <div className="dashboard-page dashboard-home-page frontdesk-dashboard-page accountant-dashboard-page accountant-dashboard-home-page admin-academics-page">
      <div className="dashboard-shell accountant-dashboard-shell">
        <aside className="dashboard-sidebar accountant-sidebar-strip">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`dashboard-sidebar-item accountant-sidebar-item ${item.key === "academics" ? "dashboard-sidebar-item-active accountant-sidebar-item-active" : ""}`}
              onClick={() => navigate(item.route)}
            >
              <div className="dashboard-sidebar-item-icon accountant-sidebar-item-icon">
                <img src={item.icon} alt={item.label} />
              </div>
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        <div className="dashboard-main accountant-main-area">
          <div className="dashboard-topbar accountant-topbar">
            <div className="dashboard-topbar-left accountant-topbar-left">
              {["Dashboard", "Academics", "Events & Meetings", "Reports"].map((tab) => (
                <div
                  key={tab}
                  className={`dashboard-topbar-tab accountant-topbar-tab ${tab === "Academics" ? "dashboard-topbar-tab-active accountant-topbar-tab-active" : ""}`}
                >
                  <button
                    className="accountant-topbar-tab-button"
                    type="button"
                    onClick={() => {
                      if (tab === "Dashboard") navigate("/AdminDashboard");
                      if (tab === "Events & Meetings") navigate("/AdminEventsAndMeetings");
                      if (tab === "Academics") navigate("/AdiminAcademicsNew");
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
            
              <EditableProfileMenu showHrSwitch />
            </div>
          </div>

          <div className="admin-academics-content">
            <div className="admin-academics-top">
               <div className="accountant-welcome-block">
                <h2>Hi, Vinay!</h2>
                <p>Check Store Inventory,</p>
                <p>Report Track to Class Teacher</p>
                <p>Submit Building maintenance</p>
              </div>

              <div className="admin-academics-summary accountant-card">
                <div className="admin-academics-summary-ring">
                  <div className="admin-academics-summary-ring-inner">70%</div>
                </div>
                <div className="admin-academics-summary-stats">
                  <p><span>Performance - staff:</span> <strong>70%</strong></p>
                  <p><span>Performance - student:</span> <strong>89%</strong></p>
                  <p><span>Behavior:</span> <strong>0 Misbehavior</strong></p>
                  <p><span>Staff overtime:</span> <strong>6 Teachers</strong></p>
                </div>
                <div className="admin-academics-summary-right">
                  <button type="button" className="collect-filter">
                    <span>As on today</span>
                  </button>
                  <div className="admin-academics-exam">
                    <h3>Exam Schedule</h3>
                    <p>SA-2 | 15/04/2026</p>
                  </div>
                </div>
              </div>

              <div className="accountant-mini-cards">
                {quickCards.map((card) => (
                  <div
                    key={card.title}
                    className="accountant-quick-card accountant-card accountant-quick-card-clickable"
                    onClick={() => setActiveQuickPanel(card.key)}
                  >
                    <div className="">
                      <img src={card.icon} alt={card.title} />
                    </div>
                    <h4>{card.title}</h4>
                    <p>{card.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>

        <div className="admin-academics-main">
  <div className="admin-academics-performance accountant-card">
    
    {/* HEADER */}
    <div className="admin-academics-performance-header">
      
      <div>
        <h3>Performance</h3>
      </div>

      {/* TABS */}
      <div className="admin-academics-performance-tabs">
        <button
          type="button"
          className={performanceTab === "staff" ? "active" : ""}
          onClick={() => setPerformanceTab("staff")}
        >
          Staff
        </button>

        <button
          type="button"
          className={performanceTab === "students" ? "active" : ""}
          onClick={() => setPerformanceTab("students")}
        >
          Student
        </button>

  <strong>
  {performanceTab === "students"
    ? filteredStudents.length
    : teachers.length}
</strong>

<span>
  {performanceTab === "students"
    ? "Class Strength"
    : "Staff Strength"}
</span>
      </div>

      {/* FILTERS */}
      <div className="admin-academics-filters">
        
        {/* SEARCH */}
        <input
          type="text"
          placeholder={
            performanceTab === "students"
              ? "Search students..."
              : "Search teachers..."
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* ✅ SHOW ONLY FOR STUDENTS */}
        {performanceTab === "students" && (
          <>
            <select
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                setSection("");
              }}
              disabled={dropdownLoading}
            >
              <option value="">Class</option>
              {derivedClasses.map((cls) => {
                const classLabel = getClassLabel(cls);
                if (!classLabel) return null;
                return (
                  <option key={classLabel} value={classLabel}>
                    {classLabel}
                  </option>
                );
              })}
            </select>

            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={dropdownLoading || !className}
            >
              <option value="">Section</option>
              {derivedSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>

    {/* GRID */}
    <div className="admin-academics-students-grid">
      
      {/* ================= STAFF ================= */}
      {performanceTab === "staff" ? (
        loadingTeachers ? (
          <div className="admin-academics-empty">Loading teachers...</div>
        ) : teachers.length === 0 ? (
          <div className="admin-academics-empty">No teachers found.</div>
        ) : (
          teachers
            .filter((teacher) => {
              const term = searchTerm.trim().toLowerCase();
              if (!term) return true;
              const name = teacher.teacher_name || teacher.name || "";
              return name.toLowerCase().includes(term);
            })
            .map((teacher, index) => {
              
              // ✅ EXTRACT CLASSES
              const classes = Object.keys(teacher)
                .filter(
                  (key) =>
                    key.startsWith("teaches_to_") && teacher[key]
                )
                .map((key) => teacher[key]);

              return (
                <div
                  key={teacher.teacher_id || index}
                  className="admin-academics-student-card"
                >
                  <div className="admin-academics-student-avatar-wrap">
                    <div className="admin-academics-student-avatar">
                      <FaUser />
                    </div>
                  </div>

                  <div className="admin-academics-student-name">
                    {teacher.teacher_name || teacher.name || "Teacher"}
                  </div>

                  <div className="admin-academics-student-meta">
                    Subject:{" "}
                    {teacher.designation ||
                      teacher.subject ||
                      teacher.phone_no ||
                      "-"}
                  </div>

                  <div className="admin-academics-student-score">
                    Teacher ID: {teacher.teacher_id || "-"}
                  </div>

                  <div className="admin-academics-student-score">
                    Classes:{" "}
                    {classes.length > 0
                      ? classes.join(", ")
                      : "-"}
                  </div>
                </div>
              );
            })
        )
      ) : filteredStudents.length === 0 ? (
        
        /* ================= STUDENTS EMPTY ================= */
        <div className="admin-academics-empty">
          {className && section
            ? "No students found."
            : "Please select class and section."}
        </div>
      
      ) : (
        
        /* ================= STUDENTS ================= */
        filteredStudents.map((student, index) => (
          <div
            key={student.id || index}
            className={`admin-academics-student-card admin-academics-student-card-clickable ${
              selectedStudent?.id === student.id
                ? "is-selected"
                : ""
            }`}
            onClick={() => {
              setSelectedStudent(student);
              setStudentPopupTab("attendance");
            }}
          >
            <div className="admin-academics-student-avatar-wrap">
              {student.photo?.data ? (
                <img
                  src={`https://cleezoclass.com:4000${bufferToPathString(
                    student.photo.data
                  )}`}
                  alt={student.name || "Student"}
                  className="admin-academics-student-photo"
                />
              ) : (
                <div className="admin-academics-student-avatar">
                  <FaUser />
                </div>
              )}
            </div>

            <div className="admin-academics-student-name">
              {student.name || "Student"}
            </div>

            <div className="admin-academics-student-meta">
              {className && section
                ? `${className} - ${section}`
                : "Student"}
            </div>

            <div className="admin-academics-student-score">
              {loadingStudentMarks
                ? "Loading marks..."
                : studentMarksMap[student.id]?.total
                ? `Marks: ${
                    studentMarksMap[student.id].obtained
                  }/${
                    studentMarksMap[student.id].total
                  } (${studentMarksMap[student.id].percent}%) | Grade: ${
                    studentMarksMap[student.id].grade
                  }`
                : `ID: ${student.id || "-"}`}
            </div>

            <div className="admin-academics-student-score">
              {loadingStudentMarks
                ? "Loading attendance..."
                : studentAttendanceMap[student.id]
                ? `Attendance: ${studentAttendanceMap[student.id]}%`
                : "Attendance: -"}
            </div>
          </div>
        ))
      )}
    </div>
  </div>

  <div className="admin-academics-right-column">
    <div className="admin-academics-storepo accountant-card">
      <div className="admin-academics-side-header">
        <h3>
          {activeQuickPanel === "assistant"
            ? "Assistant Actions"
            : activeQuickPanel === "storepo"
            ? "Store PO"
            : "Live Chat"}
        </h3>
        <div className="admin-academics-request-count">
          <strong>
            {activeQuickPanel === "assistant"
              ? assistantPanelItems.length
              : activeQuickPanel === "storepo"
              ? poItems.length
              : chatRequests.length}
          </strong>
          <span>
            {activeQuickPanel === "assistant"
              ? "Actions"
              : activeQuickPanel === "storepo"
              ? "Requests"
              : "Chats"}
          </span>
        </div>
      </div>

      <div className="admin-academics-side-subtitle">
        {activeQuickPanel === "livechat"
          ? "Requests"
          : activeQuickPanel === "assistant"
          ? "Assistant Guidance"
          : "Requests PO"}
      </div>

      <div className="admin-academics-po-list">
        {activeQuickPanel === "livechat" ? (
          <>
            {chatLoading ? (
              <div className="admin-academics-po-item">
                <span>Loading...</span>
              </div>
            ) : chatError ? (
              <div className="admin-academics-po-item">
                <span>{chatError}</span>
              </div>
            ) : requestItems.length === 0 ? (
              <div className="admin-academics-po-item">
                <span>No requests found.</span>
              </div>
            ) : (
              requestItems.map((item, index) => (
                <div key={`req-${item?.id || item?.request_id || index}`} className="admin-academics-po-item">
                  <span>
                    Live Chat (P - T) - {formatChatDateTime(
                      item?.preferred_date || item?.date || item?.requested_date,
                      item?.preferred_time || item?.time || item?.requested_time
                    )} - {item?.party1_name || item?.teacher_name || "Staff"} to {item?.party2_student || item?.student_name || "Student"}, {item?.party2_class || item?.class_name || "-"}{item?.party2_section || item?.section || ""}
                  </span>
                  <div className="admin-academics-po-actions">
                    <button type="button">▷</button>
                    <button type="button">✕</button>
                  </div>
                </div>
              ))
            )}

            <div className="admin-academics-side-subtitle">Scheduled</div>
            {scheduledItems.length === 0 ? (
              <div className="admin-academics-po-item">
                <span>No scheduled chats found.</span>
              </div>
            ) : (
              scheduledItems.map((item, index) => (
                <div key={`sch-${item?.id || item?.request_id || index}`} className="admin-academics-po-item">
                  <span>
                    Live Chat (T - P) - {formatChatDateTime(
                      item?.approved_date || item?.date || item?.requested_date,
                      item?.approved_time || item?.time || item?.requested_time
                    )} - {item?.party1_name || item?.teacher_name || "Staff"} to {item?.party2_student || item?.student_name || "Student"}, {item?.party2_class || item?.class_name || "-"}{item?.party2_section || item?.section || ""}
                  </span>
                  <div className="admin-academics-po-actions">
                    <button type="button">▷</button>
                    <button type="button">✕</button>
                  </div>
                </div>
              ))
            )}
          </>
        ) : activeQuickPanel === "assistant" ? (
          assistantPanelItems.map((item) => (
            <div key={item.title} className="admin-academics-assistant-item">
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </div>
          ))
        ) : loadingPoItems ? (
          <div className="admin-academics-po-item">
            <span>Loading PO requests...</span>
          </div>
        ) : poItems.length === 0 ? (
          <div className="admin-academics-po-item">
            <span>No PO requests found.</span>
          </div>
        ) : (
          poItems.map((item, index) => (
            <div key={item.id || item.po_id || index} className="admin-academics-po-item">
              <span>
                {item.text ||
                  `${item.id ? `PO${item.id} - ` : ""}${item.date || item.created_at || ""}, ${item.stockName || item.stock_name || "Stock"}${item.quantity ? ` ${item.quantity}` : ""}`}
              </span>
              <div className="admin-academics-po-actions">
                <button
                  type="button"
                  onClick={() => handleProcessPO(item, "OK")}
                  disabled={processingPoId === String(item.id || item.po_id || item.request_id)}
                  title="Accept"
                >
                  ▷
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessPO(item, "Rejected")}
                  disabled={processingPoId === String(item.id || item.po_id || item.request_id)}
                  title="Reject"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

  </div>
</div>
            <div className="admin-academics-bottom">
              <div className="admin-academics-alerts accountant-card">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "0.85rem",
                  }}
                >
                  <div
                    className="admin-academics-alert-item"
                    style={{
                      display: "grid",
                      gap: "0.35rem",
                      minHeight: "92px",
                      alignContent: "start",
                    }}
                  >
                    <div className="admin-academics-alert-text" style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontWeight: 700 }}>Student Alert Time</span>
                      {hasStudentAlertTime ? (
                        <>
                          <span>{studentAlertSummary}</span>
                          {studentAlertDate ? <span>Date: {studentAlertDate}</span> : null}
                        </>
                      ) : (
                        <span>No student alert time set yet.</span>
                      )}
                    </div>
                    <div className="admin-academics-alert-action-wrap">
                      <button
                        type="button"
                        className="btn-solid admin-academics-alert-action"
                        onClick={
                          !hasStudentAlertTime
                            ? () => navigate("/TeacherAttendanceForms?view=student")
                            : handleResetStudentAlertTime
                        }
                      >
                        {!hasStudentAlertTime ? "Add" : "Reset"}
                      </button>
                    </div>
                  </div>

                  <div
                    className="admin-academics-alert-item"
                    style={{
                      display: "grid",
                      gap: "0.35rem",
                      minHeight: "92px",
                      alignContent: "start",
                    }}
                  >
                    <div className="admin-academics-alert-text" style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontWeight: 700 }}>Teacher Attendance</span>
                      {hasTeacherAttendanceTimes ? (
                        <>
                          <span>{teacherAttendanceSummary}</span>
                          {teacherAttendanceDate ? <span>Date: {teacherAttendanceDate}</span> : null}
                        </>
                      ) : (
                        <span>No teacher time set yet.</span>
                      )}
                    </div>
                    <div className="admin-academics-alert-action-wrap">
                      <button
                        type="button"
                        className="btn-solid admin-academics-alert-action"
                        onClick={
                          !hasTeacherAttendanceTimes
                            ? () => navigate("/TeacherAttendanceForms?view=teacher")
                            : handleResetTeacherAttendanceTime
                        }
                      >
                        {!hasTeacherAttendanceTimes ? "Add" : "Reset"}
                      </button>
                    </div>
                  </div>

                  <div
                    className="admin-academics-alert-item"
                    style={{
                      display: "grid",
                      gap: "0.35rem",
                      minHeight: "92px",
                      alignContent: "start",
                    }}
                  >
                    <div className="admin-academics-alert-text" style={{ display: "grid", gap: "0.25rem" }}>
                      <span style={{ fontWeight: 700 }}>Attendance Radius</span>
                      <span>{attendanceRadiusSummary}</span>
                      {attendanceRadiusAddedDate ? <span>{attendanceRadiusAddedDate}</span> : null}
                    </div>
                    <div className="admin-academics-alert-action-wrap">
                      <button
                        type="button"
                        className="btn-solid admin-academics-alert-action"
                        onClick={() => navigate("/Radiusselecting")}
                      >
                        {hasAttendanceRadius ? "Update Radius" : "Set Radius"}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              <div className="admin-academics-tests accountant-card">
                <div className="admin-academics-test-item">
                  <strong>Extra Classes</strong>
                  <span>9A - 5:00PM</span>
                  <small>01/04/2026</small>
                </div>
                <div className="admin-academics-test-item">
                  <strong>Upcoming Test</strong>
                  <span>SA-2</span>
                  <small>14/04/2026</small>
                </div>
                <div className="admin-academics-test-item emphasis">
                  <strong>Previous Test</strong>
                  <span>FA-3, 100% Attk.</span>
                  <small>13/03/2026</small>
                </div>
              </div>

              <div className="admin-academics-footer-cards accountant-card">
                {footerCards.map((item) => (
                  <div key={item.title} className="admin-academics-footer-item">
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                    <small>{item.meta}</small>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>

      {selectedStudent ? (
        <div className="admin-academics-modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="admin-academics-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-academics-modal-header">
              <div>
                <h3>{selectedStudent.name || "Student"}</h3>
                <p>
                  {className || "-"} - {section || "-"} | ID: {selectedStudent.id || "-"}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedStudent(null)}>
                Close
              </button>
            </div>

            <div className="admin-academics-modal-tabs">
              {[
                { key: "attendance", label: "Attendance" },
                { key: "behaviour", label: "Behaviour" },
                { key: "academics", label: "Academics" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={studentPopupTab === tab.key ? "active" : ""}
                  onClick={() => setStudentPopupTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="admin-academics-modal-content">
              {studentPopupLoading ? (
                <div className="admin-academics-modal-empty">Loading details...</div>
              ) : studentPopupTab === "academics" ? (
                <>
                  <div className="admin-academics-split-view">
                    <div className="admin-academics-split-left">
                      <div className="admin-academics-table-wrap">
                        <table className="admin-academics-modal-table">
                          <thead>
                            <tr>
                              <th>Subject</th>
                              {popupTermRows.map((term) => (
                                <th key={term.key}>{term.label}</th>
                              ))}
                              <th>Total</th>
                              <th>Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentPopupAcademics.length === 0 ? (
                              <tr>
                                <td colSpan={popupTermRows.length + 3}>No academic data found.</td>
                              </tr>
                            ) : (
                              studentPopupAcademics.map((item, index) => {
                                const total = getPopupRowTotal(item, popupTermRows);
                                const grade = getPopupRowGrade(item, popupTermRows);
                                return (
                                  <tr key={`${item?.subject || "subject"}-${index}`}>
                                    <td>{item?.subject || item?.subject_name || item?.name || "-"}</td>
                                    {popupTermRows.map((term) => (
                                      <td key={`${item?.subject || index}-${term.key}`}>
                                        {getPopupMarkForRow(item, term)}
                                      </td>
                                    ))}
                                    <td>{total}</td>
                                    <td>{grade}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="admin-academics-split-right">
                      <div className="admin-academics-trend-card">
                        <div className="admin-academics-trend-head">
                          <strong>{activeTrendTitle}</strong>
                          {activeTrend.overallDiff !== null ? (
                            <span
                              className={
                                activeTrend.overallDiff > 0
                                  ? "admin-academics-trend-pill up"
                                  : activeTrend.overallDiff < 0
                                    ? "admin-academics-trend-pill down"
                                    : "admin-academics-trend-pill flat"
                              }
                            >
                              Overall: {activeTrend.overallDiff > 0 ? "+" : ""}
                              {activeTrend.overallDiff}%
                            </span>
                          ) : null}
                        </div>

                        <div className="admin-academics-trend-filter-row">
                          <label htmlFor="trend-subject-select">Subject:</label>
                          <select
                            id="trend-subject-select"
                            className="admin-academics-trend-subject-select"
                            value={trendSubjectKey}
                            onChange={(e) => setTrendSubjectKey(e.target.value)}
                          >
                            <option value="__all__">All Subjects</option>
                            {popupSubjectOptions.map((subject) => (
                              <option key={subject.key} value={subject.key}>
                                {subject.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {activeTrend.validPoints.length < 2 ? (
                          <div className="admin-academics-trend-empty">
                            Add more than one test record to view improvement trend.
                          </div>
                        ) : (
                          <>
                            <div className="admin-academics-trend-chart-wrap">
                              <svg viewBox="0 0 560 180" className="admin-academics-trend-chart" preserveAspectRatio="none">
                                {(() => {
                                  const values = activeTrend.validPoints.map((point) => Number(point.value));
                                  const minVal = Math.min(...values);
                                  const maxVal = Math.max(...values);
                                  const spread = maxVal - minVal || 1;
                                  const xStep = activeTrend.validPoints.length > 1 ? 520 / (activeTrend.validPoints.length - 1) : 0;
                                  const toY = (val) => 16 + ((maxVal - val) / spread) * 128;
                                  const toX = (idx) => 20 + idx * xStep;
                                  const polyline = activeTrend.validPoints
                                    .map((point, idx) => `${toX(idx)},${toY(Number(point.value))}`)
                                    .join(" ");
                                  return (
                                    <>
                                      <line x1="20" y1="144" x2="540" y2="144" className="admin-academics-trend-axis" />
                                      <polyline points={polyline} className="admin-academics-trend-line" />
                                      {activeTrend.validPoints.map((point, idx) => (
                                        <g key={point.key}>
                                          <circle cx={toX(idx)} cy={toY(Number(point.value))} r="4.5" className="admin-academics-trend-dot" />
                                          <text x={toX(idx)} y="165" textAnchor="middle" className="admin-academics-trend-x-label">
                                            {point.label}
                                          </text>
                                          <text x={toX(idx)} y={toY(Number(point.value)) - 8} textAnchor="middle" className="admin-academics-trend-value-label">
                                            {Number(point.value).toFixed(1)}%
                                          </text>
                                        </g>
                                      ))}
                                    </>
                                  );
                                })()}
                              </svg>
                            </div>

                            <div className="admin-academics-trend-transitions">
                              {activeTrend.transitions.map((item) => (
                                <span
                                  key={`${item.from}-${item.to}`}
                                  className={`admin-academics-trend-transition ${item.improved ? "up" : item.diff < 0 ? "down" : "flat"}`}
                                >
                                  {item.from} to {item.to}: {item.status} ({item.diff > 0 ? "+" : ""}
                                  {item.diff}%)
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : studentPopupTab === "attendance" ? (
                <table className="admin-academics-modal-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Present</th>
                      <th>Total</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentPopupAttendance.length === 0 ? (
                      <tr>
                        <td colSpan="4">No attendance data found.</td>
                      </tr>
                    ) : (
                      studentPopupAttendance.map((month, index) => {
                        const present = Number(month?.present || 0);
                        const total = Number(month?.total || 0);
                        const percent = total > 0 ? ((present / total) * 100).toFixed(2) : "0.00";
                        return (
                          <tr key={`${month?.month || "month"}-${index}`}>
                            <td>{month?.month} {month?.year}</td>
                            <td>{present}</td>
                            <td>{total}</td>
                            <td>{percent}%</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="admin-academics-modal-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(mockConduct).map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{value.description}</td>
                        <td>{value.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="accountant-footer-brand">
        <span>Powered By:</span>
        <img src={abcLogo} alt="Cleezo Class" className="accountant-footer-logo" />
      </div>

      <style>{`
        .admin-academics-page .accountant-dashboard-shell {
          overflow: hidden;
        }

        .admin-academics-content {
          display: grid;
          gap: 1rem;
          padding: 0.2rem 0 0.6rem;
        }

        .admin-academics-top {
          display: grid;
          grid-template-columns: 1.2fr 1.35fr 1.05fr;
          gap: 1rem;
          align-items: stretch;
        }

        .admin-academics-welcome,
        .admin-academics-summary,
        .admin-academics-performance,
        .admin-academics-storepo,
        .admin-academics-alerts,
        .admin-academics-tests,
        .admin-academics-footer-cards,
        .admin-academics-metric {
          border-radius: 1.55rem;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
          background: #fff;
        }

        .admin-academics-welcome {
          padding: 0.5rem 0.2rem;
          box-shadow: none;
          background: transparent;
        }

        .admin-academics-welcome h2 {
          font-size: 2rem;
          margin: 0 0 0.45rem;
          color: #111827;
        }

        .admin-academics-welcome p {
          margin: 0;
          font-size: 0.74rem;
          line-height: 1.35;
          color: #222;
        }

        .admin-academics-summary {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 1rem;
          align-items: center;
          padding: 0.8rem 1rem;
        }

        .admin-academics-summary-ring {
          width: 3.35rem;
          height: 3.35rem;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: conic-gradient(#f36b79 0 252deg, #f1f2f4 252deg 360deg);
        }

        .admin-academics-summary-ring-inner,
        .admin-academics-mini-ring {
          width: 2.6rem;
          height: 2.6rem;
          border-radius: 50%;
          background: #fff;
          display: grid;
          place-items: center;
          font-weight: 800;
          color: #1f2937;
        }

        .admin-academics-summary-stats p {
          margin: 0 0 0.24rem;
          font-size: 0.68rem;
          color: #555;
        }

        .admin-academics-summary-stats strong {
          color: #111;
        }

        .admin-academics-summary-right {
          display: grid;
          gap: 0.6rem;
          justify-items: end;
        }

        .admin-academics-exam h3,
        .admin-academics-exam p {
          margin: 0;
          text-align: right;
        }

        .admin-academics-exam h3 {
          font-size: 0.78rem;
        }

        .admin-academics-exam p {
          color: #ef6574;
          font-size: 0.68rem;
          font-weight: 800;
        }

        .admin-academics-mini-cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.8rem;
        }

        .admin-academics-main {
          display: grid;
          grid-template-columns: 2fr 1.05fr;
          gap: 1rem;
          align-items: start;
          min-height: 25.8rem;
        }

        .admin-academics-performance {
          padding: 1rem;
          height: 25.8rem;
          min-height: 25.8rem;
          max-height: 25.8rem;
          display: flex;
          flex-direction: column;
        }

        .admin-academics-performance-header {
          display: grid;
          grid-template-columns: auto auto 1fr;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1rem;
        }

        .admin-academics-performance-header h3 {
          margin: 0;
          font-size: 1.05rem;
        }

        .admin-academics-performance-tabs {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.7rem;
        }

        .admin-academics-performance-tabs button {
          background: transparent;
          border: 0;
          color: #888;
          font-weight: 700;
          cursor: pointer;
        }

        .admin-academics-performance-tabs button.active {
          color: #111;
          text-decoration: underline;
          text-decoration-color: #f36b79;
          text-decoration-thickness: 2px;
        }

        .admin-academics-performance-tabs strong {
          color: #f36b79;
          font-size: 1.35rem;
          margin-left: 0.3rem;
        }

        .admin-academics-filters {
          display: flex;
          justify-content: flex-end;
          gap: 0.55rem;
        }

        .admin-academics-filters input,
        .admin-academics-filters button,
        .admin-academics-filters select {
          height: 2rem;
          border: 1px solid #a8a8a8;
          border-radius: 0.7rem;
          background: #fff;
          font-size: 0.68rem;
          color: #666;
          padding: 0 0.8rem;
        }

        .admin-academics-filters input {
          width: 8.5rem;
        }

        .admin-academics-students-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 1rem 0.7rem;
          flex: 1;
          min-height: 0;
          align-content: start;
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .admin-academics-students-grid::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
          background: transparent;
        }

        .admin-academics-student-card {
          text-align: center;
        }

        .admin-academics-student-card-clickable {
          cursor: pointer;
        }

        .admin-academics-student-card-clickable:hover {
          transform: translateY(-2px);
        }

        .admin-academics-student-avatar-wrap {
          width: 4.25rem;
          height: 4.25rem;
          margin: 0 auto 0.35rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          transition: background 0.18s ease;
        }

        .admin-academics-student-card.is-selected .admin-academics-student-avatar-wrap {
          background: #f6a5ab;
        }

        .admin-academics-student-avatar {
          width: 3rem;
          height: 3rem;
          margin: 0;
          border-radius: 50%;
          background: #fff;
          display: grid;
          place-items: center;
          color: #000;
          font-size: 2rem;
        }

        .admin-academics-student-photo {
          width: 3rem;
          height: 3rem;
          margin: 0;
          border-radius: 50%;
          object-fit: cover;
          display: block;
          background: #f3f4f6;
        }

        .admin-academics-student-avatar.highlight {
          background: #f9a9b1;
        }

        .admin-academics-student-name {
          font-size: 0.58rem;
          font-weight: 700;
          color: #444;
          line-height: 1.15;
        }

        .admin-academics-student-meta,
        .admin-academics-student-score {
          font-size: 0.5rem;
          color: #7a7a7a;
          line-height: 1.15;
        }

        .admin-academics-student-score.highlight {
          color: #ef6574;
          font-weight: 800;
        }

        .admin-academics-empty {
          grid-column: 1 / -1;
          min-height: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          color: #7a7a7a;
          font-size: 0.8rem;
          border-radius: 1rem;
        }

        .admin-academics-right-column {
          display: grid;
          gap: 1rem;
          height: 25.8rem;
          min-height: 25.8rem;
          grid-template-rows: 1fr auto;
        }

        .admin-academics-storepo {
          padding: 1rem;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .admin-academics-side-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 0.6rem;
        }

        .admin-academics-side-header h3 {
          margin: 0;
          font-size: 1rem;
        }

        .admin-academics-request-count {
          display: flex;
          align-items: baseline;
          gap: 0.2rem;
        }

        .admin-academics-request-count strong {
          color: #ef6574;
          font-size: 1.9rem;
          line-height: 1;
        }

        .admin-academics-request-count span,
        .admin-academics-side-subtitle {
          font-size: 0.62rem;
          color: #777;
        }

        .admin-academics-po-list {
          display: grid;
          gap: 0.55rem;
          margin-top: 0.6rem;
          flex: 1;
          min-height: 0;
          max-height: 100%;
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .admin-academics-po-list::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
          background: transparent;
        }

        .admin-academics-po-item {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.55rem;
          align-items: center;
          font-size: 0.62rem;
          color: #666;
        }

        .admin-academics-assistant-item {
          display: grid;
          gap: 0.24rem;
          border: 1px solid #ececec;
          border-radius: 0.85rem;
          padding: 0.55rem 0.65rem;
          background: #fff;
        }

        .admin-academics-assistant-item strong {
          font-size: 0.78rem;
          color: #222;
        }

        .admin-academics-assistant-item span,
        .admin-academics-side-group-label {
          font-size: 0.68rem;
          color: #666;
        }

        .admin-academics-side-group-label {
          font-weight: 700;
          color: #555;
          margin-top: 0.15rem;
        }

        .admin-academics-po-actions {
          display: flex;
          gap: 0.35rem;
        }

        .admin-academics-po-actions button {
          width: 1.65rem;
          height: 1.65rem;
          border: 0;
          border-radius: 50%;
          background: #eef5ff;
          color: #60a5fa;
          cursor: pointer;
        }

        .admin-academics-metric-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          align-self: end;
        }

        .admin-academics-metric {
          min-height: 6.8rem;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 0.7rem;
        }

        .admin-academics-metric h3,
        .admin-academics-metric p,
        .admin-academics-metric strong,
        .admin-academics-metric span {
          margin: 0;
        }

        .admin-academics-metric strong {
          color: #ef6574;
          font-size: 1.9rem;
          line-height: 1;
        }

        .admin-academics-metric span {
          font-size: 0.68rem;
          color: #777;
        }

        .admin-academics-metric h3 {
          font-size: 0.92rem;
          margin-top: 0.25rem;
        }

        .admin-academics-metric p {
          font-size: 0.66rem;
          color: #6c6c6c;
        }

        .admin-academics-bottom {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1.1fr;
          gap: 1rem;
        }

        .admin-academics-alerts,
        .admin-academics-tests,
        .admin-academics-footer-cards {
          min-height: 4.7rem;
          padding: 0.85rem 1rem;
        }

        .admin-academics-alert-item {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 0.45rem;
          font-size: 0.62rem;
          color: #666;
          margin-bottom: 0.65rem;
        }

        .admin-academics-alert-action-wrap {
          display: flex;
          justify-content: flex-start;
        }

        .admin-academics-alert-action {
          align-self: flex-start;
          margin-top: 0.1rem;
          width: fit-content;
        }

        .admin-academics-tests,
        .admin-academics-footer-cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
          align-items: center;
        }

        .admin-academics-test-item,
        .admin-academics-footer-item {
          display: grid;
          gap: 0.18rem;
        }

        .admin-academics-test-item strong,
        .admin-academics-footer-item strong {
          font-size: 0.8rem;
          color: #111;
        }

        .admin-academics-test-item span,
        .admin-academics-footer-item span {
          font-size: 0.68rem;
          color: #111;
        }

        .admin-academics-test-item small,
        .admin-academics-footer-item small {
          font-size: 0.62rem;
          color: #f0a300;
        }

        .admin-academics-test-item.emphasis span {
          color: #ef6574;
          font-weight: 800;
        }

        .admin-academics-footer-cards {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .admin-academics-footer-item:last-child span {
          color: #ef6574;
          font-weight: 800;
        }

        .admin-academics-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.36);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          z-index: 1300;
        }

        .admin-academics-modal {
          width: min(72rem, 92vw);
          height: min(36rem, 86vh);
          min-height: min(36rem, 86vh);
          background: #fff;
          border-radius: 1.5rem;
          box-shadow: 0 30px 60px rgba(15, 23, 42, 0.22);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .admin-academics-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.2rem;
          border-bottom: 1px solid #ececec;
        }

        .admin-academics-modal-header h3,
        .admin-academics-modal-header p {
          margin: 0;
        }

        .admin-academics-modal-header h3 {
          font-size: 1.1rem;
          color: #111827;
        }

        .admin-academics-modal-header p {
          font-size: 0.72rem;
          color: #777;
          margin-top: 0.2rem;
        }

        .admin-academics-modal-header button {
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 999px;
          padding: 0.55rem 1rem;
          font-weight: 700;
          cursor: pointer;
        }

        .admin-academics-modal-tabs {
          display: flex;
          gap: 0.65rem;
          padding: 0.8rem 1.2rem 0;
        }

        .admin-academics-modal-tabs button {
          border: 1px solid #d9d9d9;
          background: #fff;
          color: #666;
          border-radius: 999px;
          padding: 0.5rem 1rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }

        .admin-academics-modal-tabs button.active {
          background: #f36b79;
          color: #fff;
          border-color: #f36b79;
        }

        .admin-academics-modal-content {
          padding: 1rem 1.2rem 1.25rem;
          flex: 1;
          min-height: 0;
          overflow: auto;
        }

        .admin-academics-modal-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }

        .admin-academics-split-view {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
          gap: 0.9rem;
          align-items: start;
        }

        .admin-academics-split-left,
        .admin-academics-split-right {
          min-width: 0;
        }

        .admin-academics-table-wrap {
          overflow: auto;
          border: 1px solid #ececec;
          border-radius: 0.9rem;
          background: #fff;
        }

        .admin-academics-trend-card {
          border: 1px solid #ececec;
          border-radius: 0.9rem;
          padding: 0.8rem 0.9rem;
          margin-bottom: 0;
          background: #fafbff;
        }

        .admin-academics-trend-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 0.55rem;
        }

        .admin-academics-trend-filter-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.6rem;
        }

        .admin-academics-trend-filter-row label {
          font-size: 0.72rem;
          color: #475467;
          font-weight: 700;
        }

        .admin-academics-trend-subject-select {
          height: 1.9rem;
          border: 1px solid #d0d5dd;
          border-radius: 0.55rem;
          background: #fff;
          color: #344054;
          font-size: 0.72rem;
          padding: 0 0.6rem;
        }

        .admin-academics-trend-head strong {
          font-size: 0.82rem;
          color: #1f2937;
        }

        .admin-academics-trend-pill {
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          font-size: 0.66rem;
          font-weight: 700;
        }

        .admin-academics-trend-pill.up {
          background: #e8f9ef;
          color: #16803c;
        }

        .admin-academics-trend-pill.down {
          background: #ffecef;
          color: #b42318;
        }

        .admin-academics-trend-pill.flat {
          background: #eef2f7;
          color: #475467;
        }

        .admin-academics-trend-empty {
          font-size: 0.72rem;
          color: #777;
          padding: 0.45rem 0;
        }

        .admin-academics-trend-chart-wrap {
          width: 100%;
          height: 11rem;
        }

        .admin-academics-trend-chart {
          width: 100%;
          height: 100%;
        }

        .admin-academics-trend-axis {
          stroke: #d0d5dd;
          stroke-width: 1.2;
        }

        .admin-academics-trend-line {
          fill: none;
          stroke: #f36b79;
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .admin-academics-trend-dot {
          fill: #fff;
          stroke: #ef6574;
          stroke-width: 2;
        }

        .admin-academics-trend-x-label {
          font-size: 10px;
          fill: #667085;
          font-weight: 600;
        }

        .admin-academics-trend-value-label {
          font-size: 10px;
          fill: #101828;
          font-weight: 700;
        }

        .admin-academics-trend-transitions {
          margin-top: 0.55rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .admin-academics-trend-transition {
          font-size: 0.64rem;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          border: 1px solid transparent;
        }

        .admin-academics-trend-transition.up {
          color: #16803c;
          border-color: #b7ebc6;
          background: #f1fcf5;
        }

        .admin-academics-trend-transition.down {
          color: #b42318;
          border-color: #fdccd3;
          background: #fff4f6;
        }

        .admin-academics-trend-transition.flat {
          color: #475467;
          border-color: #d0d5dd;
          background: #f8fafc;
        }

        @media (max-width: 1120px) {
          .admin-academics-split-view {
            grid-template-columns: 1fr;
          }
        }

        .admin-academics-modal-table th,
        .admin-academics-modal-table td {
          border-bottom: 1px solid #ececec;
          padding: 0.75rem 0.6rem;
          text-align: left;
          vertical-align: top;
        }

        .admin-academics-modal-table th {
          color: #ffffff;
          font-size: 0.78rem;
          background: #16558a;
        }

        .admin-academics-modal-table td {
          color: #5f6570;
        }

        .admin-academics-modal-empty {
          min-height: 12rem;
          display: grid;
          place-items: center;
          color: #777;
          font-size: 0.9rem;
        }

        @media (min-width: 900px) and (max-width: 1200px) {
          .admin-academics-page.accountant-dashboard-home-page,
          .admin-academics-page.frontdesk-dashboard-page {
            position: relative !important;
            inset: auto !important;
            height: auto !important;
            min-height: 100vh !important;
            overflow-x: auto !important;
            overflow-y: auto !important;
          }

          .admin-academics-page.accountant-dashboard-home-page .accountant-dashboard-shell,
          .admin-academics-page.frontdesk-dashboard-page .accountant-dashboard-shell {
            min-width: 0 !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
          }

          .admin-academics-page.accountant-dashboard-home-page .accountant-main-area,
          .admin-academics-page.frontdesk-dashboard-page .accountant-main-area,
          .admin-academics-page.accountant-dashboard-home-page .accountant-grid,
          .admin-academics-page.frontdesk-dashboard-page .accountant-grid {
            min-width: 0 !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
          }

          .frontdesk-dashboard-page .admin-academics-content {
            min-height: 0 !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            overscroll-behavior: contain !important;
            padding-right: 0.6rem !important;
            padding-bottom: 0.5rem !important;
          }
        }

        @media (min-width: 1201px) {
          .frontdesk-dashboard-page .admin-academics-content {
            min-height: 0 !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            overscroll-behavior: contain !important;
            padding-right: 0.6rem !important;
            padding-bottom: 0.5rem !important;
          }
        }

        @media (max-width: 1200px) {
          .admin-academics-page {
            min-height: 100vh;
            overflow-x: auto;
            overflow-y: auto;
          }

          .admin-academics-page .accountant-dashboard-shell,
          .admin-academics-page .dashboard-shell,
          .admin-academics-page .accountant-main-area,
          .admin-academics-page .dashboard-main {
            height: auto;
            min-height: auto;
            max-height: none;
            overflow: visible;
          }

          .admin-academics-page .admin-academics-content {
            min-width: 68rem;
            padding-bottom: 1rem;
          }

          .admin-academics-top,
          .admin-academics-main,
          .admin-academics-bottom {
            grid-template-columns: 1fr;
          }

          .admin-academics-mini-cards,
          .admin-academics-metric-row,
          .admin-academics-footer-cards,
          .admin-academics-tests {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .admin-academics-students-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .admin-academics-performance-header {
            grid-template-columns: 1fr;
          }

          .admin-academics-filters {
            justify-content: flex-start;
            flex-wrap: wrap;
          }

          .admin-academics-main,
          .admin-academics-performance,
          .admin-academics-right-column,
          .admin-academics-storepo {
            height: auto;
            min-height: auto;
            max-height: none;
          }

          .admin-academics-students-grid,
          .admin-academics-po-list {
            overflow: visible;
            max-height: none;
          }
        }

        @media (min-width: 900px) and (max-width: 1200px) {
          .admin-academics-page .admin-academics-content {
            min-width: 0 !important;
            min-height: 0 !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            overscroll-behavior: contain !important;
            padding-right: 0.6rem !important;
            padding-bottom: 0.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdiminAcademicsNew;
