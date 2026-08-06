import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaPlus, FaUser } from "react-icons/fa";
import axios from "axios";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "./AccountantDashboardnew.css";
import "./AdminDashboardNew.css";
import "../frontdeskdahboard/FrontDesk.css";
import "./AdminEventsAndMeetings.css";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";
import ErrorPopup from "../shared/ErrorPopup";
import AdmissionTimetableNew from "../shared/AdmissionTimetableNew.jsx";
import CompactTextTabs from "../shared/CompactTextTabs.jsx";
import InstituteBrand from "../shared/InstituteBrand.jsx";
import { resolveInstituteDisplayName } from "../shared/instituteNameUtils";
import { getUserDisplayName } from "../shared/userDisplayName";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import abcLogo from "../assets/logoab.png";
import dashboardIcon from "../assets/Dashboard.png";
import academicsIcon from "../assets/Staff Assign.png";
import leadProfileIcon from "../assets/Lead Profile.png";
import enrollmentIcon from "../assets/Enrollment.png";
import reportsIcon from "../assets/Reports .png";
import timelineIcon from "../assets/Timeline.png";
import followupIcon from "../assets/Profile.png";
import assistantIcon from "../assets/Assistant.png";
import communicationIcon from "../assets/Communication Assign.png";
import { FiHelpCircle } from "react-icons/fi";
import HelpCenter from "../shared/HelpCenter.jsx";
import TaskOfTheDay from "../shared/TaskOfTheDay.tsx";
const API_BASE = "https://cleezoclass.com:4000/api";

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

const reminderItems = [
  "Reminder - 30/03/2026 - Class XA, Performance report issue",
  "Reminder - 30/03/2026 - Store, Request Order for Uniform",
];

const requests = [
  "Live Chat (P - T) - 30/03/2026, 3.00pm - G. Vinay, 10A to C.T.",
  "Live Chat (T - P) - 31/03/2026, 11.00am - C.T. to N. Somesh, 10A",
];

const scheduled = [
  "Live Chat (T - P) - 26/03/2026, 3.00pm - L. Haritha, 7A to C.T.",
  "Live Chat (T - P) - 27/03/2026, 10.45am - C.T. to P. Sailaja, 10A",
];

const demoStudents = [
  "M. Vijaya Raju",
  "C. Kalyan Ram",
  "S. Aishq Ali",
];

const demoStaff = [
  "J. Anush Reddy",
  "J. Anush Reddy",
  "J. Anush Reddy",
];

const REPORT_TEMPLATE_STORAGE_KEY = "reportCardSelectedTemplate";
const REPORT_TEMPLATE_SELECTED_AT_KEY = "reportCardSelectedAt";
const REPORT_CARD_ADMIN_LAUNCH_KEY = "reportCardAdminLaunchConfig";
const DEFAULT_REPORT_TEMPLATE = "report1.html";
const ID_CARD_TEMPLATE_STORAGE_KEY = "idCardSelectedTemplate";
const DEFAULT_ID_CARD_TEMPLATE = "idcard1.html";

const normalizeReportTemplateName = (value) => {
  const template = String(value || "").trim().toLowerCase();
  return /^report[1-6]\.html$/.test(template) ? template : DEFAULT_REPORT_TEMPLATE;
};

const reportCardFormats = [
  { id: "report1.html", label: " Report Card 1" },
  { id: "report2.html", label: " Report Card 2" },
  { id: "report3.html", label: " Report Card 3" },
  { id: "report4.html", label: " Report Card 4" },
  { id: "report5.html", label: " Report Card 5" },
  { id: "report6.html", label: " Report Card 6" },
];

const normalizeIdCardTemplateName = (value) => {
  const template = String(value || "").trim().toLowerCase();
  return /^idcard(?:[1-9]|1[0-9]|2[0-6])\.html$/.test(template) ? template : DEFAULT_ID_CARD_TEMPLATE;
};

const idCardFormats = Array.from({ length: 20 }, (_, index) => {
  const cardNumber = index + 1
  return { id: `idcard${cardNumber}.html`, label: ` ID Card Template ${cardNumber}` };
});

const generationTemplates = [
  { key: "blue", className: "theme-blue" },
  { key: "green", className: "theme-green" },
  { key: "gold", className: "theme-gold" },
  { key: "coral", className: "theme-coral" },
  { key: "multi", className: "theme-multi" },
  { key: "upload", className: "theme-upload", isUpload: true },
];

const birthdayPosterTemplates = [
  { id: "birthday1.html", label: "Birthday Template 1" },
  { id: "birthday2.html", label: "Birthday Template 2" },
  { id: "birthday3.html", label: "Birthday Template 3" },
  { id: "birthday4.html", label: "Birthday Template 4" },
  { id: "birthday5.html", label: "Birthday Template 5" },
];

const eventPosterTemplates = [
  { id: "event1.html", label: "Event Template 1" },
  { id: "event2.html", label: "Event Template 2" },
  { id: "event3.html", label: "Event Template 3" },
  { id: "event4.html", label: "Event Template 4" },
  { id: "event5.html", label: "Event Template 5" },
  { id: "event6.html", label: "Event Template 6" },
];

const posterTemplateTabs = ["Student", "Staff", "All"];
const posterTemplateTypes = ["Events", "B-days", "All"];

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

const isSameMonthYear = (value, year, monthIndex) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === year && date.getMonth() === monthIndex;
};

const getDaySet = (items, key, year, monthIndex) =>
  new Set(
    (Array.isArray(items) ? items : [])
      .filter((item) => isSameMonthYear(item?.[key], year, monthIndex))
      .map((item) => new Date(item[key]).getDate())
  );

const formatChatDateTime = (dateValue, timeValue) => {
  const dateLabel = dateValue ? formatDateLabel(dateValue) : "-";
  const timeLabel = timeValue ? formatTimeLabel(timeValue) : "--";
  return `${dateLabel}, ${timeLabel}`;
};

const formatDobValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

const uniqueSortedValues = (items) =>
  Array.from(new Set((Array.isArray(items) ? items : []).filter(Boolean).map((item) => String(item).trim()))).sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
  );

const romanToNumber = (value) => {
  const roman = String(value || "").trim().toUpperCase();
  if (!/^[IVXLCDM]+$/.test(roman)) return null;
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let prev = 0;
  for (let i = roman.length - 1; i >= 0; i -= 1) {
    const current = map[roman[i]] || 0;
    if (current < prev) total -= current;
    else total += current;
    prev = current;
  }
  return total > 0 ? total : null;
};

const normalizeClassValue = (value) => {
  let normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "";

  normalized = normalized
    .replace(/\b(CLASS|STD|STANDARD|GRADE)\b/g, "")
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const compact = normalized.replace(/\s+/g, "");
  const compactMatch = compact.match(/^(\d+|[IVXLCDM]+)([A-Z]{0,2})$/);
  if (!compactMatch) return compact;

  const rawNumber = compactMatch[1];
  const suffix = compactMatch[2] || "";
  const numeric =
    /^\d+$/.test(rawNumber) ? Number(rawNumber) : romanToNumber(rawNumber);
  if (!Number.isFinite(numeric)) return compact;
  return `${numeric}${suffix}`;
};

const normalizeClassCollection = (data) => {
  if (Array.isArray(data)) {
    return uniqueSortedValues(
      data.map((item) =>
        typeof item === "string"
          ? item
          : item?.class_name || item?.className || item?.class || item?.name || item?.value || ""
      )
    );
  }

  if (data && typeof data === "object") {
    const candidates = [
      data.classOptions,
      data.classes,
      data.data,
      data.result,
      data.school,
      data.students,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return normalizeClassCollection(candidate);
      }
    }
  }

  return [];
};

const normalizeStudentCollection = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const nestedCandidates = [
    payload.students,
    payload.school,
    payload.data,
    payload.result,
    payload.rows,
    payload.items,
    payload.records,
    payload.response?.data,
    payload.data?.students,
    payload.data?.school,
    payload.data?.result,
    payload.result?.students,
    payload.result?.data,
  ];

  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

const getClassSortParts = (value) => {
  const normalized = normalizeClassValue(value);
  const match = normalized.match(/^(\d+)([A-Z]*)$/);
  if (match) return [Number(match[1]), match[2] || ""];
  return [Number.MAX_SAFE_INTEGER, normalized];
};

const compareClassValues = (left, right) => {
  const [leftNumber, leftSuffix] = getClassSortParts(left);
  const [rightNumber, rightSuffix] = getClassSortParts(right);
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;
  return String(leftSuffix).localeCompare(String(rightSuffix));
};

const resolveIdCardPhotoUrl = (rawPhoto) => {
  if (!rawPhoto) return "";

  let photoPath = rawPhoto;

  if (rawPhoto && typeof rawPhoto === "object" && rawPhoto.data) {
    try {
      const byteArray = new Uint8Array(rawPhoto.data);
      photoPath = new TextDecoder().decode(byteArray);
    } catch {
      photoPath = "";
    }
  }

  const decodeHexPhotoPath = (value) => {
    const hexValue = String(value || "").replace(/^0x/i, "");
    if (!hexValue || hexValue.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hexValue)) {
      return "";
    }
    try {
      return hexValue
        .match(/.{2}/g)
        ?.map((byte) => String.fromCharCode(parseInt(byte, 16)))
        .join("") || "";
    } catch {
      return "";
    }
  };

  if (!photoPath) return "";
  if (typeof photoPath !== "string") return "";

  let trimmed = photoPath.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("0x")) {
    trimmed = decodeHexPhotoPath(trimmed) || trimmed;
  } else if (/^(?:[0-9a-f]{2}){6,}$/i.test(trimmed)) {
    const decoded = decodeHexPhotoPath(trimmed).trim();
    if (/^(?:\/?public\/)?uploads\//i.test(decoded) || decoded.startsWith("/") || decoded.startsWith("http")) {
      trimmed = decoded;
    }
  }
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("http")) return trimmed;
  if (trimmed.startsWith("/public/uploads/")) {
    return `https://cleezoclass.com:4000${trimmed.replace("/public", "")}`;
  }
  if (trimmed.startsWith("public/uploads/")) {
    return `https://cleezoclass.com:4000/${trimmed.replace(/^public\//, "")}`;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 100) {
    return `data:image/png;base64,${trimmed}`;
  }
  if (!trimmed.startsWith("/")) return `https://cleezoclass.com:4000/${trimmed}`;
  return `https://cleezoclass.com:4000${trimmed}`;
};

const applyReportPreviewFit = (iframe) => {
  if (!iframe?.contentWindow?.document) return;

  const doc = iframe.contentWindow.document;
  const html = doc.documentElement;
  const body = doc.body;
  if (!html || !body) return;

  const reportRoot =
    doc.querySelector(".report-card") ||
    doc.querySelector(".report") ||
    doc.querySelector(".container") ||
    doc.querySelector(".page") ||
    doc.querySelector(".landscape-wrap");

  const availableWidth = Math.max((iframe.clientWidth || 0) - 12, 320);
  const contentWidth = Math.max(
    reportRoot?.scrollWidth || 0,
    body.scrollWidth || 0,
    html.scrollWidth || 0,
    1
  );
  const scale = Math.min(1, availableWidth / contentWidth);

  let previewStyle = doc.getElementById("report-preview-fit-style");
  if (!previewStyle) {
    previewStyle = doc.createElement("style");
    previewStyle.id = "report-preview-fit-style";
    doc.head?.appendChild(previewStyle);
  }

  previewStyle.textContent = `
    html, body {
      overflow-x: hidden !important;
      background: #eef2f7 !important;
    }
    body {
      margin: 0 !important;
      padding: 8px !important;
    }
    .report-card, .report, .container, .page, .landscape-wrap {
      margin-left: auto !important;
      margin-right: auto !important;
    }
  `;

  body.style.transformOrigin = "top left";
  body.style.transform = `scale(${scale})`;
  body.style.width = `${100 / scale}%`;
  body.style.minHeight = `${Math.ceil((body.scrollHeight || html.scrollHeight || 0) * scale) + 16}px`;
};

const filterStudentsByClassRange = (students, fromClass, toClass) => {
  const start = String(fromClass || "").trim();
  const end = String(toClass || "").trim();
  const hasStart = Boolean(start);
  const hasEnd = Boolean(end);

  if (!hasStart && !hasEnd) return [];

  let lowerBound = start;
  let upperBound = end;
  if (hasStart && hasEnd && compareClassValues(start, end) > 0) {
    lowerBound = end;
    upperBound = start;
  }

  return (Array.isArray(students) ? students : []).filter((student) => {
    const className = normalizeClassValue(
      student?.class_name || student?.class || student?.className || student?.classname || student?.standard || ""
    );
    const normalizedLowerBound = normalizeClassValue(lowerBound);
    const normalizedUpperBound = normalizeClassValue(upperBound);

    if (!className) return false;
    if (normalizedLowerBound && normalizedUpperBound) {
      return (
        compareClassValues(className, normalizedLowerBound) >= 0 &&
        compareClassValues(className, normalizedUpperBound) <= 0
      );
    }
    if (normalizedLowerBound) return className === normalizedLowerBound;
    return className === normalizedUpperBound;
  });
};

// const buildIdCardPreviewUrl = (templateId, student, schoolName, schoolLogoValue = "", schoolAddressValue = "") => {
//   const storage =
//     typeof window !== "undefined" && window?.localStorage ? window.localStorage : { getItem: () => "" };

//   // const stashLargeMediaValue = (value, keyPrefix) => {
//   //   const raw = String(value || "").trim();
//   //   if (!raw) return "";
//   //   const isLikelyLarge = raw.startsWith("data:image") || raw.length > 1800;
//   //   if (!isLikelyLarge) return raw;

//   //   try {
//   //     const studentKeyPart = String(
//   //       student?.id || student?.student_id || student?.admission_no || student?.admissionNo || student?.name || "student"
//   //     )
//   //       .replace(/[^a-zA-Z0-9_-]/g, "_")
//   //       .slice(0, 40);
//   //     const key = `idcard_${keyPrefix}_${studentKeyPart}`;
//   //     storage.setItem(key, raw);
//   //     return `storage:${key}`;
//   //   } catch {
//   //     return raw;
//   //   }
//   // };

//   const stashLargeMediaValue = (value, keyPrefix, sharedKey = null) => {
//   const raw = String(value || "").trim();
//   if (!raw) return "";
//   const isLikelyLarge = raw.startsWith("data:image") || raw.length > 1800;
//   if (!isLikelyLarge) return raw;

//   try {
//     const key = sharedKey || `idcard_${keyPrefix}_${studentKeyPart}`;
//     storage.setItem(key, raw);
//     return `storage:${key}`;
//   } catch {
//     return "";  // don't leak the full payload into the URL
//   }
// };

// // logo is the same for the whole batch — one shared key:

//   const storedSchoolLogo = String(storage.getItem("schoolLogo") || "").trim();
//   const storedSchoolName = String(
//     storage.getItem("schoolName") || storage.getItem("school") || storage.getItem("institute_name") || ""
//   ).trim();
//   const storedSchoolAddress = String(storage.getItem("schoolAddress") || "").trim();
//   const resolvedSchoolName = String(
//     schoolName && schoolName !== "Unknown School" ? schoolName : storedSchoolName || schoolName || "ABC School"
//   ).trim();
//   const resolvedSchoolLogo = String(
//     schoolLogoValue && schoolLogoValue !== "/default-logo.png" ? schoolLogoValue : storedSchoolLogo || schoolLogoValue || ""
//   ).trim();
//   const resolvedSchoolAddress = String(schoolAddressValue || storedSchoolAddress || "").trim();
//   const resolvedPhoto = resolveIdCardPhotoUrl(
//     student?.photo ||
//       student?.student_photo ||
//       student?.studentPhoto ||
//       student?.photo_url ||
//       student?.photoUrl ||
//       student?.student_photo_url ||
//       student?.profile_photo ||
//       student?.profilePhoto ||
//       student?.image ||
//       student?.image_url ||
//       student?.student_image ||
//       student?.studentImage ||
//       ""
//   );

//   // const safeSchoolLogo = stashLargeMediaValue(resolvedSchoolLogo, "school_logo");

//   const safeStudentPhoto = stashLargeMediaValue(resolvedPhoto, "student_photo");
// const safeSchoolLogo = stashLargeMediaValue(resolvedSchoolLogo, "school_logo", "idcard_shared_school_logo");


//   const params = new URLSearchParams({
//     school: resolvedSchoolName,
//     schoolName: resolvedSchoolName,
//     schoolLogo: safeSchoolLogo,
//     logo: safeSchoolLogo,
//     schoolAddress: resolvedSchoolAddress,
//     name: String(student?.name || student?.student_name || student?.studentName || "Student"),
//     className: String(
//       student?.class_name || student?.class || student?.className || student?.classname || student?.standard || "-"
//     ),
//     section: String(student?.section || student?.section_name || student?.sectionName || student?.sec || "-"),
//     admissionNo: String(
//       student?.admission_number || student?.admissionNo || student?.admission_no || student?.admno || student?.id || "-"
//     ),
//     rollNo: String(student?.roll_no || student?.rollNo || student?.student_id || student?.id || "-"),
//     phone: String(student?.phone || student?.mobile || student?.student_mobile || student?.contact || "-"),
//     emergency: String(
//       student?.emergency_contact || student?.parent_mobile || student?.father_mobile || student?.mother_mobile || "-"
//     ),
//     bloodGroup: String(student?.blood_group || student?.bloodGroup || "-"),
//     dob: formatDobValue(student?.dob || student?.date_of_birth || student?.dateOfBirth || "-"),
//     address: String(student?.address || student?.current_address || student?.permanent_address || "-"),
//     parent: String(student?.father_name || student?.parent_name || student?.guardian_name || "-"),
//     route: String(student?.route || student?.bus_route || "-"),
//     photo: safeStudentPhoto,
//     studentPhoto: safeStudentPhoto,
//   });

//   return `${import.meta.env.BASE_URL}idcards/${templateId}?${params.toString()}`;
// };

const buildIdCardPreviewUrl = (templateId, student, schoolName, schoolLogoValue = "", schoolAddressValue = "") => {
  const storage =
    typeof window !== "undefined" && window?.localStorage ? window.localStorage : { getItem: () => "" };

  const stashLargeMediaValue = (value, keyPrefix, sharedKey = null) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const isLikelyLarge = raw.startsWith("data:image") || raw.length > 1800;
    if (!isLikelyLarge) return raw;

    try {
      const studentKeyPart = String(
        student?.id || student?.student_id || student?.admission_no || student?.admissionNo || student?.name || "student"
      )
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 40);
      const key = sharedKey || `idcard_${keyPrefix}_${studentKeyPart}`;
      storage.setItem(key, raw);
      return `storage:${key}`;
    } catch {
      return ""; // don't leak the full payload into the URL on quota failure
    }
  };

  const storedSchoolLogo = String(storage.getItem("schoolLogo") || "").trim();
  const storedSchoolName = String(
    storage.getItem("schoolName") || storage.getItem("school") || storage.getItem("institute_name") || ""
  ).trim();
  const storedSchoolAddress = String(storage.getItem("schoolAddress") || "").trim();
  const resolvedSchoolName = String(
    schoolName && schoolName !== "Unknown School" ? schoolName : storedSchoolName || schoolName || "ABC School"
  ).trim();
  const resolvedSchoolLogo = String(
    schoolLogoValue && schoolLogoValue !== "/default-logo.png" ? schoolLogoValue : storedSchoolLogo || schoolLogoValue || ""
  ).trim();
  const resolvedSchoolAddress = String(schoolAddressValue || storedSchoolAddress || "").trim();

  const resolvedPhoto = resolveIdCardPhotoUrl(
    student?.photo ||
      student?.student_photo ||
      student?.studentPhoto ||
      student?.photo_url ||
      student?.photoUrl ||
      student?.student_photo_url ||
      student?.profile_photo ||
      student?.profilePhoto ||
      student?.image ||
      student?.image_url ||
      student?.student_image ||
      student?.studentImage ||
      ""
  );

  // Logo is identical for every student in a batch — cache it once under a shared key
  // instead of once per student, so localStorage doesn't fill up on large class ranges.
  const safeSchoolLogo = stashLargeMediaValue(resolvedSchoolLogo, "school_logo", "idcard_shared_school_logo");
  const safeStudentPhoto = stashLargeMediaValue(resolvedPhoto, "student_photo");

  const params = new URLSearchParams({
    school: resolvedSchoolName,
    schoolName: resolvedSchoolName,
    schoolLogo: safeSchoolLogo,
    logo: safeSchoolLogo,
    schoolAddress: resolvedSchoolAddress,
    name: String(student?.name || student?.student_name || student?.studentName || "Student"),
    className: String(
      student?.class_name || student?.class || student?.className || student?.classname || student?.standard || "-"
    ),
    section: String(student?.section || student?.section_name || student?.sectionName || student?.sec || "-"),
    admissionNo: String(
      student?.admission_number || student?.admissionNo || student?.admission_no || student?.admno || student?.id || "-"
    ),
    rollNo: String(student?.roll_no || student?.rollNo || student?.student_id || student?.id || "-"),
    phone: String(
      student?.phone_no ||
        student?.phone ||
        student?.mobile ||
        student?.mobile_no ||
        student?.student_mobile ||
        student?.contact ||
        "-"
    ),
    emergency: String(
      student?.emergency_contact || student?.parent_mobile || student?.father_mobile || student?.mother_mobile || "-"
    ),
    bloodGroup: String(student?.blood_group || student?.bloodGroup || "-"),
    dob: formatDobValue(student?.dob || student?.date_of_birth || student?.dateOfBirth || "-"),
    address: String(student?.address || student?.current_address || student?.permanent_address || "-"),
    parent: String(student?.father_name || student?.parent_name || student?.guardian_name || "-"),
    route: String(student?.route || student?.bus_route || "-"),
    photo: safeStudentPhoto,
    studentPhoto: safeStudentPhoto,
  });

  return `${import.meta.env.BASE_URL}idcards/${templateId}?${params.toString()}`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizePerformanceForTemplate = (rows) => {
  if (!Array.isArray(rows)) return [];

  const toFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") return NaN;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : NaN;
  };

  const isLikelyMaxField = (key) => /max|maximum|total/i.test(String(key || ""));

  const readNumericField = (entry, { maximum = false } = {}) => {
    if (entry == null) return NaN;
    if (typeof entry !== "object") return toFiniteNumber(entry);

    const numericFields = Object.entries(entry)
      .map(([key, value]) => ({ key, value: toFiniteNumber(value) }))
      .filter((field) => !Number.isNaN(field.value));

    if (!numericFields.length) return NaN;

    const match = numericFields.find((field) =>
      maximum ? isLikelyMaxField(field.key) : !isLikelyMaxField(field.key)
    );

    if (maximum) return match?.value ?? NaN;
    return match?.value ?? numericFields[0].value;
  };

  const normalizeTestEntry = (entry) => {
    const obtained = readNumericField(entry);
    const max = readNumericField(entry, { maximum: true });
    const absent =
      entry && typeof entry === "object"
        ? Boolean(entry.absent) || String(entry.status || "").toLowerCase() === "absent"
        : Number.isNaN(obtained);
    const percentage =
      !Number.isNaN(obtained) && !Number.isNaN(max) && max > 0
        ? Number(((obtained / max) * 100).toFixed(2))
        : null;

    return {
      obtained: Number.isNaN(obtained) ? null : obtained,
      marksObtained: Number.isNaN(obtained) ? null : obtained,
      max: Number.isNaN(max) ? null : max,
      maxMarks: Number.isNaN(max) ? null : max,
      percentage,
      absent,
      status: absent ? "Absent" : "Present",
    };
  };

  const toDisplayMark = (entry) => {
    const normalized = normalizeTestEntry(entry);
    if (normalized.absent) return "Ab";
    return normalized.obtained ?? "-";
  };

  return rows.map((row) => {
    const subject = row?.subject || row?.name || row?.subject_name || row?.title || "-";

    if (Array.isArray(row?.FA) || Array.isArray(row?.SA)) {
      const fa = Array.isArray(row?.FA) ? row.FA.map(toDisplayMark) : [];
      const sa = Array.isArray(row?.SA) ? row.SA.map(toDisplayMark) : [];
      const tests =
        row?.tests && typeof row.tests === "object"
          ? Object.fromEntries(Object.entries(row.tests).map(([key, entry]) => [key, normalizeTestEntry(entry)]))
          : {
              FA1: normalizeTestEntry(row?.FA?.[0]),
              FA2: normalizeTestEntry(row?.FA?.[1]),
              FA3: normalizeTestEntry(row?.FA?.[2]),
              FA4: normalizeTestEntry(row?.FA?.[3]),
              SA1: normalizeTestEntry(row?.SA?.[0]),
              SA2: normalizeTestEntry(row?.SA?.[1]),
            };

      const totals = Object.values(tests).reduce(
        (acc, entry) => {
          if (entry?.max != null && entry.max > 0) {
            acc.max += entry.max;
          }
          if (entry?.obtained != null) {
            acc.obtained += entry.obtained;
            if (entry?.max == null || entry.max <= 0) {
              acc.missingMax = true;
            }
          }
          return acc;
        },
        { obtained: 0, max: 0, missingMax: false }
      );
      const percentage =
        totals.max > 0 && !totals.missingMax
          ? Number(((totals.obtained / totals.max) * 100).toFixed(2))
          : null;

      return {
        ...row,
        subject,
        FA: fa,
        SA: sa,
        tests,
        marksObtained: Number(totals.obtained.toFixed(2)),
        obtainedMarks: Number(totals.obtained.toFixed(2)),
        totalMarks: totals.missingMax ? null : Number(totals.max.toFixed(2)),
        maxMarks: totals.missingMax ? null : Number(totals.max.toFixed(2)),
        percentage,
      };
    }

    const tests = row?.tests && typeof row.tests === "object" ? row.tests : {};
    const read = (key) => {
      if (tests[key] != null) return toDisplayMark(tests[key]);
      const matchingKey = Object.keys(tests).find((item) => String(item).toLowerCase() === key.toLowerCase());
      return matchingKey ? toDisplayMark(tests[matchingKey]) : "-";
    };

    const fa = [read("FA1"), read("FA2"), read("FA3"), read("FA4")];
    const sa = [read("SA1"), read("SA2")];
    const normalizedTests = Object.fromEntries(
      Object.entries(tests).map(([key, entry]) => [key, normalizeTestEntry(entry)])
    );
    const totals = Object.values(normalizedTests).reduce(
      (acc, entry) => {
        if (entry?.max != null && entry.max > 0) {
          acc.max += entry.max;
        }
        if (entry?.obtained != null) {
          acc.obtained += entry.obtained;
          if (entry?.max == null || entry.max <= 0) {
            acc.missingMax = true;
          }
        }
        return acc;
      },
      { obtained: 0, max: 0, missingMax: false }
    );
    const percentage =
      totals.max > 0 && !totals.missingMax
        ? Number(((totals.obtained / totals.max) * 100).toFixed(2))
        : null;

    return {
      ...row,
      subject,
      FA: fa,
      SA: sa,
      tests: normalizedTests,
      marksObtained: Number(totals.obtained.toFixed(2)),
      obtainedMarks: Number(totals.obtained.toFixed(2)),
      totalMarks: totals.missingMax ? null : Number(totals.max.toFixed(2)),
      maxMarks: totals.missingMax ? null : Number(totals.max.toFixed(2)),
      percentage,
    };
  });
};

const AdminGenerations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const schoolCode = String(localStorage.getItem("schoolCode") || "").trim();
  const activeTopTab = useMemo(() => {
    const path = location.pathname;
    if (path === "/AdminDashboard") return "Dashboard";
    if (path === "/AdiminAcademicsNew") return "Academics";
    if (path === "/AdminEventsAndMeetings") return "Events & Meetings";
    return "";
  }, [location.pathname]);
  const [schoolName, setSchoolName] = useState(() =>
    String(localStorage.getItem("schoolName") || "Unknown School").trim()
  );
  const [schoolLogo, setSchoolLogo] = useState("/default-logo.png");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
   const [performance, setPerformance] = useState({});
  
      useEffect(() => {
          getOverallPerformance();
      }, []);
  
      const getOverallPerformance = async () => {
  
          try {
  
              const schoolCode = localStorage.getItem("schoolCode");
  
              const response = await axios.get(
                  "https://cleezoclass.com:4000/api/overall-performance-percentage",
                  {
                      params: {
                          schoolCode,
                      },
                  }
              );
  
              if (response.data.success) {
                  setPerformance(response.data.data);
              }
  
          } catch (error) {
              console.log(error);
          }
  
      };
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [popupType, setPopupType] = useState("");
  const [activeQuickPanel, setActiveQuickPanel] = useState("livechat");
  const [eventMeetingTab, setEventMeetingTab] = useState("event");
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [chatRequests, setChatRequests] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [storeActions, setStoreActions] = useState([]);
  const [storeActionsLoading, setStoreActionsLoading] = useState(false);
  const [storeActionsError, setStoreActionsError] = useState("");
  const [party1List, setParty1List] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [studentOptions, setStudentOptions] = useState([]);
  const [selectedCardStudent, setSelectedCardStudent] = useState("");
  const [selectedCardStaff, setSelectedCardStaff] = useState("");
  const [selectedReportCardTemplate, setSelectedReportCardTemplate] = useState(() =>
    normalizeReportTemplateName(localStorage.getItem(REPORT_TEMPLATE_STORAGE_KEY))
  );
  const [selectedIdCardTemplate, setSelectedIdCardTemplate] = useState(() =>
    normalizeIdCardTemplateName(localStorage.getItem(ID_CARD_TEMPLATE_STORAGE_KEY))
  );
          const [openHelpSection, setOpenHelpSection] = useState(null);
        const[isHelpOpen,setIsHelpOpen]=useState(false)
        const userRole = localStorage.getItem("userRole")
  const [generationRange, setGenerationRange] = useState({
    fromClass: "",
    toClass: "",
  });
  // Download ID Card Popup States
const [downloadIdCardPopupOpen, setDownloadIdCardPopupOpen] = useState(false);
const [idCardFileFormat, setIdCardFileFormat] = useState('pdf-print');
const [idCardDownloadType, setIdCardDownloadType] = useState('zip');
const [idCardPdfLayout, setIdCardPdfLayout] = useState(2);
const [idCardSide, setIdCardSide] = useState('front-back');
const [idCardPaperSize, setIdCardPaperSize] = useState('a4');
const [idCardImageQuality, setIdCardImageQuality] = useState('high');
const [idCardShowCropMarks, setIdCardShowCropMarks] = useState(false);
const [idCardShowCutGuidelines, setIdCardShowCutGuidelines] = useState(false);
const [idCardAddPageNumbers, setIdCardAddPageNumbers] = useState(false);
const [idCardFileName, setIdCardFileName] = useState('IDCards_SelectedStudents');
  
  const [reportRangeStudents, setReportRangeStudents] = useState([]);
  const [reportRangeLoading, setReportRangeLoading] = useState(false);
  const [reportRangeError, setReportRangeError] = useState("");
  const [allReportsPopupOpen, setAllReportsPopupOpen] = useState(false);
  const [idCardRangeStudents, setIdCardRangeStudents] = useState([]);
  const [idCardRangeLoading, setIdCardRangeLoading] = useState(false);
  const [idCardRangeError, setIdCardRangeError] = useState("");
  const [allIdCardsPopupOpen, setAllIdCardsPopupOpen] = useState(false);
  const [selectedReportStudent, setSelectedReportStudent] = useState(null);
  const [selectedReportPayload, setSelectedReportPayload] = useState(null);
  const [reportPopupOpen, setReportPopupOpen] = useState(false);
  const [reportPreviewLoading, setReportPreviewLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({
  active: false,
  current: 0,
  total: 0,
  message: ""
});
  const [templatePreviewState, setTemplatePreviewState] = useState({
    open: false,
    kind: "",
    templateId: "",
    templateLabel: "",
  });
  const reportPreviewFrameRef = useRef(null);
  const templateTrackRefs = useRef({
    reportCard: null,
    idCard: null,
    poster: null,
  });
  const [posterAudienceTab, setPosterAudienceTab] = useState("Student");
  const [posterTemplateCategory, setPosterTemplateCategory] = useState("Events");
  const [selectedPosterTemplate, setSelectedPosterTemplate] = useState("event1.html");
  const [sendingPoster, setSendingPoster] = useState(false);
  const [generationView, setGenerationView] = useState("reports");
  const [liveChatForm, setLiveChatForm] = useState({
    party1: "",
    className: "",
    section: "",
    student: "",
    date: new Date().toISOString().split("T")[0],
    time: "",
  });

  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [meetings, setMeetings] = useState([]);

  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    category: "General",
    announcementDate: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [eventForm, setEventForm] = useState({
    eventName: "",
    eventType: "General",
    eventDate: new Date().toISOString().split("T")[0],
    eventTime: "",
    description: "",
  });
  const [meetingForm, setMeetingForm] = useState({
    meetingTitle: "",
    meetingDate: new Date().toISOString().split("T")[0],
    meetingTime: "",
    agenda: "",
    description: "",
  });

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth, calendarYear]);

  const announcementDays = useMemo(
    () => getDaySet(announcements, "announcementDate", calendarYear, calendarMonth),
    [announcements, calendarYear, calendarMonth]
  );
  const eventDays = useMemo(
    () => getDaySet(events, "eventDate", calendarYear, calendarMonth),
    [events, calendarYear, calendarMonth]
  );
  const meetingDays = useMemo(
    () => getDaySet(meetings, "meetingDate", calendarYear, calendarMonth),
    [meetings, calendarYear, calendarMonth]
  );

  const latestAnnouncement = announcements[0] || null;
  const latestEvent = events[0] || null;
  const latestMeeting = meetings[0] || null;

  const buildDateValue = (day) => {
    if (!day) return "";
    return `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const footerCards = [
    {
      title: latestAnnouncement ? formatDateLabel(latestAnnouncement.announcementDate) : "--",
      subtitle: latestAnnouncement?.title || "No announcements",
      meta: "Announcements",
    },
    {
      title: latestEvent ? formatDateLabel(latestEvent.eventDate) : "--",
      subtitle: latestEvent?.eventName || "No events",
      meta: "Events",
    },
    {
      title: latestMeeting ? formatDateLabel(latestMeeting.meetingDate) : "--",
      subtitle: latestMeeting?.meetingTitle || "No meetings",
      meta: "Meetings",
    },
    { title: "Complaints", subtitle: "Store", meta: "Uniform" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("schoolCode");
    localStorage.removeItem("userRole");
    localStorage.removeItem("name");
    sessionStorage.clear();
    window.location.replace(import.meta.env.BASE_URL || "/");
  };

  const assistantPanelItems = [
    {
      title: "Academics Tab Guidance",
      desc: "Check performance, exams, syllabus progress, and class-wise student discipline updates.",
    },
    {
      title: "Events & Meetings Guidance",
      desc: "Create events, assign meetings, and review pending discussion points and live chat follow-ups.",
    },
    {
      title: "Store Guidance",
      desc: "Review pending PO requests, validate stock movement, and raise replenishment actions early.",
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

  const visibleStudents = useMemo(() => {
    const source = Array.isArray(studentOptions) && studentOptions.length > 0 ? studentOptions : demoStudents;
    const normalized = source.filter(Boolean);

    if (!selectedCardStudent) {
      return normalized;
    }

    const selected = normalized.find((item) =>
      typeof item === "string" ? item === selectedCardStudent : item?.name === selectedCardStudent
    );
    const remaining = normalized.filter((item) =>
      typeof item === "string" ? item !== selectedCardStudent : item?.name !== selectedCardStudent
    );

    return selected ? [selected, ...remaining] : normalized;
  }, [selectedCardStudent, studentOptions]);

  const visibleStaff = useMemo(() => {
    const source = Array.isArray(party1List) && party1List.length > 0 ? party1List : demoStaff;
    const normalized = source.filter(Boolean);

    if (!selectedCardStaff) {
      return normalized.slice(0, 3);
    }

    const selected = normalized.find((item) =>
      typeof item === "string" ? item === selectedCardStaff : item?.name === selectedCardStaff
    );
    const remaining = normalized.filter((item) =>
      typeof item === "string" ? item !== selectedCardStaff : item?.name !== selectedCardStaff
    );
    const ordered = selected ? [selected, ...remaining] : normalized;

    return ordered.slice(0, 3);
  }, [party1List, selectedCardStaff]);

  useEffect(() => {
    if (!schoolCode) return;
    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${schoolCode}`)
      .then((res) => res.json())
      .then((data) => {
        const resolvedSchoolName = resolveInstituteDisplayName({
          apiInstituteName: data?.institute_name || data?.instituteName || data?.school_name || data?.name || data?.schoolName,
          storedSchoolName: localStorage.getItem("schoolName"),
          storedInstituteName: localStorage.getItem("instituteName"),
          schoolCode,
          fallback: "Unknown School",
        });
        const resolvedSchoolAddress = String(data?.address || data?.schoolAddress || data?.instituteAddress || "").trim();
        const normalizedLogo = normalizeInstituteLogo(data?.logo);
        setSchoolName(resolvedSchoolName);
        setSchoolLogo(normalizedLogo || "/default-logo.png");
        localStorage.setItem("schoolName", resolvedSchoolName);
        localStorage.setItem("instituteName", resolvedSchoolName);
        localStorage.setItem("schoolLogo", normalizedLogo || "/default-logo.png");
        localStorage.setItem("schoolAddress", resolvedSchoolAddress);
      })
      .catch(() => {
        const fallbackSchoolName = resolveInstituteDisplayName({
          storedSchoolName: localStorage.getItem("schoolName"),
          storedInstituteName: localStorage.getItem("instituteName"),
          schoolCode,
          fallback: "Unknown School",
        });
        setSchoolName(fallbackSchoolName);
        localStorage.setItem("schoolName", fallbackSchoolName);
        localStorage.setItem("instituteName", fallbackSchoolName);
        setSchoolLogo("/default-logo.png");
      });
  }, [schoolCode]);

  const popupStudents = useMemo(
    () => (Array.isArray(studentOptions) ? studentOptions.filter(Boolean) : []),
    [studentOptions]
  );

  const popupStaff = useMemo(
    () => (Array.isArray(party1List) ? party1List.filter(Boolean) : []),
    [party1List]
  );

  const visiblePosterStudents = visibleStudents;

  const handleChooseReportCardTemplate = (templateId) => {
    const normalized = normalizeReportTemplateName(templateId);
    const appliedAt = new Date().toISOString();
    setSelectedReportCardTemplate(normalized);
    localStorage.setItem(REPORT_TEMPLATE_STORAGE_KEY, normalized);
    localStorage.setItem(REPORT_TEMPLATE_SELECTED_AT_KEY, appliedAt);
    return normalized;
  };

  const handleChooseIdCardTemplate = (templateId) => {
    const normalized = normalizeIdCardTemplateName(templateId);
    setSelectedIdCardTemplate(normalized);
    localStorage.setItem(ID_CARD_TEMPLATE_STORAGE_KEY, normalized);
    return normalized;
  };

  const openTemplatePreview = (kind, templateId, templateLabel) => {
    setTemplatePreviewState({
      open: true,
      kind,
      templateId,
      templateLabel,
    });
  };

  const closeTemplatePreview = () => {
    setTemplatePreviewState({
      open: false,
      kind: "",
      templateId: "",
      templateLabel: "",
    });
  };

const handlePrintSelectedClassIdCards = async () => {
  const templateId = normalizeIdCardTemplateName(selectedIdCardTemplate);
  const students = Array.isArray(idCardRangeStudents) ? idCardRangeStudents : [];
  
  if (students.length === 0) {
    setPopupMessage("No students found for printing.");
    return;
  }

  // 🔥 Show progress
  setDownloadProgress({
    active: true,
    current: 0,
    total: students.length,
    message: "Preparing ID cards for print..."
  });

  try {
    // 🔥 Render each card using exact preview URL (340x540px)
    const canvases = [];
    let processedCount = 0;

    for (const student of students) {
      try {
        const canvas = await renderCardFromPreviewUrl(student, 'front');
        canvases.push({ student, canvas });
        
        processedCount++;
        setDownloadProgress({
          active: true,
          current: processedCount,
          total: students.length,
          message: `Preparing card ${processedCount} of ${students.length}: ${student?.name || 'Student'}`
        });
      } catch (error) {
        console.error(`Failed to render card for ${student?.name}:`, error);
      }
    }

    if (canvases.length === 0) {
      setDownloadProgress({ active: false });
      alert("❌ Failed to generate any ID cards for printing.");
      return;
    }

    setDownloadProgress({
      active: true,
      current: students.length,
      total: students.length,
      message: "Creating print document..."
    });

    // 🔥 Create print document with exact preview dimensions
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      setDownloadProgress({ active: false });
      alert("Please allow pop-ups to print ID cards.");
      return;
    }

    let cardsHtml = '';
    canvases.forEach(({ student, canvas }, index) => {
      const name = student?.name || student?.student_name || student?.studentName || "Student";
      const className = student?.class_name || student?.class || student?.className || student?.classname || "-";
      const section = student?.section || student?.section_name || student?.sectionName || student?.sec || "-";
      const imgData = canvas.toDataURL('image/png');

      cardsHtml += `
        <div class="print-card-page">
          <div class="print-card-wrapper">
            <img src="${imgData}" class="print-card-image" />
          </div>
          <div class="print-card-info">
            <strong>${escapeHtml(name)}</strong>
            <span>Class ${escapeHtml(className)} | Sec ${escapeHtml(section)}</span>
          </div>
        </div>
      `;
    });

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Print ID Cards - ${escapeHtml(schoolName)}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              font-family: Arial, Helvetica, sans-serif;
              background: #fff;
            }
            .print-card-page {
              page-break-after: always;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 10mm;
            }
            .print-card-page:last-child {
              page-break-after: auto;
            }
            .print-card-wrapper {
              width: 340px;
              height: 540px;
              border: 2px solid #000;
              overflow: hidden;
              background: #fff;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .print-card-image {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .print-card-info {
              margin-top: 15px;
              text-align: center;
              font-size: 14px;
              color: #333;
            }
            .print-card-info strong {
              display: block;
              font-size: 16px;
              margin-bottom: 5px;
            }
            .print-card-info span {
              color: #666;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .print-card-page {
                page-break-after: always;
                margin: 0;
                padding: 0;
              }
              .print-card-wrapper {
                border: 1px solid #000;
              }
            }
          </style>
        </head>
        <body>
          ${cardsHtml}
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();

    // 🔥 Hide progress after print dialog opens
    setTimeout(() => {
      setDownloadProgress({ active: false });
    }, 2000);

  } catch (error) {
    console.error("Print failed:", error);
    setDownloadProgress({ active: false });
    alert("❌ Failed to prepare ID cards for printing.\nError: " + error.message);
  }
};

  const fetchStudentsForReportRange = async () => {
    const code = String(schoolCode || "").trim();
    if (!code) return [];

    const attempts = [
      () => axios.get(`${API_BASE}/students-details`, { params: { schoolCode: code } }),
      () => axios.get(`${API_BASE}/api/students`, { params: { schoolCode: code } }),
      () => axios.post(`${API_BASE}/api/students`, { schoolCode: code }),
      () => axios.get(`https://cleezoclass.com:4000/students-details`, { params: { schoolCode: code } }),
      () => axios.get(`https://cleezoclass.com:4000/api/students`, { params: { schoolCode: code } }),
      () => axios.post(`https://cleezoclass.com:4000/api/students`, { schoolCode: code }),
    ];

    for (const run of attempts) {
      try {
        const response = await run();
        const list = normalizeStudentCollection(response?.data);

        if (list.length > 0) return list;
      } catch {
        // try next shape
      }
    }

    return [];
  };

  const enrichStudentsForReports = async (students) => {
    const grouped = new Map();
    const untouchedStudents = [];

    students.forEach((student) => {
      const className = String(student?.class_name || student?.class || student?.className || "").trim();
      const section = String(student?.section || student?.section_name || student?.sectionName || "").trim();
      if (!className || !section) {
        untouchedStudents.push(student);
        return;
      }
      const key = `${className}::${section}`;
      if (!grouped.has(key)) grouped.set(key, { className, section, students: [] });
      grouped.get(key).students.push(student);
    });

    if (grouped.size === 0) {
      return Array.isArray(students) ? students : [];
    }

    const results = await Promise.all(
      Array.from(grouped.values()).map(async ({ className, section, students: groupedStudents }) => {
        try {
          const response = await axios.get(
            `https://cleezoclass.com:4000/api/studentsName/${encodeURIComponent(className)}?schoolCode=${encodeURIComponent(
              schoolCode
            )}&section=${encodeURIComponent(section)}`
          );
          const detailedStudents = Array.isArray(response?.data?.students) ? response.data.students : [];

          return groupedStudents.map((student) => {
            const studentId = student?.id || student?.student_id;
            const matched = detailedStudents.find((item) => {
              const sameId = item?.id != null && studentId != null && String(item.id) === String(studentId);
              const sameIdentity =
                String(item?.name || item?.student_name || "").trim() ===
                  String(student?.name || student?.student_name || "").trim() &&
                String(item?.class_name || item?.class || item?.className || "").trim() === className &&
                String(item?.section || item?.section_name || item?.sectionName || "").trim() === section;
              return sameId || sameIdentity;
            });

            return matched ? { ...student, ...matched } : student;
          });
        } catch (error) {
          console.error("Failed to enrich report students", error);
          return groupedStudents;
        }
      })
    );

    return [...results.flat(), ...untouchedStudents];
  };

  const handleOpenReportCardGeneration = async (templateOverride) => {
    const templateToUse = normalizeReportTemplateName(templateOverride || selectedReportCardTemplate);
    const fromClass = String(generationRange.fromClass || "").trim();
    const toClass = String(generationRange.toClass || "").trim();

    if (!fromClass && !toClass) {
      setReportRangeError("Please select From class or To class.");
      return;
    }

    setReportRangeLoading(true);
    setReportRangeError("");
    setReportRangeStudents([]);
    setAllReportsPopupOpen(false);

    try {
      const students = await fetchStudentsForReportRange();
      const filtered = filterStudentsByClassRange(students, fromClass, toClass);

      if (filtered.length === 0) {
        const availableClasses = uniqueSortedValues(
          (Array.isArray(students) ? students : []).map(
            (item) => item?.class_name || item?.class || item?.className || item?.classname || item?.standard || ""
          )
        );
        setReportRangeError(
          availableClasses.length > 0
            ? `No students found for selected class range. Available classes: ${availableClasses.join(", ")}`
            : "No students found for the selected class range."
        );
        return;
      }

      const appliedAt = new Date().toISOString();
      setSelectedReportCardTemplate(templateToUse);
      localStorage.setItem(REPORT_TEMPLATE_STORAGE_KEY, templateToUse);
      localStorage.setItem(REPORT_TEMPLATE_SELECTED_AT_KEY, appliedAt);

      const enrichedStudents = await enrichStudentsForReports(filtered);
      setReportRangeStudents(enrichedStudents);
      setAllReportsPopupOpen(true);
    } catch (error) {
      setReportRangeError(error?.message || "Failed to load students for report generation.");
    } finally {
      setReportRangeLoading(false);
    }
  };

  // const handleOpenIdCardGeneration = async (templateOverride) => {

  //   const templateToUse = normalizeIdCardTemplateName(templateOverride || selectedIdCardTemplate);
  //   const fromClass = String(generationRange.fromClass || "").trim();
  //   const toClass = String(generationRange.toClass || "").trim();

  //   if (!fromClass && !toClass) {
  //     setIdCardRangeError("Please select From class or To class.");
  //     return;
  //   }

  //   setIdCardRangeLoading(true);
  //   setIdCardRangeError("");
  //   setIdCardRangeStudents([]);
  //   setAllIdCardsPopupOpen(false);

  //   try {
  //     const students = await fetchStudentsForReportRange();
  //     const filtered = filterStudentsByClassRange(students, fromClass, toClass);

  //     if (filtered.length === 0) {
  //       const availableClasses = uniqueSortedValues(
  //         (Array.isArray(students) ? students : []).map(
  //           (item) => item?.class_name || item?.class || item?.className || item?.classname || item?.standard || ""
  //         )
  //       );
  //       setIdCardRangeError(
  //         availableClasses.length > 0
  //           ? `No students found for selected class range. Available classes: ${availableClasses.join(", ")}`
  //           : "No students found for the selected class range."
  //       );
  //       return;
  //     }

  //     const enrichedStudents = await enrichStudentsForReports(filtered);
  //     setSelectedIdCardTemplate(templateToUse);
  //     localStorage.setItem(ID_CARD_TEMPLATE_STORAGE_KEY, templateToUse);
  //     setIdCardRangeStudents(enrichedStudents);
  //     setAllIdCardsPopupOpen(true);
  //   } catch (error) {
  //     setIdCardRangeError(error?.message || "Failed to load students for ID card generation.");
  //   } finally {
  //     setIdCardRangeLoading(false);
  //   }
  // };


const handleOpenIdCardGeneration = async (templateOverride) => {
    const templateToUse = normalizeIdCardTemplateName(templateOverride || selectedIdCardTemplate);
    const fromClass = String(generationRange.fromClass || "").trim();
    const toClass = String(generationRange.toClass || "").trim();

    if (!fromClass && !toClass) {
      setIdCardRangeError("Please select From class or To class.");
      return;
    }

    setIdCardRangeLoading(true);
    setIdCardRangeError("");
    setIdCardRangeStudents([]);
    setAllIdCardsPopupOpen(false);

    // 🔥 Clear stale ID-card media cache before generating a new batch,
    // otherwise localStorage fills up across sessions/classes and later
    // students silently fail to render (blank cards / missing photos).
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("idcard_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch (error) {
      console.warn("Failed to clear stale ID card cache", error);
    }

    try {
      const students = await fetchStudentsForReportRange();
      const filtered = filterStudentsByClassRange(students, fromClass, toClass);

      if (filtered.length === 0) {
        const availableClasses = uniqueSortedValues(
          (Array.isArray(students) ? students : []).map(
            (item) => item?.class_name || item?.class || item?.className || item?.classname || item?.standard || ""
          )
        );
        setIdCardRangeError(
          availableClasses.length > 0
            ? `No students found for selected class range. Available classes: ${availableClasses.join(", ")}`
            : "No students found for the selected class range."
        );
        return;
      }

      const enrichedStudents = await enrichStudentsForReports(filtered);
      setSelectedIdCardTemplate(templateToUse);
      localStorage.setItem(ID_CARD_TEMPLATE_STORAGE_KEY, templateToUse);
      setIdCardRangeStudents(enrichedStudents);
      setAllIdCardsPopupOpen(true);
    } catch (error) {
      setIdCardRangeError(error?.message || "Failed to load students for ID card generation.");
    } finally {
      setIdCardRangeLoading(false);
    }
  };

// 1. Add these states inside your AdminGenerations component


const [teachers, setTeachers] = useState([]);
const [loadingTeachers, setLoadingTeachers] = useState(false);
const [selectedCardTeacher, setSelectedCardTeacher] = useState("");

// 2. Add the useEffect hook to fetch teachers based on schoolCode
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
const buildTeacherIdCardPreviewUrl = (templateId, teacher, schoolName, schoolLogoValue = "", schoolAddressValue = "") => {
  const storage = typeof window !== "undefined" && window?.localStorage ? window.localStorage : { getItem: () => "" };

  const stashLargeMediaValue = (value, keyPrefix) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (!(raw.startsWith("data:image") || raw.length > 1800)) return raw;

    try {
      const teacherKeyPart = String(teacher?.id || teacher?.teacher_id || teacher?.emp_id || teacher?.name || "teacher")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 40);
      const key = `idcard_${keyPrefix}_${teacherKeyPart}`;
      storage.setItem(key, raw);
      return `storage:${key}`;
    } catch {
      return raw;
    }
  };

  const storedSchoolLogo = String(storage.getItem("schoolLogo") || "").trim();
  const storedSchoolName = String(storage.getItem("schoolName") || storage.getItem("school") || "").trim();
  const storedSchoolAddress = String(storage.getItem("schoolAddress") || "").trim();
  
  const resolvedSchoolName = String(schoolName && schoolName !== "Unknown School" ? schoolName : storedSchoolName || "ABC School").trim();
  const resolvedSchoolLogo = String(schoolLogoValue && schoolLogoValue !== "/default-logo.png" ? schoolLogoValue : storedSchoolLogo || "").trim();
  const resolvedSchoolAddress = String(schoolAddressValue || storedSchoolAddress || "").trim();
  
  const resolvedPhoto = resolveIdCardPhotoUrl(
    teacher?.photo ||
      teacher?.teacher_photo ||
      teacher?.teacherPhoto ||
      teacher?.photo_url ||
      teacher?.photoUrl ||
      teacher?.user_photo ||
      teacher?.userPhoto ||
      teacher?.profile_photo ||
      teacher?.profilePhoto ||
      teacher?.profile_image ||
      teacher?.profileImage ||
      teacher?.image ||
      teacher?.image_url ||
      teacher?.imageUrl ||
      teacher?.avatar ||
      ""
  );
  const safeSchoolLogo = stashLargeMediaValue(resolvedSchoolLogo, "school_logo");
  const safeTeacherPhoto = stashLargeMediaValue(resolvedPhoto, "teacher_photo");
  const designation = String(teacher?.designation || teacher?.role || teacher?.user_type || "Teacher");
  const department = String(teacher?.department || teacher?.dept || teacher?.department_name || "-");
  const subject = String(teacher?.subject || teacher?.subjects || teacher?.specialization || department || "-");
  const employeeNo = String(teacher?.emp_id || teacher?.employee_id || teacher?.teacher_id || teacher?.id || "-");

  const params = new URLSearchParams({
    cardType: "teacher",
    userType: "teacher",
    isTeacher: "true",
    school: resolvedSchoolName,
    schoolName: resolvedSchoolName,
    schoolLogo: safeSchoolLogo,
    logo: safeSchoolLogo,
    schoolAddress: resolvedSchoolAddress,
    name: String(teacher?.name || teacher?.teacher_name || "Teacher"),
    className: designation,
    section: department,
    admissionNo: employeeNo,
    rollNo: employeeNo,
    designation,
    department,
    subject,
    employeeNo,
    parent: subject,
    route: department,
    phone: String(teacher?.phone || teacher?.mobile || teacher?.phone_no || "-"),
    emergency: String(teacher?.emergency_contact || "-"),
    bloodGroup: String(teacher?.blood_group || "-"),
    dob: formatDobValue(teacher?.dob || teacher?.date_of_birth || "-"),
    address: String(teacher?.address || "-"),
    photo: safeTeacherPhoto,
    studentPhoto: safeTeacherPhoto,
    classLabel: "Designation",
    sectionLabel: "Department",
    rollLabel: "Employee ID",
    parentLabel: "Subject",
    routeLabel: "Department",
    photoAlt: "Teacher photo"
  });

  return `${import.meta.env.BASE_URL}idcards/${templateId}?${params.toString()}`;
};
const handlePrintTeacherIdCards = async () => {
  const templateId = normalizeIdCardTemplateName(selectedIdCardTemplate);
  const teacherList = Array.isArray(teachers) ? teachers : [];
  
  if (teacherList.length === 0) {
    setPopupMessage("No teachers found for printing.");
    return;
  }

  setDownloadProgress({ active: true, current: 0, total: teacherList.length, message: "Preparing Teacher ID cards..." });

  try {
    const canvases = [];
    let processedCount = 0;
    
    for (const teacher of teacherList) {
      try {
        // Render the teacher's card using the canvas render engine
        const canvas = await renderCardFromPreviewUrl(teacher, 'front', buildTeacherIdCardPreviewUrl); 
        
        canvases.push({ teacher, canvas });
        processedCount++;
        
        setDownloadProgress({
          active: true,
          current: processedCount,
          total: teacherList.length,
          message: `Preparing card ${processedCount} of ${teacherList.length}: ${teacher?.name || 'Teacher'}`
        });
      } catch (error) {
        console.error(`Failed to render card for ${teacher?.name}:`, error);
      }
    }

    if (canvases.length === 0) {
      setDownloadProgress({ active: false });
      alert("❌ Failed to generate any Teacher ID cards.");
      return;
    }

    // --- CHANGE STARTS HERE: Download as Files instead of opening a window ---
    
    setDownloadProgress({ 
      active: true, 
      current: teacherList.length, 
      total: teacherList.length, 
      message: canvases.length > 1 ? "Packaging into ZIP archive..." : "Downloading ID card..." 
    });

    if (canvases.length === 1) {
      // Single Teacher: Download directly as a PNG
      const { teacher, canvas } = canvases[0];
      const name = (teacher?.name || "Teacher").replace(/[^a-zA-Z0-9_-]/g, "_");
      
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `Teacher_ID_${name}.png`);
        }
        setDownloadProgress({ active: false });
      }, 'image/png');
      
    } else {
      // Multiple Teachers: Pack into a ZIP archive
      const zip = new JSZip();
      
      for (let i = 0; i < canvases.length; i++) {
        const { teacher, canvas } = canvases[i];
        const safeName = (teacher?.name || `Teacher_${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, "_");
        
        // Convert canvas image to a base64 data string buffer
        const imgBuffer = canvas.toDataURL('image/png').split(',')[1];
        zip.file(`Teacher_ID_${safeName}.png`, imgBuffer, { base64: true });
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      saveAs(zipContent, 'Teacher_ID_Cards.zip');
      
      setDownloadProgress({ active: false });
    }

  } catch (err) {
    console.error(err);
    setDownloadProgress({ active: false });
    alert("An error occurred while exporting Teacher ID cards.");
  }
};
  const handleOpenStudentAcademicReport = async (student) => {
    if (!student) return;

    const className = String(student.class_name || student.class || student.className || "").trim();
    const section = String(student.section || student.section_name || student.sectionName || "").trim();
    const studentId = student.id || student.student_id;
    const currentSchoolCode = localStorage.getItem("schoolCode") || schoolCode;

    try {
      setReportPreviewLoading(true);
      let enrichedStudent = student;
      if (className && section) {
        try {
          const studentsRes = await axios.get(
            `https://cleezoclass.com:4000/api/studentsName/${encodeURIComponent(className)}?schoolCode=${encodeURIComponent(currentSchoolCode)}&section=${encodeURIComponent(section)}`
          );

          const detailedStudents = Array.isArray(studentsRes?.data?.students) ? studentsRes.data.students : [];
          const matchedStudent = detailedStudents.find((item) => {
            const sameId =
              item?.id != null && studentId != null && String(item.id) === String(studentId);
            const sameIdentity =
              String(item?.name || item?.student_name || "").trim() ===
                String(student?.name || student?.student_name || "").trim() &&
              String(item?.class_name || item?.class || item?.className || "").trim() === className &&
              String(item?.section || item?.section_name || item?.sectionName || "").trim() === section;

            return sameId || sameIdentity;
          });

          if (matchedStudent) {
            enrichedStudent = { ...student, ...matchedStudent };
          }
        } catch (error) {
          console.error("Failed to enrich selected student details", error);
        }
      }

      const performancePayload = {
        name: enrichedStudent?.name || enrichedStudent?.student_name || "",
        class_name: className,
        section,
        schoolCode: currentSchoolCode,
      };

      const performanceAttempts = [
        () => axios.post(`${API_BASE}/overall/academic-performance`, performancePayload),
        () => axios.post(`https://cleezoclass.com:4000/api/overall/academic-performance`, performancePayload),
      ];

      let performance = [];
      let testTypes = [];
      for (const run of performanceAttempts) {
        try {
          const response = await run();
          performance = Array.isArray(response?.data) ? response.data : response?.data?.performance || [];
          testTypes = Array.isArray(response?.data?.testTypes) ? response.data.testTypes : [];
          break;
        } catch (error) {
          console.error("Failed academic performance attempt", error);
        }
      }

      const attendanceAttempts = [
        () => axios.post(`${API_BASE}/report/attendance/monthly`, performancePayload),
        () => axios.post(`https://cleezoclass.com:4000/api/report/attendance/monthly`, performancePayload),
      ];

      let attendance = [];
      for (const run of attendanceAttempts) {
        try {
          const response = await run();
          attendance = Array.isArray(response?.data?.monthly) ? response.data.monthly : [];
          break;
        } catch (error) {
          console.error("Failed attendance attempt", error);
        }
      }

      const payload = {
        student: {
          ...enrichedStudent,
          name: enrichedStudent?.name || enrichedStudent?.student_name || "",
          class_name: className,
          section,
          father_name: enrichedStudent?.father_name || enrichedStudent?.fatherName || "",
          address: enrichedStudent?.address || enrichedStudent?.student_address || "",
          phone_no:
            enrichedStudent?.phone_no ||
            enrichedStudent?.phone ||
            enrichedStudent?.mobile ||
            enrichedStudent?.mobile_no ||
            "",
          aadhar_no: enrichedStudent?.aadhar_no || enrichedStudent?.aadhar || "",
          admission_no: enrichedStudent?.admission_no || enrichedStudent?.admissionNumber || "",
          dob: enrichedStudent?.dob || enrichedStudent?.date_of_birth || "",
          photo:
            enrichedStudent?.photo ||
            enrichedStudent?.student_photo ||
            enrichedStudent?.photo_url ||
            enrichedStudent?.photoUrl ||
            enrichedStudent?.image ||
            enrichedStudent?.student_image ||
            "",
          schoolCode: currentSchoolCode,
        },
        performance: normalizePerformanceForTemplate(performance),
        testTypes,
        attendance,
        syncedAt: new Date().toISOString(),
      };

      localStorage.setItem("reportCardPayload", JSON.stringify(payload));
      setSelectedReportStudent(enrichedStudent);
      setSelectedReportPayload(payload);
      setReportPopupOpen(true);
    } catch (error) {
      console.error("Failed to load academic report preview", error);
      setPopupMessage("Failed to load academic report card.");
    } finally {
      setReportPreviewLoading(false);
    }
  };

  const handleConfirmTemplatePreview = async () => {
    const { kind, templateId } = templatePreviewState;
    if (!templateId) return;

    closeTemplatePreview();

    if (kind === "reportCard") {
      const normalized = handleChooseReportCardTemplate(templateId);
      await handleOpenReportCardGeneration(normalized);
      return;
    }

    if (kind === "idCard") {
      const normalized = handleChooseIdCardTemplate(templateId);
      await handleOpenIdCardGeneration(normalized);
    }
  };

const handleDownloadAcademicReport = async () => {
  // 1. Get iframe and document
  const iframe = reportPreviewFrameRef.current;
  if (!iframe?.contentWindow?.document || !selectedReportPayload?.student) return;

  const doc = iframe.contentWindow.document;
  const target = doc.querySelector(".report-card") || doc.body;
  if (!target) return;

  // 2. Convert to canvas using html2canvas
  const canvas = await html2canvas(target, {
    scale: 2,                    // High quality (2x resolution)
    useCORS: true,               // Allow cross-origin images
    backgroundColor: "#ffffff",  // White background
    windowWidth: doc.documentElement.scrollWidth,
    windowHeight: doc.documentElement.scrollHeight,
  });

  // 3. Determine orientation (landscape or portrait)
  const orientation = canvas.width > canvas.height ? "l" : "p";
  
  // 4. Create PDF with jsPDF
  const pdf = new jsPDF(orientation, "mm", "a4");
  const pageWidth = orientation === "l" ? 297 : 210;
  const pageHeight = orientation === "l" ? 210 : 297;
  
  // 5. Calculate dimensions maintaining aspect ratio
  const imageRatio = canvas.width / canvas.height;
  let renderWidth = pageWidth;
  let renderHeight = renderWidth / imageRatio;
  
  if (renderHeight > pageHeight) {
    renderHeight = pageHeight;
    renderWidth = renderHeight * imageRatio;
  }

  // 6. Center the image on the page
  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;
  
  // 7. Add image and save
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, renderWidth, renderHeight);
  pdf.save(`${selectedReportPayload.student.name || "Student"}_ReportCard.pdf`);
};
const handleDownloadAcademicReportImage = async () => {
  const iframe = reportPreviewFrameRef.current;
  if (!iframe?.contentWindow?.document || !selectedReportPayload?.student) return;

  const doc = iframe.contentWindow.document;
  const target = doc.querySelector(".report-card") || doc.body;
  if (!target) return;

  try {
    // 1. Convert to canvas
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: doc.documentElement.scrollWidth,
      windowHeight: doc.documentElement.scrollHeight,
    });

    // 2. Create download link
    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = image;
    link.download = `${selectedReportPayload.student.name || "Student"}_ReportCard.png`;
    
    // 3. Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error downloading image:", error);
    alert("Failed to download image.");
  }
};
const handleDownloadAcademicReportExcel = () => {
  if (!selectedReportPayload) return;

  // ⚠️ NOTE: Adjust these keys based on your actual selectedReportPayload structure
  const { student, subjects, overall } = selectedReportPayload; 

  // 1. Create Student Details Sheet
  const studentDetails = [
    ["Student Name", student?.name || ""],
    ["Class", student?.class || ""],
    ["Section", student?.section || ""],
    ["Father's Name", student?.fatherName || ""],
    ["Academic Year", student?.academicYear || ""],
  ];
  const wsDetails = XLSX.utils.aoa_to_sheet(studentDetails);

  // 2. Create Marks/Subjects Sheet
  let wsMarks;
  if (subjects && Array.isArray(subjects) && subjects.length > 0) {
    // Dynamically get headers from the first subject object
    const headers = Object.keys(subjects[0]); 
    const marksData = [
      headers, 
      ...subjects.map(sub => headers.map(h => sub[h])) // Map values safely
    ];
    wsMarks = XLSX.utils.aoa_to_sheet(marksData);
  } else {
    // Fallback if no subjects array is found
    wsMarks = XLSX.utils.json_to_sheet([student || {}]); 
  }

  // 3. Create Workbook and Append Sheets
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDetails, "Student Details");
  XLSX.utils.book_append_sheet(wb, wsMarks, "Marks & Subjects");

  // 4. Add Overall Summary Sheet (if available)
  if (overall) {
    const overallData = [
      ["Total Marks", overall.totalMarks || ""],
      ["Obtained Marks", overall.obtainedMarks || ""],
      ["Percentage", overall.percentage || ""],
      ["Grade", overall.grade || ""],
      ["Result", overall.result || ""],
    ];
    const wsOverall = XLSX.utils.aoa_to_sheet(overallData);
    XLSX.utils.book_append_sheet(wb, wsOverall, "Overall Summary");
  }

  // 5. Trigger Excel Download
  XLSX.writeFile(wb, `${student?.name || "Student"}_ReportCard.xlsx`);
};
  const handleTemplateScroll = (kind, direction) => {
    const track = templateTrackRefs.current?.[kind];
    if (!track) return;
    const step = Math.max(220, Math.floor(track.clientWidth * 0.72));
    track.scrollBy({
      left: direction === "next" ? step : -step,
      behavior: "smooth",
    });
  };

  const normalizeArrayResponse = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.rows)) return value.rows;
    if (Array.isArray(value?.sections)) return value.sections;
    if (Array.isArray(value?.students)) return value.students;
    return [];
  };

  const getPosterTemplates = () => {
    const eventTemplates = eventPosterTemplates.map((template) => ({
      key: template.id,
      label: template.label,
      kind: "iframe",
      src: import.meta.env.BASE_URL + `Events/${template.id}`,
    }));

    if (posterTemplateCategory === "B-days") {
      return birthdayPosterTemplates.map((template) => ({
        key: template.id,
        label: template.label,
        kind: "iframe",
        src: import.meta.env.BASE_URL + `Bdays/${template.id}`,
      }));
    }

    if (posterTemplateCategory === "All") {
      return [
        ...eventTemplates,
        ...generationTemplates.map((template) => ({
          key: template.key,
          className: template.className,
          kind: "swatch",
          isUpload: template.isUpload,
        })),
        ...birthdayPosterTemplates.map((template) => ({
          key: template.id,
          label: template.label,
          kind: "iframe",
          src: import.meta.env.BASE_URL + `Bdays/${template.id}`,
        })),
      ];
    }

    return eventTemplates;
  };

  useEffect(() => {
    const templates = getPosterTemplates();
    if (!templates.some((template) => template.key === selectedPosterTemplate)) {
      setSelectedPosterTemplate(templates[0]?.key || "");
    }
  }, [posterTemplateCategory]);

  const handleSendPosterToClassSection = async () => {
    const className = String(liveChatForm.className || "").trim();
    const section = String(liveChatForm.section || "").trim();
    const templateId = String(selectedPosterTemplate || "").trim();
    const isEventTemplate = /^event[1-6]\.html$/i.test(templateId);
    const isBirthdayTemplate = /^birthday[1-5]\.html$/i.test(templateId);

    if (!schoolCode) {
      setPopupMessage("Missing school code.");
      window.alert("Poster sending failed: Missing school code.");
      return;
    }

    if (!className || !section) {
      setPopupMessage("Please select class and section.");
      window.alert("Poster sending failed: Please select class and section.");
      return;
    }

    if (!templateId) {
      setPopupMessage("Please select a poster template.");
      window.alert("Poster sending failed: Please select a poster template.");
      return;
    }

    if (!isEventTemplate && !isBirthdayTemplate) {
      setPopupMessage("Please select a valid Events or Birthday template.");
      window.alert("Poster sending failed: Please select a valid Events or Birthday template.");
      return;
    }

    setSendingPoster(true);
    try {
      const response = await fetchJson(`${API_BASE}/admin-event-posters/send`, {
        method: "POST",
        body: JSON.stringify({
          schoolCode,
          className,
          section,
          templateId,
          eventDate: eventForm.eventDate || null,
          eventTime: eventForm.eventTime || null,
          audience: posterAudienceTab || "Student",
        }),
      });

      const queuedCount = Number(response?.data?.queuedCount || 0);
      if (queuedCount > 0) {
        const kindLabel = isBirthdayTemplate ? "Birthday" : "Event";
        const successMessage = `${kindLabel} poster queued for ${queuedCount} students in Class ${className} - ${section}.`;
        setPopupMessage(successMessage);
        window.alert(`Poster sent successfully. ${successMessage}`);
      } else {
        const notSentMessage = "Poster not sent: No students found for selected class and section.";
        setPopupMessage(notSentMessage);
        window.alert(notSentMessage);
      }
    } catch (error) {
      const failMessage = error?.message || "Failed to send poster.";
      setPopupMessage(failMessage);
      window.alert(`Poster sending failed: ${failMessage}`);
    } finally {
      setSendingPoster(false);
    }
  };

const renderGenerationCard = (title, kind = "generic") => (
    <div className="admin-events-generation-card accountant-card">
      <div className="admin-events-card-header">
        <h3>{title}</h3>
      </div>
      <div className="admin-events-generation-subtitle">Choose Templates</div>
      <div className="admin-events-template-row">
        <button
          type="button"
          className="admin-events-template-nav"
          aria-label="Previous template"
          onClick={() => handleTemplateScroll(kind, "prev")}
        >
          <FaChevronLeft />
        </button>
        <div
          className="admin-events-template-track"
          ref={(node) => {
            if (kind === "reportCard" || kind === "idCard") {
              templateTrackRefs.current[kind] = node;
            }
          }}
        >
          {kind === "reportCard"
            ? reportCardFormats.map((template) => {
                const isSelected = selectedReportCardTemplate === template.id;
                return (
                  <button
                    key={`${title}-${template.id}`}
                    type="button"
                    className={`admin-events-template-card admin-events-report-template-card ${isSelected ? "is-selected" : ""}`}
                    aria-label={`${title} ${template.label}`}
                    onClick={() => openTemplatePreview("reportCard", template.id, template.label)}
                  >
                    {/* <span className="admin-events-template-art" /> */}
                    <small className="admin-events-template-label">{template.label}</small>
                  </button>
                );
              })
            : kind === "idCard"
              ? idCardFormats.map((template) => {
                  const isSelected = selectedIdCardTemplate === template.id;
                  return (
                    <button
                      key={`${title}-${template.id}`}
                      type="button"
                      className={`admin-events-template-card admin-events-id-card-template-card ${isSelected ? "is-selected" : ""}`}
                      aria-label={`${title} ${template.label}`}
                      onClick={() => openTemplatePreview("idCard", template.id, template.label)}
                    >
                      {/* <span className="admin-events-template-art" /> */}
                      <small className="admin-events-template-label">{template.label}</small>
                    </button>
                  );
                })
              : generationTemplates.map((template) => (
                  <button
                    key={`${title}-${template.key}`}
                    type="button"
                    className={`admin-events-template-card ${template.className}`}
                    aria-label={`${title} ${template.key} template`}
                  >
                    <span className="admin-events-template-art" />
                    {template.isUpload ? <span className="admin-events-template-badge">+</span> : null}
                  </button>
                ))}
        </div>
        <button
          type="button"
          className="admin-events-template-nav"
          aria-label="Next template"
          onClick={() => handleTemplateScroll(kind, "next")}
        >
          <FaChevronRight />
        </button>
      </div>
      <div className="admin-events-generation-filter-grid">
        <label className="admin-events-generation-field">
          <span>Selection</span>
          <select value={liveChatForm.className ? "classwise" : ""} onChange={() => {}}>
            <option value="">Classwise / Curriculum</option>
            <option value="classwise">Classwise / Curriculum</option>
          </select>
        </label>
        <label className="admin-events-generation-field">
          <span>From</span>
          <select
            value={generationRange.fromClass}
            onChange={(e) => setGenerationRange((prev) => ({ ...prev, fromClass: e.target.value }))}
          >
            <option value="">Class</option>
            {classOptions.map((item, index) => (
              <option key={`${title}-class-${item}-${index}`} value={String(item)}>
                {String(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-events-generation-field">
          <span>To</span>
          <select
            value={generationRange.toClass}
            onChange={(e) => setGenerationRange((prev) => ({ ...prev, toClass: e.target.value }))}
          >
            <option value="">Class</option>
            {classOptions.map((item, index) => (
              <option key={`${title}-to-class-${item}-${index}`} value={String(item)}>
                {String(item)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="admin-events-generation-select-btn"
          onClick={
            kind === "reportCard"
              ? handleOpenReportCardGeneration
              : kind === "idCard"
                ? handleOpenIdCardGeneration
                : openLiveChatPopup
          }
          disabled={kind === "reportCard" ? reportRangeLoading : kind === "idCard" ? idCardRangeLoading : false}
        >
          {kind === "reportCard" ? (reportRangeLoading ? "Loading..." : "Generate") : kind === "idCard" ? (idCardRangeLoading ? "Loading..." : "Generate") : "Select"}
        </button>

        {/* Teacher ID Card Generation Action */}
        {kind === "idCard" && (
          <button
            type="button"
            className="admin-events-generation-select-btn teacher-gen-btn"
            onClick={handlePrintTeacherIdCards}
            disabled={loadingTeachers || teachers.length === 0}
            style={{ backgroundColor: "#10b981" }}
          >
            {loadingTeachers ? "Loading..." : `Teachers (${teachers.length})`}
          </button>
        )}
      </div>
      {kind === "reportCard" && reportRangeError ? (
        <div className="admin-events-generation-feedback">{reportRangeError}</div>
      ) : null}
      {kind === "idCard" && idCardRangeError ? (
        <div className="admin-events-generation-feedback">{idCardRangeError}</div>
      ) : null}
    </div>
  );

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.message || result?.error || "Request failed");
    }
    return result;
  };

  const loadAdminRecords = async () => {
    if (!schoolCode) {
      setPopupMessage("Missing school code.");
      return;
    }

    setLoadingRecords(true);
    try {
      const month = String(calendarMonth + 1);
      const year = String(calendarYear);
      const query = `schoolCode=${encodeURIComponent(schoolCode)}&year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;

      const [announcementRes, eventRes, meetingRes] = await Promise.all([
        fetchJson(`${API_BASE}/admin-announcements?${query}`),
        fetchJson(`${API_BASE}/admin-events?${query}`),
        fetchJson(`${API_BASE}/admin-meetings?${query}`),
      ]);

      setAnnouncements(Array.isArray(announcementRes.data) ? announcementRes.data : []);
      setEvents(Array.isArray(eventRes.data) ? eventRes.data : []);
      setMeetings(Array.isArray(meetingRes.data) ? meetingRes.data : []);
    } catch (error) {
      setPopupMessage(error.message || "Failed to load admin records.");
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    loadAdminRecords();
  }, [calendarMonth, calendarYear, schoolCode]);

  useEffect(() => {
    if (!schoolCode) return;

    const loadLiveChatMeta = async () => {
      try {
        const [{ data: staffData }, { data: classData }, { data: studentsData }] = await Promise.all([
          axios.get(`${API_BASE}/party1`, { params: { schoolCode } }),
          axios.get(`${API_BASE}/classes`, { params: { schoolCode } }),
          axios.get(`${API_BASE}/students-details`, { params: { schoolCode } }).catch(() => ({ data: [] })),
        ]);

        setParty1List(Array.isArray(staffData) ? staffData : []);
        const normalizedClasses = normalizeClassCollection(classData);
        const fallbackStudentClasses = normalizeClassCollection(studentsData);
        setClassOptions((normalizedClasses.length > 0 ? normalizedClasses : fallbackStudentClasses).sort(compareClassValues));
      } catch (error) {
        console.error("Failed to load live chat meta", error);
      }
    };

    loadLiveChatMeta();
  }, [schoolCode]);

  useEffect(() => {
    if (!schoolCode || !liveChatForm.className) {
      setSectionOptions([]);
      setStudentOptions([]);
      setSelectedCardStudent("");
      return;
    }

    axios
      .get(`${API_BASE}/sections/${encodeURIComponent(liveChatForm.className)}`, {
        params: { schoolCode },
      })
      .then((res) => {
        setSectionOptions(normalizeArrayResponse(res.data));
        setSelectedCardStudent("");
        setLiveChatForm((prev) => ({ ...prev, section: "", student: "" }));
      })
      .catch((error) => {
        console.error("Failed to load sections", error);
        setSectionOptions([]);
      });
  }, [liveChatForm.className, schoolCode]);

  useEffect(() => {
    if (!schoolCode || !liveChatForm.className || !liveChatForm.section) {
      setStudentOptions([]);
      setSelectedCardStudent("");
      return;
    }

    axios
      .get(`${API_BASE}/admin/students/${encodeURIComponent(liveChatForm.className)}/${encodeURIComponent(liveChatForm.section)}`, {
        params: { schoolCode },
      })
      .then((res) => {
        setStudentOptions(normalizeArrayResponse(res.data));
        setSelectedCardStudent("");
        setLiveChatForm((prev) => ({ ...prev, student: "" }));
      })
      .catch((error) => {
        console.error("Failed to load students", error);
        setStudentOptions([]);
      });
  }, [liveChatForm.className, liveChatForm.section, schoolCode]);

  const loadChatRequests = async () => {
    if (!schoolCode) return;
    setChatLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/chat-requests`, {
        params: { schoolCode },
      });
      setChatRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load chat requests", error);
      setChatRequests([]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    loadChatRequests();
  }, [schoolCode]);

  useEffect(() => {
    if (!schoolCode) return;

    const fetchStoreActions = async () => {
      setStoreActionsLoading(true);
      setStoreActionsError("");
      try {
        const res = await fetch(`${API_BASE}/po/requests?schoolCode=${encodeURIComponent(schoolCode)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStoreActions(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
      } catch (error) {
        console.error("Failed to load store actions", error);
        setStoreActionsError("Failed to load store actions.");
        setStoreActions([]);
      } finally {
        setStoreActionsLoading(false);
      }
    };

    fetchStoreActions();
  }, [schoolCode]);

  const openAnnouncementPopup = (day) => {
    const selectedDate = buildDateValue(day) || announcementForm.announcementDate;
    setAnnouncementForm((prev) => ({
      ...prev,
      announcementDate: selectedDate,
    }));
    setPopupType("announcement");
  };

  const openEventPopup = (day) => {
    const selectedDate = buildDateValue(day) || eventForm.eventDate;
    setEventForm((prev) => ({
      ...prev,
      eventDate: selectedDate,
    }));
    setEventMeetingTab("event");
    setPopupType("eventMeeting");
  };

  const openMeetingPopup = (day) => {
    const selectedDate = buildDateValue(day) || meetingForm.meetingDate;
    setMeetingForm((prev) => ({
      ...prev,
      meetingDate: selectedDate,
    }));
    setEventMeetingTab("meeting");
    setPopupType("eventMeeting");
  };

  const closePopup = () => setPopupType("");

  const openLiveChatPopup = () => setPopupType("liveChat");

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.announcementDate) {
      setPopupMessage("Announcement title and date are required.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchJson(`${API_BASE}/admin-announcements`, {
        method: "POST",
        body: JSON.stringify({
          schoolCode,
          ...announcementForm,
        }),
      });

      setPopupMessage("Announcement saved successfully.");
      setAnnouncementForm((prev) => ({
        ...prev,
        title: "",
        description: "",
      }));
      closePopup();
      await loadAdminRecords();
    } catch (error) {
      setPopupMessage(error.message || "Failed to save announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventForm.eventName.trim() || !eventForm.eventDate) {
      setPopupMessage("Event name and date are required.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchJson(`${API_BASE}/admin-events`, {
        method: "POST",
        body: JSON.stringify({
          schoolCode,
          ...eventForm,
        }),
      });

      setPopupMessage("Event saved successfully.");
      setEventForm((prev) => ({
        ...prev,
        eventName: "",
        eventTime: "",
        description: "",
      }));
      closePopup();
      await loadAdminRecords();
    } catch (error) {
      setPopupMessage(error.message || "Failed to save event.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateMeeting = async () => {
    if (!meetingForm.meetingTitle.trim() || !meetingForm.meetingDate) {
      setPopupMessage("Meeting title and date are required.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchJson(`${API_BASE}/admin-meetings`, {
        method: "POST",
        body: JSON.stringify({
          schoolCode,
          ...meetingForm,
        }),
      });

      setPopupMessage("Meeting saved successfully.");
      setMeetingForm((prev) => ({
        ...prev,
        meetingTitle: "",
        meetingTime: "",
        agenda: "",
        description: "",
      }));
      closePopup();
      await loadAdminRecords();
    } catch (error) {
      setPopupMessage(error.message || "Failed to save meeting.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLiveChatRequest = async () => {
    const { party1, className, section, student, date, time } = liveChatForm;

    if (!party1 || !className || !section || !student) {
      setPopupMessage("Staff, class, section, and student are required.");
      return;
    }

    const party1Obj = party1List.find((item) => item.name === party1);
    if (!party1Obj) {
      setPopupMessage("Please select a valid staff member.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_BASE}/chat-request`, {
        party1_id: party1Obj.id,
        party1_name: party1Obj.name,
        party2_class: className,
        party2_section: section,
        party2_student: student,
        date,
        time,
        schoolCode,
      });

      if (!data?.success) {
        throw new Error(data?.message || "Failed to save chat request.");
      }

      setPopupMessage("Individual chat request has been successfully saved.");
      setSelectedCardStaff(party1);
      setSelectedCardStudent(student);
      setLiveChatForm({
        party1: "",
        className,
        section,
        student: "",
        date: new Date().toISOString().split("T")[0],
        time: "",
      });
      closePopup();
      await loadChatRequests();
    } catch (error) {
      console.error("Failed to save chat request", error);
      setPopupMessage(error?.response?.data?.message || error.message || "Failed to save chat request.");
    } finally {
      setSubmitting(false);
    }
  };

  const getCardHTML = async (student, side) => {
    const url = buildIdCardPreviewUrl(selectedIdCardTemplate, student, schoolName, schoolLogo, localStorage.getItem("schoolAddress") || "");
    
    try {
      const response = await fetch(url);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return doc.body.innerHTML;
    } catch (error) {
      console.warn("Could not fetch template HTML, using fallback. Ensure same-origin or CORS is enabled.", error);
      return `
        <div style="width: 350px; height: 220px; border: 2px solid #333; border-radius: 10px; padding: 15px; box-sizing: border-box; background: #fff; font-family: Arial, sans-serif;">
          <h3 style="margin: 0 0 10px 0; color: #2c3e50; text-align: center;">${schoolName}</h3>
          <p style="margin: 5px 0; font-size: 14px;"><strong>Name:</strong> ${student.name}</p>
          <p style="margin: 5px 0; font-size: 14px;"><strong>Class:</strong> ${student.class_name || 'N/A'} - ${student.section || 'N/A'}</p>
          <p style="margin: 5px 0; font-size: 14px;"><strong>Side:</strong> ${side.toUpperCase()}</p>
        </div>
      `;
    }
  };


// 🔥 Helper: Auto-scale content to fit within card boundaries
const fitContentToCard = (element, maxWidth, maxHeight) => {
  const naturalWidth = element.scrollWidth;
  const naturalHeight = element.scrollHeight;

  const scaleX = maxWidth / naturalWidth;
  const scaleY = maxHeight / naturalHeight;
  const scale = Math.min(scaleX, scaleY, 1);

  if (scale < 1) {
    element.style.transform = `scale(${scale})`;
    element.style.transformOrigin = 'top left';
    element.style.width = `${naturalWidth}px`;
    element.style.height = `${naturalHeight}px`;
  }
};

const applyTeacherIdCardLabels = (doc) => {
  if (!doc?.defaultView?.location) return;
  const params = new URLSearchParams(doc.defaultView.location.search || "");
  const isTeacher = /^(true|1|teacher)$/i.test(
    params.get("isTeacher") || params.get("cardType") || params.get("userType") || ""
  );
  if (!isTeacher) return;

  const replacements = [
    [/\bClass\s*Name\b/gi, params.get("classLabel") || "Designation"],
    [/\bClass\b/gi, params.get("classLabel") || "Designation"],
    [/\bSec(?:tion)?\b/gi, params.get("sectionLabel") || "Department"],
    [/\bRoll\s*No\.?\b/gi, params.get("rollLabel") || "Employee ID"],
    [/\bRoll\b/gi, params.get("rollLabel") || "Employee ID"],
    [/\bAdmission\s*No\.?\b/gi, "Employee ID"],
    [/\bFather(?:'s)?\s*Name\b/gi, params.get("parentLabel") || "Subject"],
    [/\bFather\b/gi, params.get("parentLabel") || "Subject"],
    [/\bParent\b/gi, params.get("parentLabel") || "Subject"],
    [/\bGuardian\b/gi, params.get("parentLabel") || "Subject"],
    [/\bRoute\b/gi, params.get("routeLabel") || "Department"],
    [/\bStudent\b/gi, "Teacher"],
  ];

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentTag = node.parentElement?.tagName?.toLowerCase();
      return parentTag === "script" || parentTag === "style" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    let value = node.nodeValue || "";
    replacements.forEach(([pattern, replacement]) => {
      value = value.replace(pattern, replacement);
    });
    node.nodeValue = value;
  });

  doc.querySelectorAll("[data-photo]").forEach((img) => {
    img.alt = params.get("photoAlt") || "Teacher photo";
  });
};

const readIdCardStoredMedia = (doc, value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!raw.startsWith("storage:")) return raw;

  try {
    return String(doc?.defaultView?.localStorage?.getItem(raw.slice("storage:".length)) || "").trim();
  } catch {
    return "";
  }
};

// const syncIdCardPhotoBeforeCapture = (doc) => {
//   if (!doc?.defaultView?.location) return;
//   const params = new URLSearchParams(doc.defaultView.location.search || "");
//   const photo = resolveIdCardPhotoUrl(readIdCardStoredMedia(doc, params.get("photo") || params.get("studentPhoto")));
//   if (!photo) return;

//   doc.querySelectorAll("img[data-photo], img[data-student-photo]").forEach((img) => {
//     img.crossOrigin = "anonymous";
//     img.src = photo;
//     img.hidden = false;
//     img.style.width = "100%";
//     img.style.height = "100%";
//     img.style.objectFit = "cover";
//     img.style.display = "block";
//   });
// };


// const syncIdCardPhotoBeforeCapture = (doc) => {
//   if (!doc?.defaultView?.location) return;
//   const params = new URLSearchParams(doc.defaultView.location.search || "");

//   // Student / teacher photo
//   const photo = resolveIdCardPhotoUrl(readIdCardStoredMedia(doc, params.get("photo") || params.get("studentPhoto")));
//   if (photo) {
//     doc.querySelectorAll("img[data-photo], img[data-student-photo]").forEach((img) => {
//       img.crossOrigin = "anonymous";
//       img.src = photo;
//       img.hidden = false;
//       img.style.width = "100%";
//       img.style.height = "100%";
//       img.style.objectFit = "cover";
//       img.style.display = "block";
//     });
//   }

//   // 🔥 School logo — was never being resolved from its storage: reference before capture
//   const logoRaw = readIdCardStoredMedia(doc, params.get("schoolLogo") || params.get("logo"));
//   const logo = logoRaw && logoRaw.startsWith("storage:") ? "" : logoRaw; // readIdCardStoredMedia already unwraps storage:, this is just a safety net
//   if (logo) {
//     doc.querySelectorAll("img[data-logo], img[data-school-logo], .school-logo img, img.school-logo").forEach((img) => {
//       img.crossOrigin = "anonymous";
//       img.src = logo;
//       img.hidden = false;
//       img.style.display = "block";
//     });
//   }
// };

const syncIdCardPhotoBeforeCapture = (doc) => {
  if (!doc?.defaultView?.location) return;
  const params = new URLSearchParams(doc.defaultView.location.search || "");

  // Resolve every <img> whose src literally starts with "storage:" — this works
  // for BOTH the student/teacher photo and the school logo, regardless of what
  // class/attribute the template markup happens to use for each image.
  const storageImages = Array.from(doc.querySelectorAll("img")).filter((img) => {
    const rawSrc = img.getAttribute("src") || "";
    return rawSrc.trim().startsWith("storage:");
  });

  storageImages.forEach((img) => {
    const rawSrc = img.getAttribute("src") || "";
    const resolved = readIdCardStoredMedia(doc, rawSrc);
    if (!resolved) return;

    // Photos should be run through resolveIdCardPhotoUrl (handles hex/relative paths);
    // the logo is already a clean data: URL / http URL, so use it as-is.
    const isPhotoLike = rawSrc.includes("_student_photo_") || rawSrc.includes("_teacher_photo_");
    const finalSrc = isPhotoLike ? resolveIdCardPhotoUrl(resolved) : resolved;
    if (!finalSrc) return;

    img.crossOrigin = "anonymous";
    img.src = finalSrc;
    img.hidden = false;
    img.style.display = "block";
  });

  // Fallback: also handle the explicit data-photo / data-student-photo markers
  // in case the template doesn't put the raw storage: string directly in src.
  const photo = resolveIdCardPhotoUrl(readIdCardStoredMedia(doc, params.get("photo") || params.get("studentPhoto")));
  if (photo) {
    doc.querySelectorAll("img[data-photo], img[data-student-photo]").forEach((img) => {
      img.crossOrigin = "anonymous";
      img.src = photo;
      img.hidden = false;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.display = "block";
    });
  }
};

const waitForIdCardImages = async (doc) => {
  const images = Array.from(doc?.images || []).filter((img) => img.src && !img.hidden);
  await Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          if (typeof img.decode === "function") {
            img.decode().then(done).catch(done);
          }
          setTimeout(done, 2500);
        })
    )
  );
};

const renderCardFromPreviewUrl = async (student, side, buildPreviewUrl = buildIdCardPreviewUrl) => {
  const previewUrl = buildPreviewUrl(
    selectedIdCardTemplate,
    student,
    schoolName,
    schoolLogo,
    localStorage.getItem("schoolAddress") || ""
  );

  const finalUrl = previewUrl.includes('?')
    ? `${previewUrl}&side=${side}`
    : `${previewUrl}?side=${side}`;

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '340px';
    iframe.style.height = '540px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.overflow = 'hidden';
    iframe.style.visibility = 'hidden';
    iframe.src = finalUrl;
    document.body.appendChild(iframe);

    const cleanup = () => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };

    iframe.onload = async () => {
      try {
        // Wait for content to fully render
        await new Promise(r => setTimeout(r, 1500));

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (!iframeDoc || !iframeDoc.body) {
          throw new Error("Could not access iframe content");
        }

        applyTeacherIdCardLabels(iframeDoc);
        syncIdCardPhotoBeforeCapture(iframeDoc);
        await waitForIdCardImages(iframeDoc);

        const cardElement = iframeDoc.body;

        // 🔥 INJECT CSS to prevent overflow and ensure exact dimensions
        const style = iframeDoc.createElement('style');
        style.innerHTML = `
          * {
            box-sizing: border-box !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 340px !important;
            height: 540px !important;
            overflow: hidden !important;
            max-width: 340px !important;
            max-height: 540px !important;
          }
          body > * {
            max-width: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }
          img:not([data-photo]):not([data-student-photo]) {
            max-width: 100% !important;
            height: auto !important;
            object-fit: cover !important;
          }
          img[data-photo], img[data-student-photo] {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block !important;
          }
          p, div, span, h1, h2, h3, h4, h5, h6, table, tr, td {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            max-width: 100% !important;
          }
          ::-webkit-scrollbar {
            display: none !important;
          }
        `;
        iframeDoc.head.appendChild(style);

        // 🔥 Force body to exact card dimensions
        cardElement.style.width = '340px';
        cardElement.style.height = '540px';
        cardElement.style.overflow = 'hidden';
        cardElement.style.margin = '0';
        cardElement.style.padding = '0';
        cardElement.style.position = 'relative';

        // Wait for styles to apply
        await new Promise(r => setTimeout(r, 500));

        // 🔥 Auto-scale if content overflows
        const cardWrapper = cardElement.firstElementChild || cardElement;
        fitContentToCard(cardWrapper, 340, 540);

        await waitForIdCardImages(iframeDoc);

        // Wait for transform to apply
        await new Promise(r => setTimeout(r, 300));

        const scale = idCardImageQuality === 'high' ? 3 : 2;

        // 🔥 Capture with html2canvas - FIXED dimensions
        const canvas = await html2canvas(cardElement, {
          scale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          width: 340,
          height: 540,
          windowWidth: 340,
          windowHeight: 540,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
        });

        // 🔥 Verify canvas dimensions
        console.log('Canvas dimensions:', canvas.width, canvas.height);
        console.log('Expected ratio:', 340/540, 'Actual ratio:', canvas.width/canvas.height);

        cleanup();
        resolve(canvas);
      } catch (error) {
        console.error("Render error:", error);
        cleanup();
        reject(error);
      }
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("Failed to load preview iframe"));
    };

    // Timeout fallback (20 seconds)
    setTimeout(() => {
      cleanup();
      reject(new Error("Preview iframe timeout - took too long to load"));
    }, 20000);
  });
};
const exportPdfAsZip = async (canvases, config) => {
  const { fileName } = config;
  const zip = new JSZip();
  const folder = zip.folder(fileName);

  // Group canvases by student
  const studentGroups = {};
  canvases.forEach(({ student, side, canvas }) => {
    const studentId = student?.id || student?.student_id || student?.admission_no || student?.name || 'unknown';
    if (!studentGroups[studentId]) {
      studentGroups[studentId] = { student, sides: [] };
    }
    studentGroups[studentId].sides.push({ side, canvas });
  });

  // Create individual PDF for each student
  let index = 1;
  for (const [studentId, { student, sides }] of Object.entries(studentGroups)) {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Add each side (front/back) as a page
    sides.forEach(({ canvas }, i) => {
      if (i > 0) pdf.addPage();
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate dimensions maintaining aspect ratio
      const cardAspectRatio = canvas.width / canvas.height;
      const maxWidth = 80;
      const maxHeight = 120;
      
      let imgWidth, imgHeight;
      if (maxWidth / maxHeight > cardAspectRatio) {
        imgHeight = maxHeight;
        imgWidth = maxHeight * cardAspectRatio;
      } else {
        imgWidth = maxWidth;
        imgHeight = maxWidth / cardAspectRatio;
      }
      
      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;
      
      pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
    });

    // Generate filename
    const studentName = student?.name || student?.student_name || student?.studentName || "Student";
    const className = student?.class_name || student?.class || student?.className || "-";
    const section = student?.section || student?.section_name || student?.sectionName || "-";

    const safeName = `${studentName}_${className}_${section}`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '');

    // Save PDF as blob and add to ZIP
    const pdfBlob = pdf.output('blob');
    folder.file(`${safeName}.pdf`, pdfBlob);
    
    index++;
  }

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${fileName}.zip`);
};
const exportAsPdf = async (canvases, config) => {
  const { paperSize, pdfLayout, printOptions, fileName } = config;

  // 🔥 Set page dimensions
  let pageWidth = 210, pageHeight = 297;
  if (paperSize === 'letter') { pageWidth = 215.9; pageHeight = 279.4; }
  if (paperSize === 'legal') { pageWidth = 215.9; pageHeight = 355.6; }

  // 🔥 Determine grid layout
  let cols = 1, rows = 1;
  if (pdfLayout === 2) { cols = 2; rows = 1; }
  else if (pdfLayout === 4) { cols = 2; rows = 2; }
  else if (pdfLayout === 8) { cols = 4; rows = 2; }
  else if (pdfLayout === 10) { cols = 5; rows = 2; }
  else if (pdfLayout === 12) { cols = 4; rows = 3; }

  const pdf = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight]
  });

  // 🔥 Calculate cell dimensions
  const margin = 5;
  const cardGap = 3;
  const cellWidth = (pageWidth - (margin * 2) - (cardGap * (cols - 1))) / cols;
  const cellHeight = (pageHeight - (margin * 2) - (cardGap * (rows - 1))) / rows;

  // 🔥 FIXED: Calculate card dimensions maintaining 340:540 aspect ratio
  const cardAspectRatio = 340 / 540; // 0.6296
  const cellAspect = cellWidth / cellHeight;

  let cardWidth, cardHeight;

  // 🔥 Fit card inside cell while maintaining aspect ratio
  if (cellAspect > cardAspectRatio) {
    // Cell is wider than card ratio - fit to height
    cardHeight = cellHeight;
    cardWidth = cellHeight * cardAspectRatio;
  } else {
    // Cell is taller than card ratio - fit to width
    cardWidth = cellWidth;
    cardHeight = cellWidth / cardAspectRatio;
  }

  console.log('Cell dimensions:', cellWidth, 'x', cellHeight);
  console.log('Card dimensions:', cardWidth, 'x', cardHeight);
  console.log('Card aspect ratio:', cardWidth/cardHeight);

  let currentCol = 0;
  let currentRow = 0;

  for (let i = 0; i < canvases.length; i++) {
    const { canvas } = canvases[i];
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // 🔥 Add new page if needed
    if (i > 0 && currentCol === 0 && currentRow === 0) {
      pdf.addPage();
    }

    // 🔥 Calculate cell position
    const cellX = margin + (currentCol * (cellWidth + cardGap));
    const cellY = margin + (currentRow * (cellHeight + cardGap));

    // 🔥 FIXED: Center card inside cell (not stretch!)
    const cardX = cellX + (cellWidth - cardWidth) / 2;
    const cardY = cellY + (cellHeight - cardHeight) / 2;

    // 🔥 Add the card image with CORRECT dimensions
    pdf.addImage(imgData, 'JPEG', cardX, cardY, cardWidth, cardHeight);

    // 🔥 Draw cut guidelines if enabled
    if (printOptions.cutGuidelines) {
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.1);
      pdf.setLineDashPattern([1, 1], 0);
      pdf.rect(cellX, cellY, cellWidth, cellHeight);
      pdf.setLineDashPattern([], 0);
    }

    // 🔥 Draw crop marks if enabled
    if (printOptions.cropMarks) {
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);
      const markLen = 3;

      // Top-left
      pdf.line(cardX - markLen, cardY, cardX - 0.5, cardY);
      pdf.line(cardX, cardY - markLen, cardX, cardY - 0.5);
      // Top-right
      pdf.line(cardX + cardWidth + 0.5, cardY, cardX + cardWidth + markLen, cardY);
      pdf.line(cardX + cardWidth, cardY - markLen, cardX + cardWidth, cardY - 0.5);
      // Bottom-left
      pdf.line(cardX - markLen, cardY + cardHeight, cardX - 0.5, cardY + cardHeight);
      pdf.line(cardX, cardY + cardHeight + 0.5, cardX, cardY + cardHeight + markLen);
      // Bottom-right
      pdf.line(cardX + cardWidth + 0.5, cardY + cardHeight, cardX + cardWidth + markLen, cardY + cardHeight);
      pdf.line(cardX + cardWidth, cardY + cardHeight + 0.5, cardX + cardWidth, cardY + cardHeight + markLen);
    }

    // 🔥 Advance grid position
    currentCol++;
    if (currentCol >= cols) {
      currentCol = 0;
      currentRow++;
      if (currentRow >= rows) {
        currentRow = 0;
      }
    }
  }

  // 🔥 Add page numbers if enabled
  if (printOptions.pageNumbers) {
    const totalPages = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(9);
      pdf.setTextColor(150);
      pdf.text(
        `Page ${p} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 3,
        { align: 'center' }
      );
    }
  }

  pdf.save(`${fileName}.pdf`);
};
const exportAsImages = async (canvases, config) => {
  const { fileFormat, downloadType, fileName } = config;
  const mimeType = fileFormat === 'png' ? 'image/png' : 'image/jpeg';
  const extension = fileFormat === 'png' ? 'png' : 'jpg';

  // Single image download
  if (downloadType === 'single-image' && canvases.length === 1) {
    const link = document.createElement('a');
    link.download = `${fileName}.${extension}`;
    link.href = canvases[0].canvas.toDataURL(mimeType, 0.95);
    link.click();
    return;
  }

  // Single PDF (all cards in one PDF)
  if (downloadType === 'single-pdf' && !fileFormat.startsWith('pdf')) {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    for (let i = 0; i < canvases.length; i++) {
      const { canvas, student, side } = canvases[i];
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      if (i > 0) pdf.addPage();
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = 80;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;
      
      pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
    }

    pdf.save(`${fileName}.pdf`);
    return;
  }

  // ZIP download
  const zip = new JSZip();
  const folder = zip.folder(fileName);

  for (let i = 0; i < canvases.length; i++) {
    const { canvas, student, side } = canvases[i];
    const dataUrl = canvas.toDataURL(mimeType, 0.95);
    const base64Data = dataUrl.split(',')[1];

    const studentName = student?.name || student?.student_name || student?.studentName || "Student";
    const className = student?.class_name || student?.class || student?.className || "-";
    const section = student?.section || student?.section_name || student?.sectionName || "-";

    const safeName = `${studentName}_${className}_${section}_front`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '');

    folder.file(`${safeName}.${extension}`, base64Data, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${fileName}.zip`);
};

// 🔥 Add this ref at the top of your component (with other refs)
const isExecutingRef = useRef(false);

const handleExecuteIdCardDownload = async () => {
  if (isExecutingRef.current) {
    console.warn("⚠️ Download already in progress, ignoring duplicate call");
    return;
  }
  isExecutingRef.current = true;

  const isPdf = idCardFileFormat === 'pdf-print' || idCardFileFormat === 'pdf-standard';

  if (idCardRangeStudents.length === 0) {
    alert("No students selected.");
    isExecutingRef.current = false;
    return;
  }

  setDownloadProgress({ active: true, current: 0, total: 0, message: "Starting..." });

  try {
    const exportConfig = {
      students: idCardRangeStudents,
      templateId: selectedIdCardTemplate,
      schoolName,
      schoolLogo,
      schoolAddress: localStorage.getItem("schoolAddress") || "",
      fileFormat: idCardFileFormat,
      downloadType: idCardDownloadType,
      pdfLayout: isPdf ? idCardPdfLayout : null,
      cardSide: 'front', // 🔥 FRONT ONLY
      paperSize: idCardPaperSize,
      imageQuality: idCardImageQuality,
      printOptions: {
        cropMarks: idCardShowCropMarks,
        cutGuidelines: idCardShowCutGuidelines,
        pageNumbers: idCardAddPageNumbers,
      },
      fileName: idCardFileName || 'IDCards_Export',
    };

    // 🔥 Render ONLY FRONT side
    const sidesToRender = ['front'];
    const totalCards = idCardRangeStudents.length * sidesToRender.length;

    console.log('📊 Rendering sides:', sidesToRender);
    console.log('📊 Students count:', idCardRangeStudents.length);
    console.log('📊 Total cards expected:', totalCards);

    setDownloadProgress({
      active: true,
      current: 0,
      total: totalCards,
      message: `Rendering ${totalCards} ID cards (front only)...`
    });

    const canvases = [];
    let processedCount = 0;
    let failedCount = 0;

    // 🔥 Render each student's card (FRONT ONLY)
    for (const student of idCardRangeStudents) {
      for (const side of sidesToRender) {
        try {
          console.log(`🎨 Rendering: ${student?.name} (${side})`);
          const canvas = await renderCardFromPreviewUrl(student, side);
          canvases.push({ student, side, canvas });
          console.log(`✅ Rendered: ${student?.name} (${side})`);
        } catch (error) {
          console.error(`❌ Failed to render ${student?.name} (${side}):`, error);
          failedCount++;
        }

        processedCount++;
        setDownloadProgress({
          active: true,
          current: processedCount,
          total: totalCards,
          message: `Rendering ${processedCount} of ${totalCards}...`
        });
      }
    }

    console.log('📊 Final canvases count:', canvases.length);

    if (canvases.length === 0) {
      setDownloadProgress({ active: false });
      alert("❌ Failed to generate any ID cards. Please try again.");
      isExecutingRef.current = false;
      return;
    }

    setDownloadProgress({
      active: true,
      current: totalCards,
      total: totalCards,
      message: "Exporting file..."
    });

    // 🔥 No need for deduplication (only 1 side)
if (isPdf && exportConfig.downloadType === 'zip') {
  // 🔥 PDF + Individual Files (ZIP) - Create ZIP with individual PDFs
  await exportPdfAsZip(canvases, exportConfig);
} else if (isPdf) {
  // 🔥 PDF + Single PDF - Create single PDF with grid layout
  await exportAsPdf(canvases, exportConfig);
} else {
  // 🔥 PNG/JPEG - Export as images
  await exportAsImages(canvases, exportConfig);
}

    setDownloadProgress({ active: false });
    setDownloadIdCardPopupOpen(false);


const successMsg = failedCount > 0
  ? `⚠️ Exported ${canvases.length} cards (${failedCount} failed)\n${idCardRangeStudents.length} students × 2 sides (front + back)`
  : `✅ Export Successful!\n${idCardRangeStudents.length} students × 2 sides = ${canvases.length} cards (front + back)`;

// 🔥 Add format info
let formatInfo = '';
if (isPdf && exportConfig.downloadType === 'zip') {
  formatInfo = `\nFormat: PDF (Individual files in ZIP)`;
} else if (isPdf) {
  formatInfo = `\nFormat: PDF (Single file)`;
} else if (exportConfig.downloadType === 'zip') {
  formatInfo = `\nFormat: ${exportConfig.fileFormat.toUpperCase()} (ZIP archive)`;
} else {
  formatInfo = `\nFormat: ${exportConfig.fileFormat.toUpperCase()}`;
}

alert(`${successMsg}${formatInfo}`);

  } catch (error) {
    console.error("Export failed:", error);
    setDownloadProgress({ active: false });
    alert("❌ Failed to generate ID cards.\nError: " + error.message);
  } finally {
    isExecutingRef.current = false;
  }
};
  const renderHistoryItem = (label, secondary, tertiary) => (
    <div className="admin-events-history-item" key={`${label}-${secondary}-${tertiary}`}>
      <strong>{label}</strong>
      <span>{secondary}</span>
      {tertiary ? <small>{tertiary}</small> : null}
    </div>
  );

  return (
    <div className="dashboard-page dashboard-home-page frontdesk-dashboard-page accountant-dashboard-page accountant-dashboard-home-page admin-events-page">
      <div className="dashboard-shell accountant-dashboard-shell">
        <aside className="dashboard-sidebar accountant-sidebar-strip">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`dashboard-sidebar-item accountant-sidebar-item ${item.key === "communication" ? "dashboard-sidebar-item-active accountant-sidebar-item-active" : ""}`}
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
                  className={`dashboard-topbar-tab accountant-topbar-tab ${activeTopTab === tab ? "dashboard-topbar-tab-active accountant-topbar-tab-active" : ""}`}
                >
                  <button
                    className="accountant-topbar-tab-button"
                    type="button"
                    onClick={() => {
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
              <button className="accountant-branch-btn" type="button" onClick={() => navigate("/HrDashboard")}>
                Switch to HR <span className="accountant-branch-caret">▼</span>
              </button>
                     <button
                   className="accountant-help-icon-btn"
                   onClick={() => setIsHelpOpen(true)}
                 >
                 <FiHelpCircle
                 style={{
                   color: "#e9818c",
                   fontSize: "34px"
                 }}
               />
                 </button>
              <EditableProfileMenu showHrSwitch />
            </div>
          </div>

          <div className="admin-events-content">
            <div className="admin-events-top">
               <div className="accountant-welcome-block">
                <h2>Hi, {getUserDisplayName()}!</h2>
                <p>Check Store Inventory,</p>
                <p>Report Track to Class Teacher</p>
                <p>Submit Building maintenance</p>
                <CompactTextTabs
                  activePath={location.pathname}
                  onNavigate={navigate}
                  tabs={[
                    { path: "/AdminGenerations", label: "Reports" },
                    { path: "/AdmissionTimetableNew", label: "Timetable" },
                    // { path: "/AdminQuestionPaper", label: "QP" },
                  ]}
                />
              </div>
         {/* NEW DYNAMIC CARD */}
<div className="admin-events-task accountant-card">
  <div className="taskCardContent">
    <TaskOfTheDay />
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

            <div className="admin-events-middle">
              {renderGenerationCard("Generations – Report Card", "reportCard")}
              {renderGenerationCard("Generations – ID Card", "idCard")}

              <div className="admin-events-livechat accountant-card">
                <div className="admin-events-card-header">
                  <h3>
                    {activeQuickPanel === "assistant"
                      ? "Assistant Actions"
                      : activeQuickPanel === "storepo"
                        ? "Store PO"
                        : "Live Chat"}
                  </h3>
                  <div className="accountant-card-filters">
                    {activeQuickPanel === "livechat" ? (
                      <button type="button" className="admin-events-create-btn" onClick={openLiveChatPopup}>+ Create New</button>
                    ) : null}
                    <div className="accountant-feetype-count">
                      <strong>
                        {activeQuickPanel === "assistant"
                          ? assistantPanelItems.length
                          : activeQuickPanel === "storepo"
                            ? storeActions.length
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
                </div>
                {activeQuickPanel === "assistant" ? (
                  <div className="admin-events-chat-section">
                    {assistantPanelItems.map((item) => (
                      <div key={item.title} className="admin-events-assistant-item">
                        <strong>{item.title}</strong>
                        <span>{item.desc}</span>
                      </div>
                    ))}
                  </div>
                ) : activeQuickPanel === "storepo" ? (
                  <div className="admin-events-chat-section">
                    <small>Requests PO</small>
                    {storeActionsLoading ? (
                      <div className="admin-events-chat-item"><span>Loading...</span></div>
                    ) : storeActionsError ? (
                      <div className="admin-events-chat-item"><span>{storeActionsError}</span></div>
                    ) : storeActions.length === 0 ? (
                      <div className="admin-events-chat-item"><span>No PO requests found.</span></div>
                    ) : (
                      storeActions.map((item, index) => (
                        <div key={item.id || item.po_id || index} className="admin-events-chat-item">
                          <span>
                            {item.text ||
                              `${item.id ? `PO${item.id} - ` : ""}${item.date || item.created_at || ""}, ${item.stockName || item.stock_name || "Stock"}${item.quantity ? ` ${item.quantity}` : ""}`}
                          </span>
                          <div className="admin-events-chat-actions">
                            <button type="button">▷</button>
                            <button type="button">✕</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <>
                    <div className="admin-events-chat-section">
                      <small>Requests</small>
                      {chatLoading ? (
                        <div className="admin-events-chat-item"><span>Loading...</span></div>
                      ) : requestItems.length === 0 ? (
                        <div className="admin-events-chat-item"><span>No requests found.</span></div>
                      ) : (
                        requestItems.map((item) => (
                          <div key={item.id} className="admin-events-chat-item">
                            <span>
                              Live Chat (P - T) - {formatChatDateTime(item.date, item.time)} - {item.party1_name || "Staff"} to {item.party2_student || "Student"}, {item.party2_class || "-"}{item.party2_section ? item.party2_section : ""}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="admin-events-chat-section">
                      <small>Scheduled</small>
                      {scheduledItems.length === 0 ? (
                        scheduled.map((item) => (
                          <div key={item} className="admin-events-chat-item">
                            <span>{item}</span>
                            <div className="admin-events-chat-actions">
                              <button type="button">▷</button>
                              <button type="button">✕</button>
                            </div>
                          </div>
                        ))
                      ) : (
                        scheduledItems.map((item) => (
                          <div key={item.id} className="admin-events-chat-item">
                            <span>
                              Live Chat (T - P) - {formatChatDateTime(item.date, item.time)} - {item.party1_name || "Staff"} to {item.party2_student || "Student"}, {item.party2_class || "-"}{item.party2_section ? item.party2_section : ""}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="admin-events-bottom">
              <div className="admin-events-poster-panel accountant-card">
                <div className="admin-events-card-header">
                  <h3>Poster - Events</h3>
                  <div className="admin-events-filters">
                    <select
                      value={liveChatForm.className}
                      onChange={(e) => setLiveChatForm((prev) => ({ ...prev, className: e.target.value }))}
                    >
                      <option value="">Class & Sec</option>
                      {classOptions.map((item, index) => (
                        <option key={`${item}-${index}`} value={String(item)}>
                          {String(item)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={liveChatForm.section}
                      onChange={(e) => setLiveChatForm((prev) => ({ ...prev, section: e.target.value }))}
                      disabled={!liveChatForm.className}
                    >
                      <option value="">Section</option>
                      {sectionOptions.map((item, index) => (
                        <option key={`${item}-${index}`} value={String(item)}>
                          {String(item)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="admin-events-poster-layout">
                  <div className="admin-events-poster-student-block">
                    <div className="admin-events-poster-tabs">
                      {posterTemplateTabs.map((tab, index) => (
                        <button
                          key={tab}
                          type="button"
                          className={`admin-events-poster-tab ${posterAudienceTab === tab || (!posterAudienceTab && index === 0) ? "active" : ""}`}
                          onClick={() => setPosterAudienceTab(tab)}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="admin-events-poster-users">
                      {visiblePosterStudents.map((item, index) => (
                        <div
                          key={`${typeof item === "string" ? item : item?.id || index}`}
                          className="admin-events-user-card"
                        >
                          <div className="admin-events-user-icon"><FaUser /></div>
                          <strong>{typeof item === "string" ? item : item?.name || "Student"}</strong>
                          <span>
                            {liveChatForm.className || "7B"}, {liveChatForm.section || "C.T. T. Sriniv..."}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="admin-events-add-circle" onClick={openLiveChatPopup}>+</button>
                  </div>

                  <div className="admin-events-poster-divider">⇄</div>

                  <div className="admin-events-poster-template-block">
                    <div className="admin-events-generation-subtitle">Choose Templates</div>
                    <div className="admin-events-poster-template-tabs">
                      {posterTemplateTypes.map((tab, index) => (
                        <button
                          key={tab}
                          type="button"
                          className={`admin-events-poster-tab ${posterTemplateCategory === tab || (!posterTemplateCategory && index === 0) ? "active" : ""}`}
                          onClick={() => setPosterTemplateCategory(tab)}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="admin-events-template-row compact">
                      <button
                        type="button"
                        className="admin-events-template-nav"
                        aria-label="Previous poster template"
                        onClick={() => handleTemplateScroll("poster", "prev")}
                      >
                        <FaChevronLeft />
                      </button>
                      <div
                        className="admin-events-template-track"
                        ref={(node) => {
                          templateTrackRefs.current.poster = node;
                        }}
                      >
                        {getPosterTemplates().map((template) => (
                          <button
                            key={`poster-${template.key}`}
                            type="button"
                            className={`admin-events-template-card admin-events-poster-template-card ${template.className || ""} ${selectedPosterTemplate === template.key ? "is-selected" : ""}`}
                            aria-label={`${template.label || template.key} poster template`}
                            onClick={() => setSelectedPosterTemplate(template.key)}
                          >
                            <div className="admin-events-template-preview-shell">
                              <span className="admin-events-template-art" />
                              <span style={{ fontSize: "11px", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
                                {template.label || template.key}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="admin-events-template-nav"
                        aria-label="Next poster template"
                        onClick={() => handleTemplateScroll("poster", "next")}
                      >
                        <FaChevronRight />
                      </button>
                    </div>
                    <div className="admin-events-poster-schedule">
                      <label className="admin-events-generation-field">
                        <span>Schedule</span>
                        <input
                          className="admin-events-input"
                          type="date"
                          value={eventForm.eventDate}
                          onChange={(e) => setEventForm((prev) => ({ ...prev, eventDate: e.target.value }))}
                        />
                      </label>
                      <label className="admin-events-generation-field">
                        <span>&nbsp;</span>
                        <input
                          className="admin-events-input"
                          type="time"
                          value={eventForm.eventTime}
                          onChange={(e) => setEventForm((prev) => ({ ...prev, eventTime: e.target.value }))}
                        />
                      </label>
                      <button
                        type="button"
                        className="admin-events-generation-select-btn"
                        onClick={handleSendPosterToClassSection}
                        disabled={sendingPoster}
                      >
                        {sendingPoster ? "Sending..." : "Send Poster"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-events-side-stack">
                <div className="admin-events-metrics">
                  <div className="admin-events-metric accountant-card">
                    <div className="admin-events-ring">{performance.overallPercentage || 0}%</div>
                    <h4>Performance</h4>
                    <span>Students Track</span>
                  </div>
                  <div className="admin-events-metric accountant-card">
                    <strong>8</strong>
                    <small>abs. / 12 avl.</small>
                    <h4>Substitute</h4>
                    <span>8 teachers absent today</span>
                  </div>
                </div>

                <div className="admin-events-footer accountant-card">
                  {footerCards.map((item) => (
                    <div key={`${item.meta}-${item.title}`} className="admin-events-footer-item">
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
      </div>

      {popupType === "announcement" && (
        <div className="admin-events-modal-overlay" onClick={closePopup}>
          <div className="admin-events-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-events-card-header">
              <h3>Create Announcement</h3>
              <button type="button" className="admin-events-modal-close" onClick={closePopup}>×</button>
            </div>
            <div className="admin-events-form-grid">
              <input
                className="admin-events-input"
                type="text"
                placeholder="Announcement title"
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, title: e.target.value }))}
              />
              <select
                className="admin-events-input"
                value={announcementForm.category}
                onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, category: e.target.value }))}
              >
                <option value="General">General</option>
                <option value="Academic">Academic</option>
                <option value="Holiday">Holiday</option>
                <option value="Emergency">Emergency</option>
              </select>
              <input
                className="admin-events-input"
                type="date"
                value={announcementForm.announcementDate}
                onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, announcementDate: e.target.value }))}
              />
              <textarea
                className="admin-events-input admin-events-textarea"
                placeholder="Description"
                value={announcementForm.description}
                onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="admin-events-action-row">
              <button type="button" className="admin-events-submit-btn" onClick={handleCreateAnnouncement} disabled={submitting}>
                {submitting ? "Saving..." : "Create Announcement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {popupType === "eventMeeting" && (
        <div className="admin-events-modal-overlay" onClick={closePopup}>
          <div className="admin-events-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-events-card-header">
              <h3>Create {eventMeetingTab === "event" ? "Event" : "Meeting"}</h3>
              <button type="button" className="admin-events-modal-close" onClick={closePopup}>×</button>
            </div>
            <div className="admin-events-popup-tabs">
              <button
                type="button"
                className={`admin-events-popup-tab ${eventMeetingTab === "event" ? "active" : ""}`}
                onClick={() => setEventMeetingTab("event")}
              >
                Events
              </button>
              <button
                type="button"
                className={`admin-events-popup-tab ${eventMeetingTab === "meeting" ? "active" : ""}`}
                onClick={() => setEventMeetingTab("meeting")}
              >
                Meetings
              </button>
            </div>

            {eventMeetingTab === "event" ? (
              <div className="admin-events-form-grid">
                <input
                  className="admin-events-input"
                  type="text"
                  placeholder="Event name"
                  value={eventForm.eventName}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, eventName: e.target.value }))}
                />
                <select
                  className="admin-events-input"
                  value={eventForm.eventType}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, eventType: e.target.value }))}
                >
                  <option value="General">General</option>
                  <option value="Celebration">Celebration</option>
                  <option value="Competition">Competition</option>
                  <option value="Exam">Exam</option>
                </select>
                <input
                  className="admin-events-input"
                  type="date"
                  value={eventForm.eventDate}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, eventDate: e.target.value }))}
                />
                <input
                  className="admin-events-input"
                  type="time"
                  value={eventForm.eventTime}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, eventTime: e.target.value }))}
                />
                <textarea
                  className="admin-events-input admin-events-textarea"
                  placeholder="Event description"
                  value={eventForm.description}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            ) : (
              <div className="admin-events-form-grid">
                <input
                  className="admin-events-input"
                  type="text"
                  placeholder="Meeting title"
                  value={meetingForm.meetingTitle}
                  onChange={(e) => setMeetingForm((prev) => ({ ...prev, meetingTitle: e.target.value }))}
                />
                <input
                  className="admin-events-input"
                  type="date"
                  value={meetingForm.meetingDate}
                  onChange={(e) => setMeetingForm((prev) => ({ ...prev, meetingDate: e.target.value }))}
                />
                <input
                  className="admin-events-input"
                  type="time"
                  value={meetingForm.meetingTime}
                  onChange={(e) => setMeetingForm((prev) => ({ ...prev, meetingTime: e.target.value }))}
                />
                <input
                  className="admin-events-input"
                  type="text"
                  placeholder="Agenda"
                  value={meetingForm.agenda}
                  onChange={(e) => setMeetingForm((prev) => ({ ...prev, agenda: e.target.value }))}
                />
                <textarea
                  className="admin-events-input admin-events-textarea"
                  placeholder="Meeting description"
                  value={meetingForm.description}
                  onChange={(e) => setMeetingForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            )}
            <div className="admin-events-action-row">
              <button
                type="button"
                className="admin-events-submit-btn"
                onClick={eventMeetingTab === "event" ? handleCreateEvent : handleCreateMeeting}
                disabled={submitting}
              >
                {submitting ? "Saving..." : eventMeetingTab === "event" ? "Create Event" : "Create Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}

      {popupType === "liveChat" && (
        <div className="admin-events-modal-overlay" onClick={closePopup}>
          <div className="admin-events-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-events-card-header">
              <h3>Individual Chat Request</h3>
              <button type="button" className="admin-events-modal-close" onClick={closePopup}>×</button>
            </div>
            <div className="admin-events-form-grid">
              <select
                className="admin-events-input"
                value={liveChatForm.party1}
                onChange={(e) => setLiveChatForm((prev) => ({ ...prev, party1: e.target.value }))}
              >
                <option value="">Party 1 Staff</option>
                {party1List.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name} ({item.user_type})
                  </option>
                ))}
              </select>
              <select
                className="admin-events-input"
                value={liveChatForm.className}
                onChange={(e) => setLiveChatForm((prev) => ({ ...prev, className: e.target.value }))}
              >
                <option value="">Class</option>
                {classOptions.map((item, index) => (
                  <option key={`${item}-${index}`} value={String(item)}>
                    {String(item)}
                  </option>
                ))}
              </select>
              <select
                className="admin-events-input"
                value={liveChatForm.section}
                onChange={(e) => setLiveChatForm((prev) => ({ ...prev, section: e.target.value }))}
                disabled={!liveChatForm.className}
              >
                <option value="">Section</option>
                {sectionOptions.map((item, index) => (
                  <option key={`${item}-${index}`} value={String(item)}>
                    {String(item)}
                  </option>
                ))}
              </select>
              <select
                className="admin-events-input"
                value={liveChatForm.student}
                onChange={(e) => setLiveChatForm((prev) => ({ ...prev, student: e.target.value }))}
                disabled={!liveChatForm.className || !liveChatForm.section}
              >
                <option value="">Student</option>
                {studentOptions.map((item, index) => (
                  <option key={`${item?.id || index}`} value={item?.name || item?.student_name || ""}>
                    {item?.name || item?.student_name || "Student"}
                  </option>
                ))}
              </select>
              <input
                className="admin-events-input"
                type="date"
                value={liveChatForm.date}
                onChange={(e) => setLiveChatForm((prev) => ({ ...prev, date: e.target.value }))}
              />
              <input
                className="admin-events-input"
                type="time"
                value={liveChatForm.time}
                onChange={(e) => setLiveChatForm((prev) => ({ ...prev, time: e.target.value }))}
              />
            </div>
            <div className="admin-events-action-row">
              <button type="button" className="admin-events-submit-btn" onClick={handleCreateLiveChatRequest}>
                Create Chat Request
              </button>
            </div>
          </div>
        </div>
      )}

      {templatePreviewState.open && (
        <div className="admin-events-modal-overlay" onClick={closeTemplatePreview}>
          <div className="admin-events-report-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-events-card-header">
              <h3>
                {templatePreviewState.kind === "reportCard"
                  ? "Report Card Template Preview"
                  : "ID Card Template Preview"}
              </h3>
              <div className="admin-events-chat-meta">
                <button
                  type="button"
                  className="admin-events-generation-select-btn"
                  onClick={handleConfirmTemplatePreview}
                >
                  OK
                </button>
                <button
                  type="button"
                  className="admin-events-modal-close"
                  onClick={closeTemplatePreview}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="admin-events-empty-state" style={{ marginBottom: "0.6rem" }}>
              {templatePreviewState.templateLabel}
            </div>
            <div className="admin-events-academic-preview-frame-wrap">
              <iframe
                title={`${templatePreviewState.templateLabel || "Template"} full preview`}
                src={
                  templatePreviewState.kind === "reportCard"
                    ? import.meta.env.BASE_URL + `reports/${normalizeReportTemplateName(templatePreviewState.templateId)}`
                    : import.meta.env.BASE_URL + `idcards/${normalizeIdCardTemplateName(templatePreviewState.templateId)}`
                }
                className="admin-events-academic-preview-frame"
              />
            </div>
          </div>
        </div>
      )}

      {allReportsPopupOpen && (
        <div className="admin-events-modal-overlay" onClick={() => setAllReportsPopupOpen(false)}>
          <div className="admin-events-report-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-events-card-header">
              <h3>All Student Report Cards</h3>
              <button
                type="button"
                className="admin-events-modal-close"
                onClick={() => setAllReportsPopupOpen(false)}
              >
                ×
              </button>
            </div>
            {reportRangeLoading ? (
              <div className="admin-events-empty-state">Loading student reports...</div>
            ) : reportRangeError ? (
              <div className="admin-events-empty-state">{reportRangeError}</div>
            ) : reportRangeStudents.length === 0 ? (
              <div className="admin-events-empty-state">No students found for the selected class range.</div>
            ) : (
              <div className="admin-events-student-report-grid admin-events-student-report-grid-popup">
                {reportRangeStudents.map((student, index) => {
                  const name = student?.name || student?.student_name || student?.studentName || "Student";
                  const className =
                    student?.class_name || student?.class || student?.className || student?.classname || "-";
                  const section =
                    student?.section || student?.section_name || student?.sectionName || student?.sec || "-";

                  return (
                    <button
                      key={`${name}-${className}-${section}-${student?.id || index}`}
                      type="button"
                      className="admin-events-student-report-card admin-events-student-report-card-compact"
                      onClick={() => handleOpenStudentAcademicReport(student)}
                    >
                      <div className="admin-events-student-report-card-thumb">
                        <iframe
                          title={`${name} report preview`}
                          src={import.meta.env.BASE_URL + `reports/${selectedReportCardTemplate}`}
                          className="admin-events-report-template-preview"
                        />
                      </div>
                      <strong>{name}</strong>
                      <small>{`Class ${className} | Sec ${section}`}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {allIdCardsPopupOpen && (
        <div className="admin-events-modal-overlay" onClick={() => setAllIdCardsPopupOpen(false)}>
          <div className="admin-events-report-preview-modal admin-events-id-card-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-events-card-header">
              <h3>All Student ID Cards</h3>
              <div className="admin-events-chat-meta">
          <button
  type="button"
  className="admin-events-id-card-print-all-btn"
  onClick={() => setDownloadIdCardPopupOpen(true)}
  disabled={idCardRangeStudents.length === 0}
>
  Download / Print Selected Class
</button>
                <button
                  type="button"
                  className="admin-events-modal-close"
                  onClick={() => setAllIdCardsPopupOpen(false)}
                >
                  ×
                </button>
              </div>
            </div>
            {idCardRangeLoading ? (
              <div className="admin-events-empty-state">Loading student ID cards...</div>
            ) : idCardRangeError ? (
              <div className="admin-events-empty-state">{idCardRangeError}</div>
            ) : idCardRangeStudents.length === 0 ? (
              <div className="admin-events-empty-state">No students found for the selected class range.</div>
            ) : (
              <div className="admin-events-id-card-grid">
                {idCardRangeStudents.map((student, index) => {
                  const name = student?.name || student?.student_name || student?.studentName || "Student";
                  const className =
                    student?.class_name || student?.class || student?.className || student?.classname || "-";
                  const section =
                    student?.section || student?.section_name || student?.sectionName || student?.sec || "-";

                  return (
                    <div
                      key={`${name}-${className}-${section}-${student?.id || index}`}
                      className="admin-events-id-card-item"
                    >
                      <div className="admin-events-id-card-frame-wrap">
                        <iframe
                          title={`${name} ID card preview`}
                        src={buildIdCardPreviewUrl(
                          selectedIdCardTemplate,
                          student,
                          schoolName,
                          schoolLogo,
                          localStorage.getItem("schoolAddress") || ""
                        )}
                          className="admin-events-id-card-frame"
                          loading="lazy"
                        />
                      </div>
                      <strong>{name}</strong>
                      <small>{`Class ${className} | Sec ${section}`}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

 {reportPopupOpen && selectedReportStudent && (
  <div className="admin-events-modal-overlay" onClick={() => setReportPopupOpen(false)}>
    <div className="admin-events-report-preview-modal" onClick={(e) => e.stopPropagation()}>
      <div className="admin-events-card-header">
        <h3>{selectedReportStudent?.name || "Academic Report Card"}</h3>
        <div className="admin-events-chat-meta">
          {/* PDF Button */}
          <button
            type="button"
            className="admin-events-generation-select-btn"
            onClick={handleDownloadAcademicReport}
               style={{width:"100px"}}
            disabled={reportPreviewLoading}
          >
            Download PDF
          </button>
          
          {/* NEW: Image Button */}
          <button
            type="button"
            className="admin-events-generation-select-btn"
            style={{width:"100px"}}
            onClick={handleDownloadAcademicReportImage}
            disabled={reportPreviewLoading}
          >
           Download Image
          </button>

          {/* NEW: Excel Button */}
          {/* <button
            type="button"
            className="admin-events-generation-select-btn"
            onClick={handleDownloadAcademicReportExcel}
            disabled={reportPreviewLoading}
          >
            Download Excel
          </button> */}

          <button
            type="button"
            className="admin-events-modal-close"
            onClick={() => setReportPopupOpen(false)}
          >
            ×
          </button>
        </div>
      </div>
      
      {/* ... rest of your iframe code ... */}
   <div className="admin-events-academic-preview-frame-wrap">
              <iframe
                ref={reportPreviewFrameRef}
                title={`${selectedReportStudent?.name || "Student"} academic report`}
                src={import.meta.env.BASE_URL + `reports/${selectedReportCardTemplate}`}
                className="admin-events-academic-preview-frame"
                onLoad={() => {
                  if (reportPreviewFrameRef.current?.contentWindow && selectedReportPayload) {
                    reportPreviewFrameRef.current.contentWindow.postMessage(
                      { type: "REPORT_CARD_PAYLOAD", payload: selectedReportPayload },
                      window.location.origin
                    );
                    window.setTimeout(() => applyReportPreviewFit(reportPreviewFrameRef.current), 120);
                    window.setTimeout(() => applyReportPreviewFit(reportPreviewFrameRef.current), 320);
                  }
                }}
              />
            </div>
    </div>
  </div>
)}
{downloadIdCardPopupOpen && (
  <div className="admin-events-modal-overlay" onClick={() => setDownloadIdCardPopupOpen(false)}>
    <div className="admin-events-report-preview-modal admin-events-download-id-modal" onClick={(e) => e.stopPropagation()}>
      <div className="admin-events-card-header">
        <h3>Download ID Cards</h3>
        <button type="button" className="admin-events-modal-close" onClick={() => setDownloadIdCardPopupOpen(false)}>×</button>
      </div>

      <div className="admin-events-download-body">
        
        <div className="admin-events-download-section">
          <label>Selection Summary</label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
            gap: '10px', 
            marginTop: '8px' 
          }}>
            {/* 1. Total Students Card */}
            <div style={{ 
              padding: '14px', 
              // background: 'linear-gradient(135deg, #f9b1b8 0%, #f9b1b8 100%)', 
              border: '1px solid #f9b1b8', 
              borderRadius: '10px', 
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#000000' }}>
                {idCardRangeStudents.length}
              </div>
              <div style={{ fontSize: '12px', color: '#000000', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Students
              </div>
            </div>

            {/* 2. Class-wise Breakdown Cards */}
            {Object.entries(
              idCardRangeStudents.reduce((acc, student) => {
                const cls = student?.class_name || student?.class || student?.className || student?.classname || "-";
                acc[cls] = (acc[cls] || 0) + 1;
                return acc;
              }, {})
            ).map(([cls, count]) => (
              <div key={cls} style={{ 
                padding: '14px', 
                background: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '10px', 
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#334155' }}>
                  {count}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Class {cls}
                </div>
              </div>
            ))}
          </div>
        </div>

        
        <div className="admin-events-download-section">
          <label>File Format</label>
          <div className="admin-events-radio-group">
            <label><input type="radio" name="fileFormat" value="pdf-print" checked={idCardFileFormat === 'pdf-print'} onChange={e => setIdCardFileFormat(e.target.value)} /> PDF (Print Ready)</label>
            <label><input type="radio" name="fileFormat" value="pdf-standard" checked={idCardFileFormat === 'pdf-standard'} onChange={e => setIdCardFileFormat(e.target.value)} /> PDF (Standard)</label>
            <label><input type="radio" name="fileFormat" value="png" checked={idCardFileFormat === 'png'} onChange={e => setIdCardFileFormat(e.target.value)} /> PNG Images</label>
            <label><input type="radio" name="fileFormat" value="jpeg" checked={idCardFileFormat === 'jpeg'} onChange={e => setIdCardFileFormat(e.target.value)} /> JPEG Images</label>
          </div>
        </div>

        <div className="admin-events-download-section">
          <label>Download Type</label>
          <div className="admin-events-radio-group">
            <label><input type="radio" name="downloadType" value="zip" checked={idCardDownloadType === 'zip'} onChange={e => setIdCardDownloadType(e.target.value)} /> Individual Files (ZIP)</label>
            <label><input type="radio" name="downloadType" value="single-pdf" checked={idCardDownloadType === 'single-pdf'} onChange={e => setIdCardDownloadType(e.target.value)} /> Single PDF</label>
            {idCardRangeStudents.length === 1 && (
              <label><input type="radio" name="downloadType" value="single-image" checked={idCardDownloadType === 'single-image'} onChange={e => setIdCardDownloadType(e.target.value)} /> Single Image</label>
            )}
          </div>
        </div>

        {(idCardFileFormat === 'pdf-print' || idCardFileFormat === 'pdf-standard') && (
          <div className="admin-events-download-section">
            <label>PDF Layout</label>
            <select value={idCardPdfLayout} onChange={e => setIdCardPdfLayout(Number(e.target.value))}>
              <option value={1}>1 Card Per Page</option>
              <option value={2}>2 Cards Per Page</option>
              <option value={4}>4 Cards Per Page</option>
              <option value={8}>8 Cards Per A4</option>
              <option value={10}>10 Cards Per A4</option>
              <option value={12}>12 Cards Per A4</option>
            </select>
          </div>
        )}

    <div className="admin-events-download-section">
  <label>Card Sides</label>
  <div style={{
    padding: '14px 18px',
    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    border: '1px solid #93c5fd',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: '#3b82f6',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      flexShrink: 0,
    }}>
      ✓
    </div>
    <div>
      <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '14px' }}>
        Front & Back (Both Sides)
      </div>
      <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
        Each student will get 2 cards (front + back)
      </div>
    </div>
  </div>
</div>

        <div className="admin-events-download-row">
          <div className="admin-events-download-section">
            <label>Paper Size</label>
            <select value={idCardPaperSize} onChange={e => setIdCardPaperSize(e.target.value)}>
              <option value="a4">A4 (Default)</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
            </select>
          </div>
          <div className="admin-events-download-section">
            <label>Image Quality</label>
            <select value={idCardImageQuality} onChange={e => setIdCardImageQuality(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="high">High Quality (300 DPI) - Recommended</option>
            </select>
          </div>
        </div>

        <div className="admin-events-download-section">
          <label>Print Options</label>
          <div className="admin-events-checkbox-group">
            <label><input type="checkbox" checked={idCardShowCropMarks} onChange={e => setIdCardShowCropMarks(e.target.checked)} /> Show Crop Marks</label>
            <label><input type="checkbox" checked={idCardShowCutGuidelines} onChange={e => setIdCardShowCutGuidelines(e.target.checked)} /> Show Cut Guidelines</label>
            <label><input type="checkbox" checked={idCardAddPageNumbers} onChange={e => setIdCardAddPageNumbers(e.target.checked)} /> Add Page Numbers</label>
          </div>
        </div>

        <div className="admin-events-download-section">
          <label>File Name (Auto-generated)</label>
          <input 
            type="text" 
            value={idCardFileName} 
            onChange={e => setIdCardFileName(e.target.value)} 
            placeholder="IDCards_SelectedStudents"
          />
          <small style={{color: '#888', display: 'block', marginTop: '4px', fontSize: '12px'}}>
            Examples: IDCards_Class10_A, IDCards_SectionB, IDCards_EntireSchool
          </small>
        </div>

        {/* <div className="admin-events-download-note">
          <strong>Note (Print & Export Standards):</strong>
          <ul>
            <li>Generate Print Ready PDFs at 300 DPI. Embed all fonts to prevent substitution.</li>
            <li>Maintain exact physical card dimensions (use mm). Keep 5mm safe margin & 3mm bleed.</li>
            <li>Enable Crop Marks/Cut Guidelines when selected. Do not scale/stretch HTML templates.</li>
            <li>Preserve aspect ratio of photos/logos/QR codes. Export high-res images without quality loss.</li>
            <li>PNG/JPEG: Export one image per student. Auto-package into ZIP if multiple selected.</li>
            <li>PDF: Arrange cards per layout. Align Front & Back for duplex printing.</li>
            <li>Use A4/Letter/Legal without altering card dimensions. Suitable for PVC card printing.</li>
          </ul>
        </div> */}
      </div>

      <div className="admin-events-download-footer">
        <button type="button" className="admin-events-modal-cancel-btn" onClick={() => setDownloadIdCardPopupOpen(false)}>Cancel</button>
        {/* <button type="button" className="admin-events-modal-preview-btn">Preview</button>  */}
        <button type="button" className="admin-events-modal-download-btn" onClick={handleExecuteIdCardDownload}>Download</button>
      </div>
    </div>
  </div>
)}
  {
              isHelpOpen && (
                <>
                <HelpCenter
                userRole={userRole}
                openHelpSection={openHelpSection}
                    setOpenHelpSection={setOpenHelpSection}
                setIsHelpOpen={setIsHelpOpen}
                />
                </>
              )
            }
            {/* 🔥 Download Progress Overlay */}
{downloadProgress.active && (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
  }}>
    <div style={{
      background: '#fff',
      color: '#1a202c',
      padding: '40px 50px',
      borderRadius: '20px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      textAlign: 'center',
      minWidth: '360px',
    }}>
      {/* Spinning loader */}
      <div style={{
        width: '60px',
        height: '60px',
        border: '5px solid #e2e8f0',
        borderTopColor: '#003a74',
        borderRadius: '50%',
        margin: '0 auto 20px',
        animation: 'spin 1s linear infinite',
      }} />

      <h3 style={{ margin: '0 0 10px', fontSize: '20px', color: '#003a74' }}>
        Generating ID Cards
      </h3>

      <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px' }}>
        {downloadProgress.message}
      </p>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '10px',
        background: '#e2e8f0',
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '10px',
      }}>
        <div style={{
          width: `${(downloadProgress.current / downloadProgress.total) * 100}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #003a74, #667eea)',
          transition: 'width 0.3s ease',
          borderRadius: '10px',
        }} />
      </div>

      <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
        {downloadProgress.current} / {downloadProgress.total}
      </div>

      <small style={{ display: 'block', marginTop: '15px', color: '#94a3b8', fontSize: '12px' }}>
        Please don't close this window
      </small>
    </div>

    <style>{`
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
)}
      <div className="accountant-footer-brand">
        <span>Powered By:</span>
        <img src={abcLogo} alt="Cleezo Class" className="accountant-footer-logo" />
      </div>

    </div>
  );
};

export default AdminGenerations;
