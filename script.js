// NEW: Firebase Configuration
// TODO: PASTE YOUR FIREBASE CONFIG OBJECT HERE FROM FIREBASE CONSOLE
// *** IMPORTANT: Replace all "YOUR_..." placeholders with your actual Firebase project config ***
const firebaseConfig = {
  apiKey: "AIzaSyCjtbAuyePzeC6TbnbautvwUnxzcyxPvkw",
  authDomain: "phuket-food-hero-bdf99.firebaseapp.com",
  projectId: "phuket-food-hero-bdf99",
  storageBucket: "phuket-food-hero-bdf99.firebasestorage.app",
  messagingSenderId: "186105687007",
  appId: "1:186105687007:web:7f4395dfea7e8ac942326a",
  measurementId: "G-56SEESNQWF"
};
// --- IMPORTANT FIX: Declare auth, db, storage globally ---
let auth;
let db;
let storage;
// --- END IMPORTANT FIX ---

// Initialize Firebase
try {
    const firebaseApp = firebase.initializeApp(firebaseConfig); // Assign to a variable
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    console.log("Firebase initialized successfully. Auth, DB, Storage objects are accessible.");
} catch (initError) {
    console.error("Failed to initialize Firebase:", initError);
    alert("เกิดข้อผิดพลาดในการเริ่มต้น Firebase: " + initError.message + ". โปรดตรวจสอบ Firebase Config และ API Key ใน script.js");
    // Don't throw new Error here, as it stops script execution preventing any display.
    // Let the browser show the alert and the console error.
}


// Helper function to calculate stars (1 star for every 10 actions)
const calculateStars = (count) => {
    return Math.floor(count / 10);
};

// NEW Helper function to remove undefined properties from an object
function cleanObject(obj) {
    const newObj = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
}


// --- Firebase Authentication Functions ---
async function handleAuthSubmission(email, password, role, additionalData = {}) {
    let currentUser;
    let userDocRef;

    // Basic frontend validation for password length
    if (password.length < 6) {
        alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        return;
    }

    try {
        // Try to create user first in Firebase Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        // --- IMPORTANT: Robust check for currentUser and UID ---
        if (!currentUser || !currentUser.uid) {
            console.error("Auth Error: currentUser or UID is undefined after createUserWithEmailAndPassword.");
            alert('ลงทะเบียนไม่สำเร็จ: ผู้ใช้ไม่ได้ถูกสร้างอย่างถูกต้อง (UID หายไป)');
            // No need to signOut here as user might not be fully created/signed in yet
            loadMainPage();
            return;
        }
        console.log("Firebase Auth: User created with UID:", currentUser.uid);
        // --- END IMPORTANT CHECK ---
        
        // Save user data to Firestore
        // --- NEW: Wrap Firestore document creation in its own try-catch ---
        try {
            userDocRef = db.collection('users').doc(currentUser.uid);
            
            // Clean additionalData to remove undefined fields before setting
            const dataToSet = cleanObject({
                email: email,
                role: role,
                wastePostsCount: 0,
                wasteReceivedCount: 0,
                stars: 0,
                ...additionalData // Add role-specific data
            });

            await userDocRef.set(dataToSet); // Use the cleaned data
            console.log("Firestore: User document created for UID:", currentUser.uid);
            alert('ลงทะเบียนและเข้าสู่ระบบสำเร็จ!');
        } catch (firestoreError) {
            console.error("Firestore Error during user document creation:", firestoreError);
            alert('ลงทะเบียนไม่สำเร็จ: ไม่สามารถบันทึกข้อมูลโปรไฟล์ (อาจเกิดจากกฎความปลอดภัยหรือปัญหาฐานข้อมูล): ' + firestoreError.message);
            // Optional: Delete user from Auth if Firestore document creation fails
            if (auth.currentUser) { // Ensure user is still logged in to delete
                await auth.currentUser.delete();
            }
            await auth.signOut();
            loadMainPage();
            return;
        }
        // --- END NEW Firestore try-catch ---

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            console.log('User already registered in Firebase Auth, attempting login...');
            try {
                // If email already in use, try to sign in
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                currentUser = userCredential.user;
                
                // --- NEW: Robust check for currentUser and UID after sign-in ---
                if (!currentUser || !currentUser.uid) {
                    console.error("Auth Error: currentUser or UID is undefined after signInWithEmailAndPassword.");
                    alert('เข้าสู่ระบบล้มเหลว: ไม่สามารถระบุผู้ใช้ได้');
                    await auth.signOut();
                    loadMainPage();
                    return;
                }
                console.log("Firebase Auth: User signed in with existing account. UID:", currentUser.uid);
                // --- END NEW CHECK ---
                
                alert('เข้าสู่ระบบสำเร็จ!');
            } catch (loginError) {
                alert('เข้าสู่ระบบล้มเหลว: ' + (loginError.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
                console.error('Login Error during re-attempt:', loginError);
                return;
            }
        } else {
            alert('ลงทะเบียนไม่สำเร็จ: ' + (error.message || 'เกิดข้อผิดพลาด'));
            console.error('Registration Error:', error);
            return;
        }
    }

    if (currentUser && currentUser.uid) { // Ensure currentUser and its uid are available
        console.log("Attempting to fetch user document from Firestore for UID:", currentUser.uid);
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            console.log("Firestore: User document found.");
            const userDataFromFirestore = userDoc.data();
            localStorage.setItem('userRole', userDataFromFirestore.role); // Ensure correct role
            localStorage.setItem('userId', currentUser.uid); // Store UID for future reference
            localStorage.setItem('userStars', userDataFromFirestore.stars || 0); // Store stars
            // NEW: Store user's subdistrict for farmer filtering
            if (userDataFromFirestore.role === 'farmer' && userDataFromFirestore.subDistrict) {
                localStorage.setItem('userSubDistrict', userDataFromFirestore.subDistrict);
            }


            // Navigate based on actual role from Firestore
            if (userDataFromFirestore.role === 'school') {
                loadSchoolDashboard();
            } else if (userDataFromFirestore.role === 'farmer') {
                loadFarmerDashboard();
            }
        } else {
            console.error("Firestore Error: User document NOT found for UID:", currentUser.uid, ". This user exists in Auth but not Firestore. Automatic logout initiated.");
            alert('ไม่พบข้อมูลโปรไฟล์ผู้ใช้ กรุณาลงทะเบียนใหม่');
            await auth.signOut(); // Log out if profile not found
            loadMainPage(); // Fallback
        }
    } else {
        console.error("handleAuthSubmission final check: currentUser or currentUser.uid is missing after all attempts.");
        alert("เกิดข้อผิดพลาดภายในระบบ: ไม่สามารถยืนยันผู้ใช้ได้");
        loadMainPage(); // Fallback if current user somehow becomes invalid
    }
}

async function genericLoginAttempt(email, password) {
    // Basic frontend validation for password length
    if (password.length < 6) {
        alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        return;
    }
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const currentUser = userCredential.user;
        
        // --- IMPORTANT: Robust check for currentUser and UID ---
        if (!currentUser || !currentUser.uid) {
            console.error("Auth Error: currentUser or UID is undefined after signInWithEmailAndPassword (generic).");
            alert('เข้าสู่ระบบล้มเหลว: ไม่สามารถระบุผู้ใช้ได้');
            await auth.signOut();
            loadMainPage();
            return;
        }
        console.log("Firebase Auth: Generic login successful. UID:", currentUser.uid);
        // --- END IMPORTANT CHECK ---

        localStorage.setItem('userId', currentUser.uid); // Store UID for future reference

        console.log("Attempting to fetch user document from Firestore for UID:", currentUser.uid);
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            console.log("Firestore: User document found during generic login.");
            const userDataFromFirestore = userDoc.data();
            localStorage.setItem('userRole', userDataFromFirestore.role);
            localStorage.setItem('userStars', userDataFromFirestore.stars || 0);
            // NEW: Store user's subdistrict for farmer filtering
            if (userDataFromFirestore.role === 'farmer' && userDataFromFirestore.subDistrict) {
                localStorage.setItem('userSubDistrict', userDataFromFirestore.subDistrict);
            }

            alert('เข้าสู่ระบบสำเร็จ!');
            if (userDataFromFirestore.role === 'school') {
                loadSchoolDashboard();
            } else if (userDataFromFirestore.role === 'farmer') {
                loadFarmerDashboard();
            }
        } else {
            console.error("Firestore Error: User document NOT found for UID:", currentUser.uid, ". This user exists in Auth but not Firestore. Automatic logout initiated.");
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

    console.log(`Rendering data blocks for ${targetWrapperId}. Data received COUNT:`, data.length, "Data:", data);

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
        // NEW: Get school's full address for display
        const schoolFullAddress = item.schoolInfo ? 
            `${item.schoolInfo.address || ''} ${item.schoolInfo.subdistrict || ''} ${item.schoolInfo.district || ''} ${item.schoolInfo.province || ''}`.trim() : 'ไม่ระบุที่อยู่';


        // Build action buttons for each block
        let actionButtonsHtml = '';
        if (targetWrapperId === '#schoolDataBlocks') { // School Dashboard
            // --- IMPORTANT: Changed "scan-qr-button" back to "delete-button" on school dashboard ---
            if (item.schoolId === userId && !item.isDelivered) {
                actionButtonsHtml += `<button class="delete-button" data-id="${item.id}">ลบ</button>`;
            } else if (item.schoolId === userId && item.isDelivered) {
                // Show status if delivered
                actionButtonsHtml += `<p class="status-delivered">ส่งมอบแล้ว</p>`; 
            }
            // Other school posts (not owned by current school user) will not have buttons on this dashboard.
        } else if (targetWrapperId === '#farmerDataBlocks') { // Farmer Dashboard (available posts)
            // ถ้ายังไม่มีเกษตรกรคนไหนรับ
            if (!item.isReceived) {
                actionButtonsHtml += `
                    <button class="receive-waste-button" data-id="${item.id}">รับเศษอาหาร</button>
                    <button class="details-button" data-id="${item.id}">รายละเอียด</button>
                `;
            } else if (item.isReceived) { // ถ้ารับไปแล้วโดยเกษตรกรคนใดคนหนึ่ง
                actionButtonsHtml += `
                    <p class="received-status">รับแล้ว</p>
                    <button class="details-button" data-id="${item.id}">รายละเอียด</button>
                `;
            }
        } else if (targetWrapperId === '#pendingDeliveryBlocks' && userRole === 'school') { // School's Pending Delivery List
            // เฉพาะรายการที่เกษตรกรรับแล้วแต่โรงเรียนยังไม่ได้ยืนยันการส่งมอบ
            if (item.isReceived && !item.isDelivered) {
                actionButtonsHtml += `
                    <button class="scan-qr-button" data-id="${item.id}">สแกน QR Code เพื่อยืนยัน</button>
                `;
            }
        } else if (targetWrapperId === '#receivedWasteBlocks' && userRole === 'farmer') { // Farmer's Received Waste List
            // ถ้าเป็นรายการที่เกษตรกรคนนี้รับไปแล้ว
            if (item.receivedBy === userId) {
                actionButtonsHtml += `
                    <p>สถานะ: <span class="${item.isDelivered ? 'status-delivered' : 'status-pending'}">${item.isDelivered ? 'ส่งมอบแล้ว' : 'รอส่งมอบ'}</span></p>
                    <button class="show-qr-button" data-id="${item.id}">แสดง QR Code</button> `;
            }
        }


        dataBlock.innerHTML = `
            <img src="${item.imageUrl || 'https://placehold.co/150x120/ADD8E6/000000?text=No+Image'}" alt="Waste Image" class="data-item-image">
            <div class="data-item-details">
                <p><strong>เมนู:</strong> ${item.menu}</p>
                <p><strong>ปริมาณ:</strong> ${item.weight} kg</p>
                <p><strong>วันที่:</strong> ${date} (${postedAt})</p>
                <p><strong>จาก:</strong> ${schoolName}</p>
                <p><strong>ที่อยู่:</strong> ${schoolFullAddress}</p> <p><strong>ติดต่อ:</strong> ${schoolContact}</p>
            </div>
            <div class="data-block-actions"> ${actionButtonsHtml}
            </div>
        `;
        wrapper.appendChild(dataBlock);
    });

    // Attach event listeners after rendering all blocks
    if (userRole === 'school' && targetWrapperId === '#schoolDataBlocks') {
        wrapper.querySelectorAll('.delete-button').forEach(button => { // Re-attached delete listener for school dashboard
            console.log("Attaching delete listener to school dashboard item.");
            button.addEventListener('click', (e) => {
                const wasteId = e.target.dataset.id;
                showConfirmationModal('คุณแน่ใจหรือไม่ที่จะลบข้อมูลนี้?', () => deleteWasteEntry(wasteId));
            });
        });
    } else if (userRole === 'farmer' && targetWrapperId === '#farmerDataBlocks') {
        wrapper.querySelectorAll('.details-button').forEach(button => {
            console.log("Attaching farmer details listener");
            button.addEventListener('click', (e) => {
                const postId = e.target.dataset.id;
                loadPostDetails(postId);
            });
        });
        wrapper.querySelectorAll('.receive-waste-button').forEach(button => {
            console.log("Attaching receive listener");
            button.addEventListener('click', (e) => {
                const wasteId = e.target.dataset.id;
                showConfirmationModal('คุณต้องการรับเศษอาหารนี้หรือไม่?', () => handleReceiveWaste(wasteId));
            });
        });
    } else if (userRole === 'school' && targetWrapperId === '#pendingDeliveryBlocks') {
        wrapper.querySelectorAll('.scan-qr-button').forEach(button => {
            console.log("Attaching scan-qr listener for pending delivery"); // Specific log
            button.addEventListener('click', (e) => {
                const wasteId = e.target.dataset.id;
                showConfirmationModal('คุณแน่ใจหรือไม่ที่จะยืนยันการส่งมอบเศษอาหารนี้?', async () => {
                    const qrValue = prompt('กรุณากรอก Waste ID ที่แสดงบน QR Code ของเกษตรกรเพื่อยืนยันการส่งมอบ');
                    if (qrValue && qrValue === wasteId) {
                        await handleConfirmDelivery(wasteId);
                    } else if (qrValue) {
                        alert('รหัส QR Code ไม่ตรงกับรายการที่เลือก');
                    } else {
                        alert('การยืนยันถูกยกเลิก');
                    }
                });
            });
        });
    } else if (userRole === 'farmer' && targetWrapperId === '#receivedWasteBlocks') {
        wrapper.querySelectorAll('.show-qr-button').forEach(button => {
            console.log("Attaching show-qr listener for received waste"); // Specific log
            button.addEventListener('click', (e) => {
                const wasteId = e.target.dataset.id;
                loadQRCodeDisplayPage(wasteId);
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
        document.getElementById('backFromEditProfile').addEventListener('click', () => {
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
        document.getElementById('backFromQRScan').addEventListener('click', loadReceivedWastePage); // Changed to go back to received waste list for farmer
    }


    // --- Page Specific Event Listeners ---
    if (document.getElementById('purposeSelect')) {
        document.getElementById('purposeSelect').addEventListener('change', toggleOtherPurposeInput);
    }
    if (document.getElementById('editPurposeSelect')) { // For edit profile page
        document.getElementById('editPurposeSelect').addEventListener('change', toggleEditOtherPurposeInput);
    }
    // NEW: Add event listeners for school address dropdowns
    if (document.getElementById('provinceSelect')) {
        document.getElementById('provinceSelect').addEventListener('change', () => populateDistricts('provinceSelect', 'districtSelect', 'subdistrictSelect'));
    }
    if (document.getElementById('districtSelect')) {
        document.getElementById('districtSelect').addEventListener('change', () => populateSubdistricts('districtSelect', 'subdistrictSelect'));
    }
    // NEW: Add event listeners for edit school address dropdowns
    if (document.getElementById('editProvinceSelect')) {
        document.getElementById('editProvinceSelect').addEventListener('change', () => populateDistricts('editProvinceSelect', 'editDistrictSelect', 'editSubdistrictSelect'));
    }
    if (document.getElementById('editDistrictSelect')) {
        document.getElementById('editDistrictSelect').addEventListener('change', () => populateSubdistricts('editDistrictSelect', 'editSubdistrictSelect'));
    }

    // NEW: Add event listeners for farmer address dropdowns
    if (document.getElementById('farmerProvince')) {
        document.getElementById('farmerProvince').addEventListener('change', () => populateDistricts('farmerProvince', 'farmerDistrict', 'farmerSubDistrict'));
    }
    if (document.getElementById('farmerDistrict')) {
        document.getElementById('farmerDistrict').addEventListener('change', () => populateSubdistricts('farmerDistrict', 'farmerSubDistrict'));
    }
    // NEW: Add event listeners for edit farmer address dropdowns
    if (document.getElementById('editFarmerProvince')) {
        document.getElementById('editFarmerProvince').addEventListener('change', () => populateDistricts('editFarmerProvince', 'editFarmerDistrict', 'editFarmerSubDistrict'));
    }
    if (document.getElementById('editFarmerDistrict')) {
        document.getElementById('editFarmerDistrict').addEventListener('change', () => populateSubdistricts('editFarmerDistrict', 'editFarmerSubDistrict'));
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
                province: formData.get('province'),
                district: formData.get('district'),
                subdistrict: formData.get('subdistrict'),
                contactNumber: formData.get('contactNumber')
            };
            await handleAuthSubmission(email, password, 'school', additionalData);
        });
        populateProvinces('provinceSelect'); // Populate provinces when school login page loads
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

            // NEW: Address fields for farmer
            const address = formData.get('address');
            const province = formData.get('province');
            const district = formData.get('district');
            const subDistrict = formData.get('subDistrict');

            // --- IMPORTANT FIX: Filter out undefined otherPurpose before sending ---
            const additionalData = {
                name: formData.get('name'),
                contactNumber: formData.get('contactNumber'),
                address: address, // NEW
                province: province, // NEW
                district: district, // NEW
                subDistrict: subDistrict, // NEW
                purpose: purpose,
                ...(purpose === 'other' && otherPurpose.trim() !== '' ? { otherPurpose: otherPurpose } : {}) // Only add otherPurpose if 'other' is selected and it has a value
            };
            // --- END IMPORTANT FIX ---

            if (purpose === 'other' && !otherPurpose.trim()) {
                alert('กรุณาระบุความต้องการอื่นๆ');
                return;
            }

            await handleAuthSubmission(email, password, 'farmer', additionalData);
        });
        populateProvinces('farmerProvince'); // Populate provinces for farmer login
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
            const userId = auth.currentUser ? auth.currentUser.uid : null;
            if (!userId) { alert('กรุณาเข้าสู่ระบบเพื่อแก้ไขโปรไฟล์'); return; }
            
            const formData = new FormData(editProfileForm);
            const userRole = localStorage.getItem('userRole');
            
            let updateData = {};

            if (userRole === 'school') {
                updateData = cleanObject({
                    instituteName: formData.get('instituteName'),
                    province: formData.get('province'),
                    district: formData.get('district'),
                    subdistrict: formData.get('subdistrict'),
                    contactNumber: formData.get('contactNumber')
                });
            } else if (userRole === 'farmer') {
                const purpose = formData.get('purpose');
                const otherPurpose = formData.get('otherPurpose');
                updateData = cleanObject({
                    name: formData.get('name'),
                    contactNumber: formData.get('contactNumber'),
                    address: formData.get('address'),
                    province: formData.get('province'),
                    district: formData.get('district'),
                    subDistrict: formData.get('subDistrict'),
                    purpose: purpose,
                    ...(purpose === 'other' && otherPurpose.trim() !== '' ? { otherPurpose: otherPurpose } : {})
                });
            }

            if (formData.get('password')) { // Only update password if provided
                const newPassword = formData.get('password');
                if (newPassword.length < 6) {
                    alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
                    return;
                }
                try {
                    await auth.currentUser.updatePassword(newPassword);
                    console.log("Password updated successfully.");
                } catch (passwordError) {
                    console.error("Error updating password:", passwordError);
                    alert("ไม่สามารถเปลี่ยนรหัสผ่านได้: " + passwordError.message);
                    return;
                }
            }
            
            try {
                await db.collection('users').doc(userId).update(cleanObject(updateData)); // Use cleanObject
                alert('บันทึกข้อมูลสำเร็จ!');
                // Reload dashboard based on role
                if (userRole === 'school') {
                    loadSchoolDashboard();
                } else if (userRole === 'farmer') {
                    loadFarmerDashboard();
                }
            } catch (firestoreUpdateError) {
                console.error("Error updating user document:", firestoreUpdateError);
                alert("ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้: " + firestoreUpdateError.message);
            }
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
                        <img src="images/school.jpg" alt="รูปภาพโรงเรียน" class="card-image">
                        <button class="button" id="schoolButton">โรงเรียน</button>
                    </div>
                    <p class="card-description-text">คลิกที่นี่เพื่อลงทะเบียนและจัดการเศษอาหารเหลือจากโรงเรียนของคุณ</p>
                </div>
                <div class="card-with-description">
                    <div class="card">
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
                    <label for="provinceSelect">จังหวัด</label>
                    <select id="provinceSelect" name="province" required>
                        <option value="">-- เลือกจังหวัด --</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="districtSelect">อำเภอ</label>
                    <select id="districtSelect" name="district" required disabled>
                        <option value="">-- เลือกอำเภอ --</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="subdistrictSelect">ตำบล</label>
                    <select id="subdistrictSelect" name="subdistrict" required disabled>
                        <option value="">-- เลือกตำบล --</option>
                    </select>
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
                    <label for="farmerAddress">ที่อยู่ (บ้านเลขที่, ถนน, ซอย)</label>
                    <input type="text" id="farmerAddress" name="address" required>
                </div>
                <div class="form-group">
                    <label for="farmerProvince">จังหวัด</label>
                    <select id="farmerProvince" name="province" required>
                        <option value="">-- เลือกจังหวัด --</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="farmerDistrict">อำเภอ/เขต</label>
                    <select id="farmerDistrict" name="district" required disabled>
                        <option value="">-- เลือกอำเภอ/เขต --</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="farmerSubDistrict">ตำบล/แขวง</label>
                    <select id="farmerSubDistrict" name="subDistrict" required disabled>
                        <option value="">-- เลือกตำบล/แขวง --</option>
                    </select>
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
                <div class="form-group" id="otherPurposeInput" style="display:none;">
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
                    <p><strong>ที่อยู่:</strong> ${postData.schoolInfo ? `${postData.schoolInfo.subdistrict}, ${postData.schoolInfo.district}, ${postData.schoolInfo.province}` : 'ไม่ระบุ'}</p>
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
    // School fields
    const instituteName = userData.instituteName || '';
    const schoolProvince = userData.province || '';
    const schoolDistrict = userData.district || '';
    const schoolSubdistrict = userData.subdistrict || '';
    const schoolContactNumber = userData.contactNumber || '';
    // Farmer fields
    const farmerName = userData.name || '';
    const farmerContactNumber = userData.contactNumber || '';
    const farmerAddress = userData.address || '';
    const farmerProvince = userData.province || '';
    const farmerDistrict = userData.district || '';
    const farmerSubDistrict = userData.subDistrict || ''; // Note: original used subDistrict, keep consistent.
    const purpose = userData.purpose || '';
    const otherPurpose = userData.otherPurpose || '';
    const email = userData.email || '';

    let roleSpecificFields = '';
    if (userRole === 'school') {
        roleSpecificFields = `
            <div class="form-group">
                <label for="editInstituteName">ชื่อสถาบัน</label>
                <input type="text" id="editInstituteName" name="instituteName" value="${instituteName}" required>
            </div>
            <div class="form-group">
                <label for="editProvinceSelect">จังหวัด</label>
                <select id="editProvinceSelect" name="province" required>
                    <option value="">-- เลือกจังหวัด --</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editDistrictSelect">อำเภอ</label>
                <select id="editDistrictSelect" name="district" required disabled>
                    <option value="">-- เลือกอำเภอ --</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editSubdistrictSelect">ตำบล</label>
                <select id="editSubdistrictSelect" name="subdistrict" required disabled>
                    <option value="">-- เลือกตำบล --</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editContactNumber">เบอร์ติดต่อ</label>
                <input type="tel" id="editContactNumber" name="contactNumber" value="${schoolContactNumber}" required>
            </div>
        `;
    } else if (userRole === 'farmer') {
         roleSpecificFields = `
            <div class="form-group">
                <label for="editFarmerName">ชื่อ</label>
                <input type="text" id="editFarmerName" name="name" value="${farmerName}" required>
            </div>
            <div class="form-group">
                <label for="editFarmerContactNumber">เบอร์ติดต่อ</label>
                <input type="tel" id="editFarmerContactNumber" name="contactNumber" value="${farmerContactNumber}" required>
            </div>
            <div class="form-group">
                <label for="editFarmerAddress">ที่อยู่ (บ้านเลขที่, ถนน, ซอย)</label>
                <input type="text" id="editFarmerAddress" name="address" value="${farmerAddress}" required>
            </div>
            <div class="form-group">
                <label for="editFarmerProvince">จังหวัด</label>
                <select id="editFarmerProvince" name="province" required>
                    <option value="">-- เลือกจังหวัด --</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editFarmerDistrict">อำเภอ/เขต</label>
                <select id="editFarmerDistrict" name="district" required disabled>
                    <option value="">-- เลือกอำเภอ/เขต --</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editFarmerSubDistrict">ตำบล/แขวง</label>
                <select id="editFarmerSubDistrict" name="subDistrict" required disabled>
                    <option value="">-- เลือกตำบล/แขวง --</option>
                </select>
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
                    <li><strong>นำไปใช้ประโยชน์:</b> หากเป็นไปได้ ลองนำเศษอาหารไปทำปุ๋ยหมักเองที่บ้าน หรือหาแหล่งรับซื้อ/รับบริจาคเศษอาหารในชุมชน</li>
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
            const receivedAt = item.receivedAt ? new Date(item.receivedAt.toDate()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ไม่ระบุ';
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
            const receivedAt = item.receivedAt ? new Date(item.receivedAt.toDate()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ไม่ระบุ';
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
        let query = db.collection('wasteentries')
                      .where('isDelivered', '==', false); // Only show undelivered for general view

        // Get current farmer's subdistrict for sorting
        const currentUserSubDistrict = localStorage.getItem('userSubDistrict');
        let wasteData = [];

        // First, fetch items from the same subdistrict if the user has one
        if (currentUserSubDistrict) {
            // Need to first query users to find schools in the same subDistrict
            const schoolsInSameSubDistrictSnapshot = await db.collection('users')
                .where('role', '==', 'school')
                .where('subdistrict', '==', currentUserSubDistrict)
                .get();
            const schoolIdsInSameSubDistrict = schoolsInSameSubDistrictSnapshot.docs.map(doc => doc.id);

            if (schoolIdsInSameSubDistrict.length > 0) {
                const sameSubDistrictQuery = query.where('schoolId', 'in', schoolIdsInSameSubDistrict)
                                                   .orderBy('postedAt', 'desc');
                const sameSubDistrictSnapshot = await sameSubDistrictQuery.get();
                for (const doc of sameSubDistrictSnapshot.docs) {
                    const item = { id: doc.id, ...doc.data() };
                    const schoolDoc = await db.collection('users').doc(item.schoolId).get();
                    if (schoolDoc.exists) {
                        item.schoolInfo = schoolDoc.data();
                    }
                    wasteData.push(item);
                }
            }
        }
        
        // Then, fetch all other items (not in the same subdistrict or if user has no subdistrict)
        // This part is tricky with Firestore due to query limitations (cannot combine 'in' with 'not-in' easily).
        // A common pattern is to fetch all relevant data and then filter/sort client-side for complex logic.
        // For simplicity, we'll fetch all *other* undelivered items and then merge and sort.
        // This might result in duplicate fetches if `schoolId` 'in' is not optimized by Firestore for 'not-in' context.
        // A more robust solution for large datasets might involve separate 'all' fetch then filter, or cloud functions.

        // For now, let's just fetch all undelivered and then sort client-side after merging
        // This will ensure all data is present and then we can sort as required.
        const allWasteEntriesSnapshot = await db.collection('wasteentries')
            .where('isDelivered', '==', false)
            .orderBy('postedAt', 'desc')
            .get();

        let allFetchedWasteData = [];
        for (const doc of allWasteEntriesSnapshot.docs) {
            const item = { id: doc.id, ...doc.data() };
            // Manually fetch school info for display
            if (item.schoolId) {
                const schoolDoc = await db.collection('users').doc(item.schoolId).get();
                if (schoolDoc.exists) {
                    item.schoolInfo = schoolDoc.data();
                }
            }
            allFetchedWasteData.push(item);
        }

        // Apply client-side sorting: same subdistrict first, then by postedAt
        if (currentUserSubDistrict) {
            allFetchedWasteData.sort((a, b) => {
                const aInSameSubDistrict = a.schoolInfo && a.schoolInfo.subdistrict === currentUserSubDistrict;
                const bInSameSubDistrict = b.schoolInfo && b.schoolInfo.subdistrict === currentUserSubDistrict;

                if (aInSameSubDistrict && !bInSameSubDistrict) return -1; // a comes first
                if (!aInSameSubDistrict && bInSameSubDistrict) return 1;  // b comes first
                
                // If both are in same subdistrict or both are not, sort by postedAt
                const timeA = a.postedAt ? a.postedAt.toMillis() : 0;
                const timeB = b.postedAt ? b.postedAt.toMillis() : 0;
                return timeB - timeA; // Newest first
            });
        } else {
            // If no user subdistrict, just sort by postedAt
            allFetchedWasteData.sort((a, b) => {
                const timeA = a.postedAt ? a.postedAt.toMillis() : 0;
                const timeB = b.postedAt ? b.postedAt.toMillis() : 0;
                return timeB - timeA; // Newest first
            });
        }


        // Apply client-side filters for menu and schoolName AFTER sorting by location
        if (filters.menu) {
            allFetchedWasteData = allFetchedWasteData.filter(item => item.menu.toLowerCase().includes(filters.menu.toLowerCase()));
        }
        if (filters.schoolName) {
            allFetchedWasteData = allFetchedWasteData.filter(item => item.schoolInfo && item.schoolInfo.instituteName.toLowerCase().includes(filters.schoolName.toLowerCase()));
        }

        renderDataBlocks(allFetchedWasteData, '#farmerDataBlocks');

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
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
        loadMainPage();
        return;
    }
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            alert('ไม่พบข้อมูลผู้ใช้');
            loadMainPage();
            return;
        }
        const userData = userDoc.data();
        loadContent(getEditProfilePageHtml(userData)); // Load with initial data

        // Populate form fields
        document.getElementById('editEmail').value = userData.email || '';
        
        const userRole = localStorage.getItem('userRole');

        if (userRole === 'school') {
            if (document.getElementById('editInstituteName')) document.getElementById('editInstituteName').value = userData.instituteName || '';
            if (document.getElementById('editContactNumber')) document.getElementById('editContactNumber').value = userData.contactNumber || '';
            
            // Populate address dropdowns for school edit profile
            populateProvinces('editProvinceSelect', userData.province);
            if (userData.province) {
                // Pass a temporary data attribute to store the district/subdistrict for pre-selection
                const districtSelect = document.getElementById('editDistrictSelect');
                const subdistrictSelect = document.getElementById('editSubdistrictSelect');
                if (districtSelect) districtSelect.dataset.preselected = userData.district || '';
                if (subdistrictSelect) subdistrictSelect.dataset.preselected = userData.subdistrict || '';

                await populateDistricts('editProvinceSelect', 'editDistrictSelect', 'editSubdistrictSelect', userData.district);
                if (userData.district) {
                    await populateSubdistricts('editDistrictSelect', 'editSubdistrictSelect', userData.subdistrict);
                }
            }
        } else if (userRole === 'farmer') {
            if (document.getElementById('editFarmerName')) document.getElementById('editFarmerName').value = userData.name || '';
            if (document.getElementById('editFarmerContactNumber')) document.getElementById('editFarmerContactNumber').value = userData.contactNumber || '';
            
            // NEW: Populate address fields for farmer
            if (document.getElementById('editFarmerAddress')) document.getElementById('editFarmerAddress').value = userData.address || '';
            
            const farmerProvinceSelect = document.getElementById('editFarmerProvince');
            if (farmerProvinceSelect) {
                farmerProvinceSelect.value = userData.province || '';
                // Trigger population of dependent dropdowns if province is set
                if (userData.province) {
                    // Pass a temporary data attribute to store the district/subDistrict for pre-selection
                    const farmerDistrictSelect = document.getElementById('editFarmerDistrict');
                    const farmerSubDistrictSelect = document.getElementById('editFarmerSubDistrict');
                    if (farmerDistrictSelect) farmerDistrictSelect.dataset.preselected = userData.district || '';
                    if (farmerSubDistrictSelect) farmerSubDistrictSelect.dataset.preselected = userData.subDistrict || ''; // Note: original used subDistrict

                    await populateDistricts('editFarmerProvince', 'editFarmerDistrict', 'editFarmerSubDistrict', userData.district);
                    if (userData.district) {
                        await populateSubdistricts('editFarmerDistrict', 'editFarmerSubDistrict', userData.subDistrict); // Note: original used subDistrict
                    }
                }
            }


            const purposeSelect = document.getElementById('editPurposeSelect');
            if (purposeSelect) {
                purposeSelect.value = userData.purpose || '';
                const editOtherPurposeInput = document.getElementById('editOtherPurposeInput');
                if (editOtherPurposeInput) {
                    editOtherPurposeInput.style.display = (userData.purpose === 'other' ? 'block' : 'none');
                    document.getElementById('editOtherPurpose').value = userData.otherPurpose || '';
                }
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

// --- Thai Location Data (Simplified Example) ---
// In a real application, you would load this from a more comprehensive source (e.g., JSON file, API)
const thaiLocations = {
    "ภูเก็ต": {
    "เมืองภูเก็ต": ["ตลาดใหญ่", "ตลาดเหนือ", "รัษฎา", "วิชิต", "ฉลอง", "เกาะแก้ว", "ราไวย์", "กะรน"],
    "กะทู้": ["กะทู้", "ป่าตอง", "กมลา"],
    "ถลาง": ["เทพกระษัตรี", "ศรีสุนทร", "เชิงทะเล", "ป่าคลอก", "ไม้ขาว", "สาคู"]
    },
    "กระบี่": {
        "เมืองกระบี่": ["กระบี่ใหญ่", "กระบี่น้อย", "ไสไทย"],
        "อ่าวลึก": ["อ่าวลึกเหนือ", "แหลมสัก"]
    },
    "พังงา": {
        "เมืองพังงา": ["ท้ายช้าง", "ถ้ำน้ำผุด"],
        "ตะกั่วป่า": ["ตะกั่วป่า", "บางนายสี"]
    }
    // Add more provinces, districts, subdistricts as needed
};

function populateProvinces(provinceSelectId, selectedProvince = '') {
    const provinceSelect = document.getElementById(provinceSelectId);
    if (!provinceSelect) return;

    provinceSelect.innerHTML = '<option value="">-- เลือกจังหวัด --</option>';
    for (const province in thaiLocations) {
        const option = document.createElement('option');
        option.value = province;
        option.textContent = province;
        if (province === selectedProvince) {
            option.selected = true;
        }
        provinceSelect.appendChild(option);
    }
    // Re-enable district select if a province is already selected (e.g., on edit profile)
    if (selectedProvince) {
        // Correctly determine districtSelectId and subdistrictSelectId based on provinceSelectId
        let districtSelectId, subdistrictSelectId;
        if (provinceSelectId.includes('edit')) {
            districtSelectId = provinceSelectId.replace('Province', 'District');
            subdistrictSelectId = provinceSelectId.replace('Province', 'Subdistrict');
        } else {
            districtSelectId = provinceSelectId.replace('province', 'district');
            subdistrictSelectId = provinceSelectId.replace('province', 'subdistrict');
        }

        const districtSelect = document.getElementById(districtSelectId);
        if (districtSelect) districtSelect.disabled = false;
    }
}

function populateDistricts(provinceSelectId, districtSelectId, subdistrictSelectId, selectedDistrict = '') {
    const provinceSelect = document.getElementById(provinceSelectId);
    const districtSelect = document.getElementById(districtSelectId);
    const subdistrictSelect = document.getElementById(subdistrictSelectId);

    districtSelect.innerHTML = '<option value="">-- เลือกอำเภอ --</option>';
    subdistrictSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
    districtSelect.disabled = true;
    subdistrictSelect.disabled = true;

    const selectedProvince = provinceSelect.value;
    if (selectedProvince && thaiLocations[selectedProvince]) {
        for (const district in thaiLocations[selectedProvince]) {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            if (district === selectedDistrict) {
                option.selected = true;
            }
            districtSelect.appendChild(option);
        }
        districtSelect.disabled = false;
    }
    // Re-populate subdistricts if a district is already selected (e.g., on edit profile)
    if (selectedDistrict) {
        populateSubdistricts(districtSelectId, subdistrictSelectId, subdistrictSelect.dataset.preselected || ''); // Use preselected value
    }
}

function populateSubdistricts(districtSelectId, subdistrictSelectId, selectedSubdistrict = '') {
    const districtSelect = document.getElementById(districtSelectId);
    const subdistrictSelect = document.getElementById(subdistrictSelectId);

    subdistrictSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
    subdistrictSelect.disabled = true;

    // Correctly determine provinceSelectId based on districtSelectId
    let provinceSelectId;
    if (districtSelectId.includes('edit')) {
        provinceSelectId = districtSelectId.replace('District', 'Province');
    } else if (districtSelectId.includes('farmer')) {
         provinceSelectId = districtSelectId.replace('District', 'Province'); // Handles farmer specific IDs
    }
    else {
        provinceSelectId = districtSelectId.replace('district', 'province');
    }

    const provinceSelect = document.getElementById(provinceSelectId);
    const selectedProvince = provinceSelect.value;
    const selectedDistrict = districtSelect.value;

    if (selectedProvince && selectedDistrict && thaiLocations[selectedProvince] && thaiLocations[selectedProvince][selectedDistrict]) {
        thaiLocations[selectedProvince][selectedDistrict].forEach(subdistrict => {
            const option = document.createElement('option');
            option.value = subdistrict;
            option.textContent = subdistrict;
            if (subdistrict === selectedSubdistrict) {
                option.selected = true;
            }
            subdistrictSelect.appendChild(option);
        });
        subdistrictSelect.disabled = false;
    }
}


// Function to load the main page and attach event listeners
function loadMainPage() {
    // Clear token and role on returning to main page (effectively logging out)
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('userStars'); // Clear stars on logout
    localStorage.removeItem('userSubDistrict'); // NEW: Clear farmer's subdistrict on logout
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
