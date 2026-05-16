module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { target, message } = req.body;
    
    // Di Vercel Env, variabel ini sebenarnya berisi Device ID Kakak
    const token = process.env.FLOWKIRIM_TOKEN; 
    const deviceId = process.env.FLOWKIRIM_SESSION_ID; 

    // Format nomor wajib @s.whatsapp.net
    let formattedTarget = target;
    if (!formattedTarget.includes('@s.whatsapp.net')) {
        formattedTarget = `${formattedTarget}@s.whatsapp.net`;
    }

    try {
        // ==========================================
        // LANGKAH 1: Tukar Device ID menjadi Session ID Asli
        // ==========================================
        const sessionResponse = await fetch(`https://scan.flowkirim.com/api/whatsapp/sessions/${deviceId}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const sessionData = await sessionResponse.json();
        
        // Cek apakah penukaran berhasil
        if (!sessionData.success || !sessionData.data || !sessionData.data.session_id) {
            console.error("Gagal mendapatkan Session ID asli:", sessionData);
            return res.status(500).json({ error: 'Device ID tidak valid / Disconnected', detail: sessionData });
        }

        const activeSessionId = sessionData.data.session_id; // Inilah kunci yang benar!

        // ==========================================
        // LANGKAH 2: Kirim Pesan dengan Session ID Asli
        // ==========================================
        const sendResponse = await fetch('https://scan.flowkirim.com/api/whatsapp/messages/text', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                "session_id": activeSessionId,
                "message": message,
                "to": formattedTarget
            })
        });
        
        const sendData = await sendResponse.json();
        console.log(`Status Pengiriman: ${sendResponse.status}`, JSON.stringify(sendData));

        if (sendResponse.ok) {
            res.status(200).json(sendData);
        } else {
            res.status(sendResponse.status).json(sendData);
        }
    } catch (error) {
        console.error("Gagal koneksi:", error.message);
        res.status(500).json({ error: error.message });
    }
}
