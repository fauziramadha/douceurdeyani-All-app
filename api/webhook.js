module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const body = req.body;
        console.log("Pesan masuk dari FlowKirim:", JSON.stringify(body));

        // 1. Ekstrak data menggunakan format ASLI FlowKirim dari log
        const sender = body.senderNumber; 
        const messageText = body.messageText;
        const isFromMe = body.messageFromMe;

        // Jika pesan dari kita sendiri, pesan kosong, atau dari grup, hentikan proses agar bot tidak error
        if (isFromMe || !sender || !messageText || sender.includes('status') || body.isGroup) {
            return res.status(200).json({ status: 'diabaikan' });
        }

        // Bersihkan ID WhatsApp untuk memori Dify
        const cleanSender = sender.replace('@s.whatsapp.net', '');

        // 2. Minta Jawaban ke Dify (Gemini) menggunakan Environment Variables
        const difyKey = process.env.DIFY_API_KEY;
        const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${difyKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "inputs": {},
                "query": messageText,
                "response_mode": "blocking",
                "conversation_id": "", 
                "user": cleanSender 
            })
        });

        const difyData = await difyResponse.json();
        const aiAnswer = difyData.answer;

        if (!aiAnswer) {
            console.error("Gagal mendapat jawaban dari Dify:", difyData);
            return res.status(500).json({ error: 'Dify tidak menjawab' });
        }

        // 3. Kirim Balasan Otomatis via FlowKirim
        const token = process.env.FLOWKIRIM_TOKEN;
        // Menggunakan sessionDeviceId langsung dari webhook FlowKirim
        const deviceId = body.sessionDeviceId || process.env.FLOWKIRIM_SESSION_ID; 

        // Tukar Device ID menjadi Session ID Asli
        const sessionRes = await fetch(`https://scan.flowkirim.com/api/whatsapp/sessions/${deviceId}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const sessionData = await sessionRes.json();
        
        if (!sessionData.success || !sessionData.data || !sessionData.data.session_id) {
            return res.status(500).json({ error: 'Gagal menukar Session ID' });
        }
        const activeSessionId = sessionData.data.session_id;

        // Eksekusi pengiriman balasan ke WhatsApp pelanggan
        const sendRes = await fetch('https://scan.flowkirim.com/api/whatsapp/messages/text', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                "session_id": activeSessionId,
                "message": aiAnswer,
                "to": sender 
            })
        });

        const sendData = await sendRes.json();
        console.log("Status Balasan Terkirim:", JSON.stringify(sendData));

        res.status(200).json({ success: true, balasan_ai: aiAnswer });

    } catch (error) {
        console.error("Gagal Sistem:", error.message);
        res.status(500).json({ error: error.message });
    }
}
