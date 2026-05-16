export default async function handler(req, res) {
    // Hanya izinkan method POST dari website Anda
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { target, message } = req.body;
    // Mengambil token FlowKirim dari Vercel Env
    const token = process.env.FLOWKIRIM_TOKEN; 

    try {
        const response = await fetch('https://flowkirim.com/api/send', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                target: target,
                message: message
            })
        });
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
