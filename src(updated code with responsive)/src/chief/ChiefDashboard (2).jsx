// ChiefDashboard.jsx

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";

// Assuming you have these components imported for the HR popup
import Recruiters from "../shared/Recruiters.jsx";
import EventAndMeetings from "../HR_EventsMettings.jsx";
import EnrollmentBiometrics from "./Chief_Hr_Enrollment.jsx";
import AttendancePayroll from "./Chief_Hr_Attendnce.jsx";
import RecruitmentChief from "./ChiefRecruitmentsAndEvents.jsx";
import EventsMeetingsChief from "./Chief_Hr_EventsMeeting.jsx";

// === NEW/ASSUMED IMPORTS FOR OPERATIONS & COMMERCE ===
import ExammanagementChief from "./Chief_operations_ExamManagemement.jsx";
import TimetableChief from "./Chief_operations_Timetable.jsx";
// 🟢 NEW ASSUMED IMPORTS FOR COMMERCE POPUP
import IncomeChief from "./Chief_commerce_Income.jsx";
import ExpenseChief from "./Chief_commerce_Expense.jsx";
import AdmissionTab from "./Chief_operations_AdmissionTab.jsx";

// Import the hover styles and the CardSection component
import './tabhower.css'
import CardSection from "../shared/CardSection.jsx"

// 🟢 NEW HELPER: Function to parse currency strings
const parseCurrency = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsedValue = parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
        return parsedValue;
    }
    if (value === null || typeof value === 'undefined') return 0;
    return 0;
};

// 🟢 NEW HELPER: Function to format date to YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
};

const Dashboard = () => {
  const navigate = useNavigate();
  const popupContentRef = useRef(null); 
  const [selectedYear, setSelectedYear] = useState("2025-2026"); 
  
  // 🔍 DEBUG: Initial state logging
  console.log("--- Dashboard Initialization Start ---");
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  // Initial dates set to 7 days ago to today
  const [fromDate, setFromDate] = useState(formatDate(sevenDaysAgo));
  const [toDate, setToDate] = useState(formatDate(today));
  console.log(`[INIT] Initial Dates: From=${fromDate}, To=${toDate}`);
  
  const [allFees, setAllFees] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [finalPaid, setFinalPaid] = useState(0); 
  const [finalPending, setFinalPending] = useState(0); 
  const [popupComponent, setPopupComponent] = useState(null);
  
  // 🧩 Component Maps (omitted for brevity, assume unchanged)
  const hrComponentMap = {
    "/Biometric": <EnrollmentBiometrics />,
    "/BiometricTeacher": <AttendancePayroll />,
    "/teacher/new-enrollment": <RecruitmentChief />,
    "/EventAndMeetings": <EventsMeetingsChief />,
  };
  
  const operationsComponentMap = {
    "/ExammanagementChief": <ExammanagementChief />,
    "/EventsMeetingDashboard": <EventsMeetingsChief />,
    "/ChiefDashboardWrapper": < AdmissionTab/>,
    "/TimetableChief": <TimetableChief />
  };
  
  const commerceComponentMap = {
    "/AccountantDashboard/Income": <IncomeChief />, 
    "/AccountantDashboard/Expense": <ExpenseChief />, 
  };

  const handleCardItemClick = (link) => {
    if (hrComponentMap[link]) {
        setPopupComponent(hrComponentMap[link]);
        return;
    }
    if (operationsComponentMap[link]) {
        setPopupComponent(operationsComponentMap[link]);
        return;
    }
    if (commerceComponentMap[link]) {
        setPopupComponent(commerceComponentMap[link]);
        return;
    }
    navigate(link);
  };
  
  const [showOperationsPopup, setShowOperationsPopup] = useState(false);

  const [totalPaid, setTotalPaid] = useState(0); 
  const [totalBalance, setBalance] = useState(0); 
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const font = "'Century Gothic', 'AppleGothic', sans-serif";
  const [totals, setTotals] = useState({
    totalPaid: 0,
    totalBalance: 0,
    totalPrice: 0,
    loading: true,
    error: null
  });

  // (Other useEffects, Styles, Card Data definitions omitted for brevity, assume unchanged)

// Function to generate an array of dates between two Date objects
const getDatesBetween = (start, end) => {
    const dates = [];
    let currentDate = new Date(start.getTime());
    currentDate.setHours(0, 0, 0, 0); 
    while (currentDate.getTime() <= end.getTime()) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    console.log(`[applyTimeFilter] Dates in Range (${dates.length}):`, dates.map(d => formatDate(d)));
    return dates;
};

// 🛑 CRITICAL FIX: The date field is checked with updated_at included.
const applyTimeFilter = () => {
    console.group("--- [applyTimeFilter] Data Processing Start ---");
    console.log(`[applyTimeFilter] 1. Input Dates: fromDate: ${fromDate} | toDate: ${toDate}`);
    
    // Convert string dates to Date objects (at the start/end of the day)
    const startDate = new Date(fromDate);
    startDate.setHours(0, 0, 0, 0); 
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999); 
    console.log("[applyTimeFilter] 2. Filter Range (Date Objects): Start:", startDate.toISOString().split('T')[0], " | End:", endDate.toISOString().split('T')[0]); 

    if (!allFees.length) {
        console.warn("[applyTimeFilter] ⚠️ No fee data available in allFees (Length 0). Exiting filter logic."); 
        setChartData([]);
        setFinalPaid(0);
        setFinalPending(0);
        console.groupEnd();
        return;
    }
    console.log(`[applyTimeFilter] 3. Processing ${allFees.length} records from allFees state.`); 


    // 1. Group the fee data by date (using full date as the key)
    const groupedData = allFees.reduce((acc, item, index) => { 
        
        // 🛑 FIX: Added 'updated_at' to the list of checked fields.
        const dateField = item.updated_at || item.payment_date || item.transaction_date || item.fee_date || item.created_at; 
        
        if (!dateField) {
            // ⚠️ WARNING FOR MISSING DATE FIELD
            if (index < 10) console.warn(`[applyTimeFilter] ⚠️ Record ${index} skipped: Missing date field. Available keys in object: ${Object.keys(item).join(', ')}`);
            return acc;
        }

        const date = new Date(dateField);
        
        // Check if the item date is within the selected range
        const isDateWithinFilter = (date >= startDate && date <= endDate);

        // 🟢 DEBUG LOGGING FOR INDIVIDUAL ITEMS (First 5 records only)
        if (index < 5) { 
            console.log(`[applyTimeFilter] > Record ${index}: Date Field Found='${dateField}', Date(Parsed)=${date.toISOString().split('T')[0]}, Within Range?=${isDateWithinFilter}`);
            console.log(`[applyTimeFilter] > Record ${index} Values: Total_Paid=${item.Total_Paid}, Total_Expected=${item.Total_Expected}`);
        }
        // ------------------------------------

        if (isDateWithinFilter) {
            // Group by the date (MM/DD/YYYY string)
            const dateKey = date.toLocaleDateString("en-US", { year: 'numeric', month: '2-digit', day: '2-digit' });

            acc[dateKey] = acc[dateKey] || { Paid: 0, Pending: 0 };
            
            const paidAmount = parseCurrency(item.Total_Paid);
            const completeFee = parseCurrency(item.Total_Expected);
            const pendingAmount = completeFee - paidAmount;
            
            acc[dateKey].Paid += paidAmount;
            acc[dateKey].Pending += pendingAmount;
        }
        return acc;
    }, {});

    console.log("[applyTimeFilter] 4. Grouped Data (Key: MM/DD/YYYY, shows totals per day):", groupedData); 

    // 2. Calculate total Paid and Pending across the selected filter
    const totals = Object.values(groupedData).reduce((acc, item) => {
        acc.Paid += item.Paid;
        acc.Pending += item.Pending;
        return acc;
    }, { Paid: 0, Pending: 0 });

    console.log(`[applyTimeFilter] 5. Chart Totals for Filter: Paid=₹${totals.Paid.toFixed(2)} | Pending=₹${totals.Pending.toFixed(2)}`); 

    // 3. Define ALL labels in correct chronological order
    const datesInRange = getDatesBetween(startDate, endDate);

    // Use day and short month for the label for better readability on XAxis
    const orderedLabels = datesInRange.map(d => `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`);
    
    // Get corresponding keys for grouping (MM/DD/YYYY)
    const orderedKeys = datesInRange.map(d => d.toLocaleDateString("en-US", { year: 'numeric', month: '2-digit', day: '2-digit' })); // MM/DD/YYYY


    // 4. Generate chartData from orderedLabels, filling missing data with 0
    const chartData = orderedLabels.map((label, index) => {
        const key = orderedKeys[index];
        const data = {
            label,
            Paid: groupedData[key]?.Paid || 0,
            Pending: groupedData[key]?.Pending || 0,
        };
        return data;
    });

    // 🟢 FINAL CHART DATA CHECK
    const totalDataPoints = chartData.length;
    const zeroDataPoints = chartData.filter(d => d.Paid === 0 && d.Pending === 0).length;
    console.log(`[applyTimeFilter] 6. Final Chart Data Check: Total Points=${totalDataPoints}, Zero Points=${zeroDataPoints}`);
    if (totalDataPoints === zeroDataPoints && totalDataPoints > 0) {
        console.error("[applyTimeFilter] 🛑 CRITICAL ERROR: All data points are zero! Check API response for date/amount fields.");
    }
    console.log("[applyTimeFilter] 7. Final chartData (First 3 records):", chartData.slice(0, 3)); 

    // 5. Update states
    setChartData(chartData);
    setFinalPaid(totals.Paid);
    setFinalPending(totals.Pending);
    
    console.groupEnd();
};

    const [finalUnpaid, setFinalUnpaid] = useState(0);
const API_BASE_URL = "https://cleezoclass.com:4000"; 

    // 🔄 MODIFIED: fetchFeeData now uses current fromDate and toDate from state
    const fetchFeeData = async () => {
        const schoolCode = localStorage.getItem("schoolCode");
        if (!schoolCode) {
            console.error("[fetchFeeData] School code not available. Cannot fetch data.");
            return;
        }
        
        const apiUrl = `${API_BASE_URL}/api/fee-records?type=AllFeesStatusReport&fromDate=${fromDate}&toDate=${toDate}&schoolCode=${schoolCode}`;
        console.group("--- [fetchFeeData] API Call Start ---");
        console.log("[fetchFeeData] 1. Request URL:", apiUrl);


        try {
            setLoading(true);
            const response = await axios.get(apiUrl);

            const fees = response.data || [];
            setAllFees(fees);
            
            // 🛑 IMPORTANT: Log a sample record for backend data inspection
            if (fees.length > 0) {
                console.log(`[fetchFeeData] 2. ✅ API Response Success: ${fees.length} records fetched.`); 
                console.log("------------------ Sample Fee Record (First Row) ------------------");
                const sample = fees[0];
                console.log(`- StudentName: ${sample.StudentName}`);
                console.log(`- Class_name: ${sample.Class_name}`);
                console.log(`- Total_Expected (Raw): ${sample.Total_Expected}`);
                console.log(`- Total_Paid (Raw): ${sample.Total_Paid}`);
                // 🟢 CHECK THESE DATE FIELDS:
                console.log(`- 'updated_at' Field:`, sample.updated_at); 
                console.log(`- 'created_at' Field:`, sample.created_at); 
                console.log(`- 'payment_date' Field:`, sample.payment_date); 
                console.log(`- ALL KEYS:`, Object.keys(sample));
                console.log("-------------------------------------------------------------------");
            } else {
                 console.log("[fetchFeeData] 2. ✅ API Response Success: 0 records fetched for this period."); 
            }

            // Calculate final card totals (using the 'Total_' fields if available for the summary cards)
            const totalPaid = fees.reduce((a, b) => a + parseCurrency(b.Total_Paid), 0); 
            const totalUnpaid = fees.reduce(
                (a, b) => a + (parseCurrency(b.Total_Expected) - parseCurrency(b.Total_Paid)),
                0
            );
            
            console.log(`[fetchFeeData] 3. API Totals (Cards): Paid=₹${totalPaid.toFixed(2)} | Unpaid=₹${totalUnpaid.toFixed(2)}`);

            setFinalPaid(totalPaid);
            setFinalUnpaid(totalUnpaid);
        } catch (err) {
            console.error("[fetchFeeData] ❌ Error fetching fee data:", err);
        } finally {
            setLoading(false);
            console.groupEnd();
        }
    };


    const [expensesData,setExpensesData]= useState()
    const [userExpensesData,setUserExpensesData]= useState()
    const [originalUserExpensesData, setOriginalUserExpensesData] = useState(null);
    const handleSearch = async () => {
        console.log("🟢 handleSearch called...");

        const schoolCode = localStorage.getItem("schoolCode");
        console.log("📘 Retrieved schoolCode:", schoolCode);

        if (!schoolCode) {
            console.error("❌ School code not found in localStorage.");
            return;
        }

        try {
            console.log("🚀 Fetching both datasets in parallel...");

            const expensesPromise = axios.get(
            `https://cleezoclass.com:4000/totalexpensesData?schoolCode=${schoolCode}`
            );
            const billsPromise = fetch("https://cleezoclass.com:4000/getAllBills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ schoolCode }),
            });

            const [expensesResponse, billsResponse] = await Promise.all([
            expensesPromise,
            billsPromise,
            ]);

            console.log("✅ Both API calls completed successfully.");

            // --- Process regular expenses ---
            const expensesData = expensesResponse.data || [];
            console.log(`📊 Expenses data fetched: ${expensesData.length} records`);

            // --- Process and transform uploaded bills ---
            let uploadedBillsData = [];
            if (billsResponse.ok) {
                const rawBills = await billsResponse.json();
                console.log(`📦 Raw bills fetched: ${rawBills.length} records`);

                uploadedBillsData = rawBills.map((bill, index) => ({
                    id: bill.id || `bill_${index}_${Math.random()}`,
                    expense_date: bill.date,
                    expense_type: bill.bill_type || "Uploaded Bill",
                    description: bill.description || "N/A",
                    payment_mode: "N/A",
                    price: Number(bill.amount) || 0,
                    paid_amount: Number(bill.amount) || 0,
                    balance_amount: 0,
                    imageUrl: bill.imageUrl,
                    isUploadedBill: true,
                }));

                console.log("🧾 Uploaded bills transformed successfully:", uploadedBillsData);
            } else {
                console.error("❌ Failed to fetch uploaded bills. Response status:", billsResponse.status);
            }

            // --- Merge both datasets ---
            const mergedData = [...expensesData, ...uploadedBillsData];
            console.log(`🔄 Merged dataset created with ${mergedData.length} total records.`);

            // --- Sort by date ---
            mergedData.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
            console.log("📅 Merged data sorted by expense_date (newest first).");

            // --- Set to state ---
            setUserExpensesData(mergedData);
            setOriginalUserExpensesData(mergedData);

            console.log("✅ Final merged data set to state successfully.");
        } catch (error) {
            console.error("🔥 Error in handleSearch:", error);
            setUserExpensesData([]);
            setOriginalUserExpensesData([]);
        }
    };

    const [total, setTotal] = useState({
        total_investment: 0,
        total_other: 0,
        total_donation: 0,
        grand_total: 0
    });
    const [isLedgerOpenForExpense, setIsLedgerOpenForExpense] = useState(false);
    const [showStudentFinder, setShowStudentFinder] = useState(false);
    const [income, setIncome] = useState({
        total_investment: 0,
        total_other: 0,
        total_donation: 0,
        grand_total: 0,
        loading: true,
        error: null
    });

    const fetchTotals = async (schoolCode) => {
        if (!schoolCode) {
            console.warn("⚠️ fetchTotals called without a schoolCode. Aborting fetch.");
            return; 
        }

        console.log("🟢 fetchTotals called with schoolCode:", schoolCode);

        setTotals(prev => ({ ...prev, loading: true, error: null }));
        console.log("⏳ Loading set to true...");

        try {
            const response = await fetch(`https://cleezoclass.com:4000/api/totals?schoolCode=${schoolCode}`);
            console.log("🌐 Fetch request completed. Response status:", response.status);

            if (!response.ok) {
                throw new Error(`❌ Failed to fetch totals, status: ${response.status}`);
            }

            const data = await response.json();
            console.log("📦 Data received from API:", data);

            const totalPaid = parseFloat(data.totals.paid) || 0;
            const totalBalance = parseFloat(data.totals.balance) || 0;
            const totalPrice = parseFloat(data.totals.price) || 0;

            console.log("🧮 Parsed totals:", { totalPaid, totalBalance, totalPrice });

            setTotals(prev => ({
                ...prev,
                totalPaid,
                totalBalance,
                totalPrice,
                loading: false,
                error: null
            }));
            console.log("✅ Totals set to state successfully.");

        } catch (err) {
            console.error("🔥 Error in fetchTotals:", err);
            setTotals(prev => ({
            ...prev,
            loading: false,
            error: err.message
            }));
        }
    };


    useEffect(() => {
        console.log("[Effect] Mount: Initial fetchFeeData triggered."); 
        fetchFeeData();
    }, []); 
    
    // Trigger data fetch when fromDate or toDate changes
    useEffect(() => {
        console.log(`[Effect] Date Change: Re-fetching data for ${fromDate} to ${toDate}`); 
        fetchFeeData(); 
    }, [fromDate, toDate]); 
    
    // Apply time filter when allFees changes (which is triggered by data fetch)
    useEffect(() => {
        console.log("[Effect] allFees Change: State updated. Re-applying time filter."); 
        applyTimeFilter();
    }, [allFees]); 
    
    useEffect(() => {
        console.log("🟢 useEffect triggered for fetchTotals======================================");

        const schoolCode = localStorage.getItem("schoolCode");
        console.log("🔍 Raw schoolCode from localStorage=====================================================:", schoolCode);

        if (schoolCode) {
            console.log("✅ Valid schoolCode found, calling fetchTotals...");
            fetchTotals(schoolCode);
        } else {
            console.error("❌ No schoolCode found in localStorage");
        }
    }, []);


    useEffect(() => {
        handleSearch();
    }, []); // runs once when the component mounts

    // Responsive Styles (omitted for brevity, assume unchanged)
    const outerContainer = {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",  // ⬅️ vertically center
        alignItems: "center",      // ⬅️ horizontally center
        gap: isMobile ? "20px" : "50px",
        minHeight: "100vh",
        width: "100%",
        padding: isMobile ? "10px" : "20px",
        boxSizing: "border-box",
        backgroundColor: "#6b7983ff",
    };

    const container = {
        fontFamily: font,
        backgroundColor: "#fff",
        borderRadius: "16px",
        padding: isMobile ? "10px 5px" : "5px",
        boxSizing: "border-box",
        width: "100%",
        minWidth: "300px", 
        transition: "filter 0.5s ease", 
    };

    const header = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: "16px 16px 0 0",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.2)",
        padding: isMobile ? "15px" : "25px",
        marginBottom: isMobile ? "15px" : "25px",
        flexWrap: isMobile ? "wrap" : "nowrap",
        gap: isMobile ? "10px" : "0",
        position: "sticky",
        top: 0,
        zIndex: 1000,
    };


    const logoBox = {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        order: isMobile ? 1 : 0, 
    };
    const logo = {
        width: "40px",
        height: "40px",
        backgroundColor: "#001F3F",
        borderRadius: "8px",
    };
    const logoText = { fontSize: isMobile ? "16px" : "18px", fontWeight: "600" };
    const logoSub = { fontSize: isMobile ? "10px" : "12px", color: "#777" };
    const schoolTitle = {
        fontSize: isMobile ? "16px" : "20px",
        fontWeight: "600",
        color: "#333",
        textAlign: "center",
        flex: isMobile ? "1 1 100%" : 1, 
        order: isMobile ? 3 : 0, 
        marginTop: isMobile ? "10px" : "0",
    };
    const buttonGroup = {
        display: "flex",
        gap: "10px",
        order: isMobile ? 2 : 0, 
    };
    const btn = {
        backgroundColor: "#6b7983ff",
        border: "none",
        borderRadius: "16px",
        padding: isMobile ? "6px 10px" : "8px 16px",
        cursor: "pointer",
        fontSize: isMobile ? "12px" : "14px",
        fontWeight: "500",
        fontFamily: font,
        color: "#fff", 
    };

    const grid = {
        display: "flex",
        flexDirection: isMobile ? "column" : "row", 
        padding: "10px",
        gap: isMobile ? "20px" : "20px",
    };

    const card = {
        backgroundColor: "#fff",
        borderRadius: "16px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        padding: "20px",
        cursor: "pointer",
        height: "320px", 
        display: "flex",
        flexDirection: "column",
        borderLeft:'8px solid #945f4aff',
        justifyContent: "center", 
        borderTop:'1px solid #ccc',
        borderBottom:'1px solid #ccc',
        borderRight:'1px solid #ccc'
    };

    const listItem = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: isMobile ? "10px" : "5px",
        fontSize: isMobile ? "12px" : "14px",
        flexWrap: isMobile ? "wrap" : "nowrap", 
    };

    const circle = (color) => ({
        width: isMobile ? "30px" : "50px",
        height: isMobile ? "30px" : "50px",
        minWidth: isMobile ? "30px" : "50px",
        borderRadius: "50%",
        backgroundColor: color,
        marginRight: "10px",
    });

    const progress = (c1, c2) => ({
        display: "flex",
        width: isMobile ? "60px" : "90px",
        height: "20px",
        borderRadius: "4px",
        overflow: "hidden",
        background: `linear-gradient(to right, ${c1} 60%, ${c2} 40%)`,
        marginLeft: isMobile ? "0" : "auto", 
        marginTop: isMobile ? "10px" : "0", 
    });

    const smallText = { fontSize: isMobile ? "12px" : "10px", color: "#666", textAlign: "left" };
    const itemContent = {
        display: "flex",
        alignItems: "flex-start",
        flexDirection: "column",
        textAlign: "left",
        flex: 1, 
    };
    
    const commerceItems = [
    {
        color: "#9CC3F8",
        title: "Income",
        desc: [
        `Fees Paid Report - ₹${finalPaid.toLocaleString('en-IN')}`, 
        `Fees Unpaid Report - ₹${finalPending.toLocaleString('en-IN')}`,
        `Income Ledger - ₹${(finalPaid + finalPending).toLocaleString('en-IN')}`,
        ],
        link: "/AccountantDashboard/Income", 
        isPopup: true, 
    },
    {
        color: "#CFA7A7",
        title: "Expense",
        desc: [
            `
            Expenses Report - ₹${totals.totalPaid.toLocaleString('en-IN')}`,   
        `Pending Expenses - ₹${totals.totalBalance.toLocaleString('en-IN')}`,
        `Expense Ledger`,
        ],
        link: "/AccountantDashboard/Expense", 
        isPopup: true, 
    },
    
    ];

    const operationsItems = [
        {
        color: "#D4C7B0",
        title: "Academics",
        desc: "Syllabus, performance, Attendance, Behaviour, Certificates",
        link: "/ChiefDashboardWrapper",
        isPopup: true, 
        },
        {
        color: "#868C8F",
        title: "Meetings & Live Chat",
        desc: "Group Chat, Chatting assign, Parents Messaging",
        link: "/EventsMeetingDashboard", 
        isPopup: true, 
        },
        {
        color: "#705B56",
        title: "Time-Table",
        desc: "Generation, Substitutes",
        link: "/TimetableChief",
        isPopup: true,
        },
        {
        color: "#D9EEF8",
        title: "Exam Management",
        desc: "Question Paper, Evaluator, Invigilator",
        link: "/ExammanagementChief", 
        isPopup: true, 
        },
    ];

    const marketingItems = [
        {
        color: "#D4C7B0",
        title: "Marketing Staff",
        desc: "Staff list, Assign Staff, Hours Worked",
        link: "/marketing/academics",
        isPopup: false, 
        },
        {
        color: "#868C8F",
        title: "Total Visits",
        desc: "Locations, Route track, VoiceRecords",
        link: "/marketing/meetings",
        isPopup: false,
        },
        {
        color: "#705B56",
        title: "Lead Conversions",
        desc: "Lead Type, Follow ups, Closings",
        link: "/marketing/timetable",
        isPopup: false,
        },
        {
        color: "#D9EEF8",
        title: "Performance Report",
        desc: "Question Paper, Counsellor Assign, Report",
        link: "/marketing/exam",
        isPopup: false,
        },
    ];

    const hrItems = [
        {
        color: "#D9EEF8",
        title: "Enrolments & Biometrics",
        desc: "Admission process & Students track",
        link: "/Biometric",
        isPopup: true,
        },
        {
        color: "#868C8F",
        title: "Attendance & Payroll",
        desc: "Staff Track, Salary, Payroll",
        link: "/BiometricTeacher",
        isPopup: true,
        },
        {
        color: "#B5ACBC",
        title: "Recruitments & Exits",
        desc: "Joining’s & Exit Formalities",
        link: "/teacher/new-enrollment",
        isPopup: true,
        },
        {
        color: "#A39DBD",
        title: "Events & Meetings",
        desc: "Circulars, Complaints, Approvals",
        link: "/EventAndMeetings",
        isPopup: true,
        },
    ];

    const renderCard = (title, items, homepageRoute, split = false) => {
        if (split) {
        // Marketing Card Logic (Split)
        return (
            <div
            style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row", 
                gap: "10px",
                flex: 1, 
            }}
            >
            {/* Left Side: Existing Items */}
            <div
                style={{
                flex: isMobile ? "1 1 100%" : 1, 
                borderRight: isMobile ? "none" : "2px solid black",
                borderBottom: isMobile ? "2px solid black" : "none", 
                paddingRight: isMobile ? "0" : "10px",
                paddingBottom: isMobile ? "10px" : "0",
                }}
            >
                {items.map((i) => (
                <div key={i.title} style={listItem}>
                    <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        flex: 1, 
                    }}
                    >
                    <div style={circle(i.color)}></div>
    <div 
    className="title-hover" style={itemContent}>                    <div
                        style={{ fontWeight: "400", cursor: "pointer" }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCardItemClick(i.link);
                        }}
                        >
                        {i.title}
                        </div>
                        <div style={smallText}>
                        {Array.isArray(i.desc) ? (
                            i.desc.map((d, idx) => <div key={idx}>{d}</div>)
                        ) : (
                            i.desc
                        )}
                        </div>
                    </div>
                    </div>
                </div>
                ))}
            </div>
            {/* Right Side: Tool Statistics */}
            <div
            style={{
                flex: isMobile ? "1 1 100%" : 1,
                paddingLeft: isMobile ? "0" : "10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center", 
                justifyContent: "center", 
                textAlign: "center",
                width: "100%",
            }}
            >
            {/* Top Section (Button, Arrow, Text) */}
            <div
                style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center", 
                marginBottom: "20px",
                gap: "10px",
                flexWrap: isMobile ? "wrap" : "nowrap",
                width: "100%",
                }}
            >
                <button
                style={{
                    backgroundColor: "#72a5fdff",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: isMobile ? "12px" : "14px",
                    flexShrink: 0,
                }}
                >
                Admission Tool
                </button>

                <svg
                width={isMobile ? "20" : "40"}
                height="20"
                viewBox="0 0 40 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                    flexShrink: 0,
                    transform: isMobile ? "rotate(90deg)" : "none",
                }}
                >
                <line x1="10" y1="10" x2="40" y2="10" stroke="#007BFF" strokeWidth="2" />
                <polygon points="10,5 0,10 10,15" fill="#007BFF" />
                </svg>

                <div
                style={{
                    fontSize: "12px",
                    color: "#666",
                    border: "2px solid #007BFF",
                    padding: "8px 12px",
                    borderRadius: "16px",
                    backgroundColor: "#fff",
                    maxWidth: isMobile ? "100%" : "180px",
                    lineHeight: "1.4",
                    flexGrow: 1,
                }}
                >
                Hit the button to start the Automated Admission tool
                </div>
            </div>

            {/* Middle Section (Icon, Title, Dropdown) */}
            <div
                style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center", 
                gap: "10px",
                marginBottom: "20px",
                flexWrap: "wrap",
                width: "100%",
                }}
            >
                <div
                style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    backgroundColor: "#868C8F",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: "16px",
                }}
                ></div>

                <div style={{ fontSize: "12px"}}>
                Tool Statistics
                </div>

                <select
                style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    width: isMobile ? "100%" : "auto",
                }}
                >
                <option>Last Week</option>
                <option>This Week</option>
                <option>This Month</option>
                </select>
            </div>

            {/* Statistics Section */}
            <div
                style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center", 
                justifyContent: "center", 
                gap: "6px",
                fontSize: "8px",
                width: "100%",
                }}
            >
                {["Target Audience", "Exposed Audience", "Applied Impressions", "No. of Impressions"].map(
                (stat, index) => (
                    <div
                    key={stat}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: isMobile ? "90%" : "60%",
                        padding: "6px 0",
                    }}
                    >
                    <span>{stat}</span>
                    <span>
                        :{" "}
                        {index % 2 === 0
                        ? "20,000"
                        : index === 1
                        ? "8,000"
                        : index === 2
                        ? "32,000"
                        : "8"}
                        <span
                        style={{
                            color: index % 2 === 0 ? "green" : "red",
                            marginLeft: "5px",
                        }}
                        >
                        {index % 2 === 0 ? "↑" : "↓"}
                        </span>
                    </span>
                    </div>
                )
                )}
            </div>
            </div>
            </div>
        );
        } else {
        // Standard Card (Used for Operations)
        return (
        <div className="container-hover" style={card} onClick={() => homepageRoute && navigate(homepageRoute)}>
            {items.map((i) => (
                <div key={i.title} style={listItem}>
                <div
                    style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    flex: 1,
                    }}
                >
                    <div style={circle(i.color)}></div>
    <div 
    className="title-hover" style={itemContent}>
                    <div
                        style={{ fontWeight: "500", cursor: "pointer" }}
                        onClick={(e) => {
                        e.stopPropagation();
                        handleCardItemClick(i.link);
                        }}
                    >
                        {i.title}
                    </div>
                    <div style={smallText}>
                        {Array.isArray(i.desc) ? (
                        i.desc.map((d, idx) => <div key={idx}>{d}</div>)
                        ) : (
                        i.desc
                        )}
                    </div>
                    </div>
                </div>
                </div>
            ))}
            </div>
        );
        }
    };

    const renderHRCard = (title, items) => {
        return (
        <div className="container-hover" style={{ ...card, cursor: "pointer" }}>
            {items.map((i) => (
            <div key={i.title} style={listItem}>
                <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    flex: 1,
                }}
                >
                <div style={circle(i.color)}></div>

    <div 
    className="title-hover" style={itemContent}>              <div
                    style={{ fontWeight: "500", cursor: "pointer" }}
                    onClick={(e) => {
                    e.stopPropagation();
                    handleCardItemClick(i.link); 
                    }}
                >
                    {i.title}
                </div>

                <div style={smallText}>
                    {Array.isArray(i.desc)
                    ? i.desc.map((d, idx) => <div key={idx}>{d}</div>)
                    : i.desc}
                </div>
                </div>
            </div>

            </div>
            ))}
        </div>
        );
    };

    const handleLogout = () => {
        // Add any logout logic like clearing tokens etc.
        navigate("/");   // Navigate to home page
    };

    const [showPending, setShowPending] = useState(false);
    const [pendingChats, setPendingChats] = useState([]);
    const [approvedChats, setApprovedChats] = useState([]);

    const fetchPending = () => {
        console.log("📡 Fetching pending approval requests...");
        axios
        .get("http://localhost:5000/api/pending")
        .then((res) => {
            console.log("✅ Pending response data:", res.data);
            if (Array.isArray(res.data)) {
            setPendingChats(res.data);
            } else {
            console.warn("⚠️ Unexpected data format:", res.data);
            setPendingChats([]);
            }
        })
        .catch((err) => console.error("❌ Error fetching pending:", err));
    };

    const handleApprove = (id) => {
        console.log("🟢 Approving chat ID:", id);
        axios
        .post("http://localhost:5000/api/approve", { id })
        .then(() => {
            alert(`Chat ID ${id} approved`);
            console.log("✅ Approval successful for ID:", id);
            setPendingChats((prev) => prev.filter((chat) => chat.id !== id));
        })
        .catch((err) => console.error("❌ Error approving chat:", err));
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
        if (!e.target.closest(".bell-container")) setShowPending(false);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    useEffect(() => {
        fetchPending();
    }, []);

    // Effect to handle window resize for responsiveness
    useEffect(() => {
        const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);


    return (
        <div style={outerContainer}>
            <div 
                className={popupComponent ? "blur-background-active" : ""} 
                style={container}
            >
                {/* Header */}
                <div style={header}>
                    <div style={logoBox}>
                        <div style={logo}></div>
                        <div>
                            <div style={logoText}>Tanz AI</div>
                            <div style={logoSub}>For Schools</div>
                        </div>
                    </div>
                    <div style={schoolTitle}>ABC School, Miyapur, Hyderabad</div>
                    <div style={buttonGroup}>
                        <button style={btn}>Switch Branch ▾</button>
                        <button style={btn} onClick={handleLogout}>
                            Logout
                        </button>            
                    </div>
                </div>

                {/* Welcome Section */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: isMobile ? "14px" : "16px",
                        fontWeight: "600",
                        marginBottom: "5px",
                        padding: isMobile ? "0 5px" : "0",
                    }}
                >
                    <div>
                        {name ? `Welcome ${name}..!` : "Welcome Chief Department..!"}
                    </div>

                    <div style={buttonGroup}>
                        {/* 🔔 Bell Icon */}
                        <div
                            className="bell-container"
                            style={{ position: "relative", cursor: "pointer" }}
                            onClick={() => {
                                setShowPending((prev) => !prev);
                                if (!showPending) fetchPending();
                            }}
                        >
                            <FontAwesomeIcon icon={faBell} style={{ fontSize: "24px", color: "#555" }} />
                            {pendingChats.length > 0 && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: "-4px",
                                        right: "-4px",
                                        width: "10px",
                                        height: "10px",
                                        backgroundColor: "red",
                                        borderRadius: "50%",
                                        border: "1px solid white",
                                    }}
                                ></span>
                            )}

                            {/* Pending Requests Popup */}
                            {showPending && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "35px",
                                        right: "0",
                                        backgroundColor: "#fff",
                                        border: "1px solid #ddd",
                                        borderRadius: "10px",
                                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                                        width: "320px",
                                        maxHeight: "300px",
                                        overflowY: "auto",
                                        zIndex: 1000,
                                        padding: "10px",
                                    }}
                                >
                                    <h4 style={{ textAlign: "center", marginBottom: "10px" }}>
                                        Pending Approval Requests
                                    </h4>
                                    {console.log("🧾 Rendering pendingChats:", pendingChats)}
                                    {pendingChats.length === 0 ? (
                                        <p style={{ textAlign: "center", color: "#666" }}>
                                            No pending requests
                                        </p>
                                    ) : (
                                        pendingChats.map((chat) => (
                                            <div
                                                key={chat.id}
                                                style={{
                                                    borderBottom: "1px solid #eee",
                                                    padding: "10px 0",
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <div>
                                                    <strong>{chat.party1_name}</strong> →{" "}
                                                    {chat.party2_student || "Group"}
                                                    <div style={{ fontSize: "12px", color: "#777" }}>
                                                        {new Date(chat.date).toLocaleDateString()} | {chat.time}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleApprove(chat.id)}
                                                    style={{
                                                        padding: "6px 10px",
                                                        backgroundColor: "#5a7488",
                                                        color: "#fff",
                                                        border: "none",
                                                        borderRadius: "5px",
                                                        cursor: "pointer",
                                                        fontSize: "12px",
                                                    }}
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>


                {/* Commerce and Operations Grid */}
                <div style={grid}>
                   <div style={{ flex: isMobile ? "1 1 100%" : 6 }}>
  <div className="title-heading">Commerce</div>

  <div
    className="container-hover"
    style={{ ...card, borderLeft: "8px solid rgba(158, 165, 172, 1)" }}
  >
    {/* ⭐ TOP — FROM / TO DATE FILTER */}
    <div
      style={{
        fontSize: "14px",
        marginBottom: "10px",
        textAlign: "left",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
      }}
    >
      {/* LEFT SIDE TITLE */}
      <span style={{ flex: 1 }}>
        Total Term Fees: {fromDate} to {toDate}
      </span>

      {/* RIGHT SIDE DATE INPUTS */}
     {/* ⭐ TOP — FROM / TO DATE FILTER (ONE BELOW THE OTHER) */}
<div
  style={{
    fontSize: "10px",
    marginBottom: "10px",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",  // <<< ONE BY ONE
    gap: "10px",
  }}
>
  {/* TITLE */}
  <span style={{ fontWeight: "500" }}>
    Total Term Fees: {fromDate} to {toDate}
  </span>

  {/* FROM DATE */}
  <div style={{ display: "flex", alignItems: "center", gap: "10px",    marginLeft: "45px",   // ⭐ MOVE RIGHT
}}>
    <label>From:</label>
    <input
      type="date"
      value={fromDate}
      onChange={(e) => setFromDate(e.target.value)}
      className="btn-dropdown-FeesManagement"
    />
  </div>

  {/* TO DATE */}
  <div style={{ display: "flex", alignItems: "center", gap: "28px",    marginLeft: "40px",   // ⭐ MOVE RIGHT
 }}>
    <label>To:</label>
    <input
      type="date"
      value={toDate}
      onChange={(e) => setToDate(e.target.value)}
      className="btn-dropdown-FeesManagement"
    />
  </div>
</div>

    </div>

    {/* ⭐ MIDDLE — CHART + COMMERCE ITEMS */}
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        flex: 1,
        gap: "20px",
        marginTop: "10px",
      }}
    >
      {/* LEFT — LINE CHART */}
      <div
        style={{
          flex: isMobile ? "1 1 100%" : 7,
          height: isMobile ? "200px" : "250px",
        }}
      >
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={chartData}>
            <XAxis dataKey="label" fontSize={isMobile ? 10 : 12} />
            <YAxis fontSize={isMobile ? 10 : 12} />
            <Tooltip />

            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{
                width: "100%",
                fontSize: isMobile ? 10 : 12,
              }}
            />

            <Line
              type="monotone"
              dataKey="Paid"
              stroke="#6CA6FF"
              strokeWidth={3}
            />
            <Line
              type="monotone"
              dataKey="Pending"
              stroke="#9C6262"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* TOTALS BELOW CHART */}
        <div style={{ width: "100%", textAlign: "center", marginTop: "0px" }}>
          <span style={{ color: "#333", marginRight: "20px" }}>
            ₹{finalPaid.toLocaleString("en-IN")}
          </span>
          <span style={{ color: "#333" }}>
            ₹{finalPending.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* RIGHT — COMMERCE ITEMS LIST */}
      <div
        style={{
          flex: isMobile ? "1 1 100%" : 3,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginTop: isMobile ? "20px" : "0",
        }}
      >
        {commerceItems.map((i) => (
          <div
            key={i.title}
            style={{ ...listItem, fontSize: isMobile ? "10px" : "12px" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={circle(i.color)}></div>

              <div className="title-hover" style={itemContent}>
                {/* TITLE CLICK */}
                <div
                  style={{ fontWeight: "500", cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardItemClick(i.link);
                  }}
                >
                  {i.title}
                </div>

                {/* DESCRIPTION */}
                <div
                  style={{
                    ...smallText,
                    fontSize: isMobile ? "8px" : "8px",
                    fontWeight: "bold",
                    whiteSpace: "nowrap",
                  }}
                >
                  {i.desc.map((d, idx) => (
                    <div key={idx} style={{ whiteSpace: "nowrap" }}>
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>

                    <div style={{ flex: isMobile ? "1 1 100%" : 4 }}>
                        <div className="title-heading">Operations</div>
                        <div> 
                            {/* Operations card will now handle its own item clicks */}
                            {renderCard("Operations", operationsItems)}
                        </div>

                    </div>
                </div>
                {/* Marketing and HR Grid */}
                <div style={grid}>
                    <div style={{ flex: isMobile ? "1 1 100%" : 6 }}>
                        <div className="title-heading">Front Desk</div>
                        <div className="container-hover" style={{ ...card, borderLeft: "8px solid #738368ff" }}>
                            {renderCard("Marketing", marketingItems, "/marketing", true)}
                        </div>
                    </div>
                    <div style={{ flex: isMobile ? "1 1 100%" : 4 }}>
                        <div className="title-heading">HR</div>
                        <div>
                            {renderHRCard("HR", hrItems, "/RecruitmentDashboard")}
                        </div>
                    </div>
                </div>
            </div>

            {/* The Popup Modal (outside the blurred content) */}
            {popupComponent && (
                <div
                    onClick={() => setPopupComponent(null)}   // <-- Close when clicking outside

                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        background: "rgba(0,0,0,0.4)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-start", 
                        paddingTop: "20px",       
                        paddingLeft: "40px",      
                        boxSizing: "border-box",
                        zIndex: 2000,
                    }}
                >
                    <div
                        ref={popupContentRef}
                              onClick={(e) => e.stopPropagation()}    // <-- Prevent closing when clicking inside

                        style={{
                            background: "#fff",
                            maxWidth: "1000px",
                            borderRadius: "12px",
                            padding: "20px",
                            boxShadow: "0px 4px 20px rgba(0,0,0,0.3)",
                            transformOrigin: "top left",

                            transform:
                                window.innerWidth <= 1280
                                    ? "scale(0.75)"
                                    : window.innerWidth <= 1366
                                        ? "scale(0.85)"
                                        : "scale(1)",

                            width:
                                window.innerWidth <= 1280
                                    ? "133.3%"
                                    : window.innerWidth <= 1366
                                        ? "117.6%"
                                        : "100%",

                            position: "relative",
                        }}
                    >
                        {/* CLOSE BUTTON */}
                        <button
                            style={{
                                position: "absolute",
                                top: "15px",
                                right: "15px",
                                background: "red",
                                color: "#fff",
                                padding: "6px 14px",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                            }}
                            onClick={() => setPopupComponent(null)}
                        >
                            Close
                        </button>

                        <div style={{ marginTop: "40px" }}>{popupComponent}</div>
                    </div>
                </div>

            )}

        </div>
    );
};

export default Dashboard;