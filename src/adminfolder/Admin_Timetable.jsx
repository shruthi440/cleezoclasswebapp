import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { FaUser } from "react-icons/fa";
import axios from "axios";
import ScrollableSection from "../shared/ScrollableSection";
import "./Admin_Timetable.css";
import "./AccountantDashboardnew.css";
import "../frontdeskdahboard/FrontDesk.css";
import ErrorPopup from "../shared/ErrorPopup";
import TaskOfTheDay from "../shared/TaskOfTheDay.tsx";
import Extraactivityform from "../shared/Extraactivityform";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";
import abcLogo from "../assets/abc school.png";
import dashboardIcon from "../assets/Dashboard.png";
import academicsIcon from "../assets/Staff Assign.png";
import leadProfileIcon from "../assets/Lead Profile.png";
import enrollmentIcon from "../assets/Enrollment.png";
import communicationIcon from "../assets/Communication Assign.png";
import reportsIcon from "../assets/Reports .png";
import timelineIcon from "../assets/Timeline.png";
import followupIcon from "../assets/Profile.png";
import assistantIcon from "../assets/Assistant.png";

const isLaptop = window.innerWidth > 600 && window.innerWidth <= 1440;
const MOBILE_BREAKPOINT = 1024;
const BASE_URL = "https://cleezoclass.com:4000";

const initialTimetableData = {};
const timetableSidebarItems = [
  { key: "dashboard", label: "Dashboard", icon: dashboardIcon, route: "/AdminDashboard" },
  { key: "academics", label: "Academics", icon: academicsIcon, route: "/AdiminAcademicsNew" },
  { key: "events", label: "Events & Meetings", icon: leadProfileIcon, route: "/AdminEventsAndMeetings" },
  { key: "communication", label: "Generations", icon: communicationIcon, route: "/AdmissionTimetableNew" },
  { key: "store", label: "Store", icon: enrollmentIcon, route: "/AdminStoreNew" },
  { key: "report", label: "Report", icon: reportsIcon, route: "/AdminReportsPage" },
];

const timetableQuickCards = [
  { key: "livechat", title: "Live Chat", subtitle: "Approvals / Requests", icon: timelineIcon },
  { key: "storepo", title: "Store PO", subtitle: "Request Order / PO issue", icon: followupIcon },
  { key: "assistant", title: "Assistant", subtitle: "Daily Activity check", icon: assistantIcon },
];

const timetableRequestItems = [
  "Live Chat (P - T) - 07/04/2026, 15:59 - Aman to Aisha Begum, 7A",
  "Live Chat (P - T) - 27/03/2026, 18:03 - Karthik to Aliya Begum, 7A",
];

const timetableScheduledItems = [
  "Live Chat (T - P) - 24/01/2026, 12:23 - Kushal Gowda to Student, 1A",
  "Live Chat (T - P) - 24/01/2026, 12:12 - Kavya Reddy to Student, 7A",
];

const SubstituteAssignmentEmbed = ({ isMobile }) => {
  const [absentTeachers, setAbsentTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [availableSubstitutes, setAvailableSubstitutes] = useState([]);
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const schoolCode = localStorage.getItem('schoolCode');

  useEffect(() => {
    const fetchAbsentTeachers = async () => {
      try {
        const response = await axios.get(
          `${BASE_URL}/api/chief/absent-teachers`,
          { params: { schoolCode } }
        );
        const mockData = [
          { teacher_id: 1, teacher_name: 'K. Sujatha', subject: 'Maths', day: 'Mon', period: 4 },
          { teacher_id: 2, teacher_name: 'J. Andrew', subject: 'Physics', day: 'Wed', period: 3 },
          { teacher_id: 3, teacher_name: 'S. Rao', subject: 'History', day: 'Fri', period: 7 },
        ];
        setAbsentTeachers(response.data.length > 0 ? response.data : mockData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching absent teachers:', err);
        setError('Failed to load absent teacher data from API. Showing mock data.');
        setAbsentTeachers([
          { teacher_id: 1, teacher_name: 'K. Sujatha', subject: 'Maths', day: 'Mon', period: 4 },
          { teacher_id: 2, teacher_name: 'J. Andrew', subject: 'Physics', day: 'Wed', period: 3 },
          { teacher_id: 3, teacher_name: 'S. Rao', subject: 'History', day: 'Fri', period: 7 },
        ]);
        setLoading(false);
      }
    };
    fetchAbsentTeachers();
  }, [schoolCode]);

  const handleFindSubstitutes = async (teacher) => {
    setSelectedTeacher(teacher);
    setAvailableSubstitutes([]);
    setAssignmentMessage('');
    setIsModalOpen(true);
    const period = 1;
    try {
      const response = await axios.get(
        `${BASE_URL}/api/chief/available-teachers/${period}/${teacher.subject}`,
        { params: { schoolCode } }
      );
      setAvailableSubstitutes(response.data);
    } catch (err) {
      console.error('Error fetching available substitutes:', err);
      setAssignmentMessage('Failed to find available substitutes.');
    }
  };

  const handleAssignSubstitute = async (substituteId) => {
    if (!selectedTeacher) {
      setAssignmentMessage('Please select an absent teacher first.');
      return;
    }
    const assignmentData = {
      period: selectedTeacher.period || 1,
      subject: selectedTeacher.subject,
      substituteId: substituteId,
      classId: '10',
      sectionId: 'A',
      schoolCode: schoolCode
    };
    try {
      setAssignmentMessage(
        `✅ Successfully assigned substitute (ID: ${substituteId}) for ${selectedTeacher.teacher_name}'s class.`
      );
      setTimeout(() => {
        setAbsentTeachers(prev => prev.filter(t => t.teacher_id !== selectedTeacher.teacher_id));
        setIsModalOpen(false);
        setSelectedTeacher(null);
        setAvailableSubstitutes([]);
        setAssignmentMessage('');
      }, 1000);
    } catch (err) {
      console.error('Error assigning substitute:', err);
      setAssignmentMessage('❌ Assignment failed due to server error.');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTeacher(null);
    setAvailableSubstitutes([]);
    setAssignmentMessage('');
  };

  return (
    <div className="at-left-container">
      <div className="at-section-header">
        <div className="at-icon-circle"></div>
        <div className="at-section-title">Ideal Class</div>
      </div>
      {loading ? (
        <p className="at-absent-message">Loading absent teachers...</p>
      ) : error ? (
        <p className="at-absent-message error">{error}</p>
      ) : absentTeachers.length === 0 ? (
        <p className="at-absent-message">🎉 No absent teachers found today!</p>
      ) : (
        <div className="at-absent-table-container">
          <table className="at-absent-table">
            <thead>
              <tr>
                <th>Teacher Name</th>
                <th>Subject</th>
                <th>Assign Substitute</th>
              </tr>
            </thead>
            <tbody>
              {absentTeachers.map((teacher) => (
                <tr key={teacher.teacher_id}>
                  <td style={{ fontWeight: 'bold' }}>{teacher.teacher_name}</td>
                  <td>{teacher.subject}</td>
                  <td>
                    <button className="at-button-warning" onClick={() => handleFindSubstitutes(teacher)}>
                      Find teacher
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
{isModalOpen && (
  <div className="at-modal-overlay" onClick={closeModal}>
    <div
      className="at-modal-content"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="at-modal-header">
        <button className="at-modal-close-btn" onClick={closeModal}>×</button>
        <h3>
          Assign Substitute for:
          <strong> {selectedTeacher?.teacher_name}</strong> ({selectedTeacher?.subject})
        </h3>
        <p>
          *Covering Period {selectedTeacher?.period || 1} on {selectedTeacher?.day || "Today"}.
        </p>
      </div>

      <div className="at-modal-body">
        {availableSubstitutes.length > 0 ? (
          <>
            <h4>
              Available Teachers for {selectedTeacher?.subject} coverage:
            </h4>

            <ul className="at-substitutes-list">
              {availableSubstitutes.map((sub) => (
                <li className="at-substitute-item" key={sub.teacher_id}>
                  <span>
                    {sub.teacher_name} (<em>{sub.designation}</em>)
                  </span>
                  <button
                    className="at-button-success"
                    onClick={() => handleAssignSubstitute(sub.teacher_id)}
                  >
                    Assign
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Searching for available substitutes...</p>
        )}

        {assignmentMessage && (
          <p
            className={`assignment-message ${
              assignmentMessage.startsWith("❌") ? "error" : "success"
            }`}
          >
            {assignmentMessage}
          </p>
        )}
      </div>
    </div>
  </div>
)}
    </div>
  );
};

const TimetableAdmin = ({ academicsStyle = false }) => {
  const [popup, setPopup] = useState({ message: "", type: "" });
  const [activeQuickPanel, setActiveQuickPanel] = useState("livechat");
  
  const navigate = useNavigate();
  const SCHOOL_NAME = "ABC School, Miyapur, Hyderabad";
  const ADMIN_TITLE = "OPERATIONS — TIMETABLE";
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [sections, setSections] = useState({});
  const [classTeachers, setClassTeachers] = useState({});
  const [timetable, setTimetable] = useState(initialTimetableData);
  const [totalRows, setTotalRows] = useState(0);
  const [startTime, setStartTime] = useState("08:00");
  const [periodDuration, setPeriodDuration] = useState(40);
  const [numberOfPeriods, setNumberOfPeriods] = useState(7);
  const [morningInterval, setMorningInterval] = useState(false);
  const [afternoonInterval, setAfternoonInterval] = useState(false);
  const [lunchInterval, setLunchInterval] = useState(false);
  const [morningIntervalAfter, setMorningIntervalAfter] = useState(2);
  const [morningIntervalDuration, setMorningIntervalDuration] = useState(15);
  const [afternoonIntervalAfter, setAfternoonIntervalAfter] = useState(6);
  const [afternoonIntervalDuration, setAfternoonIntervalDuration] = useState(10);
  const [lunchIntervalAfter, setLunchIntervalAfter] = useState(4);
  const [lunchIntervalDuration, setLunchIntervalDuration] = useState(45);
  const [customActivities, setCustomActivities] = useState([]);
  const [editingClasses, setEditingClasses] = useState({});
  const [showTimetable, setShowTimetable] = useState(false);
  const [dayType, setDayType] = useState('full');
  const [isTimetableGenerated, setIsTimetableGenerated] = useState(false);
  const [classOptions, setClassOptions] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [extraClassForm, setExtraClassForm] = useState({
    class: '', date: '', time: '', duration: '', staff: '',
  });
  const [specialClassForm, setSpecialClassForm] = useState({
    class: '', date: '', time: '', duration: '', staff: '',
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const total = Object.values(sections).reduce((acc, section) => acc + section, 0);
    setTotalRows(total);
  }, [sections]);

  useEffect(() => {
    if (dayType === 'half') {
      setLunchInterval(false);
      setAfternoonInterval(false);
    }
  }, [dayType]);
useEffect(() => {
  const fetchOptions = async () => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
      setPopup({
        message: "School code is missing. Please log in again to continue.",
        type: "error"
      });
      return;
    }

    try {
      const response = await fetch(
        `https://cleezoclass.com:4000/api/admin/api/metadata/class-staff-options?schoolCode=${schoolCode}`
      );
      const data = await response.json();
      if (response.ok) {
        const sortedClasses = (data.classOptions || []).sort(
          (a, b) => parseInt(a) - parseInt(b)
        );
        setClassOptions(sortedClasses);
        setStaffOptions(data.staffOptions || []);
      } else {
        setPopup({
          message: `Failed to load options: ${data.message}. Please try again later.`,
          type: "error"
        });
      }
    } catch (error) {
      console.error("Network Error:", error);
      setClassOptions(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
      setStaffOptions(["K. Sujatha", "J. Andrew", "V. Sharma", "M. Khan", "S. Rao"]);
      setPopup({
        message: "Failed to connect to the server. Showing sample data for now.",
        type: "error"
      });
    } finally {
      setIsLoading(false);
    }
  };
  fetchOptions();
}, []);


  const handleClassSelection = (className) => {
    setSelectedClasses((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className]
    );
  };

  const handleSectionChange = (className, sectionCount) => {
    const updatedSections = { ...sections, [className]: sectionCount || 1 };
    setSections(updatedSections);
  };

  const handleSubmit = async () => {
    const schoolCode = (localStorage.getItem("schoolCode") || "default_school_code").trim();
    if (!schoolCode) {
setPopup({
  message: "School code is missing. Please log in again to ensure everything is set correctly.",
  type: "error"
});
      return;
    }
    const payload = {
      schoolCode,
      classes: selectedClasses.map((name) => ({
        class_name: String(name).replace(/^Class\s+/i, ''),
        sections: sections[name] || 1,
        teacher: classTeachers[name] || "Not Assigned",
      })),
      startTime,
      periodDuration,
      numberOfPeriods,
      morningInterval,
      morningIntervalAfter,
      morningIntervalDuration,
      afternoonInterval: dayType === 'full' ? afternoonInterval : false,
      afternoonIntervalAfter,
      afternoonIntervalDuration,
      lunchInterval: dayType === 'full' ? lunchInterval : false,
      lunchIntervalAfter,
      lunchIntervalDuration,
      customActivities
    };
    try {
      const { data } = await axios.post(
        `${BASE_URL}/generatetimetable`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      if (data?.weeklyTimetable) {
        setTimetable(data.weeklyTimetable);
setPopup({
  message: "The timetable has been generated successfully.",
  type: "success"
});
        setShowTimetable(true);
        setIsTimetableGenerated(true);
      } else {
setPopup({
  message: "Timetable generation failed. Please check your network connection and try again.",
  type: "error"
});
      }
    } catch (err) {
      console.error("❌ Server error during timetable generation:", err);
setPopup({
  message: "A server error occurred. Please try again later or contact support if the issue persists.",
  type: "error"
});
    }
    setShowTimetable(true);
    setIsTimetableGenerated(true);
  };

  const handleEditClass = (className) => {
    setEditingClasses(prev => ({ ...prev, [className]: true }));
  };

  const handleSaveClass = (className) => {
    setEditingClasses(prev => ({ ...prev, [className]: false }));
setPopup({
  message: `✅ Timetable for ${className} has been saved successfully!`,
  type: "success"
});
  };

  const handleRemoveClass = (className) => {
    let day = prompt("Enter the day to remove a period (e.g., Mon, or leave empty to delete the entire class):");
    if (day === null) return;
    day = day.trim();
    if (!day) {
      setTimetable((prev) => {
        const updatedTimetable = { ...prev };
        delete updatedTimetable[className];
        if (Object.keys(updatedTimetable).length === 0) {
          setShowTimetable(false);
          setIsTimetableGenerated(false);
        }
        return updatedTimetable;
      });
setPopup({
  message: `The class "${className}" has been deleted successfully.`,
  type: "success"
});
      return;
    }
    let periodNumber = prompt("Enter the period number to remove (1-10):");
    if (periodNumber === null) return;
    periodNumber = Number(periodNumber.trim());
    if (isNaN(periodNumber) || periodNumber < 1 || periodNumber > 10) {
setPopup({
  message: "Please enter a valid period number between 1 and 10.",
  type: "error"
});
      return;
    }
    setTimetable((prev) => {
      const updatedTimetable = { ...prev };
      Object.keys(updatedTimetable[className]).forEach((section) => {
        if (updatedTimetable[className][section][day]) {
          const index = updatedTimetable[className][section][day].findIndex(p => p.period === periodNumber);
          if (index !== -1) {
            updatedTimetable[className][section][day][index] = {
              period: periodNumber,
              subject: "—",
              teacher: "—",
              from_time: updatedTimetable[className][section][day][index].from_time,
              to_time: updatedTimetable[className][section][day][index].to_time,
              section
            };
          }
        }
      });
      return updatedTimetable;
    });
setPopup({
  message: `Period ${periodNumber} on ${day} for class "${className}" has been updated successfully.`,
  type: "success"
});
  };

  const handlePeriodCellChange = (className, section, day, index, field, value) => {
    setTimetable(prev => {
      const updated = { ...prev };
      updated[className][section][day][index] = {
        ...updated[className][section][day][index],
        [field]: value
      };
      return updated;
    });
  };

  const handleRequestSubmission = useCallback(async (payload) => {
    const schoolCode = localStorage.getItem("schoolCode");
    if (!schoolCode) {
setPopup({
  message: "School code is missing. Please log in again to continue.",
  type: "error"
});
      return;
    }
    const finalPayload = {
      ...payload,
      schoolCode
    };
    try {
      const response = await fetch(
        'https://cleezoclass.com:4000/api/request-class',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalPayload)
        }
      );
      const data = await response.json();
      if (response.ok) {
setPopup({
  message: data.message,
  type: "error"
});
      } else {
setPopup({
  message: `Request failed: ${data.message}. Please try again.`,
  type: "error"
});
      }
    } catch (error) {
      console.error("API call error:", error);
setPopup({
  message: "An unexpected error occurred during the request submission. Please try again later.",
  type: "error"
});
    }
  }, []);

  const handleFormChange = (formType, field, value) => {
    const setter = formType === 'extra' ? setExtraClassForm : setSpecialClassForm;
    setter(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit1 = (e, formType) => {
    e.preventDefault();
    const formData = formType === 'extra' ? extraClassForm : specialClassForm;
    if (!formData.class || !formData.date || !formData.time || !formData.duration || !formData.staff) {
setPopup({
  message: "Please fill in all the required fields before submitting the request.",
  type: "error"
});
      return;
    }
    const durationInMinutes = parseInt(formData.duration, 10);
    if (isNaN(durationInMinutes) || durationInMinutes <= 0) {
setPopup({
  message: "Duration must be a valid positive number. Please correct and try again.",
  type: "error"
});
      return;
    }
    const payload = {
      request_type: formType.toUpperCase(),
      class_name: formData.class,
      date: formData.date,
      time: formData.time,
      duration_minutes: durationInMinutes,
      staff_name: formData.staff,
    };
    handleRequestSubmission(payload);
    const resetter = formType === 'extra' ? setExtraClassForm : setSpecialClassForm;
    resetter({ class: '', date: '', time: '', duration: '', staff: '' });
  };

  const renderActionsSection = () => (
    <div className="at-actions-section">
      {isTimetableGenerated && (
        <div className="at-timetable-status-card">
          <div className="at-status-header">
            <span>✅</span> TIMETABLE STATUS
          </div>
          <p>New Timetable Generated Successfully!</p>
          <button
            onClick={() => {
              setShowTimetable(true);
              if (!isMobile) {
                document
                  .getElementById("timetable-display-anchor")
                  ?.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            View Generated Timetable
          </button>
        </div>
      )}
      <div className="at-left-container">
        <div className="at-action-item">
          <span>JA, K. Sujatha – Absent</span>
          <button>APPROVED</button>
        </div>
        <div className="at-action-item extra-class">
          <span>➡️ Extra Class</span>
          <span>IX-A, Maths, K. Sujatha – Pending (4th Period)</span>
          <button>OK</button>
        </div>
        <div className="at-action-item special-class rejected">
          <span>➡️ Special Class</span>
          <span>VII-B, Writing Skills – Mon, Rejected</span>
          <button>REJECT</button>
        </div>
      </div>
    </div>
  );

  const renderForm = (formType, formData) => (
    <form onSubmit={(e) => handleSubmit1(e, formType)}>
      <div className="at-form-grid">
        <div className="at-form-group">
          <label>Class</label>
          <select
            className="btn-dropdown"
            value={formData.class}
            onChange={(e) => handleFormChange(formType, "class", e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select Class</option>
            {classOptions.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
        <div className="at-form-group">
          <label>Date</label>
          <input
            type="date"
            className="btn-dropdown"
            value={formData.date}
            onChange={(e) => handleFormChange(formType, "date", e.target.value)}
          />
        </div>
        <div className="at-form-group">
          <label>Time</label>
          <input
            type="time"
            className="btn-dropdown"
            value={formData.time}
            onChange={(e) => handleFormChange(formType, "time", e.target.value)}
          />
        </div>
        <div className="at-form-group">
          <label>Duration (minutes)</label>
          <input
            type="number"
            className="btn-dropdown"
            value={formData.duration}
            onChange={(e) => handleFormChange(formType, "duration", e.target.value)}
          />
        </div>
        <div className="at-form-group">
          <label>Staff</label>
          <select
            className="btn-dropdown"
            value={formData.staff}
            onChange={(e) => handleFormChange(formType, "staff", e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select Staff</option>
            {staffOptions.map((staff) => (
              <option key={staff} value={staff}>{staff}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="at-form-button-row" >
        <button type="submit" className="btn-solid" style={{marginTop:'-50px'}} disabled={isLoading}>
          Request
        </button>
      </div>
    </form>
  );

  const renderExtraSpecialClassCard = () => (
    <div className="at-left-container">
      <div className="at-class-section">
        <div className="at-class-section-header">
          <div className="at-icon-circle extra-icon"></div>
          <div className="at-section-title">Extra Class</div>
        </div>
        <div className="at-class-dropdown-grid">
          {renderForm("extra", extraClassForm)}
        </div>
      </div>
      <hr className="at-divider-line" />
      <div className="at-class-section">
        <div className="at-class-section-header">
          <div className="at-icon-circle special-icon"></div>
          <div className="at-section-title">Special </div>
        </div>
        <div className="at-class-dropdown-grid">
          {renderForm("special", specialClassForm)}
        </div>
      </div>
    </div>
  );

  const renderTimetableGeneration = () => (
    <div className="at-left-container">
      <div className="at-class-selection">
        <h3>Select Classes</h3>
        <div className="at-class-checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={selectedClasses.length === classOptions.length}
              onChange={() =>
                setSelectedClasses(
                  selectedClasses.length === classOptions.length ? [] : [...classOptions]
                )
              }
            />
            Select All
          </label>
          {[...classOptions]
            .sort((a, b) => Number(a) - Number(b))
            .map((className) => (
              <label key={className}>
                <input
                  type="checkbox"
                  checked={selectedClasses.includes(className)}
                  onChange={() => handleClassSelection(className)}
                />
                {className}
              </label>
            ))}
        </div>
      </div>
      <div className="at-schedule-settings-container">
        <div className="at-schedule-settings-header">
          <h3>Schedule Settings:</h3>
          <label>Day Type:</label>
          <label>
            <input
              type="radio"
              name="dayType"
              value="full"
              checked={dayType === "full"}
              onChange={() => setDayType("full")}
            />
            Full Day
          </label>
          <label>
            <input
              type="radio"
              name="dayType"
              value="half"
              checked={dayType === "half"}
              onChange={() => setDayType("half")}
            />
            Half Day
          </label>
        </div>
        <div className="at-general-time-settings">
          <div>
            <label>Start Time:</label>
            <input
              type="time"
              value={startTime || ""}
              onChange={(e) => setStartTime(e.target.value)}
              className="at-small-input"
            />
          </div>
          <div>
            <label>Period Duration (mins):</label>
            <input
              type="number"
              min="10"
              max="120"
              value={periodDuration}
              onChange={(e) => setPeriodDuration(Number(e.target.value))}
              className="at-small-input"
            />
          </div>
          <div>
            <label>Total Periods</label>
            <input
              type="number"
              min="1"
              max="10"
              value={numberOfPeriods}
              onChange={(e) => setNumberOfPeriods(Number(e.target.value))}
              className="at-small-input"
            />
          </div>
        </div>
        <hr />
        <div className="at-intervals-container">
          {[
            {
              label: "Morning Interval",
              state: morningInterval,
              setter: setMorningInterval,
              after: morningIntervalAfter,
              afterSetter: setMorningIntervalAfter,
              duration: morningIntervalDuration,
              durationSetter: setMorningIntervalDuration,
              maxDur: 30,
              visible: true,
            },
            {
              label: "Lunch Interval",
              state: lunchInterval,
              setter: setLunchInterval,
              after: lunchIntervalAfter,
              afterSetter: setLunchIntervalAfter,
              duration: lunchIntervalDuration,
              durationSetter: setLunchIntervalDuration,
              maxDur: 120,
              visible: dayType === "full",
            },
            {
              label: "Afternoon Interval",
              state: afternoonInterval,
              setter: setAfternoonInterval,
              after: afternoonIntervalAfter,
              afterSetter: setAfternoonIntervalAfter,
              duration: afternoonIntervalDuration,
              durationSetter: setAfternoonIntervalDuration,
              maxDur: 30,
              visible: dayType === "full",
            },
          ]
            .filter((int) => int.visible)
            .map((int) => (
             <div key={int.label} className="at-interval-box">
  {/* LEFT SIDE */}
<div className="at-interval-left">
  <label className="at-interval-label">
    {int.label}
    <input
      type="checkbox"
      checked={int.state}
      onChange={() => int.setter(!int.state)}
    />
  </label>
</div>


  {/* RIGHT SIDE (appears inline, not below) */}
  {int.state && (
    <div className="at-interval-right">
      <div className="at-interval-input">
        <label>After</label>
        <input
          type="number"
          min="1"
          max={numberOfPeriods}
          value={int.after || ""}
          onChange={(e) => int.afterSetter(Number(e.target.value))}
          className="at-small-input"
        />
      </div>

      <div className="at-interval-input">
        <label>Mins</label>
        <input
          type="number"
          min="5"
          max={int.maxDur}
          value={int.duration || ""}
          onChange={(e) => int.durationSetter(Number(e.target.value))}
          className="at-small-input"
        />
      </div>
    </div>
  )}
</div>

            ))}
        </div>
      </div>
    </div>
  );

  const renderTimetableDisplay = () => (
    <div id="timetable-display-anchor" className="at-left-container timetable-display">
      <div className="at-section-title">GENERATED TIMETABLE</div>
      {Object.keys(timetable).length === 0 ? (
        <p>
          Select classes and click "Generate Timetable" to see the results.
        </p>
      ) : (
        <div className="at-timetable-scroll">
          {Object.keys(timetable).map((className) => (
            <div key={className} className="at-timetable-class">
              <h2>
                Class {className}
                <button
                  onClick={() =>
                    editingClasses[className]
                      ? handleSaveClass(className)
                      : handleEditClass(className)
                  }
                >
                  {editingClasses[className] ? "Save" : "Edit"}
                </button>
                <button
                  onClick={() => handleRemoveClass(className)}
                >
                  Remove
                </button>
              </h2>
              {Object.keys(timetable[className]).map((section) => {
                const sectionData = timetable[className][section];
                const days = Object.keys(sectionData);
                if (days.length === 0) return null;
                const firstDayPeriods = sectionData[days[0]];
                return (
                  <div key={section} className="at-timetable-section">
                    <h3>Section: {section}</h3>
                    <div className="at-timetable-table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Day</th>
                            {firstDayPeriods.map((period, index) => {
                              const periodNumber = period.interval ? null : `P${period.period}`;
                              return (
                                <th key={index}>
                                  {period.interval ? period.interval : periodNumber}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {days.map((day) => (
                            <tr key={day}>
                              <td>{day}</td>
                              {sectionData[day].map((period, index) => {
                                const isInterval = !!period?.interval;
                                return (
                                  <td key={index} className={isInterval ? "interval-cell" : ""}>
                                    {isInterval ? (
                                      <span>{period.interval}</span>
                                    ) : period ? (
                                      <>
                                        <span>
                                          {period.from_time.substring(0, 5)} - {period.to_time.substring(0, 5)}
                                        </span>
                                        <br />
                                        {editingClasses[className] ? (
                                          <>
                                            <input
                                              type="text"
                                              value={period.subject}
                                              onChange={(e) => handlePeriodCellChange(className, section, day, index, 'subject', e.target.value)}
                                            />
                                            <br />
                                            <input
                                              type="text"
                                              value={period.teacher}
                                              onChange={(e) => handlePeriodCellChange(className, section, day, index, 'teacher', e.target.value)}
                                            />
                                          </>
                                        ) : (
                                          <>
                                            <span>{period.subject}</span>
                                            <br />
                                            <span>{period.teacher}</span>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <span>Empty</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderExtraClassOnly = () => (
    <div className="at-left-container">
      <div className="at-class-section">
        <div className="at-class-section-header">
          <div className="at-icon-circle extra-icon"></div>
          <div className="at-section-title">Extra Class</div>
        </div>
        <div className="at-class-dropdown-grid">{renderForm("extra", extraClassForm)}</div>
      </div>
    </div>
  );

  const renderSpecialClassOnly = () => (
    <div className="at-left-container">
      <div className="at-class-section">
        <div className="at-class-section-header">
          <div className="at-icon-circle special-icon"></div>
          <div className="at-section-title">Special Class</div>
        </div>
        <div className="at-class-dropdown-grid">{renderForm("special", specialClassForm)}</div>
      </div>
    </div>
  );

  const assistantPanelItems = [
    "Generate timetable class-wise and check teacher overlaps before publishing.",
    "Use special classes for exams, lab sessions, and focused revision hours.",
    "Review extra classes and ideal periods daily to balance teacher load.",
  ];

  const storePanelItems = [
    "PO102 - Timetable register printing sheets",
    "PO115 - Lab attendance sheets and markers",
    "PO121 - Staff planner books",
  ];

  if (academicsStyle) {
    return (
      <div className="dashboard-page dashboard-home-page frontdesk-dashboard-page accountant-dashboard-page accountant-dashboard-home-page tt-academics-page">
        <div className="dashboard-shell accountant-dashboard-shell">
          <aside className="dashboard-sidebar accountant-sidebar-strip">
            {timetableSidebarItems.map((item) => (
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
                    className={`dashboard-topbar-tab accountant-topbar-tab ${tab === "Academics" ? "dashboard-topbar-tab-active accountant-topbar-tab-active" : ""}`}
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
                <img src={abcLogo} alt="ABC School" className="accountant-school-logo" />
                <span style={{ fontWeight: 700, marginLeft: "0.4rem" }}>ABC SCHOOL</span>
              </div>

              <div className="dashboard-topbar-right accountant-topbar-right">
              <button className="accountant-branch-btn" type="button" onClick={() => navigate("/HrDashboard")}>
                Switch to HR <span className="accountant-branch-caret">▼</span>
              </button>
              <EditableProfileMenu showHrSwitch />
              </div>
            </div>

            <div className="tt-academics-content">
              <div className="tt-academics-top">
                     <div className="accountant-welcome-block">
                <h2>Hi, Vinay!</h2>
                <p>Check Store Inventory,</p>
                <p>Report Track to Class Teacher</p>
                <p>Submit Building maintenance</p>
              </div>

                <div className="tt-academics-summary accountant-card">
                  <div className="tt-academics-summary-ring">
                    <div className="tt-academics-summary-ring-inner">70%</div>
                  </div>
                  <div className="tt-academics-summary-stats">
                    <p><span>Generated Classes:</span> <strong>{Object.keys(timetable).length}</strong></p>
                    <p><span>Selected Classes:</span> <strong>{selectedClasses.length}</strong></p>
                    <p><span>Total Rows:</span> <strong>{totalRows}</strong></p>
                    <p><span>Periods:</span> <strong>{numberOfPeriods}</strong></p>
                  </div>
                  <div className="tt-academics-summary-right">
                    <button type="button" className="collect-filter">
                      <span>{dayType === "full" ? "Full Day" : "Half Day"}</span>
                    </button>
                    <div className="tt-academics-exam">
                      <h3>Time Table Generation</h3>
                      <p>{startTime} | {periodDuration} mins</p>
                    </div>
                  </div>
                </div>

                <div className="tt-academics-mini-cards">
                  {timetableQuickCards.map((card) => (
                    <div
                      key={card.key}
                      className="accountant-quick-card accountant-card accountant-quick-card-clickable"
                      onClick={() => setActiveQuickPanel(card.key)}
                    >
                      <div className="quick-icon">
                        <img src={card.icon} alt={card.title} />
                      </div>
                      <h4>{card.title}</h4>
                      <p>{card.subtitle}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="tt-academics-main">
                <div className="tt-academics-performance accountant-card">
                  <div className="tt-academics-performance-header">
                    <div><h3>Time Table Generation</h3></div>
                    {!showTimetable && (
                      <button
                        type="button"
                        className="tt-academics-generate-btn"
                        onClick={handleSubmit}
                      >
                        Generate Timetable
                      </button>
                    )}
                  </div>
                  {showTimetable ? (
                    <div className="tt-academics-generation-main">
                      <div className="tt-academics-inner-scroll">
                        {renderTimetableDisplay()}
                      </div>
                    </div>
                  ) : (
                    <div className="tt-academics-generation-layout">
                      <div className="tt-academics-generation-main">
                        <div className="tt-academics-inner-scroll">
                          {renderTimetableGeneration()}
                        </div>
                      </div>
                      <div className="tt-academics-generation-ai">
                        <div className="tt-academics-inline-ai accountant-card">
                          <div className="tt-academics-inline-ai-inner">
                            <Extraactivityform
                              setCustomActivities={setCustomActivities}
                              embedded
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="tt-academics-right-column">
                  <div className="tt-academics-storepo accountant-card">
                    <div className="tt-academics-side-header">
                      <h3>{activeQuickPanel === "assistant" ? "Assistant Actions" : activeQuickPanel === "storepo" ? "Store PO" : "Live Chat"}</h3>
                      <div className="tt-academics-request-count">
                        <strong>{activeQuickPanel === "assistant" ? assistantPanelItems.length : activeQuickPanel === "storepo" ? storePanelItems.length : 3}</strong>
                        <span>{activeQuickPanel === "assistant" ? "Actions" : activeQuickPanel === "storepo" ? "Requests" : "Chats"}</span>
                      </div>
                    </div>
                    <div className="tt-academics-side-subtitle">
                      {activeQuickPanel === "assistant" ? "Assistant Guidance" : activeQuickPanel === "storepo" ? "Requests PO" : "Approvals / Requests"}
                    </div>
                    <div className="tt-academics-po-list">
                      {activeQuickPanel === "assistant"
                        ? assistantPanelItems.map((item) => (
                            <div key={item} className="tt-academics-assistant-item">
                              <strong>Assistant</strong>
                              <span>{item}</span>
                            </div>
                          ))
                        : activeQuickPanel === "storepo"
                          ? storePanelItems.map((item) => (
                              <div key={item} className="tt-academics-po-item">
                                <span>{item}</span>
                                <div className="tt-academics-po-actions">
                                  <button type="button">▷</button>
                                  <button type="button">✕</button>
                                </div>
                              </div>
                            ))
                          : (
                            <>
                              <div className="tt-academics-side-subgroup-label">Requests</div>
                              {timetableRequestItems.map((item) => (
                                <div key={item} className="tt-academics-po-item">
                                  <span>{item}</span>
                                  <div className="tt-academics-po-actions">
                                    <button type="button">▷</button>
                                    <button type="button">✕</button>
                                  </div>
                                </div>
                              ))}
                              <div className="tt-academics-side-subgroup-label">Scheduled</div>
                              {timetableScheduledItems.map((item) => (
                                <div key={item} className="tt-academics-po-item">
                                  <span>{item}</span>
                                  <div className="tt-academics-po-actions">
                                    <button type="button">▷</button>
                                    <button type="button">✕</button>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                    </div>
                  </div>

                </div>
              </div>

              <div className="tt-academics-bottom">
                <div className="tt-academics-bottom-card accountant-card">
                  <div className="tt-academics-bottom-card-inner">{<SubstituteAssignmentEmbed isMobile={isMobile} />}</div>
                </div>
                <div className="tt-academics-bottom-card accountant-card">
                  <div className="tt-academics-bottom-card-inner">{renderExtraClassOnly()}</div>
                </div>
                <div className="tt-academics-bottom-card accountant-card">
                  <div className="tt-academics-bottom-card-inner">{renderSpecialClassOnly()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="accountant-footer-brand">
          <span>Powered By:</span>
          <img src={abcLogo} alt="Cleezo Class" className="accountant-footer-logo" />
        </div>

        <ErrorPopup
          message={popup.message}
          type={popup.type}
          onClose={() => setPopup({ message: "", type: "" })}
        />
      </div>
    );
  }

  return (
        <div className="event-container">
      <h1 className="footprintsinner">Operations - Timetable </h1>
    <ScrollableSection
      height={isMobile ? "50vh" : isLaptop ? "95vh" : "65vh"}
    >
      
      {{
        firstSection: (
          
        
            <div className="at-container" style={{paddingBottom:'100px'}}>
              <div className="at-main-grid">
                <div className="at-left-column">
                  {renderTimetableGeneration()}
                </div>
                
                <div className="at-right-column">
                  {showTimetable ? renderTimetableDisplay() : renderActionsSection()}
                </div>
              </div>
            </div>
        ),
        secondSection: (
          <div className="at-outer-container" >
            <div className="at-container">
              <div className="at-main-grid">
                <div className="at-left-column">
                  <SubstituteAssignmentEmbed isMobile={isMobile} />
                </div>
                <div className="at-right-column">
                  {renderExtraSpecialClassCard()}
                </div>
              </div>
            </div>
          </div>
        ),
      }}
    </ScrollableSection>
    <ErrorPopup
  message={popup.message}
  type={popup.type}
  onClose={() => setPopup({ message: "", type: "" })}
/>

    </div>
  );
};

export default TimetableAdmin;
