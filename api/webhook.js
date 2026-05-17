module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const body = req.body;
        console.log("Pesan masuk dari FlowKirim:", JSON.stringify(body));

        const sender = body.senderNumber; 
        let messageText = body.messageText;
        const isFromMe = body.messageFromMe;
        const messageType = body.messageType;

        // --- LOGIKA BARU: DETEKSI GAMBAR ---
        // Jika pelanggan mengirim foto, ubah teksnya agar AI paham dan bisa merespons dengan sopan
        if (messageType === 'image' || messageType === 'imageMessage') {
            messageText = "[SISTEM: Pelanggan mengirim sebuah foto/gambar. Beritahu pelanggan dengan ramah bahwa saat ini sistem otomatis belum bisa melihat gambar, lalu tanyakan apa yang bisa dibantu.]";
        }

        if (isFromMe || !sender || !messageText || sender.includes('status') || body.isGroup) {
            return res.status(200).json({ status: 'diabaikan' });
        }

        const cleanSender = sender.replace('@s.whatsapp.net', '');
        const difyKey = process.env.DIFY_API_KEY;

        // 1. CARI BUKU CATATAN
        let convId = "";
        try {
            const historyRes = await fetch(`https://api.dify.ai/v1/conversations?user=${cleanSender}&limit=1`, {
                headers: { 'Authorization': `Bearer ${difyKey}` }
            });
            const historyData = await historyRes.json();
            if (historyData.data && historyData.data.length > 0) {
                convId = historyData.data[0].id; 
            }
        } catch (e) {
            console.error("Gagal cek riwayat:", e);
        }

        // 2. Minta Jawaban ke Dify (Dengan Fungsi Khusus)
        const timeNow = new Date().toLocaleString("id-ID", {timeZone: "Asia/Jakarta"});
        
        const askDify = async (cId) => {
            return await fetch('https://api.dify.ai/v1/chat-messages', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${difyKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "inputs": {},
                    "query": `[Waktu: ${timeNow}] Pelanggan bilang: ${messageText}`,
                    "response_mode": "blocking",
                    "conversation_id": cId, 
                    "user": cleanSender 
                })
            });
        };

        let difyResponse = await askDify(convId);
        let difyData = await difyResponse.json();

        // --- LOGIKA BARU: SELF-HEALING ---
        // Jika memori obrolan rusak (Error 400) karena kiriman foto sebelumnya atau hal lain,
        // Reset obrolan secara otomatis tanpa membuat bot mogok.
        if (difyResponse.status !== 200 || !difyData.answer) {
            console.log("Memori rusak terdeteksi. Mereset ke lembaran obrolan baru...");
            difyResponse = await askDify(""); // Tembak ulang dengan ID Obrolan Kosong
            difyData = await difyResponse.json();
        }

        const aiAnswer = difyData.answer;

        if (!aiAnswer) {
            console.error("Gagal mendapat jawaban dari Dify:", difyData);
            return res.status(500).json({ error: 'Dify tidak menjawab setelah reset' });
        }

        // 3. Kirim Balasan Otomatis via FlowKirim
        const token = process.env.FLOWKIRIM_TOKEN;
        const deviceId = body.sessionDeviceId || process.env.FLOWKIRIM_SESSION_ID; 

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
        
        const sendRes = await fetch('https://scan.flowkirim.com/api/whatsapp/messages/text', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                "session_id": sessionData.data.session_id,
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
