import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "bootstrap/dist/css/bootstrap.min.css";

const AttendanceForms = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const viewMode =
    new URLSearchParams(location.search).get("view") || "both";

  const [dynamicLogoSrc, setDynamicLogoSrc] = useState("");
  const [dynamicSchoolCode, setDynamicSchoolCode] = useState("");

  const [alertTime, setAlertTime] = useState("");
  const [loginTime, setLoginTime] = useState("");
  const [logoutTime, setLogoutTime] = useState("");

  const [message, setMessage] = useState("");
  const [message1, setMessage1] = useState("");

  const dashboardRef = useRef(null);

  // ✅ Fetch Logo
  useEffect(() => {
    const fetchSchoolLogo = async () => {
      const code = localStorage.getItem("schoolCode");
      if (!code) return;

      setDynamicSchoolCode(code);

      try {
        const res = await axios.post(
          "https://cleezoclass.com:4000/api/schoollogodynamic",
          { secretecode: code }
        );

        if (res.data.logoPath) {
          setDynamicLogoSrc(res.data.logoPath);
        }
      } catch (err) {
        console.error("Logo fetch error:", err);
      }
    };

    fetchSchoolLogo();
  }, []);

  // ✅ Submit Alert Time
  const handleSubmit = async (e) => {
    e.preventDefault();
    const schoolCode = localStorage.getItem("schoolCode");

    if (!schoolCode) {
      setMessage("❌ School code missing");
      return;
    }

    try {
      const res = await axios.post(
        "https://cleezoclass.com:4000/api/attendance/set-alert-time",
        { alertTime, schoolCode }
      );

      setMessage(res.data.message);
      setAlertTime("");
    } catch {
      setMessage("❌ Error occurred");
    }
  };

  // ✅ Submit Login/Logout Time
  const handleSubmit1 = async (e) => {
    e.preventDefault();
    const schoolCode = localStorage.getItem("schoolCode");

    if (!schoolCode) {
      setMessage1("❌ School code missing");
      return;
    }

    try {
      const res = await axios.post(
        "https://cleezoclass.com:4000/attendance/set-login-logout-time",
        { loginTime, logoutTime, schoolCode }
      );

      setMessage1(res.data.message);
      setLoginTime("");
      setLogoutTime("");
    } catch {
      setMessage1("❌ Error occurred");
    }
  };

  // ✅ Download PDF
  const handleDownload = async () => {
    const input = dashboardRef.current;
    if (!input) return;

    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF();
    pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
    pdf.save("attendance.pdf");
  };

  return (
    <>
      {/* HEADER */}
      <header
        style={{
          background: "#fff",
          height: "90px",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        }}
      >
        <img
          src={dynamicLogoSrc || "/default-logo.png"}
          alt="logo"
          style={{ height: "60px" }}
        />

        <h3 style={{ margin: "0 auto" }}>
          {dynamicSchoolCode.replace(/_/g, " ")} SCHOOL
        </h3>
      </header>

      {/* MAIN */}
      <div
        ref={dashboardRef}
        className="container mt-4 d-flex flex-column flex-lg-row gap-4 justify-content-center"
      >
        {/* ALERT TIME */}
        {viewMode !== "teacher" && (
          <div className="card p-4 shadow" style={{ maxWidth: "450px" }}>
            <h5 className="text-center mb-3">
              Set Attendance Notification Time
            </h5>

            <form onSubmit={handleSubmit}>
              <input
                type="time"
                value={alertTime}
                onChange={(e) => setAlertTime(e.target.value)}
                className="form-control mb-3"
                required
              />

              <button className="btn btn-primary w-100">Submit</button>
            </form>

            {message && (
              <p
                className={`mt-2 ${
                  message.includes("success") ? "text-success" : "text-danger"
                }`}
              >
                {message}
              </p>
            )}
          </div>
        )}

        {/* LOGIN / LOGOUT */}
        {viewMode !== "student" && (
          <div className="card p-4 shadow" style={{ maxWidth: "450px" }}>
            <h5 className="text-center mb-3">
              Set Login / Logout Time
            </h5>

            <form onSubmit={handleSubmit1}>
              <input
                type="time"
                value={loginTime}
                onChange={(e) => setLoginTime(e.target.value)}
                className="form-control mb-2"
                required
              />

              <input
                type="time"
                value={logoutTime}
                onChange={(e) => setLogoutTime(e.target.value)}
                className="form-control mb-3"
                required
              />

              <button className="btn btn-primary w-100">Submit</button>
            </form>

            {message1 && (
              <p
                className={`mt-2 ${
                  message1.includes("success")
                    ? "text-success"
                    : "text-danger"
                }`}
              >
                {message1}
              </p>
            )}
          </div>
        )}
      </div>

      {/* DOWNLOAD BUTTON */}
      <div className="text-center mt-4">
        <button onClick={handleDownload} className="btn btn-success">
          Download PDF
        </button>
      </div>
    </>
  );
};

export default AttendanceForms;