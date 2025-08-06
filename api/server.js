// Proxy สำหรับ OCR ID Card (ให้ frontend เรียก /api/ocr-id-front-iapp ได้)
app.post('/api/ocr-id-front-iapp', async (req, res) => {
  try {
    console.log('API /api/ocr-id-front-iapp ถูกเรียก', req.body);
    // รองรับทั้ง OCR และ Food Recognition
    const { idCardImageUrl, foodImageUrl } = req.body;
    if (idCardImageUrl) {
      // OCR ID Card
      const imageRes = await fetch(idCardImageUrl);
      if (!imageRes.ok) throw new Error('Failed to fetch image from URL');
      const imageBuffer = await imageRes.buffer();
      const form = new FormData();
      form.append('file', imageBuffer, { filename: 'idcard.jpg' });
      const ocrRes = await axios.post(
        'https://api.aiforthai.in.th/ocr-id-front-iapp',
        form,
        {
          headers: {
            ...form.getHeaders(),
            Apikey: process.env.AIFORTHAI_API_KEY,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );
      const ocrResult = ocrRes.data;
      console.log('OCR Result:', ocrResult);
      let extractedData = {
        idNumber: '',
        name: '',
        address: ''
      };
      if (ocrResult && ocrResult.result) {
        const result = ocrResult.result;
        if (result.idNumber) extractedData.idNumber = result.idNumber;
        if (result.name) extractedData.name = result.name;
        if (result.address) extractedData.address = result.address;
      }
      return res.json(extractedData);
    } else if (foodImageUrl) {
      // Food Recognition
      const imageRes = await fetch(foodImageUrl);
      if (!imageRes.ok) throw new Error('Failed to fetch image from URL');
      const imageBuffer = await imageRes.buffer();
      const form = new FormData();
      form.append('file', imageBuffer, { filename: 'food.jpg' });
      const foodRes = await axios.post(
        'https://api.aiforthai.in.th/thaifood',
        form,
        {
          headers: {
            ...form.getHeaders(),
            Apikey: process.env.AIFORTHAI_API_KEY,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );
      const foodResult = foodRes.data;
      console.log('Food Recognition Result:', foodResult);
      let extractedFoodData = {
        foodName: '',
        confidence: '',
        allResults: []
      };
      if (foodResult && foodResult.result && Array.isArray(foodResult.result)) {
        const topResult = foodResult.result[0];
        if (topResult) {
          extractedFoodData.foodName = topResult.food_name || '';
          extractedFoodData.confidence = topResult.confidence || '';
        }
        extractedFoodData.allResults = foodResult.result;
      }
      return res.json(extractedFoodData);
    } else {
      // ไม่พบข้อมูลที่ต้องการ
      return res.status(404).json({ error: 'No valid imageUrl provided (idCardImageUrl or foodImageUrl)' });
    }
  } catch (err) {
    console.error('Error in /api/summary:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ocr-id-front-iapp', async (req, res) => {
  try {
    console.log('API /api/ocr-id-front-iapp ถูกเรียก', req.body);
    const { idCardImageUrl } = req.body;
    if (!idCardImageUrl) {
      return res.status(400).json({ error: 'No idCardImageUrl provided' });
    }

    // 1. ดาวน์โหลดรูปจาก Firebase Storage
    const imageRes = await fetch(idCardImageUrl);
    if (!imageRes.ok) throw new Error('Failed to fetch image from URL');
    const imageBuffer = await imageRes.buffer();

    // 2. เตรียม FormData ส่งไป AIFORTHAI OCR
    const form = new FormData();
    form.append('file', imageBuffer, { filename: 'idcard.jpg' });

    // 3. ส่งไป AIFORTHAI OCR
    const ocrRes = await axios.post(
      'https://api.aiforthai.in.th/ocr-id-front-iapp',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Apikey: process.env.AIFORTHAI_API_KEY,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const ocrResult = ocrRes.data;
    console.log('OCR Result:', ocrResult);

    // 4. แยกข้อมูลที่ต้องการ (เลขบัตร, ชื่อ, ที่อยู่)
    let extractedData = {
      idNumber: '',
      name: '',
      address: ''
    };

    // ตรวจสอบและแยกข้อมูลจาก OCR result
    if (ocrResult && ocrResult.result) {
      const result = ocrResult.result;
      
      // หาเลขบัตรประชาชน (13 หลัก)
      if (result.idNumber) {
        extractedData.idNumber = result.idNumber;
      }
      
      // หาชื่อ
      if (result.name) {
        extractedData.name = result.name;
      }
      
      // หาที่อยู่
      if (result.address) {
        extractedData.address = result.address;
      }
    }

    // 5. เก็บผลลัพธ์ลง Firestore (เฉพาะข้อมูลที่ต้องการ)
    const saveData = {
      imageUrl: idCardImageUrl,
      extractedData: extractedData,
      fullOcrResult: ocrResult, // เก็บผลลัพธ์เต็มไว้ดู
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('idcard-ocr-results').add(saveData);

    // 6. ส่งผลลัพธ์กลับไป frontend (เฉพาะข้อมูลที่ต้องการ)
    res.json(extractedData);
  } catch (err) {
    console.error('Error in /api/summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// ระบบรู้จำอาหารไทย (Thai Food Image Recognition: T-Food)
app.post('/api/food-recognition', async (req, res) => {
  try {
    console.log('API /api/food-recognition ถูกเรียก', req.body);
    const { foodImageUrl } = req.body;
    console.log('[DEBUG] foodImageUrl:', foodImageUrl);
    console.log('[DEBUG] AIFORTHAI_API_KEY:', process.env.AIFORTHAI_API_KEY);
    if (!foodImageUrl) {
      console.error('[DEBUG] No foodImageUrl provided');
      return res.status(400).json({ error: 'No foodImageUrl provided' });
    }

    // 1. ดาวน์โหลดรูปอาหารจาก Firebase Storage หรือ URL
    let imageRes;
    try {
      imageRes = await fetch(foodImageUrl);
      console.log('[DEBUG] imageRes status:', imageRes.status, imageRes.statusText);
    } catch (fetchErr) {
      console.error('[DEBUG] Failed to fetch food image from URL:', fetchErr);
      return res.status(500).json({ error: 'Failed to fetch food image from URL', details: fetchErr.message });
    }
    if (!imageRes.ok) {
      console.error('[DEBUG] Image fetch response not ok:', imageRes.status, imageRes.statusText);
      return res.status(500).json({ error: 'Failed to fetch food image from URL', status: imageRes.status, statusText: imageRes.statusText });
    }

    let imageBuffer = await imageRes.buffer();
    console.log('[DEBUG] imageBuffer length:', imageBuffer.length);
    // ไม่ใช้ sharp ส่ง original image buffer ไป API

    // 2. เตรียม FormData ส่งไป AIFORTHAI T-Food API
    const form = new FormData();
    form.append('file', imageBuffer, { filename: 'food.jpg' });
    console.log('[DEBUG] FormData headers:', form.getHeaders());

    // 3. ส่งไป AIFORTHAI T-Food API
    let foodRes;
    try {
      foodRes = await axios.post(
        'https://api.aiforthai.in.th/thaifood',
        form,
        {
          headers: {
            ...form.getHeaders(),
            Apikey: process.env.AIFORTHAI_API_KEY,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );
      console.log('[DEBUG] AIFORTHAI API response status:', foodRes.status);
    } catch (apiErr) {
      console.error('[DEBUG] Error calling AIFORTHAI API:', apiErr.response ? apiErr.response.data : apiErr.message);
      if (apiErr.response && apiErr.response.data) {
        console.error('[DEBUG] Full error response:', apiErr.response.data);
      }
      return res.status(500).json({ error: 'AIFORTHAI API error', details: apiErr.response ? apiErr.response.data : apiErr.message });
    }

    const foodResult = foodRes.data;
    console.log('[DEBUG] Food Recognition Result:', foodResult);

    // 4. แยกข้อมูลที่ต้องการ (ชื่ออาหาร, ความมั่นใจ, ฯลฯ)
    let extractedFoodData = {
      foodName: '',
      confidence: '',
      allResults: []
    };

    if (foodResult && foodResult.result && Array.isArray(foodResult.result)) {
      // สมมติว่า API ส่ง array ของผลลัพธ์
      const topResult = foodResult.result[0];
      if (topResult) {
        extractedFoodData.foodName = topResult.food_name || '';
        extractedFoodData.confidence = topResult.confidence || '';
      }
      extractedFoodData.allResults = foodResult.result;
    } else {
      console.warn('[DEBUG] AIFORTHAI API response format unexpected:', foodResult);
    }

    // 5. เก็บผลลัพธ์ลง Firestore
    const saveData = {
      imageUrl: foodImageUrl,
      extractedFoodData: extractedFoodData,
      fullFoodResult: foodResult,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    try {
      await db.collection('food-recognition-results').add(saveData);
      console.log('[DEBUG] Saved food recognition result to Firestore');
    } catch (firestoreErr) {
      console.error('[DEBUG] Error saving food recognition result to Firestore:', firestoreErr);
    }

    // 6. ส่งผลลัพธ์กลับไป frontend
    res.json(extractedFoodData);
  } catch (err) {
    console.error('Error in /api/food-recognition:', err);
    res.status(500).json({ error: err.message });
  }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));
