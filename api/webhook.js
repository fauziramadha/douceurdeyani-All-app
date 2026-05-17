module.exports = async function handler(req, res) {
    // Hanya menerima metode POST dari FlowKirim
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const body = req.body;
        // PENCATAT OTOMATIS: Untuk melihat bentuk data asli dari FlowKirim jika terjadi error
        console.log("Pesan masuk dari FlowKirim:", JSON.stringify(body));

        // 1. Ekstrak nomor WA dan isi pesan pelanggan (Mendukung beberapa variasi format API WhatsApp)
        const sender = body.sender || body.from || (body.data && body.data.from) || (body.message && body.message.from);
        const messageText = body.message || body.text || (body.data && body.data.message) || (body.message && body.message.text);

        // Jika data kosong atau berupa pesan dari grup/status, abaikan agar bot tidak error
        if (!sender || !messageText || sender.includes('status') || sender.includes('g.us')) {
            return res.status(200).json({ status: 'diabaikan', detail: 'Bukan pesan pribadi valid' });
        }

        // Membersihkan format nomor pengirim
        const cleanSender = sender.replace('@s.whatsapp.net', '');

        // 2. Minta Jawaban ke Dify (Gemini 2.5 Flash)
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
                "conversation_id": "", // Kosongkan agar Dify otomatis mengingat riwayat chat user
                "user": cleanSender // Nomor pelanggan dijadikan ID agar bot ingat siapa yang dilayani
            })
        });

        const difyData = await difyResponse.json();
        const aiAnswer = difyData.answer;

        if (!aiAnswer) {
            console.error("Gagal mendapat jawaban dari Dify:", difyData);
            return res.status(500).json({ error: 'Dify tidak menjawab' });
        }

        // 3. Kirim Balasan ke WhatsApp via FlowKirim (Menggunakan sistem penukar Session ID otomatis)
        const token = process.env.FLOWKIRIM_TOKEN;
        const deviceId = process.env.FLOWKIRIM_SESSION_ID; 

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
            return res.status(500).json({ error: 'Device ID FlowKirim terputus' });
        }
        const activeSessionId = sessionData.data.session_id;

        // Kirim Pesan
        let formattedTarget = cleanSender.includes('@s.whatsapp.net') ? cleanSender : `${cleanSender}@s.whatsapp.net`;
        const sendRes = await fetch('https://scan.flowkirim.com/api/whatsapp/messages/text', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                "session_id": activeSessionId,
                "message": aiAnswer,
                "to": formattedTarget
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
