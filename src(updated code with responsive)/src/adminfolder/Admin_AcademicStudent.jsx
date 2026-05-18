import axios from 'axios';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartBar, faSync, faSearch, faLayerGroup, faArrowRight, faTrophy, faBug,
  faUserTie, faUserGraduate, faChalkboardTeacher, faTimes
} from "@fortawesome/free-solid-svg-icons";
import './AccademicTeacherAdmin.css';

// Chart.js Imports and Registration
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ErrorPopup from '../shared/ErrorPopup';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const API_BASE = 'https://cleezoclass.com:4000/api/admin';

// Retrieve School Code from localStorage
const getSchoolCode = () => {
  const storedCode = localStorage.getItem('schoolCode');
  return storedCode || 'TAGSOLNOVALLP';
};

const classCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

const getClassSortRank = (label) => {
  const raw = String(label ?? '').trim();
  const normalized = raw.toLowerCase().replace(/[\s._-]/g, '');

  if (!normalized) return { group: 3, value: Number.MAX_SAFE_INTEGER, raw };

  if (/^(prenursery|prekg)$/.test(normalized)) return { group: 0, value: 0, raw };
  if (/^nursery$/.test(normalized)) return { group: 0, value: 1, raw };
  if (/^(lkg|lowerkindergarten)$/.test(normalized)) return { group: 0, value: 2, raw };
  if (/^(ukg|upperkindergarten)$/.test(normalized)) return { group: 0, value: 3, raw };
  if (/^(kg|kindergarten)$/.test(normalized)) return { group: 0, value: 4, raw };

  const numericMatch = normalized.match(/\d+/);
  if (numericMatch) {
    return { group: 1, value: parseInt(numericMatch[0], 10), raw };
  }

  return { group: 2, value: Number.MAX_SAFE_INTEGER, raw };
};

const sortClassNames = (classes = []) => {
  const unique = Array.from(new Set((classes || []).filter(Boolean)));
  return unique.sort((a, b) => {
    const rankA = getClassSortRank(a);
    const rankB = getClassSortRank(b);
    if (rankA.group !== rankB.group) return rankA.group - rankB.group;
    if (rankA.value !== rankB.value) return rankA.value - rankB.value;
    return classCollator.compare(String(a), String(b));
  });
};

// DataModal Component
const DataModal = ({ visible, data, studentName, onClose }) => {
  if (!visible) return null;

  const getColumns = (data) => {
    if (!data || data.length === 0) return [];
    if (data[0].test_type) return ['test_type', 'subject', 'marks', 'createdAt'];
    if (data[0].date && !data[0].report) return ['date', 'leavetype', 'submission_time', 'name', 'class', 'section'];
    if (data[0].report && !data[0].date) return ['created_at', 'report', 'comment', 'class_name', 'section'];
    if (data[0].program_name) return ['winning_date', 'program_name', 'winning_event', 'winning_rank'];
    return Object.keys(data[0]);
  };

  const columns = getColumns(data);

  const formatValue = (col, value) => {
    if (!value) return 'N/A';
    if (col.toLowerCase() === 'created_at' || col.toLowerCase() === 'createdat') {
      const date = new Date(value);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    if (col.toLowerCase() === 'date' || col.toLowerCase() === 'winning_date') {
      const date = new Date(value);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return value;
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          width: '90%',
          maxWidth: '950px',
          height: '75vh',
          overflowY: 'auto',
          boxShadow: '0 5px 20px rgba(0,0,0,0.5)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ color: '#2C3E50', margin: 0, fontSize: '12px' }}>
            Raw Data for {studentName} ({data.length} records)
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              color: '#E74C3C',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              {columns.map(col => (
                <th
                  key={col}
                  style={{
                    border: '1px solid #ddd',
                    padding: '10px',
                    textAlign: 'left',
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                {columns.map(col => (
                  <td
                    key={col}
                    style={{
                      border: '1px solid #ddd',
                      padding: '8px',
                      verticalAlign: 'top'
                    }}
                  >
                    {formatValue(col, row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ViewButton Component
const ViewButton = ({ data, studentName, onClick }) => (
  <button type="button" onClick={() => onClick(data, studentName)} className="btn-solid">
    View Data ({data.length})
  </button>
);

// ReportButton Component
const ReportButton = ({ icon, label, color, onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled} className="btn-solid" style={{  padding: '6px 12px', fontSize: '11px' }}>
    {label}
  </button>
);

// Chart Options
const commonChartOptions = (titleText, yAxisTitle) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        boxWidth: 10,
        padding: 5,
        font: { size: 10 }
      }
    },
    title: {
      display: true,
      text: titleText,
      font: { size: 12 }
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 9 } }
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: yAxisTitle, font: { size: 10 } },
      max: 100,
      grid: { display: false },
      ticks: { font: { size: 9 } }
    }
  }
});

// AcademicChart Component
const AcademicChart = ({ data, studentName }) => {
  const validData = data || [];
  let subjects = [];
  let averageMarks = [];

  if (validData.length > 0) {
    const subjectMap = validData.reduce((acc, record) => {
      const { subject, marks } = record;
      acc[subject] = acc[subject] || { totalMarks: 0, count: 0 };
      acc[subject].totalMarks += marks;
      acc[subject].count += 1;
      return acc;
    }, {});

    subjects = Object.keys(subjectMap);
    averageMarks = subjects.map(subject =>
      parseFloat((subjectMap[subject].totalMarks / subjectMap[subject].count).toFixed(2))
    );
  } else {
    subjects = ['No Data'];
    averageMarks = [0];
  }

  const chartData = {
    labels: subjects,
    datasets: [
      {
        label: validData.length > 0 ? 'Average Marks' : 'No Data Available',
        data: averageMarks,
        backgroundColor: validData.length > 0 ? 'rgba(52, 152, 219, 0.7)' : 'rgba(189, 195, 199, 0.4)',
        borderColor: validData.length > 0 ? 'rgba(52, 152, 219, 1)' : 'rgba(189, 195, 199, 0.6)',
        borderWidth: 1,
      },
    ],
  };

  const options = commonChartOptions(`${studentName}'s Average Marks per Subject`, 'Average Marks');
  return <Bar data={chartData} options={options} />;
};

// AttendanceChart Component
const AttendanceChart = ({ data, studentName }) => {
  const validData = data || [];
  const counts = { Present: 0, Absent: 0 };

  validData.forEach(item => {
    const leaveType = item.leavetype ? item.leavetype.toLowerCase() : 'present';
    if (leaveType === 'present') {
      counts.Present += 1;
    } else if (leaveType === 'informed' || leaveType === 'uninformed') {
      counts.Absent += 1;
    }
  });

  const labels = ['Present', 'Absent / Leave'];
  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Attendance Count',
        data: [counts.Present, counts.Absent],
        backgroundColor: [
          'rgba(46, 204, 113, 0.7)',
          'rgba(231, 76, 60, 0.7)',
        ],
        borderColor: [
          'rgba(46, 204, 113, 1)',
          'rgba(231, 76, 60, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = commonChartOptions(`${studentName}'s Attendance Distribution`, 'Number of Days');
  options.plugins.legend.display = false;
  options.scales.x.barPercentage = 1.0;
  options.scales.x.categoryPercentage = 1.0;
  options.scales.y.max = undefined;
  options.scales.y.ticks.stepSize = 1;

  return <Bar data={chartData} options={options} />;
};

// DisciplineChart Component
const DisciplineChart = ({ data, studentName }) => {
  const validData = data || [];
  const monthlyCounts = validData.reduce((acc, record) => {
    const date = new Date(record.created_at);
    const monthYear = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    acc[monthYear] = (acc[monthYear] || 0) + 1;
    return acc;
  }, {});

  const sortedMonths = Object.keys(monthlyCounts).sort((a, b) => new Date(a) - new Date(b));

  const chartData = {
    labels: sortedMonths,
    datasets: [
      {
        label: 'Discipline Reports',
        data: sortedMonths.map(month => monthlyCounts[month]),
        backgroundColor: 'rgba(243, 156, 18, 0.7)',
        borderColor: 'rgba(243, 156, 18, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = commonChartOptions(`${studentName}'s Discipline Reports by Month`, 'Number of Reports');
  options.scales.y.max = undefined;
  options.scales.y.ticks.stepSize = 1;

  return <Bar data={chartData} options={options} />;
};

// CombinedReportChart Component
const CombinedReportChart = ({ data, studentName }) => {
  const validData = data || [];
  const attendanceData = validData.filter(item => item.date);
  const disciplineData = validData.filter(item => item.report);

  const attendanceMonthlyData = attendanceData.reduce((acc, item) => {
    const date = new Date(item.date);
    const monthYear = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    acc[monthYear] = acc[monthYear] || { present: 0, absent: 0 };
    if (item.leavetype === 'Present' || !item.leavetype) {
      acc[monthYear].present += 1;
    } else {
      acc[monthYear].absent += 1;
    }
    return acc;
  }, {});

  const disciplineMonthlyData = disciplineData.reduce((acc, record) => {
    const date = new Date(record.created_at);
    const monthYear = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    acc[monthYear] = (acc[monthYear] || 0) + 1;
    return acc;
  }, {});

  const allMonths = new Set([...Object.keys(attendanceMonthlyData), ...Object.keys(disciplineMonthlyData)]);
  const sortedMonths = Array.from(allMonths).sort((a, b) => new Date(a) - new Date(b));

  const presentData = sortedMonths.map(month => attendanceMonthlyData[month]?.present || 0);
  const absentData = sortedMonths.map(month => attendanceMonthlyData[month]?.absent || 0);
  const disciplineCountData = sortedMonths.map(month => disciplineMonthlyData[month] || 0);

  const chartData = {
    labels: sortedMonths,
    datasets: [
      {
        label: 'Present Days (Attendance)',
        data: presentData,
        backgroundColor: 'rgba(46, 204, 113, 0.7)',
      },
      {
        label: 'Absent/Leave Days (Attendance)',
        data: absentData,
        backgroundColor: 'rgba(231, 76, 60, 0.7)',
      },
      {
        label: 'Discipline Reports',
        data: disciplineCountData,
        backgroundColor: 'rgba(52, 152, 219, 0.7)',
      },
    ],
  };

  const options = commonChartOptions(`${studentName}'s Monthly Co-Scholastic (Attendance & Discipline)`, 'Count (Days or Reports)');
  options.scales.y.max = undefined;
  options.scales.y.ticks.stepSize = 1;

  return <Bar data={chartData} options={options} />;
};

// ExtraCurricularChart Component
const ExtraCurricularChart = ({ data, studentName }) => {
  const validData = data || [];
  const programCounts = validData.reduce((acc, record) => {
    const program = record.program_name || 'N/A';
    acc[program] = (acc[program] || 0) + 1;
    return acc;
  }, {});

  const programs = Object.keys(programCounts);
  const counts = programs.map(program => programCounts[program]);

  const chartData = {
    labels: programs,
    datasets: [
      {
        label: 'Activities Participated',
        data: counts,
        backgroundColor: 'rgba(155, 89, 182, 0.7)',
        borderColor: 'rgba(155, 89, 182, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = commonChartOptions(`${studentName}'s Extracurricular Activities`, 'Number of Participations');
  options.scales.y.max = undefined;
  options.scales.y.ticks.stepSize = 1;
  options.scales.x.ticks.callback = function(value) {
    const label = this.getLabelForValue(value);
    return label.length > 10 ? label.substring(0, 10) + '...' : label;
  };

  return <Bar data={chartData} options={options} />;
};

// ChartContainer Component
const ChartContainer = ({ children, data, studentName, studentData, onReportSuperAdmin }) => {
  const isDataEmpty = !data || data.length === 0;
  const resolvedStudentName =
    studentName ||
    studentData?.name ||
    studentData?.student_name ||
    "Selected Student";
  const resolvedClass =
    studentData?.class_name ||
    studentData?.class ||
    "N/A";
  const resolvedSection =
    studentData?.section ||
    "N/A";

  const handleSuperAdminReport = () => {
    if (studentData) {
      const reportData = {
        type: "admin_complaint",
        chart: studentData.dataKey,
        studentName: resolvedStudentName,
        class: resolvedClass,
        section: resolvedSection,
        message: `Admin complaint on ${studentData.dataKey} for ${resolvedStudentName} (Class ${resolvedClass}-${resolvedSection})`,
        timestamp: new Date().toISOString(),
      };
      onReportSuperAdmin(reportData);
    } else {
      window.alert("No student selected to report.");
    }
  };

  const handleReportTeacher = () => {
    if (studentData) {
      const reportData = {
        type: "teacher_report",
        chart: studentData.dataKey,
        studentName: resolvedStudentName,
        class: resolvedClass,
        section: resolvedSection,
        message: `Teacher report on ${studentData.dataKey} for ${resolvedStudentName} (Class ${resolvedClass}-${resolvedSection})`,
        timestamp: new Date().toISOString(),
      };
      onReportSuperAdmin(reportData);
    } else {
      window.alert("No student selected to report.");
    }
  };

  const handleReportParent = () => {
    window.alert(`Reporting issue with ${studentData?.dataKey || "data"} for ${studentName} to Parent.`);
  };

  return (
    <div className="admin-chart-container">
      <div className="admin-chart-area">
        {children}
      </div>
      <div className="admin-chart-footer">
        {isDataEmpty ? (
          <p className="admin-chart-info-text">
            {studentName ? "" : 'Select a student and click "View Report" to load the chart.'}
          </p>
        ) : (
          <ViewButton data={data} studentName={studentName} onClick={studentData.onViewData} />
        )}
        <div className="admin-report-buttons">
          <ReportButton
            icon={faChalkboardTeacher}
            label="Report to Teacher"
            onClick={handleReportTeacher}
            disabled={!studentName}
          />
          <ReportButton
            icon={faUserGraduate}
            label="Report to Parent"
            color="#5a7488"
            onClick={handleReportParent}
            disabled={!studentName}
          />
          <ReportButton
            icon={faUserTie}
            label="Report to Super Admin"
            color="#5a7488"
            onClick={handleSuperAdminReport}
            disabled={!studentName}
          />
        </div>
      </div>
    </div>
  );
};

// Chart Display Components
const AcademicChartDisplay = ({ data, studentName, onViewData, studentData, onReportSuperAdmin }) => {
  const chartName = studentName || 'Selected Student';
  return (
    <ChartContainer
      data={data}
      studentName={chartName}
      studentData={{ ...studentData, onViewData, dataKey: 'Academic Performance' }}
      onReportSuperAdmin={onReportSuperAdmin}
    >
      <AcademicChart data={data || []} studentName={chartName} />
    </ChartContainer>
  );
};

const AttendanceChartDisplay = ({ data, studentName, onViewData, studentData, onReportSuperAdmin }) => {
  const chartName = studentName || 'Selected Student';
  const filteredData = (data || []).filter(item => item.name === studentName);
  return (
    <ChartContainer
      data={filteredData}
      studentName={chartName}
      studentData={{ ...studentData, onViewData, dataKey: 'Attendance Report' }}
      onReportSuperAdmin={onReportSuperAdmin}
    >
      <AttendanceChart data={filteredData} studentName={chartName} />
    </ChartContainer>
  );
};

const DisciplineChartDisplay = ({ data, studentName, onViewData, studentData, onReportSuperAdmin }) => {
  const chartName = studentName || 'Selected Student';
  return (
    <ChartContainer
      data={data}
      studentName={chartName}
      studentData={{ ...studentData, onViewData, dataKey: 'Discipline Report' }}
      onReportSuperAdmin={onReportSuperAdmin}
    >
      <DisciplineChart data={data || []} studentName={chartName} />
    </ChartContainer>
  );
};

const CombinedReportChartDisplay = ({ data, studentName, onViewData, studentData, onReportSuperAdmin }) => {
  const chartName = studentName || 'Selected Student';
  return (
    <ChartContainer
      data={data}
      studentName={chartName}
      studentData={{ ...studentData, onViewData, dataKey: 'Co Scolastic' }}
      onReportSuperAdmin={onReportSuperAdmin}
    >
      <CombinedReportChart data={data || []} studentName={chartName} />
    </ChartContainer>
  );
};

const ExtraCurricularChartDisplay = ({
  data,
  studentName,
  onViewData,
  studentData,
  onReportSuperAdmin
}) => {

  const chartName = studentName || 'Selected Student';

  return (
    <div className="chart-main-wrapper">
      
      {/* LEFT SIDE → GRAPH */}
      <div className="chart-left">
        <ExtraCurricularChart
          data={data || []}
          studentName={chartName}
        />
      </div>

      {/* RIGHT SIDE → CONTAINER */}
      <div className="chart-right">
        <ChartContainer
          data={data}
          studentName={chartName}
          studentData={{ ...studentData, onViewData, dataKey: 'Extra Curricular Activities' }}
          onReportSuperAdmin={onReportSuperAdmin}
        />
      </div>

    </div>
  );
};

// FilterAndFetch Component
const FilterAndFetch = ({
  title,
  fetchDetailsEndpoint,
  dataKey,
  DisplayComponent,
  isPost = false,
  fetchSecondaryEndpoint = null,
  onReportSuperAdmin
}) => {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [classList, setClassList] = useState([]);
  const [sectionList, setSectionList] = useState([]);
  const [selectedStudentUsername, setSelectedStudentUsername] = useState('');
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [studentDropdownList, setStudentDropdownList] = useState([]);
  const [studentFullList, setStudentFullList] = useState([]);
  const [currentStudentData, setCurrentStudentData] = useState(null);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [data, setData] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ data: [], studentName: '' });
  const [curriculumList, setCurriculumList] = useState([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState("");

  // Fetch metadata for classes and sections
  const fetchMetadata = useCallback(async () => {
    setDropdownLoading(true);
    const schoolCode = getSchoolCode();
    try {
      const [classRes, sectionRes] = await Promise.all([
        axios.get(`${API_BASE}/classes?schoolCode=${schoolCode}`),
        axios.get(`${API_BASE}/sections?schoolCode=${schoolCode}`),
      ]);
      setClassList(sortClassNames(classRes.data));
      setSectionList(sectionRes.data);
    } catch (error) {
      console.error("Error fetching metadata:", error);
    }
    setDropdownLoading(false);
  }, []);

  // Fetch curriculum for selected class and section
  useEffect(() => {
    if (!selectedClass || !selectedSection) {
      setCurriculumList([]);
      return;
    }
    setSelectedCurriculum("");
    setStudentDropdownList([]);
    setCurriculumList([]);

    const fetchCurriculum = async () => {
      try {
        setDropdownLoading(true);
        const schoolCode = getSchoolCode();
        const res = await axios.get(
          `${API_BASE}/curriculum/${selectedClass}/${selectedSection}?schoolCode=${schoolCode}`
        );
        console.log("Curriculum API Response:", res.data); // Debug log
        setCurriculumList(res.data || []);
      } catch (err) {
        console.error("Error fetching curriculum:", err.response?.data || err.message);
        setCurriculumList([]);
      } finally {
        setDropdownLoading(false);
      }
    };

    fetchCurriculum();
  }, [selectedClass, selectedSection]);

  // Fetch students for selected class, section, and curriculum
  useEffect(() => {
    if (!selectedClass || !selectedSection) return;
    if (curriculumList.length > 0 && !selectedCurriculum) return;

    const fetchStudents = async () => {
      try {
        setDropdownLoading(true);
        const schoolCode = getSchoolCode();
        let url = `${API_BASE}/students/${selectedClass}/${selectedSection}`;
        if (selectedCurriculum) {
          url += `/${selectedCurriculum}`;
        }
        const res = await axios.get(`${url}?schoolCode=${schoolCode}`);
        setStudentDropdownList(res.data || []);
      } catch (err) {
        console.error("Error fetching students:", err.response?.data || err.message);
        setStudentDropdownList([]);
      } finally {
        setDropdownLoading(false);
      }
    };

    fetchStudents();
  }, [selectedClass, selectedSection, selectedCurriculum, curriculumList]);

  // Fetch all students for selected class and section
  const fetchStudentsList = useCallback(async () => {
    setDropdownLoading(true);
    const schoolCode = getSchoolCode();
    try {
      const studentResponse = await axios.get(`${API_BASE}/students`, {
        params: {
          class_name: selectedClass,
          section: selectedSection,
          schoolCode: schoolCode
        }
      });
      const studentsData = studentResponse.data;
      setStudentFullList(studentsData);
      const studentOptions = Array.isArray(studentsData)
        ? studentsData.map(s => ({
            name: s.name,
            id: s.id,
            username: s.username,
            class_name: s.class_name,
            section: s.section
          })).sort((a, b) => a.name.localeCompare(b.name))
        : [];
      setStudentDropdownList(studentOptions);
    } catch (error) {
      console.error("Error fetching filtered students list:", error.response?.data || error.message);
    } finally {
      setDropdownLoading(false);
    }
  }, [selectedClass, selectedSection]);

  // Handle student selection
  const handleStudentSelect = (selectedUsername) => {
    setSelectedStudentUsername(selectedUsername);
    if (!selectedUsername) {
      setSelectedStudentName('');
      setCurrentStudentData(null);
      setData(null);
      return;
    }
    const student = studentFullList.find(s => s.username === selectedUsername);
    if (student) {
      setSelectedStudentName(student.name);
      setCurrentStudentData(student);
      setData(null);
    } else {
      setSelectedStudentName('');
      setCurrentStudentData(null);
      setData(null);
    }
  };

  // Fetch student details
  const handleFetchStudentDetails = async (studentData) => {
    const student = studentData;
    if (!student) {
      setDetailsLoading(false);
      setData(null);
      return;
    }

    setDetailsLoading(true);
    const { username, name, class_name, section } = student;
    const schoolCode = getSchoolCode();

    try {
      if (fetchSecondaryEndpoint) {
        const [primaryRes, secondaryRes] = await Promise.all([
          axios.get(`${API_BASE}/${fetchDetailsEndpoint.replace(':username', username)}?schoolCode=${schoolCode}`),
          axios.get(`${API_BASE}/${fetchSecondaryEndpoint.replace(':username', username)}?schoolCode=${schoolCode}`),
        ]);
        setData([...primaryRes.data, ...secondaryRes.data]);
      } else {
        let response;
        let url = `${API_BASE}/${fetchDetailsEndpoint.replace(':username', username)}`;
        if (isPost) {
          response = await axios.post(url, {
            username,
            name,
            class_name,
            section,
            schoolCode: schoolCode
          });
        } else {
          url = `${url}?schoolCode=${schoolCode}`;
          response = await axios.get(url);
        }
        setData(response.data);
      }
    } catch (error) {
      console.error(`FAILED to fetch student ${dataKey} details:`, error.message, error.response?.data);
      setData([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Handle view data modal
  const handleViewData = (fetchedData, name) => {
    setModalContent({ data: fetchedData, studentName: name });
    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalContent({ data: [], studentName: '' });
  };

  // Fetch data on button click
  const handleFetchDataClick = () => {
    if (currentStudentData) {
      handleFetchStudentDetails(currentStudentData);
    }
  };

  // Reset student selection when class or section changes
  useEffect(() => {
    setSelectedStudentUsername('');
    setSelectedStudentName('');
    setCurrentStudentData(null);
    setData(null);
  }, [selectedClass, selectedSection]);

  // Fetch metadata on component mount
  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return (
    <div className="admin-filter-container">
      <h2 className="admin-filter-heading">{title}</h2>
      <div className="admin-filter-display">
        {detailsLoading && data === null ? (
          <div className="admin-filter-loading">Loading chart data...</div>
        ) : (
          <DisplayComponent
            data={data}
            studentName={selectedStudentName}
            onViewData={handleViewData}
            studentData={currentStudentData}
            onReportSuperAdmin={onReportSuperAdmin}
          />
        )}
      </div>
      <div className="admin-filter-controls" style={{marginLeft:'8px'}}>
        {/* Class Dropdown */}
                                      <div className="expense-input-field">
          <select
            id={`${dataKey}-class-select`}
            className="btn-dropdown-FeesManagement admin-filter-select"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            disabled={dropdownLoading}
          >
            <option value="">Select Class</option>
            {classList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Section Dropdown */}
                                      <div className="expense-input-field">
          <select
            id={`${dataKey}-section-select`}
            className="btn-dropdown-FeesManagement admin-filter-select"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={dropdownLoading}
          >
            <option value="">Select Section</option>
            {sectionList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Curriculum Dropdown (if exists) */}
        {curriculumList.length > 0 && (
                                      <div className="expense-input-field">
            <select
              className="btn-dropdown-FeesManagement admin-filter-select"
              value={selectedCurriculum}
              onChange={(e) => setSelectedCurriculum(e.target.value)}
              disabled={dropdownLoading}
            >
              <option value="">Select Curriculum</option>
              {curriculumList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* Student Dropdown */}
                                      <div className="expense-input-field">
          <select
            id={`${dataKey}-student-select`}
            className="btn-dropdown-FeesManagement admin-filter-select"
            value={selectedStudentUsername}
            onChange={(e) => handleStudentSelect(e.target.value)}
            disabled={
              dropdownLoading ||
              (curriculumList.length > 0 && !selectedCurriculum)
            }
          >
            <option value="">
              {dropdownLoading
                ? "Loading..."
                : studentDropdownList.length > 0
                  ? "Select Student"
                  : "No Students"}
            </option>
            {studentDropdownList.map((student) => (
              <option key={student.id} value={student.username}>
                {student.name}
              </option>
            ))}
          </select>
        </div>

        {/* View Report Button */}
        <button
          type="button" style={{marginLeft:'120px', marginTop:'-16%',}}
          onClick={handleFetchDataClick}
          disabled={!currentStudentData || detailsLoading}
          className="btn-outline admin-filter-view-btn"
        >
          <FontAwesomeIcon
            icon={detailsLoading ? faSync : faChartBar}
            spin={detailsLoading}
            className="admin-filter-btn-icon"
          />
          {detailsLoading ? "Fetching..." : "View Report"}
        </button>
      </div>

      {/* Data Modal */}
      <DataModal
        visible={isModalOpen}
        data={modalContent.data}
        studentName={modalContent.studentName}
        onClose={handleCloseModal}
      />
    </div>
  );
};

// Main Component
const AccademicTeacherAdmin = () => {
  const rightContainerRef = useRef(null);
  const actionsHeaderRef = useRef(null);
  const isLaptop = window.innerWidth > 600 && window.innerWidth <= 1440;
  const isLargeMonitor = window.innerWidth > 1440;

  const [pendingClasses, setPendingClasses] = useState(() => {
    const stored = localStorage.getItem('pendingClasses');
    return stored ? JSON.parse(stored) : [
      { class_name: '10', section: 'A' },
      { class_name: '11', section: 'C' },
    ];
  });

  const [submittedClasses, setSubmittedClasses] = useState(() => {
    const stored = localStorage.getItem('submittedClasses');
    return stored ? JSON.parse(stored) : [
      { class_name: '12', section: 'B' },
    ];
  });

  const [dismissedClasses, setDismissedClasses] = useState(() => {
    const storedDismissed = localStorage.getItem('dismissedClasses');
    return storedDismissed ? JSON.parse(storedDismissed) : [];
  });

  const [superAdminReports, setSuperAdminReports] = useState(() => {
    const storedReports = localStorage.getItem('superAdminReports');
    return storedReports ? JSON.parse(storedReports) : [];
  });
  const [recentActions, setRecentActions] = useState(() => {
    const stored = localStorage.getItem('adminAcademicStudentRecentActions');
    return stored ? JSON.parse(stored) : [];
  });

  const addRecentAction = useCallback((title, detail) => {
    const action = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title,
      detail,
      createdAt: new Date().toISOString(),
    };
    setRecentActions(prev => [action, ...prev].slice(0, 30));
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('pendingClasses', JSON.stringify(pendingClasses));
  }, [pendingClasses]);

  useEffect(() => {
    localStorage.setItem('submittedClasses', JSON.stringify(submittedClasses));
  }, [submittedClasses]);

  useEffect(() => {
    localStorage.setItem('dismissedClasses', JSON.stringify(dismissedClasses));
  }, [dismissedClasses]);

  useEffect(() => {
    localStorage.setItem('superAdminReports', JSON.stringify(superAdminReports));
  }, [superAdminReports]);

  useEffect(() => {
    localStorage.setItem('adminAcademicStudentRecentActions', JSON.stringify(recentActions));
  }, [recentActions]);

  // Handle reporting to super admin
  const handleReportSuperAdmin = useCallback(async (report) => {
    try {
      const schoolCode = getSchoolCode();
      const safeStudentName = report.studentName || "Selected Student";
      const safeClass = report.class || "N/A";
      const safeSection = report.section || "N/A";
      console.log("Sending Report:", report, schoolCode);
      const normalizedType = report.type === "teacher_report" ? "teacher_report" : "admin_complaint";
      const response = await axios.post(
        `https://cleezoclass.com:4000/api/complaints`,
        {
          schoolCode,
          type: normalizedType,
          teacher: safeStudentName,
          subject: report.chart,
          classes: [`${safeClass}-${safeSection}`],
          message: report.message || `Issue with ${report.chart} for ${safeStudentName}`,
        }
      );

      if (response.status === 200) {
        setSuperAdminReports((prev) => [{ ...report, studentName: safeStudentName, class: safeClass, section: safeSection }, ...prev]);
        addRecentAction(
          normalizedType === "teacher_report" ? "Report sent to Chief (Teacher Report)" : "Complaint sent to Chief",
          `${safeStudentName} | ${report.chart} | Class ${safeClass}-${safeSection}`
        );
        setPopup({
          message: normalizedType === "teacher_report"
            ? `Teacher report for ${safeStudentName} sent successfully!`
            : `Complaint for ${safeStudentName} sent successfully!`,
          type: "success"
        });
      }
    } catch (error) {
      console.error('Error sending report:', error.response?.data || error);
      setPopup({
        message: "Error sending report.",
        type: "error"
      });
    }
  }, [addRecentAction]);

  // Handle complain admin
  const handleComplainAdmin = () => {
    addRecentAction("Complaint action", "Complaint to admin initiated");
    setPopup({
      message: "Complaint action logged.",
      type: "info"
    });
  };

  // Handle dismiss class
  const handleDismissClass = (class_name, section) => {
    const key = `${class_name}-${section}`;
    setDismissedClasses(prev => [...prev, key]);
    addRecentAction("Class action completed", `Class ${class_name}-${section} marked OK`);
  };

  const allClassActions = [
    ...pendingClasses.map(cls => ({ ...cls, status: 'Pending' })),
    ...submittedClasses.map(cls => ({ ...cls, status: 'Submitted' })),
  ].filter(cls => !dismissedClasses.includes(`${cls.class_name}-${cls.section}`));

  // ScrollDownIcon Component
  const ScrollDownIcon = ({ width = 40, height = 60, direction = "down" }) => {
    const rotate = direction === "up" ? "rotate(180deg)" : "none";
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 64 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: rotate }}
      >
        <rect x="12" y="2" width="40" height="60" rx="20" stroke="#0a3d62" strokeWidth="4" />
        <line x1="32" y1="16" x2="32" y2="32" stroke="#0a3d62" strokeWidth="4" strokeLinecap="round" />
        <polyline
          points="24,44 32,52 40,44"
          fill="none"
          stroke="#0a3d62"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // Scroll and visibility logic
  const scrollAreaRef = useRef(null);
  const firstSectionRef = useRef(null);
  const secondSectionRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [secondSectionVisible, setSecondSectionVisible] = useState(false);
  const ignoreScrollHideRef = useRef(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const secondSectionVisibleRef = useRef(secondSectionVisible);
  useEffect(() => {
    secondSectionVisibleRef.current = secondSectionVisible;
  }, [secondSectionVisible]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const handleScroll = () => {
      const y = el.scrollTop;
      if (y > 200 && !secondSectionVisibleRef.current) setSecondSectionVisible(true);
      if (y < 150 && secondSectionVisibleRef.current && !ignoreScrollHideRef.current) {
        setSecondSectionVisible(false);
      }
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSecondSection = () => {
    if (!secondSectionVisible) setSecondSectionVisible(true);
    ignoreScrollHideRef.current = true;
    setTimeout(() => {
      ignoreScrollHideRef.current = false;
    }, 300);
    requestAnimationFrame(() => {
      secondSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const scrollToTop = () => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => setSecondSectionVisible(false), 300);
  };

  const [popup, setPopup] = useState({ message: "", type: "" });

  return (
    <div ref={scrollAreaRef}>
      <div className="footprintsinner">Operations – Academic – Student</div>
      <div ref={firstSectionRef} className="admin-section">
        <div className="staff-row-container" style={{paddingBottom:'100px'}}>
          <div className="track-left-container">
            <div className="staff-test-performance">
              <FilterAndFetch
                title="Scholastics"
                fetchDetailsEndpoint="student/academics"
                dataKey="academics"
                DisplayComponent={AcademicChartDisplay}
                isPost={true}
                onReportSuperAdmin={handleReportSuperAdmin}
              />
            </div>
            <div className="staff-test-performance" style={{ border: 'none' }}>
              <FilterAndFetch
                title="Co-Scholastics"
                fetchDetailsEndpoint="student/attendance/:username"
                fetchSecondaryEndpoint="student/discipline/:username"
                dataKey="combined"
                DisplayComponent={CombinedReportChartDisplay}
                isPost={false}
                onReportSuperAdmin={handleReportSuperAdmin}
              />
            </div>
          </div>
          <div className="Card-rightContainer">
            <div className="admin-actions-container">
              <h3 className="admin-actions-title">
                Actions ({allClassActions.length + superAdminReports.length})
              </h3>

              <div className="admin-actions-block">
                <div className="admin-actions-block-title">Recent Actions ({recentActions.length})</div>
                {recentActions.length === 0 ? (
                  <div className="admin-action-item">No recent actions yet</div>
                ) : (
                  recentActions.slice(0, 8).map((a) => (
                    <div key={a.id} className="admin-action-card">
                      <div className="admin-action-card-title">{a.title}</div>
                      <div className="admin-action-card-detail">{a.detail}</div>
                      <div className="admin-action-card-time">
                        {new Date(a.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="admin-actions-block">
                <div className="admin-actions-block-title">Scan & Pull</div>
                {allClassActions.length === 0 ? (
                  <div className="admin-action-item">No pending/submitted classes</div>
                ) : (
                  allClassActions.map((cls, i) => (
                    <div key={`${cls.class_name}-${cls.section}-${i}`} className="admin-action-card admin-action-row">
                      <div className="admin-action-card-detail">
                        <FontAwesomeIcon icon={faArrowRight} style={{ marginRight: '6px' }} />
                        Class {cls.class_name} - Section {cls.section}
                        <span className="admin-action-status">{cls.status}</span>
                      </div>
                      <button
                        type="button"
                        className="staff-ok-btn"
                        onClick={() => handleDismissClass(cls.class_name, cls.section)}
                      >
                        OK
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="admin-actions-block">
                <div className="admin-actions-block-title">Super Admin Reports ({superAdminReports.length})</div>
                {superAdminReports.length === 0 ? (
                  <div className="admin-action-item">No reports yet</div>
                ) : (
                  superAdminReports.slice(0, 10).map((rep, i) => (
                    <div key={i} className="admin-action-card">
                      <div className="admin-action-card-title">{rep.chart}</div>
                      <div className="admin-action-card-detail">
                        {rep.studentName} | Class {rep.class}-{rep.section}
                      </div>
                      <div className="admin-action-card-time">
                        {rep.timestamp ? new Date(rep.timestamp).toLocaleString() : "Recently"}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                className="btn-outline"
                onClick={handleComplainAdmin}
                style={{ marginTop: '8px' }}
              >
                Complain to Admin
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* repeat headline for second scroll segment so it remains visible when
           the user has scrolled past the first section */}
      <div className="footprintsinner" style={{ marginTop: '10px' }}>
        Operations – Academic – Student
      </div>
      <div className="staff-row-container" ref={secondSectionRef} style={{paddingTop:'10px'}}>
        <div className="track-left-container">
          <div className="staff-test-performance">
            <FilterAndFetch
              title="Attendance"
              fetchDetailsEndpoint="student/attendance/:username"
              dataKey="attendance"
              DisplayComponent={AttendanceChartDisplay}
              isPost={false}
              onReportSuperAdmin={handleReportSuperAdmin}
            />
          </div>
          <div className="staff-test-performance" style={{ border: 'none' }}>
            <FilterAndFetch
              title="Discipline Report"
              fetchDetailsEndpoint="student/discipline/:username"
              dataKey="discipline"
              DisplayComponent={DisciplineChartDisplay}
              isPost={false}
              onReportSuperAdmin={handleReportSuperAdmin}
            />
          </div>
        </div>
        <div className="Card-rightContainer">
            <div className="admin-panel">
              <FilterAndFetch
                title="Extracurricular Activities"
                fetchDetailsEndpoint="student/extra-curricular-data"
                dataKey="extra-curricular"
                DisplayComponent={ExtraCurricularChartDisplay}
                isPost={true}
                onReportSuperAdmin={handleReportSuperAdmin}
              />
          </div>
        </div>
      </div>
      <ErrorPopup
        message={popup.message}
        type={popup.type}
        onClose={() => setPopup({ message: "", type: "" })}
      />
    </div>
  );
};

export default AccademicTeacherAdmin;
