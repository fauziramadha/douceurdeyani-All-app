module.exports = async function handler(req, res) {
    // Hanya izinkan method POST dari website Anda
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { target, message } = req.body;
    
    // Mengambil Token dan Session ID dari Vercel Env
    const token = process.env.FLOWKIRIM_TOKEN; 
    const sessionId = process.env.FLOWKIRIM_SESSION_ID; 

    // Aturan FlowKirim: Nomor WA harus berakhiran @s.whatsapp.net
    let formattedTarget = target;
    if (!formattedTarget.includes('@s.whatsapp.net')) {
        formattedTarget = `${formattedTarget}@s.whatsapp.net`;
    }

    try {
        // Menggunakan URL endpoint yang benar sesuai dokumentasi
        const response = await fetch('https://flowkirim.com/api/whatsapp/messages/text', {
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
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
