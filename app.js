document.addEventListener('DOMContentLoaded', () => {
  const rawData = window.STEM_DATA || [];
  
  // State
  let filteredData = [...rawData];
  let currentPage = 1;
  let pageSize = 50;
  let currentSort = 'branch_rank';
  let selectedDivision = 'all';
  let selectedSchool = 'all';
  let selectedTier = 'all';
  let attemptMode = 'new'; // 'new' (بعد التحسين), 'old' (قبل التحسين), 'both' (مقارنة)
  let searchQuery = '';

  // Elements
  const totalCountEl = document.getElementById('statTotalCount');
  const perfectGpaEl = document.getElementById('statPerfectGpa');
  const tiersCountEl = document.getElementById('statTiersCount');
  const scienceCountEl = document.getElementById('statScienceCount');
  const mathCountEl = document.getElementById('statMathCount');
  
  const searchInput = document.getElementById('searchInput');
  const schoolFilter = document.getElementById('schoolFilter');
  const tierFilter = document.getElementById('tierFilter');
  const sortSelect = document.getElementById('sortSelect');
  const divisionPills = document.querySelectorAll('.pill-btn[data-division]');
  
  const attemptBtnNew = document.getElementById('attemptBtnNew');
  const attemptBtnOld = document.getElementById('attemptBtnOld');
  const attemptBtnBoth = document.getElementById('attemptBtnBoth');
  
  const tbody = document.getElementById('resultsTbody');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  const modalBackdrop = document.getElementById('studentModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalBody = document.getElementById('modalBody');

  // Populate Schools Filter Dropdown
  function initFilters() {
    // Schools
    const schools = Array.from(new Set(rawData.map(d => d.school_en))).filter(Boolean).sort();
    schools.forEach(sch => {
      const opt = document.createElement('option');
      opt.value = sch;
      opt.textContent = sch;
      schoolFilter.appendChild(opt);
    });

    // Tiers (الشرايح)
    const tiersMap = {};
    rawData.forEach(d => {
      const t = d.tier_number;
      if (!tiersMap[t]) {
        tiersMap[t] = { number: t, gpa: d.gpa, count: 0 };
      }
      tiersMap[t].count++;
    });

    const sortedTiers = Object.values(tiersMap).sort((a, b) => a.number - b.number);
    sortedTiers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.number.toString();
      opt.textContent = `الشريحة ${t.number} (GPA ${t.gpa.toFixed(2)} - ${t.count} طالب)`;
      tierFilter.appendChild(opt);
    });
  }

  // Populate Stats Summary
  function updateStats() {
    totalCountEl.textContent = rawData.length.toLocaleString();
    const perfectCount = rawData.filter(d => d.gpa === 4.0).length;
    perfectGpaEl.textContent = `${perfectCount} (${((perfectCount / rawData.length) * 100).toFixed(1)}%)`;
    
    const uniqueTiers = new Set(rawData.map(d => d.tier_number)).size;
    tiersCountEl.textContent = `${uniqueTiers} شرايح`;
    
    scienceCountEl.textContent = rawData.filter(d => d.division.toUpperCase() === 'SCIENCE').length.toLocaleString();
    mathCountEl.textContent = rawData.filter(d => d.division.toUpperCase() === 'MATH').length.toLocaleString();
  }

  // Populate Top 3 Leaderboard Podium
  function renderPodium() {
    const podiumGrid = document.getElementById('topPodiumGrid');
    if (!podiumGrid) return;
    
    const top3 = [...rawData].sort((a, b) => b.gpa - a.gpa || b.percentage - a.percentage).slice(0, 3);
    const badgeClasses = ['gold', 'silver', 'bronze'];
    const rankLabels = ['#1', '#2', '#3'];

    podiumGrid.innerHTML = top3.map((st, i) => `
      <div class="podium-card ${badgeClasses[i]}">
        <div class="podium-rank-badge">${rankLabels[i]}</div>
        <div class="podium-name">${st.name_en}</div>
        <div class="podium-school">${st.school_en} • ${st.division}</div>
        <div style="margin-bottom: 10px;"><span class="tier-badge">الشريحة 1</span></div>
        <div class="podium-scores">
          <div class="score-tag gpa">GPA ${st.gpa.toFixed(2)}</div>
          <div class="score-tag pct">${st.percentage.toFixed(2)}%</div>
          <div class="score-tag flex">مرنة: ${st.flexible_pct.toFixed(2)}%</div>
        </div>
      </div>
    `).join('');
  }

  // Filter & Sort Logic
  function applyFilters() {
    filteredData = rawData.filter(item => {
      // Division
      if (selectedDivision !== 'all' && item.division.toLowerCase() !== selectedDivision) {
        return false;
      }
      // School
      if (selectedSchool !== 'all' && item.school_en !== selectedSchool) {
        return false;
      }
      // Tier (الشريحة)
      if (selectedTier !== 'all' && item.tier_number.toString() !== selectedTier) {
        return false;
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchNameEn = item.name_en && item.name_en.toLowerCase().includes(q);
        const matchNameAr = item.name_ar && item.name_ar.includes(q);
        const matchSeat = item.seat_no && item.seat_no.toString().includes(q);
        const matchNat = item.national_id && item.national_id.includes(q);
        if (!matchNameEn && !matchNameAr && !matchSeat && !matchNat) {
          return false;
        }
      }
      return true;
    });

    // Sorting
    filteredData.sort((a, b) => {
      switch (currentSort) {
        case 'branch_rank':
          return a.rank_branch - b.rank_branch;
        case 'overall_rank':
          return a.rank_overall - b.rank_overall;
        case 'tier_asc':
          return a.tier_number - b.tier_number || a.rank_branch - b.rank_branch;
        case 'flex_desc':
          return b.flexible_pct - a.flexible_pct || a.seat_no - b.seat_no;
        case 'school_rank':
          return a.rank_school - b.rank_school;
        case 'gpa_desc':
          return b.gpa - a.gpa || b.percentage - a.percentage || a.seat_no - b.seat_no;
        case 'seat_asc':
          return a.seat_no - b.seat_no;
        case 'seat_desc':
          return b.seat_no - a.seat_no;
        case 'name_asc':
          return a.name_en.localeCompare(b.name_en);
        default:
          return a.rank_branch - b.rank_branch;
      }
    });

    currentPage = 1;
    renderTable();
  }

  // Render Table Page
  function renderTable() {
    const total = filteredData.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageItems = filteredData.slice(startIdx, endIdx);

    paginationInfo.textContent = `Showing ${total === 0 ? 0 : startIdx + 1} - ${endIdx} of ${total.toLocaleString()} STEM Students`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No student results found matching your search and filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageItems.map(st => {
      const rankBadgeClass = st.rank_branch === 1 ? 'top-1' : st.rank_branch === 2 ? 'top-2' : st.rank_branch === 3 ? 'top-3' : '';
      const divClass = st.division.toLowerCase() === 'science' ? 'science' : 'math';
      
      let gpaDisplay = '';
      let pctDisplay = '';
      let flexDisplay = '';

      if (attemptMode === 'new') {
        gpaDisplay = `<span class="gpa-pill ${st.gpa === 4.0 ? 'perfect' : ''}">${st.gpa.toFixed(2)}</span>`;
        pctDisplay = `${st.percentage.toFixed(2)}%`;
        flexDisplay = `<span class="flex-pct-badge">${st.flexible_pct.toFixed(2)}%</span>`;
      } else if (attemptMode === 'old') {
        const oldGpa = st.gpa_old || st.gpa;
        const oldPct = st.percentage_old || st.percentage;
        const oldFlex = st.flexible_pct_old || st.flexible_pct;
        gpaDisplay = `<span class="gpa-pill">${oldGpa.toFixed(2)}</span>`;
        pctDisplay = `${oldPct.toFixed(2)}%`;
        flexDisplay = `<span class="flex-pct-badge">${oldFlex.toFixed(2)}%</span>`;
      } else {
        // Compare Both
        const diffGpa = st.gpa_diff || 0;
        const diffTag = diffGpa > 0 ? `<span style="color:var(--success); font-size:11px;">(+${diffGpa.toFixed(2)})</span>` : `<span style="color:var(--text-muted); font-size:11px;">(0.00)</span>`;
        gpaDisplay = `<div>Old: ${st.gpa_old ? st.gpa_old.toFixed(2) : '-'} → New: <strong>${st.gpa.toFixed(2)}</strong> ${diffTag}</div>`;
        pctDisplay = `${st.percentage.toFixed(2)}%`;
        flexDisplay = `<span class="flex-pct-badge">${st.flexible_pct.toFixed(2)}%</span>`;
      }

      return `
        <tr onclick="openStudentModal(${st.seat_no})">
          <td>
            <span class="rank-tag ${rankBadgeClass}">#${st.rank_branch}</span>
          </td>
          <td>
            <span class="tier-badge">${st.tier_name_ar}</span>
          </td>
          <td>
            <div class="student-meta">
              <span class="student-name-en">${st.name_en}</span>
            </div>
          </td>
          <td><strong>${st.seat_no}</strong></td>
          <td><span class="division-badge ${divClass}">${st.division}</span></td>
          <td>${st.school_en}</td>
          <td>
            ${gpaDisplay}
            <div style="font-size: 12px; color: var(--text-muted);">${pctDisplay}</div>
          </td>
          <td>${flexDisplay}</td>
          <td>
            <button class="btn-action" onclick="event.stopPropagation(); openStudentModal(${st.seat_no})">
              Details
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Open Student Modal
  window.openStudentModal = function(seatNo) {
    const student = rawData.find(s => s.seat_no === seatNo);
    if (!student) return;

    const divClass = student.division.toLowerCase() === 'science' ? 'science' : 'math';

    let coursesHtml = '';
    if (student.courses && Object.keys(student.courses).length > 0) {
      coursesHtml = Object.entries(student.courses).map(([course, data]) => {
        let badgeClass = 'grade-A';
        if (data.grade.includes('A-')) badgeClass = 'grade-A-minus';
        else if (data.grade.includes('B+')) badgeClass = 'grade-B-plus';
        else if (data.grade.includes('B')) badgeClass = 'grade-B';
        else if (data.grade.includes('C')) badgeClass = 'grade-C';

        return `
          <tr>
            <td><strong>${course}</strong></td>
            <td><span class="grade-badge ${badgeClass}">${data.grade}</span></td>
            <td><strong>${data.points.toFixed(1)}</strong> / 4.0</td>
          </tr>
        `;
      }).join('');
    }

    let addCoursesHtml = '';
    if (student.additional_courses && Object.keys(student.additional_courses).length > 0) {
      addCoursesHtml = Object.entries(student.additional_courses).map(([course, res]) => `
        <tr>
          <td>${course}</td>
          <td><span style="color: var(--success); font-weight:700;">${res}</span></td>
        </tr>
      `).join('');
    }

    const gpaDiff = student.gpa_diff || 0;
    const diffBadge = gpaDiff > 0 ? `<span style="color:var(--success); font-size:14px; font-weight:700;"> (+${gpaDiff.toFixed(2)} GPA Improvement)</span>` : '';

    modalBody.innerHTML = `
      <div class="modal-student-header">
        <div class="modal-student-name">${student.name_en}</div>
        <div style="margin-bottom: 12px;">
          <span class="division-badge ${divClass}">${student.division} DIVISION</span>
          <span class="tier-badge" style="margin-left:8px;">${student.tier_name_ar}</span>
          <span style="color: var(--text-muted); font-size: 14px; margin-left: 10px;">Seat No: <strong>${student.seat_no}</strong></span>
        </div>
        <div class="modal-badges">
          <div class="rank-chip">Branch Rank: <strong>#${student.rank_branch}</strong></div>
          <div class="rank-chip">National Rank: <strong>#${student.rank_overall}</strong></div>
          <div class="rank-chip">School Rank: <strong>#${student.rank_school}</strong></div>
        </div>
      </div>

      <div class="modal-summary-box">
        <div class="summary-item">
          <h4>${student.gpa.toFixed(2)}${diffBadge}</h4>
          <p>GPA (بعد التحسين - الفرصة الثانية)</p>
        </div>
        <div class="summary-item">
          <h4>${student.percentage.toFixed(2)}%</h4>
          <p>المجموع الكلي الأصلي</p>
        </div>
        <div class="summary-item">
          <h4 style="color: #34d399;">${student.flexible_pct.toFixed(2)}%</h4>
          <p>النسبة المرنة (المجموع x 1.25)</p>
        </div>
        <div class="summary-item">
          <h4 style="font-size: 16px; color: var(--info);">${student.school_en}</h4>
          <p>STEM Institution</p>
        </div>
      </div>

      ${student.gpa_old ? `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-top: 16px; font-size: 13px; text-align: center;">
          <strong>Attempt Comparison (مقارنة الفرصتين):</strong> First Attempt (الفرصة الأولى): <strong>${student.gpa_old.toFixed(2)} GPA (${(student.percentage_old || 0).toFixed(2)}%)</strong> → Second Attempt (الفرصة الثانية بعد التحسين): <strong>${student.gpa.toFixed(2)} GPA (${student.percentage.toFixed(2)}%)</strong>
        </div>
      ` : ''}

      <div class="modal-section-title">Academic Subject Results</div>
      <table class="course-grid-table">
        <thead>
          <tr>
            <th>Course Title</th>
            <th>Grade</th>
            <th>Grade Points</th>
          </tr>
        </thead>
        <tbody>
          ${coursesHtml}
        </tbody>
      </table>

      ${addCoursesHtml ? `
        <div class="modal-section-title">Additional Requirements & Labs</div>
        <table class="course-grid-table">
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${addCoursesHtml}
          </tbody>
        </table>
      ` : ''}

      <div style="text-align: center; margin-top: 24px;">
        <button class="btn-action" style="padding: 10px 24px; font-size: 14px;" onclick="window.print()">
          🖨️ Print Official Result Transcript
        </button>
      </div>
    `;

    modalBackdrop.classList.add('active');
  };

  // Close Modal
  modalCloseBtn.addEventListener('click', () => modalBackdrop.classList.remove('active'));
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) modalBackdrop.classList.remove('active');
  });

  // Event Listeners for Filters
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFilters();
  });

  schoolFilter.addEventListener('change', (e) => {
    selectedSchool = e.target.value;
    applyFilters();
  });

  tierFilter.addEventListener('change', (e) => {
    selectedTier = e.target.value;
    applyFilters();
  });

  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyFilters();
  });

  divisionPills.forEach(pill => {
    pill.addEventListener('click', () => {
      divisionPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedDivision = pill.getAttribute('data-division');
      applyFilters();
    });
  });

  // Attempt Mode Listeners
  [attemptBtnNew, attemptBtnOld, attemptBtnBoth].forEach(btn => {
    btn.addEventListener('click', () => {
      [attemptBtnNew, attemptBtnOld, attemptBtnBoth].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      attemptMode = btn.getAttribute('data-attempt');
      renderTable();
    });
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  // Initial Load
  initFilters();
  updateStats();
  renderPodium();
  applyFilters();
});
