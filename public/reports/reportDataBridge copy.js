(function () {
  // Dynamic mode: read payload from localStorage/postMessage and bind data into report templates.

  var STORAGE_KEY = "reportCardPayload";
  var DEFAULT_STATIC_PAYLOAD = {
    student: {
      name: "Rahul Sharma",
      class_name: "10",
      section: "A",
      schoolCode: "ABC123"
    },
    performance: [
      { subject: "English", FA: [16, 17, 18, 17], SA: [68, 70] },
      { subject: "Mathematics", FA: [18, 19, 18, 20], SA: [74, 76] },
      { subject: "Science", FA: [17, 16, 17, 18], SA: [69, 72] },
      { subject: "Social", FA: [15, 16, 17, 16], SA: [66, 68] },
      { subject: "Hindi", FA: [16, 15, 17, 18], SA: [67, 71] }
    ],
    syncedAt: new Date().toISOString()
  };

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function resolvePhotoUrl(photo) {
    if (!photo) return "";
    var path = photo;

    if (photo && photo.data) {
      try {
        var byteArray = new Uint8Array(photo.data);
        path = String.fromCharCode.apply(null, byteArray);
      } catch (e) {
        path = "";
      }
    }

    if (typeof path === "string" && path.startsWith("0x")) {
      try {
        path = path
          .match(/.{2}/g)
          .map(function (byte) { return String.fromCharCode(parseInt(byte, 16)); })
          .join("");
      } catch (e) {
        path = "";
      }
    }

    if (!path) return "";
    if (path.startsWith("data:")) return path;
    if (path.startsWith("http")) return path;
    if (!path.startsWith("/")) path = "/" + path;
    return "https://cleezoclass.com:4000" + path;
  }

  function bindText(selector, value) {
    Array.from(document.querySelectorAll(selector)).forEach(function (node) {
      node.textContent = value;
    });
  }

  function bindDataAttrs(student) {
    var fullName = normalizeText(student && student.name);
    var firstName = fullName ? fullName.split(" ")[0] : "";
    var mappings = {
      "data-student-name": student.name,
      "data-student-first-name": firstName,
      "data-student-class": student.class_name,
      "data-student-section": student.section,
      "data-student-father": student.father_name,
      "data-student-address": student.address,
      "data-student-phone": student.phone_no,
      "data-student-aadhar": student.aadhar_no,
      "data-student-admission": student.admission_no,
      "data-student-dob": student.dob
    };

    Object.keys(mappings).forEach(function (attr) {
      Array.from(document.querySelectorAll("[" + attr + "]")).forEach(function (node) {
        node.textContent = mappings[attr] || "-";
      });
    });
  }

  function bindStudentPhoto(photo) {
    var url = resolvePhotoUrl(photo);
    if (!url) return;
    Array.from(document.querySelectorAll("img[data-student-photo]")).forEach(function (img) {
      img.src = url;
    });
  }

  function bindSchoolDetails(schoolCode, schoolDetails) {
    if (schoolDetails && schoolDetails.schoolName) {
      bindText(".school-name", schoolDetails.schoolName);
      bindText("[data-school-name]", schoolDetails.schoolName);
    }

    var logoUrl = schoolDetails && schoolDetails.logo ? resolvePhotoUrl(schoolDetails.logo) : "";
    if (logoUrl) {
      Array.from(document.querySelectorAll("img.logo, img[data-school-logo]")).forEach(function (img) {
        img.src = logoUrl;
      });
    }

    if (!schoolDetails || (!schoolDetails.schoolName && !schoolDetails.logo)) {
      if (!schoolCode) return;
      fetch("https://cleezoclass.com:4000/api/institute?dbName=" + schoolCode)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var name = data && data.institute_name ? data.institute_name : "";
          var logo = data && data.logo ? data.logo : "";
          if (name) {
            bindText(".school-name", name);
            bindText("[data-school-name]", name);
          }
          var logoPath = resolvePhotoUrl(logo);
          if (logoPath) {
            Array.from(document.querySelectorAll("img.logo, img[data-school-logo]")).forEach(function (img) {
              img.src = logoPath;
            });
          }
        })
        .catch(function () {});
    }
  }

  function gradeFromPercentage(p) {
    var pct = Number(p);
    if (pct >= 90) return "A1";
    if (pct >= 80) return "A2";
    if (pct >= 70) return "B1";
    if (pct >= 60) return "B2";
    if (pct >= 50) return "C1";
    if (pct >= 40) return "C2";
    if (pct >= 33) return "D";
    return "E";
  }

  function getLegacyMark(item, key) {
    var match = String(key || "").toUpperCase().match(/^(FA|SA)(\\d+)$/);
    if (!match) return { mark: "-", max: 0 };
    var type = match[1];
    var index = Number(match[2]) - 1;
    var mark = type === "FA" ? (item?.FA?.[index]) : (item?.SA?.[index]);
    var max = type === "FA" ? 20 : 80;
    return { mark: mark ?? "-", max: mark === null || mark === undefined ? 0 : max };
  }

  function at(list, index) {
    return Array.isArray(list) && list[index] != null ? list[index] : "-";
  }

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function toNumber(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function withTermTotals(item) {
    var fa = Array.isArray(item.FA) ? item.FA : [];
    var sa = Array.isArray(item.SA) ? item.SA : [];
    var term1FAAvg = item.term1FAAvg != null ? toNumber(item.term1FAAvg) : ((toNumber(fa[0]) + toNumber(fa[1])) / 2);
    var term2FAAvg = item.term2FAAvg != null ? toNumber(item.term2FAAvg) : ((toNumber(fa[2]) + toNumber(fa[3])) / 2);
    var sa1 = item.sa1 != null ? toNumber(item.sa1) : toNumber(sa[0]);
    var sa2 = item.sa2 != null ? toNumber(item.sa2) : toNumber(sa[1]);
    var term1Total = item.term1Total != null ? toNumber(item.term1Total) : (term1FAAvg + sa1);
    var term2Total = item.term2Total != null ? toNumber(item.term2Total) : (term2FAAvg + sa2);
    var grandTotal = item.grandTotal != null ? toNumber(item.grandTotal) : (term1Total + term2Total);
    var grandPercentage = item.grandPercentage != null ? Number(item.grandPercentage) : ((grandTotal / 240) * 100);

    return {
      term1FAAvg: term1FAAvg,
      term2FAAvg: term2FAAvg,
      sa1: sa1,
      sa2: sa2,
      term1Total: term1Total,
      term2Total: term2Total,
      grandTotal: grandTotal,
      grandPercentage: Number.isFinite(grandPercentage) ? grandPercentage : 0,
      grandGrade: item.grandGrade || gradeFromPercentage(grandPercentage)
    };
  }

  function getContainer() {
    return document.querySelector(".report-card") || document.body;
  }

  function ensureRoot() {
    var root = document.getElementById("live-academic-performance");
    if (!root) {
      root = document.createElement("section");
      root.id = "live-academic-performance";
      root.style.margin = "20px";
      root.style.padding = "14px";
      root.style.border = "2px solid #2c3e90";
      root.style.borderRadius = "10px";
      root.style.background = "#ffffff";
      getContainer().appendChild(root);
    }
    return root;
  }

  function valueForHeader(header, item, colIndex) {
    var h = normalize(header);
    var percentage = item.percentage != null ? item.percentage : "0.00";
    var grade = item.overallGrade || gradeFromPercentage(percentage);
    var t = withTermTotals(item);

    if (h.includes("subject")) return item.subject || "-";
    if (h.includes("fa (avg)")) return colIndex >= 3 ? t.term2FAAvg.toFixed(2) : t.term1FAAvg.toFixed(2);
    if (h.includes("term 1") || h === "term1") return t.term1Total;
    if (h.includes("term 2") || h === "term2") return t.term2Total;
    if (h.includes("sa 1") || h.includes("sa1")) return t.sa1.toFixed(2);
    if (h.includes("sa 2") || h.includes("sa2")) return t.sa2.toFixed(2);
    if (h.includes("grand total") || h.includes("grandtotal")) return t.grandTotal;
    if (h.includes("grand %") || h.includes("grand percentage")) return t.grandPercentage.toFixed(2) + "%";
    if (h.includes("grand grade")) return t.grandGrade;
    if (h.includes("pt-1") || h.includes("test 1") || h.includes("fa1") || h === "semester 1") return at(item.FA, 0);
    if (h.includes("pt-2") || h.includes("test 2") || h.includes("fa2") || h === "semester 2") return at(item.FA, 1);
    if (h.includes("fa3")) return at(item.FA, 2);
    if (h.includes("fa4")) return at(item.FA, 3);
    if (h.includes("assignment") || h === "aa") return at(item.FA, 2);
    if (h.includes("sea") || h.includes("nb") || h.includes("pf") || h === "ot") return at(item.FA, 3);
    if (h.includes("exam") || h.includes("sa1")) return at(item.SA, 0);
    if (h.includes("sa2")) return at(item.SA, 1);
    if (h.includes("total")) return item.total != null ? item.total : "-";
    if (h.includes("%") || h.includes("percentage")) return percentage + "%";
    if (h.includes("grade")) return grade;
    if (h.includes("remark") || h.includes("comment")) return "-";

    return "-";
  }

  function findAcademicTable() {
    var tables = Array.from(document.querySelectorAll("table"));
    return (
      tables.find(function (table) {
        var headers = Array.from(table.querySelectorAll("th")).map(function (th) {
          return normalize(th.textContent);
        });
        var hasSubject = headers.some(function (h) { return h.includes("subject"); });
        var hasScholastic = headers.some(function (h) {
          return h.includes("scholastic") || h.includes("areas") || h.includes("academic");
        });
        var hasTermLike = headers.some(function (h) {
          return h.includes("term") || h.includes("pt-1") || h.includes("pt-2") || h.includes("exam");
        });
        return hasSubject || (hasScholastic && hasTermLike);
      }) || null
    );
  }

  function replaceAcademicRows(performance, testTypes) {
    var table = findAcademicTable();
    if (!table) return false;
    var safeTests = Array.isArray(testTypes) && testTypes.length
      ? testTypes.filter(function (t) { return t && t.key && t.label; })
      : [
          { key: "FA1", label: "FA1", maxMarks: 20 },
          { key: "FA2", label: "FA2", maxMarks: 20 },
          { key: "SA1", label: "SA1", maxMarks: 80 },
          { key: "FA3", label: "FA3", maxMarks: 20 },
          { key: "FA4", label: "FA4", maxMarks: 20 },
          { key: "SA2", label: "SA2", maxMarks: 80 }
        ];

    var headerRow = safeTests.map(function (t) { return "<th>" + t.label + "</th>"; }).join("");
    table.innerHTML = [
      "<thead>",
      "<tr>",
      "<th>Subject</th>",
      headerRow,
      "<th>Marks</th>",
      "<th>%</th>",
      "<th>Grade</th>",
      "</tr>",
      "</thead>",
      "<tbody></tbody>"
    ].join("");

    var tbody = table.querySelector("tbody");

    if (!Array.isArray(performance) || performance.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No academic-performance data found.</td></tr>';
      return true;
    }

    var overallMarksSum = 0;
    var overallPctSum = 0;
    var overallPctCount = 0;

    performance.forEach(function (item) {
      var subjectMarks = 0;
      var subjectMax = 0;
      var rowCells = safeTests.map(function (t) {
        var entry = item?.tests?.[t.key];
        var val = entry && typeof entry === "object" ? entry.obtained : entry;
        if (val === undefined || val === null || val === "-") {
          var legacy = getLegacyMark(item, t.key);
          val = legacy.mark;
          if (legacy.max) {
            subjectMax += legacy.max;
            subjectMarks += toNumber(val);
          }
        } else {
          subjectMarks += toNumber(val);
          subjectMax += Number(entry?.max ?? t.maxMarks ?? 0);
        }
        return "<td>" + (val === undefined || val === null ? "-" : val) + "</td>";
      }).join("");

      var subjectPct = subjectMax > 0 ? (subjectMarks / subjectMax) * 100 : 0;
      var subjectGrade = gradeFromPercentage(subjectPct);

      overallMarksSum += subjectMarks;
      overallPctSum += subjectPct;
      overallPctCount += 1;

      var tr = document.createElement("tr");
      tr.innerHTML = [
        "<td>" + (item.subject || "-") + "</td>",
        rowCells,
        "<td>" + subjectMarks.toFixed(2) + "</td>",
        "<td>" + subjectPct.toFixed(1) + "%</td>",
        "<td>" + subjectGrade + "</td>"
      ].join("");
      tbody.appendChild(tr);
    });

    var finalPct = overallPctCount ? overallPctSum / overallPctCount : 0;
    var finalGrade = gradeFromPercentage(finalPct);
    var overallTr = document.createElement("tr");
    overallTr.innerHTML = [
      '<td style="font-weight:700;">Overall Report</td>',
      '<td colspan="' + safeTests.length + '" style="text-align:right;font-weight:700;">Totals</td>',
      '<td style="font-weight:700;">' + overallMarksSum.toFixed(2) + "</td>",
      '<td style="font-weight:700;">' + finalPct.toFixed(1) + "%</td>",
      '<td style="font-weight:700;">' + finalGrade + "</td>"
    ].join("");
    tbody.appendChild(overallTr);
    return true;
  }

  function renderAttendanceTable(attendance) {
    var table = document.querySelector("[data-attendance-table]");
    if (!table) return;
    var tbody = table.querySelector("tbody") || table;
    tbody.innerHTML = "";

    if (!Array.isArray(attendance) || attendance.length === 0) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 5;
      emptyCell.textContent = "No attendance data";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    attendance.forEach(function (month) {
      var total = toNumber(month.total);
      var present = toNumber(month.present);
      var absent = Math.max(total - present, 0);
      var pct = total > 0 ? (present / total) * 100 : 0;

      var tr = document.createElement("tr");
      tr.innerHTML = [
        "<td>" + (month.month || "") + " " + (month.year || "") + "</td>",
        "<td>" + total + "</td>",
        "<td>" + present + "</td>",
        "<td>" + absent + "</td>",
        "<td>" + pct.toFixed(1) + "%</td>"
      ].join("");
      tbody.appendChild(tr);
    });
  }

  function applyStandardAcademicSkeleton() {
    var table = findAcademicTable();
    if (!table) return;

    var hasAnySubjectData = Array.from(table.querySelectorAll("td")).some(function (td) {
      var txt = (td.textContent || "").trim();
      if (!txt) return false;
      return !/^subject$/i.test(txt);
    });

    // If report already has visible rows, leave static template untouched.
    // Live payload render will standardize it anyway.
    if (hasAnySubjectData) return;

    table.innerHTML = [
      "<thead>",
      "<tr>",
      '<th rowspan="2">Subject</th>',
      '<th colspan="3">Term I</th>',
      '<th colspan="3">Term II</th>',
      '<th colspan="3">Overall</th>',
      "</tr>",
      "<tr>",
      "<th>FA1</th>",
      "<th>FA2</th>",
      "<th>SA 1</th>",
      "<th>FA3</th>",
      "<th>FA4</th>",
      "<th>SA 2</th>",
      "<th>Marks</th>",
      "<th>%</th>",
      "<th>Grade</th>",
      "</tr>",
      "</thead>",
      '<tbody><tr><td colspan="10" style="text-align:center;">Waiting for backend data...</td></tr></tbody>'
    ].join("");
  }

  function replaceStudentInfo(student) {
    var classValue = [student.class_name || "-", student.section || "-"].join("-");

    var replacers = [
      { pattern: /^name\s*:/i, value: "Name: " + (student.name || "-") },
      { pattern: /^class\s*:/i, value: "Class: " + classValue },
      { pattern: /^section\s*:/i, value: "Section: " + (student.section || "-") }
    ];

    Array.from(document.querySelectorAll("td,div,p,span")).forEach(function (el) {
      var text = (el.textContent || "").trim();
      if (!text || text.length > 100) return;
      for (var i = 0; i < replacers.length; i += 1) {
        if (replacers[i].pattern.test(text)) {
          el.textContent = replacers[i].value;
          break;
        }
      }
    });

    // Handle label/value table layouts used by some report templates.
    Array.from(document.querySelectorAll("tr")).forEach(function (row) {
      var cells = Array.from(row.querySelectorAll("td,th"));
      if (cells.length < 2) return;

      for (var i = 0; i < cells.length - 1; i += 1) {
        var label = normalize(cells[i].textContent);
        var valueCell = cells[i + 1];
        if (!label) continue;

        if (label.includes("name")) {
          valueCell.textContent = student.name || "-";
        } else if (label === "class" || label.startsWith("class ")) {
          valueCell.textContent = student.class_name || "-";
        } else if (label.includes("section")) {
          valueCell.textContent = student.section || "-";
        } else if (label.includes("roll")) {
          valueCell.textContent = "-";
        } else if (label.includes("teacher")) {
          valueCell.textContent = "-";
        } else if (label.includes("school year")) {
          valueCell.textContent = String(new Date().getFullYear());
        } else if (label.includes("grading period")) {
          valueCell.textContent = "-";
        }
      }
    });

    // Handle "Name: John Doe" style blocks, including "Roll No" and "Teacher".
    Array.from(document.querySelectorAll("div,p,span,td")).forEach(function (el) {
      var text = (el.textContent || "").trim();
      if (!text || text.length > 120) return;

      if (/^name\s*:/i.test(text)) {
        el.textContent = "Name: " + (student.name || "-");
      } else if (/^class\s*:/i.test(text)) {
        el.textContent = "Class: " + (student.class_name || "-");
      } else if (/^section\s*:/i.test(text)) {
        el.textContent = "Section: " + (student.section || "-");
      } else if (/^roll(\s*no)?\s*:/i.test(text)) {
        el.textContent = "Roll No: -";
      } else if (/^teacher\s*:/i.test(text)) {
        el.textContent = "Teacher: -";
      }
    });
  }

  function applyStudentNamePlaceholders(student) {
    var fullName = String(student && student.name ? student.name : "").trim() || "Student";
    var firstName = fullName.split(/\s+/)[0] || fullName;

    Array.from(document.querySelectorAll("[data-student-name]")).forEach(function (el) {
      el.textContent = fullName;
    });

    Array.from(document.querySelectorAll("[data-student-first-name]")).forEach(function (el) {
      el.textContent = firstName;
    });
  }

  function replaceSampleNamesWithStudent(student) {
    var fullName = String(student && student.name ? student.name : "").trim() || "Student";
    var firstName = fullName.split(/\s+/)[0] || fullName;

    function escapeRegex(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    var fullNameSamples = [
      "John Doe",
      "Rahul Sharma",
      "Rahul Kumar"
    ];

    var firstNameSamples = [
      "John",
      "Rahul",
      "Sathwik"
    ];

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      if (!text || !text.trim()) return;

      var next = text;

      fullNameSamples.forEach(function (sample) {
        var rx = new RegExp("\\b" + escapeRegex(sample) + "\\b", "g");
        next = next.replace(rx, fullName);
      });

      firstNameSamples.forEach(function (sample) {
        var rx = new RegExp("\\b" + escapeRegex(sample) + "\\b", "g");
        next = next.replace(rx, firstName);
      });

      if (next !== text) node.nodeValue = next;
    });
  }

  function buildRows(performance) {
    if (!Array.isArray(performance) || performance.length === 0) {
      return '<tr><td colspan="5" style="text-align:center;">No academic-performance data found.</td></tr>';
    }

    return performance
      .map(function (item) {
        var t = withTermTotals(item);

        return [
          "<tr>",
          "<td>" + (item.subject || "-") + "</td>",
          "<td>" + t.term1FAAvg.toFixed(2) + "</td>",
          "<td>" + t.sa1.toFixed(2) + "</td>",
          "<td>" + t.term2FAAvg.toFixed(2) + "</td>",
          "<td>" + t.sa2.toFixed(2) + "</td>",
          "<td>" + t.grandPercentage.toFixed(1) + "%</td>",
          "<td>" + t.grandGrade + "</td>",
          "</tr>"
        ].join("");
      })
      .join("");
  }

  function buildBottomScholasticRows(performance) {
    if (!Array.isArray(performance) || performance.length === 0) {
      return {
        rowsHtml: '<tr><td colspan="10" style="text-align:center;">No academic-performance data found.</td></tr>',
        totalMarks: 0,
        avgPct: 0,
        grade: "E"
      };
    }

    var totalMarks = 0;
    var pctSum = 0;
    var pctCount = 0;

    var rowsHtml = performance.map(function (item) {
      var t = withTermTotals(item);
      var fa1 = toNumber(at(item.FA, 0));
      var fa2 = toNumber(at(item.FA, 1));
      var fa3 = toNumber(at(item.FA, 2));
      var fa4 = toNumber(at(item.FA, 3));
      var sa1 = t.sa1;
      var sa2 = t.sa2;
      var marks = fa1 + fa2 + sa1 + fa3 + fa4 + sa2;
      var pct = Number.isFinite(t.grandPercentage) ? t.grandPercentage : 0;
      var grd = t.grandGrade || gradeFromPercentage(pct);

      totalMarks += marks;
      pctSum += pct;
      pctCount += 1;

      return [
        "<tr>",
        "<td>" + (item.subject || "-") + "</td>",
        "<td>" + fa1.toFixed(2) + "</td>",
        "<td>" + fa2.toFixed(2) + "</td>",
        "<td>" + sa1.toFixed(2) + "</td>",
        "<td>" + fa3.toFixed(2) + "</td>",
        "<td>" + fa4.toFixed(2) + "</td>",
        "<td>" + sa2.toFixed(2) + "</td>",
        "<td>" + marks.toFixed(2) + "</td>",
        "<td>" + pct.toFixed(1) + "%</td>",
        "<td>" + grd + "</td>",
        "</tr>"
      ].join("");
    }).join("");

    var avgPct = pctCount ? pctSum / pctCount : 0;
    return {
      rowsHtml: rowsHtml,
      totalMarks: totalMarks,
      avgPct: avgPct,
      grade: gradeFromPercentage(avgPct)
    };
  }

  function getScholasticTheme() {
    var titleEl = document.querySelector(".section-title");
    var headerEl = document.querySelector("table th");
    var cellEl = document.querySelector("table td");

    var sectionBorderColor = "#5f7b88";
    var headingTextColor = "#2c3e90";
    var headerBg = "#90a4ae";
    var headerText = "#111";
    var headerBorder = "#222";
    var bodyBorder = "#999";

    if (titleEl && window.getComputedStyle) {
      var titleStyle = window.getComputedStyle(titleEl);
      if (titleStyle.borderColor && titleStyle.borderColor !== "rgba(0, 0, 0, 0)") {
        sectionBorderColor = titleStyle.borderColor;
      }
      if (titleStyle.color) {
        headingTextColor = titleStyle.color;
      }
      if (titleStyle.backgroundColor && titleStyle.backgroundColor !== "rgba(0, 0, 0, 0)") {
        headerBg = titleStyle.backgroundColor;
      }
    }

    if (headerEl && window.getComputedStyle) {
      var headerStyle = window.getComputedStyle(headerEl);
      if (headerStyle.backgroundColor && headerStyle.backgroundColor !== "rgba(0, 0, 0, 0)") {
        headerBg = headerStyle.backgroundColor;
      }
      if (headerStyle.color) {
        headerText = headerStyle.color;
      }
      if (headerStyle.borderColor) {
        headerBorder = headerStyle.borderColor;
      }
    }

    if (cellEl && window.getComputedStyle) {
      var cellStyle = window.getComputedStyle(cellEl);
      if (cellStyle.borderColor) {
        bodyBorder = cellStyle.borderColor;
      }
    }

    return {
      sectionBorderColor: sectionBorderColor,
      headingTextColor: headingTextColor,
      headerBg: headerBg,
      headerText: headerText,
      headerBorder: headerBorder,
      bodyBorder: bodyBorder
    };
  }

  function renderBottomScholastic(performance) {
    var container = getContainer();
    if (!container) return;
    var isCompactReport = /report[456]\.html$/i.test(window.location.pathname || "");
    var isReport4 = /report4\.html$/i.test(window.location.pathname || "");
    var isReport5 = /report5\.html$/i.test(window.location.pathname || "");
    var isReport6 = /report6\.html$/i.test(window.location.pathname || "");


    // Report 5: place Scholastic Area below the "GRADING SCALE" row.
    if (isReport5) {
      var gradingTitle = Array.from(container.querySelectorAll(".section-title")).find(function (el) {
        return /grading\s*scale/i.test((el.textContent || "").trim());
      });
      var anchor = gradingTitle ? (gradingTitle.closest(".row") || gradingTitle.parentElement) : null;
      if (anchor && anchor.parentNode && section !== anchor && section.previousElementSibling !== anchor) {
        anchor.parentNode.insertBefore(section, anchor.nextSibling);
      }
    }

    // Report 4: place Scholastic Area below the "Marks Range / Grade" table.
    if (isReport4) {
      var gradingSection = container.querySelector(".grading-section");
      var gradingAnchor = gradingSection || (container.querySelector(".grading-table") ? container.querySelector(".grading-table").closest("div") : null);
      if (gradingAnchor && gradingAnchor.parentNode && section !== gradingAnchor && section.previousElementSibling !== gradingAnchor) {
        gradingAnchor.parentNode.insertBefore(section, gradingAnchor.nextSibling);
      }
    }

    // Report 6: place Scholastic Area below the "Notes" section.
    if (isReport6) {
      var notesHeading = Array.from(container.querySelectorAll("h1,h2,h3,h4,div,p,span")).find(function (el) {
        return /^notes$/i.test((el.textContent || "").trim());
      });
      var notesAnchor = notesHeading
        ? (notesHeading.closest(".flex") || notesHeading.closest(".box") || notesHeading.parentElement)
        : null;
      if (notesAnchor && notesAnchor.parentNode && section !== notesAnchor && section.previousElementSibling !== notesAnchor) {
        notesAnchor.parentNode.insertBefore(section, notesAnchor.nextSibling);
      }
    }
    section.style.maxWidth = isCompactReport ? "920px" : "100%";
    section.style.marginLeft = "auto";
    section.style.marginRight = "auto";

    var built = buildBottomScholasticRows(performance);
    var theme = getScholasticTheme();
 
  }

  function ensureReport1FooterBelowScholastic() {
    var isReport1 = /report1\.html$/i.test(window.location.pathname || "");
    if (!isReport1) return;

    var container = getContainer();
    if (!container) return;

    var scholasticSection = container.querySelector("#bottom-scholastic-area");
    var footer = container.querySelector(".footer");
    if (!scholasticSection || !footer) return;

    // Re-append footer so it always appears below dynamic scholastic content.
    if (footer.parentNode === container) {
      footer.style.marginTop = "14px";
      container.appendChild(footer);
    }
  }

  function buildChartPoints(performance) {
    if (!Array.isArray(performance) || performance.length === 0) {
      return { labels: [], grandPercentages: [], term1: [], term2: [] };
    }

    return {
      labels: performance.map(function (item) { return item.subject || "-"; }),
      grandPercentages: performance.map(function (item) {
        return Number(withTermTotals(item).grandPercentage.toFixed(2));
      }),
      term1: performance.map(function (item) {
        return Number(withTermTotals(item).term1Total.toFixed(2));
      }),
      term2: performance.map(function (item) {
        return Number(withTermTotals(item).term2Total.toFixed(2));
      })
    };
  }

  function getReportPalette() {
    var path = String(window.location.pathname || "").toLowerCase();
    if (path.indexOf("report2") !== -1) {
      return { primary: "#1f6f43", secondary: "#7cc08a", accent: "#0f5a32" };
    }
    if (path.indexOf("report3") !== -1) {
      return { primary: "#7c2d4b", secondary: "#d4a2b4", accent: "#5b1c34" };
    }
    if (path.indexOf("report4") !== -1) {
      return { primary: "#2f5f93", secondary: "#c7d9ee", accent: "#23456b" };
    }
    if (path.indexOf("report5") !== -1) {
      return { primary: "#d9edf7", secondary: "#d9edf7", accent: "#d9edf7" };
    }
    if (path.indexOf("report6") !== -1) {
      return { primary: "#4a4f9c", secondary: "#a6acd9", accent: "#343978" };
    }
    return { primary: "#2a4f7b", secondary: "#9fb3c8", accent: "#1b6fb9" };
  }

  function buildGraphicalPoints(performance) {
    if (!Array.isArray(performance) || performance.length === 0) {
      return { labels: [], obtained: [], max: [], percent: [] };
    }

    var labels = performance.map(function (item) { return item.subject || "-"; });
    var obtained = performance.map(function (item) {
      var fa = Array.isArray(item.FA) ? item.FA : [];
      var sa = Array.isArray(item.SA) ? item.SA : [];
      var sum = 0;
      fa.forEach(function (v) { sum += toNumber(v); });
      sa.forEach(function (v) { sum += toNumber(v); });
      return Number(sum.toFixed(2));
    });
    var max = performance.map(function () { return 100; });
    var percent = obtained.map(function (v) { return Number(((v / 100) * 100).toFixed(2)); });
    return { labels: labels, obtained: obtained, max: max, percent: percent };
  }

  function upsertChart(canvasId, configBuilder) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || typeof window.Chart === "undefined") return;

    if (!window.__reportBridgeCharts) window.__reportBridgeCharts = {};
    var key = "chart_" + canvasId;

    try {
      if (window.__reportBridgeCharts[key] && typeof window.__reportBridgeCharts[key].destroy === "function") {
        window.__reportBridgeCharts[key].destroy();
      }
      window.__reportBridgeCharts[key] = new window.Chart(canvas, configBuilder());
    } catch (e) {
      // ignore chart rendering issues per template
    }
  }

  function syncCharts(performance) {
    var points = buildChartPoints(performance);
    if (points.labels.length === 0) return;
    var palette = getReportPalette();

    var yMax = Math.max.apply(null, points.grandPercentages.concat([100]));

    // report1/report2
    upsertChart("performanceChart", function () {
      return {
        type: "bar",
        data: {
          labels: points.labels,
          datasets: [{
            label: "Grand Total %",
            data: points.grandPercentages,  
            backgroundColor: palette.primary
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "top" } },
          scales: { y: { beginAtZero: true, max: yMax } }
        }
      };
    });

    // report3
    upsertChart("marksChart", function () {
      return {
        type: "bar",
        data: {
          labels: points.labels,
          datasets: [{
            label: "Grand Total %",
            data: points.grandPercentages,
            backgroundColor: palette.primary
          }]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true, max: yMax } }
        }
      };
    });

    // report5
    upsertChart("graph", function () {
      return {
        type: "bar",
        data: {
          labels: points.labels,
          datasets: [{
            label: "Grand Total %",
            data: points.grandPercentages,
            backgroundColor: palette.primary
          }]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true, max: yMax } }
        }
      };
    });

    // report4
    upsertChart("barChart", function () {
      return {
        type: "bar",
        data: {
          labels: points.labels,
          datasets: [
            { label: "Term I", data: points.term1, backgroundColor: palette.primary },
            { label: "Term II", data: points.term2, backgroundColor: palette.secondary }
          ]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      };
    });

    upsertChart("lineChart", function () {
      return {
        type: "line",
        data: {
          labels: points.labels,
          datasets: [{
            label: "Grand Total %",
            data: points.grandPercentages,
            borderColor: palette.accent,
            backgroundColor: "rgba(27, 111, 185, 0.2)",
            fill: true,
            tension: 0.3
          }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: yMax } } }
      };
    });

    // Graphical Report: Max vs Obtained
    var g = buildGraphicalPoints(performance);
    if (g.labels.length) {
      upsertChart("graphicalChart", function () {
        return {
          type: "bar",
          data: {
            labels: g.labels,
            datasets: [
              { label: "Max Marks", data: g.max, backgroundColor: palette.secondary },
              { label: "Marks Obtained", data: g.obtained, backgroundColor: palette.primary }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: "top" } },
            scales: { y: { beginAtZero: true, max: 100 } }
          }
        };
      });

      upsertChart("analyticalChart", function () {
        return {
          type: "bar",
          data: {
            labels: g.labels,
            datasets: [
              { label: "Percentage", data: g.percent, backgroundColor: palette.primary }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: "top" } },
            scales: { y: { beginAtZero: true, max: 100 } }
          }
        };
      });
    }
  }

  function render(payload) {
    if (!payload || !payload.student) return;

    var student = payload.student || {};
    var performance = payload.performance || [];
    renderAttendanceTable(payload.attendance || []);

    bindDataAttrs(student);
    bindStudentPhoto(student.photo);
    bindSchoolDetails(student.schoolCode, payload.school || null);

    replaceStudentInfo(student);
    applyStudentNamePlaceholders(student);
    replaceSampleNamesWithStudent(student);
    var tableUpdated = replaceAcademicRows(performance, payload.testTypes || []);
    renderBottomScholastic(performance);
    ensureReport1FooterBelowScholastic();
    syncCharts(performance);

    // Most report templates already have their own layout/table.
    // Keep the extra fallback panel only when no compatible table exists.
    if (tableUpdated) {
      var existingRoot = document.getElementById("live-academic-performance");
      if (existingRoot) existingRoot.remove();
      return;
    }

    var root = ensureRoot();
    root.style.maxWidth = "100%";
    root.style.overflowX = "auto";
    root.style.fontSize = "12px";
    root.innerHTML = [
      '<h3 style="margin:0 0 10px 0;color:#2c3e90;">Academic Performance</h3>',
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;font-size:13px;">',
      '<span><strong>Name:</strong> ' + (student.name || "-") + "</span>",
      '<span><strong>Class:</strong> ' + (student.class_name || "-") + "</span>",
      '<span><strong>Section:</strong> ' + (student.section || "-") + "</span>",
      '<span><strong>School:</strong> ' + (student.schoolCode || "-") + "</span>",
      "</div>",
      '<table style="width:100%;border-collapse:collapse;font-size:12px;">',
      '<thead>',
      '<tr style="background:#90a4ae;color:#111;">',
      '<th rowspan="2" style="padding:6px;border:2px solid #222;">Subject</th>',
      '<th colspan="2" style="padding:6px;border:2px solid #222;">Term I</th>',
      '<th colspan="2" style="padding:6px;border:2px solid #222;">Term II</th>',
      '<th rowspan="2" style="padding:6px;border:2px solid #222;">Grand Total</th>',
      '<th rowspan="2" style="padding:6px;border:2px solid #222;">Grade</th>',
      '</tr>',
      '<tr style="background:#90a4ae;color:#111;">',
      '<th style="padding:6px;border:2px solid #222;">FA (Avg)</th>',
      '<th style="padding:6px;border:2px solid #222;">SA 1</th>',
      '<th style="padding:6px;border:2px solid #222;">FA (Avg)</th>',
      '<th style="padding:6px;border:2px solid #222;">SA 2</th>',
      "</tr>",
      "</thead>",
      '<tbody>' + buildRows(performance) + "</tbody>",
      "</table>",
      '<p style="font-size:11px;color:#444;margin:8px 0 0 0;">Source: /api/overall/academic-performance</p>'
    ].join("");
  }

  function handlePayload(payload) {
    if (!payload) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // ignore storage failures
    }
    render(payload);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === "REPORT_CARD_PAYLOAD") {
      handlePayload(event.data.payload);
    }
  });

  var cached = safeParse(localStorage.getItem(STORAGE_KEY));
  if (cached) {
    render(cached);
  } else {
    render(DEFAULT_STATIC_PAYLOAD);
  }
})(); 