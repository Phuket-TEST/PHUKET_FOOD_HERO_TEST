// --- Helper function for authenticated API calls ---
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        ...options.headers // รวม headers เดิม
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
        alert('เซสชันหมดอายุหรือไม่มีสิทธิ์ กรุณาเข้าสู่ระบบใหม่');
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        loadMainPage(); // Redirect to main page/login
        throw new Error('Unauthorized or Forbidden'); // Throw error to stop further execution
    }

    return response;
}

// --- Helper function to handle user login/registration ---
async function handleAuthSubmission(email, password, role, additionalData = {}) {
    const authData = { email, password, role, ...additionalData };
    let response;
    let result;

    try {
        // Attempt to register first
        // TODO: Update to your Render.com Backend URL
        response = await authenticatedFetch('https://phuket-food-hero-api.onrender.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(authData)
        });

        result = await response.json();

        if (response.ok) {
            // Registration successful
            localStorage.setItem('token', result.token);
            localStorage.setItem('userRole', result.role);
            localStorage.setItem('userId', result._id);
            alert('ลงทะเบียนและเข้าสู่ระบบสำเร็จ!');
            if (result.role === 'school') {
                loadSchoolDashboard();
            } else if (result.role === 'farmer') {
                loadFarmerDashboard();
            }
            return; // Exit function
        } else if (response.status === 400 && result.msg === 'User นี้ลงทะเบียนแล้ว') {
            // User already registered, attempt to log in
            console.log('User already registered, attempting login...');
            // TODO: Update to your Render.com Backend URL
            response = await authenticatedFetch('https://phuket-food-hero-api.onrender.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }) // Only email and password for login
            });
            result = await response.json();

            if (response.ok) {
                // Login successful
                localStorage.setItem('token', result.token);
                localStorage.setItem('userRole', result.role);
                localStorage.setItem('userId', result._id);
                alert('เข้าสู่ระบบสำเร็จ!');
                if (result.role === 'school') {
                    loadSchoolDashboard();
                } else if (result.role === 'farmer') {
                    loadFarmerDashboard();
                }
                return; // Exit function
            } else {
                // Login failed after registration attempt
                alert('เข้าสู่ระบบล้มเหลว: ' + (result.msg || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
            }
        } else {
            // Other registration error
            alert('ลงทะเบียนไม่สำเร็จ: ' + (result.msg || 'เกิดข้อผิดพลาด'));
        }

    } catch (error) {
        console.error('Authentication Error:', error);
        if (error.message !== 'Unauthorized or Forbidden') {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        }
    }
}

// --- Helper function for generic login attempt ---
async function genericLoginAttempt(email, password) {
    try {
        // TODO: Update to your Render.com Backend URL
        const response = await authenticatedFetch('https://phuket-food-hero-api.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('userRole', result.role);
            localStorage.setItem('userId', result._id);
            alert('เข้าสู่ระบบสำเร็จ!');
            if (result.role === 'school') {
                loadSchoolDashboard();
            } else if (result.role === 'farmer') {
                loadFarmerDashboard();
            }
        } else {
            alert('เข้าสู่ระบบล้มเหลว: ' + (result.msg || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
        }
    } catch (error) {
        console.error('Generic Login Error:', error);
        if (error.message !== 'Unauthorized or Forbidden') {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        }
    }
}


// --- Helper function to render data blocks dynamically ---
async function renderDataBlocks(data, targetWrapperId) {
    const wrapper = document.querySelector(targetWrapperId);
    if (!wrapper) return;

    wrapper.innerHTML = '';

    if (data.length === 0) {
        wrapper.innerHTML = '<p style="color: #666; text-align: center; margin-top: 30px;">ไม่พบข้อมูล</p>';
        return;
    }

    const userRole = localStorage.getItem('userRole'); // Get current user's role
    const userId = localStorage.getItem('userId'); // Get current user's ID

    // Fetch user's stars for display
    let userStars = 0;
    try {
        // TODO: Implement Backend API to get user profile with stars
        // This API endpoint needs to be created in your Backend (e.g., in routes/auth.js)
        // It should return user data including the 'stars' field.
        const profileResponse = await authenticatedFetch(`https://phuket-food-hero-api.onrender.com/api/auth/profile/${userId}`);
        const profileData = await profileResponse.json();
        userStars = profileData.stars || 0;
    } catch (error) {
        console.error('Failed to fetch user stars:', error);
    }
    // Update star display in sidebar
    const userStarsElement = document.querySelector('.user-stars');
    if (userStarsElement) {
        userStarsElement.textContent = `⭐ ${userStars} ดาว`;
    }


    data.forEach(item => {
        const dataBlock = document.createElement('div');
        dataBlock.classList.add('data-block');
        dataBlock.dataset.id = item._id;

        // Format date
        const date = new Date(item.date).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        dataBlock.innerHTML = `
            <img src="${item.imageUrl || 'https://placehold.co/150x120/ADD8E6/000000?text=No+Image'}" alt="Waste Image" class="data-item-image">
            <div class="data-item-details">
                <p><strong>เมนู:</strong> ${item.menu}</p>
                <p><strong>ปริมาณ:</strong> ${item.weight} kg</p>
                <p><strong>วันที่:</strong> ${date}</p>
                <p><strong>จาก:</strong> ${item.school ? item.school.instituteName : 'ไม่ระบุโรงเรียน'}</p>
                <p><strong>ติดต่อ:</strong> ${item.school ? item.school.contactNumber : 'ไม่ระบุ'}</p>
            </div>
            ${userRole === 'school' && item.school && item.school._id === userId ? `<button class="delete-button" data-id="${item._id}">ลบ</button>` : ''}
            ${userRole === 'farmer' ? `
                <button class="receive-waste-button" data-id="${item._id}">รับเศษอาหาร</button>
                <button class="details-button" data-id="${item._id}">รายละเอียด</button>
                ` : ''}
        `;
        wrapper.appendChild(dataBlock);
    });

    // Attach delete button listeners for school dashboard
    if (userRole === 'school' && targetWrapperId === '#schoolDataBlocks') {
        wrapper.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const wasteId = e.target.dataset.id;
                showConfirmationModal('คุณแน่ใจหรือไม่ที่จะลบข้อมูลนี้?', () => deleteWasteEntry(wasteId));
            });
        });
    }

    // Attach details button listeners for farmer dashboard
    if (userRole === 'farmer' && targetWrapperId === '#farmerDataBlocks') {
        wrapper.querySelectorAll('.details-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const postId = e.target.dataset.id;
                loadPostDetails(postId);
            });
        });
        // Attach receive waste button listeners for farmer dashboard
        wrapper.querySelectorAll('.receive-waste-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const wasteId = e.target.dataset.id;
                showConfirmationModal('คุณต้องการรับเศษอาหารนี้หรือไม่?', () => handleReceiveWaste(wasteId));
            });
        });
    }
}

// --- Custom Confirmation Modal ---
function showConfirmationModal(message, onConfirm) {
    const modalHtml = `
        <div class="custom-modal-overlay" id="confirmationModalOverlay">
            <div class="custom-modal-content">
                <p>${message}</p>
                <div class="modal-buttons">
                    <button id="confirmYes" class="modal-button modal-button-yes">ใช่</button>
                    <button id="confirmNo" class="modal-button modal-button-no">ไม่</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('confirmYes').addEventListener('click', () => {
        onConfirm();
        document.getElementById('confirmationModalOverlay').remove();
    });
    document.getElementById('confirmNo').addEventListener('click', () => {
        document.getElementById('confirmationModalOverlay').remove();
    });
}

// --- Delete Waste Entry Function ---
async function deleteWasteEntry(id) {
    console.log('Frontend attempting to delete ID:', id);
    try {
        // TODO: Update to your Render.com Backend URL
        const response = await authenticatedFetch(`https://phuket-food-hero-api.onrender.com/api/waste/${id}`, {
            method: 'DELETE'
        });

        const contentType = response.headers.get('content-type');
        let result;
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            result = await response.text();
            console.error('Backend responded with non-JSON for delete:', result);
        }

        if (response.ok) {
            alert('ลบข้อมูลสำเร็จ!');
            loadSchoolDashboard();
        } else {
            alert('ลบข้อมูลไม่สำเร็จ: ' + (result.msg || result || 'เกิดข้อผิดพลาดที่ไม่รู้จัก'));
        }
    } catch (error) {
        console.error('Delete Waste Error:', error);
        if (error.message !== 'Unauthorized or Forbidden') {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        }
    }
}

// Handle Receive Waste Function (for Farmer)
async function handleReceiveWaste(wasteId) {
    alert(`รับเศษอาหาร ID: ${wasteId} (ยังไม่ส่งข้อมูลไปยัง Backend)`);
    // TODO: Phase 2 - Implement Backend API to update waste status and farmer's stars
    // Example:
    // try {
    //     const response = await authenticatedFetch(`https://phuket-food-hero-api.onrender.com/api/waste/receive/${wasteId}`, {
    //         method: 'POST'
    //     });
    //     if (response.ok) {
    //         alert('ยืนยันการรับเศษอาหารสำเร็จ!');
    //         loadFarmerDashboard(); // Reload dashboard
    //     } else {
    //         const errorData = await response.json();
    //         alert('ยืนยันการรับเศษอาหารไม่สำเร็จ: ' + (errorData.msg || 'เกิดข้อผิดพลาด'));
    //     }
    // } catch (error) {
    //     console.error('Receive Waste Error:', error);
    //     alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    // }
}


// --- Main Page Loading Function ---
function loadContent(contentHtml) {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = contentHtml;

    // --- Common Event Listeners ---
    if (document.getElementById('backToMain')) {
        document.getElementById('backToMain').addEventListener('click', loadMainPage);
    }
    if (document.getElementById('backToMainFromDashboard')) {
        document.getElementById('backToMainFromDashboard').addEventListener('click', loadMainPage);
    }
    if (document.getElementById('backFromAddWasteData')) {
        document.getElementById('backFromAddWasteData').addEventListener('click', loadSchoolDashboard);
    }
    if (document.getElementById('backFromPostDetails')) {
        document.getElementById('backFromPostDetails').addEventListener('click', loadFarmerDashboard);
    }
    if (document.getElementById('backFromGenericLogin')) {
        document.getElementById('backFromGenericLogin').addEventListener('click', loadMainPage);
    }
    // Event listener for back from analysis page
    if (document.getElementById('backFromAnalysis')) {
        document.getElementById('backFromAnalysis').addEventListener('click', loadSchoolDashboard);
    }
    // Event listener for back from edit profile page
    if (document.getElementById('backFromEditProfile')) {
        document.getElementById('backFromEditProfile').addEventListener('click', loadSchoolDashboard);
    }
    // Event listener for back from knowledge page
    if (document.getElementById('backFromKnowledge')) {
        document.getElementById('backFromKnowledge').addEventListener('click', (event) => {
             // Go back to the dashboard of the current role
            const userRole = localStorage.getItem('userRole');
            if (userRole === 'school') {
                loadSchoolDashboard();
            } else if (userRole === 'farmer') {
                loadFarmerDashboard();
            } else {
                loadMainPage(); // Fallback
            }
        });
    }


    // --- Page Specific Event Listeners ---
    if (document.getElementById('purposeSelect')) {
        document.getElementById('purposeSelect').addEventListener('change', toggleOtherPurposeInput);
    }

    if (document.getElementById('schoolButton')) {
        document.getElementById('schoolButton').addEventListener('click', () => loadContent(getSchoolLoginPageHtml()));
    }
    if (document.getElementById('farmerButton')) {
        document.getElementById('farmerButton').addEventListener('click', () => loadContent(getFarmerLoginPageHtml()));
    }

    // --- Form Submissions ---
    const schoolLoginForm = document.getElementById('schoolLoginForm');
    if (schoolLoginForm) {
        schoolLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(schoolLoginForm);
            const email = formData.get('email');
            const password = formData.get('password');
            const additionalData = {
                instituteName: formData.get('instituteName'),
                address: formData.get('address'),
                contactNumber: formData.get('contactNumber')
            };
            await handleAuthSubmission(email, password, 'school', additionalData);
        });
    }

    const farmerLoginForm = document.getElementById('farmerLoginForm');
    if (farmerLoginForm) {
        farmerLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(farmerLoginForm);
            const email = formData.get('email');
            const password = formData.get('password');
            const purpose = formData.get('purpose');
            const otherPurpose = formData.get('otherPurpose');

            if (purpose === 'other' && !otherPurpose.trim()) {
                alert('กรุณาระบุความต้องการอื่นๆ');
                return;
            }

            const additionalData = {
                name: formData.get('name'),
                contactNumber: formData.get('contactNumber'),
                purpose: purpose,
                otherPurpose: purpose === 'other' ? otherPurpose : undefined
            };
            await handleAuthSubmission(email, password, 'farmer', additionalData);
        });
    }

    // --- Generic Login Form Submission ---
    const genericLoginForm = document.getElementById('genericLoginForm');
    if (genericLoginForm) {
        genericLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(genericLoginForm);
            const email = formData.get('email');
            const password = formData.get('password');
            await genericLoginAttempt(email, password);
        });
    }


    // --- Add Waste Data Form ---
    const addWasteForm = document.getElementById('addWasteForm');
    if (addWasteForm) {
        addWasteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addWasteForm);

            try {
                // TODO: Update to your Render.com Backend URL
                const response = await authenticatedFetch('https://phuket-food-hero-api.onrender.com/api/waste/add', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    alert('บันทึกข้อมูลเศษอาหารสำเร็จ!');
                    loadSchoolDashboard();
                } else {
                    const errorData = await response.json();
                    alert('บันทึกข้อมูลไม่สำเร็จ: ' + (errorData.msg || 'เกิดข้อผิดพลาด'));
                }
            } catch (error) {
                console.error('Add Waste Error:', error);
                if (error.message !== 'Unauthorized or Forbidden') {
                    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
                }
            }
        });

        // Image preview logic
        const wasteImageInput = document.getElementById('wasteImage');
        const imagePreview = document.getElementById('imagePreview');
        if (wasteImageInput && imagePreview) {
            wasteImageInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        imagePreview.src = e.target.result;
                        imagePreview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    imagePreview.src = '';
                    imagePreview.style.display = 'none';
                }
            });
        }
    }

    // --- Dashboard specific buttons ---
    if (document.getElementById('addWasteDataButton')) {
        document.getElementById('addWasteDataButton').addEventListener('click', () => {
            loadContent(getAddWasteDataHtml());
        });
    }
    // Event listener for "ดูรายงานวิเคราะห์" button
    if (document.getElementById('viewAnalysisButton')) {
        document.getElementById('viewAnalysisButton').addEventListener('click', loadAnalysisPage);
    }
    // Event listener for "แก้ไขข้อมูล" button
    if (document.getElementById('editProfileButton')) {
        document.getElementById('editProfileButton').addEventListener('click', loadEditProfilePage);
    }
    // Event listener for "ความรู้เรื่องการกำจัดขยะ" button
    if (document.getElementById('knowledgeButton')) {
        document.getElementById('knowledgeButton').addEventListener('click', loadKnowledgePage);
    }


    // --- Farmer Dashboard Filter button ---
    if (document.getElementById('filterSearchButton')) {
        document.getElementById('filterSearchButton').addEventListener('click', applyFarmerFilters);
    }
}

// --- Page HTML Content Functions ---
function getMainPageHtml() {
    return `
        <div class="main-page-container">
            <h2 class="main-question-text">คุณคือใครในโครงการ PHUKET FOOD HERO นี้</h2>
            <div class="cards-and-descriptions-wrapper">
                <div class="card-with-description">
                    <div class="card">
                        <!-- TODO: Replace with your actual school image path -->
                        <img src="images/school.jpg" alt="รูปภาพโรงเรียน" class="card-image">
                        <button class="button" id="schoolButton">โรงเรียน</button>
                    </div>
                    <p class="card-description-text">คลิกที่นี่เพื่อลงทะเบียนและจัดการเศษอาหารเหลือจากโรงเรียนของคุณ</p>
                </div>
                <div class="card-with-description">
                    <div class="card">
                        <!-- TODO: Replace with your actual farmer image path -->
                        <img src="images/farmer.jpg" alt="รูปภาพเกษตรกร" class="card-image">
                        <button class="button" id="farmerButton">เกษตรกร</button>
                    </div>
                    <p class="card-description-text">คลิกที่นี่เพื่อเลือกประเภทเศษอาหารที่คุณต้องการนำไปใช้ประโยชน์</p>
                </div>
            </div>
        </div>
    `;
}

// Generic Login Page HTML
function getGenericLoginPageHtml() {
    return `
        <div class="login-container">
            <h2>เข้าสู่ระบบ</h2>
            <form id="genericLoginForm">
                <div class="form-group">
                    <label for="genericEmail">อีเมล</label>
                    <input type="email" id="genericEmail" name="email" required>
                </div>
                <div class="form-group">
                    <label for="genericPassword">รหัสผ่าน</label>
                    <input type="password" id="genericPassword" name="password" required>
                </div>
                <button type="submit" class="login-button">เข้าสู่ระบบ</button>
                <button type="button" class="back-button" id="backFromGenericLogin">ย้อนกลับ</button>
            </form>
            <p style="margin-top: 20px; color: #555; font-size: 0.9em;">
                หากยังไม่มีบัญชี กรุณาเลือกบทบาทของคุณบนหน้าหลักเพื่อลงทะเบียน
            </p>
        </div>
    `;
}

function getSchoolLoginPageHtml() {
    return `
        <div class="login-container">
            <h2>Login สำหรับโรงเรียน</h2>
            <form id="schoolLoginForm">
                <div class="form-group">
                    <label for="instituteName">ชื่อสถาบัน</label>
                    <input type="text" id="instituteName" name="instituteName" required>
                </div>
                <div class="form-group">
                    <label for="address">ที่อยู่</label>
                    <input type="text" id="address" name="address" required>
                </div>
                <div class="form-group">
                    <label for="contactNumber">เบอร์ติดต่อ</label>
                    <input type="tel" id="contactNumber" name="contactNumber" required>
                </div>
                <div class="form-group">
                    <label for="schoolEmail">อีเมล</label>
                    <input type="email" id="schoolEmail" name="email" required>
                </div>
                <div class="form-group">
                    <label for="schoolPassword">รหัสผ่าน</label>
                    <input type="password" id="schoolPassword" name="password" required>
                </div>
                <button type="submit" class="login-button">Login</button>
                <button type="button" class="back-button" id="backToMain">ย้อนกลับ</button>
            </form>
        </div>
    `;
}

function getFarmerLoginPageHtml() {
    return `
        <div class="login-container">
            <h2>Login เกษตรกร</h2>
            <form id="farmerLoginForm">
                <div class="form-group">
                    <label for="farmerName">ชื่อ</label>
                    <input type="text" id="farmerName" name="name" required>
                </div>
                <div class="form-group">
                    <label for="farmerContactNumber">เบอร์ติดต่อ</label>
                    <input type="tel" id="farmerContactNumber" name="contactNumber" required>
                </div>
                <div class="form-group">
                    <label for="farmerEmail">อีเมล</label>
                    <input type="email" id="farmerEmail" name="email" required>
                </div>
                <div class="form-group">
                    <label for="farmerPassword">รหัสผ่าน</label>
                    <input type="password" id="farmerPassword" name="password" required>
                </div>
                <div class="form-group">
                    <label for="purposeSelect">ความต้องการของคุณ</label>
                    <select id="purposeSelect" name="purpose" required>
                        <option value="">-- เลือกความต้องการ --</option>
                        <option value="animal_feed">อยากนำเศษอาหารไปเลี้ยงสัตว์</option>
                        <option value="compost">อยากนำเศษอาหารไปหมักทำปุ๋ย</option>
                        <option value="other">อื่นๆ</option>
                    </select>
                </div>
                <div class="form-group" id="otherPurposeInput">
                    <label for="otherPurpose">ระบุความต้องการอื่นๆ</label>
                    <textarea id="otherPurpose" name="otherPurpose" rows="3"></textarea>
                </div>
                <button type="submit" class="login-button">Login</button>
                <button type="button" class="back-button" id="backToMain">ย้อนกลับ</button>
            </form>
        </div>
    `;
}

// School Dashboard Page HTML content - now dynamically loads data
function getSchoolDashboardHtml() {
    return `
        <div class="school-dashboard-container">
            <div class="dashboard-content-area">
                <div class="sidebar">
                    <p class="user-stars">⭐ 0 ดาว</p>
                    <p style="color: #666; font-size:0.9em; text-align: center; padding: 10px;">(ฟังก์ชันกรองจะอยู่บนหน้าของเกษตรกร)</p>
                </div>
                <div class="main-display-area">
                    <div class="data-block-wrapper" id="schoolDataBlocks">
                        <p style="text-align: center; color: #555;">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </div>

            <div class="dashboard-buttons">
                <button type="button" class="back-button" id="backToMainFromDashboard">ย้อนกลับ</button>
                <button type="button" class="add-data-button" id="addWasteDataButton">เพิ่มข้อมูลเศษอาหาร</button>
                <button type="button" class="analysis-button" id="viewAnalysisButton">ดูรายงานวิเคราะห์</button>
                <button type="button" class="edit-profile-button" id="editProfileButton">แก้ไขข้อมูล</button>
                <button type="button" class="knowledge-button" id="knowledgeButton">ความรู้เรื่องการกำจัดขยะ</button>
            </div>
        </div>
    `;
}

// Add Waste Data Page HTML content
function getAddWasteDataHtml() {
    return `
        <div class="add-waste-container">
            <h2>เพิ่มข้อมูลเศษอาหาร</h2>
            <form id="addWasteForm">
                <div class="form-row">
                    <div class="form-group upload-group">
                        <label for="wasteImage" class="upload-button-label">อัพโหลดรูปภาพเศษอาหาร</label>
                        <input type="file" id="wasteImage" name="wasteImage" accept="image/*" class="hidden-input">
                        <img id="imagePreview" src="#" alt="Image Preview" style="display:none;">
                    </div>
                    <div class="form-fields-group">
                        <div class="form-group">
                            <label for="menu">เมนู</label>
                            <input type="text" id="menu" name="menu" placeholder="เช่น ข้าวผัด" required>
                        </div>
                        <div class="form-group">
                            <label for="weight">น้ำหนัก</label>
                            <input type="number" id="weight" name="weight" step="0.1" placeholder="เช่น 5.0 (kg)" required>
                        </div>
                        <div class="form-group">
                            <label for="date">วันที่</label>
                            <input type="date" id="date" name="date" required>
                        </div>
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="button" class="back-button" id="backFromAddWasteData">ย้อนกลับ</button>
                    <button type="submit" class="login-button">ยืนยัน</button>
                </div>
            </form>
        </div>
    `;
}

// Farmer Dashboard Page HTML content - now dynamically loads data and includes filters
function getFarmerDashboardHtml() {
    return `
        <div class="farmer-dashboard-container">
            <div class="dashboard-content-area">
                <div class="sidebar">
                    <p class="user-stars">⭐ 0 ดาว</p>
                    <h3>กรอง</h3>
                    <div class="filter-group">
                        <label for="filterWeightMin">น้ำหนัก (kg):</label>
                        <div class="filter-weight-inputs">
                            <input type="number" id="filterWeightMin" placeholder="ขั้นต่ำ" step="0.1">
                            <span>-</span>
                            <input type="number" id="filterWeightMax" placeholder="สูงสุด" step="0.1">
                        </div>
                    </div>
                    <div class="filter-group">
                        <label for="filterMenu">เมนู:</label>
                        <input type="text" id="filterMenu" placeholder="เช่น ข้าวผัด">
                    </div>
                    <div class="filter-group">
                        <label for="filterDate">วันที่:</label>
                        <input type="date" id="filterDate">
                    </div>
                    <div class="filter-group">
                        <label for="filterSchoolName">ชื่อโรงเรียน:</label>
                        <input type="text" id="filterSchoolName" placeholder="เช่น โรงเรียน ABC">
                    </div>
                    <button type="button" class="filter-button" id="filterSearchButton">ค้นหา</button>
                </div>
                <div class="main-display-area">
                    <div class="data-block-wrapper" id="farmerDataBlocks">
                        <p style="text-align: center; color: #555;">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </div>

            <div class="dashboard-buttons">
                <button type="button" class="back-button" id="backToMainFromDashboard">ย้อนกลับ</button>
                <button type="button" class="knowledge-button" id="knowledgeButton">ความรู้เรื่องการกำจัดขยะ</button>
            </div>
        </div>
    `;
}

// Post Details Page HTML content - dynamically populates data
function getPostDetailsHtml(postData) {
    if (!postData) {
        return `<div class="post-details-container"><p style="color: #666; text-align: center;">ไม่พบข้อมูลรายละเอียด</p><div class="form-buttons"><button type="button" class="back-button" id="backFromPostDetails">ย้อนกลับ</button></div></div>`;
    }

    const date = new Date(postData.date).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    return `
        <div class="post-details-container">
            <h2>รายละเอียดเศษอาหาร</h2>
            <div class="details-content">
                <img src="${postData.imageUrl || 'https://placehold.co/300x250/ADD8E6/000000?text=No+Image'}" alt="Waste Image" class="details-image">
                <div class="details-fields-group">
                    <p><strong>เมนู:</strong> ${postData.menu}</p>
                    <p><strong>น้ำหนัก:</strong> ${postData.weight} kg</p>
                    <p><strong>วันที่:</strong> ${date}</p>
                    <p><strong>โรงเรียน:</strong> ${postData.school ? postData.school.instituteName : 'ไม่ระบุโรงเรียน'}</p>
                    <p><strong>อีเมล:</strong> ${postData.school ? postData.school.email : 'ไม่ระบุ'}</p>
                    <p><strong>ที่อยู่:</strong> ${postData.school ? postData.school.address : 'ไม่ระบุ'}</p>
                    <p><strong>เบอร์ติดต่อ:</strong> ${postData.school ? postData.school.contactNumber : 'ไม่ระบุ'}</p>
                </div>
            </div>
            <div class="form-buttons">
                <button type="button" class="back-button" id="backFromPostDetails">ย้อนกลับ</button>
            </div>
        </div>
    `;
}

// Analysis Page HTML content
function getAnalysisPageHtml() {
    return `
        <div class="analysis-container">
            <h2>รายงานวิเคราะห์เศษอาหาร (7 วันล่าสุด)</h2>
            <div class="chart-container">
                <canvas id="wasteChart"></canvas>
            </div>
            <div class="form-buttons">
                <button type="button" class="back-button" id="backFromAnalysis">ย้อนกลับ</button>
            </div>
        </div>
    `;
}

// Edit Profile Page HTML content
function getEditProfilePageHtml(userData = {}) {
    const userRole = localStorage.getItem('userRole');
    const instituteName = userData.instituteName || '';
    const address = userData.address || '';
    const contactNumber = userData.contactNumber || '';
    const email = userData.email || '';
    const name = userData.name || '';
    const purpose = userData.purpose || '';
    const otherPurpose = userData.otherPurpose || '';

    let roleSpecificFields = '';
    if (userRole === 'school') {
        roleSpecificFields = `
            <div class="form-group">
                <label for="editInstituteName">ชื่อสถาบัน</label>
                <input type="text" id="editInstituteName" name="instituteName" value="${instituteName}" required>
            </div>
            <div class="form-group">
                <label for="editAddress">ที่อยู่</label>
                <input type="text" id="editAddress" name="address" value="${address}" required>
            </div>
            <div class="form-group">
                <label for="editContactNumber">เบอร์ติดต่อ</label>
                <input type="tel" id="editContactNumber" name="contactNumber" value="${contactNumber}" required>
            </div>
        `;
    } else if (userRole === 'farmer') {
         roleSpecificFields = `
            <div class="form-group">
                <label for="editFarmerName">ชื่อ</label>
                <input type="text" id="editFarmerName" name="name" value="${name}" required>
            </div>
            <div class="form-group">
                <label for="editContactNumber">เบอร์ติดต่อ</label>
                <input type="tel" id="editContactNumber" name="contactNumber" value="${contactNumber}" required>
            </div>
            <div class="form-group">
                <label for="editPurposeSelect">ความต้องการของคุณ</label>
                <select id="editPurposeSelect" name="purpose" required>
                    <option value="animal_feed" ${purpose === 'animal_feed' ? 'selected' : ''}>อยากนำเศษอาหารไปเลี้ยงสัตว์</option>
                    <option value="compost" ${purpose === 'compost' ? 'selected' : ''}>อยากนำเศษอาหารไปหมักทำปุ๋ย</option>
                    <option value="other" ${purpose === 'other' ? 'selected' : ''}>อื่นๆ</option>
                </select>
            </div>
            <div class="form-group" id="editOtherPurposeInput" style="${purpose === 'other' ? 'display:block;' : 'display:none;'}">
                <label for="editOtherPurpose">ระบุความต้องการอื่นๆ</label>
                <textarea id="editOtherPurpose" name="otherPurpose" rows="3">${otherPurpose}</textarea>
            </div>
        `;
    }

    return `
        <div class="edit-profile-container">
            <h2>แก้ไขข้อมูลส่วนตัว</h2>
            <form id="editProfileForm">
                ${roleSpecificFields}
                <div class="form-group">
                    <label for="editEmail">อีเมล (ไม่สามารถแก้ไขได้)</label>
                    <input type="email" id="editEmail" name="email" value="${email}" disabled>
                </div>
                <div class="form-group">
                    <label for="editPassword">รหัสผ่าน (เว้นว่างหากไม่ต้องการเปลี่ยน)</label>
                    <input type="password" id="editPassword" name="password">
                </div>
                <div class="form-buttons">
                    <button type="button" class="back-button" id="backFromEditProfile">ย้อนกลับ</button>
                    <button type="submit" class="login-button">บันทึกข้อมูล</button>
                </div>
            </form>
        </div>
    `;
}

// Knowledge Page HTML content
function getKnowledgePageHtml() {
    return `
        <div class="knowledge-container">
            <h2>ความรู้เรื่องการกำจัดขยะและเศษอาหาร</h2>
            <div class="knowledge-content">
                <h3>ทำไมต้องแยกขยะเศษอาหาร?</h3>
                <p>การแยกขยะเศษอาหารออกจากขยะประเภทอื่น ๆ มีความสำคัญอย่างยิ่งในการช่วยลดผลกระทบต่อสิ่งแวดล้อม และเพิ่มมูลค่าให้กับเศษอาหารเหล่านั้น:</p>
                <ul>
                    <li><strong>ลดมลพิษในหลุมฝังกลบ:</strong> เศษอาหารที่เน่าเปื่อยในหลุมฝังกลบจะปล่อยก๊าซมีเทน ซึ่งเป็นก๊าซเรือนกระจกที่รุนแรงกว่าคาร์บอนไดออกไซด์ถึง 25 เท่า การแยกเศษอาหารช่วยลดการปล่อยก๊าซเหล่านี้</li>
                    <li><strong>ลดกลิ่นและแมลง:</strong> การแยกเศษอาหารช่วยลดกลิ่นเหม็นและปัญหาแมลงวัน สัตว์พาหะต่าง ๆ ที่มักจะมาตอมกองขยะรวม</li>
                    <li><strong>สร้างมูลค่า:</strong> เศษอาหารสามารถนำไปแปรรูปเป็นปุ๋ยหมักคุณภาพสูงสำหรับพืช หรือใช้เป็นอาหารสัตว์ ซึ่งเป็นการหมุนเวียนทรัพยากรกลับคืนสู่ระบบเศรษฐกิจ</li>
                    <li><strong>ลดค่าใช้จ่ายในการกำจัด:</strong> การลดปริมาณขยะเศษอาหารที่ต้องนำไปฝังกลบ ช่วยลดภาระและค่าใช้จ่ายในการจัดการขยะของเทศบาล</li>
                </ul>

                <h3>วิธีการจัดการเศษอาหารเบื้องต้น</h3>
                <ol>
                    <li><strong>แยกตั้งแต่ต้นทาง:</strong> แบ่งถังขยะสำหรับเศษอาหารโดยเฉพาะในครัวเรือนหรือโรงเรียน</li>
                    <li><strong>เทน้ำออก:</strong> ก่อนทิ้งเศษอาหาร ควรเทน้ำหรือของเหลวส่วนเกินออกให้มากที่สุด เพื่อลดน้ำหนักและกลิ่น</li>
                    <li><strong>ใส่ภาชนะที่เหมาะสม:</strong> ใช้ถุงหรือภาชนะที่ปิดสนิทเพื่อป้องกันกลิ่นและสัตว์รบกวน</li>
                    <li><strong>นำไปใช้ประโยชน์:</strong> หากเป็นไปได้ ลองนำเศษอาหารไปทำปุ๋ยหมักเองที่บ้าน หรือหาแหล่งรับซื้อ/รับบริจาคเศษอาหารในชุมชน</li>
                </ol>

                <h3>แหล่งข้อมูลเพิ่มเติม:</h3>
                <ul>
                    <li><a href="https://www.youtube.com/watch?v=your_knowledge_video_link" target="_blank">วิดีโอเกี่ยวกับการแยกเศษอาหาร</a></li>
                    <li><a href="https://www.example.com/foodwaste_article" target="_blank">บทความเกี่ยวกับการลดขยะอาหาร</a></li>
                </ul>
            </div>
            <div class="form-buttons">
                <button type="button" class="back-button" id="backFromKnowledge">ย้อนกลับ</button>
            </div>
        </div>
    `;
}


// --- Dashboard Loading Functions (fetch data) ---
async function loadSchoolDashboard() {
    loadContent(getSchoolDashboardHtml());
    try {
        // TODO: Update to your Render.com Backend URL
        const response = await authenticatedFetch('https://phuket-food-hero-api.onrender.com/api/waste/posts');
        const data = await response.json();
        renderDataBlocks(data, '#schoolDataBlocks');
    }
    catch (error) {
        console.error('Failed to load school dashboard data:', error);
        document.querySelector('#schoolDataBlocks').innerHTML = '<p style="color: red; text-align: center;">ไม่สามารถโหลดข้อมูลได้</p>';
    }
}

async function loadFarmerDashboard(filters = {}) {
    loadContent(getFarmerDashboardHtml());
    try {
        // TODO: Update to your Render.com Backend URL
        let url = new URL('https://phuket-food-hero-api.onrender.com/api/waste/filter');
        Object.keys(filters).forEach(key => {
            if (filters[key]) url.searchParams.append(key, filters[key]);
        });

        const response = await authenticatedFetch(url.toString());
        const data = await response.json();
        renderDataBlocks(data, '#farmerDataBlocks');

        // Restore filter values if filters were applied
        if (filters.weightMin) document.getElementById('filterWeightMin').value = filters.weightMin;
        if (filters.weightMax) document.getElementById('filterWeightMax').value = filters.weightMax;
        if (filters.menu) document.getElementById('filterMenu').value = filters.menu;
        if (filters.date) document.getElementById('filterDate').value = filters.date;
        if (filters.schoolName) document.getElementById('filterSchoolName').value = filters.schoolName;

    } catch (error) {
        console.error('Failed to load farmer dashboard data:', error);
        document.querySelector('#farmerDataBlocks').innerHTML = '<p style="color: red; text-align: center;">ไม่สามารถโหลดข้อมูลได้</p>';
    }
}

async function applyFarmerFilters() {
    const filters = {
        weightMin: document.getElementById('filterWeightMin').value,
        weightMax: document.getElementById('filterWeightMax').value,
        menu: document.getElementById('filterMenu').value,
        date: document.getElementById('filterDate').value,
        schoolName: document.getElementById('filterSchoolName').value
    };
    await loadFarmerDashboard(filters);
}

async function loadPostDetails(postId) {
    try {
        // TODO: Update to your Render.com Backend URL
        const response = await authenticatedFetch(`https://phuket-food-hero-api.onrender.com/api/waste/posts/${postId}`);
        const postData = await response.json();
        loadContent(getPostDetailsHtml(postData));
    } catch (error) {
        console.error('Failed to load post details:', error);
        loadContent(getPostDetailsHtml(null));
    }
}

async function loadAnalysisPage() {
    loadContent(getAnalysisPageHtml());
    try {
        // TODO: Update to your Render.com Backend URL
        const response = await authenticatedFetch('https://phuket-food-hero-api.onrender.com/api/waste/analyze');
        const { analysis, rawData } = await response.json(); // Get both analysis and rawData

        if (analysis.length === 0) {
            document.getElementById('wasteChart').style.display = 'none';
            document.querySelector('.chart-container').innerHTML = '<p style="color: #666; text-align: center; margin-top: 30px;">ไม่พบข้อมูลสำหรับวิเคราะห์</p>';
            return;
        }

        const ctx = document.getElementById('wasteChart').getContext('2d');
        
        // Prepare data for Chart.js
        const labels = analysis.map(item => item.menu);
        const data = analysis.map(item => item.totalWeight);

        new Chart(ctx, {
            type: 'bar', // Bar chart for total waste per menu
            data: {
                labels: labels,
                datasets: [{
                    label: 'ปริมาณเศษอาหาร (kg)',
                    data: data,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)',
                        'rgba(255, 159, 64, 0.6)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allow chart to adjust size
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'ปริมาณ (kg)',
                            color: '#333'
                        },
                        ticks: {
                            color: '#333'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'เมนูอาหาร',
                            color: '#333'
                        },
                        ticks: {
                            color: '#333'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // No legend needed for single dataset
                    },
                    title: {
                        display: true,
                        text: 'เมนูที่เหลือมากที่สุดในสัปดาห์',
                        color: '#333',
                        font: {
                            size: 18
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Failed to load analysis data:', error);
        document.querySelector('.chart-container').innerHTML = '<p style="color: red; text-align: center;">ไม่สามารถโหลดข้อมูลวิเคราะห์ได้</p>';
    }
}

// Load Edit Profile Page Function (fetches user data)
async function loadEditProfilePage() {
    loadContent(getEditProfilePageHtml()); // Load empty form first
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            alert('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
            loadMainPage();
            return;
        }
        // TODO: Update to your Render.com Backend URL
        const response = await authenticatedFetch(`https://phuket-food-hero-api.onrender.com/api/auth/profile/${userId}`); // Assuming API to get profile
        const userData = await response.json();
        
        // Populate form fields
        document.getElementById('editEmail').value = userData.email || '';
        if (document.getElementById('editInstituteName')) document.getElementById('editInstituteName').value = userData.instituteName || '';
        if (document.getElementById('editAddress')) document.getElementById('editAddress').value = userData.address || '';
        if (document.getElementById('editContactNumber')) document.getElementById('editContactNumber').value = userData.contactNumber || '';
        if (document.getElementById('editFarmerName')) document.getElementById('editFarmerName').value = userData.name || '';
        
        const purposeSelect = document.getElementById('editPurposeSelect');
        if (purposeSelect) {
            purposeSelect.value = userData.purpose || '';
            const editOtherPurposeInput = document.getElementById('editOtherPurposeInput');
            if (editOtherPurposeInput) {
                editOtherPurposeInput.style.display = (userData.purpose === 'other' ? 'block' : 'none');
                document.getElementById('editOtherPurpose').value = userData.otherPurpose || '';
            }
        }
        // Attach event listener for purposeSelect in edit profile page
        if (document.getElementById('editPurposeSelect')) {
            document.getElementById('editPurposeSelect').addEventListener('change', toggleEditOtherPurposeInput);
        }

    } catch (error) {
        console.error('Failed to load profile data:', error);
        alert('ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
    }
}

// Load Knowledge Page Function
function loadKnowledgePage() {
    loadContent(getKnowledgePageHtml());
}


// Function to handle "Other" option in dropdown
function toggleOtherPurposeInput() {
    const purposeSelect = document.getElementById('purposeSelect');
    const otherPurposeInput = document.getElementById('otherPurposeInput');
    const otherPurposeTextarea = document.getElementById('otherPurpose');

    if (purposeSelect.value === 'other') {
        otherPurposeInput.style.display = 'block';
        otherPurposeTextarea.setAttribute('required', 'true');
    } else {
        otherPurposeInput.style.display = 'none';
        otherPurposeTextarea.removeAttribute('required');
        otherPurposeTextarea.value = '';
    }
}

// Function to handle "Other" option in Edit Profile dropdown
function toggleEditOtherPurposeInput() {
    const purposeSelect = document.getElementById('editPurposeSelect');
    const otherPurposeInput = document.getElementById('editOtherPurposeInput');
    const otherPurposeTextarea = document.getElementById('editOtherPurpose');

    if (purposeSelect.value === 'other') {
        otherPurposeInput.style.display = 'block';
        otherPurposeTextarea.setAttribute('required', 'true');
    } else {
        otherPurposeInput.style.display = 'none';
        otherPurposeTextarea.removeAttribute('required');
        otherPurposeTextarea.value = '';
    }
}


// Function to load the main page and attach event listeners
function loadMainPage() {
    // Clear token and role on returning to main page (effectively logging out)
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    loadContent(getMainPageHtml());
}

// NEW: Function to load generic login page
function loadGenericLoginPage() {
    loadContent(getGenericLoginPageHtml());
}

// Initial page load and setup
document.addEventListener('DOMContentLoaded', () => {
    // Ensure the main app container is ready
    const appContainer = document.getElementById('app-container');
    if (!appContainer) {
        console.error("Error: #app-container not found. Check index.html.");
        return;
    }

    // Attach event listener for the sign-in link
    const signInLink = document.getElementById('signInLink');
    if (signInLink) {
        signInLink.addEventListener('click', (event) => {
            event.preventDefault();
            loadGenericLoginPage();
        });
    } else {
        // This warning will appear in the console if the element is not found.
        console.warn("Warning: #signInLink not found. The sign-in button may not be functional.");
    }

    // Check if user is already logged in based on token/role
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'school') {
        loadSchoolDashboard();
    } else if (userRole === 'farmer') {
        loadFarmerDashboard();
    } else {
        loadMainPage(); // Default to main page if not logged in
    }
});
