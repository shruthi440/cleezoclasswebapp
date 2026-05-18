import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import "./dashboardGlobal.css";



const joinClasses = (...classes) => classes.filter(Boolean).join(" ");

const renderAction = (item, className, children) => {
  if (item.to) {
    return (
      <Link key={item.key || item.label} to={item.to} onClick={item.onClick} className={className}>
        {children}
      </Link>
    );
  }

  if (item.onClick) {
    return (
      <button key={item.key || item.label} type="button" onClick={item.onClick} className={className}>
        {children}
      </button>
    );
  }

  return (
    <div key={item.key || item.label} className={className}>
      {children}
    </div>
  );
};

const DashboardLayout = ({
    

  pageClassName = "",
  sidebarItems = [],
  topbarTabs = [],
  logoSrc,
  logoAlt = "Logo",
  instituteName = "",
  topbarRight = null,
lockViewport = false,

  footerLogoSrc,
  footerLogoAlt = "Brand",
  footerText = "Powered By:",
  children,
}) => {
  useEffect(() => {
    const lockClass = "accountant-dashboard-scroll-lock";
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const app = document.querySelector(".App");

    if (lockViewport) {
      html.classList.add(lockClass);
      body.classList.add(lockClass);
      root?.classList.add(lockClass);
      app?.classList.add(lockClass);
    } else {
      html.classList.remove(lockClass);
      body.classList.remove(lockClass);
      root?.classList.remove(lockClass);
      app?.classList.remove(lockClass);
    }

    return () => {
      html.classList.remove(lockClass);
      body.classList.remove(lockClass);
      root?.classList.remove(lockClass);
      app?.classList.remove(lockClass);
    };
  }, [lockViewport]);

  return (
    <div
      className={joinClasses("dashboard-page", pageClassName)}

    >
      <div className="dashboard-shell accountant-dashboard-shell">
        <aside className="dashboard-sidebar accountant-sidebar-strip">
          {sidebarItems.map((item) =>
            renderAction(
              item,
              joinClasses(
                "dashboard-sidebar-item",
                "accountant-sidebar-item",
                item.active && "dashboard-sidebar-item-active accountant-sidebar-item-active",
                item.className
              ),
              <>
                <div className="dashboard-sidebar-item-icon accountant-sidebar-item-icon">
                  <img src={item.icon} alt={item.iconAlt || item.label || "icon"} />
                </div>
                {item.label ? <span>{item.label}</span> : null}
              </>
            )
          )}
        </aside>

        <div className="dashboard-main accountant-main-area">
          <div className="dashboard-topbar accountant-topbar">
            <nav className="dashboard-topbar-left accountant-topbar-left">
              {topbarTabs.map((tab) =>
                renderAction(
                  tab,
                  joinClasses(
                    "dashboard-topbar-tab",
                    "accountant-topbar-tab",
                    tab.active && "dashboard-topbar-tab-active accountant-topbar-tab-active",
                    tab.className
                  ),
                  tab.label
                )
              )}
            </nav>

            <div className="dashboard-topbar-center accountant-topbar-center">
              <div className="dashboard-school-brand accountant-school-brand">
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt={logoAlt}
                    className="dashboard-school-logo accountant-school-logo"
                  />
                ) : null}
                {instituteName ? (
                  <span className="dashboard-school-name accountant-school-name">{instituteName}</span>
                ) : null}
              </div>
            </div>

            <div className="dashboard-topbar-right accountant-topbar-right">{topbarRight}</div>
          </div>

          {children}
        </div>
      </div>

      {footerLogoSrc ? (
        <div className="dashboard-footer-brand accountant-footer-brand">
          <span>{footerText}</span>
          <img
            src={footerLogoSrc}
            alt={footerLogoAlt}
            className="dashboard-footer-logo accountant-footer-logo"
          />
        </div>
      ) : null}
    </div>
  );
};

export default DashboardLayout;
