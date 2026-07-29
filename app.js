document.addEventListener('DOMContentLoaded', () => {
  const rawData = window.STEM_DATA || [];
  
  // State
  let filteredData = [...rawData];
  let currentPage = 1;
  let pageSize = 50;
  let currentSort = 'branch_rank'; // branch_rank, overall_rank, school_rank, gpa_desc, gpa_asc, seat_asc, seat_desc, name_asc
  let selectedDivision = 'all'; // all, science, math
  let selectedSchool = 'all';
  let selectedTier = 'all';
  let searchQuery = '';

  // Elements
  const totalCountEl = document.getElementById('statTotalCount');
  const perfectGpaEl = document.getElementById('statPerfectGpa');
  const scienceCountEl = document.getElementById('statScienceCount');
  const mathCountEl = document.getElementById('statMathCount');
  
  const searchInput = document.getElementById('searchInput');
  const schoolFilter = document.getElementById('schoolFilter');
  const tierFilter = document.getElementById('tierFilter');
  const sortSelect = document.getElementById('sortSelect');
  const divisionPills = document.querySelectorAll('.pill-btn');
  
  const tbody = document.getElementById('resultsTbody');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  const modalBackdrop = document.getElementById('studentModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalBody = document.getElementById('modalBody');

  // Populate Schools Filter Dropdown
  function initSchoolDropdown() {
    const schools = setOfSchools(rawData);
    schools.sort();
    schools.forEach(sch => {
      const opt = document.createElement('option');
      opt.value = sch;
      opt.textContent = sch;
      schoolFilter.appendChild(opt);
    });
  }

  function setOfSchools(data) {
    const s = new Set();
    data.forEach(d => { if (d.school_en) s.add(d.school_en); });
    return Array.from(s);
  }

  // Populate Stats Summary
  function updateStats() {
    totalCountEl.textContent = rawData.length.toLocaleString();
    const perfectCount = rawData.filter(d => d.gpa === 4.0).length;
    perfectGpaEl.textContent = `${perfectCount} (${((perfectCount / rawData.length) * 100).toFixed(1)}%)`;
    scienceCountEl.textContent = rawData.filter(d => d.division.toUpperCase() === 'SCIENCE').length.toLocaleString();
    mathCountEl.textContent = rawData.filter(d => d.division.toUpperCase() === 'MATH').length.toLocaleString();
  }

  // Populate Top 3 Leaderboard Podium
  function renderPodium() {
    const podiumGrid = document.getElementById('topPodiumGrid');
    if (!podiumGrid) return;
    
    // Top 3 Overall
    const top3 = [...rawData].sort((a, b) => b.gpa - a.gpa || b.percentage - a.percentage).slice(0, 3);
    const badgeClasses = ['gold', 'silver', 'bronze'];
    const rankLabels = ['#1', '#2', '#3'];

    podiumGrid.innerHTML = top3.map((st, i) => `
      <div class="podium-card ${badgeClasses[i]}">
        <div class="podium-rank-badge">${rankLabels[i]}</div>
        <div class="podium-name">${st.name_en}</div>
        <div class="podium-school">${st.school_en} • ${st.division}</div>
        <div class="podium-scores">
          <div class="score-tag gpa">GPA ${st.gpa.toFixed(2)}</div>
          <div class="score-tag pct">${st.percentage.toFixed(2)}%</div>
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
      // Tier
      if (selectedTier === '4.00' && item.gpa !== 4.0) return false;
      if (selectedTier === '3.80-3.99' && (item.gpa < 3.8 || item.gpa >= 4.0)) return false;
      if (selectedTier === '3.50-3.79' && (item.gpa < 3.5 || item.gpa >= 3.8)) return false;
      if (selectedTier === 'under-3.50' && item.gpa >= 3.5) return false;

      // Search Query (Name, Seat Number)
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
        case 'school_rank':
          return a.rank_school - b.rank_school;
        case 'gpa_desc':
          return b.gpa - a.gpa || b.percentage - a.percentage || a.seat_no - b.seat_no;
        case 'gpa_asc':
          return a.gpa - b.gpa || a.percentage - b.percentage || a.seat_no - b.seat_no;
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
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No student results found matching your search and filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageItems.map(st => {
      const isTop3 = st.rank_branch <= 3;
      const rankBadgeClass = st.rank_branch === 1 ? 'top-1' : st.rank_branch === 2 ? 'top-2' : st.rank_branch === 3 ? 'top-3' : '';
      const divClass = st.division.toLowerCase() === 'science' ? 'science' : 'math';
      const gpaClass = st.gpa === 4.0 ? 'perfect' : '';

      return `
        <tr onclick="openStudentModal(${st.seat_no})">
          <td>
            <span class="rank-tag ${rankBadgeClass}">#${st.rank_branch}</span>
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
            <span class="gpa-pill ${gpaClass}">${st.gpa.toFixed(2)}</span>
            <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">(${st.percentage.toFixed(2)}%)</span>
          </td>
          <td>
            <span style="color: var(--success); font-size: 12px; font-weight: 600;">✓ Pass</span>
          </td>
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

    // Courses HTML
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

    // Additional courses HTML
    let addCoursesHtml = '';
    if (student.additional_courses && Object.keys(student.additional_courses).length > 0) {
      addCoursesHtml = Object.entries(student.additional_courses).map(([course, res]) => `
        <tr>
          <td>${course}</td>
          <td><span style="color: var(--success); font-weight:700;">${res}</span></td>
        </tr>
      `).join('');
    }

    modalBody.innerHTML = `
      <div class="modal-student-header">
        <div class="modal-student-name">${student.name_en}</div>
        <div style="margin-bottom: 12px;">
          <span class="division-badge ${divClass}">${student.division} DIVISION</span>
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
          <h4>${student.gpa.toFixed(2)}</h4>
          <p>Total GPA (Out of 4.00)</p>
        </div>
        <div class="summary-item">
          <h4>${student.percentage.toFixed(3)}%</h4>
          <p>Equivalent Percentage</p>
        </div>
        <div class="summary-item">
          <h4 style="font-size: 18px; color: var(--info);">${student.school_en}</h4>
          <p>STEM Institution</p>
        </div>
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
          🖨️ Print Student Result Transcript
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
