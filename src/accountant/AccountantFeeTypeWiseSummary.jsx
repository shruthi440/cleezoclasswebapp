import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./AccountantDashboardnew.css";
import "./AccountantReportsPageNew.css";
import DashboardLayout from "../components/DashboardLayout.jsx";
import EditableProfileMenu from "../shared/EditableProfileMenu.jsx";
import { resolveInstituteDisplayName } from "../shared/instituteNameUtils";

import collectFeeIcon from "../assets/collect.png";
import addFeeIcon from "../assets/Navbar-AddFee.png";
import expenseIcon from "../assets/Navbar-Expenses.png";
import reportIcon from "../assets/Reports.png";
import dashboardIcon from "../assets/Dashboard.png";
import addStudentIcon from "../assets/Enrollment.png";
import feeTypeIcon from "../assets/Fee Type.png";
import logoab from "../assets/logoab.png";

const AccountantFeeTypeWiseSummary = () => {
  const navigate = useNavigate();
  const [instituteName, setInstituteName] = useState("Institute");
  const [instituteLogo, setInstituteLogo] = useState("/default-logo.png");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [classRows, setClassRows] = useState([]);
  const [individualRows, setIndividualRows] = useState([]);

  useEffect(() => {
    const schoolCode = String(localStorage.getItem("schoolCode") || "").trim();
    if (!schoolCode) return;

    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${encodeURIComponent(schoolCode)}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        const resolvedInstituteName = resolveInstituteDisplayName({
          apiInstituteName: data?.institute_name || data?.instituteName || data?.schoolName || data?.name,
          storedSchoolName: localStorage.getItem("schoolName"),
          storedInstituteName: localStorage.getItem("instituteName"),
          schoolCode,
          fallback: "Institute",
        });
        setInstituteLogo(data.logo || "/default-logo.png");
        setInstituteName(resolvedInstituteName);
        localStorage.setItem("schoolName", resolvedInstituteName);
        localStorage.setItem("instituteName", resolvedInstituteName);
      })
      .catch(() => {
        const fallbackInstituteName = resolveInstituteDisplayName({
          storedSchoolName: localStorage.getItem("schoolName"),
          storedInstituteName: localStorage.getItem("instituteName"),
          schoolCode,
          fallback: "Institute",
        });
        setInstituteLogo("/default-logo.png");
        setInstituteName(fallbackInstituteName);
      });
  }, []);

  const loadFeeTypeSummary = async () => {
    const schoolCode = String(localStorage.getItem("schoolCode") || "").trim();
    if (!schoolCode) return;

    try {
      setLoading(true);
      setError("");
      const { data } = await axios.get("https://cleezoclass.com:4000/api/fee-type-class-wise-summary", {
        params: { schoolCode },
      });
      const nextClassRows = Array.isArray(data?.classWise)
        ? data.classWise
        : Array.isArray(data?.data)
          ? data.data.filter((row) => String(row?.scope || "").trim() !== "Individual")
          : [];
      const nextIndividualRows = Array.isArray(data?.individualWise)
        ? data.individualWise
        : Array.isArray(data?.data)
          ? data.data.filter((row) => String(row?.scope || "").trim() === "Individual")
          : [];

      setClassRows(nextClassRows);
      setIndividualRows(nextIndividualRows);
    } catch (err) {
      setClassRows([]);
      setIndividualRows([]);
      setError(err?.response?.data?.message || "Failed to load fee type summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeeTypeSummary();
  }, []);

  const sidebarItems = [
    { key: "home", label: "Dashboard", icon: dashboardIcon, iconAlt: "Dashboard", onClick: () => navigate("/AccountantDashboard") },
    { key: "collect-fee", label: "Fees", icon: collectFeeIcon, onClick: () => navigate("/AccountantFees") },
    { key: "add-fee", label: "Add Fees", icon: addFeeIcon },
    { key: "add-student", label: "Add Student", icon: addStudentIcon },
    { key: "add-expense", label: "Expense", icon: expenseIcon, onClick: () => navigate("/AccountantExpenses") },
    { key: "report", label: "Reports", icon: reportIcon, onClick: () => navigate("/AccountantReportsPage") },
  ];

  const topbarTabs = [
    { key: "dashboard", label: "Dashboard", className: "accountant-topbar-tab-button", onClick: () => navigate("/AccountantDashboard") },
    { key: "fees", label: "Fees", className: "accountant-topbar-tab-button", onClick: () => navigate("/AccountantFees") },
    { key: "expense", label: "Expense", className: "accountant-topbar-tab-button", onClick: () => navigate("/AccountantExpenses") },
    { key: "reports", label: "Reports", className: "accountant-topbar-tab-button", onClick: () => navigate("/AccountantReportsPage") },
    { key: "fee-type", label: "Fee Type Summary", className: "accountant-topbar-tab-button", active: true },
  ];

  const topbarRight = (
    <>
      <button type="button" className="accountant-branch-btn" onClick={loadFeeTypeSummary}>
        <span>{loading ? "Refreshing..." : "Refresh"}</span>
      </button>
      <EditableProfileMenu />
    </>
  );

  const currency = (value) =>
    Number(value || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });

  const classSummaryTotals = classRows.reduce(
    (acc, row) => {
      acc.amount += Number(row?.amountPerStudent || 0);
      acc.totalAmount += Number(row?.totalAmount || 0);
      acc.paid += Number(row?.paid || row?.totalPaid || 0);
      acc.count += Number(row?.count || row?.studentCount || 0);
      return acc;
    },
    { amount: 0, totalAmount: 0, paid: 0, count: 0 }
  );

  const individualSummaryTotals = individualRows.reduce(
    (acc, row) => {
      acc.amount += Number(row?.amountPerStudent || 0);
      acc.totalAmount += Number(row?.totalAmount || 0);
      acc.paid += Number(row?.paid || row?.totalPaid || 0);
      acc.count += Number(row?.count || row?.studentCount || 0);
      return acc;
    },
    { amount: 0, totalAmount: 0, paid: 0, count: 0 }
  );

  const classWiseRows = useMemo(
    () =>
      classRows.flatMap((row) =>
        Array.isArray(row?.classWise)
          ? row.classWise.map((classRow, index) => ({
              id: `${row.feeType || "fee"}-${classRow.className || "class"}-${classRow.section || "section"}-${index}`,
              feeType: row.feeType || "-",
              className: classRow.className || "-",
              section: classRow.section || "-",
              amountPerStudent: Number(classRow.amountPerStudent || 0),
              studentCount: Number(classRow.studentCount || 0),
              totalAmount: Number(classRow.totalAmount || 0),
              paid: Number(classRow.paid || 0),
            }))
          : []
      ),
    [classRows]
  );

  const individualWiseRows = useMemo(
    () =>
      individualRows.flatMap((row) =>
        Array.isArray(row?.studentWise)
          ? row.studentWise.map((studentRow, index) => ({
              id: `${row.feeType || "fee"}-${studentRow.studentName || "student"}-${index}`,
              feeType: row.feeType || "-",
              studentName: studentRow.studentName || "-",
              className: studentRow.className || "-",
              section: studentRow.section || "-",
              amountPerStudent: Number(studentRow.amountPerStudent || 0),
              totalAmount: Number(studentRow.totalAmount || 0),
              paid: Number(studentRow.paid || 0),
            }))
          : []
      ),
    [individualRows]
  );

  return (
    <DashboardLayout
      pageClassName="frontdesk-dashboard-page accountant-dashboard-page accountant-dashboard-home-page dashboard-home-page"
      sidebarItems={sidebarItems}
      topbarTabs={topbarTabs}
      logoSrc={instituteLogo}
      logoAlt={instituteName || "Institute"}
      instituteName={instituteName}
      topbarRight={topbarRight}
      footerLogoSrc={logoab}
      footerLogoAlt="Cleezo Class"
    >
      <div
        className="accountant-grid accountant-reports-grid accountant-reports-page-content"
        style={{
          width: "100%",
          minHeight: "calc(100vh - 170px)",
          padding: "24px 18px 28px",
          boxSizing: "border-box",
        }}
      >
        <div
          className="accountant-reports-card accountant-card"
          style={{
            padding: "24px",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            background: "#fff",
            borderRadius: "18px",
            boxShadow: "0 18px 40px rgba(26, 34, 62, 0.08)",
            overflow: "hidden",
          }}
        >
          <div
            className="accountant-card-header"
            style={{
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <div
              className="accountant-report-shortcut-icon"
              style={{
                width: 56,
                height: 56,
                marginBottom: 0,
                flex: "0 0 auto",
              }}
            >
              <img src={feeTypeIcon} alt="Fee Type Summary" />
            </div>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: "24px", lineHeight: 1.2 }}>Fee Type Summary</h2>
              <p style={{ margin: "8px 0 0", opacity: 0.75, fontSize: "14px" }}>
                Per fee type amount, paid amount, and student count.
              </p>
            </div>
          </div>

          {error ? (
            <div
              style={{
                color: "#b42318",
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: "12px",
                background: "#fff4f4",
                border: "1px solid #ffd2d2",
              }}
            >
              {error}
            </div>
          ) : null}

          <div
            className="accountant-outgoing-students-summary"
            style={{
              marginBottom: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "12px",
            }}
          >
            <div className="accountant-outgoing-students-pill">
              <span>Class Fee Types</span>
              <strong>{classRows.length}</strong>
            </div>
            <div className="accountant-outgoing-students-pill">
              <span>Individual Fee Types</span>
              <strong>{individualRows.length}</strong>
            </div>
            <div className="accountant-outgoing-students-pill">
              <span>Total Amount</span>
              <strong>{currency(classSummaryTotals.totalAmount + individualSummaryTotals.totalAmount)}</strong>
            </div>
            <div className="accountant-outgoing-students-pill">
              <span>Total Paid</span>
              <strong>{currency(classSummaryTotals.paid + individualSummaryTotals.paid)}</strong>
            </div>
            <div className="accountant-outgoing-students-pill">
              <span>Total Students</span>
              <strong>{classSummaryTotals.count + individualSummaryTotals.count}</strong>
            </div>
          </div>

          {classWiseRows.length > 0 && (
            <>
              <div className="accountant-card-header" style={{ margin: "8px 0 14px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px" }}>Class Wise Fee Summary</h3>
                  <p style={{ margin: "6px 0 0", opacity: 0.75, fontSize: "14px" }}>
                    Class and section based fees.
                  </p>
                </div>
              </div>

              <div
                className="accountant-outgoing-students-table-wrap"
                style={{
                  width: "100%",
                  overflowX: "auto",
                  borderRadius: "14px",
                  border: "1px solid #ebe7e2",
                  background: "#fff",
                }}
              >
                <table
                  className="accountant-outgoing-students-table"
                  style={{
                    width: "100%",
                    minWidth: "980px",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "14px 16px", whiteSpace: "nowrap" }}>Fee Type</th>
                      <th style={{ textAlign: "left", padding: "14px 16px", whiteSpace: "nowrap" }}>Class</th>
                      <th style={{ textAlign: "left", padding: "14px 16px", whiteSpace: "nowrap" }}>Section</th>
                      <th style={{ textAlign: "right", padding: "14px 16px", whiteSpace: "nowrap" }}>Amount / Student</th>
                      <th style={{ textAlign: "right", padding: "14px 16px", whiteSpace: "nowrap" }}>Student Count</th>
                      <th style={{ textAlign: "right", padding: "14px 16px", whiteSpace: "nowrap" }}>Total Amount</th>
                      <th style={{ textAlign: "right", padding: "14px 16px", whiteSpace: "nowrap" }}>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "18px 16px" }}>
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      classWiseRows.map((row) => (
                        <tr key={row.id} style={{ borderTop: "1px solid #f0ece7" }}>
                          <td style={{ padding: "14px 16px", fontWeight: 600 }}>{row.feeType}</td>
                          <td style={{ padding: "14px 16px" }}>{row.className}</td>
                          <td style={{ padding: "14px 16px" }}>{row.section}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {currency(row.amountPerStudent || 0)}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>{row.studentCount}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {currency(row.totalAmount || 0)}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {currency(row.paid || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {individualWiseRows.length > 0 && (
            <>
              <div className="accountant-card-header" style={{ margin: "24px 0 14px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px" }}>Individual Fee Summary</h3>
                  <p style={{ margin: "6px 0 0", opacity: 0.75, fontSize: "14px" }}>
                    Student based fees without class and section grouping.
                  </p>
                </div>
              </div>

              <div
                className="accountant-outgoing-students-table-wrap"
                style={{
                  width: "100%",
                  overflowX: "auto",
                  borderRadius: "14px",
                  border: "1px solid #ebe7e2",
                  background: "#fff",
                }}
              >
                <table
                  className="accountant-outgoing-students-table"
                  style={{
                    width: "100%",
                    minWidth: "760px",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "14px 16px", whiteSpace: "nowrap" }}>Fee Type</th>
                      <th style={{ textAlign: "left", padding: "14px 16px", whiteSpace: "nowrap" }}>Student</th>
                      <th style={{ textAlign: "right", padding: "14px 16px", whiteSpace: "nowrap" }}>Amount</th>
                      <th style={{ textAlign: "right", padding: "14px 16px", whiteSpace: "nowrap" }}>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "18px 16px" }}>
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      individualWiseRows.map((row) => (
                        <tr key={row.id} style={{ borderTop: "1px solid #f0ece7" }}>
                          <td style={{ padding: "14px 16px", fontWeight: 600 }}>{row.feeType}</td>
                          <td style={{ padding: "14px 16px" }}>{row.studentName}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {currency(row.amountPerStudent || 0)}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {currency(row.paid || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!loading && classWiseRows.length === 0 && individualWiseRows.length === 0 ? (
            <div
              style={{
                marginTop: "20px",
                padding: "18px 16px",
                borderRadius: "14px",
                border: "1px solid #ebe7e2",
                background: "#faf7f4",
                color: "#6b5f55",
              }}
            >
              No fee type summary found.
            </div>
          ) : null}

        </div>
      </div>
    </DashboardLayout>
  );
};

export default AccountantFeeTypeWiseSummary;
