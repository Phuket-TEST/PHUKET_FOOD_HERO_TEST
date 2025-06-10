// NEW: Firebase Configuration
// TODO: PASTE YOUR FIREBASE CONFIG OBJECT HERE FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyCjtbAuyePzeC6TbnbautvwUnxzcyxPvkw",
  authDomain: "phuket-food-hero-bdf99.firebaseapp.com",
  projectId: "phuket-food-hero-bdf99",
  storageBucket: "phuket-food-hero-bdf99.firebasestorage.app",
  messagingSenderId: "186105687007",
  appId: "1:186105687007:web:7f4395dfea7e8ac942326a",
  measurementId: "G-56SEESNQWF"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Helper function to calculate stars (1 star for every 10 actions)
const calculateStars = (count) => {
    return Math.floor(count / 10);
};

// --- Firebase Authentication Functions ---
async function handleAuthSubmission(email, password, role, additionalData = {}) {
    let currentUser;
    let userDocRef;

    try {
        // Try to create user first
        // TODO: Update to your Render.com Backend URL if you're using it (otherwise, Firebase handles this directly)
        currentUser = await auth.createUserWithEmailAndPassword(email, password); // Firebase handles creation
        
        // Save user data to Firestore
        userDocRef = db.collection('users').doc(currentUser.uid);
        await userDocRef.set({
            email: email,
            role: role,
            wastePostsCount: 0,
            wasteReceivedCount: 0,
            stars: 0,
            ...additionalData // Add role-specific data
        });
        alert('ลงทะเบียนและเข้าสู่ระบบสำเร็จ!');

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            console.log('User already registered, attempting login...');
            try {
                // If email already in use, try to sign in
                currentUser = await auth.signInWithEmailAndPassword(email, password); // Firebase handles sign in
                alert('เข้าสู่ระบบสำเร็จ!');
            } catch (loginError) {
                alert('เข้าสู่ระบบล้มเหลว: ' + (loginError.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
                console.error('Login Error:', loginError);
                return;
            }
        } else {
            alert('ลงทะเบียนไม่สำเร็จ: ' + (error.message || 'เกิดข้อผิดพลาด'));
            console.error('Registration Error:', error);
            return;
        }
    }

    if (currentUser) {
        // Fetch user data including role and stars from Firestore
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userDataFromFirestore = userDoc.data();
            localStorage.setItem('userRole', userDataFromFirestore.role); // Ensure correct role
            localStorage.setItem('userId', currentUser.uid); // Store UID for future reference
            localStorage.setItem('userStars', userDataFromFirestore.stars || 0); // Store stars

            // Navigate based on actual role from Firestore
            if (userDataFromFirestore.role === 'school') {
                loadSchoolDashboard();
            } else if (userDataFromFirestore.role === 'farmer') {
                loadFarmerDashboard();
            }
        } else {
            console.error("User document not found in Firestore after auth. Logging out.");
            alert('ไม่พบข้อมูลโปรไฟล์ผู้ใช้ กรุณาลงทะเบียนใหม่');
            await auth.signOut(); // Log out if profile not found
            loadMainPage(); // Fallback
        }
    }
}

async function genericLoginAttempt(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const currentUser = userCredential.user;

        localStorage.setItem('userId', currentUser.uid); // Store UID for future reference

        // Fetch user data including role and stars from Firestore
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userDataFromFirestore = userDoc.data();
            localStorage.setItem('userRole', userDataFromFirestore.role);
            localStorage.setItem('userStars', userDataFromFirestore.stars || 0);

            alert('เข้าสู่ระบบสำเร็จ!');
            if (userDataFromFirestore.role === 'school') {
                loadSchoolDashboard();
            } else if (userDataFromFirestore.role === 'farmer') {
                loadFarmerDashboard();
            }
        } else {
            alert('ไม่พบข้อมูลโปรไฟล์ผู้ใช้ กรุณาลงทะเบียนใหม่');
            await auth.signOut(); // Log out if profile not found
            loadMainPage();
        }

    } catch (error) {
        alert('เข้าสู่ระบบล้มเหลว: ' + (error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
        console.error('Generic Login Error:', error);
    }
}


// --- Helper function to render data blocks dynamically ---
async function renderDataBlocks(data, targetWrapperId) {
    const wrapper = document.querySelector(targetWrapperId);
    if (!wrapper) return;

    wrapper.innerHTML = ''; // Clear previous content

    console.log(`Rendering data blocks for ${targetWrapperId}. Data received COUNT:`, data.length, "Data:", data); // Log data received count and data

    if (data.length === 0) {
        wrapper.innerHTML = '<p style="color: #666; text-align: center; margin-top: 30px;">ไม่พบข้อมูล</p>';
        return;
    }

    const userRole = localStorage.getItem('userRole'); // Get current user's role
    const userId = localStorage.getItem('userId'); // Get current user's ID

    // Fetch user's stars for display
    let userStars = 0;
    try {
        // Fetch current user's data from Firestore to get updated stars
        const userDoc = await db.collection('users').doc(userId).get();
        if(userDoc.exists) {
            userStars = userDoc.data().stars || 0;
            localStorage.setItem('userStars', userStars); // Update local storage
        }
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
        dataBlock.dataset.id = item.id; // Use .id for Firestore document ID

        // Format date
        const date = item.date ? new Date(item.date.toDate()).toLocaleDateString('th-TH', { // Convert Firestore Timestamp to Date
            year: 'numeric', month: 'long', day: 'numeric'
        }) : 'ไม่ระบุ';

        // Format postedAt (if available and is Timestamp)
        const postedAt = item.postedAt ? new Date(item.postedAt.toDate()).toLocaleTimeString('th-TH', {
            hour: '2-digit', minute: '2-digit'
        }) : 'ไม่ระบุ';

        // Get school info (populated manually from user data)
        const schoolName = item.schoolInfo ? item.schoolInfo.instituteName : 'ไม่ระบุโรงเรียน';
        const schoolContact = item.schoolInfo ? item.schoolInfo.contactNumber : 'ไม่ระบุ';
        const schoolEmail = item.schoolInfo ? item.schoolInfo.email : 'ไม่ระบุ';


        dataBlock.innerHTML = `
            <img src="${item.imageUrl || 'https://placehold.co/150x120/ADD8E6/000000?text=No+Image'}" alt="Waste Image" class="data-item-image">
            <div class="data-item-details">
                <p><strong>เมนู:</strong> ${item.menu}</p>
                <p><strong>ปริมาณ:</strong> ${item.weight} kg</p>
                <p><strong>วันที่:</strong> ${date} (${postedAt})</p>
                <p><strong>จาก:</strong> ${schoolName}</p>
                <p><strong>ติดต่อ:</strong> ${schoolContact}</p>
            </div>
            ${userRole === 'school' && item.schoolId === userId && !item.isDelivered ? `<button class="delete-button" data-id="${item.id}">ลบ</button>` : ''}
            ${userRole === 'farmer' && !item.isReceived ? `
                <button class="receive-waste-button" data-id="${item.id}">รับเศษอาหาร</button>
                <button class="details-button" data-id="${item.id}">รายละเอียด</button>
                ` : ''}
            ${userRole === 'farmer' && item.isReceived ? `
                <p class="received-status">รับแล้วโดยคุณ</p>
                <button class="details-button" data-id="${item.id}">รายละเอียด</button>
            `: ''}
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

    // NEW: Attach QR Scan button listeners for school pending delivery page
    if (userRole === 'school' && targetWrapperId === '#pendingDeliveryBlocks') {
        wrapper.querySelectorAll('.scan-qr-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const wasteId = e.target.dataset.id;
                loadQRCodeDisplayPage(wasteId); // Show QR code for this item
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

    // Get the newly added modal elements
    const confirmYesBtn = document.getElementById('confirmYes');
    const confirmNoBtn = document.getElementById('confirmNo');
    const modalOverlay = document.getElementById('confirmationModalOverlay');

    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', () => {
            onConfirm();
            if (modalOverlay) modalOverlay.remove();
        });
    } else {
        console.error("confirmYes button not found in modal.");
    }
    
    if (confirmNoBtn) {
        confirmNoBtn.addEventListener('click', () => {
            if (modalOverlay) modalOverlay.remove();
        });
    } else {
        console.error("confirmNo button not found in modal.");
    }
    
    if (modalOverlay) {
        // Optional: Close modal if clicking outside content (but inside overlay)
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });
    }
}


// --- Delete Waste Entry Function ---
async function deleteWasteEntry(id) {
    console.log('Frontend attempting to delete ID:', id);
    try {
        const wasteEntryRef = db.collection('wasteentries').doc(id);
        const wasteEntryDoc = await wasteEntryRef.get();

        if (!wasteEntryDoc.exists) {
            alert('ไม่พบข้อมูลเศษอาหารที่จะลบ');
            return;
        }
        const wasteEntryData = wasteEntryDoc.data();

        // Check if the school is the owner
        const userId = auth.currentUser ? auth.currentUser.uid : null;
        if (!userId || wasteEntryData.schoolId !== userId) {
            alert('ไม่ได้รับอนุญาตให้ลบข้อมูลนี้');
            return;
        }

        // Delete image from Firebase Storage if exists
        if (wasteEntryData.imageUrl) {
            try {
                const imageRef = storage.refFromURL(wasteEntryData.imageUrl);
                await imageRef.delete();
                console.log('Image deleted from Firebase Storage.');
            } catch (storageError) {
                console.error('Error deleting image from Firebase Storage:', storageError);
                // Continue with document deletion even if image deletion fails
            }
        }

        await wasteEntryRef.delete();

        // Update school's wastePostsCount and stars
        const schoolUserRef = db.collection('users').doc(userId);
        await db.runTransaction(async (transaction) => {
            const schoolUserDoc = await transaction.get(schoolUserRef);
            if (schoolUserDoc.exists) {
                const newWastePostsCount = Math.max(0, (schoolUserDoc.data().wastePostsCount || 0) - 1);
                const newStars = calculateStars(newWastePostsCount);
                transaction.update(schoolUserRef, {
                    wastePostsCount: newWastePostsCount,
                    stars: newStars
                });
                localStorage.setItem('userStars', newStars); // Update local storage
            }
        });

        alert('ลบข้อมูลสำเร็จ!');
        loadSchoolDashboard();
    } catch (error) {
        console.error('Delete Waste Error:', error);
        alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message);
    }
}

// Handle Receive Waste Function (for Farmer)
async function handleReceiveWaste(wasteId) {
    console.log(`Frontend sending receive request for ID: ${wasteId}`);
    try {
        const wasteEntryRef = db.collection('wasteentries').doc(wasteId);
        const wasteEntryDoc = await wasteEntryRef.get();

        if (!wasteEntryDoc.exists) {
            alert('ไม่พบข้อมูลเศษอาหารที่จะรับ');
            return;
        }
        const wasteEntryData = wasteEntryDoc.data();
        if (wasteEntryData.isReceived) {
            alert('เศษอาหารนี้ถูกรับไปแล้ว');
            return;
        }

        const farmerUserId = auth.currentUser ? auth.currentUser.uid : null;
        if (!farmerUserId) {
             alert('กรุณาเข้าสู่ระบบในฐานะเกษตรกรเพื่อรับเศษอาหาร');
             return;
        }


        // Update waste entry as received
        await wasteEntryRef.update({
            isReceived: true,
            receivedBy: farmerUserId,
            receivedAt: firebase.firestore.FieldValue.serverTimestamp() // Use server timestamp
        });

        // Update farmer's wasteReceivedCount and stars
        const farmerUserRef = db.collection('users').doc(farmerUserId);
        await db.runTransaction(async (transaction) => {
            const farmerUserDoc = await transaction.get(farmerUserRef);
            if (farmerUserDoc.exists) {
                const newWasteReceivedCount = (farmerUserDoc.data().wasteReceivedCount || 0) + 1;
                const newStars = calculateStars(newWasteReceivedCount);
                transaction.update(farmerUserRef, {
                    wasteReceivedCount: newWasteReceivedCount,
                    stars: newStars
                });
                localStorage.setItem('userStars', newStars); // Update local storage
            }
        });

        alert('ยืนยันการรับเศษอาหารสำเร็จ!');
        loadFarmerDashboard(); // Reload dashboard to reflect changes (e.g., stars)
    } catch (error) {
        console.error('Receive Waste Error:', error);
        alert('เกิดข้อผิดพลาดในการรับเศษอาหาร: ' + error.message);
    }
}

// NEW: Handle Confirm Delivery Function (for School, after QR scan)
async function handleConfirmDelivery(wasteId) {
    console.log(`Frontend sending confirm delivery request for ID: ${wasteId}`);
    try {
        const wasteEntryRef = db.collection('wasteentries').doc(wasteId);
        const wasteEntryDoc = await wasteEntryRef.get();

        if (!wasteEntryDoc.exists) {
            alert('ไม่พบข้อมูลเศษอาหารที่จะยืนยัน');
            return;
        }
        const wasteEntryData = wasteEntryDoc.data();

        // Check if the school is the owner of this waste entry
        const userId = auth.currentUser ? auth.currentUser.uid : null;
        if (!userId || wasteEntryData.schoolId !== userId) {
            alert('คุณไม่ได้รับอนุญาตให้ยืนยันการส่งมอบข้อมูลนี้');
            return;
        }

        // Check if it's already delivered
        if (wasteEntryData.isDelivered) {
            alert('เศษอาหารนี้ถูกส่งมอบไปแล้ว');
            return;
        }
        // Check if it's even received by a farmer
        if (!wasteEntryData.isReceived) {
            alert('เศษอาหารนี้ยังไม่ถูกเกษตรกรรับไป');
            return;
        }

        // Mark as delivered
        await wasteEntryRef.update({
            isDelivered: true,
            deliveredAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('ยืนยันการส่งมอบเศษอาหารสำเร็จ!');
        loadPendingDeliveryPage(); // Reload pending delivery list
    } catch (error) {
        console.error('Confirm Delivery Error:', error);
        alert('เกิดข้อผิดพลาดในการยืนยันการส่งมอบ: ' + error.message);
    }
}

// --- Main Page Loading Function ---
function loadContent(contentHtml) {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = contentHtml;
    console.log("loadContent called. HTML loaded into app-container.");

    // --- Common Event Listeners (attached after content is loaded) ---
    // These listeners are attached every time contentHtml is loaded,
    // ensuring they always work for newly rendered elements.
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
    // NEW: Event listener for back from received waste list
    if (document.getElementById('backFromReceivedWaste')) {
        document.getElementById('backFromReceivedWaste').addEventListener('click', loadFarmerDashboard);
    }
    // NEW: Event listener for back from pending delivery list
    if (document.getElementById('backFromPendingDelivery')) {
        document.getElementById('backFromPendingDelivery').addEventListener('click', loadSchoolDashboard);
    }
    // NEW: Event listener for back from QR scan page
    if (document.getElementById('backFromQRScan')) {
        document.getElementById('backFromQRScan').addEventListener('click', loadPendingDeliveryPage); // Back to pending delivery list
    }


    // --- Page Specific Event Listeners ---
    if (document.getElementById('purposeSelect')) {
        document.getElementById('purposeSelect').addEventListener('change', toggleOtherPurposeInput);
    }
    if (document.getElementById('editPurposeSelect')) { // For edit profile page
        document.getElementById('editPurposeSelect').addEventListener('change', toggleEditOtherPurposeInput);
    }

    if (document.getElementById('schoolButton')) {
        console.log("Attaching listener to schoolButton"); // Added log
        document.getElementById('schoolButton').addEventListener('click', () => loadContent(getSchoolLoginPageHtml()));
    }
    if (document.getElementById('farmerButton')) {
        console.log("Attaching listener to farmerButton"); // Added log
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

    const addWasteForm = document.getElementById('addWasteForm');
    if (addWasteForm) {
        addWasteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addWasteForm);
            const menu = formData.get('menu');
            const weight = parseFloat(formData.get('weight'));
            const date = formData.get('date');
            const imageUrlFile = formData.get('wasteImage'); // Get the file itself

            try {
                let imageUrl = null;
                if (imageUrlFile && imageUrlFile.size > 0) {
                    const storageRef = storage.ref(`waste_images/${Date.now()}_${imageUrlFile.name}`);
                    const uploadTask = storageRef.put(imageUrlFile);

                    await uploadTask; // Wait for upload to complete
                    imageUrl = await storageRef.getDownloadURL(); // Get public URL
                }

                // Add document to Firestore
                const userId = auth.currentUser ? auth.currentUser.uid : null;
                if (!userId) {
                    alert('กรุณาเข้าสู่ระบบก่อนโพสต์ข้อมูล');
                    return;
                }

                await db.collection('wasteentries').add({
                    schoolId: userId, // Link to school user ID
                    menu,
                    weight,
                    date: firebase.firestore.Timestamp.fromDate(new Date(date)), // Convert date string to Firestore Timestamp
                    imageUrl,
                    postedAt: firebase.firestore.FieldValue.serverTimestamp(), // Server timestamp for creation
                    isReceived: false,
                    isDelivered: false
                });

                // Update school's wastePostsCount and stars
                const schoolUserRef = db.collection('users').doc(userId);
                await db.runTransaction(async (transaction) => {
                    const schoolUserDoc = await transaction.get(schoolUserRef);
                    if (schoolUserDoc.exists) {
                        const newWastePostsCount = (schoolUserDoc.data().wastePostsCount || 0) + 1;
                        const newStars = calculateStars(newWastePostsCount);
                        transaction.update(schoolUserRef, {
                            wastePostsCount: newWastePostsCount,
                            stars: newStars
                        });
                        localStorage.setItem('userStars', newStars); // Update local storage
                    }
                });

                alert('บันทึกข้อมูลเศษอาหารสำเร็จ!');
                loadSchoolDashboard();
            } catch (error) {
                console.error('Add Waste Error:', error);
                alert('บันทึกข้อมูลไม่สำเร็จ: ' + error.message);
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

    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            alert('คุณกดบันทึกข้อมูลแก้ไขแล้ว! (ยังไม่ส่งข้อมูลไปยัง Backend)');
            // TODO: Phase 2 - Implement Backend API to update user profile
            // Example:
            // const userId = auth.currentUser ? auth.currentUser.uid : null;
            // if (!userId) { alert('กรุณาเข้าสู่ระบบเพื่อแก้ไขโปรไฟล์'); return; }
            // const formData = new FormData(editProfileForm);
            // const updateData = {
            //     instituteName: formData.get('instituteName') || undefined,
            //     address: formData.get('address') || undefined,
            //     contactNumber: formData.get('contactNumber') || undefined,
            //     name: formData.get('name') || undefined,
            //     purpose: formData.get('purpose') || undefined,
            //     otherPurpose: formData.get('otherPurpose') || undefined
            // };
            // if (formData.get('password')) { // Only update password if provided
            //     try {
            //         await auth.currentUser.updatePassword(formData.get('password'));
            //         console.log("Password updated successfully.");
            //     } catch (passwordError) {
            //         console.error("Error updating password:", passwordError);
            //         alert("ไม่สามารถเปลี่ยนรหัสผ่านได้: " + passwordError.message);
            //         return;
            //     }
            // }
            // await db.collection('users').doc(userId).update(updateData);
            // alert('บันทึกข้อมูลสำเร็จ!');
            loadSchoolDashboard(); // Go back to dashboard
        });
    }


    // --- Dashboard specific buttons (always available on dashboards) ---
    if (document.getElementById('addWasteDataButton')) {
        document.getElementById('addWasteDataButton').addEventListener('click', () => {
            loadContent(getAddWasteDataHtml());
        });
    }
    if (document.getElementById('viewAnalysisButton')) {
        document.getElementById('viewAnalysisButton').addEventListener('click', loadAnalysisPage);
    }
    if (document.getElementById('editProfileButton')) {
        document.getElementById('editProfileButton').addEventListener('click', loadEditProfilePage);
    }
    if (document.getElementById('knowledgeButton')) {
        document.getElementById('knowledgeButton').addEventListener('click', loadKnowledgePage);
    }
    if (document.getElementById('pendingDeliveryButton')) {
        document.getElementById('pendingDeliveryButton').addEventListener('click', loadPendingDeliveryPage);
    }
    if (document.getElementById('receivedWasteButton')) {
        document.getElementById('receivedWasteButton').addEventListener('click', loadReceivedWastePage);
    }

    // --- Farmer Dashboard Filter button (only on farmer dashboard) ---
    if (document.getElementById('filterSearchButton')) {
        document.getElementById('filterSearchButton').addEventListener('click', applyFarmerFilters);
    }

    // NEW: School Scan QR button (on pending delivery page)
    const scanQRButton = document.getElementById('scanQRButton');
    if (scanQRButton) {
        scanQRButton.addEventListener('click', async () => {
            const wasteId = prompt('จำลองการสแกน QR Code: กรุณากรอก ID ของเศษอาหารที่ต้องการยืนยันการส่งมอบ');
            if (wasteId) {
                await handleConfirmDelivery(wasteId);
            } else {
                alert('กรุณากรอก ID เศษอาหาร');
            }
        });
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
                        <img src="images/school_image.jpg" alt="รูปภาพโรงเรียน" class="card-image">
                        <button class="button" id="schoolButton">โรงเรียน</button>
                    </div>
                    <p class="card-description-text">คลิกที่นี่เพื่อลงทะเบียนและจัดการเศษอาหารเหลือจากโรงเรียนของคุณ</p>
                </div>
                <div class="card-with-description">
                    <div class="card">
                        <!-- TODO: Replace with your actual farmer image path -->
                        <img src="images/farmer_image.jpg" alt="รูปภาพเกษตรกร" class="card-image">
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
                        <option value="animal_feed" ${purpose === 'animal_feed' ? 'selected' : ''}>อยากนำเศษอาหารไปเลี้ยงสัตว์</option>
                        <option value="compost" ${purpose === 'compost' ? 'selected' : ''}>อยากนำเศษอาหารไปหมักทำปุ๋ย</option>
                        <option value="other" ${purpose === 'other' ? 'selected' : ''}>อื่นๆ</option>
                    </select>
                </div>
                <div class="form-group" id="otherPurposeInput">
                    <label for="otherPurpose">ระบุความต้องการอื่นๆ</label>
                    <textarea id="otherPurpose" name="otherPurpose" rows="3">${otherPurpose}</textarea>
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
                <button type="button" class="pending-delivery-button" id="pendingDeliveryButton">รายการเศษอาหารที่ต้องส่ง</button>
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
                        <p style="text-align: center; color: #666;">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </div>

            <div class="dashboard-buttons">
                <button type="button" class="back-button" id="backToMainFromDashboard">ย้อนกลับ</button>
                <button type="button" class="knowledge-button" id="knowledgeButton">ความรู้เรื่องการกำจัดขยะ</button>
                <button type="button" class="received-waste-button-list" id="receivedWasteButton">รายการเศษอาหารที่รับแล้ว</button>
            </div>
        </div>
    `;
}

// Post Details Page HTML content - dynamically populates data
function getPostDetailsHtml(postData) {
    if (!postData) {
        return `<div class="post-details-container"><p style="color: #666; text-align: center;">ไม่พบข้อมูลรายละเอียด</p><div class="form-buttons"><button type="button" class="back-button" id="backFromPostDetails">ย้อนกลับ</button></div></div>`;
    }

    const date = new Date(postData.date.toDate()).toLocaleDateString('th-TH', {
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
                    <p><strong>โรงเรียน:</strong> ${postData.schoolInfo ? postData.schoolInfo.instituteName : 'ไม่ระบุโรงเรียน'}</p>
                    <p><strong>อีเมล:</strong> ${postData.schoolInfo ? postData.schoolInfo.email : 'ไม่ระบุ'}</p>
                    <p><strong>ที่อยู่:</strong> ${postData.schoolInfo ? postData.schoolInfo.address : 'ไม่ระบุ'}</p>
                    <p><strong>เบอร์ติดต่อ:</strong> ${postData.schoolInfo ? postData.schoolInfo.contactNumber : 'ไม่ระบุ'}</p>
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

// NEW: Pending Delivery Page HTML content (for School)
function getPendingDeliveryHtml(pendingItems = []) {
    let pendingBlocksHtml = '';
    if (pendingItems.length === 0) {
        pendingBlocksHtml = '<p style="color: #666; text-align: center; margin-top: 30px;">ไม่มีรายการเศษอาหารที่ต้องส่ง</p>';
    } else {
        pendingItems.forEach(item => {
            const date = new Date(item.date.toDate()).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
            const receivedAt = new Date(item.receivedAt.toDate()).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' });
            pendingBlocksHtml += `
                <div class="data-block pending-item">
                    <img src="${item.imageUrl || 'https://placehold.co/100x80/ADD8E6/000000?text=Waste+Pic'}" alt="Waste Image" class="data-item-image">
                    <div class="data-item-details">
                        <p><strong>เมนู:</strong> ${item.menu}</p>
                        <p><strong>ปริมาณ:</strong> ${item.weight} kg</p>
                        <p><strong>วันที่โพสต์:</strong> ${date}</p>
                        <p><strong>ผู้รับ (เกษตรกร):</strong> ${item.receivedByInfo ? item.receivedByInfo.name : 'ไม่ระบุ'}</p>
                        <p><strong>ติดต่อผู้รับ:</strong> ${item.receivedByInfo ? item.receivedByInfo.contactNumber : 'ไม่ระบุ'}</p>
                        <p><strong>รับแล้วเมื่อ:</strong> ${receivedAt}</p>
                    </div>
                    <button class="scan-qr-button" data-id="${item.id}">สแกน QR Code เพื่อยืนยัน</button>
                </div>
            `;
        });
    }

    return `
        <div class="pending-delivery-container">
            <h2>รายการเศษอาหารที่ต้องส่ง</h2>
            <div class="pending-list-area">
                <div class="data-block-wrapper" id="pendingDeliveryBlocks">
                    ${pendingBlocksHtml}
                </div>
            </div>
            <div class="form-buttons">
                <button type="button" class="back-button" id="backFromPendingDelivery">ย้อนกลับ</button>
            </div>
        </div>
    `;
}

// NEW: Received Waste HTML (for Farmer)
function getReceivedWasteHtml(receivedItems = []) {
    let receivedBlocksHtml = '';
    if (receivedItems.length === 0) {
        receivedBlocksHtml = '<p style="color: #666; text-align: center; margin-top: 30px;">ยังไม่มีรายการเศษอาหารที่รับ</p>';
    } else {
        receivedItems.forEach(item => {
            const date = new Date(item.date.toDate()).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
            const receivedAt = item.receivedAt ? new Date(item.receivedAt.toDate()).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ไม่ระบุ';
            const deliveredStatus = item.isDelivered ? 'ส่งมอบแล้ว' : 'รอส่งมอบ';
            receivedBlocksHtml += `
                <div class="data-block received-item">
                    <img src="${item.imageUrl || 'https://placehold.co/100x80/ADD8E6/000000?text=Waste+Pic'}" alt="Waste Image" class="data-item-image">
                    <div class="data-item-details">
                        <p><strong>เมนู:</strong> ${item.menu}</p>
                        <p><strong>ปริมาณ:</strong> ${item.weight} kg</p>
                        <p><strong>วันที่โพสต์:</strong> ${date}</p>
                        <p><strong>จากโรงเรียน:</strong> ${item.schoolInfo ? item.schoolInfo.instituteName : 'ไม่ระบุโรงเรียน'}</p>
                        <p><strong>รับแล้วเมื่อ:</strong> ${receivedAt}</p>
                        <p><strong>สถานะส่งมอบ:</strong> <span class="${item.isDelivered ? 'status-delivered' : 'status-pending'}">${deliveredStatus}</span></p>
                    </div>
                    ${!item.isDelivered ? `
                        <button class="show-qr-button" data-id="${item.id}">แสดง QR Code</button>
                    ` : ''}
                </div>
            `;
        });
    }
    return `
        <div class="received-waste-container">
            <h2>รายการเศษอาหารที่รับแล้ว</h2>
            <div class="received-list-area">
                <div class="data-block-wrapper" id="receivedWasteBlocks">
                    ${receivedBlocksHtml}
                </div>
            </div>
            <div class="form-buttons">
                <button type="button" class="back-button" id="backFromReceivedWaste">ย้อนกลับ</button>
            </div>
        </div>
    `;
}

// NEW: QR Code Display Page HTML
function getQRCodeDisplayHtml(wasteId) {
    // In a real app, you'd use a QR code library to render a canvas or SVG QR.
    // For this example, we display the ID as text, simulating the QR content.
    return `
        <div class="qr-code-container">
            <h2>แสดง QR Code</h2>
            <p>กรุณาให้โรงเรียนสแกน QR Code นี้เพื่อยืนยันการรับเศษอาหาร</p>
            <div class="qr-code-box">
                <p class="qr-code-text">Waste ID: ${wasteId}</p>
                <!-- In a real app, a QR code image/canvas would go here -->
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${wasteId}" alt="QR Code for Waste ID">
            </div>
            <div class="form-buttons">
                <button type="button" class="back-button" id="backFromQRScan">ย้อนกลับ</button>
            </div>
        </div>
    `;
}


// --- Dashboard Loading Functions (fetch data) ---
async function loadSchoolDashboard() {
    loadContent(getSchoolDashboardHtml());
    try {
        // Fetch waste entries from Firestore
        const wasteEntriesSnapshot = await db.collection('wasteentries')
                                             .where('isDelivered', '==', false) // Only show undelivered items
                                             .orderBy('postedAt', 'desc')
                                             .get();
        let wasteData = [];
        for (const doc of wasteEntriesSnapshot.docs) {
            const item = { id: doc.id, ...doc.data() };
            // Manually fetch school info for display
            if (item.schoolId) {
                const schoolDoc = await db.collection('users').doc(item.schoolId).get();
                if (schoolDoc.exists) {
                    item.schoolInfo = schoolDoc.data();
                }
            }
            wasteData.push(item);
        }
        renderDataBlocks(wasteData, '#schoolDataBlocks');
    }
    catch (error) {
        console.error('Failed to load school dashboard data:', error);
        document.querySelector('#schoolDataBlocks').innerHTML = '<p style="color: red; text-align: center;">ไม่สามารถโหลดข้อมูลได้</p>';
    }
}

async function loadFarmerDashboard(filters = {}) {
    loadContent(getFarmerDashboardHtml());
    try {
        let query = db.collection('wasteentries').where('isDelivered', '==', false); // Only show undelivered for general view

        // Apply filters
        if (filters.weightMin) query = query.where('weight', '>=', parseFloat(filters.weightMin));
        if (filters.weightMax) query = query.where('weight', '<=', parseFloat(filters.weightMax));
        if (filters.date) {
            const startDate = firebase.firestore.Timestamp.fromDate(new Date(filters.date));
            const endDate = firebase.firestore.Timestamp.fromDate(new Date(new Date(filters.date).setDate(new Date(filters.date).getDate() + 1)));
            query = query.where('date', '>=', startDate).where('date', '<', endDate);
        }
        // Filtering by menu and schoolName requires fetching all and then client-side filter
        // since Firestore does not support case-insensitive contains or joins on multiple fields
        // that are not part of an exact match or range query without complex indexing or client-side filtering.
        // For simplicity and given previous context, we'll keep client-side filtering for these
        // if precise Firestore queries become too complex or require specific indexes.
        
        // For now, we'll fetch all filterable items and then client-side filter for menu/schoolName if needed
        const wasteEntriesSnapshot = await query.orderBy('postedAt', 'desc').get();
        let wasteData = [];
        for (const doc of wasteEntriesSnapshot.docs) {
            const item = { id: doc.id, ...doc.data() };
            // Manually fetch school info for display
            if (item.schoolId) {
                const schoolDoc = await db.collection('users').doc(item.schoolId).get();
                if (schoolDoc.exists) {
                    item.schoolInfo = schoolDoc.data();
                }
            }
            wasteData.push(item);
        }

        // Apply client-side filters for menu and schoolName
        if (filters.menu) {
            wasteData = wasteData.filter(item => item.menu.toLowerCase().includes(filters.menu.toLowerCase()));
        }
        if (filters.schoolName) {
            wasteData = wasteData.filter(item => item.schoolInfo && item.schoolInfo.instituteName.toLowerCase().includes(filters.schoolName.toLowerCase()));
        }

        renderDataBlocks(wasteData, '#farmerDataBlocks');

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
    loadContent(getPostDetailsHtml()); // Load empty structure first
    try {
        const wasteEntryDoc = await db.collection('wasteentries').doc(postId).get();
        if (!wasteEntryDoc.exists) {
            alert('ไม่พบข้อมูลเศษอาหาร');
            loadFarmerDashboard();
            return;
        }
        const postData = { id: wasteEntryDoc.id, ...wasteEntryDoc.data() };

        // Fetch school info
        if (postData.schoolId) {
            const schoolDoc = await db.collection('users').doc(postData.schoolId).get();
            if (schoolDoc.exists) {
                postData.schoolInfo = schoolDoc.data();
            }
        }
        // Fetch farmer info if received
        if (postData.isReceived && postData.receivedBy) {
            const farmerDoc = await db.collection('users').doc(postData.receivedBy).get();
            if (farmerDoc.exists) {
                postData.receivedByInfo = farmerDoc.data();
            }
        }

        loadContent(getPostDetailsHtml(postData));
    } catch (error) {
        console.error('Failed to load post details:', error);
        alert('ไม่สามารถโหลดข้อมูลรายละเอียดได้: ' + error.message);
        loadFarmerDashboard(); // Go back to dashboard on error
    }
}

async function loadAnalysisPage() {
    loadContent(getAnalysisPageHtml());
    try {
        const userId = localStorage.getItem('userId');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoTimestamp = firebase.firestore.Timestamp.fromDate(sevenDaysAgo);

        const wasteEntriesSnapshot = await db.collection('wasteentries')
                                            .where('schoolId', '==', userId)
                                            .where('date', '>=', sevenDaysAgoTimestamp) // Filter for last 7 days
                                            .orderBy('date', 'desc') // Order by date for analysis
                                            .get();
        let rawData = [];
        wasteEntriesSnapshot.forEach(doc => {
            rawData.push(doc.data());
        });

        if (rawData.length === 0) {
            document.getElementById('wasteChart').style.display = 'none';
            document.querySelector('.chart-container').innerHTML = '<p style="color: #666; text-align: center; margin-top: 30px;">ไม่พบข้อมูลสำหรับวิเคราะห์ในช่วง 7 วันล่าสุด</p>';
            return;
        }

        // Analysis logic: Sum weight per menu
        const analysis = {};
        rawData.forEach(entry => {
            if (analysis[entry.menu]) {
                analysis[entry.menu] += entry.weight;
            } else {
                analysis[entry.menu] = entry.weight;
            }
        });

        // Convert to array for Chart.js
        const labels = Object.keys(analysis);
        const data = Object.values(analysis);

        const ctx = document.getElementById('wasteChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'bar', // Bar chart for total waste per menu
            data: {
                labels: labels,
                datasets: [{
                    label: 'ปริมาณเศษอาหาร (kg)',
                    data: data,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
                        'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
                        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'ปริมาณ (kg)', color: '#333' },
                        ticks: { color: '#333' },
                        grid: { color: 'rgba(0, 0, 0, 0.1)' }
                    },
                    x: {
                        title: { display: true, text: 'เมนูอาหาร', color: '#333' },
                        ticks: { color: '#333' },
                        grid: { color: 'rgba(0, 0, 0, 0.1)' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'เมนูที่เหลือมากที่สุดในสัปดาห์',
                        color: '#333',
                        font: { size: 18 }
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
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            alert('ไม่พบข้อมูลผู้ใช้');
            loadMainPage();
            return;
        }
        const userData = userDoc.data();
        
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
        alert('ไม่สามารถโหลดข้อมูลโปรไฟล์ได้: ' + error.message);
    }
}

// Load Knowledge Page Function
function loadKnowledgePage() {
    loadContent(getKnowledgePageHtml());
}

// NEW: Load Pending Delivery Page Function (for School)
async function loadPendingDeliveryPage() {
    loadContent(getPendingDeliveryHtml()); // Load empty structure first
    try {
        const userId = localStorage.getItem('userId');
        const pendingEntriesSnapshot = await db.collection('wasteentries')
                                               .where('schoolId', '==', userId)
                                               .where('isReceived', '==', true) // Received by farmer
                                               .where('isDelivered', '==', false) // Not yet delivered
                                               .orderBy('receivedAt', 'desc')
                                               .get();
        let pendingData = [];
        for (const doc of pendingEntriesSnapshot.docs) {
            const item = { id: doc.id, ...doc.data() };
            // Manually fetch farmer info for display
            if (item.receivedBy) {
                const farmerDoc = await db.collection('users').doc(item.receivedBy).get();
                if (farmerDoc.exists) {
                    item.receivedByInfo = farmerDoc.data();
                }
            }
            pendingData.push(item);
        }
        renderDataBlocks(pendingData, '#pendingDeliveryBlocks'); // Render into the specific wrapper
    } catch (error) {
        console.error('Failed to load pending delivery data:', error);
        document.querySelector('#pendingDeliveryBlocks').innerHTML = '<p style="color: red; text-align: center;">ไม่สามารถโหลดข้อมูลรายการที่ต้องส่งได้</p>';
    }
}


// NEW: Load Received Waste Page Function (for Farmer)
async function loadReceivedWastePage() {
    loadContent(getReceivedWasteHtml()); // Load empty structure first
    try {
        const userId = localStorage.getItem('userId');
        const receivedEntriesSnapshot = await db.collection('wasteentries')
                                                .where('receivedBy', '==', userId) // Items this farmer received
                                                .where('isReceived', '==', true) // Confirmed as received
                                                .orderBy('receivedAt', 'desc')
                                                .get();
        let receivedData = [];
        for (const doc of receivedEntriesSnapshot.docs) {
            const item = { id: doc.id, ...doc.data() };
            // Manually fetch school info for display
            if (item.schoolId) {
                const schoolDoc = await db.collection('users').doc(item.schoolId).get();
                if (schoolDoc.exists) {
                    item.schoolInfo = schoolDoc.data();
                }
            }
            receivedData.push(item);
        }
        renderDataBlocks(receivedData, '#receivedWasteBlocks'); // Render into the specific wrapper
    } catch (error) {
        console.error('Failed to load received waste data:', error);
        document.querySelector('#receivedWasteBlocks').innerHTML = '<p style="color: red; text-align: center;">ไม่สามารถโหลดข้อมูลรายการที่รับแล้วได้</p>';
    }
}


// NEW: Load QR Code Display Page Function
function loadQRCodeDisplayPage(wasteId) {
    loadContent(getQRCodeDisplayHtml(wasteId));
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
    localStorage.removeItem('userStars'); // Clear stars on logout
    loadContent(getMainPageHtml());
}

// Function to load generic login page
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
