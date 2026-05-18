import React, { useState, useEffect, useRef, ReactNode, CSSProperties, useMemo, useCallback } from "react";
import AdmissionReportPopup from "../shared/AdmissionReportPopup";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faAngleRight, faUser, faPlus } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import premiumIcon from "../assets/Go Premium.png";
import '../STYLES/tabhower.css';
// import "./Dashboard.css";
import "./FrontDesk.css";

import "./FrontDesk_Tickets.css"
import DashboardLayout from "../components/DashboardLayout.jsx";


// 1. IMPORT REQUIRED COMPONENTS (Ensure these also have .tsx or index.d.ts files)
import AccountantParties from "../accountant/Accountant_Parties.jsx";
import LeadsProfilePage from "./FrontDesk_LeadsProfilePage.tsx";
import AdmissionCRM from "./FrontDesk_Admission.jsx";
import TestAndCouncelling from "./FrontDesk_TestAndCouncelling.jsx";
import { EnrollmentSection } from "./FrontDesk_TestAndCouncelling.tsx";
import Communication from './Frontdesk_Communication.jsx';
import "./Frontdesk_Communication.css";
import Select, { MultiValue } from "react-select";
import ErrorPopup from "../shared/ErrorPopup";
import TaskOfTheDay from "../shared/TaskOfTheDay.tsx";
import LeadsTable from "./FrontDesk_Track.tsx";
import abcLogo from "../assets/logoab.png";
import homeIcon from "../assets/Dashboard.png";
import usersIcon from "../assets/Staff Assign.png";
import chartIcon from "../assets/Lead Profile.png";
import settingsIcon from "../assets/Enrollment.png";
import timelineIcon from "../assets/Timeline.png";
import followupIcon from "../assets/Profile.png";
import assistantIcon from "../assets/Assistant.png";
import CommunicationIcon from "../assets/Communication Assign.png";
import reportSideIcon from "../assets/Reports .png";
import formatDownloadIcon from "../assets/Format Download.png";
import { FaTrashAlt, FaUser } from "react-icons/fa";
import AdmissionEnrollment from "./FrontDesk_Enrollment.tsx";

// --- INTERFACES ---

interface DescriptionObject {
  staticText?: string;
  boxedText?: string;
  text?: string;
  isBox?: boolean;
}

interface DashboardItem {
  color: string;
  title: string;
  desc: string | DescriptionObject[];
  link: string;
  displayName?: string;
  buttonType?: "OK" | "Schedule";
}

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

interface CampaignTeacher {
  teacher_id: string | number;
  teacher_name?: string;
  name?: string;
  phone_no?: string;
  email?: string;
}

interface CampaignStudent {
  id: string | number;
  name?: string;
  photo?: { data?: any };
}

interface CampaignLead {
  id: string | number;
  full_name: string;
  student_name?: string;
  lead_name?: string;
  mobile_number: string;
  email_id?: string;
  lead_admission_for?: string;
  date: string;
  lead_time: string;
  entry_type?: string;
  reg_no?: string | number;
  refer_by?: string | null;
  assigned_teacher_id?: string | number | null;
  assigned_teacher_name?: string | null;
  teacher_decision?: string | null;
}

interface ChannelOption {
  value: string;
  label: string;
}

type GalleryScope = "digital" | "staff" | "both";
const DASHBOARD_TEMPLATE_STORAGE_PREFIX = "frontdesk-dashboard-gallery-templates";
const GALLERY_TEMPLATE_META_STORAGE_PREFIX = "campaign-gallery-template-meta";

type StaffAssignmentSummary = {
  key: string;
  teacherId: string;
  teacherName: string;
  leadIds: Array<string | number>;
  count: number;
};

const CAMPAIGN_DAILY_LEAD_LIMIT = 30;

const getLocalDateKey = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) return isoDateMatch[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseScheduleMessage = (value?: string | null) => {
  const text = String(value || "").trim();
  if (!text) return { fromDate: "", toDate: "", time: "" };

  const fromMatch = text.match(/from\s*date\s*[:\-]\s*([^|,\n]+)/i);
  const toMatch = text.match(/to\s*date\s*[:\-]\s*([^|,\n]+)/i);
  const timeMatch = text.match(/time\s*[:\-]\s*([^|,\n]+)/i);

  const fromRaw = String(fromMatch?.[1] || "").trim();
  const toRaw = String(toMatch?.[1] || "").trim();
  const timeRaw = String(timeMatch?.[1] || "").trim();

  return {
    fromDate: getLocalDateKey(fromRaw),
    toDate: getLocalDateKey(toRaw),
    time: timeRaw,
  };
};

const getStatusLeadKey = (lead: any) => String(lead?.lead_id ?? lead?.id ?? "").trim();

function normalizeGalleryScope(value: any): GalleryScope {
  const scope = String(value || "both").trim().toLowerCase();
  if (scope === "digital" || scope === "staff" || scope === "both") return scope;
  return "both";
}

function galleryScopeMatches(item: any, target: "digital" | "staff") {
  const scope = normalizeGalleryScope(item?.gallery_scope ?? item?.galleryScope ?? item?.scope);
  return scope === "both" || scope === target;
}

function getDashboardTemplateStorageKey(schoolCode: string) {
  return `${DASHBOARD_TEMPLATE_STORAGE_PREFIX}:${schoolCode || "default"}`;
}

function getGalleryTemplateMetaStorageKey(schoolCode: string) {
  return `${GALLERY_TEMPLATE_META_STORAGE_PREFIX}:${schoolCode || "default"}`;
}

function readDashboardTemplates(schoolCode: string) {
  if (!schoolCode) return [];
  try {
    const raw = localStorage.getItem(getDashboardTemplateStorageKey(schoolCode));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && (item.id || item.photoId) && item.file_path)
      .map((item) => ({
        ...item,
        id: item.id ?? item.photoId,
        photoId: item.photoId ?? item.id,
        isDashboardTemplate: true,
        gallery_scope: normalizeGalleryScope(item.gallery_scope ?? item.scope ?? "both"),
      }));
  } catch {
    return [];
  }
}

function readGalleryTemplateMetaMap(schoolCode: string): Record<string, any> {
  if (!schoolCode) return {};
  try {
    const raw = localStorage.getItem(getGalleryTemplateMetaStorageKey(schoolCode));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeGalleryTemplateMetaMap(schoolCode: string, value: Record<string, any>) {
  if (!schoolCode) return;
  localStorage.setItem(getGalleryTemplateMetaStorageKey(schoolCode), JSON.stringify(value || {}));
}

function applyGalleryTemplateMeta(items: any[], schoolCode: string) {
  const map = readGalleryTemplateMetaMap(schoolCode);
  return (Array.isArray(items) ? items : []).map((item) => {
    const itemId = String(item?.photoId ?? item?.photo_id ?? item?.id ?? "");
    if (!itemId || !map[itemId]) return item;
    const meta = map[itemId];
    return {
      ...item,
      writeup: meta?.writeup ?? item?.writeup ?? "",
      buttons: Array.isArray(meta?.buttons) ? meta.buttons : item?.buttons,
      templateType: meta?.templateType ?? item?.templateType,
      hasTemplateMeta: true,
    };
  });
}

const getTeacherKey = (t: any) => String(t?.teacher_id ?? t?.id ?? "");
const getTeacherLabel = (t: any) => String(t?.teacher_name ?? t?.name ?? "");
const getTeacherSelectionKey = (t: any) =>
  String(
    t?.phone_no ??
      t?.mobile_number ??
      t?.teacher_id ??
      t?.id ??
      t?.user_id ??
      t?.staff_id ??
      `${t?.teacher_name ?? t?.name ?? ""}|${t?.email ?? t?.email_id ?? ""}`
  ).trim();
const getCampaignGroupName = (lead: any) =>
  String(lead?.refer_by ?? lead?.lead_name ?? "").trim();
const getLeadScheduleKey = (lead: any) =>
  getCampaignGroupName(lead) || String(lead?.full_name ?? "").trim();

const normalizeCampaignStaffMember = (entry: any) => ({
  ...entry,
  teacher_id: entry?.teacher_id ?? entry?.id ?? entry?.user_id ?? entry?.staff_id ?? "",
  teacher_name: entry?.teacher_name ?? entry?.name ?? entry?.full_name ?? "Staff",
  phone_no: entry?.phone_no ?? entry?.mobile_number ?? "",
  email: entry?.email ?? entry?.email_id ?? "",
  sourceType: entry?.sourceType || (entry?.mobile_number ? "campaign" : "teacher"),
  sourceLabel: entry?.sourceLabel || (entry?.mobile_number ? "Campaign Staff" : "Teacher"),
});

const mergeCampaignStaffMembers = (...groups: any[][]) => {
  const merged = new Map<string, any>();

  groups.flat().forEach((entry) => {
    const normalized = normalizeCampaignStaffMember(entry);
    const key =
      String(normalized.phone_no || "").trim() ||
      String(normalized.teacher_id || "").trim() ||
      String(normalized.teacher_name || "").trim().toLowerCase();

    if (!key) return;
    if (!merged.has(key)) {
      merged.set(key, normalized);
      return;
    }

    const existing = merged.get(key) || {};
    merged.set(key, {
      ...existing,
      ...normalized,
      teacher_id: existing.teacher_id || normalized.teacher_id,
      teacher_name: existing.teacher_name || normalized.teacher_name,
      phone_no: existing.phone_no || normalized.phone_no,
      email: existing.email || normalized.email,
      sourceType:
        existing.sourceType === "campaign" || normalized.sourceType === "campaign"
          ? "campaign"
          : existing.sourceType || normalized.sourceType,
      sourceLabel:
        existing.sourceType === "campaign" || normalized.sourceType === "campaign"
          ? "Campaign Staff"
          : existing.sourceLabel || normalized.sourceLabel,
    });
  });

  return Array.from(merged.values());
};

const CampaignSection: React.FC<{
  title: string;
  children: React.ReactNode;
  variant?: "default" | "lead" | "marketing";
  style?: React.CSSProperties;
  className?: string;
}> = ({ title, children, variant = "default", style = {}, className = "" }) => {
  const compactVariants = ["lead", "marketing"];
  const containerClass = compactVariants.includes(variant)
    ? "sectionContainer1"
    : "sectionContainer";

  return (
    <div className={`${containerClass} ${className}`} style={style}>
      <div className="sectionTitle">{title}</div>
      {children}
    </div>
  );
};

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  onSecondaryAction?: () => void;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  onSecondaryAction,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="campaign-modal-overlay" onClick={onCancel}>
      <div className="campaign-modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="campaign-modal-header duplicate-review-header">
          <div className="duplicate-review-header-copy">
            <h4>{title}</h4>
            <p>{message}</p>
          </div>
          <button type="button" className="campaign-modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="campaign-modal-footer ">
          <button
            type="button"
            className="btn-solid1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              (onSecondaryAction || onCancel)();
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn-solid"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

type StableCommunicationAssignProps = {
  onAddClick?: () => void;
  activeTab: "staff" | "students";
  filteredStudents: CampaignStudent[];
  leads: CampaignLead[];
  classNameValue: string;
  openTicketModal: (payload: {
    type: "teacher" | "student";
    teacher?: CampaignTeacher;
    student?: CampaignStudent;
  }) => void;
  onSelectTeacher: (teacher: CampaignTeacher) => void;
};

const StableCommunicationAssign = React.memo(({
  activeTab,
  filteredStudents,
  leads,
  classNameValue,
  openTicketModal,
  onSelectTeacher
}: StableCommunicationAssignProps) => {
  const [teachers, setTeachers] = useState<CampaignTeacher[]>([]);
  const [selectedTeacherLocal, setSelectedTeacherLocal] = useState<CampaignTeacher | null>(null);
  const [commDate, setCommDate] = useState("");
  const [commTime, setCommTime] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [popupVisible, setPopupVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const channelOptions: ChannelOption[] = [
    { value: "Facebook", label: "Facebook" },
    { value: "WhatsApp", label: "WhatsApp" },
    { value: "Mail", label: "Gmail" },
    { value: "All", label: "All" },
  ];

  const schoolCodeRaw = localStorage.getItem("schoolCode") || "";
  const schoolCode =
    schoolCodeRaw &&
    schoolCodeRaw.toLowerCase() !== "null" &&
    schoolCodeRaw.toLowerCase() !== "undefined"
      ? schoolCodeRaw
      : "";


  useEffect(() => {
    console.debug("[StableCommunicationAssign] mounted");
    return () => {
      console.debug("[StableCommunicationAssign] unmounted");
    };
  }, []);

  useEffect(() => {
    console.debug("[StableCommunicationAssign] updated", {
      activeTab,
      teachersCount: teachers.length,
      filteredStudentsCount: filteredStudents.length,
      selectedTeacherLocal: selectedTeacherLocal
        ? {
            id: getTeacherSelectionKey(selectedTeacherLocal),
            name: getTeacherLabel(selectedTeacherLocal),
          }
        : null,
      classNameValue,
    });
  }, [activeTab, teachers.length, filteredStudents.length, selectedTeacherLocal, classNameValue]);

  useEffect(() => {
    if (!schoolCode) return;
    setLoadingTeachers(true);
    Promise.all([
      axios.post("https://cleezoclass.com:4000/api/users", {
        schoolCode,
        user_type: "teacher",
      }),
      axios.get(`https://cleezoclass.com:4000/api/lead-staff?schoolCode=${encodeURIComponent(schoolCode)}`),
    ])
      .then(([usersRes, campaignRes]) => {
        const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
        const campaignData = Array.isArray(campaignRes.data)
          ? campaignRes.data
          : Array.isArray(campaignRes.data?.leads)
            ? campaignRes.data.leads
            : Array.isArray(campaignRes.data?.data)
              ? campaignRes.data.data
              : [];
        setTeachers(mergeCampaignStaffMembers(usersData, campaignData));
      })
      .catch((err) => {
        console.error("Error loading teachers", err);
        setTeachers([]);
      })
      .finally(() => {
        setLoadingTeachers(false);
      });
  }, [schoolCode]);

  const teacherRows = Array.from(
    { length: Math.ceil(teachers.length / 6) },
    (_, i) => teachers.slice(i * 6, i * 6 + 6)
  );

  const teacherLeadCounts = useMemo(() => {
    const countsById = new Map<string, number>();
    const countsByName = new Map<string, number>();

    (leads || []).forEach((lead: any) => {
      const leadTeacherId =
        lead?.assigned_teacher_id ??
        lead?.teacher_id ??
        lead?.assignedTeacherId ??
        lead?.assigned_teacher ??
        null;
      const leadTeacherName =
        lead?.assigned_teacher_name ??
        lead?.teacher_name ??
        lead?.assignedTeacherName ??
        lead?.refer_by ??
        "";

      const teacherId = String(leadTeacherId ?? "").trim();
      if (teacherId) {
        countsById.set(teacherId, (countsById.get(teacherId) || 0) + 1);
      }

      const teacherNameKey = String(leadTeacherName || "").trim().toLowerCase();
      if (teacherNameKey) {
        countsByName.set(teacherNameKey, (countsByName.get(teacherNameKey) || 0) + 1);
      }
    });

    return { countsById, countsByName };
  }, [leads]);

  const getTeacherLeadCount = (teacher: CampaignTeacher) => {
    const teacherId = String(teacher?.teacher_id ?? "").trim();
    if (teacherId && teacherLeadCounts.countsById.has(teacherId)) {
      return teacherLeadCounts.countsById.get(teacherId) || 0;
    }

    const teacherNameKey = String(teacher?.teacher_name ?? teacher?.name ?? "")
      .trim()
      .toLowerCase();
    if (teacherNameKey && teacherLeadCounts.countsByName.has(teacherNameKey)) {
      return teacherLeadCounts.countsByName.get(teacherNameKey) || 0;
    }

    return 0;
  };

  const handleRegister = () => {
    const missingFields: string[] = [];

    if (!commDate) missingFields.push("communication date");
    if (!commTime) missingFields.push("communication time");
    if (channels.length === 0) missingFields.push("at least one communication channel");
    if (!selectedTeacherLocal) missingFields.push("a teacher");

    if (missingFields.length > 0) {
      setErrorMsg(`Kindly select ${missingFields.join(", ")}`);
      return;
    }

    try {
      const schedule: any[] = [];
      const startDate = new Date(`${commDate}T${commTime}`);

      for (let i = 0; i < 30; i++) {
        const sendDate = new Date(startDate);
        sendDate.setDate(startDate.getDate() + i);

        schedule.push({
          teacherId: getTeacherKey(selectedTeacherLocal),
          teacherName: getTeacherLabel(selectedTeacherLocal),
          phone: selectedTeacherLocal?.phone_no,
          email: selectedTeacherLocal?.email,
          date: sendDate.toISOString().split("T")[0],
          time: sendDate.toTimeString().split(" ")[0],
          channels,
          message: "Your daily advertisement",
          schoolCode,
        });
      }

      axios
        .post("https://cleezoclass.com:4000/api/schedule-messages", {
          schedule,
          schoolCode,
        })
        .then(() => {
          setErrorMsg("Scheduled for 30 days successfully");
          setPopupVisible(false);
        })
        .catch(() => {
          setErrorMsg("Failed to schedule messages");
        });
    } catch (error) {
      console.error(error);
      setErrorMsg("Something went wrong");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setPopupVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="co-section-container">
      <div className="co-wrapper">
        <div className="tc-staffAssignSection">
          <div className="tc-staffHeader">
            <div className="Heading">Campaigning{"\n"}Staff - Assign </div>
          </div>
          <CampaignSection title="" variant="marketing" className="campaignSection">

            <div className="tickets-content1">
              {activeTab === "staff" && (
                <div className="tc-staffAssignSection">
                  {loadingTeachers && <p>Loading teachers...</p>}

                  {!loadingTeachers && (
                    <div className="tc-teacherGrid">
                      {teacherRows.map((row, idx) => (
                        <div key={idx} className="tc-teacherRow">
                          {row.map((teacher) => (
                            <div
                              key={getTeacherSelectionKey(teacher)}
                              className={`tc-teacherCard tickets-clickable ${
                                selectedTeacherLocal &&
                                getTeacherSelectionKey(selectedTeacherLocal) === getTeacherSelectionKey(teacher)
                                  ? "is-selected"
                                  : ""
                              }`}
                              onClick={() => {
                                onSelectTeacher(teacher);
                                setSelectedTeacherLocal(teacher);
                              }}
                            >
                              <div
                                className="tc-teacherAvatar"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectTeacher(teacher);
                                  setSelectedTeacherLocal(teacher);
                                }}
                              >
                                <FaUser size={30} color="#919191ff" />
                              </div>
                              <div className="tc-teacherName">
                                {teacher.teacher_name || teacher.name}
                              </div>
                              <div
                                className="tc-teacherLeadCount"
                                style={{ fontSize: "12px", color: "#666", marginTop: 2 }}
                              >
                                {getTeacherLeadCount(teacher)}{" "}
                                {getTeacherLeadCount(teacher) === 1 ? "Lead" : "Leads"}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "students" && (
                <div className="payment-student-list-panel tickets-student-panel">
                  <div className="tickets-student-grid">
                    {filteredStudents.length === 0 ? (
                      <div className="payment-no-students">
                        {classNameValue ? "No students found" : "Please select a class and section"}
                      </div>
                    ) : (
                      filteredStudents.map((student) => (
                        <div
                          key={student.id}
                          className="tickets-student-card tickets-clickable"
                          onClick={() => openTicketModal({ type: "student", student })}
                        >
                          {student.photo?.data ? (
                            <img
                              src={`https://cleezoclass.com:4000${bufferToPathString(student.photo.data)}`}
                              alt={student.name}
                              className="tickets-student-photo"
                            />
                          ) : (
                            <div className="tickets-student-photo-placeholder">
                              <FaUser size={20} color="#404040" />
                            </div>
                          )}
                          <span className="tickets-student-name">{student.name}</span>
                          <span className="tickets-student-id">ID: {student.id}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </CampaignSection>
        </div>
      </div>

      {errorMsg && (
        <div className="error-popup">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg("")}>Close</button>
        </div>
      )}

      {selectedTeacherLocal && popupVisible && (
        <div className="co-popup" ref={popupRef}>
          <div className="co-popup-title">{getTeacherLabel(selectedTeacherLocal)}</div>

          <div className="co-popup-datetime">
            <input type="date" value={commDate} onChange={(e) => setCommDate(e.target.value)} />
            <input type="time" value={commTime} onChange={(e) => setCommTime(e.target.value)} />
          </div>

          <Select
            isMulti
            options={channelOptions}
            onChange={(selected: MultiValue<ChannelOption>) =>
              setChannels(selected.map((s) => s.value))
            }
          />

          <button type="button" onClick={handleRegister} className="co-popup-btn">
            Register
          </button>
        </div>
      )}
    </div>
  );
});

type StableCommunicationAssignSectionProps = {
  leads: CampaignLead[];
  selectedLead: CampaignLead | null;
  onSelectLead: (lead: CampaignLead) => void;
  onAddClick?: () => void;
  onDigitalScheduleChange?: (schedule: {
    fromDate?: string;
    toDate?: string;
    time?: string;
    leadNames?: string[];
  }) => void;
  leadNameCounts: Array<{ name: string; count: number; date: string }>;
  galleryTarget?: "digital" | "staff";
  title?: string;
  autoImageDisabled?: boolean;
  onAutoImageDisabledChange?: (disabled: boolean) => void;
};

const StableCommunicationAssignSection = React.memo(({
  leads,
  selectedLead,
  onDigitalScheduleChange,
  leadNameCounts,
  galleryTarget = "digital",
  title,
  autoImageDisabled = false,
  onAutoImageDisabledChange
}: StableCommunicationAssignSectionProps) => {
  const [commDate, setCommDate] = useState<string>("");
  const [commTime, setCommTime] = useState<string>("");
  const [channels, setChannels] = useState<string[]>([]);
  const [popupVisible, setPopupVisible] = useState<boolean>(false);
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterRegNo, setFilterRegNo] = useState<string>("");
  const popupRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryUploaded, setGalleryUploaded] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const [galleryName, setGalleryName] = useState("");
  const [uploadScopeModalOpen, setUploadScopeModalOpen] = useState(false);
  const [pendingUploadScope, setPendingUploadScope] = useState<GalleryScope>(galleryTarget);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAfterPickRef = useRef(false);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [deleteGalleryLoading, setDeleteGalleryLoading] = useState(false);
  const [galleryDeleteConfirmOpen, setGalleryDeleteConfirmOpen] = useState(false);
  const [autoImageConfirmOpen, setAutoImageConfirmOpen] = useState(false);
  const [autoImageConfirmMode, setAutoImageConfirmMode] = useState<"enable" | "disable" | null>(null);
  const [disabledGalleryIds, setDisabledGalleryIds] = useState<Array<string | number>>([]);
  const [galleryDisableConfirmOpen, setGalleryDisableConfirmOpen] = useState(false);
  const [galleryDisableConfirmMode, setGalleryDisableConfirmMode] = useState<"enable" | "disable" | null>(null);
  const [selectedGallery, setSelectedGallery] = useState<any>(null);
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<Array<string | number>>([]);
  const [templateUploadLoading, setTemplateUploadLoading] = useState(false);
  const [sendFromDate, setSendFromDate] = useState("");
  const [sendToDate, setSendToDate] = useState("");
  const [sendFromTime, setSendFromTime] = useState("");
  const [sendToTime, setSendToTime] = useState("");
  const [sendAt, setSendAt] = useState("");
  const [sendMode, setSendMode] = useState<"single" | "all" | "auto">("single");
  const [sendLeadNames, setSendLeadNames] = useState<string[]>([]);
  const [sendLeadIds, setSendLeadIds] = useState<Array<string | number>>([]);
  const [selectedStaffKeys, setSelectedStaffKeys] = useState<string[]>([]);
  const [sendLeadFrom, setSendLeadFrom] = useState("");
  const [sendLeadTo, setSendLeadTo] = useState("");
  const [sendLeadRangeByName, setSendLeadRangeByName] = useState<Record<string, { from: string; to: string }>>({});
  const [leadSearchTerm, setLeadSearchTerm] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [sendError, setSendError] = useState("");
  const whatsappLeadGapMinutes = 3;
  const staffBulkListRef = useRef<HTMLDivElement | null>(null);
  const leadBulkListRef = useRef<HTMLDivElement | null>(null);
  const [showStaffScrollHint, setShowStaffScrollHint] = useState(false);
  const [showLeadScrollHint, setShowLeadScrollHint] = useState(false);
  const [staffListAtBottom, setStaffListAtBottom] = useState(false);
  const [leadListAtBottom, setLeadListAtBottom] = useState(false);
  const resetGalleryModal = () => {
    setGalleryModalOpen(false);
    setSelectedGallery(null);
    setSelectedGalleryIds([]);
    setSelectedStaffKeys([]);
    setSendMode("single");
    setSendStatus("");
    setSendError("");
    setSendLeadNames([]);
    setSendLeadIds([]);
    setSendLeadFrom("");
    setSendLeadTo("");
    setSendLeadRangeByName({});
    setLeadSearchTerm("");
  };

  useEffect(() => {
    console.debug("[StableCommunicationAssignSection] mounted");
    return () => {
      console.debug("[StableCommunicationAssignSection] unmounted");
    };
  }, []);

  useEffect(() => {
    console.debug("[StableCommunicationAssignSection] updated", {
      leadsCount: leads.length,
      selectedLeadId: selectedLead?.id ?? null,
      selectedLeadName: selectedLead?.full_name ?? null,
      galleryUploadedCount: galleryUploaded.length,
      galleryModalOpen,
      popupVisible,
    });
  }, [
    leads.length,
    selectedLead?.id,
    selectedLead?.full_name,
    galleryUploaded.length,
    galleryModalOpen,
    popupVisible,
  ]);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode") || "";
    if (!schoolCode) return;
    try {
      const saved = localStorage.getItem(`campaign-gallery-disabled:${schoolCode}`);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setDisabledGalleryIds(parsed);
      }
    } catch (err) {
      console.error("Load disabled gallery ids failed", err);
    }
  }, []);

  const persistDisabledGalleryIds = (ids: Array<string | number>) => {
    const schoolCode = localStorage.getItem("schoolCode") || "";
    if (!schoolCode) return;
    localStorage.setItem(`campaign-gallery-disabled:${schoolCode}`, JSON.stringify(ids));
  };

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;
    const localTemplates = readDashboardTemplates(schoolCode);
    fetch(
      `https://cleezoclass.com:4000/api/school-photos?schoolCode=${encodeURIComponent(schoolCode)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setGalleryUploaded(applyGalleryTemplateMeta([...localTemplates, ...data], schoolCode));
        } else {
          setGalleryUploaded(applyGalleryTemplateMeta(localTemplates, schoolCode));
        }
      })
      .catch((err) => {
        console.error("Fetch gallery failed", err);
        setGalleryUploaded(applyGalleryTemplateMeta(localTemplates, schoolCode));
      });
  }, []);

  const onChangeGalleryFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length < 1 || selected.length > 20) {
      setGalleryError("Please select 1 to 20 images or videos.");
      setGalleryFiles([]);
      e.target.value = "";
      return;
    }
    const invalid = selected.filter(
      (file) => !file.type.startsWith("image/") && !file.type.startsWith("video/")
    );
    if (invalid.length > 0) {
      setGalleryError("Only image or video files are allowed.");
      setGalleryFiles([]);
      e.target.value = "";
      return;
    }
    const maxBytes = 50 * 1024 * 1024;
    const tooLarge = selected.find((file) => file.size > maxBytes);
    if (tooLarge) {
      setGalleryError("Each file must be 50MB or smaller.");
      setGalleryFiles([]);
      e.target.value = "";
      return;
    }
    setGalleryError("");
    setGalleryFiles(selected);
    if (uploadAfterPickRef.current) {
      uploadAfterPickRef.current = false;
      setUploadScopeModalOpen(false);
      await handleGalleryUploadWithScope(pendingUploadScope, selected);
      e.target.value = "";
    }
  };

  const fetchGallery = async (): Promise<any[]> => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return [];
    const localTemplates = readDashboardTemplates(schoolCode);
    try {
      const res = await fetch(
        `https://cleezoclass.com:4000/api/school-photos?schoolCode=${encodeURIComponent(schoolCode)}`
      );
      const data = await res.json();
      if (res.ok) {
        const merged = Array.isArray(data) ? [...localTemplates, ...data] : localTemplates;
        const withMeta = applyGalleryTemplateMeta(merged, schoolCode);
        setGalleryUploaded(withMeta);
        return withMeta;
      }
      return localTemplates;
    } catch (err) {
      console.error("Fetch gallery failed", err);
      const withMeta = applyGalleryTemplateMeta(localTemplates, schoolCode);
      setGalleryUploaded(withMeta);
      return withMeta;
    }
  };

  const uploadDashboardTemplateToGallery = async (templateItem: any) => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) throw new Error("schoolCode not found");

    const rawPath = String(templateItem?.file_path || "");
    if (!rawPath || !rawPath.startsWith("data:image/")) {
      throw new Error("Template image source is invalid.");
    }

    const blobRes = await fetch(rawPath);
    const blob = await blobRes.blob();
    const safeName = String(templateItem?.file_name || `dashboard-template-${Date.now()}.png`)
      .replace(/\s+/g, "_");
    const file = new File([blob], safeName, { type: blob.type || "image/png" });
    const scope = normalizeGalleryScope(templateItem?.gallery_scope ?? templateItem?.scope ?? "both");

    const formData = new FormData();
    formData.append("schoolCode", schoolCode);
    formData.append("lead_name", String(templateItem?.lead_name || "Dashboard Template Upload"));
    formData.append("galleryScope", scope);
    formData.append("scope", scope);
    formData.append("photos", file);

    const res = await fetch(
      `https://cleezoclass.com:4000/api/school-photos?galleryScope=${encodeURIComponent(scope)}`,
      { method: "POST", body: formData }
    );
    const raw = await res.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }
    if (!res.ok) throw new Error(data?.error || data?.message || raw || "Template upload failed");

    const refreshed = await fetchGallery();
    const candidates = refreshed.filter(
      (item) =>
        !item?.isDashboardTemplate &&
        String(item?.file_name || "") === safeName &&
        galleryScopeMatches(item, galleryTarget)
    );
    if (candidates.length > 0) {
      const sorted = [...candidates].sort((a, b) => {
        const at = new Date(a?.created_at || 0).getTime();
        const bt = new Date(b?.created_at || 0).getTime();
        return bt - at;
      });
      const chosen = sorted[0];
      const chosenId = resolveGalleryId(chosen);
      if (chosenId !== null && chosenId !== undefined) {
        attachTemplateMetaToUploadedGalleryItem(chosenId, templateItem);
      }
      return applyGalleryTemplateMeta([chosen], schoolCode)[0];
    }
    const fallback =
      refreshed.find((item) => !item?.isDashboardTemplate && galleryScopeMatches(item, galleryTarget)) ||
      null;
    const fallbackId = resolveGalleryId(fallback);
    if (fallbackId !== null && fallbackId !== undefined) {
      attachTemplateMetaToUploadedGalleryItem(fallbackId, templateItem);
      return applyGalleryTemplateMeta([fallback], schoolCode)[0];
    }
    return fallback;
  };

  const handleUploadSelectedDashboardTemplate = async () => {
    if (!selectedGallery?.isDashboardTemplate) return;
    if (templateUploadLoading) return;
    setTemplateUploadLoading(true);
    try {
      setSendError("");
      setSendStatus("Uploading selected template...");
      const uploaded = await uploadDashboardTemplateToGallery(selectedGallery);
      if (!uploaded) throw new Error("Template uploaded, but unable to select it automatically.");
      const uploadedId = resolveGalleryId(uploaded);
      setSelectedGallery(uploaded);
      setSelectedGalleryIds(uploadedId !== null && uploadedId !== undefined ? [uploadedId] : []);
      setSendStatus("Template uploaded. You can schedule now.");
    } catch (err: any) {
      setSendError(err?.message || "Template upload failed");
      setSendStatus("");
    } finally {
      setTemplateUploadLoading(false);
    }
  };

  const handleGalleryUpload = async () => {
    await handleGalleryUploadWithScope(pendingUploadScope, galleryFiles);
  };

  const handleGalleryUploadWithScope = async (scope: GalleryScope, filesToUpload: File[] = galleryFiles) => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
      setGalleryError("schoolCode not found");
      return;
    }
    if (!filesToUpload.length) {
      setGalleryError("Select 1 to 20 images or videos first");
      return;
    }
    setGalleryLoading(true);
    setGalleryError("");
    const formData = new FormData();
    formData.append("schoolCode", schoolCode);
    formData.append("lead_name", galleryName.trim() || `${scope === "staff" ? "Staff" : "Digital"} Gallery Upload`);
    formData.append("galleryScope", scope);
    formData.append("scope", scope);
    filesToUpload.forEach((f) => formData.append("photos", f));
    try {
      const res = await fetch(`https://cleezoclass.com:4000/api/school-photos?galleryScope=${encodeURIComponent(scope)}`, {
        method: "POST",
        body: formData
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok) throw new Error(data?.error || data?.message || raw || "Upload failed");
      setGalleryFiles([]);
      setUploadScopeModalOpen(false);
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = "";
      }
      await fetchGallery();
    } catch (err: any) {
      setGalleryError(err.message || "Upload failed");
    } finally {
      setGalleryLoading(false);
    }
  };

  const resolveGalleryId = (item: any) => {
    if (!item) return null;
    if (typeof item === "string" || typeof item === "number") return item;
    return item.photoId ?? item.photo_id ?? item.id ?? null;
  };

  const getGalleryMediaSrc = (item: any) => {
    const rawPath = String(item?.file_path || "");
    if (!rawPath) return "";
    if (
      rawPath.startsWith("data:") ||
      rawPath.startsWith("blob:") ||
      /^https?:\/\//i.test(rawPath)
    ) {
      return rawPath;
    }
    return `https://cleezoclass.com:4000${rawPath}`;
  };

  const removeDashboardTemplateFromStorage = (photoId: string | number) => {
    const schoolCode = localStorage.getItem("schoolCode") || "";
    if (!schoolCode) return;
    const storageKey = getDashboardTemplateStorageKey(schoolCode);
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return;
      const next = parsed.filter((item) => {
        const itemId = item?.photoId ?? item?.id;
        return String(itemId) !== String(photoId);
      });
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // no-op
    }
  };

  const attachTemplateMetaToUploadedGalleryItem = (photoId: string | number, templateItem: any) => {
    const schoolCode = localStorage.getItem("schoolCode") || "";
    if (!schoolCode || photoId === null || photoId === undefined) return;
    const map = readGalleryTemplateMetaMap(schoolCode);
    map[String(photoId)] = {
      writeup: String(templateItem?.writeup || ""),
      buttons: Array.isArray(templateItem?.buttons) ? templateItem.buttons : [],
      templateType: templateItem?.templateType || "",
    };
    writeGalleryTemplateMetaMap(schoolCode, map);
  };

  const removeTemplateMetaFromGalleryItem = (photoId: string | number) => {
    const schoolCode = localStorage.getItem("schoolCode") || "";
    if (!schoolCode || photoId === null || photoId === undefined) return;
    const map = readGalleryTemplateMetaMap(schoolCode);
    delete map[String(photoId)];
    writeGalleryTemplateMetaMap(schoolCode, map);
  };

  const handleDeleteGallery = async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    const photoId = resolveGalleryId(selectedGallery);
    if (!schoolCode) {
      setGalleryError("schoolCode not found");
      return;
    }
    if (!photoId) {
      setGalleryError("Select an image first");
      return;
    }
    if (selectedGallery?.isDashboardTemplate) {
      removeDashboardTemplateFromStorage(photoId);
      setDisabledGalleryIds((prev) => {
        const next = prev.filter((id) => String(id) !== String(photoId));
        persistDisabledGalleryIds(next);
        return next;
      });
      setSelectedGallery(null);
      resetGalleryModal();
      await fetchGallery();
      return;
    }
    setDeleteGalleryLoading(true);
    try {
      const res = await fetch(
        `https://cleezoclass.com:4000/api/school-photos/${encodeURIComponent(String(photoId))}?schoolCode=${encodeURIComponent(schoolCode)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      removeTemplateMetaFromGalleryItem(photoId);
      setDisabledGalleryIds((prev) => {
        const next = prev.filter((id) => String(id) !== String(photoId));
        persistDisabledGalleryIds(next);
        return next;
      });
      setSelectedGallery(null);
      resetGalleryModal();
      await fetchGallery();
    } catch (err: any) {
      setGalleryError(err.message || "Delete failed");
    } finally {
      setDeleteGalleryLoading(false);
    }
  };

  const handleOpenGalleryModal = (item: any) => {
    setSelectedGallery(item);
    const galleryId = resolveGalleryId(item);
    setSelectedGalleryIds(galleryId !== null && galleryId !== undefined ? [galleryId] : []);
    setGalleryModalOpen(true);
    setSendMode("single");
    setSendStatus("");
    setSendError("");
  };

  const toggleGallerySelection = (item: any) => {
    const photoId = resolveGalleryId(item);
    if (photoId === null || photoId === undefined) return;
    if (isGalleryDisabled(item)) {
      setSelectedGallery(item);
      return;
    }

    setSelectedGalleryIds((prev) => {
      const exists = prev.some((id) => String(id) === String(photoId));
      if (exists) {
        const next = prev.filter((id) => String(id) !== String(photoId));
        const nextPrimaryId = next[next.length - 1];
        const nextPrimaryItem =
          visibleGalleryItems.find((galleryItem) => String(resolveGalleryId(galleryItem)) === String(nextPrimaryId)) || null;
        setSelectedGallery(nextPrimaryItem);
        return next;
      }
      setSelectedGallery(item);
      return [...prev, photoId];
    });
    setSendMode("single");
    setSendStatus("");
    setSendError("");
  };

  const isGalleryDisabled = (item: any) => {
    const photoId = resolveGalleryId(item);
    if (photoId === null || photoId === undefined) return false;
    return disabledGalleryIds.some((id) => String(id) === String(photoId));
  };

  const handleSelectAllGalleryItems = () => {
    const allIds = visibleGalleryItems
      .map((item) => resolveGalleryId(item))
      .filter((id) => !disabledGalleryIds.some((disabledId) => String(disabledId) === String(id)))
      .filter((id) => id !== null && id !== undefined) as Array<string | number>;
    setSelectedGalleryIds(allIds);
    const lastItem = [...visibleGalleryItems].reverse().find((item) => !isGalleryDisabled(item)) || null;
    setSelectedGallery(lastItem);
    setSendMode("single");
    setSendStatus("");
    setSendError("");
  };

  const handleClearGallerySelection = () => {
    setSelectedGalleryIds([]);
    setSelectedGallery(null);
    setSendStatus("");
    setSendError("");
  };

  const handleToggleSelectedGalleryDisabled = () => {
    if (!selectedGallery) return;
    const photoId = resolveGalleryId(selectedGallery);
    if (photoId === null || photoId === undefined) return;

    setDisabledGalleryIds((prev) => {
      const exists = prev.some((id) => String(id) === String(photoId));
      const next = exists
        ? prev.filter((id) => String(id) !== String(photoId))
        : [...prev, photoId];
      persistDisabledGalleryIds(next);
      if (!exists) {
        setSelectedGalleryIds((selectedPrev) =>
          selectedPrev.filter((id) => String(id) !== String(photoId))
        );
      }
      return next;
    });
  };

  const staffAssignments = useMemo<StaffAssignmentSummary[]>(() => {
    const byKey = new Map<string, StaffAssignmentSummary>();
    const isGenericCampaignName = (value: string) => {
      const normalized = String(value || "").trim().toLowerCase();
      return (
        normalized === "campaign" ||
        normalized === "campaigning" ||
        normalized === "digital campaign" ||
        normalized === "digital"
      );
    };

    leads.forEach((lead) => {
      const leadAny = lead as any;
      const teacherId = String(
        leadAny.assigned_teacher_id ??
        leadAny.teacher_id ??
        leadAny.assignedTeacherId ??
        leadAny.assigned_teacher ??
        ""
      ).trim();
      const teacherName = String(
        leadAny.assigned_teacher_name ??
        leadAny.teacher_name ??
        leadAny.assignedTeacherName ??
        leadAny.refer_by ??
        ""
      ).trim();
      const key = teacherId || teacherName.toLowerCase();
      if (!key) return;
      if (!teacherId && !teacherName) return;
      if (isGenericCampaignName(teacherName)) return;

      const current = byKey.get(key) || {
        key,
        teacherId,
        teacherName: teacherName || teacherId || "Unknown Staff",
        leadIds: [],
        count: 0,
      };

      if (lead.id !== undefined && lead.id !== null) {
        current.leadIds.push(lead.id);
        current.count += 1;
      }
      if (!current.teacherId && teacherId) current.teacherId = teacherId;
      if ((!current.teacherName || current.teacherName === "Unknown Staff") && teacherName) {
        current.teacherName = teacherName;
      }
      byKey.set(key, current);
    });

    return Array.from(byKey.values()).sort((a, b) => b.count - a.count);
  }, [leads]);

  const selectedStaffItems = useMemo(
    () => staffAssignments.filter((item) => selectedStaffKeys.includes(item.key)),
    [selectedStaffKeys, staffAssignments]
  );

  const selectedStaffLeadIds = useMemo(() => {
    const idSet = new Set<string>();
    selectedStaffItems.forEach((item) => {
      item.leadIds.forEach((leadId) => idSet.add(String(leadId)));
    });
    return Array.from(idSet);
  }, [selectedStaffItems]);

  const handleSendGallery = async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
      setSendError("schoolCode not found");
      return;
    }
    let ensuredSelectedGallery = selectedGallery;
    let ensuredSelectedGalleryIds = [...selectedGalleryIds];
    if (sendMode !== "auto" && selectedGallery?.isDashboardTemplate) {
      try {
        setSendError("");
        setSendStatus("Uploading selected template...");
        const uploaded = await uploadDashboardTemplateToGallery(selectedGallery);
        if (!uploaded) {
          setSendError("Unable to upload selected template.");
          setSendStatus("");
          return;
        }
        const uploadedId = resolveGalleryId(uploaded);
        ensuredSelectedGallery = uploaded;
        ensuredSelectedGalleryIds = uploadedId !== null && uploadedId !== undefined ? [uploadedId] : [];
        setSelectedGallery(uploaded);
        setSelectedGalleryIds(ensuredSelectedGalleryIds);
      } catch (err: any) {
        setSendError(err?.message || "Template upload failed");
        setSendStatus("");
        return;
      }
    }
    if (sendMode !== "auto" && !resolveGalleryId(ensuredSelectedGallery)) {
      setSendError("Select an image first");
      return;
    }
    if (!sendFromDate || !sendToDate) {
      setSendError("Select from date and to date");
      return;
    }
    if (sendFromDate > sendToDate) {
      setSendError("From date should be before or equal to To date");
      return;
    }
    if (sendFromDate > sendToDate) {
      setSendError("From date should be before or equal to To date");
      return;
    }
    setSendError("");
    setSendStatus("Sending...");
    let selectedDate = sendFromDate || "";
    let selectedTime = sendFromTime || "";
    if (sendAt) {
      const [atDate, atTimeRaw] = String(sendAt).split("T");
      if (atDate) selectedDate = atDate;
      if (atTimeRaw) selectedTime = atTimeRaw.slice(0, 5);
    }
    if (!selectedDate && commDate) selectedDate = commDate;
    if (!selectedTime && commTime) selectedTime = commTime;
    if (!selectedTime) {
      setSendError("Please select time");
      setSendStatus("");
      return;
    }
    if (galleryTarget === "staff") {
      if (selectedStaffItems.length < 1) {
        setSendError("Select at least one staff or choose All Assigned Leads");
        setSendStatus("");
        return;
      }
      if (!selectedStaffLeadIds.length) {
        setSendError("No leads are assigned to the selected staff selection");
        setSendStatus("");
        return;
      }
    }
    if (!selectedTime) {
      setSendError("Please select time");
      setSendStatus("");
      return;
    }
    const selectedSingleRange =
      sendLeadNames.length === 1 ? sendLeadRangeByName[sendLeadNames[0]] : undefined;
    const effectiveLeadFrom =
      selectedSingleRange?.from !== undefined ? selectedSingleRange.from : sendLeadFrom;
    const effectiveLeadTo =
      selectedSingleRange?.to !== undefined ? selectedSingleRange.to : sendLeadTo;
    const leadFromNumber = effectiveLeadFrom ? Number(effectiveLeadFrom) : null;
    const leadToNumber = effectiveLeadTo ? Number(effectiveLeadTo) : null;
    if (leadFromNumber !== null && (!Number.isInteger(leadFromNumber) || leadFromNumber < 1)) {
      setSendError("Lead From should be 1 or more");
      setSendStatus("");
      return;
    }
    if (leadToNumber !== null && (!Number.isInteger(leadToNumber) || leadToNumber < 1)) {
      setSendError("Lead To should be 1 or more");
      setSendStatus("");
      return;
    }
    if (leadFromNumber !== null && leadToNumber !== null && leadFromNumber > leadToNumber) {
      setSendError("Lead From should be less than or equal to Lead To");
      setSendStatus("");
      return;
    }
    const normalizedLeadNames = sendLeadNames.map((n) => String(n).trim().toLowerCase());
    const selectedLeadIdsFromUi = (
      galleryTarget === "staff" && selectedStaffLeadIds.length > 0
        ? selectedStaffLeadIds.map(String)
        : sendLeadIds.map(String)
    );
    const resolveSelectedLeads = () => {
      const hasNameFilter = normalizedLeadNames.length > 0;
      const hasIdFilter = selectedLeadIdsFromUi.length > 0;
      let selected = leads.filter((lead) => {
        const name = String(lead.lead_name || lead.refer_by || "").trim().toLowerCase();
        const matchesName = hasNameFilter ? normalizedLeadNames.includes(name) : true;
        const matchesId = hasIdFilter ? selectedLeadIdsFromUi.includes(String(lead.id)) : true;
        const matchesSelection = hasNameFilter && hasIdFilter ? matchesName || matchesId : matchesName && matchesId;
        return matchesSelection;
      });

      if (sendLeadNames.length > 1) {
        const ranged: CampaignLead[] = [];
        const seen = new Set<string>();
        const selectedByName = new Set(normalizedLeadNames);
        selected.forEach((lead) => {
          const name = String(lead.lead_name || lead.refer_by || "").trim().toLowerCase();
          if (!selectedByName.has(name)) {
            const key = String(lead.id);
            if (!seen.has(key)) {
              seen.add(key);
              ranged.push(lead);
            }
          }
        });
        normalizedLeadNames.forEach((nameKey) => {
          const displayName = sendLeadNames.find((n) => String(n).trim().toLowerCase() === nameKey) || "";
          const range = sendLeadRangeByName[displayName] || { from: "", to: "" };
          const fromNum = range.from ? Number(range.from) : null;
          const toNum = range.to ? Number(range.to) : null;
          const byName = selected.filter((lead) => {
            const leadName = String(lead.lead_name || lead.refer_by || "").trim().toLowerCase();
            return leadName === nameKey;
          });
          const startIdx = Math.max(((fromNum && Number.isInteger(fromNum) ? fromNum : 1) || 1) - 1, 0);
          const endIdx = toNum && Number.isInteger(toNum) ? toNum : byName.length;
          byName.slice(startIdx, endIdx).forEach((lead) => {
            const key = String(lead.id);
            if (!seen.has(key)) {
              seen.add(key);
              ranged.push(lead);
            }
          });
        });
        selected = ranged;
      } else if (leadFromNumber !== null || leadToNumber !== null) {
        const startIdx = Math.max((leadFromNumber || 1) - 1, 0);
        const endIdx = leadToNumber ? leadToNumber : selected.length;
        selected = selected.slice(startIdx, endIdx);
      }

      return selected.map((lead) => lead.id);
    };

    const resolvedLeadIds = resolveSelectedLeads();
    const isAllAssignedStaffSelected =
      galleryTarget === "staff" &&
      staffAssignments.length > 0 &&
      selectedStaffKeys.length === staffAssignments.length;

    const dailyLeadLimitNumber = CAMPAIGN_DAILY_LEAD_LIMIT;
    const whatsappLeadGapMinutes = 3;
    const addDays = (dateStr: string, days: number) => {
      const [year, month, day] = String(dateStr).split("-").map((part) => Number(part));
      const dt = new Date(year, (month || 1) - 1, day || 1);
      dt.setDate(dt.getDate() + days);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const buildPosterTextFromItem = (item: any) => {
      const writeupText = String(item?.writeup || "").trim();
      const buttonLines = Array.isArray(item?.buttons)
        ? item.buttons
            .map((btn: any) => {
              const label = String(btn?.label || "").trim();
              const url = String(btn?.url || "").trim();
              if (!label && !url) return "";
              if (label && url) return `${label}: ${url}`;
              return label || url;
            })
            .filter(Boolean)
        : [];
      return [writeupText, ...buttonLines].filter(Boolean).join("\n").trim();
    };

    const sendById = async (
      photoId: string | number,
      options?: {
        scheduleFromDate?: string | null;
        scheduleToDate?: string | null;
        leadFrom?: number | null;
        leadTo?: number | null;
        leadIdsForWriteup?: Array<string | number>;
        forcePosterText?: string | null;
      }
    ) => {
      const galleryItemForSend =
        visibleGalleryItems.find((item) => String(resolveGalleryId(item)) === String(photoId)) || null;
      const posterText =
        String(options?.forcePosterText || "").trim() ||
        buildPosterTextFromItem(galleryItemForSend);

      const res = await fetch("https://cleezoclass.com:4000/api/school-photos/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolCode,
          photoId,
          leadNames: sendLeadNames,
          fromDate: sendFromDate,
          toDate: sendToDate,
          sendAt: sendAt || null,
          sendTime: selectedTime || null,
          scheduleFromTime: sendFromTime || selectedTime || null,
          galleryTarget,
          leadIds:
            resolvedLeadIds.length > 0
              ? resolvedLeadIds
              : (galleryTarget === "staff" && selectedStaffLeadIds.length > 0
                  ? selectedStaffLeadIds
                  : sendLeadIds),
          leadFrom: options?.leadFrom ?? (resolvedLeadIds.length > 0 ? null : leadFromNumber),
          leadTo: options?.leadTo ?? (resolvedLeadIds.length > 0 ? null : leadToNumber),
          scheduleFromDate: options?.scheduleFromDate || null,
          scheduleToDate: options?.scheduleToDate || null,
          whatsappGapMinutes: whatsappLeadGapMinutes,
          posterMessage: posterText || null,
          message: posterText || null,
          caption: posterText || null,
          channels: ["whatsapp", "mail"],
          sendPoster: true,
          dynamicAllLeads: isAllAssignedStaffSelected
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Send failed");

      // Frontend fallback: if backend sends only media (without caption), schedule text separately.
      // This keeps writeup delivery working on older server versions.
      if (posterText) {
        try {
          const textLeadIds = Array.isArray(options?.leadIdsForWriteup)
            ? options!.leadIdsForWriteup!.map(String)
            : [];
          const textLeads =
            textLeadIds.length > 0
              ? leads.filter((lead) => textLeadIds.includes(String(lead.id)))
              : [];
          const scheduleDate = String(options?.scheduleFromDate || selectedDate || sendFromDate || "").trim();
          const scheduleTime = /^\d{2}:\d{2}$/.test(String(selectedTime || ""))
            ? `${selectedTime}:00`
            : String(selectedTime || "");

          if (textLeads.length > 0 && scheduleDate && scheduleTime) {
            const schedulePayload = textLeads.map((lead) => ({
              leadId: lead.id,
              leadName: lead.full_name,
              phone: lead.mobile_number || "",
              email: lead.email_id || "",
              date: scheduleDate,
              time: scheduleTime,
              channels: ["whatsapp"],
              message: posterText,
              schoolCode,
            }));
            await fetch("https://cleezoclass.com:4000/api/schedule-messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                schedule: schedulePayload,
                schoolCode,
              }),
            });
          }
        } catch (writeupErr) {
          console.warn("[Campaigning] writeup fallback scheduling failed", writeupErr);
        }
      }
      return data;
    };
    const normalizedLeadNamesForTarget = sendLeadNames.map((n) => String(n).trim().toLowerCase());
    const targetLeadsBase = leads.filter((lead) => {
      if (galleryTarget === "staff") {
        return selectedStaffLeadIds.length > 0
          ? selectedStaffLeadIds.map(String).includes(String(lead.id))
          : true;
      }
      const name = String(lead.lead_name || lead.refer_by || "").trim().toLowerCase();
      const hasNameFilter = normalizedLeadNamesForTarget.length > 0;
      const hasIdFilter = sendLeadIds.length > 0;
      const matchesName = hasNameFilter ? normalizedLeadNamesForTarget.includes(name) : true;
      const matchesId = hasIdFilter ? sendLeadIds.map(String).includes(String(lead.id)) : true;
      const matchesSelection = hasNameFilter && hasIdFilter ? matchesName || matchesId : matchesName && matchesId;
      return matchesSelection;
    });

    let targetLeads = targetLeadsBase;
    if (sendLeadNames.length > 1) {
      const ranged: CampaignLead[] = [];
      const seen = new Set<string>();
      const selectedByName = new Set(normalizedLeadNamesForTarget);
      targetLeads.forEach((lead) => {
        const name = String(lead.lead_name || lead.refer_by || "").trim().toLowerCase();
        if (!selectedByName.has(name)) {
          const key = String(lead.id);
          if (!seen.has(key)) {
            seen.add(key);
            ranged.push(lead);
          }
        }
      });
      normalizedLeadNamesForTarget.forEach((nameKey) => {
        const displayName = sendLeadNames.find((n) => String(n).trim().toLowerCase() === nameKey) || "";
        const range = sendLeadRangeByName[displayName] || { from: "", to: "" };
        const fromNum = range.from ? Number(range.from) : null;
        const toNum = range.to ? Number(range.to) : null;
        const byName = targetLeads.filter((lead) => {
          const leadName = String(lead.lead_name || lead.refer_by || "").trim().toLowerCase();
          return leadName === nameKey;
        });
        const startIdx = Math.max(((fromNum && Number.isInteger(fromNum) ? fromNum : 1) || 1) - 1, 0);
        const endIdx = toNum && Number.isInteger(toNum) ? toNum : byName.length;
        byName.slice(startIdx, endIdx).forEach((lead) => {
          const key = String(lead.id);
          if (!seen.has(key)) {
            seen.add(key);
            ranged.push(lead);
          }
        });
      });
      targetLeads = ranged;
    } else if (leadFromNumber !== null || leadToNumber !== null) {
      const startIdx = Math.max((leadFromNumber || 1) - 1, 0);
      const endIdx = leadToNumber ? leadToNumber : targetLeads.length;
      targetLeads = targetLeads.slice(startIdx, endIdx);
    }

    const totalTargetLeads = targetLeads.length;
    const selectedLeadStartIndex = Math.max((leadFromNumber || 1) - 1, 0);
    const selectedLeadEndIndex =
      leadToNumber && leadToNumber > 0
        ? Math.min(leadToNumber, selectedLeadStartIndex + totalTargetLeads)
        : selectedLeadStartIndex + totalTargetLeads;

    // Reflect chosen schedule in Bulk Upload UI immediately on Schedule click.
    // This keeps the UI in sync even if server scheduling is slow.
    if (onDigitalScheduleChange) {
      onDigitalScheduleChange({
        fromDate: sendFromDate || selectedDate,
        toDate: sendToDate || selectedDate,
        time: sendAt
          ? String(sendAt).split("T")[1] || selectedTime
          : sendFromTime
            ? `${sendFromTime}${sendToTime ? ` - ${sendToTime}` : ""}`
            : selectedTime,
        leadNames: sendLeadNames,
      });
    }

    const scheduleGallerySequence = async (photoIds: Array<string | number>) => {
      if (photoIds.length === 0) throw new Error("Select at least one image");
      if (totalTargetLeads === 0) throw new Error("No leads match filters");

      const totalLeadChunks = Math.ceil(totalTargetLeads / dailyLeadLimitNumber);
      let totalFailed = 0;

      // When one image is selected, preserve the full chosen date window.
      // The backend already knows how to schedule that one image from From Date to To Date.
      if (photoIds.length === 1 && totalLeadChunks === 1) {
        const photoId = photoIds[0];
        const itemForText =
          visibleGalleryItems.find((item) => String(resolveGalleryId(item)) === String(photoId)) ||
          (String(resolveGalleryId(ensuredSelectedGallery)) === String(photoId) ? ensuredSelectedGallery : null);
        const forcedPosterText = buildPosterTextFromItem(itemForText);
        const data = await sendById(photoId, {
          leadFrom: selectedLeadStartIndex + 1,
          leadTo: selectedLeadEndIndex,
          leadIdsForWriteup: targetLeads.map((lead) => lead.id),
          forcePosterText: forcedPosterText,
        });
        totalFailed += Number(data?.failed || 0);
        const totalDays = Number(data?.days || 0) || 1;
        setSendStatus(
          `Scheduled ${photoIds.length} image for ${totalTargetLeads} lead${totalTargetLeads === 1 ? "" : "s"} over ${totalDays} day${totalDays === 1 ? "" : "s"}.`
        );
        if (totalFailed > 0) {
          setSendError(`Failed for ${totalFailed} items`);
        }
        return;
      }

      for (let imageIndex = 0; imageIndex < photoIds.length; imageIndex += 1) {
        const photoId = photoIds[imageIndex];
        for (let chunkIndex = 0; chunkIndex < totalLeadChunks; chunkIndex += 1) {
          const relativeLeadStart = chunkIndex * dailyLeadLimitNumber;
          const absoluteLeadStart = selectedLeadStartIndex + relativeLeadStart + 1;
          const absoluteLeadEnd = Math.min(
            selectedLeadStartIndex + relativeLeadStart + dailyLeadLimitNumber,
            selectedLeadEndIndex
          );
          const dayOffset = imageIndex * totalLeadChunks + chunkIndex;
          const chunkDate = selectedDate ? addDays(selectedDate, dayOffset) : null;
          const chunkLeads = targetLeads.slice(relativeLeadStart, relativeLeadStart + dailyLeadLimitNumber);
          const chunkLeadIds = chunkLeads.map((lead) => lead.id);
          const itemForText =
            visibleGalleryItems.find((item) => String(resolveGalleryId(item)) === String(photoId)) ||
            (String(resolveGalleryId(ensuredSelectedGallery)) === String(photoId) ? ensuredSelectedGallery : null);
          const forcedPosterText = buildPosterTextFromItem(itemForText);
          const data = await sendById(photoId, {
            scheduleFromDate: chunkDate,
            scheduleToDate: chunkDate,
            leadFrom: absoluteLeadStart,
            leadTo: absoluteLeadEnd,
            leadIdsForWriteup: chunkLeadIds,
            forcePosterText: forcedPosterText,
          });
          totalFailed += Number(data?.failed || 0);
          setSendStatus(
            `Scheduled image ${imageIndex + 1} of ${photoIds.length} for leads ${absoluteLeadStart}-${absoluteLeadEnd}.`
          );
        }
      }

      const totalDays = photoIds.length * totalLeadChunks;
      setSendStatus(
        `Scheduled ${photoIds.length} images for ${totalTargetLeads} leads over ${totalDays} days in batches of ${dailyLeadLimitNumber}.`
      );
      if (totalFailed > 0) {
        setSendError(`Failed for ${totalFailed} items`);
      }
    };

    try {
      if (sendMode === "all") {
        const ids = visibleGalleryItems
          .filter((item) => !item?.isDashboardTemplate)
          .map(resolveGalleryId)
          .filter(Boolean)
          .filter((id) => !disabledGalleryIds.some((disabledId) => String(disabledId) === String(id))) as Array<string | number>;
        if (ids.length === 0) throw new Error("No uploaded gallery images available");
        await scheduleGallerySequence(ids);
      } else if (sendMode === "auto") {
        if (autoImageDisabled) throw new Error("Auto Image disabled.");
        if (targetLeads.length === 0) throw new Error("No leads match filters");
        const leadChunks = [];
        for (let i = 0; i < targetLeads.length; i += dailyLeadLimitNumber) {
          leadChunks.push(targetLeads.slice(i, i + dailyLeadLimitNumber));
        }
        let totalScheduled = 0;
        let totalSent = 0;
        let totalFailed = 0;
        for (let index = 0; index < leadChunks.length; index += 1) {
          const chunk = leadChunks[index];
          const payloadLeads = chunk.map((lead) => ({
            id: lead.id,
            full_name: lead.full_name,
            student_name: lead.student_name,
            reg_no: lead.reg_no,
            lead_admission_for: lead.lead_admission_for,
            mobile_number: lead.mobile_number,
            email_id: lead.email_id
          }));
          const chunkSendDate = selectedDate ? addDays(selectedDate, index) : null;
          const res = await fetch("https://cleezoclass.com:4000/api/posters/send-generated", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              schoolCode,
              leads: payloadLeads,
              galleryTarget,
              sendDate: chunkSendDate,
              sendTime: selectedTime || null,
              whatsappGapMinutes: whatsappLeadGapMinutes
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || "Poster send failed");
          totalScheduled += Number(data?.scheduled || 0);
          totalSent += Number(data?.sent || 0);
          totalFailed += Number(data?.failed || 0);
        }
        if (totalScheduled > 0) {
          setSendStatus(
            `Scheduled ${targetLeads.length} leads in ${leadChunks.length} day batches of ${dailyLeadLimitNumber}.`
          );
        } else {
          setSendStatus(`Sent posters to ${totalSent || targetLeads.length} leads`);
        }
        if (totalFailed > 0) {
          setSendError(`Failed for ${totalFailed} leads`);
        }
      } else {
        const chosenGalleryIds =
          ensuredSelectedGalleryIds.length > 0
            ? ensuredSelectedGalleryIds
            : resolveGalleryId(ensuredSelectedGallery)
              ? [resolveGalleryId(ensuredSelectedGallery) as string | number]
              : [];
        const activeChosenGalleryIds = chosenGalleryIds.filter(
          (id) => !disabledGalleryIds.some((disabledId) => String(disabledId) === String(id))
        );
        if (activeChosenGalleryIds.length === 0) {
          throw new Error("Select at least one image");
        }
        await scheduleGallerySequence(activeChosenGalleryIds as Array<string | number>);
      }
    } catch (err: any) {
      setSendError(err.message || "Send failed");
      setSendStatus("");
    }
  };

  const channelOptions: ChannelOption[] = [
    { value: "Facebook", label: "facebook" },
    { value: "WhatsApp", label: "Whatsapp" },
    { value: "Mail", label: "Gmail" },
    { value: "All", label: "All" },
  ];

  const handleRegister = () => {
    try {
      const missingFields = [];
      if (!commDate) missingFields.push("communication date");
      if (!commTime) missingFields.push("communication time");
      if (channels.length === 0) missingFields.push("at least one communication channel");
      if (!selectedLead) missingFields.push("a lead");

      if (missingFields.length > 0) {
        setErrorMsg(`Kindly select ${missingFields.join(", ")} to proceed.`);
        return;
      }

      const schoolCode = localStorage.getItem("schoolCode");
      const schedule: any[] = [];
      const startDate = new Date(commDate + "T" + commTime);

      for (let i = 0; i < 30; i++) {
        const sendDate = new Date(startDate);
        sendDate.setDate(startDate.getDate() + i);
        schedule.push({
          leadId: selectedLead.id,
          leadName: selectedLead.full_name,
          phone: selectedLead.mobile_number,
          email: selectedLead.email_id,
          date: sendDate.toISOString().split("T")[0],
          time: sendDate.toTimeString().split(" ")[0],
          channels,
          message: "Your daily advertisement",
          schoolCode,
        });
      }

      axios
        .post("https://cleezoclass.com:4000/api/schedule-messages", { schedule, schoolCode })
        .then(() => {
          setErrorMsg("Communication has been successfully scheduled for the next 30 days.");
          setPopupVisible(false);
        })
        .catch((err) => {
          console.error(err);
          setErrorMsg("Unable to schedule messages at this moment. Kindly try again later.");
        });
    } catch (error) {
      console.error(error);
      setErrorMsg("Something went wrong while scheduling communication. Please try again.");
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchRegNo = !filterRegNo || lead.reg_no?.toString().includes(filterRegNo);
    const matchDate = !filterDate || lead.date.split("T")[0] === filterDate;
    return matchRegNo && matchDate;
  });
  const normalizedLeadSearch = leadSearchTerm.trim().toLowerCase();
  const normalizedLeadSearchDigits = normalizedLeadSearch.replace(/\D/g, "");
  const normalizeText = (value: any) => String(value || "").trim().toLowerCase();
  const matchesLeadSearch = (lead: CampaignLead) => {
    if (!normalizedLeadSearch) return true;
    const fullName = normalizeText(lead.full_name || lead.student_name || `Lead ${lead.id}`);
    const leadSource = normalizeText(lead.lead_name || lead.refer_by || "");
    const mobile = String(lead.mobile_number || "").toLowerCase();
    const mobileDigits = mobile.replace(/\D/g, "");

    return (
      fullName.includes(normalizedLeadSearch) ||
      leadSource.includes(normalizedLeadSearch) ||
      mobile.includes(normalizedLeadSearch) ||
      (normalizedLeadSearchDigits.length > 0 && mobileDigits.includes(normalizedLeadSearchDigits))
    );
  };
  const visibleBulkLeadCounts = leadNameCounts.filter((item) => {
    if (!normalizedLeadSearch) return true;
    const itemName = normalizeText(item.name);
    if (itemName.includes(normalizedLeadSearch)) return true;

    return leads.some((lead) => {
      const leadName = normalizeText(lead.lead_name || lead.refer_by || "");
      return leadName === itemName && matchesLeadSearch(lead);
    });
  });
  const visibleStaffAssignments = staffAssignments.filter((item) =>
    !normalizedLeadSearch ? true : String(item.teacherName || "").toLowerCase().includes(normalizedLeadSearch)
  );
  const displayBulkLeadCounts = visibleBulkLeadCounts;

  const formatScheduleDateLabel = (value: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const scheduleMetaLabel = [
    sendFromDate ? `From ${formatScheduleDateLabel(sendFromDate)}` : "",
    sendToDate ? `To ${formatScheduleDateLabel(sendToDate)}` : "",
    sendAt
      ? `At ${String(sendAt).replace("T", " ")}`
      : sendFromTime
        ? `Time ${sendFromTime}${sendToTime ? ` - ${sendToTime}` : ""}`
        : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const updateModalListScrollHints = () => {
    const getState = (el: HTMLDivElement | null) => {
      if (!el) return { canScroll: false, atBottom: false };
      const canScroll = el.scrollHeight - el.clientHeight > 2;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      return { canScroll, atBottom };
    };

    const staffState = getState(staffBulkListRef.current);
    const leadState = getState(leadBulkListRef.current);

    setShowStaffScrollHint(staffState.canScroll);
    setStaffListAtBottom(staffState.atBottom);
    setShowLeadScrollHint(leadState.canScroll);
    setLeadListAtBottom(leadState.atBottom);
  };

  const handleLeadPickerWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const listEl = galleryTarget === "staff" ? staffBulkListRef.current : leadBulkListRef.current;
    if (!listEl) return;

    const canScroll = listEl.scrollHeight - listEl.clientHeight > 2;
    if (!canScroll) return;

    e.preventDefault();
    listEl.scrollTop += e.deltaY;
    updateModalListScrollHints();
  };

  useEffect(() => {
    if (!galleryModalOpen) {
      setShowStaffScrollHint(false);
      setShowLeadScrollHint(false);
      setStaffListAtBottom(false);
      setLeadListAtBottom(false);
      return;
    }

    const rafId = window.requestAnimationFrame(updateModalListScrollHints);
    window.addEventListener("resize", updateModalListScrollHints);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateModalListScrollHints);
    };
  }, [
    galleryModalOpen,
    galleryTarget,
    visibleStaffAssignments.length,
    displayBulkLeadCounts.length,
    sendLeadNames.length,
    leadSearchTerm,
    Object.keys(sendLeadRangeByName).length,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setPopupVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resolvedTitle =
    title || (galleryTarget === "digital" ? "Campaigning Digital - Gallery" : "Campaigning Staff - Gallery");
  const isVideoFile = (item: any) =>
    /\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(String(item?.file_name || item?.file_path || ""));
  const visibleGalleryItems = galleryUploaded.filter((item) => galleryScopeMatches(item, galleryTarget));

  return (
    <div className="co-section-container">
      <div className="co-wrapper">
        <div className="co-filter-row">
          <div className="Heading">{resolvedTitle}</div>
        </div>

        <div
          className={`campaign-gallery ${galleryTarget === "staff" ? "campaign-gallery-staff" : "campaign-gallery-digital"}`}
        >
          <div className="campaign-gallery-row">
            <div
              className="campaign-gallery-thumb campaign-gallery-thumb-empty"
              onClick={() => {
                setAutoImageConfirmMode(autoImageDisabled ? "enable" : "disable");
                setAutoImageConfirmOpen(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed #cbd5e1",
                background: autoImageDisabled ? "#f1f5f9" : "#f8fafc",
                color: autoImageDisabled ? "#94a3b8" : "#64748b",
                cursor: "pointer",
                fontSize:'10px',
                opacity: autoImageDisabled ? 0.65 : 1
              }}
            >
              {autoImageDisabled ? "Auto Image (Disabled)" : "Auto Image"}
            </div>
            {visibleGalleryItems
              .filter((item) => !isVideoFile(item))
              .map((item) => (
              <div
                className="campaign-gallery-thumb"
                key={item.id}
                onClick={() => handleOpenGalleryModal(item)}
              >
                {isVideoFile(item) ? (
                  <video
                    className="campaign-modal-image"
                    src={getGalleryMediaSrc(item)}
                    muted
                    playsInline
                    preload="metadata"
                    onClick={() => handleOpenGalleryModal(item)}
                  />
                ) : (
                  <img
                    src={getGalleryMediaSrc(item)}
                    alt={item.file_name}
                    onClick={() => handleOpenGalleryModal(item)}
                  />
                )}
              </div>
            ))}
          </div>
          {visibleGalleryItems.some((item) => isVideoFile(item)) && (
            <div className="campaign-gallery-video-row">
              {visibleGalleryItems
                .filter((item) => isVideoFile(item))
                .map((item) => (
                  <div
                    className="campaign-gallery-thumb"
                    key={`video-${item.id}`}
                    onClick={() => handleOpenGalleryModal(item)}
                  >
                    <video
                      className="campaign-modal-image"
                      src={getGalleryMediaSrc(item)}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  </div>
                ))}
            </div>
          )}

          <div className="campaign-gallery-controls">
            <div className="expense-input-field">
              <input
                type="text"
                className="btn-dropdown-FeesManagement"
                placeholder="Name"
                value={galleryName}
                onChange={(e) => setGalleryName(e.target.value)}
                style={{ marginTop: "20px" }}
              />
            </div>
            
            <button
              type="button"
              className="btn-solid"
              onClick={() => {
                setPendingUploadScope(galleryTarget);
                setUploadScopeModalOpen(true);
              }}
            >
              upload
            </button>
            <button
              type="button"
              className="btn-solid"
              onClick={handleGalleryUpload}
              disabled={galleryLoading}
            >
              {galleryLoading ? "Uploading..." : "Submit"}
            </button>
          </div>

          <input
            ref={galleryFileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onChangeGalleryFiles}
            style={{ display: "none" }}
          />

          {galleryError && <div className="campaign-bulk-error">{galleryError}</div>}

          {galleryFiles.length > 0 && (
            <div className="campaign-gallery-files">
              {galleryFiles.map((f) => (
                <span key={f.name + f.size}>{f.name}</span>
              ))}
            </div>
          )}
        </div>

        {uploadScopeModalOpen &&
          createPortal(
            <div className="campaign-modal-overlay" onClick={() => setUploadScopeModalOpen(false)}>
              <div className="campaign-modal" onClick={(e) => e.stopPropagation()}>
                <div className="campaign-modal-header">
                  <h4>Select Upload Scope</h4>
                  <button type="button" className="campaign-modal-close" onClick={() => setUploadScopeModalOpen(false)}>
                    ×
                  </button>
                </div>
                <div className="campaign-modal-body">
                  <div className="campaign-modal-lead-group-title">Insert image in</div>
                  <div className="campaign-modal-bulk-list campaign-modal-bulk-list-two-leads">
                    {(["digital", "staff", "both"] as GalleryScope[]).map((scope) => {
                      const isActive = pendingUploadScope === scope;
                      return (
                        <button
                          key={scope}
                          type="button"
                          className={`campaign-modal-lead-item campaign-modal-bulk-item${isActive ? " active" : ""}`}
                          onClick={() => setPendingUploadScope(scope)}
                        >
                          <span className="campaign-modal-lead-radio" />
                          <span className="campaign-modal-bulk-name">
                            {scope === "digital" ? "Digital" : scope === "staff" ? "Staff" : "Both"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="campaign-modal-footer">
                  <button
                    type="button"
                    className="btn-solid"
                    onClick={() => {
                      uploadAfterPickRef.current = true;
                      galleryFileInputRef.current?.click();
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {filteredLeads.length < 0 && null}
      </div>
      <ErrorPopup message={errorMsg} onClose={() => setErrorMsg("")} />

      <ConfirmDialog
        isOpen={galleryDeleteConfirmOpen}
        title="Delete Image"
        message="Are you sure you want to delete this selected image?"
        confirmLabel={deleteGalleryLoading ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        onCancel={() => {
          if (deleteGalleryLoading) return;
          setGalleryDeleteConfirmOpen(false);
        }}
        onConfirm={() => {
          handleDeleteGallery();
          setGalleryDeleteConfirmOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={autoImageConfirmOpen}
        title={autoImageConfirmMode === "enable" ? "Enable Auto Image" : "Auto Image"}
        message={
          autoImageConfirmMode === "enable"
            ? "Auto Image is currently disabled. Do you want to enable it?"
            : "Disable Auto Image? Click Cancel to use Auto Image now."
        }
        confirmLabel={autoImageConfirmMode === "enable" ? "Enable" : "Disable"}
        cancelLabel={autoImageConfirmMode === "enable" ? "Cancel" : "Use Auto Image"}
        onCancel={() => {
          setAutoImageConfirmOpen(false);
          setAutoImageConfirmMode(null);
        }}
        onSecondaryAction={() => {
          const shouldOpenAutoImage = autoImageConfirmMode === "disable";
          setAutoImageConfirmOpen(false);
          setAutoImageConfirmMode(null);
          if (shouldOpenAutoImage) {
            setSelectedGallery(null);
            setGalleryModalOpen(true);
            setSendMode("auto");
            setSendStatus("");
            setSendError("");
            setSendLeadNames([]);
            setSendLeadIds([]);
            setSendLeadFrom("");
            setSendLeadTo("");
          }
        }}
        onConfirm={() => {
          const nextDisabled = autoImageConfirmMode === "disable";
          onAutoImageDisabledChange?.(nextDisabled);
          setAutoImageConfirmOpen(false);
          setAutoImageConfirmMode(null);
        }}
      />

      <ConfirmDialog
        isOpen={galleryDisableConfirmOpen}
        title={galleryDisableConfirmMode === "enable" ? "Enable Image" : "Disable Image"}
        message={
          galleryDisableConfirmMode === "enable"
            ? "This image is currently disabled. Do you want to enable it?"
            : "Disable this selected image?"
        }
        confirmLabel={galleryDisableConfirmMode === "enable" ? "Enable" : "Disable"}
        cancelLabel="Cancel"
        onCancel={() => {
          setGalleryDisableConfirmOpen(false);
          setGalleryDisableConfirmMode(null);
        }}
        onConfirm={() => {
          handleToggleSelectedGalleryDisabled();
          setGalleryDisableConfirmOpen(false);
          setGalleryDisableConfirmMode(null);
        }}
      />

      {selectedLead && popupVisible && (
        <div ref={popupRef} className="co-popup">
          <div className="co-popup-title">Communications</div>
          <div className="co-popup-datetime">
            <input
              type="date"
              value={commDate}
              onChange={(e) => setCommDate(e.target.value)}
              className="co-popup-input"
            />
            <input
              type="time"
              value={commTime}
              onChange={(e) => setCommTime(e.target.value)}
              className="co-popup-input"
            />
          </div>
          <div className="co-popup-channel">
            <div className="co-popup-input">
              <Select
                isMulti
                options={channelOptions}
                onChange={(selected: MultiValue<ChannelOption>) =>
                  setChannels(selected.map((s) => s.value))
                }
              />
            </div>
            <button type="button" onClick={handleRegister} className="co-popup-btn">
              Register
            </button>
          </div>
        </div>
      )}

      {galleryModalOpen && createPortal(
        <div className="campaign-modal-overlay" onClick={resetGalleryModal}>
          <div className="campaign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="campaign-modal-header">
              <h4>Assign Gallery</h4>
              <button type="button" className="campaign-modal-close" onClick={resetGalleryModal}>
                x
              </button>
            </div>

            <div className="campaign-modal-body">
              <div className="campaign-modal-preview-inline">
                {selectedGallery ? (
                  <>
                  <div className="campaign-modal-selected-media-preview campaign-modal-selected-media-preview-top">
                    {/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(String(selectedGallery.file_name || selectedGallery.file_path || "")) ? (
                      <video
                        src={getGalleryMediaSrc(selectedGallery)}
                        muted
                        playsInline
                        controls
                      />
                    ) : (
                      <img
                        src={getGalleryMediaSrc(selectedGallery)}
                        alt={selectedGallery.file_name || "Selected poster"}
                      />
                    )}
                  </div>
                  <div className="campaign-modal-preview-actions">
                    {selectedGallery?.isDashboardTemplate && (
                      <button
                        type="button"
                        className="campaign-modal-preview-action-text"
                        onClick={handleUploadSelectedDashboardTemplate}
                        disabled={templateUploadLoading}
                      >
                        {templateUploadLoading ? "Uploading..." : "Upload Template"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="campaign-modal-preview-action-text campaign-modal-preview-action-text-delete"
                      onClick={() => setGalleryDeleteConfirmOpen(true)}
                      disabled={deleteGalleryLoading}
                    >
                      {deleteGalleryLoading ? "Deleting..." : "Delete"}
                    </button>
                    {!selectedGallery?.isDashboardTemplate && (
                      <button
                        type="button"
                        className="campaign-modal-preview-action-text"
                        onClick={() => {
                          setGalleryDisableConfirmMode(
                            isGalleryDisabled(selectedGallery) ? "enable" : "disable"
                          );
                          setGalleryDisableConfirmOpen(true);
                        }}
                      >
                        {isGalleryDisabled(selectedGallery) ? "Enable" : "Disable"}
                      </button>
                    )}
                  </div>
                  </>
                ) : (
                  <div className="campaign-modal-empty-state">Select a poster to preview or delete</div>
                )}

                <div className="campaign-modal-gallery-toolbar-top">
                  <div className="campaign-modal-gallery-toolbar-buttons">
                    <button
                      type="button"
                      className="btn-solid"
                      style={{ margin: 0, whiteSpace: "nowrap" }}
                      onClick={handleSelectAllGalleryItems}
                    >
                      Select All Images
                    </button>
                    <button
                      type="button"
                      className="btn-solid1"
                      style={{ margin: 0, whiteSpace: "nowrap" }}
                      onClick={handleClearGallerySelection}
                    >
                      Clear Selection
                    </button>
                  </div>
                  {selectedGalleryIds.length > 0 && (
                    <div className="campaign-modal-gallery-selected-count">
                      Selected images: {selectedGalleryIds.length}
                    </div>
                  )}
                </div>
              </div>

              {(String(selectedGallery?.writeup || "").trim() ||
                (Array.isArray(selectedGallery?.buttons) && selectedGallery.buttons.length > 0)) && (
                <div
                  style={{
                    marginTop: 8,
                    marginBottom: 8,
                    width: "100%",
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: 8,
                  }}
                >
                  {String(selectedGallery?.writeup || "").trim() ? (
                    <div style={{ fontSize: 13, color: "#334155", marginBottom: 8, lineHeight: 1.4 }}>
                      {String(selectedGallery.writeup)}
                    </div>
                  ) : null}
                  {Array.isArray(selectedGallery?.buttons) && selectedGallery.buttons.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {selectedGallery.buttons.map((btn: any, idx: number) => (
                        <button
                          key={`${btn?.id || btn?.label || "btn"}-${idx}`}
                          type="button"
                          className="btn-solid1"
                          style={{ margin: 0 }}
                          onClick={() => {
                            const url = String(btn?.url || "").trim();
                            if (url) window.open(url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          {String(btn?.label || "Button")}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="campaign-modal-gallery-selection-strip">
                {visibleGalleryItems.map((item) => {
                  const photoId = resolveGalleryId(item);
                  const isSelected = selectedGalleryIds.some((id) => String(id) === String(photoId));
                  return (
                    <button
                      key={`gallery-strip-${photoId}`}
                      type="button"
                      className={`campaign-modal-gallery-option-strip${isSelected ? " active" : ""}${isGalleryDisabled(item) ? " disabled" : ""}`}
                      onClick={() => toggleGallerySelection(item)}
                    >
                      {/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(String(item.file_name || item.file_path || "")) ? (
                        <video
                          src={getGalleryMediaSrc(item)}
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={getGalleryMediaSrc(item)}
                          alt={item.file_name || "Gallery item"}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="campaign-modal-row campaign-modal-row-leads">
                <div className="campaign-modal-lead-picker" onWheel={handleLeadPickerWheel}>
                  <div className="campaign-modal-lead-top-row">
                    <label className="campaign-modal-lead-top-label">
                      {galleryTarget === "staff" ? "Campaign Staff" : "Digital Leads"}
                    </label>
                    <div className="campaign-modal-lead-search-row">
                      <input
                        type="text"
                        value={leadSearchTerm}
                        onChange={(e) => setLeadSearchTerm(e.target.value)}
                        placeholder={galleryTarget === "staff" ? "Search staff" : "Search lead or mobile"}
                      />
                    </div>
                  </div>
                  {galleryTarget === "staff" ? (
                    <>
                      <div className="campaign-modal-lead-group-title">Assigned Staff</div>
                      <div
                        ref={staffBulkListRef}
                        className="campaign-modal-bulk-list campaign-modal-bulk-list-two-leads"
                        onScroll={updateModalListScrollHints}
                      >
                        {visibleStaffAssignments.length === 0 ? (
                          <div className="campaign-modal-empty-state">No assigned staff found</div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`campaign-modal-lead-item campaign-modal-bulk-item${
                                selectedStaffKeys.length === staffAssignments.length && staffAssignments.length > 0
                                  ? " active"
                                  : ""
                              }`}
                              onClick={() => {
                                const allKeys = staffAssignments.map((item) => item.key);
                                const allLeadIds = staffAssignments.flatMap((item) => item.leadIds);
                                const allNames = staffAssignments.map((item) => item.teacherName);
                                setSelectedStaffKeys(allKeys);
                                setSendLeadNames(allNames);
                                setSendLeadIds(allLeadIds);
                              }}
                            >
                              <span className="campaign-modal-lead-radio" />
                              <span className="campaign-modal-bulk-name">All Assigned Leads</span>
                              <span className="campaign-modal-bulk-meta">
                                {staffAssignments.reduce((sum, item) => sum + Number(item.count || 0), 0)} Leads
                              </span>
                            </button>
                            {visibleStaffAssignments.map((item) => {
                              const isActive = selectedStaffKeys.includes(item.key);
                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  className={`campaign-modal-lead-item campaign-modal-bulk-item${isActive ? " active" : ""}`}
                                  onClick={() => {
                                    setSelectedStaffKeys((prev) => {
                                      const exists = prev.includes(item.key);
                                      const next = exists ? prev.filter((k) => k !== item.key) : [...prev, item.key];
                                      const selectedItems = staffAssignments.filter((entry) => next.includes(entry.key));
                                      setSendLeadNames(selectedItems.map((entry) => entry.teacherName));
                                      setSendLeadIds(selectedItems.flatMap((entry) => entry.leadIds));
                                      return next;
                                    });
                                  }}
                                >
                                  <span className="campaign-modal-lead-radio" />
                                  <span className="campaign-modal-bulk-name">{item.teacherName}</span>
                                  <span className="campaign-modal-bulk-meta">{item.count} Leads</span>
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                      {showStaffScrollHint && !staffListAtBottom && (
                        <div className="campaign-bulk-scroll-hint visible campaign-modal-scroll-hint" aria-hidden="true">
                          <span className="campaign-bulk-scroll-icon">⌄</span>
                          <span>Scroll</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                  <div className="campaign-modal-lead-group-title">Leads</div>
                  <div
                    ref={leadBulkListRef}
                    className="campaign-modal-bulk-list campaign-modal-bulk-list-two-leads"
                    onScroll={updateModalListScrollHints}
                  >
                    <button
                      type="button"
                      className={`campaign-modal-lead-item campaign-modal-bulk-item${sendLeadNames.length === 0 && sendLeadIds.length === 0 ? " active" : ""}`}
                      onClick={() => {
                        setSendLeadNames([]);
                        setSendLeadIds([]);
                        setSendLeadFrom("");
                        setSendLeadTo("");
                      }}
                    >
                      <span className="campaign-modal-lead-radio" />
                      <span>All Leads</span>
                      {sendLeadNames.length === 0 && sendLeadIds.length === 0 && scheduleMetaLabel ? (
                        <span className="campaign-modal-bulk-schedule">{scheduleMetaLabel}</span>
                      ) : null}
                    </button>
                    {displayBulkLeadCounts.map((item) => {
                      const isActive = sendLeadNames.includes(item.name);
                      const range = sendLeadRangeByName[item.name] || { from: "", to: "" };
                      return (
                        <div key={item.name} className={`campaign-modal-bulk-row${isActive ? " active" : ""}`}>
                          <div className="campaign-modal-bulk-main-row">
                            <button
                              type="button"
                              className={`campaign-modal-lead-item campaign-modal-bulk-item${isActive ? " active" : ""}`}
                              onClick={() => {
                                setSendLeadNames((prev) => {
                                  const exists = prev.includes(item.name);
                                  const next = exists ? prev.filter((n) => n !== item.name) : [...prev, item.name];
                                  if (!exists && next.length === 1) {
                                    setSendLeadFrom(range.from || "");
                                    setSendLeadTo(range.to || "");
                                  }
                                  if (exists && next.length === 0) {
                                    setSendLeadFrom("");
                                    setSendLeadTo("");
                                  }
                                  return next;
                                });
                              }}
                            >
                              <span className="campaign-modal-lead-radio" />
                              <span className="campaign-modal-bulk-name">{item.name}</span>
                              <span className="campaign-modal-bulk-meta">
                                {item.date} - {item.count} Leads
                              </span>
                              {isActive && scheduleMetaLabel ? (
                                <span className="campaign-modal-bulk-schedule">{scheduleMetaLabel}</span>
                              ) : null}
                            </button>

                            {isActive && Number(item.count || 0) > 1 && (
                              <div className="campaign-modal-inline-range">
                                <input
                                  type="number"
                                  min={1}
                                  value={range.from}
                                  onChange={(e) => {
                                    const newFrom = e.target.value;
                                    setSendLeadRangeByName((prev) => ({
                                      ...prev,
                                      [item.name]: { from: newFrom, to: range.to || "" }
                                    }));
                                    if (sendLeadNames.length === 1) {
                                      setSendLeadFrom(newFrom);
                                    }
                                  }}
                                  placeholder="From"
                                />
                                <input
                                  type="number"
                                  min={1}
                                  value={range.to}
                                  onChange={(e) => {
                                    const newTo = e.target.value;
                                    setSendLeadRangeByName((prev) => ({
                                      ...prev,
                                      [item.name]: { from: range.from || "", to: newTo }
                                    }));
                                    if (sendLeadNames.length === 1) {
                                      setSendLeadTo(newTo);
                                    }
                                  }}
                                  placeholder="To"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                
                  </div>
                  {showLeadScrollHint && !leadListAtBottom && displayBulkLeadCounts.length > 1 && (
                    <div className="campaign-bulk-scroll-hint visible campaign-modal-scroll-hint" aria-hidden="true">
                      <span className="campaign-bulk-scroll-icon">⌄</span>
                      <span>Scroll</span>
                    </div>
                  )}
                    </>
                  )}
                </div>
              </div>
              <div className="campaign-modal-schedule-row">
                <div className="campaign-modal-field">
                  <label>From Date</label>
                  <input
                    type="date"
                    value={sendFromDate}
                    onChange={(e) => setSendFromDate(e.target.value)}
                  />
                </div>

                <div className="campaign-modal-field">
                  <label>To Date</label>
                  <input
                    type="date"
                    value={sendToDate}
                    onChange={(e) => setSendToDate(e.target.value)}
                  />
                </div>

                <div className="campaign-modal-field">
                  <label>Time</label>
                  <input
                    type="time"
                    value={sendFromTime}
                    onChange={(e) => setSendFromTime(e.target.value)}
                  />
                </div>

                <button type="button" className="btn-solid" onClick={handleSendGallery}>
                  Schedule
                </button>
              </div>
              {galleryTarget === "staff" && selectedStaffItems.length > 0 && (
                <div className="campaign-modal-selected-staff">
                  Selected staff: {selectedStaffItems.map((item) => item.teacherName).join(", ")} ({selectedStaffLeadIds.length} leads)
                </div>
              )}
              {galleryTarget !== "staff" && (sendMode === "all" || selectedGalleryIds.length > 1) && (
                <div className="campaign-modal-success" style={{ marginTop: 8 }}>
                  Images will be scheduled one per day, with up to 30 leads per day and 3 minutes gap per lead.
                </div>
              )}
              {sendError && <div className="campaign-modal-error">{sendError}</div>}
              {sendStatus && <div className="campaign-modal-success">{sendStatus}</div>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

const FrontDeskCampaigning: React.FC = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const font = "'Century Gothic', 'AppleGothic', sans-serif";
  const DEBUG_CAMPAIGNING = true;
  const [autoImageDisabledDigital, setAutoImageDisabledDigital] = useState(false);
  const [autoImageDisabledStaff, setAutoImageDisabledStaff] = useState(false);

  // 2. STATE FOR MODAL CONTROL
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<ReactNode | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [activeMiniPanel, setActiveMiniPanel] = useState<"timeline" | "followup" | "assistant">("timeline");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode") || "";
    if (!schoolCode) return;
    fetch(`https://cleezoclass.com:4000/api/auto-image-settings?schoolCode=${encodeURIComponent(schoolCode)}`)
      .then((res) => res.json())
      .then((data) => {
        setAutoImageDisabledDigital(Boolean(data?.digital));
        setAutoImageDisabledStaff(Boolean(data?.staff));
      })
      .catch((err) => {
        console.error("Load auto image settings failed", err);
      });
  }, []);

  const updateAutoImageSetting = (scope: "digital" | "staff", disabled: boolean) => {
    if (scope === "digital") {
      setAutoImageDisabledDigital(disabled);
    } else {
      setAutoImageDisabledStaff(disabled);
    }

    const schoolCode = localStorage.getItem("schoolCode") || "";
    if (!schoolCode) return;
    fetch("https://cleezoclass.com:4000/api/auto-image-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolCode, scope, disabled }),
    }).catch((err) => {
      console.error("Update auto image setting failed", err);
    });
  };
  // 2. STATE FOR MODAL CONTROL
 
  const [admissionRate, setAdmissionRate] = useState<number>(0);
  const [admissionStats, setAdmissionStats] = useState([
    { label: "Walkins", value: 0 },
    { label: "Registered", value: 0 },
    { label: "Enrollments", value: 0 },
    { label: "Paid Admission Fee", value: 0 }
  ]);
  const [sendCounts, setSendCounts] = useState({
    whatsappSentToday: 0,
    emailSentToday: 0,
    totalSentToday: 0,
    whatsappLeftToday: CAMPAIGN_DAILY_LEAD_LIMIT
  });
  const [schoolLogo, setSchoolLogo] = useState<string>("/default-logo.png");
  const [userInfo, setUserInfo] = useState<any>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);
  const [activeSidebar, setActiveSidebar] = useState<"home" | "users" | "staff" | "analytics" | "settings" | "reports">("users");
  const [activeNav, setActiveNav] = useState<"dashboard" | "admissions" | "reports" | "campaigning">("campaigning");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [duplicatePopup, setDuplicatePopup] = useState("");
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [duplicateEntries, setDuplicateEntries] = useState<any[]>([]);
  const [duplicateUploadSummary, setDuplicateUploadSummary] = useState({
    insertable: 0,
    skipped: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [leadNameInput, setLeadNameInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const leadNameInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const [singleLeadModalOpen, setSingleLeadModalOpen] = useState(false);
  const [singleLeadSubmitting, setSingleLeadSubmitting] = useState(false);
  const [singleLeadError, setSingleLeadError] = useState("");
  const [singleLeadStatus, setSingleLeadStatus] = useState("");
  const [admissionReportOpen, setAdmissionReportOpen] = useState(false);
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const singleLeadNameRef = useRef<HTMLInputElement | null>(null);
  const singleLeadMobileRef = useRef<HTMLInputElement | null>(null);
  const singleLeadEmailRef = useRef<HTMLInputElement | null>(null);
  const singleLeadClassRef = useRef<HTMLInputElement | null>(null);
  const singleLeadCampaignRef = useRef<HTMLInputElement | null>(null);
  const [singleLeadFormKey, setSingleLeadFormKey] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaignStatusSentLeads, setCampaignStatusSentLeads] = useState<Lead[]>([]);
  const [campaignStatusScheduledLeads, setCampaignStatusScheduledLeads] = useState<Lead[]>([]);
  const [leadDeleteTarget, setLeadDeleteTarget] = useState<{
    id: string | number;
    name: string;
    campaignName?: string;
    count?: number;
  } | null>(null);
  const [deleteLeadLoading, setDeleteLeadLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const bulkLeadDropdownRef = useRef<HTMLDivElement | null>(null);
  const bulkLeadSummaryRef = useRef<HTMLButtonElement | null>(null);
  const [bulkLeadDropdownOpen, setBulkLeadDropdownOpen] = useState(false);
  const [selectedBulkLeadId, setSelectedBulkLeadId] = useState<string | number | null>(null);
  const [bulkLeadDropdownRect, setBulkLeadDropdownRect] = useState<DOMRect | null>(null);
  const [bulkListModalOpen, setBulkListModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [digitalLeadSchedules, setDigitalLeadSchedules] = useState<
    Record<string, { fromDate?: string; toDate?: string; time?: string }>
  >({});
  const campaignDigitalAssignLeads = useMemo(
    () => leads.filter((lead) => String(lead.lead_name || "").trim().length > 0),
    [leads]
  );
  const leadNameCounts = useMemo(() => {
    const counts = new Map<string, { count: number; latestDate: string }>();
    leads.forEach((lead) => {
      const name = (lead.lead_name || "").trim();
      if (!name) return;
      const dateStr = lead.date ? String(lead.date).split("T")[0] : "";
      const existing = counts.get(name);
      if (!existing) {
        counts.set(name, { count: 1, latestDate: dateStr });
      } else {
        existing.count += 1;
        if (dateStr && (!existing.latestDate || dateStr > existing.latestDate)) {
          existing.latestDate = dateStr;
        }
      }
    });
    return Array.from(counts.entries())
      .map(([name, info]) => ({ name, count: info.count, date: info.latestDate }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const bulkLeadSource = useMemo(
    () => (leads.length > 0 ? leads : campaignDigitalAssignLeads),
    [leads, campaignDigitalAssignLeads]
  );

  const bulkLeadItems = useMemo(() => {
    const groupedCampaigns = new Map<
      string,
      {
        id: string | number;
        leadName: string;
        date: string;
        fromDate: string;
        toDate: string;
        time: string;
        count: number;
      }
    >();

    bulkLeadSource.forEach((lead) => {
      const leadName = String(lead.lead_name || lead.refer_by || "").trim();
      if (!leadName) return;

      const key = leadName.toLowerCase();
      const date = lead.date ? String(lead.date).split("T")[0] : "";
      const time = String((lead as any).lead_time || "").trim();
      const existing = groupedCampaigns.get(key);

      if (!existing) {
        groupedCampaigns.set(key, {
          id: lead.id,
          leadName,
          date,
          fromDate: date,
          toDate: date,
          time,
          count: 1,
        });
        return;
      }

      existing.count += 1;
      if (date && (!existing.fromDate || date < existing.fromDate)) {
        existing.fromDate = date;
      }
      if (date && (!existing.date || date > existing.date)) {
        existing.date = date;
      }
      if (date && (!existing.toDate || date > existing.toDate)) {
        existing.toDate = date;
      }
      if (time) {
        existing.time = time;
      }
    });

    return Array.from(groupedCampaigns.values()).sort((a, b) => b.count - a.count);
  }, [bulkLeadSource]);
  useEffect(() => {
    if (bulkLeadItems.length === 0) {
      setSelectedBulkLeadId(null);
      setBulkLeadDropdownOpen(false);
      return;
    }

    setSelectedBulkLeadId((current) => {
      if (current != null && bulkLeadItems.some((item) => String(item.id) === String(current))) {
        return current;
      }
      return bulkLeadItems[0].id;
    });
  }, [bulkLeadItems]);

  useEffect(() => {
    if (!bulkLeadDropdownOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const dropdownEl = bulkLeadDropdownRef.current;
      const summaryEl = bulkLeadSummaryRef.current;
      const target = event.target as Node;
      if (
        dropdownEl &&
        !dropdownEl.contains(target) &&
        summaryEl &&
        !summaryEl.contains(target)
      ) {
        setBulkLeadDropdownOpen(false);
      }
    };

    const updateRect = () => {
      const rect = bulkLeadSummaryRef.current?.getBoundingClientRect();
      setBulkLeadDropdownRect(rect || null);
    };

    updateRect();
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [bulkLeadDropdownOpen]);

  const selectedBulkLead = useMemo(
    () =>
      bulkLeadItems.find((item) => String(item.id) === String(selectedBulkLeadId)) ||
      bulkLeadItems[0] ||
      null,
    [bulkLeadItems, selectedBulkLeadId]
  );

  const remainingBulkLeadItems = useMemo(() => {
    if (!selectedBulkLead) return bulkLeadItems;
    return bulkLeadItems.filter((item) => String(item.id) !== String(selectedBulkLead.id));
  }, [bulkLeadItems, selectedBulkLead]);

  const teacherFilteredLeads = useMemo(() => {
    if (!selectedTeacher) return leads;
    const selectedId = getTeacherKey(selectedTeacher);
    const selectedName = getTeacherLabel(selectedTeacher);
    const selectedNameNorm = selectedName.trim().toLowerCase();
    return leads.filter((lead) => {
      const leadAny = lead as any;
      const leadTeacherId =
        leadAny.assigned_teacher_id ??
        leadAny.teacher_id ??
        leadAny.assignedTeacherId ??
        leadAny.assigned_teacher ??
        null;
      const leadTeacherName =
        leadAny.assigned_teacher_name ??
        leadAny.teacher_name ??
        leadAny.assignedTeacherName ??
        leadAny.refer_by ??
        "";
      const leadTeacherNameNorm = String(leadTeacherName).trim().toLowerCase();

      if (selectedId && leadTeacherId != null && String(leadTeacherId) === selectedId) return true;
      if (selectedNameNorm && leadTeacherNameNorm && leadTeacherNameNorm === selectedNameNorm) return true;
      return false;
    });
  }, [leads, selectedTeacher]);

  useEffect(() => {
    if (!DEBUG_CAMPAIGNING) return;
    if (!selectedTeacher) {
      console.debug("[Campaigning] selectedTeacher cleared; leads:", leads.length);
      return;
    }
    console.debug("[Campaigning] selectedTeacher:", {
      id: getTeacherKey(selectedTeacher),
      name: getTeacherLabel(selectedTeacher),
      raw: selectedTeacher,
    });
  }, [DEBUG_CAMPAIGNING, selectedTeacher, leads.length]);

  useEffect(() => {
    if (!DEBUG_CAMPAIGNING) return;
    console.debug("[Campaigning] teacherFilteredLeads:", {
      total: teacherFilteredLeads.length,
      sample: teacherFilteredLeads.slice(0, 3).map((l) => ({
        id: l.id,
        full_name: l.full_name,
        assigned_teacher_name: (l as any).assigned_teacher_name,
        refer_by: (l as any).refer_by,
      })),
    });
  }, [DEBUG_CAMPAIGNING, teacherFilteredLeads]);

  useEffect(() => {
    console.debug("[Campaigning] sync selectedLead effect", {
      selectedTeacher: selectedTeacher
        ? {
            id: getTeacherKey(selectedTeacher),
            name: getTeacherLabel(selectedTeacher),
          }
        : null,
      teacherFilteredLeadsCount: teacherFilteredLeads.length,
      currentSelectedLeadId: selectedLead?.id ?? null,
    });
    if (!selectedTeacher) return;
    if (teacherFilteredLeads.length < 1) return;
    if (selectedLead && teacherFilteredLeads.some((l) => l.id === selectedLead.id)) return;
    console.debug("[Campaigning] sync selectedLead effect -> setSelectedLead", {
      nextLeadId: teacherFilteredLeads[0]?.id ?? null,
      nextLeadName: teacherFilteredLeads[0]?.full_name ?? null,
    });
    setSelectedLead(teacherFilteredLeads[0]);
  }, [selectedTeacher, teacherFilteredLeads, selectedLead]);

  const handleDeleteLeadGroup = async () => {
    if (!leadDeleteTarget) return;
    const schoolCode = String(localStorage.getItem("schoolCode") || "").trim();
    if (!schoolCode) {
      setError("Missing school code.");
      setLeadDeleteTarget(null);
      return;
    }

    const targetCampaignName = String(
      leadDeleteTarget.campaignName || leadDeleteTarget.name || ""
    ).trim();
    const normalizedCampaignName = targetCampaignName.toLowerCase();
    const leadsToDelete = normalizedCampaignName
      ? leads.filter(
          (lead) =>
            String(lead.lead_name || lead.refer_by || "")
              .trim()
              .toLowerCase() === normalizedCampaignName
        )
      : leads.filter((lead) => String(lead.id) === String(leadDeleteTarget.id));

    if (leadsToDelete.length === 0) {
      setLeadDeleteTarget(null);
      return;
    }

    setDeleteLeadLoading(true);
    setError("");
    setStatus("");

    try {
      for (const lead of leadsToDelete) {
        const response = await fetch(
          `https://cleezoclass.com:4000/admissions/${encodeURIComponent(String(lead.id))}?schoolCode=${encodeURIComponent(schoolCode)}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          throw new Error("Failed to delete campaign.");
        }
      }

      const deletedLeadIds = new Set(leadsToDelete.map((lead) => String(lead.id)));
      setStatus(
        targetCampaignName
          ? `Deleted campaign ${targetCampaignName}.`
          : `Deleted lead ${leadDeleteTarget.name}.`
      );
      setLeads((prev) => prev.filter((lead) => !deletedLeadIds.has(String(lead.id))));
      setDigitalLeadSchedules((prev) => {
        const targetLeadName = targetCampaignName;
        if (!targetLeadName || !prev[targetLeadName]) return prev;
        const stillExists = leads.some((lead) => {
          const leadId = String(lead.id);
          return (
            !deletedLeadIds.has(leadId) &&
            String(lead.lead_name || lead.refer_by || "").trim() === targetLeadName
          );
        });
        if (stillExists) return prev;
        const next = { ...prev };
        delete next[targetLeadName];
        return next;
      });
      if (selectedLead && deletedLeadIds.has(String(selectedLead.id))) {
        setSelectedLead(null);
      }
      setLeadDeleteTarget(null);
    } catch (err: any) {
      setError(err?.message || "Failed to delete campaign.");
    } finally {
      setDeleteLeadLoading(false);
    }
  };
  const communicationDigitalLeads = useMemo(() => {
    return campaignDigitalAssignLeads;
  }, [campaignDigitalAssignLeads]);

  const communicationDigitalStatusRows = useMemo(
    () =>
      campaignStatusSentLeads.filter((lead) => {
        const scope = String((lead as any).campaign_scope || "").toLowerCase();
        return !scope || scope === "digital";
      }),
    [campaignStatusSentLeads]
  );

  const communicationDigitalScheduledRows = useMemo(
    () =>
      campaignStatusScheduledLeads.filter((lead) => {
        const scope = String((lead as any).campaign_scope || "").toLowerCase();
        return !scope || scope === "digital";
      }),
    [campaignStatusScheduledLeads]
  );

  const persistedDigitalLeadSchedules = useMemo(() => {
    const leadKeyById = new Map<string, string>();
    leads.forEach((lead) => {
      const leadId = String(lead?.id ?? "").trim();
      const leadKey = getLeadScheduleKey(lead);
      if (leadId && leadKey) {
        leadKeyById.set(leadId, leadKey);
      }
    });

    const scheduleMap: Record<string, { fromDate?: string; toDate?: string; time?: string }> = {};
    [...communicationDigitalScheduledRows, ...communicationDigitalStatusRows].forEach((row: any) => {
      const leadId = String(row?.lead_id ?? row?.id ?? "").trim();
      const leadKey =
        leadKeyById.get(leadId) ||
        String(row?.refer_by ?? row?.lead_name ?? row?.full_name ?? "").trim();
      if (!leadKey) return;

      const parsedSchedule = parseScheduleMessage(
        row?.schedule_message ?? row?.scheduleMessage ?? row?.schedule_msg ?? ""
      );
      const rowDate = getLocalDateKey(row?.date);
      const scheduleFromDate = getLocalDateKey(
        row?.schedule_from_date || parsedSchedule.fromDate || rowDate
      );
      const scheduleToDate = getLocalDateKey(
        row?.schedule_to_date || parsedSchedule.toDate || rowDate
      );
      const rowTime = String(row?.lead_time || "").trim();
      const scheduleFromTime = String(row?.schedule_from_time || "").trim();
      const scheduleToTime = String(row?.schedule_to_time || "").trim();
      const persistedTimeLabel =
        scheduleFromTime && scheduleToTime
          ? `${scheduleFromTime} - ${scheduleToTime}`
          : scheduleFromTime || parsedSchedule.time || rowTime;
      const existing = scheduleMap[leadKey];
      if (!existing) {
        scheduleMap[leadKey] = {
          fromDate: scheduleFromDate || "",
          toDate: scheduleToDate || "",
          time: persistedTimeLabel || "",
        };
        return;
      }

      if (scheduleFromDate) {
        if (!existing.fromDate || scheduleFromDate < existing.fromDate) existing.fromDate = scheduleFromDate;
      }
      if (scheduleToDate) {
        if (!existing.toDate || scheduleToDate > existing.toDate) existing.toDate = scheduleToDate;
      }
      if (!existing.time && persistedTimeLabel) existing.time = persistedTimeLabel;
    });

    return scheduleMap;
  }, [communicationDigitalScheduledRows, communicationDigitalStatusRows, leads]);

  const effectiveDigitalLeadSchedules = useMemo(
    () => persistedDigitalLeadSchedules,
    [persistedDigitalLeadSchedules]
  );

  function getBulkLeadSchedule(leadName?: string) {
    const allLeadsFallback =
      effectiveDigitalLeadSchedules.__ALL__ || effectiveDigitalLeadSchedules.__all__ || {};
    const directKey = String(leadName || "").trim();
    if (!directKey) return allLeadsFallback;
    if (effectiveDigitalLeadSchedules[directKey]) {
      return effectiveDigitalLeadSchedules[directKey];
    }

    const normalizedKey = directKey.toLowerCase();
    const matchedKey = Object.keys(effectiveDigitalLeadSchedules).find(
      (key) => String(key || "").trim().toLowerCase() === normalizedKey
    );
    return matchedKey ? effectiveDigitalLeadSchedules[matchedKey] || {} : allLeadsFallback;
  }

  const renderBulkLeadDropdownPortal = () => {
    if (
      !bulkLeadDropdownOpen ||
      !selectedBulkLead ||
      !bulkLeadDropdownRect ||
      typeof document === "undefined"
    ) {
      return null;
    }

    const viewportPadding = 12;
    const popoverWidth = Math.min(420, window.innerWidth - viewportPadding * 2);
    const estimatedHeight = Math.min(
      440,
      Math.max(160, remainingBulkLeadItems.length * 56 + 56)
    );
    const left = Math.min(
      Math.max(viewportPadding, bulkLeadDropdownRect.left),
      Math.max(viewportPadding, window.innerWidth - popoverWidth - viewportPadding)
    );
    const spaceBelow = window.innerHeight - bulkLeadDropdownRect.bottom - viewportPadding;
    const top =
      spaceBelow >= estimatedHeight || bulkLeadDropdownRect.top < estimatedHeight
        ? bulkLeadDropdownRect.bottom + 8
        : Math.max(viewportPadding, bulkLeadDropdownRect.top - estimatedHeight - 8);

    return createPortal(
      <div
        ref={bulkLeadDropdownRef}
        className="campaign-bulk-dropdown"
        style={
          {
            position: "fixed",
            top,
            left,
            width: popoverWidth,
            maxWidth: popoverWidth,
            maxHeight: Math.min(440, window.innerHeight - viewportPadding * 2),
          } as CSSProperties
        }
      >
        <div className="campaign-bulk-dropdown-title">Remaining leads</div>
        <div className="campaign-bulk-dropdown-list" role="listbox">
          {remainingBulkLeadItems.length > 0 ? (
            remainingBulkLeadItems.map((item) => {
              const schedule = getBulkLeadSchedule(item.leadName) as {
                fromDate?: string;
                toDate?: string;
                time?: string;
              };
              const fromDate = schedule.fromDate || item.fromDate || item.date || "";
              const toDate = schedule.toDate || item.toDate || item.date || "";
              const time = schedule.time || item.time || "";

              return (
                <div
                  key={`bulk-lead-dropdown-${item.id}`}
                  className="campaign-bulk-dropdown-item"
                >
                  <span className="campaign-bulk-dot" />
                  <span className="campaign-bulk-dropdown-item-body">
                    <span className="campaign-bulk-dropdown-item-top">
                      <span className="campaign-bulk-dropdown-item-name">
                        {item.leadName || "-"}
                      </span>
                      <span className="campaign-bulk-count-text">
                        {item.count} {item.count === 1 ? "Lead" : "Leads"}
                      </span>
                    </span>
                    <span className="campaign-bulk-dropdown-item-meta">
                      Scheduled: From Date: {fromDate ? formatLeadDateLabel(fromDate) : "-"} | To Date:{" "}
                      {toDate ? formatLeadDateLabel(toDate) : "-"} | Time:{" "}
                      {time ? formatLeadTimeLabel(time) : "-"}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="campaign-bulk-delete-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLeadDeleteTarget({
                        id: item.id,
                        name: item.leadName || "this campaign",
                        campaignName: item.leadName,
                        count: item.count,
                      });
                    }}
                    aria-label={`Delete ${item.leadName || "campaign"}`}
                    title="Delete"
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="campaign-bulk-empty">No additional leads</div>
          )}
        </div>
      </div>,
      document.body
    );
  };

  const communicationStaffStatusRows = useMemo(
    () =>
      campaignStatusSentLeads.filter(
        (lead) => String((lead as any).campaign_scope || "").toLowerCase() === "staff"
      ),
    [campaignStatusSentLeads]
  );

  const selectedStaffStatusRows = useMemo(() => {
    if (!selectedTeacher) return communicationStaffStatusRows;
    const selectedLeadIds = new Set(
      teacherFilteredLeads
        .map((lead) => String(lead.id))
        .filter((id) => id && id !== "undefined" && id !== "null")
    );
    return communicationStaffStatusRows.filter((lead: any) =>
      selectedLeadIds.has(String(lead?.lead_id ?? lead?.id))
    );
  }, [selectedTeacher, teacherFilteredLeads, communicationStaffStatusRows]);

  const campaignStatusRangeLabel = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return `${from.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })} - ${to.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
  }, []);

  const isWithinLast30Days = (value?: string | null) => {
    const dateKey = getLocalDateKey(value);
    if (!dateKey) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    const parsed = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed >= from && parsed <= today;
  };

  const sortStatusRowsByDateTime = (rows: Lead[]) =>
    [...rows].sort((a, b) => {
      const aTs = new Date(`${getLocalDateKey(a?.date) || "1970-01-01"}T${a?.lead_time || "00:00:00"}`).getTime();
      const bTs = new Date(`${getLocalDateKey(b?.date) || "1970-01-01"}T${b?.lead_time || "00:00:00"}`).getTime();
      return bTs - aTs;
    });

  const monthDigitalStatusRows = useMemo(
    () => sortStatusRowsByDateTime(communicationDigitalStatusRows.filter((lead) => isWithinLast30Days((lead as any)?.date))),
    [communicationDigitalStatusRows]
  );

  const monthSelectedStaffStatusRows = useMemo(
    () => sortStatusRowsByDateTime(selectedStaffStatusRows.filter((lead) => isWithinLast30Days((lead as any)?.date))),
    [selectedStaffStatusRows]
  );

  const digitalSentMonthCount = useMemo(
    () => monthDigitalStatusRows.length,
    [monthDigitalStatusRows]
  );

  const staffSentMonthCount = useMemo(
    () => monthSelectedStaffStatusRows.length,
    [monthSelectedStaffStatusRows]
  );

  const digitalLeftOutOfThirty = Math.max(0, CAMPAIGN_DAILY_LEAD_LIMIT - digitalSentMonthCount);
  const staffLeftOutOfThirty = Math.max(0, CAMPAIGN_DAILY_LEAD_LIMIT - staffSentMonthCount);

  const digitalPredictionSummary = useMemo(() => {
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const sentLeadIds = new Set(
      communicationDigitalStatusRows
        .map((lead: any) => String(lead?.lead_id ?? lead?.id ?? ""))
        .filter(Boolean)
    );

    const datedLeads = communicationDigitalLeads.map((lead) => {
      const rawDate = String(lead.date || "").split("T")[0];
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const ageInDays =
        parsedDate && !Number.isNaN(parsedDate.getTime())
          ? Math.max(0, Math.floor((now.getTime() - parsedDate.getTime()) / msPerDay))
          : null;
      return { lead, ageInDays };
    });

    const recentLeads = datedLeads.filter((entry) => entry.ageInDays !== null && entry.ageInDays <= 7);
    const hotLeads = datedLeads.filter(
      ({ lead, ageInDays }) =>
        ageInDays !== null &&
        ageInDays <= 2 &&
        !sentLeadIds.has(String(lead.id))
    );
    const pendingLeads = communicationDigitalLeads.filter((lead) => !sentLeadIds.has(String(lead.id)));
    const topSource = leadNameCounts[0];
    const predictedConversions = Math.min(
      pendingLeads.length,
      Math.round((recentLeads.length * Math.max(admissionRate, 8)) / 100)
    );
    const sendDaysLeft =
      sendCounts.whatsappLeftToday > 0
        ? Math.ceil(pendingLeads.length / sendCounts.whatsappLeftToday)
        : null;

    return {
      cards: [
        {
          label: "Likely This Week",
          value: String(predictedConversions),
          note: `${recentLeads.length} fresh leads are inside the active window`,
        },
        {
          label: "Hot Leads",
          value: String(hotLeads.length),
          note: "Recent leads still waiting for digital communication",
        },
        {
          label: "Strongest Source",
          value: topSource?.name || "Manual",
          note: topSource ? `${topSource.count} leads from this source` : "No campaign source yet",
        },
        {
          label: "Send Capacity",
          value: sendDaysLeft === null ? "--" : `${sendDaysLeft}d`,
          note:
            pendingLeads.length === 0
              ? "All digital leads already covered"
              : `${pendingLeads.length} leads pending with ${sendCounts.whatsappLeftToday} WhatsApp slots left today`,
        },
      ],
      insights: [
        `Prediction is based on ${communicationDigitalLeads.length} digital leads and the current ${admissionRate}% admission rate.`,
        topSource
          ? `${topSource.name} is the strongest source right now, so similar campaigns are most likely to produce the next lead spike.`
          : "Upload or assign campaign source names to improve prediction quality.",
        hotLeads.length > 0
          ? `${hotLeads.length} recent leads should be contacted first for better conversion odds.`
          : "No urgent unsent digital leads are waiting right now.",
      ],
    };
  }, [communicationDigitalLeads, communicationDigitalStatusRows, leadNameCounts, admissionRate, sendCounts.whatsappLeftToday]);

  const staffPredictionSummary = useMemo(() => {
    const assignedLeads = leads.filter((lead: any) => {
      const teacherId =
        lead?.assigned_teacher_id ??
        lead?.teacher_id ??
        lead?.assignedTeacherId ??
        lead?.assigned_teacher;
      const teacherName = String(
        lead?.assigned_teacher_name ??
          lead?.teacher_name ??
          lead?.assignedTeacherName ??
          ""
      ).trim();
      return Boolean((teacherId !== null && teacherId !== undefined && String(teacherId).trim()) || teacherName);
    });
    const unassignedCount = Math.max(leads.length - assignedLeads.length, 0);
    const selectedTeacherName = selectedTeacher ? getTeacherLabel(selectedTeacher) : "Selected Staff";
    const selectedTeacherProjected = Math.round((teacherFilteredLeads.length * Math.max(admissionRate, 8)) / 100);
    const staffCoverage = leads.length > 0 ? Math.round((assignedLeads.length / leads.length) * 100) : 0;
    const pendingStaffFollowups = Math.max(teacherFilteredLeads.length - selectedStaffStatusRows.length, 0);

    const teacherLoadMap = new Map<string, number>();
    leads.forEach((lead: any) => {
      const name = String(
        lead?.assigned_teacher_name ??
          lead?.teacher_name ??
          lead?.assignedTeacherName ??
          lead?.refer_by ??
          ""
      ).trim();
      if (!name) return;
      teacherLoadMap.set(name, (teacherLoadMap.get(name) || 0) + 1);
    });
    const topStaffLoad = Array.from(teacherLoadMap.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      cards: [
        {
          label: "Assignment Coverage",
          value: `${staffCoverage}%`,
          note: `${assignedLeads.length} of ${leads.length} leads already mapped to staff`,
        },
        {
          label: "Unassigned",
          value: String(unassignedCount),
          note: unassignedCount > 0 ? "These leads need staff ownership" : "No unassigned leads right now",
        },
        {
          label: selectedTeacher ? "Selected Staff Outlook" : "Top Staff Load",
          value: selectedTeacher ? String(selectedTeacherProjected) : topStaffLoad?.[0] || "--",
          note: selectedTeacher
            ? `${selectedTeacherName} can likely close ${selectedTeacherProjected} leads from the current queue`
            : topStaffLoad
              ? `${topStaffLoad[1]} leads currently sit with this staff member`
              : "Pick a staff member to view a focused prediction",
        },
        {
          label: "Pending Follow-ups",
          value: String(pendingStaffFollowups),
          note: `${selectedStaffStatusRows.length} staff communications already sent`,
        },
      ],
      insights: [
        `Staff prediction updates from live assignment data and the current ${admissionRate}% admission rate.`,
        selectedTeacher
          ? `${selectedTeacherName} has ${teacherFilteredLeads.length} mapped leads, so this forecast is focused on that queue.`
          : "Select a staff member in the staff panel to get a tighter prediction for that person.",
        unassignedCount > 0
          ? `${unassignedCount} leads are still unassigned, which is the biggest drag on likely conversions right now.`
          : "Assignment coverage looks healthy, so the next lift should come from fast follow-ups.",
      ],
    };
  }, [leads, selectedTeacher, teacherFilteredLeads, selectedStaffStatusRows, admissionRate]);

  const renderAssistantPanel = (
    heading: string,
    summary: {
      cards: Array<{ label: string; value: string; note: string }>;
      insights: string[];
    }
  ) => (
    <Section title="" variant="marketing" className="campaignSection">
      <div className="campaign-assistant-panel">
        <div className="campaignstatusHeader">
          <div className="campaign-assistant-heading-row">
            <div className="Heading">{heading}</div>
            <div className="campaign-assistant-badge">Campaign Assistant</div>
          </div>
          <div className="campaign-info-row">
            <div className="campaign-datetime">
              <span>
                {new Date().toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="campaign-assistant-hero">
          <div className="campaign-assistant-hero-copy">
            <div className="campaign-assistant-hero-kicker"></div>
            <div className="campaign-assistant-hero-title">
              {summary.insights[0] || "Live campaigning summary"}
            </div>
          </div>
          <div className="campaign-assistant-hero-pill">
            <span>Cards</span>
            <strong>{summary.cards.length}</strong>
          </div>
        </div>

        <div
          className="campaign-assistant-grid"
          style={{ gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}
        >
          {summary.cards.map((card) => (
            <div key={card.label} className="campaign-assistant-stat-card">
              <div className="campaign-assistant-stat-top">
                <div className="campaign-assistant-stat-label">{card.label}</div>
                <div className="campaign-assistant-stat-dot" />
              </div>
              <div className="campaign-assistant-stat-value">{card.value}</div>
              <div className="campaign-assistant-stat-note">{card.note}</div>
            </div>
          ))}
        </div>

        <div className="campaign-assistant-insights">
          <div className="campaign-assistant-insights-title">Assistant Notes</div>
          <div className="campaign-assistant-insight-list">
            {summary.insights.slice(1).map((insight, index) => (
              <div key={`${heading}-${index}`} className="campaign-assistant-insight-item">
                <span className="campaign-assistant-insight-index">{index + 1}</span>
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );

  const templateHeader = [
      "student_name",
      "full_name",
      "occupation",
      "mobile_number",
      "email_id",
      "address",
      "dob",
      "lead_admission_for",
      "refer_by"
    ];
  const templateSample = [
      "Student Name",
      "Parent Full Name",
      "Occupation",
      "9876543210",
      "parent@example.com",
      "Hyderabad",
      "2016-08-15",
      "7",
      "Campaign"
    ];

  const handleTemplateOpen = () => {
    try {
      const ws = XLSX.utils.aoa_to_sheet([templateHeader, templateSample]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bulk Upload Format");
      XLSX.writeFile(wb, "frontdesk_campaign_bulk_format.xlsx");
      setStatus("Template downloaded successfully.");
      setError("");
    } catch (err) {
      setError("Failed to download template.");
    }
  };

  const formatDuplicateEntriesMessage = (entries: any[] = []) => {
    if (!Array.isArray(entries) || entries.length === 0) {
      return "Duplicate entry detected";
    }

    const lines = entries
      .map((entry) => String(entry?.mobile_number || entry?.email_id || "").trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return "Duplicate entry detected";
    }

    const uniqueLines = Array.from(new Set(lines));
    const preview = uniqueLines.slice(0, 10);
    const moreCount = uniqueLines.length - preview.length;

    return [
      "Duplicate entry detected",
      ...preview,
      moreCount > 0 ? `+${moreCount} more` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const summarizeDuplicateEntries = (entries: any[] = []) => {
    return Array.from(
      new Set(
        (Array.isArray(entries) ? entries : [])
          .map((entry) => String(entry?.mobile_number || entry?.email_id || "").trim())
          .filter(Boolean)
      )
    );
  };

  const uploadBulkLeads = async (options?: { previewOnly?: boolean }) => {
    const previewOnly = Boolean(options?.previewOnly);
    const trimmedLeadName = leadNameInputRef.current?.value.trim() || "";
    const trimmedLocation = locationInputRef.current?.value.trim() || "";
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
      throw new Error("School Code is missing. Please login again.");
    }
    if (!file) {
      throw new Error("Please select a file to upload.");
    }

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv");
    const isXlsx = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");
    if (!isCsv && !isXlsx) {
      throw new Error("Please upload a valid .csv or .xlsx file.");
    }

    let uploadFile = file;
    if (isXlsx) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      uploadFile = new File([csv], "bulk_leads_upload.csv", { type: "text/csv" });
    }

    const formData = new FormData();
    formData.append("schoolCode", schoolCode);
    formData.append("lead_name", trimmedLeadName);
    formData.append("lead_location", trimmedLocation);
    formData.append("refer_by", "Campaign");
    formData.append("previewOnly", previewOnly ? "true" : "false");
    formData.append("file", uploadFile);

    const res = await fetch("https://cleezoclass.com:4000/api/leads/bulk-upload", {
      method: "POST",
      body: formData
    });

    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: raw || "Bulk upload failed" };
    }
    if (!res.ok) throw new Error(data?.error || "Bulk upload failed");

    return {
      data,
      trimmedLeadName,
      trimmedLocation,
    };
  };

  const handleUpload = async () => {
    setError("");
    setStatus("");
    try {
      setUploading(true);
      const { data } = await uploadBulkLeads({ previewOnly: true });
      const insertedCount = Number(data.inserted || 0);
      const skippedCount = Number(data.skipped || 0);
      const duplicates = Array.isArray(data?.duplicateEntries) ? data.duplicateEntries : [];

      if (duplicates.length > 0 || skippedCount > 0) {
        setDuplicateEntries(duplicates);
        setDuplicateUploadSummary({
          insertable: insertedCount,
          skipped: skippedCount,
        });
        setDuplicateReviewOpen(true);
        return;
      }

      const { data: finalData, trimmedLeadName, trimmedLocation } = await uploadBulkLeads({ previewOnly: false });
      const finalInsertedCount = Number(finalData.inserted || 0);
      const finalSkippedCount = Number(finalData.skipped || 0);
      const duplicateMessage = formatDuplicateEntriesMessage(finalData?.duplicateEntries || []);
      setStatus(`Uploaded ${finalInsertedCount} leads. Skipped ${finalSkippedCount}.`);
      if (finalSkippedCount > 0) {
        setError(duplicateMessage);
        setDuplicatePopup(duplicateMessage);
      }
      setLeadNameInput(trimmedLeadName || "Campaign");
      setLocationInput(trimmedLocation);
      setFile(null);
      fetchLeads();
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("duplicate")) {
        setError("Duplicate entry detected");
        setDuplicatePopup("Duplicate entry detected");
      } else {
        setError(msg || "Bulk upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUploadSkippingDuplicates = async () => {
    setError("");
    setStatus("");
    try {
      setUploading(true);
      const { data, trimmedLeadName, trimmedLocation } = await uploadBulkLeads({ previewOnly: false });
      const insertedCount = Number(data.inserted || 0);
      const skippedCount = Number(data.skipped || 0);
      setStatus(`Uploaded ${insertedCount} leads. Skipped ${skippedCount}.`);
      setLeadNameInput(trimmedLeadName || "Campaign");
      setLocationInput(trimmedLocation);
      setDuplicateReviewOpen(false);
      setDuplicateEntries([]);
      setFile(null);
      fetchLeads();
    } catch (err: any) {
      const msg = String(err?.message || "");
      setError(msg || "Bulk upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCancelDuplicateUpload = () => {
    setDuplicateReviewOpen(false);
    setDuplicateEntries([]);
    setDuplicateUploadSummary({ insertable: 0, skipped: 0 });
    setStatus("Upload cancelled.");
  };

  const handleSingleLeadSubmit = async () => {
    setSingleLeadError("");
    setSingleLeadStatus("");
    const trimmedLeadName =
      singleLeadCampaignRef.current?.value.trim() ||
      leadNameInputRef.current?.value.trim() ||
      "";
    const trimmedLocation = locationInputRef.current?.value.trim() || "";
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
      setSingleLeadError("School Code is missing. Please login again.");
      return;
    }
    const fullName = singleLeadNameRef.current?.value.trim() || "";
    const email = singleLeadEmailRef.current?.value.trim() || "";
    const leadClass = singleLeadClassRef.current?.value.trim() || "";
    if (!fullName) {
      setSingleLeadError("Please enter full name.");
      return;
    }
    const normalizeMobileForLead = (value: string) => {
      const digits = String(value || "").replace(/\D/g, "");
      if (digits.length === 12 && digits.startsWith("91")) return digits.slice(-10);
      if (digits.length === 11 && digits.startsWith("0")) return digits.slice(-10);
      if (digits.length > 10) return digits.slice(-10);
      return digits;
    };
    const mobile = normalizeMobileForLead(singleLeadMobileRef.current?.value || "");
    if (mobile.length !== 10) {
      setSingleLeadError("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setSingleLeadSubmitting(true);
      const STATIC_DOB = "2010-01-01";
      const campaignName = "Campaign";
      const fd = new FormData();
      fd.append("schoolCode", schoolCode);
      fd.append("student_name", fullName);
      fd.append("full_name", fullName);
      fd.append("occupation", "");
      fd.append("mobile_number", mobile);
      fd.append("email_id", email);
      fd.append("address", trimmedLocation);
      fd.append("dob", STATIC_DOB);
      fd.append("lead_admission_for", leadClass);
      fd.append("entry_type", "manual");
      fd.append("lead_name", fullName);
      fd.append("refer_by", campaignName);

      const res = await fetch("https://cleezoclass.com:4000/api/add-lead", {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || "Single upload failed");

      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
      const optimisticLead: Lead = {
        id: data?.id || data?.leadId || `single-${now.getTime()}`,
        full_name: fullName,
        student_name: fullName,
        lead_name: fullName,
        mobile_number: mobile,
        email_id: email,
        lead_admission_for: leadClass,
        date: localDate,
        lead_time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        entry_type: "manual",
        refer_by: campaignName,
      };

      setLeads((prev) => {
        const exists = prev.some((lead) => String(lead.id) === String(optimisticLead.id));
        if (exists) {
          return prev.map((lead) =>
            String(lead.id) === String(optimisticLead.id) ? { ...lead, ...optimisticLead } : lead
          );
        }
        return [optimisticLead, ...prev];
      });

      setSingleLeadStatus("Lead added successfully.");
      setLeadNameInput(fullName);
      setLocationInput(trimmedLocation);
      setSingleLeadFormKey((prev) => prev + 1);
      fetchLeads();
      setTimeout(() => {
        setSingleLeadModalOpen(false);
        setSingleLeadStatus("");
      }, 700);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("duplicate")) {
        setSingleLeadError("Duplicate entry detected");
        setDuplicatePopup("Duplicate entry detected");
      } else {
        setSingleLeadError(msg || "Single upload failed");
      }
    } finally {
      setSingleLeadSubmitting(false);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    fetch(
      `https://cleezoclass.com:4000/api/frontdesk/metrics?schoolCode=${encodeURIComponent(schoolCode)}`
    )
      .then((res) => res.json())
      .then((data) => {
        const registered = Number(data.registered || 0);
        const enrollments = Number(data.enrolled || 0);
        const rate = registered > 0 ? Math.round((enrollments / registered) * 100) : 0;
        setAdmissionRate(rate);
        setAdmissionStats([
          { label: "Walkins", value: Number(data.total_leads || 0) },
          { label: "Registered", value: registered },
          { label: "Enrollments", value: enrollments },
          { label: "Paid Admission Fee", value: Number(data.admission_paid || 0) }
        ]);
      })
      .catch((err) => console.error("Metrics fetch failed", err));
  }, []);

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;

    fetch(
      `https://cleezoclass.com:4000/api/frontdesk/send-counts?schoolCode=${encodeURIComponent(schoolCode)}`
    )
      .then((res) => res.json())
      .then((data) => {
        const whatsappSentToday = Number(data.whatsappSentToday ?? 0);
        const emailSentToday = Number(data.emailSentToday ?? 0);
        const totalSentToday = Number(data.totalSentToday ?? 0);
        const apiWhatsappRemaining = Number(data.whatsappRemaining);
        const localWhatsappRemaining = Math.max(
          0,
          CAMPAIGN_DAILY_LEAD_LIMIT - whatsappSentToday
        );
        const whatsappLeftToday = Number.isFinite(apiWhatsappRemaining)
          ? Math.min(localWhatsappRemaining, Math.max(0, apiWhatsappRemaining))
          : localWhatsappRemaining;
        setSendCounts({
          whatsappSentToday,
          emailSentToday,
          totalSentToday,
          whatsappLeftToday
        });
      })
      .catch((err) => console.error("Send counts fetch failed", err));
  }, []);

  const normalizeUserPhoto = (rawPhoto: any) => {
    if (!rawPhoto) return "";
    let photo = rawPhoto;
    if (typeof photo === "object" && photo?.type === "Buffer" && Array.isArray(photo?.data)) {
      try {
        photo = new TextDecoder().decode(new Uint8Array(photo.data));
      } catch {
        return "";
      }
    }
    if (typeof photo !== "string") return "";
    photo = photo.trim();
    if (!photo) return "";
    if (photo.startsWith("data:image")) return photo;
    if (photo.startsWith("http")) return photo;
    if (photo.startsWith("0x")) {
      try {
        const hex = photo.slice(2);
        let decoded = "";
        for (let i = 0; i < hex.length; i += 2) {
          decoded += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
        }
        photo = decoded.trim();
      } catch {
        return "";
      }
    }
    if (photo.startsWith("/public/uploads/")) {
      photo = photo.replace("/public", "");
    }
    if (photo.startsWith("uploads/")) {
      photo = `/${photo}`;
    }
    if (photo.startsWith("/uploads/")) {
      return `https://cleezoclass.com:4000${photo}`;
    }
    if (/^[A-Za-z0-9+/=]+$/.test(photo) && photo.length > 100) {
      return `data:image/jpeg;base64,${photo}`;
    }
    return "";
  };

  useEffect(() => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;
    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${schoolCode}`)
      .then((res) => res.json())
      .then((data) => {
        setSchoolLogo(data.logo || "/default-logo.png");
      })
      .catch(() => setSchoolLogo("/default-logo.png"));
  }, []);

  useEffect(() => {
    const username = localStorage.getItem("username");
    const schoolCode = localStorage.getItem("schoolCode");
    if (!username || !schoolCode) return;
    fetch(`https://cleezoclass.com:4000/api/user-info/${username}?schoolCode=${schoolCode}`)
      .then((res) => res.json())
      .then((data) => {
        setUserInfo({
          ...data,
          photo: normalizeUserPhoto(data?.photo)
        });
      })
      .catch(() => setUserInfo(null));
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

  // 3. MODAL HANDLER FUNCTIONS
  const openModal = (componentName: string, title: string) => {
    switch (componentName) {
      case "AdmissionCRM":
        setModalContent(<AdmissionCRM />);
        break;
      case "LeadsProfilePage":
        setModalContent(<LeadsProfilePage />);
        break;
      case "AccountantParties":
        setModalContent(<AccountantParties />);
        break;
      case "TestAndCouncelling":
        setModalContent(<TestAndCouncelling />);
        break;
      case "Communication":
        setModalContent(<Communication />);
        break;
          case "AdmissionEnrollment":
        setModalContent(<AdmissionEnrollment />);
        break;
        
      case "LeadsTable":
        setModalContent(<LeadsTable />);
        break;
      default:
        setModalContent(null);
    }
    setModalTitle(title);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
    setModalTitle("");
    setActiveSidebar("users");
    setActiveNav("campaigning");
  };

  const Modal: React.FC<ModalProps> = ({ isOpen, title, onClose, children }) => {
    if (!isOpen) return null;



    return createPortal(
      <div  className="modalOverlayStyle" onClick={onClose}>
        <div className="modalContentStyle" onClick={e => e.stopPropagation()}>
          <button type="button" className="modalCloseButton" onClick={onClose} aria-label="Close popup">
            ×
          </button>
          {children}
        </div>
      </div>
    , document.body);
  };

  
  // --- DATA ---
  const ActionItems: DashboardItem[] = [
    { color: "#868C8F", title: "Chat Approved", desc: "session no 1024", link: "/BiometricTeacher", buttonType: "Schedule" },
    { color: "#705B56", title: "Festive/Holiday", desc: "Remainder, Greeting", link: "/BiometricTeacher", buttonType: "OK" },
    { color: "#868C8F", title: "Utilities", desc: "Provide Drinking Water", link: "/BiometricTeacher", buttonType: "OK" },
    { color: "#705B56", title: "Staff Syllabus", desc: "Homework Not Assigned", link: "/operations/timetable", buttonType: "OK" },
    { color: "#705B56", title: "Staff-Heads", desc: "Homework Not Assigned", link: "/operations/timetable", buttonType: "OK" },
  ];

  const hrItems: DashboardItem[] = [
    { color: "#D9EEF8", title: "Admission-Report", desc: "Manual, Automated...", link: "AccountantParties", displayName: "Parties Income" },
    { color: "#868C8F", title: "Lead Report", desc: "Lead Details...", link: "AccountantParties" },
    { color: "#A39DBD", title: "Communication History", desc: "Whatsapp history...", link: "AccountantParties" },
  ];
  const accountItems : DashboardItem[] = [
    {
      color: "#D4C7B0",
      title: "Admission-report",
      desc: "Lead source allocation,ticket generation, view plan",
      link: "ExpensesDashboardInline", // Component Name
      displayName: "Expense Management", // Display Name for Modal
    },
    {
      color: "#868C8F",
      title: "Test and Councelling-Report",
      desc: "Test Q.P. verify,Test Report,Counselor Assign & Report",
      link: "ExpensesDashboardInline",
      displayName: "Item Manager",
    },
     {
      color: "#868C8F",
      title: "Communication-Report",
      desc: "Messaging & mails, follow ups, Image Generator, Re-Marketing opt",
      link: "Communication",
      displayName: "Miscellaneous Expenses",
    },
  ];
    const accountItem: DashboardItem[] = [
    {
      color: "#D4C7B0",
      title: "Lead Profile-Report",
      desc: "lead score, Lead Strength report, oneview lead profile",
      link: "ExpensesDashboardInline",
      displayName: "Salary Management",
    },
    {
      color: "#705B56",
      title: "Followups-Report ",
      desc: "conversational calls, Re-Assign ticket, Re-marketing-assign",
      link: "LeadsTable",
      displayName: "Expense Records",
    },
     {
      color: "#705B56",
      title: "Templates crafting",
      desc: "Edit Images,Edit Templates, Create Templates",
      link: "ExpensesDashboardInline",
      displayName: "Expense Records",
    },
  ];
    const marketingItem : DashboardItem[] = [
    {
      color: "#D4C7B0",
      title: "Lead Profile",
      desc: "Lead Score, Lead Strength, one view lead profile",
      link: "LeadsProfilePage",
      displayName: "Income Reports/Complaints",
    },
    {
      color: "#705B56",
      title: "Follow ups ",
      desc: "Conversational, calls, Re-Assign to automated admission",
      link: "LeadsTable",
      displayName: "Income Records",
    },
    {
      color: "#868C8F",
      title: "Teams",
      desc: "FrontOffice,Councellors,sales,Executives,Field Force",
      link: "LeadsProfilePage",
      displayName: "Remainders-Cutoff",
    },

  ];

  const marketingItems: DashboardItem[] = [
    {
      color: "#D4C7B0",
      title: "Admission",
      desc: "Register,Lead submission, Lead source location,Ticket Generation, Enroll forwarding",
      link: "AdmissionCRM",
      displayName: "Fees Management",
    },
    {
      color: "#868C8F",
      title: "Test and Councelling",
      desc: "Assign invigilator, Test Q.P, Test report, Counselor assign,Counseling Report",
      link: "TestAndCouncelling",
      displayName: "Discounts Management",
    },
     {
      color: "#868C8F",
      title: "Communications",
      desc: "Opt messaging, Mails, Followup, Image Generator,Re-marketing Opt",
      link: "Communication",
      displayName: "Other Incomes",
    },
  ];
  // 5. HELPER RENDER FUNCTIONS
const renderCard = (
  title: string,
  items: DashboardItem[],
  homepageRoute: string,
  split: boolean = false,
  customCardClass: string = ""
) => {

  const renderDesc = (desc: string | DescriptionObject[]) => {
    if (Array.isArray(desc)) {
      return (
        <div className="descContainer">
          {desc.map((d, idx) => (
            <React.Fragment key={idx}>
              {d.staticText && <span className="descText">{d.staticText}</span>}
              {d.boxedText && <span className="descBox">{d.boxedText}</span>}
              {d.text && (
                <span className={d.isBox ? "descBox" : "descText"}>{d.text}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      );
    }
    return desc;
  };

  const handleItemClick = (i: DashboardItem) => {
    const modalComponents = ["AdmissionCRM", "LeadsProfilePage", "AccountantParties", "TestAndCouncelling", "Communication", "LeadsTable"];
    if (modalComponents.includes(i.link)) {
      openModal(i.link, i.displayName || i.title);
    } else {
      navigate(i.link);
    }
  };

  const renderItemContent = (i: DashboardItem) => (
    <div className={`dashboard-item ${isMobile ? "mobile" : ""}`} key={i.title} onClick={() => handleItemClick(i)}>
      <div className="dashboard-item-left">
        {items === ActionItems ? (
          <FontAwesomeIcon icon={faAngleRight} className="dashboard-item-icon" />
        ) : (
          <div className="dashboard-item-circle" style={{ backgroundColor: i.color }}></div>
        )}
        <div className="dashboard-item-text">
          <div className="dashboard-item-title">{i.title}</div>
          <div className="dashboard-item-desc">{renderDesc(i.desc)}</div>
        </div>
      </div>

      {items === ActionItems && i.buttonType && (
        <button
          type="button"
          className={`dashboard-item-button ${i.buttonType === "OK" ? "ok" : "cancel"}`}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            alert(`${i.buttonType} clicked for ${i.title}`);
          }}
        >
          {i.buttonType}
        </button>
      )}
    </div>
  );

  if (split) {
    return <div className="itemListContainer">{items.map(renderItemContent)}</div>;
  }

  return <div className={`card ${customCardClass}`}>{items.map(renderItemContent)}</div>;
};

  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("schoolCode");
    localStorage.removeItem("userRole");
    localStorage.removeItem("name");
    sessionStorage.clear();
    // Hard replace prevents reopening protected dashboard via forward history.
    window.location.replace(import.meta.env.BASE_URL || "/");
  };

interface Teacher {
  teacher_id: string | number;
  teacher_name: string;
  phone_no: string;
  subject?: string;
  designation?: string;
}

interface Student {
  id: string | number;
  name?: string;
  photo?: { data?: any };
}

interface Ticket {
  id: number;
  ticket_type: "teacher" | "student";
  teacher_id?: string | number | null;
  teacher_name?: string | null;
  student_id?: string | number | null;
  student_name?: string | null;
  class_name?: string | null;
  section?: string | null;
  title: string;
  description: string;
  status: "open" | "closed";
  created_at: string;
}

interface Lead {
  id: string | number;
  full_name: string;
  student_name?: string;
  lead_name?: string;
  mobile_number: string;
  email_id?: string;
  lead_admission_for?: string;
  date: string;
  lead_time: string;
  entry_type?: string;
  reg_no?: string | number;
  refer_by?: string | null;
  assigned_teacher_id?: string | number | null;
  assigned_teacher_name?: string | null;
  teacher_decision?: string | null;
  campaign_scope?: "digital" | "staff";
}

interface ChannelOption {
  value: string;
  label: string;
}

const API_BASE = "https://cleezoclass.com:4000/api/admin";

const bufferToPathString = (bufferData: any) => {
  if (!bufferData) return "";
  try {
    const bytes = new Uint8Array(bufferData);
    let pathString = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      pathString += String.fromCharCode(bytes[i]);
    }
    return pathString.trim().replace(/\u0000/g, "");
  } catch {
    return "";
  }
};

function formatLeadDateLabel(dateValue?: string) {
  if (!dateValue) return "--";
  const dateObj = new Date(dateValue);
  if (Number.isNaN(dateObj.getTime())) return String(dateValue);
  return dateObj.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatLeadTimeLabel(timeValue?: string) {
  if (!timeValue) return "--";
  const raw = String(timeValue).trim();
  if (!raw) return "--";
  if (raw.includes("AM") || raw.includes("PM")) return raw;
  const parts = raw.split(":");
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, "0");
    const mm = parts[1].padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return raw;
}

const CommunicationAssign: React.FC<{
  onAddClick?: () => void;
}> = ({ onAddClick }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherLocal, setSelectedTeacherLocal] = useState<Teacher | null>(null);
  const [commDate, setCommDate] = useState("");
  const [commTime, setCommTime] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [popupVisible, setPopupVisible] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);

  const channelOptions: ChannelOption[] = [
    { value: "Facebook", label: "Facebook" },
    { value: "WhatsApp", label: "WhatsApp" },
    { value: "Mail", label: "Gmail" },
    { value: "All", label: "All" },
  ];

  // ✅ Fetch Teachers


  const schoolCode = localStorage.getItem("schoolCode") || "";

  const fetchAllTeachers = async () => {
    if (!schoolCode) return;
    setLoadingTeachers(true);
    try {
      const [usersRes, campaignRes] = await Promise.all([
        axios.post("https://cleezoclass.com:4000/api/users", {
          schoolCode,
          user_type: "teacher",
        }),
        axios.get(`https://cleezoclass.com:4000/api/lead-staff?schoolCode=${encodeURIComponent(schoolCode)}`),
      ]);
      const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
      const campaignData = Array.isArray(campaignRes.data)
        ? campaignRes.data
        : Array.isArray(campaignRes.data?.leads)
          ? campaignRes.data.leads
          : Array.isArray(campaignRes.data?.data)
            ? campaignRes.data.data
            : [];
      setTeachers(mergeCampaignStaffMembers(usersData, campaignData));
    } catch (err) {
      console.error("Error loading teachers", err);
      setTeachers([]);
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    fetchAllTeachers();
  }, [schoolCode]);


  // ✅ Grid
  const teacherRows = Array.from(
    { length: Math.ceil(teachers.length / 6) },
    (_, i) => teachers.slice(i * 6, i * 6 + 6)
  );

  // ✅ Register
  const handleRegister = () => {
    const missingFields: string[] = [];

    if (!commDate) missingFields.push("communication date");
    if (!commTime) missingFields.push("communication time");
    if (channels.length === 0)
      missingFields.push("at least one communication channel");
    if (!selectedTeacherLocal) missingFields.push("a teacher");

    if (missingFields.length > 0) {
      setErrorMsg(`Kindly select ${missingFields.join(", ")}`);
      return;
    }

    try {
      const schedule: any[] = [];
      const startDate = new Date(`${commDate}T${commTime}`);

      for (let i = 0; i < 30; i++) {
        const sendDate = new Date(startDate);
        sendDate.setDate(startDate.getDate() + i);

        schedule.push({
          teacherId: getTeacherKey(selectedTeacherLocal),
          teacherName: getTeacherLabel(selectedTeacherLocal),
          phone: (selectedTeacherLocal as any)?.phone_no,
          email: (selectedTeacherLocal as any)?.email,
          date: sendDate.toISOString().split("T")[0],
          time: sendDate.toTimeString().split(" ")[0],
          channels,
          message: "Your daily advertisement",
          schoolCode,
        });
      }

      axios
        .post("https://cleezoclass.com:4000/api/schedule-messages", {
          schedule,
          schoolCode,
        })
        .then(() => {
          setErrorMsg("✅ Scheduled for 30 days successfully");
          setPopupVisible(false);
        })
        .catch(() => {
          setErrorMsg("❌ Failed to schedule messages");
        });
    } catch (error) {
      console.error(error);
      setErrorMsg("Something went wrong");
    }
  };

  // ✅ Outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setPopupVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="co-section-container">
      <div className="co-wrapper">
        {/* Header */}
       
        {/* Teachers */}
        <div className="tc-staffAssignSection">
          <div className="tc-staffHeader">
            <div className="Heading">Campaigning
Staff - Assign </div>
          </div>
                <Section title="" variant="marketing" className="campaignSection">
<div className="tickets-header-and-tabs">

  


  
</div>

      <div className="tickets-content">
        {activeTab === "staff" && (
          <div className="tc-staffAssignSection">
           
            {loadingTeachers && <p>Loading teachers...</p>}

            {!loadingTeachers && (
              <div className="tc-teacherGrid">
                {teacherRows.map((row, idx) => (
                  <div key={idx} className="tc-teacherRow">
                    {row.map((teacher) => (
                      <div
                        key={getTeacherSelectionKey(teacher)}
                        className={`tc-teacherCard tickets-clickable ${
                          selectedTeacherLocal &&
                          getTeacherSelectionKey(selectedTeacherLocal) === getTeacherSelectionKey(teacher)
                            ? "is-selected"
                            : ""
                        }`}
                        onClick={() => {
                          setSelectedTeacher(teacher as any);
                          setSelectedTeacherLocal(teacher as any);
                        }}
                      >
                        <div
                          className="tc-teacherAvatar"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTeacher(teacher as any);
                            setSelectedTeacherLocal(teacher as any);
                          }}
                        >
                          <FaUser size={50} color="#919191ff" />
                        </div>
                        <div className="tc-teacherName">{teacher.name}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "students" && (
          <div className="payment-student-list-panel tickets-student-panel">
            

            <div className="tickets-student-grid">
              {filteredStudents.length === 0 ? (
                <div className="payment-no-students">
                  {className ? "No students found" : "Please select a class and section"}
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="tickets-student-card tickets-clickable"
                    onClick={() => openTicketModal({ type: "student", student })}
                  >
                    {student.photo?.data ? (
                      <img
                        src={`https://cleezoclass.com:4000${bufferToPathString(
                          student.photo.data
                        )}`}
                        alt={student.name}
                        className="tickets-student-photo"
                      />
                    ) : (
                      <div className="tickets-student-photo-placeholder">
                        <FaUser size={20} color="#404040" />
                      </div>
                    )}
                    <span className="tickets-student-name">{student.name}</span>
                    <span className="tickets-student-id">ID: {student.id}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    

  
   </Section>   
         
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="error-popup">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg("")}>Close</button>
        </div>
      )}

      {/* Popup */}
      {selectedTeacherLocal && popupVisible && (
        <div className="co-popup" ref={popupRef}>
          <div className="co-popup-title">
            {getTeacherLabel(selectedTeacherLocal)}
          </div>

          <div className="co-popup-datetime">
            <input
              type="date"
              value={commDate}
              onChange={(e) => setCommDate(e.target.value)}
            />
            <input
              type="time"
              value={commTime}
              onChange={(e) => setCommTime(e.target.value)}
            />
          </div>

          <Select
            isMulti
            options={channelOptions}
            onChange={(selected: MultiValue<ChannelOption>) =>
              setChannels(selected.map((s) => s.value))
            }
          />

          <button type="button" onClick={handleRegister} className="co-popup-btn">
            Register
          </button>
        </div>
      )}
    </div>
  );
};


const CommunicationAssignSection: React.FC<{
  leads: Lead[];
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
  onAddClick?: () => void;
  onDigitalScheduleChange?: (schedule: {
    fromDate?: string;
    toDate?: string;
    time?: string;
    leadNames?: string[];
  }) => void;
}> = ({ leads, selectedLead, onSelectLead, onAddClick, onDigitalScheduleChange }) => {
  const [commDate, setCommDate] = useState<string>("");
  const [commTime, setCommTime] = useState<string>("");
  const [channels, setChannels] = useState<string[]>([]);
  const [popupVisible, setPopupVisible] = useState<boolean>(false);
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterRegNo, setFilterRegNo] = useState<string>("");
  const popupRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryUploaded, setGalleryUploaded] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const [galleryName, setGalleryName] = useState("");
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState<any>(null);
  const [sendFromDate, setSendFromDate] = useState("");
  const [sendToDate, setSendToDate] = useState("");
  const [sendFromTime, setSendFromTime] = useState("");
  const [sendToTime, setSendToTime] = useState("");
  const [sendAt, setSendAt] = useState("");
  const [sendMode, setSendMode] = useState<"single" | "all" | "auto">("single");
  const [sendLeadName, setSendLeadName] = useState("");
  const [sendLeadFrom, setSendLeadFrom] = useState("");
  const [sendLeadTo, setSendLeadTo] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [sendError, setSendError] = useState("");
  const resetGalleryModal = () => {
    setGalleryModalOpen(false);
    setSelectedGallery(null);
    setSendMode("single");
    setSendStatus("");
    setSendError("");
    setSendLeadName("");
    setSendLeadFrom("");
    setSendLeadTo("");
  };

  const fetchGallery = async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) return;
    try {
      const res = await fetch(
        `https://cleezoclass.com:4000/api/school-photos?schoolCode=${encodeURIComponent(schoolCode)}`
      );
      const data = await res.json();
      if (res.ok) setGalleryUploaded(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch gallery failed", err);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  const onChangeGalleryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length < 1 || selected.length > 20) {
      setGalleryError("Please select 1 to 20 images or videos.");
      setGalleryFiles([]);
      return;
    }
    const invalid = selected.filter(
      (file) => !file.type.startsWith("image/") && !file.type.startsWith("video/")
    );
    if (invalid.length > 0) {
      setGalleryError("Only image or video files are allowed.");
      setGalleryFiles([]);
      return;
    }
    const maxBytes = 50 * 1024 * 1024;
    const tooLarge = selected.find((file) => file.size > maxBytes);
    if (tooLarge) {
      setGalleryError("Each file must be 50MB or smaller.");
      setGalleryFiles([]);
      return;
    }
    setGalleryError("");
    setGalleryFiles(selected);
  };

  const handleGalleryUpload = async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
      setGalleryError("schoolCode not found");
      return;
    }
    if (!galleryFiles.length) {
      setGalleryError("Select 1 to 20 images or videos first");
      return;
    }
    setGalleryLoading(true);
    setGalleryError("");
    const formData = new FormData();
    formData.append("schoolCode", schoolCode);
    formData.append("lead_name", galleryName.trim());
    galleryFiles.forEach((f) => formData.append("photos", f));
    try {
      const res = await fetch("https://cleezoclass.com:4000/api/school-photos", {
        method: "POST",
        body: formData
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok) throw new Error(data?.error || data?.message || raw || "Upload failed");
      setGalleryFiles([]);
      await fetchGallery();
    } catch (err: any) {
      setGalleryError(err.message || "Upload failed");
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleOpenGalleryModal = (item: any) => {
    setSelectedGallery(item);
    setGalleryModalOpen(true);
    setSendMode("single");
    setSendStatus("");
    setSendError("");
  };

  const resolveGalleryId = (item: any) => {
    if (!item) return null;
    if (typeof item === "string" || typeof item === "number") return item;
    return item.photoId ?? item.photo_id ?? item.id ?? null;
  };

  const handleSendGallery = async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
      setSendError("schoolCode not found");
      return;
    }
    if (sendMode !== "auto" && !selectedGallery?.id) {
      setSendError("Select an image first");
      return;
    }
    if (!sendFromDate || !sendToDate) {
      setSendError("Select from date and to date");
      return;
    }
    if (sendFromDate > sendToDate) {
      setSendError("From date should be before or equal to To date");
      return;
    }
    setSendError("");
    setSendStatus("Sending...");
    let selectedDate = sendFromDate || "";
    let selectedTime = sendFromTime || "";
    if (sendAt) {
      const [atDate, atTimeRaw] = String(sendAt).split("T");
      if (atDate) selectedDate = atDate;
      if (atTimeRaw) selectedTime = atTimeRaw.slice(0, 5);
    }
    if (!selectedDate && commDate) selectedDate = commDate;
    if (!selectedTime && commTime) selectedTime = commTime;
    if (!selectedTime) {
      setSendError("Please select time");
      setSendStatus("");
      return;
    }
    const leadFromNumber = sendLeadFrom ? Number(sendLeadFrom) : null;
    const leadToNumber = sendLeadTo ? Number(sendLeadTo) : null;
    if (leadFromNumber !== null && (!Number.isInteger(leadFromNumber) || leadFromNumber < 1)) {
      setSendError("Lead From should be 1 or more");
      setSendStatus("");
      return;
    }
    if (leadToNumber !== null && (!Number.isInteger(leadToNumber) || leadToNumber < 1)) {
      setSendError("Lead To should be 1 or more");
      setSendStatus("");
      return;
    }
    if (leadFromNumber !== null && leadToNumber !== null && leadFromNumber > leadToNumber) {
      setSendError("Lead From should be less than or equal to Lead To");
      setSendStatus("");
      return;
    }
    const buildPosterTextFromItem = (item: any) => {
      const writeupText = String(item?.writeup || "").trim();
      const buttonLines = Array.isArray(item?.buttons)
        ? item.buttons
            .map((btn: any) => {
              const label = String(btn?.label || "").trim();
              const url = String(btn?.url || "").trim();
              if (!label && !url) return "";
              if (label && url) return `${label}: ${url}`;
              return label || url;
            })
            .filter(Boolean)
        : [];
      return [writeupText, ...buttonLines].filter(Boolean).join("\n").trim();
    };

    const sendById = async (photoId: string | number) => {
      const galleryItemForSend =
        galleryUploaded.find((item) => String(resolveGalleryId(item)) === String(photoId)) || null;
      const posterText = buildPosterTextFromItem(galleryItemForSend);
      const res = await fetch("https://cleezoclass.com:4000/api/school-photos/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolCode,
          photoId,
          leadName: sendLeadName,
          fromDate: sendFromDate,
          toDate: sendToDate,
          sendAt: sendAt || null,
          sendTime: selectedTime || null,
          scheduleFromTime: sendFromTime || selectedTime || null,
          galleryTarget,
          leadFrom: leadFromNumber,
          leadTo: leadToNumber,
          whatsappGapMinutes: whatsappLeadGapMinutes,
          posterMessage: posterText || null,
          message: posterText || null,
          caption: posterText || null,
          channels: ["whatsapp", "mail"],
          sendPoster: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Send failed");

      if (posterText) {
        try {
          const normalizedLeadName = String(sendLeadName || "").trim().toLowerCase();
          let textLeads = leads.filter((lead) => {
            const name = String(lead.lead_name || lead.refer_by || "").trim().toLowerCase();
            return normalizedLeadName ? name === normalizedLeadName : true;
          });
          if (leadFromNumber !== null || leadToNumber !== null) {
            const startIdx = Math.max((leadFromNumber || 1) - 1, 0);
            const endIdx = leadToNumber ? leadToNumber : textLeads.length;
            textLeads = textLeads.slice(startIdx, endIdx);
          }
          const scheduleDate = String(selectedDate || sendFromDate || "").trim();
          const scheduleTime = /^\d{2}:\d{2}$/.test(String(selectedTime || ""))
            ? `${selectedTime}:00`
            : String(selectedTime || "");

          if (textLeads.length > 0 && scheduleDate && scheduleTime) {
            const schedulePayload = textLeads.map((lead) => ({
              leadId: lead.id,
              leadName: lead.full_name,
              phone: lead.mobile_number || "",
              email: lead.email_id || "",
              date: scheduleDate,
              time: scheduleTime,
              channels: ["whatsapp"],
              message: posterText,
              schoolCode,
            }));
            await fetch("https://cleezoclass.com:4000/api/schedule-messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                schedule: schedulePayload,
                schoolCode,
              }),
            });
          }
        } catch (writeupErr) {
          console.warn("[Campaigning] writeup fallback scheduling failed", writeupErr);
        }
      }
      return data;
    };
    try {
      if (sendMode === "all") {
        const ids = galleryUploaded.map(resolveGalleryId).filter(Boolean) as Array<string | number>;
        if (ids.length === 0) throw new Error("No gallery images available");
        const chunkSize = 5;
        let totalLeads = 0;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const results = await Promise.allSettled(chunk.map((id) => sendById(id)));
          results.forEach((res) => {
            if (res.status === "fulfilled") {
              totalLeads += Number(res.value?.totalLeads || 0);
            }
          });
          setSendStatus(`Sent ${Math.min(i + chunk.length, ids.length)} of ${ids.length} images...`);
        }
        setSendStatus(`Sent all images to ${totalLeads} leads`);
      } else if (sendMode === "auto") {
        const normalizedLeadName = String(sendLeadName || "").trim().toLowerCase();
        let targetLeads = leads.filter((lead) => {
          const name = String(lead.lead_name || lead.refer_by || "").trim().toLowerCase();
          const matchesName = normalizedLeadName ? name === normalizedLeadName : true;
          return matchesName;
        });
        if (leadFromNumber !== null || leadToNumber !== null) {
          const startIdx = Math.max((leadFromNumber || 1) - 1, 0);
          const endIdx = leadToNumber ? leadToNumber : targetLeads.length;
          targetLeads = targetLeads.slice(startIdx, endIdx);
        }
        if (targetLeads.length === 0) throw new Error("No leads match filters");
        const payloadLeads = targetLeads.map((lead) => ({
          id: lead.id,
          full_name: lead.full_name,
          student_name: lead.student_name,
          reg_no: lead.reg_no,
          lead_admission_for: lead.lead_admission_for,
          mobile_number: lead.mobile_number,
          email_id: lead.email_id
        }));
        const res = await fetch("https://cleezoclass.com:4000/api/posters/send-generated", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolCode,
            leads: payloadLeads,
            galleryTarget,
            sendDate: selectedDate || null,
            sendTime: selectedTime || null,
            whatsappGapMinutes: whatsappLeadGapMinutes
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Poster send failed");
        if (Number(data?.scheduled || 0) > 0) {
          setSendStatus(`Scheduled ${data.scheduled} posters at ${selectedTime}`);
        } else {
          setSendStatus(`Sent posters to ${data.sent || 0} leads`);
        }
        if (data.failed) {
          setSendError(`Failed for ${data.failed} leads`);
        }
      } else {
        const data = await sendById(selectedGallery.id);
        setSendStatus(`Sent to ${data.totalLeads || 0} leads`);
      }
      if (onDigitalScheduleChange) {
        onDigitalScheduleChange({
          fromDate: sendFromDate || selectedDate,
          toDate: sendToDate || selectedDate,
          time: sendAt
            ? String(sendAt).split("T")[1] || selectedTime
            : sendFromTime
              ? `${sendFromTime}${sendToTime ? ` - ${sendToTime}` : ""}`
              : selectedTime,
          leadNames: sendLeadNames,
        });
      }
    } catch (err: any) {
      setSendError(err.message || "Send failed");
      setSendStatus("");
    }
  };

  const channelOptions: ChannelOption[] = [
    { value: "Facebook", label: "facebook" },
    { value: "WhatsApp", label: "Whatsapp" },
    { value: "Mail", label: "Gmail" },
    { value: "All", label: "All" },
  ];

  const handleRegister = () => {
    try {
      const missingFields = [];
      if (!commDate) missingFields.push("communication date");
      if (!commTime) missingFields.push("communication time");
      if (channels.length === 0) missingFields.push("at least one communication channel");
      if (!selectedLead) missingFields.push("a lead");

      if (missingFields.length > 0) {
        setErrorMsg(`Kindly select ${missingFields.join(", ")} to proceed.`);
        return;
      }

      const schoolCode = localStorage.getItem("schoolCode");
      const schedule: any[] = [];
      const startDate = new Date(commDate + "T" + commTime);

      for (let i = 0; i < 30; i++) {
        const sendDate = new Date(startDate);
        sendDate.setDate(startDate.getDate() + i);
        schedule.push({
          leadId: selectedLead.id,
          leadName: selectedLead.full_name,
          phone: selectedLead.mobile_number,
          email: selectedLead.email_id,
          date: sendDate.toISOString().split("T")[0],
          time: sendDate.toTimeString().split(" ")[0],
          channels,
          message: "Your daily advertisement",
          schoolCode,
        });
      }

      axios
        .post(`https://cleezoclass.com:4000/api/schedule-messages`, { schedule, schoolCode })
        .then(() => {
          setErrorMsg("Communication has been successfully scheduled for the next 30 days.");
          setPopupVisible(false);
        })
        .catch((err) => {
          console.error(err);
          setErrorMsg("Unable to schedule messages at this moment. Kindly try again later.");
        });
    } catch (error) {
      console.error(error);
      setErrorMsg("Something went wrong while scheduling communication. Please try again.");
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchRegNo = !filterRegNo || lead.reg_no?.toString().includes(filterRegNo);
    const matchDate = !filterDate || lead.date.split("T")[0] === filterDate;
    return matchRegNo && matchDate;
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setPopupVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="co-section-container">
      <div className="co-wrapper">
        <div className="co-filter-row">
          <div className="Heading">Campaigning
Digital - Gallery</div>

        </div>

        <div className="campaign-gallery">
          <div className="campaign-gallery-row">
            <div
              className="campaign-gallery-thumb campaign-gallery-thumb-empty"
              onClick={() => galleryFileInputRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed #cbd5e1",
                background: "#f8fafc",
                color: "#64748b",
                cursor: "pointer"
              }}
            >
              Add
            </div>
            {galleryUploaded
              .filter((item) => !/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(String(item.file_name || item.file_path || "")))
              .map((item) => (
              <div
                className="campaign-gallery-thumb"
                key={item.id}
                onClick={() => handleOpenGalleryModal(item)}
              >
                {/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(String(item.file_name || item.file_path || "")) ? (
                  <video
                    className="campaign-modal-image"
                    src={`https://cleezoclass.com:4000${item.file_path}`}
                    muted
                    playsInline
                    preload="metadata"
                    onClick={() => handleOpenGalleryModal(item)}
                  />
                ) : (
                  <img
                    src={`https://cleezoclass.com:4000${item.file_path}`}
                    alt={item.file_name}
                    onClick={() => handleOpenGalleryModal(item)}
                  />
                )}
              </div>
            ))}
          </div>
          {galleryUploaded.some((item) => /\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(String(item.file_name || item.file_path || ""))) && (
            <div className="campaign-gallery-video-row">
              {galleryUploaded
                .filter((item) => /\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(String(item.file_name || item.file_path || "")))
                .map((item) => (
                  <div
                    className="campaign-gallery-thumb"
                    key={`video-${item.id}`}
                    onClick={() => handleOpenGalleryModal(item)}
                  >
                    <video
                      className="campaign-modal-image"
                      src={`https://cleezoclass.com:4000${item.file_path}`}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  </div>
                ))}
            </div>
          )}

          <div className="campaign-gallery-controls">
            <div className="expense-input-field">
            <input
              type="text"
              className="btn-dropdown-FeesManagement"
              placeholder="Name"
              value={galleryName}
              onChange={(e) => setGalleryName(e.target.value)}
              style={{marginTop:"20px"}}
            />
</div>
            <button
              type="button"
              className="btn-solid"
              onClick={() => galleryFileInputRef.current?.click()}
            >
upload            </button>
            <button
              type="button"
              className="btn-solid"
              onClick={handleGalleryUpload}
              disabled={galleryLoading}
            >
              {galleryLoading ? "Uploading..." : "Submit"}
            </button>
          </div>

          <input
            ref={galleryFileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onChangeGalleryFiles}
            style={{ display: "none" }}
          />

          {galleryError && <div className="campaign-bulk-error">{galleryError}</div>}

          {galleryFiles.length > 0 && (
            <div className="campaign-gallery-files">
              {galleryFiles.map((f) => (
                <span key={f.name + f.size}>{f.name}</span>
              ))}
            </div>
          )}
        </div>

        
 
      </div>
      <ErrorPopup message={errorMsg} onClose={() => setErrorMsg("")} />

      {selectedLead && popupVisible && (
        <div ref={popupRef} className="co-popup">
          <div className="co-popup-title">Communications</div>
          <div className="co-popup-datetime">
            <input
              type="date"
              value={commDate}
              onChange={(e) => setCommDate(e.target.value)}
              className="co-popup-input"
            />
            <input
              type="time"
              value={commTime}
              onChange={(e) => setCommTime(e.target.value)}
              className="co-popup-input"
            />
          </div>
          <div className="co-popup-channel">
            <div className="co-popup-input">
              <Select
                isMulti
                options={channelOptions}
                onChange={(selected: MultiValue<ChannelOption>) =>
                  setChannels(selected.map((s) => s.value))
                }
              />
            </div>
            <button type="button" onClick={handleRegister} className="co-popup-btn">
              Register
            </button>
          </div>
        </div>
      )}

      {galleryModalOpen && createPortal(
        <div className="campaign-modal-overlay" onClick={resetGalleryModal}>
          <div className="campaign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="campaign-modal-header">
              <h4>Assign Gallery</h4>
              <button type="button" className="campaign-modal-close" onClick={resetGalleryModal}>
                ×
              </button>
            </div>

            <div className="campaign-modal-body">
              {selectedGallery?.file_path ? (
                /\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(String(selectedGallery.file_name || selectedGallery.file_path || "")) ? (
                  <video
                    className="campaign-modal-image"
                    src={`https://cleezoclass.com:4000${selectedGallery.file_path}`}
                    controls
                    playsInline
                  />
                ) : (
                  <img
                    className="campaign-modal-image"
                    src={`https://cleezoclass.com:4000${selectedGallery.file_path}`}
                    alt={selectedGallery.file_name}
                  />
                )
              ) : (
                <div className="campaign-modal-image" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", background: "#f8fafc" }}>
                  Auto-generate
                </div>
              )}

                <div className="campaign-modal-row3">
                  <div className="campaign-modal-field">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={sendFromDate}
                      onChange={(e) => setSendFromDate(e.target.value)}
                    />
                  </div>

                  <div className="campaign-modal-field">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={sendToDate}
                      onChange={(e) => setSendToDate(e.target.value)}
                    />
                  </div>

                  <div className="campaign-modal-field">
                    <label>Time</label>
                    <input
                      type="time"
                      value={sendFromTime}
                      onChange={(e) => setSendFromTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="campaign-modal-row3">
                  <div className="campaign-modal-field">
                    <label>Lead From</label>
                    <input
                      type="number"
                      min={1}
                      value={sendLeadFrom}
                      onChange={(e) => setSendLeadFrom(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="campaign-modal-field">
                    <label>Lead To</label>
                    <input
                      type="number"
                      min={1}
                      value={sendLeadTo}
                      onChange={(e) => setSendLeadTo(e.target.value)}
                      placeholder={String(leads.length || "")}
                    />
                  </div>
                  <div className="campaign-modal-field" />
                </div>
              <div className="campaign-modal-row">
                <label>Lead Name</label>
                <select value={sendLeadName} onChange={(e) => setSendLeadName(e.target.value)}>
                  <option value="">All</option>
                  {leadNameCounts.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              {sendError && <div className="campaign-modal-error">{sendError}</div>}
              {sendStatus && <div className="campaign-modal-success">{sendStatus}</div>}
            </div>

            <div className="campaign-modal-footer">
              <button type="button" className="btn-solid" onClick={handleSendGallery}>
                Schedule
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

  const [activeTab, setActiveTab] = useState<"staff" | "students">("staff");

  const fetchLeads = () => {
    const schoolCodeRaw = String(localStorage.getItem("schoolCode") || "").trim();
    const schoolCode =
      schoolCodeRaw &&
      schoolCodeRaw.toLowerCase() !== "null" &&
      schoolCodeRaw.toLowerCase() !== "undefined"
        ? schoolCodeRaw
        : "";
    if (!schoolCode) return;
    fetch(`https://cleezoclass.com:4000/api/api/leads?schoolCode=${encodeURIComponent(schoolCode)}`)
      .then(res => res.json())
      .then(data => {
        const leadsArray = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.leads)
            ? (data as any).leads
            : Array.isArray((data as any)?.data)
              ? (data as any).data
              : [];

        const normalizedLeads = leadsArray.map((lead: any) => ({
          ...lead,
          student_name: lead.student_name || lead.full_name || "",
          full_name: lead.full_name || lead.student_name || "",
          lead_name: lead.lead_name || "",
        }));
        setLeads(normalizedLeads);
        if (DEBUG_CAMPAIGNING) {
          const sample = normalizedLeads.length > 0 ? normalizedLeads[0] : null;
          console.debug("[Campaigning] leads fetched:", {
            total: normalizedLeads.length,
            sampleKeys: sample ? Object.keys(sample) : [],
            sample,
          });
        }
      })
      .catch(err => console.error("Fetch Error:", err));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchCampaignStatus = useCallback(async () => {
    const schoolCodeRaw = String(localStorage.getItem("schoolCode") || "").trim();
    const schoolCode =
      schoolCodeRaw &&
      schoolCodeRaw.toLowerCase() !== "null" &&
      schoolCodeRaw.toLowerCase() !== "undefined"
        ? schoolCodeRaw
        : "";
    if (!schoolCode) {
      setCampaignStatusSentLeads([]);
      setCampaignStatusScheduledLeads([]);
      return;
    }

    try {
      const res = await fetch(
        `https://cleezoclass.com:4000/api/frontdesk/campaign-status?schoolCode=${encodeURIComponent(
          schoolCode
        )}&limit=300`
      );
      const data = await res.json();
      const rows = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data)
          ? data
          : [];
      const scheduledRows = Array.isArray(data?.scheduledRows) ? data.scheduledRows : rows;
      setCampaignStatusSentLeads(rows);
      setCampaignStatusScheduledLeads(scheduledRows);
    } catch (err) {
      console.error("Fetch campaign status failed:", err);
      setCampaignStatusSentLeads([]);
      setCampaignStatusScheduledLeads([]);
    }
  }, []);

  useEffect(() => {
    fetchCampaignStatus();
  }, [fetchCampaignStatus]);

  // --- Staff tab state ---
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // --- Students tab state ---
  const [classList, setClassList] = useState<any[]>([]);
  const [sectionMap, setSectionMap] = useState<any[]>([]);
  const [selectedClassSection, setSelectedClassSection] = useState<string>("");
  const [className, setClassName] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketTarget, setTicketTarget] = useState<{
    type: "teacher" | "student";
    teacher?: Teacher;
    student?: Student;
  } | null>(null);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketSuccess, setTicketSuccess] = useState("");
  const [ticketError, setTicketError] = useState("");

  const schoolCode = localStorage.getItem("schoolCode") || "";

  const fetchAllTeachers = async () => {
    if (!schoolCode) return;
    setLoadingTeachers(true);
    try {
      const res = await axios.post("https://cleezoclass.com:4000/api/users", {
        schoolCode,
        user_type: "teacher",
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setTeachers(data);
    } catch (err) {
      console.error("Error loading teachers", err);
      setTeachers([]);
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    fetchAllTeachers();
  }, [schoolCode]);

  const fetchMetadata = async () => {
    if (!schoolCode) return;
    setDropdownLoading(true);
    try {
      const [classRes, sectionRes] = await Promise.all([
        axios.get(`${API_BASE}/classes?schoolCode=${schoolCode}`),
        axios.get(`${API_BASE}/sectionFilter?schoolCode=${schoolCode}`),
      ]);

      const classesFromAPI = Array.isArray(classRes.data)
        ? classRes.data
        : classRes.data?.classes || [];
      const sectionsFromAPI = Array.isArray(sectionRes.data)
        ? sectionRes.data
        : sectionRes.data?.sections || [];

      setClassList(classesFromAPI);
      setSectionMap(sectionsFromAPI);
    } catch (err) {
      console.error("Error loading class/section metadata", err);
      setClassList([]);
      setSectionMap([]);
    } finally {
      setDropdownLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [schoolCode]);

  useEffect(() => {
    if (!selectedClassSection) {
      setClassName("");
      setSection("");
      return;
    }
    const [cls, sec] = selectedClassSection.split("_");
    setClassName(cls || "");
    setSection(sec || "");
  }, [selectedClassSection]);

  useEffect(() => {
    if (!className || !section || !schoolCode) {
      setStudents([]);
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
      });
  }, [className, section, schoolCode]);

  const fetchTickets = async () => {
    if (!schoolCode) return;
    setLoadingTickets(true);
    try {
      const params = new URLSearchParams();
      params.set("schoolCode", schoolCode);
      if (activeTab === "staff") params.set("type", "teacher");
      if (activeTab === "students") params.set("type", "student");
      if (className) params.set("className", className);
      if (section) params.set("section", section);
      const res = await axios.get(
        `https://cleezoclass.com:4000/api/tickets?${params.toString()}`
      );
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading tickets", err);
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [activeTab, className, section, schoolCode]);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return students;
    return students.filter((student) =>
      student.name?.toLowerCase().includes(term) || String(student.id).includes(term)
    );
  }, [students, searchTerm]);

  const getClassLabel = (cls: any) => {
    if (cls == null) return "";        <span className="navItem">Admissions</span>

    if (typeof cls === "string" || typeof cls === "number") return String(cls);
    return (
      cls.class_name ||
      cls.className ||
      cls.class ||
      cls.name ||
      cls.label ||
      ""
    );
  };

  const derivedClasses = useMemo(() => {
    if (classList.length > 0) return classList;
    const classSet = new Set<string>();
    sectionMap.forEach((item: any) => {
      const classValue = item?.class_name || item?.class || item?.className;
      if (classValue != null) classSet.add(String(classValue));
    });
    return Array.from(classSet);
  }, [classList, sectionMap]);

  const teacherRows: Teacher[][] = [];
  for (let i = 0; i < teachers.length; i += 6) {
    teacherRows.push(teachers.slice(i, i + 6));
  }

  const openTicketModal = (payload: {
    type: "teacher" | "student";
    teacher?: Teacher;
    student?: Student;
  }) => {
    setTicketTarget(payload);
    setTicketTitle("");
    setTicketDescription("");
    setTicketSuccess("");
    setTicketError("");
    setShowTicketModal(true);
  };

  const closeTicketModal = () => {
    setShowTicketModal(false);
    setTicketTarget(null);
  };

  const handleCreateTicket = async () => {
    if (!ticketTarget || !ticketTitle.trim() || !ticketDescription.trim()) return;
    try {
      const payload = {
        schoolCode,
        ticket_type: ticketTarget.type,
        teacher_id: ticketTarget.teacher?.teacher_id || null,
        teacher_name: ticketTarget.teacher?.teacher_name || null,
        student_id: ticketTarget.student?.id || null,
        student_name: ticketTarget.student?.name || null,
        class_name: className || null,
        section: section || null,
        title: ticketTitle.trim(),
        description: ticketDescription.trim(),
      };
      await axios.post("https://cleezoclass.com:4000/api/tickets", payload);
      setTicketSuccess("Ticket created successfully.");
      setTicketError("");
      setTimeout(() => {
        closeTicketModal();
      }, 900);
      fetchTickets();
    } catch (err) {
      console.error("Error creating ticket", err);
      setTicketError("Failed to create ticket. Please try again.");
      setTicketSuccess("");
    }
  };

  interface SectionProps {
    title: string;
    children: React.ReactNode;
    variant?: "default" | "lead" | "marketing";
    style?: React.CSSProperties;
    className?: string; // <-- add this
  }
  const Section: React.FC<SectionProps> = ({ title, children, variant = "default", style = {}, className = "" }) => {
    const compactVariants = ["lead", "marketing"];
    const containerClass = compactVariants.includes(variant)
      ? "sectionContainer1"
      : "sectionContainer";
  
    return (
      <div className={`${containerClass} ${className}`} style={style}>
        <div className="sectionTitle">{title}</div>
        {children}
      </div>
    );
  };
  
    const [schoolName, setSchoolName] = useState("Loading...");
  const [currentDbName, setCurrentDbName] = useState(localStorage.getItem("schoolCode") || "");
const [instituteAddress, setInstituteAddress] = useState("");
  const [logo, setLogo] = useState("/default-logo.png");

useEffect(() => {
  if (!currentDbName) {
    console.log("❌ No currentDbName found in localStorage");
    return;
  }

  const fetchInstituteInfo = async (retriesLeft = 1) => {
    try {
      console.log("➡️ Fetching institute info for dbName:", currentDbName);
      const res = await fetch(`https://cleezoclass.com:4000/api/institute?dbName=${currentDbName}`);
      console.log("📌 Response received, status:", res.status);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      console.log("📂 Institute data received:", data);
      setSchoolName(data.institute_name || currentDbName);
      setLogo(data.logo || "/default-logo.png");
      setInstituteAddress(data.address || "Address not available");
    } catch (err) {
      console.error("🔥 Error fetching institute info:", err);
      if (retriesLeft > 0) {
        return fetchInstituteInfo(retriesLeft - 1);
      }
      setSchoolName(currentDbName || "Unknown School");
      setLogo("/default-logo.png");
      setInstituteAddress("Address not available");
    }
  };

  fetchInstituteInfo(1);
}, [currentDbName]);

  const sidebarItems = [
    {
      key: "home",
      label: "Home",
      icon: homeIcon,
      iconAlt: "home",
      active: activeSidebar === "home",
      onClick: () => {
        setActiveSidebar("home");
        navigate("/FrontDeskDashboard");
      },
    },
    {
      key: "users",
      label: "Campaigning",
      icon: usersIcon,
      iconAlt: "users",
      active: activeSidebar === "users",
      onClick: () => {
        setActiveSidebar("users");
        navigate("/FrontDeskCampaigning");
      },
    },
    {
      key: "analytics",
      label: "Admissions",
      icon: chartIcon,
      iconAlt: "chart",
      active: activeSidebar === "analytics",
      onClick: () => {
        setActiveSidebar("analytics");
        openModal("AdmissionCRM", "Admissions");
      },
    },
    {
      key: "staff",
      label: "Communication",
      icon: CommunicationIcon,
      iconAlt: "staff",
      active: activeSidebar === "staff",
      onClick: () => {
        setActiveSidebar("staff");
        openModal("Communication", "Communication");
      },
    },
    {
      key: "settings",
      label: "Enrollments",
      icon: settingsIcon,
      iconAlt: "settings",
      active: activeSidebar === "settings",
      onClick: () => {
        setActiveSidebar("settings");
        openModal("AdmissionEnrollment", "AdmissionEnrollment");
      },
    },
    {
      key: "reports",
      label: "Reports",
      icon: reportSideIcon,
      iconAlt: "reports",
      active: activeSidebar === "reports",
      onClick: () => {
        setActiveSidebar("reports");
        setActiveNav("reports");
        navigate("/FrontDeskReport");
      },
    },
  ];

  const topbarTabs = [
    {
      key: "dashboard",
      label: "Dashboard",
      active: activeNav === "dashboard",
      onClick: () => {
        setActiveNav("dashboard");
        navigate("/FrontDeskDashboard");
      },
    },
    {
      key: "campaigning",
      label: "Campaigning",
      active: activeNav === "campaigning",
      onClick: () => {
        setActiveNav("campaigning");
        navigate("/FrontDeskCampaigning");
      },
    },
    {
      key: "admissions",
      label: "Admissions",
      active: activeNav === "admissions",
      onClick: () => {
        setActiveNav("admissions");
        setActiveSidebar("analytics");
        openModal("AdmissionCRM", "Admissions");
      },
    },
    {
      key: "reports",
      label: "Reports",
      active: activeNav === "reports",
      onClick: () => {
        setActiveNav("reports");
        navigate("/FrontDeskReport");
      },
    },
  ];

  const topbarRight = (
    <div ref={userDropdownRef} className="header-profile-wrap">
      <button
        type="button"
        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
        className="dashboard-user-btn accountant-user-btn"
        aria-label="Account"
      >
        <FaUser className="dashboard-user-icon accountant-user-icon" />
      </button>

      {userDropdownOpen && userInfo && (
        <div className="header-profile-dropdown">
          <div className="header-profile-card">
            <div className="header-profile-avatar">
              {userInfo?.photo ? (
                <img
                  src={userInfo.photo}
                  alt="Profile"
                  className="header-profile-avatar-image"
                />
              ) : (
                <FaUser className="header-profile-avatar-fallback" />
              )}
            </div>
            <div className="header-profile-name">{userInfo.name}</div>
          </div>
          <hr className="header-profile-divider" />
          <div className="header-profile-info">
            <div><strong>Designation:</strong> {userInfo.designation}</div>
            <div><strong>Gender:</strong> {userInfo.gender}</div>
            <div><strong>Phone:</strong> {userInfo.phone_no}</div>
            <div className="header-profile-email"><strong>Email:</strong> {userInfo.email}</div>
            <div><strong>School Name:</strong> {schoolName}</div>
            <div><strong>School Address:</strong> {instituteAddress}</div>
          </div>
          <button type="button" onClick={handleLogout} className="header-profile-logout">
            Logout
          </button>
        </div>
      )}
    </div>
  );

 return (
  <>
    <Modal isOpen={isModalOpen} title={modalTitle} onClose={closeModal}>
      {modalContent}
    </Modal>
    <DashboardLayout
      pageClassName="frontdesk-campaigning-screen frontdesk-dashboard-page"
      lockViewport={false}
      sidebarItems={sidebarItems}
      topbarTabs={topbarTabs}
      logoSrc={schoolLogo}
      logoAlt="Logo"
      instituteName={schoolName}
      topbarRight={topbarRight}
      footerLogoSrc={abcLogo}
      footerLogoAlt="Cleezo Class"
    >
      <div className="accountant-grid">


    {/* GREETING */}
    <div className="greetingRow accountant-row accountant-row-top">

     <div className="greetingBox">
<h2>Hi, {userInfo?.name || "User"}!</h2>
  <div className="greetingList">
    <span>Check Lead Status</span>
    <span>Assign Communications</span>
    <span>Assign Counsellor</span>
  </div>
</div>

      <div className="accountant-task-card accountant-card">
    <div className="taskCardContent">
      <TaskOfTheDay />
    </div>
  </div>

      <div className="accountant-mini-cards">

        {/* <div className="miniCard" onClick={() => setActiveMiniPanel("timeline")}>Timeline</div>
        <div className="miniCard" onClick={() => setActiveMiniPanel("followup")}>
          Follow-up
        </div>
        <div className="miniCard">Assistant</div> */}
<div className="accountant-quick-card accountant-card accountant-quick-card-clickable" onClick={() => setActiveMiniPanel("timeline")}>
    <img src={timelineIcon} alt="Timeline" />
    <h4>Timeline</h4>
    <p>Campaigning list</p>
  </div>

  <div className="accountant-quick-card accountant-card accountant-quick-card-clickable" onClick={() => setActiveMiniPanel("followup")}>
    <img src={followupIcon} alt="Follow-up" />
    <h4>Follow-up</h4>
    <p>Assigned Lead</p>
  </div>

  <div className="accountant-quick-card accountant-card accountant-quick-card-clickable" onClick={() => setActiveMiniPanel("assistant")}>
    <img src={assistantIcon} alt="Assistant" />
    <h4>Assistant</h4>
    <p>Daily Activity check</p>
  </div>
      </div>
 
    </div>


    {/* MAIN GRID */}
    <div className="accountant-row accountant-row-middle campaigning-three-grid">

                <div className="accountant-collect-card accountant-card fd-campaign-content-card admissions-card">

          <div className="admissions-card-header">
            <div className="admissions-left">
              <span className="Heading">Campaigning
  Digital - Assign</span>
              
            </div>
            <div className="campaign-assign-total">
              <span className="campaign-assign-total-value">{communicationDigitalLeads.length}</span>
              <span className="normalText">Total Leads</span>
            </div>
           
          </div>
  
          <div className="campaign-assign-content">
            <div className="campaign-assign-left">
              <div className="campaign-bulk-upload">
                <div className="blockText">Bulk Uploads</div>
                <div className="campaign-bulk-fields">
  
                  <div className="expense-input-field">
                  <input
                    type="text"
                    className="btn-dropdown-FeesManagement"
                    placeholder="Name"
                      ref={leadNameInputRef}
                    defaultValue={leadNameInput}
                  /></div>
  <div className="expense-input-field">
                  <input
                    type="text"
                    className="btn-dropdown-FeesManagement"
                    placeholder="Dist. / City / Town"
                      ref={locationInputRef}
                    defaultValue={locationInput}
                  /></div>
                </div>
  
                <div className="campaign-bulk-row">
                  <label className="btn-solid1 campaign-bulk-action campaign-bulk-upload-btn">
                    Upload
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      hidden
                    />
                  </label>
  
                  <button
                    type="button"
                    className="btn-solid campaign-bulk-action campaign-bulk-submit-btn"
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Submit"}
                  </button>
                </div>
  
              <div className="campaign-bulk-row campaign-bulk-downloadRow">
                <button
                  type="button"
                  className="campaign-bulk-template-link"
                  onClick={handleTemplateOpen}
                  aria-label="Open bulk upload template"
                  title="Open bulk upload template"
                >
                  <img src={formatDownloadIcon} alt="Format Download" />
                  <span>.xlsx</span>
                </button>
                <div className="campaign-bulk-justification">
                  Open the template to upload in correct format.
                </div>
              </div>
                {status && <div className="campaign-bulk-success">{status}</div>}
                {error && <div className="campaign-bulk-error">{error}</div>}
              </div>
  
              <div className="campaign-bulk-list-wrap has-leads">
                {selectedBulkLead ? (
                  <div className="campaign-bulk-selector">
                    <button
                      type="button"
                      ref={bulkLeadSummaryRef}
                      className="campaign-bulk-summary"
                      onClick={() => setBulkLeadDropdownOpen((prev) => !prev)}
                      aria-expanded={bulkLeadDropdownOpen}
                      aria-haspopup="listbox"
                    >
                      <span className="campaign-bulk-dot" />
                      <span className="campaign-bulk-summary-text">
                        {selectedBulkLead.leadName || "-"}
                      </span>
                      <span className="campaign-bulk-summary-count">
                        {selectedBulkLead.count} {selectedBulkLead.count === 1 ? "Lead" : "Leads"}
                      </span>
                      <span
                        className={`campaign-bulk-summary-chevron ${
                          bulkLeadDropdownOpen ? "is-open" : ""
                        }`}
                      >
                        ⌄
                      </span>
                    </button>
                    {(() => {
                      const schedule = getBulkLeadSchedule(selectedBulkLead.leadName) as {
                        fromDate?: string;
                        toDate?: string;
                        time?: string;
                      };
                      const fromDate = schedule.fromDate || selectedBulkLead.fromDate || selectedBulkLead.date || "";
                      const toDate = schedule.toDate || selectedBulkLead.toDate || selectedBulkLead.date || "";
                      const time = schedule.time || selectedBulkLead.time || "";
                      return (
                        <div className="campaign-bulk-dropdown-item-meta">
                          From Date: {fromDate ? formatLeadDateLabel(fromDate) : "-"} | To Date:{" "}
                          {toDate ? formatLeadDateLabel(toDate) : "-"} | Time:{" "}
                          {time ? formatLeadTimeLabel(time) : "-"}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="campaign-bulk-empty">No leads available</div>
                )}
              </div>
            </div>
  
            <div className="campaign-assign-right">
              <div className="campaign-single-upload">
                <div className="blockText">Single Uploads</div>
              <button
                type="button"
                className="btn-solid"
                  style={{marginLeft:'-4%'}}
                onClick={() => {
                  setSingleLeadError("");
                  setSingleLeadStatus("");
                    setSingleLeadFormKey((prev) => prev + 1);
                  setSingleLeadModalOpen(true);

                }}
              >
                Enter
              </button>
              
            </div>
          </div>
          </div>
          
        </div>

      <div className="accountant-outstanding-card accountant-card fd-campaign-content-card">
        <StableCommunicationAssignSection
          leads={communicationDigitalLeads}
          selectedLead={selectedLead}
          onSelectLead={setSelectedLead}
          onAddClick={() => openModal("Communication", "Communication Assign")}
          leadNameCounts={leadNameCounts}
          galleryTarget="digital"
          title="Campaigning Digital - Gallery"
          autoImageDisabled={autoImageDisabledDigital}
          onAutoImageDisabledChange={(disabled) => updateAutoImageSetting("digital", disabled)}
          onDigitalScheduleChange={() => {
            // Backend-only schedule display in Bulk Uploads.
            // Refresh now and once after a short delay for async DB writes.
            fetchCampaignStatus();
            window.setTimeout(() => {
              fetchCampaignStatus();
            }, 2500);
          }}
        />
      </div>
 <div className="accountant-feetype-card accountant-card fd-campaign-content-card admissions-card">
        {activeMiniPanel === "followup" ? (
          <div className="co-digital-list">
            <LeadsTable
              variant="campaigning"
              embedded
              onRowClick={(lead) => navigate(`/FrontDeskReport?report=followup&leadId=${encodeURIComponent(String(lead.id))}`)}
            />
          </div>
        ) : activeMiniPanel === "assistant" ? (
          renderAssistantPanel("Lead Predictions", digitalPredictionSummary)
        ) : (
          <Section title="" variant="marketing" className="campaignSection">
        <div className="campaignstatusHeader">

    <div className="Heading">
      Communication Digital
    </div>



    <div className="leadsCount" style={{ marginTop: 4 }}>
   <span className="campaign-assign-total-value">    {digitalSentMonthCount} </span><span className="blockText">Sent</span>
   <span className="blockText" style={{ marginLeft: 8 }}>Left out of 30: {digitalLeftOutOfThirty}</span>
    <div className="campaign-info-row">
      <div className="normalText">
        <span>{campaignStatusRangeLabel}</span>
      </div>
    </div>

    </div>

</div>
            <div className="co-digital-list">
              {monthDigitalStatusRows.map((lead, index) => {
                const schedule = effectiveDigitalLeadSchedules[getLeadScheduleKey(lead)] || {};
                const formattedDate = formatLeadDateLabel(schedule.fromDate || lead.date);
                const formattedTime = formatLeadTimeLabel(schedule.time || lead.lead_time);
                const isMail = String(lead.entry_type || "").toLowerCase().includes("mail");
                const showConnector = index < monthDigitalStatusRows.length - 1;
                const sourceName = lead.lead_name || lead.refer_by || "-";
                const channelText = isMail ? "gmail" : "WhatsApp";
                const contactText = isMail ? (lead.email_id || "--") : (lead.mobile_number || "--");
                return (
                  <div
                    key={`${lead.id}-${lead.entry_type || "channel"}-${index}`}
                    className="co-digital-row"
                    onClick={() => {
                      if (activeMiniPanel === "followup") {
                        navigate(`/FrontDeskReport?report=followup&leadId=${encodeURIComponent(String(lead.id))}`);
                      }
                    }}
                    style={{ cursor: activeMiniPanel === "followup" ? "pointer" : "default" }}
                  >
                    <div className="co-digital-left">
                      <div className="co-digital-left-time">{formattedDate}</div>
                      <div className="co-digital-left-time">{formattedTime}</div>
                    </div>

                    <div className="co-digital-channel-col">
                      <div className={`co-digital-channel ${isMail ? "co-digital-channel-g" : "co-digital-channel-w"}`}>
                        {isMail ? "G" : "W"}
                      </div>
                      {showConnector && <span className="co-digital-channel-connector" />}
                    </div>

                    <div className="normalText">
                      {lead.full_name || "Lead"} [{sourceName}] - Digital sent {channelText} template / Contact: {contactText}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>


    </div>



    {/* SECOND GRID */}
    <div className="accountant-row accountant-row-middle campaigning-three-grid">

       <div className="accountant-collect-card accountant-card fd-campaign-content-card">
        <StableCommunicationAssign
          onAddClick={() => openModal("Communication", "Communication Assign")}
          activeTab={activeTab}
          filteredStudents={filteredStudents}
          leads={leads}
          classNameValue={className}
          openTicketModal={openTicketModal}
          onSelectTeacher={setSelectedTeacher}
        />
      </div>


      <div className="accountant-outstanding-card accountant-card fd-campaign-content-card">
        <StableCommunicationAssignSection
          leads={teacherFilteredLeads}
          selectedLead={selectedLead}
          onSelectLead={setSelectedLead}
          onAddClick={() => openModal("Communication", "Communication Assign")}
          leadNameCounts={leadNameCounts}
          galleryTarget="staff"
          title="Campaigning Staff - Gallery"
          autoImageDisabled={autoImageDisabledStaff}
          onAutoImageDisabledChange={(disabled) => updateAutoImageSetting("staff", disabled)}
        />
      </div>

      <div className="accountant-feetype-card accountant-card fd-campaign-content-card admissions-card">
        {activeMiniPanel === "followup" ? (
          <div className="co-staff-list">
            <LeadsTable
              variant="campaigning"
              embedded
              onRowClick={(lead) => navigate(`/FrontDeskReport?report=followup&leadId=${encodeURIComponent(String(lead.id))}`)}
            />
          </div>
        ) : activeMiniPanel === "assistant" ? (
          renderAssistantPanel("Staff Predictions", staffPredictionSummary)
        ) : (
          <Section title="" variant="marketing" className="campaignSection">
            <div className="campaignstatusHeader">
              <div className="Heading">Communication Staff</div>
              <div className="leadsCount">
                <span className="campaign-assign-total-value">{staffSentMonthCount}</span>{" "}
                <span className="blockText">Sent</span>
                <span className="blockText" style={{ marginLeft: 8 }}>Left out of 30: {staffLeftOutOfThirty}</span>
                <div className="campaign-info-row">
                  <div className="normalText">
                    <span>{campaignStatusRangeLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="co-staff-list">
              {monthSelectedStaffStatusRows.map((lead, index, arr) => {
                const formattedDate = formatLeadDateLabel(lead.date);
                const formattedTime = formatLeadTimeLabel(lead.lead_time);
                const isMail = String(lead.entry_type || "").toLowerCase().includes("mail");
                const showConnector = index < arr.length - 1;
                const channelText = isMail ? "Gmail" : "WhatsApp";
                const contactText = isMail ? (lead.email_id || "--") : (lead.mobile_number || "--");
                return (
                  <div key={`${lead.id}-${lead.entry_type || "channel"}-${index}`} className="co-digital-row">
                    <div className="co-digital-left">
                      <div className="co-digital-left-time">{formattedDate}</div>
                      <div className="co-digital-left-time">{formattedTime}</div>
                    </div>

                    <div className="co-digital-channel-col">
                      <div className={`co-digital-channel ${isMail ? "co-digital-channel-g" : "co-digital-channel-w"}`}>
                        {isMail ? "G" : "W"}
                      </div>
                      {showConnector && <span className="co-digital-channel-connector" />}
                    </div>

                    <div className="normalText">
                      {lead.full_name || "Lead"} - Staff sent {channelText} template / Contact: {contactText}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>
     
    </div>


    {/* STATS ROW */}
    {/* <div className="statsRow">

      <div className="statBox">520 Img</div>
      <div className="statBox">1200 Msg</div>
      <div className="statBox">640 Email</div>
      <div className="statBox">2360 Conv</div>

    </div> */}

      {singleLeadModalOpen &&
        createPortal(
          <div
            className="campaign-modal-overlay"
            onClick={() => {
              setSingleLeadModalOpen(false);
              setSingleLeadError("");
              setSingleLeadStatus("");
            }}
          >
            <div className="campaign-modal" onClick={(e) => e.stopPropagation()} key={singleLeadFormKey}>
              <div className="campaign-modal-header">
                <h4>Single Upload</h4>
                <button
                  type="button"
                  className="campaign-modal-close"
                  onClick={() => {
                    setSingleLeadModalOpen(false);
                    setSingleLeadError("");
                    setSingleLeadStatus("");
                  }}
                >
                  ×
                </button>
              </div>

              <div className="campaign-modal-body">
                {/* Campaign name hidden in UI; backend uses bulk name or default */}
                <div className="campaign-modal-row">
                  <label>Full Name</label>
                  <input
                    ref={singleLeadNameRef}
                    type="text"
                    defaultValue=""
                    placeholder="Enter full name"
                  />
                </div>
                <div className="campaign-modal-row">
                  <label>Mobile</label>
                  <input
                    ref={singleLeadMobileRef}
                    type="text"
                    defaultValue=""
                    placeholder="10-digit mobile"
                  />
                </div>
                <div className="campaign-modal-row">
                  <label>Email</label>
                  <input
                    ref={singleLeadEmailRef}
                    type="email"
                    defaultValue=""
                    placeholder="email (optional)"
                  />
                </div>
                <div className="campaign-modal-row">
                  <label>Class</label>
                  <input
                    ref={singleLeadClassRef}
                    type="text"
                    defaultValue=""
                    placeholder="Class"
                  />
                </div>
                {singleLeadError && <div className="campaign-modal-error">{singleLeadError}</div>}
                {singleLeadStatus && (
                  <div className="campaign-modal-success">{singleLeadStatus}</div>
                )}
              </div>

              <div className="campaign-modal-footer">
                <button
                  type="button"
                  className="btn-solid"
                  onClick={handleSingleLeadSubmit}
                  disabled={singleLeadSubmitting}
                >
                  {singleLeadSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <Modal isOpen={admissionReportOpen} title="Admission Report" onClose={() => setAdmissionReportOpen(false)}>
        <AdmissionReportPopup />
      </Modal>
      <ErrorPopup message={duplicatePopup} onClose={() => setDuplicatePopup("")} />

      {duplicateReviewOpen &&
        createPortal(
          <div className="campaign-modal-overlay" onClick={handleCancelDuplicateUpload}>
            <div
              className="campaign-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 560, width: "92%" }}
            >
              <div className="campaign-modal-header duplicate-review-header">
                <div className="duplicate-review-header-copy">
                  <h4>Duplicate Leads Found</h4>
                  <p>Some records in your uploaded file already exist</p>
                </div>
                <button
                  type="button"
                  className="campaign-modal-close"
                  onClick={handleCancelDuplicateUpload}
                >
                  ×
                </button>
              </div>

              <div className="campaign-modal-body">
                <div className="campaign-modal-success" style={{ marginBottom: 12 }}>
                  Uploadable leads: {duplicateUploadSummary.insertable} | Duplicates skipped: {duplicateUploadSummary.skipped}
                </div>

                <div className="campaign-modal-lead-group-title">Duplicate List</div>
                <div className="campaign-modal-bulk-list" style={{ maxHeight: 260 }}>
                  {summarizeDuplicateEntries(duplicateEntries).length === 0 ? (
                    <div className="campaign-modal-empty-state">No duplicate values found</div>
                  ) : (
                    summarizeDuplicateEntries(duplicateEntries).map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="campaign-modal-lead-item campaign-modal-bulk-item"
                        style={{ cursor: "default" }}
                      >
                        <span className="campaign-modal-bulk-name">{item}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="duplicate-review-helper">
                <div>Would you like to skip the duplicates and continue importing the remaining data?</div>
              </div>
              <div className="campaign-modal-footer">
                <div className="duplicate-review-actions">
                  <div className="duplicate-review-action-group">
                    <div className="duplicate-review-action-label duplicate-review-action-label-cancel">Cancel Upload</div>
                    <button
                      type="button"
                      className="btn-solid1"
                      onClick={handleCancelDuplicateUpload}
                      disabled={uploading}
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="duplicate-review-action-group">
                    <div className="duplicate-review-action-label duplicate-review-action-label-upload">
                      Continue Without
                      Duplicate Leads
                    </div>
                    <button
                      type="button"
                      className="btn-solid"
                      onClick={handleConfirmUploadSkippingDuplicates}
                      disabled={uploading}
                    >
                      {uploading ? "Uploading..." : "Continue"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {bulkListModalOpen &&
        createPortal(
          <div className="campaign-modal-overlay" onClick={() => setBulkListModalOpen(false)}>
            <div
              className="campaign-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 620, width: "92%" }}
            >
              <div className="campaign-modal-header">
                <h4>Bulk Upload Leads</h4>
                <button
                  type="button"
                  className="campaign-modal-close"
                  onClick={() => setBulkListModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="campaign-modal-body">
                <div className="campaign-modal-bulk-list" style={{ maxHeight: 320 }}>
                  {bulkLeadItems.length === 0 ? (
                    <div className="campaign-modal-empty-state">No bulk upload leads found</div>
                  ) : (
                    bulkLeadItems.map((item) => {
                      const schedule = getBulkLeadSchedule(item.leadName) as {
                        fromDate?: string;
                        toDate?: string;
                        time?: string;
                      };

                      return (
                        <div
                          key={`bulk-lead-modal-${item.id}`}
                          className="campaign-bulk-popup-item"
                        >
                          <div className="campaign-bulk-popup-top">
                            <span className="campaign-bulk-popup-name">{item.leadName || "-"}</span>
                            <span className="campaign-bulk-popup-badge">
                              {item.count} {item.count === 1 ? "Lead" : "Leads"}
                            </span>
                          </div>
                          <div className="campaign-bulk-popup-meta">
                            Campaign: {item.leadName || "-"}
                          </div>
                          <div className="campaign-bulk-popup-meta campaign-bulk-popup-meta-row">
                            <span>Date: {item.date ? formatLeadDateLabel(item.date) : "-"}</span>
                            <button
                              type="button"
                              className="campaign-bulk-popup-delete-btn"
                              onClick={() =>
                                setLeadDeleteTarget({
                                  id: item.id,
                                  name: item.leadName || "this campaign",
                                  campaignName: item.leadName,
                                  count: item.count,
                                })
                              }
                              >
                              <span>Delete</span>
                            </button>
                          </div>
                          <div className="campaign-bulk-popup-meta">
                            From Date: {schedule.fromDate ? formatLeadDateLabel(schedule.fromDate) : "-"} | To Date:{" "}
                            {schedule.toDate ? formatLeadDateLabel(schedule.toDate) : "-"}
                            {schedule.time ? ` | Time: ${formatLeadTimeLabel(schedule.time)}` : ""}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="campaign-modal-footer">
                <button
                  type="button"
                  className="btn-solid1"
                  onClick={() => setBulkListModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <ConfirmDialog
        isOpen={Boolean(leadDeleteTarget)}
        title={leadDeleteTarget?.campaignName ? "Delete Campaign" : "Delete Lead"}
        message={
          leadDeleteTarget
            ? leadDeleteTarget.campaignName
              ? `Are you sure you want to delete campaign ${leadDeleteTarget.campaignName}${leadDeleteTarget.count ? ` with ${leadDeleteTarget.count} leads` : ""}?`
              : `Are you sure you want to delete ${leadDeleteTarget.name}?`
            : ""
        }
        confirmLabel={deleteLeadLoading ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        onConfirm={handleDeleteLeadGroup}
        onCancel={() => {
          if (deleteLeadLoading) return;
          setLeadDeleteTarget(null);
        }}
      />

      {templatePreviewOpen &&
        createPortal(
          <div className="campaign-modal-overlay" onClick={() => setTemplatePreviewOpen(false)}>
            <div className="campaign-modal template-preview-modal" onClick={(e) => e.stopPropagation()}>
              <div className="campaign-modal-header">
                <h4>Bulk Upload Template</h4>
                <button
                  type="button"
                  className="campaign-modal-close"
                  onClick={() => setTemplatePreviewOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="template-preview-table-wrap">
                <table className="template-preview-table">
                  <thead>
                    <tr>
                      {templateHeader.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {templateSample.map((cell, idx) => (
                        <td key={idx}>{cell}</td>
                      ))}
                    </tr>
                    <tr className="template-preview-edit-row">
                      {templateHeader.map((cell) => (
                        <td key={cell} contentEditable suppressContentEditableWarning />
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>,
          document.body
        )}

      {renderBulkLeadDropdownPortal()}

      </div>
    </DashboardLayout>
  </>
);


};
  const styles = {
  
    logo: { width: 90, height: 90, borderRadius: 5, objectFit: "cover" },
 
  };

export default FrontDeskCampaigning;
