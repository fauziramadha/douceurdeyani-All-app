module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { target, message } = req.body;
    
    // Ambil Token dan Session ID
    const token = process.env.FLOWKIRIM_TOKEN; 
    const sessionId = process.env.FLOWKIRIM_SESSION_ID; 

    // Format nomor sesuai Postman (wajib @s.whatsapp.net)
    let formattedTarget = target;
    if (!formattedTarget.includes('@s.whatsapp.net')) {
        formattedTarget = `${formattedTarget}@s.whatsapp.net`;
    }

    try {
        const response = await fetch('https://scan.flowkirim.com/api/whatsapp/messages/text', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                "session_id": sessionId,
                "message": message,
                "to": formattedTarget
            })
        });
        
        const data = await response.json();
        
        // PENCATAT OTOMATIS: Akan menuliskan alasan spesifik dari FlowKirim jika gagal
        console.log(`Status FlowKirim: ${response.status}`);
        console.log(`Alasan/Respon:`, JSON.stringify(data));

        if (response.ok) {
            res.status(200).json(data);
        } else {
            res.status(response.status).json(data);
        }
    } catch (error) {
        console.error("Gagal koneksi:", error.message);
        res.status(500).json({ error: error.message });
    }
}
