// Standalone Public Student Details Submission Logic
(function () {
  'use strict';

  const STORAGE_KEY = 'registerly_public_submission_id';
  let nextRollByClass = {};
  let uploadedPhotoUrl = '';

  function showFormError(msg) {
    const box = document.getElementById('pub-form-error');
    const txt = document.getElementById('pub-form-error-text');
    if (!box || !txt) return;
    if (!msg) {
      box.classList.add('hidden');
      txt.textContent = '';
    } else {
      txt.textContent = msg;
      box.classList.remove('hidden');
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function renderStatusView(data) {
    const statusSec = document.getElementById('pub-status-section');
    const formSec = document.getElementById('pub-form-section');
    const iconWrap = document.getElementById('pub-status-icon-wrap');
    const badge = document.getElementById('pub-status-badge');
    const title = document.getElementById('pub-status-title');
    const message = document.getElementById('pub-status-message');
    const btnResubmit = document.getElementById('pub-btn-resubmit');

    if (formSec) formSec.classList.add('hidden');
    if (statusSec) statusSec.classList.remove('hidden');

    const status = (data && data.status) || 'pending';
    const nameEl = document.getElementById('pub-sum-name');
    const clsEl = document.getElementById('pub-sum-class');
    const rollEl = document.getElementById('pub-sum-roll');
    if (nameEl) nameEl.textContent = data.name || '-';
    if (clsEl) clsEl.textContent = data.class || '-';
    if (rollEl) rollEl.textContent = data.roll ? `#${data.roll}` : 'Pending';

    if (status === 'approved') {
      iconWrap.className = 'w-16 h-16 mx-auto rounded-3xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center';
      iconWrap.innerHTML = '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      badge.className = 'inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
      badge.textContent = 'Approved';
      title.textContent = 'Enrollment Approved';
      message.textContent = `You have been successfully added to ${data.class || 'your class'}${data.roll ? ` (Roll No. #${data.roll})` : ''}.`;
      if (btnResubmit) btnResubmit.classList.add('hidden');
    } else if (status === 'rejected') {
      iconWrap.className = 'w-16 h-16 mx-auto rounded-3xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center';
      iconWrap.innerHTML = '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      badge.className = 'inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300';
      badge.textContent = 'Not Approved';
      title.textContent = 'Submission Not Approved';
      message.textContent = 'Your registration request could not be approved. Please verify that all details are accurate and submit again.';
      if (btnResubmit) btnResubmit.classList.remove('hidden');
    } else {
      iconWrap.className = 'w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center';
      iconWrap.innerHTML = '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
      badge.className = 'inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300';
      badge.textContent = 'Pending Review';
      title.textContent = 'Submission Pending Review';
      message.textContent = 'Your details have been received and are awaiting teacher verification. Please check back shortly.';
      if (btnResubmit) btnResubmit.classList.add('hidden');
    }
  }

  async function refreshPublicSubmissionStatus() {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) return false;
    try {
      const res = await fetch(`/api/students/public-submit-status/${encodeURIComponent(savedId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        renderStatusView(json.data);
        return true;
      }
    } catch (err) {
      console.warn('[Status Check Error]', err);
    }
    return false;
  }

  function startNewPublicSubmission() {
    localStorage.removeItem(STORAGE_KEY);
    const statusSec = document.getElementById('pub-status-section');
    const formSec = document.getElementById('pub-form-section');
    if (statusSec) statusSec.classList.add('hidden');
    if (formSec) formSec.classList.remove('hidden');
    showFormError('');
  }

  async function handlePublicClassChange() {
    const cls = document.getElementById('pub-class')?.value?.trim() || '';
    const rollInput = document.getElementById('pub-roll');

    const lower = cls.toLowerCase();
    const wrapStream = document.getElementById('pub-wrap-stream');
    const wrapDeg = document.getElementById('pub-wrap-degreeYear');
    if (wrapStream) wrapStream.classList.toggle('hidden', !(lower.includes('plus') || lower.includes('+1') || lower.includes('+2')));
    if (wrapDeg) wrapDeg.classList.toggle('hidden', !lower.includes('degree'));

    if (!rollInput) return;
    if (!cls) {
      rollInput.value = '';
      rollInput.placeholder = 'Select class';
      return;
    }

    // Show cached next roll immediately while fetching live next roll from server
    if (nextRollByClass[cls]) {
      rollInput.value = String(nextRollByClass[cls]);
    } else {
      rollInput.value = '';
      rollInput.placeholder = 'Calculating...';
    }

    try {
      const res = await fetch(`/api/students/public-next-roll?class=${encodeURIComponent(cls)}`);
      const json = await res.json();
      if (json && json.success && Number.isFinite(Number(json.nextRoll))) {
        nextRollByClass[cls] = Number(json.nextRoll);
        // Only apply if user hasn't switched to another class mid-request
        const currentCls = document.getElementById('pub-class')?.value?.trim() || '';
        if (currentCls === cls) {
          rollInput.value = String(json.nextRoll);
        }
      }
    } catch (err) {
      console.warn('[Public Next Roll Lookup Error]', err);
      if (!rollInput.value && nextRollByClass[cls]) {
        rollInput.value = String(nextRollByClass[cls]);
      }
    }
  }

  function handlePublicDobChange() {
    const dob = document.getElementById('pub-dob')?.value;
    const ageEl = document.getElementById('pub-age');
    if (!ageEl) return;
    if (!dob) {
      ageEl.value = '';
      return;
    }
    const b = new Date(dob);
    if (isNaN(b.getTime())) return;
    const n = new Date();
    let age = n.getFullYear() - b.getFullYear();
    if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) age--;
    ageEl.value = age >= 0 ? `${age} years` : '';
  }

  function handlePublicGuardianChange() {
    const val = document.getElementById('pub-guardian')?.value || '';
    const box = document.getElementById('pub-guardian-other-box');
    if (box) box.classList.toggle('hidden', val !== 'Other');
  }

  async function handlePublicPhotoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('pub-photo-status');
    const previewEl = document.getElementById('pub-photo-preview');
    if (statusEl) statusEl.textContent = 'Uploading photo...';

    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch('/api/upload/public-student-photo', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Photo upload failed');
      }
      uploadedPhotoUrl = json.url;
      if (previewEl) previewEl.src = json.url;
      if (statusEl) statusEl.textContent = 'Photo uploaded successfully.';
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || 'Could not upload photo.';
    }
  }

  async function handlePublicStudentSubmit(event) {
    event.preventDefault();
    showFormError('');

    const name = document.getElementById('pub-name')?.value?.trim() || '';
    const cls = document.getElementById('pub-class')?.value?.trim() || '';
    if (!name) return showFormError('Please enter your Full Name.');
    if (!cls) return showFormError('Please select your Class.');

    const genderEl = document.querySelector('input[name="pub-gender"]:checked');
    const payload = {
      name,
      class: cls,
      photoUrl: uploadedPhotoUrl || undefined,
      personalDetails: {
        dob: document.getElementById('pub-dob')?.value || '',
        gender: genderEl ? genderEl.value : 'Male',
        bloodGroup: document.getElementById('pub-bloodGroup')?.value || '',
        studentEmail: document.getElementById('pub-studentEmail')?.value?.trim() || ''
      },
      address: {
        fullAddress: document.getElementById('pub-fullAddress')?.value?.trim() || '',
        place: document.getElementById('pub-place')?.value?.trim() || '',
        district: document.getElementById('pub-district')?.value?.trim() || '',
        state: document.getElementById('pub-state')?.value?.trim() || '',
        pinCode: document.getElementById('pub-pinCode')?.value?.trim() || ''
      },
      familyDetails: {
        fatherName: document.getElementById('pub-fatherName')?.value?.trim() || '',
        motherName: document.getElementById('pub-motherName')?.value?.trim() || '',
        fatherMobile: document.getElementById('pub-fatherMobile')?.value?.trim() || '',
        motherNumber: document.getElementById('pub-motherNumber')?.value?.trim() || '',
        guardian: document.getElementById('pub-guardian')?.value || '',
        guardianOccupation: document.getElementById('pub-guardianOccupation')?.value?.trim() || '',
        guardianName: document.getElementById('pub-guardianName')?.value?.trim() || '',
        guardianNumber: document.getElementById('pub-guardianNumber')?.value?.trim() || '',
        guardianRelation: document.getElementById('pub-guardianRelation')?.value?.trim() || ''
      },
      academicStatus: {
        admissionNo: document.getElementById('pub-admissionNo')?.value?.trim() || '',
        admissionDate: document.getElementById('pub-admissionDate')?.value || '',
        rank: document.getElementById('pub-rank')?.value?.trim() || '',
        previousCollege: document.getElementById('pub-previousCollege')?.value?.trim() || '',
        stream: document.getElementById('pub-stream')?.value?.trim() || '',
        degreeYear: document.getElementById('pub-degreeYear')?.value?.trim() || ''
      }
    };

    const btn = document.getElementById('pub-submit-btn');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Submitting...</span>';
    }

    try {
      const res = await fetch('/api/students/public-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Submission failed. Please check your inputs.');
      }

      if (json.data && json.data.submissionId) {
        localStorage.setItem(STORAGE_KEY, json.data.submissionId);
      }
      renderStatusView(json.data || { status: 'pending', name, class: cls });
    } catch (err) {
      showFormError(err.message || 'Could not submit form. Please try again.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  async function initPublicSubmitPage() {
    try {
      const res = await fetch('/api/students/public-submit-meta');
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        const appEl = document.getElementById('pub-app-name');
        const schEl = document.getElementById('pub-school-name');
        const yrEl = document.getElementById('pub-year-pill');
        if (appEl && d.appName) appEl.textContent = d.appName;
        if (schEl && d.schoolName) schEl.textContent = d.schoolName;
        if (yrEl && d.currentAcademicYear) {
          yrEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-300"></span><span>${d.currentAcademicYear}</span>`;
        }

        nextRollByClass = d.nextRollByClass || {};
        const select = document.getElementById('pub-class');
        if (select) {
          select.innerHTML = '<option value="">Select Class</option>' +
            (d.classes || []).map(c => `<option value="${c.replace(/"/g, '&quot;')}">${c}</option>`).join('');
        }
      }
    } catch (err) {
      showFormError('Unable to load class list. Please refresh the page.');
    }

    await refreshPublicSubmissionStatus();
  }

  window.handlePublicClassChange = handlePublicClassChange;
  window.handlePublicDobChange = handlePublicDobChange;
  window.handlePublicGuardianChange = handlePublicGuardianChange;
  window.handlePublicPhotoUpload = handlePublicPhotoUpload;
  window.handlePublicStudentSubmit = handlePublicStudentSubmit;
  window.refreshPublicSubmissionStatus = refreshPublicSubmissionStatus;
  window.startNewPublicSubmission = startNewPublicSubmission;

  document.addEventListener('DOMContentLoaded', initPublicSubmitPage);
})();
