document.addEventListener('DOMContentLoaded', () => {
  const rawData = window.STEM_DATA || [];
  
  // State
  let filteredData = [...rawData];
  let currentPage = 1;
  let pageSize = 50;
  
  // Universal Sorting State
  let sortColumn = 'rank_branch';
  let sortDirection = 'asc';
  
  let selectedDivision = 'all';
  let selectedSchool = 'all';
  let selectedTier = 'all';
  let attemptMode = 'new';
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
  function initSchoolDropdown() {
    const schools = Array.from(new Set(rawData.map(d => d.school_en))).filter(Boolean).sort();
    schoolFilter.innerHTML = '<option value="all">All STEM Schools (جميع المدارس)</option>';
    schools.forEach(sch => {
      const opt = document.createElement('option');
      opt.value = sch;
      opt.textContent = sch;
      schoolFilter.appendChild(opt);
    });
  }

  // Dynamically recalculate & populate Tier Dropdown (الشرايح) based on current Division & Attempt
  function updateTierDropdown() {
    const activeDivision = selectedDivision;
    const subset = rawData.filter(d => {
      if (activeDivision !== 'all' && d.division.toLowerCase() !== activeDivision) return false;
      return true;
    });

    const tiersMap = {};
    subset.forEach(d => {
      const tNum = (attemptMode === 'old') ? d.tier_old : d.tier_new;
      const gpaVal = (attemptMode === 'old') ? d.gpa_old : d.gpa_new;
      
      if (!tiersMap[tNum]) {
        tiersMap[tNum] = { number: tNum, gpa: gpaVal, count: 0 };
      }
      tiersMap[tNum].count++;
    });

    const sortedTiers = Object.values(tiersMap).sort((a, b) => a.number - b.number);
    const currentVal = tierFilter.value;
    tierFilter.innerHTML = '<option value="all">All Tiers (جميع الشرايح)</option>';

    sortedTiers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.number.toString();
      opt.textContent = `الشريحة ${t.number} (GPA ${t.gpa.toFixed(2)} — ${t.count} طالب/طالبة)`;
      tierFilter.appendChild(opt);
    });

    if (currentVal && Array.from(tierFilter.options).some(o => o.value === currentVal)) {
      tierFilter.value = currentVal;
    } else {
      tierFilter.value = 'all';
      selectedTier = 'all';
    }
  }

  // Populate Stats Summary
  function updateStats() {
    totalCountEl.textContent = rawData.length.toLocaleString();
    const isOld = (attemptMode === 'old');
    const perfectCount = rawData.filter(d => (isOld ? d.gpa_old : d.gpa_new) === 4.0).length;
    perfectGpaEl.textContent = `${perfectCount} (${((perfectCount / rawData.length) * 100).toFixed(1)}%)`;
    
    const uniqueTiers = new Set(rawData.map(d => isOld ? d.tier_old : d.tier_new)).size;
    tiersCountEl.textContent = `${uniqueTiers} شرايح`;
    
    scienceCountEl.textContent = rawData.filter(d => d.division.toUpperCase() === 'SCIENCE').length.toLocaleString();
    mathCountEl.textContent = rawData.filter(d => d.division.toUpperCase() === 'MATH').length.toLocaleString();
  }

  // Populate Top 3 Leaderboard Podium
  function renderPodium() {
    const podiumGrid = document.getElementById('topPodiumGrid');
    if (!podiumGrid) return;
    
    const isOld = (attemptMode === 'old');
    const top3 = [...rawData].sort((a, b) => {
      const gpaA = isOld ? a.gpa_old : a.gpa_new;
      const gpaB = isOld ? b.gpa_old : b.gpa_new;
      const pctA = isOld ? a.percentage_old : a.percentage_new;
      const pctB = isOld ? b.percentage_old : b.percentage_new;
      return gpaB - gpaA || pctB - pctA;
    }).slice(0, 3);

    const badgeClasses = ['gold', 'silver', 'bronze'];
    const rankLabels = ['#1', '#2', '#3'];

    podiumGrid.innerHTML = top3.map((st, i) => {
      const gpaVal = isOld ? st.gpa_old : st.gpa_new;
      const pctVal = isOld ? st.percentage_old : st.percentage_new;
      const flexVal = isOld ? st.flexible_pct_old : st.flexible_pct_new;
      const tierVal = isOld ? st.tier_old : st.tier_new;

      return `
        <div class="podium-card ${badgeClasses[i]}">
          <div class="podium-rank-badge">${rankLabels[i]}</div>
          <div class="podium-name">${st.name_en}</div>
          <div class="podium-school">${st.school_en} • ${st.division}</div>
          <div style="margin-bottom: 10px;"><span class="tier-badge">الشريحة ${tierVal}</span></div>
          <div class="podium-scores">
            <div class="score-tag gpa">GPA ${gpaVal.toFixed(2)}</div>
            <div class="score-tag pct">${pctVal.toFixed(2)}%</div>
            <div class="score-tag flex">مرنة: ${flexVal.toFixed(2)}%</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Helper to extract course grade points
  function getSubjectPoints(student, subjectName) {
    if (!student.courses_new) return 0.0;
    for (const [key, val] of Object.entries(student.courses_new)) {
      if (key.toLowerCase().includes(subjectName.toLowerCase())) {
        return val.points || 0.0;
      }
    }
    return 0.0;
  }

  // Filter & Sort Logic
  function applyFilters() {
    updateTierDropdown();

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
      const currentItemTier = (attemptMode === 'old') ? item.tier_old : item.tier_new;
      if (selectedTier !== 'all' && currentItemTier.toString() !== selectedTier) {
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

    // Universal Sorting
    filteredData.sort((a, b) => {
      const isOld = (attemptMode === 'old');
      
      let valA, valB;
      
      switch (sortColumn) {
        case 'rank_branch':
          valA = isOld ? (a.rank_old || 9999) : a.rank_branch_new;
          valB = isOld ? (b.rank_old || 9999) : b.rank_branch_new;
          break;
        case 'rank_overall':
          valA = a.rank_overall_new;
          valB = b.rank_overall_new;
          break;
        case 'rank_school':
          valA = a.rank_school_new;
          valB = b.rank_school_new;
          break;
        case 'tier':
          valA = isOld ? a.tier_old : a.tier_new;
          valB = isOld ? b.tier_old : b.tier_new;
          break;
        case 'name':
          valA = a.name_en.toLowerCase();
          valB = b.name_en.toLowerCase();
          break;
        case 'seat':
          valA = a.seat_no;
          valB = b.seat_no;
          break;
        case 'division':
          valA = a.division;
          valB = b.division;
          break;
        case 'school':
          valA = a.school_en;
          valB = b.school_en;
          break;
        case 'gpa':
          valA = isOld ? a.gpa_old : a.gpa_new;
          valB = isOld ? b.gpa_old : b.gpa_new;
          break;
        case 'percentage':
          valA = isOld ? a.percentage_old : a.percentage_new;
          valB = isOld ? b.percentage_old : b.percentage_new;
          break;
        case 'flex_pct':
          valA = isOld ? a.flexible_pct_old : a.flexible_pct_new;
          valB = isOld ? b.flexible_pct_old : b.flexible_pct_new;
          break;
        case 'gpa_diff':
          valA = a.gpa_diff || 0;
          valB = b.gpa_diff || 0;
          break;
        case 'physics':
          valA = getSubjectPoints(a, 'physics');
          valB = getSubjectPoints(b, 'physics');
          break;
        case 'chemistry':
          valA = getSubjectPoints(a, 'chemistry');
          valB = getSubjectPoints(b, 'chemistry');
          break;
        case 'biology_geology':
          valA = Math.max(getSubjectPoints(a, 'biology'), getSubjectPoints(a, 'geology'));
          valB = Math.max(getSubjectPoints(b, 'biology'), getSubjectPoints(b, 'geology'));
          break;
        case 'pure_math':
          valA = Math.max(getSubjectPoints(a, 'pure math'), getSubjectPoints(a, 'applied math'));
          valB = Math.max(getSubjectPoints(b, 'pure math'), getSubjectPoints(b, 'applied math'));
          break;
        case 'english':
          valA = getSubjectPoints(a, 'english');
          valB = getSubjectPoints(b, 'english');
          break;
        case 'arabic':
          valA = getSubjectPoints(a, 'arabic');
          valB = getSubjectPoints(b, 'arabic');
          break;
        case 'second_lang':
          valA = Math.max(getSubjectPoints(a, 'french'), getSubjectPoints(a, 'german'));
          valB = Math.max(getSubjectPoints(b, 'french'), getSubjectPoints(b, 'german'));
          break;
        default:
          valA = a.rank_branch_new;
          valB = b.rank_branch_new;
      }

      let res = 0;
      if (typeof valA === 'string') {
        res = valA.localeCompare(valB);
      } else {
        res = valA - valB;
      }

      return sortDirection === 'asc' ? res : -res;
    });

    currentPage = 1;
    renderTable();
    updateTableHeadersUI();
  }

  // Update visual sort arrows on table headers
  function updateTableHeadersUI() {
    const headers = document.querySelectorAll('.results-table th[data-sort]');
    headers.forEach(th => {
      const col = th.getAttribute('data-sort');
      const arrowSpan = th.querySelector('.sort-arrow');
      if (col === sortColumn) {
        th.classList.add('sorted');
        if (arrowSpan) arrowSpan.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
      } else {
        th.classList.remove('sorted');
        if (arrowSpan) arrowSpan.textContent = ' ↕';
      }
    });
  }

  // Toggle Column Header Sorting
  window.handleHeaderSort = function(colName) {
    if (sortColumn === colName) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = colName;
      if (['gpa', 'percentage', 'flex_pct', 'gpa_diff', 'physics', 'chemistry', 'biology_geology', 'pure_math', 'english', 'arabic', 'second_lang'].includes(colName)) {
        sortDirection = 'desc';
      } else {
        sortDirection = 'asc';
      }
    }
    
    if (sortSelect) {
      if (colName === 'rank_branch') sortSelect.value = 'branch_rank';
      else if (colName === 'rank_overall') sortSelect.value = 'overall_rank';
      else if (colName === 'tier') sortSelect.value = 'tier_asc';
      else if (colName === 'flex_pct') sortSelect.value = 'flex_desc';
      else if (colName === 'school_rank') sortSelect.value = 'school_rank';
      else if (colName === 'gpa' && sortDirection === 'desc') sortSelect.value = 'gpa_desc';
      else if (colName === 'seat' && sortDirection === 'asc') sortSelect.value = 'seat_asc';
      else if (colName === 'seat' && sortDirection === 'desc') sortSelect.value = 'seat_desc';
      else if (colName === 'name' && sortDirection === 'asc') sortSelect.value = 'name_asc';
    }

    applyFilters();
  };

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
      const isOld = (attemptMode === 'old');
      
      // Rank Display:
      // If Division filter is "all", show overall rank or branch rank with division tag (Sci/Math)
      let rankVal, rankBadgeLabel, rankBadgeClass;
      if (sortColumn === 'rank_overall') {
        rankVal = st.rank_overall_new;
        rankBadgeLabel = `#${rankVal}`;
      } else if (sortColumn === 'rank_school') {
        rankVal = st.rank_school_new;
        rankBadgeLabel = `#${rankVal} (${st.school_en.split(' ')[0]})`;
      } else {
        // Branch Rank
        rankVal = isOld ? (st.rank_old || st.rank_branch_new) : st.rank_branch_new;
        const divShort = st.division.toUpperCase() === 'SCIENCE' ? 'Sci' : 'Math';
        rankBadgeLabel = selectedDivision === 'all' ? `#${rankVal} ${divShort}` : `#${rankVal}`;
      }

      rankBadgeClass = rankVal === 1 ? 'top-1' : rankVal === 2 ? 'top-2' : rankVal === 3 ? 'top-3' : '';
      const divClass = st.division.toLowerCase() === 'science' ? 'science' : 'math';
      const tierVal = isOld ? st.tier_old : st.tier_new;
      
      let gpaDisplay = '';
      let pctDisplay = '';
      let flexDisplay = '';

      if (attemptMode === 'new') {
        gpaDisplay = `<span class="gpa-pill ${st.gpa_new === 4.0 ? 'perfect' : ''}">${st.gpa_new.toFixed(2)}</span>`;
        pctDisplay = `${st.percentage_new.toFixed(2)}%`;
        flexDisplay = `<span class="flex-pct-badge">${st.flexible_pct_new.toFixed(2)}%</span>`;
      } else if (attemptMode === 'old') {
        gpaDisplay = `<span class="gpa-pill">${st.gpa_old.toFixed(2)}</span>`;
        pctDisplay = `${st.percentage_old.toFixed(2)}%`;
        flexDisplay = `<span class="flex-pct-badge">${st.flexible_pct_old.toFixed(2)}%</span>`;
      } else {
        // Compare Both
        const diffGpa = st.gpa_diff || 0;
        const diffTag = diffGpa > 0 ? `<span style="color:var(--success); font-weight:700; font-size:11px;">(+${diffGpa.toFixed(2)})</span>` : `<span style="color:var(--text-muted); font-size:11px;">(0.00)</span>`;
        gpaDisplay = `<div style="font-size:13px;">الفرصة 1: ${st.gpa_old.toFixed(2)} → الفرصة 2: <strong>${st.gpa_new.toFixed(2)}</strong> ${diffTag}</div>`;
        pctDisplay = `${st.percentage_new.toFixed(2)}%`;
        flexDisplay = `<span class="flex-pct-badge">${st.flexible_pct_new.toFixed(2)}%</span>`;
      }

      return `
        <tr onclick="openStudentModal(${st.seat_no})">
          <td>
            <span class="rank-tag ${rankBadgeClass}" style="min-width: 48px; border-radius: 20px; padding: 2px 8px; font-size: 13px;">${rankBadgeLabel}</span>
          </td>
          <td>
            <span class="tier-badge">الشريحة ${tierVal}</span>
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
    if (student.courses_new && Object.keys(student.courses_new).length > 0) {
      coursesHtml = Object.entries(student.courses_new).map(([course, data]) => {
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
    if (student.additional_courses_new && Object.keys(student.additional_courses_new).length > 0) {
      addCoursesHtml = Object.entries(student.additional_courses_new).map(([course, res]) => `
        <tr>
          <td>${course}</td>
          <td><span style="color: var(--success); font-weight:700;">${res}</span></td>
        </tr>
      `).join('');
    }

    const gpaDiff = student.gpa_diff || 0;
    const diffBadge = gpaDiff > 0 ? `<span style="color:var(--success); font-size:13px; font-weight:700;"> (+${gpaDiff.toFixed(2)} GPA Improvement)</span>` : '';

    modalBody.innerHTML = `
      <div class="modal-student-header">
        <div class="modal-student-name">${student.name_en}</div>
        <div style="margin-bottom: 12px;">
          <span class="division-badge ${divClass}">${student.division} DIVISION</span>
          <span class="tier-badge" style="margin-left:8px;">الشريحة ${student.tier_new}</span>
          <span style="color: var(--text-muted); font-size: 14px; margin-left: 10px;">Seat No: <strong>${student.seat_no}</strong></span>
        </div>
        <div class="modal-badges">
          <div class="rank-chip">Branch Rank (${student.division}): <strong>#${student.rank_branch_new}</strong></div>
          <div class="rank-chip">National Rank (Egypt All STEM): <strong>#${student.rank_overall_new}</strong></div>
          <div class="rank-chip">School Rank: <strong>#${student.rank_school_new}</strong></div>
          ${student.rank_old ? `<div class="rank-chip">First Trial Rank (الفرصة الأولى): <strong>#${student.rank_old}</strong></div>` : ''}
        </div>
      </div>

      <div class="modal-summary-box">
        <div class="summary-item">
          <h4>${student.gpa_new.toFixed(2)}${diffBadge}</h4>
          <p>GPA (بعد التحسين - الفرصة الثانية)</p>
        </div>
        <div class="summary-item">
          <h4>${student.percentage_new.toFixed(2)}%</h4>
          <p>المجموع الكلي الأصلي</p>
        </div>
        <div class="summary-item">
          <h4 style="color: #34d399;">${student.flexible_pct_new.toFixed(2)}%</h4>
          <p>النسبة المرنة (المجموع x 1.25)</p>
        </div>
        <div class="summary-item">
          <h4 style="font-size: 16px; color: var(--info);">${student.school_en}</h4>
          <p>STEM Institution</p>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-top: 16px; font-size: 13px; text-align: center;">
        <strong>Attempt Comparison (مقارنة الفرصتين):</strong><br>
        • الفرصة الأولى (قبل التحسين - PDF): <strong>${student.gpa_old.toFixed(2)} GPA (${student.percentage_old.toFixed(2)}%)</strong> — الشريحة ${student.tier_old}<br>
        • الفرصة الثانية (بعد التحسين - Web): <strong>${student.gpa_new.toFixed(2)} GPA (${student.percentage_new.toFixed(2)}%)</strong> — الشريحة ${student.tier_new}
      </div>

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
    const val = e.target.value;
    if (val === 'branch_rank') { sortColumn = 'rank_branch'; sortDirection = 'asc'; }
    else if (val === 'overall_rank') { sortColumn = 'rank_overall'; sortDirection = 'asc'; }
    else if (val === 'tier_asc') { sortColumn = 'tier'; sortDirection = 'asc'; }
    else if (val === 'flex_desc') { sortColumn = 'flex_pct'; sortDirection = 'desc'; }
    else if (val === 'school_rank') { sortColumn = 'rank_school'; sortDirection = 'asc'; }
    else if (val === 'gpa_desc') { sortColumn = 'gpa'; sortDirection = 'desc'; }
    else if (val === 'seat_asc') { sortColumn = 'seat'; sortDirection = 'asc'; }
    else if (val === 'seat_desc') { sortColumn = 'seat'; sortDirection = 'desc'; }
    else if (val === 'name_asc') { sortColumn = 'name'; sortDirection = 'asc'; }
    else if (val === 'gpa_diff') { sortColumn = 'gpa_diff'; sortDirection = 'desc'; }
    else if (val === 'physics') { sortColumn = 'physics'; sortDirection = 'desc'; }
    else if (val === 'chemistry') { sortColumn = 'chemistry'; sortDirection = 'desc'; }
    else if (val === 'biology_geology') { sortColumn = 'biology_geology'; sortDirection = 'desc'; }
    else if (val === 'pure_math') { sortColumn = 'pure_math'; sortDirection = 'desc'; }
    else if (val === 'english') { sortColumn = 'english'; sortDirection = 'desc'; }
    else if (val === 'arabic') { sortColumn = 'arabic'; sortDirection = 'desc'; }
    
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
      updateStats();
      renderPodium();
      applyFilters();
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
  initSchoolDropdown();
  updateStats();
  renderPodium();
  applyFilters();
});
