module.exports = async function handler(req, res) {
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

    // Trik Radar: Daftar kemungkinan alamat asli server FlowKirim
    const baseUrls = [
        'https://api.flowkirim.com',
        'https://app.flowkirim.com',
        'https://admin.flowkirim.com',
        'https://scan.flowkirim.com',
        'https://flowkirim.com'
    ];

    let lastError = null;
    let responseData = null;
    let isSuccess = false;

    // Vercel akan mencoba mengetuk pintu server ini satu per satu secara otomatis
    for (const baseUrl of baseUrls) {
        try {
            const url = `${baseUrl}/api/whatsapp/messages/text`;
            console.log(`Mencoba mengetuk pintu: ${url}`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json', // Tambahan sesuai dokumentasi mereka
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    "session_id": sessionId,
                    "message": message,
                    "to": formattedTarget
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                console.log(`BERHASIL! Pintu terbuka di: ${url}`, data);
                responseData = data;
                isSuccess = true;
                break; // Berhenti mencari karena pesan sudah berhasil terkirim
            } else {
                console.log(`Ditolak oleh ${url} (Status: ${response.status})`, data);
                lastError = data;
            }
        } catch (error) {
            console.log(`Pintu ${baseUrl} tertutup rapat/tidak ada.`);
            lastError = error.message;
        }
    }

    // Mengirim hasil akhir ke website Anda
    if (isSuccess) {
        res.status(200).json(responseData);
    } else {
        console.error("Gagal total di semua pintu. Laporan error terakhir:", lastError);
        res.status(500).json({ error: 'Semua alamat API gagal', detail: lastError });
    }
}
